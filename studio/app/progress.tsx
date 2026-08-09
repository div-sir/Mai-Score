"use client";

import { useMemo, useState } from "react";
import { chartKey, diffHistory, type HistoryEntry } from "../lib/history";
import {
  ACHIEVEMENT_TARGETS,
  buildB50Cutoffs,
  buildChartHistory,
  buildEntryCandidates,
  buildLevelCompletion,
  buildRatingTimeline,
  buildUpgradeTargets,
  listHistoryCharts,
  periodDelta,
  simulateWhatIf,
  snapshotProvenance
} from "../lib/insights";
import { achievementRank } from "../lib/achievement-rank";
import { studioCopy } from "../lib/i18n";
import type { LanguageId, StudioAssets, StudioChartRecord, StudioData, StudioRecord } from "../lib/types";
import TimelineChart from "./timeline-chart";

interface ProgressDashboardProps {
  data: StudioData | null;
  assets: StudioAssets;
  history: HistoryEntry[];
  language: LanguageId;
}

function coverSource(record: StudioChartRecord, assets: StudioAssets) {
  if (!record.imageName) return undefined;
  return assets.covers[record.imageName]
    ?? `/api/asset?url=${encodeURIComponent(`https://shama.dxrating.net/images/cover/v2/${record.imageName}.jpg`)}`;
}

