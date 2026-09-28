"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  konamiChartCandidates,
  konamiDataTables,
  konamiTableCsv,
  type KonamiChartCandidate
} from "../lib/konami-analysis";
import {
  analyzeDdrFlare,
  ddrFlareForStyle,
  type DdrPlayStyle
} from "../lib/ddr-flare";
import type { KonamiPageSnapshot } from "../lib/konami-page";
import { scoresFromKonamiPages } from "../lib/rhythm-insights";
import type { LanguageId } from "../lib/types";
import ScoreInsights from "./score-insights";

const gameLabel = (game: KonamiPageSnapshot["source"]["game"]) => game === "beatmania-iidx"
  ? "beatmania IIDX" : game === "sound-voltex" ? "SOUND VOLTEX" : "DanceDanceRevolution";

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function safeFilename(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80) || "konami-data";
}

function KonamiBarChart({ chart, language }: { chart: KonamiChartCandidate; language: LanguageId }) {
  const points = useMemo(() => [...chart.points]
    .sort((left, right) => right.value - left.value)
    .slice(0, 15), [chart.points]);
  const maximum = Math.max(...points.map((point) => point.value), 1);
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 4 });
  const formatted = (value: number) => `${number.format(value)}${chart.format === "percent" ? "%" : ""}`;
  return <figure className="konami-auto-chart" aria-label={`${chart.title}: ${chart.valueLabel}`}>
    <figcaption><strong>{chart.title}</strong><span>{chart.categoryLabel} · {chart.valueLabel}</span></figcaption>
    <div className="konami-bar-list">
      {points.map((point, index) => <div className="konami-bar-row" key={`${point.label}-${index}`}>
        <span title={point.label}>{point.label}</span>
        <div><i style={{ width: `${Math.max(2, point.value / maximum * 100)}%` }} /></div>
        <strong>{formatted(point.value)}</strong>
      </div>)}
    </div>
  </figure>;
}

