import type { PopupLanguage } from "./i18n";
import type { CollectionResult } from "./types";

export interface MaimaiImportRequest {
  type: "MAI_SCORE_MAIMAI_IMPORT";
  data: CollectionResult;
  language: PopupLanguage;
  autoSync?: boolean;
}

export function isMaimaiImportRequest(value: unknown): value is MaimaiImportRequest {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<MaimaiImportRequest>;
  const data = message.data;
  return message.type === "MAI_SCORE_MAIMAI_IMPORT"
    && (message.language === "en" || message.language === "zh-Hant" || message.language === "ja")
    && (message.autoSync === undefined || typeof message.autoSync === "boolean")
    && Boolean(data && data.schema === "mai-score/v1"
      && Array.isArray(data.records) && data.records.length === 50
      && typeof data.player?.name === "string"
      && Number.isFinite(data.b50Rating));
}
