import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign } from '../campaigns/model';
import { moveSectionTo } from '../blocks/model';
import { defaultBrand } from '../data/brand';
import { designChecks } from '../export/design-checks';
import { renderEmail } from '../export/render';
import { renderRichBody } from '../export/rich-body';
import { sanitizeRichText } from '../lib/safety';
import { decodeBackup, isCampaign } from '../lib/storage';
import { createTemplateSections, modernTemplateIds } from '../templates/blueprints';
import { templatePalettes } from '../templates/palettes';
import { templates } from '../templates/registry';
import { templateContent } from '../templates/starter';
import type { RichNode } from '../types/campaign';

test('nine registered templates include four distinct, editable section palettes', () => {
  assert.equal(templates.length, 9);
  assert.equal(new Set(modernTemplateIds.map(id => templatePalettes[id].primary)).size, 4);
  for (const id of modernTemplateIds) {
    const campaign = createCampaign({ template: id, content: templateContent(id, id) });
    assert.equal(campaign.campaignType, templates.find(template => template.id === id)?.campaignType);
    assert.ok(campaign.sections && campaign.sections.length >= 8);
    assert.ok(isCampaign(campaign));
    assert.equal(designChecks(campaign, 'pt').filter(check => check.message.includes('contraste potencialmente baixo')).length, 0, id);
    const original = templatePalettes[id].primary;
    campaign.sections[0].settings.background = { kind: 'solid', color: '#FFFFFF' };
    assert.equal(templatePalettes[id].primary, original);
    assert.notDeepEqual(campaign.sections, createTemplateSections(id));
    const restored = decodeBackup(JSON.stringify({ version: 2, campaigns: [campaign], brand: defaultBrand }));
    assert.deepEqual(restored.campaigns[0].sections, campaign.sections);
  }
});

test('new templates render real email HTML, editor-only section targets and the saved section order', async () => {
  for (const id of modernTemplateIds) {
    const campaign = createCampaign({ template: id, content: templateContent(id, id) });
    const initial = await renderEmail(campaign, 'pt', defaultBrand);
    const editor = await renderEmail(campaign, 'pt', defaultBrand, true);
    assert.match(initial, /class="email-container"/);
    assert.match(initial, /width="600"/);
    assert.doesNotMatch(initial, /data-section-id|Adicione uma fotografia do material|<script/i);
    assert.match(editor, /data-section-id=/);
    assert.match(editor, /Adicione uma fotografia do material/);
    const moved = moveSectionTo(campaign.sections!, 2, 0);
    assert.equal(moved[0].id, campaign.sections![2].id);
    const reordered = await renderEmail({ ...campaign, sections: moved }, 'pt', defaultBrand);
    assert.ok(reordered.indexOf(moved[0].content.pt.title) < reordered.indexOf(moved[1].content.pt.title));
  }
});

test('right alignment survives backup and reaches cells, images, buttons and rich paragraphs', async () => {
  const campaign = createCampaign({ template: 'catalog-color', content: templateContent('catalog-color', 'Amazonita') });
  const section = campaign.sections![0];
  section.settings.alignment = 'right';
  section.content.pt.image = 'https://example.com/stone.jpg';
  campaign.alignment = 'right';
  const restored = decodeBackup(JSON.stringify({ version: 2, campaigns: [campaign], brand: defaultBrand })).campaigns[0];
  assert.equal(restored.sections![0].settings.alignment, 'right');
  const html = await renderEmail(restored, 'pt', defaultBrand);
  assert.match(html, /<td align="right" style="padding:/);
  assert.match(html, /<table role="presentation" width="100%" align="right"/);
  assert.match(html, /<table role="presentation" align="right"/);
  for (const alignment of ['center', 'right'] as const) {
    const rich: RichNode = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: alignment }, content: [{ type: 'text', text: 'Texto alinhado' }] }] };
    assert.deepEqual(sanitizeRichText(rich).content?.[0].attrs, { textAlign: alignment });
    assert.match(await renderRichBody(rich), new RegExp(`text-align:${alignment}`));
  }
  const invalid: RichNode = { type: 'paragraph', attrs: { textAlign: 'justify' }, content: [] };
  assert.equal(sanitizeRichText(invalid).attrs, undefined);
});

test('the five original templates still use their legacy layouts', async () => {
  for (const template of templates.filter(template => template.visualCategory === 'essential')) {
    const campaign = createCampaign({ template: template.id, content: templateContent(template.id, template.name) });
    assert.equal(campaign.sections, undefined);
    assert.ok(isCampaign(campaign));
    assert.doesNotMatch(await renderEmail(campaign, 'pt', defaultBrand), /data-section-id/);
  }
});
