import { calculateChartRating } from "./rating";
import type { ParsedScore, ResolvedScore, SheetRecord } from "./types";

const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();
const key = (title: string, type: string, difficulty: string) =>
  `${normalize(title)}\u0000${type}\u0000${difficulty}`;
let indexPromise: Promise<Map<string, SheetRecord>> | undefined;

async function getIndex(): Promise<Map<string, SheetRecord>> {
  indexPromise ??= (async () => {
    const response = await fetch(chrome.runtime.getURL("data/sheets.json.gz"));
    if (!response.ok || !response.body) throw new Error("無法讀取內建譜面資料。");
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    const sheets = JSON.parse(await new Response(stream).text()) as SheetRecord[];
    return new Map(sheets.map((sheet) => [key(sheet.title, sheet.type, sheet.difficulty), sheet]));
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
      chartRating: calculateChartRating(sheet.internalLevelValue, record.achievementRate, record.comboFlag)
    };
  });
}
