/**
 * OrcaRouter Cyber Inference settings API.
 *
 * Two explicit authentication choices: paste an API key, or connect through
 * OAuth 2.0 + PKCE. Both end in the same durable key; nothing downstream
 * branches on the source.
 */

import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requireAllowedOrigin, requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import {
  cancelPkce,
  clearApiKey,
  modelsFor,
  pkceAttempt,
  providerStatus,
  saveApiKey,
  startPkce,
  submitPkceCode,
} from './orcarouter.service.js';
import type { OrcaCapability } from '@x-hunter/llm-gateway';

export const orcaRouterRoutes = Router();

orcaRouterRoutes.use(requireUser);

orcaRouterRoutes.get(
  '/',
  asyncRoute(async (_req, res) => {
    res.json(await providerStatus());
  }),
);

const apiKeyBody = z.object({ apiKey: z.string().min(1).max(400) });

orcaRouterRoutes.post(
  '/credentials/api-key',
  requireAllowedOrigin,
  asyncRoute(async (req, res) => {
    const parsed = apiKeyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Paste an OrcaRouter API key.' },
      });
      return;
    }
    const result = await saveApiKey(parsed.data.apiKey);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({
      authenticated: true,
      source: result.credential.source,
      maskedKey: result.maskedKey,
    });
  }),
);

orcaRouterRoutes.delete(
  '/credentials',
  requireAllowedOrigin,
  asyncRoute(async (_req, res) => {
    await clearApiKey();
    res.status(204).end();
  }),
);

const startBody = z.object({ mode: z.enum(['loopback', 'oob']).default('loopback') });

orcaRouterRoutes.post(
  '/oauth/start',
  requireAllowedOrigin,
  asyncRoute(async (req, res) => {
    const parsed = startBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Unsupported sign-in mode.' } });
      return;
    }
    const user = currentUser(req);
    const view = await startPkce(user.userId, parsed.data.mode);
    res.status(201).json(view);
  }),
);

orcaRouterRoutes.get(
  '/oauth/:attemptId',
  asyncRoute(async (req, res) => {
    const user = currentUser(req);
    const view = await pkceAttempt(user.userId, req.params.attemptId);
    if (!view) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Sign-in attempt not found.' } });
      return;
    }
    res.json(view);
  }),
);

const codeBody = z.object({ code: z.string().min(1).max(400) });

orcaRouterRoutes.post(
  '/oauth/:attemptId/code',
  requireAllowedOrigin,
  asyncRoute(async (req, res) => {
    const parsed = codeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Paste the code shown by OrcaRouter.' } });
      return;
    }
    const user = currentUser(req);
    const view = await submitPkceCode(user.userId, req.params.attemptId, parsed.data.code);
    if (!view) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Sign-in attempt not found.' } });
      return;
    }
    res.json(view);
  }),
);

orcaRouterRoutes.post(
  '/oauth/:attemptId/cancel',
  requireAllowedOrigin,
  asyncRoute(async (req, res) => {
    const user = currentUser(req);
    const cancelled = cancelPkce(user.userId, req.params.attemptId);
    res.status(cancelled ? 204 : 404).end();
  }),
);

const capabilitySchema = z.enum(['chat', 'embedding', 'image', 'video', 'rerank']);

orcaRouterRoutes.get(
  '/models',
  asyncRoute(async (req, res) => {
    const capability = capabilitySchema.safeParse(req.query.capability ?? 'chat');
    if (!capability.success) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Unsupported capability.' } });
      return;
    }
    const input = String(req.query.input ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => ['image', 'audio', 'video'].includes(value));
    const result = await modelsFor(capability.data as OrcaCapability, input, req.query.refresh === '1');
    res.json({
      capability: result.capability,
      source: result.source,
      degraded: result.degraded,
      catalogSource: result.catalogSource,
      modelCount: result.models.length,
      models: result.models.map((model) => ({
        id: model.id,
        name: model.name,
        contextLength: model.contextLength,
        inputModalities: model.inputModalities,
        reasoningEfforts: model.reasoningEfforts,
        fromSeed: model.fromSeed,
      })),
      error: result.error,
    });
  }),
);
