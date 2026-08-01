import {
  DEFAULT_IMAGE_OPTIONS,
  formatImageTimestamp,
  type AccentScope,
  type ImageLayout,
  type ImageOptions,
  type ImageTheme
} from "./image-options";
import type { CollectionResult, ResolvedScore } from "./types";

export interface RenderAssets {
  icon?: string;
  frame?: string;
  plate?: string;
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

interface Palette {
  background: string;
  foreground: string;
  muted: string;
  card: string;
  header: string;
  strip: string;
}

const palettes: Record<ImageTheme, Palette> = {
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

// The trophy plate colours follow DX NET's own trophy_* rarity classes, which
// the parser records as player.titleColor. An unknown rarity reads as normal
// rather than losing the trophy entirely.
const trophyStyles: Record<string, { stops: string[]; text: string }> = {
  normal: { stops: ["#eef1f7", "#c3cbdb"], text: "#28304a" },
  bronze: { stops: ["#e9b78d", "#bd7746"], text: "#3a2010" },
  silver: { stops: ["#f1f4fa", "#b6c1d2"], text: "#28304a" },
  gold: { stops: ["#f8e5a6", "#d6aa42"], text: "#463207" },
  rainbow: { stops: ["#ffd7e6", "#fff4c4", "#c9f0d6", "#c9e2ff", "#e6d2ff"], text: "#33234a" }
};

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
}[character]!));

const alpha = (hex: string, opacity: number) =>
  `${hex}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, "0")}`;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Blends two `#rrggbb` colours. `amount` is how much of `towards` to take. */
function mix(base: string, towards: string, amount: number): string {
  const ratio = clamp01(amount);
  if (ratio === 0) return base;
  const channels = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const [r1, g1, b1] = channels(base);
  const [r2, g2, b2] = channels(towards);
  const blend = (a: number, b: number) => Math.round(a + (b - a) * ratio).toString(16).padStart(2, "0");
  return `#${blend(r1, r2)}${blend(g1, g2)}${blend(b1, b2)}`;
}

/**
 * How much accent each kind of surface takes. `minimal` reproduces the
 * original look, where the accent only coloured the elements dedicated to it.
 */
export function accentReach(scope: AccentScope): { outline: number; surface: number } {
  if (scope === "full") return { outline: .64, surface: .1 };
  if (scope === "outline") return { outline: .48, surface: 0 };
  return { outline: 0, surface: 0 };
}

/** Pulls a theme's surfaces toward the accent by the configured amount. */
function accentedPalette(theme: ImageTheme, accent: string, scope: AccentScope): Palette {
  const base = palettes[theme];
  const { surface } = accentReach(scope);
  if (surface === 0) return base;
  return {
    ...base,
    background: mix(base.background, accent, surface * .55),
    card: mix(base.card, accent, surface),
    header: mix(base.header, accent, surface),
    strip: mix(base.strip, accent, surface * 1.7)
  };
}
function textUnits(value: string): number {
  return [...value].reduce((sum, character) => sum + (/[\u0000-\u00ff]/.test(character) ? 0.56 : 1), 0);
}

// One unit is one full-width glyph, so a unit is close to one em; the extra
// covers the wider bold faces. Sizing a box to a string without this comes out
// far too narrow for CJK and the text spills out of it.
const UNIT_EM = 1.05;
const textWidth = (value: string, fontSize: number) => textUnits(value) * fontSize * UNIT_EM;
const widthUnits = (available: number, fontSize: number) => available / (fontSize * UNIT_EM);

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

/**
 * The difficulty figures on a card's metadata line. `constant` falls back to
 * the displayed level for a chart the database could not resolve, so an
 * unmatched card still says how hard it is instead of going blank.
 */
