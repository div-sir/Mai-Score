import { describe, expect, it } from "vitest";
import { buildPersonalChartStats } from "../studio/lib/personal-chart-stats";
import type { StudioChartRecord } from "../studio/lib/types";

const chart = (title: string, achievementRate: number, constant = 13.7): StudioChartRecord => ({
  title, achievementRate, internalLevelValue: constant, chartRating: undefined,
  type: "dx", difficulty: "master", displayedLevel: "13+"
});

describe("personal chart statistics", () => {
  it("compares charts only with the player's own same-constant median", () => {
    const stats = buildPersonalChartStats([
      chart("A", 99), chart("B", 100), chart("C", 100.5), chart("lower", 100.5, 11.9)
    ]);
    expect(stats).toHaveLength(3);
    expect(stats.find((item) => item.record.title === "A")).toMatchObject({ peerMedian: 100, personalGap: -1 });
    expect(stats.find((item) => item.record.title === "C")?.personalGap).toBe(0.5);
  });

  it("reports no remaining rating potential at 100.5%", () => {
    const [stat] = buildPersonalChartStats([chart("done", 100.5)]);
    expect(stat.ratingPotential).toBe(0);
    expect(stat.efficiency).toBe(0);
  });
});
