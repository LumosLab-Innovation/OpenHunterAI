import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface SessionUser {
  id: string;
  email: string;
  displayName?: string;
  orgName?: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await apiFetch<{ user: SessionUser }>('/v1/auth/me');
    setUser(res.ok ? res.data.user : null);
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
    <AuthContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
