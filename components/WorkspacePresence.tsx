'use client';
import { useContext, useState } from 'react';
import { Eye, Pencil, Users } from 'lucide-react';
import type { PresenceEntry, ResourceType } from '@/types/collaboration';
import { CollaborationContext, useEditLease } from '@/lib/use-collaboration';
const initials = (name: string) => name.split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
function color(email: string) { return ['#2563eb', '#9333ea', '#0f766e', '#c2410c', '#be185d'][[...email].reduce((n, c) => n + c.charCodeAt(0), 0) % 5]; }
export function PresenceAvatars({ entries, compact = false }: { entries: PresenceEntry[]; compact?: boolean }) {
  const people = [...new Map(entries.map(p => [p.userId, p])).values()];
  if (!people.length) return null;
  return <details className={`presence-avatars ${compact ? 'compact' : ''}`}><summary aria-label={`${people.length} pessoas no workspace`}><Users size={16} />{people.slice(0, 4).map(p => <span key={p.userId} className="member-avatar" style={{ background: color(p.email) }} title={p.name}>{initials(p.name)}{entries.some(e => e.userId === p.userId && e.editing) && <Pencil size={10} />}</span>)}{people.length > 4 && <span>+{people.length - 4}</span>}</summary><div className="presence-popover">{people.map(p => <div className="presence-person" key={p.userId}><span className="member-avatar" style={{ background: color(p.email) }}>{initials(p.name)}</span><div><strong>{p.name}</strong><small>{p.state === 'away' ? 'Ausente' : 'Online'}</small>{entries.filter(e => e.userId === p.userId).map((e, i) => <small key={i}>{e.editing ? 'Editando' : 'Visualizando'} {e.resourceName || e.location}</small>)}</div></div>)}</div></details>;
}
export function ResourcePresence({ type, id }: { type: ResourceType; id: string }) {
  const { presence } = useContext(CollaborationContext);
  return <PresenceAvatars compact entries={presence.filter(p => p.resourceType === type && p.resourceId === id)} />;
}
export function EditLeaseBar({ lease, type, id, onBegin, onFinish, onCopy }: { lease: ReturnType<typeof useEditLease>; type: ResourceType; id: string; onBegin?: () => Promise<void>; onFinish?: () => Promise<void>; onCopy?: () => void }) {
  const { presence } = useContext(CollaborationContext);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const begin = async () => { setSaveError(''); if (await lease.begin()) { try { await onBegin?.(); } catch (caught) { setSaveError(caught instanceof Error ? caught.message : 'Não foi possível atualizar o recurso.'); await lease.finish(); } } };
  const finish = async () => { setSaving(true); setSaveError(''); try { await onFinish?.(); await lease.finish(); } catch (caught) { setSaveError(caught instanceof Error ? caught.message : 'O salvamento não foi concluído.'); } finally { setSaving(false); } };
  const other = presence.find(p => p.resourceType === type && p.resourceId === id && p.editing);
  return <div className="edit-lease-bar" role="status"><div>{lease.editing ? <Pencil size={17} /> : <Eye size={17} />}<span>{lease.editing ? 'Você está editando' : other ? `${other.name} está editando. Você está em visualização.` : 'Modo de visualização'}{(lease.error || saveError) && <small role="alert">{lease.error || saveError}</small>}</span><ResourcePresence type={type} id={id} /></div><div>{lease.allowed && !lease.editing && <button className="button primary" disabled={lease.busy} onClick={() => void begin()}>{lease.busy ? 'Abrindo edição…' : 'Editar'}</button>}{lease.editing && <button className="button" disabled={lease.busy || saving} onClick={() => void finish()}>{saving ? 'Salvando…' : 'Salvar e encerrar edição'}</button>}{onCopy && !lease.editing && lease.allowed && <button className="button" onClick={onCopy}>Editar uma cópia</button>}</div></div>;
}
