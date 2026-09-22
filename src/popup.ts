import { isCollectProgressMessage } from "./lib/collect-progress";
import {
  connectionForUrl,
  createCollectRequest,
  createSessionStatusRequest,
  popupPageContextForUrl,
  type PopupPageContext,
  type SessionStatusResponse
} from "./lib/connections";
import { toDxratingJson, toFullJson, toRhythmRecordJson } from "./lib/export";
import { DEFAULT_IMAGE_OPTIONS, timestampForFilename } from "./lib/image-options";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  intlLocale,
  popupText,
  type PopupLanguage
} from "./lib/i18n";
import { renderB50Document } from "./lib/render";
import { recordBadgeNames } from "./lib/achievement-rank";
import { CHART_DATA_SOURCE, chartDataIsStale } from "./lib/chart-data";
import {
  connectDrive,
  disconnectDrive,
  driveConnection,
  driveEnabled,
  setDriveEnabled,
  type AuthDeps
} from "./lib/drive-auth";
import {
  STUDIO_TRANSFER_TTL_MS,
  STUDIO_URL,
  studioTransferKey,
  studioTransferUrl,
  type StudioTransferAssets,
  type StudioTransfer
} from "./lib/studio-transfer";
import type { CollectionResult } from "./lib/types";
import { decodeKonamiCsvBytes, parseKonamiCsv, type KonamiCsvGame } from "./lib/konami-csv";
import { isKonamiImportRequest, LAST_COLLECTION_KEY, LAST_RHYTHM_RECORD_KEY } from "./lib/konami-import";
import type { RhythmRecordEnvelope } from "./lib/rhythm-record";
import {
  isKonamiPageSnapshot,
  LAST_KONAMI_PAGE_KEY,
  type KonamiPageCollectRequest,
  type KonamiPageSnapshot
} from "./lib/konami-page";

let result: CollectionResult | null = null;
let latestRhythmRecord: RhythmRecordEnvelope | null = null;
let latestKonamiPage: KonamiPageSnapshot | null = null;
let pageContext: PopupPageContext = "other";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $("status");
const exportButton = $<HTMLButtonElement>("export");
const studioButton = $<HTMLButtonElement>("studio");
const collectButton = $<HTMLButtonElement>("collect");
const updateStudioButton = $<HTMLButtonElement>("update-studio");
const fullRecordsCheckbox = $<HTMLInputElement>("include-full-records");
const languageSelect = $<HTMLSelectElement>("language");
const konamiGame = $<HTMLSelectElement>("konami-game");
const konamiFile = $<HTMLInputElement>("konami-file");
const konamiImportButton = $<HTMLButtonElement>("konami-import");
const konamiOpenLastButton = $<HTMLButtonElement>("konami-open-last");
const driveConnectButton = $<HTMLButtonElement>("drive-connect");
const driveDisconnectButton = $<HTMLButtonElement>("drive-disconnect");
const collectionModeInputs = document.querySelectorAll<HTMLInputElement>('input[name="collection-mode"]');
const extensionDriveAvailable = typeof chrome.identity?.getAuthToken === "function";
const directDownloadsAvailable = typeof chrome.downloads?.download === "function";
let language: PopupLanguage = DEFAULT_LANGUAGE;
type LoginState = "checking" | "signed-in" | "signed-out" | "unavailable";
let loginState: LoginState = "checking";
let loginPlayer = "";

function t(key: string, ...values: Array<string | number>) {
  return popupText(language, key, ...values);
}

