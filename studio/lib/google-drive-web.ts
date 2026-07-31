import type { DriveConnectionResult, DriveSyncResult } from "./drive-client";

export const GOOGLE_DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
export const DRIVE_HISTORY_FILE = "mai-score-history.json";
export const MAX_SYNC_PAYLOAD_BYTES = 4 * 1024 * 1024;

const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const TOKEN_EXPIRY_SKEW_MS = 30_000;

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(config?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    include_granted_scopes: boolean;
    prompt: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback: (error: { type?: string }) => void;
  }): GoogleTokenClient;
  revoke(token: string, callback: (response: {
    successful?: boolean;
    error?: string;
    error_description?: string;
  }) => void): void;
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface WebDriveDependencies {
  clientId: string;
  fetch: typeof globalThis.fetch;
  oauth: () => GoogleOAuth2 | undefined;
  enabled?: () => boolean;
  now?: () => number;
  randomUUID?: () => string;
}

function payloadBytes(payload: string): number {
  return new TextEncoder().encode(payload).length;
}

export class WebGoogleDriveClient {
  private accessToken?: string;
  private expiresAt = 0;

  constructor(private readonly dependencies: WebDriveDependencies) {}

  configured(): boolean {
    return this.dependencies.clientId.trim().length > 0
      && (this.dependencies.enabled?.() ?? true);
  }

  connectionStatus(): DriveConnectionResult {
    return {
      ok: true,
      connected: Boolean(this.validToken())
    };
  }

