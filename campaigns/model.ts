import type { Campaign, CampaignContent, Language, RichNode, TemplateId } from '@/types/campaign';
import { getTemplate } from '@/templates/registry';
export const richText = (text: string): RichNode => ({
  type: 'doc',
  content: text
    .split('\n')
    .map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })),
});
export const plainText = (node: RichNode): string =>
  node.text ?? node.content?.map(plainText).join(node.type === 'doc' ? '\n' : '') ?? '';
export function emptyContent(): CampaignContent {
  return {
    subject: '',
    preheader: '',
    kicker: '',
    headline: '',
    subheadline: '',
    body: richText(''),
    cta: '',
    ctaUrl: '',
    heroImage: '',
    heroAlt: '',
    applicationImage: '',
    applicationAlt: '',
    materialName: '',
    features: '',
    applications: '',
    availability: '',
    articleTitle: '',
    articleText: '',
    articleUrl: '',
    eventTitle: '',
    eventText: '',
    projectTitle: '',
    projectText: '',
  };
}
type CampaignDraft = Omit<Partial<Campaign>, 'content'> & { content?: Partial<Record<Language, CampaignContent>> };
export function createCampaign(partial: CampaignDraft = {}): Campaign {
  const template = partial.template ?? 'institutional';
  const supplied = partial.content;
  return {
    id: crypto.randomUUID(),
    date: '',
    title: 'Nova campanha',
    campaignType: 'Institucional',
    audience: '',
    objective: '',
    language: 'PT',
    notes: '',
    status: 'Pendente',
    template,
    blocks: getTemplate(template).blocks.map((id) => ({ id, enabled: true })),
    alignment: 'left',
    updatedAt: new Date().toISOString(),
    ...partial,
    content: {
      pt: supplied?.pt ?? emptyContent(),
      en: supplied?.en ?? emptyContent(),
      es: supplied?.es ?? emptyContent(),
    },
  };
}
export function changeTemplate(c: Campaign, template: TemplateId): Campaign {
  return {
    ...c,
    template,
    blocks: getTemplate(template).blocks.map((id) => ({
      id,
      enabled: c.blocks.find((b) => b.id === id)?.enabled ?? true,
    })),
  };
}
export function languages(c: Campaign): Language[] {
  const planned = c.language.split(' / ');
  return (['PT', 'EN', 'ES'] as const)
    .filter((code) => planned.includes(code))
    .map((code) => code.toLowerCase() as Language);
}
export function editCampaign(c: Campaign, update: Partial<Campaign>): Campaign {
  return {
    ...c,
    ...update,
    status:
      update.status ??
      (c.status === 'Aprovado' || c.status === 'Exportado' ? 'Em produção' : c.status),
    updatedAt: new Date().toISOString(),
  };
}
