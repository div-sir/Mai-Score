import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { BlobPreconditionFailedError, del, get, put } from "@vercel/blob";
import { parsePassport, type PublicPassport } from "./passport";
import { normalizePassportSlug } from "./passport-slug";

const STORED_PASSPORT_SCHEMA = "mai-score/stored-passport/v1" as const;
const TOKEN_BYTES = 32;
const MAX_STORED_BYTES = 16_000;

interface StoredPassport {
  schema: typeof STORED_PASSPORT_SCHEMA;
  slug: string;
  editTokenHash: string;
  createdAt: string;
  updatedAt: string;
  passport: PublicPassport;
}

export interface PassportObjectStorage {
  read(path: string): Promise<{ body: string; etag: string } | undefined>;
  create(path: string, body: string): Promise<void>;
  update(path: string, body: string, etag: string): Promise<void>;
  delete(path: string, etag: string): Promise<void>;
}

export class PassportConflictError extends Error {}
export class PassportNotFoundError extends Error {}
export class PassportAuthorizationError extends Error {}
export class PassportStorageUnavailableError extends Error {}

export function passportStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function requirePassportStorage(): void {
  if (!passportStorageConfigured()) throw new PassportStorageUnavailableError("Persistent Passports are not configured on this deployment yet.");
}

export function createPassportEditToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashPassportEditToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyPassportEditToken(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPassportEditToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function pathname(slug: string): string {
  return `passports/v1/${normalizePassportSlug(slug)}.json`;
}

function parseStoredPassport(value: unknown): StoredPassport {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid stored Passport.");
  const input = value as Record<string, unknown>;
  if (input.schema !== STORED_PASSPORT_SCHEMA) throw new Error("Unsupported stored Passport version.");
  const slug = normalizePassportSlug(input.slug);
  if (typeof input.editTokenHash !== "string" || !/^[a-f0-9]{64}$/.test(input.editTokenHash)) {
    throw new Error("Invalid stored Passport owner key.");
  }
  const createdAt = typeof input.createdAt === "string" ? input.createdAt : "";
  const updatedAt = typeof input.updatedAt === "string" ? input.updatedAt : "";
  if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt))) {
    throw new Error("Invalid stored Passport timestamp.");
  }
  return {
    schema: STORED_PASSPORT_SCHEMA,
    slug,
    editTokenHash: input.editTokenHash,
    createdAt,
    updatedAt,
    passport: parsePassport(input.passport)
  };
}

const vercelPassportStorage: PassportObjectStorage = {
  async read(path) {
    requirePassportStorage();
    const blob = await get(path, { access: "private", useCache: false });
    if (!blob) return undefined;
    return { body: await new Response(blob.stream).text(), etag: blob.blob.etag };
  },
  async create(path, body) {
    requirePassportStorage();
    await put(path, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 60,
      contentType: "application/json"
    });
  },
  async update(path, body, etag) {
    requirePassportStorage();
    await put(path, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      ifMatch: etag,
      cacheControlMaxAge: 60,
      contentType: "application/json"
    });
  },
  async delete(path, etag) {
    requirePassportStorage();
    await del(path, { ifMatch: etag });
  }
};

async function readStoredPassport(slug: string, storage: PassportObjectStorage): Promise<{ record: StoredPassport; etag: string } | undefined> {
  const blob = await storage.read(pathname(slug));
  if (!blob) return undefined;
  const text = blob.body;
  if (new TextEncoder().encode(text).length > MAX_STORED_BYTES) throw new Error("Stored Passport is too large.");
  return { record: parseStoredPassport(JSON.parse(text)), etag: blob.etag };
}

export async function getPublishedPassport(
  slug: string,
  storage: PassportObjectStorage = vercelPassportStorage
): Promise<PublicPassport | undefined> {
  return (await readStoredPassport(slug, storage))?.record.passport;
}

export async function createPublishedPassport(
  requestedSlug: string,
  value: unknown,
  now = new Date().toISOString(),
  storage: PassportObjectStorage = vercelPassportStorage
): Promise<{ slug: string; editToken: string; passport: PublicPassport }> {
  const slug = normalizePassportSlug(requestedSlug);
  const passport = parsePassport(value);
  if (await readStoredPassport(slug, storage)) throw new PassportConflictError("That profile name is already in use.");
  const editToken = createPassportEditToken();
  const record: StoredPassport = {
    schema: STORED_PASSPORT_SCHEMA,
    slug,
    editTokenHash: hashPassportEditToken(editToken),
    createdAt: now,
    updatedAt: now,
    passport
  };
  try {
    await storage.create(pathname(slug), JSON.stringify(record));
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) {
      throw new PassportConflictError("That profile name was just claimed. Choose another name.");
    }
    throw error;
  }
  return { slug, editToken, passport };
}

export async function updatePublishedPassport(
  requestedSlug: string,
  editToken: string,
  value: unknown,
  now = new Date().toISOString(),
  storage: PassportObjectStorage = vercelPassportStorage
): Promise<{ slug: string; passport: PublicPassport }> {
  const slug = normalizePassportSlug(requestedSlug);
  const existing = await readStoredPassport(slug, storage);
  if (!existing) throw new PassportNotFoundError("This Passport does not exist.");
  if (!verifyPassportEditToken(editToken, existing.record.editTokenHash)) {
    throw new PassportAuthorizationError("This browser does not have the edit key for that Passport.");
  }
  const passport = parsePassport(value);
  const record: StoredPassport = { ...existing.record, updatedAt: now, passport };
  try {
    await storage.update(pathname(slug), JSON.stringify(record), existing.etag);
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) {
      throw new PassportConflictError("This Passport changed in another window. Reload and try again.");
    }
    throw error;
  }
  return { slug, passport };
}

export async function deletePublishedPassport(
  requestedSlug: string,
  editToken: string,
  storage: PassportObjectStorage = vercelPassportStorage
): Promise<void> {
  const slug = normalizePassportSlug(requestedSlug);
  const existing = await readStoredPassport(slug, storage);
  if (!existing) throw new PassportNotFoundError("This Passport does not exist.");
  if (!verifyPassportEditToken(editToken, existing.record.editTokenHash)) {
    throw new PassportAuthorizationError("This browser does not have the edit key for that Passport.");
  }
  try {
    await storage.delete(pathname(slug), existing.etag);
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) {
      throw new PassportConflictError("This Passport changed in another window. Reload and try again.");
    }
    throw error;
  }
}
