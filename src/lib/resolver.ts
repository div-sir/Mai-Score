import { calculateChartRating } from "./rating";
import type { ParsedScore, ResolvedScore, SheetRecord } from "./types";

const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();
const key = (title: string, type: string, difficulty: string) =>
  `${normalize(title)}\u0000${type}\u0000${difficulty}`;
let indexPromise: Promise<Map<string, SheetRecord>> | undefined;

async function getIndex(): Promise<Map<string, SheetRecord>> {
  indexPromise ??= (async () => {
    try {
      const response = await fetch(chrome.runtime.getURL("data/sheets.json.gz"));
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      const sheets = JSON.parse(await new Response(stream).text()) as SheetRecord[];
      return new Map(sheets.map((sheet) => [key(sheet.title, sheet.type, sheet.difficulty), sheet]));
    } catch (error) {
      indexPromise = undefined;
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`內建譜面資料載入失敗（${detail}）。請重新載入擴充功能。`);
    }
  })();
  return indexPromise;
}

export async function resolveScores(records: ParsedScore[]): Promise<ResolvedScore[]> {
  const index = await getIndex();
  return records.map((record) => {
    const sheet = index.get(key(record.title, record.type, record.difficulty));
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
