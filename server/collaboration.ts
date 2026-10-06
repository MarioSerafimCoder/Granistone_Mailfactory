import type { D1PreparedStatement } from '@cloudflare/workers-types';
import type { MemberRole, ResourceType, WorkspaceMember, WorkspaceSession } from '@/types/collaboration';
import { clean, HttpError, identifier, type Env } from './platform';

export type MemberActor = { id: string; email: string; name: string; role: MemberRole; owner: boolean };
export const owners = (env: Env) => [...new Set((env.EDITOR_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean))];
const seconds = () => Math.floor(Date.now() / 1000);
export function originCheck(request: Request, env: Env) {
  if (!['GET', 'HEAD'].includes(request.method) && (request.headers.get('origin') !== env.SITE_ORIGIN || request.headers.get('sec-fetch-site') === 'cross-site')) throw new HttpError(403, 'Origem da solicitação não autorizada.');
}
export async function membership(request: Request, env: Env): Promise<MemberActor> {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!id || !email) throw new HttpError(401, 'Entre com ChatGPT para acessar o workspace online.');
  originCheck(request, env);
  let displayName = '';
  if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { displayName = clean(decodeURIComponent(request.headers.get('oai-authenticated-user-full-name') || ''), 160); } catch { /* Optional display name. */ }
  }
  if (owners(env).includes(email)) return { id, email, name: displayName || email.split('@')[0], role: 'admin', owner: true };
  const member = await env.DB.prepare("SELECT * FROM workspace_members WHERE email=? AND status='active'").bind(email).first<WorkspaceMember>();
  if (!member) throw new HttpError(403, 'Esta conta não está autorizada no workspace Granistone.');
  return { id, email, name: member.name || displayName || email.split('@')[0], role: member.role, owner: false };
}
export function requireRole(actor: MemberActor, role: 'admin' | 'editor') {
  if (actor.role === 'viewer' || (role === 'admin' && actor.role !== 'admin')) throw new HttpError(403, 'Sua função não permite esta ação.');
}
export async function session(request: Request, env: Env): Promise<WorkspaceSession> {
  const authenticated = Boolean(request.headers.get('oai-authenticated-user-id') && request.headers.get('oai-authenticated-user-email'));
  let actor: MemberActor | undefined;
  try { actor = await membership(request, env); } catch (error) { if (!(error instanceof HttpError) || ![401, 403].includes(error.status)) throw error; }
  const editor = Boolean(actor && actor.role !== 'viewer');
  return { authenticated, member: Boolean(actor), editor, email: request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase() || '', name: actor?.name || '', role: actor?.role ?? null, owner: actor?.owner ?? false, origin: env.SITE_ORIGIN,
    permissions: { editCampaigns: editor, publish: editor, manageMembers: actor?.role === 'admin', editBrand: actor?.role === 'admin' } };
}

