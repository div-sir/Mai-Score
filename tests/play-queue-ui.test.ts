import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PlayQueuePanel from "../studio/app/play-queue";
import CatalogPanel from "../studio/app/catalog";
import { emptyQueue, parseQueue, QUEUE_KEY } from "../studio/lib/play-queue";

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
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ schema: "mai-score/catalog/v1", region: "intl", source: { sheets: 1, updateTime: "2026-08-09" }, sheets: [{ sheetId: "one", songId: "one", title: record.title, type: "dx", difficulty: "master", level: "14", version: "A" }] }) });
  vi.stubGlobal("fetch", fetcher);
  await act(async () => root.render(React.createElement(CatalogPanel, { records: [record], language: "en" })));
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(host.textContent).toContain("Test song");
  expect(host.textContent).not.toContain("99.0000%");
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  expect(host.textContent).toContain("99.0000%");
  expect(host.textContent).toContain("Below target: 1");
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
