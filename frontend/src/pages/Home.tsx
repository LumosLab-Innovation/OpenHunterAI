import {
  Activity,
  ArrowDown,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  EyeOff,
  FileCheck2,
  FileJson2,
  FileSpreadsheet,
  LockKeyhole,
  Moon,
  Radar,
  ScanLine,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ButtonLink } from '../components/ui/ButtonLink';
import { useTheme } from '../lib/theme';

const IS_PUBLIC_SITE = import.meta.env.VITE_PUBLIC_SITE === 'true';
const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

const CONTROL_POINTS = [
  {
    icon: ShieldCheck,
    title: 'Verified scope first',
    body: 'A scan starts only after domain verification and an explicit authorization. Redirects, private addresses, expired verification, and out-of-scope hosts are blocked.',
  },
  {
    icon: ScanLine,
    title: 'A plan you can inspect',
    body: 'Target type, surface flags, authentication scope, intensity, quotas, and policy gates form a deterministic plan before any unit is dispatched.',
  },
  {
    icon: Activity,
    title: 'Controlled execution',
    body: 'Browser, R, Z, N, O, and S run only inside the effective plan. A missing tool becomes a coverage gap, never a made-up success.',
  },
  {
    icon: LockKeyhole,
    title: 'Human control at risk points',
    body: 'Sensitive actions require approval. Manual login stays in a temporary browser session; credentials and storage are not sent to reports or model prompts.',
  },
];

const PIPELINE = [
  {
    code: '01',
    title: 'Scope and authorization',
    detail: 'Confirm ownership, allowed hosts and paths, exclusions, test window, rate limits, environment, and risk acceptance for the selected intensity.',
    output: 'Immutable authorization and allowed scope',
  },
  {
    code: '02',
    title: 'Deterministic scan plan',
    detail: 'Select one target type, surface flags, auth scope, and intensity. Policy and package budgets decide which units may run and which must be skipped.',
    output: 'Effective plan, approval gates, coverage expectations',
  },
  {
    code: '03',
    title: 'Browser and signal stages',
    detail: 'Browser observes the authorized surface. R, Z, N, O, and S contribute scoped signals, hypotheses, or controlled validation plans.',
    output: 'Sanitized activity, signals, candidates, coverage gaps',
  },
  {
    code: '04',
    title: 'Finding gate',
    detail: 'A passive signal is not automatically a vulnerability. Promotion requires scoped, sanitized, evidence-backed validation and a clear impact statement.',
    output: 'Validated finding, candidate, hardening item, or limitation',
  },
  {
    code: '05',
    title: 'Report and manual retest',
    detail: 'The final report records what was tested, validated findings, developer guidance, coverage, limitations, and narrow manual retest actions.',
    output: 'Immutable report_v1 snapshot and current-status overlay',
  },
];

const RESULT_TYPES = [
  {
    icon: CircleCheck,
    title: 'Validated finding',
    body: 'A scoped issue with sanitized evidence and a demonstrated impact. It can be ranked, reported, and manually retested.',
    accent: 'text-signal',
  },
  {
    icon: CircleAlert,
    title: 'Candidate',
    body: 'A hypothesis or signal that still needs controlled validation. It is visible as unvalidated and is not treated as a confirmed defect.',
    accent: 'text-medium',
  },
  {
    icon: EyeOff,
    title: 'Hardening or coverage',
    body: 'A configuration improvement, skipped stage, or limitation. It explains what remains to be checked without fabricating a vulnerability.',
    accent: 'text-info',
  },
];

const REPORT_OUTPUTS = [
  { icon: FileCheck2, title: 'Owner summary', body: 'Outcome, tested scope, business impact, and next action.' },
  { icon: FileJson2, title: 'report_v1 snapshot', body: 'Structured, immutable scan record with a separate latest-status overlay.' },
  { icon: FileSpreadsheet, title: 'On-demand downloads', body: 'Sanitized DOCX, CSV, JSON, HTML, and PDF output from final reports.' },
];

const EXECUTION_POLICIES = [
  {
    name: 'Free Hunter',
    body: 'Uses the same planning model, then stops after its first valuable evidence-gated finding. If it finds none within budget, it returns coverage, hardening, and limitations.',
    rules: ['One returned finding', 'One monitored finding', 'One manual retest', 'Seven-day cooldown'],
  },
  {
    name: 'AI Black-hat Mindset Check',
    body: 'Runs attacker-mindset reasoning and controlled validation in the verified scope. Authentication remains an auth scope, not a separate product.',
    rules: ['Controlled validation', 'Approval-gated actions', 'Full finding workspace', 'Coverage and limitations'],
  },
  {
    name: 'Monitor Workspace',
    body: 'Keeps report history, monitor state, quotas, and the manual retest queue. It does not trigger scans after deployments or from CI/CD.',
    rules: ['Historical reports', 'Manual retest queue', 'Monitor state', 'No automatic retest'],
  },
];

