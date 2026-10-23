import { Router } from 'express';
import {
  evaluateModuleRoutePreflight,
  isLlmUseCase,
  validateModuleRoute,
  type CodingCliName,
  type ModuleRoute,
  type ModuleRouteConfig,
} from '@x-hunter/shared';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { probeViaBridge, readBridgeCapabilities, applyBridgeCompletion } from './bridge-remote.js';
import { probeCodingClis } from './coding-cli-probe.js';
import { applyRouteUpdate, loadLlmSettings, resolveRoutesPath, saveLlmSettings } from './llm-routes.store.js';

export const llmRoutes = Router();

llmRoutes.get('/llm-routes', requireUser, asyncRoute(async (_req, res) => {
  res.json(await publicSettings());
}));

llmRoutes.put('/llm-routes', requireUser, asyncRoute(async (req, res) => {
  const current = loadLlmSettings();
  const routes = resolveReplacement(current.routes, req.body);
  const problems = routes instanceof Array ? routes : [];
  if (routes instanceof Array) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: problems.join('; ') } });
    return;
  }
  try {
    saveLlmSettings({ routes, probes: current.probes, probedAt: current.probedAt }, resolveRoutesPath());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LLM route settings were not saved';
    res.status(400).json({ error: { code: 'INVALID_INPUT', message } });
    return;
  }
  res.json(await publicSettings());
}));

llmRoutes.post('/llm-routes/probe', requireUser, asyncRoute(async (_req, res) => {
  const remote = await probeViaBridge().catch(() => null);
  const local = remote ?? Object.fromEntries((await probeCodingClis()).map((probe) => [probe.cli, {
    ...probe,
    completion: 'unavailable' as const,
    completionReason: 'BRIDGE_REQUIRED',
  }]));
  const probes = Object.values(local);
  const current = loadLlmSettings();
  const probedAt = new Date().toISOString();
  const byCli = Object.fromEntries(probes.map((probe) => [probe.cli, probe])) as Partial<Record<CodingCliName, (typeof probes)[number]>>;
  try {
    saveLlmSettings({ routes: current.routes, probes: byCli, probedAt }, resolveRoutesPath());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Probe results were not stored';
    res.status(409).json({
      error: { code: 'LLM_ROUTES_NOT_PERSISTED', message },
      probes: byCli,
    });
    return;
  }
  res.json(await publicSettings());
}));

async function publicSettings() {
  const settings = loadLlmSettings();
  const bridge = await readBridgeCapabilities();
  const preview = evaluateModuleRoutePreflight({
    config: settings.routes,
    probes: applyBridgeCompletion(settings.probes, bridge),
    bridgeReady: bridge.ready,
    profile: 'standard',
    targetType: 'static_content_website',
    authScope: 'none',
    capturedAt: settings.probedAt ?? new Date(0).toISOString(),
  });
  return {
    source: settings.source,
    pathConfigured: resolveRoutesPath() !== null,
    containerHomeBlocked: resolveRoutesPath() === null,
    configError: settings.configError ?? null,
    probedAt: settings.probedAt ?? null,
    bridgeReady: bridge.ready,
    routes: settings.routes,
    probes: settings.probes,
    preview: preview.rows,
    completion: bridge.ready ? 'bridge' : 'BRIDGE_UNAVAILABLE',
  };
}

function resolveReplacement(current: ModuleRouteConfig, body: unknown): ModuleRouteConfig | string[] {
  if (!body || typeof body !== 'object') return ['Request body must be an object'];
  const record = body as { routes?: ModuleRouteConfig; update?: { useCase?: string; slot?: string; route?: ModuleRoute } };
  if (record.routes && record.update) return ['Send either routes or update, not both'];
  if (record.update) {
    const { useCase, slot, route } = record.update;
    if (!useCase || !isLlmUseCase(useCase)) return ['update.useCase is not a reasoning module'];
    if (slot !== 'primary' && slot !== 'fallback') return ['update.slot must be primary or fallback'];
    if (!route) return ['update.route is required'];
    const problems = validateModuleRoute(route, `${useCase} ${slot}`);
    if (problems.length > 0) return problems;
    const next = applyRouteUpdate(current, { useCase, slot, route });
    const pairProblems = next[useCase].primary && JSON.stringify(next[useCase].primary) === JSON.stringify(next[useCase].fallback)
      ? [`${useCase} fallback must differ from primary`]
      : [];
    return pairProblems.length > 0 ? pairProblems : next;
  }
  if (!record.routes) return ['routes or update is required'];
  return record.routes;
}
