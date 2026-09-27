import type { KonamiPageSnapshot } from "./konami-page";

export interface KonamiDataTable {
  id: string;
  pageTitle: string;
  title: string;
  sourceUrl: string;
  headers: string[];
  rows: string[][];
}

export interface KonamiChartPoint {
  label: string;
  value: number;
}

export interface KonamiChartCandidate {
  id: string;
  tableId: string;
  title: string;
  categoryLabel: string;
  valueLabel: string;
  format: "number" | "percent";
  points: KonamiChartPoint[];
}

const clean = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();

export function parseKonamiNumber(value: string): number | undefined {
  const source = clean(value);
  if (!/[0-9]/.test(source) || /\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/.test(source)) return undefined;
  const matched = source.replace(/[,，\s]/g, "").match(/[-+]?\d+(?:\.\d+)?/);
  if (!matched) return undefined;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function headersFor(headers: string[], width: number): string[] {
  return Array.from({ length: width }, (_, index) => clean(headers[index] ?? "") || `Column ${index + 1}`);
}

export function konamiDataTables(snapshot: KonamiPageSnapshot): KonamiDataTable[] {
  return snapshot.pages.flatMap((page, pageIndex) => page.tables.flatMap((table, tableIndex) => {
    const width = Math.max(table.headers.length, ...table.rows.map((row) => row.length), 0);
    if (!width || !table.rows.length) return [];
    const headers = headersFor(table.headers, width);
    const rows = table.rows
      .map((row) => headers.map((_, index) => clean(row[index] ?? "")))
      .filter((row) => row.some(Boolean));
    if (!rows.length) return [];
    return [{
      id: `page-${pageIndex}-table-${tableIndex}`,
      pageTitle: page.title,
      title: clean(table.caption ?? "") || page.headings.at(-1) || page.title,
      sourceUrl: page.url,
      headers,
      rows
    }];
  }));
}

function numericColumns(table: KonamiDataTable): Array<{ index: number; values: number[]; percent: boolean }> {
  return table.headers.flatMap((header, index) => {
    const parsed = table.rows.map((row) => parseKonamiNumber(row[index] ?? ""));
    const values = parsed.filter((value): value is number => value !== undefined);
    const threshold = Math.max(2, Math.ceil(table.rows.length * 0.6));
    if (values.length < threshold) return [];
    return [{
      index,
      values: parsed.map((value) => value ?? Number.NaN),
      percent: /%|率|RATE|ACHIEVEMENT/i.test(header)
        || table.rows.some((row) => (row[index] ?? "").includes("%"))
    }];
  });
}

function categoryColumn(table: KonamiDataTable, numericIndex: number): number | undefined {
  const candidates = table.headers.flatMap((header, index) => {
    if (index === numericIndex) return [];
    const values = table.rows.map((row) => clean(row[index] ?? "")).filter(Boolean);
    if (values.length < Math.max(2, Math.ceil(table.rows.length * 0.6))) return [];
    const numericValues = values.filter((value) => parseKonamiNumber(value) !== undefined);
    if (numericValues.length >= Math.ceil(values.length * 0.6)) return [];
    const unique = new Set(values).size;
    const averageLength = values.reduce((sum, value) => sum + value.length, 0) / values.length;
    if (unique < Math.min(2, values.length) || averageLength > 48) return [];
    const songLabel = /TITLE|SONG|MUSIC|曲名|楽曲|タイトル/i.test(header) ? 100 : 0;
    return [{ index, score: songLabel + unique / values.length * 10 - averageLength / 100 }];
  });
  return candidates.sort((left, right) => right.score - left.score)[0]?.index;
}

export function konamiChartCandidates(snapshot: KonamiPageSnapshot): KonamiChartCandidate[] {
  return konamiDataTables(snapshot).flatMap((table) => numericColumns(table).flatMap((numeric) => {
    const category = categoryColumn(table, numeric.index);
    if (category === undefined || category < 0) return [];
    const points = table.rows.flatMap((row, rowIndex) => {
      const value = numeric.values[rowIndex];
      const label = clean(row[category] ?? "");
      return Number.isFinite(value) && label ? [{ label, value }] : [];
    });
    if (points.length < 2) return [];
    return [{
      id: `${table.id}-metric-${numeric.index}`,
      tableId: table.id,
      title: table.title,
      categoryLabel: table.headers[category],
      valueLabel: table.headers[numeric.index],
      format: numeric.percent ? "percent" as const : "number" as const,
      points
    }];
  })).slice(0, 50);
}

const csvCell = (value: string) => /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function konamiTableCsv(table: KonamiDataTable): string {
  return [table.headers, ...table.rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
