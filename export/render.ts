import { renderAsync } from '@react-email/render';
import { createElement, Fragment } from 'react';
import { Maily } from '@maily-to/render';
import type { BrandSettings, Campaign, Language } from '@/types/campaign';
import { emailTokens as t } from '@/lib/tokens/email';
import { escapeHtml as e, sanitizeRichText, safeUrl } from '@/lib/safety';
import { GranistoneFooter, GranistoneHeader } from '@/components/email/brand';
import { AvailabilityPanel, CommercialSpecs, CTA, EditorialSection, NoticeBody, StoneSpecs, TextBlock } from '@/components/email/blocks';

export async function renderEmail(campaign: Campaign, language: Language, brand: BrandSettings, editor = false): Promise<string> {
  const c = campaign.content[language];
  const en = language === 'en';
  const has = (id: string) => campaign.blocks.some((block) => block.id === id && block.enabled);
  const renderer = new Maily(sanitizeRichText(c.body));
  renderer.setTheme({ colors: { paragraph: t.colors.text }, fontSize: { paragraph: `${t.body}px` } });
  const body = (await renderAsync(createElement(Fragment, null, ...renderer.children()))).replace(/<!DOCTYPE[^>]*>/gi, '');
  const row = (html: string, full = false) => html ? `<tr><td class="${full ? '' : 'email-pad'}" style="padding:0 ${full ? 0 : t.sectionPaddingDesktop}px 32px;text-align:${campaign.alignment};font-family:${t.typography.body}">${html}</td></tr>` : '';
  const columns = (left: string, right: string, width = 50) => {
    if (!left) return right;
    if (!right) return left;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="stack-col" width="${width}%" valign="top" style="width:${width}%;vertical-align:top">${left}</td><td class="stack-gap" width="24" style="width:24px">&nbsp;</td><td class="stack-col" valign="top" style="vertical-align:top">${right}</td></tr></table>`;
  };
  function photo(slot: 'hero' | 'application', width: number, height: number, label: string) {
    if (!has(slot)) return '';
    const src = safeUrl(slot === 'hero' ? c.heroImage : c.applicationImage, true);
    const alt = slot === 'hero' ? c.heroAlt : c.applicationAlt;
    const img = src ? `<img src="${e(src)}" alt="${e(alt)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0"/>` : '';
    if (!editor) return img;
    const content = img || `<span style="display:table;width:100%;height:${height}px;background:#efeeeb"><span style="display:table-cell;vertical-align:middle;text-align:center;padding:18px;color:#77746d;font-family:Arial,sans-serif"><span style="display:block;font-size:30px;font-weight:300;margin-bottom:12px">＋</span><strong style="display:block;font-size:13px;font-weight:500">${e(label)}</strong><span style="display:block;font-size:10px;margin-top:8px;line-height:1.6">Clique para adicionar<br/>Computador ou link da web</span></span></span>`;
    return `<div role="button" tabindex="0" data-image-slot="${slot}" aria-label="${src ? 'Trocar' : 'Adicionar'} ${e(label.toLowerCase())}" style="cursor:pointer;outline:1px dashed #b8b5ad;outline-offset:-1px;position:relative">${content}${src ? '<span style="position:absolute;right:8px;bottom:8px;background:#ffffffed;color:#111;padding:7px 10px;font:11px Arial">Trocar imagem ↗</span>' : ''}</div>`;
  }
  const heading = (align = campaign.alignment, compact = false) => `<div style="text-align:${align}">${c.kicker ? `<p style="font-size:10px;letter-spacing:2px;line-height:1.5;color:${t.colors.gray};margin:0 0 18px">${e(c.kicker)}</p>` : ''}${campaign.template === 'product-architect' && c.materialName ? `<p style="font-family:${t.typography.editorial};font-size:22px;margin:0 0 16px">${e(c.materialName)}</p>` : ''}<h1 style="font-family:${t.typography.editorial};font-size:${compact ? t.headingL : t.headingXL}px;line-height:1.12;font-weight:400;margin:0 0 20px">${e(c.headline || (editor ? 'Seu título começa aqui' : '')).replace(/\n/g, '<br/>')}</h1>${c.subheadline ? TextBlock(c.subheadline) : ''}</div>`;
  const button = has('cta') ? CTA(c.cta, c.ctaUrl, ['institutional', 'product-architect'].includes(campaign.template)) : '';
  let visible = '';
  switch (campaign.template) {
    case 'institutional':
      visible = row(photo('hero', 600, 300, 'Capa editorial'), true) + row(heading('center')) + row(has('body') ? body : '') + row(button);
      break;
    case 'product-architect':
      visible = row(photo('hero', 528, 310, 'Foto do material')) + row(heading()) + row(has('body') ? body : '') + row(columns(photo('application', 250, 330, 'Foto de aplicação'), has('specs') ? StoneSpecs('', c.features, c.applications, en) : '', 48)) + row(button);
      break;
    case 'product-commercial':
      visible = row(columns(photo('hero', 260, 340, 'Foto do produto'), heading('left', true) + (has('body') ? body : '') + button, 49)) + row(has('specs') ? CommercialSpecs(c.materialName, c.features, c.applications, en) : '') + row(has('availability') ? AvailabilityPanel(c.availability, en) : '');
      break;
    case 'newsletter': {
      const modules: Record<string, string> = {
        hero: photo('hero', 528, 220, 'Capa da edição'),
        body: body,
        application: photo('application', 250, 210, 'Foto de destaque'),
        article: EditorialSection(en ? 'Reading' : 'Leitura', c.articleTitle, c.articleText, c.articleUrl),
        specs: StoneSpecs(c.materialName, c.features, c.applications, en),
        event: EditorialSection('Agenda', c.eventTitle, c.eventText),
        project: EditorialSection(en ? 'Project' : 'Projeto', c.projectTitle, c.projectText),
        cta: button,
      };
      visible = row(heading('left'));
      const enabled = campaign.blocks.filter((block) => block.enabled);
      for (let i = 0; i < enabled.length; i++) {
        const current = enabled[i].id;
        const next = enabled[i + 1]?.id;
        if (current === 'application' && next === 'article') {
          visible += row(columns(modules.application, modules.article, 48)); i++;
        } else if (current === 'event' && next === 'project') {
          visible += row(columns(modules.event, modules.project)); i++;
        } else visible += row(modules[current]);
      }
      break;
    }
    case 'notice':
      visible = row(heading('center', true)) + row(photo('hero', 528, 140, 'Faixa do comunicado')) + row(has('body') ? NoticeBody(body) : '');
      break;
  }
  return `<!DOCTYPE html><html lang="${en ? 'en' : 'pt-BR'}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="x-apple-disable-message-reformatting"/><meta name="color-scheme" content="light"/><title>${e(c.subject || campaign.title)}</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--><style>body{margin:0;padding:0}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;outline:none}a{color:${t.colors.text}}${editor ? '[data-image-slot]:hover,[data-image-slot]:focus{outline:2px solid #a8202b!important}' : ''}@media only screen and (max-width:599px){.email-container{width:100%!important}.email-pad{padding-left:24px!important;padding-right:24px!important}.stack-col{display:block!important;width:100%!important}.stack-col img{max-width:100%!important}.stack-gap{display:block!important;width:100%!important;height:24px!important}h1{font-size:30px!important}}</style></head><body style="margin:0;padding:0;background:${t.pageBackground};color:${t.colors.text};font-family:${t.typography.body}"><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${e(c.preheader)}${'&#847; &zwnj; '.repeat(35)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${t.pageBackground}"><tr><td align="center"><!--[if mso]><table role="presentation" width="${t.width}" align="center"><tr><td><![endif]--><table role="presentation" class="email-container" data-template="${campaign.template}" width="${t.width}" cellspacing="0" cellpadding="0" border="0" bgcolor="${t.contentBackground}" style="width:100%;max-width:${t.width}px;margin:0 auto">${GranistoneHeader(brand)}${visible}${GranistoneFooter(brand, language)}</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
