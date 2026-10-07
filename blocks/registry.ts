import type { Language, TemplateId } from '@/types/campaign';
import type { Section, SectionType } from '@/types/design';
import { backgroundValid, colorValid, backgroundColors } from '@/lib/tokens/backgrounds';
import { sectionRenderers } from './renderers';
import { validRich } from '@/lib/rich-validation';
export interface BlockField { key: string; label: string; kind: 'text' | 'textarea' | 'image' | 'url' | 'alt'; required?: boolean }
const title: BlockField = { key: 'title', label: 'Título do bloco', kind: 'text' };
const text: BlockField = { key: 'text', label: 'Texto do bloco', kind: 'textarea' };
const image: BlockField = { key: 'image', label: 'Imagem do bloco', kind: 'image', required: true };
const alt: BlockField = { key: 'alt', label: 'Descrição da imagem', kind: 'alt', required: true };
const label: BlockField = { key: 'label', label: 'Texto do botão', kind: 'text' };
const link: BlockField = { key: 'link', label: 'Link do botão', kind: 'url' };
const picture = [image, alt], copy = [title, text], button = [label, link];
const second = (fields: BlockField[]) => fields.map(f => ({ ...f, key: f.key + '2', label: f.label + ' 2' }));
export interface BlockDefinition { name: string; icon: 'image' | 'text' | 'layout'; fields: BlockField[]; editor: 'fields'; render: typeof sectionRenderers[SectionType]; compatibleTemplates: 'all' | TemplateId[]; defaults: () => Section['content']; validate: (value: unknown) => boolean }
function define(type: SectionType, name: string, fields: BlockField[], icon: BlockDefinition['icon'] = 'layout'): BlockDefinition {
  return { name, icon, fields, editor: 'fields', render: sectionRenderers[type], compatibleTemplates: 'all',
    defaults: () => Object.fromEntries((['pt', 'en', 'es'] as Language[]).map(lang => [lang, Object.fromEntries(fields.map(f => [f.key, f.kind === 'text' || f.kind === 'textarea' ? `[${f.label}]` : '']))])) as Section['content'],
    validate: value => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => fields.some(f => f.key === key)) && fields.every(f => typeof (value as Record<string, unknown>)[f.key] === 'string' && String((value as Record<string, unknown>)[f.key]).length <= (f.kind === 'image' ? 2000000 : 20000)),
  };
}
export const blockRegistry: Record<SectionType, BlockDefinition> = {
  heroEditorial: define('heroEditorial', 'Hero editorial', [...picture, ...copy], 'image'),
  heroProduct: define('heroProduct', 'Hero de produto', [...picture, ...copy, ...button], 'image'),
  imageText: define('imageText', 'Imagem + texto', [...picture, ...copy, ...button]),
  textImage: define('textImage', 'Texto + imagem', [...copy, ...picture, ...button]),
  centeredText: define('centeredText', 'Texto centralizado', copy, 'text'),
  product: define('product', 'Produto destaque', [...picture, ...copy, ...button]),
  twoProducts: define('twoProducts', 'Dois produtos', [...picture, ...copy, ...button, ...second([...picture, ...copy, ...button])]),
  gallery: define('gallery', 'Galeria', [...picture, ...second(picture), text], 'image'),
  specifications: define('specifications', 'Informações técnicas', copy, 'text'),
  applications: define('applications', 'Lista de aplicações', copy, 'text'),
  quote: define('quote', 'Quote / destaque', copy, 'text'),
  cta: define('cta', 'CTA', [...copy, { ...label, required: true }, { ...link, required: true }]),
  divider: define('divider', 'Divisor', []),
  spacer: define('spacer', 'Espaçador', []),
  banner: define('banner', 'Banner', [...picture, ...button], 'image'),
  complementaryFooter: define('complementaryFooter', 'Rodapé complementar', copy, 'text'),
};
export function createSection(type: SectionType): Section {
  return { id: crypto.randomUUID(), type, enabled: true, content: blockRegistry[type].defaults(), settings: { background: { kind: 'solid', color: backgroundColors.white }, textColor: backgroundColors.black, padding: 36, alignment: type === 'centeredText' ? 'center' : 'left', height: 32 } };
}
export function isSection(value: unknown): value is Section {
  if (!value || typeof value !== 'object') return false;
  const s = value as Section;
  const d = typeof s.type === 'string' && Object.hasOwn(blockRegistry, s.type) ? blockRegistry[s.type] : undefined;
  if (s.richBody !== undefined && (!s.richBody || typeof s.richBody !== 'object' || !Object.entries(s.richBody).every(([lang, body]) => ['pt', 'en', 'es'].includes(lang) && validRich(body)))) return false;
  return !!d && typeof s.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(s.id) && typeof s.enabled === 'boolean' &&
    !!s.content && ['pt', 'en', 'es'].every(lang => d.validate(s.content[lang as Language])) &&
    !!s.settings && backgroundValid(s.settings.background) && colorValid(s.settings.textColor) &&
    ['left', 'center'].includes(s.settings.alignment) && Number.isInteger(s.settings.padding) && s.settings.padding >= 0 && s.settings.padding <= 80 &&
    Number.isInteger(s.settings.height) && s.settings.height >= 8 && s.settings.height <= 200;
}
export function sectionsValid(value: unknown): value is Section[] {
  return Array.isArray(value) && value.length <= 40 && value.every(isSection) && new Set(value.map(s => s.id)).size === value.length;
}
