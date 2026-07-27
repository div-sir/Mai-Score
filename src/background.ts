import { resolveScores } from "./lib/resolver";
import { CONNECTION_PROTOCOL_VERSION } from "./lib/connections";
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
