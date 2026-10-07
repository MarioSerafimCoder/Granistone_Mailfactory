'use client';
import { useContext, useEffect, useMemo, useState } from 'react';
import { Gem, Image as ImageIcon, Plus, Search } from 'lucide-react';
import { online } from '@/lib/online';
import type { MediaAsset, OnlineMaterial } from '@/types/online';
import AssetLibrary from './AssetLibrary';
import { Field, Modal, TextArea } from './ui';
import { CollaborationContext, useEditLease } from '@/lib/use-collaboration';
import { EditLeaseBar } from './WorkspacePresence';
import { ResourcePresence } from './WorkspacePresence';
import { useResourceDraft } from '@/lib/use-resource-draft';
import ResourceDraftRecovery from './ResourceDraftRecovery';

const blank = (): OnlineMaterial => ({ id: '', name: '', slug: '', category: '', description: '', features: [], applications: [], pageUrl: '', active: true, assetIds: [] });
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export default function LibraryPage() {
  const [tab, setTab] = useState<'images' | 'materials'>('images');
  const [materials, setMaterials] = useState<OnlineMaterial[]>([]); const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState(''); const [editing, setEditing] = useState<OnlineMaterial>();
  const [category, setCategory] = useState(''), [activeFilter, setActiveFilter] = useState(''), [imageQuery, setImageQuery] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const { session } = useContext(CollaborationContext);
  const canEdit = session?.permissions.editCampaigns ?? false;
  const lease = useEditLease('material', editing?.id || undefined, true, canEdit);
  const draft = useResourceDraft<OnlineMaterial>('material', editing?.id, setEditing);
  useEffect(() => {
    if (tab !== 'materials') return;
    let active = true;
    const loadingTimer = setTimeout(() => setLoading(true), 0);
    Promise.all([online.materials.list(), online.assets.list()])
      .then(([m, a]) => { if (active) { setMaterials(m); setAssets(a); setError(''); setLoading(false); } })
      .catch((caught) => { if (active) { setError(caught instanceof Error ? caught.message : 'Não foi possível abrir os materiais.'); setLoading(false); } });
    return () => { active = false; clearTimeout(loadingTimer); };
  }, [tab]);
  const assetById = useMemo(() => new Map(assets.map(item => [item.id, item])), [assets]);
  const categories = useMemo(() => [...new Set(materials.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [materials]);
  const visible = useMemo(() => materials.filter(material => (!category || material.category === category) && (!activeFilter || (activeFilter === 'active') === material.active) && (!query || normalize(material.name + ' ' + material.category + ' ' + material.description + ' ' + material.features.join(' ')).includes(normalize(query)))).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [materials, query, category, activeFilter]);
  const galleryAssets = useMemo(() => assets.filter(item => !imageQuery || normalize(item.name + ' ' + item.alt + ' ' + (item.folderPaths ?? []).join(' ')).includes(normalize(imageQuery))).sort((a, b) => Number(editing?.assetIds.includes(b.id)) - Number(editing?.assetIds.includes(a.id))).slice(0, 80), [assets, editing?.assetIds, imageQuery]);
  const asset = (id?: string) => id ? assetById.get(id) : undefined;
  async function save() {
    if (!editing?.name.trim() || (!lease.editing && editing.id) || !canEdit) return; setBusy(true); setError('');
    try { const saved = await online.materials.save(editing); draft.clear(); setMaterials((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); setEditing(undefined); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o material.'); }
    finally { setBusy(false); }
  }
  return <div className="page library-page">
    <div className="page-heading"><div><span className="eyebrow">ACERVO GRANISTONE</span><h1>Biblioteca visual</h1><p>Imagens hospedadas, materiais e dados técnicos em um só lugar.</p></div></div>
    <div className="library-tabs" role="tablist"><button className={tab === 'images' ? 'active' : ''} onClick={() => setTab('images')}><ImageIcon size={17} /> Imagens</button><button className={tab === 'materials' ? 'active' : ''} onClick={() => setTab('materials')}><Gem size={17} /> Materiais</button></div>
    {tab === 'images' ? <AssetLibrary embedded /> : <>
      <div className="material-toolbar"><label className="asset-search"><Search size={15} /><input aria-label="Buscar material" value={query} placeholder="Buscar material…" onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Filtrar categoria de material" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Filtrar estado de material" value={activeFilter} onChange={e => setActiveFilter(e.target.value)}><option value="">Ativos e inativos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select><button className="button primary" disabled={!canEdit} onClick={() => setEditing(blank())}><Plus size={15} /> Novo material</button></div>
      {!!materials.length && <p className="material-count" role="status">{visible.length} de {materials.length} materiais · selecione para ver imagens e detalhes</p>}
      {error && <p className="alert" role="alert">{error} {error.includes('Entre com') && <a href="/signin-with-chatgpt?return_to=/" target="_top">Entrar com ChatGPT</a>}</p>}
      {loading && <p className="muted" role="status">Carregando materiais e imagens…</p>}
      <div className="material-grid">{visible.map((material) => {
        const cover = asset(material.heroAssetId) ?? asset(material.assetIds[0]);
        return <article className="material-card" key={material.id}><button className="material-card-open" type="button" aria-label={`Abrir material ${material.name}`} onClick={() => setEditing(material)}>{cover ? <img src={cover.url} alt={cover.alt || material.name} loading="lazy" /> : <div className="material-placeholder"><Gem size={28} /></div>}<div><span>{material.category || 'Sem categoria'}</span><h2>{material.name}</h2><p>{material.description || 'Adicione uma descrição para este material.'}</p><small>{material.assetIds.length} {material.assetIds.length === 1 ? 'imagem' : 'imagens'} · {material.active ? 'Ativo' : 'Inativo'}</small></div></button><ResourcePresence type="material" id={material.id} /></article>;
      })}{!visible.length && !loading && !error && <div className="asset-empty"><Gem size={30} /><strong>{materials.length ? 'Nenhum material encontrado' : 'Nenhum material cadastrado'}</strong><span>{materials.length ? 'Tente outro nome, categoria ou estado.' : 'Crie o primeiro material e associe suas imagens.'}</span>{!!materials.length && <button className="button" type="button" onClick={() => { setQuery(''); setCategory(''); setActiveFilter(''); }}>Limpar filtros</button>}</div>}</div>
    </>}
    {editing && <Modal title={editing.id ? `Editar ${editing.name}` : 'Novo material'} onClose={() => setEditing(undefined)} side>
      {editing.id && <EditLeaseBar lease={lease} type="material" id={editing.id} onFinish={async () => { const saved = await online.materials.save(editing); draft.clear(); setMaterials(current => current.map(m => m.id === saved.id ? saved : m)); setEditing(saved); }} />}
      <ResourceDraftRecovery draft={draft} />
      <div className="material-form-grid" inert={Boolean(editing.id && !lease.editing) || !canEdit} aria-disabled={Boolean(editing.id && !lease.editing) || !canEdit}><div>
        <Field label="Nome" value={editing.name} onChange={(event) => draft.change({ ...editing, name: event.target.value })} />
        <Field label="Categoria" value={editing.category} placeholder="Granito, quartzito…" onChange={(event) => draft.change({ ...editing, category: event.target.value })} />
        <TextArea label="Descrição" value={editing.description} onChange={(event) => draft.change({ ...editing, description: event.target.value })} />
        <TextArea label="Características · uma por linha" value={editing.features.join('\n')} onChange={(event) => draft.change({ ...editing, features: event.target.value.split('\n').filter(Boolean) })} />
        <TextArea label="Aplicações · uma por linha" value={editing.applications.join('\n')} onChange={(event) => draft.change({ ...editing, applications: event.target.value.split('\n').filter(Boolean) })} />
        <Field label="Página do material" value={editing.pageUrl} placeholder="https://…" onChange={(event) => draft.change({ ...editing, pageUrl: event.target.value })} />
        <label className="check-line"><input type="checkbox" checked={editing.active} onChange={(event) => draft.change({ ...editing, active: event.target.checked })} /> Material ativo</label>
      </div><div className="material-asset-picker"><strong>Galeria do material</strong><p>Selecione as imagens que podem ser sugeridas no editor. {editing.assetIds.length} selecionadas.</p><Field label="Buscar imagens para o material" value={imageQuery} onChange={e => setImageQuery(e.target.value)} placeholder="Nome ou pasta…" /><div>{galleryAssets.map((item) => <label key={item.id} className={editing.assetIds.includes(item.id) ? 'active' : ''}><img src={item.url} alt={item.alt || item.name} loading="lazy" /><input type="checkbox" checked={editing.assetIds.includes(item.id)} onChange={(event) => draft.change({ ...editing, assetIds: event.target.checked ? [...editing.assetIds, item.id] : editing.assetIds.filter((id) => id !== item.id), heroAssetId: editing.heroAssetId || (event.target.checked ? item.id : undefined) })} /><span>{item.name}</span></label>)}</div>{assets.length > 80 && <small className="muted">Mostrando até 80 imagens por vez. Busque pelo nome ou pasta para encontrar outras.</small>}</div></div>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="modal-actions"><button className="button" onClick={() => setEditing(undefined)}>Fechar</button><button className="button primary" disabled={busy || !editing.name.trim() || !canEdit || Boolean(editing.id && !lease.editing)} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar material'}</button></div>
    </Modal>}
  </div>;
}
