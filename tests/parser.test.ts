import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { parseCurrentFrame, parseProfile, parseRatingTarget } from "../src/lib/parser";

const doc = (html: string) => new JSDOM(html, { url: "https://maimaidx-eng.com/maimai-mobile/home/" }).window.document;

describe("international DX NET parser", () => {
  it("parses the profile and equipped assets", () => {
    const profile = parseProfile(doc(`
      <div class="basic_block"><img class="w_112 f_l" src="/maimai-mobile/img/Icon/a.png"></div>
      <div class="trophy_block trophy_gold"><div class="trophy_inner_block">Champion</div></div>
      <div class="name_block">DIV</div><div class="rating_block">13,127</div>
      <img src="/maimai-mobile/img/course/course_rank_x.png">
      <img src="/maimai-mobile/img/class/class_rank_s_x.png">
      <img src="/maimai-mobile/img/rating_base_silver.png">
    `));
    expect(profile).toMatchObject({ name: "DIV", title: "Champion", titleColor: "gold", rating: 13127 });
    expect(profile.iconUrl).toContain("/img/Icon/a.png");

    const frame = parseCurrentFrame(doc(`
      <div class="town_block m_15 p_15 t_l"><div class="see_through_block collection_setting_block">
        <img src="/maimai-mobile/img/Frame/frame.png">
      </div></div>
    `));
    expect(frame).toContain("/img/Frame/frame.png");
  });

  it("parses score cards and assigns B15 before B35", () => {
    const cards = Array.from({ length: 16 }, (_, i) => `
      <div class="music_expert_score_back pointer w_450 m_15 p_3 f_0">
        <img class="music_kind_icon" src="/maimai-mobile/img/music_dx.png">
        <div class="music_lv_block">13</div><div class="music_name_block">Song ${i}</div>
        <div class="music_score_block">99.5000%</div>
      </div>`).join("");
    const scores = parseRatingTarget(doc(cards));
    expect(scores).toHaveLength(16);
    expect(scores[14].bucket).toBe("b15");
    expect(scores[15].bucket).toBe("b35");
    expect(scores[0]).toMatchObject({ type: "dx", difficulty: "expert", achievementRate: 99.5 });
  });
});
