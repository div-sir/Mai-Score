import { describe, expect, it } from "vitest";
import { calculateB50Breakdown, calculateChartRating, ratingCoefficient } from "../src/lib/rating";

describe("maimai chart rating", () => {
  it("uses the exact achievement breakpoints", () => {
    expect(ratingCoefficient(96.9998)).toBe(16.8);
    expect(ratingCoefficient(97)).toBe(20);
    expect(ratingCoefficient(100.5)).toBe(22.4);
  });

  it("caps achievement at 100.5 and adds one for AP", () => {
    expect(calculateChartRating(15, 100.6)).toBe(calculateChartRating(15, 100.5));
    expect(calculateChartRating(15, 100.5, "ap")).toBe(calculateChartRating(15, 100.5) + 1);
    expect(calculateChartRating(15, 100.5, "ap+")).toBe(calculateChartRating(15, 100.5) + 1);
  });

  it("sums only the best 15 new and 35 old charts", () => {
    const records = [
      ...Array.from({ length: 20 }, () => ({ bucket: "b15" as const, chartRating: 300 })),
      ...Array.from({ length: 50 }, () => ({ bucket: "b35" as const, chartRating: 290 }))
    ];
    expect(calculateB50Breakdown(records)).toEqual({
      b15Rating: 4500,
      b35Rating: 10150,
      b50Rating: 14650
    });
  });

  it("takes the highest rated charts when records are not in rank order", () => {
    const records = [
      { bucket: "b15" as const, chartRating: 1 },
      ...Array.from({ length: 15 }, () => ({ bucket: "b15" as const, chartRating: 300 })),
      { bucket: "b35" as const, chartRating: 1 },
      ...Array.from({ length: 35 }, () => ({ bucket: "b35" as const, chartRating: 290 }))
    ];
    expect(calculateB50Breakdown(records)).toEqual({
      b15Rating: 4500,
      b35Rating: 10150,
      b50Rating: 14650
    });
  });

  it("treats a missing chart rating as zero", () => {
    const records = [
      ...Array.from({ length: 15 }, () => ({ bucket: "b15" as const })),
      ...Array.from({ length: 35 }, () => ({ bucket: "b35" as const, chartRating: 290 }))
    ];
    expect(calculateB50Breakdown(records)).toEqual({
      b15Rating: 0,
      b35Rating: 10150,
      b50Rating: 10150
    });
  });
});
