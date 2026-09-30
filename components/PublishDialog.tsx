'use client';
import { useEffect, useState, useRef } from 'react';
import type { BrandSettings, Campaign, Language } from '@/types/campaign';
import type { EmailPublication, PreflightResult } from '@/types/online';
import { online, uploadLocalImage } from '@/lib/online';
import { Modal } from './ui';
export default function PublishDialog({ campaign, brand, language, onChange, onClose }: {
  campaign: Campaign; brand: BrandSettings; language: Language; onChange: (campaign: Campaign) => void; onClose: () => void;
}) {
  const [report, setReport] = useState<PreflightResult>();
  const [versions, setVersions] = useState<EmailPublication[]>([]);
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');
  const key = useRef('');
  const input = { campaign, language, brand: { ...brand, assetBaseUrl: brand.assetBaseUrl || origin } };
  const signature = JSON.stringify(input);
  const [checked, setChecked] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([online.session(), online.versions(campaign.id)]).then(([session, items]) => {
      if (active) { setOrigin(session.origin); setVersions(items); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [campaign.id]);
  async function run(action: 'upload' | 'check' | 'publish') {
    setBusy(true); setMessage('');
    try {
      if (action === 'upload') {
        const next = structuredClone(campaign); const cache = new Map<string, string>();
        for (const lang of ['pt', 'en'] as const) for (const field of ['heroImage', 'applicationImage'] as const) {
          const uri = next.content[lang][field];
          if (!uri.startsWith('data:')) continue;
          if (!cache.has(uri)) cache.set(uri, (await uploadLocalImage(uri, next.content[lang][field === 'heroImage' ? 'heroAlt' : 'applicationAlt'])).url);
          next.content[lang][field] = cache.get(uri)!;
        }
        onChange(next); setReport(undefined); setMessage('Fotos hospedadas. As URLs públicas foram aplicadas ao rascunho.');
      } else if (action === 'check') {
        setReport(await online.preflight(input)); setChecked(signature); key.current = crypto.randomUUID();
      } else {
        const result = await online.publish(input, key.current || (key.current = crypto.randomUUID()));
        setReport(result.preflight);
        if (result.publication) {
          setVersions(await online.versions(campaign.id));
          setMessage(`Versão ${result.publication.version} publicada. A versão anterior permanece intacta.`);
          setChecked(''); key.current = '';
        }
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Operação indisponível.'); }
    finally { setBusy(false); }
  }
  return <Modal title={`Publicar e-mail · ${language.toUpperCase()}`} onClose={onClose} wide>
    <p>Publique uma versão fixa do e-mail. Seus rascunhos continuam salvos neste navegador.</p>
    {!origin && <a href="/signin-with-chatgpt?return_to=/" target="_top">Entrar com ChatGPT para publicar</a>}
    <div className="actions">
      <button className="button" disabled={busy || !origin} onClick={() => void run('upload')}>Hospedar fotos locais</button>
      <button className="button" disabled={busy || !origin} onClick={() => void run('check')}>Executar pré-flight</button>
      <button className="button primary" disabled={busy || !report || report.hasErrors || checked !== signature} onClick={() => void run('publish')}>Publicar nova versão</button>
    </div>
    {busy && <p role="status">Processando…</p>}
    {report && <section><h3>{report.hasErrors ? 'Corrija os erros antes de publicar' : 'Pré-flight concluído'}</h3><ul>
      {report.checks.filter(c => c.severity !== 'pass').map(c => <li key={c.id}><strong>{c.severity === 'error' ? 'Erro' : 'Aviso'}:</strong> {c.message}</li>)}
    </ul></section>}
    {message && <p role="status">{message}</p>}
    <h3>Versões publicadas</h3>
    {versions.length ? <ul>{versions.map(v => <li key={v.id}><a href={v.url} target="_blank" rel="noreferrer">{v.language.toUpperCase()} · v{v.version} · {new Date(v.publishedAt).toLocaleString('pt-BR')}</a> · <a href={v.latestUrl} target="_blank" rel="noreferrer">Versão vigente</a></li>)}</ul> : <p>Nenhuma versão publicada.</p>}
  </Modal>;
}
