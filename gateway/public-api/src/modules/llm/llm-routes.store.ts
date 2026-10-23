import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  defaultModuleRouteConfig,
  validateModuleRouteConfig,
  type CliProbeResult,
  type CodingCliName,
  type LlmUseCase,
  type ModuleRoute,
  type ModuleRouteConfig,
} from '@x-hunter/shared';

export interface StoredLlmSettings {
  version: 1;
  routes: ModuleRouteConfig;
  probes: Partial<Record<CodingCliName, CliProbeResult>>;
  probedAt?: string;
  source: 'default' | 'file';
  configError?: string;
}

export function hostHomeConfigAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.OPENHUNTER_IN_CONTAINER === '1') return false;
  if (existsSync('/.dockerenv')) return false;
  return true;
}

export function resolveRoutesPath(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.OPENHUNTER_LLM_ROUTES_PATH) return env.OPENHUNTER_LLM_ROUTES_PATH;
  if (!hostHomeConfigAllowed(env)) return null;
  return join(homedir(), '.openhunter', 'llm-module-routes.json');
}

export function loadLlmSettings(path = resolveRoutesPath()): StoredLlmSettings {
  const defaults = defaultModuleRouteConfig();
  if (!path || !existsSync(path)) {
    return { version: 1, routes: defaults, probes: {}, source: 'default' };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredLlmSettings>;
    const routes = parsed.routes ?? defaults;
    const problems = validateModuleRouteConfig(routes);
    if (problems.length > 0) {
      return {
        version: 1,
        routes: defaults,
        probes: {},
        source: 'default',
        configError: 'LLM_ROUTES_CONFIG_INVALID',
      };
    }
    return {
      version: 1,
      routes,
      probes: parsed.probes ?? {},
      ...(parsed.probedAt ? { probedAt: parsed.probedAt } : {}),
      source: 'file',
    };
  } catch {
    return {
      version: 1,
      routes: defaults,
      probes: {},
      source: 'default',
      configError: 'LLM_ROUTES_CONFIG_INVALID',
    };
  }
}

export function saveLlmSettings(
  settings: { routes: ModuleRouteConfig; probes?: Partial<Record<CodingCliName, CliProbeResult>>; probedAt?: string },
  path = resolveRoutesPath(),
): StoredLlmSettings {
  if (!path) {
    throw new Error('LLM route settings are not persisted inside a container. Set OPENHUNTER_LLM_ROUTES_PATH to an explicit file.');
  }
  const problems = validateModuleRouteConfig(settings.routes);
  if (problems.length > 0) throw new Error(problems.join('; '));
  mkdirSync(dirname(path), { recursive: true });
  const stored = {
    version: 1 as const,
    routes: settings.routes,
    probes: settings.probes ?? {},
    ...(settings.probedAt ? { probedAt: settings.probedAt } : {}),
  };
  writeFileSync(path, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');
  return { ...stored, source: 'file' };
}

export function applyRouteUpdate(
  routes: ModuleRouteConfig,
  update: { useCase: LlmUseCase; slot: 'primary' | 'fallback'; route: ModuleRoute },
): ModuleRouteConfig {
  return {
    ...routes,
    [update.useCase]: {
      ...routes[update.useCase],
      [update.slot]: update.route,
    },
  };
}
