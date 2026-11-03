// src/utils/log.js
import fs from "node:fs";
import path from "node:path";
import { LOG_DIR } from "./paths.js";

export function log(taskId, msg) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(path.join(LOG_DIR, `${taskId || "server"}.log`), line + "\n");
  console.error(line);
}