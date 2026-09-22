import type { PopupLanguage } from "./i18n";
import type { RhythmGameId } from "./rhythm-record";

export const KONAMI_PAGE_SCHEMA = "mai-score/konami-page-snapshot/v1" as const;
export const LAST_KONAMI_PAGE_KEY = "lastKonamiPageSnapshotV1";
export const KONAMI_PAGE_LIMIT = 40;

export type KonamiPageGame = Extract<RhythmGameId,
  "beatmania-iidx" | "sound-voltex" | "dance-dance-revolution">;
export type KonamiPageAccess = "collected" | "sign-in-required" | "paid" | "failed";

export interface KonamiPageTable {
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface KonamiCollectedPage {
  url: string;
  title: string;
  access: KonamiPageAccess;
  headings: string[];
  fields: Array<{ label: string; value: string }>;
  tables: KonamiPageTable[];
  text: string[];
  error?: string;
}

export interface KonamiPageSnapshot {
  schema: typeof KONAMI_PAGE_SCHEMA;
  generatedAt: string;
  source: {
    game: KonamiPageGame;
    connectionId: "iidx-konami-page" | "sdvx-konami-page" | "ddr-konami-page";
    startUrl: string;
    region: "jp";
    pageLimit: number;
  };
  pages: KonamiCollectedPage[];
  summary: {
    collected: number;
    paid: number;
    signInRequired: number;
    failed: number;
    fields: number;
    tables: number;
  };
}

export interface KonamiPageCollectRequest {
  type: "MAI_SCORE_KONAMI_PAGE_COLLECT";
}

export interface KonamiPageImportRequest {
  type: "MAI_SCORE_KONAMI_PAGE_IMPORT";
  data: KonamiPageSnapshot;
  language: PopupLanguage;
}

const clean = (value?: string | null) => (value ?? "").replace(/\s+/g, " ").trim();
const unique = (values: string[], limit = 1000) => [...new Set(values.map(clean).filter(Boolean))].slice(0, limit);

export function konamiPageGameForUrl(url: string): KonamiPageGame | undefined {
  try {
    const page = new URL(url);
    if (page.hostname !== "p.eagate.573.jp") return undefined;
    if (page.pathname.startsWith("/game/sdvx/")) return "sound-voltex";
    if (page.pathname.startsWith("/game/2dx/")) return "beatmania-iidx";
    if (page.pathname.startsWith("/game/ddr/")) return "dance-dance-revolution";
  } catch {
    // Invalid URLs are simply unsupported.
  }
  return undefined;
}

function dataRoot(url: string, game: KonamiPageGame): string | undefined {
  const pathname = new URL(url).pathname;
  const pattern = game === "beatmania-iidx"
    ? /^(\/game\/2dx\/[^/]+\/djdata\/)/
    : game === "sound-voltex"
      ? /^(\/game\/sdvx\/[^/]+\/playdata\/)/
      : /^(\/game\/ddr\/[^/]+\/playdata\/)/;
  const existing = pathname.match(pattern)?.[1];
  if (existing) return existing;
  const versionRoot = game === "beatmania-iidx" ? pathname.match(/^(\/game\/2dx\/[^/]+\/)/)?.[1]
    : game === "sound-voltex" ? pathname.match(/^(\/game\/sdvx\/[^/]+\/)/)?.[1]
      : pathname.match(/^(\/game\/ddr\/[^/]+\/)/)?.[1];
  return versionRoot ? `${versionRoot}${game === "beatmania-iidx" ? "djdata" : "playdata"}/` : undefined;
}

function accessFor(document: Document): KonamiPageAccess {
  const body = clean(document.body?.textContent);
  if (/e-amusementへのログインが必要|ログインした状態で[、､]再度|sign[ -]?in (?:is )?required/i.test(body)) {
    return "sign-in-required";
  }
  if (/この(?:サービス|コンテンツ).{0,50}(?:ベーシック|プレミアム)コース.{0,30}必要|e-amusement (?:ベーシック|プレミアム)コースの加入が必要|basic course (?:subscription )?is required/i.test(body)) {
    return "paid";
  }
  return "collected";
}

function tableFrom(element: HTMLTableElement): KonamiPageTable | undefined {
  const rows = [...element.rows].map((row) => [...row.cells].map((cell) => clean(cell.textContent)));
  if (!rows.length || !rows.some((row) => row.some(Boolean))) return undefined;
  const first = [...element.rows[0].cells];
  const firstIsHeader = first.length > 0 && first.every((cell) => cell.tagName === "TH");
  return {
    ...(clean(element.caption?.textContent) ? { caption: clean(element.caption?.textContent) } : {}),
    headers: firstIsHeader ? rows[0] : [],
    rows: (firstIsHeader ? rows.slice(1) : rows).slice(0, 2000)
  };
}

function fieldsFrom(document: Document): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = [];
  document.querySelectorAll("dl").forEach((list) => {
    let label = "";
    [...list.children].forEach((child) => {
      if (child.tagName === "DT") label = clean(child.textContent);
      if (child.tagName === "DD" && label) {
        const value = clean(child.textContent);
        if (value) fields.push({ label, value });
      }
    });
  });
  document.querySelectorAll("table tr").forEach((row) => {
    const elements = [...row.querySelectorAll(":scope > th, :scope > td")];
    const cells = elements.map((cell) => clean(cell.textContent));
    if (elements[0]?.tagName === "TH" && elements[1]?.tagName === "TD"
      && cells.length === 2 && cells[0] && cells[1] && cells[0] !== cells[1]) {
      fields.push({ label: cells[0], value: cells[1] });
    }
  });
  document.querySelectorAll("select").forEach((select) => {
    const label = clean(select.labels?.[0]?.textContent || select.getAttribute("aria-label") || select.name);
    const value = clean(select.selectedOptions?.[0]?.textContent);
    if (label && value) fields.push({ label, value });
  });
  const seen = new Set<string>();
  return fields.filter(({ label, value }) => {
    const key = `${label}\u0000${value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2000);
}

export function extractKonamiPage(document: Document, url: string): KonamiCollectedPage {
  const tables = [...document.querySelectorAll("table")]
    .flatMap((table) => tableFrom(table as HTMLTableElement) ?? []);
  return {
    url,
    title: clean(document.title) || url,
    access: accessFor(document),
    headings: unique([...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((node) => node.textContent ?? ""), 300),
    fields: fieldsFrom(document),
    tables,
    text: unique([...document.querySelectorAll("main p,main li,#contents p,#contents li,.contents p,.contents li,article p,article li")]
      .map((node) => node.textContent ?? "").filter((value) => clean(value).length >= 2), 1000)
  };
}

function pageLinks(document: Document, baseUrl: string, root: string): string[] {
  const origin = new URL(baseUrl).origin;
  return unique([...document.querySelectorAll<HTMLAnchorElement>("a[href]")].flatMap((anchor) => {
    try {
      const link = new URL(anchor.getAttribute("href") ?? "", baseUrl);
      link.hash = "";
      if (link.origin !== origin || !link.pathname.startsWith(root)) return [];
      if (/\/(?:logout|login|payment|subscribe)(?:\/|\.|$)/i.test(link.pathname)) return [];
      return [link.href];
    } catch {
      return [];
    }
  }), KONAMI_PAGE_LIMIT * 4);
}

export async function collectKonamiPages(
  currentDocument: Document,
  startUrl: string,
  fetchPage: (url: string) => Promise<string>,
  parseHtml: (html: string) => Document,
  limit = KONAMI_PAGE_LIMIT
): Promise<KonamiPageSnapshot> {
  const game = konamiPageGameForUrl(startUrl);
  if (!game) throw new Error("This is not a supported KONAMI game page.");
  const root = dataRoot(startUrl, game);
  if (!root) throw new Error("Open this game's PLAY DATA page first.");
  const requested = new URL(startUrl);
  requested.hash = "";
  const useCurrentDocument = requested.pathname.startsWith(root);
  const initial = useCurrentDocument ? requested : new URL(`${root}index.html`, requested.origin);
  const queue = [initial.href];
  const queued = new Set(queue);
  const pages: KonamiCollectedPage[] = [];

  while (queue.length && pages.length < limit) {
    const url = queue.shift()!;
    try {
      const document = useCurrentDocument && url === initial.href ? currentDocument : parseHtml(await fetchPage(url));
      const page = extractKonamiPage(document, url);
      pages.push(page);
      for (const link of pageLinks(document, url, root)) {
        if (!queued.has(link) && queued.size < limit * 4) {
          queued.add(link);
          queue.push(link);
        }
      }
    } catch (error) {
      pages.push({
        url,
        title: url,
        access: "failed",
        headings: [], fields: [], tables: [], text: [],
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const count = (access: KonamiPageAccess) => pages.filter((page) => page.access === access).length;
  const connectionId = game === "beatmania-iidx" ? "iidx-konami-page"
    : game === "sound-voltex" ? "sdvx-konami-page" : "ddr-konami-page";
  return {
    schema: KONAMI_PAGE_SCHEMA,
    generatedAt: new Date().toISOString(),
    source: { game, connectionId, startUrl: initial.href, region: "jp", pageLimit: limit },
    pages,
    summary: {
      collected: count("collected"),
      paid: count("paid"),
      signInRequired: count("sign-in-required"),
      failed: count("failed"),
      fields: pages.reduce((sum, page) => sum + page.fields.length, 0),
      tables: pages.reduce((sum, page) => sum + page.tables.length, 0)
    }
  };
}

export function isKonamiPageSnapshot(value: unknown): value is KonamiPageSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<KonamiPageSnapshot>;
  return snapshot.schema === KONAMI_PAGE_SCHEMA
    && Boolean(snapshot.source && konamiPageGameForUrl(snapshot.source.startUrl ?? "") === snapshot.source.game)
    && Array.isArray(snapshot.pages)
    && Boolean(snapshot.summary && Number.isInteger(snapshot.summary.collected));
}

export function isKonamiPageImportRequest(value: unknown): value is KonamiPageImportRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<KonamiPageImportRequest>;
  return request.type === "MAI_SCORE_KONAMI_PAGE_IMPORT"
    && (request.language === "en" || request.language === "zh-Hant" || request.language === "ja")
    && isKonamiPageSnapshot(request.data);
}
