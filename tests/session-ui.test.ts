import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SessionDashboard from "../studio/app/session";
import type { StudioData } from "../studio/lib/types";

let dom: JSDOM;
let root: Root;
let host: HTMLDivElement;

const data = (): StudioData => {
  const records = Array.from({ length: 50 }, (_, index) => ({
    title: `B50 ${index}`, type: "dx" as const, difficulty: "master" as const,
    displayedLevel: "13+", internalLevelValue: 13.7,
    achievementRate: index === 0 ? 100.2 : 100.5, chartRating: 300,
    bucket: index < 15 ? "b15" as const : "b35" as const
  }));
  return {
    schema: "mai-score/v1", exportedAt: "2026-09-18T21:00:00.000Z",
    player: { name: "TEST", title: "", rating: 15000 }, records,
    fullRecords: records,
    recentPlays: [{
      ...records[0], playedAt: "2026-09-18T20:30", track: 1,
      newAchievement: true, newDxScore: false
    }],
    b15Rating: 4500, b35Rating: 10500, b50Rating: 15000
  };
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

it("renders session metrics, coaching, and share actions", async () => {
  await act(async () => root.render(React.createElement(SessionDashboard, {
    data: data(), assets: { covers: {} }, history: [], language: "en", onStatus: vi.fn()
  })));
  expect(host.textContent).toContain("Play session");
  expect(host.textContent).toContain("Session highlights");
  expect(host.textContent).toContain("Weakness prescription");
  expect(host.textContent).toContain("B50 0");
  expect([...host.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
    "Download card", "Share card"
  ]);
});

it("explains how to enable sessions for an older snapshot", async () => {
  const old = data();
  delete old.recentPlays;
  await act(async () => root.render(React.createElement(SessionDashboard, {
    data: old, assets: { covers: {} }, history: [], language: "en", onStatus: vi.fn()
  })));
  expect(host.textContent).toContain("no recent-play data");
  expect(host.querySelectorAll("button")).toHaveLength(0);
});
