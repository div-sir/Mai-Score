import { parseCurrentFrame, parseProfile, parseRatingTarget } from "./lib/parser";
import { resolveScores } from "./lib/resolver";
import type { CollectionResult } from "./lib/types";

const ROOT = "https://maimaidx-eng.com/maimai-mobile";

async function fetchDocument(path: string): Promise<Document> {
  const response = await fetch(`${ROOT}${path}`, { credentials: "include" });
  if (!response.ok) throw new Error(`DX NET 回傳 ${response.status}`);
  return new DOMParser().parseFromString(await response.text(), "text/html");
}

async function collect(): Promise<CollectionResult> {
  const [home, ratingTarget, frame] = await Promise.all([
    fetchDocument("/home/"),
    fetchDocument("/home/ratingTargetMusic/"),
    fetchDocument("/collection/frame/")
  ]);
  const player = parseProfile(home);
  player.frameUrl = parseCurrentFrame(frame);
  const records = await resolveScores(parseRatingTarget(ratingTarget));
  if (records.length < 50) throw new Error(`只找到 ${records.length} 筆成績，預期為 50 筆。`);
  const warnings = records.flatMap((record) => record.warning ? [record.warning] : []);
  const b15Rating = records.filter((x) => x.bucket === "b15").reduce((sum, x) => sum + (x.chartRating ?? 0), 0);
  const b35Rating = records.filter((x) => x.bucket === "b35").reduce((sum, x) => sum + (x.chartRating ?? 0), 0);
  return {
    schema: "mai-score/v1",
    exportedAt: new Date().toISOString(),
    source: `${ROOT}/home/ratingTargetMusic/`,
    player,
    records,
    b15Rating,
    b35Rating,
    b50Rating: b15Rating + b35Rating,
    warnings
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MAI_SCORE_COLLECT") return;
  collect().then((data) => sendResponse({ ok: true, data })).catch((error: unknown) => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
  });
  return true;
});
