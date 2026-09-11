"use client";
import { useMemo, useState } from "react";
import type { SheetRecord } from "../../src/lib/types";
import type { LanguageId, StudioChartRecord, StudioData } from "../lib/types";
import { simulateCatalogChart } from "../lib/catalog-simulation";
import { joinCatalogRecords } from "../lib/catalog-records";
import { catalogCompletion, type CompletionGoal } from "../lib/catalog-completion";

export default function CatalogPanel({ records, language, data }: { records: StudioChartRecord[]; language: LanguageId; data?: StudioData | null }) {
  const [gap, setGap] = useState("all");
  const [selected, setSelected] = useState<SheetRecord | null>(null);
  const [target, setTarget] = useState("100.5");
  const [catalog, setCatalog] = useState<SheetRecord[]>([]);
  const [date, setDate] = useState("");
  const [state, setState] = useState("idle");
  const [query, setQuery] = useState("");
  const [constant, setConstant] = useState("all");
  const [compare, setCompare] = useState(false);
  const [goal, setGoal] = useState<CompletionGoal>("sss");
  const [limit, setLimit] = useState(50);
  const t = language === "zh-Hant" ? ["國際版曲庫", "載入曲庫", "搜尋曲名、版本或難度", "確認這份成績來自國際版，啟用比較", "已達成", "未達目標", "未觀測／無法匹配", "顯示更多", "載入失敗，請重試", "曲庫資料日期", "未知不代表未遊玩；資料日期不保證曲庫為最新。", "譜面定數", "全部定數"] : language === "ja" ? ["国際版カタログ", "カタログを読み込む", "曲名・バージョン・難易度で検索", "成績が国際版であることを確認して比較", "達成", "目標未達", "未観測・照合不能", "さらに表示", "読み込み失敗。再試行してください", "カタログ更新日", "未観測は未プレイを意味しません。最新データとは限りません。", "譜面定数", "すべての定数"] : ["International catalog", "Load catalog", "Search title, version or difficulty", "Confirm these scores are International and compare", "Completed", "Below target", "Unobserved / unmatched", "Show more", "Load failed. Retry", "Catalog date", "Unknown does not mean unplayed. The catalog may not be current.", "Chart constant", "All constants"];
  async function load() {
    setState("loading");
    try {
      const response = await fetch("/data/catalog.json");
      if (!response.ok) throw new Error("Catalog unavailable");
      const value = await response.json();
      if (value.schema !== "mai-score/catalog/v1" || value.region !== "intl" || !Array.isArray(value.sheets) || value.sheets.length !== value.source?.sheets || typeof value.source?.updateTime !== "string") throw new Error("Invalid catalog");
      const ids = new Set();
      for (const s of value.sheets) {
        if (!s || typeof s.sheetId !== "string" || !s.sheetId || ids.has(s.sheetId) || typeof s.title !== "string" || typeof s.version !== "string" || !Number.isFinite(s.internalLevelValue) || !["std", "dx"].includes(s.type) || !["basic", "advanced", "expert", "master", "remaster"].includes(s.difficulty)) throw new Error("Invalid chart");
        ids.add(s.sheetId);
      }
      setCatalog(value.sheets); setDate(value.source.updateTime); setState("ready");
    } catch { setState("error"); }
  }
  const rows = useMemo(() => joinCatalogRecords(catalog, compare ? records : []), [catalog, records, compare]);
  const constants = useMemo(() => [...new Set(catalog.map(sheet => sheet.internalLevelValue))].sort((a, b) => b - a), [catalog]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase();
    return rows.filter(r => (constant === "all" || r.sheet.internalLevelValue === Number(constant))
      && `${r.sheet.title} ${r.sheet.version} ${r.sheet.difficulty}`.toLocaleLowerCase().includes(normalizedQuery));
  }, [rows, query, constant]);
  const summary = useMemo(() => catalogCompletion(filtered, goal), [filtered, goal]);
  const visible = compare && gap !== "all" ? summary.gaps.filter(g => gap === "gaps" || g.reason === gap).map(g => g.chart) : filtered;
  const simulation = compare && data && selected && target.trim() ? simulateCatalogChart(data, selected, Number(target)) : undefined;
  const labels = language === "zh-Hant" ? ["顯示範圍", "全部", "所有缺口", "已知未達標", "未觀測", "匹配不明", "模擬", "目標達成率 %", "缺少明確 B15/B35 資格、完整分組或定數，或目標低於目前成績，無法計算。"] : language === "ja" ? ["表示範囲", "すべて", "未達・不明", "既知の未達", "未観測", "照合不能", "シミュレーション", "目標達成率 %", "B15/B35 資格・完全なグループ・定数が不足、または目標が現在の成績未満です。"] : ["Show", "All", "All gaps", "Known below target", "Unobserved", "Ambiguous", "Simulate", "Target achievement %", "Needs explicit B15/B35 eligibility, complete buckets and a constant; target must not be below the current score."];
  return <details className="records-detail-panel catalog-panel">
    <summary>{t[0]}</summary>
    <div className="catalog-body">
    {state !== "ready" && <button className="catalog-load panel-primary-button" type="button" disabled={state === "loading"} onClick={load}>{t[1]}{state === "loading" ? "…" : ""}</button>}
    {state === "error" && <p role="alert">{t[8]}</p>}
    {state === "ready" && <>
      <div className="catalog-meta"><p>{t[9]}: <time dateTime={date}>{date}</time> · {catalog.length}</p><p>{t[10]}</p></div>
      <div className="catalog-controls">
        <label className="catalog-search">{t[2]}<input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(50); }} /></label>
        <label><span>{t[11]}</span><select aria-label={t[11]} value={constant} onChange={e => { setConstant(e.target.value); setLimit(50); }}><option value="all">{t[12]}</option>{constants.map(value => <option key={value} value={value}>{value.toFixed(1)}</option>)}</select></label>
        <label><span>SSS / SSS+ / FC / AP</span><select value={goal} onChange={e => setGoal(e.target.value as CompletionGoal)}>{(["sss", "sssPlus", "fc", "ap"] as const).map(g => <option key={g} value={g}>{g === "sssPlus" ? "SSS+" : g.toUpperCase()}</option>)}</select></label>
        {compare && <label><span>{labels[0]}</span><select value={gap} onChange={e => { setGap(e.target.value); setLimit(50); }}>{["all", "gaps", "below-target", "unobserved", "ambiguous"].map((g, i) => <option key={g} value={g}>{labels[i + 1]}</option>)}</select></label>}
      </div>
      <label className="catalog-compare"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /><span>{t[3]}</span></label>
      {compare && <div className="catalog-summary" aria-label="Completion summary"><span><b>{summary.completed}</b>{t[4]}</span><span><b>{summary.belowTarget}</b>{t[5]}</span><span><b>{summary.unknown}</b>{t[6]}</span></div>}
      {selected && compare && <section className="catalog-simulator" aria-label={labels[6]}><h3>{selected.title}</h3><p>{selected.type.toUpperCase()} · {selected.difficulty.toUpperCase()} · {selected.level} · {selected.version}</p><label>{labels[7]}<input type="number" min="0" max="100.5" step="0.0001" value={target} onChange={e => setTarget(e.target.value)} /></label><p role="status">{simulation ? `${simulation.bucket.toUpperCase()} · Rating ${simulation.rating} · B50 +${simulation.gain} → ${simulation.total}` : labels[8]}</p></section>}
      <ul className="catalog-list">{visible.slice(0, limit).map(r => <li key={r.sheet.sheetId}><div><strong>{r.sheet.title}</strong><span>{r.sheet.type.toUpperCase()} · {r.sheet.difficulty.toUpperCase()} · {r.sheet.level} · {r.sheet.internalLevelValue.toFixed(1)}</span><small>{r.sheet.version}</small></div>{compare && <div className="catalog-result"><b>{r.score ? `${r.score.achievementRate.toFixed(4)}%` : t[6]}</b><button className="panel-secondary-button" type="button" onClick={() => setSelected(r.sheet)}>{labels[6]}</button></div>}</li>)}</ul>
      <p className="catalog-count" role="status">{visible.length}</p>
      {visible.length > limit && <button className="panel-secondary-button" type="button" onClick={() => setLimit(n => n + 50)}>{t[7]} ({Math.min(limit, visible.length)}/{visible.length})</button>}
    </>}
    </div>
  </details>;
}
