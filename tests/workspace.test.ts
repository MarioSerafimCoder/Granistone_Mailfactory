import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import worker from '../server/worker';
import { platformFixture } from './platform-fixture';
import { createCampaign, editCampaign, languageStates } from '../campaigns/model';
import { defaultBrand } from '../data/brand';
import { decodeBackup, isCampaign, type StudioData } from '../lib/storage';
import { OnlineError, online } from '../lib/online';
import { WorkspaceSync } from '../lib/workspace-sync';
import { hostLocalImages } from '../lib/workspace-images';
import { AssetRepository } from '../server/assets';
import { publicationSignature } from '../lib/publication-signature';
import { PublicationRepository } from '../server/publications';
import { richText } from '../campaigns/model';
function setup() {
  const fixture = platformFixture();
  fixture.env.EDITOR_EMAILS = 'editor@example.com,second@example.com';
  const request = async (path: string, method = 'GET', body?: unknown, user = 'editor@example.com') => worker.fetch(new Request(`https://studio.example.com${path}`, {
    method, headers: { Origin: 'https://studio.example.com', 'Content-Type': 'application/json', ...(user ? { 'oai-authenticated-user-id': user, 'oai-authenticated-user-email': user } : {}) }, body: body === undefined ? undefined : JSON.stringify(body),
  }), fixture.env);
  const api = (user = 'editor@example.com'): Pick<typeof online, 'session' | 'campaigns' | 'settings'> => {
    const call = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
      const response = await request(path, method, body, user);
      const data = await response.json() as T & { error?: string };
      if (!response.ok) throw new OnlineError(data.error || 'Erro', response.status);
      return data;
    };
    return {
      session: () => call('/api/session'),
      campaigns: {
        list: () => call('/api/campaigns'), get: id => call(`/api/campaigns/${id}`),
        create: (campaign, requestId) => call('/api/campaigns', 'POST', { campaign, requestId }),
        save: (campaign, revision, requestId) => call(`/api/campaigns/${campaign.id}`, 'PUT', { campaign, revision, requestId }),
        remove: (id, revision, requestId) => call(`/api/campaigns/${id}`, 'DELETE', { revision, requestId }),
        restore: (id, revision) => call(`/api/campaigns/${id}/restore`, 'POST', { revision, requestId: crypto.randomUUID() }),
        history: id => call(`/api/campaigns/${id}/history`),
        restoreRevision: (id, revision, historical) => call(`/api/campaigns/${id}/history/${historical}/restore`, 'POST', { revision, requestId: crypto.randomUUID() }),
      },
      settings: { get: () => call('/api/workspace/settings'), save: (brand, revision, requestId) => call('/api/workspace/settings', 'PUT', { brand, revision, requestId }) },
    };
  };
  return { ...fixture, request, api };
}
const key = () => crypto.randomUUID();
const empty = (): StudioData => ({ version: 2, campaigns: [], brand: defaultBrand });

