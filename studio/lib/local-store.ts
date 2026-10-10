import { type HistoryEntry, sortHistory, toHistoryEntry } from "./history";
import { mergeHistories } from "./history-sync";
import type { LanguageId, StudioAssets, StudioData } from "./types";
import type { RhythmRecordEnvelope } from "../../src/lib/rhythm-record";
import type { KonamiPageSnapshot, KonamiPageGame } from "./konami-page";
import { rhythmRecordFromKonamiPages } from "./rhythm-insights";

const DB_NAME = "mai-score-studio";
const DB_VERSION = 4;
const STORE_NAME = "snapshots";
const HISTORY_STORE = "history";
const GAME_STORE = "game-data";
const GAME_HISTORY_STORE = "game-history";
const LATEST_KEY = "latest";
const MAX_GAME_HISTORY = 12;

export interface StudioSnapshot {
  data: StudioData;
  assets: StudioAssets;
  source: string;
  generatedAt: string;
  language: LanguageId;
  savedAt: string;
}

export type ExternalGameDataset = {
  game: KonamiPageGame;
  kind: "rhythm-record";
  data: RhythmRecordEnvelope;
  source: string;
  language: LanguageId;
  savedAt: string;
} | {
  game: KonamiPageGame;
  kind: "konami-pages";
  data: KonamiPageSnapshot;
  source: string;
  language: LanguageId;
  savedAt: string;
};

type WithoutSavedAt<T> = T extends unknown ? Omit<T, "savedAt"> : never;
export type ExternalGameDatasetInput = WithoutSavedAt<ExternalGameDataset>;

export interface ExternalGameHistoryEntry {
  key: string;
  game: KonamiPageGame;
  data: RhythmRecordEnvelope;
  source: string;
  language: LanguageId;
  savedAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
      // Added in v2. Existing users keep their latest snapshot and simply
      // start accumulating history from their next collection.
      if (!database.objectStoreNames.contains(HISTORY_STORE)) {
        database.createObjectStore(HISTORY_STORE, { keyPath: "generatedAt" });
      }
      if (!database.objectStoreNames.contains(GAME_STORE)) {
        database.createObjectStore(GAME_STORE, { keyPath: "game" });
      }
      if (!database.objectStoreNames.contains(GAME_HISTORY_STORE)) {
        database.createObjectStore(GAME_HISTORY_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage."));
  });
}

export async function saveExternalGameDataset(
  dataset: ExternalGameDatasetInput
): Promise<ExternalGameDataset> {
  const database = await openDatabase();
  try {
    const saved = { ...dataset, savedAt: new Date().toISOString() } as ExternalGameDataset;
    const historyData = dataset.kind === "rhythm-record" ? dataset.data : rhythmRecordFromKonamiPages(dataset.data);
    const keepsHistory = historyData.records.length > 0;
    const stores = keepsHistory ? [GAME_STORE, GAME_HISTORY_STORE] : [GAME_STORE];
    const transaction = database.transaction(stores, "readwrite");
    transaction.objectStore(GAME_STORE).put(saved);
    if (keepsHistory) {
      const historyStore = transaction.objectStore(GAME_HISTORY_STORE);
      const key = `${saved.game}\u0000${historyData.generatedAt}`;
      historyStore.put({ key, game: saved.game, data: historyData, source: saved.source, language: saved.language, savedAt: saved.savedAt } satisfies ExternalGameHistoryEntry);
      const historyRequest = historyStore.getAll();
      await new Promise<void>((resolve, reject) => {
        historyRequest.onsuccess = () => {
          const obsolete = (historyRequest.result as ExternalGameHistoryEntry[])
            .filter((entry) => entry.game === saved.game)
            .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
            .slice(MAX_GAME_HISTORY);
          for (const entry of obsolete) historyStore.delete(entry.key);
          resolve();
        };
        historyRequest.onerror = () => reject(historyRequest.error ?? new Error("Could not prune saved game history."));
      });
    }
    await complete(transaction);
    return saved;
  } finally {
    database.close();
  }
}

export async function listExternalGameHistory(game?: ExternalGameDataset["game"]): Promise<ExternalGameHistoryEntry[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(GAME_HISTORY_STORE, "readonly");
    const request = transaction.objectStore(GAME_HISTORY_STORE).getAll();
    const result = await new Promise<ExternalGameHistoryEntry[]>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as ExternalGameHistoryEntry[]) ?? []);
      request.onerror = () => reject(request.error ?? new Error("Could not read saved game history."));
    });
    await complete(transaction);
    return result.filter((entry) => !game || entry.game === game)
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  } finally {
    database.close();
  }
}

