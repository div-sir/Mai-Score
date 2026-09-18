import { sortHistory, type HistoryEntry } from "./history";
import {
  normalizeLanguage,
  normalizeStudioOptions,
  type LanguageId,
  type StudioChartRecord,
  type StudioOptions
} from "./types";

export const HISTORY_SYNC_SCHEMA = "mai-score/history-sync/v2";
const LEGACY_HISTORY_SYNC_SCHEMA = "mai-score/history-sync/v1";

export interface SyncedSettings {
  updatedAt: string;
  language: LanguageId;
  options: StudioOptions;
}

interface EncodedHistoryEntry extends Omit<HistoryEntry, "fullRecords"> {
  fullRecordRefs?: number[];
}

export interface HistorySyncDocument {
  schema: typeof HISTORY_SYNC_SCHEMA;
  entries: EncodedHistoryEntry[];
  fullRecordPool: StudioChartRecord[];
  settings?: SyncedSettings;
}

export interface ParsedSyncDocument {
  entries: HistoryEntry[];
  skipped: number;
  settings?: SyncedSettings;
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<HistoryEntry>;
  return typeof entry.generatedAt === "string"
    && entry.generatedAt.length > 0
    && typeof entry.savedAt === "string"
    && typeof entry.playerName === "string"
    && typeof entry.officialRating === "number"
    && typeof entry.b50Rating === "number"
    && Array.isArray(entry.records)
    && (entry.recentPlays === undefined || (Array.isArray(entry.recentPlays)
      && entry.recentPlays.every((play) => isRecentPlay(play))));
}

function isRecentPlay(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const play = value as Record<string, unknown>;
  return typeof play.title === "string"
    && (play.type === "std" || play.type === "dx")
    && ["basic", "advanced", "expert", "master", "remaster"].includes(String(play.difficulty))
    && typeof play.achievementRate === "number"
    && typeof play.playedAt === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(play.playedAt);
}

function isFullRecord(value: unknown): value is StudioChartRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<StudioChartRecord>;
  return typeof record.title === "string"
    && (record.type === "std" || record.type === "dx")
    && ["basic", "advanced", "expert", "master", "remaster"].includes(String(record.difficulty))
    && typeof record.displayedLevel === "string"
    && typeof record.achievementRate === "number"
    && Number.isFinite(record.achievementRate);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function rank(entry: HistoryEntry): string {
  // Prefer the complete copy even when a newer client re-saved the same
  // collection without Full Records, then use the established tie-breakers.
  return `${entry.fullRecords !== undefined ? 1 : 0}\u0000${entry.savedAt}\u0000${canonical(entry)}`;
}

export function parseSyncedSettings(value: unknown): SyncedSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const settings = value as Partial<SyncedSettings>;
  if (typeof settings.updatedAt !== "string" || !settings.updatedAt) return undefined;
  return {
    updatedAt: settings.updatedAt,
    language: normalizeLanguage(settings.language),
    options: normalizeStudioOptions(settings.options)
  };
}

export function mergeSettings(
  left: SyncedSettings | undefined,
  right: SyncedSettings | undefined
): SyncedSettings | undefined {
  if (!left) return right;
  if (!right) return left;
  if (left.updatedAt !== right.updatedAt) return left.updatedAt > right.updatedAt ? left : right;
  return canonical(left) >= canonical(right) ? left : right;
}

export function createSyncDocument(
  entries: readonly HistoryEntry[],
  settings?: SyncedSettings
): HistorySyncDocument {
  const fullRecordPool: StudioChartRecord[] = [];
  const pooled = new Map<string, number>();
  const encoded = sortHistory(entries).map(({ fullRecords, ...entry }): EncodedHistoryEntry => {
    if (fullRecords === undefined) return entry;
    const fullRecordRefs = fullRecords.map(record => {
      const identity = canonical(record);
      const existing = pooled.get(identity);
      if (existing !== undefined) return existing;
      const index = fullRecordPool.length;
      pooled.set(identity, index);
      fullRecordPool.push({ ...record });
      return index;
    });
    return { ...entry, fullRecordRefs };
  });
  return {
    schema: HISTORY_SYNC_SCHEMA,
    entries: encoded,
    fullRecordPool,
    ...(settings ? { settings } : {})
  };
}

export function serializeSyncDocument(
  entries: readonly HistoryEntry[],
  settings?: SyncedSettings
): string {
  return JSON.stringify(createSyncDocument(entries, settings));
}

/** Reads compact v2 documents and existing v1 documents. */
export function parseSyncDocument(text: string): ParsedSyncDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("The synced history file is not valid JSON.");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("The synced history file is not an object.");
  }

  const document = raw as { schema?: unknown; entries?: unknown; fullRecordPool?: unknown; settings?: unknown };
  if (document.schema !== HISTORY_SYNC_SCHEMA && document.schema !== LEGACY_HISTORY_SYNC_SCHEMA) {
    throw new Error(`Unsupported synced history format: ${String(document.schema)}`);
  }
  if (!Array.isArray(document.entries)) throw new Error("The synced history file has no entries array.");

  const pool = document.schema === HISTORY_SYNC_SCHEMA ? document.fullRecordPool : undefined;
  if (document.schema === HISTORY_SYNC_SCHEMA && !Array.isArray(pool)) {
    throw new Error("The synced history file has no Full Records pool.");
  }

  const entries: HistoryEntry[] = [];
  let skipped = 0;
  for (const value of document.entries) {
    if (!isHistoryEntry(value)) {
      skipped += 1;
      continue;
    }
    if (document.schema === LEGACY_HISTORY_SYNC_SCHEMA) {
      if (value.fullRecords !== undefined && (!Array.isArray(value.fullRecords) || !value.fullRecords.every(isFullRecord))) {
        skipped += 1;
        continue;
      }
      entries.push(value);
      continue;
    }

    const encoded = value as HistoryEntry & { fullRecordRefs?: unknown };
    if (encoded.fullRecords !== undefined) {
      skipped += 1;
      continue;
    }
    if (encoded.fullRecordRefs === undefined) {
      const { fullRecordRefs: _, fullRecords: __, ...entry } = encoded;
      entries.push(entry);
      continue;
    }
    if (!Array.isArray(encoded.fullRecordRefs)) {
      skipped += 1;
      continue;
    }
    const fullRecords: StudioChartRecord[] = [];
    let valid = true;
    for (const reference of encoded.fullRecordRefs) {
      const record = Number.isInteger(reference) && Number(reference) >= 0 && Array.isArray(pool)
        ? pool[Number(reference)]
        : undefined;
      if (!isFullRecord(record)) {
        valid = false;
        break;
      }
      fullRecords.push({ ...record });
    }
    if (!valid) {
      skipped += 1;
      continue;
    }
    const { fullRecordRefs: _, fullRecords: __, ...entry } = encoded;
    entries.push({ ...entry, fullRecords });
  }

  const settings = parseSyncedSettings(document.settings);
  return { entries, skipped, ...(settings ? { settings } : {}) };
}

export function mergeHistories(
  left: readonly HistoryEntry[],
  right: readonly HistoryEntry[]
): HistoryEntry[] {
  const merged = new Map<string, HistoryEntry>();
  for (const entry of [...left, ...right]) {
    const existing = merged.get(entry.generatedAt);
    if (!existing || rank(entry) > rank(existing)) merged.set(entry.generatedAt, entry);
  }
  return sortHistory([...merged.values()]);
}
