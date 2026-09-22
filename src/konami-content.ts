import { decodeKonamiCsvBytes, parseKonamiCsv, type KonamiCsvGame } from "./lib/konami-csv";
import { LANGUAGE_STORAGE_KEY, type PopupLanguage } from "./lib/i18n";
import type { KonamiImportRequest } from "./lib/konami-import";
import {
  collectKonamiPages,
  konamiPageGameForUrl,
  type KonamiPageCollectRequest,
  type KonamiPageImportRequest,
  type KonamiPageSnapshot
} from "./lib/konami-page";

const pageGame = konamiPageGameForUrl(location.href);
const csvGame: Exclude<KonamiCsvGame, "auto"> | undefined = pageGame === "beatmania-iidx" || pageGame === "sound-voltex"
  ? pageGame : undefined;
const dismissedKey = `mai-score-konami-prompt:${pageGame ?? "unknown"}`;
const gameName = pageGame === "beatmania-iidx" ? "beatmania IIDX"
  : pageGame === "sound-voltex" ? "SOUND VOLTEX" : "DanceDanceRevolution";

const copy = (language: PopupLanguage) => language === "zh-Hant" ? {
  eyebrow: "Mai-Score 已偵測此網站", title: `收集 ${gameName} 資料`,
  body: "直接整理目前登入狀態可開啟的 PLAY DATA 頁面。付費或登入限制頁會標示為無法取得，不會讀取帳密。",
  collect: "收集所有可讀資料", collecting: "正在檢查 PLAY DATA…", done: "完成，正在開啟 Studio",
  csv: "改用官方 CSV", close: "關閉"
} : language === "ja" ? {
  eyebrow: "Mai-Score がこのサイトを検出しました", title: `${gameName} データを収集`,
  body: "現在のログイン状態で開けるPLAY DATAページを整理します。有料・ログイン制限ページは取得不可として表示し、認証情報は読み取りません。",
  collect: "閲覧可能なデータを収集", collecting: "PLAY DATAを確認中…", done: "完了。Studioを開きます",
  csv: "公式CSVを使用", close: "閉じる"
} : {
  eyebrow: "Mai-Score detected this site", title: `Collect ${gameName} data`,
  body: "Organize every PLAY DATA page available in the current session. Paid or sign-in-gated pages are reported as unavailable; credentials are never read.",
  collect: "Collect all readable data", collecting: "Checking PLAY DATA…", done: "Done — opening Studio",
  csv: "Use official CSV instead", close: "Close"
};

async function collectVisiblePages(): Promise<KonamiPageSnapshot> {
  return collectKonamiPages(
    document,
    location.href,
    async (url) => {
      const response = await fetch(url, { credentials: "include", redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    },
    (html) => new DOMParser().parseFromString(html, "text/html")
  );
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if ((message as Partial<KonamiPageCollectRequest>)?.type !== "MAI_SCORE_KONAMI_PAGE_COLLECT") return;
  collectVisiblePages()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error: unknown) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }));
  return true;
});

async function mount() {
  if (!pageGame || sessionStorage.getItem(dismissedKey)) return;
  const stored = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
  const candidate = stored[LANGUAGE_STORAGE_KEY];
  const language: PopupLanguage = candidate === "zh-Hant" || candidate === "ja" ? candidate : "en";
  const text = copy(language);
  const host = document.createElement("div");
  host.id = "mai-score-konami-prompt";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host{all:initial}.card{position:fixed;z-index:2147483647;right:18px;bottom:18px;width:min(360px,calc(100vw - 36px));box-sizing:border-box;border:1px solid #4a426f;border-radius:18px;padding:17px;background:linear-gradient(145deg,#14182d,#0d1020);color:#edf1ff;box-shadow:0 18px 60px #0009;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.top{display:flex;align-items:start;justify-content:space-between;gap:12px}.mark{display:grid;width:34px;height:34px;flex:none;place-items:center;border-radius:10px;background:linear-gradient(135deg,#35c9a0,#5a8cff);font-size:12px;font-weight:900}.heading{display:grid;flex:1;gap:2px}.eyebrow{color:#9ba7ce;font-size:10px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.title{font-size:16px;font-weight:800}.close{display:grid;width:30px;height:30px;place-items:center;border:0;border-radius:9px;background:#ffffff0c;color:#b8c0dc;cursor:pointer;font-size:19px}.body{margin:12px 0;color:#aeb8d8;font-size:12px}.action,.csv{width:100%;border:0;border-radius:11px;padding:11px;color:#fff;cursor:pointer;font:800 13px inherit}.action{background:linear-gradient(135deg,#22b99a,#5a8cff)}.csv{margin-top:7px;border:1px solid #343c61;background:#171d35;color:#b9c3e3}.action:disabled,.csv:disabled{cursor:wait;opacity:.65}.status{margin:9px 2px 0;color:#9ff0d1;font-size:11px}.status:empty{display:none}@media(max-width:560px){.card{right:10px;bottom:10px;width:calc(100vw - 20px)}}
    </style>
    <section class="card" role="dialog" aria-label="${text.title}">
      <div class="top"><span class="mark">${pageGame === "dance-dance-revolution" ? "DDR" : "M"}</span><div class="heading"><span class="eyebrow">${text.eyebrow}</span><strong class="title">${text.title}</strong></div><button class="close" type="button" aria-label="${text.close}">×</button></div>
      <p class="body">${text.body}</p>
      <button class="action" type="button">${text.collect}</button>
      ${csvGame ? `<input class="file" type="file" accept=".csv,text/csv,text/plain" hidden><button class="csv" type="button">${text.csv}</button>` : ""}
      <p class="status" role="status"></p>
    </section>`;
  document.documentElement.append(host);
  const close = shadow.querySelector<HTMLButtonElement>(".close")!;
  const action = shadow.querySelector<HTMLButtonElement>(".action")!;
  const csv = shadow.querySelector<HTMLButtonElement>(".csv");
  const file = shadow.querySelector<HTMLInputElement>(".file");
  const status = shadow.querySelector<HTMLElement>(".status")!;
  close.addEventListener("click", () => {
    sessionStorage.setItem(dismissedKey, "1");
    host.remove();
  });
  action.addEventListener("click", async () => {
    action.disabled = true;
    action.textContent = text.collecting;
    status.textContent = "";
    try {
      const data = await collectVisiblePages();
      const response = await chrome.runtime.sendMessage({
        type: "MAI_SCORE_KONAMI_PAGE_IMPORT", data, language
      } satisfies KonamiPageImportRequest) as { ok: boolean; error?: string } | undefined;
      if (!response?.ok) throw new Error(response?.error ?? "Mai-Score did not respond.");
      status.textContent = `${text.done} · ${data.summary.collected}/${data.pages.length}`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      action.disabled = false;
      action.textContent = text.collect;
    }
  });
  csv?.addEventListener("click", () => file?.click());
  file?.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected || !csvGame || !csv) return;
    csv.disabled = true;
    status.textContent = "";
    try {
      const data = parseKonamiCsv(decodeKonamiCsvBytes(await selected.arrayBuffer()), selected.name, csvGame);
      const response = await chrome.runtime.sendMessage({
        type: "MAI_SCORE_KONAMI_IMPORT", data, language
      } satisfies KonamiImportRequest) as { ok: boolean; error?: string } | undefined;
      if (!response?.ok) throw new Error(response?.error ?? "Mai-Score did not respond.");
      status.textContent = `${text.done} · ${data.records.length.toLocaleString(language)}`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      csv.disabled = false;
      file.value = "";
    }
  });
}

void mount();
