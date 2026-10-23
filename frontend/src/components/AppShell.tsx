import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { Button } from './ui/Button';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, refresh } = useAuth();
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen">
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 z-50 bg-surface p-3">Skip to content</a>
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <a href="/" className="font-display text-lg font-semibold tracking-tight">OpenHunter<span className="text-signal">AI</span></a>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-muted">{loading ? 'Connecting…' : user ? 'Local engine' : 'Offline'}</span>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          </div>
        </div>
      </header>
      <main id="workspace-content" className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        {loading ? <p role="status" className="text-sm text-ink-muted">Connecting to the local engine…</p> : !user ? (
          <section className="max-w-lg space-y-4">
            <h1 className="font-display text-xl font-semibold">Local engine unavailable</h1>
            <p className="text-sm text-ink-muted">Start the self-hosted services on this computer, then reconnect.</p>
            <Button variant="secondary" onClick={() => void refresh()}>Reconnect</Button>
          </section>
        ) : children}
      </main>
    </div>
  );
}
