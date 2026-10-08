import type { BlockId, CampaignType, TemplateId } from '@/types/campaign';
import type { CampaignDesign, Section } from '@/types/design';
import { createTemplateSections, templateDesign } from './blueprints';
export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  label: string;
  description: string;
  campaignType: CampaignType;
  blocks: BlockId[];
  reorder: boolean;
  visualCategory: 'essential' | 'new';
  createSections?: () => Section[];
  defaultDesign?: () => CampaignDesign;
}
export const templates: TemplateDefinition[] = [
  {
    id: 'institutional',
    name: 'Institutional',
    label: 'Institucional',
    description: 'Capa panorâmica, título centralizado e narrativa editorial em uma coluna.',
    campaignType: 'Institucional', visualCategory: 'essential',
    blocks: ['hero', 'body', 'cta'],
    reorder: false,
  },
  {
    id: 'product-architect',
    name: 'Product Architect',
    label: 'Produto · Arquitetura',
    description: 'Capa do material e composição de aplicação + especificações lado a lado.',
    campaignType: 'Produto', visualCategory: 'essential',
    blocks: ['hero', 'body', 'application', 'specs', 'cta'],
    reorder: false,
  },
  {
    id: 'product-commercial',
    name: 'Product Commercial',
    label: 'Produto · Comercial',
    description: 'Vitrine em duas colunas: fotografia à esquerda e chamada comercial à direita.',
    campaignType: 'Produto', visualCategory: 'essential',
    blocks: ['hero', 'body', 'specs', 'availability', 'cta'],
    reorder: false,
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    label: 'Newsletter',
    description: 'Abertura de revista, banner e cartões de conteúdo com imagem de destaque.',
    campaignType: 'Newsletter', visualCategory: 'essential',
    blocks: ['hero', 'body', 'application', 'article', 'specs', 'event', 'project', 'cta'],
    reorder: true,
  },
  {
    id: 'notice',
    name: 'Notice',
    label: 'Avisos e datas',
    description: 'Comunicado centralizado com faixa de imagem compacta e quadro de informação.',
    campaignType: 'Aviso', visualCategory: 'essential',
    blocks: ['hero', 'body'],
    reorder: false,
  },
  { id: 'promo-impact', name: 'Promo · Impacto', label: 'Promo · Impacto', description: 'Bordô editorial, creme e contraste forte para campanhas de impacto.', campaignType: 'Promocional', blocks: ['hero', 'body', 'cta'], reorder: true, visualCategory: 'new', createSections: () => createTemplateSections('promo-impact'), defaultDesign: () => templateDesign('promo-impact') },
  { id: 'catalog-color', name: 'Produto · Amazonita', label: 'Produto · Amazonita', description: 'Verdes minerais e petróleo para coleções e lançamentos de materiais.', campaignType: 'Produto', blocks: ['hero', 'body', 'cta'], reorder: true, visualCategory: 'new', createSections: () => createTemplateSections('catalog-color'), defaultDesign: () => templateDesign('catalog-color') },
  { id: 'editorial-organic', name: 'Editorial · Terra', label: 'Editorial · Terra', description: 'Terracota, areia e oliva para narrativas sobre matéria e arquitetura.', campaignType: 'Newsletter', blocks: ['hero', 'body', 'cta'], reorder: true, visualCategory: 'new', createSections: () => createTemplateSections('editorial-organic'), defaultDesign: () => templateDesign('editorial-organic') },
  { id: 'brand-story', name: 'Marca · Noir Gold', label: 'Marca · Noir Gold', description: 'Preto, grafite e acentos de dourado antigo para histórias de marca.', campaignType: 'Institucional', blocks: ['hero', 'body', 'cta'], reorder: true, visualCategory: 'new', createSections: () => createTemplateSections('brand-story'), defaultDesign: () => templateDesign('brand-story') },
];
export const blockLabels: Record<BlockId, string> = {
  hero: 'Imagem principal',
  body: 'Texto editorial',
  application: 'Imagem de aplicação',
  specs: 'Material e características',
  availability: 'Disponibilidade',
  article: 'Artigo secundário',
  event: 'Evento',
  project: 'Projeto',
  cta: 'Chamada para ação',
};
export const getTemplate = (id: TemplateId) => templates.find((t) => t.id === id)!;
export function suggestTemplate(type: CampaignType, audience: string): TemplateId {
  if (type === 'Aviso') return 'notice';
  if (type === 'Newsletter') return 'newsletter';
  if (type === 'Promocional') return 'product-commercial';
  if (type === 'Produto')
    return /arquit|especific|design/i.test(audience) ? 'product-architect' : 'product-commercial';
  return 'institutional';
}
