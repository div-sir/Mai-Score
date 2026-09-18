import type { ComboFlag, Difficulty, ParsedFullScore, ParsedRecentPlay, ParsedScore, PlayerProfile, SyncFlag } from "./types";

const absolute = (value: string | null, base: string): string | undefined => {
  if (!value) return undefined;
  try { return new URL(value, base).href; } catch { return undefined; }
};

const imageBy = (doc: Document, fragment: string, base: string) =>
  absolute(doc.querySelector<HTMLImageElement>(`img[src*="${fragment}"]`)?.getAttribute("src") ?? null, base);

export function parseProfile(doc: Document, base = "https://maimaidx-eng.com/maimai-mobile/home/"): PlayerProfile {
  const name = doc.querySelector(".name_block")?.textContent?.trim() ?? "";
  if (!name) throw new Error("找不到玩家資料，請確認已登入 maimai DX NET。");
  const trophy = doc.querySelector(".trophy_block");
  const titleClass = [...(trophy?.classList ?? [])].find((x) => x.startsWith("trophy_") && x !== "trophy_block");
  const starText = [...doc.querySelectorAll("div")].find((x) => /×[\d,]+/.test(x.textContent ?? ""))?.textContent ?? "";
  return {
    name,
    title: trophy?.querySelector(".trophy_inner_block")?.textContent?.trim() ?? "",
    titleColor: titleClass?.replace("trophy_", ""),
    rating: Number((doc.querySelector(".rating_block")?.textContent ?? "0").replace(/,/g, "")),
    stars: Number(starText.match(/×([\d,]+)/)?.[1].replace(/,/g, "") ?? 0) || undefined,
    iconUrl: absolute(doc.querySelector<HTMLImageElement>(".basic_block img.w_112, img.w_112.f_l")?.getAttribute("src") ?? null, base),
    courseRankUrl: imageBy(doc, "/course/course_rank_", base),
    classRankUrl: imageBy(doc, "/class/class_rank_", base),
    frameUrl: imageBy(doc, "/img/Frame/", base),
    ratingBaseUrl: imageBy(doc, "rating_base_", base)
  };
}

function difficultyFrom(card: Element): Difficulty | null {
  const className = [...card.classList].find((x) => /^music_(basic|advanced|expert|master|remaster)_score_back$/.test(x));
  return (className?.match(/^music_(.+?)_score_back$/)?.[1] as Difficulty | undefined) ?? null;
}

function flagsFrom(card: Element): Pick<ParsedFullScore, "comboFlag" | "syncFlag"> {
  const icons = [...card.querySelectorAll<HTMLImageElement>('img[src*="music_icon_"]')]
    .map((image) => (image.getAttribute("src") ?? "").toLowerCase());
  const combo = icons.find((src) => /music_icon_(fc|fcp|ap|app)\.png/.test(src))
    ?.match(/music_icon_(fcp|fc|app|ap)\.png/)?.[1];
  const sync = icons.find((src) => /music_icon_(fs|fsp|fsd|fsdp|fdx|fdxp)\.png/.test(src))
    ?.match(/music_icon_(fsdp|fsd|fsp|fs|fdxp|fdx)\.png/)?.[1];
  return {
    comboFlag: combo
      ?.replace("fcp", "fc+").replace("app", "ap+") as ComboFlag | undefined,
    syncFlag: sync
      ?.replace("fsdp", "fsd+").replace("fsp", "fs+").replace("fdxp", "fdx+") as SyncFlag | undefined
  };
}

export function parseRatingTarget(doc: Document): ParsedScore[] {
  return parseRatingTargetPage(doc).records;
}

export interface RatingTargetPage {
  records: ParsedScore[];
  candidates: ParsedScore[];
}

