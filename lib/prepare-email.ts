import type { BrandSettings, Campaign } from '@/types/campaign';
import { blockRegistry } from '@/blocks/registry';
import { publicHttpsUrl } from './public-url';

// Resolve only known application resources. Never turn arbitrary relative
// links (or another site's URLs) into apparently valid hosted images.
export function hostedResourceUrl(value: string, origin: string): string {
  if (publicHttpsUrl(origin) && /^\/(?:assets\/[a-f0-9]{64}|brand\/[a-zA-Z0-9_.-]+)$/.test(value)) {
    return new URL(value, origin).href;
  }
  return value;
}

export function prepareBrand(brand: BrandSettings, origin: string): BrandSettings {
  const base = brand.assetBaseUrl.trim() || (publicHttpsUrl(origin) ? origin.replace(/\/$/, '') : '');
  return { ...brand, assetBaseUrl: base, logoUrl: hostedResourceUrl(brand.logoUrl, base) };
}

export function prepareCampaignImages(source: Campaign, origin = ''): Campaign {
  const campaign = structuredClone(source);
  const labels = { pt: ['Imagem principal', 'Imagem de aplicação', 'Imagem'], en: ['Main image', 'Application image', 'Image'], es: ['Imagen principal', 'Imagen de aplicación', 'Imagen'] };
  for (const lang of ['pt', 'en', 'es'] as const) {
    const content = campaign.content[lang];
    for (const [image, alt, label] of [['heroImage', 'heroAlt', labels[lang][0]], ['applicationImage', 'applicationAlt', labels[lang][1]]] as const) {
      content[image] = hostedResourceUrl(content[image], origin);
      if (content[image] && !content[alt].trim()) content[alt] = `${label} · ${content.materialName || content.headline || campaign.title}`.slice(0, 500);
    }
    for (const section of campaign.sections ?? []) {
      const values = section.content[lang];
      for (const field of blockRegistry[section.type].fields.filter(f => f.kind === 'image')) {
        values[field.key] = hostedResourceUrl(values[field.key] || '', origin);
        const second = field.key === 'image2', alt = second ? 'alt2' : 'alt';
        if (values[field.key] && !values[alt]?.trim()) values[alt] = `${labels[lang][2]} · ${values[second ? 'title2' : 'title'] || content.materialName || content.headline || campaign.title}`.slice(0, 500);
      }
    }
  }
  const background = (value: { kind: string; image?: string } | undefined) => {
    if (value?.kind === 'image' && value.image) value.image = hostedResourceUrl(value.image, origin);
  };
  background(campaign.design?.email); background(campaign.design?.content);
  for (const section of campaign.sections ?? []) background(section.settings.background);
  return campaign;
}
