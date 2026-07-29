# Chrome Web Store listing assets

Everything needed to submit Mai-Score, plus the answers the submission form asks
for. Nothing here is bundled into the extension.

## Screenshots

`screenshots/` holds three 1280×800 PNGs, the size the Web Store expects:

| File | Shows |
| --- | --- |
| `1-collect.png` | The popup after a successful collection |
| `2-studio.png` | The Studio editor with demo data loaded |
| `3-export.png` | The rendered Best 50 image |

They use Studio's built-in demo data — invented song titles and a placeholder
player name, no real account and no third-party cover art. Regenerate them after
a UI change; `2-studio.png` is a plain 1280×800 capture of Studio at `/`.

## Icon

The 128×128 store icon is `public/icons/icon128.png`, the same file the extension
ships. All four PNG sizes are rasterized from `public/icons/icon.svg`, which is
the source of truth — re-render them from it if the artwork changes.

## Listing copy

The framing to keep throughout: this is a tool for exporting **your own** profile
— a nicer version of the screenshot players already share. Players screenshot
their Best 50 and post it; this makes that image better. That is accurate, it is
what reviewers need to understand, and it keeps attention on user-initiated
export of the user's own data rather than on access to game data.

**Single purpose.** Mai-Score exports a player's own maimai DX NET International
Best 50 as an image or a JSON file.

### English (primary listing)

**Short description** (132 character limit):

> Turn your own maimai DX NET Best 50 into a clean, shareable image — one click, processed entirely in your browser.

**Detailed description**, opening — the part reviewers actually read closely:

> Mai-Score is a nicer way to share the Best 50 you already screenshot.
>
> When you click Collect B50, it reads the Best 50 page of the account you are
> already signed in to, and turns it into a high-resolution image you can post —
> with layout, theme, accent colour and an optional watermark. Nothing is
> collected until you click, nothing runs in the background, and your scores are
> processed in your browser.

**Disclaimer**, as the closing line. One sentence; a long legal notice reads as
defensive:

> Mai-Score is an unofficial community project and is not affiliated with,
> endorsed by, or sponsored by SEGA.

### 繁體中文

> 一鍵將你自己的 maimai DX NET Best 50 轉成適合分享的圖片，全程在瀏覽器內處理。

> Mai-Score 讓你原本就在截圖分享的 Best 50 變得更好看。
>
> 按下「Collect B50」後，它會讀取你已登入帳號的 Best 50 頁面，轉成可直接發佈的
> 高解析度圖片，並可調整版面、主題、強調色與浮水印。在你按下之前不會收集任何
> 資料，不會在背景執行，成績都在你的瀏覽器內處理。

> Mai-Score 為非官方社群專案，與 SEGA 無任何隸屬、認可或贊助關係。

### 日本語

> maimai DX NET の自分のベスト50を、ワンクリックで共有しやすい画像に。処理はすべてブラウザ内で完結します。

> Mai-Score は、すでにスクリーンショットで共有しているベスト50を、もっときれいに共有するための拡張機能です。
>
> 「Collect B50」を押すと、すでにログインしているアカウントのベスト50ページを
> 読み取り、投稿できる高解像度の画像に変換します。レイアウト、テーマ、アクセント
> カラー、ウォーターマークを調整できます。クリックするまで何も収集せず、
> バックグラウンドでは動作せず、スコアはブラウザ内で処理されます。

> Mai-Score は非公式のコミュニティプロジェクトです。株式会社セガとの提携・承認・後援関係はありません。

### Wording to avoid

These push attention toward the least defensible reading of what the extension
does:

| Avoid | Use instead |
| --- | --- |
| scrape, crawler, bot | reads your own score page |
| automatically, in the background | when you click |
| database of songs, all charts | your Best 50 |
| unlock, bypass, full access | export, save a copy |

Also leave the bundled chart database out of the listing. It is an
implementation detail, and describing it invites the idea that the extension
redistributes game data. What users want to read is that their Best 50 comes out
looking good.

**Naming.** "Mai-Score" is an invented compound and is fine. Naming "maimai DX
NET" in the description is nominative use — stating what the extension works
with — which is also fine. The line to hold is describing compatibility without
implying origin: keep the icon, name, and promotional art clear of official
colours and logotype. The current blue/violet gradient is already well away from
it.

**Permission justifications:**

| Permission | Why |
| --- | --- |
| `storage` | Save the language preference, and hand collected data to Studio under a single-use session token. |
| `downloads` | Write the PNG, SVG, or JSON file the user asked to export. |
| `identity` | Ask for Google consent only when the user explicitly connects Drive history sync, obtain a scoped token, and revoke it on disconnect. |
| `maimaidx-eng.com` | Read the user's own Best 50 pages (International) — the data being exported. |
| `maimaidx.jp` | Same, for players signed in to the Japan-domestic site instead. |
| `shama.dxrating.net` | Fetch song cover art so exported images include it. |
| `www.googleapis.com` | Read and update Mai-Score's single history document inside the user's private Drive `appDataFolder`. |
| `oauth2.googleapis.com` | Revoke the Google grant when the user chooses Disconnect. |

**Remote code:** none. Everything executed by the extension ships in the package.

**Data use.** Declare that scores are read and handled locally by default and are never sold. If the user explicitly enables Google Drive sync, history is transferred only to that user's hidden Drive `appDataFolder` under the `drive.appdata` scope; Mai-Score does not operate a score database. Disconnect revokes access; the separate, confirmed **Delete cloud history** action permanently removes the synced app-data file without deleting local history. The other server-side detail worth disclosing accurately:
when a JSON file is loaded into Studio manually, cover images are proxied through
`/api/asset`, so the server sees which covers were requested along with normal
request logs. Collected data never reaches the server on the extension path.

**Privacy policy URL:** `https://mai-score.milifix.com/privacy`

## Before submitting

- [ ] Register the developer account (one-time US$5 fee)
- [ ] Confirm the privacy policy URL is live and reachable
- [ ] State in the description that this is unofficial and not affiliated with SEGA
- [ ] Fill in every permission justification above
- [ ] Publish unlisted first, then switch to public once the listing reads right
- [ ] Add the 繁體中文 and 日本語 listings — the extension is already trilingual
- [ ] Test Collect against a real, logged-in maimaidx.jp account before relying on the JP adapter — it mirrors the international parser's assumptions but has never run against the live domestic site
- [ ] Test Drive create, pull, merge, update, disconnect, and reauthorization against Google's real API
- [ ] Publish the Drive-aware privacy policy before distributing a Drive-enabled build
- [ ] Register the Web Store extension ID with its own production OAuth client
- [ ] Complete Google's verification for the sensitive `drive.appdata` scope
- [x] Add a separately confirmed cloud-history deletion control that leaves local history intact

Reading DX NET may sit uneasily with SEGA's terms of service, and reviewers do
sometimes weigh third-party terms. That risk does not go away, but the copy
above is written to keep the listing on the defensible ground: a player
exporting their own profile, on their own action, in their own browser. Publish
unlisted first so a misjudged description costs a rejection email rather than a
public record.
