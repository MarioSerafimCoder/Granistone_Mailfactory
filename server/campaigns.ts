import { defaultBrand } from '@/data/brand';
import { emptyContent, languageStates, reconcileLanguageState } from '@/campaigns/model';
import { isCampaign, migrateBrand } from '@/lib/storage';
import type { Campaign } from '@/types/campaign';
import type { SharedCampaign, SharedBrand, CampaignRevision } from '@/types/workspace';
import { hashBytes } from './assets';
import { HttpError, identifier, type Env } from './platform';
type Actor = { id: string; email: string };
interface Row { id: string; data: string; revision: number; created_at: string; created_by: string; updated_at: string; updated_by: string; deleted_at: string | null; deleted_by: string | null }
const model = (row: Row): SharedCampaign => ({ campaign: JSON.parse(row.data), revision: row.revision, createdAt: row.created_at, createdBy: row.created_by, updatedAt: row.updated_at, updatedBy: row.updated_by, deletedAt: row.deleted_at, deletedBy: row.deleted_by });
export function expectedRevision(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new HttpError(400, 'Informe a revisão que você abriu.');
  return Number(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Dados inválidos.');
  return value as Record<string, unknown>;
}
export async function validateImages(value: unknown, env: Env): Promise<void> {
  if (typeof value === 'string') {
    if (/^(data|blob):/i.test(value)) throw new HttpError(400, 'Hospede as imagens locais antes de sincronizar.');
    if (value.startsWith(`${env.SITE_ORIGIN}/assets/`)) {
      const id = value.slice(`${env.SITE_ORIGIN}/assets/`.length);
      if (!await env.DB.prepare('SELECT id FROM assets WHERE id=? AND deleted_at IS NULL').bind(id).first()) throw new HttpError(400, 'Uma imagem não está mais disponível na biblioteca.');
    }
  } else if (value && typeof value === 'object') for (const item of Object.values(value)) await validateImages(item, env);
}
export class CampaignRepository {
  constructor(private env: Env, private actor: Actor) {}
  async list() {
    const rows = await this.env.DB.prepare('SELECT * FROM campaigns ORDER BY updated_at DESC').all<Row>();
    return rows.results.map(model);
  }
  async get(id: string) {
    const row = await this.env.DB.prepare('SELECT * FROM campaigns WHERE id=?').bind(identifier(id)).first<Row>();
    if (!row) throw new HttpError(404, 'Campanha não encontrada.');
    return model(row);
  }
  private async campaign(value: unknown, previous?: Campaign) {
    if (!isCampaign(value) || !value.title.trim() || value.title.length > 500) throw new HttpError(400, 'Campanha inválida. Revise os campos e idiomas.');
    identifier(value.id);
    const next = { ...value, content: { ...value.content, es: value.content.es ?? emptyContent() }, languageState: languageStates(value), updatedAt: new Date().toISOString() };
    const result = reconcileLanguageState(previous ?? { ...next, languageState: undefined, status: 'Pendente' }, next, this.actor.email);
    await validateImages(result, this.env);
    return result;
  }
  // The receipt and the conditional write share a D1 transaction. Retrying a lost
  // response returns the original acknowledgement, never another write.
  private async mutate<T>(resource: string, input: Record<string, unknown>, prepare: () => Promise<{ statement: ReturnType<Env['DB']['prepare']>; result: T }>): Promise<T> {
    const key = identifier(String(input.requestId || ''));
    const fingerprint = await hashBytes(new TextEncoder().encode(JSON.stringify({ resource, input })));
    const replay = async () => {
      const row = await this.env.DB.prepare('SELECT * FROM workspace_mutations WHERE id=?').bind(key).first<{ actor: string; fingerprint: string; response: string }>();
      if (!row) return undefined;
      if (row.actor !== this.actor.id || row.fingerprint !== fingerprint) throw new HttpError(409, 'Identificador de gravação já utilizado.');
      return JSON.parse(row.response) as T;
    };
    const cached = await replay(); if (cached) return cached;
    const { statement, result } = await prepare();
    try {
      const results = await this.env.DB.batch([
        statement,
        this.env.DB.prepare('INSERT INTO workspace_mutations(id,resource,actor,fingerprint,response) SELECT ?,?,?,?,? WHERE changes()=1')
          .bind(key, resource, this.actor.id, fingerprint, JSON.stringify(result)),
      ]);
      if (!Number(results[0].meta.changes)) throw new HttpError(409, 'Esta campanha ou configuração foi alterada por outro usuário.');
      return result;
    } catch (error) {
      const repeated = await replay(); if (repeated) return repeated;
      if (String(error).includes('asset_unavailable')) throw new HttpError(409, 'Uma imagem foi removida durante a gravação. Escolha outra imagem.');
      throw error;
    }
  }
  async create(value: unknown) {
    const input = object(value);
    return this.mutate('campaign:create', input, async () => {
      const campaign = await this.campaign(input.campaign);
      const now = campaign.updatedAt;
      const result: SharedCampaign = { campaign, revision: 1, createdAt: now, updatedAt: now, createdBy: this.actor.email, updatedBy: this.actor.email, deletedAt: null, deletedBy: null };
      const statement = this.env.DB.prepare('INSERT INTO campaigns(id,title,date,status,language,data,revision,created_at,created_by,updated_at,updated_by,reason) VALUES(?,?,?,?,?,?,1,?,?,?,?,?) ON CONFLICT(id) DO NOTHING')
        .bind(campaign.id, campaign.title, campaign.date, campaign.status, campaign.language, JSON.stringify(campaign), now, this.actor.email, now, this.actor.email, 'create');
      return { statement, result };
    });
  }
  async update(id: string, value: unknown, action: 'save' | 'delete' | 'restore' | 'revision' = 'save', historical?: number) {
    const input = object(value); const expected = expectedRevision(input.revision);
    return this.mutate(`campaign:${id}:${action}:${historical ?? ''}`, input, async () => {
      const current = await this.get(id);
      if (current.revision !== expected) throw new HttpError(409, 'Esta campanha foi alterada por outro usuário enquanto você editava.');
      if (action !== 'restore' && current.deletedAt) throw new HttpError(409, 'Esta campanha está na lixeira. Restaure antes de editar.');
      let campaign = current.campaign;
      if (action === 'save') campaign = await this.campaign(input.campaign, current.campaign);
      if (action === 'revision') {
        const row = await this.env.DB.prepare('SELECT data FROM campaign_revisions WHERE campaign_id=? AND revision=?').bind(id, historical!).first<{ data: string }>();
        if (!row) throw new HttpError(404, 'Revisão não encontrada.');
        campaign = await this.campaign(JSON.parse(row.data), current.campaign);
      }
      if (campaign.id !== id) throw new HttpError(400, 'O ID da campanha não pode ser alterado.');
      const now = new Date().toISOString();
      const result: SharedCampaign = { ...current, campaign, revision: expected + 1, updatedAt: now, updatedBy: this.actor.email, deletedAt: action === 'delete' ? now : null, deletedBy: action === 'delete' ? this.actor.email : null };
      const reason = action === 'save' ? input.reason === 'conflict' ? 'conflict' : 'autosave' : action;
      const statement = this.env.DB.prepare('UPDATE campaigns SET title=?,date=?,status=?,language=?,data=?,revision=revision+1,updated_at=?,updated_by=?,deleted_at=?,deleted_by=?,reason=? WHERE id=? AND revision=?')
        .bind(campaign.title, campaign.date, campaign.status, campaign.language, JSON.stringify(campaign), now, this.actor.email, result.deletedAt, result.deletedBy, reason, id, expected);
      return { statement, result };
    });
  }
  async history(id: string): Promise<CampaignRevision[]> {
    await this.get(id);
    const rows = await this.env.DB.prepare('SELECT * FROM campaign_revisions WHERE campaign_id=? ORDER BY revision DESC').bind(id).all<{ revision: number; data: string; changed_by: string; created_at: string; reason: string }>();
    return rows.results.map(row => ({ revision: row.revision, campaign: JSON.parse(row.data), changedBy: row.changed_by, createdAt: row.created_at, reason: row.reason }));
  }
  async brand(): Promise<SharedBrand> {
    const row = await this.env.DB.prepare("SELECT * FROM workspace_settings WHERE key='brand'").first<{ data: string; revision: number; updated_at: string; updated_by: string }>();
    return row ? { brand: migrateBrand(JSON.parse(row.data)), revision: row.revision, updatedAt: row.updated_at, updatedBy: row.updated_by } : { brand: defaultBrand, revision: 0, updatedAt: '', updatedBy: '' };
  }
  async saveBrand(value: unknown) {
    const input = object(value), revision = expectedRevision(input.revision);
    return this.mutate('settings:brand', input, async () => {
      let brand;
      try { brand = migrateBrand(input.brand); } catch { throw new HttpError(400, 'Configuração de marca inválida.'); }
      await validateImages(brand, this.env);
      const now = new Date().toISOString();
      const result: SharedBrand = { brand, revision: revision + 1, updatedAt: now, updatedBy: this.actor.email };
      const statement = revision === 0
        ? this.env.DB.prepare("INSERT INTO workspace_settings(key,data,revision,updated_at,updated_by) VALUES('brand',?,1,?,?) ON CONFLICT(key) DO NOTHING").bind(JSON.stringify(brand), now, this.actor.email)
        : this.env.DB.prepare("UPDATE workspace_settings SET data=?,revision=revision+1,updated_at=?,updated_by=? WHERE key='brand' AND revision=?").bind(JSON.stringify(brand), now, this.actor.email, revision);
      return { statement, result };
    });
  }
}
