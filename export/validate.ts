import type { BrandSettings, Campaign, Language } from '@/types/campaign';
import { isPublicUrl, safeUrl } from '@/lib/safety';
import { assetUrl } from '@/components/email/brand';
import { plainText } from '@/campaigns/model';
export function exportIssues(c: Campaign, lang: Language, brand: BrandSettings): string[] {
  const content = c.content[lang];
  const issues: string[] = [];
  if (!content.subject.trim()) issues.push('Preencha o assunto.');
  if (!content.headline.trim()) issues.push('Preencha o título neste idioma.');
  if (!isPublicUrl(brand.logoUrl || assetUrl(brand, 'granistone-logo.png')))
    issues.push('Configure uma URL HTTPS pública para a logo em Marca e rodapé.');
  if (!isPublicUrl(brand.assetBaseUrl))
    issues.push(
      'Configure o endereço público dos arquivos da marca para exibir os ícones no e-mail.',
    );
  if (!safeUrl(brand.unsubscribeUrl))
    issues.push('Configure o link de descadastro fornecido pelo RD Station.');
  for (const [name, url] of [
    ['Facebook', brand.facebook],
    ['Instagram', brand.instagram],
    ['Site', brand.website],
    ['WhatsApp', brand.whatsapp],
  ])
    if (!safeUrl(url)) issues.push(`Configure um link válido para ${name} no rodapé.`);
  for (const b of c.blocks.filter((b) => b.enabled)) {
    if (b.id === 'hero' || b.id === 'application') {
      const src = b.id === 'hero' ? content.heroImage : content.applicationImage;
      const alt = b.id === 'hero' ? content.heroAlt : content.applicationAlt;
      if (src && !isPublicUrl(src))
        issues.push(
          `A ${b.id === 'hero' ? 'imagem principal' : 'imagem de aplicação'} precisa de uma URL HTTPS pública.`,
        );
      if (src && !alt.trim())
        issues.push(
          `Preencha o texto alternativo da ${b.id === 'hero' ? 'imagem principal' : 'imagem de aplicação'}.`,
        );
    }
    if (b.id === 'body' && !plainText(content.body).trim())
      issues.push('Preencha o texto editorial ou desative esse bloco.');
    if (b.id === 'cta' && (!content.cta || !safeUrl(content.ctaUrl)))
      issues.push('Preencha o texto e um link válido do CTA ou desative o bloco.');
    if (b.id === 'article' && content.articleUrl && !safeUrl(content.articleUrl))
      issues.push('O link do artigo é inválido.');
  }
  return issues;
}
