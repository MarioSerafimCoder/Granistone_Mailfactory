import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, editCampaign, plainText, richText } from '../campaigns/model';
import { createSection, sectionsValid } from '../blocks/registry';
import { duplicateSection, moveSection, moveSectionTo } from '../blocks/model';
import { fieldDocument, historyOf, mergeCampaignPatch, rebaseHostedImages, recordHistory, stepHistory, updateLegacyText, updateSectionText } from '../lib/canvas-model';
import { decodeBackup, isCampaign } from '../lib/storage';
import { defaultBrand } from '../data/brand';
import { renderEmail } from '../export/render';
import { publicationSignature } from '../lib/publication-signature';
import { applySectionTranslation, sectionTranslationItems } from '../lib/translation';

test('inline updates keep IDs, languages, rich marks, and backups intact', () => {
  const source = createSection('twoProducts');
  source.content.en.title = 'English';
  const value = richText('Pedra natural'); value.content![0].content![0].marks = [{ type: 'bold' }];
  const next = updateSectionText(source, 'pt', 'title', value);
  assert.equal(next.id, source.id); assert.equal(next.content.en.title, 'English');
  assert.equal(next.content.pt.title, 'Pedra natural'); assert.ok(sectionsValid([next]));
  assert.deepEqual(fieldDocument(next.content.pt.title, next.richFields?.pt?.title), value);
  assert.deepEqual(fieldDocument('Changed by an older editor', value), richText('Changed by an older editor'));
  const c = createCampaign({ sections: [next] });
  assert.deepEqual(decodeBackup(JSON.stringify({ version: 2, campaigns: [c], brand: defaultBrand })).campaigns[0].sections, [next]);
  assert.equal(sectionsValid([{ ...next, richFields: { pt: { image: value } } }]), false);
});
test('history groups continuous typing, restores deletions, bounds memory and clears redo on branching', () => {
  let h = historyOf('initial'); h = recordHistory(h, 'a', 'text', 1000); h = recordHistory(h, 'ab', 'text', 1100);
  assert.deepEqual(h.past, ['initial']); h = recordHistory(h, 'moved', undefined, 1200);
  h = stepHistory(h); assert.equal(h.present, 'ab'); h = stepHistory(h); assert.equal(h.present, 'initial');
  h = stepHistory(h, true); assert.equal(h.present, 'ab'); h = recordHistory(h, 'new'); assert.equal(h.future.length, 0);
  for (let i = 0; i < 100; i++) h = recordHistory(h, String(i)); assert.equal(h.past.length, 80);
});
test('moving and duplication preserve the complete section and independent rich fields', () => {
  const a = updateSectionText(createSection('centeredText'), 'es', 'title', richText('Español'));
  const b = createSection('cta'), copy = duplicateSection(a);
  assert.notEqual(copy.id, a.id); copy.content.es.title = 'Other'; assert.equal(a.content.es.title, 'Español');
  const moved = moveSectionTo([a, b], 0, 1); assert.strictEqual(moved[1], a);
  assert.deepEqual(stepHistory(recordHistory(historyOf([a, b]), [b])).present, [a, b]);
});
test('rich title rendering is safe, does not format URLs, preserves legacy markup and invalidates only its language', async () => {
  const c = createCampaign(); c.content.pt.headline = 'Granito'; c.content.en.headline = 'Granite';
  const baseline = await renderEmail(c, 'pt', defaultBrand);
  const value = richText('Granito'); value.content![0].content![0].marks = [{ type: 'bold' }, { type: 'link', attrs: { href: 'javascript:alert(1)' } }];
  const next = editCampaign(c, updateLegacyText(c, 'pt', 'headline', value), 'pt');
  const html = await renderEmail(next, 'pt', defaultBrand);
  assert.match(html, /<strong>Granito<\/strong>/); assert.doesNotMatch(html, /javascript:|GRANISTONE_RICH_|contenteditable|data-canvas|canvas-bubble/);
  assert.equal(await renderEmail(next, 'en', defaultBrand), await renderEmail(c, 'en', defaultBrand));
  assert.equal(await renderEmail(c, 'pt', defaultBrand), baseline); assert.ok(isCampaign(next));
  assert.equal(isCampaign({ ...next, richFields: { pt: { heroImage: value } } }), false);
});
test('all block formats export marks and preserve multiline data without editor controls', async () => {
  for (const type of ['heroEditorial', 'twoProducts', 'gallery', 'quote', 'cta', 'specifications', 'applications'] as const) {
    let section = createSection(type);
    const field = type === 'gallery' ? 'text' : 'title';
    const value = richText('Natural'); value.content![0].content![0].marks = [{ type: 'italic' }];
    section = updateSectionText(section, 'pt', field, value);
    const html = await renderEmail(createCampaign({ sections: [section] }), 'pt', defaultBrand);
    assert.match(html, /<em>Natural<\/em>/); assert.doesNotMatch(html, /data-section-id|GRANISTONE_RICH_|contenteditable/);
  }
  assert.equal(plainText({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }, { type: 'hardBreak' }, { type: 'text', text: 'two' }] }] }), 'one\ntwo');
});

