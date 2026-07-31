import type { LanguageId, LayoutId, StudioAssets, StudioData, StudioOptions, StudioRecord, ThemeId } from "./types";

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

const palettes: Record<ThemeId, { bg: string; fg: string; muted: string; card: string; header: string; strip: string }> = {
  night: { bg: "#0a1022", fg: "#f5f7ff", muted: "#98a4c8", card: "#141b35", header: "#151c36", strip: "#292653" },
  light: { bg: "#f3f6ff", fg: "#11182c", muted: "#637092", card: "#ffffff", header: "#ffffff", strip: "#e9edfb" },
  maimai: { bg: "#ddf6ff", fg: "#173348", muted: "#58778a", card: "#fffefd", header: "#fffaf2", strip: "#dff5ff" }
};

const difficulty: Record<string, string> = {
  basic: "#36c985", advanced: "#f5c842", expert: "#ff5b66", master: "#9d69ff", remaster: "#d8a9ff"
};

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
}[character]!));
const alpha = (hex: string, opacity: number) => `${hex}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;
function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(1, limit - 1))}…`;
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
  const palette = palettes[options.theme];
  const copy = renderCopy(language);
  const ordered = [...data.records].sort((a, b) => a.bucket === b.bucket ? 0 : a.bucket === "b15" ? -1 : 1);
  const newRecords = ordered.filter((record) => record.bucket === "b15").slice(0, 15);
  const oldRecords = ordered.filter((record) => record.bucket === "b35").slice(0, 35);
  const newRows = Math.ceil(newRecords.length / spec.columns);
  const oldStartY = spec.startY + newRows * (spec.cardH + spec.gapY) + spec.sectionGap;
  const icon = assets.icon ?? assetUrl(data.player.iconUrl, origin);
  const frame = assets.frame ?? assetUrl(data.player.frameUrl, origin);
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
      ...(options.showLevel ? [record.displayedLevel] : []),
      ...(options.showConstant && Number.isFinite(record.internalLevelValue)
        ? [`CONST ${Number(record.internalLevelValue).toFixed(1)}`]
        : [])
    ].join(" · ");
    const maxChars = options.layout === "landscape" ? 21 : options.layout === "compact" ? 19 : 23;
    const color = difficulty[record.difficulty] ?? options.accent;
    return `<g transform="translate(${x} ${y})">
      <rect width="${spec.cardW}" height="${spec.cardH}" rx="16" fill="${palette.card}" stroke="${alpha(color, .45)}" stroke-width="3"/>
      ${reservesCover ? coverSource
        ? `<image href="${coverSource}" x="${spec.pad}" y="${spec.pad}" width="${spec.cover}" height="${spec.cover}" preserveAspectRatio="xMidYMid slice"/>`
        : `<rect x="${spec.pad}" y="${spec.pad}" width="${spec.cover}" height="${spec.cover}" rx="10" fill="${alpha(color, .16)}"/>`
      : ""}
      <text x="${contentX}" y="${spec.pad + spec.title}" font-size="${spec.title}" font-weight="750">${esc(truncate(record.title, maxChars))}</text>
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
      <text x="${textX}" y="${titleY}" font-size="${options.layout === "compact" ? 22 : 25}" style="fill:${palette.muted}">${esc(data.player.title)}</text>
      <text x="${textX}" y="${nameY}" font-size="${options.layout === "compact" ? 42 : 49}" font-weight="850" letter-spacing="2">${esc(data.player.name)}</text>
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
