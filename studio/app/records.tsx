"use client";

import { useMemo, useState } from "react";
import { achievementRank } from "../lib/achievement-rank";
import { buildLevelCompletion } from "../lib/insights";
import { studioCopy } from "../lib/i18n";
import { groupPlatesByVersion } from "../lib/plates";
import type { LanguageId, StudioAssets, StudioData } from "../lib/types";
import SongCover from "./song-cover";

interface RecordsDashboardProps {
  data: StudioData | null;
  assets: StudioAssets;
  language: LanguageId;
}

export default function RecordsDashboard({ data, assets, language }: RecordsDashboardProps) {
  const copy = studioCopy(language);
  const [level, setLevel] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [query, setQuery] = useState("");
  const levelCompletion = useMemo(() => buildLevelCompletion(data?.fullRecords ?? []), [data]);
  const effectiveLevel = level && levelCompletion.some((entry) => entry.level === level)
    ? level
    : levelCompletion.at(-1)?.level ?? "all";
  const visibleRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(language);
    return (data?.fullRecords ?? []).filter((record) =>
      (effectiveLevel === "all" || record.displayedLevel === effectiveLevel)
      && (difficulty === "all" || record.difficulty === difficulty)
      && (!normalizedQuery || `${record.title} ${record.type} ${record.difficulty}`.toLocaleLowerCase(language).includes(normalizedQuery))
    ).sort((a, b) => b.achievementRate - a.achievementRate || a.title.localeCompare(b.title));
  }, [data, effectiveLevel, difficulty, query, language]);
  const completion = useMemo(() => visibleRecords.reduce((summary, record) => ({
    total: summary.total + 1,
    sss: summary.sss + (record.achievementRate >= 100 ? 1 : 0),
    sssPlus: summary.sssPlus + (record.achievementRate >= 100.5 ? 1 : 0),
    fullCombo: summary.fullCombo + (record.comboFlag ? 1 : 0),
    allPerfect: summary.allPerfect + (record.comboFlag === "ap" || record.comboFlag === "ap+" ? 1 : 0),
    fullSync: summary.fullSync + (record.syncFlag ? 1 : 0)
  }), { total: 0, sss: 0, sssPlus: 0, fullCombo: 0, allPerfect: 0, fullSync: 0 }), [visibleRecords]);
  const plateGroups = useMemo(() => groupPlatesByVersion(data?.plateProgress ?? []), [data?.plateProgress]);
  const plateLabel = { kiwami: "極", shou: language === "zh-Hant" ? "將" : "将", kami: "神", maimai: "舞舞" } as const;

  if (!data?.fullRecords?.length) {
    return (
      <section className="progress-empty-state">
        <span>▦</span>
        <h1>{copy.recordsHeading}</h1>
        <p>{copy.recordsEmpty}</p>
      </section>
    );
  }

  return (
    <section className="records-dashboard">
      <header className="progress-header records-header">
        <div><span>{data.fullRecords.length} {copy.charts}</span><h1>{copy.recordsHeading}</h1></div>
        <time dateTime={data.exportedAt}>{copy.observedAt}: {new Date(data.exportedAt).toLocaleString(language)}</time>
      </header>

      <article className="insight-panel full-records-panel">
        <header>
          <div><h2>{copy.levelCompletion}</h2><p>{copy.levelCompletionDescription}</p></div>
          <div className="target-filters records-filters">
            <label>{copy.levelFilter}<select value={effectiveLevel} onChange={(event) => setLevel(event.target.value)}><option value="all">{copy.all}</option>{levelCompletion.map((entry) => <option key={entry.level} value={entry.level}>{entry.level} · {entry.total}</option>)}</select></label>
            <label>{copy.difficultyFilter}<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">{copy.all}</option><option value="expert">EXPERT</option><option value="master">MASTER</option><option value="remaster">Re:MASTER</option></select></label>
            <label>{copy.searchRecords}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchRecords} /></label>
          </div>
        </header>
        <div className="completion-summary"><span><b>{completion.total}</b>{copy.charts}</span><span><b>{completion.sss}</b>SSS</span><span><b>{completion.sssPlus}</b>SSS+</span><span><b>{completion.fullCombo}</b>FC / AP</span><span><b>{completion.allPerfect}</b>AP</span><span><b>{completion.fullSync}</b>FS / FDX</span></div>
        <div className="completion-grid">{visibleRecords.map((record) => <article key={record.chartId ?? `${record.title}-${record.type}-${record.difficulty}`}><SongCover record={record} assets={assets} /><div><strong>{record.title}</strong><span>{record.type.toUpperCase()} · {record.difficulty.toUpperCase()} · {record.displayedLevel}</span></div><div className="completion-result"><b>{record.achievementRate.toFixed(4)}%</b><span>{achievementRank(record.achievementRate).toUpperCase()} {[record.comboFlag, record.syncFlag].filter(Boolean).join(" · ")}</span></div></article>)}</div>
      </article>

      <details className="records-detail-panel">
        <summary>{copy.plateProgress}</summary>
        {plateGroups.length ? <div className="plate-grid">{plateGroups.map((group) => (
          <section key={group.version || "all"}>
            <h3>
              <span>{group.version || copy.plateProgress}</span>
              {Number.isFinite(group.nearest) && <small>{copy.plateRemaining(group.nearest)}</small>}
            </h3>
            <div>{group.plates.map((plate) => {
              const percent = plate.total ? Math.min(100, plate.completed / plate.total * 100) : 0;
              return <div key={plate.kind} className={plate.completed >= plate.total ? "plate-done" : undefined}><span>{plateLabel[plate.kind]}</span><strong>{plate.completed} / {plate.total}</strong><i><b style={{ width: `${percent}%` }} /></i></div>;
            })}</div>
          </section>
        ))}</div> : <p className="panel-empty">{copy.plateRequiresFull}</p>}
      </details>
    </section>
  );
}
