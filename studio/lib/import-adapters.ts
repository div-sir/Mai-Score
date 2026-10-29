import { parseMaiScore } from "./import";
import { isGenericRhythmRecord, parseGenericRhythmRecord } from "./generic-rhythm";
import { isKonamiPageSnapshot } from "./konami-page";
import type { KonamiPageSnapshot } from "./konami-page";
import type { RhythmRecordEnvelope } from "../../src/lib/rhythm-record";
import type { StudioData } from "./types";

export type ImportedDataset =
  | { adapter: "mai-score"; label: "Mai-Score JSON"; kind: "maimai"; data: StudioData }
  | { adapter: "rhythm-record"; label: "Rhythm Record v1"; kind: "rhythm-record"; data: RhythmRecordEnvelope }
  | { adapter: "konami-pages"; label: "Mai-Score KONAMI snapshot"; kind: "konami-pages"; data: KonamiPageSnapshot };

export interface ImportAdapter {
  id: ImportedDataset["adapter"];
  label: string;
  accepts: string;
  detect(value: unknown): boolean;
  parse(value: unknown): ImportedDataset;
}

/**
 * The registry is intentionally data-first. Third-party tools can target the
 * documented Rhythm Record schema without coupling Studio to their UI or
 * account tokens, and a native adapter can be added here when a stable export
 * format is available.
 */
export const IMPORT_ADAPTERS: readonly ImportAdapter[] = [{
  id: "rhythm-record",
  label: "Rhythm Record v1",
  accepts: "mai-score/rhythm-record/v1",
  detect: isGenericRhythmRecord,
  parse: (value) => ({ adapter: "rhythm-record", label: "Rhythm Record v1", kind: "rhythm-record", data: parseGenericRhythmRecord(value) })
}, {
  id: "konami-pages",
  label: "Mai-Score KONAMI snapshot",
  accepts: "mai-score/konami-pages/v1",
  detect: isKonamiPageSnapshot,
  parse: (value) => ({ adapter: "konami-pages", label: "Mai-Score KONAMI snapshot", kind: "konami-pages", data: value as KonamiPageSnapshot })
}, {
  id: "mai-score",
  label: "Mai-Score JSON",
  accepts: "mai-score/v1 and maimai Rhythm Record",
  detect: (value) => Boolean(value && typeof value === "object" && !Array.isArray(value)),
  parse: (value) => ({ adapter: "mai-score", label: "Mai-Score JSON", kind: "maimai", data: parseMaiScore(value) })
}];

export function importWithAdapter(value: unknown): ImportedDataset {
  const adapter = IMPORT_ADAPTERS.find((candidate) => candidate.detect(value));
  if (!adapter) throw new Error("No compatible import adapter recognized this file.");
  return adapter.parse(value);
}
