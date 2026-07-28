import {
  DEFAULT_IMAGE_OPTIONS,
  formatImageTimestamp,
  type ImageLayout,
  type ImageOptions,
  type ImageTheme
} from "./image-options";
import { ratingTier } from "./rating-tier";
import type { CollectionResult, ResolvedScore } from "./types";

export interface RenderAssets {
  icon?: string;
  frame?: string;
  covers?: Record<string, string>;
}

export interface RenderedImage {
  svg: string;
  width: number;
  height: number;
}

interface LayoutSpec {
  width: number;
  height: number;
  columns: number;
  marginX: number;
  startY: number;
  gapX: number;
  gapY: number;
  cardWidth: number;
  cardHeight: number;
  cardRadius: number;
  padding: number;
  coverSize: number;
  titleSize: number;
  metaSize: number;
  achievementSize: number;
  stripHeight: number;
  headerHeight: number;
  sectionGap: number;
}

const layouts: Record<ImageLayout, LayoutSpec> = {
  classic: {
    width: 2000, height: 2650, columns: 5, marginX: 44, startY: 370,
    gapX: 24, gapY: 25, cardWidth: 358, cardHeight: 190, cardRadius: 18,
    padding: 14, coverSize: 112, titleSize: 21, metaSize: 14,
    achievementSize: 27, stripHeight: 36, headerHeight: 286, sectionGap: 60
  },
  compact: {
    width: 1600, height: 1990, columns: 5, marginX: 28, startY: 300,
    gapX: 14, gapY: 14, cardWidth: 297, cardHeight: 142, cardRadius: 14,
    padding: 10, coverSize: 72, titleSize: 17, metaSize: 11,
    achievementSize: 21, stripHeight: 28, headerHeight: 222, sectionGap: 48
  },
  landscape: {
    width: 3000, height: 1840, columns: 10, marginX: 34, startY: 360,
    gapX: 12, gapY: 16, cardWidth: 282, cardHeight: 210, cardRadius: 16,
    padding: 12, coverSize: 84, titleSize: 17, metaSize: 11,
    achievementSize: 23, stripHeight: 34, headerHeight: 275, sectionGap: 60
  }
};

interface RenderCopy {
  newBreakdown: string;
  oldBreakdown: string;
  newSection: string;
  oldSection: string;
  charts: string;
  generated: string;
}

function renderCopy(locale: string): RenderCopy {
  if (locale.toLowerCase().startsWith("zh")) {
    return {
      newBreakdown: "新曲 B15",
      oldBreakdown: "舊曲 B35",
      newSection: "新曲區 · BEST 15",
      oldSection: "舊曲區 · BEST 35",
      charts: "首",
      generated: "由 Mai-Score 在本機產生"
    };
  }
  if (locale.toLowerCase().startsWith("ja")) {
    return {
      newBreakdown: "新曲 B15",
      oldBreakdown: "旧曲 B35",
      newSection: "新曲枠 · BEST 15",
      oldSection: "旧曲枠 · BEST 35",
      charts: "譜面",
      generated: "Mai-Score でローカル生成"
    };
  }
  return {
    newBreakdown: "New B15",
    oldBreakdown: "Old B35",
    newSection: "NEW CHARTS · BEST 15",
    oldSection: "OLD CHARTS · BEST 35",
    charts: "charts",
    generated: "Generated locally by Mai-Score"
  };
}

const difficultyColors: Record<string, string> = {
  basic: "#36c985",
  advanced: "#f5c842",
  expert: "#ff5b66",
  master: "#9d69ff",
  remaster: "#d8a9ff"
};

const palettes: Record<ImageTheme, {
  background: string;
  foreground: string;
  muted: string;
  card: string;
  header: string;
  strip: string;
}> = {
  night: {
    background: "#0b1022", foreground: "#f4f7ff", muted: "#98a4c8",
    card: "#141b35", header: "#141b35", strip: "#292653"
  },
  light: {
    background: "#f3f6ff", foreground: "#11182c", muted: "#637092",
    card: "#ffffff", header: "#ffffff", strip: "#e9edfb"
  },
  maimai: {
    background: "#ddf6ff", foreground: "#173348", muted: "#58778a",
    card: "#ffffff", header: "#fffaf2", strip: "#dff5ff"
  }
};

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
}[character]!));

const alpha = (hex: string, opacity: number) =>
  `${hex}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, "0")}`;