function chartValueParts(options: ImageOptions, record: ResolvedScore): string[] {
  const constant = Number.isFinite(record.internalLevelValue)
    ? Number(record.internalLevelValue).toFixed(1)
    : undefined;
  switch (options.chartValue) {
    case "none": return [];
    case "constant": return [constant ?? record.displayedLevel];
    case "both": return constant ? [record.displayedLevel, constant] : [record.displayedLevel];
    default: return [record.displayedLevel];
  }
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
  palette: Palette,
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
  // 1.65 units per point of font size assumed a unit was ~0.6em, which let a
  // full-width title run past the card edge. A unit is one full-width glyph.
  const titleUnits = widthUnits(contentWidth, spec.titleSize);
  const stripY = spec.cardHeight - spec.stripHeight - pad;
  const achievementY = Math.min(
    stripY - 16,
    spec.padding + spec.achievementSize + (spec === layouts.landscape ? 84 : 60)
  );
  const color = difficultyColors[record.difficulty];
  // Difficulty still leads the card border; the accent is blended into it so
  // a restyled export reads as one palette instead of five stray hues.
  const borderColor = mix(color, options.accentColor, accentReach(options.accentScope).outline);
  const borderOpacity = options.accentScope === "minimal" ? .42 : .62;
  const meta = [
    record.type.toUpperCase(),
    record.difficulty.toUpperCase(),
    ...chartValueParts(options, record)
  ].join(" · ");
  const bucketLabel = `${record.bucket.toUpperCase()} #${bucketIndex(records, index)}`;

  return `<g transform="translate(${x} ${y})">
    <rect width="${spec.cardWidth}" height="${spec.cardHeight}" rx="${spec.cardRadius}" fill="${palette.card}" stroke="${alpha(borderColor, .62)}" stroke-width="3"/>
    ${hasCover
      ? `<image href="${asset}" x="${pad}" y="${pad}" width="${spec.coverSize}" height="${spec.coverSize}" preserveAspectRatio="xMidYMid slice"/>`
      : options.showCovers
        ? `<rect x="${pad}" y="${pad}" width="${spec.coverSize}" height="${spec.coverSize}" rx="${Math.round(spec.cardRadius * .6)}" fill="${alpha(color, .16)}"/>`
        : ""}
    <text x="${contentX}" y="${pad + spec.titleSize}" font-size="${spec.titleSize}" font-weight="750">${esc(truncate(record.title, titleUnits))}</text>
    <text x="${contentX}" y="${pad + spec.titleSize + spec.metaSize + 13}" font-size="${spec.metaSize}" style="fill:${palette.muted}">${esc(meta)}</text>
    ${options.showAchievement
      ? `<text x="${contentX}" y="${achievementY}" font-size="${spec.achievementSize}" font-weight="800">${record.achievementRate.toFixed(4)}%</text>`
      : ""}
    ${(options.showBucketRank || options.showChartRating)
      ? `<rect x="${pad}" y="${stripY}" width="${spec.cardWidth - pad * 2}" height="${spec.stripHeight}" rx="${Math.round(spec.stripHeight / 3)}" fill="${options.theme === "maimai" ? alpha(color, .13) : palette.strip}"/>
        ${options.showBucketRank ? `<text x="${pad * 2}" y="${stripY + spec.stripHeight * .68}" font-size="${spec.metaSize}" style="fill:${palette.muted}">${bucketLabel}</text>` : ""}
        ${options.showChartRating ? `<text x="${spec.cardWidth - pad * 2}" y="${stripY + spec.stripHeight * .72}" text-anchor="end" font-size="${spec.achievementSize * .88}" font-weight="850">${record.chartRating ?? "?"}</text>` : ""}`
      : ""}
  </g>`;
}

/**
 * The trophy the game shows under a player's name, with its rarity colour.
 * Returns the markup plus the box it occupies, so the nameplate behind it can
 * be sized to the block rather than to a guessed constant.
 */