function pageCopy() {
  const copies = language === "zh-Hant" ? {
    maimai: ["maimai DX 成績收集", "maimai DX NET", "開啟 DX NET 後可收集 B50 與完整記錄。"],
    "sound-voltex": ["SOUND VOLTEX 資料收集", "SOUND VOLTEX", "直接收集可讀 PLAY DATA；官方 CSV 保留為選用方式。"],
    "beatmania-iidx": ["beatmania IIDX 資料收集", "beatmania IIDX", "直接收集可讀 DJ DATA；官方 CSV 保留為選用方式。"],
    "dance-dance-revolution": ["DDR WORLD 資料收集", "已偵測 DanceDanceRevolution WORLD", "可以直接整理目前登入狀態下能開啟的 PLAY DATA；付費或登入限制頁會標示為無法取得。"],
    other: ["選擇支援的音樂遊戲網站", "目前頁面不支援直接收集", "請開啟 maimai DX NET、SOUND VOLTEX 或 beatmania IIDX 的成績頁。"],
    studio: "開啟 Mai-Score Studio"
  } : language === "ja" ? {
    maimai: ["maimai DX スコア収集", "maimai DX NET", "DX NETからB50と全記録を収集できます。"],
    "sound-voltex": ["SOUND VOLTEX スコア取込", "SOUND VOLTEX", "このページの公式CSVを端末内で整理します。"],
    "beatmania-iidx": ["beatmania IIDX スコア取込", "beatmania IIDX", "このページの公式CSVを端末内で整理します。"],
    "dance-dance-revolution": ["DDR WORLD データ収集", "DanceDanceRevolution WORLDを検出", "現在のログイン状態で開けるPLAY DATAを整理できます。有料・ログイン制限ページは取得不可として表示します。"],
    other: ["対応サイトを開いてください", "このページでは直接収集できません", "maimai DX NET、SOUND VOLTEX、beatmania IIDXのスコアページを開いてください。"],
    studio: "Mai-Score Studioを開く"
  } : {
    maimai: ["maimai DX score collection", "maimai DX NET", "Collect B50 and Full Records from DX NET."],
    "sound-voltex": ["SOUND VOLTEX score import", "SOUND VOLTEX", "Use the official CSV from this site; processing stays on this device."],
    "beatmania-iidx": ["beatmania IIDX score import", "beatmania IIDX", "Use the official CSV from this site; processing stays on this device."],
    "dance-dance-revolution": ["DDR WORLD data collection", "DanceDanceRevolution WORLD detected", "Collect PLAY DATA available in the current session. Paid or sign-in-gated pages are reported as unavailable."],
    other: ["Open a supported rhythm-game site", "Direct collection is unavailable here", "Open a maimai DX NET, SOUND VOLTEX, or beatmania IIDX score page."],
    studio: "Open Mai-Score Studio"
  };
  return copies;
}

function applyPageContext() {
  const isMaimai = pageContext === "maimai";
  const isKonamiFile = pageContext === "sound-voltex" || pageContext === "beatmania-iidx";
  const isKonamiPage = isKonamiFile || pageContext === "dance-dance-revolution";
  document.querySelectorAll<HTMLElement>(".maimai-context").forEach((element) => { element.hidden = !isMaimai; });
  document.querySelectorAll<HTMLElement>(".konami-context").forEach((element) => { element.hidden = !isKonamiFile; });
  document.querySelectorAll<HTMLElement>(".konami-page-context").forEach((element) => { element.hidden = !isKonamiPage; });
  const notice = $("context-notice");
  notice.hidden = isMaimai || isKonamiFile;
  const text = pageCopy();
  const [subtitle, title, message] = text[pageContext];
  $("context-subtitle").textContent = subtitle;
  $("context-title").textContent = title;
  $("context-message").textContent = message;
  $("context-game-mark").textContent = pageContext === "dance-dance-revolution" ? "DDR" : "♪";
  $("context-open-studio").textContent = text.studio;
  if (isKonamiFile) {
    konamiGame.value = pageContext;
    konamiGame.disabled = true;
  }
}

