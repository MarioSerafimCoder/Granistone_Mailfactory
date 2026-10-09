import type { Campaign, Language } from '@/types/campaign';
import type { Blueprint, Section, SectionType } from '@/types/design';
import { createSection, blockRegistry } from './registry';
import { defaultDesign } from '@/lib/tokens/backgrounds';
import { plainText, createCampaign } from '@/campaigns/model';
import { fieldDocument } from '@/lib/canvas-model';
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
  if (!Number.isInteger(index) || !Number.isInteger(direction) || index < 0 || index >= sections.length || index + direction < 0 || index + direction >= sections.length) return sections;
  const next = [...sections]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next;
}
export function moveSectionTo(sections: Section[], from: number, to: number): Section[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= sections.length || to < 0 || to >= sections.length || from === to) return sections;
  const next = [...sections]; const [section] = next.splice(from, 1); next.splice(to, 0, section); return next;
}
// Convert on a block operation: untouched campaigns keep their existing renderer and payload.
// The original content remains in Campaign.content and in the revision history.
export function convertSections(campaign: Campaign): Section[] {
  if (campaign.sections) return structuredClone(campaign.sections);
  const sections: Section[] = [];
  function copyFormatting(section: Section, mapping: Record<string, string[]>) {
    for (const lang of ['pt', 'en', 'es'] as const) for (const [target, fields] of Object.entries(mapping)) {
      if (!fields.some(field => campaign.richFields?.[lang]?.[field])) continue;
      const documents = fields.filter(field => String(campaign.content[lang][field as keyof typeof campaign.content.pt] ?? '').length).map(field => fieldDocument(String(campaign.content[lang][field as keyof typeof campaign.content.pt] ?? ''), campaign.richFields?.[lang]?.[field]));
      const doc = { type: 'doc', content: documents.flatMap(doc => doc.content ?? []) };
      if (plainText(doc) === section.content[lang][target]) section.richFields = { ...section.richFields, [lang]: { ...section.richFields?.[lang], [target]: doc } };
    }
  }
  function add(type: SectionType, values: (lang: Language) => Record<string, string>, enabled = true) {
    const section = createSection(type); section.enabled = enabled;
    section.settings.alignment = campaign.alignment;
    if (campaign.design?.textColor) section.settings.textColor = campaign.design.textColor;
    for (const lang of ['pt', 'en', 'es'] as const) section.content[lang] = { ...Object.fromEntries(blockRegistry[type].fields.map(f => [f.key, ''])), ...values(lang) };
    sections.push(section);
  }
  add('centeredText', lang => ({ title: campaign.content[lang].headline, text: [campaign.content[lang].kicker, campaign.content[lang].subheadline].filter(Boolean).join('\n') }));
  copyFormatting(sections[0], { title: ['headline'], text: ['kicker', 'subheadline'] });
  for (const block of campaign.blocks) {
    const start = sections.length;
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
    for (const section of sections.slice(start)) {
      if (block.id === 'cta') copyFormatting(section, { label: ['cta'] });
      else if (block.id === 'specs') copyFormatting(section, { title: ['materialName'], text: ['features', 'applications'] });
      else if (block.id === 'availability') copyFormatting(section, { text: ['availability'] });
      else if (['article', 'event', 'project'].includes(block.id)) copyFormatting(section, section.type === 'cta' ? { label: [`${block.id}Title`] } : { title: [`${block.id}Title`], text: [`${block.id}Text`] });
    }
  }
  return sections;
}
export function blueprintFromCampaign(campaign: Campaign, keepContent = false): Blueprint {
  const sections = convertSections(campaign);
  if (!keepContent) for (const section of sections) {
    section.content = blockRegistry[section.type].defaults();
    delete section.richBody;
    delete section.richFields;
    // Backgrounds are design choices; the user explicitly sees them in the template.
  }
  return { template: campaign.template, sections, design: structuredClone(campaign.design ?? defaultDesign()), alignment: campaign.alignment, language: campaign.language };
}
export function campaignFromBlueprint(blueprint: Blueprint, title: string): Campaign {
  const campaign = createCampaign({ title, template: blueprint.template, language: blueprint.language, alignment: blueprint.alignment, design: structuredClone(blueprint.design), sections: blueprint.sections.map(duplicateSection), status: 'Em produção' });
  return campaign;
}
