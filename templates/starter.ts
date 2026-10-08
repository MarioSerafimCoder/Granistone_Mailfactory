import { emptyContent, richText } from '@/campaigns/model';
import type { CampaignContent, Language, TemplateId } from '@/types/campaign';
import { defaultBrand } from '@/data/brand';

export function templateContent(template: TemplateId, title: string): Record<Language, CampaignContent> {
  const common = {
    ...emptyContent(), subject: title, kicker: 'GRANISTONE A ROCHA',
    cta: 'Conheça as possibilidades', ctaUrl: defaultBrand.website,
  };
  const variants: Record<TemplateId, Partial<CampaignContent>> = {
    institutional: {
      headline: 'Histórias que se tornam parte dos espaços.',
      subheadline: 'A beleza de uma escolha que permanece.',
      body: richText('Cada projeto guarda uma história. A pedra natural conecta matéria, tempo e imaginação, dando forma a ambientes com identidade.\nConte aqui a história da sua campanha.'),
    },
    'product-architect': {
      kicker: 'MATÉRIA · ARQUITETURA', materialName: 'Nome do material',
      headline: 'A natureza desenha.\nSeu projeto revela.',
      body: richText('Texturas, veios e luz criam uma presença singular. Apresente o conceito do material e sua relação com o projeto.'),
      features: 'Descreva os acabamentos\nApresente os diferenciais',
      applications: 'Indique as aplicações recomendadas pela equipe técnica.',
      cta: 'Explore o material',
    },
    'product-commercial': {
      kicker: 'SELEÇÃO GRANISTONE', headline: 'Mais possibilidades para o seu portfólio.',
      body: richText('Apresente o material, seus diferenciais e a oportunidade para seu cliente.'),
      materialName: 'Nome do material', features: 'Diferenciais do material\nAcabamentos disponíveis',
      applications: 'Aplicações recomendadas',
      availability: 'Consulte lotes, dimensões e prazos com nossa equipe.',
      cta: 'Solicite uma cotação', ctaUrl: defaultBrand.whatsapp,
    },
    newsletter: {
      kicker: 'JORNAL GRANISTONE · NOVA EDIÇÃO', headline: 'Matéria, ideias\ne novas perspectivas.',
      body: richText('Uma seleção de materiais, projetos e encontros para inspirar suas próximas escolhas.'),
      articleTitle: 'Um novo olhar para os espaços', articleText: 'Apresente aqui a história de destaque desta edição. Adicione uma imagem ao lado para completar a leitura.',
      articleUrl: defaultBrand.website, materialName: 'Material da edição', features: 'Descreva o material em destaque.',
      eventTitle: 'Encontros e conexões', eventText: 'Compartilhe a próxima data da sua agenda.',
      projectTitle: 'Arquitetura em foco', projectText: 'Apresente um projeto e os materiais que fazem parte dele.',
      cta: 'Explore a edição',
    },
    notice: {
      kicker: 'COMUNICADO GRANISTONE', headline: 'Uma informação\npara o seu planejamento.',
      subheadline: 'Inclua a data ou o período do comunicado.',
      body: richText('Escreva aqui as informações de atendimento, horários ou orientações para clientes e parceiros.\nAgradecemos pela compreensão.'),
    },
    'promo-impact': {
      kicker: 'GRANISTONE · EM DESTAQUE', headline: 'Matéria que transforma espaços.',
      preheader: 'Uma seleção para projetos que pedem presença.',
      body: richText('Apresente aqui o motivo desta campanha e convide seu público a conhecer a seleção.'),
      cta: 'Explorar materiais',
    },
    'catalog-color': {
      kicker: 'SELEÇÃO GRANISTONE', headline: 'A matéria encontra o projeto.',
      preheader: 'Uma seleção mineral para espaços com identidade.',
      body: richText('Apresente os materiais da coleção sem inventar especificações técnicas.'),
      cta: 'Ver catálogo',
    },
    'editorial-organic': {
      kicker: 'CADERNO DE ARQUITETURA', headline: 'Terra, tempo e forma.',
      preheader: 'Uma história sobre matéria e arquitetura.',
      body: richText('Conte uma história sobre projetos, materiais e novas perspectivas.'),
      cta: 'Ver coleção',
    },
    'brand-story': {
      kicker: 'GRANISTONE', headline: 'Cada superfície tem uma origem.',
      preheader: 'Conheça a história que a matéria carrega.',
      body: richText('Compartilhe a visão da marca e a relação entre natureza, arquitetura e permanência.'),
      cta: 'Conheça a Granistone',
    },
  };
  return { pt: { ...common, ...variants[template] }, en: emptyContent(), es: emptyContent() };
}
