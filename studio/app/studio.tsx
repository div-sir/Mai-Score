"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { renderStudioSvg } from "../lib/render";
import { studioCopy } from "../lib/i18n";
import {
  clearStudioSnapshot,
  loadStudioSnapshot,
  saveStudioSnapshot
} from "../lib/local-store";
import { SAMPLE_DATA } from "../lib/sample";
import {
  DEFAULT_OPTIONS,
  type LanguageId,
  type StudioAssets,
  type StudioData,
  type StudioOptions,
  type StudioRecord
} from "../lib/types";

const STORAGE_KEY = "mai-score-studio-options-v1";

type ExtensionResponse =
  | { ok: true; data: unknown; assets?: StudioAssets; language?: LanguageId }
  | { ok: false; error: string }
  | undefined;

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
        achievementRate: Number(record.result?.achievementRate ?? 0),
        bucket: record.grouping?.bucket === "b15" ? "b15" : "b35",
        chartRating: Number(record.result?.rating?.value ?? 0),
        imageName: record.song?.jacketId ? String(record.song.jacketId) : undefined
      };
    });
    const summary = Array.isArray(value.summaries)
      ? (value.summaries as Array<Record<string, any>>).find((item) => item.system === "best50")
      : undefined;
    return normalizeB50({
      schema: String(value.schema),
      exportedAt: String(value.generatedAt ?? new Date().toISOString()),
      player: {
        name: String(player?.displayName ?? "PLAYER"),
        title: String(player?.title ?? ""),
        rating: Number(player?.rating ?? 0)
      },
      records,
      b15Rating: Number(summary?.groups?.b15 ?? 0),
      b35Rating: Number(summary?.groups?.b35 ?? 0),
      b50Rating: Number(summary?.value ?? 0)
    });
  }

  const player = value.player as StudioData["player"] | undefined;
  const records = value.records;
  if (!player || !Array.isArray(records)) throw new Error("Missing player or records. Select a Mai-Score full JSON file.");
  if (records.length < 50) throw new Error(`Found ${records.length} records; B50 preview requires 50.`);
  return normalizeB50({
    schema: String(value.schema ?? "mai-score/v1"),
    exportedAt: String(value.exportedAt ?? new Date().toISOString()),
    player: {
      name: String(player.name ?? "PLAYER"),
      title: String(player.title ?? ""),
      rating: Number(player.rating ?? 0),
      iconUrl: player.iconUrl,
      frameUrl: player.frameUrl
    },
    records: records as StudioRecord[],
    b15Rating: Number(value.b15Rating ?? 0),
    b35Rating: Number(value.b35Rating ?? 0),
    b50Rating: Number(value.b50Rating ?? 0)
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
  token: string
): Promise<{ data: unknown; assets: StudioAssets; language: LanguageId }> {
  const runtime = (window as unknown as { chrome?: { runtime?: ExternalRuntime } }).chrome?.runtime;
  if (!runtime?.sendMessage) {
    return Promise.reject(new Error("Could not connect to Mai-Score. Update and reload the extension."));
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Transfer timed out. Open Studio again from the extension.")), 10000);
    runtime.sendMessage(extensionId, { type: "MAI_SCORE_STUDIO_IMPORT", token }, (response) => {
      window.clearTimeout(timeout);
      const runtimeError = runtime.lastError?.message;
      if (runtimeError) {
        reject(new Error("Could not connect to Mai-Score. Reload extension v0.5.0."));
      } else if (!response?.ok) {
        reject(new Error(response?.error ?? "The extension returned no data."));
      } else {
        const language = response.language === "zh-Hant" || response.language === "ja"
          ? response.language
          : "en";
        resolve({ data: response.data, assets: response.assets ?? { covers: {} }, language });
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
  return {
    covers: Object.fromEntries(
      coverPairs.filter((pair): pair is readonly [string, string] => Boolean(pair[1]))
    )
  };
}

function safeName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
}

export default function Studio() {
  const [data, setData] = useState<StudioData>(SAMPLE_DATA);
  const [assets, setAssets] = useState<StudioAssets>({ covers: {} });
  const [options, setOptions] = useState<StudioOptions>(DEFAULT_OPTIONS);
  const [exportFormat, setExportFormat] = useState<"png" | "svg">("png");
  const [message, setMessage] = useState(studioCopy("en").demoMessage);
  const [source, setSource] = useState(studioCopy("en").demoSource);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const [generatedAt, setGeneratedAt] = useState(SAMPLE_DATA.exportedAt);
  const fileRef = useRef<HTMLInputElement>(null);
  const copy = studioCopy(options.language);

  useEffect(() => {
    let cancelled = false;
    setOrigin(window.location.origin);
    setGeneratedAt(new Date().toISOString());
    const hash = new URLSearchParams(window.location.hash.slice(1));
    let savedLanguage: LanguageId = "en";
    try {
      const preset = hash.get("preset");
      const saved = preset ? JSON.parse(preset) : JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) {
        const restoredOptions = { ...DEFAULT_OPTIONS, ...saved };
        savedLanguage = restoredOptions.language;
        setOptions(restoredOptions);
      }
    } catch {
      setMessage("Saved style could not be read. Defaults were restored.");
    }

    const extensionId = hash.get("extensionId");
    const transfer = hash.get("transfer");
    void (async () => {
      if (extensionId && transfer) {
        setMessage(studioCopy(savedLanguage).receiving);
        try {
          const received = await receiveFromExtension(extensionId, transfer);
          if (cancelled) return;
          const parsed = parseMaiScore(received.data);
          const timestamp = new Date().toISOString();
          setData(parsed);
          setAssets(received.assets);
          setOptions((current) => ({ ...current, language: received.language }));
          setSource("Mai-Score extension");
          setGeneratedAt(timestamp);
          const coverCount = Object.keys(received.assets.covers).length;
          const profileAssetCount = [received.assets.icon, received.assets.frame].filter(Boolean).length;
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
          } catch {
            if (!cancelled) setMessage(studioCopy(received.language).localSaveFailed);
          }
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        } catch (error) {
          if (cancelled) return;
          setMessage(error instanceof Error ? error.message : String(error));
        }
        return;
      }

      try {
        const stored = await loadStudioSnapshot();
        if (!stored || cancelled) return;
        setData(normalizeB50(stored.data));
        setAssets(stored.assets);
        setSource(stored.source);
        setGeneratedAt(stored.generatedAt);
        setOptions((current) => ({ ...current, language: stored.language }));
        setMessage(studioCopy(stored.language).restored(
          stored.data.player.name,
          new Date(stored.savedAt).toLocaleString()
        ));
      } catch {
        // IndexedDB can be unavailable in restricted browsing modes; demo mode remains usable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  }, [options]);

  const rendered = useMemo(
    () => renderStudioSvg(data, options, origin, new Date(generatedAt), assets),
    [data, options, origin, generatedAt, assets]
  );
  const previewUrl = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rendered.svg)}`,
    [rendered.svg]
  );

  const set = <K extends keyof StudioOptions>(key: K, value: StudioOptions[K]) =>
    setOptions((current) => ({ ...current, [key]: value }));

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
          language: options.language
        });
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

  async function exportImage() {
    setBusy(true);
    try {
      const finalRendered = renderStudioSvg(data, options, origin, new Date(), assets);
      if (exportFormat === "svg") {
        download(new Blob([finalRendered.svg], { type: "image/svg+xml" }), `mai-score-${safeName(data.player.name)}-${options.layout}.svg`);
      } else {
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
          download(blob, `mai-score-${safeName(data.player.name)}-${options.layout}.png`);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      setMessage(copy.downloadReady(exportFormat.toUpperCase()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
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
      setData(SAMPLE_DATA);
      setAssets({ covers: {} });
      setSource(copy.demoSource);
      setGeneratedAt(new Date().toISOString());
      setMessage(copy.localDataCleared);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div><strong>Mai-Score Studio</strong><small>{copy.subtitle}</small></div>
        </div>
        <div className="data-actions">
          <div className="data-summary">
            <span>{source}</span>
            <strong>{data.player.name}</strong>
            <small>Rating {data.player.rating} · B50 {data.b50Rating}</small>
          </div>
          <input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={loadFile} />
          <button className="secondary-button" onClick={() => {
            setData(SAMPLE_DATA);
            setAssets({ covers: {} });
            setSource(copy.demoSource);
            setMessage(copy.demoMessage);
          }}>{copy.demo}</button>
          <button className="load-button" onClick={() => fileRef.current?.click()}>{copy.loadJson}</button>
        </div>
      </header>

      <div className="status-line"><span />{message}</div>

      <section className="workspace">
        <aside className="control-panel">
          <div className="panel-heading">
            <h1>{copy.exportStyle}</h1>
            <button className="reset-button" onClick={() => setOptions(DEFAULT_OPTIONS)}>{copy.reset}</button>
          </div>

          <div className="field-grid">
            <label>{copy.language}<select value={options.language} onChange={(event) => set("language", event.target.value as StudioOptions["language"])}>
              <option value="en">English</option><option value="zh-Hant">繁體中文</option><option value="ja">日本語</option>
            </select></label>
            <label>{copy.layout}<select value={options.layout} onChange={(event) => set("layout", event.target.value as StudioOptions["layout"])}>
              <option value="classic">Classic 5×10</option><option value="compact">Compact 5×10</option><option value="landscape">Landscape 10×5</option>
            </select></label>
            <label>{copy.theme}<select value={options.theme} onChange={(event) => set("theme", event.target.value as StudioOptions["theme"])}>
              <option value="night">Night</option><option value="light">Light</option><option value="maimai">maimai</option>
            </select></label>
            <label>{copy.timestamp}<select value={options.timestamp} onChange={(event) => set("timestamp", event.target.value as StudioOptions["timestamp"])}>
              <option value="off">{copy.off}</option><option value="date">{copy.date}</option><option value="datetime">{copy.dateTime}</option>
            </select></label>
            <label>{copy.timezone}<select value={options.timezone} disabled={options.timestamp === "off"} onChange={(event) => set("timezone", event.target.value as StudioOptions["timezone"])}>
              <option value="local">{copy.local}</option><option value="utc">UTC</option>
            </select></label>
            <label>{copy.accent}<input type="color" value={options.accent} onChange={(event) => set("accent", event.target.value)} /></label>
            <label>{copy.outputFormat}<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as "png" | "svg")}>
              <option value="png">PNG</option><option value="svg">SVG</option>
            </select></label>
            <label className="wide-field">{copy.watermark}<input value={options.watermark} maxLength={48} placeholder={copy.watermarkPlaceholder} onChange={(event) => set("watermark", event.target.value)} /></label>
          </div>

          <details className="display-options">
            <summary>{copy.displayContent}</summary>
            <div className="toggle-list">
              {([
                ["showFrame", copy.frame], ["showIcon", copy.icon], ["showCovers", copy.covers],
                ["showOfficialRating", copy.officialRating], ["showBreakdown", copy.breakdown],
                ["showAchievement", copy.achievement], ["showChartRating", copy.chartRating],
                ["showLevel", copy.level], ["showRank", copy.rank]
              ] as Array<[keyof StudioOptions, string]>).map(([key, label]) => (
                <label key={key}><input type="checkbox" checked={Boolean(options[key])} onChange={(event) => set(key, event.target.checked as never)} />{label}</label>
              ))}
            </div>
          </details>

          <button className="export-button" disabled={busy} onClick={exportImage}>
            {busy ? copy.processing : `${copy.download} ${exportFormat.toUpperCase()}`}
          </button>
          <button className="preset-button" onClick={copyPreset}>{copy.copyStyle}</button>
          <button className="danger-button" onClick={clearLocalData}>{copy.clearLocalData}</button>
          <p className="privacy-note">{copy.privacy}</p>
        </aside>

        <section className="preview-panel">
          <div className="preview-toolbar">
            <strong>{copy.livePreview}</strong>
            <span>{options.layout} · {rendered.width} × {rendered.height}</span>
          </div>
          <div className={`preview-stage theme-${options.theme}`}>
            <img src={previewUrl} alt={`${options.layout} B50 export preview`} />
          </div>
        </section>
      </section>
    </main>
  );
}
