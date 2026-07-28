import { describe, expect, it } from "vitest";
import { ratingStars, ratingTier } from "../src/lib/rating-tier";
import { ratingStars as studioRatingStars, ratingTier as studioRatingTier } from "../studio/lib/rating-tier";

// Every row transcribed directly from the official in-game rating table
// (13000 and up). This is the ground truth for that range; anything below
// 13000 is still unverified community guesswork and not covered here.
const OFFICIAL_TABLE: Array<[number, number, string, number]> = [
  [13000, 13999, "silver", 0],
  [14000, 14249, "gold", 1],
  [14250, 14499, "gold", 2],
  [14500, 14749, "platinum", 1],
  [14750, 14999, "platinum", 2],
  [15000, 15249, "rainbow", 1],
  [15250, 15499, "rainbow", 2],
  [15500, 15749, "rainbow", 3],
  [15750, 15999, "rainbow", 4],
  [16000, 16249, "rainbow-extreme", 1],
  [16250, 16499, "rainbow-extreme", 2],
  [16500, 16749, "rainbow-extreme", 3],
  [16750, 17999, "rainbow-extreme", 4]
];

describe("rating tier", () => {
  it("matches every row of the official table, name and star count together", () => {
    for (const [min, max, name, stars] of OFFICIAL_TABLE) {
      for (const rating of [min, max]) {
        expect(ratingTier(rating).name, `rating ${rating}`).toBe(name);
        expect(ratingStars(rating), `rating ${rating}`).toBe(stars);
      }
    }
  });

  it("never regresses to white above 0", () => {
    expect(ratingTier(0).name).toBe("white");
    expect(ratingTier(999).name).toBe("white");
  });

  it("moves up exactly at each band boundary, not one off it", () => {
    const boundaries: Array<[number, string]> = [
      [1000, "blue"], [2000, "green"], [4000, "yellow"], [7000, "red"],
      [10000, "purple"], [12000, "bronze"], [13000, "silver"],
      [14000, "gold"], [14500, "platinum"], [15000, "rainbow"], [16000, "rainbow-extreme"]
    ];
    for (const [min, name] of boundaries) {
      expect(ratingTier(min).name).toBe(name);
      expect(ratingTier(min - 1).name).not.toBe(name);
    }
  });

  it("has no stars below gold", () => {
    for (const rating of [0, 999, 5000, 10000, 12500, 13000, 13999]) {
      expect(ratingStars(rating)).toBe(0);
    }
  });

  it("caps stars at each tier's maximum instead of climbing forever", () => {
    expect(ratingStars(14499)).toBe(2);
    expect(ratingStars(14999)).toBe(2);
    expect(ratingStars(99999)).toBe(4);
  });

  it("holds the top tier for any rating above its floor", () => {
    expect(ratingTier(99999).name).toBe("rainbow-extreme");
  });

  it("stays identical to Studio's independent copy of this table", () => {
    // Studio has no shared package with the extension, so this table is
    // duplicated by hand at studio/lib/rating-tier.ts. A rating tier that
    // matches on one side and not the other is a real, user-visible
    // inconsistency between the popup export and the Studio export.
    for (let rating = 0; rating <= 17000; rating += 250) {
      expect(studioRatingTier(rating)).toEqual(ratingTier(rating));
      expect(studioRatingStars(rating)).toBe(ratingStars(rating));
    }
  });

  it("gives every tier at least two gradient stops and a readable label colour", () => {
    for (const rating of [0, 1000, 2000, 4000, 7000, 10000, 12000, 13000, 14000, 14500, 15000, 16000]) {
      const tier = ratingTier(rating);
      expect(tier.gradient.length).toBeGreaterThanOrEqual(2);
      expect(tier.labelColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
