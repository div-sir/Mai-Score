"use client";
import { useMemo, useState } from "react";
import type { SheetRecord } from "../../src/lib/types";
import type { LanguageId, StudioChartRecord } from "../lib/types";
import { joinCatalogRecords } from "../lib/catalog-records";
import { catalogCompletion, type CompletionGoal } from "../lib/catalog-completion";

export default function CatalogPanel({ records, language }: { records: StudioChartRecord[]; language: LanguageId }) {
  const [catalog, setCatalog] = useState<SheetRecord[]>([]);
  const [date, setDate] = useState("");
  const [state, setState] = useState("idle");
  const [query, setQuery] = useState("");
  const [compare, setCompare] = useState(false);
  const [goal, setGoal] = useState<CompletionGoal>("sss");
  const [limit, setLimit] = useState(50);
  const t = language === "zh-Hant" ? ["國際版曲庫", "載入曲庫", "搜尋曲名、版本或難度", "確認這份成績來自國際版，啟用比較", "已達成", "未達目標", "未觀測／無法匹配", "顯示更多", "載入失敗，請重試", "曲庫資料日期", "未知不代表未遊玩；資料日期不保證曲庫為最新。"] : language === "ja" ? ["国際版カタログ", "カタログを読み込む", "曲名・バージョン・難易度で検索", "成績が国際版であることを確認して比較", "達成", "目標未達", "未観測・照合不能", "さらに表示", "読み込み失敗。再試行してください", "カタログ更新日", "未観測は未プレイを意味しません。最新データとは限りません。"] : ["International catalog", "Load catalog", "Search title, version or difficulty", "Confirm these scores are International and compare", "Completed", "Below target", "Unobserved / unmatched", "Show more", "Load failed. Retry", "Catalog date", "Unknown does not mean unplayed. The catalog may not be current."];
  async function load() {
    setState("loading");
    try {
      const response = await fetch("/data/catalog.json");
      if (!response.ok) throw new Error("Catalog unavailable");
      const value = await response.json();
      if (value.schema !== "mai-score/catalog/v1" || value.region !== "intl" || !Array.isArray(value.sheets) || value.sheets.length !== value.source?.sheets || typeof value.source?.updateTime !== "string") throw new Error("Invalid catalog");
      const ids = new Set();
      for (const s of value.sheets) {
        if (!s || typeof s.sheetId !== "string" || !s.sheetId || ids.has(s.sheetId) || typeof s.title !== "string" || typeof s.version !== "string" || !["std", "dx"].includes(s.type) || !["basic", "advanced", "expert", "master", "remaster"].includes(s.difficulty)) throw new Error("Invalid chart");
        ids.add(s.sheetId);
      }
      setCatalog(value.sheets); setDate(value.source.updateTime); setState("ready");
    } catch { setState("error"); }
  }
  const rows = useMemo(() => joinCatalogRecords(catalog, compare ? records : []), [catalog, records, compare]);
  const filtered = useMemo(() => rows.filter(r => `${r.sheet.title} ${r.sheet.version} ${r.sheet.difficulty}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [rows, query]);
  const summary = useMemo(() => catalogCompletion(filtered, goal), [filtered, goal]);
  return <details className="records-detail-panel">
    <summary>{t[0]}</summary>
    {state !== "ready" && <button type="button" disabled={state === "loading"} onClick={load}>{t[1]}{state === "loading" ? "…" : ""}</button>}
    {state === "error" && <p role="alert">{t[8]}</p>}
    {state === "ready" && <>
      <p>{t[9]}: <time dateTime={date}>{date}</time> · {catalog.length}</p><p>{t[10]}</p>
      <label>{t[2]}<input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(50); }} /></label>
      <label><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />{t[3]}</label>
      <label>SSS / SSS+ / FC / AP<select value={goal} onChange={e => setGoal(e.target.value as CompletionGoal)}>{(["sss", "sssPlus", "fc", "ap"] as const).map(g => <option key={g} value={g}>{g === "sssPlus" ? "SSS+" : g.toUpperCase()}</option>)}</select></label>
      {compare && <p>{t[4]}: {summary.completed} · {t[5]}: {summary.belowTarget} · {t[6]}: {summary.unknown}</p>}
      <ul>{filtered.slice(0, limit).map(r => <li key={r.sheet.sheetId}>{r.sheet.title} · {r.sheet.type.toUpperCase()} · {r.sheet.difficulty.toUpperCase()} · {r.sheet.level} · {r.sheet.version}{compare ? ` · ${r.score ? r.score.achievementRate.toFixed(4) + "%" : t[6]}` : ""}</li>)}</ul>
      {filtered.length > limit && <button type="button" onClick={() => setLimit(n => n + 50)}>{t[7]} ({Math.min(limit, filtered.length)}/{filtered.length})</button>}
    </>}
  </details>;
}
