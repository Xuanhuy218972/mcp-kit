// src/utils/git.js
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
const run = promisify(execFile);

export async function git(repo, args) {
  try {
    const { stdout } = await run("git", args, { cwd: repo, maxBuffer: 20 * 1024 * 1024 });
    return stdout;
  } catch (e) {
    return `git ${args.join(" ")} failed: ${e.message}`;
  }
}

export function clip(s, max) {
  return s.length > max ? s.slice(0, max) + `\n...[TRUNCATED ${s.length - max} chars]` : s;
}

export async function repoContext(repo) {
  const files = (await git(repo, ["ls-files"])).split("\n").slice(0, 400).join("\n");
  const agentsPath = path.join(repo, "AGENTS.md");
  const agents = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, "utf8") : "(no AGENTS.md)";
  return `===== AGENTS.md =====\n${clip(agents, 6000)}\n\n===== FILE TREE (git ls-files) =====\n${files}`;
}

export async function checkpoint(repo, taskId, iteration) {
  // Lưu snapshot để rollback: commit WIP lên nhánh c2c/<taskId>
  const branch = `c2c/${taskId}`;
  await git(repo, ["checkout", "-B", branch]);
  await git(repo, ["add", "-A"]);
  await git(repo, ["commit", "--allow-empty", "--no-verify", "-m", `c2c iteration ${iteration}`]);
  await git(repo, ["tag", "-f", `c2c/${taskId}/iteration-${iteration}`]);
}