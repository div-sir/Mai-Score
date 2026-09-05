import { expect, it } from "vitest";
import { searchRecords } from "../studio/lib/record-search";
import type { StudioChartRecord } from "../studio/lib/types";

const records: StudioChartRecord[] = [
  { title: "Alpha", type: "std", difficulty: "basic", displayedLevel: "3", achievementRate: 99, version: "A", internalLevelValue: 3 },
  { title: "Alpha", type: "dx", difficulty: "advanced", displayedLevel: "7", achievementRate: 100, comboFlag: "ap+", version: "B", internalLevelValue: 7 },
  { title: "Beta", type: "dx", difficulty: "master", displayedLevel: "13", achievementRate: 98, comboFlag: "fc" }
];

it("keeps all levels and supports basic and advanced", () => {
  expect(searchRecords(records, { level: "all" })).toHaveLength(3);
  expect(searchRecords(records, { difficulty: "basic" })).toEqual([records[0]]);
  expect(searchRecords(records, { difficulty: "advanced" })).toEqual([records[1]]);
});
it("combines type, version and search filters", () => {
  expect(searchRecords(records, { type: "dx", version: "B", query: " ALPHA " })).toEqual([records[1]]);
  expect(searchRecords(records, { type: "std", version: "B" })).toEqual([]);
});
it("handles SSS boundary and inclusive AP and FC statuses", () => {
  expect(searchRecords(records, { status: "sss" })).toHaveLength(2);
  expect(searchRecords(records, { status: "ap" })).toEqual([records[1]]);
  expect(searchRecords(records, { status: "fc" })).toHaveLength(2);
});
it("sorts without mutating input and puts unknown constants last", () => {
  const before = [...records];
  expect(searchRecords(records, { sort: "low" })[0]).toBe(records[2]);
  expect(searchRecords(records, { sort: "constant" })).toEqual([records[1], records[0], records[2]]);
  expect(records).toEqual(before);
});
