// src/utils/paths.js
import path from "node:path";
import { fileURLToPath } from "node:url";
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const TASK_DIR = path.join(ROOT, "tasks", "active");
export const LOG_DIR = path.join(ROOT, "logs");