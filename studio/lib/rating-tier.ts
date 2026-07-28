// Kept identical to src/lib/rating-tier.ts (the extension has no shared
// package with Studio to import this from). See that file for the same
// verification note: confirmed only against one data point (14699 -> gold);
// every other band boundary is carried over from memory, not re-checked
// against the live game.
export interface RatingTier {
  name: string;
  gradient: readonly string[];
  labelColor: string;
}

const TIERS: ReadonlyArray<{ min: number; tier: RatingTier }> = [
  { min: 0, tier: { name: "white", gradient: ["#f2f2f2", "#c7c7c7"], labelColor: "#333333" } },
  { min: 1000, tier: { name: "blue", gradient: ["#8fd8ff", "#2f8fd6"], labelColor: "#ffffff" } },
  { min: 2000, tier: { name: "green", gradient: ["#9be898", "#3fae43"], labelColor: "#ffffff" } },
  { min: 4000, tier: { name: "yellow", gradient: ["#ffe27a", "#f2b400"], labelColor: "#5a3d00" } },
  { min: 7000, tier: { name: "red", gradient: ["#ff9a86", "#e2412a"], labelColor: "#ffffff" } },
  { min: 10000, tier: { name: "purple", gradient: ["#dcaaff", "#9a3fd6"], labelColor: "#ffffff" } },
  { min: 12000, tier: { name: "bronze", gradient: ["#d9a468", "#96602c"], labelColor: "#ffffff" } },
  { min: 13000, tier: { name: "silver", gradient: ["#f1f3f6", "#a9b3bd"], labelColor: "#3a3a3a" } },
  { min: 14000, tier: { name: "gold", gradient: ["#ffe9a8", "#e8b23d"], labelColor: "#5a3d00" } },
  { min: 15000, tier: { name: "platinum", gradient: ["#f4fbff", "#bfe6ef"], labelColor: "#1f4a55" } },
  { min: 16000, tier: { name: "rainbow", gradient: ["#ff8fd6", "#ffd97a", "#8fe08a", "#7ad1ff", "#c79bff"], labelColor: "#2a2a2a" } }
];

export function ratingTier(rating: number): RatingTier {
  let selected = TIERS[0].tier;
  for (const { min, tier } of TIERS) {
    if (rating < min) break;
    selected = tier;
  }
  return selected;
}
