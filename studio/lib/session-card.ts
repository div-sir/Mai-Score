import { sessionCopy } from "./i18n";
import { buildPracticeList, type PlaySession, type WeaknessPrescription } from "./session";
import type { LanguageId, StudioData } from "./types";

const escapeXml = (value: string) => value
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");

const compact = (value: string, max = 28) => value.length > max ? `${value.slice(0, max - 1)}…` : value;

const signed = (value: number | undefined) => value === undefined ? "—" : `${value > 0 ? "+" : ""}${value}`;

export function renderSessionShareCard(
  data: StudioData,
  session: PlaySession,
  prescriptions: readonly WeaknessPrescription[],
  language: LanguageId
) {
  const copy = sessionCopy(language);
  const width = 1080;
  const height = 1350;
  const highlights = [...session.plays]
    .sort((a, b) => Number(b.chartRating ?? 0) - Number(a.chartRating ?? 0)
      || b.achievementRate - a.achievementRate)
    .slice(0, 3);
  const practice = buildPracticeList(prescriptions, 4);
  const focus = prescriptions[0] ? copy.weakness[prescriptions[0].kind] : undefined;
  const date = new Date(`${session.endedAt}:00`).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });

  const metric = (x: number, label: string, value: string) => `
    <g transform="translate(${x} 310)">
      <rect width="230" height="132" rx="24" fill="#171d2c" stroke="#2d3750"/>
      <text x="24" y="43" fill="#91a0bc" font-size="22">${escapeXml(label)}</text>
      <text x="24" y="98" fill="#f5f7ff" font-size="42" font-weight="750">${escapeXml(value)}</text>
    </g>`;
  const highlightRows = highlights.map((play, index) => `
    <g transform="translate(70 ${548 + index * 100})">
      <rect width="940" height="82" rx="18" fill="#151b28"/>
      <text x="24" y="35" fill="#f5f7ff" font-size="24" font-weight="700">${escapeXml(compact(play.title, 34))}</text>
      <text x="24" y="63" fill="#91a0bc" font-size="18">${escapeXml(`${play.type.toUpperCase()} · ${play.difficulty.toUpperCase()} · ${play.displayedLevel}`)}</text>
      <text x="910" y="51" text-anchor="end" fill="#72d6c9" font-size="28" font-weight="750">${play.achievementRate.toFixed(4)}%</text>
    </g>`).join("");
  const practiceRows = practice.map((target, index) => `
    <g transform="translate(70 ${1030 + index * 58})">
      <circle cx="14" cy="-7" r="7" fill="#a98cff"/>
      <text x="36" y="0" fill="#e9edfa" font-size="22">${escapeXml(compact(target.record.title, 31))}</text>
      <text x="910" y="0" text-anchor="end" fill="#c2b2ff" font-size="21">${escapeXml(`${copy.target} ${target.targetAchievement.toFixed(target.targetAchievement % 1 ? 1 : 0)}%`)}</text>
    </g>`).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b1020"/><stop offset="1" stop-color="#151124"/></linearGradient></defs>
    <rect width="1080" height="1350" fill="url(#bg)"/>
    <circle cx="950" cy="80" r="250" fill="#795cff" opacity=".11"/>
    <text x="70" y="80" fill="#72d6c9" font-size="22" font-weight="700" letter-spacing="4">MAI-SCORE · SESSION</text>
    <text x="70" y="150" fill="#f5f7ff" font-size="52" font-weight="800">${escapeXml(compact(data.player.name, 22))}</text>
    <text x="70" y="195" fill="#91a0bc" font-size="24">${escapeXml(date)}</text>
    <text x="1010" y="150" text-anchor="end" fill="#f5f7ff" font-size="50" font-weight="800">${data.b50Rating}</text>
    <text x="1010" y="188" text-anchor="end" fill="#91a0bc" font-size="20">B50 RATING</text>
    ${metric(70, copy.plays, String(session.plays.length))}
    ${metric(320, copy.uniqueCharts, String(session.uniqueCharts))}
    ${metric(570, copy.personalBests, String(session.personalBests))}
    ${metric(820, copy.ratingSinceSnapshot, signed(session.ratingDelta))}
    <text x="70" y="505" fill="#91a0bc" font-size="21" font-weight="700" letter-spacing="2">${escapeXml(copy.topPlays.toUpperCase())}</text>
    ${highlightRows}
    <rect x="70" y="870" width="940" height="120" rx="24" fill="#201c31" stroke="#493d68"/>
    <text x="98" y="913" fill="#b8a1ff" font-size="21" font-weight="700">${escapeXml(copy.diagnosis)}</text>
    <text x="98" y="953" fill="#f5f7ff" font-size="29" font-weight="750">${escapeXml(focus?.title ?? "—")}</text>
    <text x="70" y="1020" fill="#91a0bc" font-size="21" font-weight="700" letter-spacing="2">${escapeXml(copy.practiceList.toUpperCase())}</text>
    ${practiceRows}
    <text x="70" y="1310" fill="#68758e" font-size="18">${escapeXml(copy.generatedLocally)}</text>
    <text x="1010" y="1310" text-anchor="end" fill="#68758e" font-size="18">mai-score.milifix.com</text>
  </svg>`;
  return { svg, width, height };
}