function trophyBadge(
  title: string,
  titleColor: string | undefined,
  x: number,
  top: number,
  maxWidth: number,
  compact: boolean
): { markup: string; width: number; height: number } {
  const style = trophyStyles[String(titleColor ?? "").toLowerCase()] ?? trophyStyles.normal;
  const fontSize = compact ? 17 : 20;
  const height = compact ? 30 : 36;
  const padding = compact ? 16 : 20;
  const available = Math.max(120, maxWidth);
  const label = truncate(title, widthUnits(available - padding * 2, fontSize));
  const width = Math.min(available, Math.round(textWidth(label, fontSize)) + padding * 2);
  const stops = style.stops.map((color, index) =>
    `<stop offset="${(index / Math.max(1, style.stops.length - 1)).toFixed(3)}" stop-color="${color}"/>`
  ).join("");
  return {
    width,
    height,
    markup: `<defs><linearGradient id="trophyFill" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs>
  <g transform="translate(${x} ${top})">
    <rect width="${width}" height="${height}" rx="${Math.round(height / 2)}" fill="url(#trophyFill)" stroke="${alpha(style.text, .28)}"/>
    <text x="${width / 2}" y="${height * .68}" text-anchor="middle" font-size="${fontSize}" font-weight="700" style="fill:${style.text}">${esc(label)}</text>
  </g>`
  };
}

function header(
  result: CollectionResult,
  spec: LayoutSpec,
  options: ImageOptions,
  palette: Palette,
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
  const scoreBoxWidth = options.layout === "compact" ? 142 : 168;
  const scoreBoxHeight = options.layout === "compact" ? 42 : 50;
  const scoreBoxGap = 10;
  const scoreBoxY = ratingY - (options.layout === "compact" ? 8 : 5);
  const scoreBoxesX = scoreX - scoreBoxWidth * 2 - scoreBoxGap;
  const compact = options.layout === "compact";
  const nameSize = compact ? 42 : 49;
  // The breakdown boxes are the leftmost thing on the right-hand side, so the
  // name block may grow up to them and no further.
  const nameBlockWidth = Math.max(160, scoreBoxesX - textX - 28);
  const trophyTop = nameY + (compact ? 14 : 16);
  const trophy = options.showPlayerTitle && result.player.title
    ? trophyBadge(result.player.title, result.player.titleColor, textX, trophyTop, nameBlockWidth, compact)
    : undefined;
  const plateTop = nameY - nameSize - (compact ? 10 : 12);
  const plateBottom = (trophy ? trophyTop + trophy.height : nameY + 10) + (compact ? 6 : 8);
  const platePad = compact ? 16 : 22;
  // Hugs the name and trophy rather than filling the space up to the score
  // boxes: a nameplate stretched across half the header stops reading as one.
  const plateWidth = Math.min(
    nameBlockWidth + platePad,
    Math.round(Math.max(textWidth(result.player.name, nameSize) + nameSize / 2, trophy?.width ?? 0)) + platePad * 2
  );

  return `
  ${options.showFrame && assets.frame ? `<image href="${assets.frame}" x="0" y="0" width="${spec.width}" height="${spec.startY - 58}" preserveAspectRatio="xMidYMid slice" opacity=".9"/>` : ""}
  <rect x="${panelX}" y="${panelY}" width="${panelWidth}" height="${spec.headerHeight - 10}" rx="28" fill="${palette.header}" opacity=".95" stroke="${alpha(options.accentColor, .25)}" stroke-width="2"/>
  <rect x="${panelX}" y="${panelY}" width="10" height="${spec.headerHeight - 10}" rx="5" fill="${options.accentColor}"/>
  ${options.showIcon && assets.icon ? `<image href="${assets.icon}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid slice"/>` : ""}
  ${options.showPlate && assets.plate ? `<defs><clipPath id="plateClip">
    <rect x="${textX - platePad}" y="${plateTop}" width="${plateWidth}" height="${plateBottom - plateTop}" rx="18"/>
  </clipPath></defs>
  <g clip-path="url(#plateClip)">
    <image href="${assets.plate}" x="${textX - platePad}" y="${plateTop}" width="${plateWidth}" height="${plateBottom - plateTop}" preserveAspectRatio="xMidYMid slice" opacity=".55"/>
    <rect x="${textX - platePad}" y="${plateTop}" width="${plateWidth}" height="${plateBottom - plateTop}" fill="${alpha(palette.header, .55)}"/>
  </g>` : ""}
  <text x="${textX}" y="${nameY}" font-size="${nameSize}" font-weight="850" letter-spacing="2">${esc(result.player.name)}</text>
  ${trophy?.markup ?? ""}
  <text x="${scoreX}" y="${titleY}" text-anchor="end" font-size="${options.layout === "compact" ? 17 : 21}" font-weight="700" letter-spacing="1.5" style="fill:${palette.muted}">BEST 50 · TOTAL</text>
  <text x="${scoreX}" y="${nameY + 10}" text-anchor="end" font-size="${options.layout === "compact" ? 56 : 68}" font-weight="900">${result.b50Rating}</text>
  ${options.showRatingBreakdown ? `
    <g transform="translate(${scoreBoxesX} ${scoreBoxY})">
      <rect width="${scoreBoxWidth}" height="${scoreBoxHeight}" rx="10" fill="${alpha(options.accentColor, .13)}" stroke="${alpha(options.accentColor, .34)}"/>
      <text x="12" y="${scoreBoxHeight * .36}" font-size="${options.layout === "compact" ? 9 : 11}" font-weight="800" letter-spacing=".7" style="fill:${palette.muted}">${copy.newBreakdown}</text>
      <text x="${scoreBoxWidth - 12}" y="${scoreBoxHeight * .78}" text-anchor="end" font-size="${options.layout === "compact" ? 18 : 22}" font-weight="850">${result.b15Rating}</text>
    </g>
    <g transform="translate(${scoreBoxesX + scoreBoxWidth + scoreBoxGap} ${scoreBoxY})">
      <rect width="${scoreBoxWidth}" height="${scoreBoxHeight}" rx="10" fill="${alpha(options.accentColor, .07)}" stroke="${alpha(options.accentColor, .2)}"/>
      <text x="12" y="${scoreBoxHeight * .36}" font-size="${options.layout === "compact" ? 9 : 11}" font-weight="800" letter-spacing=".7" style="fill:${palette.muted}">${copy.oldBreakdown}</text>
      <text x="${scoreBoxWidth - 12}" y="${scoreBoxHeight * .78}" text-anchor="end" font-size="${options.layout === "compact" ? 18 : 22}" font-weight="850">${result.b35Rating}</text>
    </g>` : ""}`;
}

