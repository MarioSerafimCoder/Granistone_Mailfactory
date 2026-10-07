'use client';
import { useContext, useEffect, useState } from 'react';
import type { SavedDesign } from '@/types/design';
import { online } from '@/lib/online';
import { CollaborationContext, useEditLease } from '@/lib/use-collaboration';
import SavedDesignDialog from './SavedDesignDialog';
import { Modal } from './ui';
export default function SavedDesignLibrary({ kind, onUse }: { kind: 'block' | 'template'; onUse: (value: SavedDesign) => void }) {
  const { session } = useContext(CollaborationContext);
  const [items, setItems] = useState<SavedDesign[]>([]), [editing, setEditing] = useState<SavedDesign>(), [removing, setRemoving] = useState<SavedDesign>();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lease = useEditLease('design', removing?.id, !!removing, session?.role === 'admin');
  async function refresh() { try { setItems(await online.designs.list(kind)); setError(''); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Biblioteca indisponível.'); } }
  useEffect(() => {
    if (!session?.member) return;
    let live = true;
    const load = () => { void online.designs.list(kind).then(items => { if (live) { setItems(items); setError(''); } }).catch(e => { if (live) setError(e.message); }); };
    const first = setTimeout(load, 0), timer = setInterval(load, 15000); window.addEventListener('focus', load);
    return () => { live = false; clearTimeout(first); clearInterval(timer); window.removeEventListener('focus', load); };
  }, [kind, session?.member]);
  async function copy(item: SavedDesign) {
    setBusy(true); setError('');
    try { await online.designs.save({ ...structuredClone(item), id: crypto.randomUUID(), name: item.name + ' · cópia', revision: 0 }); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível duplicar.'); } finally { setBusy(false); }
  }
  async function remove() {
    if (!removing) return; setBusy(true); setError('');
    try {
      if (!await lease.begin()) return;
      await online.designs.remove(removing.id, removing.revision); setRemoving(undefined); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível excluir.'); }
    finally { await lease.finish(); setBusy(false); }
  }
  return <div className="saved-design-library">
    {!session?.member && <p className="muted">Entre com ChatGPT para acessar os {kind === 'block' ? 'blocos' : 'templates'} compartilhados.</p>}
    {error && <p role="alert" className="alert">{error}</p>}
    {session?.member && <button type="button" className="text-button" onClick={() => void refresh()}>Atualizar coleção</button>}
    <div className="saved-design-grid">{items.map(item => <article className="saved-design-card" key={item.id}><span className="eyebrow">{item.category}</span><h3>{item.name}</h3><p>{item.description}</p><small>Revisão {item.revision} · {item.updatedBy}</small><div className="actions"><button type="button" className="button primary" onClick={() => onUse(item)} disabled={!session?.editor}>{kind === 'block' ? 'Inserir bloco' : 'Usar template'}</button>{session?.editor && <><button type="button" className="button" onClick={() => setEditing(item)}>Editar</button><button type="button" className="button" disabled={busy} onClick={() => void copy(item)}>Duplicar</button></>}{session?.role === 'admin' && <button type="button" className="text-button danger" onClick={() => setRemoving(item)}>Excluir</button>}</div></article>)}</div>
    {session?.member && !items.length && !error && <p className="muted">Nenhum {kind === 'block' ? 'bloco salvo' : 'template personalizado'} nesta coleção.</p>}
    {editing && <SavedDesignDialog initial={editing} existing={editing} onClose={() => setEditing(undefined)} onSaved={() => void refresh()} />}
    {removing && <Modal title="Excluir da biblioteca" onClose={() => { if (!busy) setRemoving(undefined); }}><p>Excluir “{removing.name}”? As campanhas que já usam uma cópia continuarão disponíveis.</p>{(lease.error || error) && <p className="alert">{lease.error || error}</p>}<div className="modal-actions"><button type="button" className="button" disabled={busy} onClick={() => setRemoving(undefined)}>Cancelar</button><button type="button" className="button danger" disabled={busy} onClick={() => void remove()}>Excluir da biblioteca</button></div></Modal>}
  </div>;
}
