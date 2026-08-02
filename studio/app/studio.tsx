"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import ProgressDashboard from "./progress";
import { renderStudioSvg } from "../lib/render";
import { studioCopy } from "../lib/i18n";
import {
  clearStudioHistory,
  clearStudioSnapshot,
  listStudioHistory,
  loadStudioSnapshot,
  mergeStudioHistory,
  saveStudioSnapshot,
  saveStudioSnapshotOnly
} from "../lib/local-store";
import { chartKey, diffHistory, fromHistoryEntry, type HistoryEntry } from "../lib/history";
import { recordBadgeNames } from "../lib/achievement-rank";
import {
  mergeSettings,
  parseSyncDocument,
  serializeSyncDocument,
  type SyncedSettings
} from "../lib/history-sync";
import {
  connectGoogleDriveWeb,
  deleteFromDrive,
  disconnectGoogleDrive,
  driveAuthorizationUrl,
  driveConnectionStatus,
  pullFromDrive,
  pushToDrive,
  rememberExtensionId,
  webDriveConfigured
} from "../lib/drive-provider";
import {
  DEFAULT_OPTIONS,
  normalizeLanguage,
  normalizeStudioOptions,
  type LanguageId,
  type StudioAssets,
  type StudioData,
  type StudioOptions,
  type StudioRecord
} from "../lib/types";

const STORAGE_KEY = "mai-score-studio-options-v1";
const UI_THEME_KEY = "mai-score-studio-ui-theme";
type DriveUiState = "unavailable" | "checking" | "disconnected" | "connected";
type UiTheme = "dark" | "light";
type StudioView = "export" | "progress";
const PLATE_KINDS = new Set(["kiwami", "shou", "kami", "maimai"]);

const ACCENT_PRESETS = [
  { name: "Champagne", value: "#b89b72" },
  { name: "Sage", value: "#789486" },
  { name: "Slate", value: "#7489a6" },
  { name: "Rose", value: "#aa7c82" },
  { name: "Plum", value: "#8d7898" },
  { name: "Copper", value: "#ad7654" }
] as const;

type ExtensionResponse =
  | { ok: true; data: unknown; assets?: StudioAssets; language?: LanguageId }
  | { ok: false; error: string }
  | undefined;

function parsePlateProgress(value: unknown): StudioData["plateProgress"] {
  if (!Array.isArray(value)) return undefined;
  const entries = value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const entry = candidate as Record<string, unknown>;
    const completed = Number(entry.completed);
    const total = Number(entry.total);
    if (!PLATE_KINDS.has(String(entry.kind))
      || !Number.isInteger(completed)
      || !Number.isInteger(total)
      || completed < 0
      || total < completed) return [];
    return [{
      kind: String(entry.kind) as "kiwami" | "shou" | "kami" | "maimai",
      ...(typeof entry.version === "string" && entry.version.trim()
        ? { version: entry.version.trim().slice(0, 48) }
        : {}),
      completed,
      total
    }];
  });
  return entries.length ? entries : undefined;
}

interface ExternalRuntime {
  lastError?: { message?: string };
  sendMessage(
    extensionId: string,
    message: unknown,
    callback: (response: ExtensionResponse) => void
  ): void;
}