function DdrFlareSection({ data, language }: { data: KonamiPageSnapshot; language: LanguageId }) {
  const analysis = useMemo(() => analyzeDdrFlare(data), [data]);
  const [requestedStyle, setRequestedStyle] = useState<DdrPlayStyle>("SINGLE");
  const style = analysis.styles.includes(requestedStyle) ? requestedStyle : analysis.styles[0] ?? "SINGLE";
  const groups = useMemo(() => ddrFlareForStyle(analysis, style), [analysis, style]);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const counted = groups.reduce((sum, group) => sum + group.counted.length, 0);
  const recommendations = groups.flatMap((group) => group.candidates.slice(0, 3).map((chart) => ({
    ...chart,
    category: group.category
  }))).sort((left, right) => left.needed - right.needed || right.flareSkill - left.flareSkill).slice(0, 8);
  const t = language === "zh-Hant" ? {
    title: "DDR Flare Skill", subtitle: "算分曲與升分門檻", total: "目前計入合計", counted: "計入譜面",
    cutoff: "第 30 名", songs: "算分歌曲", advice: "最接近進榜的譜面", need: "至少再增加",
    missing: "尚未找到可辨識的 Flare Skill 表格。請在 DDR WORLD 開啟 PLAY DATA 裡的 Flare Skill 對象曲頁面後重新收集。",
    incomplete: "未滿 30 首；目前找到的對象曲都會計入。", unknown: "筆譜面缺少官方分類，暫不列入合計。",
    exact: "只使用頁面實際顯示的 Flare Skill；不從分數猜測 Skill。SINGLE 與 DOUBLE 分開，三類各取最高 30 譜面。",
    noAdvice: "各分類目前沒有榜外候選；收集更多對象曲後會顯示進榜所需差值。", skill: "Skill"
  } : language === "ja" ? {
    title: "DDR フレアスキル", subtitle: "対象譜面と更新候補", total: "対象合計", counted: "対象譜面",
    cutoff: "30位", songs: "対象曲", advice: "ランクインに近い譜面", need: "あと",
    missing: "フレアスキル表を認識できませんでした。DDR WORLD の PLAY DATA でフレアスキル対象曲ページを開き、再取得してください。",
    incomplete: "30譜面未満のため、取得済みの対象譜面はすべて加算されます。", unknown: "譜面は公式カテゴリが不明なため合計から除外しました。",
    exact: "ページに表示されたフレアスキルのみ使用します。スコアから推測しません。SINGLE/DOUBLE は別集計で、3カテゴリ各上位30譜面です。",
    noAdvice: "現在は圏外候補がありません。対象曲を追加取得すると必要差分を表示します。", skill: "Skill"
  } : {
    title: "DDR Flare Skill", subtitle: "Contributing charts and improvement thresholds", total: "Counted total", counted: "Counted charts",
    cutoff: "30th place", songs: "Contributing songs", advice: "Closest charts outside the Top 30", need: "Needs at least",
    missing: "No recognizable Flare Skill table was found. Open Flare Skill Target Songs under DDR WORLD PLAY DATA, then collect again.",
    incomplete: "Fewer than 30 charts; every collected target chart currently counts.", unknown: "charts have no explicit official category and are excluded from the total.",
    exact: "Uses only Flare Skill shown on the collected page; it never guesses Skill from score. SINGLE and DOUBLE are separate, with the best 30 in each of three categories.",
    noAdvice: "There are no outside candidates yet. Collect more target songs to see exact entry gaps.", skill: "Skill"
  };

  if (!analysis.charts.length) return <section className="ddr-flare ddr-flare-empty">
    <div><span>{t.subtitle}</span><h2>{t.title}</h2></div><p>{t.missing}</p>
  </section>;

  return <section className="ddr-flare">
    <header className="ddr-flare-heading">
      <div><span>{t.subtitle}</span><h2>{t.title}</h2><p>{t.exact}</p></div>
      <div className="ddr-style-switch" aria-label="DDR play style">
        {analysis.styles.map((entry) => <button type="button" key={entry} aria-pressed={style === entry} onClick={() => setRequestedStyle(entry)}>{entry}</button>)}
      </div>
    </header>
    <div className="ddr-flare-overview">
      <div><span>{t.total}</span><strong>{total.toLocaleString(language)}</strong></div>
      <div><span>{t.counted}</span><strong>{counted}<small> / 90</small></strong></div>
      {groups.map((group) => <div key={group.category}><span>{group.category}</span><strong>{group.total.toLocaleString(language)}</strong><small>{group.cutoff === undefined ? t.incomplete : `${t.cutoff}: ${group.cutoff}`}</small></div>)}
    </div>
    {analysis.unknownCategoryCount ? <p className="ddr-flare-warning">{analysis.unknownCategoryCount} {t.unknown}</p> : null}
    <div className="ddr-flare-content">
      <section><h3>{t.songs}</h3><div className="ddr-counted-list">
        {groups.flatMap((group) => group.counted.map((chart, index) => ({ chart, group, index })))
          .sort((left, right) => right.chart.flareSkill - left.chart.flareSkill).map(({ chart, group, index }) => <article key={chart.id}>
            <span>{group.category} #{index + 1}</span><div><strong>{chart.title}</strong><small>{[chart.difficulty, chart.level ? `Lv ${chart.level}` : ""].filter(Boolean).join(" · ") || style}</small></div><b>{chart.flareSkill}</b>
          </article>)}
      </div></section>
      <aside><h3>{t.advice}</h3>{recommendations.length ? <div className="ddr-advice-list">{recommendations.map((chart) => <article key={chart.id}>
        <span>{chart.category}</span><strong>{chart.title}</strong><small>{chart.flareSkill} {t.skill} · {t.need} +{chart.needed}</small>
      </article>)}</div> : <p className="ddr-no-advice">{t.noAdvice}</p>}</aside>
    </div>
  </section>;
}

