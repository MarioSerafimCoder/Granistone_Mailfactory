import type { EditLock, ResourceType } from '@/types/collaboration';
import { OnlineError } from './online-error';

let sessionId = '', tabId = '';
const locks = new Map<string, EditLock>();
const inFlight = new Map<string, Promise<EditLock>>();
const key = (type: ResourceType, id: string) => `${type}:${id}`;
export function browserIdentity() {
  // Memory-scoped identity: a duplicated browser tab never inherits a lease.
  if (!sessionId) { sessionId = crypto.randomUUID(); tabId = crypto.randomUUID(); }
  return { sessionId, tabId };
}
function changed() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('workspace-lease-change')); }
export function activeLease(type: ResourceType, id: string) {
  const lock = locks.get(key(type, id));
  return lock && lock.expiresAt * 1000 > Date.now() ? lock : undefined;
}
export function invalidateLease(type: ResourceType, id: string) { locks.delete(key(type, id)); changed(); }
export function editHeaders(type: ResourceType, id: string): Record<string, string> {
  const identity = browserIdentity(), lock = activeLease(type, id);
  return { 'X-Workspace-Session': identity.sessionId, 'X-Workspace-Tab': identity.tabId, ...(lock ? { 'X-Edit-Token': lock.token, 'X-Edit-Generation': String(lock.generation) } : {}) };
}
async function operation(action: string, input: unknown): Promise<EditLock> {
  const response = await fetch(`/api/workspace/edit-locks/${action}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const data = await response.json();
  if (!response.ok) throw new OnlineError(data.error || 'Edição indisponível.', response.status);
  return data;
}
export async function acquireLease(type: ResourceType, id: string) {
  const existing = activeLease(type, id); if (existing) return existing;
  const k = key(type, id), pending = inFlight.get(k); if (pending) return pending;
  const promise = operation('acquire', { resourceType: type, resourceId: id, ...browserIdentity() }).then(lock => { locks.set(k, lock); changed(); return lock; }).finally(() => inFlight.delete(k));
  inFlight.set(k, promise); return promise;
}
export async function renewLease(type: ResourceType, id: string) {
  const lock = locks.get(key(type, id)); if (!lock) throw new Error('Clique em Editar para retomar a edição.');
  try { const renewed = await operation('renew', lock); locks.set(key(type, id), renewed); changed(); return renewed; }
  catch (error) { invalidateLease(type, id); throw error; }
}
export async function releaseLease(type: ResourceType, id: string) {
  const lock = locks.get(key(type, id)); locks.delete(key(type, id)); changed();
  if (lock) await operation('release', lock).catch(() => {});
}
export async function withLease<T>(type: ResourceType, id: string, action: () => Promise<T>): Promise<T> {
  const held = Boolean(activeLease(type, id)); await acquireLease(type, id);
  try { return await action(); } finally { if (!held) await releaseLease(type, id); }
}
