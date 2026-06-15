import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ThemeProvider } from './lib/theme';
import { AuthProvider } from './lib/auth';
import { FindingDetailPage, FindingsPage } from './pages/Findings';
import { HomePage } from './pages/Home';
import { LoginPage, RegisterPage } from './pages/Auth';
import { ProjectDetailPage, ProjectsPage } from './pages/Projects';
import { ReportDetailPage, ReportsPage } from './pages/Reports';
import { ScanDetailPage, ScansPage } from './pages/Scans';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/scans" element={<ScansPage />} />
              <Route path="/scans/:id" element={<ScanDetailPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/:id" element={<ReportDetailPage />} />
              <Route path="/findings" element={<FindingsPage />} />
              <Route path="/findings/:id" element={<FindingDetailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
