import type { AccentScope, LanguageId, LayoutId, StudioAssets, StudioData, StudioOptions, StudioRecord, ThemeId } from "./types";

interface Spec {
  width: number; height: number; columns: number; margin: number; startY: number;
  gapX: number; gapY: number; cardW: number; cardH: number; cover: number;
  pad: number; title: number; meta: number; rate: number; strip: number; header: number;
  sectionGap: number;
}

const specs: Record<LayoutId, Spec> = {
  classic: { width: 2000, height: 2650, columns: 5, margin: 44, startY: 370, gapX: 24, gapY: 25, cardW: 358, cardH: 190, cover: 112, pad: 14, title: 21, meta: 14, rate: 27, strip: 36, header: 286, sectionGap: 60 },
  compact: { width: 1600, height: 1990, columns: 5, margin: 28, startY: 300, gapX: 14, gapY: 14, cardW: 297, cardH: 142, cover: 72, pad: 10, title: 17, meta: 11, rate: 21, strip: 28, header: 222, sectionGap: 48 },
  landscape: { width: 3000, height: 1840, columns: 10, margin: 34, startY: 360, gapX: 12, gapY: 16, cardW: 282, cardH: 210, cover: 84, pad: 12, title: 17, meta: 11, rate: 23, strip: 34, header: 275, sectionGap: 60 }
};

interface Palette { bg: string; fg: string; muted: string; card: string; header: string; strip: string }

const palettes: Record<ThemeId, Palette> = {
  night: { bg: "#0a1022", fg: "#f5f7ff", muted: "#98a4c8", card: "#141b35", header: "#151c36", strip: "#292653" },
  light: { bg: "#f3f6ff", fg: "#11182c", muted: "#637092", card: "#ffffff", header: "#ffffff", strip: "#e9edfb" },
  maimai: { bg: "#ddf6ff", fg: "#173348", muted: "#58778a", card: "#fffefd", header: "#fffaf2", strip: "#dff5ff" }
};

const difficulty: Record<string, string> = {
  basic: "#36c985", advanced: "#f5c842", expert: "#ff5b66", master: "#9d69ff", remaster: "#d8a9ff"
};

