import type { StudioChartRecord } from "./types";

export interface RecordFilters {
  level?: string;
  difficulty?: string;
  type?: string;
  version?: string;
  constant?: string;
  status?: string;
  query?: string;
  sort?: string;
}

/** Filter a collected dataset without changing its records or source order. */
export function searchRecords(records: readonly StudioChartRecord[], filters: RecordFilters = {}, language = "en") {
  const query = (filters.query ?? "").trim().toLocaleLowerCase(language);
  const matches = (filter: string | undefined, value: string | undefined) => !filter || filter === "all" || filter === value;
  return records.filter(record =>
    matches(filters.level, record.displayedLevel)
    && matches(filters.difficulty, record.difficulty)
    && matches(filters.type, record.type)
    && matches(filters.version, record.version)
    && (!filters.constant || filters.constant === "all" || record.internalLevelValue === Number(filters.constant))
    && (!filters.status || filters.status === "all"
      || (filters.status === "sss" && record.achievementRate < 100)
      || (filters.status === "fc" && Boolean(record.comboFlag))
      || (filters.status === "ap" && (record.comboFlag === "ap" || record.comboFlag === "ap+")))
    && (!query || `${record.title} ${record.type} ${record.difficulty} ${record.version ?? ""}`.toLocaleLowerCase(language).includes(query))
  ).sort((a, b) => (filters.sort === "title" ? a.title.localeCompare(b.title, language)
    : filters.sort === "low" ? a.achievementRate - b.achievementRate
    : filters.sort === "constant" ? (b.internalLevelValue ?? -1) - (a.internalLevelValue ?? -1)
    : b.achievementRate - a.achievementRate) || a.title.localeCompare(b.title, language));
}
