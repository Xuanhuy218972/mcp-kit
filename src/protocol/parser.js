// src/protocol/parser.js
const KEYS = ["MESSAGE_ID", "STATE", "TASK_ID", "ITERATION", "EXECUTOR",
              "PLAN", "ISSUES", "REQUIRED_FIXES", "SUMMARY", "TESTS"];

export function parseC2C(raw) {
  const blocks = [...raw.matchAll(/<<<C2C_BEGIN>>>([\s\S]*?)<<<C2C_END>>>/g)];
  let body = '';
  if (blocks.length > 0) {
    body = blocks[blocks.length - 1][1]; // lấy block cuối cùng
  } else if (/STATE:\s*(PLAN_APPROVED|PLAN_REJECTED|REVIEW_PASSED|REVIEW_FAILED)/i.test(raw)) {
    // Fallback: nếu AI vô tình không in delimiter nhưng in đúng các trường protocol C2C
    body = raw;
  } else {
    throw new Error("NO_C2C_BLOCK");
  }

  const out = {};
  let cur = null;
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (m && KEYS.includes(m[1])) {
      cur = m[1];
      out[cur] = m[2];
    } else if (cur) {
      out[cur] += "\n" + line;
    }
  }
  for (const k of Object.keys(out)) out[k] = out[k].trim();
  return out;
}