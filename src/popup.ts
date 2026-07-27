import { toDxratingJson, toFullJson } from "./lib/export";
import { renderB50Svg } from "./lib/render";
import type { CollectionResult } from "./lib/types";

let result: CollectionResult | null = null;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $("status");
const buttons = ["png", "dxjson", "fulljson"].map((id) => $<HTMLButtonElement>(id));

function setStatus(text: string, kind = "") {
  status.textContent = text;
  status.className = `status ${kind}`;
}

function downloadText(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  chrome.downloads.download({ url, filename: name, saveAs: true }, () => setTimeout(() => URL.revokeObjectURL(url), 30000));
}

async function fetchDataUrl(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  const response = await fetch(url);
  if (!response.ok) return undefined;
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function collect() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://maimaidx-eng.com/maimai-mobile/")) {
    throw new Error("請先開啟 maimai DX NET 國際版頁面。");
  }
  return await chrome.tabs.sendMessage(tab.id, { type: "MAI_SCORE_COLLECT" }) as
    { ok: true; data: CollectionResult } | { ok: false; error: string };
}

$<HTMLButtonElement>("collect").addEventListener("click", async () => {
  setStatus("正在抓取個人資料、frame 與 B50…");
  try {
    const response = await collect();
    if (!response.ok) throw new Error(response.error);
    result = response.data;
    $("summary").hidden = false;
    $("player").textContent = result.player.name;
    $("official-rating").textContent = String(result.player.rating);
    $("b50-rating").textContent = String(result.b50Rating);
    $("resolved").textContent = `${result.records.length - result.warnings.length}/50`;
    buttons.forEach((button) => { button.disabled = false; });
    setStatus(result.warnings.length ? `完成，但有 ${result.warnings.length} 首歌無法比對。` : "完成：50 首譜面已計算。", result.warnings.length ? "" : "ok");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
});

$("dxjson").addEventListener("click", () => result && downloadText("mai-score-dxrating.json", toDxratingJson(result), "application/json"));
$("fulljson").addEventListener("click", () => result && downloadText("mai-score-full.json", toFullJson(result), "application/json"));
$("png").addEventListener("click", async () => {
  if (!result) return;
  setStatus("正在準備封面並繪製 PNG…");
  try {
    const coverNames = [...new Set(result.records.flatMap((x) => x.imageName ? [x.imageName] : []))];
    const coverPairs = await Promise.all(coverNames.map(async (name) => [
      name, await fetchDataUrl(`https://shama.dxrating.net/images/cover/v2/${name}.jpg`)
    ] as const));
    const covers = Object.fromEntries(coverPairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1])));
    const [icon, frame] = await Promise.all([fetchDataUrl(result.player.iconUrl), fetchDataUrl(result.player.frameUrl)]);
    const theme = ($<HTMLSelectElement>("theme").value === "light" ? "light" : "night");
    const svg = renderB50Svg(result, theme, { icon, frame, covers });
    const image = new Image();
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2000; canvas.height = 2550;
      canvas.getContext("2d")!.drawImage(image, 0, 0);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((blob) => {
        if (!blob) return setStatus("PNG 產生失敗。", "error");
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({ url, filename: `mai-score-${result!.player.name}-b50.png`, saveAs: true }, () => setTimeout(() => URL.revokeObjectURL(url), 30000));
        setStatus("PNG 已產生。", "ok");
      }, "image/png");
    };
    image.onerror = () => setStatus("圖像解碼失敗。", "error");
    image.src = svgUrl;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
});