function applyLanguage() {
  document.documentElement.lang = language;
  languageSelect.value = language;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = t(key);
  });
  renderChartDataState();
  if (result) renderUnmatchedCharts(result);
  updateCollectLabel();
  renderLoginState(loginState, loginPlayer);
  const gameName = pageContext === "beatmania-iidx" ? "beatmania IIDX" : "SOUND VOLTEX";
  const konami = language === "zh-Hant" ? {
    title: `${gameName} 成績匯入`, hint: "選擇這個遊戲的官方 CSV，整理後直接在 Studio 開啟。",
    official: "開啟官方 CSV", action: "選擇 CSV 並在 Studio 開啟", last: "重新開啟上次成績"
  } : language === "ja" ? {
    title: `${gameName} スコア取込`, hint: "このゲームの公式CSVを選び、Studioで直接開きます。",
    official: "公式CSVを開く", action: "CSVを選んでStudioで開く", last: "前回のスコアを開く"
  } : {
    title: `${gameName} score import`, hint: "Choose this game's official CSV and open the organized records in Studio.",
    official: "Open official CSV", action: "Choose CSV and open Studio", last: "Open last imported scores"
  };
  $("konami-title").textContent = konami.title;
  $("konami-hint").textContent = konami.hint;
  $("konami-official").textContent = konami.official;
  konamiImportButton.textContent = konami.action;
  konamiOpenLastButton.textContent = konami.last;
  const direct = language === "zh-Hant" ? {
    title: "免費收集可讀資料", hint: "整理目前登入狀態能開啟的頁面；不讀取帳密，也不繞過付費限制。",
    action: "收集所有可以找到的資料", last: "重新開啟上次收集"
  } : language === "ja" ? {
    title: "閲覧可能なデータを無料収集", hint: "現在開けるページのみ整理します。認証情報や有料制限は回避しません。",
    action: "見つかるデータをすべて収集", last: "前回の収集を開く"
  } : {
    title: "Collect readable data for free", hint: "Organizes pages available now; credentials and paid restrictions are never bypassed.",
    action: "Collect everything available", last: "Open last collection"
  };
  $("konami-page-title").textContent = direct.title;
  $("konami-page-hint").textContent = direct.hint;
  $("konami-page-action").textContent = direct.action;
  $("konami-page-open-last").textContent = direct.last;
  applyPageContext();
}

function renderLoginState(next: LoginState, playerName = "") {
  loginState = next;
  loginPlayer = playerName;
  const panel = $("login-state");
  panel.className = `login-state ${next}`;
  $("login-state-label").textContent = t(next === "signed-in" ? "loginSignedIn"
    : next === "signed-out" ? "loginSignedOut"
      : next === "unavailable" ? "loginUnavailable" : "loginChecking");
  $("login-player").textContent = playerName;
  $("open-dxnet").hidden = next === "signed-in" || next === "checking";
  const canCollect = next === "signed-in";
  collectButton.disabled = !canCollect;
  updateStudioButton.disabled = !canCollect;
}

function renderUnmatchedCharts(data: CollectionResult) {
  const unmatched = data.fullRecords?.filter((record) => record.warning) ?? [];
  const panel = $("unmatched-charts");
  panel.hidden = unmatched.length === 0;
  $("unmatched-count").textContent = unmatched.length ? t("unmatchedChartCount", unmatched.length) : "";
  const list = $("unmatched-list");
  list.replaceChildren(...unmatched.map((record) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = record.title;
    const type = document.createElement("span");
    type.textContent = record.type.toUpperCase();
    const chart = document.createElement("small");
    chart.textContent = `${record.difficulty.toUpperCase()} · Lv ${record.displayedLevel} · ${record.achievementRate.toFixed(4)}%`;
    item.append(title, type, chart);
    return item;
  }));
}

function renderChartDataState() {
  const element = $("chart-data");
  const locale = intlLocale(language);
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: "medium" })
    .format(new Date(CHART_DATA_SOURCE.updateTime));
  const sheets = CHART_DATA_SOURCE.sheets.toLocaleString(locale);
  const stale = chartDataIsStale();
  element.textContent = t(stale ? "chartDataStale" : "chartDataUpdated", updated, sheets);
  element.classList.toggle("stale", stale);
}

async function initializeLanguage() {
  const stored = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
  const candidate = stored[LANGUAGE_STORAGE_KEY];
  language = candidate === "zh-Hant" || candidate === "ja" || candidate === "en"
    ? candidate
    : DEFAULT_LANGUAGE;
  applyLanguage();
  setStatus(t("login"));
}

