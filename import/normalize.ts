import { SSF } from 'xlsx';
import { createCampaign, emptyContent, richText } from '@/campaigns/model';
import { suggestTemplate } from '@/templates/registry';
import { campaignSourceKey, stableImportId } from '@/campaigns/identity';
import {
  statuses,
  type Campaign,
  type CampaignType,
  type ImportIssue,
} from '@/types/campaign';
export const normalizeKey = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, ' ');
export const aliases = {
  title: ['tema', 'nome', 'titulo', 'campanha', 'title'],
  date: ['data', 'data de disparo', 'disparo', 'date'],
  campaignType: ['tipo', 'tipo de conteudo', 'conteudo', 'campaigntype', 'type'],
  audience: ['publico', 'segmento', 'audiencia', 'audience'],
  objective: ['objetivo', 'objective'],
  language: ['idioma', 'lingua', 'language'],
  cta: ['cta', 'chamada para acao'],
  notes: ['observacoes', 'observacao', 'notas', 'notes'],
  approach: ['abordagem'],
  ctaUrl: ['url cta', 'link cta', 'url', 'link'],
  status: ['status', 'situacao'],
  subject: ['assunto', 'subject'],
  preheader: ['preheader', 'pre header'],
  body: ['texto', 'body'],
};
export function parseDate(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'number') {
    const d = SSF.parse_date_code(value);
    return d ? validDate(d.y, d.m, d.d) : '';
  }
  if (value instanceof Date)
    return validDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  const s = String(value).trim();
  const br = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  return br ? validDate(+br[3], +br[2], +br[1]) : iso ? validDate(+iso[1], +iso[2], +iso[3]) : '';
}
function validDate(y: number, m: number, d: number): string {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
    ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    : '';
}
export function normalizeRow(row: Record<string, unknown>): {
  campaign?: Campaign;
  warnings: string[];
} {
  const normalized = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeKey(k), v]));
  const getRaw = (key: keyof typeof aliases) =>
    aliases[key].map((k) => normalized[k]).find((v) => v !== undefined && v !== '');
  const get = (key: keyof typeof aliases) => String(getRaw(key) ?? '').trim();
  const title = get('title');
  if (!title) return { warnings: ['Linha sem tema/nome ignorada.'] };
  const type = normalizeKey(get('campaignType'));
  const audience = get('audience');
  const campaignType: CampaignType = /newsletter|boletim/.test(type)
    ? 'Newsletter'
    : /aviso|feriado|comunicado|data comemorativa|notice/.test(type)
      ? 'Aviso'
      : /produto|product/.test(type)
        ? 'Produto'
        : /promoc|comercial/.test(type + normalizeKey(get('approach')))
          ? 'Promocional'
          : 'Institucional';
  const lang = normalizeKey(get('language'));
  const hasPt = /\bpt\b|portug/.test(lang);
  const hasEn = /\ben\b|english|ingles/.test(lang);
  const hasEs = /\bes\b|spanish|espanhol/.test(lang);
  const language: Campaign['language'] = hasPt && hasEn && hasEs ? 'PT / EN / ES'
    : hasPt && hasEn || /biling/.test(lang) ? 'PT / EN'
      : hasPt && hasEs ? 'PT / ES'
        : hasEn && hasEs ? 'EN / ES'
          : hasEs ? 'ES'
            : hasEn ? 'EN' : 'PT';
  const rawDate = get('date');
  const date = parseDate(getRaw('date'));
  const warnings: string[] = [];
  const importIssues: ImportIssue[] = [];
  if (!rawDate) {
    importIssues.push({code:'missing-date',field:'date',severity:'warning',message:'Data de disparo não informada.'});
  } else if (!date) {
    importIssues.push({code:'invalid-date',field:'date',severity:'warning',message:'Data inválida; informe DD/MM/AAAA.'});
  }
  if (!type) importIssues.push({code:'missing-type',field:'campaignType',severity:'warning',message:'Tipo não identificado; usado Institucional.'});
  if (!audience) importIssues.push({code:'missing-audience',field:'audience',severity:'warning',message:'Público não identificado.'});
  if (!get('language')) importIssues.push({code:'missing-language',field:'language',severity:'warning',message:'Idioma não identificado; usado PT.'});
  warnings.push(...importIssues.map((issue) => `“${title}”: ${issue.message}`));
  const status =
    statuses.find((s) => normalizeKey(s) === normalizeKey(get('status'))) ?? 'Pendente';
  const content = {
    ...emptyContent(),
    headline: title,
    subject: get('subject') || title,
    preheader: get('preheader'),
    body: richText(get('body')),
    cta: get('cta'),
    ctaUrl: get('ctaUrl'),
  };
  const sourceKey = campaignSourceKey({date, title, audience, language, campaignType});
  return {
    campaign: createCampaign({
      id: stableImportId(sourceKey),
      sourceKey,
      importIssues,
      title,
      date,
      audience,
      campaignType,
      objective: get('objective'),
      notes: get('notes'),
      language,
      status,
      template: suggestTemplate(campaignType, audience),
      content: {
        pt: ['EN', 'ES', 'EN / ES'].includes(language) ? emptyContent() : content,
        en: language === 'EN' ? content : emptyContent(),
        es: language === 'ES' ? content : emptyContent(),
      },
    }),
    warnings,
  };
}
