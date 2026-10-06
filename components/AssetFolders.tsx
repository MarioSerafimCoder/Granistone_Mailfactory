'use client';
import { Folder, FolderOpen, Images } from 'lucide-react';
import { childFolders } from '@/lib/asset-folders';
import type { MediaAsset } from '@/types/online';

export default function AssetFolders({ items, folder, onChange }: { items: MediaAsset[]; folder: string; onChange: (folder: string) => void }) {
  const folders = childFolders(items, folder);
  const parts = folder.split('/').filter(Boolean);
  return <section className="asset-folders" aria-label="Pastas da biblioteca">
    <nav className="asset-breadcrumb" aria-label="Caminho da pasta">
      <button type="button" onClick={() => onChange('')} aria-current={!folder ? 'page' : undefined}><Images size={16} /> Todas as imagens <span>{items.length}</span></button>
      {parts.map((part, index) => <span key={index}><span aria-hidden="true">/</span><button type="button" onClick={() => onChange(parts.slice(0, index + 1).join('/'))} aria-current={index === parts.length - 1 ? 'page' : undefined}>{part}</button></span>)}
    </nav>
    {!!folders.length && <div className="asset-folder-grid">{folders.map(item => <button type="button" className="asset-folder-card" key={item.path} onClick={() => onChange(item.path)}>
      <Folder size={23} /><span><strong>{item.name}</strong><small>{item.count} {item.count === 1 ? 'imagem' : 'imagens'}</small></span>
    </button>)}</div>}
    {folder && <p className="asset-folder-hint"><FolderOpen size={15} /> {folder} · imagens desta pasta e subpastas</p>}
  </section>;
}
