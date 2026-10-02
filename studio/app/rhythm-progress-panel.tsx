import type { RhythmRecordEnvelope } from "../../src/lib/rhythm-record";
import { compareRhythmRecords } from "../lib/rhythm-progress";
import type { LanguageId } from "../lib/types";

export default function RhythmProgressPanel({ current, previous, language }: { current: RhythmRecordEnvelope; previous?: RhythmRecordEnvelope; language: LanguageId }) {
  const progress = compareRhythmRecords(current, previous);
  if (!progress) return null;
  const text = language === "zh-Hant" ? {
    progress: "與上次更新比較", since: "上次資料", newCharts: "新增譜面", improved: "升分譜面", scoreGain: "累計升分", biggest: "最大進步", noGain: "這次沒有偵測到分數提升；新增譜面仍會獨立計算。"
  } : language === "ja" ? {
    progress: "前回の更新と比較", since: "前回のデータ", newCharts: "新規譜面", improved: "更新譜面", scoreGain: "合計上昇", biggest: "最大更新", noGain: "今回はスコア更新がありません。新規譜面は別に集計されます。"
  } : {
    progress: "Changes since last update", since: "Previous data", newCharts: "New charts", improved: "Improved charts", scoreGain: "Score gained", biggest: "Biggest improvement", noGain: "No score improvements were detected this time. New charts are counted separately."
  };
  return <section className="rhythm-progress">
    <header><div><span>{text.since} · {new Date(progress.previousAt).toLocaleString(language)}</span><h2>{text.progress}</h2></div></header>
    <div className="rhythm-progress-metrics">
      <span><small>{text.newCharts}</small><strong>+{progress.newCharts.toLocaleString(language)}</strong></span>
      <span><small>{text.improved}</small><strong>{progress.improvedCharts.toLocaleString(language)}</strong></span>
      <span><small>{text.scoreGain}</small><strong>+{progress.scoreGain.toLocaleString("en-US")}</strong></span>
      <span><small>{text.biggest}</small><strong>{progress.topImprovements[0] ? `+${progress.topImprovements[0].gain.toLocaleString("en-US")}` : "—"}</strong></span>
    </div>
    {progress.topImprovements.length ? <div className="rhythm-progress-list">{progress.topImprovements.map((entry) => <article key={entry.id}>
      <div><strong>{entry.title}</strong><small>{entry.difficulty}</small></div><span>{entry.previousScore.toLocaleString("en-US")} → {entry.score.toLocaleString("en-US")}</span><b>+{entry.gain.toLocaleString("en-US")}</b>
    </article>)}</div> : <p>{text.noGain}</p>}
  </section>;
}
