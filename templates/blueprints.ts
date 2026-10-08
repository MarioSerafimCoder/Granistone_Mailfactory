import { blockRegistry, createSection } from '@/blocks/registry';
import { defaultBrand } from '@/data/brand';
import type { TemplateId } from '@/types/campaign';
import type { CampaignDesign, Section, SectionType } from '@/types/design';
import { templatePalettes, type TemplatePalette } from './palettes';

type NewTemplate = keyof typeof templatePalettes;
type BlockSpec = {
  type: SectionType; content?: Record<string, string>; background: string; textColor: string;
  alignment?: Section['settings']['alignment']; padding?: number;
};
const solid = (color: string) => ({ kind: 'solid' as const, color });
const url = defaultBrand.website;

function block(spec: BlockSpec): Section {
  const section = createSection(spec.type);
  section.settings = { ...section.settings, background: solid(spec.background), textColor: spec.textColor, padding: spec.padding ?? 36, alignment: spec.alignment ?? section.settings.alignment };
  section.content.pt = Object.fromEntries(blockRegistry[spec.type].fields.map(field => [field.key, spec.content?.[field.key] ?? section.content.pt[field.key]]));
  for (const language of ['en', 'es'] as const) {
    section.content[language] = Object.fromEntries(Object.keys(section.content[language]).map(key => [key, key === 'link' || key === 'link2' ? spec.content?.[key] ?? '' : '']));
  }
  return section;
}

export function templateDesign(id: NewTemplate): CampaignDesign {
  const p = templatePalettes[id];
  return { email: solid(p.surfaceAlt), content: solid(p.surface), textColor: p.text };
}

const editorial = (p: TemplatePalette, type: SectionType, title: string, text: string, background: string, textColor: string, alignment?: Section['settings']['alignment'], padding?: number) =>
  block({ type, content: { title, text }, background: background || p.surface, textColor: textColor || p.text, alignment, padding });
const photo = (p: TemplatePalette, type: SectionType, title: string, text: string, background: string, textColor: string, label = '', alignment?: Section['settings']['alignment']) =>
  block({ type, content: { image: '', alt: title, title, text, label, link: label ? url : '' }, background: background || p.surface, textColor: textColor || p.text, alignment });
const action = (p: TemplatePalette, title: string, text: string, label: string, background: string, textColor: string, alignment?: Section['settings']['alignment']) =>
  block({ type: 'cta', content: { title, text, label, link: url }, background: background || p.primary, textColor: textColor || p.textInverse, alignment });

