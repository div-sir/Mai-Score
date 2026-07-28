import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Mai-Score",
  description: "How the Mai-Score extension and Studio handle your data."
};

const UPDATED = "July 28, 2026";

export default function Privacy() {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link href="/" className="legal-back">← Back to Studio</Link>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: {UPDATED}</p>
      </header>

      <section>
        <h2>Summary</h2>
        <p>
          Mai-Score reads your own maimai DX NET score page so you can export it as an image
          or a JSON file. Your scores are processed in your browser. There is no Mai-Score
          account, no analytics, and no advertising. The one case where a request reaches our
          server is song cover art, described under <em>Cover art</em> below.
        </p>
      </section>

      <section>
        <h2>What the extension reads</h2>
        <p>
          When you click <strong>Collect B50</strong>, the extension requests your Best-50
          pages from whichever maimai DX NET you are signed in to
          &mdash; <code>maimaidx-eng.com</code> (International) or{" "}
          <code>maimaidx.jp</code> (Japan) &mdash; using the session you already have open,
          and reads:
        </p>
        <ul>
          <li>your in-game player name and official rating</li>
          <li>your Best-50 chart entries: song title, difficulty, level, achievement, and cover image name</li>
        </ul>
        <p>
          The extension does not read your SEGA password, payment details, or any page other
          than the score pages it needs. It never transmits your DX NET session cookie
          anywhere; the cookie is attached by the browser to requests aimed at that same
          site and nowhere else.
        </p>
      </section>

      <section>
        <h2>Where your data is stored</h2>
        <ul>
          <li>
            <strong>Your language preference</strong>{" "}
            is kept in the extension&rsquo;s local storage on your device.
          </li>
          <li>
            <strong>Collected scores</strong>{" "}
            are held in memory while the popup is open. When
            you open Studio, they are placed in the extension&rsquo;s session storage under a
            single-use token and handed to the Studio tab. That entry expires and is removed;
            session storage is cleared when the browser closes.
          </li>
          <li>
            <strong>In Studio</strong>, your most recent snapshot is saved in your
            browser&rsquo;s IndexedDB so the page survives a reload. It stays on your device,
            and <strong>Clear local data</strong> in Studio deletes it.
          </li>
        </ul>
        <p>We do not operate a database of user scores, and we cannot see your scores.</p>
      </section>

      <section>
        <h2>Cover art</h2>
        <p>
          Exported images include song cover art, which is not part of your score data and has
          to be fetched separately.
        </p>
        <ul>
          <li>
            When you arrive from the extension, the extension fetches the covers itself and
            embeds them before handing data to Studio. No cover request reaches our server.
          </li>
          <li>
            When you load a JSON file into Studio manually, Studio requests the covers through{" "}
            <code>/api/asset</code> on our server, which relays them from{" "}
            <code>shama.dxrating.net</code>. In this case our server sees{" "}
            <strong>which cover images were requested</strong>, along with the ordinary
            information any web server receives: IP address, timestamp, and user agent. It does
            not receive your player name, rating, or achievements. This proxy only accepts a
            fixed allowlist of image hosts and paths.
          </li>
        </ul>
        <p>
          Studio is hosted on Vercel, which processes standard request logs on our behalf as
          part of serving the site.
        </p>
      </section>

      <section>
        <h2>What we do not do</h2>
        <ul>
          <li>We do not sell or transfer your data to third parties.</li>
          <li>We do not use your data for advertising, profiling, or credit assessment.</li>
          <li>We do not use your data for anything unrelated to exporting your B50.</li>
          <li>We do not run analytics or tracking scripts in the extension or in Studio.</li>
        </ul>
      </section>

      <section>
        <h2>Permissions the extension asks for</h2>
        <ul>
          <li><strong>storage</strong> — save your language preference and the single-use Studio handoff.</li>
          <li><strong>downloads</strong> — save the image or JSON file you asked to export.</li>
          <li><strong>maimaidx-eng.com</strong> and <strong>maimaidx.jp</strong> — read your own score pages, International or Japan.</li>
          <li><strong>shama.dxrating.net</strong> — fetch song cover art for the export.</li>
        </ul>
      </section>

      <section>
        <h2>Removing your data</h2>
        <p>
          Use <strong>Clear local data</strong> in Studio to delete the saved snapshot, and
          uninstall the extension to remove its stored preference. Because nothing is kept on
          our servers, there is no account to delete and no deletion request to file.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If this policy changes, the date at the top of this page changes with it. Material
          changes will also be noted in the project&rsquo;s release notes.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions or reports can be raised as an issue on the{" "}
          <a href="https://github.com/div-sir/Mai-Score" target="_blank" rel="noreferrer">
            Mai-Score GitHub repository
          </a>.
        </p>
      </section>

      <footer className="legal-footer">
        Mai-Score is a community project. It is not affiliated with, endorsed by, or sponsored
        by SEGA. &ldquo;maimai&rdquo; is a trademark of its respective owner.
      </footer>
    </main>
  );
}
