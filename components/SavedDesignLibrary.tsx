'use client';
import { useContext, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import type { SavedDesign } from '@/types/design';
import { blockRegistry } from '@/blocks/registry';
import { online } from '@/lib/online';
import { CollaborationContext, useEditLease } from '@/lib/use-collaboration';
import SavedDesignDialog from './SavedDesignDialog';
import SavedDesignPreview from './SavedDesignPreview';
import { Modal } from './ui';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
export default function SavedDesignLibrary({ kind, onUse }: { kind: 'block' | 'template'; onUse: (value: SavedDesign) => void }) {
  const { session } = useContext(CollaborationContext);
  const [items, setItems] = useState<SavedDesign[]>([]);
  const [editing, setEditing] = useState<SavedDesign>(), [removing, setRemoving] = useState<SavedDesign>();
  const [query, setQuery] = useState(''), [category, setCategory] = useState(''), [selected, setSelected] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const lease = useEditLease('design', removing?.id, !!removing, session?.role === 'admin');
  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try { setItems(await online.designs.list(kind)); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Biblioteca indisponível.'); }
    finally { if (!silent) setLoading(false); }
  }
  useEffect(() => {
    if (!session?.member) return;
    let live = true;
    const load = () => { void online.designs.list(kind).then(items => { if (live) { setItems(items); setError(''); setLoading(false); } }).catch(e => { if (live) { setError(e instanceof Error ? e.message : 'Biblioteca indisponível.'); setLoading(false); } }); };
    const first = setTimeout(load, 0), timer = setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => { live = false; clearTimeout(first); clearInterval(timer); window.removeEventListener('focus', load); };
  }, [kind, session?.member]);
  const categories = useMemo(() => [...new Set(items.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [items]);
  const visible = useMemo(() => items.filter(item => (!category || item.category === category) && (!query || normalize(item.name + ' ' + item.description + ' ' + item.category + ' ' + (item.kind === 'block' ? blockRegistry[item.payload.type].name : item.payload.sections.map(s => blockRegistry[s.type].name).join(' '))).includes(normalize(query)))), [items, category, query]);
  async function copy(item: SavedDesign) {
    setBusy(true); setError(''); setMessage('');
    try { await online.designs.save({ ...structuredClone(item), id: crypto.randomUUID(), name: item.name + ' · cópia', revision: 0 }); await refresh(true); setMessage((kind === 'block' ? 'Bloco' : 'Template') + ' duplicado na biblioteca.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível duplicar.'); } finally { setBusy(false); }
  }
  async function remove() {
    if (!removing) return; setBusy(true); setError(''); setMessage('');
    try {
      if (!await lease.begin()) return;
      await online.designs.remove(removing.id, removing.revision);
      setRemoving(undefined); await refresh(true);
      setMessage((kind === 'block' ? 'Bloco' : 'Template') + ' removido da biblioteca.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível excluir.'); }
    finally { await lease.finish(); setBusy(false); }
  }
  return <div className="saved-design-library">
    {!session?.member && <p className="muted">Entre com ChatGPT para acessar os {kind === 'block' ? 'blocos' : 'templates'} compartilhados.</p>}
    {session?.member && <div className="saved-design-toolbar"><label className="asset-search"><Search size={16} /><input aria-label={kind === 'block' ? 'Buscar blocos' : 'Buscar templates'} value={query} placeholder={kind === 'block' ? 'Buscar bloco ou tipo…' : 'Buscar template…'} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filtrar categoria" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select><button type="button" className="button" disabled={loading} onClick={() => void refresh()}><RefreshCw size={15} /> Atualizar coleção</button></div>}
    {loading && session?.member && <p role="status" className="muted">Carregando {kind === 'block' ? 'blocos' : 'templates'} compartilhados…</p>}
    {error && <p role="alert" className="alert">{error} <button type="button" className="text-button" onClick={() => void refresh()}>Tentar novamente</button></p>}
    {message && <p role="status" className="action-feedback">{message}</p>}
    {!!items.length && <p className="saved-design-count" role="status">{visible.length} de {items.length} {kind === 'block' ? 'blocos' : 'templates'} na coleção</p>}
    <div className="saved-design-grid">{visible.map(item => <article className={'saved-design-card' + (selected === item.id ? ' selected' : '')} key={item.id}>
      <button type="button" className="saved-design-preview-button" aria-label={'Visualizar ' + item.name} aria-pressed={selected === item.id} onClick={() => setSelected(selected === item.id ? '' : item.id)}><SavedDesignPreview design={item} /></button>
      <div className="saved-design-card-body"><span className="eyebrow">{item.category}</span><h3>{item.name}</h3><p>{item.description || (item.kind === 'block' ? blockRegistry[item.payload.type].name : item.payload.sections.length + ' seções prontas para personalizar')}</p><small>Revisão {item.revision} · {item.updatedBy}</small>
      {selected === item.id && <p className="saved-design-selected">{item.kind === 'block' ? 'Tipo: ' + blockRegistry[item.payload.type].name : item.payload.sections.length + ' blocos no template'} · PT / EN / ES</p>}
      <div className="actions"><button type="button" className="button primary" onClick={() => onUse(item)} disabled={!session?.editor}>{kind === 'block' ? 'Inserir bloco' : 'Usar template'}</button>{session?.editor && <><button type="button" className="button" title="Editar conteúdo ou renomear" onClick={() => setEditing(item)}>Editar</button><button type="button" className="button" disabled={busy} onClick={() => void copy(item)}>Duplicar</button></>}{session?.role === 'admin' && <button type="button" className="text-button danger" onClick={() => setRemoving(item)}>Excluir</button>}</div></div>
    </article>)}</div>
    {session?.member && !loading && !visible.length && !error && <div className="asset-empty"><strong>{items.length ? 'Nenhum resultado para esta busca' : kind === 'block' ? 'Nenhum bloco salvo' : 'Nenhum template personalizado'}</strong><span>{items.length ? 'Tente outro termo ou categoria.' : kind === 'block' ? 'Salve um bloco da campanha para reutilizá-lo aqui.' : 'Abra uma campanha e escolha “Salvar como template”.'}</span>{items.length > 0 && <button type="button" className="button" onClick={() => { setQuery(''); setCategory(''); }}>Limpar filtros</button>}</div>}
    {editing && <SavedDesignDialog initial={editing} existing={editing} onClose={() => setEditing(undefined)} onSaved={() => { void refresh(true); setMessage((kind === 'block' ? 'Bloco' : 'Template') + ' atualizado.'); }} />}
    {removing && <Modal title="Excluir da biblioteca" onClose={() => { if (!busy) setRemoving(undefined); }}><p>Excluir “{removing.name}”? As campanhas que já usam uma cópia continuarão disponíveis.</p>{(lease.error || error) && <p className="alert">{lease.error || error}</p>}<div className="modal-actions"><button type="button" className="button" disabled={busy} onClick={() => setRemoving(undefined)}>Cancelar</button><button type="button" className="button danger" disabled={busy} onClick={() => void remove()}>Excluir da biblioteca</button></div></Modal>}
  </div>;
}
