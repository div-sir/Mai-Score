export interface PlayGoal {
  chartKey: string;
  target: number;
  note: string;
}
export interface PlayQueue { schema: "mai-score/play-queue/v1"; goals: PlayGoal[] }
export const QUEUE_KEY = "mai-score:play-queue:v1";
export const emptyQueue = (): PlayQueue => ({ schema: "mai-score/play-queue/v1", goals: [] });

/** Reject unsupported or malformed persisted data without overwriting it. */
export function parseQueue(raw: string | null): PlayQueue {
  if (raw === null) return emptyQueue();
  if (raw.length > 500_000) throw new Error("Queue exceeds size limit");
  const value = JSON.parse(raw);
  if (!value || value.schema !== "mai-score/play-queue/v1" || !Array.isArray(value.goals) || value.goals.length > 200) throw new Error("Invalid queue schema");
  const seen = new Set<string>();
  const goals = value.goals.map((goal: unknown): PlayGoal => {
    if (!goal || typeof goal !== "object") throw new Error("Invalid goal");
    const item = goal as Record<string, unknown>;
    if (typeof item.chartKey !== "string" || !item.chartKey.trim() || item.chartKey.length > 512
      || typeof item.target !== "number" || !Number.isFinite(item.target) || item.target < 0 || item.target > 100.5
      || typeof item.note !== "string" || item.note.length > 1000 || seen.has(item.chartKey)) throw new Error("Invalid goal fields");
    seen.add(item.chartKey);
    return { chartKey: item.chartKey, target: item.target, note: item.note };
  });
  return { schema: "mai-score/play-queue/v1", goals };
}

export function setQueueGoal(queue: PlayQueue, goal: PlayGoal): PlayQueue {
  const index = queue.goals.findIndex(item => item.chartKey === goal.chartKey);
  const goals = [...queue.goals];
  if (index < 0) goals.push(goal); else goals[index] = goal;
  return parseQueue(JSON.stringify({ schema: queue.schema, goals }));
}

export function saveQueue(storage: Pick<Storage, "setItem">, queue: PlayQueue): void {
  const validated = parseQueue(JSON.stringify(queue));
  // Storage failures must reach the caller so the UI cannot claim a successful save.
  storage.setItem(QUEUE_KEY, JSON.stringify(validated));
}
