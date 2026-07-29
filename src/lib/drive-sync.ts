import { CONNECTION_PROTOCOL_VERSION } from "./connections";
import {
  DriveAuthError,
  findAppDataFile,
  readAppDataFile,
  writeAppDataFile,
  type DriveContext
} from "./drive-appdata";

export const DRIVE_HISTORY_FILE = "mai-score-history.json";

// The extension relays an opaque string; only Studio parses it. Bounded so a
// runaway payload cannot be pushed into the user's Drive quota, and so a
// malformed request is rejected before any network call. Roughly 4 MB of
// JSON — far above a realistic history, far below anything alarming.
export const MAX_SYNC_PAYLOAD_BYTES = 4 * 1024 * 1024;

export interface DrivePullRequest {
  type: "MAI_SCORE_DRIVE_PULL";
  protocolVersion: number;
}

export interface DrivePushRequest {
  type: "MAI_SCORE_DRIVE_PUSH";
  protocolVersion: number;
  /** Serialized history document. The extension never inspects this. */
  payload: string;
}

export type DriveSyncRequest = DrivePullRequest | DrivePushRequest;

export type DriveSyncResponse =
  | { ok: true; payload?: string; modifiedTime?: string }
  // "needs-auth" is distinct from a generic failure: it is the one outcome
  // Studio can act on, by sending the user to the popup to grant access,
  // since interactive consent cannot be raised from a background worker.
  | { ok: false; reason: "needs-auth" }
  | { ok: false; reason: "error"; error: string };

export function createDrivePullRequest(): DrivePullRequest {
  return { type: "MAI_SCORE_DRIVE_PULL", protocolVersion: CONNECTION_PROTOCOL_VERSION };
}

export function createDrivePushRequest(payload: string): DrivePushRequest {
  return { type: "MAI_SCORE_DRIVE_PUSH", protocolVersion: CONNECTION_PROTOCOL_VERSION, payload };
}

export function isDriveSyncRequest(value: unknown): value is DriveSyncRequest {
  if (!value || typeof value !== "object") return false;
  // Deliberately untyped fields: this validates an arbitrary cross-origin
  // message, so narrowing to one variant up front would make the other
  // variant's check look impossible to the compiler.
  const message = value as { type?: unknown; protocolVersion?: unknown; payload?: unknown };
  if (message.protocolVersion !== CONNECTION_PROTOCOL_VERSION) return false;
  if (message.type === "MAI_SCORE_DRIVE_PULL") return true;
  return message.type === "MAI_SCORE_DRIVE_PUSH"
    && typeof message.payload === "string"
    && payloadBytes(message.payload) <= MAX_SYNC_PAYLOAD_BYTES;
}

/** Byte length, not character count — multi-byte song titles are common here. */
export function payloadBytes(payload: string): number {
  return new TextEncoder().encode(payload).length;
}

/**
 * Carries out an already-validated request against Drive. Kept free of any
 * chrome.* dependency so the whole find/read/write path is testable; the
 * caller supplies the token it obtained however it can.
 */
export async function performDriveSync(
  context: DriveContext,
  request: DriveSyncRequest
): Promise<DriveSyncResponse> {
  try {
    const existing = await findAppDataFile(context, DRIVE_HISTORY_FILE);

    if (request.type === "MAI_SCORE_DRIVE_PULL") {
      // Nothing synced yet is a normal first run, not a failure.
      if (!existing) return { ok: true };
      return { ok: true, payload: await readAppDataFile(context, existing.id), modifiedTime: existing.modifiedTime };
    }

    const written = await writeAppDataFile(context, DRIVE_HISTORY_FILE, request.payload, existing?.id);
    return { ok: true, modifiedTime: written.modifiedTime };
  } catch (error) {
    if (error instanceof DriveAuthError) return { ok: false, reason: "needs-auth" };
    return { ok: false, reason: "error", error: error instanceof Error ? error.message : String(error) };
  }
}
