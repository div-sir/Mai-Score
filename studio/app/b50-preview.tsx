"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import ChartDetail from "./chart-detail";
import SongCover from "./song-cover";
import { achievementForRating, calculateInsightRating } from "../lib/insights";
import type { renderStudioSvg } from "../lib/render";
import { chartKey, type HistoryEntry } from "../lib/history";
import type { LanguageId, StudioAssets, StudioChartRecord, StudioData } from "../lib/types";

function TrendIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 17 6-6 4 4 6-8"/><path d="M15 7h5v5"/></svg>;
}

export default function B50Preview({ data, assets, history, language, rendered, previewUrl }: {
  data: StudioData; assets: StudioAssets; history: HistoryEntry[]; language: LanguageId;
  rendered: ReturnType<typeof renderStudioSvg>; previewUrl: string;
}) {
  const [selected, setSelected] = useState<StudioChartRecord | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const copy = language === "zh-Hant"
    ? { hint: "點擊譜面查看紀錄與推分目標", close: "關閉", next: "至少 +1 Rating", max: "已達最高或沒有足夠資料", b50Gain: "B50 增量", chartGain: "單譜增量", full: "完整記錄", target: "目標達成率", current: "目前達成率", rating: "單譜 Rating", route: "推分路線", unknown: "定數或目前 Rating 未知，無法計算推分。" }
    : language === "ja"
      ? { hint: "譜面を選択して履歴と目標を表示", close: "閉じる", next: "Rating +1 以上", max: "上限到達またはデータ不足", b50Gain: "B50 増分", chartGain: "譜面増分", full: "全記録", target: "目標達成率", current: "現在の達成率", rating: "譜面 Rating", route: "Rating ルート", unknown: "定数または現在の Rating が不明です。" }
      : { hint: "Select a chart for history and Rating targets", close: "Close", next: "At least +1 Rating", max: "Maximum reached or insufficient data", b50Gain: "B50 gain", chartGain: "Chart Rating gain", full: "Full Records", target: "Target achievement", current: "Current achievement", rating: "Chart Rating", route: "Rating route", unknown: "Chart constant or current Rating is unknown." };
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);
  const level = selected?.internalLevelValue;
  const baseline = selected?.chartRating ?? (level && selected ? calculateInsightRating(level, selected.achievementRate) : undefined);
  const next = selected && baseline !== undefined ? achievementForRating(selected, baseline + 1) : undefined;
  const targets = selected ? [...new Set([next, 100, 100.5])].filter((value): value is number => value !== undefined && value > selected.achievementRate) : [];
  const progress = selected ? Math.min(100, selected.achievementRate / 100.5 * 100) : 0;
  const selectedB50 = selected ? data.records.find(record => chartKey(record) === chartKey(selected)) : undefined;
  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      event.currentTarget.close();
    }
  };
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
    <dialog ref={dialog} className="b50-chart-dialog" aria-labelledby="b50-chart-title" onClick={closeOnBackdrop} onClose={() => setSelected(null)}>
      <form method="dialog" className="b50-dialog-close"><button type="submit" aria-label={copy.close} autoFocus>×</button></form>
      {selected ? <div key={chartKey(selected)} className="b50-dialog-content">
        <header className={`b50-dialog-hero difficulty-${selected.difficulty}`}>
          <SongCover record={selected} assets={assets} />
          <div className="b50-dialog-title">
            <span>{selectedB50?.bucket.toUpperCase() ?? copy.full} · {selected.type.toUpperCase()}</span>
            <h2 id="b50-chart-title">{selected.title}</h2>
            <p><b>{selected.difficulty.toUpperCase()}</b><span>Lv {selected.displayedLevel}</span>{level ? <span>CONST {level}</span> : null}</p>
          </div>
          <div className="achievement-orbit" style={{ "--achievement-progress": `${progress}%` } as CSSProperties} aria-label={`${copy.current}: ${selected.achievementRate.toFixed(4)}%`}>
            <span><small>{copy.current}</small><strong>{selected.achievementRate.toFixed(4)}<i>%</i></strong></span>
          </div>
        </header>
        {level !== undefined && level > 0 && baseline !== undefined ? <section className="b50-rating-route" aria-labelledby="b50-rating-route-title">
          <header><span className="route-icon"><TrendIcon /></span><div><small>{copy.route}</small><h3 id="b50-rating-route-title">{copy.next}</h3></div><b>{next === undefined ? copy.max : `${next.toFixed(4)}%`}</b></header>
          <div className="b50-rating-baseline"><span><small>{copy.rating}</small><strong>{baseline}</strong></span><i aria-hidden="true"/><span><small>{copy.target}</small><strong>{next === undefined ? "—" : `${next.toFixed(4)}%`}</strong></span></div>
          {targets.length ? <div className="b50-target-grid">{targets.map(target => {
            const gain = Math.max(0, calculateInsightRating(level, target) - baseline);
            return <article key={target} className={target === next ? "primary" : undefined}>
              <span className="target-ring" style={{ "--target-progress": `${Math.min(100, target / 100.5 * 100)}%` } as CSSProperties}><b>{target.toFixed(target === 100 ? 0 : 4)}%</b></span>
              <div><small>{selectedB50 ? copy.b50Gain : copy.chartGain}</small><strong>+{gain}</strong></div>
            </article>;
          })}</div> : null}
        </section> : <p className="b50-unknown">{copy.unknown}</p>}
        <ChartDetail record={selected} records={data.fullRecords ?? data.records} history={history} language={language} initiallyOpen onSelectRecord={setSelected} />
      </div> : null}
    </dialog>
  </>;
}
