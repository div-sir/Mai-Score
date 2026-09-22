export const KONAMI_PAGE_SCHEMA = "mai-score/konami-page-snapshot/v1" as const;

export type KonamiPageGame = "beatmania-iidx" | "sound-voltex" | "dance-dance-revolution";
export interface KonamiPageSnapshot {
  schema: typeof KONAMI_PAGE_SCHEMA;
  generatedAt: string;
  source: {
    game: KonamiPageGame;
    connectionId: string;
    startUrl: string;
    region: "jp";
    pageLimit: number;
  };
  pages: Array<{
    url: string;
    title: string;
    access: "collected" | "sign-in-required" | "paid" | "failed";
    headings: string[];
    fields: Array<{ label: string; value: string }>;
    tables: Array<{ caption?: string; headers: string[]; rows: string[][] }>;
    text: string[];
    error?: string;
  }>;
  summary: {
    collected: number;
    paid: number;
    signInRequired: number;
    failed: number;
    fields: number;
    tables: number;
  };
}

const games = new Set<KonamiPageGame>(["beatmania-iidx", "sound-voltex", "dance-dance-revolution"]);

export function isKonamiPageSnapshot(value: unknown): value is KonamiPageSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<KonamiPageSnapshot>;
  return snapshot.schema === KONAMI_PAGE_SCHEMA
    && Boolean(snapshot.source && games.has(snapshot.source.game as KonamiPageGame))
    && typeof snapshot.generatedAt === "string"
    && Number.isFinite(Date.parse(snapshot.generatedAt))
    && Array.isArray(snapshot.pages)
    && Boolean(snapshot.summary && Number.isInteger(snapshot.summary.collected));
}
