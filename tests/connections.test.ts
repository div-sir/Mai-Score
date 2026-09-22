import { describe, expect, it } from "vitest";
import {
  CONNECTIONS,
  CONNECTION_PROTOCOL_VERSION,
  connectionForUrl,
  createCollectRequest,
  createSessionStatusRequest,
  isCollectRequest,
  isSessionStatusRequest,
  popupPageContextForUrl
} from "../src/lib/connections";

describe("connection registry", () => {
  it("selects the international DX NET adapter", () => {
    expect(connectionForUrl("https://maimaidx-eng.com/maimai-mobile/home/")?.id).toBe("dxnet-intl");
    expect(connectionForUrl("https://example.com/")).toBeUndefined();
  });

  it("selects the Japan-domestic DX NET adapter without matching the international one", () => {
    const jp = connectionForUrl("https://maimaidx.jp/maimai-mobile/home/");
    expect(jp?.id).toBe("dxnet-jp");
    expect(jp?.region).toBe("jp");
    expect(connectionForUrl("https://maimaidx.jp/maimai-mobile/home/")?.id).not.toBe("dxnet-intl");
  });

  it("chooses popup content from the active score website", () => {
    expect(popupPageContextForUrl("https://maimaidx-eng.com/maimai-mobile/home/")).toBe("maimai");
    expect(popupPageContextForUrl("https://p.eagate.573.jp/game/sdvx/vii/playdata/")).toBe("sound-voltex");
    expect(popupPageContextForUrl("https://p.eagate.573.jp/game/2dx/33/djdata/")).toBe("beatmania-iidx");
    expect(popupPageContextForUrl("https://p.eagate.573.jp/game/ddr/ddrworld/playdata/index.html")).toBe("dance-dance-revolution");
    expect(popupPageContextForUrl("https://example.com/game/ddr/")).toBe("other");
  });

  it("versions collection messages for future adapters", () => {
    const request = createCollectRequest("dxnet-intl");
    expect(request.protocolVersion).toBe(CONNECTION_PROTOCOL_VERSION);
    expect(isCollectRequest(request)).toBe(true);
    expect(isCollectRequest({ ...request, protocolVersion: 99 })).toBe(false);
    expect(isCollectRequest(createCollectRequest("dxnet-intl", true))).toBe(true);
    expect(isCollectRequest({ ...request, includeFullRecords: undefined })).toBe(true);
    expect(isCollectRequest({ ...request, includeFullRecords: "yes" })).toBe(false);
  });

  it("versions non-destructive login-status probes", () => {
    const request = createSessionStatusRequest("dxnet-intl");
    expect(isSessionStatusRequest(request)).toBe(true);
    expect(isSessionStatusRequest({ ...request, protocolVersion: 99 })).toBe(false);
    expect(isSessionStatusRequest({ ...request, connectionId: "rhythm-record-file" })).toBe(false);
  });

  it("reserves adapters for shared rhythm-game records", () => {
    const planned = CONNECTIONS.filter((connection) => connection.status === "planned");
    expect(planned.map((connection) => connection.id)).toEqual([
      "rhythm-record-file",
      "popn-konami",
      "ddr-konami"
    ]);
    expect(planned.map((connection) => connection.game)).toEqual([
      "maimai-dx",
      "popn-music",
      "dance-dance-revolution"
    ]);
    expect(isCollectRequest(createCollectRequest("sdvx-konami"))).toBe(false);
    expect(connectionForUrl("https://p.eagate.573.jp/game/sdvx/vii/playdata/download/index.html")?.id).toBe("sdvx-konami");
    expect(connectionForUrl("https://p.eagate.573.jp/game/2dx/33/djdata/score_download.html")?.id).toBe("iidx-konami-csv");
  });
});