// Matches DX NET's own trophy_* rarity classes, recorded as player.titleColor.
// An unknown rarity reads as normal rather than losing the trophy entirely.
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
const alpha = (hex: string, opacity: number) => `${hex}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;
// Counting characters treats a full-width glyph as no wider than an "i", so
// CJK titles ran past the card edge. Measuring in units — one unit is one
// full-width glyph — is what the extension renderer does, and both have to
// agree or the same style exports differently from each side.
function textUnits(value: string): number {
  return [...value].reduce((sum, character) => sum + (/[\u0000-\u00ff]/.test(character) ? 0.56 : 1), 0);
}

// A unit is close to one em; the extra covers the wider bold faces.
const UNIT_EM = 1.05;
const textWidth = (value: string, fontSize: number) => textUnits(value) * fontSize * UNIT_EM;
const widthUnits = (available: number, fontSize: number) => available / (fontSize * UNIT_EM);

function truncate(value: string, units: number) {
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

/** Blends two `#rrggbb` colours. `amount` is how much of `towards` to take. */
function mix(base: string, towards: string, amount: number): string {
  const ratio = Math.max(0, Math.min(1, amount));
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
function accentedPalette(theme: ThemeId, accent: string, scope: AccentScope): Palette {
  const base = palettes[theme];
  const { surface } = accentReach(scope);
  if (surface === 0) return base;
  return {
    ...base,
    bg: mix(base.bg, accent, surface * .55),
    card: mix(base.card, accent, surface),
    header: mix(base.header, accent, surface),
    strip: mix(base.strip, accent, surface * 1.7)
  };
}

/**
 * The difficulty figures on a card's metadata line. `constant` falls back to
 * the displayed level for a chart with no resolved constant, so an unmatched
 * card still says how hard it is instead of going blank.
 */
function chartValueParts(options: StudioOptions, record: StudioRecord): string[] {
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

function assetUrl(url: string | undefined, origin: string) {
  if (!url || !origin) return undefined;
  return `${origin}/api/asset?url=${encodeURIComponent(url)}`;
}

function renderCopy(language: LanguageId) {
  if (language === "zh-Hant") return {
    newBreakdown: "新曲 B15",
    oldBreakdown: "舊曲 B35",
    newSection: "新曲區 · BEST 15",
    oldSection: "舊曲區 · BEST 35",
    charts: "首",
    generated: "由 Mai-Score Studio 在本機產生"
  };
  if (language === "ja") return {
    newBreakdown: "新曲 B15",
    oldBreakdown: "旧曲 B35",
    newSection: "新曲枠 · BEST 15",
    oldSection: "旧曲枠 · BEST 35",
    charts: "譜面",
    generated: "Mai-Score Studio でローカル生成"
  };
  return {
    newBreakdown: "New B15",
    oldBreakdown: "Old B35",
    newSection: "NEW CHARTS · BEST 15",
    oldSection: "OLD CHARTS · BEST 35",
    charts: "charts",
    generated: "Generated locally by Mai-Score Studio"
  };
}

function visibleTimestamp(options: StudioOptions, generatedAt: Date, language: LanguageId) {
  if (options.timestamp === "off") return "";
  const format: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    ...(options.timestamp === "datetime" ? { timeStyle: "short" as const } : {})
  };
  const locale = language === "zh-Hant" ? "zh-TW" : language === "ja" ? "ja-JP" : "en-US";
  return new Intl.DateTimeFormat(locale, format).format(generatedAt);
}

function rank(records: StudioRecord[], index: number) {
  const bucket = records[index].bucket;
  return records.slice(0, index + 1).filter((record) => record.bucket === bucket).length;
}

export function renderStudioSvg(
  data: StudioData,
  options: StudioOptions,
  language: LanguageId,
  origin = "",
  generatedAt = new Date(),
  assets: StudioAssets = { covers: {} }
) {
  const spec = specs[options.layout];
  const palette = accentedPalette(options.theme, options.accent, options.accentScope);
  const copy = renderCopy(language);
  const ordered = [...data.records].sort((a, b) => a.bucket === b.bucket ? 0 : a.bucket === "b15" ? -1 : 1);
  const newRecords = ordered.filter((record) => record.bucket === "b15").slice(0, 15);
  const oldRecords = ordered.filter((record) => record.bucket === "b35").slice(0, 35);
  const newRows = Math.ceil(newRecords.length / spec.columns);
  const oldStartY = spec.startY + newRows * (spec.cardH + spec.gapY) + spec.sectionGap;
  const icon = assets.icon ?? assetUrl(data.player.iconUrl, origin);
  const frame = assets.frame ?? assetUrl(data.player.frameUrl, origin);
  const plate = assets.plate ?? assetUrl(data.player.plateUrl, origin);
  const margin = Math.max(24, Math.round(spec.width * .014));
  const panelW = spec.width - margin * 2;
  const iconSize = options.layout === "compact" ? 124 : options.layout === "landscape" ? 150 : 168;
  const iconX = margin + 36;
  const iconY = 24 + Math.round((spec.header - iconSize) / 2);
  const textX = options.showIcon && icon ? iconX + iconSize + 34 : margin + 52;
  const titleY = 24 + (options.layout === "compact" ? 62 : 78);
  const nameY = titleY + (options.layout === "compact" ? 46 : 60);
  const ratingY = nameY + (options.layout === "compact" ? 36 : 48);
  const scoreX = margin + panelW - 52;
  const scoreBoxWidth = options.layout === "compact" ? 142 : 168;
  const scoreBoxHeight = options.layout === "compact" ? 42 : 50;
  const scoreBoxGap = 10;
  const scoreBoxY = ratingY - (options.layout === "compact" ? 8 : 5);
  const scoreBoxesX = scoreX - scoreBoxWidth * 2 - scoreBoxGap;
  const timestamp = visibleTimestamp(options, generatedAt, language);
  const compact = options.layout === "compact";
  const nameSize = compact ? 42 : 49;
  // The breakdown boxes are the leftmost thing on the right-hand side, so the
  // name block may grow up to them and no further.
  const nameBlockWidth = Math.max(160, scoreBoxesX - textX - 28);
  const trophyTop = nameY + (compact ? 14 : 16);
  const trophy = options.showTrophy && data.player.title
    ? trophyBadge(data.player.title, data.player.titleColor, textX, trophyTop, nameBlockWidth, compact)
    : undefined;
  const plateTop = nameY - nameSize - (compact ? 10 : 12);
  const plateBottom = (trophy ? trophyTop + trophy.height : nameY + 10) + (compact ? 6 : 8);
  const platePad = compact ? 16 : 22;
  // Hugs the name and trophy rather than filling the space up to the score
  // boxes: a nameplate stretched across half the header stops reading as one.
  const plateWidth = Math.min(
    nameBlockWidth + platePad,
    Math.round(Math.max(textWidth(data.player.name, nameSize) + nameSize / 2, trophy?.width ?? 0)) + platePad * 2
  );

  const renderCards = (records: StudioRecord[], sectionStartY: number, globalOffset: number) => records.map((record, sectionIndex) => {
    const index = globalOffset + sectionIndex;
    const column = sectionIndex % spec.columns;
    const row = Math.floor(sectionIndex / spec.columns);
    const x = spec.margin + column * (spec.cardW + spec.gapX);
    const y = sectionStartY + row * (spec.cardH + spec.gapY);
    const coverSource = record.imageName
      ? assets.covers[record.imageName]
        ?? assetUrl(`https://shama.dxrating.net/images/cover/v2/${record.imageName}.jpg`, origin)
      : undefined;
    const reservesCover = options.showCovers;
    const contentX = reservesCover ? spec.pad * 2 + spec.cover : spec.pad;
    const stripY = spec.cardH - spec.strip - spec.pad;
    const achievementY = Math.min(stripY - 16, spec.pad + spec.rate + (options.layout === "landscape" ? 84 : 60));
    const meta = [
      record.type.toUpperCase(),
      record.difficulty.toUpperCase(),
      ...chartValueParts(options, record)
    ].join(" · ");
    const titleUnits = widthUnits(spec.cardW - contentX - spec.pad, spec.title);
    const color = difficulty[record.difficulty] ?? options.accent;
    // Difficulty still leads the card border; the accent is blended into it so
    // a restyled export reads as one palette instead of five stray hues.
    const borderColor = mix(color, options.accent, accentReach(options.accentScope).outline);
    const borderOpacity = options.accentScope === "minimal" ? .45 : .62;
    return `<g transform="translate(${x} ${y})">
      <rect width="${spec.cardW}" height="${spec.cardH}" rx="16" fill="${palette.card}" stroke="${alpha(borderColor, .62)}" stroke-width="3"/>
      ${reservesCover ? coverSource
        ? `<image href="${coverSource}" x="${spec.pad}" y="${spec.pad}" width="${spec.cover}" height="${spec.cover}" preserveAspectRatio="xMidYMid slice"/>`
        : `<rect x="${spec.pad}" y="${spec.pad}" width="${spec.cover}" height="${spec.cover}" rx="10" fill="${alpha(color, .16)}"/>`
      : ""}
      <text x="${contentX}" y="${spec.pad + spec.title}" font-size="${spec.title}" font-weight="750">${esc(truncate(record.title, titleUnits))}</text>
      <text x="${contentX}" y="${spec.pad + spec.title + spec.meta + 13}" font-size="${spec.meta}" style="fill:${palette.muted}">${esc(meta)}</text>
      ${options.showAchievement ? `<text x="${contentX}" y="${achievementY}" font-size="${spec.rate}" font-weight="800">${record.achievementRate.toFixed(4)}%</text>` : ""}
      ${(options.showRank || options.showChartRating) ? `<rect x="${spec.pad}" y="${stripY}" width="${spec.cardW - spec.pad * 2}" height="${spec.strip}" rx="10" fill="${palette.strip}"/>` : ""}
      ${options.showRank ? `<text x="${spec.pad * 2}" y="${stripY + spec.strip * .68}" font-size="${spec.meta}" style="fill:${palette.muted}">${record.bucket.toUpperCase()} #${rank(ordered, index)}</text>` : ""}
      ${options.showChartRating ? `<text x="${spec.cardW - spec.pad * 2}" y="${stripY + spec.strip * .72}" text-anchor="end" font-size="${spec.rate * .88}" font-weight="850">${record.chartRating ?? "?"}</text>` : ""}
    </g>`;
  }).join("");
  const cards = renderCards(newRecords, spec.startY, 0) + renderCards(oldRecords, oldStartY, newRecords.length);

  return {
    width: spec.width,
    height: spec.height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}">
      <style>text{font-family:Inter,ui-sans-serif,system-ui,"Noto Sans",sans-serif;fill:${palette.fg}}</style>
      <rect width="${spec.width}" height="${spec.height}" fill="${palette.bg}"/>
      ${options.showFrame && frame ? `<image href="${frame}" x="0" y="0" width="${spec.width}" height="${spec.startY - 58}" preserveAspectRatio="xMidYMid slice" opacity=".9"/>` : ""}
      <rect x="${margin}" y="24" width="${panelW}" height="${spec.header - 10}" rx="28" fill="${palette.header}" opacity=".96" stroke="${alpha(options.accent, .28)}" stroke-width="2"/>
      <rect x="${margin}" y="24" width="10" height="${spec.header - 10}" rx="5" fill="${options.accent}"/>
      ${options.showIcon && icon ? `<image href="${icon}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid slice"/>` : ""}
      ${options.showPlate && plate ? `<defs><clipPath id="plateClip">
        <rect x="${textX - platePad}" y="${plateTop}" width="${plateWidth}" height="${plateBottom - plateTop}" rx="18"/>
      </clipPath></defs>
      <g clip-path="url(#plateClip)">
        <image href="${plate}" x="${textX - platePad}" y="${plateTop}" width="${plateWidth}" height="${plateBottom - plateTop}" preserveAspectRatio="xMidYMid slice" opacity=".55"/>
        <rect x="${textX - platePad}" y="${plateTop}" width="${plateWidth}" height="${plateBottom - plateTop}" fill="${alpha(palette.header, .55)}"/>
      </g>` : ""}
      <text x="${textX}" y="${nameY}" font-size="${nameSize}" font-weight="850" letter-spacing="2">${esc(data.player.name)}</text>
      ${trophy?.markup ?? ""}
      <text x="${scoreX}" y="${titleY}" text-anchor="end" font-size="${options.layout === "compact" ? 17 : 21}" font-weight="700" letter-spacing="1.5" style="fill:${palette.muted}">BEST 50 · TOTAL</text>
      <text x="${scoreX}" y="${nameY + 10}" text-anchor="end" font-size="${options.layout === "compact" ? 56 : 68}" font-weight="900">${data.b50Rating}</text>
      ${options.showBreakdown ? `
        <g transform="translate(${scoreBoxesX} ${scoreBoxY})">
          <rect width="${scoreBoxWidth}" height="${scoreBoxHeight}" rx="10" fill="${alpha(options.accent, .13)}" stroke="${alpha(options.accent, .34)}"/>
          <text x="12" y="${scoreBoxHeight * .36}" font-size="${options.layout === "compact" ? 9 : 11}" font-weight="800" letter-spacing=".7" style="fill:${palette.muted}">${copy.newBreakdown}</text>
          <text x="${scoreBoxWidth - 12}" y="${scoreBoxHeight * .78}" text-anchor="end" font-size="${options.layout === "compact" ? 18 : 22}" font-weight="850">${data.b15Rating}</text>
        </g>
        <g transform="translate(${scoreBoxesX + scoreBoxWidth + scoreBoxGap} ${scoreBoxY})">
          <rect width="${scoreBoxWidth}" height="${scoreBoxHeight}" rx="10" fill="${alpha(options.accent, .07)}" stroke="${alpha(options.accent, .2)}"/>
          <text x="12" y="${scoreBoxHeight * .36}" font-size="${options.layout === "compact" ? 9 : 11}" font-weight="800" letter-spacing=".7" style="fill:${palette.muted}">${copy.oldBreakdown}</text>
          <text x="${scoreBoxWidth - 12}" y="${scoreBoxHeight * .78}" text-anchor="end" font-size="${options.layout === "compact" ? 18 : 22}" font-weight="850">${data.b35Rating}</text>
        </g>` : ""}
      <g>
        <rect x="${spec.margin}" y="${spec.startY - 46}" width="${spec.width - spec.margin * 2}" height="34" rx="10" fill="${alpha(options.accent, .16)}"/>
        <text x="${spec.margin + 14}" y="${spec.startY - 22}" font-size="18" font-weight="850">${copy.newSection}</text>
        <text x="${spec.width - spec.margin - 14}" y="${spec.startY - 22}" text-anchor="end" font-size="16" style="fill:${palette.muted}">${newRecords.length} ${copy.charts} · ${data.b15Rating}</text>
      </g>
      <g>
        <rect x="${spec.margin}" y="${oldStartY - 46}" width="${spec.width - spec.margin * 2}" height="34" rx="10" fill="${alpha(options.accent, .11)}"/>
        <text x="${spec.margin + 14}" y="${oldStartY - 22}" font-size="18" font-weight="850">${copy.oldSection}</text>
        <text x="${spec.width - spec.margin - 14}" y="${oldStartY - 22}" text-anchor="end" font-size="16" style="fill:${palette.muted}">${oldRecords.length} ${copy.charts} · ${data.b35Rating}</text>
      </g>
      ${cards}
      <text x="${spec.margin}" y="${spec.height - 28}" font-size="16" style="fill:${palette.muted}">${esc(options.watermark || copy.generated)}</text>
      <text x="${spec.width - spec.margin}" y="${spec.height - 28}" text-anchor="end" font-size="16" style="fill:${palette.muted}">${esc([timestamp, "preview"].filter(Boolean).join(" · "))}</text>
    </svg>`
  };
}
