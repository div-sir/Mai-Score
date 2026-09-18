import type { HistoryEntry } from "./history";
import type { StudioData } from "./types";

export type AutoSyncDriveState = "unavailable" | "checking" | "disconnected" | "connected";
export type AutoSyncDecision = "wait" | "sync" | "local-only";

export function decideAutoSync(
  snapshot: string | undefined,
  data: StudioData | null,
  history: readonly HistoryEntry[],
  driveState: AutoSyncDriveState,
  syncing: boolean
): AutoSyncDecision {
  if (!snapshot || !data || data.exportedAt !== snapshot || syncing) return "wait";
  if (!history.some((entry) => entry.generatedAt === snapshot)) return "wait";
  if (driveState === "checking") return "wait";
  return driveState === "connected" ? "sync" : "local-only";
}
