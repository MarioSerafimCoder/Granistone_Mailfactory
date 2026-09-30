import type { OnlineMaterial } from '@/types/online';
import { clean, identifier, HttpError, type Env } from './platform';
import { publicHttpsUrl } from '@/lib/public-url';
import { AssetRepository } from './assets';
export class MaterialRepository {
  constructor(private env: Env) {}
  async get(id: string) {
    const row = await this.env.DB.prepare('SELECT data FROM materials WHERE id=?').bind(identifier(id)).first<{ data: string }>();
    if (!row) throw new HttpError(404, 'Material não encontrado.');
    return JSON.parse(row.data) as OnlineMaterial;
  }
  async list() {
    const rows = await this.env.DB.prepare('SELECT data FROM materials ORDER BY slug LIMIT 500').all<{ data: string }>();
    return rows.results.map(r => JSON.parse(r.data) as OnlineMaterial);
  }
  async save(raw: Partial<OnlineMaterial>, id = crypto.randomUUID() as string) {
    identifier(id);
    if (!clean(raw.name, 160)) throw new HttpError(400, 'Nome do material obrigatório.');
    const array = (v: unknown, max: number): string[] => {
      if (v === undefined) return [];
      if (!Array.isArray(v) || v.length > max || !v.every(x => typeof x === 'string')) throw new HttpError(400, 'Lista inválida.');
      return v.map(x => clean(x, 500));
    };
    const assetIds = [...new Set([...array(raw.assetIds, 100), raw.heroAssetId, raw.slabAssetId, raw.applicationAssetId].filter(Boolean))] as string[];
    const assets = new AssetRepository(this.env);
    for (const assetId of assetIds) await assets.get(assetId);
    if (raw.pageUrl && !publicHttpsUrl(raw.pageUrl)) throw new HttpError(400, 'Página do material inválida.');
    const material: OnlineMaterial = {
      id, name: clean(raw.name, 160), slug: clean(raw.slug || raw.name, 160).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id,
      category: clean(raw.category, 100), description: clean(raw.description, 5000),
      features: array(raw.features, 50), applications: array(raw.applications, 50),
      pageUrl: clean(raw.pageUrl, 2048), active: raw.active !== false,
      heroAssetId: raw.heroAssetId, slabAssetId: raw.slabAssetId, applicationAssetId: raw.applicationAssetId, assetIds,
    };
    await this.env.DB.batch([
      this.env.DB.prepare('INSERT INTO materials (id,slug,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,data=excluded.data').bind(id, material.slug, JSON.stringify(material)),
      this.env.DB.prepare('DELETE FROM material_assets WHERE material_id=?').bind(id),
      ...assetIds.map(assetId => this.env.DB.prepare('INSERT INTO material_assets (material_id,asset_id) VALUES (?,?)').bind(id, assetId)),
    ]);
    return material;
  }
}
