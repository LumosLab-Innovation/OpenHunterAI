import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './lib/theme';
import { HomePage } from './pages/Home';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <HomePage />
    </ThemeProvider>
  </React.StrictMode>,
);
