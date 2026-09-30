import type { BrandSettings, Campaign, Language } from '@/types/campaign';
import type { PreflightCheck, PreflightResult } from '@/types/online';
import { publicHttpsUrl as isPublicUrl } from '@/lib/public-url';
import { assetUrl } from '@/components/email/brand';
import { plainText } from '@/campaigns/model';
export const preflightLimits = { subject: 60, preheader: 140, htmlBytes: 102_400, imageBytes: 500_000 };
export function result(checks: PreflightCheck[]): PreflightResult {
  return { checks, hasErrors: checks.some(c => c.severity === 'error'), warnings: checks.filter(c => c.severity === 'warning') };
}
export function contentChecks(c: Campaign, lang: Language, brand: BrandSettings): PreflightCheck[] {
  const v = c.content[lang]; const checks: PreflightCheck[] = [];
  const add = (id: string, category: PreflightCheck['category'], severity: PreflightCheck['severity'], message: string) => checks.push({ id, category, severity, message });
  add('subject', 'content', !v.subject.trim() ? 'error' : v.subject.length > preflightLimits.subject ? 'warning' : 'pass', !v.subject.trim() ? 'Preencha o assunto.' : `Assunto: ${v.subject.length} caracteres (recomendado até ${preflightLimits.subject}).`);
  add('preheader', 'content', !v.preheader.trim() || v.preheader.length > preflightLimits.preheader ? 'warning' : 'pass', `Preheader: ${v.preheader.length} caracteres (recomendado entre 1 e ${preflightLimits.preheader}).`);
  add('headline', 'content', v.headline.trim() ? 'pass' : 'error', v.headline.trim() ? 'Título preenchido.' : 'Preencha o título neste idioma.');
  for (const slot of c.blocks.filter(b => b.enabled)) {
    if (slot.id === 'hero' || slot.id === 'application') {
      const src = slot.id === 'hero' ? v.heroImage : v.applicationImage;
      const alt = slot.id === 'hero' ? v.heroAlt : v.applicationAlt;
      const label = slot.id === 'hero' ? 'imagem principal' : 'imagem de aplicação';
      add(`${slot.id}.src`, 'images', isPublicUrl(src) ? 'pass' : 'error', isPublicUrl(src) ? `${label}: endereço público HTTPS.` : `A ${label} precisa de uma URL HTTPS pública; o slot está habilitado.`);
      add(`${slot.id}.alt`, 'images', alt.trim() ? 'pass' : 'error', alt.trim() ? `${label}: descrição preenchida.` : `Preencha o texto alternativo da ${label}.`);
    }
    if (slot.id === 'body') add('body', 'content', plainText(v.body).trim() ? 'pass' : 'error', plainText(v.body).trim() ? 'Texto editorial preenchido.' : 'Preencha o texto editorial ou desative esse bloco.');
    if (slot.id === 'cta') add('cta', 'links', v.cta.trim() && isPublicUrl(v.ctaUrl) ? 'pass' : 'error', v.cta.trim() && isPublicUrl(v.ctaUrl) ? 'CTA válido.' : 'Preencha o texto e um link HTTPS público do CTA ou desative o bloco.');
    if (slot.id === 'article' && v.articleUrl) add('article', 'links', isPublicUrl(v.articleUrl) ? 'pass' : 'error', isPublicUrl(v.articleUrl) ? 'Link editorial válido.' : 'O link do artigo é inválido.');
  }
  for (const [id, url] of [['logo', brand.logoUrl || assetUrl(brand, 'granistone-logo.png')], ['marca', brand.assetBaseUrl]])
    add(id, 'images', isPublicUrl(url) ? 'pass' : 'error', isPublicUrl(url) ? `${id}: URL válida.` : `Configure uma URL HTTPS pública para ${id} em Marca e rodapé.`);
  for (const [id, url] of [['Facebook', brand.facebook], ['Instagram', brand.instagram], ['Site', brand.website], ['WhatsApp', brand.whatsapp]])
    add(id, 'links', isPublicUrl(url) ? 'pass' : 'error', isPublicUrl(url) ? `${id}: link válido.` : `Configure um link válido para ${id} no rodapé.`);
  if (brand.unsubscribeMode === 'rd-managed')
    add('unsubscribe', 'compatibility', brand.unsubscribeUrl ? 'error' : 'warning', brand.unsubscribeUrl ? 'Apague o link manual ao usar descadastro gerenciado pelo RD Station.' : 'O RD Station deverá inserir seu próprio descadastro; homologar com um disparo real.');
  else add('unsubscribe', 'links', isPublicUrl(brand.unsubscribeUrl) ? 'pass' : 'error', isPublicUrl(brand.unsubscribeUrl) ? 'Link de descadastro configurado.' : 'Configure o link real de descadastro ou selecione o gerenciamento pelo RD Station.');
  return checks;
}
export function htmlChecks(html: string): PreflightCheck[] {
  const checks: PreflightCheck[] = [];
  const add = (id: string, bad: boolean, message: string) => checks.push({ id, category: 'compatibility', severity: bad ? 'error' : 'pass', message } as PreflightCheck);
  add('html.active', /<(script|iframe|object|embed|form|input|link)\b|\son[a-z]+\s*=|javascript\s*:|vbscript\s*:|data-image-slot|contenteditable|srcdoc\s*=/i.test(html), 'HTML sem scripts, eventos, formulários ou controles do editor.');
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  add('html.images', images.some(tag => !isPublicUrl(tag.match(/\bsrc="([^"]*)"/i)?.[1]?.replace(/&amp;/g, '&') || '')), 'Todas as imagens precisam usar HTTPS público absoluto.');
  add('html.alt', images.some(tag => !tag.match(/\balt="([^"]+)"/i)?.[1].trim()), 'Todas as imagens precisam de ALT.');
  add('html.urls', [...html.matchAll(/\b(?:href|background|src)="([^"]*)"/gi)].some(m => !/^(mailto:|tel:)/i.test(m[1]) && !isPublicUrl(m[1].replace(/&amp;/g, '&'))), 'Links e recursos do HTML devem ser públicos.');
  add('html.css', /url\s*\(|@import|expression\s*\(/i.test(html), 'O HTML não pode conter recursos CSS externos ou código ativo.');
  add('html.viewport', !/<meta[^>]+name="viewport"/i.test(html), 'Viewport responsivo presente.');
  add('html.structure', !/role="presentation"/.test(html) || !/class="email-container"/.test(html) || !/width="600"/.test(html), 'Estrutura principal de e-mail com largura de 600 px.');
  const size = new TextEncoder().encode(html).length;
  checks.push({ id: 'html.size', category: 'compatibility', severity: size > preflightLimits.htmlBytes ? 'warning' : 'pass', message: `HTML: ${size} bytes; recomendado abaixo de 102 KB.` });
  return checks;
}
