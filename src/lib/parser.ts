import type { Difficulty, ParsedScore, PlayerProfile } from "./types";

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

export function parseRatingTarget(doc: Document): ParsedScore[] {
  const cardSelector = ".pointer.w_450.m_15.p_3.f_0";
  const anchor = doc.querySelector("div.see_through_block");
  const sections: Element[][] = [];
  let sibling = anchor?.nextElementSibling ?? null;

  while (sibling && sections.length < 2) {
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

  // The candidate sections further down the page use the same card selector, so
  // the buckets must come from the first two screw_block sections. Guessing by
  // position instead would silently mis-file real targets if the page changes.
  if (sections.length !== 2 || sections[0].length < 15 || sections[1].length < 35) {
    const found = sections.map((cards) => cards.length).join(" / ") || "0";
    throw new Error(`無法辨識 DX NET 的 B50 版面（找到 ${sections.length} 個區塊，各 ${found} 筆），請回報以便更新解析規則。`);
  }

  const targetGroups = [
    { bucket: "b15" as const, cards: sections[0].slice(0, 15) },
    { bucket: "b35" as const, cards: sections[1].slice(0, 35) }
  ];

  return targetGroups.flatMap(({ bucket, cards }) => cards.flatMap((card) => {
    const difficulty = difficultyFrom(card);
    const title = card.querySelector(".music_name_block")?.textContent?.trim();
    const achievementRate = Number(card.querySelector(".music_score_block")?.textContent?.replace("%", "").trim());
    const src = card.querySelector<HTMLImageElement>(".music_kind_icon")?.getAttribute("src") ?? "";
    const type = /music_dx\.png/i.test(src) ? "dx" : "std";
    if (!difficulty || !title || !Number.isFinite(achievementRate)) return [];
    const icons = [...card.querySelectorAll<HTMLImageElement>('img[src*="/music_icon_"]')].map((x) => x.src.toLowerCase());
    return [{
      title, type, difficulty,
      displayedLevel: card.querySelector(".music_lv_block")?.textContent?.trim() ?? "",
      achievementRate,
      bucket,
      comboFlag: icons.find((x) => /music_icon_(ap|app)/.test(x))?.match(/music_icon_(app|ap)/)?.[1]?.replace("app", "ap+"),
      syncFlag: icons.find((x) => /music_icon_(fs|fsp|fsd|fsdp)/.test(x))?.match(/music_icon_(fsdp|fsd|fsp|fs)/)?.[1]?.replace("fsdp", "fsd+").replace("fsp", "fs+")
    }];
  }));
}

export function parseCurrentFrame(doc: Document, base = "https://maimaidx-eng.com/maimai-mobile/collection/frame"): string | undefined {
  const current = doc.querySelector(".town_block.m_15.p_15.t_l .see_through_block.collection_setting_block");
  return absolute(current?.querySelector<HTMLImageElement>('img[src*="/img/Frame/"]')?.getAttribute("src") ?? null, base);
}
