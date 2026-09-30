'use client';
import { useEffect, useState } from 'react';
import { online } from '@/lib/online';
import type { MediaAsset } from '@/types/online';
import { Modal } from './ui';
export default function AssetLibrary({ onSelect, onClose }: { onSelect: (asset: MediaAsset) => void; onClose: () => void }) {
  const [items, setItems] = useState<MediaAsset[]>([]); const [query, setQuery] = useState(''); const [error, setError] = useState('');
  useEffect(() => { let active = true; online.assets.list(query).then(value => { if (active) setItems(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [query]);
  return <Modal title="Imagens online" onClose={onClose}>
    <label>Buscar imagem<input value={query} onChange={e => setQuery(e.target.value)} /></label>
    {error && <p role="alert">{error} <a href="/signin-with-chatgpt?return_to=/" target="_top">Entrar com ChatGPT</a></p>}
    <ul>{items.map(asset => <li key={asset.id}><button className="button" onClick={() => onSelect(asset)}>{asset.name} · {asset.width} × {asset.height}</button></li>)}</ul>
    {!items.length && !error && <p>Nenhuma imagem hospedada.</p>}
  </Modal>;
}
