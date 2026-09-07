import { expect, it } from "vitest";
import { simulateCatalogChart } from "../studio/lib/catalog-simulation";
import type { StudioData, StudioRecord } from "../studio/lib/types";
import type { SheetRecord } from "../src/lib/types";
const sheet: SheetRecord = { sheetId: "a", songId: "a", title: "A", type: "dx", difficulty: "master", level: "13", internalLevelValue: 13, version: "A", imageName: "" };
const candidate: StudioRecord = { chartId: "a", title: "A", type: "dx", difficulty: "master", displayedLevel: "13", internalLevelValue: 13, achievementRate: 99, chartRating: 200, bucket: "b15" };
const data = (): StudioData => ({ schema: "test", exportedAt: "2026-09-05", player: { name: "Test", title: "", rating: 0 }, records: Array.from({ length: 15 }, (_, i) => ({ ...candidate, chartId: String(i), title: String(i), chartRating: 250 })), candidateRecords: [candidate], b15Rating: 3750, b35Rating: 0, b50Rating: 3750 });
it("subtracts the bucket cutoff for eligible candidates", () => {
  const result = simulateCatalogChart(data(), sheet, 100.5)!;
  expect(result.gain).toBe(result.rating - 250);
  expect(result.total).toBe(3750 + result.gain);
});
it("uses the selected B50 record's rating for an improvement", () => {
  const d = data(); d.records[0] = candidate;
  const result = simulateCatalogChart(d, sheet, 100.5)!;
  expect(result.gain).toBe(result.rating - 200);
});
it("withholds unsupported, incomplete and lower-score scenarios", () => {
  const d = data();
  expect(simulateCatalogChart({ ...d, candidateRecords: [] }, sheet, 100.5)).toBeUndefined();
  expect(simulateCatalogChart({ ...d, records: [] }, sheet, 100.5)).toBeUndefined();
  expect(simulateCatalogChart(d, sheet, 98)).toBeUndefined();
  expect(simulateCatalogChart(d, sheet, NaN)).toBeUndefined();
  expect(simulateCatalogChart(d, { ...sheet, internalLevelValue: NaN }, 100)).toBeUndefined();
});
