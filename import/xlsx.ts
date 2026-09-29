import { read, utils, write } from 'xlsx';
import { aliases, normalizeKey, normalizeRow } from './normalize';
import type { Campaign } from '@/types/campaign';
export interface ImportResult {
  campaigns: Campaign[];
  warnings: string[];
  sheets: string[];
  skipped: number;
}
export function parseWorkbook(data: ArrayBuffer): ImportResult {
  const workbook = read(data, { type: 'array', cellDates: true });
  const result: ImportResult = { campaigns: [], warnings: [], sheets: [], skipped: 0 };
  for (const name of workbook.SheetNames) {
    const rows = utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      defval: '',
      blankrows: false,
    });
    const headerAt = rows.findIndex((row) =>
      row.some((cell) => aliases.title.includes(normalizeKey(cell))),
    );
    if (headerAt < 0) {
      result.warnings.push(`Aba “${name}” ignorada: cabeçalho Tema ou Nome não encontrado.`);
      continue;
    }
    result.sheets.push(name);
    const header = rows[headerAt].map(String);
    for (const [offset, row] of rows.slice(headerAt + 1).entries()) {
      if (row.every((v) => !String(v).trim())) continue;
      const { campaign, warnings } = normalizeRow(
        Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])),
      );
      const line = headerAt + offset + 2;
      result.warnings.push(...warnings.map((warning) => `Aba “${name}”, linha ${line}: ${warning}`));
      if (campaign) result.campaigns.push(campaign);
      else result.skipped++;
    }
  }
  return result;
}
export function exampleWorkbook(): ArrayBuffer {
  const book = utils.book_new();
  utils.book_append_sheet(
    book,
    utils.json_to_sheet([
      {
        'Data de disparo': '01/10/2026',
        Tema: 'Crystal Palace',
        'Tipo de conteúdo': 'Produto',
        Público: 'Arquitetos',
        Objetivo: 'Apresentar o material',
        Idioma: 'PT / EN',
        CTA: 'Conheça o material',
        'URL CTA': 'https://www.granistone.com.br',
        Observações: 'Inserir imagens e texto aprovado',
      },
      {
        'Data de disparo': '12/10/2026',
        Tema: 'Atendimento no feriado',
        'Tipo de conteúdo': 'Aviso',
        Público: 'Clientes',
        Objetivo: 'Informar horários',
        Idioma: 'PT',
        CTA: '',
        'URL CTA': '',
        Observações: 'Confirmar horários',
      },
    ]),
    'Outubro 2026',
  );
  return write(book, { type: 'array', bookType: 'xlsx' });
}
