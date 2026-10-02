import type { RhythmRecordEnvelope } from "../../src/lib/rhythm-record";

export interface RhythmImprovement {
  id: string;
  title: string;
  difficulty: string;
  previousScore: number;
  score: number;
  gain: number;
}

export interface RhythmProgress {
  previousAt: string;
  newCharts: number;
  improvedCharts: number;
  scoreGain: number;
  topImprovements: RhythmImprovement[];
}

const recordKey = (record: RhythmRecordEnvelope["records"][number]) => record.chart.id || record.recordId;

export function compareRhythmRecords(current: RhythmRecordEnvelope, previous?: RhythmRecordEnvelope): RhythmProgress | undefined {
  if (!previous || previous.source.game !== current.source.game) return undefined;
  const previousRecords = new Map(previous.records.map((record) => [recordKey(record), record]));
  const improvements: RhythmImprovement[] = [];
  let newCharts = 0;

  for (const record of current.records) {
    const older = previousRecords.get(recordKey(record));
    if (!older) {
      newCharts += 1;
      continue;
    }
    const score = record.result.rawScore;
    const previousScore = older.result.rawScore;
    if (score === undefined || previousScore === undefined || score <= previousScore) continue;
    improvements.push({
      id: recordKey(record), title: record.song.title, difficulty: record.chart.difficulty,
      previousScore, score, gain: score - previousScore
    });
  }

  improvements.sort((left, right) => right.gain - left.gain || left.title.localeCompare(right.title));
  return {
    previousAt: previous.generatedAt,
    newCharts,
    improvedCharts: improvements.length,
    scoreGain: improvements.reduce((sum, entry) => sum + entry.gain, 0),
    topImprovements: improvements.slice(0, 5)
  };
}
