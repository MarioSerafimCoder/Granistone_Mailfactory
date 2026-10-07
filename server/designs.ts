import type { Blueprint, DesignInput, SavedDesign } from '@/types/design';
import { sectionsValid, isSection } from '@/blocks/registry';
import { designValid } from '@/lib/tokens/backgrounds';
import { templates } from '@/templates/registry';
import { expectedRevision, validateImages } from './campaigns';
import { HttpError, identifier, clean, type Env } from './platform';
type Row = { id: string; name: string; description: string; category: string; kind: 'block' | 'template'; data: string; revision: number; created_at: string; created_by: string; updated_at: string; updated_by: string };
const model = (row: Row): SavedDesign => ({ id: row.id, name: row.name, description: row.description, category: row.category, kind: row.kind, payload: JSON.parse(row.data), revision: row.revision, createdAt: row.created_at, createdBy: row.created_by, updatedAt: row.updated_at, updatedBy: row.updated_by });
export function validBlueprint(value: unknown): value is Blueprint {
  if (!value || typeof value !== 'object') return false;
  const p = value as Blueprint;
  return templates.some(t => t.id === p.template) && sectionsValid(p.sections) && designValid(p.design) && ['left', 'center'].includes(p.alignment) && ['PT', 'EN', 'ES', 'PT / EN', 'PT / ES', 'EN / ES', 'PT / EN / ES'].includes(p.language);
}
export class DesignRepository {
  constructor(private env: Env, private actor: { email: string }) {}
  async list(kind: string) {
    if (!['block', 'template'].includes(kind)) throw new HttpError(400, 'Coleção inválida.');
    return (await this.env.DB.prepare('SELECT * FROM reusable_designs WHERE kind=? AND deleted_at IS NULL ORDER BY updated_at DESC').bind(kind).all<Row>()).results.map(model);
  }
  async get(id: string) {
    const row = await this.env.DB.prepare('SELECT * FROM reusable_designs WHERE id=? AND deleted_at IS NULL').bind(identifier(id)).first<Row>();
    if (!row) throw new HttpError(404, 'Bloco ou template não encontrado.'); return model(row);
  }
  async save(input: Record<string, unknown>, id?: string) {
    const value = input as unknown as DesignInput;
    if (!['block', 'template'].includes(value.kind) || !(value.kind === 'block' ? isSection(value.payload) : validBlueprint(value.payload))) throw new HttpError(400, 'Estrutura do bloco ou template inválida.');
    const name = clean(value.name, 120), description = clean(value.description, 1000), category = clean(value.category, 80);
    if (!name || !category) throw new HttpError(400, 'Informe nome e categoria.');
    const payload = JSON.stringify(value.payload);
    if (payload.length > 1000000 || /"(?:data|blob):/i.test(payload)) throw new HttpError(400, 'Hospede as imagens na biblioteca antes de salvar.');
    const now = new Date().toISOString();
    await validateImages(value.payload, this.env);
    if (!id) {
      id = identifier(value.id || crypto.randomUUID());
      // Client chooses the ID, so retries never create a second resource.
      await this.env.DB.prepare('INSERT INTO reusable_designs(id,kind,name,description,category,data,revision,created_at,created_by,updated_at,updated_by) VALUES(?,?,?,?,?,?,1,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id, value.kind, name, description, category, payload, now, this.actor.email, now, this.actor.email).run();
      const saved = await this.get(id);
      if (saved.kind !== value.kind || JSON.stringify(saved.payload) !== payload || saved.name !== name || saved.description !== description || saved.category !== category) throw new HttpError(409, 'Este identificador já está em uso.');
      return saved;
    }
    const revision = expectedRevision(value.revision);
    const result = await this.env.DB.prepare('UPDATE reusable_designs SET name=?,description=?,category=?,data=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND kind=? AND deleted_at IS NULL').bind(name, description, category, payload, now, this.actor.email, identifier(id), revision, value.kind).run();
    if (!result.meta.changes) throw new HttpError(409, 'Este recurso mudou. Seu rascunho foi preservado; reabra a versão atual.');
    return this.get(id);
  }
  async remove(id: string, revision: number) {
    const result = await this.env.DB.prepare('UPDATE reusable_designs SET deleted_at=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND deleted_at IS NULL').bind(new Date().toISOString(), new Date().toISOString(), this.actor.email, identifier(id), expectedRevision(revision)).run();
    if (!result.meta.changes) throw new HttpError(409, 'Este recurso foi alterado. Atualize a lista.'); return { deleted: true };
  }
}
