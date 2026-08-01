import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "../studio/lib/history";
import {
  HISTORY_SYNC_SCHEMA,
  mergeHistories,
  mergeSettings,
  parseSyncDocument,
  serializeSyncDocument,
  type SyncedSettings
} from "../studio/lib/history-sync";
import { DEFAULT_OPTIONS } from "../studio/lib/types";

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  generatedAt: "2026-07-01T00:00:00.000Z",
  savedAt: "2026-07-01T00:00:00.000Z",
  source: "extension",
  language: "en",
  playerName: "DIV",
  officialRating: 14000,
  b50Rating: 14000,
  records: [],
  ...overrides
});

const ids = (entries: HistoryEntry[]) => entries.map((e) => e.generatedAt);

describe("history sync document", () => {
  it("round-trips through serialize and parse", () => {
    const entries = [entry({ generatedAt: "2026-07-01T00:00:00.000Z" }), entry({ generatedAt: "2026-07-08T00:00:00.000Z" })];
    const parsed = parseSyncDocument(serializeSyncDocument(entries));
    expect(parsed.skipped).toBe(0);
    expect(ids(parsed.entries).sort()).toEqual(ids(entries).sort());
  });

  it("writes the schema tag so a future format change is detectable", () => {
    expect(JSON.parse(serializeSyncDocument([])).schema).toBe(HISTORY_SYNC_SCHEMA);
  });

  it("refuses a document it cannot safely read", () => {
    expect(() => parseSyncDocument("not json")).toThrow(/valid JSON/);
    expect(() => parseSyncDocument("[]")).toThrow(/not an object|no entries/);
    expect(() => parseSyncDocument(JSON.stringify({ schema: "something/else", entries: [] }))).toThrow(/Unsupported/);
    expect(() => parseSyncDocument(JSON.stringify({ schema: HISTORY_SYNC_SCHEMA }))).toThrow(/entries array/);
  });

  it("keeps the good entries and counts the bad ones instead of losing everything", () => {
    // One corrupt row in a synced file should not wipe a real history.
    const parsed = parseSyncDocument(JSON.stringify({
      schema: HISTORY_SYNC_SCHEMA,
      entries: [entry(), { generatedAt: 42 }, null, entry({ generatedAt: "2026-07-08T00:00:00.000Z" })]
    }));
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.skipped).toBe(2);
  });
});

describe("merging two histories", () => {
  it("unions collections that only one side has", () => {
    const local = [entry({ generatedAt: "2026-07-01T00:00:00.000Z" })];
    const remote = [entry({ generatedAt: "2026-07-08T00:00:00.000Z" })];
    expect(ids(mergeHistories(local, remote))).toEqual([
      "2026-07-08T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z"
    ]);
  });

  it("keeps one copy of a collection both sides already have", () => {
    const shared = entry();
    expect(mergeHistories([shared], [{ ...shared }])).toHaveLength(1);
  });

  it("prefers the later save when the same collection differs", () => {
    // A re-save usually means it was resolved against a newer chart database,
    // so the newer resolution is the better one to keep.
    const older = entry({ savedAt: "2026-07-01T00:00:00.000Z", b50Rating: 13900 });
    const newer = entry({ savedAt: "2026-07-09T00:00:00.000Z", b50Rating: 14000 });
    expect(mergeHistories([older], [newer])[0].b50Rating).toBe(14000);
    expect(mergeHistories([newer], [older])[0].b50Rating).toBe(14000);
  });

  it("is commutative, including when saves collide exactly", () => {
    // Without a content-derived tiebreak, two devices would each prefer their
    // own copy and re-push forever.
    const a = entry({ savedAt: "2026-07-01T00:00:00.000Z", b50Rating: 14000 });
    const b = entry({ savedAt: "2026-07-01T00:00:00.000Z", b50Rating: 14001 });
    expect(mergeHistories([a], [b])).toEqual(mergeHistories([b], [a]));
  });

  it("is idempotent — re-merging its own output changes nothing", () => {
    const local = [entry({ generatedAt: "2026-07-01T00:00:00.000Z" }), entry({ generatedAt: "2026-07-08T00:00:00.000Z" })];
    const remote = [entry({ generatedAt: "2026-07-08T00:00:00.000Z", savedAt: "2026-07-10T00:00:00.000Z" })];
    const once = mergeHistories(local, remote);
    expect(mergeHistories(once, remote)).toEqual(once);
    expect(mergeHistories(once, once)).toEqual(once);
  });

  it("is associative, so sync order across three devices does not matter", () => {
    const a = [entry({ generatedAt: "2026-07-01T00:00:00.000Z" })];
    const b = [entry({ generatedAt: "2026-07-08T00:00:00.000Z", savedAt: "2026-07-08T00:00:00.000Z" })];
    const c = [entry({ generatedAt: "2026-07-08T00:00:00.000Z", savedAt: "2026-07-09T00:00:00.000Z", b50Rating: 14500 })];
    expect(mergeHistories(mergeHistories(a, b), c)).toEqual(mergeHistories(a, mergeHistories(b, c)));
  });

  it("does not depend on JSON key order when breaking a tie", () => {
    // Entries arriving from Drive are re-parsed, so their key order can differ
    // from the locally built ones even when the content is identical.
    const local = entry({ savedAt: "2026-07-01T00:00:00.000Z", b50Rating: 14000, officialRating: 14000 });
    const reordered = JSON.parse(JSON.stringify({
      records: [], b50Rating: 14000, officialRating: 14000, playerName: "DIV",
      language: "en", source: "extension",
      savedAt: "2026-07-01T00:00:00.000Z", generatedAt: "2026-07-01T00:00:00.000Z"
    })) as HistoryEntry;

    expect(mergeHistories([local], [reordered])).toHaveLength(1);
    expect(mergeHistories([local], [reordered])).toEqual(mergeHistories([reordered], [local]));
  });

  it("handles an empty side without losing the other", () => {
    const local = [entry()];
    expect(mergeHistories(local, [])).toEqual(local);
    expect(mergeHistories([], local)).toEqual(local);
    expect(mergeHistories([], [])).toEqual([]);
  });

  it("preserves the full timeline, which progress tracking depends on", () => {
    const weekly = Array.from({ length: 12 }, (_, i) =>
      entry({ generatedAt: `2026-0${1 + Math.floor(i / 4)}-0${(i % 4) + 1}T00:00:00.000Z`, b50Rating: 14000 + i * 10 }));
    const merged = mergeHistories(weekly.slice(0, 6), weekly.slice(4));
    expect(merged).toHaveLength(12);
    // Newest first, so a timeline can be read straight off the result.
    expect(merged[0].generatedAt > merged[merged.length - 1].generatedAt).toBe(true);
  });
});

