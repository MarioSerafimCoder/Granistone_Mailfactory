'use client';
import { useEffect, useState, useRef } from 'react';
import type { BrandSettings, Campaign, Language } from '@/types/campaign';
import type { EmailPublication, PreflightResult } from '@/types/online';
import { online, uploadLocalImage } from '@/lib/online';
import { Modal } from './ui';
import { downloadFile } from '@/export/download';
export default function PublishDialog({ campaign, brand, language, onChange, onClose }: {
  campaign: Campaign; brand: BrandSettings; language: Language; onChange: (campaign: Campaign) => void; onClose: () => void;
}) {
  const [report, setReport] = useState<PreflightResult & { html?: string }>();
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
        for (const lang of ['pt', 'en', 'es'] as const) for (const field of ['heroImage', 'applicationImage'] as const) {
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
  const latest = versions.find((version) => version.language === language);
  const dirty = !latest || new Date(campaign.updatedAt).getTime() > new Date(latest.publishedAt).getTime();
  const groups = report ? (['content', 'images', 'links', 'compatibility'] as const).map((category) => ({ category, checks: report.checks.filter((check) => check.category === category) })) : [];
  const categoryLabel = { content: 'Conteúdo', images: 'Imagens', links: 'Links', compatibility: 'Compatibilidade' };
  return <Modal title={`Publicar e-mail · ${language.toUpperCase()}`} onClose={onClose} wide>
    <div className={`publish-state ${dirty ? 'dirty' : 'current'}`}><strong>{dirty ? 'Há alterações ainda não publicadas' : 'Esta versão está publicada'}</strong><span>{latest ? `Última publicação: v${latest.version} · ${new Date(latest.publishedAt).toLocaleString('pt-BR')}` : 'Ainda não há uma versão online para este idioma.'}</span></div>
    <p>O pré-flight verifica conteúdo, imagens, links e compatibilidade antes de criar uma versão fixa.</p>
    {!origin && <a href="/signin-with-chatgpt?return_to=/" target="_top">Entrar com ChatGPT para publicar</a>}
    <div className="actions">
      <button className="button" disabled={busy || !origin} onClick={() => void run('upload')}>Hospedar fotos locais</button>
      <button className="button" disabled={busy || !origin} onClick={() => void run('check')}>Executar pré-flight</button>
      <button className="button primary" disabled={busy || !report || report.hasErrors || checked !== signature} onClick={() => void run('publish')}>PUBLICAR PARA RD</button>
    </div>
    {busy && <p role="status">Processando…</p>}
    {report && <section className="preflight-report"><div className="preflight-summary"><h3>{report.hasErrors ? 'Corrija os erros antes de publicar' : 'Pré-flight concluído'}</h3><span>{report.checks.filter((item) => item.severity === 'pass').length} aprovados · {report.checks.filter((item) => item.severity === 'warning').length} avisos · {report.checks.filter((item) => item.severity === 'error').length} erros</span></div><div className="preflight-groups">{groups.map((group) => <div key={group.category}><h4>{categoryLabel[group.category]}</h4>{group.checks.map((check) => <p key={check.id} className={check.severity}><span>{check.severity === 'pass' ? '✓' : check.severity === 'warning' ? '!' : '×'}</span>{check.message}</p>)}</div>)}</div></section>}
    {message && <p role="status">{message}</p>}
    <h3>Versões publicadas</h3>
    {versions.length ? <div className="version-list">{versions.map(v => <article key={v.id}><div><strong>{v.language.toUpperCase()} · versão {v.version}</strong><span>{new Date(v.publishedAt).toLocaleString('pt-BR')}{v.id === latest?.id ? ' · vigente' : ''}</span></div><div><a className="button" href={v.url} target="_blank" rel="noreferrer">Abrir e-mail</a><button className="button" onClick={() => void navigator.clipboard.writeText(v.latestUrl)}>Copiar URL</button><button className="button" onClick={() => void navigator.clipboard.writeText(v.html)}>Copiar HTML</button><button className="button" onClick={() => downloadFile(v.html, `${v.slug}-${v.language}-v${v.version}.html`, 'text/html')}>Baixar HTML</button></div></article>)}</div> : <p>Nenhuma versão publicada.</p>}
  </Modal>;
}
