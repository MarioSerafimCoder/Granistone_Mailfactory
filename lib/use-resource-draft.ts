'use client';
import { useContext, useEffect, useState } from 'react';
import type { ResourceType } from '@/types/collaboration';
import { CollaborationContext } from './use-collaboration';
import { downloadFile } from '@/export/download';
// Library/brand drafts contain text and hosted image references, never tokens.
export function useResourceDraft<T>(type: ResourceType, id: string | undefined, setValue: (value: T) => void, baseRevision?: number) {
  const { session } = useContext(CollaborationContext);
  const key = `granistone-draft:${session?.email || 'local'}:${type}:${id || 'new'}`;
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => { try { setAvailable(Boolean(localStorage.getItem(key))); } catch { setError('Não foi possível consultar o rascunho local.'); } }, 0);
    return () => clearTimeout(timer);
  }, [key]);
  const change = (value: T) => {
    setValue(value);
    try { localStorage.setItem(key, JSON.stringify({ value, baseRevision })); setAvailable(true); }
    catch { setError('Não foi possível preservar o rascunho local. Mantenha esta janela aberta até salvar.'); }
  };
  const clear = () => { try { localStorage.removeItem(key); setAvailable(false); } catch { /* Retain recovery data if storage is unavailable. */ } };
  const recover = () => {
    try { const raw = localStorage.getItem(key); if (raw) { const stored = JSON.parse(raw); const value = stored.value; if (!value || typeof value !== 'object') throw new Error('Não foi possível recuperar este rascunho.'); if (baseRevision !== undefined && stored.baseRevision !== baseRevision) throw new Error('A versão compartilhada mudou desde este rascunho. Baixe uma cópia para recuperar seus textos sem substituir a marca atual.'); setValue(value as T); } }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível recuperar este rascunho.'); }
  };
  const download = () => { const raw = localStorage.getItem(key); if (raw) downloadFile(raw, `rascunho-${type}-${id || 'novo'}.json`, 'application/json'); };
  return { available, error, change, clear, recover, download };
}