// A compact two-tone pill echoing the in-game DELUXE RATING badge: a
// tier-coloured label zone fused into a dark number zone. Self-contained
// (its <defs> can sit anywhere in the document per the SVG spec) so callers
// only need an anchor point and a height.
function ratingBadge(x: number, yCenter: number, rating: number, height: number): string {
  const tier = ratingTier(rating);
  const labelWidth = height * 2.35;
  const numberWidth = String(rating).length * height * 0.58 + height * 0.85;
  const y = yCenter - height / 2;
  const stops = tier.gradient.map((color, index) =>
    `<stop offset="${tier.gradient.length > 1 ? Math.round(index / (tier.gradient.length - 1) * 100) : 0}%" stop-color="${color}"/>`
  ).join("");

  return `
  <defs><linearGradient id="ratingTierGradient" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs>
  <g transform="translate(${x} ${y})">
    <rect x="0" y="0" width="${labelWidth + height / 2}" height="${height}" rx="${height / 2}" fill="url(#ratingTierGradient)" stroke="#00000030" stroke-width="1.5"/>
    <rect x="${labelWidth - height / 2}" y="0" width="${numberWidth}" height="${height}" rx="${height / 2}" fill="#1c1c1c"/>
    <text x="${labelWidth / 2}" y="${height * 0.63}" text-anchor="middle" font-size="${Math.round(height * 0.32)}" font-weight="800" letter-spacing="0.5" style="fill:${tier.labelColor}">RATING</text>
    <text x="${labelWidth - height / 2 + numberWidth / 2}" y="${height * 0.71}" text-anchor="middle" font-size="${Math.round(height * 0.5)}" font-weight="900" style="fill:#ffffff">${rating}</text>
  </g>`;
}

function textUnits(value: string): number {
  return [...value].reduce((sum, character) => sum + (/[\u0000-\u00ff]/.test(character) ? 0.56 : 1), 0);
}

function truncate(value: string, units: number): string {
  if (textUnits(value) <= units) return value;
  let result = "";
  let used = 0;
  for (const character of value) {
    const width = /[\u0000-\u00ff]/.test(character) ? 0.56 : 1;
    if (used + width > units - 1) break;
    result += character;
    used += width;
  }
  return `${result}…`;
}

function bucketIndex(records: ResolvedScore[], recordIndex: number): number {
  const bucket = records[recordIndex].bucket;
  return records.slice(0, recordIndex + 1).filter((record) => record.bucket === bucket).length;
}

function renderCard(
  record: ResolvedScore,
  index: number,
  sectionIndex: number,
  sectionStartY: number,
  records: ResolvedScore[],
  spec: LayoutSpec,
  options: ImageOptions,
  palette: typeof palettes[ImageTheme],
  asset?: string
): string {
  const column = sectionIndex % spec.columns;
  const row = Math.floor(sectionIndex / spec.columns);
  const x = spec.marginX + column * (spec.cardWidth + spec.gapX);
  const y = sectionStartY + row * (spec.cardHeight + spec.gapY);
  const pad = spec.padding;
  const reservesCover = options.showCovers;
  const hasCover = reservesCover && Boolean(asset);
  const contentX = reservesCover ? pad + spec.coverSize + pad : pad;
  const contentWidth = spec.cardWidth - contentX - pad;
  const titleUnits = contentWidth / spec.titleSize * 1.65;
  const stripY = spec.cardHeight - spec.stripHeight - pad;
  const achievementY = Math.min(
    stripY - 16,
    spec.padding + spec.achievementSize + (spec === layouts.landscape ? 84 : 60)
  );
  const color = difficultyColors[record.difficulty];
  const meta = [
    record.type.toUpperCase(),
    record.difficulty.toUpperCase(),
    ...(options.showLevel ? [record.displayedLevel] : [])
  ].join(" · ");
  const bucketLabel = `${record.bucket.toUpperCase()} #${bucketIndex(records, index)}`;

  return `<g transform="translate(${x} ${y})">
    <rect width="${spec.cardWidth}" height="${spec.cardHeight}" rx="${spec.cardRadius}" fill="${palette.card}" stroke="${alpha(color, .42)}" stroke-width="3"/>
    ${hasCover
      ? `<image href="${asset}" x="${pad}" y="${pad}" width="${spec.coverSize}" height="${spec.coverSize}" preserveAspectRatio="xMidYMid slice"/>`
      : options.showCovers
        ? `<rect x="${pad}" y="${pad}" width="${spec.coverSize}" height="${spec.coverSize}" rx="${Math.round(spec.cardRadius * .6)}" fill="${alpha(color, .16)}"/>`
        : ""}
    <text x="${contentX}" y="${pad + spec.titleSize}" font-size="${spec.titleSize}" font-weight="750">${esc(truncate(record.title, titleUnits))}</text>
    <text x="${contentX}" y="${pad + spec.titleSize + spec.metaSize + 13}" font-size="${spec.metaSize}" fill="${palette.muted}">${esc(meta)}</text>
    ${options.showAchievement
      ? `<text x="${contentX}" y="${achievementY}" font-size="${spec.achievementSize}" font-weight="800">${record.achievementRate.toFixed(4)}%</text>`
      : ""}
    ${(options.showBucketRank || options.showChartRating)
      ? `<rect x="${pad}" y="${stripY}" width="${spec.cardWidth - pad * 2}" height="${spec.stripHeight}" rx="${Math.round(spec.stripHeight / 3)}" fill="${options.theme === "maimai" ? alpha(color, .13) : palette.strip}"/>
        ${options.showBucketRank ? `<text x="${pad * 2}" y="${stripY + spec.stripHeight * .68}" font-size="${spec.metaSize}" fill="${palette.muted}">${bucketLabel}</text>` : ""}
        ${options.showChartRating ? `<text x="${spec.cardWidth - pad * 2}" y="${stripY + spec.stripHeight * .72}" text-anchor="end" font-size="${spec.achievementSize * .88}" font-weight="850">${record.chartRating ?? "?"}</text>` : ""}`
      : ""}
  </g>`;
}

