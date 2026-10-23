import { useState } from 'react';
import { ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react';
import {
  AUTH_SCOPE_OPTIONS,
  INTENSITY_OPTIONS,
  SURFACE_FLAGS,
  TARGET_TYPE_OPTIONS,
} from '../lib/product';
import { cn } from '../lib/cn';
import { apiFetch } from '../lib/api';
import { Button } from './ui/Button';
import { Field, Input, Checkbox } from './ui/Field';
import { ErrorState } from './ui/States';

export interface AuthorizationPayload {
  targetType: string;
  testIntensityMode: string;
  authScope: string;
  surfaceFlags: Record<string, boolean>;
  aggressiveStagingRiskAccepted: boolean;
  allowedHosts: string[];
  allowedPaths: string[];
  excludedPaths: string[];
  authorityConfirmed: true;
  consentText: string;
}

const STEPS = ['Target', 'Surface', 'Intensity', 'Review'] as const;

interface WizardState {
  targetType: string;
  testIntensityMode: string;
  authScope: string;
  allowedHosts: string;
  surfaceFlags: Record<string, boolean>;
  riskAccepted: boolean;
  authorityConfirmed: boolean;
}

const INITIAL: WizardState = {
  targetType: 'interactive_web_app',
  testIntensityMode: 'controlled_attack_simulation',
  authScope: 'none',
  allowedHosts: '',
  surfaceFlags: Object.fromEntries(SURFACE_FLAGS.map(([k]) => [k, false])),
  riskAccepted: false,
  authorityConfirmed: false,
};

/** Radio-card option used across wizard steps. */
function OptionCard({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border p-4 text-left transition-all',
        active
          ? 'border-signal bg-signal/10 shadow-glow'
          : 'border-hairline-strong bg-surface hover:border-signal/50',
      )}
    >
      <span className="block text-sm font-medium text-ink">{label}</span>
      {hint && <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{hint}</span>}
    </button>
  );
}

