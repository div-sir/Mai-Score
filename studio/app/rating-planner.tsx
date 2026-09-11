"use client";

import { useMemo, useState } from "react";
import { plannerCopy } from "../lib/i18n";
import { buildFullRecordRecommendations, buildRatingPlan } from "../lib/rating-planner";
import type { LanguageId, StudioAssets, StudioData } from "../lib/types";
import SongCover from "./song-cover";

interface PlannerProps {
  data: StudioData;
  assets: StudioAssets;
  language: LanguageId;
}

const difficultyOptions = ["all", "basic", "advanced", "expert", "master", "remaster"] as const;

export function RatingPlannerPanel({ data, assets, language }: PlannerProps) {
  const copy = plannerCopy(language);
  const suggestedTarget = Math.ceil((data.b50Rating + 1) / 100) * 100;
  const [target, setTarget] = useState(suggestedTarget);
  const [draftTarget, setDraftTarget] = useState(String(suggestedTarget));
  const plan = useMemo(() => buildRatingPlan(data, target), [data, target]);
  const needed = Math.max(0, target - data.b50Rating);

  return <article className="insight-panel action-panel rating-planner-panel">
    <header><div><h2>{copy.goalTitle}</h2><p>{copy.goalDescription}</p></div></header>
    <form className="planner-target" onSubmit={event => {
      event.preventDefault();
      const value = Number(draftTarget);
      if (Number.isFinite(value)) setTarget(Math.min(20_000, Math.max(data.b50Rating, Math.floor(value))));
    }}>
      <label><span>{copy.targetRating}</span><input type="number" min={data.b50Rating} max="20000" step="1" value={draftTarget} onChange={event => setDraftTarget(event.target.value)} /></label>
      <button type="submit" className="panel-primary-button">{copy.buildPlan}</button>
    </form>
    <div className="planner-summary">
      <span><small>{copy.currentRating}</small><strong>{data.b50Rating}</strong></span>
      <span><small>{copy.requiredGain}</small><strong>+{needed}</strong></span>
      <span><small>{copy.projectedRating}</small><strong>{plan.projectedRating}</strong></span>
      <span><small>{copy.maximumRating}</small><strong>{plan.maximumRating}</strong></span>
    </div>
    <p className={`planner-status ${plan.reachable ? "reachable" : "unreachable"}`} role="status">
      <span aria-hidden="true">{plan.reachable ? "✓" : "!"}</span>{plan.reachable ? copy.reachable : copy.unreachable}
    </p>
    {plan.steps.length ? <ol className="planner-steps">
      {plan.steps.map((step, index) => <li key={step.key}>
        <b>{index + 1}</b><SongCover record={step.record} assets={assets} />
        <div><strong>{step.record.title}</strong><span>{step.record.type.toUpperCase()} · {step.record.difficulty.toUpperCase()} · {step.record.displayedLevel} · {step.bucket.toUpperCase()}</span></div>
        <dl><div><dt>{copy.achievementTarget}</dt><dd>{step.record.achievementRate.toFixed(4)}% → {step.targetAchievement.toFixed(4)}%</dd></div><div><dt>{copy.b50Gain}</dt><dd className="up">+{step.b50Gain}</dd></div></dl>
      </li>)}
    </ol> : <p className="panel-empty">{copy.planEmpty}</p>}
  </article>;
}

export function FullRecordRecommendationsPanel({ data, assets, language }: PlannerProps) {
  const copy = plannerCopy(language);
  const [difficulty, setDifficulty] = useState<(typeof difficultyOptions)[number]>("all");
  const [showAll, setShowAll] = useState(false);
  const recommendations = useMemo(() => buildFullRecordRecommendations(data, 100), [data]);
  const filtered = recommendations.filter(item => difficulty === "all" || item.record.difficulty === difficulty);
  const visible = showAll ? filtered : filtered.slice(0, 12);

  return <article className="insight-panel action-panel full-recommendations-panel">
    <header>
      <div><h2>{copy.fullTitle}</h2><p>{copy.fullDescription}</p></div>
      <label>{language === "zh-Hant" ? "難度" : language === "ja" ? "難易度" : "Difficulty"}<select value={difficulty} onChange={event => setDifficulty(event.target.value as (typeof difficultyOptions)[number])}>
        {difficultyOptions.map(value => <option key={value} value={value}>{value === "all" ? (language === "zh-Hant" ? "全部" : language === "ja" ? "すべて" : "All") : value.toUpperCase()}</option>)}
      </select></label>
    </header>
    {!data.fullRecords?.length ? <p className="panel-empty">{copy.fullRequiresRecords}</p> : visible.length ? <>
      <ol className="recommendation-list">{visible.map(item => <li key={item.key}>
        <SongCover record={item.record} assets={assets} />
        <div><strong>{item.record.title}</strong><span>{item.record.type.toUpperCase()} · {item.record.difficulty.toUpperCase()} · {item.record.displayedLevel} · {item.bucket.toUpperCase()}</span><small>{item.inB50 ? copy.inB50 : copy.outsideB50}</small></div>
        <dl><div><dt>{copy.achievementTarget}</dt><dd>{item.record.achievementRate.toFixed(4)}% → {item.targetAchievement.toFixed(4)}%</dd></div><div><dt>{copy.b50Gain}</dt><dd className="up">+{item.b50Gain}</dd></div></dl>
      </li>)}</ol>
      {!showAll && filtered.length > visible.length ? <button type="button" className="panel-secondary-button" onClick={() => setShowAll(true)}>{copy.showAll} ({visible.length}/{filtered.length})</button> : null}
    </> : <p className="panel-empty">{copy.planEmpty}</p>}
  </article>;
}
