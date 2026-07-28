import { describe, expect, it } from "vitest";
import {
  createFetchProgress,
  createMatchingProgress,
  describeFetchError,
  isCollectProgressMessage
} from "../src/lib/collect-progress";
import { CONNECTION_PROTOCOL_VERSION } from "../src/lib/connections";

const translate = (key: string, ...values: Array<string | number>) => `${key}:${values.join(",")}`;

describe("collect progress messages", () => {
  it("round-trips through the type guard", () => {
    const fetchMessage = createFetchProgress(2, 3);
    const matchingMessage = createMatchingProgress();
    expect(isCollectProgressMessage(fetchMessage)).toBe(true);
    expect(isCollectProgressMessage(matchingMessage)).toBe(true);
    expect(fetchMessage).toMatchObject({ stage: "fetch", done: 2, total: 3 });
  });

  it("rejects messages from a different protocol version or a different message family", () => {
    expect(isCollectProgressMessage({ ...createFetchProgress(1, 3), protocolVersion: CONNECTION_PROTOCOL_VERSION + 1 })).toBe(false);
    expect(isCollectProgressMessage({ type: "MAI_SCORE_COLLECT", protocolVersion: CONNECTION_PROTOCOL_VERSION })).toBe(false);
    expect(isCollectProgressMessage(null)).toBe(false);
    expect(isCollectProgressMessage("MAI_SCORE_PROGRESS")).toBe(false);
  });
});

describe("describeFetchError", () => {
  it("names a stalled request distinctly from a failed one", () => {
    const timeout = describeFetchError(new DOMException("timed out", "TimeoutError"), "the B50 target list", translate);
    expect(timeout.message).toBe("fetchTimeout:the B50 target list");

    const network = describeFetchError(new TypeError("Failed to fetch"), "the B50 target list", translate);
    expect(network.message).toBe("fetchFailed:the B50 target list");
  });

  it("falls back to the generic failure for an unrecognized error shape", () => {
    expect(describeFetchError("not an error object", "player profile", translate).message).toBe("fetchFailed:player profile");
  });
});
