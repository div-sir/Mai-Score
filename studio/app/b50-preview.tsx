"use client";

import { useEffect, useRef, useState } from "react";
import ChartDetail from "./chart-detail";
import { achievementForRating, calculateInsightRating } from "../lib/insights";
import type { renderStudioSvg } from "../lib/render";
import type { HistoryEntry } from "../lib/history";
import type { LanguageId, StudioData, StudioRecord } from "../lib/types";

export default function B50Preview({ data, history, language, rendered, previewUrl }: {
  data: StudioData; history: HistoryEntry[]; language: LanguageId;
  rendered: ReturnType<typeof renderStudioSvg>; previewUrl: string;
}) {
  const [selected, setSelected] = useState<StudioRecord | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const copy = language === "zh-Hant"
    ? { hint: "點擊譜面查看紀錄與推分目標", close: "關閉", next: "至少 +1 Rating", max: "已達最高或沒有足夠資料", gain: "B50 增量", target: "達成率", unknown: "定數或目前 Rating 未知，無法計算推分。" }
    : language === "ja"
      ? { hint: "譜面を選択して履歴と目標を表示", close: "閉じる", next: "Rating +1 以上", max: "上限到達またはデータ不足", gain: "B50 増分", target: "達成率", unknown: "定数または現在の Rating が不明です。" }
      : { hint: "Select a chart for history and Rating targets", close: "Close", next: "At least +1 Rating", max: "Maximum reached or insufficient data", gain: "B50 gain", target: "Achievement", unknown: "Chart constant or current Rating is unknown." };
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);
  const level = selected?.internalLevelValue;
  const baseline = selected?.chartRating ?? (level && selected ? calculateInsightRating(level, selected.achievementRate) : undefined);
  const next = selected && baseline !== undefined ? achievementForRating(selected, baseline + 1) : undefined;
  const targets = selected ? [...new Set([next, 100, 100.5])].filter((value): value is number => value !== undefined && value > selected.achievementRate) : [];
  return <>
    <p className="preview-chart-hint">{copy.hint}</p>
    <div className="interactive-b50">
      <img src={previewUrl} alt="B50" />
      {rendered.hitAreas.map(({ record, x, y, width, height }, index) => <button
        type="button" key={`${record.bucket}-${index}`} className="b50-chart-hit"
        aria-label={`${record.title} · ${record.type.toUpperCase()} · ${record.difficulty.toUpperCase()} · ${copy.hint}`}
        style={{ left: `${x / rendered.width * 100}%`, top: `${y / rendered.height * 100}%`, width: `${width / rendered.width * 100}%`, height: `${height / rendered.height * 100}%` }}
        onClick={() => setSelected(record)}
      />)}
    </div>
    <dialog ref={dialog} className="b50-chart-dialog" aria-labelledby="b50-chart-title" onClose={() => setSelected(null)}>
      <form method="dialog"><button type="submit" autoFocus>{copy.close}</button></form>
      {selected && <>
        <h2 id="b50-chart-title">{selected.title}</h2>
        <p>{selected.bucket.toUpperCase()} · {selected.type.toUpperCase()} · {selected.difficulty.toUpperCase()} · {selected.achievementRate.toFixed(4)}%</p>
        {level !== undefined && level > 0 && baseline !== undefined ? <>
          <p>{copy.next}: {next === undefined ? copy.max : `${next.toFixed(4)}%`}</p>
          <table><thead><tr><th>{copy.target}</th><th>{copy.gain}</th></tr></thead><tbody>
            {targets.map(target => <tr key={target}><td>{target.toFixed(4)}%</td><td>+{Math.max(0, calculateInsightRating(level, target) - baseline)}</td></tr>)}
          </tbody></table>
        </> : <p>{copy.unknown}</p>}
        <ChartDetail key={`${selected.type}-${selected.difficulty}-${selected.title}`} record={selected} records={data.fullRecords ?? data.records} history={history} language={language} initiallyOpen />
      </>}
    </dialog>
  </>;
}
