import type { LanguageId } from "./types";

export interface StudioCopy {
  subtitle: string;
  emptySource: string;
  emptyMessage: string;
  emptyPreview: string;
  loadJson: string;
  exportStyle: string;
  reset: string;
  language: string;
  layout: string;
  theme: string;
  timestamp: string;
  timezone: string;
  accent: string;
  outputFormat: string;
  watermark: string;
  watermarkPlaceholder: string;
  displayContent: string;
  frame: string;
  icon: string;
  covers: string;
  officialRating: string;
  breakdown: string;
  achievement: string;
  chartRating: string;
  level: string;
  rank: string;
  download: string;
  processing: string;
  copyStyle: string;
  clearLocalData: string;
  clearConfirm: string;
  privacy: string;
  privacyLink: string;
  share: string;
  shared: string;
  history: string;
  syncHeading: string;
  driveChecking: string;
  driveConnected: string;
  driveDisconnected: string;
  driveUnavailable: string;
  driveAccountHint: string;
  driveConnect: string;
  driveConnecting: string;
  drivePopupBlocked: string;
  driveDisconnect: string;
  driveDisconnecting: string;
  driveAuthOpened: string;
  driveConnectedDone: string;
  driveDisconnectedDone: string;
  driveDisconnectWarning: (error: string) => string;
  syncNow: string;
  syncing: string;
  deleteCloudHistory: string;
  deletingCloudHistory: string;
  deleteCloudConfirm: string;
  cloudDeleted: string;
  cloudAlreadyEmpty: string;
  syncedAt: (count: number) => string;
  syncNeedsAuth: string;
  syncNoExtension: string;
  syncFailed: (error: string) => string;
  syncSkipped: (count: number) => string;
  historyEmpty: string;
  historyEntered: (count: number) => string;
  historyLeft: (count: number) => string;
  historyImproved: (count: number) => string;
  livePreview: string;
  off: string;
  date: string;
  dateTime: string;
  local: string;
  loadingFile: (name: string) => string;
  loadedFile: (name: string, records: number, covers: number) => string;
  transferred: (name: string, records: number, covers: number, profileAssets: number) => string;
  restored: (name: string, savedAt: string) => string;
  localDataCleared: string;
  localSaveFailed: string;
  receiving: string;
  ready: (name: string, records: number) => string;
  extensionUnavailable: string;
  transferTimedOut: string;
  transferEmpty: string;
  transferFailedRestored: (error: string, name: string, savedAt: string) => string;
  downloadReady: (format: string) => string;
  styleCopied: string;
}