export default function KonamiPagesDashboard({ data, language }: { data: KonamiPageSnapshot; language: LanguageId }) {
  const [query, setQuery] = useState("");
  const [selectedChartId, setSelectedChartId] = useState("");
  const deferredQuery = useDeferredValue(query);
  const text = language === "zh-Hant" ? {
    source: "免費頁面直接收集", pages: "可讀頁面", fields: "欄位", tables: "表格", restricted: "受限頁面",
    search: "搜尋頁面、欄位或內容", paid: "需要付費方案", login: "需要登入", failed: "讀取失敗", collected: "已收集",
    noData: "這個頁面沒有可整理的結構化內容。", raw: "其他可見內容", open: "開啟官方頁面",
    analysis: "資料圖表", chart: "選擇數值欄位", noChart: "目前沒有至少兩筆、可安全辨識的數值資料；原始表格仍完整保留。",
    csv: "下載這個表格 CSV", json: "下載整理後 JSON", top: "最多顯示數值最高的 15 筆"
  } : language === "ja" ? {
    source: "無料ページから直接収集", pages: "取得ページ", fields: "項目", tables: "表", restricted: "制限ページ",
    search: "ページ・項目・内容を検索", paid: "有料コースが必要", login: "ログインが必要", failed: "取得失敗", collected: "取得済み",
    noData: "整理できる構造化データはありません。", raw: "その他の表示内容", open: "公式ページを開く",
    analysis: "データチャート", chart: "数値列を選択", noChart: "安全に判定できる数値データが2件以上ありません。元の表は保持されています。",
    csv: "この表をCSVで保存", json: "整理済みJSONを保存", top: "値の高い順に最大15件を表示"
  } : {
    source: "Direct free-page collection", pages: "Readable pages", fields: "Fields", tables: "Tables", restricted: "Restricted pages",
    search: "Search pages, fields, or visible text", paid: "Paid plan required", login: "Sign-in required", failed: "Could not read", collected: "Collected",
    noData: "No structured content was available on this page.", raw: "Other visible content", open: "Open official page",
    analysis: "Data charts", chart: "Choose a numeric column", noChart: "No numeric table with at least two safely recognized values was found. The original tables remain available.",
    csv: "Download this table as CSV", json: "Download analyzed JSON", top: "Shows up to the 15 highest values"
  };
  const tables = useMemo(() => konamiDataTables(data), [data]);
  const charts = useMemo(() => konamiChartCandidates(data), [data]);
  const selectedChart = charts.find((chart) => chart.id === selectedChartId) ?? charts[0];
  const selectedTable = tables.find((table) => table.id === selectedChart?.tableId);
  const insightRecords = useMemo(() => scoresFromKonamiPages(data), [data]);
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
    {data.source.game === "dance-dance-revolution" ? <DdrFlareSection data={data} language={language} /> : null}
    {(data.source.game === "dance-dance-revolution" || data.source.game === "sound-voltex") && insightRecords.length
      ? <ScoreInsights key={data.source.game} game={data.source.game} records={insightRecords} language={language} generatedAt={data.generatedAt} /> : null}
    <section className="konami-analysis">
      <div className="konami-analysis-heading"><div><h2>{text.analysis}</h2><p>{text.top}</p></div>
        <button type="button" onClick={() => downloadText(
          `mai-score-${data.source.game}-analysis.json`,
          JSON.stringify({ generatedAt: data.generatedAt, game: data.source.game, tables, charts }, null, 2),
          "application/json"
        )}>{text.json}</button>
      </div>
      {selectedChart ? <>
        <div className="konami-chart-controls">
          <label><span>{text.chart}</span><select value={selectedChart.id} onChange={(event) => setSelectedChartId(event.target.value)}>
            {charts.map((chart) => <option value={chart.id} key={chart.id}>{chart.title} · {chart.valueLabel}</option>)}
          </select></label>
          {selectedTable ? <button type="button" onClick={() => downloadText(
            `${safeFilename(selectedTable.title)}.csv`,
            `\uFEFF${konamiTableCsv(selectedTable)}`,
            "text/csv;charset=utf-8"
          )}>{text.csv}</button> : null}
        </div>
        <KonamiBarChart chart={selectedChart} language={language} />
      </> : <p className="konami-chart-empty">{text.noChart}</p>}
    </section>
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
