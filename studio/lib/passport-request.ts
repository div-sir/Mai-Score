import { normalizePassportSlug } from "./passport-slug";

export const MAX_PASSPORT_REQUEST_BYTES = 16_000;

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("Cross-origin Passport writes are not allowed.");
}

export async function readPassportRequest(request: Request): Promise<{ slug?: string; passport: unknown }> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("Passport requests must use JSON.");
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_PASSPORT_REQUEST_BYTES) throw new Error("Passport request is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_PASSPORT_REQUEST_BYTES) throw new Error("Passport request is too large.");
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Passport request must be a JSON object.");
  const input = parsed as { slug?: unknown; passport?: unknown };
  return {
    slug: input.slug === undefined ? undefined : normalizePassportSlug(input.slug),
    passport: input.passport
  };
}

export function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match) throw new Error("A valid Passport edit key is required.");
  return match[1];
}