const COPY: Record<LanguageId, StudioCopy> = {
  en: {
    subtitle: "B50 image preview",
    emptySource: "No data",
    emptyMessage: "No B50 loaded. Open Studio from Mai-Score or load a full JSON file.",
    emptyPreview: "Load B50 data to preview an export.",
    loadJson: "Load JSON",
    exportStyle: "Export style",
    reset: "Reset",
    language: "Language",
    layout: "Layout",
    theme: "Theme",
    timestamp: "Timestamp",
    timezone: "Time zone",
    accent: "Accent",
    outputFormat: "Format",
    watermark: "Watermark",
    watermarkPlaceholder: "@username / event",
    displayContent: "Visible content",
    frame: "Frame",
    icon: "Icon",
    covers: "Song jackets",
    officialRating: "Official Rating",
    breakdown: "New B15 / Old B35",
    achievement: "Achievement",
    chartRating: "Chart Rating",
    level: "Chart level",
    rank: "B15 / B35 rank",
    download: "Download",
    processing: "Processing…",
    copyStyle: "Copy style link",
    clearLocalData: "Clear local B50 and history",
    clearConfirm: "Remove the saved B50, images, and all local history from this browser?",
    privacy: "B50 data stays in this browser by default. Optional Drive sync stores history in your own Google account.",
    privacyLink: "Privacy policy",
    share: "Share image",
    shared: "Shared.",
    history: "History",
    syncHeading: "Google Drive",
    driveChecking: "Checking…",
    driveConnected: "Connected",
    driveDisconnected: "Not connected",
    driveUnavailable: "Extension not linked",
    driveAccountHint: "Uses the Google account for this Chrome profile. Switch Chrome profiles before connecting to use a different account.",
    driveConnect: "Connect Google Drive",
    driveConnecting: "Opening Google authorization…",
    drivePopupBlocked: "The Google authorization window was blocked. Allow pop-ups for this site and try again.",
    driveDisconnect: "Disconnect",
    driveDisconnecting: "Disconnecting…",
    driveAuthOpened: "Complete Google authorization in the Mai-Score window, then return here.",
    driveConnectedDone: "Google Drive is connected. History sync is available.",
    driveDisconnectedDone: "Google Drive was disconnected. Local history was not changed.",
    driveDisconnectWarning: (error) => `Disconnected locally, but Google could not confirm revocation: ${error}`,
    syncNow: "Sync history",
    syncing: "Syncing…",
    deleteCloudHistory: "Delete cloud history",
    deletingCloudHistory: "Deleting cloud history…",
    deleteCloudConfirm: "Permanently delete the synced Mai-Score history from Google Drive? Local browser history will remain.",
    cloudDeleted: "Cloud history was permanently deleted. Local history was not changed.",
    cloudAlreadyEmpty: "No cloud history file was found. Local history was not changed.",
    syncedAt: (count) => `Synced. ${count} collection(s) in history.`,
    syncNeedsAuth: "Choose Connect Google Drive here, complete authorization, then sync again.",
    syncNoExtension: "Install or enable the latest Mai-Score extension in this Chrome profile.",
    syncFailed: (error) => `Sync failed: ${error}`,
    syncSkipped: (count) => `${count} unreadable entr(ies) in the synced file were ignored.`,
    historyEmpty: "No history yet. Collect again later to see what changed.",
    historyEntered: (count) => `${count} new`,
    historyLeft: (count) => `${count} dropped`,
    historyImproved: (count) => `${count} improved`,
    livePreview: "Live preview",
    off: "Off",
    date: "Date",
    dateTime: "Date + time",
    local: "Local",
    loadingFile: (name) => `Loaded ${name}; preparing public song jackets…`,
    loadedFile: (name, records, covers) => `Loaded ${name}: ${records} records and ${covers} jackets.`,
    transferred: (name, records, covers, profileAssets) =>
      `Loaded ${name}: ${records} B50 records, ${covers} jackets, and ${profileAssets}/2 profile images. Saved in this browser.`,
    restored: (name, savedAt) => `Restored ${name} from this browser · saved ${savedAt}.`,
    localDataCleared: "Saved B50 data, images, and local history were removed from this browser.",
    localSaveFailed: "The preview is ready, but this browser could not save it for later.",
    receiving: "Receiving B50 from the Mai-Score extension…",
    ready: (name, records) => `${name}: ${records} B50 records are ready.`,
    extensionUnavailable: "Could not connect to Mai-Score. Reload the latest extension.",
    transferTimedOut: "Transfer timed out. Open Studio again from the extension.",
    transferEmpty: "The extension returned no B50 data.",
    transferFailedRestored: (error, name, savedAt) => `Could not receive the new B50 (${error}). Restored ${name} from this browser · saved ${savedAt}.`,
    downloadReady: (format) => `${format} is ready to download.`,
    styleCopied: "Style link copied. It does not include player or score data."
  },
  "zh-Hant": {
    subtitle: "B50 圖片預覽",
    emptySource: "尚無資料",
    emptyMessage: "尚未載入 B50。請從 Mai-Score 開啟 Studio，或載入完整 JSON。",
    emptyPreview: "載入 B50 資料後即可預覽匯出圖片。",
    loadJson: "載入 JSON",
    exportStyle: "匯出樣式",
    reset: "重設",
    language: "語言",
    layout: "排版",
    theme: "主題",
    timestamp: "時間戳記",
    timezone: "時區",
    accent: "強調色",
    outputFormat: "輸出格式",
    watermark: "浮水印",
    watermarkPlaceholder: "@使用者名稱 / 活動",
    displayContent: "顯示內容",
    frame: "Frame",
    icon: "Icon",
    covers: "歌曲封面",
    officialRating: "官方 Rating",
    breakdown: "新曲 B15 / 舊曲 B35",
    achievement: "達成率",
    chartRating: "單曲 Rating",
    level: "譜面等級",
    rank: "B15 / B35 排名",
    download: "下載",
    processing: "處理中…",
    copyStyle: "複製目前樣式連結",
    clearLocalData: "清除本機 B50 與歷史紀錄",
    clearConfirm: "要從此瀏覽器移除已儲存的 B50、圖片與所有本機歷史紀錄嗎？",
    privacy: "B50 預設只留在此瀏覽器；啟用同步後，歷史紀錄會存入你自己的 Google 帳號。",
    privacyLink: "隱私權政策",
    share: "分享圖片",
    shared: "已分享。",
    history: "歷史紀錄",
    syncHeading: "Google 雲端硬碟",
    driveChecking: "檢查中…",
    driveConnected: "已連結",
    driveDisconnected: "尚未連結",
    driveUnavailable: "尚未連接擴充功能",
    driveAccountHint: "使用目前 Chrome 個人檔案的 Google 帳號；若要使用其他帳號，請先切換 Chrome 個人檔案再連結。",
    driveConnect: "連結 Google 雲端硬碟",
    driveConnecting: "正在開啟 Google 授權…",
    drivePopupBlocked: "Google 授權視窗遭到封鎖。請允許此網站開啟彈出式視窗後再試一次。",
    driveDisconnect: "取消連結",
    driveDisconnecting: "正在取消連結…",
    driveAuthOpened: "請在 Mai-Score 授權視窗完成 Google 授權，再回到此頁。",
    driveConnectedDone: "Google 雲端硬碟已連結，可以同步歷史紀錄。",
    driveDisconnectedDone: "已取消 Google 雲端硬碟連結，本機歷史紀錄沒有變更。",
    driveDisconnectWarning: (error) => `已清除本機連結，但 Google 無法確認撤銷授權：${error}`,
    syncNow: "同步歷史紀錄",
    syncing: "同步中…",
    deleteCloudHistory: "刪除雲端歷史紀錄",
    deletingCloudHistory: "正在刪除雲端歷史紀錄…",
    deleteCloudConfirm: "要永久刪除 Google 雲端硬碟中的 Mai-Score 同步歷史嗎？此瀏覽器的本機歷史不會被刪除。",
    cloudDeleted: "已永久刪除雲端歷史紀錄，本機歷史沒有變更。",
    cloudAlreadyEmpty: "找不到雲端歷史檔案，本機歷史沒有變更。",
    syncedAt: (count) => `已同步，歷史共 ${count} 筆收集紀錄。`,
    syncNeedsAuth: "請在此按「連結 Google 雲端硬碟」、完成授權，再重新同步。",
    syncNoExtension: "請在目前的 Chrome 個人檔案安裝或啟用最新版 Mai-Score 擴充功能。",
    syncFailed: (error) => `同步失敗：${error}`,
    syncSkipped: (count) => `同步檔案中有 ${count} 筆無法讀取的紀錄已略過。`,
    historyEmpty: "尚無歷史紀錄。之後再收集一次就能看到變化。",
    historyEntered: (count) => `新進 ${count}`,
    historyLeft: (count) => `掉出 ${count}`,
    historyImproved: (count) => `進步 ${count}`,
    livePreview: "即時預覽",
    off: "關閉",
    date: "日期",
    dateTime: "日期＋時間",
    local: "本機",
    loadingFile: (name) => `已載入 ${name}，正在準備公開歌曲封面…`,
    loadedFile: (name, records, covers) => `已載入 ${name}：${records} 筆記錄與 ${covers} 張封面。`,
    transferred: (name, records, covers, profileAssets) =>
      `已載入 ${name}：${records} 筆 B50、${covers} 張封面與 ${profileAssets}/2 項玩家圖片；已儲存在此瀏覽器。`,
    restored: (name, savedAt) => `已從此瀏覽器還原 ${name} · 儲存時間 ${savedAt}。`,
    localDataCleared: "已從此瀏覽器清除 B50、圖片與本機歷史紀錄。",
    localSaveFailed: "預覽已完成，但此瀏覽器無法保留資料供下次使用。",
    receiving: "正在從 Mai-Score 擴充功能接收 B50…",
    ready: (name, records) => `${name}：${records} 筆 B50 已可使用。`,
    extensionUnavailable: "無法連接 Mai-Score，請重新載入最新版擴充功能。",
    transferTimedOut: "資料傳輸逾時，請回到擴充功能重新開啟 Studio。",
    transferEmpty: "擴充功能沒有傳回 B50 資料。",
    transferFailedRestored: (error, name, savedAt) => `無法接收新的 B50（${error}）。已從此瀏覽器還原 ${name} · 儲存時間 ${savedAt}。`,
    downloadReady: (format) => `${format} 已準備下載。`,
    styleCopied: "樣式連結已複製；不包含玩家或成績資料。"
  },
  ja: {
    subtitle: "B50 画像プレビュー",
    emptySource: "データなし",
    emptyMessage: "B50 はまだ読み込まれていません。Mai-Score から Studio を開くか、完全 JSON を読み込んでください。",
    emptyPreview: "B50 データを読み込むと書き出し画像をプレビューできます。",
    loadJson: "JSON を読み込む",
    exportStyle: "書き出しスタイル",
    reset: "リセット",
    language: "言語",
    layout: "レイアウト",
    theme: "テーマ",
    timestamp: "タイムスタンプ",
    timezone: "タイムゾーン",
    accent: "アクセント",
    outputFormat: "形式",
    watermark: "透かし",
    watermarkPlaceholder: "@ユーザー名 / イベント",
    displayContent: "表示項目",
    frame: "フレーム",
    icon: "アイコン",
    covers: "ジャケット",
    officialRating: "公式 Rating",
    breakdown: "新曲 B15 / 旧曲 B35",
    achievement: "達成率",
    chartRating: "譜面 Rating",
    level: "譜面レベル",
    rank: "B15 / B35 順位",
    download: "ダウンロード",
    processing: "処理中…",
    copyStyle: "スタイルリンクをコピー",
    clearLocalData: "ローカル B50 と履歴を消去",
    clearConfirm: "このブラウザに保存した B50、画像、すべてのローカル履歴を削除しますか？",
    privacy: "B50 は通常このブラウザ内に保存されます。同期を有効にすると、履歴は自分の Google アカウントに保存されます。",
    privacyLink: "プライバシーポリシー",
    share: "画像を共有",
    shared: "共有しました。",
    history: "履歴",
    syncHeading: "Google ドライブ",
    driveChecking: "確認中…",
    driveConnected: "連携済み",
    driveDisconnected: "未連携",
    driveUnavailable: "拡張機能と未接続",
    driveAccountHint: "現在の Chrome プロフィールの Google アカウントを使用します。別のアカウントを使う場合は、連携前に Chrome プロフィールを切り替えてください。",
    driveConnect: "Google ドライブと連携",
    driveConnecting: "Google 認証を開いています…",
    drivePopupBlocked: "Google 認証ウィンドウがブロックされました。このサイトのポップアップを許可して、もう一度お試しください。",
    driveDisconnect: "連携を解除",
    driveDisconnecting: "連携を解除中…",
    driveAuthOpened: "Mai-Score の認証ウィンドウで Google 認証を完了し、このページに戻ってください。",
    driveConnectedDone: "Google ドライブと連携しました。履歴を同期できます。",
    driveDisconnectedDone: "Google ドライブとの連携を解除しました。ローカル履歴は変更されていません。",
    driveDisconnectWarning: (error) => `ローカル連携は解除しましたが、Google で認証の取り消しを確認できませんでした：${error}`,
    syncNow: "履歴を同期",
    syncing: "同期中…",
    deleteCloudHistory: "クラウド履歴を削除",
    deletingCloudHistory: "クラウド履歴を削除中…",
    deleteCloudConfirm: "Google ドライブ上の Mai-Score 同期履歴を完全に削除しますか？このブラウザのローカル履歴は削除されません。",
    cloudDeleted: "クラウド履歴を完全に削除しました。ローカル履歴は変更されていません。",
    cloudAlreadyEmpty: "クラウド履歴ファイルは見つかりませんでした。ローカル履歴は変更されていません。",
    syncedAt: (count) => `同期しました。履歴は ${count} 件です。`,
    syncNeedsAuth: "ここで「Google ドライブと連携」を選び、認証を完了してからもう一度同期してください。",
    syncNoExtension: "現在の Chrome プロフィールに最新版 Mai-Score 拡張機能をインストールまたは有効化してください。",
    syncFailed: (error) => `同期に失敗しました：${error}`,
    syncSkipped: (count) => `同期ファイル内の読み取れない ${count} 件は無視しました。`,
    historyEmpty: "履歴はまだありません。次回の取得から変化を確認できます。",
    historyEntered: (count) => `新規 ${count}`,
    historyLeft: (count) => `圏外 ${count}`,
    historyImproved: (count) => `更新 ${count}`,
    livePreview: "ライブプレビュー",
    off: "オフ",
    date: "日付",
    dateTime: "日付＋時刻",
    local: "ローカル",
    loadingFile: (name) => `${name} を読み込みました。公開ジャケットを準備中…`,
    loadedFile: (name, records, covers) => `${name}: ${records} 件、ジャケット ${covers} 枚を読み込みました。`,
    transferred: (name, records, covers, profileAssets) =>
      `${name}: B50 ${records} 件、ジャケット ${covers} 枚、プロフィール画像 ${profileAssets}/2 を読み込み、このブラウザに保存しました。`,
    restored: (name, savedAt) => `${name} をこのブラウザから復元しました · 保存日時 ${savedAt}。`,
    localDataCleared: "このブラウザから B50、画像、ローカル履歴を削除しました。",
    localSaveFailed: "プレビューは利用できますが、このブラウザに保存できませんでした。",
    receiving: "Mai-Score 拡張機能から B50 を受信中…",
    ready: (name, records) => `${name}: B50 ${records} 件を利用できます。`,
    extensionUnavailable: "Mai-Score に接続できません。最新版の拡張機能を再読み込みしてください。",
    transferTimedOut: "転送がタイムアウトしました。拡張機能から Studio をもう一度開いてください。",
    transferEmpty: "拡張機能から B50 データが返されませんでした。",
    transferFailedRestored: (error, name, savedAt) => `新しい B50 を受信できませんでした（${error}）。${name} をこのブラウザから復元しました · 保存日時 ${savedAt}。`,
    downloadReady: (format) => `${format} のダウンロード準備が完了しました。`,
    styleCopied: "スタイルリンクをコピーしました。プレイヤー・スコアデータは含まれません。"
  }
};

export const studioCopy = (language: LanguageId): StudioCopy => COPY[language] ?? COPY.en;
