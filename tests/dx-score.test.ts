import { describe, expect, it } from "vitest";
import { buildDxScoreInsights, dxStars } from "../studio/lib/dx-score";
import type { StudioRecentPlay } from "../studio/lib/types";

const play = (title: string, score: number, max: number, extra: Partial<StudioRecentPlay> = {}): StudioRecentPlay => ({
  title, type: "dx", difficulty: "master", displayedLevel: "13", achievementRate: 100,
  playedAt: "2026-11-20T12:00", track: 1, newAchievement: false, dxScore: score, dxScoreMax: max, ...extra
});

describe("DX Score insights", () => {
  it("uses the five DX star thresholds", () => {
    expect([84.99, 85, 90, 93, 95, 97, 100].map(dxStars)).toEqual([0, 1, 2, 3, 4, 5, 5]);
  });

  it("keeps the best score per chart and calculates star upgrades", () => {
    const result = buildDxScoreInsights([
      play("A", 2500, 3000), play("A", 2850, 3000, { playedAt: "2026-11-20T13:00", newDxScore: true }),
      play("B", 1800, 2000, { newDxScore: true })
    ]);
    expect(result).toMatchObject({ totalScore: 4650, totalMax: 5000, rate: 93, chartCount: 2, recentBests: 2 });
    expect(result?.starCounts).toEqual([0, 0, 1, 0, 1, 0]);
    expect(result?.closestUpgrades.find((chart) => chart.play.title === "B")).toMatchObject({ nextStars: 3, pointsNeeded: 60 });
  });

  it("ignores invalid scores", () => {
    expect(buildDxScoreInsights([play("A", 3001, 3000)])).toBeUndefined();
  });
});
