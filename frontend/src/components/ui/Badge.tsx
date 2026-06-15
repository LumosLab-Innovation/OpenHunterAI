import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider',
  {
    variants: {
      tone: {
        neutral: 'border-hairline-strong bg-surface-raised text-ink-muted',
        signal: 'border-signal/40 bg-signal/10 text-signal',
        critical: 'border-critical/40 bg-critical/10 text-critical',
        high: 'border-high/40 bg-high/10 text-high',
        medium: 'border-medium/40 bg-medium/10 text-medium',
        low: 'border-low/40 bg-low/10 text-low',
        info: 'border-info/40 bg-info/10 text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const SEVERITY_TONE: Record<string, Severity> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'info',
  informational: 'info',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

/** Maps a severity string from the API to the correct colored badge. */
export function SeverityBadge({ severity }: { severity?: string }) {
  const key = (severity ?? 'info').toLowerCase();
  return <Badge tone={SEVERITY_TONE[key] ?? 'info'}>{severity ?? 'info'}</Badge>;
}

const STATE_DOT: Record<string, string> = {
  running: 'bg-signal animate-pulse-ring',
  pending: 'bg-medium',
  queued: 'bg-info',
  done: 'bg-signal',
  finalized: 'bg-signal',
  completed: 'bg-signal',
  failed: 'bg-critical',
  error: 'bg-critical',
  skipped: 'bg-ink-faint',
};

/** A status pill with a colored state dot, for scan/step lifecycle states. */
export function StatusBadge({ state }: { state?: string }) {
  const key = (state ?? 'pending').toLowerCase();
  return (
    <Badge tone="neutral" className="normal-case tracking-normal">
      <span className={cn('h-1.5 w-1.5 rounded-full', STATE_DOT[key] ?? 'bg-ink-faint')} />
      <span className="text-data text-[11px]">{state ?? 'pending'}</span>
    </Badge>
  );
}
