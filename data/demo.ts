import { convertSections } from '@/blocks/model';
import { createCampaign, emptyContent, plainText, richText } from '@/campaigns/model';
import type { Campaign, CampaignContent } from '@/types/campaign';

const content = (values: Partial<CampaignContent>): CampaignContent => ({
  ...emptyContent(),
  ...values,
});

function crystalPalaceCampaign(): Campaign {
  return createCampaign({
      title: 'Crystal Palace · Arquitetura',
      date: '2026-10-01',
      campaignType: 'Produto',
      audience: 'Arquitetos / Especificadores',
      objective: 'Apresentar o material com linguagem editorial e foco em especificação.',
      template: 'product-architect',
      status: 'Em produção',
      language: 'PT / EN / ES',
      materialId: 'crystal-palace',
      demo: true,
      content: {
        pt: content({
          subject: 'Crystal Palace: matéria, luz e arquitetura',
          preheader: 'Uma leitura editorial para projetos que valorizam a presença da pedra natural.',
          kicker: 'PEDRA NATURAL · ARQUITETURA',
          headline: 'A natureza desenha.\nA arquitetura revela.',
          subheadline: 'Crystal Palace transforma superfície em presença.',
          body: richText('Veios, movimento e profundidade criam uma composição que muda com a luz. Crystal Palace foi escolhido para apresentar como a pedra natural pode conduzir o conceito de um ambiente.\nUse esta campanha como ponto de partida e substitua as informações demonstrativas pelos dados técnicos aprovados.'),
          materialName: 'Crystal Palace',
          features: 'Expressão visual marcante\nAcabamentos a confirmar com a equipe técnica',
          applications: 'Interiores, painéis e superfícies — validar a aplicação para cada projeto',
          cta: 'Conheça o material',
          ctaUrl: 'https://www.granistone.com.br/',
        }),
        en: content({
          subject: 'Crystal Palace: matter, light and architecture',
          preheader: 'An editorial perspective for projects shaped by natural stone.',
          kicker: 'NATURAL STONE · ARCHITECTURE',
          headline: 'Nature draws.\nArchitecture reveals.',
          subheadline: 'Crystal Palace turns surfaces into presence.',
          body: richText('Veins, movement and depth create a composition that changes with light. Crystal Palace shows how natural stone can guide an interior concept.\nUse this campaign as a starting point and replace the demonstration copy with approved technical information.'),
          materialName: 'Crystal Palace',
          features: 'Distinct visual expression\nFinishes to be confirmed with the technical team',
          applications: 'Interiors, panels and surfaces — validate each project application',
          cta: 'Discover the material',
          ctaUrl: 'https://www.granistone.com.br/',
        }),
        es: content({
          subject: 'Crystal Palace: materia, luz y arquitectura',
          preheader: 'Una mirada editorial para proyectos definidos por la piedra natural.',
          kicker: 'PIEDRA NATURAL · ARQUITECTURA',
          headline: 'La naturaleza diseña.\nLa arquitectura revela.',
          subheadline: 'Crystal Palace transforma las superficies en presencia.',
          body: richText('Vetas, movimiento y profundidad crean una composición que cambia con la luz. Crystal Palace muestra cómo la piedra natural puede guiar el concepto de un ambiente.\nUtiliza esta campaña como punto de partida y sustituye el contenido de demostración por la información técnica aprobada.'),
          materialName: 'Crystal Palace',
          features: 'Expresión visual distintiva\nAcabados por confirmar con el equipo técnico',
          applications: 'Interiores, paneles y superficies — valida la aplicación en cada proyecto',
          cta: 'Descubre el material',
          ctaUrl: 'https://www.granistone.com.br/',
        }),
      },
    });
}

const placeholder = (value: string) => /^\[(Título do bloco|Texto do bloco|Texto do botão)( 2)?\]$/.test(value);

