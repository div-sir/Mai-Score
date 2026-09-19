import { decodeKonamiCsvBytes, parseKonamiCsv, type KonamiCsvGame } from "./lib/konami-csv";
import { LANGUAGE_STORAGE_KEY, type PopupLanguage } from "./lib/i18n";
import type { KonamiImportRequest } from "./lib/konami-import";

const game: Exclude<KonamiCsvGame, "auto"> = location.pathname.includes("/game/2dx/")
  ? "beatmania-iidx" : "sound-voltex";
const dismissedKey = `mai-score-konami-prompt:${game}`;

const copy = (language: PopupLanguage) => language === "zh-Hant" ? {
  eyebrow: "Mai-Score 已偵測此網站", title: game === "beatmania-iidx" ? "匯入 IIDX 成績" : "匯入 SDVX 成績",
  body: "下載官方 CSV 後，可直接在這裡整理並開啟 Studio。帳號與登入資料不會被讀取。",
  action: "選擇 CSV 並匯入", working: "正在整理…", done: "完成，正在開啟 Studio", close: "關閉"
} : language === "ja" ? {
  eyebrow: "Mai-Score がこのサイトを検出しました", title: game === "beatmania-iidx" ? "IIDXスコアを取込" : "SDVXスコアを取込",
  body: "公式CSVをダウンロード後、ここから整理してStudioで開けます。ログイン情報は読み取りません。",
  action: "CSVを選んで取込", working: "処理中…", done: "完了。Studioを開きます", close: "閉じる"
} : {
  eyebrow: "Mai-Score detected this site", title: game === "beatmania-iidx" ? "Import IIDX scores" : "Import SDVX scores",
  body: "After downloading the official CSV, organize it here and open Studio. Sign-in details are never read.",
  action: "Choose CSV and import", working: "Organizing…", done: "Done — opening Studio", close: "Close"
};

async function mount() {
  if (sessionStorage.getItem(dismissedKey)) return;
  const stored = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
  const candidate = stored[LANGUAGE_STORAGE_KEY];
  const language: PopupLanguage = candidate === "zh-Hant" || candidate === "ja" ? candidate : "en";
  const text = copy(language);
  const host = document.createElement("div");
  host.id = "mai-score-konami-prompt";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host{all:initial}.card{position:fixed;z-index:2147483647;right:18px;bottom:18px;width:min(360px,calc(100vw - 36px));box-sizing:border-box;border:1px solid #4a426f;border-radius:18px;padding:17px;background:linear-gradient(145deg,#14182d,#0d1020);color:#edf1ff;box-shadow:0 18px 60px #0009;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.top{display:flex;align-items:start;justify-content:space-between;gap:12px}.mark{display:grid;width:34px;height:34px;flex:none;place-items:center;border-radius:10px;background:linear-gradient(135deg,#ef4c88,#5a8cff);font-size:15px;font-weight:900}.heading{display:grid;flex:1;gap:2px}.eyebrow{color:#9ba7ce;font-size:10px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.title{font-size:16px;font-weight:800}.close{display:grid;width:30px;height:30px;place-items:center;border:0;border-radius:9px;background:#ffffff0c;color:#b8c0dc;cursor:pointer;font-size:19px}.body{margin:12px 0;color:#aeb8d8;font-size:12px}.action{width:100%;border:0;border-radius:11px;padding:11px;background:linear-gradient(135deg,#ef4c88,#6f67ff);color:#fff;cursor:pointer;font:800 13px inherit}.action:disabled{cursor:wait;opacity:.65}.status{margin:9px 2px 0;color:#9ff0d1;font-size:11px}.status:empty{display:none}@media(max-width:560px){.card{right:10px;bottom:10px;width:calc(100vw - 20px)}}
    </style>
    <section class="card" role="dialog" aria-label="${text.title}">
      <div class="top"><span class="mark">M</span><div class="heading"><span class="eyebrow">${text.eyebrow}</span><strong class="title">${text.title}</strong></div><button class="close" type="button" aria-label="${text.close}">×</button></div>
      <p class="body">${text.body}</p>
      <input class="file" type="file" accept=".csv,text/csv,text/plain" hidden>
      <button class="action" type="button">${text.action}</button><p class="status" role="status"></p>
    </section>`;
  document.documentElement.append(host);
  const close = shadow.querySelector<HTMLButtonElement>(".close")!;
  const action = shadow.querySelector<HTMLButtonElement>(".action")!;
  const file = shadow.querySelector<HTMLInputElement>(".file")!;
  const status = shadow.querySelector<HTMLElement>(".status")!;
  close.addEventListener("click", () => {
    sessionStorage.setItem(dismissedKey, "1");
    host.remove();
  });
  action.addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    action.disabled = true;
    action.textContent = text.working;
    status.textContent = "";
    try {
      const data = parseKonamiCsv(decodeKonamiCsvBytes(await selected.arrayBuffer()), selected.name, game);
      const response = await chrome.runtime.sendMessage({
        type: "MAI_SCORE_KONAMI_IMPORT", data, language
      } satisfies KonamiImportRequest) as { ok: boolean; error?: string } | undefined;
      if (!response?.ok) throw new Error(response?.error ?? "Mai-Score did not respond.");
      status.textContent = `${text.done} · ${data.records.length.toLocaleString(language)}`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      action.disabled = false;
      action.textContent = text.action;
      file.value = "";
    }
  });
}

void mount();
