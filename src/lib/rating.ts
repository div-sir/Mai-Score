const COEFFICIENTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [10, 1.6], [20, 3.2], [30, 4.8], [40, 6.4], [50, 8],
  [60, 9.6], [70, 11.2], [75, 12], [79.9999, 12.8], [80, 13.6],
  [90, 15.2], [94, 16.8], [96.9999, 17.6], [97, 20], [98, 20.3],
  [98.9999, 20.6], [99, 20.8], [99.5, 21.1], [99.9999, 21.4],
  [100, 21.6], [100.4999, 22.2], [100.5, 22.4]
];

export function ratingCoefficient(achievementRate: number): number {
  let coefficient = 0;
  for (const [threshold, value] of COEFFICIENTS) {
    if (achievementRate < threshold) break;
    coefficient = value;
  }
  return coefficient;
}

export function calculateChartRating(
  internalLevel: number,
  achievementRate: number,
  comboFlag?: string
): number {
  const capped = Math.min(100.5, Math.max(0, achievementRate));
  const base = Math.floor(ratingCoefficient(capped) * internalLevel * capped / 100);
  return base + (/^ap\+?$/i.test(comboFlag ?? "") ? 1 : 0);
}
