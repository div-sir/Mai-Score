// Mirrors the extension's src/lib/drive-sync.ts protocol. Studio cannot
// import from the extension package, so the message shapes are restated
// here; a protocol version mismatch surfaces as a clear error from the
// extension rather than silent misbehaviour.
export const SYNC_PROTOCOL_VERSION = 1;
export const DRIVE_DELETE_CONFIRMATION = "DELETE_MAI_SCORE_CLOUD_HISTORY";
export const EXTENSION_ID_STORAGE_KEY = "mai-score-extension-id";

export type DriveSyncResult =
  | { ok: true; payload?: string; modifiedTime?: string; deleted?: boolean }
  | { ok: false; reason: "needs-auth" }
  | { ok: false; reason: "error"; error: string }
  | { ok: false; reason: "no-extension" };

interface ExternalRuntime {
  lastError?: { message?: string };
  sendMessage(extensionId: string, message: unknown, callback: (response: unknown) => void): void;
}

function runtime(): ExternalRuntime | undefined {
  return (window as unknown as { chrome?: { runtime?: ExternalRuntime } }).chrome?.runtime;
}

/**
 * The extension supplies its ID once, in the handoff URL. Sync happens long
 * after that, so it is remembered — without it Studio has no way to address
 * the extension at all.
 */
export function rememberExtensionId(extensionId: string): void {
  try {
    window.localStorage.setItem(EXTENSION_ID_STORAGE_KEY, extensionId);
  } catch {
    // A blocked localStorage only costs sync-without-handoff, not correctness.
  }
}

export function storedExtensionId(): string | undefined {
  try {
    return window.localStorage.getItem(EXTENSION_ID_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function send(message: unknown, timeoutMs = 20000): Promise<DriveSyncResult> {
  const extensionId = storedExtensionId();
  const chromeRuntime = runtime();
  if (!extensionId || !chromeRuntime?.sendMessage) return Promise.resolve({ ok: false, reason: "no-extension" });

  return new Promise((resolve) => {
    // Without this the promise never settles if the extension is disabled
    // mid-call and the callback is simply dropped.
    const timer = window.setTimeout(
      () => resolve({ ok: false, reason: "error", error: "The extension did not respond." }),
      timeoutMs
    );
    chromeRuntime.sendMessage(extensionId, message, (response) => {
      window.clearTimeout(timer);
      if (chromeRuntime.lastError || !response) {
        resolve({ ok: false, reason: "no-extension" });
        return;
      }
      resolve(response as DriveSyncResult);
    });
  });
}

export function pullFromDrive(): Promise<DriveSyncResult> {
  return send({ type: "MAI_SCORE_DRIVE_PULL", protocolVersion: SYNC_PROTOCOL_VERSION });
}

export function pushToDrive(payload: string): Promise<DriveSyncResult> {
  return send({ type: "MAI_SCORE_DRIVE_PUSH", protocolVersion: SYNC_PROTOCOL_VERSION, payload });
}

export function deleteFromDrive(): Promise<DriveSyncResult> {
  return send({
    type: "MAI_SCORE_DRIVE_DELETE",
    protocolVersion: SYNC_PROTOCOL_VERSION,
    confirmation: DRIVE_DELETE_CONFIRMATION
  });
}
