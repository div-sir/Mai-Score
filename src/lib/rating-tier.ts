export interface RatingTier {
  name: string;
  // 2+ colour stops for a linear gradient, low to high.
  gradient: readonly string[];
  // Text colour readable against that gradient.
  labelColor: string;
}

// Community-documented maimai DX rating tier bands (the colour of the
// official in-game "DELUXE RATING" badge border). Confirmed against one data
// point directly: the reference screenshot this was built from shows 14699
// as gold, which is why the gold band runs 14000-14999 rather than splitting
// at 14500 as some older community write-ups have it. The exact edges of
// every OTHER band are carried over from memory, not re-verified against the
// live game — flag any tier that looks wrong once you see it rendered.
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
