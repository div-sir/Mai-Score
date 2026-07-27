import { describe, expect, it } from "vitest";
import { toDxratingJson } from "../src/lib/export";
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
});
