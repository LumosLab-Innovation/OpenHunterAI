import { cn } from '../../lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-hairline-strong border-t-signal',
        className,
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded bg-surface-raised',
        'after:absolute after:inset-0 after:animate-scan-sweep after:bg-gradient-to-r after:from-transparent after:via-hairline-strong/40 after:to-transparent',
        className,
      )}
    />
  );
}

/** Stack of skeleton rows, for table/list loading states. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
