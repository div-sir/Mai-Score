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
const languageSelect = $<HTMLSelectElement>("language");
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
  const response = await chrome.tabs.sendMessage(tab.id, createCollectRequest(connection.id)) as
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
  const [icon, frame] = await Promise.all([
    fetchDataUrl(result.player.iconUrl),
    fetchDataUrl(result.player.frameUrl)
  ]);
  const rendered = renderB50Document(result, options, { icon, frame, covers }, generatedAt, intlLocale(language));
  const blob = await svgToPng(rendered.svg, rendered.width, rendered.height);
  const safePlayer = result.player.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  downloadBlob(`mai-score-${safePlayer}-${timestampForFilename(generatedAt)}.png`, blob);
  setStatus(t("pngReady"), "ok");
}

async function prepareStudioAssets(): Promise<StudioTransferAssets> {
  if (!result) return { covers: {} };
  const coverNames = [...new Set(result.records.flatMap((record) => record.imageName ? [record.imageName] : []))];
  const coverPairs = await mapConcurrent(coverNames, 8, async (name) => [
    name,
    await fetchDataUrl(`https://shama.dxrating.net/images/cover/v2/${name}.jpg`)
  ] as const);
  const [icon, frame] = await Promise.all([
    fetchDataUrl(result.player.iconUrl),
    fetchDataUrl(result.player.frameUrl)
  ]);
  return {
    icon,
    frame,
    covers: Object.fromEntries(
      coverPairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1]))
    )
  };
}

$<HTMLButtonElement>("collect").addEventListener("click", async () => {
  setStatus(t("fetching"));
  try {
    const { response, connection } = await collect();
    if (!response.ok) throw new Error(response.error);
    result = response.data;
    $("summary").hidden = false;
    $("player").textContent = result.player.name;
    $("official-rating").textContent = String(result.player.rating);
    $("b50-rating").textContent = String(result.b50Rating);
    $("resolved").textContent = `${result.records.length - result.warnings.length}/50`;
    exportButton.disabled = false;
    studioButton.disabled = false;
    setStatus(
      result.warnings.length
        ? t("unmatched", connection.label, result.warnings.length)
        : t("collected"),
      result.warnings.length ? "" : "ok"
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
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
  if (!result) setStatus(t("login"));
});

void initializeLanguage();
