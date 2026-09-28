"use client";

import { useDeferredValue, useMemo, useState, type CSSProperties } from "react";
import type { RhythmRecordEnvelope } from "../../src/lib/rhythm-record";
import { rhythmGameLabel } from "../lib/generic-rhythm";
import { scoresFromRhythmRecord } from "../lib/rhythm-insights";
import type { LanguageId } from "../lib/types";
import ScoreInsights from "./score-insights";

interface Props { data: RhythmRecordEnvelope; language: LanguageId; }

const labels = (language: LanguageId) => language === "zh-Hant" ? {
  charts: "已遊玩譜面", search: "搜尋歌曲或藝人", all: "全部難度", score: "分數", grade: "等級",
  clear: "通關狀態", miss: "MISS", empty: "沒有符合條件的譜面", imported: "匯入時間", flare: "Flare Skill", gauge: "Flare／量表", style: "模式",
  allLevels: "全部等級", allStyles: "全部模式", allClears: "全部通關狀態", sortScore: "分數高到低", sortLevel: "等級高到低", sortTitle: "曲名", reset: "重設篩選"
} : language === "ja" ? {
  charts: "プレー済み譜面", search: "曲名・アーティストを検索", all: "すべての難易度", score: "スコア", grade: "グレード",
  clear: "クリア", miss: "ミス", empty: "条件に一致する譜面がありません", imported: "インポート日時", flare: "フレアスキル", gauge: "フレア／ゲージ", style: "スタイル",
  allLevels: "すべてのレベル", allStyles: "すべてのスタイル", allClears: "すべてのクリア", sortScore: "スコア順", sortLevel: "レベル順", sortTitle: "曲名順", reset: "絞り込みを解除"
} : {
  charts: "Played charts", search: "Search songs or artists", all: "All difficulties", score: "Score", grade: "Grade",
  clear: "Clear", miss: "Miss", empty: "No charts match these filters", imported: "Imported", flare: "Flare Skill", gauge: "Flare / gauge", style: "Style",
  allLevels: "All levels", allStyles: "All styles", allClears: "All clear states", sortScore: "Score: high to low", sortLevel: "Level: high to low", sortTitle: "Song title", reset: "Reset filters"
};

