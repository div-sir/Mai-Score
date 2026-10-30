"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listExternalGameDatasets, loadStudioSnapshot } from "../../lib/local-store";
import {
  createPassport,
  decodePassport,
  encodePassport,
  externalPassportSummary,
  maimaiPassportSummary,
  type PassportGameSummary,
  type PublicPassport
} from "../../lib/passport";
import { rhythmGameLabel } from "../../lib/generic-rhythm";

const gameLabel = (game: PassportGameSummary["game"]) => game === "maimai-dx" ? "maimai DX"
  : game === "dance-dance-revolution" ? "DDR WORLD" : rhythmGameLabel(game);

export default function PassportClient() {
  const [publicProfile, setPublicProfile] = useState<PublicPassport | null>(null);
  const [summaries, setSummaries] = useState<PassportGameSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("Loading local game data…");
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    const readHash = () => {
      const encoded = new URLSearchParams(window.location.hash.slice(1)).get("profile");
      if (!encoded) return false;
      try {
        setPublicProfile(decodePassport(encoded));
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
      return true;
    };
    const hashChanged = () => {
      if (!readHash()) setPublicProfile(null);
    };
    window.addEventListener("hashchange", hashChanged);
    if (!readHash()) {
      void Promise.all([loadStudioSnapshot(), listExternalGameDatasets()]).then(([maimai, external]) => {
        const next = [
          ...(maimai ? [maimaiPassportSummary(maimai.data)] : []),
          ...external.map(externalPassportSummary)
        ];
        setSummaries(next);
        setSelected(next.map((entry) => entry.game));
        setDisplayName(maimai?.data.player.name ?? next.find((entry) => entry.playerName)?.playerName ?? "");
        setMessage(next.length ? "Choose exactly what this public link may reveal." : "Collect or import game data in Studio first.");
      }).catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    }
    return () => window.removeEventListener("hashchange", hashChanged);
  }, []);

  const chosen = useMemo(() => summaries.filter((entry) => selected.includes(entry.game)), [selected, summaries]);

  async function publish() {
    try {
      const profile = createPassport(displayName, bio, chosen);
      const url = new URL("/passport", window.location.origin);
      url.hash = `profile=${encodePassport(profile)}`;
      setShareUrl(url.toString());
      await navigator.clipboard.writeText(url.toString());
      setMessage("Public Passport link copied. The link contains only the summary shown below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyBookmarklet() {
    const loader = `javascript:(()=>{const s=document.createElement('script');s.src='${window.location.origin}/collector/v0.1.0.js';s.dataset.maiScore='v0.1.0';document.documentElement.append(s)})()`;
    await navigator.clipboard.writeText(loader);
    setMessage("Bookmark collector copied. Create a browser bookmark and paste it into the bookmark URL field.");
  }

  const profile = publicProfile ?? (displayName && chosen.length ? createPassport(displayName, bio, chosen) : null);

  return <main className="passport-shell">
    <header className="passport-nav">
      <Link className="passport-brand" href="/"><span>M</span><strong>Mai-Score</strong></Link>
      <Link href="/">Open Studio</Link>
    </header>
    {publicProfile ? <section className="passport-hero public">
      <p className="passport-eyebrow">RHYTHM GAME PLAYER PASSPORT</p>
      <h1>{publicProfile.profile.displayName}</h1>
      {publicProfile.profile.bio ? <p>{publicProfile.profile.bio}</p> : null}
      <small>Shared {new Date(publicProfile.publishedAt).toLocaleDateString()}</small>
    </section> : <section className="passport-builder">
      <div>
        <p className="passport-eyebrow">PUBLIC PROFILE BUILDER</p>
        <h1>One profile for every cabinet.</h1>
        <p>Create a permanent, serverless link. Your raw records stay in this browser; only the selected summary is encoded in the URL.</p>
      </div>
      <div className="passport-fields">
        <label>Display name<input value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label>Short introduction<textarea value={bio} maxLength={160} rows={3} onChange={(event) => setBio(event.target.value)} /></label>
        <fieldset><legend>Visible game data</legend>{summaries.map((summary) => <label className="passport-choice" key={summary.game}>
          <input type="checkbox" checked={selected.includes(summary.game)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, summary.game] : current.filter((game) => game !== summary.game))} />
          <span><strong>{gameLabel(summary.game)}</strong><small>{summary.rating !== undefined ? `Rating ${summary.rating.toLocaleString()} · ` : ""}{summary.playedCharts.toLocaleString()} charts</small></span>
        </label>)}</fieldset>
        <button type="button" className="passport-publish" disabled={!displayName.trim() || !chosen.length} onClick={() => void publish()}>Copy public Passport link</button>
        {shareUrl ? <a className="passport-link" href={shareUrl}>Open the published view</a> : null}
      </div>
    </section>}
    {profile ? <section className="passport-games" aria-label="Public game summaries">
      {profile.games.map((game) => <article key={game.game}>
        <div className={`passport-game-mark game-${game.game}`} aria-hidden="true">{gameLabel(game.game).slice(0, 2).toUpperCase()}</div>
        <div><p>{gameLabel(game.game)}</p><h2>{game.rating !== undefined ? game.rating.toLocaleString() : game.playerName ?? "Collected"}</h2></div>
        <dl><div><dt>Played charts</dt><dd>{game.playedCharts.toLocaleString()}</dd></div><div><dt>Updated</dt><dd>{new Date(game.updatedAt).toLocaleDateString()}</dd></div></dl>
      </article>)}
    </section> : null}
    {!publicProfile ? <section className="bookmarklet-guide">
      <div><p className="passport-eyebrow">DX NET BOOKMARK COLLECTOR</p><h2>Collect without installing an extension.</h2><p>Copy the fixed-version bookmark, save it as a browser bookmark, then run it while signed in to DX NET. A confirmation window always appears before any request.</p></div>
      <div className="bookmarklet-steps"><span>1</span><p><strong>Copy</strong> the bookmark code.</p><span>2</span><p><strong>Paste</strong> it into a bookmark URL.</p><span>3</span><p><strong>Run</strong> it on DX NET and choose the collection range.</p><button type="button" onClick={() => void copyBookmarklet()}>Copy DX NET bookmark</button></div>
    </section> : null}
    <p className="passport-status" role="status">{message}</p>
    <footer className="passport-privacy"><strong>Privacy by construction</strong><span>No score list, account ID, login cookie, Google token, or official-site HTML is included in a Passport link.</span></footer>
  </main>;
}
