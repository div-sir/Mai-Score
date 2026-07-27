import { describe, expect, it } from "vitest";
import { calculateChartRating, ratingCoefficient } from "../src/lib/rating";

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
});
