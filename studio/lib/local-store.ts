import type { LanguageId, StudioAssets, StudioData } from "./types";

const DB_NAME = "mai-score-studio";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
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