function setStatus(text: string, kind = "") {
  status.textContent = text;
  status.className = `status ${kind}`;
}

async function readCsvFile(file: File): Promise<string> {
  // KONAMI downloads have historically used both UTF-8 and Windows Japanese
  // encodings. Decode locally; the original file never leaves the browser.
  return decodeKonamiCsvBytes(await file.arrayBuffer());
}

function updateCollectLabel() {
  collectButton.textContent = t("collectOnly");
  updateStudioButton.textContent = t("updateStudio");
}

function setCollectionModeDisabled(disabled: boolean) {
  collectionModeInputs.forEach((input) => { input.disabled = disabled; });
}

async function refreshLoginState() {
  if (pageContext !== "maimai") return;
  renderLoginState("checking");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const connection = tab?.url ? connectionForUrl(tab.url) : undefined;
    if (!tab?.id || !connection || connection.transport !== "content-script") {
      renderLoginState("signed-out");
      setStatus(t("login"));
      return;
    }
    const response = await chrome.tabs.sendMessage(
      tab.id,
      createSessionStatusRequest(connection.id)
    ) as SessionStatusResponse | undefined;
    if (!response?.ok) {
      renderLoginState("unavailable");
      setStatus(response?.error ?? t("loginUnavailable"), "error");
      return;
    }
    if (!response.signedIn) {
      renderLoginState("signed-out");
      setStatus(t("login"));
      return;
    }
    renderLoginState("signed-in", response.playerName);
    setStatus(t("loginSignedIn"), "ok");
  } catch (error) {
    renderLoginState("unavailable");
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
}

$("open-dxnet").addEventListener("click", async () => {
  await chrome.tabs.create({ url: "https://maimaidx-eng.com/maimai-mobile/" });
});

const authDeps: AuthDeps = {
  identity: chrome.identity,
  fetch: globalThis.fetch,
  clearLastError: () => { void chrome.runtime.lastError; }
};

function renderDriveState(connected: boolean) {
  $("drive-state").textContent = t(connected ? "driveConnected" : "driveDisconnected");
  driveConnectButton.hidden = connected;
  driveDisconnectButton.hidden = !connected;
}

async function refreshDriveState() {
  if (!extensionDriveAvailable) {
    $("drive-panel").hidden = true;
    return;
  }
  if (!await driveEnabled(chrome.storage.local)) {
    renderDriveState(false);
    return;
  }
  renderDriveState(await driveConnection(authDeps) === "connected");
}

driveConnectButton.addEventListener("click", async () => {
  driveConnectButton.disabled = true;
  $("drive-state").textContent = t("driveConnecting");
  try {
    const outcome = await connectDrive(authDeps);
    // Cancelling is a choice, not a failure — say so plainly and leave the
    // panel in its disconnected state rather than showing an error.
    if (outcome.ok) {
      await setDriveEnabled(chrome.storage.local, true);
      setStatus(t("driveConnectedDone"), "ok");
    } else {
      setStatus(t(outcome.error === "cancelled" ? "driveCancelled" : "driveFailed", outcome.error));
    }
  } catch (error) {
    setStatus(t("driveFailed", error instanceof Error ? error.message : String(error)), "error");
  } finally {
    driveConnectButton.disabled = false;
    await refreshDriveState();
  }
});

driveDisconnectButton.addEventListener("click", async () => {
  driveDisconnectButton.disabled = true;
  $("drive-state").textContent = t("driveDisconnecting");
  try {
    // Disable Drive before touching remote authorization. This preference
    // prevents Chrome from silently reissuing a token on the next popup open.
    await setDriveEnabled(chrome.storage.local, false);
    await disconnectDrive(authDeps);
    renderDriveState(false);
    setStatus(t("driveDisconnectedDone"), "ok");
  } catch (error) {
    // Local Identity state is cleared even when Google cannot be reached. Do
    // not immediately request a new token here, which would make Disconnect
    // appear to have done nothing while Google's revocation is still pending.
    renderDriveState(false);
    setStatus(t("driveDisconnectFailed", error instanceof Error ? error.message : String(error)), "error");
  } finally {
    driveDisconnectButton.disabled = false;
  }
});