const settings = (overrides: Partial<SyncedSettings> = {}): SyncedSettings => ({
  updatedAt: "2026-07-01T00:00:00.000Z",
  language: "en",
  options: DEFAULT_OPTIONS,
  ...overrides
});

describe("synced settings", () => {
  it("round-trips watermark, style, and language through the document", () => {
    const mine = settings({
      language: "zh-Hant",
      options: { ...DEFAULT_OPTIONS, watermark: "@div", accent: "#123456", accentScope: "full" }
    });
    const parsed = parseSyncDocument(serializeSyncDocument([entry()], mine));
    expect(parsed.settings).toEqual(mine);
  });

  it("leaves settings absent on a document written before they existed", () => {
    expect(parseSyncDocument(serializeSyncDocument([entry()])).settings).toBeUndefined();
  });

  it("is readable by a document reader that only wants entries", () => {
    // The added key must not change the schema, or older Studio builds would
    // reject the whole file and report an unsupported format.
    const document = JSON.parse(serializeSyncDocument([entry()], settings()));
    expect(document.schema).toBe(HISTORY_SYNC_SCHEMA);
    expect(document.entries).toHaveLength(1);
  });

  it("ignores a settings block with no timestamp to merge on", () => {
    const document = JSON.parse(serializeSyncDocument([entry()], settings()));
    delete document.settings.updatedAt;
    expect(parseSyncDocument(JSON.stringify(document)).settings).toBeUndefined();
  });

  it("repairs unusable fields instead of discarding the whole block", () => {
    const document = JSON.parse(serializeSyncDocument([entry()], settings()));
    document.settings.language = "kl";
    document.settings.options.accent = "not-a-colour";
    const parsed = parseSyncDocument(JSON.stringify(document));
    expect(parsed.settings).toMatchObject({
      language: "en",
      options: expect.objectContaining({ accent: DEFAULT_OPTIONS.accent })
    });
  });

  it("takes the later edit", () => {
    const older = settings({ updatedAt: "2026-07-01T00:00:00.000Z" });
    const newer = settings({ updatedAt: "2026-07-09T00:00:00.000Z", language: "ja" });
    expect(mergeSettings(older, newer)).toBe(newer);
    expect(mergeSettings(newer, older)).toBe(newer);
  });

  it("takes whichever side exists when the other has none", () => {
    const mine = settings();
    expect(mergeSettings(mine, undefined)).toBe(mine);
    expect(mergeSettings(undefined, mine)).toBe(mine);
    expect(mergeSettings(undefined, undefined)).toBeUndefined();
  });

  it("agrees on a winner when two devices saved in the same millisecond", () => {
    // Without a content tiebreak each device would keep preferring its own
    // copy and re-push it forever.
    const left = settings({ language: "ja" });
    const right = settings({ language: "zh-Hant" });
    expect(mergeSettings(left, right)).toBe(mergeSettings(right, left));
  });

  it("is idempotent and associative", () => {
    const a = settings({ updatedAt: "2026-07-01T00:00:00.000Z" });
    const b = settings({ updatedAt: "2026-07-05T00:00:00.000Z", language: "ja" });
    const c = settings({ updatedAt: "2026-07-03T00:00:00.000Z", language: "zh-Hant" });
    expect(mergeSettings(a, a)).toBe(a);
    expect(mergeSettings(mergeSettings(a, b), c)).toEqual(mergeSettings(a, mergeSettings(b, c)));
  });
});
