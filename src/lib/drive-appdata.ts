export const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";
export const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

// Everything this module touches lives in appDataFolder: a per-app hidden
// space the user never sees in their own Drive listing, and which the
// drive.appdata scope is confined to. Writing anywhere else would need a
// broader scope than the extension requests.
export const APPDATA_SPACE = "appDataFolder";

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

/** The token is missing, expired, or was revoked — the caller must re-auth. */
export class DriveAuthError extends Error {
  constructor(message = "Google Drive authorization is no longer valid.") {
    super(message);
    this.name = "DriveAuthError";
  }
}

/** Drive answered, but not with success. Carries the status for diagnosis. */
export class DriveRequestError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(`Google Drive returned ${status}: ${detail}`);
    this.name = "DriveRequestError";
    this.status = status;
  }
}

export interface DriveContext {
  token: string;
  /** Injected so the transport can be substituted in tests. */
  fetch: typeof globalThis.fetch;
}

async function driveFetch(context: DriveContext, url: string, init: RequestInit = {}): Promise<Response> {
  const response = await context.fetch(url, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${context.token}` }
  });
  // 401 means the token is bad; 403 from Drive is usually scope or quota, but
  // for an appdata-only client the realistic cause is a revoked grant, so both
  // route the caller back through auth rather than surfacing a raw status.
  if (response.status === 401 || response.status === 403) throw new DriveAuthError();
  if (!response.ok) throw new DriveRequestError(response.status, await response.text().catch(() => ""));
  return response;
}

/** Finds one app-data file by exact name, or undefined when absent. */
export async function findAppDataFile(context: DriveContext, name: string): Promise<DriveFile | undefined> {
  const query = new URLSearchParams({
    spaces: APPDATA_SPACE,
    q: `name = '${name.replace(/'/g, "\\'")}' and trashed = false`,
    fields: "files(id,name,modifiedTime)",
    pageSize: "1"
  });
  const response = await driveFetch(context, `${DRIVE_FILES_API}?${query}`);
  const body = await response.json() as { files?: DriveFile[] };
  return body.files?.[0];
}

export async function readAppDataFile(context: DriveContext, fileId: string): Promise<string> {
  const response = await driveFetch(context, `${DRIVE_FILES_API}/${encodeURIComponent(fileId)}?alt=media`);
  return response.text();
}

/**
 * Creates the file, or replaces its contents when `existingId` is given.
 * Create needs the metadata (to place it in appDataFolder) alongside the
 * body, so it goes out as multipart; an update only replaces bytes.
 */
export async function writeAppDataFile(
  context: DriveContext,
  name: string,
  content: string,
  existingId?: string
): Promise<DriveFile> {
  const fields = "fields=id,name,modifiedTime";

  if (existingId) {
    const response = await driveFetch(
      context,
      `${DRIVE_UPLOAD_API}/${encodeURIComponent(existingId)}?uploadType=media&${fields}`,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: content }
    );
    return response.json() as Promise<DriveFile>;
  }

  const boundary = `mai-score-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name, parents: [APPDATA_SPACE] });
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    content,
    `--${boundary}--`,
    ""
  ].join("\r\n");

  const response = await driveFetch(
    context,
    `${DRIVE_UPLOAD_API}?uploadType=multipart&${fields}`,
    { method: "POST", headers: { "content-type": `multipart/related; boundary=${boundary}` }, body }
  );
  return response.json() as Promise<DriveFile>;
}