function downloadText(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  chrome.downloads.download({ url, filename: name, saveAs: true }, () =>
    setTimeout(() => URL.revokeObjectURL(url), 30000));
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: name, saveAs: true }, () =>
    setTimeout(() => URL.revokeObjectURL(url), 30000));
}

async function fetchDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return undefined;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      output[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return output;
}

async function collect() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error(t("noTab"));
  const connection = connectionForUrl(tab.url);
  if (!connection) throw new Error(t("openDxnet"));
  if (connection.transport !== "content-script") throw new Error(t("unsupported", connection.label));
  const response = await chrome.tabs.sendMessage(
    tab.id,
    createCollectRequest(connection.id, fullRecordsCheckbox.checked)
  ) as
    { ok: true; data: CollectionResult } | { ok: false; error: string };
  return { response, connection };
}

async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const image = new Image();
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(t("svgFailed")));
      image.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(t("canvasFailed"));
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(t("pngFailed"))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function exportQuickPng() {
  if (!result) return;
  const source = result.source;
  const generatedAt = new Date();
  setStatus(t("preparingPng"));
  const options = DEFAULT_IMAGE_OPTIONS;
  const coverNames = [...new Set(result.records.flatMap((record) => record.imageName ? [record.imageName] : []))];
  const coverPairs = await mapConcurrent(coverNames, 8, async (name) => [
    name,
    await fetchDataUrl(`https://shama.dxrating.net/images/cover/v2/${name}.jpg`)
  ] as const);
  const covers = Object.fromEntries(
    coverPairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1]))
  );
  const badgeNames = [...new Set(result.records.flatMap(recordBadgeNames))];
  const badgePairs = await mapConcurrent(badgeNames, 8, async (name) => [
    name,
    await fetchDataUrl(new URL(`/maimai-mobile/img/${name}`, source).href)
  ] as const);
  const badges = Object.fromEntries(
    badgePairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1]))
  );
  const [icon, frame] = await Promise.all([
    fetchDataUrl(result.player.iconUrl),
    fetchDataUrl(result.player.frameUrl)
  ]);
  const rendered = renderB50Document(result, options, { icon, frame, covers, badges }, generatedAt, intlLocale(language));
  const blob = await svgToPng(rendered.svg, rendered.width, rendered.height);
  const safePlayer = result.player.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  downloadBlob(`mai-score-${safePlayer}-${timestampForFilename(generatedAt)}.png`, blob);
  setStatus(t("pngReady"), "ok");
}

async function prepareStudioAssets(): Promise<StudioTransferAssets> {
  if (!result) return { covers: {} };
  const source = result.source;
  const coverNames = [...new Set([...result.records, ...(result.candidateRecords ?? []), ...(result.recentPlays ?? [])]
    .flatMap((record) => record.imageName ? [record.imageName] : []))];
  const coverPairs = await mapConcurrent(coverNames, 8, async (name) => [
    name,
    await fetchDataUrl(`https://shama.dxrating.net/images/cover/v2/${name}.jpg`)
  ] as const);
  const badgeNames = [...new Set(result.records.flatMap(recordBadgeNames))];
  const badgePairs = await mapConcurrent(badgeNames, 8, async (name) => [
    name,
    await fetchDataUrl(new URL(`/maimai-mobile/img/${name}`, source).href)
  ] as const);
  const [icon, frame] = await Promise.all([
    fetchDataUrl(result.player.iconUrl),
    fetchDataUrl(result.player.frameUrl)
  ]);
  return {
    icon,
    frame,
    badges: Object.fromEntries(
      badgePairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1]))
    ),
    covers: Object.fromEntries(
      coverPairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1]))
    )
  };
}

// Live progress from the content script's fetches. Guarded on the busy class
// so a stray message from a stale run (or a previous popup instance) can't
// overwrite the final result once collection has finished.
chrome.runtime.onMessage.addListener((message) => {
  if (!isCollectProgressMessage(message)
    || (!collectButton.classList.contains("busy") && !updateStudioButton.classList.contains("busy"))) return;
  setStatus(message.stage === "matching" ? t("matchingCharts") : t("fetchProgress", message.done ?? 0, message.total ?? 3));
});

