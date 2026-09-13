#!/usr/bin/env node
// Read-only, dependency-free local workspace client. Never sends cookies or keys.
import { pathToFileURL } from "node:url";

export function buildRequest(command, id, base = "http://127.0.0.1:4000") {
  const url = new URL(base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "OPENHUNTER_API_BASE must be a loopback HTTP(S) URL without credentials, query or fragment.",
    );
  }
  const routes = {
    status: "/v1/workspace/status",
    projects: "/v1/projects",
    scan: "/v1/scans/",
    findings: "/v1/findings",
    report: "/v1/reports/",
  };
  if (!Object.hasOwn(routes, command))
    throw new Error(
      "Usage: openhunter.mjs <status|projects|scan ID|findings SCAN_ID|report ID>",
    );
  if (
    ["scan", "findings", "report"].includes(command) &&
    !/^[A-Za-z0-9_-]+$/.test(id ?? "")
  ) {
    throw new Error("A valid ID is required.");
  }
  return (
    base.replace(/\/$/, "") +
    routes[command] +
    (["scan", "report"].includes(command) ? encodeURIComponent(id) : "")
  );
}

export function selectFindings(data, scanId) {
  if (!Array.isArray(data.findings))
    throw new Error("Unexpected findings response.");
  return {
    findings: data.findings.filter((finding) => finding.scanJobId === scanId),
  };
}

async function main() {
  try {
    const target = buildRequest(
      process.argv[2] ?? "status",
      process.argv[3],
      process.env.OPENHUNTER_API_BASE,
    );
    const response = await fetch(target, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        "Workspace returned HTTP " +
          response.status +
          ". Check local mode and runtime status.",
      );
    const data = await response.json();
    if (data.mode && data.mode !== "local")
      throw new Error(
        "This helper only supports local workspaces; use hosted authentication for this deployment.",
      );
    const selected =
      process.argv[2] === "findings"
        ? selectFindings(data, process.argv[3])
        : data;
    console.log(JSON.stringify(selected, null, 2));
  } catch (error) {
    console.error(
      "OpenHunter: " +
        error.message +
        "\nStart the local workspace in its checkout: node ops/local.mjs start",
    );
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
