import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCampaign, editCampaign } from '../campaigns/model';
import { blockRegistry, createSection, isSection } from '../blocks/registry';
import { blueprintFromCampaign, campaignFromBlueprint, convertSections, duplicateCampaign, duplicateSection, moveSection } from '../blocks/model';
import { defaultDesign } from '../lib/tokens/backgrounds';
import { isCampaign, decodeBackup } from '../lib/storage';
import { defaultBrand } from '../data/brand';
import { publicationSignature } from '../lib/publication-signature';
import { renderEmail } from '../export/render';
import { backgroundAttributes } from '../export/background';
import { contentChecks, htmlChecks } from '../export/preflight';
import { runPreflight, imageUrls } from '../server/preflight';
import { platformFixture } from './platform-fixture';
import worker from '../server/worker';
import { AssetRepository } from '../server/assets';
import { PublicationRepository } from '../server/publications';
import type { SectionType } from '../types/design';
import { applySectionTranslation, sectionTranslationItems } from '../lib/translation';

test('registry covers all 16 blocks; add, duplicate, remove and reorder preserve independent localized content', async () => {
  const sections = (Object.keys(blockRegistry) as SectionType[]).map(createSection);
  assert.equal(sections.length, 16); sections.forEach(s => assert.equal(isSection(s), true));
  const duplicate = duplicateSection(sections[0]); duplicate.content.pt.title = 'Cópia editada';
  assert.notEqual(duplicate.id, sections[0].id); assert.notEqual(duplicate.content.pt.title, sections[0].content.pt.title);
  const moved = moveSection([sections[0], duplicate], 1, -1); assert.equal(moved[0].id, duplicate.id);
  assert.equal(moved.filter(s => s.id !== duplicate.id).length, 1);
  const c = createCampaign({ sections });
  const html = await renderEmail(c, 'pt', defaultBrand);
  assert.match(html, /width="600"/); assert.doesNotMatch(html, /display:(flex|grid)|var\(--|<script/);
  const bad = structuredClone(c); bad.sections![0].settings.padding = 999; assert.equal(isCampaign(bad), false);
  assert.equal(isSection({ ...sections[0], type: '__proto__' }), false);
});

test('legacy campaigns retain their rendering, rich formatting and backup; copy resets approvals and templates strip specific text', async () => {
  const old = createCampaign({ title: 'Original', status: 'Aprovado', sourceKey: 'spreadsheet-id' });
  old.content.pt.body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texto importante', marks: [{ type: 'bold' }] }] }] };
  const before = await renderEmail(old, 'pt', defaultBrand);
  assert.equal(await renderEmail(decodeBackup(JSON.stringify({ version: 2, campaigns: [old], brand: defaultBrand })).campaigns[0], 'pt', defaultBrand), before);
  const converted = { ...old, sections: convertSections(old) };
  assert.match(await renderEmail(converted, 'pt', defaultBrand), /<strong[^>]*>Texto importante/);
  assert.equal(await renderEmail(old, 'pt', defaultBrand), before);
  const copy = duplicateCampaign(converted);
  assert.notEqual(copy.id, old.id); assert.equal(copy.status, 'Em produção'); assert.equal(copy.sourceKey, undefined);
  assert.equal(copy.languageState?.pt.approvedBy, undefined); assert.notEqual(copy.sections![0].id, converted.sections[0].id);
  const blueprint = blueprintFromCampaign(converted); assert.doesNotMatch(JSON.stringify(blueprint), /Texto importante/);
  const from = campaignFromBlueprint(blueprint, 'Modelo novo'); assert.equal(isCampaign(from), true);
  assert.notEqual(from.sections![0].id, blueprint.sections[0].id);
});

test('design edits reset the affected language approval and publication signature; section translation keeps images and links', () => {
  const c = createCampaign({ status: 'Aprovado', language: 'PT / EN / ES', sections: [createSection('imageText')], design: defaultDesign() });
  c.sections![0].content.pt = { title: 'Pedra', text: 'Natural', image: 'https://example.com/stone.jpg', alt: 'Chapa', label: 'Abrir', link: 'https://example.com/' };
  const original = publicationSignature({ campaign: c, language: 'pt', brand: defaultBrand });
  const sections = applySectionTranslation(c, 'es', { target: 'es', items: sectionTranslationItems(c, 'pt').map(item => ({ ...item, text: 'ES ' + item.text })) }, true)!;
  assert.equal(sections[0].content.es.image, c.sections![0].content.pt.image);
  assert.equal(sections[0].content.es.link, c.sections![0].content.pt.link);
  const translated = editCampaign(c, { sections }, 'es');
  assert.equal(publicationSignature({ campaign: translated, language: 'pt', brand: defaultBrand }), original);
  assert.equal(translated.languageState!.pt.status, 'Aprovado');
  assert.equal(translated.languageState!.es.status, 'Em produção');
  const updated = editCampaign(c, { design: { ...defaultDesign(), email: { kind: 'solid', color: '#111111' } } });
  assert.equal(updated.languageState!.pt.status, 'Em produção');
  assert.notEqual(publicationSignature({ campaign: updated, language: 'pt', brand: defaultBrand }), original);
});

test('solid, gradient, image and per-section backgrounds emit safe table fallbacks and actionable preflight warnings', async () => {
  const f = platformFixture(); try {
    const asset = await new AssetRepository(f.env).create(new Uint8Array(readFileSync('public/brand/granistone-logo.png')), 'image/png', 'logo.png', { alt: 'Pedra' });
    const c = createCampaign({ sections: [createSection('centeredText')], design: defaultDesign() });
    c.content.pt.subject = 'Teste'; c.sections![0].content.pt = { title: 'Título', text: 'Conteúdo aprovado' };
    c.design!.email = { kind: 'gradient', start: '#111111', end: '#343434', direction: 'diagonal', fallback: '#111111' };
    c.design!.content = { kind: 'image', image: asset.url, size: 'cover', position: 'top', fallback: '#F5F3EF', overlay: .3 };
    c.sections![0].settings.background = { kind: 'solid', color: '#111111' };
    c.sections![0].settings.textColor = '#121212';
    const brand = { ...defaultBrand, assetBaseUrl: f.env.SITE_ORIGIN };
    const html = await renderEmail(c, 'pt', brand);
    assert.match(html, /bgcolor="#111111"/); assert.match(html, /linear-gradient\(135deg/);
    assert.match(html, /background="https:\/\/studio.example.com\/assets\//);
    assert.ok(imageUrls(html).includes(asset.url)); assert.equal(htmlChecks(html).some(c => c.severity === 'error'), false);
    const checks = await runPreflight({ campaign: c, language: 'pt', brand }, f.env);
    assert.ok(checks.warnings.some(c => c.message.includes('Outlook desktop')));
    assert.ok(checks.warnings.some(c => c.message.includes('contraste')));
    const published = await new PublicationRepository(f.env).publish({ campaign: c, language: 'pt', brand }, 'design-publication');
    assert.ok(published.publication);
    const immutable = published.publication.html;
    c.design!.email = { kind: 'solid', color: '#FFFFFF' };
    assert.equal((await new PublicationRepository(f.env).list(c.id))[0].html, immutable);
    const missing = structuredClone(c); (missing.design!.content as { fallback?: string }).fallback = undefined;
    assert.equal(isCampaign(missing), false);
    assert.ok(contentChecks(missing, 'pt', brand).some(c => c.severity === 'error' && c.message.includes('fallback')));
    c.design!.content = { kind: 'image', image: 'http://127.0.0.1/private', size: 'cover', position: 'top', fallback: '#FFFFFF', overlay: 0 };
    assert.ok(contentChecks(c, 'pt', brand).some(c => c.severity === 'error' && c.message.includes('HTTPS')));
    f.objects.clear();
    assert.ok((await runPreflight({ campaign: { ...c, design: { ...c.design!, content: { kind: 'image', image: asset.url, fallback: '#FFFFFF', size: 'contain', position: 'center', overlay: 0 } } }, brand, language: 'pt' }, f.env)).checks.some(c => c.severity === 'error' && c.message.includes('ausente')));
  } finally { f.close(); }
});

test('transparent and original-size image backgrounds keep email markup self-contained', () => {
  assert.equal(backgroundAttributes({ kind: 'none' }), 'style="background-color:transparent;"');
  const attrs = backgroundAttributes({ kind: 'image', image: 'https://example.com/stone.jpg', size: 'original', position: 'top', align: 'left', repeat: 'repeat', fallback: '#FFFFFF', overlay: 0 });
  assert.match(attrs, /bgcolor="#FFFFFF"/);
  assert.match(attrs, /background-size:auto;background-position:left top;background-repeat:repeat/);
  assert.doesNotMatch(attrs, /var\(--ui-|data-theme/);
});

test('saved blocks and templates share D1, enforce membership + leases + CAS, retain images and create new campaign history', async () => {
  const f = platformFixture(); try {
    const request = (path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}, email = 'editor@example.com') => worker.fetch(new Request(f.env.SITE_ORIGIN + path, { method, headers: { 'Content-Type': 'application/json', Origin: f.env.SITE_ORIGIN, 'oai-authenticated-user-id': email, 'oai-authenticated-user-email': email, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) }), f.env);
    const s = createSection('centeredText');
    const input = { id: crypto.randomUUID(), kind: 'block', payload: s, name: 'Bloco compartilhado', description: 'Editorial', category: 'Produto', revision: 0 };
    assert.equal((await request('/api/designs', 'POST', input, {}, 'outsider@example.com')).status, 403);
    const created = await request('/api/designs', 'POST', input); assert.equal(created.status, 201, await created.text());
    assert.equal((await request('/api/designs', 'POST', input)).status, 201);
    assert.equal((await (await request('/api/designs?kind=block')).json() as unknown[]).length, 1);
    const edited = { ...input, revision: 1, name: 'Alterado' };
    assert.equal((await request('/api/designs/' + input.id, 'PUT', edited, { 'X-Resource-Revision': '1' })).status, 423);
    const lock = await (await request('/api/workspace/edit-locks/acquire', 'POST', { resourceType: 'design', resourceId: input.id, sessionId: crypto.randomUUID(), tabId: crypto.randomUUID() })).json() as { token: string; generation: number; sessionId: string; tabId: string };
    const headers = { 'X-Workspace-Session': lock.sessionId, 'X-Workspace-Tab': lock.tabId, 'X-Edit-Token': lock.token, 'X-Edit-Generation': String(lock.generation), 'X-Resource-Revision': '1' };
    assert.equal((await request('/api/designs/' + input.id, 'PUT', edited, headers)).status, 200);
    assert.equal((await request('/api/designs/' + input.id, 'PUT', edited, headers)).status, 409);
    const source = createCampaign({ status: 'Aprovado', sections: [s] });
    const blueprint = blueprintFromCampaign(source);
    const template = { ...input, id: crypto.randomUUID(), kind: 'template', payload: blueprint };
    assert.equal((await request('/api/designs', 'POST', template)).status, 201);
    const copy = duplicateCampaign(source);
    const saved = await request('/api/campaigns', 'POST', { campaign: copy, requestId: crypto.randomUUID() }); assert.equal(saved.status, 201);
    const result = await saved.json() as { revision: number; campaign: { status: string }; createdAt: string };
    assert.equal(result.revision, 1); assert.equal(result.campaign.status, 'Em produção'); assert.ok(result.createdAt);
    assert.equal((await (await request('/api/campaigns/' + copy.id + '/history')).json() as unknown[]).length, 1);
    const asset = await new AssetRepository(f.env).create(new Uint8Array(readFileSync('public/brand/granistone-logo.png')), 'image/png', 'logo.png', {});
    const image = createSection('banner'); image.content.pt.image = asset.url;
    assert.equal((await request('/api/designs', 'POST', { ...input, id: crypto.randomUUID(), payload: image })).status, 201);
    await assert.rejects(() => new AssetRepository(f.env).remove(asset.id), /Exclusão bloqueada/);
    const deletion = await request('/api/designs/' + input.id, 'DELETE', undefined, { ...headers, 'X-Resource-Revision': '2' });
    assert.equal(deletion.status, 200);
    assert.equal((await request('/api/designs/' + input.id)).status, 404);
  } finally { f.close(); }
});
