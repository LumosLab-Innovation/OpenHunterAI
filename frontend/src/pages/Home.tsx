import {
  ArrowRight,
  FileCheck2,
  Crosshair,
  Radar,
  ScanLine,
  ShieldCheck,
  Lock,
  EyeOff,
  GitPullRequestArrow,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { ButtonLink } from '../components/ui/ButtonLink';
import { Card } from '../components/ui/Card';
import { cn } from '../lib/cn';

const STEPS = [
  { icon: ShieldCheck, title: 'Verify & authorize', body: 'Prove domain ownership and create an immutable scan authorization. No verified scope, no scan.' },
  { icon: ScanLine, title: 'Run the pipeline', body: 'A deterministic Scan Plan drives browser inspection plus Z/N/O/S stages within your scope.' },
  { icon: Crosshair, title: 'Triage findings', body: 'Sanitized evidence becomes ranked findings on a board — raw secrets never leave the boundary.' },
  { icon: FileCheck2, title: 'Report & retest', body: 'Owner summary, developer fix pack, and coverage. Retest each finding manually when you are ready.' },
];

const TIERS = [
  {
    name: 'Free Hunter',
    price: '$0',
    blurb: 'One valuable finding, then stop. Coverage report either way.',
    features: ['1 returned finding', '1 monitored finding', '1 retest', '7-day cooldown'],
    cta: 'Start free',
    to: '/register',
    featured: false,
  },
  {
    name: 'AI Black-hat Mindset Check',
    price: 'PAYG',
    blurb: 'Full attacker-mindset reasoning with controlled validation in scope.',
    features: ['Up to 50 findings', 'Controlled validation', 'Approval-gated actions', 'Full finding board'],
    cta: 'Create workspace',
    to: '/register',
    featured: true,
  },
  {
    name: 'Enterprise / PAYG',
    price: 'Custom',
    blurb: 'Monitor workspace, expanded quota, and pay-as-you-go scanning.',
    features: ['Monitor workspace', 'Expanded quota', 'Priority pipeline', 'Custom scope'],
    cta: 'Talk to us',
    to: '/register',
    featured: false,
  },
];

const GUARDRAILS = [
  { icon: Lock, text: 'Authorized targets only — verified domains inside an immutable scope.' },
  { icon: EyeOff, text: 'No raw secrets, cookies, or tokens persisted in logs, prompts, or reports.' },
  { icon: GitPullRequestArrow, text: 'Sensitive actions pass an explicit approval gate before they run.' },
];

export function HomePage() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-radar opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 lg:pt-28">
          <Badge tone="signal" className="animate-fade-up">
            <Radar className="h-3 w-3" /> Authorized security testing workspace
          </Badge>
          <h1
            className="mt-6 max-w-3xl font-display text-5xl font-900 leading-[0.95] tracking-tightest text-ink animate-fade-up sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '60ms' }}
          >
            Hunt like an attacker.
            <br />
            <span className="text-signal">Stay inside the lines.</span>
          </h1>
          <p
            className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted animate-fade-up"
            style={{ animationDelay: '120ms' }}
          >
            Verify a domain, create an immutable scan authorization, run the hunter pipeline, and turn
            sanitized evidence into findings and reports — with governed execution at every step.
          </p>
          <div
            className="mt-9 flex flex-wrap gap-3 animate-fade-up"
            style={{ animationDelay: '180ms' }}
          >
            <ButtonLink to="/register" size="lg">
              Create workspace <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink to="/login" variant="secondary" size="lg">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-hairline bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
          <h2 className="font-display text-sm font-700 uppercase tracking-wider text-ink-faint">
            The pipeline
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <Card key={title} className="relative p-5">
                <span className="text-data text-xs text-signal/70">0{i + 1}</span>
                <Icon className="mt-3 h-6 w-6 text-signal" />
                <h3 className="mt-3 font-display text-base font-700 text-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
          <h2 className="font-display text-2xl font-900 tracking-tight text-ink">
            Pick your intensity
          </h2>
          <p className="mt-2 max-w-lg text-sm text-ink-muted">
            Same Target Type, Surface Flags, and Test Intensity model across tiers — the limits change,
            not the engine.
          </p>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <Card
                key={tier.name}
                className={cn(
                  'flex flex-col p-6',
                  tier.featured && 'border-signal/50 shadow-glow',
                )}
              >
                {tier.featured && (
                  <Badge tone="signal" className="mb-3 self-start">
                    Recommended
                  </Badge>
                )}
                <h3 className="font-display text-lg font-700 text-ink">{tier.name}</h3>
                <p className="mt-3 font-display text-3xl font-900 text-ink">{tier.price}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{tier.blurb}</p>
                <ul className="mt-5 grid flex-1 gap-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-ink">
                      <span className="text-signal">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  to={tier.to}
                  variant={tier.featured ? 'primary' : 'secondary'}
                  className="mt-6"
                >
                  {tier.cta}
                </ButtonLink>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Guardrails */}
      <section className="border-t border-hairline bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
          <h2 className="font-display text-2xl font-900 tracking-tight text-ink">
            Governed by design
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {GUARDRAILS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-signal/40 bg-signal/10">
                  <Icon className="h-4 w-4 text-signal" />
                </span>
                <p className="text-sm leading-relaxed text-ink-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-ink-faint">
          <span className="text-data">OpenHunterAI</span>
          <span>Authorized external web/app security testing. Verified scope only.</span>
        </div>
      </footer>
    </div>
  );
}
