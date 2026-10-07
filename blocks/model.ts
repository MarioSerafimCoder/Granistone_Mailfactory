import type { Campaign, Language } from '@/types/campaign';
import type { Blueprint, Section, SectionType } from '@/types/design';
import { createSection, blockRegistry } from './registry';
import { defaultDesign } from '@/lib/tokens/backgrounds';
import { plainText, createCampaign } from '@/campaigns/model';
export function duplicateCampaign(source: Campaign): Campaign {
  const now = new Date().toISOString();
  const copy = structuredClone(source);
  delete copy.sourceKey; delete copy.demo; delete copy.importIssues;
  return { ...copy, id: crypto.randomUUID(), title: `${source.title} · cópia`, date: '', status: 'Em produção', updatedAt: now,
    sections: copy.sections?.map(s => ({ ...s, id: crypto.randomUUID() })),
    languageState: { pt: { status: 'Em produção', updatedAt: now }, en: { status: 'Em produção', updatedAt: now }, es: { status: 'Em produção', updatedAt: now } } };
}
export const duplicateSection = (s: Section): Section => ({ ...structuredClone(s), id: crypto.randomUUID() });
export function moveSection(sections: Section[], index: number, direction: number): Section[] {
  if (index + direction < 0 || index + direction >= sections.length) return sections;
  const next = [...sections]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next;
}
// Opt-in conversion: untouched campaigns keep their existing renderer and payload.
// The original content remains in Campaign.content and in the revision history.
export function convertSections(campaign: Campaign): Section[] {
  if (campaign.sections) return structuredClone(campaign.sections);
  const sections: Section[] = [];
  function add(type: SectionType, values: (lang: Language) => Record<string, string>, enabled = true) {
    const section = createSection(type); section.enabled = enabled;
    for (const lang of ['pt', 'en', 'es'] as const) section.content[lang] = { ...Object.fromEntries(blockRegistry[type].fields.map(f => [f.key, ''])), ...values(lang) };
    sections.push(section);
  }
  add('centeredText', lang => ({ title: campaign.content[lang].headline, text: [campaign.content[lang].kicker, campaign.content[lang].subheadline].filter(Boolean).join('\n') }));
  for (const block of campaign.blocks) {
    if (block.id === 'hero' || block.id === 'application') {
      const primary = block.id === 'hero'; add('banner', lang => ({ image: campaign.content[lang][primary ? 'heroImage' : 'applicationImage'], alt: campaign.content[lang][primary ? 'heroAlt' : 'applicationAlt'] }), block.enabled);
    } else if (block.id === 'cta') add('cta', lang => ({ label: campaign.content[lang].cta, link: campaign.content[lang].ctaUrl }), block.enabled);
    else if (block.id === 'specs') add('specifications', lang => ({ title: campaign.content[lang].materialName, text: [campaign.content[lang].features, campaign.content[lang].applications].filter(Boolean).join('\n') }), block.enabled);
    else if (block.id === 'body') { add('centeredText', lang => ({ title: '', text: plainText(campaign.content[lang].body) }), block.enabled); sections[sections.length - 1].richBody = { pt: structuredClone(campaign.content.pt.body), en: structuredClone(campaign.content.en.body), es: structuredClone(campaign.content.es.body) }; }
    else if (block.id === 'availability') add('centeredText', lang => ({ title: '', text: campaign.content[lang].availability }), block.enabled);
    else {
      const id = block.id;
      add('centeredText', lang => ({ title: campaign.content[lang][`${id}Title`], text: campaign.content[lang][`${id}Text`] }), block.enabled);
      if (id === 'article' && Object.values(campaign.content).some(c => c.articleUrl)) add('cta', lang => ({ label: campaign.content[lang].articleTitle, link: campaign.content[lang].articleUrl }), block.enabled);
    }
  }
  return sections;
}
export function blueprintFromCampaign(campaign: Campaign, keepContent = false): Blueprint {
  const sections = convertSections(campaign);
  if (!keepContent) for (const section of sections) {
    section.content = blockRegistry[section.type].defaults();
    delete section.richBody;
    // Backgrounds are design choices; the user explicitly sees them in the template.
  }
  return { template: campaign.template, sections, design: structuredClone(campaign.design ?? defaultDesign()), alignment: campaign.alignment, language: campaign.language };
}
export function campaignFromBlueprint(blueprint: Blueprint, title: string): Campaign {
  const campaign = createCampaign({ title, template: blueprint.template, language: blueprint.language, alignment: blueprint.alignment, design: structuredClone(blueprint.design), sections: blueprint.sections.map(duplicateSection), status: 'Em produção' });
  return campaign;
}
