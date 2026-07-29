import { type HistoryEntry, sortHistory, toHistoryEntry } from "./history";
import { mergeHistories } from "./history-sync";
import type { LanguageId, StudioAssets, StudioData } from "./types";

const DB_NAME = "mai-score-studio";
const DB_VERSION = 2;
const STORE_NAME = "snapshots";
const HISTORY_STORE = "history";
const LATEST_KEY = "latest";

export interface StudioSnapshot {
  data: StudioData;
  assets: StudioAssets;
  source: string;
  generatedAt: string;
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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage."));
  });
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
