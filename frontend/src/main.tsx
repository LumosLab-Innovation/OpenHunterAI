import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ThemeProvider } from './lib/theme';
import { AuthProvider, useAuth } from './lib/auth';
import { FindingDetailPage, FindingsPage } from './pages/Findings';
import { DashboardPage } from './pages/Dashboard';
import { ProjectDetailPage, ProjectsPage } from './pages/Projects';
import { ReportDetailPage, ReportsPage } from './pages/Reports';
import { ScanDetailPage, ScansPage } from './pages/Scans';
import './styles.css';

function RequireLocalEngine({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  return !loading && user ? <>{children}</> : null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<RequireLocalEngine><DashboardPage /></RequireLocalEngine>} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/projects" element={<RequireLocalEngine><ProjectsPage /></RequireLocalEngine>} />
              <Route path="/projects/:id" element={<RequireLocalEngine><ProjectDetailPage /></RequireLocalEngine>} />
              <Route path="/scans" element={<RequireLocalEngine><ScansPage /></RequireLocalEngine>} />
              <Route path="/scans/:id" element={<RequireLocalEngine><ScanDetailPage /></RequireLocalEngine>} />
              <Route path="/reports" element={<RequireLocalEngine><ReportsPage /></RequireLocalEngine>} />
              <Route path="/reports/:id" element={<RequireLocalEngine><ReportDetailPage /></RequireLocalEngine>} />
              <Route path="/findings" element={<RequireLocalEngine><FindingsPage /></RequireLocalEngine>} />
              <Route path="/findings/:id" element={<RequireLocalEngine><FindingDetailPage /></RequireLocalEngine>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
