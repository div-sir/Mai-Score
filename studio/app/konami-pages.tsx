"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { KonamiPageSnapshot } from "../lib/konami-page";
import type { LanguageId } from "../lib/types";

const gameLabel = (game: KonamiPageSnapshot["source"]["game"]) => game === "beatmania-iidx"
  ? "beatmania IIDX" : game === "sound-voltex" ? "SOUND VOLTEX" : "DanceDanceRevolution";

export default function KonamiPagesDashboard({ data, language }: { data: KonamiPageSnapshot; language: LanguageId }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const text = language === "zh-Hant" ? {
    source: "免費頁面直接收集", pages: "可讀頁面", fields: "欄位", tables: "表格", restricted: "受限頁面",
    search: "搜尋頁面、欄位或內容", paid: "需要付費方案", login: "需要登入", failed: "讀取失敗", collected: "已收集",
    noData: "這個頁面沒有可整理的結構化內容。", raw: "其他可見內容", open: "開啟官方頁面"
  } : language === "ja" ? {
    source: "無料ページから直接収集", pages: "取得ページ", fields: "項目", tables: "表", restricted: "制限ページ",
    search: "ページ・項目・内容を検索", paid: "有料コースが必要", login: "ログインが必要", failed: "取得失敗", collected: "取得済み",
    noData: "整理できる構造化データはありません。", raw: "その他の表示内容", open: "公式ページを開く"
  } : {
    source: "Direct free-page collection", pages: "Readable pages", fields: "Fields", tables: "Tables", restricted: "Restricted pages",
    search: "Search pages, fields, or visible text", paid: "Paid plan required", login: "Sign-in required", failed: "Could not read", collected: "Collected",
    noData: "No structured content was available on this page.", raw: "Other visible content", open: "Open official page"
  };
  const pages = useMemo(() => {
    const wanted = deferredQuery.trim().toLocaleLowerCase();
    if (!wanted) return data.pages;
    return data.pages.filter((page) => JSON.stringify(page).toLocaleLowerCase().includes(wanted));
  }, [data.pages, deferredQuery]);
  const restricted = data.summary.paid + data.summary.signInRequired;
  return <section className="konami-pages-dashboard">
    <header className="konami-pages-hero">
      <div><span>KONAMI / e-amusement</span><h1>{gameLabel(data.source.game)}</h1><p>{text.source} · {new Date(data.generatedAt).toLocaleString(language)}</p></div>
      <div className="konami-pages-metrics">
        <div><strong>{data.summary.collected}</strong><span>{text.pages}</span></div>
        <div><strong>{data.summary.fields}</strong><span>{text.fields}</span></div>
        <div><strong>{data.summary.tables}</strong><span>{text.tables}</span></div>
        <div className={restricted ? "restricted" : ""}><strong>{restricted}</strong><span>{text.restricted}</span></div>
      </div>
    </header>
    <input className="konami-pages-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} />
    <div className="konami-pages-list">
      {pages.map((page) => <details key={page.url} className={`konami-page-card ${page.access}`} open={page.access === "collected" && pages.length <= 5}>
        <summary>
          <div><strong>{page.title}</strong><small>{page.headings[0] || new URL(page.url).pathname}</small></div>
          <span>{page.access === "paid" ? text.paid : page.access === "sign-in-required" ? text.login : page.access === "failed" ? text.failed : text.collected}</span>
        </summary>
        <div className="konami-page-body">
          <a href={page.url} target="_blank" rel="noreferrer">{text.open}</a>
          {page.error ? <p className="konami-page-error">{page.error}</p> : null}
          {page.fields.length ? <dl>{page.fields.map((field, index) => <div key={`${field.label}-${index}`}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl> : null}
          {page.tables.map((table, tableIndex) => <div className="konami-table-wrap" key={`${table.caption}-${tableIndex}`}>
            {table.caption ? <strong>{table.caption}</strong> : null}
            <table>{table.headers.length ? <thead><tr>{table.headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead> : null}
              <tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>)}
          {page.text.length ? <details className="konami-raw"><summary>{text.raw} ({page.text.length})</summary><ul>{page.text.map((value, index) => <li key={index}>{value}</li>)}</ul></details> : null}
          {!page.fields.length && !page.tables.length && !page.text.length && !page.error ? <p>{text.noData}</p> : null}
        </div>
      </details>)}
    </div>
  </section>;
}
