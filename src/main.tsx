import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';
import './styles-responsive.css';

try {
  const saved = localStorage.getItem('qingji-theme');
  document.documentElement.dataset.theme = saved === 'dark' || (saved === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
} catch { /* Storage access is optional; the database remains the source of truth. */ }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
