import {
  createFetchProgress,
  createMatchingProgress,
  describeFetchError,
  FETCH_TIMEOUT_MS
} from "./lib/collect-progress";
import {
  parseCurrentFrame,
  parseCurrentPlate,
  parseFullRecordsPage,
  parseProfile,
  parseRatingTargetPage
} from "./lib/parser";
import { CONNECTION_PROTOCOL_VERSION, connectionForUrl, isCollectRequest, type ConnectionDescriptor } from "./lib/connections";
import { calculateB50Breakdown } from "./lib/rating";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, popupText, type PopupLanguage } from "./lib/i18n";
import { CHART_DATA_SOURCE } from "./lib/chart-data";
import type {
  CollectionResult,
  Difficulty,
  ParsedChartScore,
  ParsedFullScore,
  ResolvedChartScore,
  ResolvedScore
} from "./lib/types";

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

async function resolveViaBackground<T extends ParsedChartScore>(
  records: T[],
  connectionId: string,
  text: (key: string, ...values: Array<string | number>) => string
): Promise<Array<T & ResolvedChartScore>> {
  const response = await chrome.runtime.sendMessage({
    type: "MAI_SCORE_RESOLVE",
    protocolVersion: CONNECTION_PROTOCOL_VERSION,
    connectionId,
    records
  }) as { ok: true; records: ResolvedScore[] } | { ok: false; error: string } | undefined;
  if (!response) throw new Error(text("resolverNoResponse"));
  if (!response.ok) throw new Error(response.error);
  return response.records as unknown as Array<T & ResolvedChartScore>;
}

const FULL_RECORD_DIFFICULTIES: readonly Difficulty[] = ["basic", "advanced", "expert", "master", "remaster"];

const recordKey = (record: ResolvedChartScore) => record.sheetId
  ?? `${record.title.normalize("NFKC").trim().toLocaleLowerCase()}\u0000${record.type}\u0000${record.difficulty}`;

async function collect(connection: ConnectionDescriptor, includeFullRecords: boolean): Promise<CollectionResult> {
  const language = await currentLanguage();
  const text = (key: string, ...values: Array<string | number>) => popupText(language, key, ...values);

  let fetched = 0;
  if (includeFullRecords && connection.id !== "dxnet-intl") {
    throw new Error(text("fullRecordsIntlOnly"));
  }
  const total = 3 + (includeFullRecords ? FULL_RECORD_DIFFICULTIES.length : 0);
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
  const parsedFullRecords: ParsedFullScore[] = [];
  if (includeFullRecords) {
    for (const [index, difficulty] of FULL_RECORD_DIFFICULTIES.entries()) {
      const label = text("labelFullRecordsDifficulty", index + 1, FULL_RECORD_DIFFICULTIES.length);
      const document = await tracked(fetchDocument(
        `/record/musicGenre/search/?genre=99&diff=${index}`,
        label,
        text
      ));
      try {
        parsedFullRecords.push(...parseFullRecordsPage(document, difficulty));
      } catch (error) {
        if (error instanceof Error && error.message === "FULL_RECORDS_LAYOUT_CHANGED") {
          throw new Error(text("fullRecordsLayoutChanged", difficulty));
        }
        throw error;
      }
    }
  }

  reportProgress(createMatchingProgress());
  const b50Count = parsedB15.length + parsedB35.length;
  const resolved = await resolveViaBackground(
    [...parsedB15, ...parsedB35, ...parsedPage.candidates, ...parsedFullRecords],
    connection.id,
    text
  );
  const records = resolved.slice(0, b50Count) as ResolvedScore[];
  const candidateEnd = b50Count + parsedPage.candidates.length;
  const candidateRecords = resolved.slice(b50Count, candidateEnd) as ResolvedScore[];
  const resolvedFullRecords = resolved.slice(candidateEnd);
  const fullByChart = new Map(resolvedFullRecords.map((record) => [recordKey(record), record]));
  // Prefer the canonical Rating Target copy for charts in B50. It preserves
  // the exact same score/flags used to calculate the visible B15/B35.
  for (const record of records) fullByChart.set(recordKey(record), record);
  const fullRecords = includeFullRecords ? [...fullByChart.values()] : undefined;
  const fullRecordsUnmatched = fullRecords?.filter((record) => record.warning).length;
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
    ...(fullRecords ? { fullRecords, fullRecordsUnmatched } : {}),
    ...(candidateRecords.length ? { candidateRecords } : {}),
    b15Rating,
    b35Rating,
    b50Rating,
    warnings
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isCollectRequest(message) || !CONNECTION || message.connectionId !== CONNECTION.id) return;
  collect(CONNECTION, message.includeFullRecords === true).then((data) => sendResponse({ ok: true, data })).catch((error: unknown) => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
  });
  return true;
});
