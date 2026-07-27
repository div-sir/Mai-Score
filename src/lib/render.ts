import type { CollectionResult, ResolvedScore } from "./types";

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
}[c]!));

const colors: Record<string, string> = {
  basic: "#36c985", advanced: "#f5c842", expert: "#ff5b66", master: "#9d69ff", remaster: "#d8a9ff"
};

function card(record: ResolvedScore, index: number, asset?: string): string {
  const column = index % 5;
  const row = Math.floor(index / 5);
  const x = 44 + column * 382;
  const y = 350 + row * 215;
  const title = record.title.length > 22 ? `${record.title.slice(0, 21)}…` : record.title;
  return `<g transform="translate(${x} ${y})">
    <rect width="358" height="190" rx="18" fill="var(--card)" stroke="${colors[record.difficulty]}55" stroke-width="3"/>
    ${asset ? `<image href="${asset}" x="14" y="14" width="112" height="112" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="14" y="14" width="112" height="112" rx="12" fill="${colors[record.difficulty]}33"/>`}
    <text x="140" y="38" class="title">${esc(title)}</text>
    <text x="140" y="70" class="meta">${record.type.toUpperCase()} · ${record.difficulty.toUpperCase()} · ${esc(record.displayedLevel)}</text>
    <text x="140" y="107" class="rate">${record.achievementRate.toFixed(4)}%</text>
    <rect x="14" y="141" width="330" height="36" rx="10" fill="${colors[record.difficulty]}22"/>
    <text x="28" y="166" class="small">${record.bucket.toUpperCase()} #${record.bucket === "b15" ? index + 1 : index - 14}</text>
    <text x="330" y="166" text-anchor="end" class="score">${record.chartRating ?? "?"}</text>
  </g>`;
}

export function renderB50Svg(
  result: CollectionResult,
  theme: "night" | "light",
  assets: { icon?: string; frame?: string; covers?: Record<string, string> } = {}
): string {
  const night = theme === "night";
  const background = night ? "#0b1022" : "#f3f6ff";
  const foreground = night ? "#f4f7ff" : "#11182c";
  const muted = night ? "#98a4c8" : "#637092";
  const cardColor = night ? "#141b35" : "#ffffff";
  const ordered = [...result.records].sort((a, b) => a.bucket === b.bucket ? 0 : a.bucket === "b15" ? -1 : 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2550" viewBox="0 0 2000 2550">
  <style>
    :root{--card:${cardColor}} text{font-family:Inter,"Noto Sans CJK TC","Noto Sans",sans-serif;fill:${foreground}}
    .title{font-size:21px;font-weight:750}.meta,.small{font-size:14px;fill:${muted}}.rate{font-size:27px;font-weight:800}.score{font-size:24px;font-weight:850}
  </style>
  <rect width="2000" height="2550" fill="${background}"/>
  ${assets.frame ? `<image href="${assets.frame}" x="0" y="0" width="2000" height="315" preserveAspectRatio="xMidYMid slice" opacity=".88"/>` : ""}
  <rect x="28" y="24" width="1944" height="286" rx="28" fill="${cardColor}" opacity=".94"/>
  ${assets.icon ? `<image href="${assets.icon}" x="64" y="66" width="168" height="168" preserveAspectRatio="xMidYMid slice"/>` : ""}
  <text x="${assets.icon ? 264 : 72}" y="102" font-size="25" fill="${muted}">${esc(result.player.title)}</text>
  <text x="${assets.icon ? 264 : 72}" y="162" font-size="49" font-weight="850">${esc(result.player.name)}</text>
  <text x="${assets.icon ? 264 : 72}" y="211" font-size="25" fill="${muted}">Official Rating ${result.player.rating}</text>
  <text x="1908" y="126" text-anchor="end" font-size="25" fill="${muted}">BEST 50</text>
  <text x="1908" y="198" text-anchor="end" font-size="68" font-weight="900">${result.b50Rating}</text>
  <text x="1908" y="238" text-anchor="end" font-size="21" fill="${muted}">B15 ${result.b15Rating} + B35 ${result.b35Rating}</text>
  ${ordered.map((record, i) => card(record, i, record.imageName ? assets.covers?.[record.imageName] : undefined)).join("")}
  <text x="1000" y="2510" text-anchor="middle" font-size="18" fill="${muted}">Generated locally by Mai-Score · ${esc(result.exportedAt.slice(0, 10))}</text>
</svg>`;
}