test('shared campaigns: two authorized users, CAS conflicts, trusted audit, deletion, restore and history', async () => {
  const f = setup();
  try {
    const a = f.api(), b = f.api('second@example.com');
    const campaign = createCampaign({ title: 'Equipe Granistone' });
    const first = await a.campaigns.create(campaign, key());
    assert.equal(first.revision, 1); assert.equal(first.createdBy, 'editor@example.com');
    assert.equal((await b.campaigns.get(campaign.id)).campaign.title, campaign.title);
    const next = editCampaign(first.campaign, { title: 'Novo título' });
    const saved = await b.campaigns.save(next, 1, key());
    assert.equal(saved.revision, 2); assert.equal(saved.updatedBy, 'second@example.com');
    await assert.rejects(a.campaigns.save(campaign, 1, key()), error => error instanceof OnlineError && error.status === 409);
    await assert.rejects(a.campaigns.remove(campaign.id, 1, key()), /alterada/);
    const deleted = await a.campaigns.remove(campaign.id, 2, key());
    assert.ok(deleted.deletedAt); assert.equal(deleted.deletedBy, 'editor@example.com');
    await assert.rejects(a.campaigns.save(next, 3, key()), /lixeira/);
    const restored = await b.campaigns.restore(campaign.id, 3); assert.equal(restored.revision, 4); assert.equal(restored.deletedAt, null);
    const history = await a.campaigns.history(campaign.id);
    assert.ok(history.some(h => h.reason === 'delete')); assert.ok(history.some(h => h.reason === 'restore'));
    const rollback = await a.campaigns.restoreRevision(campaign.id, 4, 1);
    assert.equal(rollback.campaign.title, campaign.title); assert.equal(rollback.revision, 5);
    assert.equal((await f.request('/api/campaigns')).headers.get('Cache-Control'), 'no-store');
    for (const user of ['', 'intruder@example.com']) {
      assert.ok([401, 403].includes((await f.request('/api/campaigns', 'GET', undefined, user)).status));
      assert.ok([401, 403].includes((await f.request(`/api/campaigns/${campaign.id}`, 'PUT', { campaign, revision: 5, requestId: key(), created_by: 'editor@example.com' }, user)).status));
    }
  } finally { f.close(); }
});
test('idempotent create/update receipts recover a lost response without duplication', async () => {
  const f = setup(); try {
    const api = f.api(), campaign = createCampaign(), id = key();
    const first = await api.campaigns.create(campaign, id);
    assert.deepEqual(await api.campaigns.create(campaign, id), first);
    const updateKey = key(), changed = editCampaign(first.campaign, { title: 'Atualização' });
    const saved = await api.campaigns.save(changed, 1, updateKey);
    assert.deepEqual(await api.campaigns.save(changed, 1, updateKey), saved);
    assert.equal((await api.campaigns.list()).length, 1);
    await assert.rejects(api.campaigns.create({ ...campaign, title: 'Reutilização inválida' }, id), /Identificador/);
  } finally { f.close(); }
});
test('payload validation rejects malformed Spanish and local URLs; brand uses CAS', async () => {
  const f = setup(); try {
    const api = f.api(), c = createCampaign(); c.content.es = {} as typeof c.content.es;
    await assert.rejects(api.campaigns.create(c, key()), /inválida/);
    const image = createCampaign(); image.content.pt.heroImage = 'data:image/png;base64,AA==';
    await assert.rejects(api.campaigns.create(image, key()), /Hospede/);
    const brand = { ...defaultBrand, address: 'Endereço compartilhado' };
    await api.settings.save(brand, 0, key());
    assert.equal((await f.api('second@example.com').settings.get()).brand.address, brand.address);
    await assert.rejects(api.settings.save(defaultBrand, 0, key()), error => error instanceof OnlineError && error.status === 409);
    assert.equal((await api.settings.get()).revision, 1);
  } finally { f.close(); }
});
test('local migration is opt-in, idempotent, keeps IDs and does not overwrite shared campaigns', async () => {
  const f = setup(); try {
    const campaign = createCampaign({ id: 'stable-xlsx-id' });
    const sync = new WorkspaceSync({ ...empty(), campaigns: [campaign] }, async () => {}, () => {}, f.api());
    await sync.refresh(); assert.equal((await f.api().campaigns.list()).length, 0); assert.equal(sync.localCampaigns.length, 1);
    await sync.migrate(); await sync.migrate();
    assert.equal((await f.api().campaigns.list()).length, 1); assert.equal(sync.meta.revisions[campaign.id], 1);
    const different = new WorkspaceSync({ ...empty(), campaigns: [{ ...campaign, title: 'Outro rascunho' }] }, async () => {}, () => {}, f.api());
    await different.refresh(); assert.ok(different.meta.conflicts[campaign.id]); assert.equal(different.data.campaigns[0].title, 'Outro rascunho');
    await different.resolve(campaign.id, true); await different.sync(); assert.equal((await f.api().campaigns.list()).length, 2);
  } finally { f.close(); }
});
test('sync protects offline edits through reload, refresh and 409 without false cloud acknowledgements', async () => {
  const f = setup(); try {
    const api = f.api(), shared = await api.campaigns.create(createCampaign(), key());
    let disk = empty();
    const sync = new WorkspaceSync(empty(), async data => { disk = structuredClone(data); }, () => {}, api);
    await sync.refresh();
    const next = editCampaign(shared.campaign, { title: 'Meu trabalho offline' });
    await sync.save({ ...sync.data, campaigns: [next] });
    assert.equal(sync.campaignState(next.id), 'saving');
    const save = api.campaigns.save; api.campaigns.save = async () => { throw new TypeError('Sem conexão'); };
    await sync.sync(); assert.equal(sync.state, 'offline'); assert.ok(disk.sync?.pending[next.id]);
    api.campaigns.save = save;
    await f.api('second@example.com').campaigns.save({ ...shared.campaign, title: 'Trabalho da equipe' }, 1, key());
    const reload = new WorkspaceSync(disk, async () => {}, () => {}, api);
    await reload.refresh(); assert.equal(reload.data.campaigns[0].title, 'Meu trabalho offline');
    await reload.sync(); assert.equal(reload.state, 'conflict'); assert.equal((await api.campaigns.get(next.id)).campaign.title, 'Trabalho da equipe');
    await reload.resolve(next.id, false); assert.equal(reload.data.campaigns[0].title, 'Trabalho da equipe'); assert.equal(reload.meta.trash[0].title, 'Meu trabalho offline · cópia recuperada');
  } finally { f.close(); }
});
test('uploads deduplicate across languages before syncing and shared/history assets cannot be deleted', async () => {
  const f = setup(); try {
    const campaign = createCampaign({ language: 'PT / EN / ES' });
    const uri = `data:image/png;base64,${readFileSync('public/brand/granistone-logo.png').toString('base64')}`;
    for (const lang of ['pt', 'en', 'es'] as const) campaign.content[lang].heroImage = uri;
    let count = 0;
    const assets = new AssetRepository(f.env);
    const imageHost = async <T extends Parameters<typeof hostLocalImages>[0]>(input: T) => hostLocalImages(input, async () => { count++; return assets.create(readFileSync('public/brand/granistone-logo.png'), 'image/png', 'logo.png'); });
    const sync = new WorkspaceSync({ ...empty(), campaigns: [campaign] }, async () => {}, () => {}, f.api(), imageHost);
    await sync.refresh(); await sync.migrate();
    const saved = await f.api().campaigns.get(campaign.id);
    assert.equal(count, 1); assert.ok(!JSON.stringify(saved).includes('data:image'));
    assert.equal(saved.campaign.content.pt.heroImage, saved.campaign.content.es.heroImage);
    const id = saved.campaign.content.pt.heroImage.split('/').pop()!;
    await assert.rejects(assets.remove(id), /utilizada/);
    await f.api().campaigns.remove(campaign.id, 1, key());
    await assert.rejects(assets.remove(id), /utilizada/);
  } finally { f.close(); }
});
test('legacy language migration, independent approval and rendered-language publication freshness', () => {
  const legacy = createCampaign({ language: 'PT / EN', status: 'Aprovado' });
  const restored = decodeBackup(JSON.stringify({ ...empty(), campaigns: [legacy] })).campaigns[0];
  assert.equal(languageStates(restored).en.status, 'Aprovado'); assert.equal(languageStates(restored).es.status, 'Pendente');
  const signature = publicationSignature({ campaign: restored, language: 'pt', brand: defaultBrand });
  const edited = editCampaign(restored, { content: { ...restored.content, en: { ...restored.content.en, headline: 'English' } } }, 'en');
  assert.equal(languageStates(edited).en.status, 'Em produção'); assert.equal(languageStates(edited).pt.status, 'Aprovado');
  assert.equal(publicationSignature({ campaign: edited, language: 'pt', brand: defaultBrand }), signature);
  const approved = editCampaign(edited, { status: 'Aprovado' }, 'en');
  assert.equal(languageStates(approved).en.status, 'Aprovado'); assert.equal(languageStates(approved).es.status, 'Pendente');
  assert.ok(isCampaign(approved));
});
test('autosave snapshots are throttled while language status transitions are recorded and approvers are trusted', async () => {
  const f = setup(); try {
    const api = f.api(); let row = await api.campaigns.create(createCampaign(), key());
    for (let i = 0; i < 4; i++) row = await api.campaigns.save(editCampaign(row.campaign, { title: `Título ${i}` }), row.revision, key());
    assert.equal((await api.campaigns.history(row.campaign.id)).length, 1);
    const approved = editCampaign(row.campaign, { status: 'Aprovado' }, 'pt'); approved.languageState!.pt.approvedBy = 'spoof@example.com';
    row = await api.campaigns.save(approved, row.revision, key());
    assert.equal(row.campaign.languageState!.pt.approvedBy, 'editor@example.com');
    assert.equal((await api.campaigns.history(row.campaign.id)).length, 2);
  } finally { f.close(); }
});
test('shared publication requires the current revision and remains immutable after edits and deletion', async () => {
  const f = setup(); try {
    const api = f.api(), assets = new AssetRepository(f.env);
    const asset = await assets.create(readFileSync('public/brand/granistone-logo.png'), 'image/png', 'logo.png');
    const campaign = createCampaign({ title: 'Publicação compartilhada' });
    campaign.content.pt = { ...campaign.content.pt, subject: 'Granistone', headline: 'Pedra natural', preheader: 'Saiba mais', body: richText('Texto da campanha.'), cta: 'Ver', ctaUrl: f.env.SITE_ORIGIN, heroImage: asset.url, heroAlt: 'Pedra', applicationImage: asset.url, applicationAlt: 'Aplicação' };
    const brand = { ...defaultBrand, assetBaseUrl: f.env.SITE_ORIGIN, facebook: f.env.SITE_ORIGIN, instagram: f.env.SITE_ORIGIN, website: f.env.SITE_ORIGIN, whatsapp: f.env.SITE_ORIGIN };
    const row = await api.campaigns.create(campaign, key());
    const publications = new PublicationRepository(f.env);
    const input = { campaign: row.campaign, language: 'pt' as const, brand, campaignRevision: row.revision };
    const result = await publications.publish(input, key());
    assert.ok(result.publication, JSON.stringify(result.preflight));
    const before = result.publication!.html;
    await api.campaigns.save(editCampaign(row.campaign, { content: { ...row.campaign.content, pt: { ...row.campaign.content.pt, headline: 'Novo texto' } } }), 1, key());
    await assert.rejects(publications.publish(input, key()), /Sincronize/);
    await api.campaigns.remove(campaign.id, 2, key());
    assert.equal(await (await worker.fetch(new Request(result.publication!.url), f.env)).text(), before);
    assert.throws(() => f.db.exec("UPDATE publications SET html='changed'"), /immutable/);
  } finally { f.close(); }
});
test('edits made during an in-flight save are queued on the acknowledged revision', async () => {
  const f = setup(); try {
    const api = f.api(), row = await api.campaigns.create(createCampaign(), key());
    const sync = new WorkspaceSync(empty(), async () => {}, () => {}, api);
    await sync.refresh();
    const originalSave = api.campaigns.save;
    let release!: () => void, started!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { started = resolve; });
    api.campaigns.save = async (...args) => { started(); await waiting; return originalSave(...args); };
    await sync.save({ ...sync.data, campaigns: [{ ...row.campaign, title: 'Primeira edição' }] });
    const sending = sync.sync(); await ready;
    await sync.save({ ...sync.data, campaigns: [{ ...row.campaign, title: 'Edição enquanto salva' }] });
    release(); await sending;
    assert.equal(sync.data.campaigns[0].title, 'Edição enquanto salva');
    assert.equal(sync.meta.pending[row.campaign.id].revision, 2);
    await sync.sync(); assert.equal((await api.campaigns.get(row.campaign.id)).campaign.title, 'Edição enquanto salva');
    assert.equal(sync.campaignState(row.campaign.id), 'saved');
  } finally { f.close(); }
});
test('an open brand form keeps its base revision and conflicts instead of overwriting another editor', async () => {
  const f = setup(); try {
    const api = f.api(); await api.settings.save(defaultBrand, 0, key());
    const sync = new WorkspaceSync(empty(), async () => {}, () => {}, api); await sync.refresh();
    sync.brandEditing = true;
    await f.api('second@example.com').settings.save({ ...defaultBrand, address: 'Da equipe' }, 1, key());
    await sync.refresh(); assert.equal(sync.meta.brandRevision, 1);
    await sync.save({ ...sync.data, brand: { ...defaultBrand, address: 'Minha edição' } });
    sync.brandEditing = false; await sync.sync();
    assert.ok(sync.meta.brandConflict); assert.equal((await api.settings.get()).brand.address, 'Da equipe');
  } finally { f.close(); }
});