function renderCollectionResult(data: CollectionResult) {
  result = data;
  $("summary").hidden = false;
  $("player").textContent = data.player.name;
  const gap = data.b50Rating - data.player.rating;
  $("b50-rating").textContent = gap === 0
    ? String(data.b50Rating)
    : `${data.b50Rating} (${gap > 0 ? "+" : ""}${gap})`;
  $("resolved").textContent = data.fullRecords
    ? t("resolvedFull", data.records.length - data.warnings.length, data.fullRecords.length - (data.fullRecordsUnmatched ?? 0), data.fullRecords.length)
    : `${data.records.length - data.warnings.length}/50`;
  renderUnmatchedCharts(data);
  exportButton.disabled = false;
  studioButton.disabled = false;
}

function showCollectionStatus(connectionLabel: string) {
  if (!result) return;
  const gap = result.b50Rating - result.player.rating;
  const unmatchedFullRecords = result.fullRecordsUnmatched ?? 0;
  setStatus(
    gap !== 0
      ? t("ratingGap", `${gap > 0 ? "+" : ""}${gap}`, result.warnings.length)
      : result.warnings.length
        ? t("unmatched", connectionLabel, result.warnings.length)
        : result.fullRecords
          ? t("collectedFull", result.fullRecords.length, unmatchedFullRecords)
          : t("collected"),
    gap === 0 && !result.warnings.length && !unmatchedFullRecords ? "ok" : unmatchedFullRecords ? "warning" : ""
  );
}

async function openStudio(autoSync: boolean) {
  if (!result) return;
  const token = crypto.randomUUID();
  const assets = await prepareStudioAssets();
  const transfer: StudioTransfer = {
    data: result,
    assets,
    language,
    expiresAt: Date.now() + STUDIO_TRANSFER_TTL_MS
  };
  await chrome.storage.session.set({ [studioTransferKey(token)]: transfer });
  await chrome.tabs.create({ url: studioTransferUrl(chrome.runtime.id, token, autoSync) });
  setStatus(t(autoSync ? "studioAutoOpened" : "studioOpened", Object.keys(assets.covers).length), "ok");
}

async function openRhythmStudio(data: RhythmRecordEnvelope) {
  const token = crypto.randomUUID();
  const transfer: StudioTransfer = {
    data,
    assets: { covers: {} },
    language,
    expiresAt: Date.now() + STUDIO_TRANSFER_TTL_MS
  };
  await chrome.storage.session.set({ [studioTransferKey(token)]: transfer });
  await chrome.tabs.create({ url: studioTransferUrl(chrome.runtime.id, token) });
}

async function openKonamiPageStudio(data: KonamiPageSnapshot) {
  const token = crypto.randomUUID();
  const transfer: StudioTransfer = {
    data,
    assets: { covers: {} },
    language,
    expiresAt: Date.now() + STUDIO_TRANSFER_TTL_MS
  };
  await chrome.storage.session.set({ [studioTransferKey(token)]: transfer });
  await chrome.tabs.create({ url: studioTransferUrl(chrome.runtime.id, token) });
}

function renderKonamiPageResult(data: KonamiPageSnapshot) {
  latestKonamiPage = data;
  const matchesPage = data.source.game === pageContext;
  const line = $("konami-page-result");
  line.hidden = !matchesPage;
  line.textContent = language === "zh-Hant"
    ? `可讀 ${data.summary.collected} 頁 · ${data.summary.fields} 個欄位 · ${data.summary.tables} 個表格 · ${data.summary.paid + data.summary.signInRequired} 頁受限`
    : language === "ja"
      ? `取得 ${data.summary.collected}ページ · ${data.summary.fields}項目 · ${data.summary.tables}表 · 制限 ${data.summary.paid + data.summary.signInRequired}ページ`
      : `${data.summary.collected} pages · ${data.summary.fields} fields · ${data.summary.tables} tables · ${data.summary.paid + data.summary.signInRequired} restricted`;
  $("konami-page-open-last").hidden = !matchesPage;
}

