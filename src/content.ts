import {
  createFetchProgress,
  createMatchingProgress,
  describeFetchError,
  FETCH_TIMEOUT_MS
} from "./lib/collect-progress";
import { parseCurrentFrame, parseCurrentPlate, parseProfile, parseRatingTargetPage } from "./lib/parser";
import { CONNECTION_PROTOCOL_VERSION, connectionForUrl, isCollectRequest, type ConnectionDescriptor } from "./lib/connections";
import { calculateB50Breakdown } from "./lib/rating";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, popupText, type PopupLanguage } from "./lib/i18n";
import { CHART_DATA_SOURCE } from "./lib/chart-data";
import type { CollectionResult, ParsedScore, ResolvedScore } from "./lib/types";

// One content script runs on every registered DX NET region (see
// manifest.json's content_scripts.matches); which region depends on where
// this instance actually loaded, never a hardcoded domain.
const CONNECTION: ConnectionDescriptor | undefined = connectionForUrl(window.location.href);
const ROOT = `${window.location.origin}/maimai-mobile`;
/** Deadline for pages the export can do without. */
const OPTIONAL_FETCH_TIMEOUT_MS = 5_000;

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

async function fetchDocument(
  path: string,
  label: string,
  text: (key: string, ...values: Array<string | number>) => string,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Document> {
  let response: Response;
  try {
    response = await fetch(`${ROOT}${path}`, { credentials: "include", signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw describeFetchError(error, label, text);
  }
  if (!response.ok) throw new Error(text("fetchBadStatus", label, response.status));
  return new DOMParser().parseFromString(await response.text(), "text/html");
}

async function resolveViaBackground(
  records: ParsedScore[],
  connectionId: string,
  text: (key: string, ...values: Array<string | number>) => string
): Promise<ResolvedScore[]> {
  const response = await chrome.runtime.sendMessage({
    type: "MAI_SCORE_RESOLVE",
    protocolVersion: CONNECTION_PROTOCOL_VERSION,
    connectionId,
    records
  }) as { ok: true; records: ResolvedScore[] } | { ok: false; error: string } | undefined;
  if (!response) throw new Error(text("resolverNoResponse"));
  if (!response.ok) throw new Error(response.error);
  return response.records;
}

async function collect(connection: ConnectionDescriptor): Promise<CollectionResult> {
  const language = await currentLanguage();
  const text = (key: string, ...values: Array<string | number>) => popupText(language, key, ...values);

  let fetched = 0;
  const total = 3;
  const tracked = (promise: Promise<Document>) => promise.then((doc) => {
    fetched += 1;
    reportProgress(createFetchProgress(fetched, total));
    return doc;
  });

  const [home, ratingTarget, frame, plate] = await Promise.all([
    tracked(fetchDocument("/home/", text("labelProfile"), text)),
    tracked(fetchDocument("/home/ratingTargetMusic/", text("labelB50"), text)),
    tracked(fetchDocument("/collection/frame/", text("labelFrame"), text)),
    // Decorative only, and the plate collection page has not been verified
    // against every region. A failure here must not lose the whole B50, so
    // this one request is allowed to come back empty — on a short deadline,
    // because the other three are what the export actually needs and a slow
    // optional page must not hold the collection open behind them.
    fetchDocument("/collection/plate/", text("labelPlate"), text, OPTIONAL_FETCH_TIMEOUT_MS)
      .catch(() => undefined)
  ]);
  const player = parseProfile(home, `${ROOT}/home/`);
  player.frameUrl = parseCurrentFrame(frame, `${ROOT}/collection/frame`);
  player.plateUrl = plate ? parseCurrentPlate(plate, `${ROOT}/collection/plate`) : undefined;
  const parsedPage = parseRatingTargetPage(ratingTarget);
  const parsed = parsedPage.records;
  const parsedB15 = parsed.filter((record) => record.bucket === "b15");
  const parsedB35 = parsed.filter((record) => record.bucket === "b35");
  if (parsedB15.length !== 15 || parsedB35.length !== 35) {
    throw new Error(text("unexpectedTargetCounts", parsedB15.length, parsedB35.length));
  }
  reportProgress(createMatchingProgress());
  const b50Count = parsedB15.length + parsedB35.length;
  const resolved = await resolveViaBackground([...parsedB15, ...parsedB35, ...parsedPage.candidates], connection.id, text);
  const records = resolved.slice(0, b50Count);
  const candidateRecords = resolved.slice(b50Count);
  // Candidate matching is advisory and must not make the official B50 look
  // unresolved in the popup's 50/50 status or rating-gap explanation.
  const warnings = records.flatMap((record) => record.warning ? [record.warning] : []);
  const { b15Rating, b35Rating, b50Rating } = calculateB50Breakdown(records);
  return {
    schema: "mai-score/v1",
    exportedAt: new Date().toISOString(),
    source: `${ROOT}/home/ratingTargetMusic/`,
    connection: {
      id: connection.id,
      protocolVersion: CONNECTION_PROTOCOL_VERSION,
      region: connection.region
    },
    chartData: { ...CHART_DATA_SOURCE },
    player,
    records,
    ...(candidateRecords.length ? { candidateRecords } : {}),
    b15Rating,
    b35Rating,
    b50Rating,
    warnings
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isCollectRequest(message) || !CONNECTION || message.connectionId !== CONNECTION.id) return;
  collect(CONNECTION).then((data) => sendResponse({ ok: true, data })).catch((error: unknown) => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
  });
  return true;
});
