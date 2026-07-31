import {
  deleteFromDrive as deleteFromExtension,
  disconnectGoogleDrive as disconnectExtension,
  driveAuthorizationUrl,
  driveConnectionStatus as extensionConnectionStatus,
  pullFromDrive as pullFromExtension,
  pushToDrive as pushToExtension,
  rememberExtensionId,
  type DriveConnectionResult,
  type DriveSyncResult
} from "./drive-client";
import { webGoogleDrive } from "./google-drive-web";

type DriveProvider = "extension" | "web";
let activeProvider: DriveProvider | undefined;

export { driveAuthorizationUrl, rememberExtensionId };

export function webDriveConfigured(): boolean {
  return webGoogleDrive.configured();
}

export async function driveConnectionStatus(): Promise<DriveConnectionResult> {
  const extension = await extensionConnectionStatus();
  if (extension.ok && extension.connected) {
    activeProvider = "extension";
    return extension;
  }

  const web = webGoogleDrive.connectionStatus();
  if (web.ok && web.connected) {
    activeProvider = "web";
    return web;
  }

  activeProvider = undefined;
  // A configured web client makes mobile and extension-free browsers valid
  // disconnected clients rather than an "Extension unavailable" dead end.
  if (webGoogleDrive.configured()) return { ok: true, connected: false };
  return extension;
}

export async function connectGoogleDriveWeb(): Promise<DriveConnectionResult> {
  const result = await webGoogleDrive.connect();
  if (result.ok && result.connected) activeProvider = "web";
  return result;
}

export function pullFromDrive(): Promise<DriveSyncResult> {
  return activeProvider === "web" ? webGoogleDrive.pull() : pullFromExtension();
}

export function pushToDrive(payload: string): Promise<DriveSyncResult> {
  return activeProvider === "web" ? webGoogleDrive.push(payload) : pushToExtension(payload);
}

export function deleteFromDrive(): Promise<DriveSyncResult> {
  return activeProvider === "web" ? webGoogleDrive.delete() : deleteFromExtension();
}

export async function disconnectGoogleDrive(): Promise<DriveConnectionResult> {
  const result = activeProvider === "web"
    ? await webGoogleDrive.disconnect()
    : await disconnectExtension();
  activeProvider = undefined;
  return result;
}