function header(
  result: CollectionResult,
  spec: LayoutSpec,
  options: ImageOptions,
  palette: typeof palettes[ImageTheme],
  assets: RenderAssets,
  copy: RenderCopy
): string {
  const margin = Math.max(24, Math.round(spec.width * .014));
  const panelX = margin;
  const panelY = 24;
  const panelWidth = spec.width - margin * 2;
  const iconSize = options.layout === "compact" ? 124 : options.layout === "landscape" ? 150 : 168;
  const iconX = panelX + 36;
  const iconY = panelY + Math.round((spec.headerHeight - iconSize) / 2);
  const textX = options.showIcon && assets.icon ? iconX + iconSize + 34 : panelX + 52;
  const titleY = panelY + (options.layout === "compact" ? 62 : 78);
  const nameY = titleY + (options.layout === "compact" ? 46 : 60);
  const ratingY = nameY + (options.layout === "compact" ? 36 : 48);
  const scoreX = panelX + panelWidth - 52;

  return `
  ${options.showFrame && assets.frame ? `<image href="${assets.frame}" x="0" y="0" width="${spec.width}" height="${spec.headerHeight + 48}" preserveAspectRatio="xMidYMid slice" opacity=".9"/>` : ""}
  <rect x="${panelX}" y="${panelY}" width="${panelWidth}" height="${spec.headerHeight - 10}" rx="28" fill="${palette.header}" opacity=".95" stroke="${alpha(options.accentColor, .25)}" stroke-width="2"/>
  <rect x="${panelX}" y="${panelY}" width="10" height="${spec.headerHeight - 10}" rx="5" fill="${options.accentColor}"/>
  ${options.showIcon && assets.icon ? `<image href="${assets.icon}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid slice"/>` : ""}
  ${options.showPlayerTitle ? `<text x="${textX}" y="${titleY}" font-size="${options.layout === "compact" ? 22 : 25}" fill="${palette.muted}">${esc(result.player.title)}</text>` : ""}
  <text x="${textX}" y="${nameY}" font-size="${options.layout === "compact" ? 42 : 49}" font-weight="850" letter-spacing="2">${esc(result.player.name)}</text>
  ${options.showOfficialRating ? ratingBadge(textX, ratingY - (options.layout === "compact" ? 10 : 12), result.player.rating, options.layout === "compact" ? 30 : 36) : ""}
  <text x="${scoreX}" y="${titleY}" text-anchor="end" font-size="${options.layout === "compact" ? 20 : 25}" fill="${palette.muted}">BEST 50</text>
  <text x="${scoreX}" y="${nameY + 10}" text-anchor="end" font-size="${options.layout === "compact" ? 56 : 68}" font-weight="900">${result.b50Rating}</text>
  ${options.showRatingBreakdown ? `<text x="${scoreX}" y="${ratingY}" text-anchor="end" font-size="${options.layout === "compact" ? 17 : 21}" fill="${palette.muted}">${copy.newBreakdown} ${result.b15Rating} + ${copy.oldBreakdown} ${result.b35Rating}</text>` : ""}`;
}

