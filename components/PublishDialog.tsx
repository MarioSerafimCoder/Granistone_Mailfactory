'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BrandSettings, Campaign, Language } from '@/types/campaign';
import type { EmailPublication, PreflightResult } from '@/types/online';
import type { SaveState } from '@/lib/workspace-sync';
import { online } from '@/lib/online';
import { hostLocalImages } from '@/lib/workspace-images';
import { Modal } from './ui';
import { downloadFile } from '@/export/download';
import { publicationSignature } from '@/lib/publication-signature';
import { languageStates } from '@/campaigns/model';

const categories = ['images', 'content', 'links', 'compatibility'] as const;
const categoryLabel = { images: 'Imagens', content: 'Conteúdo', links: 'Links', compatibility: 'Compatibilidade' };
type Step = 'idle' | 'images' | 'waiting' | 'validating' | 'ready' | 'review' | 'published';
export default function PublishDialog({ campaign, brand, language, campaignRevision, saveState, onChange, onClose }: {
  campaign: Campaign; brand: BrandSettings; language: Language; campaignRevision?: number; saveState: SaveState;
  onChange: (campaign: Campaign) => void; onClose: () => void;
}) {
  const [report, setReport] = useState<PreflightResult & { html?: string }>();
  const [versions, setVersions] = useState<EmailPublication[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [origin, setOrigin] = useState('');
  const [checked, setChecked] = useState('');
  const key = useRef('');
  const input = useMemo(() => ({ campaign, language, campaignRevision, brand: { ...brand, assetBaseUrl: brand.assetBaseUrl || origin } }), [campaign, language, campaignRevision, brand, origin]);
  const signature = JSON.stringify(input);
  const hasLocalImages = (['pt', 'en', 'es'] as const).some(lang => (['heroImage', 'applicationImage'] as const).some(field => campaign.content[lang][field].startsWith('data:')));
  useEffect(() => {
    let active = true;
    Promise.all([online.session(), online.versions(campaign.id)]).then(([session, items]) => {
      if (active) { setOrigin(session.origin); setVersions(items); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [campaign.id]);
  useEffect(() => {
    if (step !== 'waiting' || saveState !== 'saved' || hasLocalImages) return;
    let active = true;
    online.preflight(input).then(next => {
      if (!active) return;
      setReport(next); setChecked(signature); key.current = crypto.randomUUID();
      setStep(next.hasErrors ? 'review' : 'ready');
    }).catch(error => { if (active) { setMessage(error instanceof Error ? error.message : 'Validação indisponível.'); setStep('review'); } });
    return () => { active = false; };
    // The serialized input identifies the exact synchronized revision being checked.
  }, [step, saveState, hasLocalImages, signature, input]);
  async function prepare() {
    if (!origin) return;
    setBusy(true); setMessage(''); setReport(undefined); setChecked('');
    try {
      if (hasLocalImages) {
        setStep('images');
        onChange(await hostLocalImages(campaign));
        setStep('waiting');
      } else {
        setStep('validating');
        const next = await online.preflight(input);
        setReport(next); setChecked(signature); key.current = crypto.randomUUID();
        setStep(next.hasErrors ? 'review' : 'ready');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível preparar o e-mail.');
      setStep('review');
    } finally { setBusy(false); }
  }
  async function publish() {
    setBusy(true); setMessage('');
    try {
      const result = await online.publish(input, key.current || (key.current = crypto.randomUUID()));
      if (result.preflight) setReport(result.preflight);
      if (result.publication) {
        setVersions(await online.versions(campaign.id));
        setMessage(`Versão ${result.publication.version} publicada. A versão anterior permanece intacta.`);
        setStep('published'); setChecked(''); key.current = '';
      } else setStep('review');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Publicação indisponível.'); }
    finally { setBusy(false); }
  }
  const latest = versions.find(version => version.language === language);
  const dirty = !latest || (latest.sourceSignature ? latest.sourceSignature !== publicationSignature(input) : new Date(languageStates(campaign)[language].updatedAt).getTime() > new Date(latest.publishedAt).getTime());
  const canPublish = !busy && step === 'ready' && !!report && !report.hasErrors && checked === signature && saveState === 'saved' && !hasLocalImages;
  return <Modal title={`Publicar e-mail · ${language.toUpperCase()}`} onClose={onClose} wide>
    <section className="publish-section" aria-label="Status da publicação">
      <h3 className="eyebrow">STATUS</h3>
      <div className={`publish-state ${dirty ? 'dirty' : 'current'}`}><strong>{language.toUpperCase()} · {latest ? `versão publicada v${latest.version}` : 'sem versão publicada'}</strong><span>{latest ? `Última publicação: ${new Date(latest.publishedAt).toLocaleString('pt-BR')}` : 'Ainda não há uma versão online para este idioma.'}</span><small>{dirty ? 'Há alterações desde a última publicação' : 'Esta versão está publicada'}</small></div>
    </section>
    {!origin && <a href="/signin-with-chatgpt?return_to=/" target="_top">Entrar com ChatGPT para publicar</a>}
    <section className="publish-section" aria-label="Pré-flight">
      <h3 className="eyebrow">PRÉ-FLIGHT</h3>
      <p>Prepare o e-mail para hospedar imagens locais e verificar conteúdo, links e compatibilidade.</p>
      <div className="actions"><button className="button primary" disabled={busy || !origin} onClick={() => void prepare()}>Preparar para RD Station</button><button className="button" disabled={!canPublish} onClick={() => void publish()}>Publicar versão</button></div>
      {(busy || step === 'waiting') && <p role="status">{step === 'images' ? 'Preparando imagens…' : step === 'waiting' ? 'Aguardando as imagens ficarem disponíveis para a equipe…' : 'Validando conteúdo, links e compatibilidade…'}</p>}
      {report && checked === signature && <><div className="preflight-steps">{categories.map(category => {
        const checks = report.checks.filter(check => check.category === category);
        const state = checks.some(check => check.severity === 'error') ? 'error' : checks.some(check => check.severity === 'warning') ? 'warning' : 'pass';
        return <div key={category} className={`step-${state}`}><span aria-hidden="true">{state === 'pass' ? '✓' : state === 'warning' ? '!' : '×'}</span>{categoryLabel[category]}</div>;
      })}</div><p className="preflight-outcome" role="status">{report.hasErrors ? 'Corrija os itens indicados antes de publicar.' : 'Tudo pronto para publicar.'}</p><details className="preflight-details"><summary>Ver detalhes do pré-flight</summary><div className="preflight-groups">{categories.map(category => <div key={category}><h4>{categoryLabel[category]}</h4>{report.checks.filter(check => check.category === category).map(check => <p key={check.id} className={check.severity}><span>{check.severity === 'pass' ? '✓' : check.severity === 'warning' ? '!' : '×'}</span>{check.message}</p>)}</div>)}</div></details></>}
      {message && <p role={step === 'review' ? 'alert' : 'status'}>{message}</p>}
    </section>
    <section className="publish-section" aria-label="Versões publicadas"><h3 className="eyebrow">VERSÕES PUBLICADAS</h3>
      {versions.filter(v => v.language === language).length ? <div className="version-list">{versions.filter(v => v.language === language).map(v => <article key={v.id}><div><strong>v{v.version}{v.id === latest?.id ? ' · vigente' : ''}</strong><span>{new Date(v.publishedAt).toLocaleString('pt-BR')}</span></div><details className="version-actions"><summary>Ações da versão v{v.version}</summary><a href={v.url} target="_blank" rel="noreferrer">Abrir</a><button onClick={() => void navigator.clipboard.writeText(v.latestUrl)}>Copiar URL</button><button onClick={() => void navigator.clipboard.writeText(v.html)}>Copiar HTML</button><button onClick={() => downloadFile(v.html, `${v.slug}-${v.language}-v${v.version}.html`, 'text/html')}>Baixar HTML</button></details></article>)}</div> : <p>Nenhuma versão publicada em {language.toUpperCase()}.</p>}
    </section>
  </Modal>;
}
