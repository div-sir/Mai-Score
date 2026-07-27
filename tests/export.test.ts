import { describe, expect, it } from "vitest";
import { toDxratingJson, toRhythmRecordJson } from "../src/lib/export";
import type { CollectionResult } from "../src/lib/types";

it("exports dxrating-compatible B50 entries only", () => {
  const result = {
    schema: "mai-score/v1", exportedAt: "", source: "", player: { name: "P", title: "", rating: 0 },
    b15Rating: 0, b35Rating: 0, b50Rating: 0, warnings: [],
    records: [
      { title: "A", type: "dx", difficulty: "expert", displayedLevel: "12", achievementRate: 100, bucket: "b15", sheetId: "A__dxrt__dx__dxrt__expert" },
      { title: "?", type: "std", difficulty: "master", displayedLevel: "13", achievementRate: 99, bucket: "b35", warning: "missing" }
    ]
  } satisfies CollectionResult;
  expect(JSON.parse(toDxratingJson(result))).toEqual([{ sheetId: "A__dxrt__dx__dxrt__expert", achievementRate: 100 }]);

  const rhythmRecord = JSON.parse(toRhythmRecordJson(result));
  expect(rhythmRecord).toMatchObject({
    schema: "mai-score/rhythm-record/v1",
    source: { game: "maimai-dx", connectionId: "dxnet-intl", region: "intl" },
    player: { displayName: "P", rating: 0 },
    summaries: [{ system: "best50", value: 0, groups: { b15: 0, b35: 0 } }]
  });
  expect(rhythmRecord.records).toHaveLength(2);
  expect(rhythmRecord.records[0]).toMatchObject({
    song: { id: "A", title: "A" },
    chart: { id: "A__dxrt__dx__dxrt__expert", difficulty: "expert" },
    result: { achievementRate: 100 },
    grouping: { bucket: "b15", rank: 1 }
  });
});
