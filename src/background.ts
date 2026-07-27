import { resolveScores } from "./lib/resolver";
import type { ParsedScore } from "./lib/types";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MAI_SCORE_RESOLVE") return;
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
