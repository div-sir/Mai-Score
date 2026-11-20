"use client";

import { useMemo } from "react";
import { buildDxScoreInsights } from "../lib/dx-score";
import type { LanguageId, StudioData } from "../lib/types";

export default function DxScoreInsightsPanel({ data, language }: { data: StudioData; language: LanguageId }) {
  const insights = useMemo(() => buildDxScoreInsights(data.recentPlays), [data.recentPlays]);
  const text = language === "zh-Hant" ? {
    eyebrow: "已收集的遊玩記錄", title: "DX 分分析", total: "最佳 DX 分合計", rate: "整體比例", charts: "涵蓋譜面", bests: "近期新紀錄",
    distribution: "DX 星級分布", upgrades: "最接近下一顆星", top: "最高 DX 分比例", points: "分即可達到", collected: "目前沒有可分析的 DX 分。重新收集 DX NET 遊玩記錄後會自動顯示。",
    note: "同一譜面只採用已收集到的最高分；這不是 DX NET 全曲歷史總計。"
  } : language === "ja" ? {
    eyebrow: "収集済みプレイ履歴", title: "DX スコア分析", total: "ベスト DX スコア合計", rate: "総合達成率", charts: "対象譜面", bests: "最近の自己ベスト",
    distribution: "DX 星分布", upgrades: "次の星に近い譜面", top: "DX スコア達成率上位", points: "点で到達", collected: "分析できる DX スコアがありません。DX NET のプレイ履歴を再収集すると表示されます。",
    note: "同一譜面は収集済みの最高点のみを使用します。DX NET の全履歴合計ではありません。"
  } : {
    eyebrow: "Collected play log", title: "DX Score insights", total: "Best DX Score total", rate: "Overall rate", charts: "Charts covered", bests: "Recent new bests",
    distribution: "DX star distribution", upgrades: "Closest to the next star", top: "Highest DX Score rates", points: "points to reach", collected: "No DX Scores are available yet. Collect the DX NET play log again to add them.",
    note: "Each chart uses its best collected score. This is not an all-time DX NET total."
  };

  if (!insights) return <article className="insight-panel dx-score-panel empty"><header><div><span>{text.eyebrow}</span><h2>{text.title}</h2></div></header><p className="panel-empty">{text.collected}</p></article>;
  const highestStarCount = insights.starCounts[5] ?? 0;
  return <article className="insight-panel dx-score-panel">
    <header><div><span>{text.eyebrow}</span><h2>{text.title}</h2></div><strong>{insights.totalScore.toLocaleString(language)}<small>/ {insights.totalMax.toLocaleString(language)}</small></strong></header>
    <div className="dx-score-metrics">
      <span><small>{text.rate}</small><strong>{insights.rate.toFixed(2)}%</strong></span>
      <span><small>{text.charts}</small><strong>{insights.chartCount.toLocaleString(language)}</strong></span>
      <span><small>{text.bests}</small><strong>{insights.recentBests.toLocaleString(language)}</strong></span>
      <span><small>5★</small><strong>{highestStarCount.toLocaleString(language)}</strong></span>
    </div>
    <div className="dx-score-sections">
      <section className="dx-star-distribution"><h3>{text.distribution}</h3><div>{insights.starCounts.map((count, stars) => {
        const width = insights.chartCount ? count / insights.chartCount * 100 : 0;
        return <span key={stars}><b>{stars ? `${stars}★` : "—"}</b><i><em style={{ width: `${width}%` }} /></i><strong>{count}</strong></span>;
      })}</div></section>
      <section className="dx-score-list"><h3>{text.upgrades}</h3>{insights.closestUpgrades.length ? <div>{insights.closestUpgrades.map((chart) => <article key={chart.key}><div><strong>{chart.play.title}</strong><small>{chart.play.type.toUpperCase()} · {chart.play.difficulty.toUpperCase()} · {chart.rate.toFixed(2)}%</small></div><b>+{chart.pointsNeeded} <small>{text.points} {chart.nextStars}★</small></b></article>)}</div> : <p>5★</p>}</section>
      <section className="dx-score-list"><h3>{text.top}</h3><div>{insights.topCharts.map((chart) => <article key={chart.key}><div><strong>{chart.play.title}</strong><small>{chart.play.type.toUpperCase()} · {chart.play.difficulty.toUpperCase()}</small></div><b>{chart.rate.toFixed(2)}% <small>{chart.stars}★</small></b></article>)}</div></section>
    </div>
    <p className="dx-score-note">{text.note}</p>
  </article>;
}
