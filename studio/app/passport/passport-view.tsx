import type { PassportGameSummary, PublicPassport } from "../../lib/passport";
import { rhythmGameLabel } from "../../lib/generic-rhythm";

export const passportGameLabel = (game: PassportGameSummary["game"]) => game === "maimai-dx" ? "maimai DX"
  : game === "dance-dance-revolution" ? "DDR WORLD" : rhythmGameLabel(game);

const dateLabel = (value: string) => new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC"
}).format(new Date(value));

export function PassportGameCards({ profile }: { profile: PublicPassport }) {
  return <section className="passport-games" aria-label="Public game summaries">
    {profile.games.map((game) => <article key={game.game}>
      <div className={`passport-game-mark game-${game.game}`} aria-hidden="true">{passportGameLabel(game.game).slice(0, 2).toUpperCase()}</div>
      <div><p>{passportGameLabel(game.game)}</p><h2>{game.rating !== undefined ? game.rating.toLocaleString("en") : game.playerName ?? "Collected"}</h2></div>
      <dl><div><dt>Played charts</dt><dd>{game.playedCharts.toLocaleString("en")}</dd></div><div><dt>Updated</dt><dd>{dateLabel(game.updatedAt)}</dd></div></dl>
    </article>)}
  </section>;
}

export function PublishedPassport({ profile, slug }: { profile: PublicPassport; slug?: string }) {
  return <>
    <section className="passport-hero public">
      <p className="passport-eyebrow">RHYTHM GAME PLAYER PASSPORT</p>
      <h1>{profile.profile.displayName}</h1>
      {profile.profile.bio ? <p>{profile.profile.bio}</p> : null}
      <small>{slug ? `mai-score.milifix.com/p/${slug} · ` : ""}Updated {dateLabel(profile.publishedAt)}</small>
    </section>
    <PassportGameCards profile={profile} />
  </>;
}
