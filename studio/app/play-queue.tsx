"use client";

import { useEffect, useMemo, useState } from "react";
import { emptyQueue, parseQueue, QUEUE_KEY, saveQueue, setQueueGoal, type PlayQueue } from "../lib/play-queue";
import type { LanguageId, StudioChartRecord } from "../lib/types";

export default function PlayQueuePanel({ records, language }: { records: StudioChartRecord[]; language: LanguageId }) {
  const [queue, setQueue] = useState<PlayQueue>(emptyQueue);
  const [ready, setReady] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState("");
  const [target, setTarget] = useState("100");
  const [note, setNote] = useState("");
  const text = language === "zh-Hant"
    ? { title: "待打清單", scope: "只儲存在此瀏覽器，所有匯入玩家共用；不會同步或上傳。", chart: "譜面", choose: "選擇譜面", target: "目標達成率 %", note: "練習筆記", save: "儲存目標", saved: "已儲存在此瀏覽器", error: "無法讀取或儲存清單；原有資料未被覆寫。請檢查瀏覽器儲存設定。", edit: "編輯", remove: "移除", empty: "尚無待打目標" }
    : language === "ja"
      ? { title: "プレイ予定", scope: "このブラウザーのみ。インポートした全プレイヤーで共有し、同期・送信しません。", chart: "譜面", choose: "譜面を選択", target: "目標達成率 %", note: "練習メモ", save: "目標を保存", saved: "ブラウザーに保存しました", error: "読み込み・保存に失敗しました。既存データは上書きしていません。保存設定を確認してください。", edit: "編集", remove: "削除", empty: "目標がありません" }
      : { title: "Play queue", scope: "Stored only in this browser, shared across imported players. Never synced or uploaded.", chart: "Chart", choose: "Choose a chart", target: "Target achievement %", note: "Practice notes", save: "Save goal", saved: "Saved in this browser", error: "Cannot read or save the queue. Existing data was not overwritten. Check browser storage settings.", edit: "Edit", remove: "Remove", empty: "No queued goals" };
  const charts = useMemo(() => new Map(records.map(record => [JSON.stringify([record.title, record.type, record.difficulty]), `${record.title} · ${record.type.toUpperCase()} · ${record.difficulty.toUpperCase()}`])), [records]);
  useEffect(() => {
    try { setQueue(parseQueue(localStorage.getItem(QUEUE_KEY))); setReady(true); }
    catch { setReady(false); }
  }, []);
  function update(transform: (current: PlayQueue) => PlayQueue) {
    try {
      // Read at mutation time so another tab's saved goals are preserved.
      const next = transform(parseQueue(localStorage.getItem(QUEUE_KEY)));
      saveQueue(localStorage, next);
      setQueue(next);
      setMessage(text.saved);
    } catch { setMessage(text.error); }
  }
  return <details className="records-detail-panel play-queue">
    <summary>{text.title} · {queue.goals.length}</summary>
    <p>{text.scope}</p>
    {ready === false && <p role="status">{text.error}</p>}
    <form className="target-filters" onSubmit={event => {
      event.preventDefault();
      if (!selected || !target.trim()) return;
      update(current => setQueueGoal(current, { chartKey: selected, target: Number(target), note }));
    }}>
      <label>{text.chart}<select required value={selected} onChange={event => setSelected(event.target.value)}><option value="">{text.choose}</option>{selected && !charts.has(selected) && <option value={selected}>{selected}</option>}{[...charts].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>{text.target}<input required type="number" min="0" max="100.5" step="0.0001" value={target} onChange={event => setTarget(event.target.value)} /></label>
      <label>{text.note}<input maxLength={1000} value={note} onChange={event => setNote(event.target.value)} /></label>
      <button type="submit" className="panel-primary-button" disabled={!ready}>{text.save}</button>
    </form>
    <p role="status">{message}</p>
    {queue.goals.length ? <ul>{queue.goals.map(goal => <li key={goal.chartKey}>
      <span>{charts.get(goal.chartKey) ?? goal.chartKey} → {goal.target}% {goal.note}</span>
      <button type="button" className="panel-secondary-button" onClick={() => { setSelected(goal.chartKey); setTarget(String(goal.target)); setNote(goal.note); }}>{text.edit}</button>
      <button type="button" className="panel-danger-button" disabled={!ready} onClick={() => update(current => ({ ...current, goals: current.goals.filter(item => item.chartKey !== goal.chartKey) }))}>{text.remove}</button>
    </li>)}</ul> : <p>{text.empty}</p>}
  </details>;
}
