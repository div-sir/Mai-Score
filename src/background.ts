import { resolveScores } from "./lib/resolver";
import { CONNECTION_PROTOCOL_VERSION } from "./lib/connections";
import {
  isStudioImportRequest,
  isStudioSender,
  studioTransferKey,
  type StudioTransfer
} from "./lib/studio-transfer";
import type { ParsedScore } from "./lib/types";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MAI_SCORE_RESOLVE"
    || message.protocolVersion !== CONNECTION_PROTOCOL_VERSION
    || message.connectionId !== "dxnet-intl") return;
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

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!isStudioSender(sender.url) || !isStudioImportRequest(message)) return;
  const key = studioTransferKey(message.token);
  chrome.storage.session.get(key)
    .then(async (stored) => {
      const transfer = stored[key] as StudioTransfer | undefined;
      await chrome.storage.session.remove(key);
      if (!transfer || transfer.expiresAt <= Date.now()) {
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