export function renderB50Document(
  result: CollectionResult,
  options: ImageOptions,
  assets: RenderAssets = {},
  generatedAt = new Date(),
  locale = "en"
): RenderedImage {
  const spec = layouts[options.layout];
  const palette = accentedPalette(options.theme, options.accentColor, options.accentScope);
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
    <text x="${spec.width - spec.marginX - 14}" y="${spec.startY - 22}" text-anchor="end" font-size="16" style="fill:${palette.muted}">${newRecords.length} ${copy.charts} · ${result.b15Rating}</text>
  </g>
  <g>
    <rect x="${spec.marginX}" y="${oldStartY - 46}" width="${spec.width - spec.marginX * 2}" height="34" rx="10" fill="${alpha(options.accentColor, .11)}"/>
    <text x="${spec.marginX + 14}" y="${oldStartY - 22}" font-size="18" font-weight="850">${copy.oldSection}</text>
    <text x="${spec.width - spec.marginX - 14}" y="${oldStartY - 22}" text-anchor="end" font-size="16" style="fill:${palette.muted}">${oldRecords.length} ${copy.charts} · ${result.b35Rating}</text>
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
  ${footerLeft ? `<text x="${spec.marginX}" y="${footerY}" font-size="16" style="fill:${palette.muted}">${esc(footerLeft)}</text>` : ""}
  ${footerRight ? `<text x="${spec.width - spec.marginX}" y="${footerY}" text-anchor="end" font-size="16" style="fill:${palette.muted}">${esc(footerRight)}</text>` : ""}
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
