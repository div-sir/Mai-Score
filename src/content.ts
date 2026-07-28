import {
  createFetchProgress,
  createMatchingProgress,
  describeFetchError,
  FETCH_TIMEOUT_MS
} from "./lib/collect-progress";
import { parseCurrentFrame, parseProfile, parseRatingTarget } from "./lib/parser";
import { CONNECTION_PROTOCOL_VERSION, isCollectRequest } from "./lib/connections";
import { calculateB50Breakdown } from "./lib/rating";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, popupText, type PopupLanguage } from "./lib/i18n";
import type { CollectionResult, ParsedScore, ResolvedScore } from "./lib/types";

const ROOT = "https://maimaidx-eng.com/maimai-mobile";

async function currentLanguage(): Promise<PopupLanguage> {
  const stored = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
  const candidate = stored[LANGUAGE_STORAGE_KEY];
  return candidate === "zh-Hant" || candidate === "ja" || candidate === "en" ? candidate : DEFAULT_LANGUAGE;
}

// Fire-and-forget: the popup may be closed or never listening, and a missing
// receiver must not fail the collection it is only reporting progress for.
function reportProgress(message: ReturnType<typeof createFetchProgress>) {
  void chrome.runtime.sendMessage(message).catch(() => {});
}

async function fetchDocument(path: string, label: string, text: (key: string, ...values: Array<string | number>) => string): Promise<Document> {
  let response: Response;
  try {
    response = await fetch(`${ROOT}${path}`, { credentials: "include", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    throw describeFetchError(error, label, text);
  }
  if (!response.ok) throw new Error(text("fetchBadStatus", label, response.status));
  return new DOMParser().parseFromString(await response.text(), "text/html");
}

async function resolveViaBackground(
  records: ParsedScore[],
  text: (key: string, ...values: Array<string | number>) => string
): Promise<ResolvedScore[]> {
  const response = await chrome.runtime.sendMessage({
    type: "MAI_SCORE_RESOLVE",
    protocolVersion: CONNECTION_PROTOCOL_VERSION,
    connectionId: "dxnet-intl",
    records
  }) as { ok: true; records: ResolvedScore[] } | { ok: false; error: string } | undefined;
  if (!response) throw new Error(text("resolverNoResponse"));
  if (!response.ok) throw new Error(response.error);
  return response.records;
}

async function collect(): Promise<CollectionResult> {
  const language = await currentLanguage();
  const text = (key: string, ...values: Array<string | number>) => popupText(language, key, ...values);

  let fetched = 0;
  const total = 3;
  const tracked = (promise: Promise<Document>) => promise.then((doc) => {
    fetched += 1;
    reportProgress(createFetchProgress(fetched, total));
    return doc;
  });

  const [home, ratingTarget, frame] = await Promise.all([
    tracked(fetchDocument("/home/", text("labelProfile"), text)),
    tracked(fetchDocument("/home/ratingTargetMusic/", text("labelB50"), text)),
    tracked(fetchDocument("/collection/frame/", text("labelFrame"), text))
  ]);
  const player = parseProfile(home);
  player.frameUrl = parseCurrentFrame(frame);
  const parsed = parseRatingTarget(ratingTarget);
  const parsedB15 = parsed.filter((record) => record.bucket === "b15");
  const parsedB35 = parsed.filter((record) => record.bucket === "b35");
  if (parsedB15.length !== 15 || parsedB35.length !== 35) {
    throw new Error(text("unexpectedTargetCounts", parsedB15.length, parsedB35.length));
  }
  reportProgress(createMatchingProgress());
  const records = await resolveViaBackground([...parsedB15, ...parsedB35], text);
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
