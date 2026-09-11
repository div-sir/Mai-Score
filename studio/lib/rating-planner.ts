import { chartKey } from "./history";
import { ACHIEVEMENT_TARGETS, calculateInsightRating } from "./insights";
import type { StudioChartRecord, StudioData, StudioRecord } from "./types";

export type PlanningBucket = StudioRecord["bucket"];

export interface FullRecordRecommendation {
  key: string;
  record: StudioChartRecord;
  bucket: PlanningBucket;
  targetAchievement: number;
  currentRating: number;
  targetRating: number;
  achievementNeeded: number;
  b50Gain: number;
  inB50: boolean;
}

export interface RatingPlanStep extends FullRecordRecommendation {
  projectedB50: number;
}

export interface RatingPlan {
  currentRating: number;
  targetRating: number;
  projectedRating: number;
  maximumRating: number;
  reachable: boolean;
  steps: RatingPlanStep[];
}

interface PlanningChart {
  key: string;
  record: StudioChartRecord;
  bucket: PlanningBucket;
  inB50: boolean;
  currentRating: number;
}

const BUCKET_SIZE: Record<PlanningBucket, number> = { b15: 15, b35: 35 };

function recordRating(record: StudioChartRecord): number {
  const stored = Number(record.chartRating);
  if (Number.isFinite(stored)) return stored;
  const level = Number(record.internalLevelValue);
  return Number.isFinite(level) && level > 0
    ? calculateInsightRating(level, record.achievementRate)
    : 0;
}

function identityMap(records: readonly StudioRecord[]) {
  return new Map(records.map(record => [chartKey(record), record.bucket]));
}

/**
 * Full Records do not carry a B15/B35 flag. Resolve known B50/candidate charts
 * first, then use the version represented by the current B15 as the only safe
 * way to classify the remaining played charts.
 */
function planningCharts(data: StudioData): PlanningChart[] {
  const explicit = identityMap([...(data.records ?? []), ...(data.candidateRecords ?? [])]);
  const currentVersions = new Set(data.records
    .filter(record => record.bucket === "b15" && record.version)
    .map(record => record.version as string));
  const b50Keys = new Set(data.records.map(chartKey));
  const source = data.fullRecords?.length ? data.fullRecords : data.records;
  const seen = new Set<string>();
  return source.flatMap((record): PlanningChart[] => {
    const key = chartKey(record);
    if (seen.has(key)) return [];
    seen.add(key);
    const bucket = explicit.get(key)
      ?? (record.version && currentVersions.size === 1
        ? (currentVersions.has(record.version) ? "b15" : "b35")
        : undefined);
    const level = Number(record.internalLevelValue);
    if (!bucket || !Number.isFinite(level) || level <= 0 || record.achievementRate >= 100.5) return [];
    return [{ key, record, bucket, inB50: b50Keys.has(key), currentRating: recordRating(record) }];
  });
}

function baseBuckets(data: StudioData) {
  return {
    b15: data.records.filter(record => record.bucket === "b15").map(record => ({ key: chartKey(record), rating: recordRating(record) })),
    b35: data.records.filter(record => record.bucket === "b35").map(record => ({ key: chartKey(record), rating: recordRating(record) }))
  };
}

function bucketTotal(
  base: ReturnType<typeof baseBuckets>,
  bucket: PlanningBucket,
  selections: ReadonlyMap<string, { bucket: PlanningBucket; rating: number }>
) {
  const ratings = new Map(base[bucket].map(item => [item.key, item.rating]));
  for (const [key, selection] of selections) {
    if (selection.bucket === bucket) ratings.set(key, selection.rating);
  }
  return [...ratings.values()].sort((a, b) => b - a).slice(0, BUCKET_SIZE[bucket]).reduce((sum, rating) => sum + rating, 0);
}

function plannedTotal(data: StudioData, selections: ReadonlyMap<string, { bucket: PlanningBucket; rating: number }>) {
  const base = baseBuckets(data);
  return bucketTotal(base, "b15", selections) + bucketTotal(base, "b35", selections);
}

