'use client';
import { useEffect, useMemo, useState } from 'react';
import { Gem, Image as ImageIcon, Plus, Search } from 'lucide-react';
import { online } from '@/lib/online';
import type { MediaAsset, OnlineMaterial } from '@/types/online';
import AssetLibrary from './AssetLibrary';
import { Field, Modal, TextArea } from './ui';

const blank = (): OnlineMaterial => ({ id: '', name: '', slug: '', category: '', description: '', features: [], applications: [], pageUrl: '', active: true, assetIds: [] });

export default function LibraryPage() {
  const [tab, setTab] = useState<'images' | 'materials'>('images');
  const [materials, setMaterials] = useState<OnlineMaterial[]>([]); const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState(''); const [editing, setEditing] = useState<OnlineMaterial>();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (tab !== 'materials') return;
    let active = true;
    Promise.all([online.materials.list(), online.assets.list()])
      .then(([m, a]) => { if (active) { setMaterials(m); setAssets(a); setError(''); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Não foi possível abrir os materiais.'); });
    return () => { active = false; };
  }, [tab]);
  const visible = useMemo(() => materials.filter((material) => `${material.name} ${material.category}`.toLowerCase().includes(query.toLowerCase())), [materials, query]);
  const asset = (id?: string) => assets.find((item) => item.id === id);
  async function save() {
    if (!editing?.name.trim()) return; setBusy(true); setError('');
    try { const saved = await online.materials.save(editing); setMaterials((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); setEditing(undefined); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o material.'); }
    finally { setBusy(false); }
  }
  return <div className="page library-page">
    <div className="page-heading"><div><span className="eyebrow">ACERVO GRANISTONE</span><h1>Biblioteca visual</h1><p>Imagens hospedadas, materiais e dados técnicos em um só lugar.</p></div></div>
    <div className="library-tabs" role="tablist"><button className={tab === 'images' ? 'active' : ''} onClick={() => setTab('images')}><ImageIcon size={17} /> Imagens</button><button className={tab === 'materials' ? 'active' : ''} onClick={() => setTab('materials')}><Gem size={17} /> Materiais</button></div>
    {tab === 'images' ? <AssetLibrary embedded /> : <>
      <div className="material-toolbar"><label className="asset-search"><Search size={15} /><input value={query} placeholder="Buscar material…" onChange={(event) => setQuery(event.target.value)} /></label><button className="button primary" onClick={() => setEditing(blank())}><Plus size={15} /> Novo material</button></div>
      {error && <p className="alert" role="alert">{error} {error.includes('Entre com') && <a href="/signin-with-chatgpt?return_to=/" target="_top">Entrar com ChatGPT</a>}</p>}
      <div className="material-grid">{visible.map((material) => {
        const cover = asset(material.heroAssetId) ?? asset(material.assetIds[0]);
        return <article className="material-card" key={material.id} onClick={() => setEditing(material)}>{cover ? <img src={cover.url} alt={cover.alt || material.name} /> : <div className="material-placeholder"><Gem size={28} /></div>}<div><span>{material.category || 'Sem categoria'}</span><h2>{material.name}</h2><p>{material.description || 'Adicione uma descrição para este material.'}</p><small>{material.assetIds.length} {material.assetIds.length === 1 ? 'imagem' : 'imagens'} · {material.active ? 'Ativo' : 'Inativo'}</small></div></article>;
      })}{!visible.length && !error && <div className="asset-empty"><Gem size={30} /><strong>Nenhum material cadastrado</strong><span>Crie o primeiro material e associe suas imagens.</span></div>}</div>
    </>}
    {editing && <Modal title={editing.id ? `Editar ${editing.name}` : 'Novo material'} onClose={() => setEditing(undefined)} wide>
      <div className="material-form-grid"><div>
        <Field label="Nome" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
        <Field label="Categoria" value={editing.category} placeholder="Granito, quartzito…" onChange={(event) => setEditing({ ...editing, category: event.target.value })} />
        <TextArea label="Descrição" value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
        <TextArea label="Características · uma por linha" value={editing.features.join('\n')} onChange={(event) => setEditing({ ...editing, features: event.target.value.split('\n').filter(Boolean) })} />
        <TextArea label="Aplicações · uma por linha" value={editing.applications.join('\n')} onChange={(event) => setEditing({ ...editing, applications: event.target.value.split('\n').filter(Boolean) })} />
        <Field label="Página do material" value={editing.pageUrl} placeholder="https://…" onChange={(event) => setEditing({ ...editing, pageUrl: event.target.value })} />
        <label className="check-line"><input type="checkbox" checked={editing.active} onChange={(event) => setEditing({ ...editing, active: event.target.checked })} /> Material ativo</label>
      </div><div className="material-asset-picker"><strong>Galeria do material</strong><p>Selecione as imagens que podem ser sugeridas no editor.</p><div>{assets.map((item) => <label key={item.id} className={editing.assetIds.includes(item.id) ? 'active' : ''}><img src={item.url} alt={item.alt || item.name} /><input type="checkbox" checked={editing.assetIds.includes(item.id)} onChange={(event) => setEditing({ ...editing, assetIds: event.target.checked ? [...editing.assetIds, item.id] : editing.assetIds.filter((id) => id !== item.id), heroAssetId: editing.heroAssetId || (event.target.checked ? item.id : undefined) })} /><span>{item.name}</span></label>)}</div></div></div>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="modal-actions"><button className="button" onClick={() => setEditing(undefined)}>Cancelar</button><button className="button primary" disabled={busy || !editing.name.trim()} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar material'}</button></div>
    </Modal>}
  </div>;
}
