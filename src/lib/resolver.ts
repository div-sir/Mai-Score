import { calculateChartRating } from "./rating";
import type {
  ParsedChartScore,
  ParsedFullScore,
  ParsedScore,
  ResolvedFullScore,
  ResolvedScore,
  SheetRecord,
  VersionChartTotals
} from "./types";

const normalize = (value: string) => value.normalize("NFKC").replaceAll("\\@", "@").trim().toLocaleLowerCase();
const INVISIBLE_FORMATTING = /[\u200b-\u200d\u2060\ufeff]/g;
const COMPATIBLE_PUNCTUATION = /[\u2018\u2019\u201b]/g;
const COMPATIBLE_QUOTES = /[\u201c\u201d]/g;
const COMPATIBLE_DASHES = /[\u2010-\u2015\u2212]/g;
const WHITESPACE = /\s+/g;
const compatibleNormalize = (value: string) => normalize(value)
  .replace(INVISIBLE_FORMATTING, "")
  .replace(COMPATIBLE_PUNCTUATION, "'")
  .replace(COMPATIBLE_QUOTES, '"')
  .replace(COMPATIBLE_DASHES, "-")
  .replace(WHITESPACE, " ");
const key = (title: string, type: string, difficulty: string) =>
  `${normalize(title)}\u0000${type}\u0000${difficulty}`;
const compatibleKey = (title: string, type: string, difficulty: string) =>
  `${compatibleNormalize(title)}\u0000${type}\u0000${difficulty}`;
let catalogPromise: Promise<SheetRecord[]> | undefined;
interface CatalogIndexes {
  exact: Map<string, SheetRecord>;
  compatible: Map<string, SheetRecord | null>;
}
let indexPromise: Promise<CatalogIndexes> | undefined;

/**
 * The whole bundled catalog. Cached separately from the lookup index because
 * the index is keyed by title/type/difficulty and would silently collapse two
 * sheets that share one — fine for lookup, wrong for counting.
 */
async function getCatalog(): Promise<SheetRecord[]> {
  catalogPromise ??= (async () => {
    try {
      const response = await fetch(chrome.runtime.getURL("data/sheets.json.gz"));
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      return JSON.parse(await new Response(stream).text()) as SheetRecord[];
    } catch (error) {
      catalogPromise = undefined;
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`內建譜面資料載入失敗（${detail}）。請重新載入擴充功能。`);
    }
  })();
  return catalogPromise;
}

async function getIndex(): Promise<CatalogIndexes> {
  indexPromise ??= getCatalog().then((sheets) => {
    const exact = new Map<string, SheetRecord>();
    const compatible = new Map<string, SheetRecord | null>();
    for (const sheet of sheets) {
      exact.set(key(sheet.title, sheet.type, sheet.difficulty), sheet);
      const lookup = compatibleKey(sheet.title, sheet.type, sheet.difficulty);
      compatible.set(lookup, compatible.has(lookup) ? null : sheet);
    }
    return { exact, compatible };
  }).catch((error: unknown) => {
    indexPromise = undefined;
    throw error;
  });
  return indexPromise;
}

/**
 * How many charts each game version has, split by difficulty.
 *
 * Plate progress needs a denominator that includes charts the player has never
 * touched, which only the catalog knows. Shipping the per-difficulty breakdown
 * rather than a single total lets Studio decide which difficulties a plate
 * counts — so correcting that rule never requires collecting again.
 */
export async function versionChartTotals(): Promise<VersionChartTotals[]> {
  const byVersion = new Map<string, VersionChartTotals>();
  for (const sheet of await getCatalog()) {
    if (!sheet.version) continue;
    let totals = byVersion.get(sheet.version);
    if (!totals) {
      totals = { version: sheet.version, basic: 0, advanced: 0, expert: 0, master: 0, remaster: 0 };
      byVersion.set(sheet.version, totals);
    }
    totals[sheet.difficulty] += 1;
  }
  return [...byVersion.values()].sort((a, b) => a.version.localeCompare(b.version));
}

export function resolveScores(records: ParsedScore[]): Promise<ResolvedScore[]>;
export function resolveScores(records: ParsedFullScore[]): Promise<ResolvedFullScore[]>;
export async function resolveScores(records: ParsedChartScore[]): Promise<Array<ParsedChartScore & Partial<SheetRecord> & {
  chartRating?: number;
  warning?: string;
}>> {
  const indexes = await getIndex();
  return records.map((record) => {
    const sheet = indexes.exact.get(key(record.title, record.type, record.difficulty))
      ?? indexes.compatible.get(compatibleKey(record.title, record.type, record.difficulty));
    if (!sheet) return { ...record, warning: `無法比對：${record.title} (${record.type}/${record.difficulty})` };
    return {
      ...record,
      sheetId: sheet.sheetId,
      songId: sheet.songId,
      internalLevelValue: sheet.internalLevelValue,
      version: sheet.version,
      imageName: sheet.imageName,
      chartRating: calculateChartRating(sheet.internalLevelValue, record.achievementRate)
    };
  });
}