function SongCover({ record, assets }: { record: StudioChartRecord; assets: StudioAssets }) {
  const source = coverSource(record, assets);
  return (
    <div className="upgrade-cover" aria-hidden="true">
      <span>♪</span>
      {source ? <img src={source} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
    </div>
  );
}

function signed(value: number | undefined) {
  if (value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${value}`;
}

const achievementLabel = (value: number) => `${value.toFixed(value % 1 ? 1 : 0)}%`;

export default function ProgressDashboard({ data, assets, history, language }: ProgressDashboardProps) {
  const copy = studioCopy(language);
  const plateLabel = { kiwami: "極", shou: language === "zh-Hant" ? "將" : "将", kami: "神", maimai: "舞舞" } as const;
  const timeline = useMemo(() => buildRatingTimeline(history), [history]);
  const charts = useMemo(() => listHistoryCharts(history), [history]);
  const [selectedKey, setSelectedKey] = useState("");
  const [chartQuery, setChartQuery] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [level, setLevel] = useState("all");
  const [simulationKey, setSimulationKey] = useState("");
  const [simulationAchievement, setSimulationAchievement] = useState(100.5);
  const [fullLevel, setFullLevel] = useState("");
  const [fullDifficulty, setFullDifficulty] = useState("all");
  const [fullQuery, setFullQuery] = useState("");

  const activeKey = selectedKey || (charts[0] ? chartKey(charts[0]) : "");
  const activeChart = charts.find((chart) => chartKey(chart) === activeKey);
  const chartHistory = useMemo(
    () => activeKey ? buildChartHistory(history, activeKey) : [],
    [history, activeKey]
  );
  const searchResults = useMemo(() => {
    const query = chartQuery.trim().toLocaleLowerCase(language);
    return charts.filter((chart) => !query || `${chart.title} ${chart.difficulty} ${chart.displayedLevel}`.toLocaleLowerCase(language).includes(query));
  }, [charts, chartQuery, language]);

  const allTargets = useMemo(() => data ? buildUpgradeTargets(data, 50) : [], [data]);
  const levels = useMemo(() => [...new Set(allTargets.map((target) => target.record.displayedLevel))]
    .sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b) || a.localeCompare(b)), [allTargets]);
  const targets = allTargets.filter((target) =>
    (difficulty === "all" || target.record.difficulty === difficulty)
    && (level === "all" || target.record.displayedLevel === level)
  ).slice(0, 8);
  const cutoffs = useMemo(() => data ? buildB50Cutoffs(data) : undefined, [data]);
  const entryCandidates = useMemo(() => data ? buildEntryCandidates(data) : [], [data]);
  const simulationRecords = useMemo(() => (data?.records ?? [])
    .filter((record) => Number.isFinite(Number(record.internalLevelValue)))
    .sort((a, b) => a.title.localeCompare(b.title)), [data]);
  const simulationRecord = data?.records.find((record) => chartKey(record) === simulationKey)
    ?? simulationRecords[0];
  const effectiveSimulationAchievement = simulationRecord
    ? Math.min(100.5, Math.max(simulationRecord.achievementRate, simulationAchievement))
    : simulationAchievement;
  const simulation = data && simulationRecord
    ? simulateWhatIf(data, simulationRecord, effectiveSimulationAchievement)
    : undefined;
  const latest = history[0];
  const latestDiff = history.length > 1 ? diffHistory(history[1], history[0]) : undefined;
  const provenance = latest ? snapshotProvenance(latest) : undefined;
  const levelCompletion = useMemo(() => buildLevelCompletion(data?.fullRecords ?? []), [data]);
  const effectiveFullLevel = fullLevel && levelCompletion.some((entry) => entry.level === fullLevel)
    ? fullLevel
    : levelCompletion.at(-1)?.level ?? "all";
  const visibleFullRecords = useMemo(() => {
    const query = fullQuery.trim().toLocaleLowerCase(language);
    return (data?.fullRecords ?? []).filter((record) =>
      (effectiveFullLevel === "all" || record.displayedLevel === effectiveFullLevel)
      && (fullDifficulty === "all" || record.difficulty === fullDifficulty)
      && (!query || `${record.title} ${record.type} ${record.difficulty}`.toLocaleLowerCase(language).includes(query))
    ).sort((a, b) => b.achievementRate - a.achievementRate || a.title.localeCompare(b.title));
  }, [data, effectiveFullLevel, fullDifficulty, fullQuery, language]);
  const visibleCompletion = useMemo(() => visibleFullRecords.reduce((summary, record) => ({
    total: summary.total + 1,
    sss: summary.sss + (record.achievementRate >= 100 ? 1 : 0),
    sssPlus: summary.sssPlus + (record.achievementRate >= 100.5 ? 1 : 0),
    fullCombo: summary.fullCombo + (record.comboFlag ? 1 : 0),
    allPerfect: summary.allPerfect + (record.comboFlag === "ap" || record.comboFlag === "ap+" ? 1 : 0),
    fullSync: summary.fullSync + (record.syncFlag ? 1 : 0)
  }), { total: 0, sss: 0, sssPlus: 0, fullCombo: 0, allPerfect: 0, fullSync: 0 }), [visibleFullRecords]);

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

  const selectSimulation = (record: StudioRecord) => {
    setSimulationKey(chartKey(record));
    const next = ACHIEVEMENT_TARGETS.find((target) => target > record.achievementRate + 0.00005) ?? 100.5;
    setSimulationAchievement(next);
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

      {data?.fullRecords?.length ? <article className="insight-panel full-records-panel">
        <header>
          <div><h2>{copy.levelCompletion}</h2><p>{copy.levelCompletionDescription}</p></div>
          <div className="target-filters">
            <label>{copy.levelFilter}<select value={effectiveFullLevel} onChange={(event) => setFullLevel(event.target.value)}>
              <option value="all">{copy.all}</option>
              {levelCompletion.map((entry) => <option key={entry.level} value={entry.level}>{entry.level} · {entry.total}</option>)}
            </select></label>
            <label>{copy.difficultyFilter}<select value={fullDifficulty} onChange={(event) => setFullDifficulty(event.target.value)}>
              <option value="all">{copy.all}</option><option value="expert">EXPERT</option><option value="master">MASTER</option><option value="remaster">Re:MASTER</option>
            </select></label>
            <label>{copy.searchCharts}<input value={fullQuery} onChange={(event) => setFullQuery(event.target.value)} placeholder={copy.searchCharts} /></label>
          </div>
        </header>
        <div className="completion-summary">
          <span><b>{visibleFullRecords.length}</b>{copy.charts}</span>
          <span><b>{visibleCompletion.sss}</b>SSS</span>
          <span><b>{visibleCompletion.sssPlus}</b>SSS+</span>
          <span><b>{visibleCompletion.fullCombo}</b>FC / AP</span>
          <span><b>{visibleCompletion.allPerfect}</b>AP</span>
          <span><b>{visibleCompletion.fullSync}</b>FS / FDX</span>
        </div>
        <div className="completion-grid">
          {visibleFullRecords.map((record) => <article key={record.chartId ?? `${record.title}-${record.type}-${record.difficulty}`}>
            <SongCover record={record} assets={assets} />
            <div><strong>{record.title}</strong><span>{record.type.toUpperCase()} · {record.difficulty.toUpperCase()} · {record.displayedLevel}</span></div>
            <div className="completion-result"><b>{record.achievementRate.toFixed(4)}%</b><span>{achievementRank(record.achievementRate).toUpperCase()} {[record.comboFlag, record.syncFlag].filter(Boolean).join(" · ")}</span></div>
          </article>)}
        </div>
      </article> : null}

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
                  </div>
                  <dl>
                    <div><dt>{copy.needed}</dt><dd>+{target.achievementNeeded.toFixed(4)}%</dd></div>
                    <div><dt>{copy.to100}</dt><dd className="up">+{target.gainTo100}</dd></div>
                    <div><dt>{copy.to1005}</dt><dd className="up">+{target.gainTo1005}</dd></div>
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="insight-panel what-if-panel">
          <header><div><h2>{copy.simulate}</h2><p>{copy.simulateDescription}</p></div></header>
          {simulationRecord && simulation ? <>
            <label className="simulation-chart-picker">
              <span>{copy.selectChart}</span>
              <select value={chartKey(simulationRecord)} onChange={(event) => {
                const record = simulationRecords.find((candidate) => chartKey(candidate) === event.target.value);
                if (record) selectSimulation(record);
              }}>
                {simulationRecords.map((record) => <option key={chartKey(record)} value={chartKey(record)}>
                  {record.title} · {record.difficulty.toUpperCase()} {record.displayedLevel}
                </option>)}
              </select>
            </label>
            <div className="simulated-song"><SongCover record={simulationRecord} assets={assets} /><div><strong>{simulationRecord.title}</strong><span>{copy.current}: {achievementLabel(simulationRecord.achievementRate)} · {simulation.currentChartRating} Rating</span></div></div>
            <div className="simulation-presets" aria-label={copy.quickTargets}>
              {ACHIEVEMENT_TARGETS.filter((target) => target > simulationRecord.achievementRate + 0.00005).map((target) => (
                <button key={target} type="button" aria-pressed={Math.abs(effectiveSimulationAchievement - target) < 0.00005} onClick={() => setSimulationAchievement(target)}>
                  {achievementLabel(target)}
                </button>
              ))}
            </div>
            <label className="achievement-slider">
              <span>{copy.simulated}</span>
              <input
                className="achievement-number"
                type="number"
                min={simulationRecord.achievementRate}
                max="100.5"
                step="0.0001"
                value={effectiveSimulationAchievement.toFixed(4)}
                onChange={(event) => setSimulationAchievement(Number(event.target.value))}
              />
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
              <div className="simulation-impact"><span>{copy.b50Impact}</span><strong className={simulation.b50Delta >= 0 ? "up" : "down"}>{signed(simulation.b50Delta)}</strong></div>
              <div><span>B50</span><strong>{simulation.currentB50} → {simulation.simulatedB50}</strong></div>
            </div>
          </> : <p className="panel-empty">{copy.noUpgradeTargets}</p>}
        </article>

        <article className="insight-panel candidate-panel">
          <header><div><h2>{copy.potentialEntries}</h2><p>{copy.potentialEntriesDescription}</p></div></header>
          {entryCandidates.length ? <ol className="candidate-list">
            {entryCandidates.map((candidate) => <li key={candidate.key}>
              <SongCover record={candidate.record} assets={assets} />
              <div className="candidate-song">
                <strong>{candidate.record.title}</strong>
                <span>{candidate.record.type.toUpperCase()} · {candidate.record.difficulty.toUpperCase()} · {candidate.record.displayedLevel}</span>
              </div>
              <div className="candidate-goal">
                <small>{copy.needed}</small>
                <strong>+{candidate.achievementNeeded.toFixed(4)}%</strong>
                <span>→ {candidate.targetAchievement.toFixed(4)}%</span>
              </div>
              <div className="candidate-cutoff">
                <small>{candidate.record.bucket.toUpperCase()} {copy.cutoff}</small>
                <strong>{candidate.cutoff} → {candidate.cutoff + 1}</strong>
              </div>
            </li>)}
          </ol> : <p className="panel-empty">{copy.noEntryCandidates}</p>}
        </article>

        <article className="insight-panel cutoff-panel">
          <header><div><h2>{copy.atRisk}</h2><p>{copy.atRiskDescription}</p></div></header>
          {cutoffs ? <>
            <div className="cutoff-values"><span>New B15 <strong>{cutoffs.b15}</strong></span><span>Old B35 <strong>{cutoffs.b35}</strong></span></div>
            <ul className="risk-list">
              {cutoffs.atRisk.slice(0, 6).map((risk) => <li key={risk.key}>
                <SongCover record={risk.record} assets={assets} />
                <span><strong>{risk.record.title}</strong><small>{risk.record.bucket.toUpperCase()} · {copy.margin} +{risk.margin}</small></span>
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
          <select className="chart-history-select" value={activeKey} onChange={(event) => setSelectedKey(event.target.value)} aria-label={copy.selectChart}>
            {searchResults.map((chart) => <option key={chartKey(chart)} value={chartKey(chart)}>
              {chart.title} · {chart.difficulty.toUpperCase()} {chart.displayedLevel}
            </option>)}
          </select>
          {activeChart && <div className="selected-chart-summary">
            <SongCover record={activeChart} assets={assets} />
            <div><strong>{activeChart.title}</strong><span>{activeChart.type.toUpperCase()} · {activeChart.difficulty.toUpperCase()} · {activeChart.displayedLevel}</span></div>
            <b>{chartHistory.length}<small>{copy.observations}</small></b>
          </div>}
          <ol className="chart-history-list" aria-label={copy.chartHistory}>
            {chartHistory.map((point, index) => {
              const previous = chartHistory[index - 1];
              const delta = previous ? point.chartRating - previous.chartRating : undefined;
              return <li key={point.observedAt}>
                <time dateTime={point.observedAt}><strong>{new Date(point.observedAt).toLocaleDateString(language)}</strong><small>{new Date(point.observedAt).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })}</small></time>
                <span><small>{copy.achievement}</small><strong>{point.achievementRate.toFixed(4)}%</strong></span>
                <span><small>{copy.chartRating}</small><strong>{point.chartRating}</strong></span>
                <b className={(delta ?? 0) > 0 ? "up" : delta && delta < 0 ? "down" : ""}>{signed(delta)}</b>
              </li>;
            })}
          </ol>
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
          {provenance && <dl><div><dt>{copy.observedAt}</dt><dd>{new Date(provenance.observedAt).toLocaleString(language)}</dd></div><div><dt>{copy.importedAt}</dt><dd>{new Date(provenance.importedAt).toLocaleString(language)}</dd></div><div><dt>{copy.sourceLabel}</dt><dd>{provenance.source}</dd></div><div><dt>{copy.sourceSchema}</dt><dd>{provenance.sourceSchema}</dd></div><div><dt>{copy.ratingModel}</dt><dd>{provenance.ratingModel}</dd></div>{provenance.chartData && <div><dt>{copy.chartData}</dt><dd>{new Date(provenance.chartData.updateTime).toLocaleDateString(language)} · {provenance.chartData.sheets.toLocaleString(language)}</dd></div>}</dl>}
        </article>
      </div>
    </section>
  );
}
