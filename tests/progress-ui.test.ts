import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ProgressDashboard from "../studio/app/progress";
import type { HistoryEntry } from "../studio/lib/history";
import type { StudioData, StudioRecord } from "../studio/lib/types";

let dom: JSDOM;
let root: Root;
let host: HTMLDivElement;

const record: StudioRecord = {
  title: "Target", type: "dx", difficulty: "master", displayedLevel: "13+",
  internalLevelValue: 13.7, achievementRate: 100.1, bucket: "b15", chartRating: 296
};
const historyEntry = (generatedAt: string, chartRating: number): HistoryEntry => ({
  generatedAt, savedAt: generatedAt, source: "test", language: "en", playerName: "P",
  officialRating: chartRating, b50Rating: chartRating,
  records: [{ ...record, chartRating }]
});
const data: StudioData = {
  schema: "mai-score/v1", exportedAt: "2026-10-02T00:00:00.000Z",
  player: { name: "P", title: "", rating: 297 }, records: [record],
  b15Rating: 296, b35Rating: 0, b50Rating: 296
};

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://studio.example" });
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("localStorage", dom.window.localStorage);
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("deletes the selected timeline point and keeps a zero To 100% gain placeholder", async () => {
  const onDeleteHistoryPoint = vi.fn().mockResolvedValue(undefined);
  await act(async () => root.render(React.createElement(ProgressDashboard, {
    data, assets: { covers: {} }, language: "en", onDeleteHistoryPoint,
    history: [
      historyEntry("2026-10-02T00:00:00.000Z", 296),
      historyEntry("2026-10-01T00:00:00.000Z", 295)
    ]
  })));

  expect([...host.querySelectorAll(".action-tabs button")].map((button) => button.textContent)).not.toContain("What-if");

  await act(async () => host.querySelector<HTMLButtonElement>(".timeline-point-actions button")!.click());
  expect(onDeleteHistoryPoint).toHaveBeenCalledWith("2026-10-02T00:00:00.000Z");

  const easyGains = [...host.querySelectorAll<HTMLButtonElement>(".action-tabs button")]
    .find((button) => button.textContent === "Easy gains")!;
  await act(async () => easyGains.click());
  const zeroGain = host.querySelector<HTMLElement>(".upgrade-list .zero-gain")!;
  expect(zeroGain.textContent).toBe("+0");
  expect(zeroGain.classList.contains("zero-gain")).toBe(true);
});
