import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { RHYTHM_RECORD_SCHEMA, toRhythmRecord } from "../src/lib/rhythm-record";
import type { CollectionResult } from "../src/lib/types";

const syntheticResult: CollectionResult = {
  schema: "mai-score/v1",
  exportedAt: "2026-01-01T00:00:00.000Z",
  source: "https://maimaidx-eng.com/maimai-mobile/home/ratingTargetMusic/",
  connection: { id: "dxnet-intl", protocolVersion: 1 },
  player: { name: "TEST PLAYER", title: "TEST TITLE", rating: 0 },
  records: [{
    title: "TEST SONG",
    type: "dx",
    difficulty: "master",
    displayedLevel: "1",
    achievementRate: 0,
    bucket: "b15",
    songId: "test-song",
    sheetId: "test-song__dxrt__dx__dxrt__master",
    internalLevelValue: 1,
    chartRating: 0
  }],
  b15Rating: 0,
  b35Rating: 0,
  b50Rating: 0,
  warnings: []
};

describe("Rhythm Record v1", () => {
  it("normalizes a maimai collection without service credentials", () => {
    const exported = toRhythmRecord(syntheticResult);
    expect(exported.schema).toBe(RHYTHM_RECORD_SCHEMA);
    expect(exported.source.game).toBe("maimai-dx");
    expect(exported.records[0]).toMatchObject({
      recordId: "test-song__dxrt__dx__dxrt__master__1",
      song: { id: "test-song", title: "TEST SONG" },
      result: {
        achievementRate: 0,
        rating: { value: 0, system: "maimai-dx-rating" }
      }
    });
    expect(JSON.stringify(exported)).not.toMatch(/cookie|password|authorization/i);
  });

  it("reserves stable game IDs in the machine-readable schema", async () => {
    const schema = JSON.parse(await readFile("schemas/rhythm-record-v1.schema.json", "utf8"));
    expect(schema.properties.schema.const).toBe(RHYTHM_RECORD_SCHEMA);
    expect(schema.$defs.source.properties.game.enum).toEqual([
      "maimai-dx",
      "popn-music",
      "sound-voltex",
      "dance-dance-revolution"
    ]);
  });
});
