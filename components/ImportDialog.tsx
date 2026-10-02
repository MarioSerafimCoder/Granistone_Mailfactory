'use client';
import { useState } from 'react';
import { Upload, FileSpreadsheet, Check, Download } from 'lucide-react';
import { Modal } from './ui';
import { parseWorkbook, exampleWorkbook, type ImportResult } from '@/import/xlsx';
import { downloadFile } from '@/export/download';
import type { Campaign } from '@/types/campaign';
import { campaignFingerprint } from '@/campaigns/identity';
export function ImportDialog({
  existing,
  onImport,
  onClose,
}: {
  existing: Campaign[];
  onImport: (c: Campaign[], focusPending?: boolean) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<ImportResult>();
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const known = new Set(existing.filter((c) => !c.demo).map(campaignFingerprint));
  const unique =
    result?.campaigns.filter((c) => {
      const key = campaignFingerprint(c);
      if (known.has(key)) return false;
      known.add(key);
      return true;
    }) ?? [];
  const repeated = result ? result.campaigns.length - unique.length : 0;
  const missingDate = unique.filter(c => !c.date).length;
  const needsReview = unique.filter(c => c.importIssues?.length).length;
  async function read(file?: File) {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Selecione um arquivo XLSX ou XLS.');
      if (file.size > 10_000_000) throw new Error('O limite é 10 MB por planilha.');
      setFileName(file.name);
      const next = parseWorkbook(await file.arrayBuffer());
      setResult(next);
      if (!next.campaigns.length)
        setError('Nenhuma campanha encontrada. Confira o modelo de planilha abaixo.');
    } catch (caught) {
      setResult(undefined);
      const message = caught instanceof Error ? caught.message : '';
      setError(
        message.startsWith('Selecione') || message.startsWith('O limite')
          ? message
          : 'O arquivo selecionado não parece ser uma planilha XLSX válida. Baixe o modelo e confira o formato.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Importar planejamento" onClose={onClose} wide>
      <p className="muted">
        Transforme as linhas da sua planilha em campanhas. Você confere tudo antes de importar.
      </p>
      <label
        className="upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void read(e.dataTransfer.files[0]);
        }}
      >
        <Upload size={25} />
        <strong>
          {busy ? 'Lendo planilha…' : fileName || 'Selecione ou arraste sua planilha'}
        </strong>
        <span>XLSX ou XLS · até 10 MB · todas as abas</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          disabled={busy}
          onChange={(e) => void read(e.target.files?.[0])}
        />
      </label>
      <button
        className="text-button"
        onClick={() =>
          downloadFile(
            exampleWorkbook(),
            'planejamento-granistone.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          )
        }
      >
        <Download size={15} /> Baixar planilha modelo
      </button>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {result && result.campaigns.length > 0 && (
        <>
          <div className="import-summary">
            <FileSpreadsheet size={20} />
            <strong>{result.campaigns.length} campanhas identificadas</strong>
            <span>{result.sheets.join(', ')}</span>
          </div>
          <div className="import-stats" aria-label="Resumo da importação">
            <span><strong>{unique.length}</strong> novas</span>
            <span><strong>{repeated}</strong> já existentes</span>
            <span><strong>{missingDate}</strong> sem data</span>
            <span><strong>{needsReview}</strong> precisam de revisão</span>
            <span>
              <strong>{result.campaigns.filter((campaign) => campaign.date).length}</strong> com data
            </span>
            {(['Produto', 'Institucional', 'Newsletter', 'Aviso', 'Promocional'] as const).map(
              (type) => {
                const count = result.campaigns.filter(
                  (campaign) => campaign.campaignType === type,
                ).length;
                return count ? (
                  <span key={type}>
                    <strong>{count}</strong> {type}
                  </span>
                ) : null;
              },
            )}
            <span>
              <strong>
                {result.campaigns.filter((campaign) => campaign.language.includes('EN')).length}
              </strong>{' '}
              com EN
            </span>
            <span className={result.warnings.length ? 'has-warning' : ''}>
              <strong>{result.warnings.length}</strong> avisos
            </span>
          </div>
          <div className="import-table">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Campanha</th>
                  <th>Template sugerido</th>
                  <th>Idioma</th>
                  <th>Verificação</th>
                </tr>
              </thead>
              <tbody>
                {result.campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>{c.date || 'Sem data'}</td>
                    <td>{c.title}</td>
                    <td>{c.template}</td>
                    <td>{c.language}</td>
                    <td>
                      {c.importIssues?.length ? (
                        <span
                          className="row-warning"
                          title={c.importIssues.map((issue) => issue.message).join(' ')}
                        >
                          {c.importIssues.length} aviso{c.importIssues.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="row-ok">Pronta</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {repeated > 0 && (
            <p className="check-line">
              {repeated} duplicata(s) será(ão) ignorada(s): mesma
              data, tema, tipo, público e idioma.
            </p>
          )}
        </>
      )}
      {!!result?.warnings.length && (
        <details className="warnings">
          <summary>{result.warnings.length} observações de importação</summary>
          <ul>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          Cancelar
        </button>
        {needsReview > 0 && <button className="button" disabled={busy || !unique.length} onClick={() => { onImport(unique, true); onClose(); }}>Importar e ver pendências</button>}
        <button
          className="button primary"
          disabled={busy || !unique.length}
          onClick={() => {
            onImport(unique);
            onClose();
          }}
        >
          <Check size={16} />
          Importar {unique.length} campanhas
        </button>
      </div>
    </Modal>
  );
}
