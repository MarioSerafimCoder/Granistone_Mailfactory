'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
const key = 'granistone-ui-theme';
type Theme = 'light' | 'dark';
function systemTheme(): Theme { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    sync();
    const changed = () => {
      try { if (localStorage.getItem(key)) return; } catch { /* Use system preference. */ }
      const next = systemTheme();
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const dark = theme === 'dark';
  return <button type="button" className="theme-toggle" aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'} aria-pressed={dark}
    onClick={() => {
      const next = dark ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(key, next); } catch { /* The current tab still changes theme. */ }
      setTheme(next);
    }}>{dark ? <Sun size={17} /> : <Moon size={17} />}<span>{dark ? 'Modo claro' : 'Modo escuro'}</span></button>;
}
