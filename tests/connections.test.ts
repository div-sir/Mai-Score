import { describe, expect, it } from "vitest";
import {
  CONNECTIONS,
  CONNECTION_PROTOCOL_VERSION,
  connectionForUrl,
  createCollectRequest,
  isCollectRequest
} from "../src/lib/connections";

describe("connection registry", () => {
  it("selects the international DX NET adapter", () => {
    expect(connectionForUrl("https://maimaidx-eng.com/maimai-mobile/home/")?.id).toBe("dxnet-intl");
    expect(connectionForUrl("https://example.com/")).toBeUndefined();
  });

  it("versions collection messages for future adapters", () => {
    const request = createCollectRequest("dxnet-intl");
    expect(request.protocolVersion).toBe(CONNECTION_PROTOCOL_VERSION);
    expect(isCollectRequest(request)).toBe(true);
    expect(isCollectRequest({ ...request, protocolVersion: 99 })).toBe(false);
  });

  it("reserves adapters for shared rhythm-game records", () => {
    const planned = CONNECTIONS.filter((connection) => connection.status === "planned");
    expect(planned.map((connection) => connection.id)).toEqual([
      "rhythm-record-file",
      "popn-konami",
      "sdvx-konami",
      "ddr-konami"
    ]);
    expect(planned.map((connection) => connection.game)).toEqual([
      "maimai-dx",
      "popn-music",
      "sound-voltex",
      "dance-dance-revolution"
    ]);
    expect(isCollectRequest(createCollectRequest("sdvx-konami"))).toBe(false);
  });
});
