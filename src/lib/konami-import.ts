import type { PopupLanguage } from "./i18n";
import { RHYTHM_RECORD_SCHEMA, type RhythmRecordEnvelope } from "./rhythm-record";

export const LAST_COLLECTION_KEY = "lastCollectionV1";
export const LAST_RHYTHM_RECORD_KEY = "lastRhythmRecordV1";

export interface KonamiImportRequest {
  type: "MAI_SCORE_KONAMI_IMPORT";
  data: RhythmRecordEnvelope;
  language: PopupLanguage;
}

export function isKonamiImportRequest(value: unknown): value is KonamiImportRequest {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<KonamiImportRequest>;
  const data = message.data;
  return message.type === "MAI_SCORE_KONAMI_IMPORT"
    && (message.language === "en" || message.language === "zh-Hant" || message.language === "ja")
    && Boolean(data && data.schema === RHYTHM_RECORD_SCHEMA
      && (data.source.game === "beatmania-iidx" || data.source.game === "sound-voltex")
      && Array.isArray(data.records) && data.records.length > 0);
}