export function parseRatingTargetPage(doc: Document): RatingTargetPage {
  const cardSelector = ".pointer.w_450.m_15.p_3.f_0";
  const anchor = doc.querySelector("div.see_through_block");
  const sections: Element[][] = [];
  let sibling = anchor?.nextElementSibling ?? null;

  while (sibling && sections.length < 4) {
    if (sibling.matches("div.screw_block")) {
      const cards: Element[] = [];
      sibling = sibling.nextElementSibling;
      while (sibling?.matches(cardSelector)) {
        cards.push(sibling);
        sibling = sibling.nextElementSibling;
      }
      sections.push(cards);
      continue;
    }
    sibling = sibling.nextElementSibling;
  }

  // The candidate sections further down the page use the same card selector.
  // The first two blocks are the official B15/B35; blocks three and four are
  // DX NET's own near-miss lists and are optional on older page variants.
  if (sections.length < 2 || sections[0].length < 15 || sections[1].length < 35) {
    const found = sections.map((cards) => cards.length).join(" / ") || "0";
    throw new Error(`無法辨識 DX NET 的 B50 版面（找到 ${sections.length} 個區塊，各 ${found} 筆），請回報以便更新解析規則。`);
  }

  const parseGroups = (groups: Array<{ bucket: "b15" | "b35"; cards: Element[] }>) => groups.flatMap(({ bucket, cards }) => cards.flatMap((card) => {
    const difficulty = difficultyFrom(card);
    const rawTitle = card.querySelector(".music_name_block")?.textContent;
    const title = rawTitle?.trim() || (rawTitle?.includes("\u3000") ? "\u3000" : undefined);
    const achievementRate = Number(card.querySelector(".music_score_block")?.textContent?.replace("%", "").trim());
    const src = card.querySelector<HTMLImageElement>(".music_kind_icon")?.getAttribute("src") ?? "";
    const type: ParsedScore["type"] = /music_dx\.png/i.test(src) ? "dx" : "std";
    if (!difficulty || !title || !Number.isFinite(achievementRate)) return [];
    return [{
      title, type, difficulty,
      displayedLevel: card.querySelector(".music_lv_block")?.textContent?.trim() ?? "",
      achievementRate,
      bucket,
      ...flagsFrom(card)
    }];
  }));

  const records = parseGroups([
    { bucket: "b15" as const, cards: sections[0].slice(0, 15) },
    { bucket: "b35" as const, cards: sections[1].slice(0, 35) }
  ]);
  const candidates = parseGroups([
    { bucket: "b15", cards: sections[2] ?? [] },
    { bucket: "b35", cards: sections[3] ?? [] }
  ]);
  return { records, candidates };
}


/**
 * Parses one authenticated DX NET musicGenre result page. The endpoint is
 * already filtered to one difficulty, so the caller supplies that difficulty
 * instead of trusting decorative class names that have changed between site
 * revisions. Unplayed cards are intentionally omitted.
 */
export function parseFullRecordsPage(doc: Document, difficulty: Difficulty): ParsedFullScore[] {
  // Identify song rows independently of score availability. DX NET omits
  // achievement elements on unplayed charts, including entire BASIC pages.
  // Do not require rows to be direct children of the page wrapper.
  const cards = [...doc.querySelectorAll(".main_wrapper .w_450")]
    .filter((card) => card.querySelectorAll(".music_name_block").length === 1
      && card.querySelector(".music_lv_block")
      && card.querySelector(".music_name_block")?.closest(".w_450") === card);
  if (!cards.length) throw new Error("FULL_RECORDS_LAYOUT_CHANGED");

  return cards.flatMap((card) => {
    const rawTitle = card.querySelector(".music_name_block")?.textContent;
    // U+3000 is an actual catalog song title, not a missing name.
    const title = rawTitle?.trim() || (rawTitle?.includes("\u3000") ? "\u3000" : undefined);
    const displayedLevel = card.querySelector(".music_lv_block")?.textContent?.trim() ?? "";
    const scoreElement = card.querySelector(".music_score_block.w_120") ?? card.querySelector(".music_score_block");
    const scoreText = scoreElement?.textContent?.replace("%", "").trim() ?? "";
    // Missing and empty achievement elements are both unplayed variants.
    if (!scoreText) return [];
    const achievementRate = Number(scoreText);
    if (!title || !displayedLevel || !Number.isFinite(achievementRate)
      || achievementRate < 0 || achievementRate > 101) {
      throw new Error("FULL_RECORDS_LAYOUT_CHANGED");
    }
    const kindSrc = card.querySelector<HTMLImageElement>(".music_kind_icon")?.getAttribute("src") ?? "";
    const id = card.getAttribute("id") ?? "";
    const type: ParsedFullScore["type"] = /music_dx\.png/i.test(kindSrc) || /^dx_/i.test(id) ? "dx" : "std";
    return [{
      title,
      type,
      difficulty,
      displayedLevel,
      achievementRate,
      ...flagsFrom(card)
    }];
  });
}

export function parseCurrentFrame(doc: Document, base = "https://maimaidx-eng.com/maimai-mobile/collection/frame"): string | undefined {
  return currentCollectionImage(doc, "/img/Frame/", base);
}

const playlogImageName = (image?: HTMLImageElement | null) => (image?.getAttribute("src") ?? "")
  .split("/").at(-1)?.replace(/\.png(?:\?.*)?$/i, "").toLowerCase() ?? "";

