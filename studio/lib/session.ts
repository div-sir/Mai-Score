import { chartKey, type HistoryEntry } from "./history";
import type { StudioChartRecord, StudioData, StudioRecentPlay } from "./types";

export type WeaknessKind = "precision" | "accuracy" | "combo" | "consistency";

export interface PlaySession {
  plays: StudioRecentPlay[];
  startedAt: string;
  endedAt: string;
  uniqueCharts: number;
  personalBests: number;
  dxScoreBests: number;
  fullCombos: number;
  allPerfects: number;
  repeatedCharts: number;
  ratingDelta?: number;
}

export interface PracticeTarget {
  record: StudioChartRecord;
  targetAchievement: number;
  attempts?: number;
}

export interface WeaknessPrescription {
  kind: WeaknessKind;
  evidence: number;
  severity: number;
  targets: PracticeTarget[];
}

const timeOf = (playedAt: string) => Date.parse(`${playedAt}:00`);

const nextThreshold = (achievement: number) => {
  for (const target of [97, 98, 99, 99.5, 100, 100.5]) {
    if (achievement < target - 0.00005) return target;
  }
  return 100.5;
};

/** Groups the newest rolling play-log entries into one arcade visit. */
export function buildLatestSession(
  plays: readonly StudioRecentPlay[] | undefined,
  previous?: HistoryEntry,
  currentOfficialRating?: number,
  gapMinutes = 120
): PlaySession | undefined {
  const sorted = [...(plays ?? [])]
    .filter((play) => Number.isFinite(timeOf(play.playedAt)))
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  if (!sorted.length) return undefined;

  const selected = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const newer = timeOf(selected.at(-1)!.playedAt);
    const older = timeOf(sorted[index].playedAt);
    if (newer - older > gapMinutes * 60_000) break;
    selected.push(sorted[index]);
  }

  const attempts = new Map<string, number>();
  for (const play of selected) attempts.set(chartKey(play), (attempts.get(chartKey(play)) ?? 0) + 1);
  const fullCombos = selected.filter((play) => Boolean(play.comboFlag)).length;
  const allPerfects = selected.filter((play) => play.comboFlag === "ap" || play.comboFlag === "ap+").length;
  const ratingDelta = previous && Number.isFinite(currentOfficialRating)
    ? Number(currentOfficialRating) - previous.officialRating
    : undefined;

  return {
    plays: selected,
    startedAt: selected.at(-1)!.playedAt,
    endedAt: selected[0].playedAt,
    uniqueCharts: attempts.size,
    personalBests: selected.filter((play) => play.newAchievement).length,
    dxScoreBests: selected.filter((play) => play.newDxScore).length,
    fullCombos,
    allPerfects,
    repeatedCharts: [...attempts.values()].filter((count) => count > 1).length,
    ...(ratingDelta !== undefined ? { ratingDelta } : {})
  };
}

function targetList(records: readonly StudioChartRecord[], limit = 3): PracticeTarget[] {
  return [...records]
    .sort((a, b) => {
      const gapA = nextThreshold(a.achievementRate) - a.achievementRate;
      const gapB = nextThreshold(b.achievementRate) - b.achievementRate;
      return gapA - gapB
        || Number(b.internalLevelValue ?? 0) - Number(a.internalLevelValue ?? 0)
        || a.title.localeCompare(b.title);
    })
    .slice(0, limit)
    .map((record) => ({ record, targetAchievement: nextThreshold(record.achievementRate) }));
}

/** Deterministic, local-only coaching from best scores and the latest visit. */
export function buildWeaknessPrescriptions(
  data: StudioData,
  session?: PlaySession
): WeaknessPrescription[] {
  const records = data.fullRecords ?? data.records;
  const precision = records.filter((record) => record.achievementRate >= 99.5 && record.achievementRate < 100.5);
  const accuracy = records.filter((record) => record.achievementRate >= 97 && record.achievementRate < 99.5);
  const combo = records.filter((record) => record.achievementRate >= 99 && !record.comboFlag);
  const byKey = new Map(records.map((record) => [chartKey(record), record]));
  const attempts = new Map<string, StudioRecentPlay[]>();
  for (const play of session?.plays ?? []) {
    const key = chartKey(play);
    attempts.set(key, [...(attempts.get(key) ?? []), play]);
  }
  const repeated = [...attempts.entries()]
    .filter(([, plays]) => plays.length > 1 && plays.every((play) => !play.newAchievement));
  const consistencyTargets = repeated.flatMap(([key, plays]) => {
    const record = byKey.get(key) ?? plays[0];
    return record ? [{ record, targetAchievement: nextThreshold(record.achievementRate), attempts: plays.length }] : [];
  }).sort((a, b) => Number(b.attempts) - Number(a.attempts)).slice(0, 3);

  const candidates: WeaknessPrescription[] = [
    {
      kind: "precision",
      evidence: precision.length,
      severity: precision.length / Math.max(8, records.length * 0.12),
      targets: targetList(precision)
    },
    {
      kind: "accuracy",
      evidence: accuracy.length,
      severity: accuracy.length / Math.max(8, records.length * 0.15),
      targets: targetList(accuracy)
    },
    {
      kind: "combo",
      evidence: combo.length,
      severity: combo.length / Math.max(8, records.length * 0.12),
      targets: targetList(combo)
    },
    {
      kind: "consistency",
      evidence: repeated.length,
      severity: repeated.length / Math.max(2, session?.uniqueCharts ?? 2),
      targets: consistencyTargets
    }
  ];

  return candidates
    .filter((item) => item.evidence > 0 && item.targets.length > 0)
    .sort((a, b) => b.severity - a.severity || b.evidence - a.evidence || a.kind.localeCompare(b.kind))
    .slice(0, 3);
}

export function buildPracticeList(prescriptions: readonly WeaknessPrescription[], limit = 6): PracticeTarget[] {
  const seen = new Set<string>();
  const result: PracticeTarget[] = [];
  for (const prescription of prescriptions) {
    for (const target of prescription.targets) {
      const key = chartKey(target.record);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(target);
      if (result.length >= limit) return result;
    }
  }
  return result;
}
