import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../server/worker';
import { platformFixture } from './platform-fixture';
import { createCampaign } from '../campaigns/model';
import { defaultBrand } from '../data/brand';
import { AssetRepository } from '../server/assets';
import { guardedEnv, type MemberActor } from '../server/collaboration';
import { CampaignRepository } from '../server/campaigns';
import type { EditLock } from '../types/collaboration';

function setup() {
  const f = platformFixture();
  const owner = 'editor@example.com';
  const identity = () => ({ sessionId: crypto.randomUUID(), tabId: crypto.randomUUID() });
  const headers = (lock?: EditLock): Record<string, string> => lock ? { 'X-Workspace-Session': lock.sessionId, 'X-Workspace-Tab': lock.tabId, 'X-Edit-Token': lock.token, 'X-Edit-Generation': String(lock.generation) } : {};
  const request = (path: string, method = 'GET', body?: unknown, email = owner, extra: Record<string, string> = {}) => worker.fetch(new Request(`${f.env.SITE_ORIGIN}${path}`, { method, headers: { Origin: f.env.SITE_ORIGIN, 'Content-Type': 'application/json', 'oai-authenticated-user-id': email, 'oai-authenticated-user-email': email, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) }), f.env);
  const json = async (path: string, method = 'GET', body?: unknown, email = owner, extra?: Record<string, string>) => { const r = await request(path, method, body, email, extra); const data = await r.json(); assert.ok(r.ok, JSON.stringify(data)); return data; };
  const add = (email: string, role = 'editor') => json('/api/workspace/members', 'POST', { email, role });
  const campaign = () => json('/api/campaigns', 'POST', { campaign: createCampaign(), requestId: crypto.randomUUID() });
  const acquire = (resourceType: string, resourceId: string, email = owner, ids = identity()) => json('/api/workspace/edit-locks/acquire', 'POST', { resourceType, resourceId, ...ids }, email) as Promise<EditLock>;
  return { ...f, owner, request, json, add, campaign, acquire, headers, identity };
}
test('members authorize immediately, normalize email, restrict roles and preserve audit on removal', async () => {
  const f = setup(); try {
    const m = await f.add(' Flavia@Granistone.com.br ');
    const editor = await f.json('/api/session', 'GET', undefined, 'flavia@granistone.com.br');
    assert.equal(editor.member, true); assert.equal(editor.role, 'editor'); assert.equal(editor.permissions.manageMembers, false);
    assert.equal((await f.request('/api/workspace/members', 'GET', undefined, editor.email)).status, 403);
    await f.add('viewer@granistone.com.br', 'viewer');
    const viewer = await f.json('/api/session', 'GET', undefined, 'viewer@granistone.com.br');
    assert.equal(viewer.member, true); assert.equal(viewer.editor, false);
    assert.equal((await f.request('/api/campaigns', 'GET', undefined, viewer.email)).status, 200);
    assert.equal((await f.request('/api/campaigns', 'POST', { campaign: createCampaign(), requestId: crypto.randomUUID() }, viewer.email)).status, 403);
    assert.equal((await f.request('/api/workspace/members', 'POST', { email: editor.email, role: 'editor' })).status, 409);
    await f.json(`/api/workspace/members/${m.id}`, 'DELETE');
    assert.equal((await f.request('/api/campaigns', 'GET', undefined, editor.email)).status, 403);
    assert.equal((await f.json('/api/session')).owner, true);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM workspace_member_events WHERE member_id=?').get(m.id)!.n, 2);
  } finally { f.close(); }
});
test('last administrator cannot be disabled, demoted or removed, including concurrent removals', async () => {
  const f = setup(); try {
    const a = await f.add('admin-a@example.com', 'admin'), b = await f.add('admin-b@example.com', 'admin');
    const result = await Promise.all([f.request(`/api/workspace/members/${a.id}`, 'DELETE'), f.request(`/api/workspace/members/${b.id}`, 'DELETE')]);
    assert.deepEqual(result.map(r => r.status).sort(), [200, 409]);
    const left = f.db.prepare("SELECT id FROM workspace_members WHERE role='admin'").get()!.id;
    assert.equal((await f.request(`/api/workspace/members/${left}`, 'PATCH', { role: 'viewer' })).status, 409);
    assert.equal((await f.request(`/api/workspace/members/${left}`, 'PATCH', { status: 'disabled' })).status, 409);
  } finally { f.close(); }
});
test('a single lease wins acquisition, second tab cannot save, different resources remain independent', async () => {
  const f = setup(); try {
    const c = await f.campaign(), d = await f.campaign();
    const first = f.identity(), second = f.identity();
    const result = await Promise.all([f.request('/api/workspace/edit-locks/acquire', 'POST', { resourceType: 'campaign', resourceId: c.campaign.id, ...first }), f.request('/api/workspace/edit-locks/acquire', 'POST', { resourceType: 'campaign', resourceId: c.campaign.id, ...second })]);
    assert.deepEqual(result.map(r => r.status).sort(), [200, 423]);
    const winner = await result.find(r => r.ok)!.json() as EditLock;
    await f.acquire('campaign', d.campaign.id);
    const input = { campaign: { ...c.campaign, title: 'Salvo' }, revision: c.revision, requestId: crypto.randomUUID() };
    assert.equal((await f.request(`/api/campaigns/${c.campaign.id}`, 'PUT', input)).status, 423);
    assert.equal((await f.request(`/api/campaigns/${c.campaign.id}`, 'PUT', input, f.owner, { ...f.headers(winner), 'X-Workspace-Tab': second.tabId === winner.tabId ? first.tabId : second.tabId })).status, 423);
    const saved = await f.json(`/api/campaigns/${c.campaign.id}`, 'PUT', input, f.owner, f.headers(winner));
    assert.equal(saved.revision, 2);
    assert.equal((await f.request(`/api/campaigns/${c.campaign.id}`, 'PUT', { ...input, requestId: crypto.randomUUID() }, f.owner, f.headers(winner))).status, 409);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM workspace_write_checks').get()!.n, 0);
  } finally { f.close(); }
});
test('expired lease is fenced from saving, renewing and releasing a replacement lease', async () => {
  const f = setup(); try {
    const c = await f.campaign(), old = await f.acquire('campaign', c.campaign.id);
    f.db.prepare('UPDATE workspace_edit_locks SET expires_at=0').run();
    const next = await f.acquire('campaign', c.campaign.id);
    assert.ok(next.generation > old.generation);
    assert.notEqual(next.token, old.token);
    for (const action of ['renew', 'release']) assert.equal((await f.request(`/api/workspace/edit-locks/${action}`, 'POST', old)).status, 423);
    assert.equal((await f.request(`/api/campaigns/${c.campaign.id}`, 'PUT', { campaign: c.campaign, revision: 1, requestId: crypto.randomUUID() }, f.owner, f.headers(old))).status, 423);
    assert.equal((await f.request(`/api/campaigns/${c.campaign.id}`, 'PUT', { campaign: c.campaign, revision: 1, requestId: crypto.randomUUID() }, f.owner, f.headers(next))).status, 200);
  } finally { f.close(); }
});
test('permission is rechecked atomically after a session was authorized; revoked drafts cannot overwrite', async () => {
  const f = setup(); try {
    const member = await f.add('editor-b@example.com'), c = await f.campaign();
    const lock = await f.acquire('campaign', c.campaign.id, 'editor-b@example.com');
    const actor: MemberActor = { id: 'editor-b@example.com', email: 'editor-b@example.com', name: 'Editor B', role: 'editor', owner: false };
    const req = new Request(`${f.env.SITE_ORIGIN}/api/campaigns/${c.campaign.id}`, { method: 'PUT', headers: f.headers(lock) });
    const repo = new CampaignRepository(guardedEnv(f.env, actor, req, 'campaign', c.campaign.id), actor);
    await f.json(`/api/workspace/members/${member.id}`, 'PATCH', { role: 'viewer' });
    await assert.rejects(repo.update(c.campaign.id, { campaign: { ...c.campaign, title: 'Não deve salvar' }, revision: 1, requestId: crypto.randomUUID() }), /workspace_forbidden/);
    assert.equal((await f.json(`/api/campaigns/${c.campaign.id}`)).revision, 1);
    assert.equal((await f.request('/api/workspace/edit-locks/acquire', 'POST', { resourceType: 'campaign', resourceId: c.campaign.id, ...f.identity() }, actor.email)).status, 403);
  } finally { f.close(); }
});
test('presence is per tab, expires, and editing is derived from server leases', async () => {
  const f = setup(); try {
    const c = await f.campaign(), a = f.identity(), b = f.identity();
    const payload = { location: 'campaign', resourceType: 'campaign', resourceId: c.campaign.id, editing: true };
    await f.json('/api/workspace/presence/heartbeat', 'POST', { ...payload, ...a });
    await f.json('/api/workspace/presence/heartbeat', 'POST', { ...payload, ...b, active: false });
    const entries = await f.json('/api/workspace/presence'); assert.equal(entries.length, 2); assert.equal(entries[0].editing, false);
    await f.acquire('campaign', c.campaign.id, f.owner, a);
    assert.equal((await f.json('/api/workspace/presence')).filter((p: { editing: boolean }) => p.editing).length, 1);
    await f.json('/api/workspace/presence/session', 'DELETE', a);
    assert.equal((await f.json('/api/workspace/presence')).length, 1);
    f.db.prepare('UPDATE workspace_presence_sessions SET expires_at=0').run();
    assert.deepEqual(await f.json('/api/workspace/presence'), []);
  } finally { f.close(); }
});
test('brand, materials and assets require leases; library revisions prevent a stale same-tab write', async () => {
  const f = setup(); try {
    assert.equal((await f.request('/api/workspace/settings', 'PUT', { brand: defaultBrand, revision: 0, requestId: crypto.randomUUID() })).status, 423);
    const brand = await f.acquire('brand', 'brand');
    assert.equal((await f.request('/api/workspace/settings', 'PUT', { brand: defaultBrand, revision: 0, requestId: crypto.randomUUID() }, f.owner, f.headers(brand))).status, 200);
    const material = await f.json('/api/materials', 'POST', { name: 'Amazonita' });
    const lock = await f.acquire('material', material.id);
    const headers = { ...f.headers(lock), 'X-Resource-Revision': String(material.revision) };
    assert.equal((await f.request(`/api/materials/${material.id}`, 'PUT', { ...material, name: 'Novo nome' }, f.owner, headers)).status, 200);
    assert.equal((await f.request(`/api/materials/${material.id}`, 'PUT', { ...material, name: 'Sobrescrita' }, f.owner, headers)).status, 409);
    const asset = await new AssetRepository(f.env).create(readFileSync('public/brand/granistone-logo.png'), 'image/png', 'logo.png');
    assert.equal((await f.request(`/api/assets/${asset.id}`, 'PATCH', { name: 'Não salvar' })).status, 423);
    const lease = await f.acquire('asset', asset.id);
    assert.equal((await f.request(`/api/assets/${asset.id}`, 'PATCH', { name: 'Logo' }, f.owner, { ...f.headers(lease), 'X-Resource-Revision': String(asset.revision) })).status, 200);
  } finally { f.close(); }
});
