"use client";

import { useMemo, useState } from "react";
import { chartKey, diffHistory, type HistoryEntry } from "../lib/history";
import {
  buildB50Cutoffs,
  buildChartHistory,
  buildRatingTimeline,
  buildUpgradeTargets,
  listHistoryCharts,
  periodDelta,
  simulateWhatIf,
  snapshotProvenance
} from "../lib/insights";
import { studioCopy } from "../lib/i18n";
import type { LanguageId, StudioAssets, StudioData, StudioRecord } from "../lib/types";
import TimelineChart from "./timeline-chart";

interface ProgressDashboardProps {
  data: StudioData | null;
  assets: StudioAssets;
  history: HistoryEntry[];
  language: LanguageId;
  onLocateRecord: (record: StudioRecord) => void;
  initialSelectedKey?: string;
}

function coverSource(record: StudioRecord, assets: StudioAssets) {
  if (!record.imageName) return undefined;
  return assets.covers[record.imageName]
    ?? `/api/asset?url=${encodeURIComponent(`https://shama.dxrating.net/images/cover/v2/${record.imageName}.jpg`)}`;
}

function SongCover({ record, assets }: { record: StudioRecord; assets: StudioAssets }) {
  const source = coverSource(record, assets);
  return (
    <div className="upgrade-cover" aria-hidden="true">
      <span>♪</span>
      {source ? <img src={source} alt="" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
    </div>
  );
}

function signed(value: number | undefined) {
  if (value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${value}`;
}

const achievementLabel = (value: number) => `${value.toFixed(value % 1 ? 1 : 0)}%`;

export default function ProgressDashboard({ data, assets, history, language, onLocateRecord, initialSelectedKey = "" }: ProgressDashboardProps) {
  const copy = studioCopy(language);
  const plateLabel = { kiwami: "極", shou: language === "zh-Hant" ? "將" : "将", kami: "神", maimai: "舞舞" } as const;
  const timeline = useMemo(() => buildRatingTimeline(history), [history]);
  const charts = useMemo(() => listHistoryCharts(history), [history]);
  const [selectedKey, setSelectedKey] = useState(initialSelectedKey);
  const [chartQuery, setChartQuery] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [level, setLevel] = useState("all");
  const [simulationKey, setSimulationKey] = useState("");
  const [simulationAchievement, setSimulationAchievement] = useState(100.5);

  const activeKey = selectedKey || (charts[0] ? chartKey(charts[0]) : "");
  const activeChart = charts.find((chart) => chartKey(chart) === activeKey);
  const activeCurrentRecord = data?.records.find((record) => chartKey(record) === activeKey);
  const chartHistory = useMemo(
    () => activeKey ? buildChartHistory(history, activeKey) : [],
    [history, activeKey]
  );
  const searchResults = useMemo(() => {
    const query = chartQuery.trim().toLocaleLowerCase(language);
    return charts.filter((chart) => !query || `${chart.title} ${chart.difficulty} ${chart.displayedLevel}`.toLocaleLowerCase(language).includes(query)).slice(0, 10);
  }, [charts, chartQuery, language]);

  const allTargets = useMemo(() => data ? buildUpgradeTargets(data, 50) : [], [data]);
  const levels = useMemo(() => [...new Set(allTargets.map((target) => target.record.displayedLevel))]
    .sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b) || a.localeCompare(b)), [allTargets]);
  const targets = allTargets.filter((target) =>
    (difficulty === "all" || target.record.difficulty === difficulty)
    && (level === "all" || target.record.displayedLevel === level)
  ).slice(0, 8);
  const cutoffs = useMemo(() => data ? buildB50Cutoffs(data) : undefined, [data]);
  const simulationRecord = data?.records.find((record) => chartKey(record) === simulationKey)
    ?? targets[0]?.record;
  const effectiveSimulationAchievement = simulationRecord
    ? Math.min(100.5, Math.max(simulationRecord.achievementRate, simulationAchievement))
    : simulationAchievement;
  const simulation = data && simulationRecord
    ? simulateWhatIf(data, simulationRecord, effectiveSimulationAchievement)
    : undefined;
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

  const selectSimulation = (record: StudioRecord, targetAchievement?: number) => {
    setSimulationKey(chartKey(record));
    setSimulationAchievement(Math.max(record.achievementRate, targetAchievement ?? record.achievementRate));
  };

  return (
    <section className="progress-dashboard">
      <header className="progress-header">
        <div><span>{history.length} {copy.observedSnapshots}</span><h1>{copy.progressHeading}</h1></div>
        <time dateTime={latest.generatedAt}>{copy.observedAt}: {new Date(latest.generatedAt).toLocaleString(language)}</time>
      </header>

      <TimelineChart timeline={timeline} language={language} title={copy.timeline} />

      <div className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.field}>
            <div className="metric-label"><span>{metric.label}</span><small>{copy.last30Days} {signed(periodDelta(timeline, metric.field, 30))}</small></div>
            <strong>{metric.value}</strong>
            <footer>{copy.allTime} <b className={(periodDelta(timeline, metric.field) ?? 0) >= 0 ? "up" : "down"}>{signed(periodDelta(timeline, metric.field))}</b></footer>
          </article>
        ))}
      </div>

      <div className="insight-grid">
        <article className="insight-panel upgrade-panel">
          <header>
            <div><h2>{copy.upgradeTargets}</h2><p>{copy.upgradeDescription}</p></div>
            <div className="target-filters">
              <label>{copy.difficultyFilter}<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                <option value="all">{copy.all}</option>
                <option value="expert">EXPERT</option><option value="master">MASTER</option><option value="remaster">Re:MASTER</option>
              </select></label>
              <label>{copy.levelFilter}<select value={level} onChange={(event) => setLevel(event.target.value)}>
                <option value="all">{copy.all}</option>
                {levels.map((value) => <option key={value} value={value}>{value}</option>)}
              </select></label>
            </div>
          </header>
          {targets.length === 0 ? <p className="panel-empty">{copy.noUpgradeTargets}</p> : (
            <ol className="upgrade-list">
              {targets.map((target) => (
                <li key={target.key}>
                  <SongCover record={target.record} assets={assets} />
                  <div className="upgrade-song">
                    <strong>{target.record.title}</strong>
                    <span>{target.record.type.toUpperCase()} · {target.record.difficulty.toUpperCase()} · {target.record.displayedLevel}</span>
                    <div className="row-actions">
                      <button type="button" onClick={() => selectSimulation(target.record, target.targetAchievement)}>{copy.simulate}</button>
                      <button type="button" onClick={() => onLocateRecord(target.record)}>{copy.viewInExport}</button>
                    </div>
                  </div>
                  <dl>
                    <div><dt>{copy.target}</dt><dd>{achievementLabel(target.targetAchievement)}</dd></div>
                    <div><dt>{copy.needed}</dt><dd>+{target.achievementNeeded.toFixed(4)}%</dd></div>
                    <div><dt>{copy.nextGain}</dt><dd className="up">+{target.ratingGain}</dd></div>
                    <div><dt>{copy.theoretical}</dt><dd>+{target.theoreticalGain}</dd></div>
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="insight-panel what-if-panel">
          <header><div><h2>{copy.simulate}</h2><p>{copy.simulateDescription}</p></div></header>
          {simulationRecord && simulation ? <>
            <div className="simulated-song"><SongCover record={simulationRecord} assets={assets} /><div><strong>{simulationRecord.title}</strong><span>{achievementLabel(simulationRecord.achievementRate)} · {simulation.currentChartRating}</span></div></div>
            <label className="achievement-slider">
              <span>{copy.simulated} <strong>{effectiveSimulationAchievement.toFixed(4)}%</strong></span>
              <input
                type="range"
                min={simulationRecord.achievementRate}
                max="100.5"
                step="0.0001"
                value={effectiveSimulationAchievement}
                onChange={(event) => setSimulationAchievement(Number(event.target.value))}
              />
            </label>
            <div className="simulation-results">
              <div><span>{copy.chartRating}</span><strong>{simulation.currentChartRating} → {simulation.simulatedChartRating}</strong></div>
              <div><span>{copy.b50Impact}</span><strong className={simulation.b50Delta >= 0 ? "up" : "down"}>{signed(simulation.b50Delta)}</strong></div>
              <div><span>B50</span><strong>{simulation.currentB50} → {simulation.simulatedB50}</strong></div>
            </div>
            <button className="inline-primary" type="button" onClick={() => onLocateRecord(simulationRecord)}>{copy.viewInExport}</button>
          </> : <p className="panel-empty">{copy.noUpgradeTargets}</p>}
        </article>

        <article className="insight-panel cutoff-panel">
          <header><div><h2>{copy.atRisk}</h2><p>{copy.atRiskDescription}</p></div></header>
          {cutoffs ? <>
            <div className="cutoff-values"><span>New B15 <strong>{cutoffs.b15}</strong></span><span>Old B35 <strong>{cutoffs.b35}</strong></span></div>
            <ul className="risk-list">
              {cutoffs.atRisk.slice(0, 6).map((risk) => <li key={risk.key}>
                <button type="button" onClick={() => onLocateRecord(risk.record)}>
                  <SongCover record={risk.record} assets={assets} />
                  <span><strong>{risk.record.title}</strong><small>{risk.record.bucket.toUpperCase()} · {copy.margin} +{risk.margin}</small></span>
                </button>
              </li>)}
            </ul>
          </> : null}
        </article>

        <article className="insight-panel chart-history-panel">
          <header><div><h2>{copy.chartHistory}</h2><p>{copy.chartHistoryDescription}</p></div></header>
          <input
            className="chart-search"
            type="search"
            value={chartQuery}
            placeholder={copy.searchCharts}
            aria-label={copy.searchCharts}
            onChange={(event) => setChartQuery(event.target.value)}
          />
          <div className="chart-search-results">
            {searchResults.map((chart) => <button
              type="button"
              key={chartKey(chart)}
              aria-pressed={chartKey(chart) === activeKey}
              onClick={() => setSelectedKey(chartKey(chart))}
            >{chart.title}<small>{chart.difficulty} · {chart.displayedLevel}</small></button>)}
          </div>
          {activeChart && <div className="selected-chart"><strong>{activeChart.title}</strong>{activeCurrentRecord
            ? <button type="button" onClick={() => onLocateRecord(activeCurrentRecord)}>{copy.viewInExport}</button>
            : null}</div>}
          <div className="chart-history-table" role="table" aria-label={copy.chartHistory}>
            <div className="chart-history-head" role="row"><span role="columnheader">{copy.observedAt}</span><span role="columnheader">{copy.achievement}</span><span role="columnheader">{copy.chartRating}</span><span role="columnheader">Δ</span></div>
            {chartHistory.map((point, index) => {
              const previous = chartHistory[index - 1];
              const delta = previous ? point.chartRating - previous.chartRating : undefined;
              return <div role="row" key={point.observedAt}>
                <time role="cell" dateTime={point.observedAt}>{new Date(point.observedAt).toLocaleDateString(language)}</time>
                <span role="cell">{point.achievementRate.toFixed(4)}%</span>
                <strong role="cell">{point.chartRating}</strong>
                <span role="cell" className={(delta ?? 0) > 0 ? "up" : delta && delta < 0 ? "down" : ""}>{signed(delta)}</span>
              </div>;
            })}
          </div>
        </article>

        <article className="insight-panel plate-panel">
          <header><div><h2>{copy.plateProgress}</h2></div></header>
          {data?.plateProgress?.length ? <div className="plate-grid">{data.plateProgress.map((plate) => {
            const percent = plate.total ? Math.min(100, plate.completed / plate.total * 100) : 0;
            return <div key={`${plate.kind}-${plate.version ?? "all"}`}><span>{plate.version ? `${plate.version} · ` : ""}{plateLabel[plate.kind]}</span><strong>{plate.completed} / {plate.total}</strong><i><b style={{ width: `${percent}%` }} /></i></div>;
          })}</div> : <p className="panel-empty">{copy.plateRequiresFull}</p>}
        </article>

        <article className="insight-panel change-panel">
          <header><div><h2>{copy.latestChanges}</h2><p>{copy.latestChangesDescription}</p></div></header>
          {!latestDiff || (!latestDiff.entered.length && !latestDiff.left.length && !latestDiff.changed.length)
            ? <p className="panel-empty">{copy.noChanges}</p>
            : <div className="change-summary"><span><strong className="up">{signed(latestDiff.ratingDelta)}</strong>{copy.ratingGain}</span><span><strong>{latestDiff.entered.length}</strong>{copy.enteredB50}</span><span><strong>{latestDiff.left.length}</strong>{copy.leftB50}</span><span><strong>{latestDiff.changed.length}</strong>{copy.improvedCharts}</span></div>}
        </article>

        <article className="insight-panel provenance-panel">
          <header><div><h2>{copy.sourceDetails}</h2><p>{copy.sourceDetailsDescription}</p></div></header>
          {provenance && <dl><div><dt>{copy.observedAt}</dt><dd>{new Date(provenance.observedAt).toLocaleString(language)}</dd></div><div><dt>{copy.importedAt}</dt><dd>{new Date(provenance.importedAt).toLocaleString(language)}</dd></div><div><dt>{copy.sourceLabel}</dt><dd>{provenance.source}</dd></div><div><dt>{copy.sourceSchema}</dt><dd>{provenance.sourceSchema}</dd></div><div><dt>{copy.ratingModel}</dt><dd>{provenance.ratingModel}</dd></div></dl>}
        </article>
      </div>
    </section>
  );
}
