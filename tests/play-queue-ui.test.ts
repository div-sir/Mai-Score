import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PlayQueuePanel from "../studio/app/play-queue";
import CatalogPanel from "../studio/app/catalog";
import ChartDetail from "../studio/app/chart-detail";
import { emptyQueue, parseQueue, QUEUE_KEY } from "../studio/lib/play-queue";
import type { StudioData } from "../studio/lib/types";

let dom: JSDOM;
let root: Root;
let host: HTMLDivElement;
const record = { title: "Test song", type: "dx" as const, difficulty: "master" as const, displayedLevel: "14", achievementRate: 99 };
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
afterEach(async () => { await act(async () => root.unmount()); dom.window.close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render() { await act(async () => root.render(React.createElement(PlayQueuePanel, { records: [record], language: "en" }))); }
it("loads catalog on demand and requires explicit International comparison", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ schema: "mai-score/catalog/v1", region: "intl", source: { sheets: 1, updateTime: "2026-08-09" }, sheets: [{ sheetId: "one", songId: "one", title: record.title, type: "dx", difficulty: "master", level: "14", internalLevelValue: 14, version: "A" }] }) });
  vi.stubGlobal("fetch", fetcher);
  await act(async () => root.render(React.createElement(CatalogPanel, { records: [record], language: "en" })));
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(host.textContent).toContain("Test song");
  expect(host.textContent).not.toContain("99.0000%");
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  expect(host.textContent).toContain("99.0000%");
  expect(host.textContent).toContain("1Below target");
  const range = [...host.querySelectorAll("select")].find(s => [...s.options].some(o => o.value === "below-target"))!;
  await act(async () => { range.value = "below-target"; range.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  expect(host.querySelectorAll("li")).toHaveLength(1);
  await act(async () => host.querySelector<HTMLButtonElement>("li button")!.click());
  expect(host.textContent).toContain("Needs explicit B15/B35 eligibility");
  await act(async () => { range.value = "unobserved"; range.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  expect(host.querySelectorAll("li")).toHaveLength(0);
});
it("reports unavailable catalog without fabricating charts", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  await act(async () => root.render(React.createElement(CatalogPanel, { records: [], language: "en" })));
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(host.querySelector('[role="alert"]')!.textContent).toContain("Load failed");
  expect(host.querySelectorAll("li")).toHaveLength(0);
});
it("filters the International catalog by chart constant", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    schema: "mai-score/catalog/v1", region: "intl",
    source: { sheets: 2, updateTime: "2026-09-09" },
    sheets: [
      { sheetId: "high", songId: "high", title: "High constant", type: "dx", difficulty: "master", level: "13+", internalLevelValue: 13.7, version: "A" },
      { sheetId: "low", songId: "low", title: "Low constant", type: "std", difficulty: "expert", level: "12", internalLevelValue: 12, version: "B" }
    ]
  }) }));
  await act(async () => root.render(React.createElement(CatalogPanel, { records: [], language: "en" })));
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  const constant = host.querySelector<HTMLSelectElement>('select[aria-label="Chart constant"]')!;
  await act(async () => { constant.value = "13.7"; constant.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  expect(host.textContent).toContain("High constant");
  expect(host.textContent).not.toContain("Low constant");
  expect(host.textContent).toContain("13.7");
});
it("opens collected sibling difficulties and labels saved best observations", async () => {
  const sibling = { ...record, difficulty: "expert" as const, displayedLevel: "12", achievementRate: 100.5 };
  const otherType = { ...record, type: "std" as const, difficulty: "expert" as const, achievementRate: 100 };
  const history = [{ generatedAt: "2026-08-01T00:00:00.000Z", savedAt: "2026-08-01T00:01:00.000Z", source: "test", language: "en" as const, playerName: "P", officialRating: 0, b50Rating: 290, records: [{ ...record, chartRating: 290, bucket: "b15" as const }] }];
  await act(async () => root.render(React.createElement(ChartDetail, { record, records: [record, sibling, otherType], history, language: "en" })));
  const details = host.querySelector("details")!;
  await act(async () => { Object.defineProperty(details, "open", { configurable: true, value: true }); details.dispatchEvent(new dom.window.Event("toggle")); });
  expect(host.textContent).toContain("MASTERLv 1499.0000%");
  expect(host.textContent).toContain("EXPERTLv 12100.5000%");
  expect(host.textContent).not.toContain("100.0000%");
  expect(host.textContent).toContain("Observed best history");
  expect(host.textContent).toContain("99.0000%290 RA");
});
async function submit() { await act(async () => host.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))); }
async function selectChart() {
  const select = host.querySelector("select")!;
  await act(async () => { select.value = select.options[1].value; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
}
it("saves, edits, removes and reloads a browser-local goal", async () => {
  await render();
  await selectChart();
  await submit();
  expect(parseQueue(localStorage.getItem(QUEUE_KEY)).goals).toHaveLength(1);
  expect(host.textContent).toContain("Saved in this browser");
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(host.querySelectorAll("li")).toHaveLength(1);
  const buttons = host.querySelector("li")!.querySelectorAll("button");
  await act(async () => buttons[0].click());
  expect(host.querySelector("select")!.value).toBe(JSON.stringify(["Test song", "dx", "master"]));
  await submit();
  expect(parseQueue(localStorage.getItem(QUEUE_KEY)).goals).toHaveLength(1);
  await act(async () => buttons[1].click());
  expect(parseQueue(localStorage.getItem(QUEUE_KEY))).toEqual(emptyQueue());
});
it("preserves malformed data and disables writes", async () => {
  localStorage.setItem(QUEUE_KEY, "broken-json");
  await render();
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  expect(host.textContent).toContain("Cannot read or save");
  expect(localStorage.getItem(QUEUE_KEY)).toBe("broken-json");
});
it("reports quota failure without displaying a saved goal", async () => {
  await render();
  await selectChart();
  vi.spyOn(dom.window.Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota"); });
  await submit();
  expect(host.textContent).toContain("Cannot read or save");
  expect(host.textContent).not.toContain("Saved in this browser");
  expect(host.querySelectorAll("li")).toHaveLength(0);
});
it("preserves another tab's goal when saving", async () => {
  await render();
  localStorage.setItem(QUEUE_KEY, JSON.stringify({ ...emptyQueue(), goals: [{ chartKey: "another-chart", target: 100, note: "other tab" }] }));
  await selectChart();
  await submit();
  expect(parseQueue(localStorage.getItem(QUEUE_KEY)).goals).toHaveLength(2);
});

it("switches plate progress to a clearly labelled MASTER-only view", async () => {
  const { default: RecordsDashboard } = await import("../studio/app/records");
  const master = { ...record, title: "Master target", version: "A", internalLevelValue: 14, comboFlag: "fc" as const };
  const expert = { ...record, title: "Expert target", difficulty: "expert" as const, version: "A", internalLevelValue: 13.7 };
  const data: StudioData = {
    schema: "mai-score/v1", exportedAt: "2026-09-09T00:00:00.000Z",
    player: { name: "P", title: "", rating: 0 }, records: [], fullRecords: [master, expert],
    versionTotals: [{ version: "A", basic: 1, advanced: 1, expert: 1, master: 1, remaster: 0 }],
    plateProgress: [
      { kind: "kiwami", version: "A", completed: 1, total: 4 },
      { kind: "shou", version: "A", completed: 0, total: 4 },
      { kind: "kami", version: "A", completed: 0, total: 4 },
      { kind: "maimai", version: "A", completed: 0, total: 4 }
    ],
    b15Rating: 0, b35Rating: 0, b50Rating: 0
  };
  await act(async () => root.render(React.createElement(RecordsDashboard, { data, assets: { covers: {} }, history: [], language: "en" })));
  const constant = host.querySelector<HTMLSelectElement>('.records-filters select[aria-label="Constant"]')!;
  await act(async () => { constant.value = "14"; constant.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  const completionGrid = host.querySelector(".completion-grid")!;
  expect(completionGrid.textContent).toContain("Master targetDX · MASTER · 14 · 14.0");
  expect(completionGrid.textContent).not.toContain("Expert target");
  expect(host.querySelector(".plate-grid")!.textContent).toContain("1 / 4");
  const toggle = host.querySelector<HTMLInputElement>(".plate-master-only input")!;
  await act(async () => toggle.click());
  expect(host.querySelector(".plate-grid")!.textContent).toContain("1 / 1");
  expect(host.textContent).toContain("actual plates still require BASIC–MASTER");
});

it("opens an export chart with a +1 target and history, then clears it on close", async () => {
  const { default: B50Preview } = await import('../studio/app/b50-preview');
  const { renderStudioSvg } = await import('../studio/lib/render');
  const { DEFAULT_OPTIONS } = await import('../studio/lib/types');
  const chart = { ...record, internalLevelValue: 14, achievementRate: 99, chartRating: 291, imageName: 'test-cover', bucket: 'b15' as const };
  const data = { schema:'mai-score/v1', exportedAt:'2026-09-07T00:00:00Z', player:{name:'Test',title:'',rating:291}, records:[chart], b15Rating:291,b35Rating:0,b50Rating:291 };
  const assets = { covers: { 'test-cover': 'data:image/png;base64,AA==' } };
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  await act(async () => root.render(React.createElement(B50Preview, {data,assets,history:[],language:'en',rendered:renderStudioSvg(data,DEFAULT_OPTIONS,'en'),previewUrl:'data:image/svg+xml,<svg/>'})));
  await act(async () => host.querySelector<HTMLButtonElement>('.b50-chart-hit')!.click());
  expect(host.querySelector('dialog')!.open).toBe(true);
  expect(host.textContent).toContain('At least +1 Rating');
  expect(host.querySelector('.achievement-orbit')).not.toBeNull();
  expect(host.querySelector('.b50-dialog-hero .upgrade-cover img')?.getAttribute('src')).toBe(assets.covers['test-cover']);
  expect(host.querySelectorAll('.b50-target-grid article').length).toBeGreaterThan(0);
  expect(host.textContent).toContain('Observed best history');
  expect(host.textContent).toContain('This does not mean it was unplayed');
  await act(async () => { const dialog = host.querySelector('dialog')!; dialog.open=false; dialog.dispatchEvent(new dom.window.Event('close')); });
  expect(host.querySelector('#b50-chart-title')).toBeNull();
});
