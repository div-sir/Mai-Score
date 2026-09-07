import type { SheetRecord } from "../../src/lib/types";
import type { StudioData, StudioRecord } from "./types";
import { calculateInsightRating } from "./insights";

/** Eligibility comes only from the imported Rating Target buckets, never a guessed release date. */
export function simulateCatalogChart(data: StudioData, sheet: SheetRecord, target: number) {
  if (!Number.isFinite(target) || target < 0 || target > 100.5 || !Number.isFinite(sheet.internalLevelValue) || sheet.internalLevelValue <= 0) return undefined;
  const matches = (r: StudioRecord) => r.type === sheet.type && r.difficulty === sheet.difficulty
    && (r.chartId ? r.chartId === sheet.sheetId : r.title === sheet.title);
  const current = data.records.filter(matches);
  const candidates = (data.candidateRecords ?? []).filter(matches);
  if (current.length > 1 || (!current.length && candidates.length !== 1)) return undefined;
  const record = current[0] ?? candidates[0];
  if (target < record.achievementRate) return undefined;
  const bucket = data.records.filter(r => r.bucket === record.bucket);
  const capacity = record.bucket === "b15" ? 15 : 35;
  if (bucket.length !== capacity) return undefined;
  const ratings = bucket.map(r => r.chartRating ?? (r.internalLevelValue ? calculateInsightRating(r.internalLevelValue, r.achievementRate) : NaN));
  if (ratings.some(r => !Number.isFinite(r))) return undefined;
  const rating = calculateInsightRating(sheet.internalLevelValue, target);
  const baseline = current.length ? ratings[bucket.indexOf(record)] : Math.min(...ratings);
  const gain = Math.max(0, rating - baseline);
  return { bucket: record.bucket, rating, gain, total: data.b50Rating + gain };
}
