'use client';
import { useEffect, useRef, useState } from 'react';
import { clearRecovery, loadStudio, persistStudio, saveRecovery, type StudioData } from './storage';
import { WorkspaceSync } from './workspace-sync';
export type { SaveState } from './workspace-sync';
export function useStudio() {
  const [data, setData] = useState<StudioData | null>(null);
  const [error, setError] = useState('');
  const [workspaceState, setWorkspaceState] = useState<WorkspaceSync | null>(null);
  const [, render] = useState(0);
  const engine = useRef<WorkspaceSync | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    let persistence = Promise.resolve();
    const persist = (snapshot: StudioData) => {
      const copy = structuredClone(snapshot);
      persistence = persistence.catch(() => {}).then(async () => {
        await persistStudio(copy);
        if (engine.current?.data === snapshot) clearRecovery();
      });
      return persistence;
    };
    const tick = async () => {
      const workspace = engine.current;
      if (!workspace) return;
      await workspace.refresh(); await workspace.sync();
    };
    loadStudio().then(async loaded => {
      if (!alive) return;
      const workspace = new WorkspaceSync(loaded, persist, () => {
        if (alive) { setData(workspace.data); setError(workspace.error); render(n => n + 1); }
      });
      engine.current = workspace; setWorkspaceState(workspace); setData(workspace.data);
      await persist(workspace.data); clearRecovery(); await tick();
    }).catch(() => { if (alive) setError('Não foi possível acessar o cache. Seus dados anteriores foram preservados.'); });
    const flush = () => {
      if (engine.current) {
        try { saveRecovery(engine.current.data, null); } catch { /* Large images remain protected by IndexedDB writes. */ }
        void persist(engine.current.data).catch(() => {});
      }
    };
    const focus = () => { void tick(); };
    window.addEventListener('pagehide', flush); window.addEventListener('online', focus); window.addEventListener('focus', focus);
    const interval = setInterval(focus, 15000);
    return () => {
      alive = false; engine.current?.stop(); flush();
      clearInterval(interval); clearTimeout(timer.current);
      window.removeEventListener('pagehide', flush); window.removeEventListener('online', focus); window.removeEventListener('focus', focus);
    };
  }, []);
  function save(next: StudioData, immediate = false) {
    const workspace = engine.current; if (!workspace) return false;
    clearTimeout(timer.current);
    void workspace.save(next).then(() => {
      timer.current = setTimeout(() => void workspace.sync(), immediate ? 0 : 800);
    }).catch(() => setError('Não foi possível salvar o cache local. Baixe um backup antes de fechar.'));
    return true;
  }
  return { data, save, saveState: workspaceState?.state ?? 'loading', error, workspace: workspaceState };
}
