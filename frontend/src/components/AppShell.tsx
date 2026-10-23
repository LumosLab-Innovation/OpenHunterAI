import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Crosshair,
  LayoutDashboard,
  FileText,
  FolderKanban,
  Menu,
  Moon,
  Radar,
  Sun,
  X,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { useTheme } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { Button } from './ui/Button';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/scans', label: 'Scans', icon: Radar },
  { to: '/findings', label: 'Findings', icon: Crosshair },
  { to: '/reports', label: 'Reports', icon: FileText },
];

function BrandMark({ className, to = '/' }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn('group flex items-center gap-2', className)}>
      <span className="relative flex h-7 w-7 items-center justify-center rounded border border-signal/50 bg-signal/10">
        <Radar className="h-4 w-4 text-signal transition-transform duration-500 group-hover:rotate-90" />
      </span>
      <span className="font-display text-base font-900 tracking-tight text-ink">
        Open<span className="text-signal">Hunter</span>AI
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) return <div className="min-h-screen bg-canvas" aria-label="Connecting to local engine" />;

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <BrandMark />
        <h1 className="font-display text-xl font-700 text-ink">Local engine unavailable</h1>
        <p className="max-w-md text-sm text-ink-muted">Start the self-hosted services on this computer, then refresh the dashboard.</p>
        <Button onClick={() => window.location.reload()}>Retry connection</Button>
      </div>
    );
  }

  // Local dashboard chrome: sidebar + content.
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-hairline bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-hairline px-5">
          <BrandMark to="/dashboard" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <SidebarLink key={to} to={to} label={label} Icon={Icon} />
          ))}
        </nav>
        <p className="border-t border-hairline p-5 text-data text-[11px] text-ink-faint">Local self-hosted engine</p>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-hairline bg-canvas/80 px-5 backdrop-blur lg:hidden">
        <BrandMark to="/dashboard" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-30 bg-canvas lg:hidden">
          <nav className="flex flex-col gap-1 p-4">
            {NAV.map(({ to, label, icon: Icon }) => (
              <SidebarLink
                key={to}
                to={to}
                label={label}
                Icon={Icon}
                onClick={() => setMobileOpen(false)}
              />
            ))}
            <p className="mt-4 border-t border-hairline pt-4 text-data text-xs text-ink-faint">Local self-hosted engine</p>
          </nav>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        {/* Desktop topbar with theme toggle */}
        <div className="hidden h-16 items-center justify-end border-b border-hairline px-6 lg:flex">
          <ThemeToggle />
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarLink({
  to,
  label,
  Icon,
  onClick,
}: {
  to: string;
  label: string;
  Icon: typeof Radar;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-signal/10 text-signal'
            : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}
