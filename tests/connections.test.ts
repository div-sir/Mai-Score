import { describe, expect, it } from "vitest";
import {
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
});