const PLAYLOG_DIFFICULTY: Record<string, Difficulty> = {
  diff_basic: "basic",
  diff_advanced: "advanced",
  diff_expert: "expert",
  diff_master: "master",
  diff_remaster: "remaster"
};

function playlogTitle(block: Element): string | undefined {
  const title = block.querySelector<HTMLElement>(".basic_block.m_5.m_t_17.m_r_60");
  if (!title) return undefined;
  const clone = title.cloneNode(true) as HTMLElement;
  clone.querySelector(".w_80")?.remove();
  const raw = clone.textContent;
  return raw?.trim() || (raw?.includes("\u3000") ? "\u3000" : undefined);
}

function playlogFlags(block: Element): Pick<ParsedRecentPlay, "comboFlag" | "syncFlag"> {
  const names = [...block.querySelectorAll<HTMLImageElement>(".playlog_result_innerblock img")].map(playlogImageName);
  const comboName = names.find((name) => ["fc", "fcplus", "ap", "applus"].includes(name));
  const syncName = names.find((name) => ["fs", "fsplus", "fsd", "fsdplus", "fdx", "fdxplus"].includes(name));
  const comboFlag = comboName
    ?.replace("fcplus", "fc+").replace("applus", "ap+") as ComboFlag | undefined;
  const syncFlag = syncName
    ?.replace("fsplus", "fs+").replace("fsdplus", "fsd+")
    .replace("fdxplus", "fdx+") as SyncFlag | undefined;
  return { comboFlag, syncFlag };
}

/** Parses the rolling recent-play list with one entry per actual play. */
export function parseRecentPlaysPage(doc: Document): ParsedRecentPlay[] {
  const blocks = [...doc.querySelectorAll<HTMLElement>(".p_10.t_l.f_0.v_b")]
    .filter((block) => block.querySelector('form[action*="playlogDetail"]'));
  return blocks.flatMap((block) => {
    const title = playlogTitle(block);
    const difficulty = PLAYLOG_DIFFICULTY[playlogImageName(block.querySelector<HTMLImageElement>(".playlog_diff"))];
    const achievementRate = Number((block.querySelector(".playlog_achievement_txt")?.textContent ?? "")
      .replace("%", "").replace(/,/g, "").trim());
    const subTitle = block.querySelector(".sub_title")?.textContent ?? "";
    const played = subTitle.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
    if (!title || !difficulty || !played || !Number.isFinite(achievementRate)) return [];
    const kind = playlogImageName(block.querySelector<HTMLImageElement>(".playlog_music_kind_icon, .playlog_music_kind_icon_utage img"));
    const type: ParsedRecentPlay["type"] = kind === "music_dx" ? "dx" : "std";
    const scorePair = (block.querySelector(".playlog_score_block .white")?.textContent ?? "")
      .split("/").map((part) => Number(part.replace(/,/g, "").trim()));
    const dxStarName = playlogImageName(block.querySelector<HTMLImageElement>(".playlog_deluxscore_star"));
    const dxStar = Number(dxStarName.match(/dxstar_(\d)/)?.[1]);
    return [{
      title,
      type,
      difficulty,
      displayedLevel: block.querySelector(".playlog_level_icon")?.textContent?.trim() ?? "",
      achievementRate,
      playedAt: `${played[1]}-${played[2]}-${played[3]}T${played[4]}:${played[5]}`,
      track: Number(subTitle.match(/TRACK\s+(\d+)/i)?.[1] ?? 0),
      newAchievement: Boolean(block.querySelector(".playlog_achievement_newrecord")),
      ...(Number.isFinite(scorePair[0]) ? { dxScore: scorePair[0] } : {}),
      ...(Number.isFinite(scorePair[1]) ? { dxScoreMax: scorePair[1] } : {}),
      ...(Number.isFinite(dxStar) ? { dxStar } : {}),
      newDxScore: Boolean(block.querySelector(".playlog_deluxscore_newrecord")),
      scoreRank: playlogImageName(block.querySelector<HTMLImageElement>(".playlog_scorerank")) || undefined,
      ...playlogFlags(block)
    }];
  });
}

function currentCollectionImage(doc: Document, fragment: string, base: string): string | undefined {
  const current = doc.querySelector(".collection_setting_block");
  const image = [...(current?.querySelectorAll<HTMLImageElement>("img") ?? [])]
    .find(image => image.getAttribute("src")?.toLowerCase().includes(fragment.toLowerCase()));
  return absolute(image?.getAttribute("src") ?? null, base);
}
