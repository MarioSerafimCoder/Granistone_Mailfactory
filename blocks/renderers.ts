import type { Section, SectionType } from '@/types/design';
import type { Language } from '@/types/campaign';
import { escapeHtml as e, safeUrl } from '@/lib/safety';
import { emailTokens as t } from '@/lib/tokens/email';
import { backgroundAttributes } from '@/export/background';
import { renderRichBody } from '@/export/rich-body';
type Renderer = (c: Record<string, string>, section: Section, richBody?: string) => string;
const text = (value = '') => value ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:inherit">${e(value).replace(/\n/g, '<br/>')}</p>` : '';
const title = (value = '') => value ? `<h2 style="font:normal 30px/1.2 ${t.typography.editorial};color:inherit;margin:0 0 20px">${e(value)}</h2>` : '';
const image = (src = '', alt = '') => safeUrl(src, true) ? `<img src="${e(safeUrl(src, true))}" alt="${e(alt)}" width="528" style="display:block;width:100%;max-width:528px;height:auto;border:0;margin:0 0 16px"/>` : '';
const link = (label = '', url = '', color = t.colors.text) => safeUrl(url) ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:16px 24px;border:1px solid ${color}"><a href="${e(safeUrl(url))}" style="font:16px Arial;color:${color};text-decoration:underline">${e(label)}</a></td></tr></table>` : '';
const columns = (a: string, b: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="stack-col" width="48%" valign="top">${a}</td><td class="stack-gap" width="24">&nbsp;</td><td class="stack-col" width="48%" valign="top">${b}</td></tr></table>`;
const copy: Renderer = (c, _s, richBody) => title(c.title) + (richBody ?? text(c.text));
const product: Renderer = (c, s) => image(c.image, c.alt) + copy(c, s) + link(c.label, c.link, s.settings.textColor);
export const sectionRenderers: Record<SectionType, Renderer> = {
  heroEditorial: (c, s) => image(c.image, c.alt) + copy(c, s),
  heroProduct: product,
  imageText: (c, s) => columns(image(c.image, c.alt), copy(c, s) + link(c.label, c.link, s.settings.textColor)),
  textImage: (c, s) => columns(copy(c, s) + link(c.label, c.link, s.settings.textColor), image(c.image, c.alt)),
  centeredText: copy, product,
  twoProducts: (c, s) => columns(product(c, s), product({ image: c.image2, alt: c.alt2, title: c.title2, text: c.text2, label: c.label2, link: c.link2 }, s)),
  gallery: c => columns(image(c.image, c.alt), image(c.image2, c.alt2)) + text(c.text),
  specifications: c => title(c.title) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${(c.text || '').split('\n').filter(Boolean).map(line => `<tr><td style="padding:12px;border-bottom:1px solid ${t.border};color:inherit">${e(line)}</td></tr>`).join('')}</table>`,
  applications: c => title(c.title) + `<ul style="padding-left:24px;line-height:1.7;color:inherit">${(c.text || '').split('\n').filter(Boolean).map(line => `<li>${e(line)}</li>`).join('')}</ul>`,
  quote: (c, s) => `<blockquote style="margin:0;padding:16px;border-left:3px solid ${s.settings.textColor}">${text(c.text)}${text(c.title)}</blockquote>`,
  cta: (c, s) => copy(c, s) + link(c.label, c.link, s.settings.textColor),
  divider: () => `<table role="presentation" width="100%"><tr><td height="1" style="border-top:1px solid ${t.border};font-size:1px;line-height:1px">&nbsp;</td></tr></table>`,
  spacer: (_c, s) => `<table role="presentation" width="100%"><tr><td height="${s.settings.height}" style="height:${s.settings.height}px;font-size:1px;line-height:1px">&nbsp;</td></tr></table>`,
  banner: (c, s) => image(c.image, c.alt) + link(c.label, c.link, s.settings.textColor),
  complementaryFooter: copy,
};
export async function renderSection(section: Section, language: Language, renderer: Renderer = sectionRenderers[section.type]): Promise<string> {
  if (!section.enabled) return '';
  const settings = section.settings;
  const richBody = section.richBody?.[language] ? await renderRichBody(section.richBody[language], settings.textColor) : undefined;
  return `<tr><td ${backgroundAttributes(settings.background)}><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:${settings.padding}px;text-align:${settings.alignment};font-family:${t.typography.body};color:${settings.textColor}">${renderer(section.content[language], section, richBody)}</td></tr></table></td></tr>`;
}
