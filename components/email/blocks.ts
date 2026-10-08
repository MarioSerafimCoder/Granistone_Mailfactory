import { emailTokens as t } from '@/lib/tokens/email';
import { escapeHtml as e, safeUrl } from '@/lib/safety';
import type { ContentAlignment, Language } from '@/types/campaign';
const { colors: c, typography: font, spacing: s } = t;
export function TextBlock(text: string) {
  return `<p style="margin:0 0 ${s.small}px;color:${c.text};font-family:${font.body};font-size:${font.bodySize}px;line-height:1.7">${e(text).replace(/\n/g, '<br/>')}</p>`;
}
export function Title(text: string) {
  return `<h2 style="margin:0 0 ${s.small}px;font-size:24px;line-height:1.3;font-family:${font.editorial};font-weight:400">${e(text)}</h2>`;
}
export function ImageBlock(src: string, alt: string) {
  const url = safeUrl(src, true);
  return url
    ? `<img src="${e(url)}" alt="${e(alt)}" width="${t.width - s.emailPadding * 2}" style="display:block;width:100%;max-width:${t.width - s.emailPadding * 2}px;height:auto;border:0"/>`
    : '';
}
export const ProductHero = ImageBlock;
export const EditorialHero = ImageBlock;
export const InstitutionalHero = ImageBlock;
export function StoneSpecs(name: string, features: string, applications: string, lang: Language) {
  const featuresLabel = lang === 'en' ? 'FEATURES' : 'CARACTERÍSTICAS';
  const applicationsLabel = lang === 'en' ? 'APPLICATIONS' : lang === 'es' ? 'APLICACIONES' : 'APLICAÇÕES';
  return `${name ? Title(name) : ''}${features ? `<h3 style="font-size:14px;margin:20px 0 8px">${featuresLabel}</h3>${TextBlock(features)}` : ''}${applications ? `<h3 style="font-size:14px;margin:20px 0 8px">${applicationsLabel}</h3>${TextBlock(applications)}` : ''}`;
}
export function ArticleBlock(title: string, text: string, url = '') {
  return `${title ? Title(title) : ''}${text ? TextBlock(text) : ''}${safeUrl(url) ? `<a href="${e(safeUrl(url))}" style="color:${c.text};font-size:14px">${e(title)} →</a>` : ''}`;
}
export function EditorialSection(
  label: string,
  title: string,
  text: string,
  url = '',
) {
  if (!title && !text) return '';
  return `${Divider()}<p style="margin:0 0 12px;color:${c.gray};font-family:${font.body};font-size:10px;letter-spacing:1.8px;text-transform:uppercase">${e(label)}</p>${ArticleBlock(title, text, url)}`;
}
export function AvailabilityPanel(text: string, lang: Language, align: ContentAlignment = 'left') {
  if (!text) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.lightGray}"><tr><td align="${align}" style="padding:24px;text-align:${align}"><p style="margin:0 0 8px;color:${c.gray};font-family:${font.body};font-size:10px;letter-spacing:1.5px">${lang === 'en' ? 'COMMERCIAL AVAILABILITY' : lang === 'es' ? 'DISPONIBILIDAD COMERCIAL' : 'DISPONIBILIDADE COMERCIAL'}</p>${TextBlock(text)}</td></tr></table>`;
}
export function CommercialSpecs(name: string, features: string, applications: string, lang: Language, align: ContentAlignment = 'left') {
  if (!name && !features && !applications) return '';
  const cell = (label: string, value: string) =>
    `<td width="50%" valign="top" align="${align}" style="padding:18px;border:1px solid ${t.border};text-align:${align}"><p style="margin:0 0 8px;color:${c.gray};font-family:${font.body};font-size:10px;letter-spacing:1.3px">${e(label)}</p>${TextBlock(value)}</td>`;
  return `${name ? `<p style="margin:0 0 18px;font-family:${font.editorial};font-size:26px">${e(name)}</p>` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cell(lang === 'en' ? 'FEATURES' : lang === 'es' ? 'DIFERENCIALES' : 'DIFERENCIAIS', features)}${cell(lang === 'en' ? 'APPLICATIONS' : lang === 'es' ? 'APLICACIONES' : 'APLICAÇÕES', applications)}</tr></table>`;
}
export function NoticeBody(html: string, align: ContentAlignment = 'center') {
  if (!html) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.lightGray}"><tr><td align="${align}" style="padding:28px 32px;text-align:${align}">${html}</td></tr></table>`;
}
export function CTA(label: string, url: string, subtle: boolean, align: ContentAlignment = 'left') {
  if (!label || !safeUrl(url)) return '';
  return `<table role="presentation" align="${align}" border="0" cellpadding="0" cellspacing="0"><tr><td bgcolor="${subtle ? c.white : c.black}" align="center" style="border:1px solid ${c.black};text-align:center"><a href="${e(safeUrl(url))}" target="_blank" style="display:inline-block;padding:16px 28px;border:1px solid ${subtle ? c.white : c.black};font-family:${font.body};font-size:14px;color:${subtle ? c.black : c.white};text-decoration:none;mso-padding-alt:0"><!--[if mso]><i style="mso-font-width:200%;mso-text-raise:24pt" hidden>&emsp;</i><![endif]--><span style="mso-text-raise:12pt">${e(label)}</span><!--[if mso]><i style="mso-font-width:200%" hidden>&emsp;&#8203;</i><![endif]--></a></td></tr></table>`;
}
export function Divider() {
  return `<hr style="border:0;border-top:1px solid ${c.lightGray};margin:${s.section}px 0"/>`;
}
export function Spacer() {
  return `<div style="height:${s.section}px;line-height:${s.section}px">&#8202;</div>`;
}
export function QuoteBlock(text: string) {
  return `<blockquote style="margin:${s.section}px 0;padding-left:${s.section}px;border-left:2px solid ${c.black}">${TextBlock(text)}</blockquote>`;
}
