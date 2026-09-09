import { describe, expect, it } from "vitest";
import { PLATE_DIFFICULTIES, PLATE_RULES, buildPlateProgress } from "../studio/lib/plates";
import type { StudioChartRecord, VersionChartTotals } from "../studio/lib/types";

const chart = (overrides: Partial<StudioChartRecord> = {}): StudioChartRecord => ({
  title: "Aurora Signal",
  type: "dx",
  difficulty: "master",
  displayedLevel: "13+",
  achievementRate: 99,
  version: "PRiSM",
  ...overrides
});

const totals = (overrides: Partial<VersionChartTotals> = {}): VersionChartTotals => ({
  version: "PRiSM",
  basic: 1,
  advanced: 1,
  expert: 1,
  master: 1,
  remaster: 1,
  ...overrides
});

const find = (progress: ReturnType<typeof buildPlateProgress>, kind: string, version = "PRiSM") =>
  progress.find((entry) => entry.kind === kind && entry.version === version);

describe("plate rules", () => {
  it("counts BASIC through MASTER and leaves Re:MASTER out of the denominator", () => {
    // The community sources this table came from agree the four skill plates
    // span BASIC–MASTER. If that is ever corrected, this is the assertion that
    // should change first, and the totals below say why: a version with one
    // chart per difficulty gives four, not five.
    expect(PLATE_DIFFICULTIES).toEqual(["basic", "advanced", "expert", "master"]);
    const progress = buildPlateProgress([chart()], [totals()]);
    expect(progress.every((entry) => entry.total === 4)).toBe(true);
  });

  it("covers exactly the four plate kinds the Progress panel renders", () => {
    expect(PLATE_RULES.map((rule) => rule.kind).sort())
      .toEqual(["kami", "kiwami", "maimai", "shou"]);
  });

  it.each([
    ["shou", chart({ achievementRate: 100 }), chart({ achievementRate: 99.9999 })],
    ["kiwami", chart({ comboFlag: "fc" }), chart({})],
    ["kami", chart({ comboFlag: "ap" }), chart({ comboFlag: "fc+" })],
    ["maimai", chart({ syncFlag: "fsd" }), chart({ syncFlag: "fs+" })]
  ])("counts a chart toward %s only when it meets that plate's bar", (kind, meets, misses) => {
    expect(find(buildPlateProgress([meets], [totals()]), kind)?.completed).toBe(1);
    expect(find(buildPlateProgress([misses], [totals()]), kind)?.completed).toBe(0);
  });

  it("treats AP as satisfying the full-combo plate, since it is a stronger lamp", () => {
    expect(find(buildPlateProgress([chart({ comboFlag: "ap+" })], [totals()]), "kiwami")?.completed).toBe(1);
  });

  it("accepts FDX and FSD as the same lamp", () => {
    // DX NET reports the DX-era FDX spelling and the older FSD spelling for
    // what the 舞舞 plate treats as one thing.
    for (const syncFlag of ["fsd", "fsd+", "fdx", "fdx+"] as const) {
      expect(find(buildPlateProgress([chart({ syncFlag })], [totals()]), "maimai")?.completed).toBe(1);
    }
    for (const syncFlag of ["fs", "fs+"] as const) {
      expect(find(buildPlateProgress([chart({ syncFlag })], [totals()]), "maimai")?.completed).toBe(0);
    }
  });

  it("ignores a Re:MASTER clear rather than counting it as progress", () => {
    const progress = buildPlateProgress([chart({ difficulty: "remaster", comboFlag: "ap" })], [totals()]);
    expect(progress).toEqual([]);
  });

  it("takes the denominator from the catalog, not from what was played", () => {
    // The whole point of shipping version totals: someone who has played four
    // charts of a 400-chart version must not see 100%.
    const progress = buildPlateProgress(
      [chart({ difficulty: "basic", comboFlag: "ap" })],
      [totals({ basic: 100, advanced: 100, expert: 100, master: 100 })]
    );
    expect(find(progress, "kiwami")).toMatchObject({ completed: 1, total: 400 });
  });

  it("can calculate a MASTER-only practice view without changing the plate rules", () => {
    const progress = buildPlateProgress([
      chart({ difficulty: "basic" }),
      chart({ difficulty: "master", comboFlag: "fc" })
    ], [totals({ basic: 20, advanced: 20, expert: 20, master: 30 })], ["master"]);
    expect(find(progress, "kiwami")).toMatchObject({ completed: 1, total: 30 });
  });

  it("omits a version whose totals are unknown instead of flattering it", () => {
    expect(buildPlateProgress([chart({ version: "CiRCLE" })], [totals()])).toEqual([]);
  });

  it("reports nothing without Full Records or without totals", () => {
    expect(buildPlateProgress(undefined, [totals()])).toEqual([]);
    expect(buildPlateProgress([chart()], undefined)).toEqual([]);
    expect(buildPlateProgress([], [totals()])).toEqual([]);
  });

  it("keeps versions independent", () => {
    const progress = buildPlateProgress(
      [chart({ version: "PRiSM", comboFlag: "ap" }), chart({ version: "BUDDiES" })],
      [totals(), totals({ version: "BUDDiES" })]
    );
    expect(find(progress, "kami", "PRiSM")?.completed).toBe(1);
    expect(find(progress, "kami", "BUDDiES")?.completed).toBe(0);
  });
});
