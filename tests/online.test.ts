import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { platformFixture } from './platform-fixture';
import { AssetRepository } from '../server/assets';
import { MaterialRepository } from '../server/materials';
import { PublicationRepository } from '../server/publications';
import { optimizeImage, MAX_UPLOAD } from '../server/images';
import { publicHttpsUrl } from '../lib/public-url';
import { inspectRemote } from '../server/remote';
import { contentChecks, htmlChecks } from '../export/preflight';
import { runPreflight } from '../server/preflight';
import { createCampaign, richText } from '../campaigns/model';
import { defaultBrand } from '../data/brand';
import worker from '../server/worker';
import type { PublicationInput } from '../types/online';
import { translateContent } from '../server/translation';

const png = new Uint8Array(readFileSync('public/brand/granistone-logo.png'));
test('Gemini translation validates and returns every requested field', async () => {
  const fixture = platformFixture(); fixture.env.GEMINI_API_KEY = 'test-secret';
  const original = globalThis.fetch; let header = '';
  globalThis.fetch = async (_url, init) => {
    header = new Headers(init?.headers).get('x-goog-api-key') || '';
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify([{ id: 'headline', text: 'Natural stone' }]) }] } }] });
  };
  try {
    const result = await translateContent({ target: 'en', items: [{ id: 'headline', text: 'Pedra natural' }] }, fixture.env);
    assert.equal(result.items[0].text, 'Natural stone'); assert.equal(header, 'test-secret');
    await assert.rejects(translateContent({ target: 'fr', items: [] }, fixture.env), /inválido/);
  } finally { globalThis.fetch = original; fixture.close(); }
});
function validInput(origin: string, image: string): PublicationInput {
  const campaign = createCampaign({ title: 'Amazon Green · Arquitetos' });
  campaign.content.pt = { ...campaign.content.pt, subject: 'Campanha teste', headline: 'Conteúdo para homologação', preheader: 'Prévia de teste', body: richText('Texto de teste.'), heroImage: image, heroAlt: 'Logo Granistone', cta: 'Acessar', ctaUrl: origin };
  campaign.content.en = { ...campaign.content.pt, subject: 'Test campaign' };
  return { campaign, language: 'pt', brand: { ...defaultBrand, assetBaseUrl: origin, website: origin, facebook: origin, instagram: origin, whatsapp: origin, unsubscribeMode: 'rd-managed', unsubscribeUrl: '' } };
}
test('upload validates signatures, size, corrupt files and paths; transparent PNG remains PNG', () => {
  const image = optimizeImage(png, 'image/png', 'logo.png');
  assert.equal(image.mimeType, 'image/png'); assert.ok(image.width <= 1600); assert.ok(image.fileSize > 0);
  assert.throws(() => optimizeImage(png, 'image/jpeg', 'logo.jpg'));
  assert.throws(() => optimizeImage(png, 'image/png', '../logo.png'));
  assert.throws(() => optimizeImage(new Uint8Array(MAX_UPLOAD + 1), 'image/png', 'x.png'));
  assert.throws(() => optimizeImage(new Uint8Array([1, 2, 3]), 'image/png', 'x.png'));
  assert.throws(() => optimizeImage(png.subarray(0, 40), 'image/png', 'x.png'));
});
test('assets persist, deduplicate, edit metadata, serve anonymously, associate materials and protect references', async () => {
  const fixture = platformFixture(); const repo = new AssetRepository(fixture.env);
  try {
    const asset = await repo.create(png, 'image/png', 'logo.png', { name: 'Teste', category: 'institucional', alt: 'Logo' });
    assert.match(asset.url, /^https:\/\/studio.example.com\/assets\/[a-f0-9]{64}$/);
    assert.equal((await repo.create(png, 'image/png', 'same.png')).id, asset.id);
    assert.equal(fixture.objects.size, 1);
    assert.equal((await repo.list('Teste', 'institucional')).length, 1);
    assert.equal((await repo.update(asset.id, { alt: 'Nova descrição' })).alt, 'Nova descrição');
    const served = await worker.fetch(new Request(asset.url), fixture.env); assert.equal(served.status, 200); assert.equal(served.headers.get('content-type'), 'image/png');
    assert.ok((await served.arrayBuffer()).byteLength > 0);
    const materials = new MaterialRepository(fixture.env);
    const material = await materials.save({ name: 'Teste sem dados técnicos', heroAssetId: asset.id });
    assert.equal(material.description, ''); assert.deepEqual(material.features, []);
    assert.deepEqual((await materials.get(material.id)).assetIds, [asset.id]);
    await assert.rejects(repo.remove(asset.id), /Exclusão bloqueada/);
    assert.equal((await repo.usage(asset.id)).materials.length, 1);
    await materials.save({ ...material, heroAssetId: undefined, assetIds: [] }, material.id);
    await repo.remove(asset.id); await assert.rejects(repo.get(asset.id));
    assert.equal(fixture.objects.size, 1);
  } finally { fixture.close(); }
});
test('preflight rejects missing enabled images, data/http/private URLs, empty ALT, invalid CTA and active HTML', () => {
  const input = validInput('https://studio.example.com', 'https://studio.example.com/assets/abc');
  for (const url of ['', 'data:image/png;base64,aaaa', 'http://example.com/x.png', 'https://localhost/x', 'https://10.0.0.1/x', 'https://[::1]/x']) {
    input.campaign.content.pt.heroImage = url;
    assert.ok(contentChecks(input.campaign, 'pt', input.brand).some(c => c.id === 'hero.src' && c.severity === 'error'), url);
  }
  input.campaign.content.pt.heroAlt = ''; input.campaign.content.pt.ctaUrl = 'javascript:alert(1)';
  const checks = contentChecks(input.campaign, 'pt', input.brand);
  assert.ok(checks.some(c => c.id === 'hero.alt' && c.severity === 'error'));
  assert.ok(checks.some(c => c.id === 'cta' && c.severity === 'error'));
  for (const html of ['<script>alert(1)</script>', '<iframe src="https://example.com"></iframe>', '<img src="/local.png" alt="x">', '<img src="data:image/png;base64,aa" alt="x">']) assert.ok(htmlChecks(html).some(c => c.severity === 'error'));
});
test('SSRF denies normalized private IPv4/IPv6, credentials, ports, suspicious hosts and every redirect hop', async () => {
  for (const url of ['https://127.1/x', 'https://2130706433/x', 'https://0x7f000001/x', 'https://169.254.169.254/x', 'https://100.64.0.1/x', 'https://[::ffff:127.0.0.1]/x', 'https://[fc00::1]/x', 'https://example.com:8443', 'https://user:pass@example.com', 'https://metadata.internal/x']) assert.equal(publicHttpsUrl(url), false, url);
  let requested = 0;
  const fetcher: typeof fetch = async (url) => {
    if (String(url).startsWith('https://cloudflare-dns.com/')) return Response.json({ Status: 0, Answer: [{ type: 1, data: '93.184.216.34' }] });
    requested++; return new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } });
  };
  await assert.rejects(inspectRemote('https://images.example.com/a', { hosts: [], fetcher }), /Domínio/); assert.equal(requested, 0);
  await assert.rejects(inspectRemote('https://images.example.com/a', { hosts: ['images.example.com'], fetcher }), /insegura/); assert.equal(requested, 1);
  await assert.rejects(inspectRemote('https://images.example.com/a', { hosts: ['images.example.com'], fetcher: async () => Response.json({ Status: 0, Answer: [{ type: 1, data: '10.0.0.1' }] }) }), /DNS privado/);
});
test('remote checks handle HEAD fallback, MIME errors, HTTP failures, timeouts and excessive redirects', async () => {
  const methods: string[] = [];
  const wrap = (handler: typeof fetch): typeof fetch => async (url, options) => String(url).startsWith('https://cloudflare-dns.com/') ? Response.json({ Status: 0, Answer: [{ type: 1, data: '93.184.216.34' }] }) : handler(url, options);
  const remote = await inspectRemote('https://images.example.com/a', { hosts: ['images.example.com'], fetcher: wrap(async (_, options) => { methods.push(options?.method || 'GET'); return options?.method === 'HEAD' ? new Response(null, { status: 405 }) : new Response(null, { status: 206, headers: { 'content-type': 'image/png', 'content-range': 'bytes 0-1/900000' } }); }) }, true);
  assert.deepEqual(methods, ['HEAD', 'GET']); assert.equal(remote.fileSize, 900000);
  for (const handler of [async () => new Response('', { headers: { 'content-type': 'text/html' } }), async () => new Response(null, { status: 404 }), async () => { throw new DOMException('Timeout', 'TimeoutError'); }, async () => new Response(null, { status: 302, headers: { location: '/again' } })]) await assert.rejects(inspectRemote('https://images.example.com/a', { hosts: ['images.example.com'], fetcher: wrap(handler) }, true));
});
test('publication runs server preflight, has immutable v1/v2, independent PT/EN, idempotency and public raw HTML', async () => {
  const fixture = platformFixture();
  try {
    const assets = new AssetRepository(fixture.env);
    const asset = await assets.create(png, 'image/png', 'logo.png');
    const input = validInput(fixture.env.SITE_ORIGIN, asset.url);
    const preflight = await runPreflight(input, fixture.env);
    assert.equal(preflight.hasErrors, false, JSON.stringify(preflight.checks.filter(c => c.severity === 'error')));
    const publications = new PublicationRepository(fixture.env);
    const first = (await publications.publish(input, 'request-1')).publication!;
    assert.equal(first.version, 1); assert.ok(!first.html.includes('/brand/'));
    input.campaign.content.pt.headline = 'Versão editada';
    const second = (await publications.publish(input, 'request-2')).publication!;
    assert.equal(second.version, 2); assert.ok(second.html.includes('Versão editada'));
    assert.equal((await publications.publish(input, 'request-2')).publication?.id, second.id);
    assert.equal((await publications.publish({ ...input, language: 'en' }, 'request-en')).publication?.version, 1);
    const page = await worker.fetch(new Request(first.url), fixture.env);
    assert.equal(page.status, 200); assert.equal(await page.text(), first.html);
    assert.ok(!/<script|data-image-slot|sidebar|toolbar/.test(first.html));
    for (const match of first.html.matchAll(/<img[^>]+src="([^"]+)"/g)) assert.equal((await worker.fetch(new Request(match[1]), fixture.env)).status, 200);
    await assert.rejects(assets.remove(asset.id), /Exclusão bloqueada/);
    assert.throws(() => fixture.db.exec('UPDATE publications SET html=\'changed\''), /publication_immutable/);
    assert.throws(() => fixture.db.exec('DELETE FROM publications'), /publication_immutable/);
    input.campaign.content.pt.heroImage = '';
    assert.equal((await publications.publish(input, 'invalid')).publication, null);
    assert.equal((await publications.list(input.campaign.id)).length, 3);
  } finally { fixture.close(); }
});
test('public worker rejects anonymous writes, wrong editor and cross-site mutations', async () => {
  const fixture = platformFixture();
  try {
    const url = `${fixture.env.SITE_ORIGIN}/api/assets`;
    assert.equal((await worker.fetch(new Request(url, { method: 'POST' }), fixture.env)).status, 401);
    assert.equal((await worker.fetch(new Request(url, { headers: { 'oai-authenticated-user-id': 'visitor', 'oai-authenticated-user-email': 'other@example.com' } }), fixture.env)).status, 403);
    assert.equal((await worker.fetch(new Request(url, { method: 'POST', headers: { 'oai-authenticated-user-id': 'editor', 'oai-authenticated-user-email': 'editor@example.com', origin: 'https://attacker.example.com' } }), fixture.env)).status, 403);
    assert.equal((await worker.fetch(new Request(`${fixture.env.SITE_ORIGIN}/assets/..%2fsecret`), fixture.env)).status, 404);
  } finally { fixture.close(); }
});
