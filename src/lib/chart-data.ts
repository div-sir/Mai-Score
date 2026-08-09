import source from "../data/source.json";
import type { ChartDataMetadata } from "./types";

export const CHART_DATA_STALE_AFTER_DAYS = 30;
export const CHART_DATA_SOURCE: ChartDataMetadata = source;

export function chartDataAgeDays(
  now: Date = new Date(),
  updateTime = CHART_DATA_SOURCE.updateTime
): number {
  const updatedAt = Date.parse(updateTime);
  if (!Number.isFinite(updatedAt)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - updatedAt) / 86_400_000));
}

export function chartDataIsStale(now: Date = new Date()): boolean {
  return chartDataAgeDays(now) > CHART_DATA_STALE_AFTER_DAYS;
}
