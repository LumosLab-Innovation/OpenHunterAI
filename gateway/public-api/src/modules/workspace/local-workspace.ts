import type { IncomingMessage } from "node:http";
import type { Request, Response, NextFunction } from "express";
import { getPrisma } from "@x-hunter/db";
import type { SessionUser } from "../../middlewares/auth.middleware.js";

export function workspaceMode(): "local" | "hosted" {
  const mode = process.env.OPENHUNTER_MODE;
  if (mode === "local" || mode === "hosted") return mode;
  if (mode) {
    throw new Error("OPENHUNTER_MODE must be local or hosted");
  }
  if (process.env.OPENHUNTER_LOCAL_MODE === "1") return "local";
  if (process.env.OPENHUNTER_LOCAL_MODE === "0") return "hosted";
  return ["production", "test"].includes(process.env.NODE_ENV ?? "")
    ? "hosted"
    : "local";
}

// Validate the real Host and browser Origin, not proxy-supplied forwarding headers.
// Local Docker publishes the API and its same-origin frontend on loopback only.
export function isLocalWorkspaceRequest(
  req: Pick<IncomingMessage, "headers">,
): boolean {
  const host = req.headers.host?.toLowerCase();
  if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))
    return false;
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  if (!origin) return true; // CLI clients do not send Origin.
  try {
    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol) || origin !== url.origin)
      return false;
    const defaults = [
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://[::1]:3001",
    ];
    const configured = [process.env.OPENHUNTER_LOCAL_UI_ORIGINS, process.env.LOCAL_UI_ORIGINS]
      .filter(Boolean)
      .join(",")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      (url.host === host || [...defaults, ...configured].includes(origin))
    );
  } catch {
    return false;
  }
}

export function localWorkspaceBoundary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (workspaceMode() === "local" && !isLocalWorkspaceRequest(req)) {
    res
      .status(403)
      .json({
        error: {
          code: "LOCAL_ONLY",
          message: "Open the local workspace at http://localhost:3001.",
        },
      });
    return;
  }
  next();
}

export async function localWorkspaceUser(): Promise<SessionUser> {
  if (workspaceMode() !== "local") {
    throw new Error("Local workspace bootstrap is unavailable in hosted mode");
  }
  const prisma = getPrisma();
  const org = await prisma.organization.upsert({
    where: { slug: "openhunter-local" },
    create: {
      name: "Local",
      slug: "openhunter-local",
    },
    update: {},
  });
  const user = await prisma.user.upsert({
    where: { email: "local@openhunter.invalid" },
    create: {
      organizationId: org.id,
      email: "local@openhunter.invalid",
      displayName: "Local operator",
      role: "owner",
      passwordHash: "!local-mode-no-password",
    },
    update: {},
  });
  if (user.organizationId !== org.id || user.role !== "owner") {
    throw new Error("Local workspace identity conflicts with existing data");
  }
  return { userId: user.id, orgId: org.id, email: user.email, role: user.role };
}
