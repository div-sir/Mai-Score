export const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export type DriveConnection = "connected" | "disconnected";

/** The slice of chrome.identity this module uses, injected so it can be tested. */
export interface IdentityApi {
  getAuthToken(details: { interactive: boolean }, callback: (token?: string) => void): void;
  removeCachedAuthToken(details: { token: string }, callback: () => void): void;
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

function dropCachedToken(deps: AuthDeps, token: string): Promise<void> {
  return new Promise((resolve) => deps.identity.removeCachedAuthToken({ token }, resolve));
}

/** Whether a grant already exists, asked for without prompting. */
export async function driveConnection(deps: AuthDeps): Promise<DriveConnection> {
  return await requestToken(deps, false) ? "connected" : "disconnected";
}

/**
 * Raises Google's consent screen. Must be called from a user gesture in a
 * page context — a background worker has no gesture to attach it to, which
 * is why sync reports "needs-auth" and leaves this to the popup.
 */
export async function connectDrive(deps: AuthDeps): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await requestToken(deps, true);
  // The user closing or refusing the consent window is not an error worth
  // dressing up; it just leaves the connection off.
  return token ? { ok: true } : { ok: false, error: "cancelled" };
}

/**
 * Revokes the grant at Google, then drops Chrome's cached copy. Order
 * matters: the token is needed to revoke it, and clearing the cache alone
 * would leave the grant live on the account, while revoking alone would
 * leave Chrome handing back a dead token.
 */
export async function disconnectDrive(deps: AuthDeps): Promise<void> {
  const token = await requestToken(deps, false);
  if (!token) return;
  try {
    await deps.fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: "POST" });
  } catch {
    // Still drop the local token: leaving a cached credential behind after
    // the user asked to disconnect is worse than a missed remote revoke.
  }
  await dropCachedToken(deps, token);
}
