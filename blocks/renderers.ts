import type { Section, SectionType } from '@/types/design';
import type { ContentAlignment, Language } from '@/types/campaign';
import { escapeHtml as e, safeUrl } from '@/lib/safety';
import { emailTokens as t } from '@/lib/tokens/email';
import { backgroundAttributes } from '@/export/background';
import { renderRichBody } from '@/export/rich-body';

type Renderer = (c: Record<string, string>, section: Section, richBody?: string, editor?: boolean) => string;
const text = (value = '') => value ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:inherit">${e(value).replace(/\n/g, '<br/>')}</p>` : '';
const title = (value = '') => value ? `<h2 style="font:normal 30px/1.2 ${t.typography.editorial};color:inherit;margin:0 0 20px">${e(value)}</h2>` : '';
const image = (src = '', alt = '', align: ContentAlignment = 'left', editor = false) => {
  const imageUrl = safeUrl(src, true);
  if (!imageUrl && !editor) return '';
  const content = imageUrl
    ? `<img src="${e(imageUrl)}" alt="${e(alt)}" width="528" style="display:block;width:100%;max-width:528px;height:auto;border:0"/>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" height="180" style="height:180px;background:${t.pageBackground};color:${t.colors.gray};font:13px Arial,sans-serif">Adicione uma fotografia do material</td></tr></table>`;
  return `<table role="presentation" width="100%" align="${align}" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px"><tr><td align="${align}">${content}</td></tr></table>`;
};
const link = (label = '', url = '', color = t.colors.text, align: ContentAlignment = 'left') => safeUrl(url) && label
  ? `<table role="presentation" align="${align}" cellpadding="0" cellspacing="0" border="0"><tr><td align="${align}" style="padding:16px 24px;border:1px solid ${color}"><a href="${e(safeUrl(url))}" style="font:16px Arial;color:${color};text-decoration:underline">${e(label)}</a></td></tr></table>` : '';
const columns = (a: string, b: string, align: ContentAlignment) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="stack-col" width="48%" align="${align}" valign="top">${a}</td><td class="stack-gap" width="24">&nbsp;</td><td class="stack-col" width="48%" align="${align}" valign="top">${b}</td></tr></table>`;
const copy: Renderer = (c, _s, richBody) => title(c.title) + (richBody ?? text(c.text));
const product: Renderer = (c, s, richBody, editor) => image(c.image, c.alt, s.settings.alignment, editor) + copy(c, s, richBody) + link(c.label, c.link, s.settings.textColor, s.settings.alignment);
export const sectionRenderers: Record<SectionType, Renderer> = {
  heroEditorial: (c, s, richBody, editor) => image(c.image, c.alt, s.settings.alignment, editor) + copy(c, s, richBody),
  heroProduct: product,
  imageText: (c, s, richBody, editor) => columns(image(c.image, c.alt, s.settings.alignment, editor), copy(c, s, richBody) + link(c.label, c.link, s.settings.textColor, s.settings.alignment), s.settings.alignment),
  textImage: (c, s, richBody, editor) => columns(copy(c, s, richBody) + link(c.label, c.link, s.settings.textColor, s.settings.alignment), image(c.image, c.alt, s.settings.alignment, editor), s.settings.alignment),
  centeredText: copy, product,
  twoProducts: (c, s, _richBody, editor) => columns(product(c, s, undefined, editor), product({ image: c.image2, alt: c.alt2, title: c.title2, text: c.text2, label: c.label2, link: c.link2 }, s, undefined, editor), s.settings.alignment),
  gallery: (c, s, _richBody, editor) => columns(image(c.image, c.alt, s.settings.alignment, editor), image(c.image2, c.alt2, s.settings.alignment, editor), s.settings.alignment) + text(c.text),
  specifications: (c, s) => title(c.title) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${(c.text || '').split('\n').filter(Boolean).map(line => `<tr><td align="${s.settings.alignment}" style="padding:12px;border-bottom:1px solid ${t.border};color:inherit;text-align:${s.settings.alignment}">${e(line)}</td></tr>`).join('')}</table>`,
  applications: (c, s) => title(c.title) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${(c.text || '').split('\n').filter(Boolean).map(line => `<tr><td align="${s.settings.alignment}" style="padding:5px 0;color:inherit;text-align:${s.settings.alignment}">• ${e(line)}</td></tr>`).join('')}</table>`,
  quote: (c, s) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="${s.settings.alignment}" style="padding:16px;border-left:3px solid ${s.settings.textColor};text-align:${s.settings.alignment}">${text(c.text)}${text(c.title)}</td></tr></table>`,
  cta: (c, s, richBody) => copy(c, s, richBody) + link(c.label, c.link, s.settings.textColor, s.settings.alignment),
  divider: () => `<table role="presentation" width="100%"><tr><td height="1" style="border-top:1px solid ${t.border};font-size:1px;line-height:1px">&nbsp;</td></tr></table>`,
  spacer: (_c, s) => `<table role="presentation" width="100%"><tr><td height="${s.settings.height}" style="height:${s.settings.height}px;font-size:1px;line-height:1px">&nbsp;</td></tr></table>`,
  banner: (c, s, _richBody, editor) => image(c.image, c.alt, s.settings.alignment, editor) + link(c.label, c.link, s.settings.textColor, s.settings.alignment),
  complementaryFooter: copy,
};

export async function renderSection(section: Section, language: Language, renderer: Renderer = sectionRenderers[section.type], editor = false): Promise<string> {
  if (!section.enabled) return '';
  const settings = section.settings;
  const richBody = section.richBody?.[language] ? await renderRichBody(section.richBody[language], settings.textColor) : undefined;
  const marker = editor ? ` data-section-id="${e(section.id)}" title="Clique para editar este bloco" tabindex="0"` : '';
  return `<tr${marker}><td ${backgroundAttributes(settings.background)}><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="${settings.alignment}" style="padding:${settings.padding}px;text-align:${settings.alignment};font-family:${t.typography.body};color:${settings.textColor}">${renderer(section.content[language], section, richBody, editor)}</td></tr></table></td></tr>`;
}