// Each write checks fresh membership and the exact lease inside the same D1
// transaction as its statements. A revoked user or delayed request cannot pass.
export function guardedEnv(env: Env, actor: MemberActor, request: Request, resourceType = '', resourceId = '', requiredRole = 'editor', revision: number | null = null): Env {
  const database = env.DB;
  const rawStatements = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const check = () => database.prepare('INSERT INTO workspace_write_checks(id,user_id,email,owner,required_role,resource_type,resource_id,session_id,tab_id,token,generation,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), actor.id, actor.email, actor.owner ? 1 : 0, requiredRole, resourceType, resourceId, request.headers.get('x-workspace-session') || '', request.headers.get('x-workspace-tab') || '', request.headers.get('x-edit-token') || '', Number(request.headers.get('x-edit-generation')) || 0, revision);
  const batch = async (statements: D1PreparedStatement[]) => {
    const results = await database.batch([check(), ...statements.map(s => rawStatements.get(s) || s), database.prepare('DELETE FROM workspace_write_checks')]);
    return results.slice(1, -1);
  };
  return { ...env, DB: new Proxy(database, { get(target, key) {
    if (key === 'batch') return batch;
    if (key === 'prepare') return (sql: string) => {
      const wrap = (statement: D1PreparedStatement): D1PreparedStatement => {
        const proxy = new Proxy(statement, { get(s, property) {
        if (property === 'bind') return (...values: unknown[]) => wrap(s.bind(...values));
        if (property === 'run') return async () => (await batch([s]))[0];
        const value = Reflect.get(s, property); return typeof value === 'function' ? value.bind(s) : value;
        } });
        rawStatements.set(proxy, statement); return proxy;
      };
      return wrap(target.prepare(sql));
    };
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } }) };
}
const validRole = (value: unknown): MemberRole => { if (!['admin', 'editor', 'viewer'].includes(String(value))) throw new HttpError(400, 'Função inválida.'); return value as MemberRole; };
export class CollaborationRepository {
  constructor(private env: Env, private actor: MemberActor) {}
  async members() {
    requireRole(this.actor, 'admin');
    const rows = (await this.env.DB.prepare('SELECT * FROM workspace_members ORDER BY created_at').all<WorkspaceMember>()).results;
    return [...rows.map(row => ({ ...row, owner: owners(this.env).includes(row.email) })), ...owners(this.env).filter(email => !rows.some(row => row.email === email)).map(email => ({ id: `owner:${email}`, email, name: email.split('@')[0], role: 'admin', status: 'active', created_at: '', last_seen_at: null, owner: true }))];
  }
  async add(input: Record<string, unknown>) {
    requireRole(this.actor, 'admin');
    const email = String(input.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, 'Informe um e-mail válido.');
    const role = owners(this.env).includes(email) ? 'admin' : validRole(input.role);
    const id = crypto.randomUUID(), now = new Date().toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare("INSERT INTO workspace_members(id,email,name,role,status,created_at,created_by,updated_at) VALUES(?,?,?,?,'active',?,?,?)").bind(id, email, clean(input.name, 160), role, now, this.actor.email, now),
      this.event(id, email, 'added', null, role),
    ]);
    return { id };
  }
  private event(id: string, email: string, action: string, before: string | null, after: string | null) {
    return this.env.DB.prepare('INSERT INTO workspace_member_events(id,member_id,target_email,action,actor_email,previous_role,new_role,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, email, action, this.actor.email, before, after, new Date().toISOString());
  }
  async change(id: string, input: Record<string, unknown>, remove = false) {
    requireRole(this.actor, 'admin');
    const member = await this.env.DB.prepare('SELECT * FROM workspace_members WHERE id=?').bind(identifier(id)).first<WorkspaceMember>();
    if (!member) throw new HttpError(404, 'Membro não encontrado.');
    if (owners(this.env).includes(member.email)) throw new HttpError(409, 'O acesso administrativo de emergência é preservado.');
    const role = input.role === undefined ? member.role : validRole(input.role);
    const status = input.status === undefined ? member.status : input.status;
    if (!['active', 'disabled'].includes(String(status))) throw new HttpError(400, 'Status inválido.');
    await this.env.DB.batch([
      remove ? this.env.DB.prepare('DELETE FROM workspace_members WHERE id=?').bind(id) : this.env.DB.prepare('UPDATE workspace_members SET role=?,status=?,updated_at=? WHERE id=?').bind(role, status, new Date().toISOString(), id),
      this.event(id, member.email, remove ? 'removed' : 'updated', `${member.role}:${member.status}`, remove ? null : `${role}:${status}`),
      this.env.DB.prepare('UPDATE workspace_edit_locks SET expires_at=0 WHERE email=?').bind(member.email),
      this.env.DB.prepare('DELETE FROM workspace_presence_sessions WHERE email=?').bind(member.email),
    ]);
    return { success: true };
  }
  async events() { requireRole(this.actor, 'admin'); return (await this.env.DB.prepare('SELECT e.*,e.target_email AS member_email FROM workspace_member_events e ORDER BY e.created_at DESC LIMIT 50').all()).results; }
  private identity(input: Record<string, unknown>) { return { sessionId: identifier(String(input.sessionId || '')), tabId: identifier(String(input.tabId || '')) }; }
  async heartbeat(input: Record<string, unknown>) {
    const { sessionId, tabId } = this.identity(input), now = seconds();
    const resourceType = ['campaign', 'material', 'asset', 'brand'].includes(String(input.resourceType)) ? String(input.resourceType) : '';
    const resourceId = resourceType ? identifier(String(input.resourceId || '')) : '';
    const locations: Record<string, string> = { campaigns: 'Campanhas', templates: 'Templates', library: 'Biblioteca', members: 'Membros do workspace', brand: 'Marca e rodapé', campaign: 'Campanha', material: 'Material', asset: 'Imagem' };
    await this.env.DB.batch([
      this.env.DB.prepare('INSERT INTO workspace_presence_sessions(id,user_id,email,name,session_id,tab_id,location,resource_type,resource_id,last_activity_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,location=excluded.location,resource_type=excluded.resource_type,resource_id=excluded.resource_id,last_activity_at=excluded.last_activity_at,last_seen_at=excluded.last_seen_at,expires_at=excluded.expires_at WHERE user_id=excluded.user_id')
        .bind(`${this.actor.id}:${sessionId}:${tabId}`, this.actor.id, this.actor.email, this.actor.name, sessionId, tabId, locations[String(input.location)] || 'Workspace', resourceType, resourceId, input.active === false ? now - 181 : now, now, now + 60),
      this.env.DB.prepare('UPDATE workspace_members SET last_seen_at=? WHERE email=?').bind(new Date().toISOString(), this.actor.email),
      this.env.DB.prepare('DELETE FROM workspace_presence_sessions WHERE expires_at<=?').bind(now),
    ]);
    return { success: true };
  }
  async leave(input: Record<string, unknown>) {
    const { sessionId, tabId } = this.identity(input);
    await this.env.DB.prepare('DELETE FROM workspace_presence_sessions WHERE user_id=? AND session_id=? AND tab_id=?').bind(this.actor.id, sessionId, tabId).run(); return { success: true };
  }
  async presence() {
    const now = seconds();
    const rows = (await this.env.DB.prepare('SELECT p.*,l.user_id AS editor_id,l.session_id AS editor_session,l.tab_id AS editor_tab FROM workspace_presence_sessions p LEFT JOIN workspace_edit_locks l ON l.resource_type=p.resource_type AND l.resource_id=p.resource_id AND l.expires_at>? WHERE p.expires_at>?').bind(now, now).all<{ user_id: string; email: string; name: string; tab_id: string; session_id: string; location: string; resource_type: ResourceType | ''; resource_id: string; last_activity_at: number; editor_id: string; editor_session: string; editor_tab: string }>()).results;
    const allowed = new Set((await this.env.DB.prepare("SELECT email FROM workspace_members WHERE status='active'").all<{ email: string }>()).results.map(r => r.email));
    const result = [];
    for (const p of rows) {
      if (!allowed.has(p.email) && !owners(this.env).includes(p.email)) continue;
      let name = '';
      if (p.resource_type === 'campaign') name = (await this.env.DB.prepare('SELECT title FROM campaigns WHERE id=?').bind(p.resource_id).first<{ title: string }>())?.title || '';
      if (p.resource_type === 'material') name = (await this.env.DB.prepare("SELECT json_extract(data,'$.name') AS name FROM materials WHERE id=?").bind(p.resource_id).first<{ name: string }>())?.name || '';
      if (p.resource_type === 'asset') name = (await this.env.DB.prepare('SELECT name FROM assets WHERE id=?').bind(p.resource_id).first<{ name: string }>())?.name || '';
      result.push({ userId: p.user_id, email: p.email, name: p.name, tabId: p.tab_id, location: p.location, resourceType: p.resource_type, resourceId: p.resource_id, resourceName: name, state: now - p.last_activity_at > 180 ? 'away' : 'online', editing: p.editor_id === p.user_id && p.editor_session === p.session_id && p.editor_tab === p.tab_id });
    }
    return result;
  }
  async lock(input: Record<string, unknown>, action: string) {
    const { sessionId, tabId } = this.identity(input);
    const type = String(input.resourceType), id = identifier(String(input.resourceId || ''));
    if (!['campaign', 'material', 'asset', 'brand'].includes(type)) throw new HttpError(400, 'Recurso inválido.');
    requireRole(this.actor, type === 'brand' ? 'admin' : 'editor');
    const table = { campaign: 'campaigns', material: 'materials', asset: 'assets' }[type];
    if (table && !await this.env.DB.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(id).first()) throw new HttpError(404, 'Recurso não encontrado.');
    if (type === 'brand' && id !== 'brand') throw new HttpError(400, 'Configuração inválida.');
    const now = seconds();
    if (action === 'acquire') {
      const token = crypto.randomUUID();
      await this.env.DB.prepare('INSERT INTO workspace_edit_locks(resource_type,resource_id,user_id,email,session_id,tab_id,token,generation,expires_at) VALUES(?,?,?,?,?,?,?,1,?) ON CONFLICT(resource_type,resource_id) DO UPDATE SET user_id=excluded.user_id,email=excluded.email,session_id=excluded.session_id,tab_id=excluded.tab_id,token=excluded.token,generation=workspace_edit_locks.generation+1,expires_at=excluded.expires_at WHERE workspace_edit_locks.expires_at<=?')
        .bind(type, id, this.actor.id, this.actor.email, sessionId, tabId, token, now + 90, now).run();
      const row = await this.env.DB.prepare('SELECT * FROM workspace_edit_locks WHERE resource_type=? AND resource_id=?').bind(type, id).first<{ token: string; generation: number; expires_at: number; email: string }>();
      if (row?.token !== token) throw new HttpError(423, `${row?.email || 'Outra pessoa'} está editando este recurso. Continue em visualização.`);
      return { resourceType: type, resourceId: id, token, generation: row.generation, expiresAt: row.expires_at, sessionId, tabId };
    }
    const matches = 'resource_type=? AND resource_id=? AND user_id=? AND session_id=? AND tab_id=? AND token=? AND generation=? AND expires_at>?';
    const values = [type, id, this.actor.id, sessionId, tabId, String(input.token || ''), Number(input.generation) || 0, now];
    // Keep expired rows so generations never repeat after a release.
    const result = await this.env.DB.prepare(`UPDATE workspace_edit_locks SET expires_at=? WHERE ${matches}`).bind(action === 'release' ? 0 : now + 90, ...values).run();
    if (!result.meta.changes) throw new HttpError(423, 'Sua reserva de edição expirou. Suas alterações locais foram preservadas.');
    return { ...input, expiresAt: action === 'release' ? 0 : now + 90 };
  }
}