const gameValue = (record: RhythmRecordEnvelope["records"][number], keys: string[]) => {
  for (const key of keys) {
    const value = record.gameSpecific?.[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return undefined;
};

export default function RhythmRecordsDashboard({ data, language }: Props) {
  const text = labels(language);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [difficulty, setDifficulty] = useState("all");
  const [level, setLevel] = useState("all");
  const [style, setStyle] = useState("all");
  const [clear, setClear] = useState("all");
  const [sort, setSort] = useState<"score" | "level" | "title">("score");
  const difficulties = useMemo(() => [...new Set(data.records.map((record) => record.chart.difficulty))].sort(), [data]);
  const levels = useMemo(() => [...new Set(data.records.flatMap((record) => record.chart.level ? [record.chart.level] : []))]
    .sort((left, right) => Number(left) - Number(right) || left.localeCompare(right)), [data]);
  const styles = useMemo(() => [...new Set(data.records.flatMap((record) => {
    const value = gameValue(record, ["playStyle", "style"]) ?? record.chart.type;
    return value ? [value] : [];
  }))].sort(), [data]);
  const clearStates = useMemo(() => [...new Set(data.records.flatMap((record) => {
    const value = gameValue(record, ["flareRank", "flareGauge", "danceGauge", "gauge"]) ?? record.result.clearStatus;
    return value ? [value] : [];
  }))].sort(), [data]);
  const records = useMemo(() => {
    const needle = deferredQuery.normalize("NFKC").toLocaleLowerCase();
    return data.records.filter((record) => {
      const recordStyle = gameValue(record, ["playStyle", "style"]) ?? record.chart.type;
      const recordClear = gameValue(record, ["flareRank", "flareGauge", "danceGauge", "gauge"]) ?? record.result.clearStatus;
      return (difficulty === "all" || record.chart.difficulty === difficulty)
        && (level === "all" || record.chart.level === level)
        && (style === "all" || recordStyle === style)
        && (clear === "all" || recordClear === clear)
        && (!needle || `${record.song.title} ${record.song.artist ?? ""}`.normalize("NFKC").toLocaleLowerCase().includes(needle));
    }).sort((left, right) => sort === "level"
      ? Number(right.chart.levelValue ?? right.chart.level ?? 0) - Number(left.chart.levelValue ?? left.chart.level ?? 0)
        || Number(right.result.rawScore ?? 0) - Number(left.result.rawScore ?? 0)
      : sort === "title" ? left.song.title.localeCompare(right.song.title, language)
        : Number(right.result.rawScore ?? 0) - Number(left.result.rawScore ?? 0));
  }, [clear, data, difficulty, deferredQuery, language, level, sort, style]);
  const isDdr = data.source.game === "dance-dance-revolution";
  const accent = data.source.game === "sound-voltex" ? "#ef4c88" : isDdr ? "#d8903f" : "#5a8cff";
  const insightRecords = useMemo(() => scoresFromRhythmRecord(data), [data]);

  return <section className="rhythm-dashboard" style={{ "--rhythm-accent": accent } as CSSProperties}>
    <header className="rhythm-hero">
      <div><span>KONAMI / e-amusement</span><h1>{rhythmGameLabel(data.source.game)}</h1><p>{text.imported}: {new Date(data.generatedAt).toLocaleString(language)}</p></div>
      <div className="rhythm-count"><strong>{data.records.length.toLocaleString(language)}</strong><span>{text.charts}</span></div>
    </header>
    {data.source.game === "sound-voltex" || isDdr ? <ScoreInsights key={data.source.game} game={data.source.game} records={insightRecords} language={language} generatedAt={data.generatedAt} /> : null}
    <div className="rhythm-filters">
      <input aria-label={text.search} type="search" value={query} placeholder={text.search} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label={text.all} value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
        <option value="all">{text.all}</option>{difficulties.map((entry) => <option key={entry}>{entry}</option>)}
      </select>
      <select aria-label={text.allLevels} value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">{text.allLevels}</option>{levels.map((entry) => <option key={entry}>{entry}</option>)}</select>
      <select aria-label={text.allStyles} value={style} onChange={(event) => setStyle(event.target.value)}><option value="all">{text.allStyles}</option>{styles.map((entry) => <option key={entry}>{entry}</option>)}</select>
      <select aria-label={text.allClears} value={clear} onChange={(event) => setClear(event.target.value)}><option value="all">{text.allClears}</option>{clearStates.map((entry) => <option key={entry}>{entry}</option>)}</select>
      <select aria-label={text.sortScore} value={sort} onChange={(event) => setSort(event.target.value as "score" | "level" | "title")}><option value="score">{text.sortScore}</option><option value="level">{text.sortLevel}</option><option value="title">{text.sortTitle}</option></select>
      <button type="button" disabled={!query && difficulty === "all" && level === "all" && style === "all" && clear === "all" && sort === "score"} onClick={() => { setQuery(""); setDifficulty("all"); setLevel("all"); setStyle("all"); setClear("all"); setSort("score"); }}>{text.reset}</button>
    </div>
    <div className="rhythm-results-heading"><strong>{records.length.toLocaleString(language)}</strong><span>/ {data.records.length.toLocaleString(language)}</span></div>
    {records.length ? <div className="rhythm-record-grid">{records.map((record) => {
      const flareSkill = gameValue(record, ["flareSkill", "flare_skill"])
        ?? (record.result.rating?.system.toLowerCase().includes("flare") ? String(record.result.rating.value) : undefined);
      const flareGauge = gameValue(record, ["flareRank", "flareGauge", "danceGauge", "gauge"]);
      const playStyle = gameValue(record, ["playStyle", "style"]) ?? record.chart.type;
      return <article key={record.recordId}>
      <span className="rhythm-difficulty">{record.chart.difficulty}</span>
      <div className="rhythm-song"><strong>{record.song.title}</strong><span>{record.song.artist || "—"}</span></div>
      <div className="rhythm-level">{record.chart.type ? <span>{record.chart.type}</span> : null}<strong>Lv {record.chart.level || "—"}</strong></div>
      <div className="rhythm-score"><span>{text.score}</span><strong>{Number(record.result.rawScore ?? 0).toLocaleString("en-US")}</strong></div>
      <dl>
        <div><dt>{isDdr ? text.flare : text.grade}</dt><dd>{isDdr ? flareSkill ?? "—" : record.result.grade || "—"}</dd></div>
        <div><dt>{isDdr ? text.gauge : text.clear}</dt><dd>{isDdr ? flareGauge ?? record.result.clearStatus ?? "—" : record.result.clearStatus || "—"}</dd></div>
        <div><dt>{isDdr ? text.style : text.miss}</dt><dd>{isDdr ? playStyle ?? "—" : record.result.missCount ?? "—"}</dd></div>
      </dl>
    </article>;})}</div> : <div className="rhythm-empty">{text.empty}</div>}
  </section>;
}
