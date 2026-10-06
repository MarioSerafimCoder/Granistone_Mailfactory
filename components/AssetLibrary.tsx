'use client';
import { useContext, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Pencil, RefreshCw, Search, Trash2 } from 'lucide-react';
import { online } from '@/lib/online';
import { assetCategories, type MediaAsset, type OnlineMaterial } from '@/types/online';
import { Field, Modal, Select, TextArea } from './ui';
import AssetFolders from './AssetFolders';
import AssetUpload from './AssetUpload';
import { CollaborationContext, useEditLease } from '@/lib/use-collaboration';
import { EditLeaseBar, ResourcePresence } from './WorkspacePresence';
import { useResourceDraft } from '@/lib/use-resource-draft';
import ResourceDraftRecovery from './ResourceDraftRecovery';

type Props = { onSelect?: (asset: MediaAsset) => void; onClose?: () => void; embedded?: boolean; lazy?: boolean; materialId?: string; preferredOrientation?: MediaAsset['orientation'] };
const labels: Record<MediaAsset['category'], string> = { material: 'Material', ambiente: 'Ambiente', chapa: 'Chapa', detalhe: 'Detalhe', institucional: 'Institucional', evento: 'Evento', outro: 'Outro' };

export default function AssetLibrary({ onSelect, onClose, embedded = false, lazy = false, materialId = '', preferredOrientation }: Props) {
  const [items, setItems] = useState<MediaAsset[]>([]); const [materials, setMaterials] = useState<OnlineMaterial[]>([]);
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('');
  const [folder, setFolder] = useState('');
  const [orientation, setOrientation] = useState(preferredOrientation ?? ''); const [material, setMaterial] = useState(materialId);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [selected, setSelected] = useState<MediaAsset>();
  const [active, setActive] = useState(!lazy);
  const { session } = useContext(CollaborationContext);
  const canEdit = session?.permissions.editCampaigns ?? false;
  const lease = useEditLease('asset', selected?.id, true, canEdit);
  const draft = useResourceDraft<MediaAsset>('asset', selected?.id, setSelected);
  async function refresh() {
    setBusy(true); setError('');
    try { const [assets, materialItems] = await Promise.all([online.assets.list(), online.materials.list()]); setItems(assets); setMaterials(materialItems); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível abrir a biblioteca.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!active) return;
    let live = true;
    const load = () => {
      setBusy(true);
      Promise.all([online.assets.list(), online.materials.list()])
        .then(([assets, materialItems]) => { if (live) { setItems(assets); setMaterials(materialItems); setError(''); } })
        .catch((caught) => { if (live) setError(caught instanceof Error ? caught.message : 'Não foi possível abrir a biblioteca.'); })
        .finally(() => { if (live) setBusy(false); });
    };
    const timer = setTimeout(load, 0);
    const interval = setInterval(load, 30000);
    window.addEventListener('focus', load);
    return () => { live = false; clearTimeout(timer); clearInterval(interval); window.removeEventListener('focus', load); };
  }, [active]);
  const filtered = useMemo(() => items.filter((asset) => {
    if (folder && !(asset.folderPaths ?? []).some(path => path === folder || path.startsWith(`${folder}/`))) return false;
    if (category && asset.category !== category) return false;
    const searchable = `${asset.name} ${asset.alt} ${(asset.folderPaths ?? []).join(' ')}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    if (query && !searchable.includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'))) return false;
    if (orientation && asset.orientation !== orientation) return false;
    return !material || (materials.find((item) => item.id === material)?.assetIds.includes(asset.id) ?? false);
  }), [items, materials, material, orientation, folder, category, query]);
  async function saveAsset() {
    if (!selected || !lease.editing) return; setBusy(true); setError('');
    try {
      const updated = await online.assets.update(selected.id, { revision: selected.revision, name: selected.name, alt: selected.alt, category: selected.category, folderPaths: selected.folderPaths });
      draft.clear(); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)); setSelected(undefined);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar.'); throw caught; }
    finally { setBusy(false); }
  }
  async function removeAsset() {
    if (!selected || !lease.editing || session?.role !== 'admin') return; setBusy(true); setError('');
    try { await online.assets.remove(selected.id, selected.revision); setItems((current) => current.filter((item) => item.id !== selected.id)); setSelected(undefined); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível excluir.'); }
    finally { setBusy(false); }
  }
  const body = !active ? <button className="asset-library-open" type="button" onClick={() => setActive(true)}><ImagePlus size={24} /><strong>Abrir biblioteca de imagens</strong><span>Busque fotos hospedadas e recomendações para este espaço.</span></button> : <div className="asset-browser">
    <AssetFolders items={items} folder={folder} onChange={setFolder} />
    {canEdit && <AssetUpload folder={folder} material={materials.find(item => item.id === material)} onComplete={refresh} />}
    <div className="asset-toolbar">
      <label className="asset-search"><Search size={15} /><input value={query} placeholder="Buscar por nome…" onChange={(event) => setQuery(event.target.value)} /></label>
      <select aria-label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas as categorias</option>{assetCategories.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select>
      <select aria-label="Orientação" value={orientation} onChange={(event) => setOrientation(event.target.value as typeof orientation)}><option value="">Todas as orientações</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option><option value="square">Quadrada</option></select>
      <select aria-label="Material" value={material} onChange={(event) => setMaterial(event.target.value)}><option value="">Todos os materiais</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <button className="button" type="button" disabled={busy} onClick={() => void refresh()}><RefreshCw size={15} /> Atualizar</button>
    </div>
    <p className="asset-count" role="status">{filtered.length} {filtered.length === 1 ? 'imagem' : 'imagens'}{folder ? ' nesta pasta' : ' na biblioteca'}{(query || category || orientation || material) ? ' com os filtros atuais' : ''}</p>
    {preferredOrientation && <p className="asset-recommendation">Imagens {preferredOrientation === 'horizontal' ? 'horizontais' : preferredOrientation === 'vertical' ? 'verticais' : 'quadradas'} são as mais indicadas para este espaço.</p>}
    {error && <p role="alert" className="alert">{error} {error.includes('Entre com') && <a href="/signin-with-chatgpt?return_to=/" target="_top">Entrar com ChatGPT</a>}</p>}
    {busy && !items.length ? <p className="muted">Carregando biblioteca…</p> : <div className="asset-grid">
      {filtered.map((asset) => <article className="asset-card" key={asset.id}>
        <ResourcePresence type="asset" id={asset.id} />
        <button className="asset-image" type="button" onClick={() => onSelect ? onSelect(asset) : setSelected(asset)}><img src={asset.url} alt={asset.alt || asset.name} loading="lazy" /></button>
        <div><strong title={asset.name}>{asset.name}</strong><span>{asset.width} × {asset.height} · {labels[asset.category]}</span>{!!asset.folderPaths?.length && <span title={asset.folderPaths.join(', ')}>{asset.folderPaths.join(' · ')}</span>}</div>
        <button type="button" className="icon-button" aria-label={`Editar ${asset.name}`} onClick={() => setSelected(asset)}><Pencil size={15} /></button>
        {onSelect && <button type="button" className="button" onClick={() => onSelect(asset)}>Usar imagem</button>}
      </article>)}
      {!filtered.length && !error && <div className="asset-empty"><ImagePlus size={30} /><strong>Nenhuma imagem encontrada</strong><span>Envie uma imagem ou ajuste os filtros.</span></div>}
    </div>}
    {selected && <Modal title="Detalhes da imagem" onClose={() => setSelected(undefined)}>
      <EditLeaseBar lease={lease} type="asset" id={selected.id} onFinish={saveAsset} />
      <ResourceDraftRecovery draft={draft} />
      <img className="asset-detail-preview" src={selected.url} alt={selected.alt || selected.name} />
      <div className="asset-detail-meta"><span>{selected.width} × {selected.height}</span><span>{Math.round(selected.fileSize / 1024)} KB</span><span>{selected.orientation}</span></div>
      <fieldset disabled={!lease.editing} className="lease-fields"><legend className="sr-only">Dados da imagem</legend><Field label="Nome" value={selected.name} onChange={(event) => draft.change({ ...selected, name: event.target.value })} />
      <Field label="Texto alternativo" value={selected.alt} onChange={(event) => draft.change({ ...selected, alt: event.target.value })} />
      <TextArea label="Pastas · uma por linha" placeholder="Imagens Catálogo/Amazonita Amazon Green" value={(selected.folderPaths ?? []).join('\n')} onChange={(event) => draft.change({ ...selected, folderPaths: event.target.value.split('\n') })} />
      <Select label="Categoria" value={selected.category} onChange={(event) => draft.change({ ...selected, category: event.target.value as MediaAsset['category'] })}>{assetCategories.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</Select>
      </fieldset>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="modal-actions spread"><button type="button" className="button danger" disabled={busy || !lease.editing || session?.role !== 'admin'} onClick={() => void removeAsset()}><Trash2 size={14} /> Excluir</button><div><button type="button" className="button" onClick={() => setSelected(undefined)}>Fechar</button><button type="button" className="button primary" disabled={busy || !lease.editing} onClick={() => void saveAsset().catch(() => {})}>Salvar</button></div></div>
    </Modal>}
  </div>;
  if (embedded) return body;
  return <Modal title="Biblioteca de imagens" onClose={onClose ?? (() => {})} wide>{body}</Modal>;
}
