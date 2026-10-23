import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Field';
import { OrcaRouterProviderPanel } from '../orcarouter/OrcaRouterProviderPanel';

interface RouteHop { cli?: string; provider?: string; model: string; reasoningLevel?: string; accepted: boolean; reason?: string }
interface RoutePreview { useCase: string; primary: RouteHop; fallback: RouteHop; coverageGap?: string }
interface RouteSettings { preview: RoutePreview[]; probedAt: string | null; completion: string; configError: string | null }

export function ReasoningSettings() {
  const [routeSettings, setRouteSettings] = useState<RouteSettings | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeUseCase, setRouteUseCase] = useState('signal_summary');
  const [routeSlot, setRouteSlot] = useState<'primary' | 'fallback'>('primary');
  const [routeCli, setRouteCli] = useState('codex');
  const [routeModel, setRouteModel] = useState('cli-default');
  const [routeLevel, setRouteLevel] = useState('low');
  const [routeBusy, setRouteBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void apiFetch<RouteSettings>('/v1/llm-routes').then((result) => {
      if (!active) return;
      if (!result.ok) setRouteError(result.error.message ?? 'Reasoning routes could not be loaded.');
      else setRouteSettings(result.data);
    });
    return () => { active = false; };
  }, []);

  return <div className="space-y-6">
      <section aria-labelledby="reasoning-routes-title" className="space-y-3">
        <h2 id="reasoning-routes-title" className="font-display text-lg font-700 text-ink">Reasoning routes</h2>
        <p className="mt-1 text-sm text-ink-muted">Model routes are captured when each scan starts. Probe availability before running.</p>
        {routeError && <p className="mt-3 text-sm text-ink-muted">{routeError}</p>}
        {routeSettings && (
          <>
            <ul className="mt-4 divide-y divide-hairline border-y border-hairline text-xs">
              {routeSettings.preview.map((row) => (
                <li key={row.useCase} className="grid gap-1 py-2 sm:grid-cols-2">
                  <span className="font-medium text-ink">{row.useCase}</span>
                  <span className="text-ink-muted">
                    primary {row.primary.cli ?? row.primary.provider}/{row.primary.model}/{row.primary.reasoningLevel ?? 'api'} {row.primary.accepted ? 'accepted' : row.primary.reason ?? 'not accepted'}
                    {'; '}
                    fallback {row.fallback.cli ?? row.fallback.provider}/{row.fallback.model}/{row.fallback.reasoningLevel ?? 'api'} {row.fallback.accepted ? 'accepted' : row.fallback.reason ?? 'not accepted'}
                  </span>
                </li>
              ))}
            </ul>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              setRouteBusy(true);
              setRouteError(null);
              const route = routeCli === 'openai' || routeCli === 'deepseek'
                ? { transport: 'api_key', provider: routeCli, model: routeModel }
                : { transport: 'coding_cli', cli: routeCli, model: routeModel, reasoningLevel: routeLevel };
              void apiFetch<RouteSettings>('/v1/llm-routes', {
                method: 'PUT',
                body: JSON.stringify({ update: { useCase: routeUseCase, slot: routeSlot, route } }),
              }).then((result) => {
                if (!result.ok) setRouteError(result.error.message ?? 'Route was not saved.');
                else setRouteSettings(result.data);
              }).finally(() => setRouteBusy(false));
            }}>
              <Select aria-label="Reasoning module" value={routeUseCase} onChange={(event) => setRouteUseCase(event.target.value)}>
                {(routeSettings.preview).map((row) => <option key={row.useCase} value={row.useCase}>{row.useCase}</option>)}
              </Select>
              <Select aria-label="Route slot" value={routeSlot} onChange={(event) => setRouteSlot(event.target.value as 'primary' | 'fallback')}>
                <option value="primary">primary</option>
                <option value="fallback">fallback</option>
              </Select>
              <Select aria-label="Coding CLI or API provider" value={routeCli} onChange={(event) => setRouteCli(event.target.value)}>
                {['codex', 'claude', 'gemini', 'grok', 'openai', 'deepseek'].map((cli) => <option key={cli} value={cli}>{cli}</option>)}
              </Select>
              <Select aria-label="Reasoning level" value={routeLevel} onChange={(event) => setRouteLevel(event.target.value)}>
                {['low', 'medium', 'high', 'xhigh'].map((level) => <option key={level} value={level}>{level}</option>)}
              </Select>
              <Input aria-label="Model" value={routeModel} onChange={(event) => setRouteModel(event.target.value)} />
              <div className="flex gap-2">
                <Button type="submit" disabled={routeBusy}>Save route</Button>
                <Button type="button" variant="ghost" disabled={routeBusy} onClick={() => {
                  setRouteBusy(true);
                  setRouteError(null);
                  void apiFetch<RouteSettings>('/v1/llm-routes/probe', { method: 'POST', body: '{}' }).then((result) => {
                    if (!result.ok) setRouteError(result.error.message ?? 'CLI probe did not finish.');
                    else setRouteSettings(result.data);
                  }).finally(() => setRouteBusy(false));
                }}>Probe CLIs</Button>
              </div>
            </form>
            <p className="mt-2 text-xs text-ink-faint">
              {routeSettings.probedAt ? `Last probe ${routeSettings.probedAt}. ` : 'No probe stored. '}
              {routeSettings.completion}. Unprobed routes stay not accepted. This is not a finding or scan gate.
            </p>
          </>
        )}
      </section>

<details className="border-t border-hairline pt-4"><summary className="cursor-pointer text-sm font-medium">OrcaRouter connection</summary><div className="mt-4"><OrcaRouterProviderPanel /></div></details></div>;
}