function renderRhythmResult(data: RhythmRecordEnvelope) {
  latestRhythmRecord = data;
  const matchesPage = data.source.game === pageContext;
  const game = data.source.game === "beatmania-iidx" ? "beatmania IIDX" : "SOUND VOLTEX";
  const resultLine = $("konami-result");
  resultLine.hidden = !matchesPage;
  resultLine.textContent = `${game} · ${data.records.length.toLocaleString()} charts`;
  konamiOpenLastButton.hidden = !matchesPage;
}

$("konami-official").addEventListener("click", async () => {
  const game = konamiGame.value;
  const url = game === "beatmania-iidx"
    ? "https://p.eagate.573.jp/game/2dx/33/djdata/score_download.html"
    : "https://p.eagate.573.jp/game/sdvx/vii/playdata/download/index.html";
  await chrome.tabs.create({ url });
});

$("context-open-studio").addEventListener("click", async () => {
  await chrome.tabs.create({ url: STUDIO_URL });
});

$<HTMLButtonElement>("konami-page-action").addEventListener("click", async () => {
  const button = $<HTMLButtonElement>("konami-page-action");
  if (button.disabled) return;
  button.disabled = true;
  button.classList.add("busy");
  const resultLine = $("konami-page-result");
  resultLine.hidden = false;
  resultLine.textContent = language === "zh-Hant" ? "正在檢查可讀的 PLAY DATA 頁面…"
    : language === "ja" ? "閲覧可能なPLAY DATAを確認中…" : "Checking readable PLAY DATA pages…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error(t("noTab"));
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "MAI_SCORE_KONAMI_PAGE_COLLECT"
    } satisfies KonamiPageCollectRequest) as { ok: true; data: KonamiPageSnapshot } | { ok: false; error: string };
    if (!response?.ok) throw new Error(response?.error ?? "Mai-Score did not respond.");
    renderKonamiPageResult(response.data);
    await chrome.storage.local.set({ [LAST_KONAMI_PAGE_KEY]: response.data });
    await openKonamiPageStudio(response.data);
  } catch (error) {
    resultLine.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    button.disabled = false;
    button.classList.remove("busy");
  }
});

$<HTMLButtonElement>("konami-page-open-last").addEventListener("click", async () => {
  if (!latestKonamiPage) return;
  await openKonamiPageStudio(latestKonamiPage);
});

konamiImportButton.addEventListener("click", () => konamiFile.click());
konamiOpenLastButton.addEventListener("click", async () => {
  if (!latestRhythmRecord) return;
  konamiOpenLastButton.disabled = true;
  try {
    await openRhythmStudio(latestRhythmRecord);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    konamiOpenLastButton.disabled = false;
  }
});
konamiFile.addEventListener("change", async () => {
  const file = konamiFile.files?.[0];
  if (!file) return;
  konamiImportButton.disabled = true;
  konamiImportButton.classList.add("busy");
  try {
    const rhythmResult = parseKonamiCsv(await readCsvFile(file), file.name, konamiGame.value as KonamiCsvGame);
    renderRhythmResult(rhythmResult);
    await chrome.storage.local.set({ [LAST_RHYTHM_RECORD_KEY]: rhythmResult });
    await openRhythmStudio(rhythmResult);
    const game = rhythmResult.source.game === "beatmania-iidx" ? "beatmania IIDX" : "SOUND VOLTEX";
    setStatus(`${game}: ${rhythmResult.records.length.toLocaleString()} charts imported.`, "ok");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    konamiFile.value = "";
    konamiImportButton.disabled = false;
    konamiImportButton.classList.remove("busy");
  }
});

