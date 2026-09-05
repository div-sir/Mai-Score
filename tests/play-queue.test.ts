import { expect, it } from "vitest";
import { emptyQueue, parseQueue, saveQueue, setQueueGoal } from "../studio/lib/play-queue";
const goal = { chartKey: '["Song","dx","master"]', target: 100.5, note: "Practice ending" };
it("round trips and updates without duplicate entries or input mutation", () => {
  const queue = setQueueGoal(emptyQueue(), goal);
  const updated = setQueueGoal(queue, { ...goal, target: 100 });
  expect(updated.goals).toHaveLength(1);
  expect(queue.goals[0].target).toBe(100.5);
  expect(parseQueue(JSON.stringify(queue))).toEqual(queue);
  expect(parseQueue(null)).toEqual(emptyQueue());
});
it("rejects malformed, unsupported, duplicate and oversized data", () => {
  for (const raw of ['{', '{}', JSON.stringify({schema:"v2",goals:[]}), JSON.stringify({...emptyQueue(),goals:[goal,goal]}), ' '.repeat(500001)]) expect(() => parseQueue(raw)).toThrow();
  for (const bad of [{...goal,target:101},{...goal,target:-1},{...goal,note:"a".repeat(1001)},{...goal,chartKey:""}]) expect(() => setQueueGoal(emptyQueue(),bad)).toThrow();
});
it("reports storage errors and does not write invalid state", () => {
  expect(() => saveQueue({ setItem: () => { throw new Error("Quota"); } }, emptyQueue())).toThrow("Quota");
  let writes = 0;
  expect(() => saveQueue({setItem:()=>{writes++;}}, {...emptyQueue(),goals:[{...goal,target:200}]})).toThrow();
  expect(writes).toBe(0);
});
