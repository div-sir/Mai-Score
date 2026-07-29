export const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
export const DRIVE_ENABLED_STORAGE_KEY = "maiScoreDriveEnabled";

export interface DrivePreferenceStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export async function driveEnabled(storage: DrivePreferenceStorage): Promise<boolean> {
  const stored = await storage.get(DRIVE_ENABLED_STORAGE_KEY);
  return stored[DRIVE_ENABLED_STORAGE_KEY] === true;
}

export async function setDriveEnabled(storage: DrivePreferenceStorage, enabled: boolean): Promise<void> {
  await storage.set({ [DRIVE_ENABLED_STORAGE_KEY]: enabled });
}

export type DriveConnection = "connected" | "disconnected";

/** The slice of chrome.identity this module uses, injected so it can be tested. */
export interface IdentityApi {
  getAuthToken(details: { interactive: boolean }, callback: (token?: string) => void): void;
  removeCachedAuthToken(details: { token: string }, callback: () => void): void;
  clearAllCachedAuthTokens(callback: () => void): void;
}

export interface AuthDeps {
  identity: IdentityApi;
  fetch: typeof globalThis.fetch;
  /** Reading chrome.runtime.lastError is what clears Chrome's pending error. */
  clearLastError?: () => void;
}

function requestToken(deps: AuthDeps, interactive: boolean): Promise<string | undefined> {
  return new Promise((resolve) => {
    deps.identity.getAuthToken({ interactive }, (token) => {
      deps.clearLastError?.();
      resolve(typeof token === "string" && token ? token : undefined);
    });
  });
}

function clearIdentityState(deps: AuthDeps): Promise<void> {
  return new Promise((resolve) => deps.identity.clearAllCachedAuthTokens(resolve));
}

/** Whether a grant already exists, asked for without prompting. */
export async function driveConnection(deps: AuthDeps): Promise<DriveConnection> {
  return await requestToken(deps, false) ? "connected" : "disconnected";
}

/**
 * Raises Google's consent screen when Chrome needs one. The Identity API uses
 * the Google account associated with the current Chrome profile.
 */
export async function connectDrive(deps: AuthDeps): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await requestToken(deps, true);
  return token ? { ok: true } : { ok: false, error: "cancelled" };
}

/**
 * Revokes the Google grant and always clears Chrome Identity's cached tokens
 * and account preferences. A failed remote revoke is reported to the caller,
 * while the local browser is still disconnected immediately.
 */
export async function disconnectDrive(deps: AuthDeps): Promise<void> {
  const token = await requestToken(deps, false);
  let revokeError: Error | undefined;

  try {
    if (token) {
      const response = await deps.fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      if (!response.ok) {
        revokeError = new Error(`Google authorization revocation failed (${response.status}).`);
      }
    }
  } catch (error) {
    revokeError = error instanceof Error ? error : new Error(String(error));
  } finally {
    await clearIdentityState(deps);
  }

  if (revokeError) throw revokeError;
}