function parseMaiScore(input: unknown): StudioData {
  if (!input || typeof input !== "object") throw new Error("The JSON root must be an object.");
  const value = input as Record<string, unknown>;

  if (value.schema === "mai-score/rhythm-record/v1") {
    const source = value.source as { game?: string } | undefined;
    if (source?.game !== "maimai-dx") throw new Error("B50 preview currently supports only maimai-dx Rhythm Record files.");
    const player = value.player as { displayName?: string; title?: string; rating?: number } | undefined;
    const universalRecords = Array.isArray(value.records) ? value.records : [];
    const records: StudioRecord[] = universalRecords.map((entry) => {
      const record = entry as Record<string, any>;
      return {
        title: String(record.song?.title ?? "Unknown"),
        type: record.chart?.type === "std" ? "std" : "dx",
        difficulty: ["basic", "advanced", "expert", "master", "remaster"].includes(record.chart?.difficulty)
          ? record.chart.difficulty
          : "master",
        displayedLevel: String(record.chart?.level ?? "?"),
        internalLevelValue: Number.isFinite(Number(record.chart?.levelValue))
          ? Number(record.chart.levelValue)
          : undefined,
        achievementRate: Number(record.result?.achievementRate ?? 0),
        bucket: record.grouping?.bucket === "b15" ? "b15" : "b35",
        chartRating: Number(record.result?.rating?.value ?? 0),
        imageName: record.song?.jacketId ? String(record.song.jacketId) : undefined,
        comboFlag: ["fc", "fc+", "ap", "ap+"].includes(record.gameSpecific?.comboFlag)
          ? record.gameSpecific.comboFlag
          : undefined,
        syncFlag: ["fs", "fs+", "fsd", "fsd+"].includes(record.gameSpecific?.syncFlag)
          ? record.gameSpecific.syncFlag
          : undefined
      };
    });
    const summaries = Array.isArray(value.summaries) ? value.summaries as Array<Record<string, any>> : [];
    const summary = summaries.find((item) => item.system === "best50");
    const plateSummary = summaries.find((item) => item.system === "maimai-plate-progress");
    return normalizeB50({
      schema: String(value.schema),
      exportedAt: String(value.generatedAt ?? new Date().toISOString()),
      source: typeof (value.source as { url?: unknown } | undefined)?.url === "string"
        ? String((value.source as { url?: unknown }).url)
        : undefined,
      player: {
        name: String(player?.displayName ?? "PLAYER"),
        title: String(player?.title ?? ""),
        rating: Number(player?.rating ?? 0)
      },
      records,
      b15Rating: Number(summary?.groups?.b15 ?? 0),
      b35Rating: Number(summary?.groups?.b35 ?? 0),
      b50Rating: Number(summary?.value ?? 0),
      plateProgress: parsePlateProgress(plateSummary?.entries)
    });
  }

  const player = value.player as StudioData["player"] | undefined;
  const records = value.records;
  if (!player || !Array.isArray(records)) throw new Error("Missing player or records. Select a Mai-Score full JSON file.");
  if (records.length < 50) throw new Error(`Found ${records.length} records; B50 preview requires 50.`);
  return normalizeB50({
    schema: String(value.schema ?? "mai-score/v1"),
    exportedAt: String(value.exportedAt ?? new Date().toISOString()),
    source: typeof value.source === "string" ? value.source : undefined,
    player: {
      name: String(player.name ?? "PLAYER"),
      title: String(player.title ?? ""),
      titleColor: player.titleColor,
      rating: Number(player.rating ?? 0),
      iconUrl: player.iconUrl,
      frameUrl: player.frameUrl,
      plateUrl: player.plateUrl
    },
    records: (records as StudioRecord[]).map((record) => ({
      ...record,
      internalLevelValue: Number.isFinite(Number(record.internalLevelValue))
        ? Number(record.internalLevelValue)
        : undefined
    })),
    b15Rating: Number(value.b15Rating ?? 0),
    b35Rating: Number(value.b35Rating ?? 0),
    b50Rating: Number(value.b50Rating ?? 0),
    plateProgress: parsePlateProgress(value.plateProgress)
  });
}

const chartRatingOf = (record: StudioRecord) =>
  Number.isFinite(Number(record.chartRating)) ? Number(record.chartRating) : 0;

function normalizeB50(data: StudioData): StudioData {
  // Imported files are not required to be in rank order, so take the highest
  // rated charts rather than whichever ones happen to come first.
  const topOf = (bucket: "b15" | "b35", limit: number) => data.records
    .filter((record) => record.bucket === bucket)
    .sort((a, b) => chartRatingOf(b) - chartRatingOf(a))
    .slice(0, limit);
  const b15 = topOf("b15", 15);
  const b35 = topOf("b35", 35);
  if (b15.length !== 15 || b35.length !== 35) {
    throw new Error(`Expected 15 new and 35 old charts, found ${b15.length} and ${b35.length}.`);
  }
  const sum = (records: StudioRecord[]) => records.reduce(
    (total, record) => total + chartRatingOf(record),
    0
  );
  const b15Rating = sum(b15);
  const b35Rating = sum(b35);
  return {
    ...data,
    records: [...b15, ...b35],
    b15Rating,
    b35Rating,
    b50Rating: b15Rating + b35Rating
  };
}

function receiveFromExtension(
  extensionId: string,
  token: string,
  language: LanguageId
): Promise<{ data: unknown; assets: StudioAssets; language: LanguageId }> {
  const copy = studioCopy(language);
  const runtime = (window as unknown as { chrome?: { runtime?: ExternalRuntime } }).chrome?.runtime;
  if (!runtime?.sendMessage) {
    return Promise.reject(new Error(copy.extensionUnavailable));
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(copy.transferTimedOut)), 10000);
    runtime.sendMessage(extensionId, { type: "MAI_SCORE_STUDIO_IMPORT", token }, (response) => {
      window.clearTimeout(timeout);
      const runtimeError = runtime.lastError?.message;
      if (runtimeError) {
        reject(new Error(copy.extensionUnavailable));
      } else if (!response?.ok) {
        reject(new Error(response?.error ?? copy.transferEmpty));
      } else {
        const responseLanguage = response.language === "zh-Hant" || response.language === "ja"
          ? response.language
          : "en";
        resolve({ data: response.data, assets: response.assets ?? { covers: {} }, language: responseLanguage });
      }
    });
  });
}

