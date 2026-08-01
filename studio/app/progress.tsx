"use client";

import { useMemo, useState } from "react";
import { chartKey, diffHistory, type HistoryEntry } from "../lib/history";
import {
  buildChartHistory,
  buildRatingTimeline,
  buildUpgradeTargets,
  listHistoryCharts,
  periodDelta,
  snapshotProvenance,
  type RatingTimelinePoint
} from "../lib/insights";
import { studioCopy } from "../lib/i18n";
import type { LanguageId, StudioData } from "../lib/types";

interface ProgressDashboardProps {
  data: StudioData | null;
  history: HistoryEntry[];
  language: LanguageId;
}

// chartKey deliberately contains a NUL separator. Encode it before putting it
// into an HTML option value: browsers normalize NULs in DOM strings.
const chartOptionKey = (record: Parameters<typeof chartKey>[0]) => encodeURIComponent(chartKey(record));

function signed(value: number | undefined) {
  if (value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${value}`;
}

function Sparkline({
  timeline,
  field
}: {
  timeline: RatingTimelinePoint[];
  field: "b15" | "b35" | "b50";
}) {
  if (timeline.length < 2) return <div className="sparkline-empty">—</div>;
  const values = timeline.map((point) => point[field]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : 2 + index / (values.length - 1) * 96;
    const y = 31 - (value - min) / range * 26;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} />
      <circle cx="98" cy={31 - (values.at(-1)! - min) / range * 26} r="2" />
    </svg>
  );
}

export default function ProgressDashboard({ data, history, language }: ProgressDashboardProps) {
  const copy = studioCopy(language);
  const timeline = useMemo(() => buildRatingTimeline(history), [history]);
  const charts = useMemo(() => listHistoryCharts(history), [history]);
  const [selectedKey, setSelectedKey] = useState("");
  const activeOptionKey = selectedKey || (charts[0] ? chartOptionKey(charts[0]) : "");
  const activeKey = activeOptionKey ? decodeURIComponent(activeOptionKey) : "";
  const activeChart = charts.find((chart) => chartKey(chart) === activeKey);
  const chartHistory = useMemo(
    () => activeKey ? buildChartHistory(history, activeKey) : [],
    [history, activeKey]
  );
  const targets = useMemo(() => data ? buildUpgradeTargets(data) : [], [data]);
  const latest = history[0];
  const latestDiff = history.length > 1 ? diffHistory(history[1], history[0]) : undefined;
  const provenance = latest ? snapshotProvenance(latest) : undefined;

  if (!latest) {
    return (
      <section className="progress-empty-state">
        <span>↗</span>
        <h1>{copy.progressHeading}</h1>
        <p>{copy.progressEmpty}</p>
      </section>
    );
  }

  const latestPoint = timeline.at(-1)!;
  const metrics = [
    { label: "B50", field: "b50" as const, value: latestPoint.b50 },
    { label: "New B15", field: "b15" as const, value: latestPoint.b15 },
    { label: "Old B35", field: "b35" as const, value: latestPoint.b35 }
  ];

  return (
    <section className="progress-dashboard">
      <header className="progress-header">
        <div>
          <span>{history.length} {copy.observedSnapshots}</span>
          <h1>{copy.progressHeading}</h1>
        </div>
        <time dateTime={latest.generatedAt}>{copy.observedAt}: {new Date(latest.generatedAt).toLocaleString(language)}</time>
      </header>

      <div className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.field}>
            <div className="metric-label"><span>{metric.label}</span><small>{copy.last30Days} {signed(periodDelta(timeline, metric.field, 30))}</small></div>
            <strong>{metric.value}</strong>
            <Sparkline timeline={timeline} field={metric.field} />
            <footer>{copy.allTime} <b className={(periodDelta(timeline, metric.field) ?? 0) >= 0 ? "up" : "down"}>{signed(periodDelta(timeline, metric.field))}</b></footer>
          </article>
        ))}
      </div>

      <div className="insight-grid">
        <article className="insight-panel upgrade-panel">
          <header><div><h2>{copy.upgradeTargets}</h2><p>{copy.upgradeDescription}</p></div></header>
          {targets.length === 0 ? <p className="panel-empty">{copy.noUpgradeTargets}</p> : (
            <ol className="upgrade-list">
              {targets.map((target) => (
                <li key={target.key}>
                  <div className="upgrade-rank">+{target.ratingGain}</div>
                  <div className="upgrade-song">
                    <strong>{target.record.title}</strong>
                    <span>{target.record.type.toUpperCase()} · {target.record.difficulty.toUpperCase()} · {target.record.displayedLevel}</span>
                  </div>
                  <dl>
                    <div><dt>{copy.target}</dt><dd>{target.targetAchievement.toFixed(target.targetAchievement % 1 ? 1 : 0)}%</dd></div>
                    <div><dt>{copy.needed}</dt><dd>+{target.achievementNeeded.toFixed(4)}%</dd></div>
                    <div><dt>{copy.theoretical}</dt><dd>+{target.theoreticalGain}</dd></div>
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="insight-panel chart-history-panel">
          <header>
            <div><h2>{copy.chartHistory}</h2><p>{copy.chartHistoryDescription}</p></div>
            <select aria-label={copy.selectChart} value={activeOptionKey} onChange={(event) => setSelectedKey(event.target.value)}>
              {charts.map((chart) => <option key={chartOptionKey(chart)} value={chartOptionKey(chart)}>{chart.title} · {chart.difficulty}</option>)}
            </select>
          </header>
          {activeChart && <div className="selected-chart"><strong>{activeChart.title}</strong><span>{activeChart.type.toUpperCase()} · {activeChart.difficulty.toUpperCase()}</span></div>}
          <div className="chart-history-table" role="table" aria-label={copy.chartHistory}>
            <div className="chart-history-head" role="row">
              <span role="columnheader">{copy.observedAt}</span>
              <span role="columnheader">{copy.achievement}</span>
              <span role="columnheader">{copy.chartRating}</span>
              <span role="columnheader">Δ</span>
            </div>
            {chartHistory.map((point, index) => {
              const previous = chartHistory[index - 1];
              const delta = previous ? point.chartRating - previous.chartRating : undefined;
              return (
                <div role="row" key={point.observedAt}>
                  <time role="cell" dateTime={point.observedAt}>{new Date(point.observedAt).toLocaleDateString(language)}</time>
                  <span role="cell">{point.achievementRate.toFixed(4)}%</span>
                  <strong role="cell">{point.chartRating}</strong>
                  <span role="cell" className={(delta ?? 0) > 0 ? "up" : delta && delta < 0 ? "down" : ""}>{signed(delta)}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="insight-panel change-panel">
          <header><div><h2>{copy.latestChanges}</h2><p>{copy.latestChangesDescription}</p></div></header>
          {!latestDiff || (!latestDiff.entered.length && !latestDiff.left.length && !latestDiff.changed.length)
            ? <p className="panel-empty">{copy.noChanges}</p>
            : <div className="change-summary">
              <span><strong className="up">{signed(latestDiff.ratingDelta)}</strong>{copy.ratingGain}</span>
              <span><strong>{latestDiff.entered.length}</strong>{copy.enteredB50}</span>
              <span><strong>{latestDiff.left.length}</strong>{copy.leftB50}</span>
              <span><strong>{latestDiff.changed.length}</strong>{copy.improvedCharts}</span>
            </div>}
        </article>

        <article className="insight-panel provenance-panel">
          <header><div><h2>{copy.sourceDetails}</h2><p>{copy.sourceDetailsDescription}</p></div></header>
          {provenance && <dl>
            <div><dt>{copy.observedAt}</dt><dd>{new Date(provenance.observedAt).toLocaleString(language)}</dd></div>
            <div><dt>{copy.importedAt}</dt><dd>{new Date(provenance.importedAt).toLocaleString(language)}</dd></div>
            <div><dt>{copy.sourceLabel}</dt><dd>{provenance.source}</dd></div>
            <div><dt>{copy.sourceSchema}</dt><dd>{provenance.sourceSchema}</dd></div>
            <div><dt>{copy.ratingModel}</dt><dd>{provenance.ratingModel}</dd></div>
          </dl>}
        </article>
      </div>
    </section>
  );
}