export function createTemplateSections(id: NewTemplate): Section[] {
  const p = templatePalettes[id];
  switch (id) {
    case 'promo-impact': return [
      editorial(p, 'centeredText', 'UMA NOVA PERSPECTIVA', 'Granistone apresenta', p.secondary, p.textInverse, 'center', 16),
      editorial(p, 'centeredText', 'Matéria que transforma o espaço.', '', p.primary, p.textInverse, 'left', 52),
      editorial(p, 'centeredText', '', 'Uma seleção criada para projetos que pedem presença.', p.primary, p.textInverse, 'left', 24),
      photo(p, 'heroEditorial', 'O material em destaque', 'Substitua esta imagem pela fotografia da sua campanha.', p.primary, p.textInverse),
      editorial(p, 'quote', 'Design que permanece.', 'Texturas, movimento e luz em uma conversa entre natureza e arquitetura.', p.surfaceAlt, p.text),
      action(p, 'Conheça a seleção', 'Encontre a pedra certa para a sua próxima ideia.', 'Explorar materiais', p.surface, p.text),
      photo(p, 'product', 'Um olhar mais próximo', 'Apresente aqui o material e seus diferenciais aprovados.', p.surfaceAlt, p.text, 'Ver material'),
      editorial(p, 'centeredText', 'Seu próximo projeto começa aqui.', 'Converse com a equipe Granistone.', p.secondary, p.textInverse, 'center', 48),
      action(p, '', '', 'Fale com a Granistone', p.secondary, p.textInverse, 'center'),
    ];
    case 'catalog-color': return [
      photo(p, 'heroProduct', 'A matéria encontra o projeto.', 'Uma seleção mineral para espaços com identidade.', p.secondary, p.textInverse, 'Explorar seleção'),
      editorial(p, 'centeredText', 'Uma paleta feita pela natureza.', 'A pedra natural revela profundidade, textura e novas possibilidades.', p.surface, p.text),
      block({ type: 'twoProducts', content: { image: '', alt: 'Primeiro material', title: 'Material em foco', text: 'Apresente as qualidades visuais do material.', label: 'Conhecer', link: url, image2: '', alt2: 'Segundo material', title2: 'Outra expressão', text2: 'Mostre uma segunda leitura da coleção.', label2: 'Conhecer', link2: url }, background: p.accent, textColor: p.text }),
      action(p, 'Escolha com intenção.', 'Explore a coleção com apoio da equipe.', 'Ver catálogo', p.primary, p.textInverse),
      photo(p, 'imageText', 'Detalhes que fazem diferença.', 'A luz e os veios transformam cada superfície.', p.surface, p.text, 'Descobrir'),
      photo(p, 'textImage', 'Da matéria ao ambiente.', 'Apresente uma aplicação real para inspirar o projeto.', p.surfaceAlt, p.text),
      editorial(p, 'quote', 'Projetos com personalidade.', 'A seleção certa aproxima conceito e experiência.', p.secondary, p.textInverse),
      action(p, '', '', 'Conversar com a equipe', p.surface, p.secondary),
    ];
    case 'editorial-organic': return [
      photo(p, 'heroEditorial', 'A arquitetura nasce da matéria.', 'Um olhar sobre superfícies, paisagens e modos de habitar.', p.primary, p.textInverse),
      editorial(p, 'centeredText', 'Terra, tempo e forma.', 'Cada material conta uma história que continua no espaço.', p.surface, p.text, 'left', 52),
      editorial(p, 'quote', 'A beleza está no encontro.', 'Entre a natureza e a intenção de quem projeta.', p.accent, p.text),
      photo(p, 'imageText', 'Texturas em movimento.', 'Descubra possibilidades para criar ambientes com identidade.', p.secondary, p.textInverse),
      photo(p, 'product', 'Material em perspectiva.', 'Uma escolha de presença serena e caráter único.', p.surface, p.text),
      photo(p, 'textImage', 'Da origem ao projeto.', 'A matéria ganha novas leituras em cada aplicação.', p.surfaceAlt, p.text),
      action(p, 'Explore novas histórias.', 'Encontre inspiração para o próximo projeto.', 'Ver coleção', p.primary, p.textInverse),
      editorial(p, 'centeredText', 'Matéria, arquitetura e possibilidades.', '', p.text, p.textInverse, 'center', 52),
    ];
    case 'brand-story': return [
      editorial(p, 'centeredText', 'GRANISTONE', 'A natureza como ponto de partida.', p.primary, p.textInverse, 'center', 48),
      photo(p, 'heroEditorial', 'Cada superfície tem uma origem.', 'Uma história feita de matéria, tempo e olhar.', p.secondary, p.textInverse),
      editorial(p, 'centeredText', 'O valor está nos detalhes.', 'Selecionamos pedras naturais para projetos que permanecem.', p.surface, p.text, 'left', 56),
      photo(p, 'imageText', 'Matéria com significado.', 'A beleza natural se revela em cada textura.', p.secondary, p.textInverse),
      editorial(p, 'quote', 'Uma escolha que atravessa o tempo.', 'Arquitetura e natureza em diálogo.', p.surfaceAlt, p.text),
      photo(p, 'textImage', 'Da origem ao espaço.', 'Cada projeto dá continuidade à história da pedra.', p.secondary, p.textInverse),
      editorial(p, 'centeredText', 'Presença sem excesso.', 'Conheça o universo Granistone.', p.primary, p.textInverse, 'center', 52),
      action(p, '', '', 'Conheça a Granistone', p.primary, p.accent, 'center'),
    ];
  }
}

export const modernTemplateIds: NewTemplate[] = ['promo-impact', 'catalog-color', 'editorial-organic', 'brand-story'];
export const isModernTemplate = (id: TemplateId): id is NewTemplate => modernTemplateIds.includes(id as NewTemplate);
