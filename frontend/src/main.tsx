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
import './styles.css';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
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
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
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
