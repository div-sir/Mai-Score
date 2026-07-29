import { resolveScores } from "./lib/resolver";
import { CONNECTIONS, CONNECTION_PROTOCOL_VERSION } from "./lib/connections";
import { isDriveSyncRequest, performDriveSync, type DriveSyncResponse } from "./lib/drive-sync";
import { DRIVE_ENABLED_STORAGE_KEY } from "./lib/drive-auth";
import {
  consumeStudioTransfer,
  isStudioImportRequest,
  isStudioSender
} from "./lib/studio-transfer";
import type { ParsedScore } from "./lib/types";

// The chart database is shared across every maimai DX region — a song's
// internal level doesn't change with which DX NET a player logged into — so
// this accepts resolve requests from any active content-script connection
// for the game rather than one hardcoded region.
function isResolvableConnection(connectionId: unknown): boolean {
  return CONNECTIONS.some((connection) =>
    connection.id === connectionId && connection.status === "active" && connection.transport === "content-script");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MAI_SCORE_RESOLVE"
    || message.protocolVersion !== CONNECTION_PROTOCOL_VERSION
    || !isResolvableConnection(message.connectionId)) return;
  resolveScores(message.records as ParsedScore[])
    .then((records) => sendResponse({ ok: true, records }))
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  return true;
});

/**
 * Silent token only. Interactive consent needs a user gesture, which a
 * background worker woken by an external message does not have — so a
 * missing grant is reported back rather than failing with a confusing
 * error, and the popup raises the consent prompt instead.
 */
function silentAuthToken(): Promise<string | undefined> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      // Reading lastError is what suppresses Chrome's unchecked-error warning.
      void chrome.runtime.lastError;
      resolve(typeof token === "string" && token ? token : undefined);
    });
  });
}

async function handleDriveSync(message: unknown): Promise<DriveSyncResponse> {
  if (!isDriveSyncRequest(message)) return { ok: false, reason: "error", error: "Malformed sync request." };
  const stored = await chrome.storage.local.get(DRIVE_ENABLED_STORAGE_KEY);
  if (stored[DRIVE_ENABLED_STORAGE_KEY] !== true) return { ok: false, reason: "needs-auth" };
  const token = await silentAuthToken();
  if (!token) return { ok: false, reason: "needs-auth" };
  return performDriveSync({ token, fetch: globalThis.fetch }, message);
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!isStudioSender(sender.url)) return;

  if (isDriveSyncRequest(message)) {
    handleDriveSync(message).then(sendResponse).catch((error: unknown) => sendResponse({
      ok: false,
      reason: "error",
      error: error instanceof Error ? error.message : String(error)
    } satisfies DriveSyncResponse));
    return true;
  }

  if (!isStudioImportRequest(message)) return;
  consumeStudioTransfer(chrome.storage.session, message.token)
    .then((transfer) => {
      if (!transfer) {
        sendResponse({ ok: false, error: "預覽資料已過期，請回到 Mai-Score 再按一次網頁預覽。" });
        return;
      }
      sendResponse({
        ok: true,
        data: transfer.data,
        assets: transfer.assets,
        language: transfer.language
      });
    })
    .catch((error: unknown) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }));
  return true;
});