  connect(): Promise<DriveConnectionResult> {
    if (!this.configured()) {
      return Promise.resolve({
        ok: false,
        reason: "error",
        error: "Google Drive web sync is not configured."
      });
    }

    const oauth = this.dependencies.oauth();
    if (!oauth) {
      return Promise.resolve({
        ok: false,
        reason: "error",
        error: "Google authorization is still loading. Try again in a moment."
      });
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: DriveConnectionResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const client = oauth.initTokenClient({
        client_id: this.dependencies.clientId,
        scope: GOOGLE_DRIVE_APPDATA_SCOPE,
        include_granted_scopes: false,
        prompt: "select_account",
        callback: (response) => {
          if (response.error || !response.access_token) {
            finish({
              ok: false,
              reason: "error",
              error: response.error_description || response.error || "Google authorization was not completed."
            });
            return;
          }
          const scopes = new Set((response.scope ?? "").split(/\s+/).filter(Boolean));
          if (!scopes.has(GOOGLE_DRIVE_APPDATA_SCOPE)) {
            finish({
              ok: false,
              reason: "error",
              error: "Google Drive app-data access was not granted."
            });
            return;
          }
          this.accessToken = response.access_token;
          this.expiresAt = this.now() + Math.max(0, Number(response.expires_in ?? 0)) * 1000;
          finish({ ok: true, connected: true });
        },
        error_callback: (error) => {
          finish({
            ok: false,
            reason: "error",
            error: error.type === "popup_closed"
              ? "Google authorization was cancelled."
              : error.type === "popup_failed_to_open"
                ? "The Google authorization window was blocked."
                : "Google authorization could not be opened."
          });
        }
      });
      client.requestAccessToken({ prompt: "select_account" });
    });
  }

  async pull(): Promise<DriveSyncResult> {
    return this.run(async (token) => {
      const existing = await this.findFile(token);
      if (!existing) return { ok: true };
      const response = await this.driveFetch(
        token,
        `${DRIVE_FILES_API}/${encodeURIComponent(existing.id)}?alt=media`
      );
      return {
        ok: true,
        payload: await response.text(),
        modifiedTime: existing.modifiedTime
      };
    });
  }

  async push(payload: string): Promise<DriveSyncResult> {
    if (payloadBytes(payload) > MAX_SYNC_PAYLOAD_BYTES) {
      return {
        ok: false,
        reason: "error",
        error: "The history document is larger than the 4 MB sync limit."
      };
    }
    return this.run(async (token) => {
      const existing = await this.findFile(token);
      const written = existing
        ? await this.updateFile(token, existing.id, payload)
        : await this.createFile(token, payload);
      return { ok: true, modifiedTime: written.modifiedTime };
    });
  }

  async delete(): Promise<DriveSyncResult> {
    return this.run(async (token) => {
      const existing = await this.findFile(token);
      if (!existing) return { ok: true, deleted: false };
      await this.driveFetch(
        token,
        `${DRIVE_FILES_API}/${encodeURIComponent(existing.id)}`,
        { method: "DELETE" }
      );
      return { ok: true, deleted: true };
    });
  }

  disconnect(): Promise<DriveConnectionResult> {
    const token = this.accessToken;
    this.clearToken();
    if (!token) return Promise.resolve({ ok: true, connected: false });

    const oauth = this.dependencies.oauth();
    if (!oauth) {
      return Promise.resolve({
        ok: true,
        connected: false,
        warning: "The local web token was cleared, but Google revocation could not be opened."
      });
    }
    return new Promise((resolve) => {
      oauth.revoke(token, (response) => {
        resolve(response.successful || response.error === "invalid_token"
          ? { ok: true, connected: false }
          : {
              ok: true,
              connected: false,
              warning: response.error_description || response.error || "Google could not confirm revocation."
            });
      });
    });
  }

  private now(): number {
    return this.dependencies.now?.() ?? Date.now();
  }

  private validToken(): string | undefined {
    if (!this.accessToken || this.expiresAt - TOKEN_EXPIRY_SKEW_MS <= this.now()) {
      this.clearToken();
      return undefined;
    }
    return this.accessToken;
  }

  private clearToken(): void {
    this.accessToken = undefined;
    this.expiresAt = 0;
  }

  private async run(
    operation: (token: string) => Promise<Extract<DriveSyncResult, { ok: true }>>
  ): Promise<DriveSyncResult> {
    const token = this.validToken();
    if (!token) return { ok: false, reason: "needs-auth" };
    try {
      return await operation(token);
    } catch (error) {
      if (error instanceof WebDriveAuthError) {
        this.clearToken();
        return { ok: false, reason: "needs-auth" };
      }
      return {
        ok: false,
        reason: "error",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async driveFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.dependencies.fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        authorization: `Bearer ${token}`
      }
    });
    if (response.status === 401 || response.status === 403) throw new WebDriveAuthError();
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Google Drive returned ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return response;
  }

  private async findFile(token: string): Promise<DriveFile | undefined> {
    const query = new URLSearchParams({
      spaces: "appDataFolder",
      q: `name = '${DRIVE_HISTORY_FILE}' and trashed = false`,
      fields: "files(id,name,modifiedTime)",
      pageSize: "1"
    });
    const response = await this.driveFetch(token, `${DRIVE_FILES_API}?${query}`);
    const body = await response.json() as { files?: DriveFile[] };
    return body.files?.[0];
  }

  private async updateFile(token: string, fileId: string, payload: string): Promise<DriveFile> {
    const response = await this.driveFetch(
      token,
      `${DRIVE_UPLOAD_API}/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,modifiedTime`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: payload
      }
    );
    return response.json() as Promise<DriveFile>;
  }

  private async createFile(token: string, payload: string): Promise<DriveFile> {
    const boundary = `mai-score-${this.dependencies.randomUUID?.() ?? crypto.randomUUID()}`;
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify({ name: DRIVE_HISTORY_FILE, parents: ["appDataFolder"] }),
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      payload,
      `--${boundary}--`,
      ""
    ].join("\r\n");
    const response = await this.driveFetch(
      token,
      `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime`,
      {
        method: "POST",
        headers: { "content-type": `multipart/related; boundary=${boundary}` },
        body
      }
    );
    return response.json() as Promise<DriveFile>;
  }
}

class WebDriveAuthError extends Error {}

function browserOAuth(): GoogleOAuth2 | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }).google?.accounts?.oauth2;
}

function browserWebOAuthEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.origin === "https://mai-score.milifix.com"
    || window.location.origin === "http://localhost:3000"
    || window.location.origin === "http://127.0.0.1:3000";
}

export const webGoogleDrive = new WebGoogleDriveClient({
  clientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  fetch: (...args) => globalThis.fetch(...args),
  oauth: browserOAuth,
  enabled: browserWebOAuthEnabled
});
