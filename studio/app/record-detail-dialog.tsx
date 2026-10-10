"use client";

import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import { chartKey, type HistoryEntry } from "../lib/history";
import type { LanguageId, StudioAssets, StudioChartRecord } from "../lib/types";
import ChartDetail from "./chart-detail";
import SongCover from "./song-cover";

export default function RecordDetailDialog({ record, records, assets, history, language, onClose, onSelectRecord }: {
  record: StudioChartRecord | null;
  records: StudioChartRecord[];
  assets: StudioAssets;
  history: HistoryEntry[];
  language: LanguageId;
  onClose: () => void;
  onSelectRecord: (record: StudioChartRecord) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = language === "zh-Hant" ? "關閉" : language === "ja" ? "閉じる" : "Close";
  useEffect(() => {
    if (record && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!record && dialog.current?.open) dialog.current.close();
  }, [record]);
  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      event.currentTarget.close();
    }
  };
  const progress = record ? Math.min(100, record.achievementRate / 100.5 * 100) : 0;
  return <dialog ref={dialog} className="b50-chart-dialog record-chart-dialog" aria-labelledby="record-chart-title" onClick={closeOnBackdrop} onClose={onClose}>
    <form method="dialog" className="b50-dialog-close"><button type="submit" aria-label={close} autoFocus>×</button></form>
    {record ? <div key={chartKey(record)} className="b50-dialog-content">
      <header className={`b50-dialog-hero difficulty-${record.difficulty}`}>
        <SongCover record={record} assets={assets} />
        <div className="b50-dialog-title">
          <span>{record.type.toUpperCase()} · {record.difficulty.toUpperCase()}</span>
          <h2 id="record-chart-title">{record.title}</h2>
          <p><span>Lv {record.displayedLevel}</span>{record.internalLevelValue !== undefined ? <span>CONST {record.internalLevelValue.toFixed(1)}</span> : null}</p>
        </div>
        <div className="achievement-orbit" style={{ "--achievement-progress": `${progress}%` } as CSSProperties}>
          <span><small>ACHIEVEMENT</small><strong>{record.achievementRate.toFixed(4)}<i>%</i></strong></span>
        </div>
      </header>
      <ChartDetail record={record} records={records} history={history} language={language} initiallyOpen onSelectRecord={onSelectRecord} />
    </div> : null}
  </dialog>;
}
