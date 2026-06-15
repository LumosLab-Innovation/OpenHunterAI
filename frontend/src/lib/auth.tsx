import { createContext, useContext, useEffect, useState } from 'react';
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

  async function refresh() {
    const res = await apiFetch<{ user: SessionUser }>('/v1/auth/me');
    setUser(res.ok ? res.data.user : null);
    setLoading(false);
  }

  async function signOut() {
    await apiFetch('/v1/auth/signout', { method: 'POST' });
    setUser(null);
  }

  useEffect(() => {
    void refresh();
  }, []);

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
