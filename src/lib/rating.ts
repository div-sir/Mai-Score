// Official maimai DX single-chart rating:
//   floor(internal level x min(achievement, 100.5) x coefficient / 100)
//
// One coefficient per achievement band, keyed by the bottom of the band. The
// table previously also carried entries at 79.9999, 96.9999, 98.9999, 99.9999
// and 100.4999 — the *tops* of bands — whose values came from a different
// coefficient convention. Because DX NET reports achievement to four decimals,
// those values are reachable, and they awarded a higher coefficient at the top
// of a band than the band itself.
const COEFFICIENTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [10, 1.6], [20, 3.2], [30, 4.8], [40, 6.4], [50, 8],
  [60, 9.6], [70, 11.2], [75, 12], [80, 13.6], [90, 15.2],
  [94, 16.8], [97, 20], [98, 20.3], [99, 20.8], [99.5, 21.1],
  [100, 21.6], [100.5, 22.4]
];

export function ratingCoefficient(achievementRate: number): number {
  let coefficient = 0;
  for (const [threshold, value] of COEFFICIENTS) {
    if (achievementRate < threshold) break;
    coefficient = value;
  }
  return coefficient;
}

// Achievement alone determines the rating. maimai DX has no full-combo or
// all-perfect bonus — that is a CHUNITHM mechanic — so an AP used to add one
// point per chart here that the official rating never counted, leaving the
// Mai-Score total above the game's by the number of AP charts in the B50.
export function calculateChartRating(
  internalLevel: number,
  achievementRate: number
): number {
  const capped = Math.min(100.5, Math.max(0, achievementRate));
  return Math.floor(ratingCoefficient(capped) * internalLevel * capped / 100);
}

export function calculateB50Breakdown(
  records: ReadonlyArray<{ bucket: "b15" | "b35"; chartRating?: number }>
): { b15Rating: number; b35Rating: number; b50Rating: number } {
  // Sort before truncating: records may come from an imported Rhythm Record
  // document rather than the rank-ordered DX NET page.
  const sum = (bucket: "b15" | "b35", limit: number) => records
    .filter((record) => record.bucket === bucket)
    .map((record) => record.chartRating ?? 0)
    .sort((a, b) => b - a)
    .slice(0, limit)
    .reduce((total, rating) => total + rating, 0);
  const b15Rating = sum("b15", 15);
  const b35Rating = sum("b35", 35);
  return { b15Rating, b35Rating, b50Rating: b15Rating + b35Rating };
}
