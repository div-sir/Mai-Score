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
import { normalizePassportSlug, suggestPassportSlug } from "../../lib/passport-slug";
import { PassportGameCards, passportGameLabel, PublishedPassport } from "./passport-view";

const OWNER_KEY_PREFIX = "mai-score:passport:v1:owner:";
const LAST_SLUG_KEY = "mai-score:passport:v1:last-slug";

export default function PassportClient() {
  const [publicProfile, setPublicProfile] = useState<PublicPassport | null>(null);
  const [summaries, setSummaries] = useState<PassportGameSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [slug, setSlug] = useState("");
  const [hasEditKey, setHasEditKey] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [persistenceAvailable, setPersistenceAvailable] = useState<boolean | null>(null);
  const [message, setMessage] = useState("Loading local game data…");
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    void fetch("/api/passports", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { available?: unknown }) => setPersistenceAvailable(result.available === true))
      .catch(() => setPersistenceAvailable(false));
    const readHash = () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const encoded = hash.get("profile");
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
      let recoveredSlug = "";
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const manage = hash.get("manage");
      const token = hash.get("token");
      if (manage && token) {
        try {
          if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("The Passport recovery link has an invalid edit key.");
          recoveredSlug = normalizePassportSlug(manage);
          window.localStorage.setItem(`${OWNER_KEY_PREFIX}${recoveredSlug}`, token);
          window.localStorage.setItem(LAST_SLUG_KEY, recoveredSlug);
          setSlug(recoveredSlug);
          setHasEditKey(true);
          setShareUrl(new URL(`/p/${recoveredSlug}`, window.location.origin).toString());
          window.history.replaceState(null, "", "/passport");
          setMessage("Passport edit access restored on this browser.");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : String(error));
        }
      }
      void Promise.all([loadStudioSnapshot(), listExternalGameDatasets()]).then(([maimai, external]) => {
        const next = [
          ...(maimai ? [maimaiPassportSummary(maimai.data)] : []),
          ...external.map(externalPassportSummary)
        ];
        setSummaries(next);
        setSelected(next.map((entry) => entry.game));
        const name = maimai?.data.player.name ?? next.find((entry) => entry.playerName)?.playerName ?? "";
        setDisplayName(name);
        if (!recoveredSlug) {
          const saved = window.localStorage.getItem(LAST_SLUG_KEY) ?? "";
          const nextSlug = saved || suggestPassportSlug(name);
          setSlug(nextSlug);
          if (saved) {
            setHasEditKey(Boolean(window.localStorage.getItem(`${OWNER_KEY_PREFIX}${saved}`)));
            setShareUrl(new URL(`/p/${saved}`, window.location.origin).toString());
          }
          setMessage(next.length ? "Choose exactly what this public profile may reveal." : "Collect or import game data in Studio first.");
        }
      }).catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
    }
    return () => window.removeEventListener("hashchange", hashChanged);
  }, []);

  const chosen = useMemo(() => summaries.filter((entry) => selected.includes(entry.game)), [selected, summaries]);

  function changeSlug(value: string) {
    setSlug(value.toLowerCase());
    setShareUrl("");
    try {
      const normalized = normalizePassportSlug(value);
      setHasEditKey(Boolean(window.localStorage.getItem(`${OWNER_KEY_PREFIX}${normalized}`)));
    } catch {
      setHasEditKey(false);
    }
  }

  async function publishPersistent() {
    setPublishing(true);
    try {
      const normalized = normalizePassportSlug(slug);
      const profile = createPassport(displayName, bio, chosen);
      const token = window.localStorage.getItem(`${OWNER_KEY_PREFIX}${normalized}`);
      const response = await fetch(token ? `/api/passports/${encodeURIComponent(normalized)}` : "/api/passports", {
        method: token ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(token ? { passport: profile } : { slug: normalized, passport: profile })
      });
      const result = await response.json() as { error?: string; editToken?: string };
      if (!response.ok) throw new Error(result.error || `Passport service returned ${response.status}.`);
      if (result.editToken) window.localStorage.setItem(`${OWNER_KEY_PREFIX}${normalized}`, result.editToken);
      window.localStorage.setItem(LAST_SLUG_KEY, normalized);
      setHasEditKey(true);
      const url = new URL(`/p/${normalized}`, window.location.origin).toString();
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setMessage(`${token ? "Updated" : "Created"} fixed Passport and copied its public link.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPublishing(false);
    }
  }

  async function copyServerlessLink() {
    try {
      const profile = createPassport(displayName, bio, chosen);
      const url = new URL("/passport", window.location.origin);
      url.hash = `profile=${encodePassport(profile)}`;
      setShareUrl(url.toString());
      await navigator.clipboard.writeText(url.toString());
      setMessage("Serverless Passport link copied. It contains only the summary shown below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyRecoveryLink() {
    try {
      const normalized = normalizePassportSlug(slug);
      const token = window.localStorage.getItem(`${OWNER_KEY_PREFIX}${normalized}`);
      if (!token) throw new Error("This browser does not have the edit key for that Passport.");
      const url = new URL("/passport", window.location.origin);
      url.hash = new URLSearchParams({ manage: normalized, token }).toString();
      await navigator.clipboard.writeText(url.toString());
      setMessage("Private recovery link copied. Keep it secret—anyone with it can update this Passport.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function deletePersistentPassport() {
    if (!window.confirm("Delete this public Passport permanently? This profile name will become available again.")) return;
    setPublishing(true);
    try {
      const normalized = normalizePassportSlug(slug);
      const token = window.localStorage.getItem(`${OWNER_KEY_PREFIX}${normalized}`);
      if (!token) throw new Error("This browser does not have the edit key for that Passport.");
      const response = await fetch(`/api/passports/${encodeURIComponent(normalized)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` }
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || `Passport service returned ${response.status}.`);
      window.localStorage.removeItem(`${OWNER_KEY_PREFIX}${normalized}`);
      if (window.localStorage.getItem(LAST_SLUG_KEY) === normalized) window.localStorage.removeItem(LAST_SLUG_KEY);
      setHasEditKey(false);
      setShareUrl("");
      setMessage("Public Passport deleted. Your local game data was not changed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPublishing(false);
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
    {publicProfile ? <PublishedPassport profile={publicProfile} /> : <section className="passport-builder">
      <div>
        <p className="passport-eyebrow">PUBLIC PROFILE BUILDER</p>
        <h1>One profile for every cabinet.</h1>
        <p>Claim one fixed public address and update it whenever your local game data changes. Raw records stay in this browser; only the selected summary is published.</p>
      </div>
      <div className="passport-fields">
        <label>Display name<input value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label>Short introduction<textarea value={bio} maxLength={160} rows={3} onChange={(event) => setBio(event.target.value)} /></label>
        <label>Public profile name<span className="passport-slug-field"><span>mai-score.milifix.com/p/</span><input value={slug} maxLength={30} autoCapitalize="none" spellCheck={false} onChange={(event) => changeSlug(event.target.value)} /></span><small>3–30 lowercase letters, numbers, or single hyphens.</small></label>
        <fieldset><legend>Visible game data</legend>{summaries.map((summary) => <label className="passport-choice" key={summary.game}>
          <input type="checkbox" checked={selected.includes(summary.game)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, summary.game] : current.filter((game) => game !== summary.game))} />
          <span><strong>{passportGameLabel(summary.game)}</strong><small>{summary.rating !== undefined ? `Rating ${summary.rating.toLocaleString()} · ` : ""}{summary.playedCharts.toLocaleString()} charts</small></span>
        </label>)}</fieldset>
        <button type="button" className="passport-publish" disabled={persistenceAvailable !== true || publishing || !displayName.trim() || !chosen.length || !slug.trim()} onClick={() => void publishPersistent()}>{persistenceAvailable === null ? "Checking fixed profiles…" : persistenceAvailable === false ? "Fixed profiles need storage" : publishing ? "Publishing…" : hasEditKey ? "Update fixed Passport" : "Create fixed Passport"}</button>
        {persistenceAvailable === false ? <small className="passport-storage-note">The serverless option remains available while persistent storage is being connected.</small> : null}
        <button type="button" className="passport-secondary" disabled={!displayName.trim() || !chosen.length} onClick={() => void copyServerlessLink()}>Copy serverless link instead</button>
        {shareUrl ? <div className="passport-published-actions"><a className="passport-link" href={shareUrl}>Open the published view</a>{hasEditKey ? <><button type="button" onClick={() => void copyRecoveryLink()}>Copy private recovery link</button><button type="button" className="passport-delete" onClick={() => void deletePersistentPassport()}>Delete public Passport</button></> : null}</div> : null}
      </div>
    </section>}
    {!publicProfile && profile ? <PassportGameCards profile={profile} /> : null}
    {!publicProfile ? <section className="bookmarklet-guide">
      <div><p className="passport-eyebrow">DX NET BOOKMARK COLLECTOR</p><h2>Collect without installing an extension.</h2><p>Copy the fixed-version bookmark, save it as a browser bookmark, then run it while signed in to DX NET. A confirmation window always appears before any request.</p></div>
      <div className="bookmarklet-steps"><span>1</span><p><strong>Copy</strong> the bookmark code.</p><span>2</span><p><strong>Paste</strong> it into a bookmark URL.</p><span>3</span><p><strong>Run</strong> it on DX NET and choose the collection range.</p><button type="button" onClick={() => void copyBookmarklet()}>Copy DX NET bookmark</button></div>
    </section> : null}
    <p className="passport-status" role="status">{message}</p>
    <footer className="passport-privacy"><strong>Privacy by construction</strong><span>No score list, account ID, login cookie, Google token, or official-site HTML is included in a Passport link.</span></footer>
  </main>;
}
