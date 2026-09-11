import { describe, expect, it } from "vitest";
import { calculateInsightRating } from "../studio/lib/insights";
import { buildFullRecordRecommendations, buildRatingPlan } from "../studio/lib/rating-planner";
import type { StudioData, StudioRecord } from "../studio/lib/types";

function b50Record(index: number, bucket: "b15" | "b35"): StudioRecord {
  return {
    title: `${bucket}-${index}`,
    type: "dx",
    difficulty: "master",
    displayedLevel: "10",
    internalLevelValue: 10,
    achievementRate: 100.5,
    chartRating: bucket === "b15" ? 210 : 205,
    version: bucket === "b15" ? "Current" : "Old",
    bucket
  };
}

function fixture(): StudioData {
  const records = [
    ...Array.from({ length: 15 }, (_, index) => b50Record(index, "b15")),
    ...Array.from({ length: 35 }, (_, index) => b50Record(index, "b35"))
  ];
  const outside = {
    title: "Outside candidate",
    type: "dx" as const,
    difficulty: "master" as const,
    displayedLevel: "10+",
    internalLevelValue: 10.7,
    achievementRate: 99.9,
    version: "Old"
  };
  return {
    schema: "mai-score/v1",
    exportedAt: "2026-09-11T00:00:00.000Z",
    player: { name: "TEST", title: "", rating: 0 },
    records,
    fullRecords: [...records, outside],
    b15Rating: 15 * 210,
    b35Rating: 35 * 205,
    b50Rating: 15 * 210 + 35 * 205
  };
}

describe("Full Records recommendations", () => {
  it("includes a played chart outside B50 and assigns it to the old bucket", () => {
    const recommendations = buildFullRecordRecommendations(fixture());
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      record: { title: "Outside candidate" },
      bucket: "b35",
      targetAchievement: 100,
      inB50: false
    });
    expect(recommendations[0].b50Gain).toBe(calculateInsightRating(10.7, 100) - 205);
  });

  it("withholds version-inferred recommendations when the current version is ambiguous", () => {
    const data = fixture();
    data.records[1].version = "Another current version";
    expect(buildFullRecordRecommendations(data)).toEqual([]);
  });

  it("can skip milestones that do not yet cross the B35 cutoff", () => {
    const data = fixture();
    for (const record of data.records.filter(record => record.bucket === "b35")) record.chartRating = 225;
    const outside = data.fullRecords!.find(record => record.title === "Outside candidate")!;
    outside.achievementRate = 98;
    outside.chartRating = calculateInsightRating(10.7, 98);
    data.b35Rating = 35 * 225;
    data.b50Rating = data.b15Rating + data.b35Rating;
    const recommendation = buildFullRecordRecommendations(data)[0];
    expect(recommendation.targetAchievement).toBe(100.5);
    expect(recommendation.b50Gain).toBe(calculateInsightRating(10.7, 100.5) - 225);
  });
});

describe("target Rating planner", () => {
  it("builds a cutoff-aware plan and reports whether the target is reachable", () => {
    const data = fixture();
    const firstGain = calculateInsightRating(10.7, 100) - 205;
    const plan = buildRatingPlan(data, data.b50Rating + firstGain);
    expect(plan.reachable).toBe(true);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({ targetAchievement: 100, b50Gain: firstGain });
    expect(plan.projectedRating).toBe(data.b50Rating + firstGain);

    const impossible = buildRatingPlan(data, 20_000);
    expect(impossible.reachable).toBe(false);
    expect(impossible.maximumRating).toBeLessThan(20_000);
  });
});
