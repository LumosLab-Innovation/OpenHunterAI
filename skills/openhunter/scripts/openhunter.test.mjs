import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRequest, selectFindings } from "./openhunter.mjs";

test("only builds documented read-only requests", () => {
  assert.equal(
    buildRequest("status"),
    "http://127.0.0.1:4000/v1/workspace/status",
  );
  assert.equal(
    buildRequest("scan", "scan_123"),
    "http://127.0.0.1:4000/v1/scans/scan_123",
  );
  assert.equal(
    buildRequest("findings", "scan_123", "http://localhost:3001/api/"),
    "http://localhost:3001/api/v1/findings",
  );
  assert.throws(() => buildRequest("delete", "project_1"));
  assert.throws(() => buildRequest("scan", "../projects"));
});
test("filters findings by the real scanJobId field; the API list is workspace-wide", () => {
  assert.deepEqual(
    selectFindings(
      {
        findings: [
          { id: "a", scanJobId: "one" },
          { id: "b", scanJobId: "two" },
        ],
      },
      "one",
    ),
    { findings: [{ id: "a", scanJobId: "one" }] },
  );
  assert.throws(() => selectFindings({}, "one"));
});
test("rejects non-local and credential-bearing endpoints", () => {
  for (const url of [
    "https://example.com",
    "http://169.254.169.254",
    "http://localhost.evil.test",
    "http://user:pass@localhost",
    "file:///etc/passwd",
    "http://localhost?q=x",
    "http://localhost/#x",
  ]) {
    assert.throws(() => buildRequest("status", undefined, url));
  }
  assert.equal(
    buildRequest("status", undefined, "http://[::1]:4000"),
    "http://[::1]:4000/v1/workspace/status",
  );
});
