import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  collectKonamiPages,
  extractKonamiPage,
  isKonamiPageSnapshot,
  konamiPageGameForUrl
} from "../src/lib/konami-page";

const documentOf = (html: string, url = "https://p.eagate.573.jp/game/ddr/ddrworld/playdata/index.html") =>
  new JSDOM(html, { url }).window.document;

describe("KONAMI readable page collection", () => {
  it("detects supported game pages without accepting lookalike hosts", () => {
    expect(konamiPageGameForUrl("https://p.eagate.573.jp/game/ddr/ddrworld/playdata/")).toBe("dance-dance-revolution");
    expect(konamiPageGameForUrl("https://p.eagate.573.jp/game/sdvx/vii/playdata/")).toBe("sound-voltex");
    expect(konamiPageGameForUrl("https://p.eagate.573.jp/game/2dx/33/djdata/")).toBe("beatmania-iidx");
    expect(konamiPageGameForUrl("https://p.eagate.573.jp.example.com/game/ddr/ddrworld/playdata/")).toBeUndefined();
  });

  it("extracts fields, tables, headings, and visible content", () => {
    const page = extractKonamiPage(documentOf(`<!doctype html><title>Status</title><main>
      <h1>プロフィール</h1><dl><dt>DANCER NAME</dt><dd>SOMI</dd></dl>
      <table><tr><th>曲名</th><th>スコア</th></tr><tr><td>Test Song</td><td>987,650</td></tr></table>
      <p>最終プレー日時 2026-09-20</p></main>`), "https://p.eagate.573.jp/game/ddr/ddrworld/playdata/index.html");
    expect(page).toMatchObject({
      access: "collected",
      title: "Status",
      headings: ["プロフィール"],
      fields: [{ label: "DANCER NAME", value: "SOMI" }],
      tables: [{ headers: ["曲名", "スコア"], rows: [["Test Song", "987,650"]] }]
    });
    expect(page.text).toContain("最終プレー日時 2026-09-20");
  });

  it("crawls only the current game's data area and reports restricted pages", async () => {
    const startUrl = "https://p.eagate.573.jp/game/ddr/ddrworld/playdata/index.html";
    const start = documentOf(`<main><h1>Status</h1>
      <a href="music.html">Music</a><a href="/game/ddr/ddrworld/news.html">News</a>
      <a href="https://example.com/steal">External</a></main>`, startUrl);
    const requested: string[] = [];
    const snapshot = await collectKonamiPages(start, startUrl, async (url) => {
      requested.push(url);
      return "<!doctype html><title>Music</title><main><p>このサービスはe-amusement ベーシックコースの加入が必要です｡</p></main>";
    }, (html) => documentOf(html), 10);
    expect(requested).toEqual(["https://p.eagate.573.jp/game/ddr/ddrworld/playdata/music.html"]);
    expect(snapshot.summary).toMatchObject({ collected: 1, paid: 1, signInRequired: 0, failed: 0 });
    expect(isKonamiPageSnapshot(snapshot)).toBe(true);
  });
});
