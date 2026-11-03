// src/protocol/validator.js
import { STATES } from "./states.js";

export function validate(msg, { taskId, allowed }) {
  const errs = [];
  for (const k of ["MESSAGE_ID", "STATE", "TASK_ID", "ITERATION", "EXECUTOR"])
    if (!msg[k]) errs.push(`thiếu ${k}`);
  if (msg.STATE && !STATES.includes(msg.STATE)) errs.push(`STATE lạ: ${msg.STATE}`);
  if (allowed && msg.STATE && !allowed.includes(msg.STATE)) errs.push(`STATE ${msg.STATE} không hợp lệ ở bước này`);
  if (taskId && msg.TASK_ID && msg.TASK_ID !== taskId) errs.push(`TASK_ID sai: ${msg.TASK_ID}`);
  if (msg.ITERATION && Number.isNaN(Number(msg.ITERATION))) errs.push("ITERATION không phải số");
  return errs;
}