async function fetchDataUrl(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(`/api/asset?url=${encodeURIComponent(url)}`);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      output[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return output;
}

async function loadPublicAssets(data: StudioData): Promise<StudioAssets> {
  const coverNames = [...new Set(data.records.flatMap((record) => record.imageName ? [record.imageName] : []))];
  const coverPairs = await mapConcurrent(coverNames, 8, async (name) => [
    name,
    await fetchDataUrl(`https://shama.dxrating.net/images/cover/v2/${name}.jpg`)
  ] as const);
  const badgeNames = [...new Set(data.records.flatMap(recordBadgeNames))];
  const badgeBase = data.source && /^https:\/\/maimaidx(?:-eng\.com|\.jp)\//.test(data.source)
    ? data.source
    : "https://maimaidx-eng.com/maimai-mobile/home/ratingTargetMusic/";
  const badgePairs = await mapConcurrent(badgeNames, 8, async (name) => [
    name,
    await fetchDataUrl(new URL(`/maimai-mobile/img/${name}`, badgeBase).href)
  ] as const);
  return {
    covers: Object.fromEntries(
      coverPairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1]))
    ),
    badges: Object.fromEntries(
      badgePairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1]))
    )
  };
}

function safeName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
}

export default function Studio() {
  const [data, setData] = useState<StudioData | null>(null);
  const [assets, setAssets] = useState<StudioAssets>({ covers: {} });
  const [options, setOptions] = useState<StudioOptions>(DEFAULT_OPTIONS);
  const [language, setLanguage] = useState<LanguageId>("en");
  // Stamped only when the person changes something, never when a sync applies
  // an incoming style — otherwise every device would look like the newest one
  // and the merge could never settle.
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState("");
  const [uiTheme, setUiTheme] = useState<UiTheme>("dark");
  const [studioView, setStudioView] = useState<StudioView>("export");
  const [highlightedChartKey, setHighlightedChartKey] = useState("");
  const [exportFormat, setExportFormat] = useState<"png" | "svg">("png");
  const [message, setMessage] = useState(studioCopy("en").emptyMessage);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  // Resolved after mount: navigator is not available while server-rendering.
  const [canShare, setCanShare] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [driveState, setDriveState] = useState<DriveUiState>("unavailable");
  const [syncing, setSyncing] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [disconnectingDrive, setDisconnectingDrive] = useState(false);
  const [deletingCloud, setDeletingCloud] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString());
  const fileRef = useRef<HTMLInputElement>(null);
  const copy = studioCopy(language);
  const copyRef = useRef(copy);
  copyRef.current = copy;

  useEffect(() => {
    let cancelled = false;
    setOrigin(window.location.origin);
    setUiTheme(localStorage.getItem(UI_THEME_KEY) === "light" ? "light" : "dark");
    setGeneratedAt(new Date().toISOString());
    setCanShare(typeof navigator.share === "function" && typeof navigator.canShare === "function");
    listStudioHistory().then((entries) => { if (!cancelled) setHistory(entries); }).catch(() => {});
    const hash = new URLSearchParams(window.location.hash.slice(1));
    let savedLanguage: LanguageId = "en";
    try {
      const preset = hash.get("preset");
      const saved = preset ? JSON.parse(preset) : JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) {
        savedLanguage = normalizeLanguage(saved.language);
        setLanguage(savedLanguage);
        setOptions(normalizeStudioOptions(saved));
        // A shared preset link is somebody else's style, not an edit of your
        // own, so it must not win the next sync against your real devices.
        if (!preset && typeof saved.settingsUpdatedAt === "string") {
          setSettingsUpdatedAt(saved.settingsUpdatedAt);
        }
      }
    } catch {
      setMessage("Saved style could not be read. Defaults were restored.");
    }

    const extensionId = hash.get("extensionId");
    const transfer = hash.get("transfer");
    // The handoff URL is the only place the extension's ID is ever given to
    // Studio; sync happens long after, so keep it.
    if (extensionId) {
      rememberExtensionId(extensionId);
    }
    void refreshDriveState();

    const restoreSavedSnapshot = async (failure?: string): Promise<boolean> => {
      try {
        const stored = await loadStudioSnapshot();
        if (!stored || cancelled) return false;
        const normalized = normalizeB50(stored.data);
        setData(normalized);
        setAssets(stored.assets);
        setSource(stored.source);
        setGeneratedAt(stored.generatedAt);
        setLanguage(stored.language);
        const savedAt = new Date(stored.savedAt).toLocaleString();
        const restoredCopy = studioCopy(stored.language);
        setMessage(failure
          ? restoredCopy.transferFailedRestored(failure, stored.data.player.name, savedAt)
          : restoredCopy.restored(stored.data.player.name, savedAt));
        return true;
      } catch {
        // IndexedDB can be unavailable in restricted browsing modes.
        return false;
      }
    };

    void (async () => {
      if (extensionId && transfer) {
        setMessage(studioCopy(savedLanguage).receiving);
        try {
          const received = await receiveFromExtension(extensionId, transfer, savedLanguage);
          if (cancelled) return;
          const parsed = parseMaiScore(received.data);
          const timestamp = new Date().toISOString();
          setData(parsed);
          setAssets(received.assets);
          setLanguage(received.language);
          setSource("Mai-Score extension");
          setGeneratedAt(timestamp);
          const coverCount = Object.keys(received.assets.covers).length;
          const profileAssetCount = [received.assets.icon, received.assets.frame, received.assets.plate].filter(Boolean).length;
          setMessage(studioCopy(received.language).transferred(
            parsed.player.name,
            parsed.records.length,
            coverCount,
            profileAssetCount
          ));
          try {
            await saveStudioSnapshot({
              data: parsed,
              assets: received.assets,
              source: "Mai-Score extension",
              generatedAt: timestamp,
              language: received.language
            });
            if (!cancelled) setHistory(await listStudioHistory());
          } catch {
            if (!cancelled) setMessage(studioCopy(received.language).localSaveFailed);
          }
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        } catch (error) {
          if (cancelled) return;
          const failure = error instanceof Error ? error.message : String(error);
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
          if (!await restoreSavedSnapshot(failure)) setMessage(failure);
        }
        return;
      }

      await restoreSavedSnapshot();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refreshAfterAuthorization = () => {
      void refreshDriveState();
    };
    window.addEventListener("focus", refreshAfterAuthorization);
    return () => window.removeEventListener("focus", refreshAfterAuthorization);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...options, language, settingsUpdatedAt }));
  }, [options, language, settingsUpdatedAt]);

  useEffect(() => {
    localStorage.setItem(UI_THEME_KEY, uiTheme);
  }, [uiTheme]);

  const rendered = useMemo(
    () => data ? renderStudioSvg(data, options, language, origin, new Date(generatedAt), assets, highlightedChartKey) : null,
    [data, options, language, origin, generatedAt, assets, highlightedChartKey]
  );
  const previewUrl = useMemo(
    () => rendered ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rendered.svg)}` : "",
    [rendered]
  );

  const touchSettings = () => setSettingsUpdatedAt(new Date().toISOString());

  const set = <K extends keyof StudioOptions>(key: K, value: StudioOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
    touchSettings();
  };

  function resetOptions() {
    setOptions(DEFAULT_OPTIONS);
    touchSettings();
  }

  function locateRecordInExport(record: StudioRecord) {
    setHighlightedChartKey(chartKey(record));
    setStudioView("export");
  }

  function changeLanguage(next: LanguageId) {
    setLanguage(next);
    touchSettings();
    const nextCopy = studioCopy(next);
    setMessage(data ? nextCopy.ready(data.player.name, data.records.length) : nextCopy.emptyMessage);
  }

  /** What this device would contribute to a sync, or nothing if untouched. */
  function localSettings(): SyncedSettings | undefined {
    return settingsUpdatedAt ? { updatedAt: settingsUpdatedAt, language, options } : undefined;
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseMaiScore(JSON.parse(await file.text()));
      setData(parsed);
      setAssets({ covers: {} });
      setSource(file.name);
      setGeneratedAt(new Date().toISOString());
      setMessage(copy.loadingFile(file.name));
      const loadedAssets = await loadPublicAssets(parsed);
      setAssets(loadedAssets);
      const timestamp = new Date().toISOString();
      setGeneratedAt(timestamp);
      const loadedMessage = copy.loadedFile(file.name, parsed.records.length, Object.keys(loadedAssets.covers).length);
      setMessage(loadedMessage);
      try {
        await saveStudioSnapshot({
          data: parsed,
          assets: loadedAssets,
          source: file.name,
          generatedAt: timestamp,
          language
        });
        setHistory(await listStudioHistory());
      } catch {
        setMessage(copy.localSaveFailed);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      event.target.value = "";
    }
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function renderExport(): Promise<{ blob: Blob; filename: string }> {
    if (!data) throw new Error(copy.emptyMessage);
    const finalRendered = renderStudioSvg(data, options, language, origin, new Date(generatedAt), assets);
    const base = `mai-score-${safeName(data.player.name)}-${options.layout}`;
    if (exportFormat === "svg") {
      return {
        blob: new Blob([finalRendered.svg], { type: "image/svg+xml" }),
        filename: `${base}.svg`
      };
    }
    const image = new Image();
    const url = URL.createObjectURL(new Blob([finalRendered.svg], { type: "image/svg+xml" }));
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Preview image decoding failed."));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = finalRendered.width;
      canvas.height = finalRendered.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not create the image canvas.");
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("PNG encoding failed.")), "image/png")
      );
      return { blob, filename: `${base}.png` };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function exportImage() {
    if (!data) {
      setMessage(copy.emptyMessage);
      return;
    }
    setBusy(true);
    try {
      const { blob, filename } = await renderExport();
      download(blob, filename);
      setMessage(copy.downloadReady(exportFormat.toUpperCase()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  // On a phone this replaces download-then-find-it-in-the-gallery-then-upload
  // with a single hop into the target app.
  async function shareImage() {
    if (!data) {
      setMessage(copy.emptyMessage);
      return;
    }
    setBusy(true);
    try {
      const { blob, filename } = await renderExport();
      const file = new File([blob], filename, { type: blob.type });
      if (!navigator.canShare?.({ files: [file] })) {
        download(blob, filename);
        setMessage(copy.downloadReady(exportFormat.toUpperCase()));
        return;
      }
      await navigator.share({ files: [file], title: `${data.player.name} — Best 50` });
      setMessage(copy.shared);
    } catch (error) {
      // Dismissing the share sheet rejects; that is not a failure worth showing.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Pull, merge, push — in that order, and always all three. Pushing the
   * merged result back is what lets a device that was offline contribute its
   * own collections instead of being silently overwritten by whatever Drive
   * already held.
   */
  async function showLatestHistory(
    entries: readonly HistoryEntry[],
    // Sync may have just adopted another device's language; the closure still
    // holds the old one, and this is written into the stored snapshot.
    snapshotLanguage: LanguageId = language
  ) {
    const latest = entries[0];
    if (!latest) return;

    const latestData = normalizeB50(fromHistoryEntry(latest));
    const isCurrentSnapshot = data?.exportedAt === latestData.exportedAt;
    const retainedProfileAssets: Pick<StudioAssets, "icon" | "frame" | "plate"> = isCurrentSnapshot
      ? { icon: assets.icon, frame: assets.frame, plate: assets.plate }
      : {};

    // Show the score immediately, then let jacket loading fill in progressively.
    setData(latestData);
    setAssets({ covers: {}, ...retainedProfileAssets });
    setSource("Google Drive");
    setGeneratedAt(latestData.exportedAt);

    const publicAssets = await loadPublicAssets(latestData);
    const latestAssets = { ...publicAssets, ...retainedProfileAssets };
    setAssets(latestAssets);
    try {
      await saveStudioSnapshotOnly({
        data: latestData,
        assets: latestAssets,
        source: "Google Drive",
        generatedAt: latestData.exportedAt,
        language: snapshotLanguage
      });
    } catch {
      // The synchronized history is already safe. Private browsing may block
      // the optional current-preview cache, which should not fail the sync.
    }
  }

  async function syncHistory() {
    setSyncing(true);
    try {
      const pulled = await pullFromDrive();
      if (!pulled.ok) {
        if (pulled.reason === "needs-auth") setDriveState("disconnected");
        if (pulled.reason === "no-extension") setDriveState("unavailable");
        setMessage(pulled.reason === "needs-auth" ? copy.syncNeedsAuth
          : pulled.reason === "no-extension" ? copy.syncNoExtension
            : copy.syncFailed(pulled.error));
        return;
      }

      let incoming: HistoryEntry[] = [];
      let skipped = 0;
      let incomingSettings: SyncedSettings | undefined;
      if (pulled.payload) {
        try {
          const parsed = parseSyncDocument(pulled.payload);
          incoming = parsed.entries;
          skipped = parsed.skipped;
          incomingSettings = parsed.settings;
        } catch (error) {
          setMessage(copy.syncFailed(error instanceof Error ? error.message : String(error)));
          return;
        }
      }

      const merged = await mergeStudioHistory(incoming);
      setHistory(merged);

      const mine = localSettings();
      const settings = mergeSettings(mine, incomingSettings);
      // mergeSettings returns one of its arguments, so an identity check is
      // what tells us the remote style won. Applying it without re-stamping
      // keeps this device a follower until its own next edit, so the two
      // sides converge instead of racing.
      if (settings && settings !== mine) {
        setOptions(settings.options);
        setLanguage(settings.language);
        setSettingsUpdatedAt(settings.updatedAt);
      }

      const pushed = await pushToDrive(serializeSyncDocument(merged, settings));
      if (!pushed.ok) {
        if (pushed.reason === "needs-auth") setDriveState("disconnected");
        if (pushed.reason === "no-extension") setDriveState("unavailable");
        setMessage(pushed.reason === "needs-auth" ? copy.syncNeedsAuth
          : pushed.reason === "no-extension" ? copy.syncNoExtension
            : copy.syncFailed(pushed.error));
        return;
      }

      const syncedCopy = studioCopy(settings?.language ?? language);
      await showLatestHistory(merged, settings?.language ?? language);
      setMessage(skipped > 0
        ? `${syncedCopy.syncedAt(merged.length)} ${syncedCopy.syncSkipped(skipped)}`
        : syncedCopy.syncedAt(merged.length));
    } catch (error) {
      setMessage(copy.syncFailed(error instanceof Error ? error.message : String(error)));
    } finally {
      setSyncing(false);
    }
  }

  async function deleteCloudHistory() {
    if (!window.confirm(copy.deleteCloudConfirm)) return;
    setDeletingCloud(true);
    try {
      const outcome = await deleteFromDrive();
      if (!outcome.ok) {
        if (outcome.reason === "needs-auth") setDriveState("disconnected");
        if (outcome.reason === "no-extension") setDriveState("unavailable");
        setMessage(outcome.reason === "needs-auth" ? copy.syncNeedsAuth
          : outcome.reason === "no-extension" ? copy.syncNoExtension
            : copy.syncFailed(outcome.error));
        return;
      }
      setMessage(outcome.deleted ? copy.cloudDeleted : copy.cloudAlreadyEmpty);
    } catch (error) {
      setMessage(copy.syncFailed(error instanceof Error ? error.message : String(error)));
    } finally {
      setDeletingCloud(false);
    }
  }

  async function refreshDriveState() {
    setDriveState("checking");
    const outcome = await driveConnectionStatus();
    if (!outcome.ok) {
      setDriveState(outcome.reason === "no-extension" ? "unavailable" : "disconnected");
      if (outcome.reason === "error") setMessage(copyRef.current.syncFailed(outcome.error));
      return;
    }
    setDriveState(outcome.connected ? "connected" : "disconnected");
    if (outcome.warning) setMessage(copyRef.current.driveDisconnectWarning(outcome.warning));
  }

  async function connectGoogleDriveFromStudio() {
    if (webDriveConfigured()) {
      setConnectingDrive(true);
      setMessage(copy.driveConnecting);
      try {
        const outcome = await connectGoogleDriveWeb();
        if (!outcome.ok) {
          setDriveState("disconnected");
          setMessage(outcome.reason === "needs-auth"
            ? copy.syncNeedsAuth
            : outcome.reason === "no-extension"
              ? copy.syncNoExtension
              : copy.syncFailed(outcome.error));
          return;
        }
        setDriveState("connected");
        setMessage(copy.driveConnectedDone);
        await syncHistory();
      } catch (error) {
        setDriveState("disconnected");
        setMessage(copy.syncFailed(error instanceof Error ? error.message : String(error)));
      } finally {
        setConnectingDrive(false);
      }
      return;
    }

    const url = driveAuthorizationUrl(language);
    const authorizationWindow = window.open(
      url,
      "mai-score-drive-auth",
      "popup,width=480,height=620"
    );
    if (!authorizationWindow) {
      setMessage(copy.drivePopupBlocked);
      return;
    }
    setMessage(copy.driveAuthOpened);
  }

  async function disconnectDriveFromStudio() {
    setDisconnectingDrive(true);
    try {
      const outcome = await disconnectGoogleDrive();
      if (!outcome.ok) {
        setDriveState(outcome.reason === "no-extension" ? "unavailable" : "disconnected");
        setMessage(outcome.reason === "no-extension"
          ? copy.syncNoExtension
          : outcome.reason === "needs-auth"
            ? copy.syncNeedsAuth
            : copy.syncFailed(outcome.error));
        return;
      }
      setDriveState("disconnected");
      setMessage(outcome.warning
        ? copy.driveDisconnectWarning(outcome.warning)
        : copy.driveDisconnectedDone);
    } catch (error) {
      setDriveState("disconnected");
      setMessage(copy.syncFailed(error instanceof Error ? error.message : String(error)));
    } finally {
      setDisconnectingDrive(false);
    }
  }

  async function copyPreset() {
    const url = new URL(window.location.href);
    url.hash = `preset=${encodeURIComponent(JSON.stringify(options))}`;
    await navigator.clipboard.writeText(url.toString());
    setMessage(copy.styleCopied);
  }

  async function clearLocalData() {
    if (!window.confirm(copy.clearConfirm)) return;
    try {
      await clearStudioSnapshot();
      await clearStudioHistory();
      setHistory([]);
      setData(null);
      setAssets({ covers: {} });
      setSource("");
      setGeneratedAt(new Date().toISOString());
      setMessage(copy.localDataCleared);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="studio-shell" data-ui-theme={uiTheme}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div><strong>Mai-Score Studio</strong><small>{copy.subtitle}</small></div>
        </div>
        <div className="data-actions">
          <div className="data-summary">
            <span>{source || copy.emptySource}</span>
            <strong>{data?.player.name ?? "—"}</strong>
            <small>{data ? `Rating ${data.player.rating} · B50 ${data.b50Rating}` : copy.emptyPreview}</small>
          </div>
          <div className={`drive-compact ${driveState}`} aria-label={copy.syncHeading}>
            <span className="drive-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M8.2 3.5h5.1l3.1 5.4-2.6 4.5H3.6l2.5-4.5z" />
                <path d="M16.4 8.9 21 17h-5.2l-2.6-4.5z" />
                <path d="m3 17 2.6-4.5h7.6l2.6 4.5z" />
              </svg>
            </span>
            <span className="drive-state-label">
              <i />
              {driveState === "checking" ? copy.driveChecking
                : driveState === "connected" ? copy.driveConnected
                  : driveState === "disconnected" ? copy.driveDisconnected
                    : copy.driveUnavailable}
            </span>
            {driveState === "connected" ? (
              <>
                <button className="sync-button" disabled={syncing || deletingCloud || busy} onClick={syncHistory}>
                  {syncing ? copy.syncing : copy.syncNow}
                </button>
                <details className="drive-more">
                  <summary aria-label={copy.driveOptions}>•••</summary>
                  <div>
                    <button
                      className="secondary-button drive-disconnect-button"
                      disabled={syncing || deletingCloud || disconnectingDrive || busy}
                      onClick={disconnectDriveFromStudio}
                    >
                      {disconnectingDrive ? copy.driveDisconnecting : copy.driveDisconnect}
                    </button>
                    <button className="danger-button" disabled={syncing || deletingCloud || busy} onClick={deleteCloudHistory}>
                      {deletingCloud ? copy.deletingCloudHistory : copy.deleteCloudHistory}
                    </button>
                  </div>
                </details>
              </>
            ) : (
              <button
                className="drive-connect-button"
                disabled={busy || connectingDrive || driveState === "checking" || driveState === "unavailable"}
                onClick={connectGoogleDriveFromStudio}
              >
                {connectingDrive ? copy.driveConnecting
                  : driveState === "checking" ? copy.driveChecking
                    : copy.driveConnect}
              </button>
            )}
          </div>
          <button
            type="button"
            className="icon-toggle"
            aria-pressed={uiTheme === "light"}
            aria-label={`${copy.appearance}: ${uiTheme === "light" ? copy.light : copy.dark}`}
            title={`${copy.appearance}: ${uiTheme === "light" ? copy.light : copy.dark}`}
            onClick={() => setUiTheme(uiTheme === "light" ? "dark" : "light")}
          >
            {uiTheme === "light" ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4.6" />
                <path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3M4.8 4.8l2.1 2.1M17.1 17.1l2.1 2.1M19.2 4.8l-2.1 2.1M6.9 17.1l-2.1 2.1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.5 14.4A8.6 8.6 0 0 1 9.6 3.5a8.7 8.7 0 1 0 10.9 10.9z" />
              </svg>
            )}
          </button>
          <span className="icon-picker" title={copy.language}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3.2 9.4h17.6M3.2 14.6h17.6M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
            </svg>
            <select
              aria-label={copy.language}
              value={language}
              onChange={(event) => changeLanguage(event.target.value as LanguageId)}
            >
              <option value="en">EN</option>
              <option value="zh-Hant">繁中</option>
              <option value="ja">日本語</option>
            </select>
          </span>
          <input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={loadFile} />
          <button className="load-button" onClick={() => fileRef.current?.click()}>{copy.loadJson}</button>
        </div>
      </header>

      <div className="status-line">
        <div className="status-message"><span />{message}</div>
        <nav className="studio-tabs" aria-label={copy.studioSections}>
          <button type="button" aria-pressed={studioView === "export"} onClick={() => setStudioView("export")}>{copy.exportTab}</button>
          <button type="button" aria-pressed={studioView === "progress"} onClick={() => setStudioView("progress")}>{copy.progressTab}</button>
        </nav>
      </div>

      {studioView === "progress" ? (
        <ProgressDashboard
          data={data}
          assets={assets}
          history={history}
          language={language}
          onLocateRecord={locateRecordInExport}
          initialSelectedKey={highlightedChartKey}
        />
      ) : <section className="workspace">
        <aside className="control-panel">
          <div className="panel-heading">
            <h1>{copy.exportStyle}</h1>
            <button className="reset-button" onClick={resetOptions}>{copy.reset}</button>
          </div>

          <div className="field-grid">
            <label>{copy.layout}<select value={options.layout} onChange={(event) => set("layout", event.target.value as StudioOptions["layout"])}>
              <option value="classic">Classic 5×10</option><option value="compact">Compact 5×10</option><option value="landscape">Landscape 10×5</option>
            </select></label>
            <label>{copy.theme}<select value={options.theme} onChange={(event) => set("theme", event.target.value as StudioOptions["theme"])}>
              <option value="night">Night</option><option value="light">Light</option><option value="maimai">maimai</option>
            </select></label>
            <label>{copy.timestamp}<select value={options.timestamp} onChange={(event) => set("timestamp", event.target.value as StudioOptions["timestamp"])}>
              <option value="off">{copy.off}</option><option value="date">{copy.date}</option><option value="datetime">{copy.dateTime}</option>
            </select></label>
            <label>{copy.outputFormat}<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as "png" | "svg")}>
              <option value="png">PNG</option><option value="svg">SVG</option>
            </select></label>
            <label>{copy.chartValue}<select value={options.chartValue} onChange={(event) => set("chartValue", event.target.value as StudioOptions["chartValue"])}>
              <option value="level">{copy.level}</option>
              <option value="constant">{copy.constant}</option>
              <option value="both">{copy.chartValueBoth}</option>
              <option value="none">{copy.off}</option>
            </select></label>
            <label>{copy.accentScope}<select value={options.accentScope} onChange={(event) => set("accentScope", event.target.value as StudioOptions["accentScope"])}>
              <option value="minimal">{copy.accentMinimal}</option>
              <option value="outline">{copy.accentOutline}</option>
              <option value="full">{copy.accentFull}</option>
            </select></label>
            <fieldset className="accent-field wide-field">
              <legend>{copy.accent}</legend>
              <div className="accent-presets">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    aria-label={preset.name}
                    aria-pressed={options.accent.toLowerCase() === preset.value}
                    style={{ backgroundColor: preset.value }}
                    onClick={() => set("accent", preset.value)}
                  />
                ))}
                <label className="custom-accent">
                  <span>HEX</span>
                  <input type="color" value={options.accent} onChange={(event) => set("accent", event.target.value)} />
                </label>
              </div>
            </fieldset>
            <label className="wide-field">{copy.watermark}<input value={options.watermark} maxLength={48} placeholder={copy.watermarkPlaceholder} onChange={(event) => set("watermark", event.target.value)} /></label>
          </div>

          <section className="display-options" aria-labelledby="visible-content-heading">
            <h3 id="visible-content-heading">{copy.displayContent}</h3>
            <div className="toggle-list">
              {([
                ["showFrame", copy.frame], ["showIcon", copy.icon], ["showCovers", copy.covers],
                ["showPlate", copy.plate], ["showTrophy", copy.trophy],
                ["showBreakdown", copy.breakdown],
                ["showAchievement", copy.achievement], ["showChartRating", copy.chartRating],
                ["showScoreBadges", copy.scoreBadges],
                ["showRank", copy.rank]
              ] as Array<[keyof StudioOptions, string]>).map(([key, label]) => (
                <label key={key}><input type="checkbox" checked={Boolean(options[key])} onChange={(event) => set(key, event.target.checked as never)} />{label}</label>
              ))}
            </div>
          </section>

          <button className="export-button" disabled={busy || !data} onClick={exportImage}>
            {busy ? copy.processing : `${copy.download} ${exportFormat.toUpperCase()}`}
          </button>
          <details className="history-panel">
            <summary>{copy.history}{history.length ? ` (${history.length})` : ""}</summary>
            {history.length === 0
              ? <p className="history-empty">{copy.historyEmpty}</p>
              : (
                <ol className="history-list">
                  {history.map((point, index) => {
                    const previous = history[index + 1];
                    const diff = previous ? diffHistory(previous, point) : undefined;
                    return (
                      <li key={point.generatedAt}>
                        <div className="history-head">
                          <time dateTime={point.generatedAt}>
                            {new Date(point.generatedAt).toLocaleDateString(language)}
                          </time>
                          <strong>{point.b50Rating}</strong>
                          {diff && diff.ratingDelta !== 0 && (
                            <span className={diff.ratingDelta > 0 ? "delta up" : "delta down"}>
                              {diff.ratingDelta > 0 ? "+" : ""}{diff.ratingDelta}
                            </span>
                          )}
                        </div>
                        {diff && (diff.entered.length > 0 || diff.changed.length > 0) && (
                          <div className="history-detail">
                            {diff.entered.length > 0 && <span>{copy.historyEntered(diff.entered.length)}</span>}
                            {diff.left.length > 0 && <span>{copy.historyLeft(diff.left.length)}</span>}
                            {diff.changed.length > 0 && <span>{copy.historyImproved(diff.changed.length)}</span>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
          </details>
          {canShare && (
            <button className="share-button" disabled={busy || !data} onClick={shareImage}>
              {copy.share}
            </button>
          )}
          <button className="preset-button" onClick={copyPreset}>{copy.copyStyle}</button>
          <button className="danger-button" onClick={clearLocalData}>{copy.clearLocalData}</button>
          <p className="privacy-note">
            {copy.privacy}{" "}
            <a href="/privacy">{copy.privacyLink}</a>
          </p>
        </aside>

        <section className={`preview-panel${data ? "" : " empty"}`}>
          <div className="preview-toolbar">
            <strong>{copy.livePreview}</strong>
            <div className="preview-locator">
              {data ? <>
                <select
                  aria-label={copy.locateChart}
                  value={highlightedChartKey}
                  onChange={(event) => setHighlightedChartKey(event.target.value)}
                >
                  <option value="">{copy.locateChart}</option>
                  {data.records.map((record) => <option key={chartKey(record)} value={chartKey(record)}>{record.title} · {record.difficulty.toUpperCase()}</option>)}
                </select>
                <button type="button" disabled={!highlightedChartKey} onClick={() => setStudioView("progress")}>{copy.viewInProgress}</button>
              </> : null}
              <span>{rendered ? `${options.layout} · ${rendered.width} × ${rendered.height}` : copy.emptySource}</span>
            </div>
          </div>
          <div className={`preview-stage theme-${options.theme}`}>
            {rendered
              ? <img src={previewUrl} alt={`${options.layout} B50 export preview`} />
              : <p className="empty-preview">{copy.emptyPreview}</p>}
          </div>
        </section>
      </section>}
    </main>
  );
}
