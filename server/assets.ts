import type { MediaAsset } from '@/types/online';
import { assetCategories } from '@/types/online';
import { clean, HttpError, identifier, type Env } from './platform';
import { optimizeImage } from './images';
import { normalizeFolderPaths } from '@/lib/asset-folders';
type AssetRow = { id: string; object_key: string; metadata: string; deleted_at: string | null };
export async function hashBytes(bytes: Uint8Array) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export class AssetRepository {
  constructor(private env: Env) {}
  async row(id: string) { return this.env.DB.prepare('SELECT * FROM assets WHERE id=? AND deleted_at IS NULL').bind(identifier(id)).first<AssetRow>(); }
  async get(id: string): Promise<MediaAsset> {
    const row = await this.row(id); if (!row) throw new HttpError(404, 'Imagem não encontrada.');
    const asset = JSON.parse(row.metadata) as MediaAsset;
    asset.url = `${this.env.SITE_ORIGIN}/assets/${asset.id}`;
    const folders = await this.env.DB.prepare('SELECT folder_path FROM asset_folders WHERE asset_id=? ORDER BY folder_path').bind(id).all<{ folder_path: string }>();
    asset.folderPaths = folders.results.map(folder => folder.folder_path);
    return asset;
  }
  async list(query = '', category = '', offset = 0) {
    const rows = await this.env.DB.prepare('SELECT metadata, (SELECT json_group_array(folder_path) FROM asset_folders WHERE asset_id=assets.id) AS folders FROM assets WHERE deleted_at IS NULL AND name LIKE ? AND (? = \'\' OR category=?) ORDER BY created_at DESC, id DESC LIMIT 100 OFFSET ?').bind(`%${clean(query, 100)}%`, category, category, offset).all<{ metadata: string; folders: string }>();
    return rows.results.map(r => {
      const asset = JSON.parse(r.metadata) as MediaAsset;
      return { ...asset, url: `${this.env.SITE_ORIGIN}/assets/${asset.id}`, folderPaths: JSON.parse(r.folders) as string[] };
    });
  }
  private folders(value: unknown) {
    try { return normalizeFolderPaths(value); }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'Pasta inválida.'); }
  }
  private async addFolders(id: string, paths: string[]) {
    if (paths.length) await this.env.DB.batch(paths.map(path => this.env.DB.prepare('INSERT OR IGNORE INTO asset_folders (asset_id,folder_path) VALUES (?,?)').bind(id, path)));
  }
  async create(bytes: Uint8Array, mime: string, fileName: string, metadata: Partial<MediaAsset> = {}) {
    const folders = this.folders(metadata.folderPaths);
    const image = optimizeImage(bytes, mime, fileName);
    const hash = await hashBytes(image.bytes);
    const existing = await this.env.DB.prepare('SELECT id FROM assets WHERE hash=? AND deleted_at IS NULL').bind(hash).first<{ id: string }>();
    if (existing) { await this.addFolders(existing.id, folders); return this.get(existing.id); }
    const id = hash; const objectKey = `media/${hash}`;
    const now = new Date().toISOString();
    const asset: MediaAsset = { id, name: clean(metadata.name || fileName, 160), fileName: `${id}.${image.mimeType === 'image/png' ? 'png' : 'jpg'}`,
      mimeType: image.mimeType, fileSize: image.fileSize, width: image.width, height: image.height,
      orientation: image.width === image.height ? 'square' : image.width > image.height ? 'horizontal' : 'vertical',
      category: assetCategories.includes(metadata.category!) ? metadata.category! : 'outro', alt: clean(metadata.alt, 500),
      url: `${this.env.SITE_ORIGIN}/assets/${id}`, createdAt: now, updatedAt: now };
    await this.env.BUCKET.put(objectKey, image.bytes, { httpMetadata: { contentType: image.mimeType, cacheControl: 'public, max-age=31536000, immutable' } });
    await this.env.DB.prepare('INSERT INTO assets (id,object_key,hash,metadata,category,name,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(hash) DO UPDATE SET deleted_at=NULL').bind(id, objectKey, hash, JSON.stringify(asset), asset.category, asset.name, now).run();
    await this.addFolders(id, folders);
    return this.get(id);
  }
  async update(id: string, patch: Partial<MediaAsset>) {
    const asset = await this.get(id);
    const folders = patch.folderPaths === undefined ? undefined : this.folders(patch.folderPaths);
    if (patch.name !== undefined) asset.name = clean(patch.name, 160);
    if (patch.alt !== undefined) asset.alt = clean(patch.alt, 500);
    if (patch.category !== undefined) {
      if (!assetCategories.includes(patch.category)) throw new HttpError(400, 'Categoria inválida.');
      asset.category = patch.category;
    }
    asset.updatedAt = new Date().toISOString();
    const statements = [this.env.DB.prepare('UPDATE assets SET metadata=?,name=?,category=? WHERE id=? AND deleted_at IS NULL').bind(JSON.stringify({ ...asset, folderPaths: undefined }), asset.name, asset.category, id)];
    if (folders !== undefined) {
      statements.push(this.env.DB.prepare('DELETE FROM asset_folders WHERE asset_id=?').bind(id));
      statements.push(...folders.map(path => this.env.DB.prepare('INSERT INTO asset_folders (asset_id,folder_path) VALUES (?,?)').bind(id, path)));
    }
    await this.env.DB.batch(statements);
    return this.get(id);
  }
  async usage(id: string) {
    await this.get(id);
    const publications = await this.env.DB.prepare('SELECT publication_id AS id FROM publication_assets WHERE asset_id=?').bind(id).all();
    const materials = await this.env.DB.prepare('SELECT material_id AS id FROM material_assets WHERE asset_id=?').bind(id).all();
    return { publications: publications.results, materials: materials.results };
  }
  async remove(id: string) {
    await this.get(id);
    try {
      await this.env.DB.prepare('UPDATE assets SET deleted_at=? WHERE id=?').bind(new Date().toISOString(), id).run();
    } catch (error) {
      if (String(error).includes('asset_in_use')) throw new HttpError(409, 'Imagem utilizada por campanha, histórico, marca, material ou publicação. Exclusão bloqueada.');
      throw error;
    }
    // Retain bytes. Soft deletion + database guards eliminate publication/delete races.
    return { deleted: true, retained: true };
  }
  async serve(id: string, request: Request) {
    const row = await this.row(id); if (!row) throw new HttpError(404, 'Imagem não encontrada.');
    const object = await this.env.BUCKET.get(row.object_key);
    if (!object) throw new HttpError(503, 'Arquivo temporariamente indisponível.');
    const asset = JSON.parse(row.metadata) as MediaAsset;
    const headers = { 'Content-Type': asset.mimeType, 'Content-Length': String(object.size), 'Cache-Control': 'public, max-age=31536000, immutable', ETag: object.httpEtag, 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' };
    if (request.headers.get('if-none-match') === object.httpEtag) return new Response(null, { status: 304, headers });
    return new Response(request.method === 'HEAD' ? null : object.body as unknown as ReadableStream, { headers });
  }
}