function nextOptions(
  data: StudioData,
  charts: readonly PlanningChart[],
  selectedAchievements: ReadonlyMap<string, number>,
  selections: ReadonlyMap<string, { bucket: PlanningBucket; rating: number }>
) {
  const before = plannedTotal(data, selections);
  return charts.flatMap((chart): FullRecordRecommendation[] => {
    const currentAchievement = selectedAchievements.get(chart.key) ?? chart.record.achievementRate;
    return ACHIEVEMENT_TARGETS.filter(target => target > currentAchievement + 0.00005).flatMap((targetAchievement): FullRecordRecommendation[] => {
      const targetRating = calculateInsightRating(Number(chart.record.internalLevelValue), targetAchievement);
      const next = new Map(selections);
      next.set(chart.key, { bucket: chart.bucket, rating: targetRating });
      const b50Gain = plannedTotal(data, next) - before;
      if (b50Gain <= 0) return [];
      return [{
        key: chart.key,
        record: chart.record,
        bucket: chart.bucket,
        targetAchievement,
        currentRating: selections.get(chart.key)?.rating ?? chart.currentRating,
        targetRating,
        achievementNeeded: targetAchievement - currentAchievement,
        b50Gain,
        inB50: chart.inB50
      }];
    });
  });
}

/** Best next milestone for every played chart, including charts outside B50. */
export function buildFullRecordRecommendations(data: StudioData, limit = 20): FullRecordRecommendation[] {
  const charts = planningCharts(data);
  const ranked = nextOptions(data, charts, new Map(), new Map()).sort((a, b) => {
      const efficiencyA = a.b50Gain / Math.max(a.achievementNeeded, 0.0001);
      const efficiencyB = b.b50Gain / Math.max(b.achievementNeeded, 0.0001);
      return efficiencyB - efficiencyA || b.b50Gain - a.b50Gain || a.achievementNeeded - b.achievementNeeded;
    });
  const unique = new Map<string, FullRecordRecommendation>();
  for (const recommendation of ranked) {
    if (!unique.has(recommendation.key)) unique.set(recommendation.key, recommendation);
  }
  return [...unique.values()].slice(0, limit);
}

/**
 * Greedily applies the most efficient next achievement milestone, recalculating
 * both bucket cutoffs after every step. A chart may advance through several
 * milestones; the returned plan consolidates each chart into one final target
 * and then replays those targets so every displayed B50 gain stays additive.
 */
export function buildRatingPlan(data: StudioData, requestedTarget: number, maxSteps = 50): RatingPlan {
  const targetRating = Math.max(data.b50Rating, Math.floor(requestedTarget));
  const charts = planningCharts(data);
  const selections = new Map<string, { bucket: PlanningBucket; rating: number }>();
  const achievements = new Map<string, number>();
  const chosen = new Map<string, RatingPlanStep>();
  let projectedRating = data.b50Rating;
  let iterations = 0;

  while (projectedRating < targetRating && iterations < maxSteps * ACHIEVEMENT_TARGETS.length) {
    const options = nextOptions(data, charts, achievements, selections).sort((a, b) => {
      const efficiencyA = a.b50Gain / Math.max(a.achievementNeeded, 0.0001);
      const efficiencyB = b.b50Gain / Math.max(b.achievementNeeded, 0.0001);
      return efficiencyB - efficiencyA || b.b50Gain - a.b50Gain || a.achievementNeeded - b.achievementNeeded;
    });
    const best = options[0];
    if (!best) break;
    selections.set(best.key, { bucket: best.bucket, rating: best.targetRating });
    achievements.set(best.key, best.targetAchievement);
    const nextProjected = data.b50Rating + (plannedTotal(data, selections) - plannedTotal(data, new Map()));
    chosen.set(best.key, { ...best, b50Gain: nextProjected - projectedRating, projectedB50: nextProjected });
    projectedRating = nextProjected;
    iterations += 1;
  }

  const maximumSelections = new Map(charts.map(chart => [chart.key, {
    bucket: chart.bucket,
    rating: calculateInsightRating(Number(chart.record.internalLevelValue), 100.5)
  }]));
  const maximumRating = data.b50Rating + (plannedTotal(data, maximumSelections) - plannedTotal(data, new Map()));
  const replay = new Map<string, { bucket: PlanningBucket; rating: number }>();
  let replayTotal = plannedTotal(data, replay);
  const steps = [...chosen.values()].map(step => {
    const chart = charts.find(candidate => candidate.key === step.key)!;
    replay.set(step.key, selections.get(step.key)!);
    const nextTotal = plannedTotal(data, replay);
    const b50Gain = nextTotal - replayTotal;
    replayTotal = nextTotal;
    return {
      ...step,
      currentRating: chart.currentRating,
      achievementNeeded: step.targetAchievement - chart.record.achievementRate,
      b50Gain,
      projectedB50: data.b50Rating + (nextTotal - plannedTotal(data, new Map()))
    };
  }).filter(step => step.b50Gain > 0).slice(0, maxSteps);
  return {
    currentRating: data.b50Rating,
    targetRating,
    projectedRating,
    maximumRating,
    reachable: projectedRating >= targetRating,
    steps
  };
}
