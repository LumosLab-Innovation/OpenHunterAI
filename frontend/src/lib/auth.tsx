import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface SessionUser {
  id: string;
  email: string;
  displayName?: string;
  orgName?: string;
}

export interface WorkspaceStatus {
  mode: 'local' | 'hosted';
  workspace: { name: string };
  user: SessionUser;
  services: { api: string; database: string; queue: string };
  models: Array<{ role: string; provider: string; model: string; configured: boolean }>;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  mode: 'local' | 'hosted';
  status: WorkspaceStatus | null;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'local' | 'hosted'>('local');
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const config = await apiFetch<{ mode: 'local' | 'hosted' }>('/v1/workspace');
    if (!config.ok) {
      setStatus(null);
      setUser(null);
      setError(config.error.message ?? 'Workspace unavailable. Check the API and database.');
      setLoading(false);
      return;
    }
    setMode(config.data.mode);
    const res = await apiFetch<WorkspaceStatus>('/v1/workspace/status');
    setStatus(res.ok ? res.data : null);
    setUser(res.ok ? res.data.user : null);
    if (!res.ok && res.status !== 401) setError(res.error.message ?? 'Workspace unavailable. Check the database and run migrations.');
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    const res = await apiFetch('/v1/auth/signout', { method: 'POST' });
    if (!res.ok) throw new Error(res.error.message ?? `Sign out failed (${res.status})`);
    setUser(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const revalidate = () => {
      void refresh();
    };
    window.addEventListener('pageshow', revalidate);
    window.addEventListener('focus', revalidate);
    return () => {
      window.removeEventListener('pageshow', revalidate);
      window.removeEventListener('focus', revalidate);
    };
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut, mode, status, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
