import { cn } from '../lib/cn';

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** Consistent page title block with optional right-aligned actions. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="grid gap-1">
        <h1 className="font-display text-2xl font-900 tracking-tight text-ink">{title}</h1>
        {description && <p className="max-w-xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
