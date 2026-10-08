import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { utils, write } from 'xlsx';
import { normalizeRow, parseDate } from '../import/normalize';
import { parseWorkbook, exampleWorkbook } from '../import/xlsx';
import { changeTemplate, createCampaign, editCampaign, richText } from '../campaigns/model';
import { suggestTemplate, templates } from '../templates/registry';
import { renderEmail } from '../export/render';
import { defaultBrand } from '../data/brand';
import { exportIssues } from '../export/validate';
import { decodeBackup, isCampaign } from '../lib/storage';
import { sanitizeRichText } from '../lib/safety';
import { campaignFileName } from '../export/download';
import { campaignFingerprint } from '../campaigns/identity';
import { applyTranslation, translationItems } from '../lib/translation';
import { GRANISTONE_UNSUBSCRIBE_URL } from '../data/granistone.config';

test('normalizes Portuguese headings, dates, audience and bilingual planning', () => {
  const { campaign, warnings } = normalizeRow({
    'Data de disparo': '01/10/2026',
    TEMA: 'Crystal Palace',
    'Tipo de conteúdo': 'Produto',
    PÚBLICO: 'Arquiteto / Especificador',
    Idioma: 'PT / EN',
    CTA: 'Ver material',
  });
  assert.ok(campaign);
  assert.equal(campaign.template, 'product-architect');
  assert.equal(campaign.date, '2026-10-01');
  assert.equal(campaign.language, 'PT / EN');
  assert.equal(campaign.content.pt.cta, 'Ver material');
  assert.equal(campaign.content.en.headline, '');
  assert.equal(warnings.length, 0);
});
test('handles Excel serial dates and rejects impossible dates without silently rolling over', () => {
  assert.equal(parseDate(46296), '2026-10-01');
  assert.equal(parseDate('31/02/2026'), '');
  assert.equal(parseDate('2026-02-29'), '');
  assert.equal(parseDate('2028-02-29'), '2028-02-29');
});
test('parses a real XLSX with title rows, multiple sheets, skipped rows and warnings', () => {
  const wb = utils.book_new();
  utils.book_append_sheet(
    wb,
    utils.aoa_to_sheet([
      ['CRM Outubro 2026'],
      [],
      ['Tema', 'Data', 'Tipo', 'Público', 'Idioma'],
      ['Produto A', '02/10/2026', 'Produto', 'Marmorista', 'EN'],
      ['Sem data válida', '31/02/2026', 'Aviso', 'Clientes', 'PT'],
      ['', '', 'Produto'],
    ]),
    'CRM',
  );
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['Notas'], ['Somente referência']]), 'Notas');
  const result = parseWorkbook(write(wb, { type: 'array', bookType: 'xlsx' }));
  assert.equal(result.campaigns.length, 2);
  assert.equal(result.campaigns[0].template, 'product-commercial');
  assert.equal(result.campaigns[0].content.en.headline, 'Produto A');
  assert.equal(result.skipped, 1);
  assert.ok(result.warnings.some((w) => /data inválida/i.test(w)));
  assert.ok(result.warnings.some((w) => w.includes('Notas')));
  assert.equal(parseWorkbook(exampleWorkbook()).campaigns.length, 2);
});
test('template mapping, language isolation and stale approval reset', () => {
  assert.equal(suggestTemplate('Newsletter', ''), 'newsletter');
  assert.equal(suggestTemplate('Aviso', ''), 'notice');
  assert.equal(suggestTemplate('Promocional', ''), 'product-commercial');
  const c = createCampaign({ status: 'Exportado' });
  const edited = editCampaign(c, {
    content: { ...c.content, pt: { ...c.content.pt, headline: 'Novo título' } },
  });
  assert.equal(edited.status, 'Em produção');
  assert.equal(edited.content.en.headline, '');
  assert.equal(changeTemplate(edited, 'notice').blocks.length, 2);
});

