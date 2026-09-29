'use client';
import { useEffect, useRef, useState } from 'react';
import { clearRecovery, loadStudio, persistStudio, saveRecovery, type StudioData } from './storage';

export type SaveState = 'loading' | 'saving' | 'saved' | 'error';
const AUTOSAVE_DELAY = 500;

export function useStudio() {
  const [data, setData] = useState<StudioData | null>(null);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const pending = useRef<StudioData | null>(null);
  const committed = useRef<StudioData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function persistPending() {
    const snapshot = pending.current;
    if (!snapshot) return;
    // IndexedDB serializes readwrite transactions in their creation order.
    void persistStudio(snapshot).then(() => {
      committed.current = snapshot;
      if (pending.current === snapshot) {
        pending.current = null;
        clearRecovery();
        setError(''); setSaveState('saved');
      }
    }).catch(() => {
      setSaveState('error');
      setError('Alterações ainda não salvas: armazenamento indisponível. Baixe um backup antes de fechar esta página.');
    });
  }

  useEffect(() => {
    let alive = true;
    loadStudio().then(async (loaded) => {
      if (!alive) return;
      setData(loaded);
      await persistStudio(loaded);
      if (alive) { committed.current = loaded; clearRecovery(); setSaveState('saved'); }
    }).catch(() => {
      if (!alive) return;
      setSaveState('error');
      setError('Não foi possível acessar os dados locais. Seus dados anteriores não foram apagados. Verifique o armazenamento do navegador.');
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const flush = () => {
      const snapshot = pending.current;
      if (snapshot) {
        try { saveRecovery(snapshot, committed.current); } catch { /* IndexedDB still receives the final write if the journal is unavailable. */ }
        void persistStudio(snapshot).catch(() => {});
      }
    };
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
      if (timer.current) clearTimeout(timer.current);
      flush();
    };
  }, []);

  function save(next: StudioData, immediate = false) {
    setData(next); pending.current = next; setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    if (immediate) persistPending();
    else timer.current = setTimeout(persistPending, AUTOSAVE_DELAY);
    return true;
  }
  return { data, save, saveState, error };
}
