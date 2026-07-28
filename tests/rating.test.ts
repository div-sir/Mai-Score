import { describe, expect, it } from "vitest";
import { calculateB50Breakdown, calculateChartRating, ratingCoefficient } from "../src/lib/rating";

describe("maimai chart rating", () => {
  it("uses the exact achievement breakpoints", () => {
    expect(ratingCoefficient(96.9998)).toBe(16.8);
    expect(ratingCoefficient(97)).toBe(20);
    expect(ratingCoefficient(100.5)).toBe(22.4);
  });

  it("holds one coefficient across each achievement band", () => {
    // DX NET reports four decimals, so the top of a band is reachable and must
    // not score higher than the rest of it.
    expect(ratingCoefficient(99.9999)).toBe(ratingCoefficient(99.5));
    expect(ratingCoefficient(100.4999)).toBe(ratingCoefficient(100));
    expect(ratingCoefficient(98.9999)).toBe(ratingCoefficient(98));
    expect(ratingCoefficient(96.9999)).toBe(ratingCoefficient(94));
    expect(ratingCoefficient(79.9999)).toBe(ratingCoefficient(75));
  });

  it("never lowers the coefficient as achievement rises", () => {
    // Sweep coarsely, then densely either side of every breakpoint — that is
    // where a stray entry from another convention would show up.
    const breakpoints = [75, 80, 90, 94, 97, 98, 99, 99.5, 100, 100.5];
    const probes = [
      ...Array.from({ length: 1006 }, (_, i) => i / 10),
      ...breakpoints.flatMap((b) => [b - 0.0002, b - 0.0001, b, b + 0.0001])
    ].filter((rate) => rate >= 0 && rate <= 100.5).sort((a, b) => a - b);

    const regressions = probes.filter((rate, index) =>
      index > 0 && ratingCoefficient(rate) < ratingCoefficient(probes[index - 1]));
    expect(regressions).toEqual([]);
  });

  it("caps achievement at 100.5", () => {
    expect(calculateChartRating(15, 100.6)).toBe(calculateChartRating(15, 100.5));
    expect(calculateChartRating(15, 100.5)).toBe(337);
  });

  it("ignores combo status, which the official rating does not count", () => {
    // A 15.0 chart at SSS+ is 337 whether or not it was an AP.
    expect(calculateChartRating(15, 100.5)).toBe(337);
    expect(calculateChartRating(14, 99.5)).toBe(Math.floor(21.1 * 14 * 99.5 / 100));
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