function PublicHeader() {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        <a href="#top" className="flex items-center gap-2" aria-label="OpenHunterAI overview">
          <span className="flex h-7 w-7 items-center justify-center rounded border border-signal/50 bg-signal/10">
            <Radar className="h-4 w-4 text-signal" />
          </span>
          <span className="font-display text-base font-900 tracking-tight text-ink">
            Open<span className="text-signal">Hunter</span>AI
          </span>
        </a>
        <nav className="hidden items-center gap-5 text-sm text-ink-muted md:flex" aria-label="Page sections">
          <a className="hover:text-ink" href="#workflow">Workflow</a>
          <a className="hover:text-ink" href="#evidence">Evidence</a>
          <a className="hover:text-ink" href="#boundaries">Boundaries</a>
        </nav>
        <Button variant="ghost" size="icon" aria-label="Toggle theme" title="Toggle theme" onClick={toggle}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

function PrimaryActions() {
  if (IS_PUBLIC_SITE) {
    return (
      <div className="mt-8 flex flex-wrap gap-3">
        <a className="inline-flex h-10 items-center gap-2 rounded bg-signal px-4 text-sm font-medium text-signal-ink hover:bg-signal/90" href="#workflow">
          Read the workflow <ArrowDown className="h-4 w-4" />
        </a>
        <a className="inline-flex h-10 items-center gap-2 rounded border border-hairline-strong bg-surface px-4 text-sm font-medium text-ink hover:border-signal/60 hover:text-signal" href="#boundaries">
          Review boundaries
        </a>
      </div>
    );
  }
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <ButtonLink to="/register" size="lg">
        Create workspace <ArrowRight className="h-4 w-4" />
      </ButtonLink>
      <ButtonLink to="/login" variant="secondary" size="lg">Sign in</ButtonLink>
    </div>
  );
}

