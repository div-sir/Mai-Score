import {
  createFetchProgress,
  createMatchingProgress,
  describeFetchError,
  FETCH_TIMEOUT_MS
} from "./lib/collect-progress";
import {
  parseCurrentFrame,
  parseFullRecordsPage,
  parseProfile,
  parseRecentPlaysPage,
  parseRatingTargetPage
} from "./lib/parser";
import {
  CONNECTION_PROTOCOL_VERSION,
  connectionForUrl,
  isCollectRequest,
  isSessionStatusRequest,
  type ConnectionDescriptor,
  type SessionStatusResponse
} from "./lib/connections";
import { calculateB50Breakdown } from "./lib/rating";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, popupText, type PopupLanguage } from "./lib/i18n";
import { CHART_DATA_SOURCE } from "./lib/chart-data";
import type { MaimaiImportRequest } from "./lib/maimai-import";
import type {
  CollectionResult,
  Difficulty,
  ParsedChartScore,
  ParsedFullScore,
  ResolvedChartScore,
  ResolvedRecentPlay,
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

/** A lightweight, read-only check used when the popup opens. It never stores
 * credentials and only reads the same authenticated home page as collection. */
async function probeSession(): Promise<SessionStatusResponse> {
  const profileFrom = (document: Document) => {
    try { return parseProfile(document, `${ROOT}/home/`).name; }
    catch { return undefined; }
  };
  const visiblePlayer = profileFrom(document);
  if (visiblePlayer) return { ok: true, signedIn: true, playerName: visiblePlayer };

  try {
    const response = await fetch(`${ROOT}/home/`, {
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(OPTIONAL_FETCH_TIMEOUT_MS)
    });
    if (!response.ok) return { ok: false, error: `DX NET returned ${response.status}.` };
    if (response.url && new URL(response.url).origin !== window.location.origin) {
      return { ok: true, signedIn: false };
    }
    const html = await response.text();
    const home = new DOMParser().parseFromString(html, "text/html");
    if (/ERROR\s+CODE\s*[:：]\s*200002(?!\d)/i.test(home.body.textContent ?? "")) {
      return { ok: true, signedIn: false };
    }
    const playerName = profileFrom(home);
    return playerName ? { ok: true, signedIn: true, playerName } : { ok: true, signedIn: false };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

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
  const recentPage = await decoration("/record/", text("labelRecentPlays"));
  const parsedRecentPlays = recentPage ? parseRecentPlaysPage(recentPage) : [];
  const frame = await decoration("/collection/frame/", text("labelFrame"));
  player.frameUrl = (frame && parseCurrentFrame(frame, `${ROOT}/collection/frame/`)) ?? player.frameUrl;

  reportProgress(createMatchingProgress());
  const b50Count = parsedB15.length + parsedB35.length;
  const { records: resolved, versionTotals } = await resolveViaBackground(
    [...parsedB15, ...parsedB35, ...parsedPage.candidates, ...parsedFullRecords, ...parsedRecentPlays],
    connection.id,
    text,
    // Only meaningful next to Full Records: a plate denominator counts charts
    // the player has never touched, which a B50-only document cannot support.
    includeFullRecords
  );
  const records = resolved.slice(0, b50Count) as ResolvedScore[];
  const candidateEnd = b50Count + parsedPage.candidates.length;
  const candidateRecords = resolved.slice(b50Count, candidateEnd) as ResolvedScore[];
  const fullRecordsEnd = candidateEnd + parsedFullRecords.length;
  const resolvedFullRecords = resolved.slice(candidateEnd, fullRecordsEnd);
  const recentPlays = resolved.slice(fullRecordsEnd) as ResolvedRecentPlay[];
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
    ...(recentPage ? { recentPlays } : {}),
    b15Rating,
    b35Rating,
    b50Rating,
    warnings
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!CONNECTION || message?.connectionId !== CONNECTION.id) return;
  if (isSessionStatusRequest(message)) {
    probeSession().then(sendResponse).catch((error: unknown) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    } satisfies SessionStatusResponse));
    return true;
  }
  if (!isCollectRequest(message)) return;
  collect(CONNECTION, message.includeFullRecords === true).then((data) => sendResponse({ ok: true, data })).catch((error: unknown) => {
    const manifest = chrome.runtime.getManifest();
    sendResponse({ ok: false, error: `${error instanceof Error ? error.message : String(error)} [${manifest.version_name ?? manifest.version}]` });
  });
  return true;
});

