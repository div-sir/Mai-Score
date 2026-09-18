import { describe, expect, it } from "vitest";
import { decideAutoSync } from "./auto-sync";
import type { HistoryEntry } from "./history";
import type { StudioData } from "./types";

const data = { exportedAt: "2026-09-18T12:00:00.000Z" } as StudioData;
const history = [{ generatedAt: data.exportedAt }] as HistoryEntry[];

describe("one-click Studio auto sync", () => {
  it("waits until the transferred snapshot is safely in local history", () => {
    expect(decideAutoSync(data.exportedAt, data, [], "connected", false)).toBe("wait");
    expect(decideAutoSync(data.exportedAt, data, history, "checking", false)).toBe("wait");
  });

  it("syncs an imported snapshot only when Drive is already connected", () => {
    expect(decideAutoSync(data.exportedAt, data, history, "connected", false)).toBe("sync");
    expect(decideAutoSync(data.exportedAt, data, history, "disconnected", false)).toBe("local-only");
    expect(decideAutoSync(data.exportedAt, data, history, "unavailable", false)).toBe("local-only");
  });
});