/** Completes the original Crystal Palace demo without overwriting content edited by a user. */
export function upgradeDemoCampaign(campaign: Campaign): Campaign {
  if (!campaign.demo || campaign.title !== 'Crystal Palace · Arquitetura') return campaign;
  const reference = crystalPalaceCampaign();
  const spanish = { ...campaign.content.es };
  for (const [key, value] of Object.entries(reference.content.es)) {
    const field = key as keyof CampaignContent;
    if (field === 'body') {
      if (!plainText(spanish.body).trim()) spanish.body = structuredClone(reference.content.es.body);
    } else if (typeof value === 'string' && !String(spanish[field] ?? '').trim()) {
      (spanish[field] as string) = value;
    }
  }

  const translations = new Map<string, string>();
  const richBodies = new Map<string, CampaignContent['body']>();
  for (const section of convertSections(reference)) {
    for (const [field, value] of Object.entries(section.content.pt)) {
      if (value.trim()) translations.set(`${section.type}\u0000${field}\u0000${value}`, section.content.es[field] ?? '');
    }
    if (section.richBody?.pt && section.richBody.es) richBodies.set(`${section.type}\u0000${plainText(section.richBody.pt)}`, section.richBody.es);
  }
  const sections = campaign.sections?.map(section => {
    const next = structuredClone(section);
    for (const [field, value] of Object.entries(section.content.pt)) {
      const translated = translations.get(`${section.type}\u0000${field}\u0000${value}`);
      if (translated && (!next.content.es[field]?.trim() || placeholder(next.content.es[field]))) next.content.es[field] = translated;
    }
    if (section.richBody?.pt && (!section.richBody.es || !plainText(section.richBody.es).trim())) {
      const translated = richBodies.get(`${section.type}\u0000${plainText(section.richBody.pt)}`);
      if (translated) next.richBody = { ...next.richBody, es: structuredClone(translated) };
    }
    if (next.richBody?.es) next.content.es.text = plainText(next.richBody.es);
    return next;
  });
  return {
    ...campaign,
    language: 'PT / EN / ES',
    content: { ...campaign.content, es: spanish },
    ...(sections ? { sections } : {}),
  };
}

