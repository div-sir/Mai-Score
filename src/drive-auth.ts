import {
  connectDrive,
  driveConnection,
  driveEnabled,
  setDriveEnabled,
  type AuthDeps
} from "./lib/drive-auth";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  popupText,
  type PopupLanguage
} from "./lib/i18n";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const connectButton = $<HTMLButtonElement>("connect");
const closeButton = $<HTMLButtonElement>("close");
const status = $("status");

const requestedLanguage = new URLSearchParams(location.search).get("lang");
const language: PopupLanguage = requestedLanguage === "zh-Hant" || requestedLanguage === "ja"
  ? requestedLanguage
  : DEFAULT_LANGUAGE;
document.documentElement.lang = language;

const EXTRA_COPY: Record<PopupLanguage, {
  title: string;
  checking: string;
  description: string;
  continue: string;
  close: string;
  privacy: string;
}> = {
  en: {
    title: "Connect Google Drive",
    checking: "Checking connection…",
    description: "Mai-Score stores one history document in your private Google Drive app data folder.",
    continue: "Continue with Google",
    close: "Return to Studio",
    privacy: "No Mai-Score account is created. Google Drive access is optional and can be revoked at any time."
  },
  "zh-Hant": {
    title: "連結 Google 雲端硬碟",
    checking: "正在檢查連線狀態…",
    description: "Mai-Score 只會在你私人的 Google 雲端硬碟應用程式資料夾中儲存一份歷史紀錄文件。",
    continue: "繼續使用 Google",
    close: "返回 Studio",
    privacy: "不會建立 Mai-Score 帳號。Google 雲端硬碟為選用功能，隨時可以取消連結。"
  },
  ja: {
    title: "Google ドライブと連携",
    checking: "接続状態を確認中…",
    description: "Mai-Score は、非公開の Google ドライブ アプリデータフォルダに履歴ファイルを 1 つだけ保存します。",
    continue: "Google で続行",
    close: "Studio に戻る",
    privacy: "Mai-Score アカウントは作成されません。Google ドライブ連携は任意で、いつでも解除できます。"
  }
};

const copy = EXTRA_COPY[language];
$("title").textContent = copy.title;
status.textContent = copy.checking;
$("description").textContent = copy.description;
$("account-hint").textContent = popupText(language, "driveAccountHint");
connectButton.textContent = copy.continue;
closeButton.textContent = copy.close;
$("privacy").textContent = copy.privacy;

const authDeps: AuthDeps = {
  identity: chrome.identity,
  fetch: globalThis.fetch,
  clearLastError: () => { void chrome.runtime.lastError; }
};

function renderConnected() {
  status.textContent = popupText(language, "driveConnectedDone");
  status.className = "status ok";
  connectButton.hidden = true;
  closeButton.hidden = false;
}

function renderDisconnected() {
  status.textContent = popupText(language, "driveDisconnected");
  status.className = "status";
  connectButton.hidden = false;
  closeButton.hidden = true;
}

connectButton.addEventListener("click", async () => {
  connectButton.disabled = true;
  status.textContent = popupText(language, "driveConnecting");
  status.className = "status";
  try {
    const outcome = await connectDrive(authDeps);
    if (outcome.ok) {
      await setDriveEnabled(chrome.storage.local, true);
      await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: language });
      renderConnected();
    } else {
      renderDisconnected();
      status.textContent = popupText(language, "driveCancelled");
    }
  } catch (error) {
    renderDisconnected();
    status.textContent = popupText(
      language,
      "driveFailed",
      error instanceof Error ? error.message : String(error)
    );
    status.className = "status error";
  } finally {
    connectButton.disabled = false;
  }
});

closeButton.addEventListener("click", () => {
  window.close();
});

void (async () => {
  if (!await driveEnabled(chrome.storage.local)) {
    renderDisconnected();
    return;
  }
  if (await driveConnection(authDeps) === "connected") renderConnected();
  else renderDisconnected();
})();
