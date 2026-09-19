import {
  RHYTHM_RECORD_SCHEMA,
  type RhythmGameId,
  type RhythmRecordEnvelope
} from "./rhythm-record";

export type KonamiCsvGame = "auto" | "beatmania-iidx" | "sound-voltex";

export function decodeKonamiCsvBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("shift_jis").decode(bytes);
  }
}

type CsvRow = Record<string, string>;

const normalize = (value: string) => value
  .normalize("NFKC")
  .replace(/^\uFEFF/, "")
  .replace(/[\s_\-・/]+/g, "")
  .toUpperCase();

const number = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[,，]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

function parseRows(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const delimiter = source.split(/\r?\n/, 1)[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, "").trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field.replace(/\r$/, "").trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function table(text: string): { headers: string[]; normalized: string[]; rows: CsvRow[] } {
  const [headers, ...values] = parseRows(text);
  if (!headers || headers.length < 2) throw new Error("CSV does not contain a usable header row.");
  return {
    headers,
    normalized: headers.map(normalize),
    rows: values.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])))
  };
}

function value(row: CsvRow, headers: string[], normalized: string[], aliases: string[]): string {
  const index = normalized.findIndex((header) => aliases.some((alias) => header === normalize(alias)));
  return index < 0 ? "" : row[headers[index]] ?? "";
}

function containing(row: CsvRow, headers: string[], normalized: string[], parts: string[], excluded: string[] = []): string {
  const wanted = parts.map(normalize);
  const blocked = excluded.map(normalize);
  const index = normalized.findIndex((header) => wanted.every((part) => header.includes(part))
    && blocked.every((part) => !header.includes(part)));
  return index < 0 ? "" : row[headers[index]] ?? "";
}

const songId = (title: string) => normalize(title).toLocaleLowerCase();
const chartId = (game: RhythmGameId, title: string, type: string, difficulty: string) =>
  `${game}:${songId(title)}:${normalize(type).toLocaleLowerCase()}:${normalize(difficulty).toLocaleLowerCase()}`;

function envelope(game: RhythmGameId, connectionId: string, records: RhythmRecordEnvelope["records"]): RhythmRecordEnvelope {
  if (!records.length) throw new Error("No played charts were found in this CSV. Check the selected game and file.");
  return {
    schema: RHYTHM_RECORD_SCHEMA,
    generatedAt: new Date().toISOString(),
    source: { game, connectionId, region: "jp" },
    records,
    summaries: [{ system: "played-charts", value: records.length }]
  };
}

const IIDX_DIFFICULTIES = ["BEGINNER", "NORMAL", "HYPER", "ANOTHER", "LEGGENDARIA"] as const;

function parseIidx(text: string): RhythmRecordEnvelope {
  const { headers, normalized, rows } = table(text);
  const records: RhythmRecordEnvelope["records"] = [];
  const titleAliases = ["TITLE", "曲名", "タイトル", "楽曲名"];
  const longStyle = normalized.some((header) => ["PLAYSTYLE", "プレースタイル"].includes(header));

  for (const row of rows) {
    const title = value(row, headers, normalized, titleAliases);
    if (!title) continue;
    const artist = value(row, headers, normalized, ["ARTIST", "アーティスト"]);
    const version = value(row, headers, normalized, ["VERSION", "バージョン"]);
    const playCount = number(value(row, headers, normalized, ["PLAYCOUNT", "プレー回数", "プレイ回数"]));

    if (longStyle) {
      const type = value(row, headers, normalized, ["PLAYSTYLE", "プレースタイル"]).toUpperCase();
      const difficulty = value(row, headers, normalized, ["DIFFICULTY", "難易度"]).toUpperCase();
      const score = number(value(row, headers, normalized, ["EXSCORE", "EXスコア", "スコア"]));
      if (!type || !difficulty || !score) continue;
      const id = chartId("beatmania-iidx", title, type, difficulty);
      records.push({
        recordId: id,
        song: { id: songId(title), title, ...(artist ? { artist } : {}) },
        chart: {
          id,
          type,
          difficulty,
          ...(value(row, headers, normalized, ["LEVEL", "レベル", "難易度値"])
            ? { level: value(row, headers, normalized, ["LEVEL", "レベル", "難易度値"]) } : {})
        },
        result: {
          rawScore: score,
          ...(value(row, headers, normalized, ["DJLEVEL", "DJレベル"]) ? { grade: value(row, headers, normalized, ["DJLEVEL", "DJレベル"]) } : {}),
          ...(value(row, headers, normalized, ["CLEARTYPE", "クリアタイプ", "クリアランプ"]) ? { clearStatus: value(row, headers, normalized, ["CLEARTYPE", "クリアタイプ", "クリアランプ"]) } : {}),
          ...(number(value(row, headers, normalized, ["MISSCOUNT", "ミスカウント"])) !== undefined
            ? { missCount: number(value(row, headers, normalized, ["MISSCOUNT", "ミスカウント"])) } : {})
        },
        gameSpecific: { ...(version ? { version } : {}), ...(playCount !== undefined ? { playCount } : {}) }
      });
      continue;
    }

    for (const type of ["SP", "DP"] as const) {
      for (const difficulty of IIDX_DIFFICULTIES) {
        const score = number(containing(row, headers, normalized, [type, difficulty, "SCORE"], ["MISS", "DJLEVEL", "CLEAR"])
          || containing(row, headers, normalized, [type, difficulty, "スコア"], ["ミス", "DJレベル", "クリア"]));
        if (!score) continue;
        const id = chartId("beatmania-iidx", title, type, difficulty);
        const level = containing(row, headers, normalized, [type, difficulty, "LEVEL"], ["DJLEVEL"])
          || containing(row, headers, normalized, [type, difficulty, "レベル"], ["DJレベル"]);
        const grade = containing(row, headers, normalized, [type, difficulty, "DJLEVEL"])
          || containing(row, headers, normalized, [type, difficulty, "DJレベル"]);
        const clearStatus = containing(row, headers, normalized, [type, difficulty, "CLEAR"])
          || containing(row, headers, normalized, [type, difficulty, "クリア"]);
        const missCount = number(containing(row, headers, normalized, [type, difficulty, "MISS"])
          || containing(row, headers, normalized, [type, difficulty, "ミス"]));
        records.push({
          recordId: id,
          song: { id: songId(title), title, ...(artist ? { artist } : {}) },
          chart: { id, type, difficulty, ...(level ? { level } : {}) },
          result: {
            rawScore: score,
            ...(grade ? { grade } : {}),
            ...(clearStatus ? { clearStatus } : {}),
            ...(missCount !== undefined ? { missCount } : {})
          },
          gameSpecific: { ...(version ? { version } : {}), ...(playCount !== undefined ? { playCount } : {}) }
        });
      }
    }
  }
  return envelope("beatmania-iidx", "iidx-konami-csv", records);
}

