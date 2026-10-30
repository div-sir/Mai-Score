import type { RhythmRecordEnvelope } from "../../src/lib/rhythm-record";

const HEADER_ALIASES = {
  level: ["lv", "level", "レベル"],
  title: ["title", "music", "song", "楽曲名", "曲名"],
  difficulty: ["difficulty", "diff", "難易度"],
  lamp: ["lamp", "clear_lamp", "clear", "クリアランク", "クリア"],
  score: ["score", "highscore", "high_score", "ハイスコア", "スコア"],
  exScore: ["exscore", "ex_score", "ex-score", "ex score", "exスコア"],
  grade: ["grade", "rank", "グレード", "ランク"],
  vf: ["vf", "volforce", "単曲vf"],
  lastPlayed: ["last played", "last_played", "played at", "最終プレイ"]
} as const;

const cleanHeader = (value: string) => value.normalize("NFKC").trim().toLowerCase();

/** Small RFC 4180 reader used for local score exports. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function headerIndex(headers: string[], aliases: readonly string[]): number {
  return headers.findIndex((header) => aliases.includes(cleanHeader(header)));
}

export function isSdvxHelperCsv(text: string): boolean {
  const headers = parseCsv(text)[0] ?? [];
  return headerIndex(headers, HEADER_ALIASES.title) >= 0
    && headerIndex(headers, HEADER_ALIASES.difficulty) >= 0
    && headerIndex(headers, HEADER_ALIASES.score) >= 0
    && (headerIndex(headers, HEADER_ALIASES.vf) >= 0 || headerIndex(headers, HEADER_ALIASES.lamp) >= 0);
}

const numeric = (value: string | undefined): number | undefined => {
  if (!value?.trim()) return undefined;
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

function playedAt(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) return `${normalized}:00`;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export function parseSdvxHelperCsv(text: string, generatedAt = new Date().toISOString()): RhythmRecordEnvelope {
  const [rawHeaders, ...rows] = parseCsv(text);
  if (!rawHeaders || !isSdvxHelperCsv(text)) throw new Error("This CSV is not a recognized sdvx_helper score export.");
  const columns = {
    level: headerIndex(rawHeaders, HEADER_ALIASES.level),
    title: headerIndex(rawHeaders, HEADER_ALIASES.title),
    difficulty: headerIndex(rawHeaders, HEADER_ALIASES.difficulty),
    lamp: headerIndex(rawHeaders, HEADER_ALIASES.lamp),
    score: headerIndex(rawHeaders, HEADER_ALIASES.score),
    exScore: headerIndex(rawHeaders, HEADER_ALIASES.exScore),
    grade: headerIndex(rawHeaders, HEADER_ALIASES.grade),
    vf: headerIndex(rawHeaders, HEADER_ALIASES.vf),
    lastPlayed: headerIndex(rawHeaders, HEADER_ALIASES.lastPlayed)
  };
  const cell = (row: string[], index: number) => index < 0 ? undefined : row[index]?.trim();
  const records: RhythmRecordEnvelope["records"] = [];
  for (const [index, row] of rows.entries()) {
    const title = cell(row, columns.title);
    const difficulty = cell(row, columns.difficulty);
    const score = numeric(cell(row, columns.score));
    if (!title || !difficulty || score === undefined || score <= 0) continue;
    const level = numeric(cell(row, columns.level));
    const vf = numeric(cell(row, columns.vf));
    const exScore = numeric(cell(row, columns.exScore));
    const chartId = `${title}\u0000${difficulty}`;
    records.push({
      recordId: `sdvx-helper-${index + 1}-${chartId}`,
      ...(playedAt(cell(row, columns.lastPlayed)) ? { playedAt: playedAt(cell(row, columns.lastPlayed)) } : {}),
      song: { id: title, title },
      chart: {
        id: chartId,
        difficulty,
        ...(level === undefined ? {} : { level: String(level), levelValue: level })
      },
      result: {
        rawScore: score,
        ...(cell(row, columns.grade) ? { grade: cell(row, columns.grade) } : {}),
        ...(cell(row, columns.lamp) ? { clearStatus: cell(row, columns.lamp) } : {}),
        ...(vf === undefined ? {} : { rating: { value: vf, system: "volforce-milli" } })
      },
      ...(exScore === undefined ? {} : { gameSpecific: { exScore } })
    });
  }
  if (records.length === 0) throw new Error("The sdvx_helper CSV did not contain any played charts.");
  return {
    schema: "mai-score/rhythm-record/v1",
    generatedAt,
    source: { game: "sound-voltex", connectionId: "sdvx-helper-csv" },
    records
  };
}
