import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import KonamiPagesDashboard from "../studio/app/konami-pages";
import RhythmRecordsDashboard from "../studio/app/rhythm-records";
import type { KonamiPageSnapshot } from "../studio/lib/konami-page";
import type { RhythmRecordEnvelope } from "../src/lib/rhythm-record";

const pageSnapshot = (game: KonamiPageSnapshot["source"]["game"]): KonamiPageSnapshot => ({
  schema: "mai-score/konami-page-snapshot/v1",
  generatedAt: "2026-09-27T12:00:00.000Z",
  source: { game, connectionId: `${game}-pages`, startUrl: "https://p.eagate.573.jp/game/ddr/ddrworld/playdata/index.html", region: "jp", pageLimit: 40 },
  pages: [], summary: { collected: 0, paid: 0, signInRequired: 0, failed: 0, fields: 0, tables: 0 }
});

describe("game-specific Studio dashboards", () => {
  it("shows the DDR Flare panel only for DDR page collections", () => {
    const ddr = renderToStaticMarkup(React.createElement(KonamiPagesDashboard, { data: pageSnapshot("dance-dance-revolution"), language: "zh-Hant" }));
    const iidx = renderToStaticMarkup(React.createElement(KonamiPagesDashboard, { data: pageSnapshot("beatmania-iidx"), language: "zh-Hant" }));
    expect(ddr).toContain("算分曲與升分門檻");
    expect(ddr).toContain("Flare Skill 對象曲頁面");
    expect(iidx).not.toContain("算分曲與升分門檻");
  });

  it("uses DDR result fields instead of IIDX/SDVX labels", () => {
    const data: RhythmRecordEnvelope = {
      schema: "mai-score/rhythm-record/v1", generatedAt: "2026-09-27T12:00:00.000Z",
      source: { game: "dance-dance-revolution", connectionId: "ddr" },
      records: [{
        recordId: "song-sp", song: { id: "song", title: "Song" },
        chart: { id: "song-sp", type: "SINGLE", difficulty: "CHALLENGE", level: "18" },
        result: { rawScore: 990000, rating: { system: "ddr-flare-skill", value: 145 } },
        gameSpecific: { flareRank: "EX", playStyle: "SINGLE" }
      }]
    };
    const html = renderToStaticMarkup(React.createElement(RhythmRecordsDashboard, { data, language: "en" }));
    expect(html).toContain("Flare Skill");
    expect(html).toContain("Flare / gauge");
    expect(html).toContain("Score insights");
    expect(html).toContain("Target score");
    expect(html).toContain("SINGLE");
  });

  it("adds Best 50 and VF Potential only to the SDVX dashboard", () => {
    const data: RhythmRecordEnvelope = {
      schema: "mai-score/rhythm-record/v1", generatedAt: "2026-09-27T12:00:00.000Z",
      source: { game: "sound-voltex", connectionId: "sdvx" },
      records: [{ recordId: "song-exh", song: { id: "song", title: "Song" }, chart: { id: "song-exh", difficulty: "EXHAUST", level: "18.3", levelValue: 18.3 }, result: { rawScore: 9923042, grade: "S", clearStatus: "EXCESSIVE RATE CLEAR" } }]
    };
    const html = renderToStaticMarkup(React.createElement(RhythmRecordsDashboard, { data, language: "en" }));
    expect(html).toContain("VOLFORCE Best 50");
    expect(html).toContain("VF Potential");
    expect(html).toContain("0.388");
  });
});
