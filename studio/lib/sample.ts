import type { StudioData } from "./types";

const names = [
  "Aurora Signal", "Midnight Circuit", "Parallel Bloom", "Glass Horizon", "Orbiting",
  "Afterimage", "Neon Current", "White Canvas", "Second Sunrise", "Vector Memory"
];

const records: StudioData["records"] = Array.from({ length: 50 }, (_, index) => ({
  title: `${names[index % names.length]} ${Math.floor(index / names.length) + 1}`,
  type: index % 6 === 0 ? "std" : "dx",
  difficulty: index % 9 === 0 ? "expert" : index % 7 === 0 ? "remaster" : "master",
  displayedLevel: index % 4 === 0 ? "13+" : "13",
  achievementRate: 100.5 - index * 0.0137,
  bucket: index < 15 ? "b15" : "b35",
  chartRating: 310 - Math.floor(index / 2)
}));
const b15Rating = records.slice(0, 15).reduce((sum, record) => sum + (record.chartRating ?? 0), 0);
const b35Rating = records.slice(15).reduce((sum, record) => sum + (record.chartRating ?? 0), 0);

export const SAMPLE_DATA: StudioData = {
  schema: "mai-score/v1",
  exportedAt: "2026-07-27T08:00:00.000Z",
  player: {
    name: "PREVIEW PLAYER",
    title: "Mai-Score Studio",
    rating: 15000
  },
  records,
  b15Rating,
  b35Rating,
  b50Rating: b15Rating + b35Rating
};
