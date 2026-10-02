"use client";

import { useMemo, useState } from "react";
import { iidxLevelSummaries, iidxReviewCandidates, type InsightScore } from "../lib/rhythm-insights";
import type { LanguageId } from "../lib/types";

interface Props {
  records: InsightScore[];
  language: LanguageId;
  onFilterRecords?: (style: string, level: string) => void;
}

export default function IidxInsights({ records, language, onFilterRecords }: Props) {
  const styles = useMemo(() => [...new Set(records.map((record) => record.style?.toUpperCase()).filter((value): value is string => Boolean(value)))].sort(), [records]);
  const [requestedStyle, setRequestedStyle] = useState("SP");
  const style = styles.includes(requestedStyle) ? requestedStyle : styles[0] ?? "";
  const summaries = useMemo(() => iidxLevelSummaries(records, style), [records, style]);
  const levels = summaries.map((summary) => summary.level);
  const [requestedLevel, setRequestedLevel] = useState("");
  const level = requestedLevel && levels.includes(requestedLevel) ? requestedLevel : levels[0] ?? "";
  const candidates = useMemo(() => iidxReviewCandidates(records, { style, level }), [level, records, style]);
  const selected = summaries.find((summary) => summary.level === level);
  const percent = (value: number, total = selected?.count ?? 0) => total ? `${Math.round(value / total * 100)}%` : "—";
  const t = language === "zh-Hant" ? {
    title: "IIDX 補燈工作台", subtitle: "只使用官方 CSV／頁面提供的 DJ LEVEL 與 Clear Lamp", level: "等級", played: "已遊玩", aaa: "AAA", hard: "HARD 以上", clear: "通關率", failed: "FAILED", candidates: "優先複習譜面", filter: "在記錄中查看", empty: "目前沒有可辨識的 IIDX 譜面資料。", note: "候選優先列出所選等級中燈況較弱的譜面；不在缺少物量時猜測 AAA 差值或 BPI。"
  } : language === "ja" ? {
    title: "IIDX ランプ更新ワークベンチ", subtitle: "公式CSV／ページのDJ LEVELとクリアランプのみ使用", level: "レベル", played: "プレー済み", aaa: "AAA", hard: "HARD以上", clear: "クリア率", failed: "FAILED", candidates: "優先復習譜面", filter: "記録で表示", empty: "認識できるIIDX譜面データがありません。", note: "選択レベルでランプが弱い譜面を優先します。ノーツ数がない場合、AAA差分やBPIは推測しません。"
  } : {
    title: "IIDX lamp workbench", subtitle: "Uses only DJ LEVEL and clear lamps supplied by the official CSV or page", level: "Level", played: "Played", aaa: "AAA", hard: "HARD or better", clear: "Clear rate", failed: "FAILED", candidates: "Priority review charts", filter: "Show in records", empty: "No recognizable IIDX chart data is available.", note: "Candidates prioritize weaker lamps at the selected level. AAA gaps and BPI are not guessed without note counts."
  };

  if (!summaries.length) return <section className="iidx-insights"><header><div><span>{t.subtitle}</span><h2>{t.title}</h2></div></header><p>{t.empty}</p></section>;
  return <section className="iidx-insights">
    <header><div><span>{t.subtitle}</span><h2>{t.title}</h2></div><div className="iidx-controls">
      <div role="group" aria-label="IIDX play style">{styles.map((entry) => <button type="button" key={entry} aria-pressed={style === entry} onClick={() => { setRequestedStyle(entry); setRequestedLevel(""); }}>{entry}</button>)}</div>
      <label><span>{t.level}</span><select value={level} onChange={(event) => setRequestedLevel(event.target.value)}>{levels.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
    </div></header>
    {selected ? <div className="iidx-metrics">
      <span><small>{t.played}</small><strong>{selected.count}</strong></span>
      <span><small>{t.aaa}</small><strong>{selected.aaa}<i>{percent(selected.aaa)}</i></strong></span>
      <span><small>{t.hard}</small><strong>{selected.hardOrBetter}<i>{percent(selected.hardOrBetter)}</i></strong></span>
      <span><small>{t.clear}</small><strong>{percent(selected.cleared)}</strong></span>
      <span><small>{t.failed}</small><strong>{selected.failed}</strong></span>
    </div> : null}
    <div className="iidx-level-strip">{summaries.map((summary) => <button type="button" key={summary.level} aria-pressed={summary.level === level} onClick={() => setRequestedLevel(summary.level)}><b>Lv {summary.level}</b><span>{summary.hardOrBetter}/{summary.count} HARD+</span><i style={{ width: `${summary.count ? summary.hardOrBetter / summary.count * 100 : 0}%` }} /></button>)}</div>
    <div className="iidx-candidate-heading"><div><h3>{t.candidates}</h3><p>{t.note}</p></div>{onFilterRecords ? <button type="button" onClick={() => onFilterRecords(style, level)}>{t.filter}</button> : null}</div>
    <div className="iidx-candidates">{candidates.map((record) => <article key={record.id}><div><strong>{record.title}</strong><small>{record.difficulty} · Lv {record.level}</small></div><span>{record.grade || "—"}</span><b>{record.clear || "—"}</b></article>)}</div>
  </section>;
}