const PROMPT_DISMISSED_KEY = `mai-score-maimai-prompt:${CONNECTION?.id ?? "unknown"}`;

const promptCopy = (language: PopupLanguage, supportsFullRecords: boolean) => language === "zh-Hant" ? {
  eyebrow: "MAI-SCORE · DX NET",
  title: "要更新你的成績嗎？",
  body: supportsFullRecords
    ? "從目前登入的帳號收集 B50 與已遊玩譜面，完成後直接開啟 Studio。"
    : "從目前登入的帳號收集 B50，完成後直接開啟 Studio。",
  full: supportsFullRecords ? "收集完整記錄並開啟 Studio" : "收集 B50 並開啟 Studio",
  quick: "只收集 B50",
  collecting: "正在讀取 DX NET…",
  preparing: "收集完成，正在開啟 Studio…",
  close: "關閉"
} : language === "ja" ? {
  eyebrow: "MAI-SCORE · DX NET",
  title: "スコアを更新しますか？",
  body: supportsFullRecords
    ? "ログイン中のアカウントからB50とプレイ済み譜面を取得し、Studioを開きます。"
    : "ログイン中のアカウントからB50を取得し、Studioを開きます。",
  full: supportsFullRecords ? "全記録を取得してStudioを開く" : "B50を取得してStudioを開く",
  quick: "B50のみ取得",
  collecting: "DX NETを読み込み中…",
  preparing: "取得完了。Studioを開いています…",
  close: "閉じる"
} : {
  eyebrow: "MAI-SCORE · DX NET",
  title: "Update your scores?",
  body: supportsFullRecords
    ? "Collect B50 and played charts from the signed-in account, then open Studio."
    : "Collect B50 from the signed-in account, then open Studio.",
  full: supportsFullRecords ? "Collect Full Records and open Studio" : "Collect B50 and open Studio",
  quick: "Collect B50 only",
  collecting: "Reading DX NET…",
  preparing: "Collection complete — opening Studio…",
  close: "Close"
};

