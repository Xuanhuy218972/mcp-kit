// src/workflow/state-machine.js
const T = {
  TASK_RECEIVED:    ["WAITING_FOR_PLAN"],
  WAITING_FOR_PLAN: ["PLAN_APPROVED", "PLAN_REJECTED", "ERROR"],
  PLAN_REJECTED:    ["WAITING_FOR_PLAN"],
  PLAN_APPROVED:    ["CODING"],
  CODING:           ["REVIEWING"],
  REVIEWING:        ["REVIEW_FAILED", "REVIEW_PASSED", "ERROR"],
  REVIEW_FAILED:    ["CODING", "MAX_ITERATIONS"],
  REVIEW_PASSED:    ["DONE"],
  MAX_ITERATIONS:   [],
  ERROR:            ["WAITING_FOR_PLAN", "REVIEWING"],
  DONE:             [],
};
export function canGo(from, to) { return (T[from] || []).includes(to); }