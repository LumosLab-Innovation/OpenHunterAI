export const HUNTER_PHASES = [
  'recon',
  'routing',
  'scenario_execution',
  'candidate_collection',
  'independent_triage',
  'reporting',
] as const;

export type HunterPhase = (typeof HUNTER_PHASES)[number];
export type ScenarioState = 'queued' | 'running' | 'completed' | 'blocked' | 'skipped';

export interface HunterScenario {
  id: string;
  hunterId: string;
  state: ScenarioState;
  evidenceRefs: string[];
  coverageGap?: string;
}

export interface HunterCheckpoint {
  scanId: string;
  phase: HunterPhase;
  completedScenarioIds: string[];
  pendingScenarioIds: string[];
  updatedAt: string;
}

export interface ScenarioCoverage {
  attempted: number;
  completed: number;
  skipped: number;
  blocked: number;
  pending: number;
  gaps: string[];
  canFinalize: boolean;
}

const ALLOWED_TRANSITIONS: Record<ScenarioState, ReadonlySet<ScenarioState>> = {
  queued: new Set(['running', 'skipped', 'blocked']),
  running: new Set(['completed', 'blocked']),
  completed: new Set(),
  blocked: new Set(['running', 'skipped']),
  skipped: new Set(),
};

export function canTransitionScenario(from: ScenarioState, to: ScenarioState): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].has(to);
}

/** Coverage accounting prevents a scan from silently finalizing with backlog. */
export function summarizeScenarioCoverage(scenarios: HunterScenario[]): ScenarioCoverage {
  const completed = scenarios.filter((s) => s.state === 'completed').length;
  const skipped = scenarios.filter((s) => s.state === 'skipped').length;
  const blocked = scenarios.filter((s) => s.state === 'blocked').length;
  const pending = scenarios.filter((s) => s.state === 'queued' || s.state === 'running').length;
  const gaps = scenarios
    .filter((s) => s.state === 'blocked' || s.state === 'skipped')
    .map((s) => s.coverageGap?.trim() || `${s.hunterId}:${s.state}`);
  return {
    attempted: scenarios.length - scenarios.filter((s) => s.state === 'queued').length,
    completed,
    skipped,
    blocked,
    pending,
    gaps,
    canFinalize: pending === 0,
  };
}

export function buildHunterCheckpoint(scanId: string, phase: HunterPhase, scenarios: HunterScenario[]): HunterCheckpoint {
  return {
    scanId,
    phase,
    completedScenarioIds: scenarios.filter((s) => s.state === 'completed').map((s) => s.id),
    pendingScenarioIds: scenarios.filter((s) => s.state === 'queued' || s.state === 'running' || s.state === 'blocked').map((s) => s.id),
    updatedAt: new Date().toISOString(),
  };
}
