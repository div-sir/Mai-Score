import { describe, expect, it } from "vitest";
import {
  konamiChartCandidates,
  konamiDataTables,
  konamiTableCsv,
  parseKonamiNumber
} from "../studio/lib/konami-analysis";
import type { KonamiPageSnapshot } from "../studio/lib/konami-page";

const snapshot = (headers: string[], rows: string[][]): KonamiPageSnapshot => ({
  schema: "mai-score/konami-page-snapshot/v1",
  generatedAt: "2026-09-26T12:00:00.000Z",
  source: {
    game: "dance-dance-revolution",
    connectionId: "ddr-konami-page",
    startUrl: "https://p.eagate.573.jp/game/ddr/ddrworld/playdata/music.html",
    region: "jp",
    pageLimit: 40
  },
  pages: [{
    url: "https://p.eagate.573.jp/game/ddr/ddrworld/playdata/music.html",
    title: "DDR Music Data",
    access: "collected",
    headings: ["楽曲データ"],
    fields: [],
    tables: [{ caption: "Recent scores", headers, rows }],
    text: []
  }],
  summary: { collected: 1, paid: 0, signInRequired: 0, failed: 0, fields: 0, tables: 1 }
});

describe("KONAMI page data analysis", () => {
  it("parses localized numeric values without interpreting dates", () => {
    expect(parseKonamiNumber("９８７，６５０")).toBe(987650);
    expect(parseKonamiNumber("98.765%" )).toBe(98.765);
    expect(parseKonamiNumber("Lv 18")).toBe(18);
    expect(parseKonamiNumber("2026/09/26")).toBeUndefined();
    expect(parseKonamiNumber("AAA+")).toBeUndefined();
  });

  it("normalizes collected tables and creates chart candidates for numeric columns", () => {
    const data = snapshot(["曲名", "難易度", "スコア", "達成率"], [
      ["Song A", "EXPERT", "987,650", "98.765%"],
      ["Song B", "CHALLENGE", "999,120", "99.912%"],
      ["Song C", "DIFFICULT", "950,000", "95.000%"]
    ]);
    const tables = konamiDataTables(data);
    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({ title: "Recent scores", headers: ["曲名", "難易度", "スコア", "達成率"] });
    const charts = konamiChartCandidates(data);
    expect(charts.map((chart) => chart.valueLabel)).toEqual(["スコア", "達成率"]);
    expect(charts[0].categoryLabel).toBe("曲名");
    expect(charts[0].points[0]).toEqual({ label: "Song A", value: 987650 });
    expect(charts[1].format).toBe("percent");
  });

  it("does not invent a chart when every column is numeric and exports valid CSV", () => {
    const data = snapshot(["Rank", "Score"], [["1", "999"], ["2", "888"]]);
    expect(konamiChartCandidates(data)).toEqual([]);
    const table = konamiDataTables(snapshot(["Song", "Note"], [["A, B", "He said \"Hi\""]]))[0];
    expect(konamiTableCsv(table)).toBe('Song,Note\r\n"A, B","He said ""Hi"""');
  });
});