export async function listExternalGameDatasets(): Promise<ExternalGameDataset[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(GAME_STORE, "readonly");
    const request = transaction.objectStore(GAME_STORE).getAll();
    const result = await new Promise<ExternalGameDataset[]>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as ExternalGameDataset[]) ?? []);
      request.onerror = () => reject(request.error ?? new Error("Could not read saved game data."));
    });
    await complete(transaction);
    return result.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  } finally {
    database.close();
  }
}

export async function clearExternalGameDatasets(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([GAME_STORE, GAME_HISTORY_STORE], "readwrite");
    transaction.objectStore(GAME_STORE).clear();
    transaction.objectStore(GAME_HISTORY_STORE).clear();
    await complete(transaction);
  } finally {
    database.close();
  }
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Local storage transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Local storage transaction was cancelled."));
  });
}

export async function loadStudioSnapshot(): Promise<StudioSnapshot | undefined> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(LATEST_KEY);
    const result = await new Promise<StudioSnapshot | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StudioSnapshot | undefined);
      request.onerror = () => reject(request.error ?? new Error("Could not read local data."));
    });
    await complete(transaction);
    return result;
  } finally {
    database.close();
  }
}

export async function saveStudioSnapshot(snapshot: Omit<StudioSnapshot, "savedAt">): Promise<void> {
  const database = await openDatabase();
  try {
    const savedAt = new Date().toISOString();
    // Both stores in one transaction: a snapshot and its point on the timeline
    // commit together or not at all.
    const transaction = database.transaction([STORE_NAME, HISTORY_STORE], "readwrite");
    transaction.objectStore(STORE_NAME).put(
      { ...snapshot, savedAt } satisfies StudioSnapshot,
      LATEST_KEY
    );
    transaction.objectStore(HISTORY_STORE).put(
      toHistoryEntry(snapshot.data, snapshot.source, snapshot.language, savedAt)
    );
    await complete(transaction);
  } finally {
    database.close();
  }
}

/**
 * Updates the currently previewed snapshot without creating or replacing a
 * history point. Drive sync already merged the authoritative history first.
 */
export async function saveStudioSnapshotOnly(
  snapshot: Omit<StudioSnapshot, "savedAt">
): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(
      { ...snapshot, savedAt: new Date().toISOString() } satisfies StudioSnapshot,
      LATEST_KEY
    );
    await complete(transaction);
  } finally {
    database.close();
  }
}

export async function appendStudioHistory(entry: HistoryEntry): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE, "readwrite");
    // Keyed on generatedAt, so re-opening the same collection overwrites its
    // own entry rather than adding a duplicate point to the timeline.
    transaction.objectStore(HISTORY_STORE).put(entry);
    await complete(transaction);
  } finally {
    database.close();
  }
}

export async function listStudioHistory(): Promise<HistoryEntry[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE, "readonly");
    const request = transaction.objectStore(HISTORY_STORE).getAll();
    const result = await new Promise<HistoryEntry[]>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as HistoryEntry[]) ?? []);
      request.onerror = () => reject(request.error ?? new Error("Could not read local history."));
    });
    await complete(transaction);
    return sortHistory(result);
  } finally {
    database.close();
  }
}

/**
 * Folds incoming entries into the local history and returns the result.
 * Read and write share one transaction so a collection saved mid-merge
 * cannot be silently overwritten by a stale snapshot of the store.
 */
export async function mergeStudioHistory(incoming: readonly HistoryEntry[]): Promise<HistoryEntry[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE, "readwrite");
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.getAll();
    const existing = await new Promise<HistoryEntry[]>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as HistoryEntry[]) ?? []);
      request.onerror = () => reject(request.error ?? new Error("Could not read local history."));
    });

    const merged = mergeHistories(existing, incoming);
    for (const entry of merged) store.put(entry);
    await complete(transaction);
    return merged;
  } finally {
    database.close();
  }
}

export async function clearStudioHistory(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE, "readwrite");
    transaction.objectStore(HISTORY_STORE).clear();
    await complete(transaction);
  } finally {
    database.close();
  }
}

export async function deleteStudioHistoryEntry(generatedAt: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(HISTORY_STORE, "readwrite");
    transaction.objectStore(HISTORY_STORE).delete(generatedAt);
    await complete(transaction);
  } finally {
    database.close();
  }
}

export async function clearStudioSnapshot(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(LATEST_KEY);
    await complete(transaction);
  } finally {
    database.close();
  }
}
