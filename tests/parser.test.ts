import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  parseCurrentFrame,
  parseCurrentPlate,
  parseFullRecordsPage,
  parseProfile,
  parseRatingTarget,
  parseRatingTargetPage
} from "../src/lib/parser";

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

    const plate = parseCurrentPlate(doc(`
      <div class="town_block m_15 p_15 t_l"><div class="see_through_block collection_setting_block">
        <img src="/maimai-mobile/img/Plate/plate.png">
      </div></div>
    `));
    expect(plate).toContain("/img/Plate/plate.png");
  });

  it("returns no plate rather than throwing when the page has none", () => {
    // The plate collection page has not been verified against every region.
    // content.ts treats a miss as "no nameplate", so the parser must return
    // undefined instead of failing the whole collection.
    expect(parseCurrentPlate(doc("<div></div>"))).toBeUndefined();
    expect(parseCurrentPlate(doc(`
      <div class="town_block m_15 p_15 t_l"><div class="see_through_block collection_setting_block">
        <img src="/maimai-mobile/img/Frame/frame.png">
      </div></div>
    `))).toBeUndefined();
  });

  it("resolves asset URLs against an explicit base, not a hardcoded region", () => {
    // content.ts derives base from window.location for whichever DX NET
    // region actually loaded it; parser.ts must honor that base rather than
    // falling back to its international-only default.
    const jpDoc = new JSDOM(`
      <div class="basic_block"><img class="w_112 f_l" src="/maimai-mobile/img/Icon/a.png"></div>
      <div class="name_block">DIV</div><div class="rating_block">13,127</div>
    `, { url: "https://maimaidx.jp/maimai-mobile/home/" }).window.document;

    const profile = parseProfile(jpDoc, "https://maimaidx.jp/maimai-mobile/home/");
    expect(profile.iconUrl).toBe("https://maimaidx.jp/maimai-mobile/img/Icon/a.png");

    const jpFrameDoc = new JSDOM(`
      <div class="town_block m_15 p_15 t_l"><div class="see_through_block collection_setting_block">
        <img src="/maimai-mobile/img/Frame/frame.png">
      </div></div>
    `, { url: "https://maimaidx.jp/maimai-mobile/collection/frame" }).window.document;
    const frame = parseCurrentFrame(jpFrameDoc, "https://maimaidx.jp/maimai-mobile/collection/frame");
    expect(frame).toBe("https://maimaidx.jp/maimai-mobile/img/Frame/frame.png");
  });

  it("parses only the two rating target sections and excludes candidates", () => {
    const section = (count: number, prefix: string) => Array.from({ length: count }, (_, i) => `
      <div class="music_expert_score_back pointer w_450 m_15 p_3 f_0">
        <img class="music_kind_icon" src="/maimai-mobile/img/music_dx.png">
        <div class="music_lv_block">13</div><div class="music_name_block">${prefix} ${i}</div>
        <div class="music_score_block">99.5000%</div>
      </div>`).join("");
    const scores = parseRatingTarget(doc(`
      <div class="see_through_block"></div>
      <div class="screw_block">New targets</div>${section(15, "New")}
      <div class="screw_block">Old targets</div>${section(35, "Old")}
      <div class="screw_block">New candidates</div>${section(10, "Candidate new")}
      <div class="screw_block">Old candidates</div>${section(10, "Candidate old")}
    `));
    expect(scores).toHaveLength(50);
    expect(scores[14].bucket).toBe("b15");
    expect(scores[15].bucket).toBe("b35");
    expect(scores[0]).toMatchObject({ title: "New 0", type: "dx", difficulty: "expert", achievementRate: 99.5 });
    expect(scores[49].title).toBe("Old 34");
    expect(scores.some((score) => score.title.startsWith("Candidate"))).toBe(false);
  });

  it("returns DX NET candidate sections separately from the B50", () => {
    const section = (count: number, prefix: string) => Array.from({ length: count }, (_, i) => `
      <div class="music_master_score_back pointer w_450 m_15 p_3 f_0">
        <img class="music_kind_icon" src="/maimai-mobile/img/music_dx.png">
        <div class="music_lv_block">13+</div><div class="music_name_block">${prefix} ${i}</div>
        <div class="music_score_block">99.9000%</div>
      </div>`).join("");
    const page = parseRatingTargetPage(doc(`
      <div class="see_through_block"></div>
      <div class="screw_block">New targets</div>${section(15, "New")}
      <div class="screw_block">Old targets</div>${section(35, "Old")}
      <div class="screw_block">New candidates</div>${section(10, "Candidate new")}
      <div class="screw_block">Old candidates</div>${section(10, "Candidate old")}
    `));
    expect(page.records).toHaveLength(50);
    expect(page.candidates).toHaveLength(20);
    expect(page.candidates[0]).toMatchObject({ title: "Candidate new 0", bucket: "b15" });
    expect(page.candidates[10]).toMatchObject({ title: "Candidate old 0", bucket: "b35" });
  });

  it("refuses to guess buckets when the target sections are missing", () => {
    const card = (title: string) => `
      <div class="music_expert_score_back pointer w_450 m_15 p_3 f_0">
        <img class="music_kind_icon" src="/maimai-mobile/img/music_dx.png">
        <div class="music_lv_block">13</div><div class="music_name_block">${title}</div>
        <div class="music_score_block">99.5000%</div>
      </div>`;
    const cards = Array.from({ length: 50 }, (_, i) => card(`Song ${i}`)).join("");

    // No screw_block headers: the old code fell back to slicing the first 15 and
    // next 35 cards, which silently mis-filed targets on any layout change.
    expect(() => parseRatingTarget(doc(`<div class="see_through_block"></div>${cards}`)))
      .toThrow(/無法辨識 DX NET 的 B50 版面/);

    // A section that is short of the official count is also not guessable.
    expect(() => parseRatingTarget(doc(`
      <div class="see_through_block"></div>
      <div class="screw_block">New targets</div>${Array.from({ length: 14 }, (_, i) => card(`New ${i}`)).join("")}
      <div class="screw_block">Old targets</div>${Array.from({ length: 35 }, (_, i) => card(`Old ${i}`)).join("")}
    `))).toThrow(/無法辨識 DX NET 的 B50 版面/);
  });

  it("reads standard charts and combo/sync flags", () => {
    const icon = (name: string) => `<img src="/maimai-mobile/img/music_icon_${name}.png">`;
    const card = (title: string, icons: string) => `
      <div class="music_master_score_back pointer w_450 m_15 p_3 f_0">
        <img class="music_kind_icon" src="/maimai-mobile/img/music_standard.png">
        <div class="music_lv_block">14+</div><div class="music_name_block">${title}</div>
        <div class="music_score_block">100.5000%</div>${icons}
      </div>`;
    const flags = ["", icon("fc"), icon("fcp"), icon("ap"), icon("app"), icon("fs"), icon("fsp"), icon("fsd"), icon("fsdp")];
    const scores = parseRatingTarget(doc(`
      <div class="see_through_block"></div>
      <div class="screw_block">New</div>${Array.from({ length: 15 }, (_, i) => card(`New ${i}`, flags[i] ?? "")).join("")}
      <div class="screw_block">Old</div>${Array.from({ length: 35 }, (_, i) => card(`Old ${i}`, "")).join("")}
    `));

    expect(scores[0]).toMatchObject({ type: "std", difficulty: "master", displayedLevel: "14+" });
    expect(scores[0].comboFlag).toBeUndefined();
    expect(scores[0].syncFlag).toBeUndefined();
    expect(scores[1].comboFlag).toBe("fc");
    expect(scores[2].comboFlag).toBe("fc+");
    expect(scores[3].comboFlag).toBe("ap");
    expect(scores[4].comboFlag).toBe("ap+");
    expect(scores[5].syncFlag).toBe("fs");
    expect(scores[6].syncFlag).toBe("fs+");
    expect(scores[7].syncFlag).toBe("fsd");
    expect(scores[8].syncFlag).toBe("fsd+");
  });

  it("parses a played-chart difficulty page and skips unplayed cards", () => {
    const full = parseFullRecordsPage(doc(`
      <div class="main_wrapper">
        <div class="screw_block">POPS &amp; ANIME</div>
        <div class="w_450 m_15 p_r f_0">
          <div class="music_master_score_back pointer p_3">
            <div class="music_lv_block">13+</div>
            <div class="music_name_block">Standard song</div>
            <div class="music_score_block">100.1234%</div>
            <img class="music_kind_icon" src="/maimai-mobile/img/music_standard.png">
            <img class="f_r" src="/maimai-mobile/img/music_icon_app.png">
            <img class="f_r" src="/maimai-mobile/img/music_icon_fdxp.png">
          </div>
        </div>
        <div id="dx_22" class="w_450 m_15 p_r f_0">
          <div class="music_master_score_back pointer p_3">
            <div class="music_lv_block">14</div>
            <div class="music_name_block">DX song</div>
            <div class="music_score_block">99.5000%</div>
          </div>
        </div>
        <div class="w_450 m_15 p_r f_0">
          <div class="music_master_score_back pointer p_3">
            <div class="music_lv_block">12</div>
            <div class="music_name_block">Not played</div>
            <div class="music_score_block"></div>
            <img class="music_kind_icon" src="/maimai-mobile/img/music_dx.png">
          </div>
        </div>
      </div>
    `), "master");

    expect(full).toEqual([{
      title: "Standard song",
      type: "std",
      difficulty: "master",
      displayedLevel: "13+",
      achievementRate: 100.1234,
      comboFlag: "ap+",
      syncFlag: "fdx+"
    }, {
      title: "DX song",
      type: "dx",
      difficulty: "master",
      displayedLevel: "14",
      achievementRate: 99.5,
      comboFlag: undefined,
      syncFlag: undefined
    }]);
  });

  it("rejects a login or changed-layout page as Full Records", () => {
    expect(() => parseFullRecordsPage(doc(`<div class="main_wrapper"><p>Sign in</p></div>`), "expert"))
      .toThrow("FULL_RECORDS_LAYOUT_CHANGED");
  });
});