export function demoCampaigns(): Campaign[] {
  return [
    crystalPalaceCampaign(),
    createCampaign({
      title: 'Dia da Arquitetura',
      date: '2026-10-05',
      campaignType: 'Institucional',
      audience: 'Arquitetos',
      objective: 'Fortalecer a relação da marca com profissionais de arquitetura.',
      template: 'institutional',
      status: 'Pendente',
      language: 'PT',
      demo: true,
      content: {
        pt: content({
          subject: 'Arquitetura é imaginar o que ainda não existe',
          preheader: 'Uma homenagem da Granistone a quem transforma matéria em espaço.',
          kicker: 'DIA DA ARQUITETURA',
          headline: 'Ideias que ganham forma.',
          subheadline: 'Nossa homenagem a quem desenha novas maneiras de viver.',
          body: richText('Todo projeto começa com uma pergunta e se constrói em escolhas. No Dia da Arquitetura, celebramos os profissionais que encontram beleza, função e permanência em cada detalhe.\nObrigado por permitir que a pedra natural faça parte dessas histórias.'),
          cta: 'Conheça a Granistone',
          ctaUrl: 'https://www.granistone.com.br/',
        }),
        en: emptyContent(),
      },
    }),
    createCampaign({
      title: 'Speranza · Novas possibilidades',
      date: '2026-10-08',
      campaignType: 'Promocional',
      audience: 'Marmoristas / Revendedores',
      objective: 'Apresentar diferenciais e disponibilidade comercial com leitura rápida.',
      template: 'product-commercial',
      status: 'Pendente',
      language: 'PT',
      materialId: 'speranza',
      demo: true,
      content: {
        pt: content({
          subject: 'Speranza: novas possibilidades para o seu portfólio',
          preheader: 'Diferenciais, aplicações e disponibilidade em uma leitura objetiva.',
          kicker: 'SELEÇÃO GRANISTONE',
          headline: 'Um material.\nNovas possibilidades.',
          subheadline: 'Uma composição pensada para ampliar seu repertório comercial.',
          body: richText('Speranza combina presença visual e versatilidade para conversas comerciais mais inspiradoras. Personalize este exemplo com condições, formatos e informações aprovadas pela equipe.'),
          materialName: 'Speranza',
          features: 'Composição de forte presença\nAcabamentos a confirmar',
          applications: 'Bancadas, painéis e interiores — sujeitos à validação técnica',
          availability: 'Consulte formatos, lotes e prazos com a equipe comercial Granistone.',
          cta: 'Fale com nosso time',
          ctaUrl: 'https://wa.me/5585986221574',
        }),
        en: emptyContent(),
      },
    }),
    createCampaign({
      title: 'Dentro da Granistone · Outubro',
      date: '2026-10-15',
      campaignType: 'Newsletter',
      audience: 'Toda a base',
      objective: 'Reunir conteúdo editorial, agenda e projeto em uma edição mensal.',
      template: 'newsletter',
      status: 'Revisão',
      language: 'PT / EN',
      materialId: 'amazon-green',
      demo: true,
      content: {
        pt: content({
          subject: 'Dentro da Granistone · edição de outubro',
          preheader: 'Material em destaque, inspiração e agenda em uma só edição.',
          kicker: 'EDIÇÃO 10 · 2026',
          headline: 'Perspectivas em pedra natural.',
          subheadline: 'Uma curadoria mensal de matéria, projetos e encontros.',
          body: richText('Nesta edição, reunimos referências para olhar a pedra natural por novos ângulos: da escolha do material ao resultado no espaço construído.'),
          articleTitle: 'Como a luz transforma a leitura da pedra',
          articleText: 'Textura, acabamento e incidência de luz trabalham juntos. Veja pontos para considerar durante a especificação.',
          articleUrl: 'https://www.granistone.com.br/',
          materialName: 'Amazon Green',
          features: 'Expressão orgânica\nInformações técnicas sob consulta',
          applications: 'Projetos autorais com validação técnica',
          eventTitle: 'Agenda Granistone',
          eventText: 'Acompanhe nossos canais para os próximos encontros e apresentações.',
          projectTitle: 'Projeto em foco',
          projectText: 'Um espaço em que material, proporção e luz constroem uma atmosfera singular.',
          cta: 'Explore a edição',
          ctaUrl: 'https://www.granistone.com.br/',
        }),
        en: content({
          subject: 'Inside Granistone · October edition',
          preheader: 'Featured material, inspiration and agenda in one edition.',
          kicker: 'EDITION 10 · 2026',
          headline: 'Perspectives in natural stone.',
          subheadline: 'A monthly curation of matter, projects and encounters.',
          body: richText('This edition brings together references to see natural stone from new angles: from material selection to its presence in the built space.'),
          articleTitle: 'How light transforms the perception of stone',
          articleText: 'Texture, finish and light work together. Explore key points to consider when specifying a material.',
          articleUrl: 'https://www.granistone.com.br/',
          materialName: 'Amazon Green',
          features: 'Organic expression\nTechnical information on request',
          applications: 'Signature projects subject to technical validation',
          eventTitle: 'Granistone agenda',
          eventText: 'Follow our channels for upcoming meetings and presentations.',
          projectTitle: 'Featured project',
          projectText: 'A space where material, proportion and light create a singular atmosphere.',
          cta: 'Explore the edition',
          ctaUrl: 'https://www.granistone.com.br/',
        }),
      },
    }),
    createCampaign({
      title: 'Comunicado de atendimento',
      date: '2026-10-12',
      campaignType: 'Aviso',
      audience: 'Clientes e parceiros',
      objective: 'Informar uma alteração de atendimento com clareza e cordialidade.',
      template: 'notice',
      status: 'Pendente',
      language: 'PT',
      alignment: 'center',
      demo: true,
      content: {
        pt: content({
          subject: 'Comunicado · atendimento em 12 de outubro',
          preheader: 'Confira nosso horário e programe seu contato com a equipe.',
          kicker: '12 DE OUTUBRO',
          headline: 'Uma pausa no calendário.',
          subheadline: 'Nosso atendimento retorna normalmente no próximo dia útil.',
          body: richText('Durante o feriado, nossos canais digitais permanecem disponíveis. Retornaremos às solicitações por ordem de recebimento.\nAgradecemos a compreensão e desejamos um excelente dia.'),
        }),
        en: emptyContent(),
      },
    }),
  ];
}
