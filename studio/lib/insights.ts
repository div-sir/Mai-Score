import type { HistoryEntry } from "./history";
import { chartKey } from "./history";
import type { StudioData, StudioRecord } from "./types";

// Kept in sync with src/lib/rating.ts. Studio is deployed as its own Next.js
// package, so it cannot depend on Extension build internals at runtime.
const COEFFICIENTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [10, 1.6], [20, 3.2], [30, 4.8], [40, 6.4], [50, 8],
  [60, 9.6], [70, 11.2], [75, 12], [80, 13.6], [90, 15.2],
  [94, 16.8], [97, 20], [98, 20.3], [99, 20.8], [99.5, 21.1],
  [100, 21.6], [100.5, 22.4]
];

export const RATING_MODEL = "maimai-dx-rating/2026-08";
export const ACHIEVEMENT_TARGETS = [97, 98, 99, 99.5, 100, 100.5] as const;

export interface RatingTimelinePoint {
  observedAt: string;
  b15: number;
  b35: number;
  b50: number;
}

export interface ChartHistoryPoint {
  observedAt: string;
  savedAt: string;
  achievementRate: number;
  chartRating: number;
  bucket: StudioRecord["bucket"];
}

export interface UpgradeTarget {
  key: string;
  record: StudioRecord;
  targetAchievement: number;
  achievementNeeded: number;
  currentRating: number;
  targetRating: number;
  ratingGain: number;
  theoreticalGain: number;
}

export interface SnapshotProvenance {
  observedAt: string;
  importedAt: string;
  source: string;
  sourceSchema: string;
  ratingModel: typeof RATING_MODEL;
}

function bucketTotal(entry: HistoryEntry, bucket: StudioRecord["bucket"]): number {
  const stored = bucket === "b15" ? entry.b15Rating : entry.b35Rating;
  if (Number.isFinite(stored)) return Number(stored);
  return entry.records.reduce(
    (total, record) => total + (record.bucket === bucket && Number.isFinite(record.chartRating)
      ? Number(record.chartRating)
      : 0),
    0
  );
}

/** Oldest first, which is the order charts and trend summaries consume. */
export function buildRatingTimeline(entries: readonly HistoryEntry[]): RatingTimelinePoint[] {
  return [...entries]
    .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt))
    .map((entry) => {
      const b15 = bucketTotal(entry, "b15");
      const b35 = bucketTotal(entry, "b35");
      return { observedAt: entry.generatedAt, b15, b35, b50: b15 + b35 };
    });
}

export function periodDelta(
  timeline: readonly RatingTimelinePoint[],
  field: "b15" | "b35" | "b50",
  days?: number
): number | undefined {
  const latest = timeline.at(-1);
  if (!latest || timeline.length < 2) return undefined;
  let baseline = timeline[0];
  if (days !== undefined) {
    const cutoff = Date.parse(latest.observedAt) - days * 86_400_000;
    baseline = [...timeline].reverse().find((point) => Date.parse(point.observedAt) <= cutoff)
      ?? timeline[0];
  }
  return latest[field] - baseline[field];
}

export function listHistoryCharts(entries: readonly HistoryEntry[]): StudioRecord[] {
  const charts = new Map<string, StudioRecord>();
  for (const entry of entries) {
    for (const record of entry.records) {
      if (!charts.has(chartKey(record))) charts.set(chartKey(record), record);
    }
  }
  return [...charts.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function buildChartHistory(
  entries: readonly HistoryEntry[],
  key: string
): ChartHistoryPoint[] {
  return [...entries]
    .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt))
    .flatMap((entry) => {
      const record = entry.records.find((candidate) => chartKey(candidate) === key);
      return record ? [{
        observedAt: entry.generatedAt,
        savedAt: entry.savedAt,
        achievementRate: record.achievementRate,
        chartRating: Number(record.chartRating ?? 0),
        bucket: record.bucket
      }] : [];
    });
}

function ratingCoefficient(achievementRate: number): number {
  let coefficient = 0;
  for (const [threshold, value] of COEFFICIENTS) {
    if (achievementRate < threshold) break;
    coefficient = value;
  }
  return coefficient;
}

export function calculateInsightRating(internalLevel: number, achievementRate: number): number {
  const capped = Math.min(100.5, Math.max(0, achievementRate));
  return Math.floor(ratingCoefficient(capped) * internalLevel * capped / 100);
}

/**
 * Recommends only improvements to charts already visible in the B50. DX NET's
 * target page does not expose every non-B50 candidate, so claiming replacement
 * recommendations from this document would be fabricated.
 */
export function buildUpgradeTargets(data: StudioData, limit = 8): UpgradeTarget[] {
  return data.records.flatMap((record): UpgradeTarget[] => {
    const level = Number(record.internalLevelValue);
    if (!Number.isFinite(level) || level <= 0 || record.achievementRate >= 100.5) return [];
    const targetAchievement = ACHIEVEMENT_TARGETS.find((target) => target > record.achievementRate + 0.00005);
    if (targetAchievement === undefined) return [];
    const currentRating = Number.isFinite(record.chartRating)
      ? Number(record.chartRating)
      : calculateInsightRating(level, record.achievementRate);
    const targetRating = calculateInsightRating(level, targetAchievement);
    const theoreticalRating = calculateInsightRating(level, 100.5);
    return [{
      key: chartKey(record),
      record,
      targetAchievement,
      achievementNeeded: targetAchievement - record.achievementRate,
      currentRating,
      targetRating,
      ratingGain: Math.max(0, targetRating - currentRating),
      theoreticalGain: Math.max(0, theoreticalRating - currentRating)
    }];
  })
    .filter((target) => target.ratingGain > 0)
    .sort((a, b) => {
      const efficiencyA = a.ratingGain / Math.max(a.achievementNeeded, 0.0001);
      const efficiencyB = b.ratingGain / Math.max(b.achievementNeeded, 0.0001);
      return efficiencyB - efficiencyA
        || b.ratingGain - a.ratingGain
        || a.achievementNeeded - b.achievementNeeded;
    })
    .slice(0, limit);
}

export function snapshotProvenance(entry: HistoryEntry): SnapshotProvenance {
  return {
    observedAt: entry.generatedAt,
    importedAt: entry.savedAt,
    source: entry.source || "unknown",
    sourceSchema: entry.provenance?.sourceSchema ?? "mai-score/v1 (legacy snapshot)",
    ratingModel: RATING_MODEL
  };
}
