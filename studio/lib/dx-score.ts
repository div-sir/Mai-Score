import type { StudioRecentPlay } from "./types";

export const DX_STAR_RATES = [85, 90, 93, 95, 97] as const;

export interface DxScoreChartBest {
  key: string;
  play: StudioRecentPlay;
  score: number;
  max: number;
  rate: number;
  stars: number;
  nextStars?: number;
  nextScore?: number;
  pointsNeeded?: number;
}

export interface DxScoreInsights {
  totalScore: number;
  totalMax: number;
  rate: number;
  chartCount: number;
  playCount: number;
  recentBests: number;
  oldestAt: string;
  newestAt: string;
  starCounts: readonly number[];
  closestUpgrades: DxScoreChartBest[];
  topCharts: DxScoreChartBest[];
}

const chartKey = (play: StudioRecentPlay) => play.chartId || `${play.title}\u0000${play.type}\u0000${play.difficulty}`;

export function dxStars(rate: number): number {
  let stars = 0;
  for (const threshold of DX_STAR_RATES) {
    if (rate + Number.EPSILON < threshold) break;
    stars += 1;
  }
  return stars;
}

function chartBest(play: StudioRecentPlay): DxScoreChartBest | undefined {
  const score = Number(play.dxScore);
  const max = Number(play.dxScoreMax);
  if (!Number.isSafeInteger(score) || !Number.isSafeInteger(max) || score < 0 || max <= 0 || score > max) return undefined;
  const rate = score / max * 100;
  const stars = dxStars(rate);
  const nextRate = DX_STAR_RATES[stars];
  const nextScore = nextRate === undefined ? undefined : Math.ceil(max * nextRate / 100);
  return {
    key: chartKey(play), play, score, max, rate, stars,
    ...(nextScore === undefined ? {} : { nextStars: stars + 1, nextScore, pointsNeeded: Math.max(0, nextScore - score) })
  };
}

/** Summarizes the rolling DX NET play log without counting repeat plays twice. */
export function buildDxScoreInsights(plays: readonly StudioRecentPlay[] | undefined): DxScoreInsights | undefined {
  const bestByChart = new Map<string, DxScoreChartBest>();
  const validPlayedAt: string[] = [];
  let playCount = 0;
  for (const play of plays ?? []) {
    const candidate = chartBest(play);
    if (!candidate) continue;
    playCount += 1;
    if (Number.isFinite(Date.parse(`${play.playedAt}:00`))) validPlayedAt.push(play.playedAt);
    const current = bestByChart.get(candidate.key);
    if (!current || candidate.score > current.score || (candidate.score === current.score && candidate.play.playedAt > current.play.playedAt)) {
      bestByChart.set(candidate.key, candidate);
    }
  }
  const charts = [...bestByChart.values()];
  if (!charts.length) return undefined;
  const totalScore = charts.reduce((sum, chart) => sum + chart.score, 0);
  const totalMax = charts.reduce((sum, chart) => sum + chart.max, 0);
  const starCounts = Array.from({ length: 6 }, (_, stars) => charts.filter((chart) => chart.stars === stars).length);
  const observedAt = validPlayedAt.sort();
  return {
    totalScore,
    totalMax,
    rate: totalScore / totalMax * 100,
    chartCount: charts.length,
    playCount,
    recentBests: (plays ?? []).filter((play) => play.newDxScore).length,
    oldestAt: observedAt[0] ?? charts.at(-1)!.play.playedAt,
    newestAt: observedAt.at(-1) ?? charts[0].play.playedAt,
    starCounts,
    closestUpgrades: charts.filter((chart) => chart.pointsNeeded !== undefined)
      .sort((a, b) => a.pointsNeeded! - b.pointsNeeded! || b.rate - a.rate || a.play.title.localeCompare(b.play.title))
      .slice(0, 6),
    topCharts: [...charts].sort((a, b) => b.rate - a.rate || b.score - a.score || a.play.title.localeCompare(b.play.title)).slice(0, 6)
  };
}
