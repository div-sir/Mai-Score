import { isCollectProgressMessage } from "./lib/collect-progress";
import { connectionForUrl, createCollectRequest } from "./lib/connections";
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
import { ratingStars, ratingTier } from "./lib/rating-tier";
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
  type StudioTransferAssets,
  type StudioTransfer
} from "./lib/studio-transfer";
import type { CollectionResult } from "./lib/types";

let result: CollectionResult | null = null;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $("status");
const exportButton = $<HTMLButtonElement>("export");
const studioButton = $<HTMLButtonElement>("studio");
const collectButton = $<HTMLButtonElement>("collect");
const fullRecordsCheckbox = $<HTMLInputElement>("include-full-records");
const languageSelect = $<HTMLSelectElement>("language");
const driveConnectButton = $<HTMLButtonElement>("drive-connect");
const driveDisconnectButton = $<HTMLButtonElement>("drive-disconnect");
let language: PopupLanguage = DEFAULT_LANGUAGE;

function t(key: string, ...values: Array<string | number>) {
  return popupText(language, key, ...values);
}

function applyLanguage() {
  document.documentElement.lang = language;
  languageSelect.value = language;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = t(key);
  });
  renderChartDataState();
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

function applyRatingBadge(rating: number) {
  const tier = ratingTier(rating);
  const label = document.querySelector<HTMLElement>("#official-rating-badge .rating-badge-label");
  if (label) {
    label.style.background = `linear-gradient(135deg, ${tier.gradient.join(", ")})`;
    label.style.color = tier.labelColor;
  }
  const stars = document.getElementById("official-rating-stars");
  if (stars) stars.textContent = "★".repeat(ratingStars(rating));
}

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
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const blob = await response.blob();
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
  const [icon, frame, plate] = await Promise.all([
    fetchDataUrl(result.player.iconUrl),
    fetchDataUrl(result.player.frameUrl),
    fetchDataUrl(result.player.plateUrl)
  ]);
  const rendered = renderB50Document(result, options, { icon, frame, plate, covers, badges }, generatedAt, intlLocale(language));
  const blob = await svgToPng(rendered.svg, rendered.width, rendered.height);
  const safePlayer = result.player.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  downloadBlob(`mai-score-${safePlayer}-${timestampForFilename(generatedAt)}.png`, blob);
  setStatus(t("pngReady"), "ok");
}

async function prepareStudioAssets(): Promise<StudioTransferAssets> {
  if (!result) return { covers: {} };
  const source = result.source;
  const coverNames = [...new Set([...result.records, ...(result.candidateRecords ?? [])]
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
  const [icon, frame, plate] = await Promise.all([
    fetchDataUrl(result.player.iconUrl),
    fetchDataUrl(result.player.frameUrl),
    fetchDataUrl(result.player.plateUrl)
  ]);
  return {
    icon,
    frame,
    plate,
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
  if (!isCollectProgressMessage(message) || !collectButton.classList.contains("busy")) return;
  setStatus(message.stage === "matching" ? t("matchingCharts") : t("fetchProgress", message.done ?? 0, message.total ?? 3));
});

collectButton.addEventListener("click", async () => {
  // Collecting fetches three DX NET pages; without this guard a double-click
  // starts a second run whose result races the first.
  if (collectButton.disabled) return;
  collectButton.disabled = true;
  fullRecordsCheckbox.disabled = true;
  collectButton.classList.add("busy");
  setStatus(t(fullRecordsCheckbox.checked ? "fetchingFull" : "fetching"));
  try {
    const { response, connection } = await collect();
    if (!response.ok) throw new Error(response.error);
    result = response.data;
    $("summary").hidden = false;
    $("player").textContent = result.player.name;
    $("official-rating").textContent = String(result.player.rating);
    applyRatingBadge(result.player.rating);
    // The official rating is the sum of the same 50 charts, so any gap means
    // this build disagrees with the game. Show it rather than let it pass.
    const gap = result.b50Rating - result.player.rating;
    $("b50-rating").textContent = gap === 0
      ? String(result.b50Rating)
      : `${result.b50Rating} (${gap > 0 ? "+" : ""}${gap})`;
    $("resolved").textContent = result.fullRecords
      ? t("resolvedFull", result.records.length - result.warnings.length, result.fullRecords.length - (result.fullRecordsUnmatched ?? 0), result.fullRecords.length)
      : `${result.records.length - result.warnings.length}/50`;
    exportButton.disabled = false;
    studioButton.disabled = false;
    setStatus(
      gap !== 0
        ? t("ratingGap", `${gap > 0 ? "+" : ""}${gap}`, result.warnings.length)
        : result.warnings.length
          ? t("unmatched", connection.label, result.warnings.length)
          : result.fullRecords
            ? t("collectedFull", result.fullRecords.length, result.fullRecordsUnmatched ?? 0)
            : t("collected"),
      gap === 0 && !result.warnings.length ? "ok" : ""
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    collectButton.disabled = false;
    fullRecordsCheckbox.disabled = false;
    collectButton.classList.remove("busy");
  }
});

$<HTMLButtonElement>("studio").addEventListener("click", async () => {
  if (!result) return;
  studioButton.disabled = true;
  setStatus(t("preparingAssets"));
  try {
    const token = crypto.randomUUID();
    const assets = await prepareStudioAssets();
    const transfer: StudioTransfer = {
      data: result,
      assets,
      language,
      expiresAt: Date.now() + STUDIO_TRANSFER_TTL_MS
    };
    await chrome.storage.session.set({ [studioTransferKey(token)]: transfer });
    const url = new URL(STUDIO_URL);
    url.hash = new URLSearchParams({
      extensionId: chrome.runtime.id,
      transfer: token
    }).toString();
    await chrome.tabs.create({ url: url.toString() });
    setStatus(t("studioOpened", Object.keys(assets.covers).length), "ok");
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
  void refreshDriveState();
  if (!result) setStatus(t("login"));
});

async function initializePopup() {
  await initializeLanguage();
  // Never interactive on open: the panel reflects existing state, and consent
  // is only ever raised by the user pressing Connect.
  await refreshDriveState();
}

void initializePopup();
