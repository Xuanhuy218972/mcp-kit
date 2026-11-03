// src/workflow/task-manager.js
import fs from "node:fs";
import path from "node:path";
import { TASK_DIR } from "../utils/paths.js";
import { canGo } from "./state-machine.js";

const file = (id) => path.join(TASK_DIR, `${id}.json`);

export function loadTask(id) {
  return fs.existsSync(file(id)) ? JSON.parse(fs.readFileSync(file(id), "utf8")) : null;
}
export function saveTask(t) {
  fs.mkdirSync(TASK_DIR, { recursive: true });
  t.updatedAt = new Date().toISOString();
  fs.writeFileSync(file(t.taskId), JSON.stringify(t, null, 2));
}
export function newTask({ taskId, requirement, repository }) {
  const t = { taskId, requirement, repository, state: "TASK_RECEIVED", iteration: 0,
              conversationUrl: null, lastMessage: null, history: [] };
  saveTask(t);
  return t;
}
export function transition(t, to, note = "") {
  if (!canGo(t.state, to)) throw new Error(`Chuyển trạng thái sai: ${t.state} → ${to}`);
  t.history.push({ at: new Date().toISOString(), from: t.state, to, note });
  t.state = to;
  saveTask(t);
}
export function deleteTask(id) { if (fs.existsSync(file(id))) fs.unlinkSync(file(id)); }