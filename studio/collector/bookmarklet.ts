import { parseFullRecordsPage, parseProfile, parseRatingTargetPage } from "../../src/lib/parser";
import { calculateB50Breakdown, calculateChartRating } from "../../src/lib/rating";
import type { CollectionResult, Difficulty, ParsedChartScore, ResolvedScore, SheetRecord, VersionChartTotals } from "../../src/lib/types";

const STUDIO_ORIGIN = "https://mai-score.milifix.com";
const STORAGE_KEY = "mai-score-bookmarklet-last-v1";
const ROOT = `${location.origin}/maimai-mobile`;
const host = location.hostname;
const isInternational = host === "maimaidx-eng.com";
const isJapanese = host === "maimaidx.jp";

if (!isInternational && !isJapanese) throw new Error("Mai-Score collector only runs on maimai DX NET.");

const normalize = (value: string) => value.normalize("NFKC").replaceAll("\\@", "@").trim().toLocaleLowerCase();
const key = (title: string, type: string, difficulty: string) => `${normalize(title)}\u0000${type}\u0000${difficulty}`;

async function fetchDocument(path: string): Promise<Document> {
  const response = await fetch(`${ROOT}${path}`, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`DX NET returned HTTP ${response.status}.`);
  const text = await response.text();
  if (/ERROR\s+CODE\s*[:：]\s*200002(?!\d)/i.test(text)) throw new Error("DX NET sign-in expired. Sign in and run the bookmark again.");
  return new DOMParser().parseFromString(text, "text/html");
}

async function catalog(): Promise<{ sheets: SheetRecord[]; source?: CollectionResult["chartData"] }> {
  const response = await fetch(`${STUDIO_ORIGIN}/data/catalog.json`, { cache: "force-cache" });
  if (!response.ok) throw new Error("Mai-Score chart catalog could not be loaded.");
  const value = await response.json() as { sheets?: SheetRecord[]; source?: CollectionResult["chartData"] };
  if (!Array.isArray(value.sheets)) throw new Error("Mai-Score chart catalog is invalid.");
  return { sheets: value.sheets, source: value.source };
}

type BookmarkletResolved = ParsedChartScore & Partial<SheetRecord> & { chartRating?: number; warning?: string };

function resolve(records: ParsedChartScore[], sheets: SheetRecord[]): BookmarkletResolved[] {
  const index = new Map(sheets.map((sheet) => [key(sheet.title, sheet.type, sheet.difficulty), sheet]));
  return records.map((record) => {
    const sheet = index.get(key(record.title, record.type, record.difficulty));
    if (!sheet) return { ...record, warning: `Unmatched: ${record.title} (${record.type}/${record.difficulty})` };
    return { ...record, ...sheet, displayedLevel: record.displayedLevel, chartRating: calculateChartRating(sheet.internalLevelValue, record.achievementRate) };
  });
}

function totals(sheets: SheetRecord[]): VersionChartTotals[] {
  const result = new Map<string, VersionChartTotals>();
  for (const sheet of sheets) {
    if (!sheet.version) continue;
    const entry = result.get(sheet.version) ?? { version: sheet.version, basic: 0, advanced: 0, expert: 0, master: 0, remaster: 0 };
    entry[sheet.difficulty] += 1;
    result.set(sheet.version, entry);
  }
  return [...result.values()];
}

async function collect(includeFull: boolean, update: (message: string) => void): Promise<CollectionResult> {
  update("Reading player profile…");
  const player = parseProfile(await fetchDocument("/home/"), `${ROOT}/home/`);
  update("Reading B50…");
  const target = parseRatingTargetPage(await fetchDocument("/home/ratingTargetMusic/"));
  const full: ParsedChartScore[] = [];
  const difficulties: Difficulty[] = ["basic", "advanced", "expert", "master", "remaster"];
  if (includeFull) {
    for (const [index, difficulty] of difficulties.entries()) {
      update(`Reading Full Records ${index + 1}/${difficulties.length}…`);
      full.push(...parseFullRecordsPage(await fetchDocument(`/record/musicGenre/search/?genre=99&diff=${index}`), difficulty));
    }
  }
  update("Matching the International chart catalog…");
  const chartCatalog = await catalog();
  const b50Count = target.records.length;
  const resolved = resolve([...target.records, ...target.candidates, ...full], chartCatalog.sheets);
  const records = resolved.slice(0, b50Count) as ResolvedScore[];
  const candidates = resolved.slice(b50Count, b50Count + target.candidates.length) as ResolvedScore[];
  const fullResolved = resolved.slice(b50Count + target.candidates.length);
  const fullByChart = new Map(fullResolved.map((record) => [key(record.title, record.type, record.difficulty), record]));
  for (const record of records) fullByChart.set(key(record.title, record.type, record.difficulty), record);
  const fullRecords = includeFull ? [...fullByChart.values()] : undefined;
  const rating = calculateB50Breakdown(records);
  return {
    schema: "mai-score/v1",
    exportedAt: new Date().toISOString(),
    source: `${ROOT}/home/ratingTargetMusic/`,
    connection: { id: isInternational ? "dxnet-intl-bookmarklet" : "dxnet-jp-bookmarklet", protocolVersion: 1, region: isInternational ? "intl" : "jp" },
    chartData: chartCatalog.source,
    player,
    records,
    ...(fullRecords ? { fullRecords, fullRecordsUnmatched: fullRecords.filter((record) => record.warning).length, versionTotals: totals(chartCatalog.sheets) } : {}),
    ...(candidates.length ? { candidateRecords: candidates } : {}),
    ...rating,
    warnings: records.flatMap((record) => record.warning ? [record.warning] : [])
  };
}

