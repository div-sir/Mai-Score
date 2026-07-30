import { CONNECTION_PROTOCOL_VERSION } from "./connections";
import {
  disconnectDrive,
  driveConnection,
  driveEnabled,
  setDriveEnabled,
  type AuthDeps,
  type DrivePreferenceStorage
} from "./drive-auth";

export type DriveBridgeRequest =
  | { type: "MAI_SCORE_DRIVE_STATUS"; protocolVersion: number }
  | { type: "MAI_SCORE_DRIVE_DISCONNECT"; protocolVersion: number };

export type DriveBridgeResponse =
  | { ok: true; connected: boolean; warning?: string }
  | { ok: false; reason: "error"; error: string };

export interface DriveBridgeDeps {
  auth: AuthDeps;
  storage: DrivePreferenceStorage;
}

export function createDriveStatusRequest(): DriveBridgeRequest {
  return { type: "MAI_SCORE_DRIVE_STATUS", protocolVersion: CONNECTION_PROTOCOL_VERSION };
}

export function createDriveDisconnectRequest(): DriveBridgeRequest {
  return { type: "MAI_SCORE_DRIVE_DISCONNECT", protocolVersion: CONNECTION_PROTOCOL_VERSION };
}

export function isDriveBridgeRequest(value: unknown): value is DriveBridgeRequest {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<DriveBridgeRequest>;
  return message.protocolVersion === CONNECTION_PROTOCOL_VERSION
    && (message.type === "MAI_SCORE_DRIVE_STATUS" || message.type === "MAI_SCORE_DRIVE_DISCONNECT");
}

export async function performDriveBridgeRequest(
  deps: DriveBridgeDeps,
  request: DriveBridgeRequest
): Promise<DriveBridgeResponse> {
  if (request.type === "MAI_SCORE_DRIVE_STATUS") {
    if (!await driveEnabled(deps.storage)) return { ok: true, connected: false };
    return {
      ok: true,
      connected: await driveConnection(deps.auth) === "connected"
    };
  }

  // Persist the user's explicit disconnect before attempting the remote
  // revocation. Even if Google is unreachable, later status checks must not
  // silently reacquire a cached grant.
  await setDriveEnabled(deps.storage, false);
  try {
    await disconnectDrive(deps.auth);
    return { ok: true, connected: false };
  } catch (error) {
    return {
      ok: true,
      connected: false,
      warning: error instanceof Error ? error.message : String(error)
    };
  }
}
