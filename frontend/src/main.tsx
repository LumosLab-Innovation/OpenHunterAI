import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ThemeProvider } from './lib/theme';
import { AuthProvider } from './lib/auth';
import { WorkspacePage } from './pages/Workspace';
import './styles.css';

function LegacySelection({ kind }: { kind: string }) {
  const { id } = useParams();
  return <Navigate replace to={id ? `/?${new URLSearchParams({ [kind]: id })}` : '/'} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider><AuthProvider><BrowserRouter><AppShell><Routes>
      <Route path="/" element={<WorkspacePage />} />
      {['project', 'scan', 'report', 'finding'].map((kind) => (
        <Route key={kind} path={`/${kind}s/:id`} element={<LegacySelection kind={kind} />} />
      ))}
      <Route path="/setup" element={<Navigate replace to="/?settings=1" />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes></AppShell></BrowserRouter></AuthProvider></ThemeProvider>
  </React.StrictMode>,
);