function transfer(data: CollectionResult, target: Window) {
  const send = () => target.postMessage({ type: "MAI_SCORE_BOOKMARKLET_IMPORT", data }, STUDIO_ORIGIN);
  const listener = (event: MessageEvent) => {
    if (event.origin === STUDIO_ORIGIN && event.source === target && event.data?.type === "MAI_SCORE_STUDIO_READY") send();
  };
  window.addEventListener("message", listener);
  send();
  window.setTimeout(() => window.removeEventListener("message", listener), 60_000);
}

const existing = document.getElementById("mai-score-bookmarklet-collector");
existing?.remove();
const root = document.createElement("div");
root.id = "mai-score-bookmarklet-collector";
const shadow = root.attachShadow({ mode: "closed" });
shadow.innerHTML = `<style>:host{all:initial}.backdrop{position:fixed;z-index:2147483646;inset:0;background:#0008}.card{position:fixed;z-index:2147483647;top:50%;left:50%;width:min(430px,calc(100vw - 28px));box-sizing:border-box;transform:translate(-50%,-50%);border:1px solid #d5d1c7;border-radius:14px;padding:20px;background:#faf9f6;color:#20231f;box-shadow:0 24px 80px #0007;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.top{display:flex;justify-content:space-between;gap:12px}.eyebrow{color:#8e7355;font-size:9px;font-weight:800;letter-spacing:.12em}.title{display:block;margin-top:3px;font-size:20px}.close{border:0;background:transparent;color:#555;font-size:24px;cursor:pointer}.body{color:#676c65;font-size:12px}.privacy{border-left:3px solid #708b7e;padding-left:10px;color:#596159;font-size:11px}.actions{display:grid;gap:8px;margin-top:16px}.actions button{border:1px solid #d0cdc4;border-radius:9px;padding:11px;background:#fff;color:#2d312d;cursor:pointer;font-weight:750}.actions .primary{border-color:#486e62;background:#486e62;color:#fff}.actions button:disabled{cursor:wait;opacity:.55}.status{min-height:18px;margin:12px 0 0;color:#486e62;font-size:10px}@media(prefers-color-scheme:dark){.card{border-color:#3f463f;background:#20241f;color:#f0f1ed}.body,.privacy{color:#adb3ac}.actions button{border-color:#464d46;background:#292e29;color:#eceee9}}</style><div class="backdrop"></div><section class="card" role="dialog" aria-modal="true"><div class="top"><div><span class="eyebrow">MAI-SCORE · BOOKMARK COLLECTOR v0.1.0</span><strong class="title">Collect signed-in DX NET data?</strong></div><button class="close" aria-label="Close">×</button></div><p class="body">The collector reads pages available to this signed-in browser and matches them locally. International Full Records makes five additional page requests.</p><p class="privacy">No password, cookie, token, or page HTML is sent to Mai-Score. Only the normalized result moves directly from this tab to Studio.</p><div class="actions"><button class="primary full">Collect B50 + Full Records</button><button class="quick">Collect B50 only</button><button class="last" hidden>Open last saved collection</button></div><p class="status" role="status"></p></section>`;
document.documentElement.append(root);
const status = shadow.querySelector<HTMLElement>(".status")!;
const buttons = [...shadow.querySelectorAll<HTMLButtonElement>("button")];
const close = () => root.remove();
shadow.querySelector(".close")?.addEventListener("click", close);
shadow.querySelector(".backdrop")?.addEventListener("click", close);
const last = shadow.querySelector<HTMLButtonElement>(".last")!;
const saved = localStorage.getItem(STORAGE_KEY);
last.hidden = !saved;
last.addEventListener("click", () => {
  const target = window.open(`${STUDIO_ORIGIN}/#bookmarklet=1`, "_blank");
  if (!target || !saved) return;
  transfer(JSON.parse(saved) as CollectionResult, target);
  close();
});
const run = async (includeFull: boolean) => {
  const target = window.open("about:blank", "_blank");
  if (!target) { status.textContent = "Allow pop-ups for this page and try again."; return; }
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const data = await collect(includeFull && isInternational, (message) => { status.textContent = message; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    target.location.href = `${STUDIO_ORIGIN}/#bookmarklet=1`;
    transfer(data, target);
    status.textContent = "Collection complete. Opening Studio…";
    window.setTimeout(close, 800);
  } catch (error) {
    target.close();
    status.textContent = error instanceof Error ? error.message : String(error);
    buttons.forEach((button) => { button.disabled = false; });
  }
};
shadow.querySelector(".full")?.addEventListener("click", () => void run(true));
shadow.querySelector(".quick")?.addEventListener("click", () => void run(false));
if (!isInternational) shadow.querySelector<HTMLButtonElement>(".full")!.textContent = "Collect B50 (Japan region)";
