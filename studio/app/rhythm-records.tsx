"use client";

import { useDeferredValue, useMemo, useState, type CSSProperties } from "react";
import type { RhythmRecordEnvelope } from "../../src/lib/rhythm-record";
import { rhythmGameLabel } from "../lib/generic-rhythm";
import type { LanguageId } from "../lib/types";

interface Props { data: RhythmRecordEnvelope; language: LanguageId; }

const labels = (language: LanguageId) => language === "zh-Hant" ? {
  charts: "已遊玩譜面", search: "搜尋歌曲或藝人", all: "全部難度", score: "分數", grade: "等級",
  clear: "通關狀態", miss: "MISS", empty: "沒有符合條件的譜面", imported: "匯入時間"
} : language === "ja" ? {
  charts: "プレー済み譜面", search: "曲名・アーティストを検索", all: "すべての難易度", score: "スコア", grade: "グレード",
  clear: "クリア", miss: "ミス", empty: "条件に一致する譜面がありません", imported: "インポート日時"
} : {
  charts: "Played charts", search: "Search songs or artists", all: "All difficulties", score: "Score", grade: "Grade",
  clear: "Clear", miss: "Miss", empty: "No charts match these filters", imported: "Imported"
};

export default function RhythmRecordsDashboard({ data, language }: Props) {
  const text = labels(language);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [difficulty, setDifficulty] = useState("all");
  const difficulties = useMemo(() => [...new Set(data.records.map((record) => record.chart.difficulty))].sort(), [data]);
  const records = useMemo(() => {
    const needle = deferredQuery.normalize("NFKC").toLocaleLowerCase();
    return data.records.filter((record) => (difficulty === "all" || record.chart.difficulty === difficulty)
      && (!needle || `${record.song.title} ${record.song.artist ?? ""}`.normalize("NFKC").toLocaleLowerCase().includes(needle)))
      .sort((a, b) => Number(b.result.rawScore ?? 0) - Number(a.result.rawScore ?? 0));
  }, [data, difficulty, deferredQuery]);
  const accent = data.source.game === "sound-voltex" ? "#ef4c88" : "#5a8cff";

  return <section className="rhythm-dashboard" style={{ "--rhythm-accent": accent } as CSSProperties}>
    <header className="rhythm-hero">
      <div><span>KONAMI / e-amusement</span><h1>{rhythmGameLabel(data.source.game)}</h1><p>{text.imported}: {new Date(data.generatedAt).toLocaleString(language)}</p></div>
      <div className="rhythm-count"><strong>{data.records.length.toLocaleString(language)}</strong><span>{text.charts}</span></div>
    </header>
    <div className="rhythm-filters">
      <input aria-label={text.search} type="search" value={query} placeholder={text.search} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label={text.all} value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
        <option value="all">{text.all}</option>{difficulties.map((entry) => <option key={entry}>{entry}</option>)}
      </select>
    </div>
    <div className="rhythm-results-heading"><strong>{records.length.toLocaleString(language)}</strong><span>/ {data.records.length.toLocaleString(language)}</span></div>
    {records.length ? <div className="rhythm-record-grid">{records.map((record) => <article key={record.recordId}>
      <span className="rhythm-difficulty">{record.chart.difficulty}</span>
      <div className="rhythm-song"><strong>{record.song.title}</strong><span>{record.song.artist || "—"}</span></div>
      <div className="rhythm-level">{record.chart.type ? <span>{record.chart.type}</span> : null}<strong>Lv {record.chart.level || "—"}</strong></div>
      <div className="rhythm-score"><span>{text.score}</span><strong>{Number(record.result.rawScore ?? 0).toLocaleString("en-US")}</strong></div>
      <dl>
        <div><dt>{text.grade}</dt><dd>{record.result.grade || "—"}</dd></div>
        <div><dt>{text.clear}</dt><dd>{record.result.clearStatus || "—"}</dd></div>
        <div><dt>{text.miss}</dt><dd>{record.result.missCount ?? "—"}</dd></div>
      </dl>
    </article>)}</div> : <div className="rhythm-empty">{text.empty}</div>}
  </section>;
}
