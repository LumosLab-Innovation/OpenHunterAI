import type { IncomingMessage } from "node:http";
import type { Request, Response, NextFunction } from "express";
import { getPrisma } from "@x-hunter/db";
import type { SessionUser } from "../../middlewares/auth.middleware.js";

export const LOCAL_ORG_ID = "openhunter_local_workspace";

export function workspaceMode(): "local" | "hosted" {
  const mode = process.env.OPENHUNTER_MODE;
  if (mode === "local" || mode === "hosted") return mode;
  if (mode) {
    throw new Error("OPENHUNTER_MODE must be local or hosted");
  }
  return ["production", "test"].includes(process.env.NODE_ENV ?? "")
    ? "hosted"
    : "local";
}

// Validate the real Host and browser Origin, not proxy-supplied forwarding headers.
// Local Docker publishes the API and its same-origin frontend on loopback only.
export function isLocalWorkspaceRequest(
  req: Pick<IncomingMessage, "headers">,
): boolean {
  const host = req.headers.host;
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
    const configured = (process.env.LOCAL_UI_ORIGINS ?? "")
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
  const prisma = getPrisma();
  const org = await prisma.organization.upsert({
    where: { id: LOCAL_ORG_ID },
    create: {
      id: LOCAL_ORG_ID,
      name: "Local workspace",
      slug: "openhunter-local-workspace",
    },
    update: {},
  });
  const user = await prisma.user.upsert({
    where: { id: "openhunter_local_operator" },
    create: {
      id: "openhunter_local_operator",
      organizationId: org.id,
      email: "operator@openhunter.invalid",
      displayName: "Local operator",
      role: "owner",
      passwordHash: "local-only:no-password-login",
    },
    update: {},
  });
  if (user.organizationId !== org.id || user.role !== "owner") {
    throw new Error("Local workspace identity conflicts with existing data");
  }
  return { userId: user.id, orgId: org.id, email: user.email, role: user.role };
}
