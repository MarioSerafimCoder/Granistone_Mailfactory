import type { MediaAsset, OnlineMaterial } from '@/types/online';

export type StoneFolder = { path: string; name: string; assetIds: string[] };
export type CatalogMaterial = { material: OnlineMaterial; folder?: StoneFolder; folderOnly: boolean };

const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
const catalogRoot = (value: string) => ['imagens catalogo', 'catalogo'].includes(fold(value));
const institutional = (value: string) => ['fotos institucionais', 'institucional'].includes(fold(value));
export const folderMaterialId = (path: string) => `folder:${encodeURIComponent(path)}`;
export function materialFolderPath(id: string) {
  if (!id.startsWith('folder:')) return '';
  try { return decodeURIComponent(id.slice(7)); } catch { return ''; }
}

export function stoneFolders(assets: MediaAsset[]): StoneFolder[] {
  const groups = new Map<string, StoneFolder>();
  for (const asset of assets) for (const path of asset.folderPaths ?? []) {
    const parts = path.normalize('NFC').split('/').filter(Boolean);
    const root = parts.findIndex(catalogRoot);
    if (root < 0 || !parts[root + 1] || institutional(parts[root + 1])) continue;
    const name = parts[root + 1];
    const key = fold(name);
    let folder = groups.get(key);
    if (!folder) {
      folder = { path: parts.slice(0, root + 2).join('/'), name, assetIds: [] };
      groups.set(key, folder);
    }
    if (!folder.assetIds.includes(asset.id)) folder.assetIds.push(asset.id);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function catalogMaterials(materials: OnlineMaterial[], assets: MediaAsset[]): CatalogMaterial[] {
  const matched = new Set<string>();
  const entries: CatalogMaterial[] = stoneFolders(assets).map(folder => {
    const saved = materials.find(item => !matched.has(item.id) && fold(item.name) === fold(folder.name));
    if (saved) {
      matched.add(saved.id);
      return { material: { ...saved, assetIds: [...new Set([...saved.assetIds, ...folder.assetIds])], heroAssetId: saved.heroAssetId || folder.assetIds[0] }, folder, folderOnly: false };
    }
    const material: OnlineMaterial = {
      id: folderMaterialId(folder.path), name: folder.name, slug: fold(folder.name).replace(/[^a-z0-9]+/g, '-'),
      category: 'Pedra natural', description: '', features: [], applications: [], pageUrl: '', active: true,
      heroAssetId: folder.assetIds[0], assetIds: folder.assetIds,
    };
    return { material, folder, folderOnly: true };
  });
  entries.push(...materials.filter(item => !matched.has(item.id)).map(material => ({ material, folderOnly: false })));
  return entries.sort((a, b) => a.material.name.localeCompare(b.material.name, 'pt-BR'));
}
