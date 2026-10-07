import type { Campaign, Language } from '@/types/campaign';
import type { Background } from '@/types/design';
import type { PreflightCheck } from '@/types/online';
import { resolveBackground, colorValid } from '@/lib/tokens/backgrounds';
import { blockRegistry } from '@/blocks/registry';
import { publicHttpsUrl } from '@/lib/public-url';

export function campaignBackgrounds(c: Campaign): { name: string; background: Background; textColor: string }[] {
  return [...(c.design ? [{ name: 'Fundo do e-mail', background: c.design.email, textColor: c.design.textColor }, { name: 'Fundo do conteúdo', background: c.design.content, textColor: c.design.textColor }] : []), ...(c.sections ?? []).filter(s => s.enabled).map(s => ({ name: blockRegistry[s.type].name, background: s.settings.background, textColor: s.settings.textColor }))];
}
export function contrast(a: string, b: string) {
  const luminance = (color: string) => {
    const channels = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function designChecks(c: Campaign, lang: Language): PreflightCheck[] {
  const checks: PreflightCheck[] = [];
  const add = (severity: PreflightCheck['severity'], message: string, category: PreflightCheck['category'] = 'compatibility') => checks.push({ id: `design.${checks.length}`, category, severity, message });
  if (c.sections && !c.sections.some(s => s.enabled && !['divider', 'spacer'].includes(s.type))) add('error', 'Adicione pelo menos um bloco de conteúdo ativo.', 'content');
  for (const section of c.sections ?? []) {
    if (!section.enabled) continue;
    for (const field of blockRegistry[section.type].fields) {
      const value = section.content[lang][field.key];
      if (field.required && !value.trim()) add('error', `${blockRegistry[section.type].name}: preencha ${field.label.toLowerCase()}.`, field.kind === 'image' || field.kind === 'alt' ? 'images' : 'content');
      if ((field.kind === 'image' || field.kind === 'url') && value && !publicHttpsUrl(value)) add('error', `${field.label}: use um endereço HTTPS público.`, field.kind === 'image' ? 'images' : 'links');
      if (/^\[.+\]$/.test(value)) add('warning', `${blockRegistry[section.type].name}: substitua o placeholder ${value}.`, 'content');
    }
  }
  for (const item of campaignBackgrounds(c)) {
    const b = resolveBackground(item.background);
    if (b.kind === 'none') continue;
    const fallback = b.kind === 'solid' ? b.color : b.fallback;
    if (!colorValid(fallback)) { add('error', `${item.name}: configure uma cor sólida de fallback.`); continue; }
    if (b.kind === 'gradient') add('warning', `${item.name}: Outlook desktop e clientes sem gradientes mostrarão a cor de fallback ${fallback}.`);
    if (b.kind === 'image') {
      if (!publicHttpsUrl(b.image)) add('error', `${item.name}: selecione uma imagem pública HTTPS.`, 'images');
      add('warning', `${item.name}: Outlook desktop ou imagens bloqueadas podem exibir somente o fallback ${fallback}. Informações essenciais devem estar no texto; a imagem e o overlay não são garantidos.`);
    }
    const colors = b.kind === 'gradient' ? [fallback, b.start, b.end] : [fallback];
    if (colorValid(item.textColor) && colors.some(color => contrast(item.textColor, color) < 4.5)) add('warning', `${item.name}: contraste potencialmente baixo entre texto e fundo. Revise também a aparência com a imagem desativada.`);
  }
  return checks;
}
