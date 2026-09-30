'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Pencil, Search, Trash2, Upload } from 'lucide-react';
import { online } from '@/lib/online';
import { assetCategories, type MediaAsset, type OnlineMaterial } from '@/types/online';
import { Field, Modal, Select } from './ui';

type Props = { onSelect?: (asset: MediaAsset) => void; onClose?: () => void; embedded?: boolean; lazy?: boolean; materialId?: string; preferredOrientation?: MediaAsset['orientation'] };
const labels: Record<MediaAsset['category'], string> = { material: 'Material', ambiente: 'Ambiente', chapa: 'Chapa', detalhe: 'Detalhe', institucional: 'Institucional', evento: 'Evento', outro: 'Outro' };

export default function AssetLibrary({ onSelect, onClose, embedded = false, lazy = false, materialId = '', preferredOrientation }: Props) {
  const [items, setItems] = useState<MediaAsset[]>([]); const [materials, setMaterials] = useState<OnlineMaterial[]>([]);
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('');
  const [orientation, setOrientation] = useState(preferredOrientation ?? ''); const [material, setMaterial] = useState(materialId);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [selected, setSelected] = useState<MediaAsset>();
  const [uploading, setUploading] = useState(false); const input = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(!lazy);
  async function refresh() {
    setBusy(true); setError('');
    try { const [assets, materialItems] = await Promise.all([online.assets.list(query, category), online.materials.list()]); setItems(assets); setMaterials(materialItems); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível abrir a biblioteca.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!active) return;
    let live = true;
    const timer = setTimeout(() => {
      Promise.all([online.assets.list(query, category), online.materials.list()])
        .then(([assets, materialItems]) => { if (live) { setItems(assets); setMaterials(materialItems); setError(''); } })
        .catch((caught) => { if (live) setError(caught instanceof Error ? caught.message : 'Não foi possível abrir a biblioteca.'); })
        .finally(() => { if (live) setBusy(false); });
    }, 180);
    return () => { live = false; clearTimeout(timer); };
  }, [active, query, category]);
  const filtered = useMemo(() => items.filter((asset) => {
    if (orientation && asset.orientation !== orientation) return false;
    return !material || (materials.find((item) => item.id === material)?.assetIds.includes(asset.id) ?? false);
  }), [items, materials, material, orientation]);
  async function upload(file?: File) {
    if (!file) return; setUploading(true); setError('');
    try {
      const asset = await online.assets.upload(file, { fileName: file.name, name: file.name.replace(/\.[^.]+$/, ''), alt: '', category: 'outro' });
      const owner = materials.find((item) => item.id === material);
      if (owner && !owner.assetIds.includes(asset.id)) await online.materials.save({ ...owner, assetIds: [...owner.assetIds, asset.id] });
      await refresh(); setSelected(asset);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'O upload não foi concluído.'); }
    finally { setUploading(false); if (input.current) input.current.value = ''; }
  }
  async function saveAsset() {
    if (!selected) return; setBusy(true); setError('');
    try {
      const updated = await online.assets.update(selected.id, { name: selected.name, alt: selected.alt, category: selected.category });
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item)); setSelected(undefined);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  async function removeAsset() {
    if (!selected) return; setBusy(true); setError('');
    try { await online.assets.remove(selected.id); setItems((current) => current.filter((item) => item.id !== selected.id)); setSelected(undefined); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível excluir.'); }
    finally { setBusy(false); }
  }
  const body = !active ? <button className="asset-library-open" type="button" onClick={() => setActive(true)}><ImagePlus size={24} /><strong>Abrir biblioteca de imagens</strong><span>Busque fotos hospedadas e recomendações para este espaço.</span></button> : <div className="asset-browser">
    <div className="asset-toolbar">
      <label className="asset-search"><Search size={15} /><input value={query} placeholder="Buscar por nome…" onChange={(event) => setQuery(event.target.value)} /></label>
      <select aria-label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas as categorias</option>{assetCategories.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select>
      <select aria-label="Orientação" value={orientation} onChange={(event) => setOrientation(event.target.value as typeof orientation)}><option value="">Todas as orientações</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option><option value="square">Quadrada</option></select>
      <select aria-label="Material" value={material} onChange={(event) => setMaterial(event.target.value)}><option value="">Todos os materiais</option>{materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <button className="button primary" type="button" disabled={uploading} onClick={() => input.current?.click()}><Upload size={15} /> {uploading ? 'Enviando…' : 'Enviar imagem'}</button>
      <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files?.[0])} />
    </div>
    {preferredOrientation && <p className="asset-recommendation">Imagens {preferredOrientation === 'horizontal' ? 'horizontais' : preferredOrientation === 'vertical' ? 'verticais' : 'quadradas'} são as mais indicadas para este espaço.</p>}
    {error && <p role="alert" className="alert">{error} {error.includes('Entre com') && <a href="/signin-with-chatgpt?return_to=/" target="_top">Entrar com ChatGPT</a>}</p>}
    {busy && !items.length ? <p className="muted">Carregando biblioteca…</p> : <div className="asset-grid">
      {filtered.map((asset) => <article className="asset-card" key={asset.id}>
        <button className="asset-image" type="button" onClick={() => onSelect ? onSelect(asset) : setSelected(asset)}><img src={asset.url} alt={asset.alt || asset.name} loading="lazy" /></button>
        <div><strong>{asset.name}</strong><span>{asset.width} × {asset.height} · {labels[asset.category]}</span></div>
        <button type="button" className="icon-button" aria-label={`Editar ${asset.name}`} onClick={() => setSelected(asset)}><Pencil size={15} /></button>
        {onSelect && <button type="button" className="button" onClick={() => onSelect(asset)}>Usar imagem</button>}
      </article>)}
      {!filtered.length && !error && <div className="asset-empty"><ImagePlus size={30} /><strong>Nenhuma imagem encontrada</strong><span>Envie uma imagem ou ajuste os filtros.</span></div>}
    </div>}
    {selected && <Modal title="Detalhes da imagem" onClose={() => setSelected(undefined)}>
      <img className="asset-detail-preview" src={selected.url} alt={selected.alt || selected.name} />
      <div className="asset-detail-meta"><span>{selected.width} × {selected.height}</span><span>{Math.round(selected.fileSize / 1024)} KB</span><span>{selected.orientation}</span></div>
      <Field label="Nome" value={selected.name} onChange={(event) => setSelected({ ...selected, name: event.target.value })} />
      <Field label="Texto alternativo" value={selected.alt} onChange={(event) => setSelected({ ...selected, alt: event.target.value })} />
      <Select label="Categoria" value={selected.category} onChange={(event) => setSelected({ ...selected, category: event.target.value as MediaAsset['category'] })}>{assetCategories.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</Select>
      <div className="modal-actions spread"><button type="button" className="button danger" disabled={busy} onClick={() => void removeAsset()}><Trash2 size={14} /> Excluir</button><div><button type="button" className="button" onClick={() => setSelected(undefined)}>Cancelar</button><button type="button" className="button primary" disabled={busy} onClick={() => void saveAsset()}>Salvar</button></div></div>
    </Modal>}
  </div>;
  if (embedded) return body;
  return <Modal title="Biblioteca de imagens" onClose={onClose ?? (() => {})} wide>{body}</Modal>;
}
