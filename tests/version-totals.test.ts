import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it, vi } from "vitest";

// versionChartTotals reads the same bundled catalog the resolver uses, through
// chrome.runtime.getURL. Pointing both at the real public/data file is what
// makes this a check of the shipped data and not of a fixture that agrees with
// the code by construction.
beforeAll(async () => {
  const catalog = await readFile("public/data/sheets.json.gz");
  vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => `bundled:${path}` } });
  vi.stubGlobal("fetch", async (url: string) => {
    if (url !== "bundled:data/sheets.json.gz") throw new Error(`unexpected fetch: ${url}`);
    return new Response(catalog);
  });
});

describe("catalog version totals", () => {
  it("accounts for every sheet in the bundled catalog", async () => {
    const { versionChartTotals } = await import("../src/lib/resolver");
    const totals = await versionChartTotals();
    const counted = totals.reduce(
      (sum, entry) => sum + entry.basic + entry.advanced + entry.expert + entry.master + entry.remaster,
      0
    );

    const { CHART_DATA_SOURCE } = await import("../src/lib/chart-data");
    // Every sheet lands in exactly one version bucket, so the breakdown has to
    // add back up to the catalog. A silent undercount here would deflate every
    // plate denominator.
    expect(counted).toBe(CHART_DATA_SOURCE.sheets);
    expect(totals.length).toBeGreaterThan(20);
  });

  it("reports each version once, with non-negative counts", async () => {
    const { versionChartTotals } = await import("../src/lib/resolver");
    const totals = await versionChartTotals();

    expect(new Set(totals.map((entry) => entry.version)).size).toBe(totals.length);
    for (const entry of totals) {
      expect(entry.version).not.toBe("");
      for (const difficulty of ["basic", "advanced", "expert", "master", "remaster"] as const) {
        expect(Number.isInteger(entry[difficulty]) && entry[difficulty] >= 0).toBe(true);
      }
    }
  });

  it("gives every version a non-empty BASIC-through-MASTER denominator", async () => {
    const { versionChartTotals } = await import("../src/lib/resolver");
    const totals = await versionChartTotals();

    // A version that reached zero here would be dropped from plate progress
    // entirely, which should only ever happen to a version that has no charts.
    for (const entry of totals) {
      expect(
        entry.basic + entry.advanced + entry.expert + entry.master,
        `${entry.version} has no BASIC-MASTER charts`
      ).toBeGreaterThan(0);
    }
  });
});
