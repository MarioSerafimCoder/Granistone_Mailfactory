'use client';
import { useState } from 'react';
import { Check, Copy, Download, FileJson } from 'lucide-react';
import { Modal } from './ui';
import { campaignFileName, downloadFile } from '@/export/download';
import { exportIssues } from '@/export/validate';
import type { BrandSettings, Campaign, Language } from '@/types/campaign';
export function ExportDialog({
  campaign,
  language,
  brand,
  html,
  onClose,
  onExported,
  onSettings,
}: {
  campaign: Campaign;
  language: Language;
  brand: BrandSettings;
  html: string;
  onClose: () => void;
  onExported: () => void;
  onSettings: () => void;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const issues = exportIssues(campaign, language, brand);
  const c = campaign.content[language];
  const name = campaignFileName(campaign, language);
  async function copy(text: string, label: string, exported = false) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} copiado.`);
      if (exported) onExported();
    } catch {
      setMessage('O navegador não permitiu copiar. Use a opção de download.');
    }
  }
  async function draft() {
    setBusy(true);
    try {
      let output = html;
      const paths = [...new Set(html.match(/\/brand\/[a-z\d._-]+/gi) ?? [])];
      for (const path of paths) {
        const response = await fetch(path);
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        const uri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        output = output.split(`"${path}"`).join(`"${uri}"`);
      }
      downloadFile(output, `${name}-local.html`, 'text/html;charset=utf-8');
      setMessage('HTML baixado com as fotos locais e a marca incorporadas. Pode ser aberto no computador. Para disparar pelo RD Station, use imagens hospedadas.');
    } catch {
      setMessage('Não foi possível preparar as imagens do rascunho.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Exportar campanha · ${language.toUpperCase()}`} onClose={onClose}>
      <p className="muted">
        O HTML exportado é o mesmo exibido no preview. Nenhum e-mail será enviado pelo Studio.
      </p>
      {issues.length ? (
        <div className="export-check">
          <strong>Antes de levar ao RD Station</strong>
          <ul>
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <button className="text-button" onClick={onSettings}>
            Abrir Marca e rodapé →
          </button>
        </div>
      ) : (
        <div className="export-ok">
          <Check size={18} />
          Conteúdo e endereços preenchidos. Faça um disparo de teste no RD Station.
        </div>
      )}
      <div className="export-grid">
        <button
          className="button primary"
          disabled={!!issues.length || !html}
          onClick={() => void copy(html, 'HTML', true)}
        >
          <Copy size={16} />
          Copiar HTML
        </button>
        <button
          className="button"
          disabled={!!issues.length || !html}
          onClick={() => {
            downloadFile(html, `${name}.html`, 'text/html;charset=utf-8');
            onExported();
            setMessage('HTML baixado.');
          }}
        >
          <Download size={16} />
          Baixar HTML
        </button>
        <button
          className="button"
          onClick={() =>
            downloadFile(JSON.stringify(campaign, null, 2), `${name}.json`, 'application/json')
          }
        >
          <FileJson size={16} />
          Baixar JSON
        </button>
        <button
          className="button"
          disabled={!c.subject}
          onClick={() => void copy(c.subject, 'Assunto')}
        >
          <Copy size={16} />
          Copiar assunto
        </button>
        <button
          className="button"
          disabled={!c.preheader}
          onClick={() => void copy(c.preheader, 'Preheader')}
        >
          <Copy size={16} />
          Copiar preheader
        </button>
      </div>
      <div className="local-export">
        <strong>Arquivo para abrir no computador</strong>
        <p>Inclui as fotos carregadas e a marca dentro do HTML. Para enviar por e-mail, publique as imagens e use a exportação para RD Station.</p>
        <button
          className="text-button draft-button"
          disabled={busy || !html}
          onClick={() => void draft()}
        >
          <Download size={15} />
          {busy ? 'Preparando…' : 'Baixar HTML com fotos locais'}
        </button>
      </div>
      {message && (
        <p role="status" className="feedback">
          {message}
        </p>
      )}
    </Modal>
  );
}
