"use client";

import { useState } from "react";
import { buildChartHistory, calculateInsightRating } from "../lib/insights";
import type { HistoryEntry } from "../lib/history";
import type { LanguageId, StudioChartRecord } from "../lib/types";

export default function ChartDetail({ record, records, history, language, initiallyOpen = false }: {
  record: StudioChartRecord; records: StudioChartRecord[]; history: HistoryEntry[]; language: LanguageId; initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const copy = language === "zh-Hant"
    ? { details: "單曲詳情", charts: "已收集的各難度", history: "B50 觀測歷史", empty: "沒有此譜面的 B50 歷史；不代表未曾遊玩。", target: "目標達成率／單譜 Rating", version: "收錄版本", constant: "譜面定數" }
    : language === "ja"
      ? { details: "楽曲詳細", charts: "取得済みの難易度", history: "B50 観測履歴", empty: "B50 履歴がありません。未プレイを意味しません。", target: "目標達成率／譜面 Rating", version: "収録バージョン", constant: "譜面定数" }
      : { details: "Song details", charts: "Collected difficulties", history: "B50 observation history", empty: "No B50 history for this chart. This does not mean it was unplayed.", target: "Target achievement / chart Rating", version: "Game version", constant: "Chart constant" };
  const points = open ? buildChartHistory(history, JSON.stringify([record.title, record.type, record.difficulty])) : [];
  const siblings = open ? records.filter(r => r.type === record.type && (record.songId && r.songId ? record.songId === r.songId : r.title === record.title)) : [];
  return <details open={open} className="chart-detail" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{copy.details}</summary>
    {open ? <div className="chart-detail-content">
      <div className="chart-detail-facts"><span><small>{copy.version}</small><b>{record.version ?? "—"}</b></span><span><small>{copy.constant}</small><b>{record.internalLevelValue ?? "—"}</b></span><span><small>Flags</small><b>{[record.comboFlag, record.syncFlag].filter(Boolean).join(" · ") || "—"}</b></span></div>
      <h3>{copy.charts}</h3>
      <div className="difficulty-strip">{siblings.map(r => <article key={r.chartId ?? `${r.type}-${r.difficulty}`} className={`difficulty-${r.difficulty}`}>
        <i aria-hidden="true"/><div><b>{r.difficulty.toUpperCase()}</b><small>Lv {r.displayedLevel}</small></div><strong>{r.achievementRate.toFixed(4)}%</strong><span>{r.chartRating?.toFixed(0) ?? "—"} RA</span>
      </article>)}</div>
      {record.internalLevelValue !== undefined ? <><h3>{copy.target}</h3><div className="chart-target-bars">{[100, 100.5].filter(value => value >= record.achievementRate).map(value => <div key={value}><span><b>{value}%</b><small>{calculateInsightRating(record.internalLevelValue!, value)} RA</small></span><i><b style={{ width: `${Math.min(100, value / 100.5 * 100)}%` }}/></i></div>)}</div></> : null}
      <h3>{copy.history}</h3>
      {points.length ? <ol className="chart-history-timeline">{points.map(point => <li key={point.observedAt}><i aria-hidden="true"/><time dateTime={point.observedAt}>{new Date(point.observedAt).toLocaleDateString(language)}</time><strong>{point.achievementRate.toFixed(4)}%</strong><span>{point.chartRating} RA</span></li>)}</ol> : <p className="chart-history-empty"><span aria-hidden="true">◇</span>{copy.empty}</p>}
    </div> : null}
  </details>;
}
