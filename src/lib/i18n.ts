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
    fetchProgress: (done, total) => `Fetching DX NET pages… (${done}/${total})`,
    matchingCharts: "Matching charts against the local chart database…",
    fetchFailed: (label) => `Could not read ${label}: the DX NET request failed.`,
    fetchBadStatus: (label, status) => `Could not read ${label}: DX NET returned ${status}.`,
    fetchTimeout: (label) => `Could not read ${label}: DX NET did not respond within 20 seconds. Its servers may be slow or down right now.`,
    labelProfile: "player profile",
    labelB50: "the B50 target list",
    labelFrame: "the frame",
    collected: "Collection complete. You can open Studio.",
    unmatched: (label, count) => `${label}: ${count} charts could not be matched.`,
    unexpectedTargetCounts: (b15, b35) => `Expected 15 new and 35 old rating targets, found ${b15} and ${b35}. DX NET may have changed its page layout.`,
    resolverNoResponse: "The chart database service did not respond. Please reload the extension.",
    ratingGap: (delta, unresolved) => unresolved
      ? `B50 is ${delta} vs the official rating — ${unresolved} chart(s) could not be matched, so they count as 0.`
      : `B50 is ${delta} vs the official rating. The local chart database may be out of date; run npm run sync-data.`,
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
    fetchProgress: (done, total) => `正在抓取 DX NET 頁面…（${done}/${total}）`,
    matchingCharts: "正在比對本機譜面資料庫…",
    fetchFailed: (label) => `無法讀取${label}：DX NET 網路請求失敗。`,
    fetchBadStatus: (label, status) => `無法讀取${label}：DX NET 回傳 ${status}。`,
    fetchTimeout: (label) => `無法讀取${label}：DX NET 在 20 秒內沒有回應，SEGA 伺服器可能較慢或暫時異常。`,
    labelProfile: "玩家資料",
    labelB50: "B50 目標清單",
    labelFrame: "frame",
    collected: "抓取完成，可以開啟 Studio。",
    unmatched: (label, count) => `${label}：有 ${count} 首歌無法比對。`,
    unexpectedTargetCounts: (b15, b35) => `預期新曲 15 首、舊曲 35 首，實際找到 ${b15} 首與 ${b35} 首。DX NET 的頁面版面可能已變更。`,
    resolverNoResponse: "譜面資料服務沒有回應，請重新載入擴充功能。",
    ratingGap: (delta, unresolved) => unresolved
      ? `B50 與官方 rating 相差 ${delta} —— 有 ${unresolved} 首無法比對，以 0 計算。`
      : `B50 與官方 rating 相差 ${delta}。本機譜面資料庫可能已過期，請執行 npm run sync-data。`,
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
    fetchProgress: (done, total) => `DX NET のページを取得中…（${done}/${total}）`,
    matchingCharts: "ローカルの譜面データベースと照合中…",
    fetchFailed: (label) => `${label}を読み込めませんでした：DX NET への通信に失敗しました。`,
    fetchBadStatus: (label, status) => `${label}を読み込めませんでした：DX NET が ${status} を返しました。`,
    fetchTimeout: (label) => `${label}を読み込めませんでした：DX NET が 20 秒以内に応答しませんでした。SEGA サーバーが混雑しているか、停止している可能性があります。`,
    labelProfile: "プロフィール",
    labelB50: "B50 対象曲リスト",
    labelFrame: "フレーム",
    collected: "取得完了。Studio を開けます。",
    unmatched: (label, count) => `${label}: ${count} 譜面を照合できませんでした。`,
    unexpectedTargetCounts: (b15, b35) => `新曲 15 件・旧曲 35 件を想定していましたが、${b15} 件・${b35} 件でした。DX NET のページ構成が変更された可能性があります。`,
    resolverNoResponse: "譜面データベースサービスから応答がありません。拡張機能を再読み込みしてください。",
    ratingGap: (delta, unresolved) => unresolved
      ? `B50 と公式レートの差は ${delta} です。${unresolved} 譜面が照合できず 0 として計算されています。`
      : `B50 と公式レートの差は ${delta} です。ローカル譜面データベースが古い可能性があります（npm run sync-data）。`,
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
