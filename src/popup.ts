import { connectionForUrl, createCollectRequest } from "./lib/connections";
import { toDxratingJson, toFullJson } from "./lib/export";
import {
  DEFAULT_IMAGE_OPTIONS,
  normalizeImageOptions,
  timestampForFilename,
  type ImageOptions
} from "./lib/image-options";
import { renderB50Document } from "./lib/render";
import type { CollectionResult } from "./lib/types";

const OPTIONS_KEY = "imageOptions";
let result: CollectionResult | null = null;
let imageOptions: ImageOptions = { ...DEFAULT_IMAGE_OPTIONS };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $("status");
const buttons = ["png", "dxjson", "fulljson"].map((id) => $<HTMLButtonElement>(id));

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
  if (!tab?.id || !tab.url) throw new Error("找不到目前分頁。");
  const connection = connectionForUrl(tab.url);
  if (!connection) throw new Error("目前頁面沒有可用的 Mai-Score 連結方式。");
  if (connection.transport !== "content-script") throw new Error(`${connection.label} 尚未支援自動抓取。`);
  const response = await chrome.tabs.sendMessage(tab.id, createCollectRequest(connection.id)) as
    { ok: true; data: CollectionResult } | { ok: false; error: string };
  return { response, connection };
}

function readOptions(): ImageOptions {
  return normalizeImageOptions({
    version: 1,
    layout: $<HTMLSelectElement>("layout").value,
    theme: $<HTMLSelectElement>("theme").value,
    accentColor: $<HTMLInputElement>("accent-color").value,
    watermark: $<HTMLInputElement>("watermark").value,
    timestampMode: $<HTMLSelectElement>("timestamp-mode").value,
    timestampZone: $<HTMLSelectElement>("timestamp-zone").value,
    scale: Number($<HTMLSelectElement>("scale").value),
    timestampFilename: $<HTMLInputElement>("timestamp-filename").checked,
    showFrame: $<HTMLInputElement>("show-frame").checked,
    showIcon: $<HTMLInputElement>("show-icon").checked,
    showCovers: $<HTMLInputElement>("show-covers").checked,
    showPlayerTitle: $<HTMLInputElement>("show-player-title").checked,
    showOfficialRating: $<HTMLInputElement>("show-official-rating").checked,
    showRatingBreakdown: $<HTMLInputElement>("show-rating-breakdown").checked,
    showAchievement: $<HTMLInputElement>("show-achievement").checked,
    showChartRating: $<HTMLInputElement>("show-chart-rating").checked,
    showLevel: $<HTMLInputElement>("show-level").checked,
    showBucketRank: $<HTMLInputElement>("show-bucket-rank").checked,
    showGeneratedBy: $<HTMLInputElement>("show-generated-by").checked
  });
}

function applyOptions(options: ImageOptions) {
  $<HTMLSelectElement>("layout").value = options.layout;
  $<HTMLSelectElement>("theme").value = options.theme;
  $<HTMLInputElement>("accent-color").value = options.accentColor;
  $<HTMLInputElement>("watermark").value = options.watermark;
  $<HTMLSelectElement>("timestamp-mode").value = options.timestampMode;
  $<HTMLSelectElement>("timestamp-zone").value = options.timestampZone;
  $<HTMLSelectElement>("scale").value = String(options.scale);
  $<HTMLInputElement>("timestamp-filename").checked = options.timestampFilename;
  $<HTMLInputElement>("show-frame").checked = options.showFrame;
  $<HTMLInputElement>("show-icon").checked = options.showIcon;
  $<HTMLInputElement>("show-covers").checked = options.showCovers;
  $<HTMLInputElement>("show-player-title").checked = options.showPlayerTitle;
  $<HTMLInputElement>("show-official-rating").checked = options.showOfficialRating;
  $<HTMLInputElement>("show-rating-breakdown").checked = options.showRatingBreakdown;
  $<HTMLInputElement>("show-achievement").checked = options.showAchievement;
  $<HTMLInputElement>("show-chart-rating").checked = options.showChartRating;
  $<HTMLInputElement>("show-level").checked = options.showLevel;
  $<HTMLInputElement>("show-bucket-rank").checked = options.showBucketRank;
  $<HTMLInputElement>("show-generated-by").checked = options.showGeneratedBy;
  $<HTMLSelectElement>("timestamp-zone").disabled = options.timestampMode === "off";
}