export function renderB50Document(
  result: CollectionResult,
  options: ImageOptions,
  assets: RenderAssets = {},
  generatedAt = new Date(),
  locale = "en"
): RenderedImage {
  const spec = layouts[options.layout];
  const palette = palettes[options.theme];
  const copy = renderCopy(locale);
  const ordered = [...result.records].sort((a, b) => a.bucket === b.bucket ? 0 : a.bucket === "b15" ? -1 : 1);
  const newRecords = ordered.filter((record) => record.bucket === "b15").slice(0, 15);
  const oldRecords = ordered.filter((record) => record.bucket === "b35").slice(0, 35);
  const newRows = Math.ceil(newRecords.length / spec.columns);
  const oldStartY = spec.startY + newRows * (spec.cardHeight + spec.gapY) + spec.sectionGap;
  const timestamp = formatImageTimestamp(generatedAt, options, locale);
  const footerY = spec.height - 28;
  const footerLeft = options.watermark || (options.showGeneratedBy ? copy.generated : "");
  const footerRight = [
    timestamp,
    result.connection?.id,
    options.layout
  ].filter(Boolean).join(" · ");

  return {
    width: spec.width,
    height: spec.height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}">
  <style>text{font-family:Inter,"Noto Sans CJK TC","Noto Sans",sans-serif;fill:${palette.foreground}}</style>
  <rect width="${spec.width}" height="${spec.height}" fill="${palette.background}"/>
  <defs>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="${options.accentColor}"/><stop offset="1" stop-color="${alpha(options.accentColor, .18)}"/>
    </linearGradient>
  </defs>
  ${header(result, spec, options, palette, assets, copy)}
  <g>
    <rect x="${spec.marginX}" y="${spec.startY - 46}" width="${spec.width - spec.marginX * 2}" height="34" rx="10" fill="${alpha(options.accentColor, .16)}"/>
    <text x="${spec.marginX + 14}" y="${spec.startY - 22}" font-size="18" font-weight="850">${copy.newSection}</text>
    <text x="${spec.width - spec.marginX - 14}" y="${spec.startY - 22}" text-anchor="end" font-size="16" fill="${palette.muted}">${newRecords.length} ${copy.charts} · ${result.b15Rating}</text>
  </g>
  <g>
    <rect x="${spec.marginX}" y="${oldStartY - 46}" width="${spec.width - spec.marginX * 2}" height="34" rx="10" fill="${alpha(options.accentColor, .11)}"/>
    <text x="${spec.marginX + 14}" y="${oldStartY - 22}" font-size="18" font-weight="850">${copy.oldSection}</text>
    <text x="${spec.width - spec.marginX - 14}" y="${oldStartY - 22}" text-anchor="end" font-size="16" fill="${palette.muted}">${oldRecords.length} ${copy.charts} · ${result.b35Rating}</text>
  </g>
  ${newRecords.map((record, sectionIndex) => renderCard(
    record,
    sectionIndex,
    sectionIndex,
    spec.startY,
    ordered,
    spec,
    options,
    palette,
    record.imageName ? assets.covers?.[record.imageName] : undefined
  )).join("")}
  ${oldRecords.map((record, sectionIndex) => renderCard(
    record,
    newRecords.length + sectionIndex,
    sectionIndex,
    oldStartY,
    ordered,
    spec,
    options,
    palette,
    record.imageName ? assets.covers?.[record.imageName] : undefined
  )).join("")}
  ${footerLeft ? `<text x="${spec.marginX}" y="${footerY}" font-size="16" fill="${palette.muted}">${esc(footerLeft)}</text>` : ""}
  ${footerRight ? `<text x="${spec.width - spec.marginX}" y="${footerY}" text-anchor="end" font-size="16" fill="${palette.muted}">${esc(footerRight)}</text>` : ""}
</svg>`
  };
}

export function renderB50Svg(
  result: CollectionResult,
  theme: "night" | "light",
  assets: RenderAssets = {}
): string {
  return renderB50Document(result, { ...DEFAULT_IMAGE_OPTIONS, theme }, assets).svg;
}