export function HomePage() {
  return (
    <div id="top" className="overflow-hidden">
      {IS_PUBLIC_SITE && <PublicHeader />}

      <section className="relative border-b border-hairline">
        <div className="pointer-events-none absolute inset-0 bg-radar opacity-70" aria-hidden />
        <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)] lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-data text-xs font-medium uppercase tracking-[0.18em] text-signal">Authorized external security testing</p>
            <h1 className="mt-5 font-display text-5xl font-900 leading-[0.96] tracking-tight text-ink animate-fade-up sm:text-6xl lg:text-7xl">OpenHunterAI</h1>
            <p className="mt-5 max-w-xl text-xl leading-relaxed text-ink-muted animate-fade-up" style={{ animationDelay: '70ms' }}>
              A governed workspace for testing verified public web and application targets with an attacker mindset, evidence gates, and an explicit account of coverage.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-faint animate-fade-up" style={{ animationDelay: '120ms' }}>
              It is not an unrestricted scanner. The product makes the scope, plan, approvals, evidence status, and testing limits visible before it asks anyone to trust an outcome.
            </p>
            <PrimaryActions />
          </div>

          <figure className="relative min-h-[360px] overflow-hidden border-y border-hairline py-8 lg:min-h-[480px]" aria-label="OpenHunterAI scan workflow">
            <img src={LOGO_SRC} alt="OpenHunterAI" className="pointer-events-none absolute -right-24 top-8 w-[520px] max-w-none opacity-10 grayscale invert" />
            <div className="absolute bottom-0 left-0 top-0 w-px bg-signal/50" />
            <div className="relative grid gap-0">
              {[
                ['01', 'Verified scope'],
                ['02', 'Deterministic plan'],
                ['03', 'Browser · R · Z · N · O · S'],
                ['04', 'Evidence gate'],
                ['05', 'Report_v1 · manual retest'],
              ].map(([code, label], index) => (
                <div key={code} className="group relative grid grid-cols-[64px_1fr] gap-4 border-b border-hairline/80 px-5 py-4 last:border-b-0">
                  <span className="text-data text-xs text-signal">{code}</span>
                  <span className="font-display text-base font-700 text-ink group-hover:text-signal">{label}</span>
                  {index < 4 && <span className="absolute ml-[26px] mt-7 h-5 border-l border-dashed border-signal/40" aria-hidden />}
                </div>
              ))}
            </div>
            <figcaption className="absolute bottom-0 right-0 bg-canvas px-3 py-2 text-data text-[11px] uppercase tracking-wider text-ink-faint">Scan lifecycle</figcaption>
          </figure>
        </div>
      </section>

      <section className="border-b border-hairline bg-surface/35">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <p className="text-data text-xs uppercase tracking-[0.18em] text-ink-faint">Operating model</p>
          <div className="mt-4 max-w-2xl">
            <h2 className="font-display text-3xl font-900 tracking-tight text-ink">What the workspace controls</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-muted">The product separates what a user authorizes, what the runtime may execute, and what a report is allowed to claim.</p>
          </div>
          <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {CONTROL_POINTS.map(({ icon: Icon, title, body }) => (
              <article key={title} className="border-t border-hairline-strong pt-4">
                <Icon className="h-5 w-5 text-signal" />
                <h3 className="mt-4 font-display text-lg font-700 text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-20 border-b border-hairline">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:h-fit">
              <p className="text-data text-xs uppercase tracking-[0.18em] text-signal">Workflow</p>
              <h2 className="mt-4 font-display text-3xl font-900 tracking-tight text-ink">From permission to a report someone can challenge</h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">Every scan keeps the decision trail: why an action was permitted, what ran, what was skipped, and why a result is or is not a finding.</p>
            </div>
            <ol className="border-t border-hairline">
              {PIPELINE.map((step) => (
                <li key={step.code} className="grid gap-3 border-b border-hairline py-6 sm:grid-cols-[72px_minmax(0,1fr)_minmax(180px,0.55fr)] sm:gap-6">
                  <span className="text-data text-sm text-signal">{step.code}</span>
                  <div>
                    <h3 className="font-display text-xl font-700 text-ink">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.detail}</p>
                  </div>
                  <p className="border-l border-hairline pl-4 text-sm leading-relaxed text-ink-faint">{step.output}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="evidence" className="scroll-mt-20 border-b border-hairline bg-surface/35">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-data text-xs uppercase tracking-[0.18em] text-signal">Evidence language</p>
              <h2 className="mt-4 font-display text-3xl font-900 tracking-tight text-ink">A signal is not a finding</h2>
            </div>
            <p className="max-w-2xl text-base leading-relaxed text-ink-muted">Reports distinguish confirmed issues from hypotheses and hardening work. Missing headers or passive observations do not become a medium-severity vulnerability unless controlled evidence supports the impact.</p>
          </div>
          <div className="mt-10 grid gap-0 border-y border-hairline md:grid-cols-3">
            {RESULT_TYPES.map(({ icon: Icon, title, body, accent }) => (
              <article key={title} className="border-b border-hairline p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                <Icon className={`h-5 w-5 ${accent}`} />
                <h3 className="mt-4 font-display text-lg font-700 text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h3 className="font-display text-xl font-700 text-ink">What the final report contains</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {REPORT_OUTPUTS.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="border-t border-hairline-strong pt-4">
                    <Icon className="h-5 w-5 text-signal" />
                    <h4 className="mt-3 font-display text-base font-700 text-ink">{title}</h4>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <aside className="border-l border-signal/40 pl-5">
              <p className="text-data text-xs uppercase tracking-[0.18em] text-signal">Data boundary</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">Raw passwords, cookies, tokens, API keys, browser storage, HAR files, and sensitive request/response bodies do not belong in activities, prompts, reports, or exports.</p>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-b border-hairline">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <p className="text-data text-xs uppercase tracking-[0.18em] text-ink-faint">Execution policies</p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-900 tracking-tight text-ink">Packages change limits, not the truth standard</h2>
          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            {EXECUTION_POLICIES.map(({ name, body, rules }) => (
              <article key={name} className="border-t border-hairline-strong pt-5">
                <h3 className="font-display text-xl font-700 text-ink">{name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{body}</p>
                <ul className="mt-5 grid gap-2 border-t border-hairline pt-4 text-sm text-ink-muted">
                  {rules.map((rule) => <li key={rule} className="flex gap-2"><span className="text-signal">+</span>{rule}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="boundaries" className="scroll-mt-20 bg-surface/35">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-data text-xs uppercase tracking-[0.18em] text-signal">Boundaries</p>
              <h2 className="mt-4 font-display text-3xl font-900 tracking-tight text-ink">What OpenHunterAI will not do</h2>
            </div>
            <div className="grid gap-0 border-y border-hairline">
              {[
                'No scan of an unverified domain, a private/local/metadata address, or a redirect outside the authorized scope.',
                'No destructive wipe, malware, persistence, stealth/evasion, credential stuffing, brute force, or raw secret exfiltration.',
                'No CI/CD-based or deployment-triggered retest. Retests are narrow, manual, and tied to a finding.',
                'No fabricated success when a unit or integration is unavailable; the report records a skipped stage or coverage gap.',
              ].map((item, index) => (
                <div key={item} className="grid grid-cols-[40px_1fr] gap-4 border-b border-hairline py-4 last:border-b-0">
                  <span className="text-data text-xs text-signal">0{index + 1}</span>
                  <p className="text-sm leading-relaxed text-ink-muted">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-faint lg:px-8">
          <span className="font-display font-700 text-ink">OpenHunterAI</span>
          <a
            className="underline decoration-hairline-strong underline-offset-4 hover:text-ink"
            href="https://github.com/LumosLab-Innovation/OpenHunterAI/blob/main/LICENSING.md"
          >
            Source-available under PolyForm Noncommercial
          </a>
          <span>Authorized external web/app security testing. Verified scope only.</span>
        </div>
      </footer>
    </div>
  );
}
