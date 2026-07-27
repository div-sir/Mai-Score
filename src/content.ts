import { parseCurrentFrame, parseProfile, parseRatingTarget } from "./lib/parser";
import { CONNECTION_PROTOCOL_VERSION, isCollectRequest } from "./lib/connections";
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
  const records = await resolveViaBackground(parseRatingTarget(ratingTarget));
  if (records.length < 50) throw new Error(`只找到 ${records.length} 筆成績，預期為 50 筆。`);
  const warnings = records.flatMap((record) => record.warning ? [record.warning] : []);
  const b15Rating = records.filter((x) => x.bucket === "b15").reduce((sum, x) => sum + (x.chartRating ?? 0), 0);
  const b35Rating = records.filter((x) => x.bucket === "b35").reduce((sum, x) => sum + (x.chartRating ?? 0), 0);
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
    b50Rating: b15Rating + b35Rating,
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