export function AuthorizationWizard({
  projectId,
  testAccountCount = 0,
  onCreated,
  onCancel,
}: {
  projectId: string;
  testAccountCount?: number;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<WizardState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));

  const isAggressive = s.testIntensityMode === 'aggressive_staging';
  const allowedHosts = s.allowedHosts
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const hasAllowedHosts = allowedHosts.length > 0;
  const requiredTestAccounts = s.authScope === 'two_accounts' ? 2 : s.authScope === 'one_account' ? 1 : 0;
  const hasRequiredTestAccounts = testAccountCount >= requiredTestAccounts;
  const canSubmit = hasAllowedHosts && hasRequiredTestAccounts && s.authorityConfirmed && (!isAggressive || s.riskAccepted);

  async function submit() {
    if (!canSubmit) {
      setError(
        !hasAllowedHosts
          ? 'Enter at least one public host before authorizing a scan.'
          : !hasRequiredTestAccounts
            ? `Auth scope ${s.authScope} requires ${requiredTestAccounts} saved test account(s).`
            : !s.authorityConfirmed
              ? 'Confirm your authority to test the declared hosts.'
              : 'Accept the staging risk statement before authorizing this scan.',
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload: AuthorizationPayload = {
      targetType: s.targetType,
      testIntensityMode: s.testIntensityMode,
      authScope: s.authScope,
      surfaceFlags: s.surfaceFlags,
      aggressiveStagingRiskAccepted: s.riskAccepted,
      allowedHosts,
      allowedPaths: [],
      excludedPaths: [],
      authorityConfirmed: true,
      consentText: `I confirm I am authorized to test ${allowedHosts.join(', ')} within the declared scope.`,
    };
    const res = await apiFetch(`/v1/projects/${projectId}/authorizations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) setError(res.error.message ?? `HTTP ${res.status}`);
    else onCreated();
  }

  return (
    <div className="grid gap-6">
      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-700',
                i === step
                  ? 'border-signal bg-signal text-signal-ink'
                  : i < step
                    ? 'border-signal/50 text-signal'
                    : 'border-hairline-strong text-ink-faint',
              )}
            >
              {i + 1}
            </span>
            <span className={cn(i === step ? 'text-ink' : 'text-ink-faint')}>{label}</span>
            {i < STEPS.length - 1 && <span className="text-ink-faint">·</span>}
          </li>
        ))}
      </ol>

      <div className="min-h-[200px]">
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {TARGET_TYPE_OPTIONS.map((o) => (
              <OptionCard
                key={o.value}
                active={s.targetType === o.value}
                label={o.label}
                hint={o.hint}
                onClick={() => set('targetType', o.value)}
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5">
            <Field
              label="Allowed hosts"
              hint="Enter public hostnames you are authorized to test, separated by commas. Private, local, and metadata hosts are blocked."
              required
            >
              <Input
                value={s.allowedHosts}
                onChange={(e) => set('allowedHosts', e.target.value)}
                placeholder="staging.example.com"
              />
            </Field>
            <div className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                Surface flags
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                {SURFACE_FLAGS.map(([key, label]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2.5 rounded border border-hairline px-3 py-2 text-sm text-ink hover:border-signal/40"
                  >
                    <Checkbox
                      checked={s.surfaceFlags[key]}
                      onChange={(e) =>
                        set('surfaceFlags', { ...s.surfaceFlags, [key]: e.target.checked })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5">
            <div className="grid gap-3">
              {INTENSITY_OPTIONS.map((o) => (
                <OptionCard
                  key={o.value}
                  active={s.testIntensityMode === o.value}
                  label={o.label}
                  hint={o.hint}
                  onClick={() => set('testIntensityMode', o.value)}
                />
              ))}
            </div>
            <Field label="Authenticated scope">
              <p className="mb-3 text-sm leading-relaxed text-ink-muted">
                Choose <span className="text-ink">No accounts</span> for public-only testing. Choose one/two accounts only when you have created throwaway test users for the target app below this form.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {AUTH_SCOPE_OPTIONS.map((o) => (
                  <OptionCard
                    key={o.value}
                    active={s.authScope === o.value}
                    label={o.label}
                    onClick={() => set('authScope', o.value)}
                  />
                ))}
              </div>
            </Field>
            {requiredTestAccounts > testAccountCount && (
              <div className="rounded border border-medium/40 bg-medium/10 px-3 py-2 text-sm text-medium">
                This scope needs {requiredTestAccounts} saved test account(s). You currently have {testAccountCount}. Go back to Test accounts and add throwaway credentials, or select No accounts.
              </div>
            )}
            {isAggressive && (
              <label className="flex items-start gap-3 rounded-lg border border-high/40 bg-high/10 p-4 text-sm text-ink">
                <Checkbox
                  checked={s.riskAccepted}
                  onChange={(e) => set('riskAccepted', e.target.checked)}
                  className="mt-0.5"
                />
                <span className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-high" />
                  Aggressive Staging is only for staging/dev/test targets I control. Validation may
                  create test data, trigger alerts, or add load. Raw secrets are never stored;
                  sensitive actions still require approval gates.
                </span>
              </label>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3">
            {!hasAllowedHosts && (
              <div className="rounded border border-medium/40 bg-medium/10 px-3 py-2 text-sm text-medium">
                Enter at least one public host in scope before authorizing a scan.
              </div>
            )}
            {!hasRequiredTestAccounts && (
              <div className="rounded border border-medium/40 bg-medium/10 px-3 py-2 text-sm text-medium">
                Auth scope {s.authScope} requires {requiredTestAccounts} saved test account(s). Add test accounts first, or choose No accounts.
              </div>
            )}
            <dl className="grid gap-3 rounded-lg border border-hairline bg-surface-raised p-5 text-sm">
              <ReviewRow label="Target type" value={s.targetType} />
              <ReviewRow label="Intensity" value={s.testIntensityMode} />
              <ReviewRow label="Auth scope" value={s.authScope} />
              <ReviewRow
                label="Allowed hosts"
                value={s.allowedHosts || 'Enter a public host'}
              />
              <ReviewRow
                label="Surface flags"
                value={
                  Object.entries(s.surfaceFlags)
                    .filter(([, v]) => v)
                    .map(([k]) => k)
                    .join(', ') || 'none'
                }
              />
            </dl>
            <label className="flex items-start gap-3 rounded-lg border border-hairline bg-surface-raised p-4 text-sm text-ink">
              <Checkbox checked={s.authorityConfirmed} onChange={(e) => set('authorityConfirmed', e.target.checked)} className="mt-0.5" />
              <span>I confirm I have authority to test these hosts within this scope. I understand the scan may generate traffic and alerts.</span>
            </label>
          </div>
        )}
      </div>

      {error && <ErrorState message={error} />}

      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-4">
        <Button
          variant="ghost"
          onClick={() => (step === 0 ? onCancel() : setStep((v) => v - 1))}
        >
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((v) => v + 1)}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => void submit()} disabled={!canSubmit || submitting}>
            {submitting ? 'Authorizing…' : 'Authorize scan'}
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="text-data text-right text-ink">{value}</dd>
    </div>
  );
}