const SDVX_DIFFICULTIES = ["NOVICE", "ADVANCED", "EXHAUST", "MAXIMUM", "INFINITE", "GRAVITY", "HEAVENLY", "VIVID", "EXCEED"] as const;
const SDVX_SHORT: Record<string, string> = {
  NOV: "NOVICE", ADV: "ADVANCED", EXH: "EXHAUST", MXM: "MAXIMUM",
  INF: "INFINITE", GRV: "GRAVITY", HVN: "HEAVENLY", VVD: "VIVID", XCD: "EXCEED"
};

function parseSdvx(text: string): RhythmRecordEnvelope {
  const { headers, normalized, rows } = table(text);
  const records: RhythmRecordEnvelope["records"] = [];
  const titleAliases = ["TITLE", "曲名", "タイトル", "楽曲名"];
  const longDifficulty = normalized.some((header) => ["DIFFICULTY", "難易度"].includes(header));

  for (const row of rows) {
    const title = value(row, headers, normalized, titleAliases);
    if (!title) continue;
    const artist = value(row, headers, normalized, ["ARTIST", "アーティスト"]);
    const addRecord = (difficulty: string, score: number, prefix?: string) => {
      const resolvedDifficulty = SDVX_SHORT[difficulty.toUpperCase()] ?? difficulty.toUpperCase();
      const id = chartId("sound-voltex", title, "SDVX", resolvedDifficulty);
      const parts = prefix ? [prefix] : [];
      const level = prefix
        ? containing(row, headers, normalized, [...parts, "LEVEL"]) || containing(row, headers, normalized, [...parts, "レベル"])
        : value(row, headers, normalized, ["LEVEL", "レベル"]);
      const grade = prefix
        ? containing(row, headers, normalized, [...parts, "GRADE"]) || containing(row, headers, normalized, [...parts, "グレード"])
        : value(row, headers, normalized, ["GRADE", "グレード", "RANK", "ランク"]);
      const clearStatus = prefix
        ? containing(row, headers, normalized, [...parts, "CLEAR"]) || containing(row, headers, normalized, [...parts, "クリア"])
        : value(row, headers, normalized, ["CLEAR", "クリア", "クリアメダル"]);
      records.push({
        recordId: id,
        song: { id: songId(title), title, ...(artist ? { artist } : {}) },
        chart: { id, type: "SDVX", difficulty: resolvedDifficulty, ...(level ? { level } : {}) },
        result: { rawScore: score, ...(grade ? { grade } : {}), ...(clearStatus ? { clearStatus } : {}) }
      });
    };

    if (longDifficulty) {
      const difficulty = value(row, headers, normalized, ["DIFFICULTY", "難易度"]);
      const score = number(value(row, headers, normalized, ["SCORE", "スコア", "EXSCORE", "EXスコア"]));
      if (difficulty && score) addRecord(difficulty, score);
      continue;
    }

    for (const difficulty of SDVX_DIFFICULTIES) {
      const short = Object.entries(SDVX_SHORT).find(([, name]) => name === difficulty)?.[0];
      const prefix = normalized.some((header) => header.includes(difficulty)) ? difficulty : short;
      if (!prefix) continue;
      const score = number(containing(row, headers, normalized, [prefix, "SCORE"], ["GRADE", "CLEAR"])
        || containing(row, headers, normalized, [prefix, "スコア"], ["グレード", "クリア"]));
      if (score) addRecord(difficulty, score, prefix);
    }
  }
  return envelope("sound-voltex", "sdvx-konami", records);
}

export function detectKonamiCsvGame(text: string, filename = ""): Exclude<KonamiCsvGame, "auto"> {
  const sample = normalize(`${filename}\n${text.slice(0, 4000)}`);
  if (sample.includes("IIDX") || sample.includes("DJLEVEL") || sample.includes("プレースタイル")
    || sample.includes("SPNORMAL") || sample.includes("DPHYPER")) return "beatmania-iidx";
  if (sample.includes("SDVX") || sample.includes("SOUNDVOLTEX") || sample.includes("EXHAUST")
    || sample.includes("MAXIMUM") || sample.includes("クリアメダル")) return "sound-voltex";
  throw new Error("Could not identify this KONAMI CSV. Select IIDX or SOUND VOLTEX explicitly.");
}

export function parseKonamiCsv(text: string, filename = "", game: KonamiCsvGame = "auto"): RhythmRecordEnvelope {
  const selected = game === "auto" ? detectKonamiCsvGame(text, filename) : game;
  return selected === "beatmania-iidx" ? parseIidx(text) : parseSdvx(text);
}
