import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeFolderPaths, folderForFile, childFolders } from '../lib/asset-folders';
import { AssetRepository } from '../server/assets';
import { platformFixture } from './platform-fixture';
import { online } from '../lib/online';
import { catalogMaterials, materialFolderPath, stoneFolders } from '../lib/catalog-materials';
import type { MediaAsset, OnlineMaterial } from '../types/online';

test('folder paths preserve accents and hierarchy and reject traversal or malformed input', () => {
  assert.deepEqual(normalizeFolderPaths([' Imagens Catálogo / Amazonita ', 'Imagens Catálogo/Amazonita', '']), ['Imagens Catálogo/Amazonita']);
  assert.deepEqual(folderForFile({ webkitRelativePath: 'Catálogo/Amazonita/foto.jpg' }, 'Acervo'), ['Acervo/Catálogo/Amazonita']);
  assert.deepEqual(folderForFile({ webkitRelativePath: '' }, 'Institucional'), ['Institucional']);
  for (const paths of [['../a'], ['a/../b'], ['a/./b'], ['a\u0000b'], ['x'.repeat(241)], 'folder', [3]]) assert.throws(() => normalizeFolderPaths(paths));
});

test('every stone folder becomes a material without duplicating saved materials', () => {
  const asset = (id: string, paths: string[]): MediaAsset => ({ id, name: id, fileName: `${id}.jpg`, mimeType: 'image/jpeg', width: 100, height: 100, fileSize: 100, url: `https://example.com/${id}`, category: 'material', orientation: 'square', alt: id, createdAt: '', updatedAt: '', folderPaths: paths });
  const assets = Array.from({ length: 21 }, (_, index) => asset(`photo-${index}`, [`Imagens Catálogo/Pedra ${index + 1}/Detalhes`]));
  assets.push(asset('extra', ['Imagens Catálogo/Pedra 2', 'Imagens Catálogo/Fotos institucionais']));
  assets.push(asset('unrelated', ['Eventos/Pedra 22']));
  const saved: OnlineMaterial = { id: 'saved-2', name: 'Pedra 2', slug: 'pedra-2', category: 'Quartzito', description: 'Detalhes cadastrados', features: [], applications: [], pageUrl: '', active: true, assetIds: [] };
  const folders = stoneFolders(assets);
  assert.equal(folders.length, 21);
  assert.equal(folders.find(folder => folder.name === 'Pedra 2')?.assetIds.length, 2);
  const catalog = catalogMaterials([saved], assets);
  assert.equal(catalog.length, 21);
  assert.equal(catalog.filter(item => item.material.name === 'Pedra 2').length, 1);
  const matched = catalog.find(item => item.material.name === 'Pedra 2')!;
  assert.equal(matched.folderOnly, false);
  assert.equal(matched.material.description, 'Detalhes cadastrados');
  assert.equal(matched.material.assetIds.length, 2);
  const automatic = catalog.find(item => item.material.name === 'Pedra 1')!;
  assert.equal(automatic.folderOnly, true);
  assert.equal(materialFolderPath(automatic.material.id), automatic.folder?.path);
});

test('shared folder memberships survive duplicate uploads, edits and reload without changing image bytes', async () => {
  const f = platformFixture(); const repo = new AssetRepository(f.env);
  try {
    const png = new Uint8Array(readFileSync('public/brand/granistone-logo.png'));
    const first = await repo.create(png, 'image/png', 'logo.png', { folderPaths: ['Catálogo/Amazonita'] });
    const second = await repo.create(png, 'image/png', 'repeat.png', { folderPaths: ['Catálogo/Amazonita', 'Catálogo/Institucional'] });
    assert.equal(second.id, first.id); assert.equal(f.objects.size, 1);
    assert.deepEqual(second.folderPaths, ['Catálogo/Amazonita', 'Catálogo/Institucional']);
    assert.deepEqual(childFolders(await repo.list(), ''), [{ path: 'Catálogo', name: 'Catálogo', count: 1 }]);
    assert.equal(childFolders(await repo.list(), 'Catálogo').length, 2);
    await assert.rejects(repo.update(first.id, { name: 'Must not persist', folderPaths: ['../bad'] }));
    assert.equal((await repo.get(first.id)).name, first.name);
    await repo.update(first.id, { folderPaths: ['Nova pasta'], alt: 'Logo' });
    assert.deepEqual((await new AssetRepository(f.env).get(first.id)).folderPaths, ['Nova pasta']);
    assert.equal((await repo.list())[0].alt, 'Logo');
    assert.equal(f.objects.size, 1);
    await repo.update(first.id, { folderPaths: [] });
    assert.deepEqual((await repo.list())[0].folderPaths, []);
  } finally { f.close(); }
});

test('catalog pagination returns all images beyond the former 100 image limit', async () => {
  const f = platformFixture(); const originalFetch = globalThis.fetch;
  try {
    for (let i = 0; i < 205; i++) {
      const id = String(i).padStart(64, '0');
      f.db.prepare('INSERT INTO assets (id,object_key,hash,metadata,category,name,created_at) VALUES (?,?,?,?,?,?,?)').run(id, id, id, JSON.stringify({ id, name: `Image ${i}` }), 'outro', `Image ${i}`, '2026-10-06');
    }
    const repo = new AssetRepository(f.env);
    const offsets: number[] = [];
    globalThis.fetch = async input => {
      const url = new URL(String(input), f.env.SITE_ORIGIN); const offset = Number(url.searchParams.get('offset'));
      offsets.push(offset);
      return Response.json(await repo.list('', '', offset));
    };
    const assets = await online.assets.list();
    assert.equal(assets.length, 205); assert.equal(new Set(assets.map(a => a.id)).size, 205);
    assert.deepEqual(offsets, [0, 100, 200]);
  } finally { globalThis.fetch = originalFetch; f.close(); }
});
