export type Language = 'pt' | 'en' | 'es';
export const statuses = ['Pendente', 'Em produção', 'Revisão', 'Aprovado', 'Exportado'] as const;
export type Status = (typeof statuses)[number];
export type ImportIssueSeverity = 'warning' | 'error';
export interface ImportIssue {
  code: 'missing-date' | 'invalid-date' | 'missing-type' | 'missing-audience' | 'missing-language';
  field: 'date' | 'campaignType' | 'audience' | 'language';
  message: string;
  severity: ImportIssueSeverity;
}
export const campaignTypes = [
  'Institucional',
  'Produto',
  'Promocional',
  'Newsletter',
  'Aviso',
] as const;
export type CampaignType = (typeof campaignTypes)[number];
export type ContentAlignment = 'left' | 'center' | 'right';
export type TemplateId =
  'institutional' | 'product-architect' | 'product-commercial' | 'newsletter' | 'notice' |
  'promo-impact' | 'catalog-color' | 'editorial-organic' | 'brand-story';
export type BlockId =
  | 'hero'
  | 'body'
  | 'application'
  | 'specs'
  | 'availability'
  | 'article'
  | 'event'
  | 'project'
  | 'cta';
export interface RichNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
}
export interface CampaignContent {
  subject: string;
  preheader: string;
  kicker: string;
  headline: string;
  subheadline: string;
  body: RichNode;
  cta: string;
  ctaUrl: string;
  heroImage: string;
  heroAlt: string;
  applicationImage: string;
  applicationAlt: string;
  materialName: string;
  features: string;
  applications: string;
  availability: string;
  articleTitle: string;
  articleText: string;
  articleUrl: string;
  eventTitle: string;
  eventText: string;
  projectTitle: string;
  projectText: string;
}
export interface Campaign {
  sections?: import('./design').Section[];
  design?: import('./design').CampaignDesign;
  languageState?: Record<Language, { status: Status; updatedAt: string; approvedAt?: string; approvedBy?: string }>;
  id: string;
  date: string;
  title: string;
  campaignType: CampaignType;
  audience: string;
  objective: string;
  language: 'PT' | 'EN' | 'ES' | 'PT / EN' | 'PT / ES' | 'EN / ES' | 'PT / EN / ES';
  notes: string;
  status: Status;
  template: TemplateId;
  content: Record<Language, CampaignContent>;
  blocks: { id: BlockId; enabled: boolean }[];
  alignment: ContentAlignment;
  materialId?: string;
  sourceKey?: string;
  importIssues?: ImportIssue[];
  demo?: boolean;
  updatedAt: string;
}
export interface StoneMaterial {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  features: string[];
  applications: string[];
  images: string[];
  heroImage: string;
  slabImage: string;
}
export interface BrandSettings {
  unsubscribeMode?: 'link' | 'rd-managed';
  brandName: string;
  email: string;
  assetBaseUrl: string;
  logoUrl: string;
  facebook: string;
  instagram: string;
  website: string;
  whatsapp: string;
  unsubscribeUrl: string;
  address: string;
  phone: string;
}