async function runCollection(trigger: HTMLButtonElement, updateStudio: boolean) {
  // A collection is sequential and must have only one owner; otherwise two
  // runs can race the shared DX NET session and overwrite the popup result.
  if (trigger.disabled) return;
  collectButton.disabled = true;
  updateStudioButton.disabled = true;
  setCollectionModeDisabled(true);
  trigger.classList.add("busy");
  setStatus(t(fullRecordsCheckbox.checked ? "fetchingFull" : "fetching"));
  try {
    const { response, connection } = await collect();
    if (!response.ok) throw new Error(response.error);
    renderCollectionResult(response.data);
    await chrome.storage.local.set({ [LAST_COLLECTION_KEY]: response.data });
    if (updateStudio) {
      setStatus(t("studioUpdating"));
      await openStudio(true);
    } else {
      showCollectionStatus(connection.label);
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    const canCollect = loginState === "signed-in";
    collectButton.disabled = !canCollect;
    updateStudioButton.disabled = !canCollect;
    setCollectionModeDisabled(false);
    trigger.classList.remove("busy");
  }
}

collectButton.addEventListener("click", () => void runCollection(collectButton, false));
updateStudioButton.addEventListener("click", () => void runCollection(updateStudioButton, true));

$<HTMLButtonElement>("studio").addEventListener("click", async () => {
  if (!result) return;
  studioButton.disabled = true;
  setStatus(t("preparingAssets"));
  try {
    await openStudio(false);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    studioButton.disabled = false;
  }
});

$<HTMLButtonElement>("export").addEventListener("click", async () => {
  if (!result) return;
  try {
    switch ($<HTMLSelectElement>("export-format").value) {
      case "png":
        await exportQuickPng();
        break;
      case "dxrating":
        downloadText("mai-score-dxrating.json", toDxratingJson(result), "application/json");
        setStatus(t("dxratingReady"), "ok");
        break;
      case "full":
        downloadText("mai-score-full.json", toFullJson(result), "application/json");
        setStatus(t("fullReady"), "ok");
        break;
      case "rhythm":
        downloadText("mai-score-rhythm-record.json", toRhythmRecordJson(result), "application/json");
        setStatus(t("rhythmReady"), "ok");
        break;
      default:
        throw new Error(t("unknownFormat"));
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
});

languageSelect.addEventListener("change", () => {
  language = languageSelect.value as PopupLanguage;
  applyLanguage();
  void chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: language });
  if (pageContext === "maimai") {
    void refreshDriveState();
    void refreshLoginState();
  }
});

collectionModeInputs.forEach((input) => {
  input.addEventListener("change", updateCollectLabel);
});

async function initializePopup() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  pageContext = popupPageContextForUrl(tab?.url);
  await initializeLanguage();
  const detected = tab?.url ? connectionForUrl(tab.url) : undefined;
  if (detected?.id === "iidx-konami-csv") konamiGame.value = "beatmania-iidx";
  if (detected?.id === "sdvx-konami") konamiGame.value = "sound-voltex";
  if (!directDownloadsAvailable) $("direct-export").hidden = true;
  // Never interactive on open: the panel reflects existing state, and consent
  // is only ever raised by the user pressing Connect.
  if (pageContext === "maimai") {
    await refreshDriveState();
    await refreshLoginState();
  }
  const stored = await chrome.storage.local.get([LAST_COLLECTION_KEY, LAST_RHYTHM_RECORD_KEY, LAST_KONAMI_PAGE_KEY]);
  const collection = stored[LAST_COLLECTION_KEY];
  if (pageContext === "maimai" && collection && typeof collection === "object" && Array.isArray((collection as CollectionResult).records)
    && (collection as CollectionResult).player?.name) {
    renderCollectionResult(collection as CollectionResult);
  }
  const rhythm = stored[LAST_RHYTHM_RECORD_KEY];
  const restoreRequest = { type: "MAI_SCORE_KONAMI_IMPORT", data: rhythm, language };
  if (isKonamiImportRequest(restoreRequest)) {
    renderRhythmResult(restoreRequest.data);
  }
  if (isKonamiPageSnapshot(stored[LAST_KONAMI_PAGE_KEY])) {
    renderKonamiPageResult(stored[LAST_KONAMI_PAGE_KEY]);
  }
}

void initializePopup();
