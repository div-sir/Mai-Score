"use client";

import { useMemo, useState } from "react";
import { sessionCopy } from "../lib/i18n";
import type { HistoryEntry } from "../lib/history";
import {
  buildLatestSession,
  buildPracticeList,
  buildWeaknessPrescriptions
} from "../lib/session";
import { renderSessionShareCard } from "../lib/session-card";
import type { LanguageId, StudioAssets, StudioData } from "../lib/types";
import SongCover from "./song-cover";

interface SessionDashboardProps {
  data: StudioData | null;
  assets: StudioAssets;
  history: HistoryEntry[];
  language: LanguageId;
  onStatus: (message: string) => void;
}

const signed = (value: number | undefined) => value === undefined ? "—" : `${value > 0 ? "+" : ""}${value}`;

async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Share card could not be decoded."));
      image.src = source;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Share card canvas is unavailable.");
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Share card PNG encoding failed.")),
      "image/png"
    ));
  } finally {
    URL.revokeObjectURL(source);
  }
}

export default function SessionDashboard({ data, assets, history, language, onStatus }: SessionDashboardProps) {
  const copy = sessionCopy(language);
  const [working, setWorking] = useState(false);
  const previous = useMemo(() => {
    if (!data) return undefined;
    const index = history.findIndex((entry) => entry.generatedAt === data.exportedAt);
    return index >= 0 ? history[index + 1] : history.find((entry) => entry.generatedAt < data.exportedAt);
  }, [data, history]);
  const session = useMemo(
    () => buildLatestSession(data?.recentPlays, previous, data?.player.rating),
    [data, previous]
  );
  const prescriptions = useMemo(
    () => data ? buildWeaknessPrescriptions(data, session) : [],
    [data, session]
  );
  const practice = useMemo(() => buildPracticeList(prescriptions), [prescriptions]);

  if (!data || !session) {
    return <section className="session-empty-state">
      <span aria-hidden="true">◎</span>
      <h1>{copy.heading}</h1>
      <p>{copy.empty}</p>
      <small>{copy.collectHint}</small>
    </section>;
  }

  const createCard = async () => {
    const rendered = renderSessionShareCard(data, session, prescriptions, language);
    const blob = await svgToPng(rendered.svg, rendered.width, rendered.height);
    return new File([blob], `mai-score-session-${data.exportedAt.slice(0, 10)}.png`, { type: "image/png" });
  };

  const saveCard = (file: File) => {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const downloadCard = async () => {
    setWorking(true);
    try {
      const file = await createCard();
      saveCard(file);
      onStatus(copy.cardReady);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

  const shareCard = async () => {
    setWorking(true);
    try {
      const file = await createCard();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${data.player.name} · ${copy.heading}` });
        onStatus(copy.cardReady);
      } else {
        saveCard(file);
        onStatus(copy.cardReady);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      onStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

  const highlights = [...session.plays]
    .sort((a, b) => Number(b.chartRating ?? 0) - Number(a.chartRating ?? 0)
      || b.achievementRate - a.achievementRate)
    .slice(0, 5);

  return <section className="session-dashboard">
    <header className="session-header">
      <div><span>{copy.latestVisit}</span><h1>{copy.heading}</h1><p>{copy.description}</p></div>
      <time dateTime={session.endedAt}>{new Date(`${session.endedAt}:00`).toLocaleString(language)}</time>
    </header>

    <div className="session-metrics">
      <article><span>{copy.plays}</span><strong>{session.plays.length}</strong></article>
      <article><span>{copy.uniqueCharts}</span><strong>{session.uniqueCharts}</strong></article>
      <article><span>{copy.personalBests}</span><strong>{session.personalBests}</strong><small>DX {session.dxScoreBests}</small></article>
      <article><span>{copy.ratingSinceSnapshot}</span><strong className={(session.ratingDelta ?? 0) >= 0 ? "up" : "down"}>{signed(session.ratingDelta)}</strong></article>
    </div>

    <article className="session-panel session-highlights">
      <header><h2>{copy.topPlays}</h2><span>{session.fullCombos} FC · {session.allPerfects} AP</span></header>
      <ol>{highlights.map((play, index) => <li key={`${play.playedAt}-${play.track}-${index}`}>
        <SongCover record={play} assets={assets} />
        <div><strong>{play.title}</strong><span>{play.type.toUpperCase()} · {play.difficulty.toUpperCase()} · {play.displayedLevel}</span></div>
        <div className="session-score"><strong>{play.achievementRate.toFixed(4)}%</strong><span>{play.newAchievement ? "PB" : play.scoreRank?.toUpperCase() ?? ""}</span></div>
      </li>)}</ol>
    </article>

    <div className="session-coaching-grid">
      <article className="session-panel prescription-panel">
        <header><div><h2>{copy.diagnosis}</h2><p>{copy.diagnosisDescription}</p></div></header>
        <div className="prescription-list">{prescriptions.map((prescription, index) => {
          const text = copy.weakness[prescription.kind];
          return <section key={prescription.kind} className={index === 0 ? "primary" : ""}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><h3>{text.title}</h3><p>{text.description}</p><small>{copy.evidence(prescription.evidence)}</small></div>
          </section>;
        })}</div>
      </article>

      <article className="session-panel practice-panel">
        <header><div><h2>{copy.practiceList}</h2><p>{copy.practiceDescription}</p></div></header>
        <ol>{practice.map((target) => <li key={`${target.record.title}-${target.record.type}-${target.record.difficulty}`}>
          <SongCover record={target.record} assets={assets} />
          <div><strong>{target.record.title}</strong><span>{target.record.difficulty.toUpperCase()} · {target.record.displayedLevel}{target.attempts ? ` · ${copy.attempts(target.attempts)}` : ""}</span></div>
          <strong>{copy.target} {target.targetAchievement.toFixed(target.targetAchievement % 1 ? 1 : 0)}%</strong>
        </li>)}</ol>
      </article>
    </div>

    <article className="session-share-panel">
      <div><h2>{copy.shareCard}</h2><p>{copy.shareCardDescription}</p></div>
      <div>
        <button type="button" className="secondary-button" disabled={working} onClick={downloadCard}>{copy.downloadCard}</button>
        <button type="button" className="load-button" disabled={working} onClick={shareCard}>{copy.shareCardAction}</button>
      </div>
    </article>
  </section>;
}
