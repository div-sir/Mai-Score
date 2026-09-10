"use client";

import { useMemo, useState } from "react";
import { achievementRank } from "../lib/achievement-rank";
import { buildLevelCompletion } from "../lib/insights";
import { studioCopy } from "../lib/i18n";
import { buildPlateProgress, groupPlatesByVersion } from "../lib/plates";
import type { LanguageId, StudioAssets, StudioData } from "../lib/types";
import SongCover from "./song-cover";
import ChartDetail from "./chart-detail";
import PlayQueuePanel from "./play-queue";
import CatalogPanel from "./catalog";
import type { HistoryEntry } from "../lib/history";
import { searchRecords } from "../lib/record-search";

interface RecordsDashboardProps {
  data: StudioData | null;
  history: HistoryEntry[];
  assets: StudioAssets;
  language: LanguageId;
}

export default function RecordsDashboard({ data, assets, language, history }: RecordsDashboardProps) {
  const copy = studioCopy(language);
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState("achievement");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [version, setVersion] = useState("all");
  const [constant, setConstant] = useState("all");
  const [plateSort, setPlateSort] = useState<"remaining" | "version">("remaining");
  const [plateMasterOnly, setPlateMasterOnly] = useState(false);
  const versions = useMemo(() => [...new Set((data?.fullRecords ?? []).flatMap(r => r.version ? [r.version] : []))].sort(), [data]);
  const constants = useMemo(() => [...new Set((data?.fullRecords ?? []).flatMap(record =>
    Number.isFinite(record.internalLevelValue) ? [Number(record.internalLevelValue)] : []
  ))].sort((a, b) => b - a), [data]);
  const text = language === "zh-Hant"
    ? { status: "成績狀態", below: "未達 SSS", empty: "沒有符合條件的成績", reset: "重設篩選", details: "譜面詳情", constant: "定數", version: "版本", masterOnly: "僅顯示 MASTER", masterPlateNote: "MASTER 進度檢視；實際牌子仍需 BASIC～MASTER。", unmatched: "未匹配曲目" }
    : language === "ja"
      ? { status: "達成状況", below: "SSS 未達成", empty: "条件に合う成績がありません", reset: "絞り込みを解除", details: "譜面詳細", constant: "定数", version: "バージョン", masterOnly: "MASTER のみ", masterPlateNote: "MASTER の進捗表示です。実際のプレートには BASIC～MASTER が必要です。", unmatched: "未一致の曲" }
      : { status: "Score status", below: "Below SSS", empty: "No matching scores", reset: "Reset filters", details: "Chart details", constant: "Constant", version: "Version", masterOnly: "MASTER only", masterPlateNote: "MASTER progress view; actual plates still require BASIC–MASTER.", unmatched: "Unmatched charts" };
  const sortLabel = language === "zh-Hant" ? "排序" : language === "ja" ? "並び順" : "Sort";
  const titleLabel = language === "en" ? "Title" : "曲名";
  const [difficulty, setDifficulty] = useState("all");
  const [query, setQuery] = useState("");
  const levelCompletion = useMemo(() => buildLevelCompletion(data?.fullRecords ?? []), [data]);
  const effectiveLevel = level === "all" || levelCompletion.some((entry) => entry.level === level)
    ? level
    : "all";
  const visibleRecords = useMemo(() => searchRecords(data?.fullRecords ?? [], {
    level: effectiveLevel, difficulty, query, sort, status, type, version, constant
  }, language), [constant, data, effectiveLevel, difficulty, query, language, sort, status, type, version]);
  const completion = useMemo(() => visibleRecords.reduce((summary, record) => ({
    total: summary.total + 1,
    sss: summary.sss + (record.achievementRate >= 100 ? 1 : 0),
    sssPlus: summary.sssPlus + (record.achievementRate >= 100.5 ? 1 : 0),
    fullCombo: summary.fullCombo + (record.comboFlag ? 1 : 0),
    allPerfect: summary.allPerfect + (record.comboFlag === "ap" || record.comboFlag === "ap+" ? 1 : 0),
    fullSync: summary.fullSync + (record.syncFlag ? 1 : 0)
  }), { total: 0, sss: 0, sssPlus: 0, fullCombo: 0, allPerfect: 0, fullSync: 0 }), [visibleRecords]);
  const canFilterPlate = Boolean(data?.versionTotals?.length);
  const effectivePlateMasterOnly = plateMasterOnly && canFilterPlate;
  const plateGroups = useMemo(() => {
    const recalculated = buildPlateProgress(
      data?.fullRecords,
      data?.versionTotals,
      effectivePlateMasterOnly ? ["master"] : undefined
    );
    const canRecalculate = Boolean(data?.fullRecords?.length && data?.versionTotals?.length);
    const progress = canRecalculate ? recalculated : data?.plateProgress ?? [];
    const groups = groupPlatesByVersion(progress);
    return [...groups].sort((a, b) => plateSort === "remaining"
      ? (a.nearest - b.nearest) || a.version.localeCompare(b.version)
      : a.version.localeCompare(b.version));
  }, [data?.fullRecords, data?.plateProgress, data?.versionTotals, effectivePlateMasterOnly, plateSort]);
  const plateLabel = { kiwami: "極", shou: language === "zh-Hant" ? "將" : "将", kami: "神", maimai: "舞舞" } as const;
  const activeFilterCount = [effectiveLevel !== "all", difficulty !== "all", status !== "all", type !== "all", version !== "all", constant !== "all", Boolean(query.trim()), sort !== "achievement"].filter(Boolean).length;
  const advancedFilterCount = [status !== "all", type !== "all", version !== "all", constant !== "all", sort !== "achievement"].filter(Boolean).length;
  const resetFilters = () => {
    setLevel("all");
    setDifficulty("all");
    setStatus("all");
    setType("all");
    setVersion("all");
    setConstant("all");
    setQuery("");
    setSort("achievement");
  };
  const moreFilters = language === "zh-Hant" ? "更多篩選" : language === "ja" ? "その他の絞り込み" : "More filters";

  if (!data?.fullRecords?.length) {
    return (
      <section className="progress-empty-state">
        <span>▦</span>
        <h1>{copy.recordsHeading}</h1>
        <p>{copy.recordsEmpty}</p>
        <CatalogPanel records={data?.records ?? []} language={language} data={data} />
      </section>
    );
  }

  return (
    <section className="records-dashboard">
      <header className="progress-header records-header">
        <div><span>{data.fullRecords.length} {copy.charts}</span><h1>{copy.recordsHeading}</h1></div>
        <time dateTime={data.exportedAt}>{copy.observedAt}: {new Date(data.exportedAt).toLocaleString(language)}</time>
      </header>

      <PlayQueuePanel records={data.fullRecords} language={language} />
      <CatalogPanel records={data.fullRecords} language={language} data={data} />
      <article className="insight-panel full-records-panel">
        <header className="records-panel-heading">
          <div><h2>{copy.levelCompletion}</h2><p>{copy.levelCompletionDescription}</p></div>
          <div className="records-filter-toolbar">
            <label className="records-search">{copy.searchRecords}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchRecords} /></label>
            <div className="target-filters records-quick-filters">
            <label>{copy.levelFilter}<select value={effectiveLevel} onChange={(event) => setLevel(event.target.value)}><option value="all">{copy.all}</option>{levelCompletion.map((entry) => <option key={entry.level} value={entry.level}>{entry.level} · {entry.total}</option>)}</select></label>
            <label>{copy.difficultyFilter}<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">{copy.all}</option><option value="basic">BASIC</option><option value="advanced">ADVANCED</option><option value="expert">EXPERT</option><option value="master">MASTER</option><option value="remaster">Re:MASTER</option></select></label>
            <button type="button" className={difficulty === "master" ? "filter-active" : undefined} onClick={() => setDifficulty(difficulty === "master" ? "all" : "master")}>{text.masterOnly}</button>
            <details className="records-advanced-filters">
              <summary>{moreFilters}{advancedFilterCount ? <b>{advancedFilterCount}</b> : null}</summary>
              <div className="target-filters records-filters">
                <label>{sortLabel}<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="achievement">{copy.achievement} ↓</option><option value="low">{copy.achievement} ↑</option><option value="title">{titleLabel}</option><option value="constant">{text.constant} ↓</option></select></label>
                <label>{text.constant}<select aria-label={text.constant} value={constant} onChange={event => setConstant(event.target.value)}><option value="all">{copy.all}</option>{constants.map(value => <option key={value} value={value}>{value.toFixed(1)}</option>)}</select></label>
                <label>STD / DX<select value={type} onChange={event => setType(event.target.value)}><option value="all">{copy.all}</option><option value="std">STD</option><option value="dx">DX</option></select></label>
                <label>{text.version}<select value={version} onChange={event => setVersion(event.target.value)}><option value="all">{copy.all}</option>{versions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                <label>{text.status}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{copy.all}</option><option value="sss">{text.below}</option><option value="fc">FC / AP</option><option value="ap">AP</option></select></label>
              </div>
            </details>
            {activeFilterCount ? <button type="button" className="records-reset" onClick={resetFilters}>{text.reset}<b>{activeFilterCount}</b></button> : null}
            </div>
          </div>
        </header>
        <div className="completion-summary"><span><b>{completion.total}</b>{copy.charts}</span><span><b>{completion.sss}</b>SSS</span><span><b>{completion.sssPlus}</b>SSS+</span><span><b>{completion.fullCombo}</b>FC / AP</span><span><b>{completion.allPerfect}</b>AP</span><span><b>{completion.fullSync}</b>FS / FDX</span></div>
        {!visibleRecords.length && <p role="status" className="panel-empty">{text.empty}</p>}
        <div className="completion-grid">{visibleRecords.map((record) => <article key={record.chartId ?? `${record.title}-${record.type}-${record.difficulty}`}><SongCover record={record} assets={assets} /><div><strong>{record.title}</strong><span>{record.type.toUpperCase()} · {record.difficulty.toUpperCase()} · {record.displayedLevel}{record.internalLevelValue !== undefined ? ` · ${record.internalLevelValue.toFixed(1)}` : ""}</span></div><div className="completion-result"><b>{record.achievementRate.toFixed(4)}%</b><span>{achievementRank(record.achievementRate).toUpperCase()} {[record.comboFlag, record.syncFlag].filter(Boolean).join(" · ")}</span></div><ChartDetail record={record} records={data.fullRecords ?? []} history={history} language={language} /></article>)}</div>
      </article>

      <details className="records-detail-panel">
        <summary>{copy.plateProgress}</summary>
        <div className="plate-controls"><label className="plate-sort">{sortLabel}<select value={plateSort} onChange={(event) => setPlateSort(event.target.value as "remaining" | "version")}><option value="remaining">{language === "zh-Hant" ? "最接近完成" : language === "ja" ? "残りが少ない順" : "Fewest remaining"}</option><option value="version">{language === "zh-Hant" ? "版本" : language === "ja" ? "バージョン" : "Version"}</option></select></label><label className="plate-master-only"><input type="checkbox" checked={effectivePlateMasterOnly} disabled={!canFilterPlate} onChange={event => setPlateMasterOnly(event.target.checked)} /><span>{text.masterOnly}</span></label></div>
        {effectivePlateMasterOnly ? <p className="plate-filter-note">{text.masterPlateNote}</p> : null}
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
      {data.fullRecords.some(record => record.warning) && <details className="records-detail-panel unmatched-panel"><summary>{text.unmatched} ({data.fullRecords.filter(record => record.warning).length})</summary><ul>{data.fullRecords.filter(record => record.warning).map(record => <li key={`${record.title}-${record.type}-${record.difficulty}`}>{record.title || "—"} · {record.type.toUpperCase()} · {record.difficulty.toUpperCase()}</li>)}</ul></details>}
    </section>
  );
}
