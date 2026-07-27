export type PopupLanguage = "en" | "zh-Hant" | "ja";

export const DEFAULT_LANGUAGE: PopupLanguage = "en";
export const LANGUAGE_STORAGE_KEY = "maiScoreLanguage";

type Copy = Record<string, string | ((...values: Array<string | number>) => string)>;

const COPY: Record<PopupLanguage, Copy> = {
  en: {
    subtitle: "International B50 exporter",
    login: "Open maimai DX NET International and sign in first.",
    player: "Player",
    officialRating: "Official Rating",
    b50Total: "B50 total",
    resolved: "Resolved",
    collect: "Collect B50",
    studio: "Preview and customize online",
    directExport: "Direct export",
    quickPng: "Quick PNG (default style)",
    download: "Download",
    privacy: "Data is processed locally; Studio uses a single-use transfer token.",
    noTab: "The active tab could not be found.",
    openDxnet: "Open maimai DX NET International first.",
    unsupported: (label) => `${label} does not support automatic collection yet.`,
    fetching: "Collecting profile, frame, New B15, and Old B35…",
    collected: "Collection complete. You can open Studio.",
    unmatched: (label, count) => `${label}: ${count} charts could not be matched.`,
    preparingPng: "Preparing quick PNG…",
    pngReady: "Quick PNG is ready.",
    preparingAssets: "Preparing frame, icon, and song jackets…",
    studioOpened: (count) => `Studio opened with ${count} jackets.`,
    dxratingReady: "dxrating JSON is ready.",
    fullReady: "Mai-Score full JSON is ready.",
    rhythmReady: "Rhythm Record JSON is ready.",
    unknownFormat: "Unknown export format.",
    svgFailed: "SVG image decoding failed.",
    canvasFailed: "Could not create the image canvas.",
    pngFailed: "PNG encoding failed."
  },
  "zh-Hant": {
    subtitle: "國際版 B50 匯出工具",
    login: "請先開啟並登入 maimai DX NET 國際版。",
    player: "玩家",
    officialRating: "官方 Rating",
    b50Total: "B50 合計",
    resolved: "已解析",
    collect: "抓取 B50",
    studio: "在網頁預覽並調整",
    directExport: "直接匯出",
    quickPng: "快速 PNG（預設樣式）",
    download: "下載",
    privacy: "資料只在瀏覽器本機處理；Studio 使用一次性交換碼。",
    noTab: "找不到目前分頁。",
    openDxnet: "請先開啟 maimai DX NET 國際版。",
    unsupported: (label) => `${label} 尚未支援自動抓取。`,
    fetching: "正在抓取個人資料、frame、新曲 B15 與舊曲 B35…",
    collected: "抓取完成，可以開啟 Studio。",
    unmatched: (label, count) => `${label}：有 ${count} 首歌無法比對。`,
    preparingPng: "正在準備快速 PNG…",
    pngReady: "快速 PNG 已準備下載。",
    preparingAssets: "正在準備 frame、icon 與歌曲封面…",
    studioOpened: (count) => `Studio 已開啟，已帶入 ${count} 張封面。`,
    dxratingReady: "dxrating JSON 已準備下載。",
    fullReady: "Mai-Score 完整 JSON 已準備下載。",
    rhythmReady: "Rhythm Record JSON 已準備下載。",
    unknownFormat: "未知的匯出格式。",
    svgFailed: "SVG 圖像解碼失敗。",
    canvasFailed: "無法建立圖片畫布。",
    pngFailed: "PNG 編碼失敗。"
  },
  ja: {
    subtitle: "海外版 B50 エクスポーター",
    login: "maimai DX NET 海外版を開いてログインしてください。",
    player: "プレイヤー",
    officialRating: "公式 Rating",
    b50Total: "B50 合計",
    resolved: "解析済み",
    collect: "B50 を取得",
    studio: "オンラインでプレビュー・調整",
    directExport: "直接エクスポート",
    quickPng: "クイック PNG（標準スタイル）",
    download: "ダウンロード",
    privacy: "データはローカルで処理され、Studio は一度限りの転送コードを使用します。",
    noTab: "現在のタブが見つかりません。",
    openDxnet: "maimai DX NET 海外版を先に開いてください。",
    unsupported: (label) => `${label} は自動取得に未対応です。`,
    fetching: "プロフィール、フレーム、新曲 B15、旧曲 B35 を取得中…",
    collected: "取得完了。Studio を開けます。",
    unmatched: (label, count) => `${label}: ${count} 譜面を照合できませんでした。`,
    preparingPng: "クイック PNG を準備中…",
    pngReady: "クイック PNG の準備が完了しました。",
    preparingAssets: "フレーム、アイコン、ジャケットを準備中…",
    studioOpened: (count) => `Studio を開き、ジャケット ${count} 枚を転送しました。`,
    dxratingReady: "dxrating JSON の準備が完了しました。",
    fullReady: "Mai-Score 完全 JSON の準備が完了しました。",
    rhythmReady: "Rhythm Record JSON の準備が完了しました。",
    unknownFormat: "不明なエクスポート形式です。",
    svgFailed: "SVG 画像をデコードできませんでした。",
    canvasFailed: "画像キャンバスを作成できませんでした。",
    pngFailed: "PNG をエンコードできませんでした。"
  }
};

export function popupText(
  language: PopupLanguage,
  key: string,
  ...values: Array<string | number>
): string {
  const value = COPY[language]?.[key] ?? COPY.en[key] ?? key;
  return typeof value === "function" ? value(...values) : value;
}

export function intlLocale(language: PopupLanguage): string {
  return language === "zh-Hant" ? "zh-TW" : language === "ja" ? "ja-JP" : "en-US";
}
