// Kept identical to src/lib/rating-tier.ts (the extension has no shared
// package with Studio to import this from). See that file for the same
// verification note: 13000+ is confirmed against the official in-game
// rating table; below 13000 is community-documented guesswork, unverified.
export interface RatingTier {
  name: string;
  gradient: readonly string[];
  labelColor: string;
}

interface TierEntry {
  min: number;
  tier: RatingTier;
  stars?: { step: number; max: number };
}

const TIERS: readonly TierEntry[] = [
  { min: 0, tier: { name: "white", gradient: ["#f2f2f2", "#c7c7c7"], labelColor: "#333333" } },
  { min: 1000, tier: { name: "blue", gradient: ["#8fd8ff", "#2f8fd6"], labelColor: "#ffffff" } },
  { min: 2000, tier: { name: "green", gradient: ["#9be898", "#3fae43"], labelColor: "#ffffff" } },
  { min: 4000, tier: { name: "yellow", gradient: ["#ffe27a", "#f2b400"], labelColor: "#5a3d00" } },
  { min: 7000, tier: { name: "red", gradient: ["#ff9a86", "#e2412a"], labelColor: "#ffffff" } },
  { min: 10000, tier: { name: "purple", gradient: ["#dcaaff", "#9a3fd6"], labelColor: "#ffffff" } },
  { min: 12000, tier: { name: "bronze", gradient: ["#d9a468", "#96602c"], labelColor: "#ffffff" } },
  { min: 13000, tier: { name: "silver", gradient: ["#bfe4ff", "#4a9fd9"], labelColor: "#ffffff" } },
  { min: 14000, tier: { name: "gold", gradient: ["#ffe27a", "#e8942f"], labelColor: "#5a3200" }, stars: { step: 250, max: 2 } },
  { min: 14500, tier: { name: "platinum", gradient: ["#fff2c2", "#f2c96a"], labelColor: "#5a3d00" }, stars: { step: 250, max: 2 } },
  { min: 15000, tier: { name: "rainbow", gradient: ["#ff8fd6", "#ffd97a", "#8fe08a", "#7ad1ff", "#c79bff"], labelColor: "#2a2a2a" }, stars: { step: 250, max: 4 } },
  { min: 16000, tier: { name: "rainbow-extreme", gradient: ["#ff5fa8", "#ffd23d", "#4de07a", "#3fb6ff", "#a862ff"], labelColor: "#ffffff" }, stars: { step: 250, max: 4 } }
];

function entryFor(rating: number): TierEntry {
  let selected = TIERS[0];
  for (const entry of TIERS) {
    if (rating < entry.min) break;
    selected = entry;
  }
  return selected;
}

export function ratingTier(rating: number): RatingTier {
  return entryFor(rating).tier;
}

export function ratingStars(rating: number): number {
  const entry = entryFor(rating);
  if (!entry.stars) return 0;
  return Math.min(entry.stars.max, Math.floor((rating - entry.min) / entry.stars.step) + 1);
}
