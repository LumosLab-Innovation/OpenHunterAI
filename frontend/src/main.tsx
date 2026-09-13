import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ThemeProvider } from './lib/theme';
import { AuthProvider, useAuth } from './lib/auth';
import { FindingDetailPage, FindingsPage } from './pages/Findings';
import { HomePage } from './pages/Home';
import { LoginPage, RegisterPage } from './pages/Auth';
import { ProjectDetailPage, ProjectsPage } from './pages/Projects';
import { ReportDetailPage, ReportsPage } from './pages/Reports';
import { ScanDetailPage, ScansPage } from './pages/Scans';
import { WorkspacePage } from './pages/Workspace';
import { SetupPage } from './pages/Setup';
import './styles.css';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, mode } = useAuth();

  if (mode === 'local') return <>{children}</>;
  if (loading) return <p className="text-ink-muted">Connecting to workspace…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function EntryPage({ kind }: { kind: 'home' | 'login' | 'register' }) {
  const { mode, loading } = useAuth();
  if (loading) return <WorkspacePage />;
  if (mode === 'local') return kind === 'home' ? <WorkspacePage /> : <Navigate to="/" replace />;
  return kind === 'login' ? <LoginPage /> : kind === 'register' ? <RegisterPage /> : <HomePage />;
}

const isPublicSite = import.meta.env.VITE_PUBLIC_SITE === 'true';

function PublicSite() {
  return (
    <ThemeProvider>
      <HomePage />
    </ThemeProvider>
  );
}

function Application() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<EntryPage kind="home" />} />
              <Route path="/login" element={<EntryPage kind="login" />} />
              <Route path="/register" element={<EntryPage kind="register" />} />
              <Route path="/setup" element={<RequireAuth><SetupPage /></RequireAuth>} />
              <Route path="/projects" element={<RequireAuth><ProjectsPage /></RequireAuth>} />
              <Route path="/projects/:id" element={<RequireAuth><ProjectDetailPage /></RequireAuth>} />
              <Route path="/scans" element={<RequireAuth><ScansPage /></RequireAuth>} />
              <Route path="/scans/:id" element={<RequireAuth><ScanDetailPage /></RequireAuth>} />
              <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
              <Route path="/reports/:id" element={<RequireAuth><ReportDetailPage /></RequireAuth>} />
              <Route path="/findings" element={<RequireAuth><FindingsPage /></RequireAuth>} />
              <Route path="/findings/:id" element={<RequireAuth><FindingDetailPage /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPublicSite ? <PublicSite /> : <Application />}
  </React.StrictMode>,
);
