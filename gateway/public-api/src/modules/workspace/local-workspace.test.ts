import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Request, type Response } from "express";
import type { Server } from "node:http";
import {
  LOCAL_ORG_ID,
  isLocalWorkspaceRequest,
  localWorkspaceBoundary,
  localWorkspaceUser,
  workspaceMode,
} from "./local-workspace.js";
import {
  requireUser,
  verifyPassword,
} from "../../middlewares/auth.middleware.js";
import { EntitlementService } from "../billing/entitlement.service.js";

const db = vi.hoisted(() => ({
  organization: { upsert: vi.fn() },
  user: { upsert: vi.fn() },
  userSession: { findUnique: vi.fn() },
  subscription: { findFirst: vi.fn() },
  creditEntry: { findMany: vi.fn(), create: vi.fn() },
}));
vi.mock("@x-hunter/db", () => ({ getPrisma: () => db }));

let server: Server | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENHUNTER_MODE", "local");
  vi.stubEnv("NODE_ENV", "test");
  db.organization.upsert.mockResolvedValue({ id: LOCAL_ORG_ID });
  db.user.upsert.mockResolvedValue({
    id: "openhunter_local_operator",
    organizationId: LOCAL_ORG_ID,
    email: "operator@openhunter.invalid",
    role: "owner",
  });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
});

describe("local request boundary", () => {
  it.each(["localhost:4000", "127.0.0.1:4000", "[::1]:4000"])(
    "allows loopback CLI Host %s",
    (host) => {
      expect(isLocalWorkspaceRequest({ headers: { host } })).toBe(true);
    },
  );
  it.each([
    { host: "attacker.example" },
    { host: "localhost.attacker.example" },
    { host: "192.168.1.10" },
    { host: "localhost:4000", origin: "https://attacker.example" },
    { host: "localhost:4000", origin: "null" },
    { host: "localhost:4000", origin: "http://localhost:9876" },
    { host: "localhost:4000", origin: "http://localhost:3001/path" },
    { host: "localhost:4000", "sec-fetch-site": "cross-site" },
    { "x-forwarded-host": "localhost:4000" },
  ])("rejects unsafe Host/Origin/Fetch Metadata %j", (headers) => {
    expect(isLocalWorkspaceRequest({ headers })).toBe(false);
  });
  it("allows the local UI through the API proxy", () => {
    expect(
      isLocalWorkspaceRequest({
        headers: { host: "localhost:4000", origin: "http://localhost:3001" },
      }),
    ).toBe(true);
    expect(
      isLocalWorkspaceRequest({
        headers: { host: "localhost:3001", origin: "http://localhost:3001" },
      }),
    ).toBe(true);
  });
  it("only extends CORS to explicitly configured loopback UI origins", () => {
    vi.stubEnv(
      "LOCAL_UI_ORIGINS",
      "http://localhost:5173,https://attacker.example",
    );
    expect(
      isLocalWorkspaceRequest({
        headers: { host: "localhost:4000", origin: "http://localhost:5173" },
      }),
    ).toBe(true);
    expect(
      isLocalWorkspaceRequest({
        headers: { host: "localhost:4000", origin: "https://attacker.example" },
      }),
    ).toBe(false);
  });
});

describe("workspace identity", () => {
  it("upserts the same isolated identity without creating a password or session", async () => {
    expect(await localWorkspaceUser()).toEqual(await localWorkspaceUser());
    expect(db.organization.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: LOCAL_ORG_ID }, update: {} }),
    );
    const create = db.user.upsert.mock.calls[0][0].create;
    expect(create.organizationId).toBe(LOCAL_ORG_ID);
    expect(verifyPassword("anything", create.passwordHash)).toBe(false);
    expect(db.userSession.findUnique).not.toHaveBeenCalled();
  });
  it("fails closed when an existing identity belongs to another organization", async () => {
    db.user.upsert.mockResolvedValue({
      organizationId: "hosted_org",
      role: "owner",
    });
    await expect(localWorkspaceUser()).rejects.toThrow("conflicts");
  });
  it("keeps production authenticated unless local is explicitly selected", () => {
    vi.stubEnv("OPENHUNTER_MODE", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(workspaceMode()).toBe("hosted");
    vi.stubEnv("OPENHUNTER_MODE", "local");
    expect(workspaceMode()).toBe("local");
    vi.stubEnv("OPENHUNTER_MODE", "typo");
    expect(workspaceMode).toThrow("local or hosted");
  });
});

async function request(headers: Record<string, string> = {}) {
  const app = express();
  app.use(localWorkspaceBoundary);
  app.get("/project", requireUser, (req, res) =>
    res.json({ orgId: req.user!.orgId }),
  );
  app.use((error: Error, _req: Request, res: Response, _next: unknown) =>
    res.status(503).json({ error: error.message }),
  );
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address() as { port: number };
  return fetch("http://127.0.0.1:" + address.port + "/project", { headers });
}

describe("auth mode integration", () => {
  it("serves a protected route without login or cookies locally", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ orgId: LOCAL_ORG_ID });
  });
  it("rejects foreign websites before bootstrapping an identity", async () => {
    const response = await request({ Origin: "https://attacker.example" });
    expect(response.status).toBe(403);
    expect(db.organization.upsert).not.toHaveBeenCalled();
  });
  it("still requires a session in hosted mode", async () => {
    vi.stubEnv("OPENHUNTER_MODE", "hosted");
    const response = await request();
    expect(response.status).toBe(401);
    expect(db.organization.upsert).not.toHaveBeenCalled();
  });
  it("does not let a failed bootstrap pass authentication", async () => {
    db.organization.upsert.mockRejectedValue(new Error("database unavailable"));
    const response = await request();
    expect(response.status).toBe(503);
  });
});

describe("local entitlements", () => {
  it("requires no subscription or credits only for the local identity", async () => {
    await new EntitlementService().assertCanScan(
      "project",
      LOCAL_ORG_ID,
      "enterprise_payg",
    );
    expect(db.creditEntry.findMany).not.toHaveBeenCalled();
    expect(db.creditEntry.create).not.toHaveBeenCalled();
  });
  it("retains subscription enforcement for other organizations", async () => {
    db.subscription.findFirst.mockResolvedValue(null);
    await expect(
      new EntitlementService().assertCanScan(
        "project",
        "hosted_org",
        "ai_blackhat_mindset_check",
      ),
    ).rejects.toThrow();
  });
  it("does not bypass billing in hosted mode, even for the reserved ID", async () => {
    vi.stubEnv("OPENHUNTER_MODE", "hosted");
    db.creditEntry.findMany.mockResolvedValue([]);
    await expect(
      new EntitlementService().assertCanScan(
        "project",
        LOCAL_ORG_ID,
        "enterprise_payg",
      ),
    ).rejects.toThrow();
    expect(db.creditEntry.create).not.toHaveBeenCalled();
  });
});
