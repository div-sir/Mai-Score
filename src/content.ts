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
  ResolvedScore,
  VersionChartTotals
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
  const request = async (targetPath: string) => {
    const response = await fetch(`${ROOT}${targetPath}`, {
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs)
    });
    const html = await response.text();
    const document = new DOMParser().parseFromString(html, "text/html");
    const errorCode = document.body.textContent?.match(/ERROR\s+CODE\s*[:：]\s*(\d{6})(?!\d)/i)?.[1];
    return { response, document, errorCode };
  };
  let retryNetworkFailure = true;
  let refreshExpiredSession = true;
  while (true) {
    let response: Response;
    let document: Document;
    let errorCode: string | undefined;
    try {
      ({ response, document, errorCode } = await request(path));
    } catch (error) {
      if (retryNetworkFailure) {
        retryNetworkFailure = false;
        await new Promise(resolve => setTimeout(resolve, 750));
        continue;
      }
      throw describeFetchError(error, label, text);
    }
    // DX NET can return an application error page with HTTP 200.
    // Detect it before attempting to parse the page as player/score data.
    if (errorCode === "200002" && refreshExpiredSession) {
      refreshExpiredSession = false;
      try {
        // A score endpoint can lose DX NET's application session while the
        // browser login cookie remains valid. Visiting home once mirrors the
        // recovery that users previously had to perform by hand. The retry is
        // strictly bounded and never attempts to sign in or retain page HTML.
        const refreshed = await request("/home/");
        if (refreshed.response.ok && !refreshed.errorCode) {
          if (path === "/home/") return refreshed.document;
          continue;
        }
      } catch {
        // Fall through to the actionable expiry message. A refresh failure is
        // not evidence that the score-page structure changed.
      }
    }
    if (errorCode === "200002") throw new Error(text("fetchSessionExpired", label));
    if (errorCode) throw new Error(text("fetchApplicationError", label, errorCode));
    if (!response.ok) throw new Error(text("fetchBadStatus", label, response.status));
    return document;
  }
}

async function resolveViaBackground<T extends ParsedChartScore>(
  records: T[],
  connectionId: string,
  text: (key: string, ...values: Array<string | number>) => string,
  includeVersionTotals = false
): Promise<{ records: Array<T & ResolvedChartScore>; versionTotals?: VersionChartTotals[] }> {
  const response = await chrome.runtime.sendMessage({
    type: "MAI_SCORE_RESOLVE",
    protocolVersion: CONNECTION_PROTOCOL_VERSION,
    connectionId,
    records,
    includeVersionTotals
  }) as
    | { ok: true; records: ResolvedScore[]; versionTotals?: VersionChartTotals[] }
    | { ok: false; error: string }
    | undefined;
  if (!response) throw new Error(text("resolverNoResponse"));
  if (!response.ok) throw new Error(response.error);
  return {
    records: response.records as unknown as Array<T & ResolvedChartScore>,
    versionTotals: response.versionTotals
  };
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
  const total = 4 + (includeFullRecords ? FULL_RECORD_DIFFICULTIES.length : 0);
  const tracked = (promise: Promise<Document>) => promise.then((doc) => {
    fetched += 1;
    reportProgress(createFetchProgress(fetched, total));
    return doc;
  });

  // DX NET requests share one authenticated session. Keep them sequential.
  const home = await tracked(fetchDocument("/home/", text("labelProfile"), text));
  const player = parseProfile(home, `${ROOT}/home/`);
  const ratingTarget = await tracked(fetchDocument("/home/ratingTargetMusic/", text("labelB50"), text));
  const decoration = async (path: string, label: string) => {
    try { return await fetchDocument(path, label, text, OPTIONAL_FETCH_TIMEOUT_MS); }
    catch { return undefined; }
    finally { reportProgress(createFetchProgress(++fetched, total)); }
  };
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
          const songs = document.querySelectorAll(".music_name_block").length;
          const levels = document.querySelectorAll(".music_lv_block").length;
          const scores = document.querySelectorAll(".music_score_block").length;
          throw new Error(`${text("fullRecordsLayoutChanged", difficulty)} [songs=${songs}; levels=${levels}; scoreBlocks=${scores}]`);
        }
        throw error;
      }
    }
  }

  // Finish required score requests before visiting optional collection pages.
  // These share the authenticated session even when their failures are ignored.
  const frame = await decoration("/collection/frame/", text("labelFrame"));
  const plate = await decoration("/collection/plate/", text("labelPlate"));
  player.frameUrl = (frame && parseCurrentFrame(frame, `${ROOT}/collection/frame/`)) ?? player.frameUrl;
  player.plateUrl = (plate && parseCurrentPlate(plate, `${ROOT}/collection/plate/`)) ?? player.plateUrl;

  reportProgress(createMatchingProgress());
  const b50Count = parsedB15.length + parsedB35.length;
  const { records: resolved, versionTotals } = await resolveViaBackground(
    [...parsedB15, ...parsedB35, ...parsedPage.candidates, ...parsedFullRecords],
    connection.id,
    text,
    // Only meaningful next to Full Records: a plate denominator counts charts
    // the player has never touched, which a B50-only document cannot support.
    includeFullRecords
  );
  const records = resolved.slice(0, b50Count) as ResolvedScore[];
  const candidateEnd = b50Count + parsedPage.candidates.length;
  const candidateRecords = resolved.slice(b50Count, candidateEnd) as ResolvedScore[];
  const resolvedFullRecords = resolved.slice(candidateEnd);
  const fullByChart = new Map(resolvedFullRecords.map((record) => [recordKey(record), record]));
  // Prefer the canonical Rating Target copy for charts in B50. It preserves
  // the exact same score/flags used to calculate the visible B15/B35.
  for (const record of records) {
    const full = fullByChart.get(recordKey(record));
    record.comboFlag ??= full?.comboFlag;
    record.syncFlag ??= full?.syncFlag;
    fullByChart.set(recordKey(record), record);
  }
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
    ...(versionTotals ? { versionTotals } : {}),
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
    const manifest = chrome.runtime.getManifest();
    sendResponse({ ok: false, error: `${error instanceof Error ? error.message : String(error)} [${manifest.version_name ?? manifest.version}]` });
  });
  return true;
});
