import { expect, it } from "vitest";
import { catalogCompletion } from "../studio/lib/catalog-completion";
import { joinCatalogRecords } from "../studio/lib/catalog-records";
import type { SheetRecord } from "../src/lib/types";
const sheet = (id: string): SheetRecord => ({ sheetId: id, songId: id, title: id, type: "dx", difficulty: "master", level: "13", internalLevelValue: 13, version: "A", imageName: "" });
const score = (id: string, achievementRate: number, comboFlag?: "fc+" | "ap+") => ({ chartId: id, title: id, type: "dx" as const, difficulty: "master" as const, displayedLevel: "13", achievementRate, comboFlag });
it("counts actual members and separates unknown observations from known gaps", () => {
  const rows = joinCatalogRecords([sheet("a"), sheet("b"), sheet("c")], [score("a", 100), score("b", 99.9999)]);
  const result = catalogCompletion(rows, "sss");
  expect(result).toMatchObject({ total: 3, completed: 1, belowTarget: 1, unknown: 1 });
  expect(result.gaps.map(g => [g.chart.sheet.sheetId, g.reason])).toEqual([["b", "below-target"], ["c", "unobserved"]]);
  expect(rows[2].score).toBeUndefined();
});
it("uses exact thresholds and inclusive FC/AP badges", () => {
  const rows = joinCatalogRecords([sheet("a"), sheet("b")], [score("a", 100.4999, "fc+"), score("b", 100.5, "ap+")]);
  expect(catalogCompletion(rows, "sssPlus").completed).toBe(1);
  expect(catalogCompletion(rows, "fc").completed).toBe(2);
  expect(catalogCompletion(rows, "ap").completed).toBe(1);
});
it("rejects duplicate denominator IDs and withholds ambiguous or invalid scores", () => {
  const duplicate = joinCatalogRecords([sheet("a"), sheet("a")], [score("a", 100.5)]);
  expect(duplicate.every(row => row.status === "ambiguous" && !row.score)).toBe(true);
  expect(() => catalogCompletion(duplicate, "sss")).toThrow("unique chart IDs");
  const rows = joinCatalogRecords([sheet("a"), sheet("b")], [score("a", 100), score("a", 100.5), score("b", NaN)]);
  expect(catalogCompletion(rows, "sss")).toMatchObject({ completed: 0, unknown: 2 });
  expect(catalogCompletion([], "sss")).toMatchObject({ total: 0, completed: 0, gaps: [] });
});
