'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { PresenceEntry, ResourceType, WorkspaceSession } from '@/types/collaboration';
import { online } from './online';
import { acquireLease, activeLease, browserIdentity, releaseLease, renewLease } from './edit-leases';

export const CollaborationContext = createContext<{ session?: WorkspaceSession; presence: PresenceEntry[]; setResource?: (resource: { type: ResourceType; id: string } | undefined) => void }>({ presence: [] });
export function useWorkspacePresence(session: WorkspaceSession | undefined, location: string, resourceType: ResourceType | '' = '', resourceId = '') {
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!session?.member) return;
    let alive = true, running = false, lastActivity = Date.now();
    const activity = () => { lastActivity = Date.now(); };
    const tick = async () => {
      if (running || !alive) return;
      running = true;
      try {
        await online.presence.heartbeat({ ...browserIdentity(), location, resourceType, resourceId, active: document.visibilityState === 'visible' && Date.now() - lastActivity < 180000 });
        const entries = await online.presence.list();
        if (alive) { setPresence(entries); setUnavailable(false); }
      } catch { if (alive) { setPresence([]); setUnavailable(true); } }
      finally { running = false; }
    };
    const timer = setTimeout(() => void tick(), 0);
    const interval = setInterval(() => { if (document.visibilityState === 'visible' || (resourceType && activeLease(resourceType, resourceId))) void tick(); }, 15000);
    const focus = () => { activity(); void tick(); };
    const leave = () => { void online.presence.leave(browserIdentity()).catch(() => {}); };
    window.addEventListener('pointerdown', activity); window.addEventListener('keydown', activity);
    window.addEventListener('focus', focus); window.addEventListener('online', focus); window.addEventListener('pagehide', leave);
    window.addEventListener('workspace-lease-change', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { alive = false; clearTimeout(timer); clearInterval(interval); window.removeEventListener('pointerdown', activity); window.removeEventListener('keydown', activity); window.removeEventListener('focus', focus); window.removeEventListener('online', focus); window.removeEventListener('pagehide', leave); window.removeEventListener('workspace-lease-change', focus); document.removeEventListener('visibilitychange', focus); };
  }, [session?.member, location, resourceType, resourceId]);
  return { presence, unavailable };
}
export function useEditLease(type: ResourceType, id: string | undefined, shared = true, explicitAllowed?: boolean, autoAcquire = false, onAcquired?: () => Promise<void>) {
  const { session, setResource } = useContext(CollaborationContext);
  useEffect(() => { if (!id || !setResource) return; setResource({ type, id }); return () => setResource(undefined); }, [id, type, setResource]);
  const allowed = explicitAllowed ?? (type === 'brand' ? session?.permissions.editBrand === true : !session?.member || session.permissions.editCampaigns);
  const [, render] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const latestOnAcquired = useRef(onAcquired);
  const desired = useRef(id);
  useEffect(() => { latestOnAcquired.current = onAcquired; desired.current = id; });
  useEffect(() => {
    if (!id || !shared) return;
    let alive = true, renewing = false;
    const change = () => { if (alive) render(n => n + 1); };
    const renew = async () => {
      if (renewing || !activeLease(type, id)) { change(); return; }
      renewing = true;
      try { await renewLease(type, id); }
      catch (caught) { if (alive) setError(caught instanceof Error ? caught.message : 'Conexão de edição interrompida.'); }
      finally { renewing = false; }
    };
    const interval = setInterval(() => void renew(), 15000);
    const focus = () => { void renew(); };
    window.addEventListener('workspace-lease-change', change); window.addEventListener('focus', focus); window.addEventListener('online', focus);
    return () => { alive = false; clearInterval(interval); window.removeEventListener('workspace-lease-change', change); window.removeEventListener('focus', focus); window.removeEventListener('online', focus); void releaseLease(type, id); };
  }, [type, id, shared]);
  useEffect(() => {
    if (!autoAcquire || !id || !shared || !allowed || activeLease(type, id)) return;
    let alive = true;
    queueMicrotask(() => { if (alive) { setBusy(true); setError(''); } });
    void acquireLease(type, id).then(async () => {
      if (desired.current !== id) { await releaseLease(type, id); return; }
      await latestOnAcquired.current?.();
    }).catch(caught => {
      if (alive) setError(caught instanceof Error ? caught.message : 'Não foi possível abrir a edição. Tente novamente.');
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [type, id, shared, allowed, autoAcquire]);
  const editing = Boolean(id && allowed && !busy && (!shared || activeLease(type, id)));
  const begin = async () => {
    if (!id || !allowed) return false;
    setBusy(true); setError('');
    try { if (shared) await acquireLease(type, id); return true; }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível iniciar a edição.'); return false; }
    finally { setBusy(false); }
  };
  const finish = async () => { if (id && shared) await releaseLease(type, id); setError(''); };
  return { editing, allowed, busy, error, begin, finish };
}
