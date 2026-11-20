"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { SheetRecord } from "../../src/lib/types";
import { loadStudioSnapshot } from "../lib/local-store";
import { buildPersonalChartStats, type PersonalChartStat } from "../lib/personal-chart-stats";
import type { LanguageId, StudioChartRecord } from "../lib/types";
import SongCover from "./song-cover";

type View = "songs" | "constants" | "personal";
interface CatalogDocument { schema: string; region: string; source: { updateTime: string; sheets: number }; sheets: SheetRecord[] }

const copy = {
  en: {
    eyebrow: "INTERNATIONAL SONG DATABASE", title: "Song research center", description: "Search the International catalog, browse constants, and turn your saved Full Records into a personal difficulty and rating-opportunity map.",
    back: "Open Studio", songs: "Songs", constants: "Constant table", personal: "Personal map", search: "Title, song ID or version", all: "All", type: "Chart type", difficulty: "Difficulty", level: "Level", version: "Version", results: "charts", updated: "Catalog updated", loading: "Loading the International catalog…", error: "The catalog could not be loaded.", more: "Show more", reset: "Clear filters", noResults: "No charts match these filters.",
    personalTitle: "Your difficulty × Rating opportunity", personalHelp: "Each point uses only your own saved MASTER / Re:MASTER scores. Right means this chart is stronger than your median at the same constant; higher means more Rating remains at 100.5%. This is not crowd difficulty data.", needData: "Import B50 + Full Records in Studio to unlock your personal map.", strongest: "Personal strengths", weaknesses: "Personal weaknesses", opportunities: "Best opportunities", gap: "vs your same-constant median", potential: "Rating potential", close: "Close", achievement: "Achievement", yourScore: "Your saved score", unobserved: "No saved score", songId: "Song ID"
  },
  "zh-Hant": {
    eyebrow: "國際版歌曲資料庫", title: "歌曲研究中心", description: "搜尋國際版曲庫、瀏覽定數表，並把本機 Full Records 轉成個人難度偏差與推分機會地圖。",
    back: "開啟 Studio", songs: "歌曲列表", constants: "定數表", personal: "個人地圖", search: "搜尋曲名、歌曲 ID 或版本", all: "全部", type: "譜面類型", difficulty: "難度", level: "等級", version: "版本", results: "張譜面", updated: "曲庫更新", loading: "正在載入國際版曲庫…", error: "無法載入曲庫。", more: "顯示更多", reset: "清除條件", noResults: "沒有符合條件的譜面。",
    personalTitle: "你的難度偏差 × 推分機會", personalHelp: "每個點只使用你本機儲存的 MASTER／Re:MASTER 成績。越右代表高於你在同定數的中位成績，越上代表推到 100.5% 尚有較多 Rating；這不是群體詐稱資料。", needData: "請先在 Studio 匯入 B50＋Full Records，才能產生個人地圖。", strongest: "個人強項", weaknesses: "個人弱項", opportunities: "最佳推分機會", gap: "相對同定數中位數", potential: "Rating 潛力", close: "關閉", achievement: "達成率", yourScore: "你的本機成績", unobserved: "沒有本機成績", songId: "歌曲 ID"
  },
  ja: {
    eyebrow: "INTERNATIONAL SONG DATABASE", title: "楽曲リサーチ", description: "海外版カタログの検索、定数表、端末に保存した全成績から個人差とレーティング候補を確認できます。",
    back: "Studio を開く", songs: "楽曲一覧", constants: "定数表", personal: "個人マップ", search: "曲名・曲 ID・バージョン", all: "すべて", type: "譜面タイプ", difficulty: "難易度", level: "レベル", version: "バージョン", results: "譜面", updated: "カタログ更新", loading: "海外版カタログを読み込み中…", error: "カタログを読み込めませんでした。", more: "さらに表示", reset: "条件をクリア", noResults: "条件に一致する譜面がありません。",
    personalTitle: "自分の得意度 × Rating 候補", personalHelp: "各点は端末に保存された自分の MASTER / Re:MASTER 成績だけを使用します。右ほど同定数の自分の中央値より得意、上ほど 100.5% までの Rating 余地が大きいことを示します。集合統計ではありません。", needData: "Studio で B50＋全成績を読み込むと個人マップを利用できます。", strongest: "得意譜面", weaknesses: "苦手譜面", opportunities: "おすすめ候補", gap: "同定数の中央値との差", potential: "Rating 余地", close: "閉じる", achievement: "達成率", yourScore: "保存済み成績", unobserved: "保存済み成績なし", songId: "曲 ID"
  }
} satisfies Record<LanguageId, Record<string, string>>;

