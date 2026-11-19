import { chartKey } from "./history";
import { calculateInsightRating } from "./insights";
import type { StudioChartRecord } from "./types";

export interface PersonalChartStat {
  key: string;
  record: StudioChartRecord;
  peerMedian: number;
  personalGap: number;
  currentRating: number;
  maximumRating: number;
  ratingPotential: number;
  efficiency: number;
}

function median(values: readonly number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Compares a player's own high-level MASTER charts at the same official
 * constant. This is deliberately personal data, not a crowd-sourced claim
 * about a chart's true difficulty.
 */
export function buildPersonalChartStats(records: readonly StudioChartRecord[]): PersonalChartStat[] {
  const eligible = records.filter((record) =>
    (record.difficulty === "master" || record.difficulty === "remaster")
    && Number.isFinite(record.internalLevelValue)
    && Number(record.internalLevelValue) >= 12
    && Number.isFinite(record.achievementRate)
  );
  const byConstant = new Map<string, number[]>();
  for (const record of eligible) {
    const key = Number(record.internalLevelValue).toFixed(1);
    const values = byConstant.get(key) ?? [];
    values.push(record.achievementRate);
    byConstant.set(key, values);
  }
  return eligible.map((record) => {
    const level = Number(record.internalLevelValue);
    const peerMedian = median(byConstant.get(level.toFixed(1)) ?? [record.achievementRate]);
    const currentRating = Number.isFinite(record.chartRating)
      ? Number(record.chartRating)
      : calculateInsightRating(level, record.achievementRate);
    const maximumRating = calculateInsightRating(level, 100.5);
    const ratingPotential = Math.max(0, maximumRating - currentRating);
    const achievementNeeded = Math.max(0.05, 100.5 - record.achievementRate);
    return {
      key: chartKey(record),
      record,
      peerMedian,
      personalGap: record.achievementRate - peerMedian,
      currentRating,
      maximumRating,
      ratingPotential,
      efficiency: ratingPotential / achievementNeeded
    };
  }).sort((a, b) => b.efficiency - a.efficiency || b.ratingPotential - a.ratingPotential || a.record.title.localeCompare(b.record.title));
}
