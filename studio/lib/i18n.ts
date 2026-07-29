import type { LanguageId } from "./types";

export interface StudioCopy {
  subtitle: string;
  demo: string;
  demoSource: string;
  demoMessage: string;
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
  downloadReady: (format: string) => string;
  styleCopied: string;
}

const COPY: Record<LanguageId, StudioCopy> = {
  en: {
    subtitle: "B50 image preview",
    demo: "Demo",
    demoSource: "Demo data",
    demoMessage: "Showing demo data. Import from the extension or load a full JSON file.",
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
    clearLocalData: "Clear local B50 data",
    clearConfirm: "Remove the saved B50 and images from this browser?",
    privacy: "B50 data stays in this browser by default. Optional Drive sync stores history in your own Google account.",
    privacyLink: "Privacy policy",
    share: "Share image",
    shared: "Shared.",
    history: "History",
    syncHeading: "Google Drive",
    syncNow: "Sync history",
    syncing: "Syncing…",
    deleteCloudHistory: "Delete cloud history",
    deletingCloudHistory: "Deleting cloud history…",
    deleteCloudConfirm: "Permanently delete the synced Mai-Score history from Google Drive? Local browser history will remain.",
    cloudDeleted: "Cloud history was permanently deleted. Local history was not changed.",
    cloudAlreadyEmpty: "No cloud history file was found. Local history was not changed.",
    syncedAt: (count) => `Synced. ${count} collection(s) in history.`,
    syncNeedsAuth: "Open the Mai-Score popup and allow Google Drive access, then sync again.",
    syncNoExtension: "Open Studio from the Mai-Score extension once, so it can connect.",
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
    localDataCleared: "Saved B50 data and images were removed from this browser.",
    localSaveFailed: "The preview is ready, but this browser could not save it for later.",
    receiving: "Receiving B50 from the Mai-Score extension…",
    downloadReady: (format) => `${format} is ready to download.`,
    styleCopied: "Style link copied. It does not include player or score data."
  },
  "zh-Hant": {
    subtitle: "B50 圖片預覽",
    demo: "示範",
    demoSource: "示範資料",
    demoMessage: "目前使用示範資料。可從擴充功能直接帶入，或載入完整 JSON。",
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
    clearLocalData: "清除本機 B50 資料",
    clearConfirm: "要從此瀏覽器移除已儲存的 B50 與圖片嗎？",
    privacy: "B50 預設只留在此瀏覽器；啟用同步後，歷史紀錄會存入你自己的 Google 帳號。",
    privacyLink: "隱私權政策",
    share: "分享圖片",
    shared: "已分享。",
    history: "歷史紀錄",
    syncHeading: "Google 雲端硬碟",
    syncNow: "同步歷史紀錄",
    syncing: "同步中…",
    deleteCloudHistory: "刪除雲端歷史紀錄",
    deletingCloudHistory: "正在刪除雲端歷史紀錄…",
    deleteCloudConfirm: "要永久刪除 Google 雲端硬碟中的 Mai-Score 同步歷史嗎？此瀏覽器的本機歷史不會被刪除。",
    cloudDeleted: "已永久刪除雲端歷史紀錄，本機歷史沒有變更。",
    cloudAlreadyEmpty: "找不到雲端歷史檔案，本機歷史沒有變更。",
    syncedAt: (count) => `已同步，歷史共 ${count} 筆收集紀錄。`,
    syncNeedsAuth: "請開啟 Mai-Score 彈出視窗並允許 Google 雲端硬碟存取，然後再同步一次。",
    syncNoExtension: "請先從 Mai-Score 擴充功能開啟一次 Studio，才能建立連線。",
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
    localDataCleared: "已從此瀏覽器清除 B50 與圖片。",
    localSaveFailed: "預覽已完成，但此瀏覽器無法保留資料供下次使用。",
    receiving: "正在從 Mai-Score 擴充功能接收 B50…",
    downloadReady: (format) => `${format} 已準備下載。`,
    styleCopied: "樣式連結已複製；不包含玩家或成績資料。"
  },
  ja: {
    subtitle: "B50 画像プレビュー",
    demo: "デモ",
    demoSource: "デモデータ",
    demoMessage: "デモデータを表示中です。拡張機能または完全 JSON から読み込めます。",
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
    clearLocalData: "ローカル B50 データを消去",
    clearConfirm: "このブラウザに保存した B50 と画像を削除しますか？",
    privacy: "B50 は通常このブラウザ内に保存されます。同期を有効にすると、履歴は自分の Google アカウントに保存されます。",
    privacyLink: "プライバシーポリシー",
    share: "画像を共有",
    shared: "共有しました。",
    history: "履歴",
    syncHeading: "Google ドライブ",
    syncNow: "履歴を同期",
    syncing: "同期中…",
    deleteCloudHistory: "クラウド履歴を削除",
    deletingCloudHistory: "クラウド履歴を削除中…",
    deleteCloudConfirm: "Google ドライブ上の Mai-Score 同期履歴を完全に削除しますか？このブラウザのローカル履歴は削除されません。",
    cloudDeleted: "クラウド履歴を完全に削除しました。ローカル履歴は変更されていません。",
    cloudAlreadyEmpty: "クラウド履歴ファイルは見つかりませんでした。ローカル履歴は変更されていません。",
    syncedAt: (count) => `同期しました。履歴は ${count} 件です。`,
    syncNeedsAuth: "Mai-Score のポップアップを開いて Google ドライブへのアクセスを許可してから、もう一度同期してください。",
    syncNoExtension: "先に Mai-Score 拡張機能から Studio を一度開いてください。",
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
    localDataCleared: "このブラウザから B50 と画像を削除しました。",
    localSaveFailed: "プレビューは利用できますが、このブラウザに保存できませんでした。",
    receiving: "Mai-Score 拡張機能から B50 を受信中…",
    downloadReady: (format) => `${format} のダウンロード準備が完了しました。`,
    styleCopied: "スタイルリンクをコピーしました。プレイヤー・スコアデータは含まれません。"
  }
};

export const studioCopy = (language: LanguageId): StudioCopy => COPY[language] ?? COPY.en;
