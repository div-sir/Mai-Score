import { describe, expect, it } from "vitest";
import { ratingTier } from "../src/lib/rating-tier";
import { ratingTier as studioRatingTier } from "../studio/lib/rating-tier";

describe("rating tier", () => {
  it("matches the one confirmed data point: 14699 is gold", () => {
    expect(ratingTier(14699).name).toBe("gold");
  });

  it("never regresses to white above 0", () => {
    expect(ratingTier(0).name).toBe("white");
    expect(ratingTier(999).name).toBe("white");
  });

  it("moves up exactly at each band boundary, not one off it", () => {
    const boundaries: Array<[number, string]> = [
      [1000, "blue"], [2000, "green"], [4000, "yellow"], [7000, "red"],
      [10000, "purple"], [12000, "bronze"], [13000, "silver"],
      [14000, "gold"], [15000, "platinum"], [16000, "rainbow"]
    ];
    for (const [min, name] of boundaries) {
      expect(ratingTier(min).name).toBe(name);
      expect(ratingTier(min - 1).name).not.toBe(name);
    }
  });

  it("holds the top tier for any rating above its floor", () => {
    expect(ratingTier(99999).name).toBe("rainbow");
  });

  it("stays identical to Studio's independent copy of this table", () => {
    // Studio has no shared package with the extension, so this table is
    // duplicated by hand at studio/lib/rating-tier.ts. A rating tier that
    // matches on one side and not the other is a real, user-visible
    // inconsistency between the popup export and the Studio export.
    for (let rating = 0; rating <= 17000; rating += 250) {
      expect(studioRatingTier(rating)).toEqual(ratingTier(rating));
    }
  });

  it("gives every tier at least two gradient stops and a readable label colour", () => {
    for (const rating of [0, 1000, 2000, 4000, 7000, 10000, 12000, 13000, 14000, 15000, 16000]) {
      const tier = ratingTier(rating);
      expect(tier.gradient.length).toBeGreaterThanOrEqual(2);
      expect(tier.labelColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
