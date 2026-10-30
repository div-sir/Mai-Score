import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublishedPassport } from "../../passport/passport-view";
import { getPublishedPassport } from "../../../lib/passport-store";
import { normalizePassportSlug } from "../../../lib/passport-slug";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Player Passport · Mai-Score",
  description: "A privacy-first public rhythm-game profile."
};

export default async function PersistentPassportPage({ params }: { params: Promise<{ slug: string }> }) {
  const requested = (await params).slug;
  let slug: string;
  try {
    slug = normalizePassportSlug(requested);
  } catch {
    notFound();
  }
  const profile = await getPublishedPassport(slug);
  if (!profile) notFound();
  return <main className="passport-shell">
    <header className="passport-nav">
      <Link className="passport-brand" href="/"><span>M</span><strong>Mai-Score</strong></Link>
      <Link href="/passport">Create your Passport</Link>
    </header>
    <PublishedPassport profile={profile} slug={slug} />
    <footer className="passport-privacy"><strong>Privacy by construction</strong><span>This page contains summary values selected by its owner, not a score list, account ID, login cookie, Google token, or official-site HTML.</span></footer>
  </main>;
}
