import { parseCurrentFrame, parseProfile, parseRatingTarget } from "./lib/parser";
import { CONNECTION_PROTOCOL_VERSION, isCollectRequest } from "./lib/connections";
import { calculateB50Breakdown } from "./lib/rating";
import type { CollectionResult, ParsedScore, ResolvedScore } from "./lib/types";

const ROOT = "https://maimaidx-eng.com/maimai-mobile";

async function fetchDocument(path: string, label: string): Promise<Document> {
  let response: Response;
  try {
    response = await fetch(`${ROOT}${path}`, { credentials: "include" });
  } catch {
    throw new Error(`無法讀取 ${label}：DX NET 網路請求失敗。`);
  }
  if (!response.ok) throw new Error(`無法讀取 ${label}：DX NET 回傳 ${response.status}。`);
  return new DOMParser().parseFromString(await response.text(), "text/html");
}

async function resolveViaBackground(records: ParsedScore[]): Promise<ResolvedScore[]> {
  const response = await chrome.runtime.sendMessage({
    type: "MAI_SCORE_RESOLVE",
    protocolVersion: CONNECTION_PROTOCOL_VERSION,
    connectionId: "dxnet-intl",
    records
  }) as { ok: true; records: ResolvedScore[] } | { ok: false; error: string } | undefined;
  if (!response) throw new Error("譜面資料服務沒有回應，請重新載入擴充功能。");
  if (!response.ok) throw new Error(response.error);
  return response.records;
}

async function collect(): Promise<CollectionResult> {
  const [home, ratingTarget, frame] = await Promise.all([
    fetchDocument("/home/", "玩家資料"),
    fetchDocument("/home/ratingTargetMusic/", "B50"),
    fetchDocument("/collection/frame/", "frame")
  ]);
  const player = parseProfile(home);
  player.frameUrl = parseCurrentFrame(frame);
  const parsed = parseRatingTarget(ratingTarget);
  const parsedB15 = parsed.filter((record) => record.bucket === "b15");
  const parsedB35 = parsed.filter((record) => record.bucket === "b35");
  if (parsedB15.length !== 15 || parsedB35.length !== 35) {
    throw new Error(`Expected 15 new and 35 old rating targets, found ${parsedB15.length} and ${parsedB35.length}.`);
  }
  const records = await resolveViaBackground([...parsedB15, ...parsedB35]);
  const warnings = records.flatMap((record) => record.warning ? [record.warning] : []);
  const { b15Rating, b35Rating, b50Rating } = calculateB50Breakdown(records);
  return {
    schema: "mai-score/v1",
    exportedAt: new Date().toISOString(),
    source: `${ROOT}/home/ratingTargetMusic/`,
    connection: {
      id: "dxnet-intl",
      protocolVersion: CONNECTION_PROTOCOL_VERSION
    },
    player,
    records,
    b15Rating,
    b35Rating,
    b50Rating,
    warnings
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isCollectRequest(message) || message.connectionId !== "dxnet-intl") return;
  collect().then((data) => sendResponse({ ok: true, data })).catch((error: unknown) => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
  });
  return true;
});
