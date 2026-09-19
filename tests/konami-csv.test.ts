import { describe, expect, it } from "vitest";
import { detectKonamiCsvGame, parseKonamiCsv } from "../src/lib/konami-csv";

describe("KONAMI official CSV import", () => {
  it("parses long-form SOUND VOLTEX rows and quoted titles", () => {
    const csv = [
      "楽曲名,アーティスト,難易度,レベル,スコア,グレード,クリアメダル",
      '"Song, One",Artist,EXH,17,"9,876,543",AAA+,ULTIMATE CHAIN',
      "Unplayed,Artist,NOV,3,0,D,NO PLAY"
    ].join("\n");
    const result = parseKonamiCsv(csv, "sdvx_score.csv");
    expect(result.source).toMatchObject({ game: "sound-voltex", connectionId: "sdvx-konami" });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      song: { title: "Song, One", artist: "Artist" },
      chart: { difficulty: "EXHAUST", level: "17" },
      result: { rawScore: 9876543, grade: "AAA+", clearStatus: "ULTIMATE CHAIN" }
    });
  });

  it("parses wide IIDX SP/DP columns", () => {
    const csv = [
      "バージョン,タイトル,アーティスト,プレー回数,SP NORMAL レベル,SP NORMAL EXスコア,SP NORMAL DJ LEVEL,SP NORMAL クリアタイプ,SP NORMAL ミスカウント,DP HYPER レベル,DP HYPER EXスコア",
      "33,Test Song,DJ TEST,4,7,1234,A,HARD CLEAR,12,10,1800"
    ].join("\n");
    const result = parseKonamiCsv(csv, "iidx_score.csv");
    expect(result.source.game).toBe("beatmania-iidx");
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      chart: { type: "SP", difficulty: "NORMAL", level: "7" },
      result: { rawScore: 1234, grade: "A", clearStatus: "HARD CLEAR", missCount: 12 },
      gameSpecific: { version: "33", playCount: 4 }
    });
    expect(result.records[1]).toMatchObject({ chart: { type: "DP", difficulty: "HYPER" }, result: { rawScore: 1800 } });
  });

  it("detects games and gives a useful failure for unrelated files", () => {
    expect(detectKonamiCsvGame("TITLE,SP NORMAL EX SCORE", "scores.csv")).toBe("beatmania-iidx");
    expect(detectKonamiCsvGame("楽曲名,MAXIMUM SCORE", "scores.csv")).toBe("sound-voltex");
    expect(() => detectKonamiCsvGame("name,value\na,b", "other.csv")).toThrow(/identify/);
  });
});
