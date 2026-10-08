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
  const definition = getTemplate(template);
  const supplied = partial.content;
  return {
    id: crypto.randomUUID(),
    date: '',
    title: 'Nova campanha',
    campaignType: definition.campaignType,
    audience: '',
    objective: '',
    language: 'PT',
    notes: '',
    status: 'Pendente',
    template,
    blocks: definition.blocks.map((id) => ({ id, enabled: true })),
    ...(definition.createSections ? { sections: definition.createSections() } : {}),
    ...(definition.defaultDesign ? { design: definition.defaultDesign() } : {}),
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
  const definition = getTemplate(template);
  return {
    ...c,
    template,
    campaignType: definition.campaignType,
    ...(definition.createSections ? { sections: definition.createSections(), design: definition.defaultDesign?.() } : {}),
    blocks: definition.blocks.map((id) => ({
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
export function languageStates(c: Campaign): NonNullable<Campaign['languageState']> {
  return Object.fromEntries((['pt', 'en', 'es'] as const).map(lang => [lang,
    c.languageState?.[lang] ?? { status: languages(c).includes(lang) ? c.status : 'Pendente', updatedAt: c.updatedAt },
  ])) as NonNullable<Campaign['languageState']>;
}
export function reconcileLanguageState(previous: Campaign, next: Campaign, actor?: string): Campaign {
  const before = languageStates(previous), state = languageStates(next);
  const sharedChanged = ['template', 'blocks', 'alignment', 'materialId', 'design'].some(key => JSON.stringify(previous[key as keyof Campaign]) !== JSON.stringify(next[key as keyof Campaign]));
  const now = new Date().toISOString();
  for (const lang of ['pt', 'en', 'es'] as const) {
    const sectionView = (c: Campaign) => c.sections?.map(s => ({ ...s, content: s.content[lang], richBody: s.richBody?.[lang] }));
    const changed = sharedChanged || JSON.stringify(previous.content[lang]) !== JSON.stringify(next.content[lang]) || JSON.stringify(sectionView(previous)) !== JSON.stringify(sectionView(next));
    const status = changed && ['Aprovado', 'Exportado'].includes(state[lang].status) ? 'Em produção' : state[lang].status;
    state[lang] = { ...state[lang], status, updatedAt: changed ? now : before[lang].updatedAt };
    if (status === 'Aprovado') {
      state[lang].approvedAt = before[lang].status === 'Aprovado' ? before[lang].approvedAt : now;
      state[lang].approvedBy = before[lang].status === 'Aprovado' ? before[lang].approvedBy : actor;
    } else { delete state[lang].approvedAt; delete state[lang].approvedBy; }
  }
  const planned = languages(next).map(lang => state[lang].status);
  const status = planned.every(s => s === planned[0]) ? planned[0] : 'Em produção';
  return { ...next, status, languageState: state };
}
export function editCampaign(c: Campaign, update: Partial<Campaign>, language?: Language): Campaign {
  const next = {
    ...c,
    ...update,
    languageState: update.languageState ?? languageStates(c),
    status:
      update.status ??
      (c.status === 'Aprovado' || c.status === 'Exportado' ? 'Em produção' : c.status),
    updatedAt: new Date().toISOString(),
  };
  if (update.status) {
    next.languageState = languageStates(c);
    for (const lang of language ? [language] : languages(c)) next.languageState[lang] = { ...next.languageState[lang], status: update.status };
  }
  return reconcileLanguageState(c, next);
}
