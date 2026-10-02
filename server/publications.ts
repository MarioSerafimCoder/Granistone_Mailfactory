import type { EmailPublication, PublicationInput } from '@/types/online';
import { runPreflight, imageUrls } from './preflight';
import { AssetRepository, hashBytes } from './assets';
import { HttpError, identifier, type Env } from './platform';
import { publicationSignature } from '@/lib/publication-signature';
interface Row { id: string; campaign_id: string; language: 'pt' | 'en' | 'es'; slug: string; version: number; html: string; published_at: string; source_signature: string }
export class PublicationRepository {
  constructor(private env: Env) {}
  private model(row: Row): EmailPublication {
    const latestUrl = `${this.env.SITE_ORIGIN}/emails/${row.slug}/${row.language}`;
    return { id: row.id, campaignId: row.campaign_id, language: row.language, slug: row.slug, version: row.version, html: row.html, publishedAt: row.published_at, latestUrl, url: `${latestUrl}/v/${row.version}`, sourceSignature: row.source_signature };
  }
  async list(campaignId: string) {
    const rows = await this.env.DB.prepare('SELECT * FROM publications WHERE campaign_id=? ORDER BY version DESC LIMIT 100').bind(campaignId).all<Row>();
    return rows.results.map(row => this.model(row));
  }
  async publish(input: PublicationInput, requestId: string) {
    identifier(requestId);
    const existing = await this.env.DB.prepare('SELECT * FROM publications WHERE request_id=?').bind(requestId).first<Row>();
    if (existing) {
      if (existing.campaign_id !== input.campaign.id || existing.language !== input.language) throw new HttpError(409, 'Chave de publicação já utilizada.');
      return { publication: this.model(existing), replayed: true };
    }
    const shared = await this.env.DB.prepare('SELECT revision,data,deleted_at FROM campaigns WHERE id=?').bind(input.campaign.id).first<{ revision: number; data: string; deleted_at: string | null }>();
    if (shared && (shared.deleted_at || input.campaignRevision !== shared.revision || publicationSignature({ ...input, campaign: JSON.parse(shared.data) }) !== publicationSignature(input))) throw new HttpError(409, 'Sincronize a campanha antes de publicar. Há uma revisão diferente no workspace.');
    const preflight = await runPreflight(input, this.env);
    if (preflight.hasErrors) return { preflight, publication: null };
    let html = preflight.html;
    const assets = new AssetRepository(this.env); const ids = new Set<string>();
    for (const url of imageUrls(html)) {
      const parsed = new URL(url);
      if (parsed.origin !== this.env.SITE_ORIGIN) continue;
      if (parsed.pathname.startsWith('/assets/')) { ids.add(parsed.pathname.split('/')[2]); continue; }
      // Snapshot shipped branding too, so a later application update cannot alter v1.
      if (/^\/brand\/[a-z0-9_.-]+$/.test(parsed.pathname)) {
        const response = await this.env.ASSETS.fetch(new Request(url) as never);
        if (!response.ok) throw new HttpError(503, 'Marca indisponível para publicação.');
        const asset = await assets.create(new Uint8Array(await response.arrayBuffer()), response.headers.get('content-type')!.split(';')[0], parsed.pathname.split('/').pop()!, { name: 'Marca Granistone', category: 'institucional' });
        html = html.split(`src="${url}"`).join(`src="${asset.url}"`); ids.add(asset.id);
      }
    }
    const first = await this.env.DB.prepare('SELECT slug FROM publications WHERE campaign_id=? LIMIT 1').bind(input.campaign.id).first<{ slug: string }>();
    const slug = first?.slug || `${input.campaign.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'email'}-${(await hashBytes(new TextEncoder().encode(input.campaign.id))).slice(0, 16)}`;
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    try {
      await this.env.DB.batch([
        this.env.DB.prepare('INSERT INTO publications (id,campaign_id,language,slug,version,html,published_at,request_id,source_signature) SELECT ?,?,?,?,(SELECT COALESCE(MAX(version),0)+1 FROM publications WHERE campaign_id=? AND language=?),?,?,?,? WHERE ? IS NULL OR EXISTS(SELECT 1 FROM campaigns WHERE id=? AND revision=? AND deleted_at IS NULL)').bind(id, input.campaign.id, input.language, slug, input.campaign.id, input.language, html, now, requestId, publicationSignature(input), shared?.revision ?? null, input.campaign.id, shared?.revision ?? null),
        ...[...ids].map(assetId => this.env.DB.prepare('INSERT INTO publication_assets (publication_id,asset_id) VALUES (?,?)').bind(id, assetId)),
        ...(shared ? [this.env.DB.prepare("INSERT INTO campaign_revisions(campaign_id,revision,data,changed_by,created_at,reason) SELECT id,revision,data,updated_by,?,'publication' FROM campaigns WHERE id=? AND revision=? ON CONFLICT(campaign_id,revision) DO NOTHING").bind(now, input.campaign.id, shared.revision)] : []),
      ]);
    } catch (error) {
      const replay = await this.env.DB.prepare('SELECT * FROM publications WHERE request_id=?').bind(requestId).first<Row>();
      if (replay && replay.campaign_id === input.campaign.id && replay.language === input.language) return { publication: this.model(replay), replayed: true };
      if (String(error).includes('asset_unavailable')) throw new HttpError(409, 'Uma imagem foi removida durante a publicação. Execute o pré-flight novamente.');
      if (String(error).includes('FOREIGN KEY')) throw new HttpError(409, 'A campanha mudou durante a publicação. Sincronize e tente novamente.');
      throw error;
    }
    const row = await this.env.DB.prepare('SELECT * FROM publications WHERE id=?').bind(id).first<Row>();
    if (!row) throw new HttpError(409, 'A campanha mudou durante a publicação. Sincronize e tente novamente.');
    return { publication: this.model(row!), preflight };
  }
  async serve(slug: string, language: string, version: number | undefined, request: Request) {
    const row = version
      ? await this.env.DB.prepare('SELECT * FROM publications WHERE slug=? AND language=? AND version=?').bind(slug, language, version).first<Row>()
      : await this.env.DB.prepare('SELECT * FROM publications WHERE slug=? AND language=? ORDER BY version DESC LIMIT 1').bind(slug, language).first<Row>();
    if (!row) throw new HttpError(404, 'E-mail não encontrado.');
    const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': version ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate', ETag: `"${row.id}"`, 'Content-Security-Policy': "default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' };
    return new Response(request.headers.get('if-none-match') === headers.ETag || request.method === 'HEAD' ? null : row.html, { status: request.headers.get('if-none-match') === headers.ETag ? 304 : 200, headers });
  }
}
