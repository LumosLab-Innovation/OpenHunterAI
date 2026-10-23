import { Router } from "express";
import { createConnection } from "node:net";
import { getPrisma } from "@x-hunter/db";
import { requireUser } from "../../middlewares/auth.middleware.js";
import { asyncRoute } from "../../middlewares/async-route.middleware.js";
import { workspaceMode } from "./local-workspace.js";

export const workspaceRoutes = Router();

workspaceRoutes.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ mode: workspaceMode() });
});

workspaceRoutes.get(
  "/status",
  requireUser,
  asyncRoute(async (req, res) => {
    const queue = await queueReachable();
    const models = ["LOW", "HIGH"].map((role) => {
      const provider =
        process.env[`LLM_${role}_REASONING_PROVIDER`] ?? "deepseek";
      const model = process.env[`LLM_${role}_REASONING_MODEL`] ?? "";
      const configured = Boolean(
        model &&
          ((provider === "openai" && process.env.OPENAI_API_KEY) ||
            (provider === "deepseek" && process.env.DEEPSEEK_API_KEY) ||
            (provider === "orcarouter" && process.env.ORCAROUTER_API_KEY)),
      );
      return { role: role.toLowerCase(), provider, model, configured };
    });
    const user = await getPrisma().user.findUnique({
      where: { id: req.user!.userId },
      include: { organization: true },
    });
    res.json({
      mode: workspaceMode(),
      workspace: { name: user?.organization.name ?? "Workspace" },
      user: {
        id: req.user!.userId,
        email: req.user!.email,
        displayName: user?.displayName,
      },
      services: {
        api: "connected",
        database: "connected",
        queue: queue ? "connected" : "unavailable",
      },
      models,
    });
  }),
);

function queueReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(process.env.NATS_URL ?? "nats://127.0.0.1:4222");
    } catch {
      resolve(false);
      return;
    }
    const socket = createConnection({
      host: url.hostname,
      port: Number(url.port || 4222),
    });
    const finish = (ready: boolean) => {
      socket.destroy();
      resolve(ready);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}
