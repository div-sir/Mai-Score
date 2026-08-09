import { describe, expect, it } from "vitest";
import {
  CHART_DATA_SOURCE,
  CHART_DATA_STALE_AFTER_DAYS,
  chartDataAgeDays,
  chartDataIsStale
} from "../src/lib/chart-data";

describe("chart-data metadata", () => {
  it("describes the packaged catalog", () => {
    expect(CHART_DATA_SOURCE.source).toMatch(/^https:\/\//);
    expect(CHART_DATA_SOURCE.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(CHART_DATA_SOURCE.sheets).toBeGreaterThanOrEqual(6195);
    expect(Date.parse(CHART_DATA_SOURCE.updateTime)).toBeGreaterThanOrEqual(Date.parse("2026-08-09"));
  });

  it("marks data stale only after the supported freshness window", () => {
    const updated = "2026-08-01T00:00:00.000Z";
    expect(chartDataAgeDays(new Date("2026-08-31T00:00:00.000Z"), updated)).toBe(CHART_DATA_STALE_AFTER_DAYS);
    expect(chartDataAgeDays(new Date("2026-09-01T00:00:00.000Z"), updated)).toBe(CHART_DATA_STALE_AFTER_DAYS + 1);
    expect(chartDataIsStale(new Date(CHART_DATA_SOURCE.updateTime))).toBe(false);
  });

  it("does not report a negative age for future-dated upstream metadata", () => {
    expect(chartDataAgeDays(new Date("2026-08-01T00:00:00.000Z"), "2026-08-02T00:00:00.000Z")).toBe(0);
    expect(chartDataAgeDays(new Date(), "not-a-date")).toBe(Number.POSITIVE_INFINITY);
  });
});