async function mountCollectionPrompt() {
  if (!CONNECTION || window.sessionStorage.getItem(PROMPT_DISMISSED_KEY)) return;
  // Real DX NET pages always contain visible page content. Skipping an empty
  // shell also avoids flashing the prompt while the site is still replacing
  // its initial document.
  if (!document.body?.textContent?.trim() && !document.querySelector("img,main,form")) return;
  const session = await probeSession();
  if (!session.ok || !session.signedIn || window.sessionStorage.getItem(PROMPT_DISMISSED_KEY)) return;
  const language = await currentLanguage();
  const supportsFullRecords = CONNECTION.id === "dxnet-intl";
  const text = promptCopy(language, supportsFullRecords);
  const host = document.createElement("div");
  host.id = "mai-score-collection-prompt";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host{all:initial}.card{position:fixed;z-index:2147483647;right:18px;bottom:18px;width:min(370px,calc(100vw - 36px));box-sizing:border-box;border:1px solid #d8d4ca;border-radius:12px;padding:16px;background:#fbfaf7;color:#252824;box-shadow:0 14px 36px #1719142e;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.top{display:flex;align-items:flex-start;gap:11px}.mark{display:grid;width:34px;height:34px;flex:none;place-items:center;border-radius:8px;background:#345f55;color:#fff;font-size:14px;font-weight:850}.heading{display:grid;min-width:0;flex:1;gap:1px}.eyebrow{color:#727970;font-size:9px;font-weight:750;letter-spacing:.08em}.title{font-size:16px;font-weight:750;letter-spacing:-.01em}.close{display:grid;width:30px;height:30px;place-items:center;border:1px solid transparent;border-radius:7px;background:transparent;color:#626960;cursor:pointer;font-size:20px;line-height:1}.close:hover{border-color:#d8d4ca;background:#f1efe9}.body{margin:11px 0 14px;color:#646a63;font-size:12px}.actions{display:grid;gap:7px}.action,.quick{width:100%;border-radius:8px;padding:10px 12px;cursor:pointer;font:700 12px/1.3 inherit}.action{border:1px solid #345f55;background:#345f55;color:#fff}.action:hover{background:#2c5149}.quick{border:1px solid #d8d4ca;background:#fff;color:#3d433e}.quick:hover{background:#f4f2ec}.action:disabled,.quick:disabled{cursor:wait;opacity:.58}.status{margin:9px 1px 0;color:#436e62;font-size:10px}.status:empty{display:none}@media(max-width:560px){.card{right:10px;bottom:10px;width:calc(100vw - 20px)}}@media(prefers-color-scheme:dark){.card{border-color:#3a403b;background:#20241f;color:#f1efe9;box-shadow:0 16px 42px #0007}.eyebrow,.body{color:#aeb4ad}.close{color:#c3c7c1}.close:hover,.quick:hover{border-color:#454c46;background:#292e29}.quick{border-color:#454c46;background:#252a25;color:#e4e7e2}.action{border-color:#6d9b8d;background:#6d9b8d;color:#101511}.action:hover{background:#7aa899}.status{color:#91b9ad}}
    </style>
    <section class="card" role="dialog" aria-label="${text.title}">
      <div class="top"><span class="mark" aria-hidden="true">M</span><div class="heading"><span class="eyebrow">${text.eyebrow}</span><strong class="title">${text.title}</strong></div><button class="close" type="button" aria-label="${text.close}">×</button></div>
      <p class="body">${text.body}</p>
      <div class="actions"><button class="action" type="button">${text.full}</button>${supportsFullRecords ? `<button class="quick" type="button">${text.quick}</button>` : ""}</div>
      <p class="status" role="status"></p>
    </section>`;
  document.documentElement.append(host);
  const close = shadow.querySelector<HTMLButtonElement>(".close")!;
  const action = shadow.querySelector<HTMLButtonElement>(".action")!;
  const quick = shadow.querySelector<HTMLButtonElement>(".quick");
  const status = shadow.querySelector<HTMLElement>(".status")!;
  const dismiss = () => {
    window.sessionStorage.setItem(PROMPT_DISMISSED_KEY, "1");
    document.removeEventListener("pointerdown", outsideClick, true);
    document.removeEventListener("keydown", keydown, true);
    host.remove();
  };
  const outsideClick = (event: Event) => {
    if (!event.composedPath().includes(host)) dismiss();
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") dismiss();
  };
  close.addEventListener("click", dismiss);
  const run = async (includeFullRecords: boolean) => {
    action.disabled = true;
    if (quick) quick.disabled = true;
    status.textContent = text.collecting;
    try {
      const data = await collect(CONNECTION, includeFullRecords);
      status.textContent = text.preparing;
      const response = await chrome.runtime.sendMessage({
        type: "MAI_SCORE_MAIMAI_IMPORT",
        data,
        language,
        autoSync: true
      } satisfies MaimaiImportRequest) as { ok: boolean; error?: string } | undefined;
      if (!response?.ok) throw new Error(response?.error ?? "Mai-Score could not open Studio.");
      dismiss();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
      action.disabled = false;
      if (quick) quick.disabled = false;
    }
  };
  action.addEventListener("click", () => void run(supportsFullRecords));
  quick?.addEventListener("click", () => void run(false));
  window.requestAnimationFrame(() => {
    if (!host.isConnected) return;
    document.addEventListener("pointerdown", outsideClick, true);
    document.addEventListener("keydown", keydown, true);
  });
}

void mountCollectionPrompt();
