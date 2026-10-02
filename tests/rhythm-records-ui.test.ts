import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RhythmRecordsDashboard from "../studio/app/rhythm-records";
import type { RhythmRecordEnvelope } from "../src/lib/rhythm-record";

let dom: JSDOM;
let root: Root;
let host: HTMLDivElement;

const data: RhythmRecordEnvelope = {
  schema: "mai-score/rhythm-record/v1",
  generatedAt: "2026-09-28T00:00:00Z",
  source: { game: "sound-voltex", connectionId: "test" },
  records: Array.from({ length: 61 }, (_, index) => ({
    recordId: `record-${index}`,
    song: { id: `song-${index}`, title: `Song ${index}` },
    chart: { id: `chart-${index}`, difficulty: "EXHAUST", level: "18", levelValue: 18 },
    result: { rawScore: 9_000_000 + index, grade: "A", clearStatus: "CLEAR" }
  }))
};

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://studio.example" });
  vi.stubGlobal("window", dom.window); vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("navigator", dom.window.navigator); vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount()); dom.window.close(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it("paginates large record sets and switches to the compact table", async () => {
  await act(async () => root.render(React.createElement(RhythmRecordsDashboard, { data, language: "en" })));
  expect(host.querySelectorAll(".rhythm-record-grid article")).toHaveLength(60);
  expect(host.textContent).toContain("1 not shown");

  const compact = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Compact table")!;
  await act(async () => compact.click());
  expect(host.querySelectorAll(".rhythm-table tbody tr")).toHaveLength(60);
  expect(compact.getAttribute("aria-pressed")).toBe("true");

  const more = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Show more"))!;
  await act(async () => more.click());
  expect(host.querySelectorAll(".rhythm-table tbody tr")).toHaveLength(61);
  expect(host.textContent).not.toContain("not shown");
});

it("applies the IIDX workbench style and level to the full record filters", async () => {
  const iidx: RhythmRecordEnvelope = {
    ...data,
    source: { game: "beatmania-iidx", connectionId: "test" },
    records: [
      { recordId: "spa", song: { id: "a", title: "SP A" }, chart: { id: "spa", type: "SP", difficulty: "ANOTHER", level: "12", levelValue: 12 }, result: { rawScore: 2200, grade: "AAA", clearStatus: "HARD CLEAR" } },
      { recordId: "sph", song: { id: "b", title: "SP H" }, chart: { id: "sph", type: "SP", difficulty: "HYPER", level: "12", levelValue: 12 }, result: { rawScore: 1800, grade: "A", clearStatus: "FAILED" } },
      { recordId: "dpa", song: { id: "c", title: "DP A" }, chart: { id: "dpa", type: "DP", difficulty: "ANOTHER", level: "11", levelValue: 11 }, result: { rawScore: 1900, grade: "AA", clearStatus: "CLEAR" } }
    ]
  };
  await act(async () => root.render(React.createElement(RhythmRecordsDashboard, { data: iidx, language: "en" })));
  const filter = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Show in records")!;
  await act(async () => filter.click());
  expect(host.querySelector<HTMLSelectElement>('select[aria-label="All styles"]')?.value).toBe("SP");
  expect(host.querySelector<HTMLSelectElement>('select[aria-label="All levels"]')?.value).toBe("12");
  expect(host.querySelectorAll(".rhythm-record-grid article")).toHaveLength(2);
});
