"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { RatingTimelinePoint } from "../lib/insights";
import type { LanguageId } from "../lib/types";

type TimelineField = "b50" | "b15" | "b35";

interface TimelineChartProps {
  timeline: RatingTimelinePoint[];
  language: LanguageId;
  title: string;
  onDeletePoint: (observedAt: string) => Promise<void>;
}

const WIDTH = 760;
const HEIGHT = 230;
const PADDING = { top: 32, right: 24, bottom: 38, left: 58 };

export default function TimelineChart({ timeline, language, title, onDeletePoint }: TimelineChartProps) {
  const [field, setField] = useState<TimelineField>("b50");
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, timeline.length - 1));
  const [deleting, setDeleting] = useState(false);
  useEffect(() => setActiveIndex(Math.max(0, timeline.length - 1)), [timeline.length]);
  const geometry = useMemo(() => {
    if (!timeline.length) return undefined;
    const values = timeline.map((point) => point[field]);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = Math.max(2, Math.ceil((rawMax - rawMin) * .12));
    const min = Math.max(0, rawMin - padding);
    const max = Math.max(min + 1, rawMax + padding);
    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const points = values.map((value, index) => ({
      x: PADDING.left + (timeline.length === 1 ? plotWidth / 2 : index / (timeline.length - 1) * plotWidth),
      y: PADDING.top + (max - value) / (max - min) * plotHeight,
      value
    }));
    return { min, max, plotWidth, plotHeight, points };
  }, [timeline, field]);

  if (!geometry) return <div className="timeline-empty">—</div>;
  const boundedIndex = Math.min(activeIndex, timeline.length - 1);
  const active = geometry.points[boundedIndex];
  const activePoint = timeline[boundedIndex];
  const line = geometry.points.map((point) => `${point.x},${point.y}`).join(" ");
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return {
      y: PADDING.top + ratio * geometry.plotHeight,
      value: Math.round(geometry.max - ratio * (geometry.max - geometry.min))
    };
  });
  const tickIndexes = [...new Set([0, Math.floor((timeline.length - 1) / 2), timeline.length - 1])];
  const tooltipX = Math.min(WIDTH - 148, Math.max(PADDING.left, active.x - 58));
  const tooltipY = Math.max(4, active.y - 42);
  const copy = language === "zh-Hant"
    ? { selected: "已選紀錄", remove: "刪除異常紀錄", deleting: "正在刪除…" }
    : language === "ja"
      ? { selected: "選択中の記録", remove: "異常な記録を削除", deleting: "削除中…" }
      : { selected: "Selected record", remove: "Delete anomalous record", deleting: "Deleting…" };

  return (
    <article className="timeline-panel">
      <header>
        <h2>{title}</h2>
        <div className="timeline-switch" aria-label={title}>
          {(["b50", "b15", "b35"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={field === option}
              onClick={() => setField(option)}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${title}: ${field.toUpperCase()}`}>
        {yTicks.map((tick) => <g key={tick.y}>
          <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={tick.y} y2={tick.y} />
          <text x={PADDING.left - 10} y={tick.y + 4} textAnchor="end">{tick.value}</text>
        </g>)}
        <polyline className="timeline-line" points={line} />
        {geometry.points.map((point, index) => (
          <circle
            key={timeline[index].observedAt}
            className={index === boundedIndex ? "active" : ""}
            cx={point.x}
            cy={point.y}
            r={index === boundedIndex ? 5 : 3}
            tabIndex={0}
            role="button"
            aria-label={`${new Date(timeline[index].observedAt).toLocaleString(language)} · ${field.toUpperCase()} ${point.value}`}
            onFocus={() => setActiveIndex(index)}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => setActiveIndex(index)}
            onKeyDown={(event: KeyboardEvent<SVGCircleElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setActiveIndex(index);
              }
            }}
          />
        ))}
        {tickIndexes.map((index) => (
          <text key={timeline[index].observedAt} className="timeline-date" x={geometry.points[index].x} y={HEIGHT - 10} textAnchor={index === 0 ? "start" : index === timeline.length - 1 ? "end" : "middle"}>
            {new Date(timeline[index].observedAt).toLocaleDateString(language, { month: "short", day: "numeric" })}
          </text>
        ))}
        <g className="timeline-tooltip" transform={`translate(${tooltipX} ${tooltipY})`}>
          <rect width="116" height="35" rx="7" />
          <text x="9" y="14">{new Date(activePoint.observedAt).toLocaleDateString(language)}</text>
          <text className="value" x="107" y="27" textAnchor="end">{active.value}</text>
        </g>
      </svg>
      <footer className="timeline-point-actions">
        <span><small>{copy.selected}</small><strong>{new Date(activePoint.observedAt).toLocaleString(language)} · {field.toUpperCase()} {active.value}</strong></span>
        <button type="button" disabled={deleting} onClick={async () => {
          setDeleting(true);
          try { await onDeletePoint(activePoint.observedAt); }
          finally { setDeleting(false); }
        }}>{deleting ? copy.deleting : copy.remove}</button>
      </footer>
    </article>
  );
}