test('formatting invalidates only the corresponding publication and translation keeps rich titles', () => {
  const c = createCampaign({ sections: [createSection('centeredText')] });
  const doc = richText('Pedra'); doc.content![0].content![0].marks = [{ type: 'bold' }];
  const next = { ...c, sections: [updateSectionText(c.sections![0], 'pt', 'title', doc)] };
  const signature = (campaign: typeof c, language: 'pt' | 'en') => publicationSignature({ campaign, language, brand: defaultBrand });
  assert.notEqual(signature(c, 'pt'), signature(next, 'pt')); assert.equal(signature(c, 'en'), signature(next, 'en'));
  const translated = applySectionTranslation(next, 'es', { target: 'es', items: sectionTranslationItems(next, 'pt').map(item => ({ ...item, text: 'Piedra' })) }, true)!;
  assert.equal(translated[0].content.es.title, 'Piedra'); assert.deepEqual(translated[0].richFields?.es?.title.content?.[0].content?.[0].marks, [{ type: 'bold' }]);
  assert.equal(translated[0].content.pt.title, 'Pedra');
});

test('image hosting acknowledgements preserve undo while unrelated remote changes invalidate it', () => {
  const before = createCampaign(), local = structuredClone(before);
  local.content.pt.heroImage = 'data:image/png;base64,AAAA';
  const hosted = structuredClone(local); hosted.content.pt.heroImage = 'https://example.com/image.png';
  const h = recordHistory(historyOf(before), local);
  const rebased = rebaseHostedImages(h, local, hosted)!;
  assert.equal(stepHistory(rebased).present.content.pt.heroImage, '');
  assert.equal(stepHistory(stepHistory(rebased), true).present.content.pt.heroImage, 'https://example.com/image.png');
  hosted.content.pt.headline = 'Remote edit'; assert.equal(rebaseHostedImages(h, local, hosted), undefined);
});

test('image completion and ALT typing in one render batch never overwrite each other', () => {
  const base = createCampaign({ sections: [createSection('heroEditorial'), createSection('cta')] });
  const image = structuredClone(base); image.content.pt.heroImage = 'https://example.com/new.png'; image.sections![0].content.pt.image = 'https://example.com/new.png';
  const alt = structuredClone(base); alt.content.pt.heroAlt = 'Nova foto'; alt.sections![0].content.pt.alt = 'Nova foto';
  const patch = mergeCampaignPatch(base, image, { content: alt.content, sections: alt.sections });
  assert.equal(patch.content!.pt.heroImage, image.content.pt.heroImage); assert.equal(patch.content!.pt.heroAlt, 'Nova foto');
  assert.equal(patch.sections![0].content.pt.image, image.sections![0].content.pt.image); assert.equal(patch.sections![0].content.pt.alt, 'Nova foto');
  const moved = { ...image, sections: [...image.sections!].reverse() };
  const lateAlt = mergeCampaignPatch(base, moved, { sections: alt.sections });
  assert.equal(lateAlt.sections![0].id, moved.sections[0].id); assert.equal(lateAlt.sections![1].content.pt.alt, 'Nova foto');
});

test('batched block insertions, removals and reorders preserve unrelated edits', () => {
  const a = createSection('centeredText'), b = createSection('cta'), c = createSection('divider'), d = createSection('spacer');
  const base = createCampaign({ sections: [a, b] });
  const inserted = { ...base, sections: [a, b, c] };
  const merged = mergeCampaignPatch(base, inserted, { sections: [a, b, d] }).sections!;
  assert.deepEqual(new Set(merged.map(s => s.id)), new Set([a.id, b.id, c.id, d.id]));
  const removed = mergeCampaignPatch(base, inserted, { sections: [b] }).sections!;
  assert.deepEqual(removed.map(s => s.id), [b.id, c.id]);
  const reordered = mergeCampaignPatch(base, { ...base, sections: [b] }, { sections: [b, a] }).sections!;
  assert.deepEqual(reordered.map(s => s.id), [b.id]);
  assert.ok(sectionsValid(merged));
});

test('invalid move indexes leave the block list intact', () => {
  const sections = [createSection('cta'), createSection('divider')];
  for (const index of [-1, 2, NaN, 0.5]) {
    assert.strictEqual(moveSection(sections, index, 1), sections);
    assert.strictEqual(moveSectionTo(sections, index, 0), sections);
    assert.strictEqual(moveSectionTo(sections, 0, index), sections);
  }
});
