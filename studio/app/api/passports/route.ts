import { BlobAccessError, BlobStoreNotFoundError } from "@vercel/blob";
import { createPublishedPassport, passportStorageConfigured, PassportConflictError, PassportStorageUnavailableError } from "../../../lib/passport-store";
import { assertSameOrigin, readPassportRequest } from "../../../lib/passport-request";

export const runtime = "nodejs";

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store" }
});

export function GET() {
  return json({ available: passportStorageConfigured() });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readPassportRequest(request);
    if (!body.slug) return json({ error: "Choose a profile name." }, 400);
    const created = await createPublishedPassport(body.slug, body.passport);
    return json(created, 201);
  } catch (error) {
    if (error instanceof PassportConflictError) return json({ error: error.message }, 409);
    if (error instanceof PassportStorageUnavailableError) return json({ error: error.message }, 503);
    if (error instanceof BlobAccessError || error instanceof BlobStoreNotFoundError) {
      return json({ error: "Persistent Passports are not configured on this deployment yet." }, 503);
    }
    if (error instanceof SyntaxError) return json({ error: "Passport request contains invalid JSON." }, 400);
    if (error instanceof Error && /Passport|profile name|Cross-origin|JSON/.test(error.message)) {
      return json({ error: error.message }, error.message.startsWith("Cross-origin") ? 403 : 400);
    }
    console.error("Passport creation failed", error);
    return json({ error: "Passport storage is temporarily unavailable." }, 503);
  }
}
