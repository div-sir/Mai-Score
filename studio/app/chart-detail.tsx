"use client";

import { useState } from "react";
import { buildChartHistory, calculateInsightRating } from "../lib/insights";
import { chartKey, type HistoryEntry } from "../lib/history";
import type { LanguageId, StudioChartRecord } from "../lib/types";

function DifficultyCard({ record, selected, onSelect }: {
  record: StudioChartRecord;
  selected: boolean;
  onSelect?: (record: StudioChartRecord) => void;
}) {
  const content = <>
    <i aria-hidden="true"/><div><b>{record.difficulty.toUpperCase()}</b><small>Lv {record.displayedLevel}</small></div><strong>{record.achievementRate.toFixed(4)}%</strong><span>{record.chartRating?.toFixed(0) ?? "—"} RA</span>
  </>;
  const className = `difficulty-card difficulty-${record.difficulty}${selected ? " is-selected" : ""}`;
  return onSelect
    ? <button type="button" className={className} aria-pressed={selected} onClick={() => onSelect(record)}>{content}</button>
    : <article className={className}>{content}</article>;
}

export default function ChartDetail({ record, records, history, language, initiallyOpen = false, onSelectRecord }: {
  record: StudioChartRecord; records: StudioChartRecord[]; history: HistoryEntry[]; language: LanguageId; initiallyOpen?: boolean;
  onSelectRecord?: (record: StudioChartRecord) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const copy = language === "zh-Hant"
    ? { details: "單曲詳情", charts: "已收集的各難度", switchChart: "選擇難度即可在此視窗更新詳情。", history: "最佳成績觀測歷史", empty: "尚無此譜面的已儲存觀測記錄；不代表未曾遊玩。", target: "目標達成率／單譜 Rating", version: "收錄版本", constant: "譜面定數" }
    : language === "ja"
      ? { details: "楽曲詳細", charts: "取得済みの難易度", switchChart: "難易度を選ぶと、この画面の詳細が切り替わります。", history: "ベストスコア観測履歴", empty: "この譜面の保存済み観測記録はありません。未プレイを意味しません。", target: "目標達成率／譜面 Rating", version: "収録バージョン", constant: "譜面定数" }
      : { details: "Song details", charts: "Collected difficulties", switchChart: "Select a difficulty to update this window.", history: "Observed best history", empty: "No saved observation for this chart. This does not mean it was unplayed.", target: "Target achievement / chart Rating", version: "Game version", constant: "Chart constant" };
  const points = open ? buildChartHistory(history, JSON.stringify([record.title, record.type, record.difficulty])) : [];
  const siblings = open ? records.filter(r => r.type === record.type && (record.songId && r.songId ? record.songId === r.songId : r.title === record.title)) : [];
  return <details open={open} className="chart-detail" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{copy.details}</summary>
    {open ? <div className="chart-detail-content">
      <div className="chart-detail-facts"><span><small>{copy.version}</small><b>{record.version ?? "—"}</b></span><span><small>{copy.constant}</small><b>{record.internalLevelValue ?? "—"}</b></span><span><small>Flags</small><b>{[record.comboFlag, record.syncFlag].filter(Boolean).join(" · ") || "—"}</b></span></div>
      <h3>{copy.charts}</h3>
      {onSelectRecord && siblings.length > 1 ? <p className="difficulty-strip-hint">{copy.switchChart}</p> : null}
      <div className="difficulty-strip">{siblings.map(r => <DifficultyCard key={r.chartId ?? `${r.type}-${r.difficulty}`} record={r} selected={chartKey(r) === chartKey(record)} onSelect={onSelectRecord}/>)}</div>
      {record.internalLevelValue !== undefined ? <><h3>{copy.target}</h3><div className="chart-target-bars">{[100, 100.5].filter(value => value >= record.achievementRate).map(value => <div key={value}><span><b>{value}%</b><small>{calculateInsightRating(record.internalLevelValue!, value)} RA</small></span><i><b style={{ width: `${Math.min(100, value / 100.5 * 100)}%` }}/></i></div>)}</div></> : null}
      <h3>{copy.history}</h3>
      {points.length ? <ol className="chart-history-timeline">{points.map(point => <li key={point.observedAt}><i aria-hidden="true"/><time dateTime={point.observedAt}>{new Date(point.observedAt).toLocaleDateString(language)}</time><strong>{point.achievementRate.toFixed(4)}%</strong><span>{point.chartRating} RA</span></li>)}</ol> : <p className="chart-history-empty"><span aria-hidden="true">◇</span>{copy.empty}</p>}
    </div> : null}
  </details>;
}