test('Spanish translation preserves Portuguese, rich formatting, links and shared images', () => {
  const campaign = createCampaign();
  campaign.content.pt = { ...campaign.content.pt, headline: 'Pedra natural', cta: 'Conheça', ctaUrl: 'https://example.com', heroImage: 'https://example.com/a.jpg', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Uma história', marks: [{ type: 'bold' }] }] }] } };
  const translated = translationItems(campaign.content.pt).map((item) => ({ id: item.id, text: item.text === 'Pedra natural' ? 'Piedra natural' : item.text === 'Conheça' ? 'Descubra' : item.text === 'Uma história' ? 'Una historia' : item.text }));
  const spanish = applyTranslation(campaign.content.pt, campaign.content.es, { target: 'es', items: translated });
  assert.equal(campaign.content.pt.headline, 'Pedra natural');
  assert.equal(spanish.headline, 'Piedra natural');
  assert.equal(spanish.ctaUrl, campaign.content.pt.ctaUrl);
  assert.equal(spanish.heroImage, campaign.content.pt.heroImage);
  assert.deepEqual(spanish.body.content?.[0].content?.[0].marks, [{ type: 'bold' }]);
  assert.equal(spanish.body.content?.[0].content?.[0].text, 'Una historia');
});
test('import identity and export filenames stay stable across repeated runs', () => {
  const first = normalizeRow({
    Tema: 'Crystal Palace',
    Data: '01/10/2026',
    Tipo: 'Produto',
    Público: 'Arquitetos / Especificadores',
    Idioma: 'PT / EN',
  }).campaign!;
  const repeated = normalizeRow({
    Tema: '  CRYSTAL palace ',
    Data: '01/10/2026',
    Tipo: 'Produto',
    Público: 'Arquitetos / Especificadores',
    Idioma: 'PT / EN',
  }).campaign!;
  assert.equal(first.id, repeated.id);
  assert.equal(campaignFingerprint(first), campaignFingerprint(repeated));
  assert.equal(
    campaignFileName(first, 'pt'),
    'granistone-crystal-palace-arquitetos-especificadores-pt',
  );
});
test('all five templates render the same brand footer and escaped content with real Maily formatting', async () => {
  for (const t of templates.filter(template => template.visualCategory === 'essential')) {
    const c = createCampaign({ template: t.id });
    c.content.pt = {
      ...c.content.pt,
      subject: 'Teste <script>',
      headline: 'Pedra & arquitetura',
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Texto seguro', marks: [{ type: 'bold' }] }],
          },
        ],
      },
    };
    const html = await renderEmail(c, 'pt', defaultBrand);
    assert.ok(html.includes('Pedra &amp; arquitetura'));
    assert.ok(html.includes('Agradecemos pela sua'));
    assert.ok(html.includes('https://www.facebook.com/granistonearocha'));
    assert.ok(html.includes('https://www.instagram.com/granistonearocha/'));
    assert.ok(html.includes('https://wa.me/5585986221574'));
    assert.match(html, /<strong[^>]*>Texto seguro<\/strong>/);
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('<!--[if mso]>'));
    assert.ok(html.includes('role="presentation"'));
    assert.ok(html.includes(`data-template="${t.id}"`));
  }
});
test('unsafe URLs, arbitrary CSS and HTML nodes cannot pass to exported email', async () => {
  const c = createCampaign();
  c.content.pt.headline = '<img src=x onerror=alert(1)>';
  c.content.pt.cta = 'Clique';
  c.content.pt.ctaUrl = 'javascript:alert(1)';
  c.content.pt.body = {
    type: 'doc',
    content: [
      { type: 'htmlCodeBlock', content: [{ type: 'text', text: '<script>BAD</script>' }] },
      {
        type: 'paragraph',
        attrs: { style: 'color:red' },
        content: [
          {
            type: 'text',
            text: 'Boa',
            marks: [
              { type: 'textStyle', attrs: { color: 'red' } },
              { type: 'link', attrs: { href: 'javascript:bad' } },
            ],
          },
        ],
      },
    ],
  };
  const html = await renderEmail(c, 'pt', defaultBrand);
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('BAD'));
  assert.ok(!html.includes('color:red'));
  assert.equal(sanitizeRichText(c.content.pt.body).content?.[1].attrs, undefined);
});
test('export blocks local images and always renders the official unsubscribe link', async () => {
  const c = createCampaign();
  c.content.pt = {
    ...c.content.pt,
    subject: 'Assunto',
    headline: 'Título',
    body: richText('Texto'),
    cta: 'Conheça',
    ctaUrl: 'https://example.com',
    heroImage: 'data:image/png;base64,AAAA',
  };
  assert.ok(exportIssues(c, 'pt', defaultBrand).length >= 3);
  c.content.pt.heroImage = 'https://example.com/image.png';
  c.content.pt.heroAlt = 'Detalhe da pedra natural';
  const brand = {
    ...defaultBrand,
    assetBaseUrl: 'https://assets.example.com',
    facebook: 'https://facebook.com/example',
    instagram: 'https://instagram.com/example',
  };
  assert.equal(exportIssues(c, 'pt', brand).length, 0);
  assert.equal(defaultBrand.unsubscribeUrl, GRANISTONE_UNSUBSCRIBE_URL);
  assert.ok((await renderEmail(c, 'pt', brand)).includes('clickemailmkt.granistone.com.br/ls/click'));
});
test('JSON persistence round-trips complete campaigns and rejects corrupt backups', () => {
  const c = createCampaign();
  const legacyBrand = { ...defaultBrand, facebook: '', instagram: '', website: '', whatsapp: '' };
  const original = { version: 1, campaigns: [c], brand: legacyBrand };
  const migrated = decodeBackup(JSON.stringify(original));
  assert.equal(migrated.version, 2);
  assert.equal(migrated.brand.facebook, defaultBrand.facebook);
  assert.equal(migrated.brand.instagram, defaultBrand.instagram);
  assert.equal(isCampaign({ ...c, blocks: [] }), false);
  assert.throws(() => decodeBackup('{"version":2}'));
  assert.throws(() => decodeBackup(JSON.stringify({ ...original, campaigns: [c, c] })));
});

test('every template exposes its image slots only in the editor and uses its own layout', async () => {
  const { templateContent } = await import('../templates/starter');
  for (const template of templates.filter(template => template.visualCategory === 'essential')) {
    const campaign = createCampaign({ template: template.id, content: templateContent(template.id, 'Layout') });
    const editing = await renderEmail(campaign, 'pt', defaultBrand, true);
    const final = await renderEmail(campaign, 'pt', defaultBrand);
    assert.equal((editing.match(/data-image-slot="/g) || []).length, template.blocks.filter((block) => ['hero', 'application'].includes(block)).length);
    assert.ok(!final.includes('data-image-slot'));
    assert.ok(!final.includes('Clique para adicionar'));
    assert.ok(!final.includes('<script'));
    assert.ok(editing.includes('Computador ou link da web'));
    if (template.id === 'product-commercial') assert.ok(editing.includes('width="49%"'));
    if (template.id === 'product-architect') assert.ok(editing.includes('width="48%"'));
    if (template.id === 'newsletter') assert.ok(editing.indexOf('<h1') < editing.indexOf('data-image-slot="hero"'));
    if (template.id === 'institutional') assert.ok(editing.indexOf('data-image-slot="hero"') < editing.indexOf('<h1'));
  }
});
