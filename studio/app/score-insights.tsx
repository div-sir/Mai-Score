"use client";

import { useMemo, useState } from "react";
import type { RhythmGameId } from "../../src/lib/rhythm-record";
import {
  distribution,
  levelInsights,
  scoreTargetPresets,
  sdvxVolforce,
  targetScoreCandidates,
  type InsightScore
} from "../lib/rhythm-insights";
import type { LanguageId } from "../lib/types";
import { renderScoreShareCard } from "../lib/score-card";

interface Props {
  game: RhythmGameId;
  records: InsightScore[];
  language: LanguageId;
  generatedAt?: string;
}

const number = (value: number, language: LanguageId) => value.toLocaleString(language);

async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render the score card."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Score card canvas is unavailable.");
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not encode the score card.")), "image/png"
    ));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ScoreInsights({ game, records, language, generatedAt }: Props) {
  const presets = scoreTargetPresets(game);
  const [target, setTarget] = useState(presets.at(-1) ?? 0);
  const [cardState, setCardState] = useState<"idle" | "working" | "ready" | "error">("idle");
  const levels = useMemo(() => levelInsights(records), [records]);
  const grades = useMemo(() => distribution(records, "grade"), [records]);
  const clears = useMemo(() => distribution(records, "clear"), [records]);
  const candidates = useMemo(() => targetScoreCandidates(records, target), [records, target]);
  const vf = useMemo(() => game === "sound-voltex" ? sdvxVolforce(records) : undefined, [game, records]);
  const maxDistribution = Math.max(1, ...grades.map((entry) => entry.count), ...clears.map((entry) => entry.count));
  const t = language === "zh-Hant" ? {
    title: "成績分析", subtitle: "從其他查分工具補進的實用視圖", level: "等級表現", average: "平均分數", best: "最高分", clearRate: "通關率",
    grade: "成績分布", clear: "通關分布", target: "目標分數", closest: "最接近目標的譜面", gap: "還差", noLevel: "收集資料沒有譜面等級。",
    vf: "VOLFORCE Best 50", vfTotal: "推算 VF", vfCutoff: "B50 門檻", vfCount: "可計算譜面", potential: "VF Potential", projected: "預估增加",
    vfNote: "只在譜面定數與通關類型齊全時推算；官方已記錄的單曲 VF 會優先使用。", noVf: "目前缺少譜面定數或通關類型，無法安全推算 VF。",
    download: "下載分析卡", share: "分享分析卡", ready: "分析卡已準備完成", error: "分析卡產生失敗"
  } : language === "ja" ? {
    title: "スコア分析", subtitle: "他のスコアツールで便利な表示", level: "レベル別成績", average: "平均スコア", best: "最高スコア", clearRate: "クリア率",
    grade: "グレード分布", clear: "クリア分布", target: "目標スコア", closest: "目標に近い譜面", gap: "あと", noLevel: "譜面レベルが取得されていません。",
    vf: "VOLFORCE Best 50", vfTotal: "推定 VF", vfCutoff: "B50 ボーダー", vfCount: "計算可能譜面", potential: "VF Potential", projected: "推定上昇",
    vfNote: "譜面定数とクリアタイプが揃う場合のみ計算し、公式の単曲VFがあれば優先します。", noVf: "譜面定数またはクリアタイプがないため、安全にVFを計算できません。",
    download: "分析カードを保存", share: "分析カードを共有", ready: "分析カードを作成しました", error: "分析カードを作成できませんでした"
  } : {
    title: "Score insights", subtitle: "Useful views found in dedicated score trackers", level: "Performance by level", average: "Average", best: "Best", clearRate: "Clear rate",
    grade: "Grade distribution", clear: "Clear distribution", target: "Target score", closest: "Closest charts to the target", gap: "Gap", noLevel: "The collected data has no chart levels.",
    vf: "VOLFORCE Best 50", vfTotal: "Estimated VF", vfCutoff: "B50 cutoff", vfCount: "Calculable charts", potential: "VF Potential", projected: "Estimated gain",
    vfNote: "Calculated only when chart constant and clear type are present; an official per-chart VF value takes priority.", noVf: "Chart constants or clear types are missing, so VF cannot be estimated safely.",
    download: "Download insight card", share: "Share insight card", ready: "Insight card is ready", error: "Could not create the insight card"
  };

  const createCard = async () => {
    const card = renderScoreShareCard(game, records, target, language, generatedAt);
    const blob = await svgToPng(card.svg, card.width, card.height);
    return new File([blob], `mai-score-${game}-insights.png`, { type: "image/png" });
  };
  const saveCard = (file: File) => {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const handleCard = async (share: boolean) => {
    setCardState("working");
    try {
      const file = await createCard();
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${game} · ${t.title}` });
      } else {
        saveCard(file);
      }
      setCardState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return setCardState("idle");
      setCardState("error");
    }
  };

  return <section className="score-insights">
    <header><div><span>{t.subtitle}</span><h2>{t.title}</h2></div><div className="insight-header-actions"><strong>{number(records.length, language)}</strong><button type="button" disabled={cardState === "working"} onClick={() => void handleCard(false)}>{t.download}</button><button type="button" disabled={cardState === "working"} onClick={() => void handleCard(true)}>{t.share}</button></div></header>
    {cardState === "ready" || cardState === "error" ? <p className={`insight-card-status ${cardState}`} role="status">{cardState === "ready" ? t.ready : t.error}</p> : null}
    {vf ? <section className="vf-panel">
      <div className="vf-heading"><div><span>SDVX</span><h3>{t.vf}</h3></div><p>{t.vfNote}</p></div>
      {vf.counted.length ? <>
        <div className="vf-metrics">
          <div><span>{t.vfTotal}</span><strong>{vf.total.toFixed(3)}</strong></div>
          <div><span>{t.vfCutoff}</span><strong>{vf.cutoff ? (vf.cutoff / 1000).toFixed(3) : "—"}</strong></div>
          <div><span>{t.vfCount}</span><strong>{vf.entries.length}<small> / 50</small></strong></div>
        </div>
        <div className="vf-columns">
          <div><h4>Best 50</h4><div className="vf-list">{vf.counted.slice(0, 12).map((entry, index) => <article key={entry.id}>
            <span>#{index + 1}</span><div><strong>{entry.title}</strong><small>{[entry.difficulty, entry.level ? `Lv ${entry.level}` : ""].filter(Boolean).join(" · ")}</small></div><b>{(entry.vfMilli / 1000).toFixed(3)}</b>
          </article>)}</div></div>
          <div><h4>{t.potential}</h4>{vf.potential.length ? <div className="vf-potential">{vf.potential.slice(0, 8).map((entry) => <article key={entry.id}>
            <strong>{entry.title}</strong><span>{number(entry.targetScore, language)}</span><small>{t.projected} +{(entry.gainMilli / 1000).toFixed(3)}</small>
          </article>)}</div> : <p className="insight-empty">{t.noVf}</p>}</div>
        </div>
      </> : <p className="insight-empty">{t.noVf}</p>}
    </section> : null}
    <div className="insight-grid">
      <section className="level-insights"><h3>{t.level}</h3>{levels.length ? <div>{levels.map((entry) => <article key={entry.level}>
        <strong>Lv {entry.level}</strong><span>{entry.count}</span><dl><div><dt>{t.average}</dt><dd>{number(entry.average, language)}</dd></div><div><dt>{t.best}</dt><dd>{number(entry.best, language)}</dd></div>{entry.clearRate === undefined ? null : <div><dt>{t.clearRate}</dt><dd>{Math.round(entry.clearRate * 100)}%</dd></div>}</dl>
      </article>)}</div> : <p className="insight-empty">{t.noLevel}</p>}</section>
      <section className="distribution-insights"><h3>{t.grade} / {t.clear}</h3><div>{[...grades.slice(0, 6), ...clears.slice(0, 6)].map((entry, index) => <article key={`${entry.label}-${index}`}>
        <span>{entry.label}</span><i><b style={{ width: `${entry.count / maxDistribution * 100}%` }} /></i><strong>{entry.count}</strong>
      </article>)}</div></section>
    </div>
    <section className="score-targets">
      <div><h3>{t.target}</h3><div className="target-presets">{presets.map((preset) => <button type="button" key={preset} aria-pressed={target === preset} onClick={() => setTarget(preset)}>{number(preset, language)}</button>)}</div></div>
      <h4>{t.closest}</h4><div className="target-list">{candidates.map((entry) => <article key={entry.id}><div><strong>{entry.title}</strong><small>{[entry.difficulty, entry.level ? `Lv ${entry.level}` : ""].filter(Boolean).join(" · ")}</small></div><span>{number(entry.score, language)}</span><b>{t.gap} {number(entry.gap, language)}</b></article>)}</div>
    </section>
  </section>;
}
