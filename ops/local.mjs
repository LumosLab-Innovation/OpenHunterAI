#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { readFile, writeFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const action = process.argv[2] ?? "start";
const commands = {
  start: ["up", "-d", "--build", "--wait", "--wait-timeout", "180"],
  restart: [
    "up",
    "-d",
    "--build",
    "--force-recreate",
    "--wait",
    "--wait-timeout",
    "180",
  ],
  stop: ["down"], // Named volumes are deliberately retained.
  status: ["ps", "-a"],
  logs: ["logs", "--tail", "100", ...process.argv.slice(3)],
};
if (
  !Object.hasOwn(commands, action) ||
  Number(process.versions.node.split(".")[0]) < 22
) {
  console.error(
    "Node.js 22+ required. Usage: node ops/local.mjs <start|restart|stop|status|logs [service]>",
  );
  process.exit(1);
}
function run(args, quiet = false) {
  const result = spawnSync("docker", args, {
    cwd: root,
    stdio: quiet ? "ignore" : "inherit",
  });
  return result.status ?? 1;
}
if (run(["compose", "version"], true) || run(["info"], true)) {
  console.error(
    "Docker is not ready. Install/start Docker Desktop (or Docker Engine + Compose v2), then retry.",
  );
  process.exit(1);
}
try {
  await access(envPath);
} catch {
  if (!["start", "restart"].includes(action)) {
    console.error("No local configuration yet. Run: node ops/local.mjs start");
    process.exit(1);
  }
  const template = await readFile(resolve(root, ".env.local.example"), "utf8");
  await writeFile(
    envPath,
    template.replaceAll("__GENERATE__", () => randomBytes(32).toString("hex")),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created .env.local with unique local secrets. Add your model keys there when ready.",
  );
}
const profiles = process.argv.includes("--with-browser")
  ? ["--profile", "authenticated-targets"]
  : [];
const code = run([
  "compose",
  "--project-name",
  "openhunter-local",
  "--env-file",
  ".env.local",
  "-f",
  "compose.local.yml",
  ...profiles,
  ...commands[action],
]);
if (code) {
  console.error(
    "Local stack did not complete. Inspect: node ops/local.mjs status / node ops/local.mjs logs",
  );
  process.exit(code);
}
if (["start", "restart"].includes(action)) {
  try {
    const response = await fetch(
      "http://127.0.0.1:3001/api/v1/workspace/status",
      { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok)
      throw new Error("Workspace API returned HTTP " + response.status);
    const status = await response.json();
    if (status.mode !== "local" || status.services?.database !== "connected")
      throw new Error("Workspace is not ready");
    console.log(
      "\nOpenHunterAI is ready: http://localhost:3001 — no login required.",
    );
    console.log(
      "Stop: node ops/local.mjs stop (projects and findings are retained).",
    );
    console.log(
      "AI keys and optional OpenHack/Strix runtimes: docs/LOCAL_WORKSPACE.md",
    );
  } catch (error) {
    console.error(
      "Containers started but the workspace is not ready: " + error.message,
    );
    process.exit(1);
  }
}