const emptyAssets = { covers: {} };
const scoreIdentity = (record: Pick<StudioChartRecord, "title" | "type" | "difficulty">) => JSON.stringify([record.title, record.type, record.difficulty]);
const sheetRecord = (sheet: SheetRecord, score?: StudioChartRecord): StudioChartRecord => score ?? ({
  chartId: sheet.sheetId, songId: sheet.songId, title: sheet.title, type: sheet.type, difficulty: sheet.difficulty,
  displayedLevel: sheet.level, internalLevelValue: sheet.internalLevelValue, achievementRate: 0, version: sheet.version, imageName: sheet.imageName
});

export default function SongResearchCenter() {
  const [language, setLanguage] = useState<LanguageId>("en");
  const [catalog, setCatalog] = useState<CatalogDocument | null>(null);
  const [records, setRecords] = useState<StudioChartRecord[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [view, setView] = useState<View>("songs");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [type, setType] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [level, setLevel] = useState("all");
  const [version, setVersion] = useState("all");
  const [limit, setLimit] = useState(80);
  const [selected, setSelected] = useState<SheetRecord | null>(null);
  const t = copy[language];

  useEffect(() => {
    let stored: unknown;
    try { stored = JSON.parse(localStorage.getItem("mai-score-studio-options-v1") ?? "null")?.language; } catch { stored = undefined; }
    const browser = navigator.language.toLowerCase();
    setLanguage(stored === "zh-Hant" || stored === "ja" || stored === "en" ? stored : browser.startsWith("zh") ? "zh-Hant" : browser.startsWith("ja") ? "ja" : "en");
    Promise.all([
      fetch("/data/catalog.json").then(async response => {
        if (!response.ok) throw new Error("Catalog unavailable");
        return response.json() as Promise<CatalogDocument>;
      }),
      loadStudioSnapshot().catch(() => undefined)
    ]).then(([document, snapshot]) => {
      if (document.schema !== "mai-score/catalog/v1" || document.region !== "intl" || !Array.isArray(document.sheets)) throw new Error("Invalid catalog");
      setCatalog(document);
      setRecords(snapshot?.data.fullRecords?.length ? snapshot.data.fullRecords : snapshot?.data.records ?? []);
      setState("ready");
    }).catch(() => setState("error"));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  const scoreMaps = useMemo(() => ({
    byId: new Map(records.flatMap(record => record.chartId ? [[record.chartId, record] as const] : [])),
    byIdentity: new Map(records.map(record => [scoreIdentity(record), record]))
  }), [records]);
  const scoreFor = (sheet: SheetRecord) => scoreMaps.byId.get(sheet.sheetId) ?? scoreMaps.byIdentity.get(scoreIdentity(sheet));
  const versions = useMemo(() => [...new Set(catalog?.sheets.map(sheet => sheet.version) ?? [])].sort(), [catalog]);
  const levels = useMemo(() => [...new Set(catalog?.sheets.map(sheet => sheet.level) ?? [])].sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b) || a.localeCompare(b)), [catalog]);
  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase(language);
    return (catalog?.sheets ?? []).filter(sheet =>
      (type === "all" || sheet.type === type) && (difficulty === "all" || sheet.difficulty === difficulty)
      && (level === "all" || sheet.level === level) && (version === "all" || sheet.version === version)
      && `${sheet.title} ${sheet.songId} ${sheet.version} ${sheet.type} ${sheet.difficulty}`.toLocaleLowerCase(language).includes(needle)
    ).sort((a, b) => b.internalLevelValue - a.internalLevelValue || a.title.localeCompare(b.title, language));
  }, [catalog, deferredQuery, type, difficulty, level, version, language]);
  const constantGroups = useMemo(() => {
    const groups = new Map<number, SheetRecord[]>();
    for (const sheet of filtered.filter(item => item.internalLevelValue >= 12)) {
      const list = groups.get(sheet.internalLevelValue) ?? [];
      list.push(sheet); groups.set(sheet.internalLevelValue, list);
    }
    return [...groups].sort((a, b) => b[0] - a[0]);
  }, [filtered]);
  const stats = useMemo(() => buildPersonalChartStats(records), [records]);
  const { mapStats, maxPotential, strength, weakness, opportunities } = useMemo(() => {
    const visibleMapStats = stats.filter(item => item.ratingPotential > 0).slice(0, 220);
    return {
      mapStats: visibleMapStats,
      maxPotential: Math.max(1, ...visibleMapStats.map(item => item.ratingPotential)),
      strength: [...stats].sort((a, b) => b.personalGap - a.personalGap).slice(0, 5),
      weakness: [...stats].sort((a, b) => a.personalGap - b.personalGap).slice(0, 5),
      opportunities: stats.slice(0, 8)
    };
  }, [stats]);
  const selectStat = (stat: PersonalChartStat) => {
    const sheet = catalog?.sheets.find(candidate => candidate.sheetId === stat.record.chartId)
      ?? catalog?.sheets.find(candidate => scoreIdentity(candidate) === scoreIdentity(stat.record));
    if (sheet) setSelected(sheet);
  };
  const reset = () => { setQuery(""); setType("all"); setDifficulty("all"); setLevel("all"); setVersion("all"); setLimit(80); };
  const selectedScore = selected ? scoreFor(selected) : undefined;
  const siblings = selected ? (catalog?.sheets.filter(sheet => sheet.songId === selected.songId) ?? []) : [];

  return <main className="song-research-shell">
    <header className="song-research-nav"><Link href="/" className="passport-brand"><span>M</span><strong>Mai-Score</strong></Link><div><Link href="/">{t.back}</Link><select aria-label="Language" value={language} onChange={event => setLanguage(event.target.value as LanguageId)}><option value="en">EN</option><option value="zh-Hant">繁中</option><option value="ja">日本語</option></select></div></header>
    <section className="song-research-hero"><p>{t.eyebrow}</p><h1>{t.title}</h1><span>{t.description}</span>{catalog ? <small>{t.updated}: {new Date(catalog.source.updateTime).toLocaleDateString(language)} · {catalog.source.sheets.toLocaleString(language)} {t.results}</small> : null}</section>
    <nav className="song-research-tabs" aria-label={t.title}>{(["songs", "constants", "personal"] as const).map(tab => <button key={tab} type="button" aria-pressed={view === tab} onClick={() => setView(tab)}>{t[tab]}</button>)}</nav>
    {state === "loading" ? <p className="song-research-status">{t.loading}</p> : state === "error" ? <p className="song-research-status error">{t.error}</p> : <>
      {view !== "personal" ? <section className="song-research-filters">
        <label className="wide">{t.search}<input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(80); }} /></label>
        <label>{t.type}<select value={type} onChange={event => setType(event.target.value)}><option value="all">{t.all}</option><option value="std">STD</option><option value="dx">DX</option></select></label>
        <label>{t.difficulty}<select value={difficulty} onChange={event => setDifficulty(event.target.value)}><option value="all">{t.all}</option>{["basic", "advanced", "expert", "master", "remaster"].map(value => <option value={value} key={value}>{value.toUpperCase()}</option>)}</select></label>
        <label>{t.level}<select value={level} onChange={event => setLevel(event.target.value)}><option value="all">{t.all}</option>{levels.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
        <label>{t.version}<select value={version} onChange={event => setVersion(event.target.value)}><option value="all">{t.all}</option>{versions.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
        <button type="button" onClick={reset}>{t.reset}</button>
      </section> : null}
      {view === "songs" ? <section className="song-browser"><p>{filtered.length.toLocaleString(language)} {t.results}</p>{filtered.length ? <div className="song-browser-grid">{filtered.slice(0, limit).map(sheet => { const score = scoreFor(sheet); return <button type="button" key={sheet.sheetId} onClick={() => setSelected(sheet)}><SongCover record={sheetRecord(sheet, score)} assets={emptyAssets}/><span><strong>{sheet.title}</strong><small>{sheet.type.toUpperCase()} · {sheet.difficulty.toUpperCase()} · Lv {sheet.level}</small><em>{sheet.version}</em></span><b>{sheet.internalLevelValue.toFixed(1)}</b>{score ? <i>{score.achievementRate.toFixed(4)}%</i> : null}</button>; })}</div> : <div className="song-research-empty">{t.noResults}</div>}{filtered.length > limit ? <button className="song-research-more" type="button" onClick={() => setLimit(value => value + 80)}>{t.more} ({Math.min(limit, filtered.length)}/{filtered.length})</button> : null}</section> : null}
      {view === "constants" ? <section className="constant-browser"><p>{filtered.filter(item => item.internalLevelValue >= 12).length.toLocaleString(language)} {t.results}</p>{constantGroups.map(([constant, sheets]) => <section key={constant}><header><h2>{constant.toFixed(1)}</h2><span>{sheets.length}</span></header><div>{sheets.map(sheet => <button type="button" key={sheet.sheetId} onClick={() => setSelected(sheet)}><SongCover record={sheetRecord(sheet, scoreFor(sheet))} assets={emptyAssets}/><span><strong>{sheet.title}</strong><small>{sheet.type.toUpperCase()} · {sheet.difficulty.toUpperCase()}</small></span></button>)}</div></section>)}</section> : null}
      {view === "personal" ? <section className="personal-map-section"><header><div><h2>{t.personalTitle}</h2><p>{t.personalHelp}</p></div>{stats.length ? <strong>{stats.length.toLocaleString(language)}</strong> : null}</header>{stats.length ? <>
        <div className="personal-map"><svg viewBox="0 0 1000 440" role="img" aria-label={t.personalTitle}><line x1="500" y1="24" x2="500" y2="400"/><line x1="40" y1="400" x2="960" y2="400"/>{mapStats.map(stat => { const x = Math.max(50, Math.min(950, 500 + stat.personalGap * 115)); const y = 390 - stat.ratingPotential / maxPotential * 350; const openStat = () => selectStat(stat); return <circle key={stat.key} cx={x} cy={y} r={Math.max(5, Math.min(11, 5 + stat.record.internalLevelValue! - 12))} className={stat.personalGap >= 0 ? "strength" : "weakness"} tabIndex={0} role="button" onClick={openStat} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openStat(); } }}><title>{stat.record.title} · {stat.personalGap >= 0 ? "+" : ""}{stat.personalGap.toFixed(4)}% · +{stat.ratingPotential} RA</title></circle>; })}<text x="500" y="430" textAnchor="middle">{t.gap}</text><text x="22" y="210" textAnchor="middle" transform="rotate(-90 22 210)">{t.potential}</text></svg></div>
        <div className="personal-rankings">{([
          { label: t.opportunities, items: opportunities },
          { label: t.strongest, items: strength },
          { label: t.weaknesses, items: weakness }
        ] satisfies { label: string; items: PersonalChartStat[] }[]).map(group => <section key={group.label}><h3>{group.label}</h3><ol>{group.items.map(stat => <li key={stat.key}><button type="button" onClick={() => selectStat(stat)}><span><strong>{stat.record.title}</strong><small>{stat.record.internalLevelValue?.toFixed(1)} · {stat.record.achievementRate.toFixed(4)}%</small></span><b>{stat.personalGap >= 0 ? "+" : ""}{stat.personalGap.toFixed(3)}%</b><em>+{stat.ratingPotential} RA</em></button></li>)}</ol></section>)}</div>
      </> : <div className="song-research-empty"><p>{t.needData}</p><Link href="/">{t.back}</Link></div>}</section> : null}
    </>}
    {selected ? <div className="song-detail-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><section className="song-public-dialog" role="dialog" aria-modal="true" aria-labelledby="song-public-title"><button className="song-public-close" type="button" aria-label={t.close} onClick={() => setSelected(null)}>×</button><header><SongCover record={sheetRecord(selected, selectedScore)} assets={emptyAssets}/><div><span>{selected.version}</span><h2 id="song-public-title">{selected.title}</h2><p>{t.songId}: {selected.songId}</p></div></header><div className="song-public-chart-strip">{siblings.map(sheet => { const score = scoreFor(sheet); return <button type="button" className={sheet.sheetId === selected.sheetId ? "selected" : ""} key={sheet.sheetId} onClick={() => setSelected(sheet)}><span>{sheet.type.toUpperCase()} · {sheet.difficulty.toUpperCase()}</span><strong>{sheet.internalLevelValue.toFixed(1)}</strong><small>Lv {sheet.level}</small>{score ? <b>{score.achievementRate.toFixed(4)}%</b> : <em>{t.unobserved}</em>}</button>; })}</div>{selectedScore ? <div className="song-public-score"><span>{t.yourScore}</span><strong>{selectedScore.achievementRate.toFixed(4)}%</strong><small>{[selectedScore.comboFlag, selectedScore.syncFlag].filter(Boolean).join(" · ") || t.achievement}</small></div> : null}</section></div> : null}
  </main>;
}
