import type { RhythmGameId } from "../../src/lib/rhythm-record";
import type { LanguageId } from "./types";
import {
  levelInsights,
  sdvxVolforce,
  targetScoreCandidates,
  type InsightScore
} from "./rhythm-insights";

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
})[character]!);

const short = (value: string, length = 34) => value.length > length ? `${value.slice(0, length - 1)}…` : value;
const gameName = (game: RhythmGameId) => game === "sound-voltex" ? "SOUND VOLTEX" : game === "dance-dance-revolution" ? "DanceDanceRevolution" : game;

export interface ScoreShareCard {
  svg: string;
  width: number;
  height: number;
}

export function renderScoreShareCard(
  game: RhythmGameId,
  records: readonly InsightScore[],
  target: number,
  language: LanguageId,
  generatedAt = new Date().toISOString()
): ScoreShareCard {
  const width = 1080;
  const height = 1350;
  const accent = game === "sound-voltex" ? "#e65e91" : "#d59a50";
  const allLevels = levelInsights(records);
  const levels = allLevels.slice(-6);
  const maximumAverage = Math.max(1, ...levels.map((entry) => entry.average));
  const candidates = targetScoreCandidates(records, target, 6);
  const vf = game === "sound-voltex" ? sdvxVolforce(records) : undefined;
  const number = (value: number) => value.toLocaleString(language);
  const t = language === "zh-Hant" ? {
    report: "成績分析卡", charts: "譜面", levels: "等級區間", goal: "目標分數", level: "等級表現", average: "平均",
    closest: "最接近目標", gap: "還差", vf: "推算 VOLFORCE", local: "由 Mai-Score 在瀏覽器本機產生"
  } : language === "ja" ? {
    report: "スコア分析カード", charts: "譜面", levels: "レベル帯", goal: "目標スコア", level: "レベル別成績", average: "平均",
    closest: "目標に近い譜面", gap: "あと", vf: "推定 VOLFORCE", local: "Mai-Score がブラウザ内で生成"
  } : {
    report: "Score insight card", charts: "Charts", levels: "Level bands", goal: "Target score", level: "Performance by level", average: "Average",
    closest: "Closest to target", gap: "Gap", vf: "Estimated VOLFORCE", local: "Generated locally by Mai-Score"
  };
  const levelRows = levels.map((entry, index) => {
    const y = 526 + index * 82;
    const bar = Math.max(10, entry.average / maximumAverage * 590);
    return `<text x="86" y="${y}" class="label">Lv ${escapeXml(entry.level)}</text><rect x="210" y="${y - 27}" width="620" height="28" rx="8" class="track"/><rect x="210" y="${y - 27}" width="${bar.toFixed(1)}" height="28" rx="8" fill="${accent}"/><text x="954" y="${y}" class="value" text-anchor="end">${number(entry.average)}</text>`;
  }).join("");
  const candidateRows = candidates.map((entry, index) => {
    const y = 1030 + index * 43;
    return `<text x="86" y="${y}" class="song">${escapeXml(short(entry.title))}</text><text x="954" y="${y}" class="gap" text-anchor="end">${escapeXml(t.gap)} ${number(entry.gap)}</text>`;
  }).join("");
  const metrics = [
    { label: t.charts, value: number(records.length) },
    { label: t.levels, value: number(allLevels.length) },
    { label: t.goal, value: number(target) },
    ...(vf?.counted.length ? [{ label: t.vf, value: vf.total.toFixed(3) }] : [])
  ];
  const metricWidth = 908 / metrics.length;
  const metricCards = metrics.map((metric, index) => `<g transform="translate(${86 + index * metricWidth},250)"><rect width="${metricWidth - 14}" height="126" rx="18" class="panel"/><text x="22" y="39" class="metric-label">${escapeXml(metric.label)}</text><text x="22" y="91" class="metric-value">${escapeXml(metric.value)}</text></g>`).join("");
  const date = new Date(generatedAt).toLocaleDateString(language, { year: "numeric", month: "short", day: "numeric" });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><style>
    text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#f0f1ed}.kicker{font-size:24px;font-weight:750;letter-spacing:4px;fill:${accent}}.title{font-size:54px;font-weight:850}.date{font-size:20px;fill:#9ba19b}.panel{fill:#202420;stroke:#ffffff20}.metric-label{font-size:18px;fill:#9ba19b}.metric-value{font-size:34px;font-weight:850}.section{font-size:25px;font-weight:800}.label{font-size:21px;font-weight:750}.value{font-size:21px;font-weight:800}.track{fill:#2a302b}.song{font-size:19px;font-weight:700}.gap{font-size:18px;font-weight:800;fill:${accent}}.footer{font-size:17px;fill:#858c86}
  </style><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#151815"/><stop offset="1" stop-color="#1d211d"/></linearGradient></defs>
  <rect width="1080" height="1350" fill="url(#bg)"/><rect x="0" width="14" height="1350" fill="${accent}"/>
  <text x="86" y="92" class="kicker">${escapeXml(t.report.toUpperCase())}</text><text x="86" y="165" class="title">${escapeXml(gameName(game))}</text><text x="954" y="165" class="date" text-anchor="end">${escapeXml(date)}</text>
  ${metricCards}<text x="86" y="453" class="section">${escapeXml(t.level)}</text>${levelRows}
  <line x1="86" y1="944" x2="994" y2="944" stroke="#ffffff20"/><text x="86" y="992" class="section">${escapeXml(t.closest)}</text>${candidateRows}
  <text x="86" y="1300" class="footer">${escapeXml(t.local)}</text><text x="994" y="1300" class="footer" text-anchor="end">mai-score.milifix.com</text>
  </svg>`;
  return { svg, width, height };
}
