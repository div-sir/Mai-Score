import type { RhythmRecordEnvelope } from "../../src/lib/rhythm-record";

type RhythmRecord = RhythmRecordEnvelope["records"][number];

function gameValue(record: RhythmRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record.gameSpecific?.[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return "";
}

function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? "" : String(value);
  // CSV is commonly opened in a spreadsheet. Treat user-controlled song and
  // artist text as text so a leading formula marker cannot execute.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function rhythmRecordsCsv(records: readonly RhythmRecord[]): string {
  const rows = records.map((record) => [
    record.song.title,
    record.song.artist,
    record.chart.difficulty,
    gameValue(record, ["playStyle", "style"]) || record.chart.type,
    record.chart.level,
    record.result.rawScore,
    record.result.grade,
    gameValue(record, ["flareRank", "flareGauge", "danceGauge", "gauge"]) || record.result.clearStatus,
    record.result.missCount,
    record.result.rating?.value,
    record.result.rating?.system
  ]);
  const header = ["Title", "Artist", "Difficulty", "Style", "Level", "Score", "Grade", "Clear / gauge", "Miss", "Rating", "Rating system"];
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
