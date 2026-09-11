import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FullRecordRecommendationsPanel, RatingPlannerPanel } from "../studio/app/rating-planner";
import type { StudioData, StudioRecord } from "../studio/lib/types";

let dom: JSDOM;
let root: Root;
let host: HTMLDivElement;

const b50Record = (index: number, bucket: "b15" | "b35"): StudioRecord => ({
  title: `${bucket}-${index}`, type: "dx", difficulty: "master", displayedLevel: "10",
  internalLevelValue: 10, achievementRate: 100.5, chartRating: bucket === "b15" ? 210 : 205,
  version: bucket === "b15" ? "Current" : "Old", bucket
});

function data(): StudioData {
  const records = [
    ...Array.from({ length: 15 }, (_, index) => b50Record(index, "b15")),
    ...Array.from({ length: 35 }, (_, index) => b50Record(index, "b35"))
  ];
  return {
    schema: "mai-score/v1", exportedAt: "2026-09-11T00:00:00.000Z",
    player: { name: "TEST", title: "", rating: 10_325 }, records,
    fullRecords: [...records, { title: "Outside opportunity", type: "dx", difficulty: "master", displayedLevel: "10+", internalLevelValue: 10.7, achievementRate: 99.9, version: "Old" }],
    b15Rating: 3_150, b35Rating: 7_175, b50Rating: 10_325
  };
}

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>");
  vi.stubGlobal("window", dom.window); vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount()); dom.window.close(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it("renders a target Rating plan with additive score targets", async () => {
  await act(async () => root.render(React.createElement(RatingPlannerPanel, { data: data(), assets: { covers: {} }, language: "en" })));
  expect(host.textContent).toContain("Target Rating planner");
  expect(host.textContent).toContain("Outside opportunity");
  expect(host.textContent).toContain("99.9000% → 100.5000%");
  expect(host.querySelector<HTMLInputElement>('input[type="number"]')!.min).toBe("10325");
});

it("labels recommendations from outside the current B50", async () => {
  await act(async () => root.render(React.createElement(FullRecordRecommendationsPanel, { data: data(), assets: { covers: {} }, language: "en" })));
  expect(host.textContent).toContain("Full Records all-chart gains");
  expect(host.textContent).toContain("Outside opportunity");
  expect(host.textContent).toContain("Outside B50");
});
