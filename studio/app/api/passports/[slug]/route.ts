import { BlobAccessError, BlobStoreNotFoundError } from "@vercel/blob";
import {
  getPublishedPassport,
  deletePublishedPassport,
  PassportAuthorizationError,
  PassportConflictError,
  PassportNotFoundError,
  PassportStorageUnavailableError,
  updatePublishedPassport
} from "../../../../lib/passport-store";
import { assertSameOrigin, bearerToken, readPassportRequest } from "../../../../lib/passport-request";

export const runtime = "nodejs";

const json = (body: unknown, status = 200, cacheControl = "no-store") => Response.json(body, {
  status,
  headers: { "cache-control": cacheControl }
});

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const passport = await getPublishedPassport(slug);
    return passport
      ? json({ slug, passport })
      : json({ error: "Passport not found." }, 404);
  } catch (error) {
    if (error instanceof BlobAccessError || error instanceof BlobStoreNotFoundError) {
      return json({ error: "Persistent Passports are not configured on this deployment yet." }, 503);
    }
    if (error instanceof PassportStorageUnavailableError) return json({ error: error.message }, 503);
    if (error instanceof Error && /profile name/.test(error.message)) return json({ error: "Passport not found." }, 404);
    console.error("Passport read failed", error);
    return json({ error: "Passport storage is temporarily unavailable." }, 503);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    const body = await readPassportRequest(request);
    const updated = await updatePublishedPassport(slug, bearerToken(request), body.passport);
    return json(updated);
  } catch (error) {
    if (error instanceof PassportAuthorizationError) return json({ error: error.message }, 403);
    if (error instanceof PassportNotFoundError) return json({ error: error.message }, 404);
    if (error instanceof PassportConflictError) return json({ error: error.message }, 409);
    if (error instanceof PassportStorageUnavailableError) return json({ error: error.message }, 503);
    if (error instanceof BlobAccessError || error instanceof BlobStoreNotFoundError) {
      return json({ error: "Persistent Passports are not configured on this deployment yet." }, 503);
    }
    if (error instanceof SyntaxError) return json({ error: "Passport request contains invalid JSON." }, 400);
    if (error instanceof Error && /Passport|profile name|Cross-origin|JSON|edit key/.test(error.message)) {
      return json({ error: error.message }, error.message.startsWith("Cross-origin") ? 403 : 400);
    }
    console.error("Passport update failed", error);
    return json({ error: "Passport storage is temporarily unavailable." }, 503);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    await deletePublishedPassport(slug, bearerToken(request));
    return json({ deleted: true });
  } catch (error) {
    if (error instanceof PassportAuthorizationError) return json({ error: error.message }, 403);
    if (error instanceof PassportNotFoundError) return json({ error: error.message }, 404);
    if (error instanceof PassportConflictError) return json({ error: error.message }, 409);
    if (error instanceof PassportStorageUnavailableError) return json({ error: error.message }, 503);
    if (error instanceof BlobAccessError || error instanceof BlobStoreNotFoundError) {
      return json({ error: "Persistent Passports are not configured on this deployment yet." }, 503);
    }
    if (error instanceof Error && /profile name|Cross-origin|edit key/.test(error.message)) {
      return json({ error: error.message }, error.message.startsWith("Cross-origin") ? 403 : 400);
    }
    console.error("Passport deletion failed", error);
    return json({ error: "Passport storage is temporarily unavailable." }, 503);
  }
}
