import type { ComboFlag, Difficulty, ParsedFullScore, ParsedScore, PlayerProfile, SyncFlag } from "./types";

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
    ratingBaseUrl: imageBy(doc, "rating_base_", base)
  };
}

function difficultyFrom(card: Element): Difficulty | null {
  const className = [...card.classList].find((x) => /^music_(basic|advanced|expert|master|remaster)_score_back$/.test(x));
  return (className?.match(/^music_(.+?)_score_back$/)?.[1] as Difficulty | undefined) ?? null;
}

function flagsFrom(card: Element): Pick<ParsedFullScore, "comboFlag" | "syncFlag"> {
  const icons = [...card.querySelectorAll<HTMLImageElement>('img[src*="/music_icon_"]')]
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
    const title = card.querySelector(".music_name_block")?.textContent?.trim();
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
  const cards = [...doc.querySelectorAll(".main_wrapper > .w_450")]
    .filter((card) => card.querySelector(".music_name_block") && card.querySelector(".music_score_block"));
  if (!cards.length) throw new Error("FULL_RECORDS_LAYOUT_CHANGED");

  return cards.flatMap((card) => {
    const title = card.querySelector(".music_name_block")?.textContent?.trim();
    const displayedLevel = card.querySelector(".music_lv_block")?.textContent?.trim() ?? "";
    const scoreText = card.querySelector(".music_score_block")?.textContent?.replace("%", "").trim() ?? "";
    // DX NET renders an empty score block for charts that have not been played.
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

/**
 * The nameplate ("名牌版" / プレート) behind the player name. Same page shape as
 * the frame collection, so it shares the parser; the caller treats a missing
 * result as "no plate", never as a failed collection.
 */
export function parseCurrentPlate(doc: Document, base = "https://maimaidx-eng.com/maimai-mobile/collection/plate"): string | undefined {
  return currentCollectionImage(doc, "/img/Plate/", base);
}

function currentCollectionImage(doc: Document, fragment: string, base: string): string | undefined {
  const current = doc.querySelector(".town_block.m_15.p_15.t_l .see_through_block.collection_setting_block");
  return absolute(current?.querySelector<HTMLImageElement>(`img[src*="${fragment}"]`)?.getAttribute("src") ?? null, base);
}
