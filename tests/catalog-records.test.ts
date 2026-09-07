import { expect, it } from "vitest";
import { joinCatalogRecords } from "../studio/lib/catalog-records";
import type { SheetRecord } from "../src/lib/types";
import type { StudioChartRecord } from "../studio/lib/types";

const sheet: SheetRecord = { sheetId: "one", songId: "song", title: "Song", type: "dx", difficulty: "master", level: "13", internalLevelValue: 13, version: "A", imageName: "" };
const score: StudioChartRecord = { title: "Song", type: "dx", difficulty: "master", displayedLevel: "13", achievementRate: 99 };

it("matches explicit IDs and unique legacy identities", () => {
  expect(joinCatalogRecords([sheet], [score])[0].status).toBe("matched");
  expect(joinCatalogRecords([sheet], [{ ...score, title: "Renamed", chartId: "one" }])[0].status).toBe("matched");
});
it("does not fabricate zero scores for absent data", () => {
  expect(joinCatalogRecords([sheet], [])[0]).toEqual({ sheet, status: "unobserved" });
});
it("does not conflate STD and DX or override conflicting IDs", () => {
  expect(joinCatalogRecords([sheet], [{ ...score, type: "std" }])[0].status).toBe("unobserved");
  expect(joinCatalogRecords([sheet], [{ ...score, chartId: "other" }])[0].status).toBe("unobserved");
  expect(joinCatalogRecords([sheet], [{ ...score, chartId: "one", difficulty: "expert" }])[0].status).toBe("ambiguous");
});
it("withholds ambiguous legacy names and duplicate score IDs", () => {
  expect(joinCatalogRecords([sheet, { ...sheet, sheetId: "two" }], [score]).every(r => r.status === "ambiguous")).toBe(true);
  expect(joinCatalogRecords([sheet], [{ ...score, chartId: "one" }, { ...score, chartId: "one" }])[0].status).toBe("ambiguous");
});
