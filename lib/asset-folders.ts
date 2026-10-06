import type { MediaAsset } from '@/types/online';

export function normalizeFolderPaths(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 32) throw new Error('Informe até 32 pastas.');
  return [...new Set(value.map((path) => {
    if (typeof path !== 'string') throw new Error('Pasta inválida.');
    const parts = path.normalize('NFC').replace(/\\/g, '/').split('/').map(part => part.trim()).filter(Boolean);
    if (parts.some(part => part === '.' || part === '..' || /[\u0000-\u001f\u007f]/.test(part))) throw new Error('Nome de pasta inválido.');
    const normalized = parts.join('/');
    if (normalized.length > 240) throw new Error('O caminho da pasta deve ter até 240 caracteres.');
    return normalized;
  }).filter(Boolean))];
}

export function folderForFile(file: Pick<File, 'webkitRelativePath'>, currentFolder = ''): string[] {
  const directory = file.webkitRelativePath?.split('/').slice(0, -1).join('/');
  return normalizeFolderPaths([directory ? [currentFolder, directory].filter(Boolean).join('/') : currentFolder]);
}

export function childFolders(assets: MediaAsset[], parent: string) {
  const folders = new Map<string, Set<string>>();
  const prefix = parent ? `${parent}/` : '';
  for (const asset of assets) for (const path of asset.folderPaths ?? []) {
    if (!path.startsWith(prefix) || path === parent) continue;
    const child = prefix + path.slice(prefix.length).split('/')[0];
    if (!folders.has(child)) folders.set(child, new Set());
    folders.get(child)!.add(asset.id);
  }
  return [...folders].map(([path, ids]) => ({ path, name: path.split('/').at(-1)!, count: ids.size }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
