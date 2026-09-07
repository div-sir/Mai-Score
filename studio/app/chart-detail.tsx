"use client";

import { useState } from "react";
import { buildChartHistory, calculateInsightRating } from "../lib/insights";
import type { HistoryEntry } from "../lib/history";
import type { LanguageId, StudioChartRecord } from "../lib/types";

export default function ChartDetail({ record, records, history, language }: {
  record: StudioChartRecord; records: StudioChartRecord[]; history: HistoryEntry[]; language: LanguageId;
}) {
  const [open, setOpen] = useState(false);
  const copy = language === "zh-Hant"
    ? { details: "單曲詳情", charts: "已收集的各難度", history: "B50 觀測歷史", empty: "沒有此譜面的 B50 歷史；不代表未曾遊玩。", target: "目標達成率／單譜 Rating" }
    : language === "ja"
      ? { details: "楽曲詳細", charts: "取得済みの難易度", history: "B50 観測履歴", empty: "B50 履歴がありません。未プレイを意味しません。", target: "目標達成率／譜面 Rating" }
      : { details: "Song details", charts: "Collected difficulties", history: "B50 observation history", empty: "No B50 history for this chart. This does not mean it was unplayed.", target: "Target achievement / chart Rating" };
  const points = open ? buildChartHistory(history, JSON.stringify([record.title, record.type, record.difficulty])) : [];
  const siblings = open ? records.filter(r => r.type === record.type && (record.songId && r.songId ? record.songId === r.songId : r.title === record.title)) : [];
  return <details className="chart-detail" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{copy.details}</summary>
    {open && <div>
      <p>{record.version ?? "—"} · {record.internalLevelValue ?? "—"}</p>
      <h3>{copy.charts}</h3>
      <ul>{siblings.map(r => <li key={r.chartId ?? `${r.type}-${r.difficulty}`}>{r.difficulty.toUpperCase()} · {r.displayedLevel} · {r.achievementRate.toFixed(4)}% · {[r.comboFlag, r.syncFlag].filter(Boolean).join(" / ")}</li>)}</ul>
      {record.internalLevelValue !== undefined && <><h3>{copy.target}</h3><ul>{[100, 100.5].filter(value => value >= record.achievementRate).map(value => <li key={value}>{value}% → {calculateInsightRating(record.internalLevelValue!, value)}</li>)}</ul></>}
      <h3>{copy.history}</h3>
      {points.length ? <ul>{points.map(point => <li key={point.observedAt}><time dateTime={point.observedAt}>{new Date(point.observedAt).toLocaleDateString(language)}</time> · {point.achievementRate.toFixed(4)}% · {point.chartRating}</li>)}</ul> : <p>{copy.empty}</p>}
    </div>}
  </details>;
}