async function persistOptions() {
  imageOptions = readOptions();
  applyOptions(imageOptions);
  await chrome.storage.local.set({ [OPTIONS_KEY]: imageOptions });
}

async function initializeOptions() {
  const stored = await chrome.storage.local.get(OPTIONS_KEY);
  imageOptions = normalizeImageOptions(stored[OPTIONS_KEY]);
  applyOptions(imageOptions);
}

async function svgToPng(svg: string, width: number, height: number, scale: number): Promise<Blob> {
  const image = new Image();
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("SVG 圖像解碼失敗。"));
      image.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("無法建立圖片畫布。");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG 編碼失敗。")), "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

$<HTMLButtonElement>("collect").addEventListener("click", async () => {
  setStatus("正在抓取個人資料、frame 與 B50…");
  try {
    const { response, connection } = await collect();
    if (!response.ok) throw new Error(response.error);
    result = response.data;
    $("summary").hidden = false;
    $("player").textContent = result.player.name;
    $("official-rating").textContent = String(result.player.rating);
    $("b50-rating").textContent = String(result.b50Rating);
    $("resolved").textContent = `${result.records.length - result.warnings.length}/50`;
    buttons.forEach((button) => { button.disabled = false; });
    setStatus(
      result.warnings.length
        ? `${connection.label}：有 ${result.warnings.length} 首歌無法比對。`
        : `${connection.label}：50 首譜面已計算。`,
      result.warnings.length ? "" : "ok"
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
});

$("dxjson").addEventListener("click", () =>
  result && downloadText("mai-score-dxrating.json", toDxratingJson(result), "application/json"));
$("fulljson").addEventListener("click", () =>
  result && downloadText("mai-score-full.json", toFullJson(result), "application/json"));

$("png").addEventListener("click", async () => {
  if (!result) return;
  const generatedAt = new Date();
  setStatus("正在準備素材並繪製 PNG…");
  try {
    imageOptions = readOptions();
    const coverNames = imageOptions.showCovers
      ? [...new Set(result.records.flatMap((record) => record.imageName ? [record.imageName] : []))]
      : [];
    const coverPairs = await mapConcurrent(coverNames, 8, async (name) => [
      name,
      await fetchDataUrl(`https://shama.dxrating.net/images/cover/v2/${name}.jpg`)
    ] as const);
    const covers = Object.fromEntries(
      coverPairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1]))
    );
    const [icon, frame] = await Promise.all([
      imageOptions.showIcon ? fetchDataUrl(result.player.iconUrl) : undefined,
      imageOptions.showFrame ? fetchDataUrl(result.player.frameUrl) : undefined
    ]);
    const rendered = renderB50Document(result, imageOptions, { icon, frame, covers }, generatedAt, navigator.language);
    const blob = await svgToPng(rendered.svg, rendered.width, rendered.height, imageOptions.scale);
    const safePlayer = result.player.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
    const timestamp = imageOptions.timestampFilename ? `-${timestampForFilename(generatedAt)}` : "";
    downloadBlob(`mai-score-${safePlayer}-${imageOptions.layout}${timestamp}.png`, blob);
    setStatus(`PNG 已產生：${rendered.width * imageOptions.scale} × ${rendered.height * imageOptions.scale}`, "ok");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
});

$(".customize").addEventListener("change", () => void persistOptions());
$<HTMLInputElement>("watermark").addEventListener("input", () => void persistOptions());
$<HTMLButtonElement>("reset-options").addEventListener("click", () => {
  imageOptions = { ...DEFAULT_IMAGE_OPTIONS };
  applyOptions(imageOptions);
  void chrome.storage.local.set({ [OPTIONS_KEY]: imageOptions });
});

void initializeOptions();
