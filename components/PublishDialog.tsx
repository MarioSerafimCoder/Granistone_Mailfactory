'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BrandSettings, Campaign, Language } from '@/types/campaign';
import type { EmailPublication, PreflightResult } from '@/types/online';
import type { SaveState } from '@/lib/workspace-sync';
import { online } from '@/lib/online';
import { hasLocalImages as containsLocalImages, hostLocalImages } from '@/lib/workspace-images';
import { prepareBrand, prepareCampaignImages } from '@/lib/prepare-email';
import { mergeCampaignPatch } from '@/lib/canvas-model';
import { Modal } from './ui';
import { downloadFile } from '@/export/download';
import { publicationSignature } from '@/lib/publication-signature';
import { languageStates } from '@/campaigns/model';

const categories = ['images', 'content', 'links', 'compatibility'] as const;
const categoryLabel = { images: 'Imagens', content: 'Conteúdo', links: 'Links', compatibility: 'Compatibilidade' };
type Step = 'idle' | 'images' | 'waiting' | 'ready' | 'review' | 'published';
export default function PublishDialog({ campaign, brand, language, campaignRevision, saveState, onChange, onClose }: {
  campaign: Campaign; brand: BrandSettings; language: Language; campaignRevision?: number; saveState: SaveState;
  onChange: (campaign: Partial<Campaign>) => void; onClose: () => void;
}) {
  const [report, setReport] = useState<PreflightResult & { html?: string }>();
  const [versions, setVersions] = useState<EmailPublication[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [origin, setOrigin] = useState('');
  const [checked, setChecked] = useState('');
  const key = useRef('');
  const latestInput = useRef({ campaign, onChange });
  useLayoutEffect(() => { latestInput.current = { campaign, onChange }; }, [campaign, onChange]);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  const input = useMemo(() => ({ campaign, language, campaignRevision, brand: prepareBrand(brand, origin) }), [campaign, language, campaignRevision, brand, origin]);
  const signature = JSON.stringify(input);
  const hasLocalImages = containsLocalImages(campaign) || containsLocalImages(input.brand);
  useEffect(() => {
    let active = true;
    online.session().then(session => {
      if (active && session.editor) setOrigin(session.origin);
    }).catch(error => { if (active) setMessage(error.message); });
    online.versions(campaign.id).then(items => { if (active) setVersions(items); })
      .catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [campaign.id]);
  useEffect(() => {
    if (!origin) return;
    const timer = setTimeout(() => void prepare(), 0);
    return () => clearTimeout(timer);
    // Automatically prepare once the authenticated publication origin is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);
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
    const sequence = ++request.current;
    const source = latestInput.current.campaign;
    setBusy(true); setMessage(''); setReport(undefined); setChecked('');
    try {
      setStep('images');
      const prepared = await hostLocalImages(prepareCampaignImages(source, origin));
      if (sequence !== request.current) return;
      if (JSON.stringify(prepared) !== JSON.stringify(source)) {
        latestInput.current.onChange(mergeCampaignPatch(source, latestInput.current.campaign, prepared));
      }
      setStep('waiting');
    } catch (error) {
      if (sequence !== request.current) return;
      setMessage(error instanceof Error ? error.message : 'Não foi possível preparar o e-mail.');
      setStep('review');
    } finally { if (sequence === request.current) setBusy(false); }
  }
  async function publish() {
    if (!canPublish) return;
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
      <p>As imagens locais são hospedadas e as descrições ausentes são preenchidas automaticamente. Confira o resultado antes de publicar.</p>
      <div className="actions"><button className="button" disabled={busy || !origin} onClick={() => void prepare()}>{step === 'idle' ? 'Preparar para RD Station' : 'Verificar novamente'}</button><button className="button primary" disabled={!canPublish} onClick={() => void publish()}>Publicar versão</button></div>
      {(busy || step === 'waiting') && <p role="status">{step === 'images' ? 'Preparando imagens e descrições…' : saveState === 'saved' && !hasLocalImages ? 'Validando conteúdo, links e compatibilidade…' : 'Aguardando o salvamento da campanha e das imagens na nuvem…'}</p>}
      {step === 'waiting' && ['error', 'offline', 'paused', 'conflict', 'local'].includes(saveState) && <p role="alert">A campanha precisa estar salva na nuvem. Volte ao editor para sincronizar ou resolver as alterações pendentes.</p>}
      {step === 'waiting' && containsLocalImages(input.brand) && <p role="alert">O logo ainda está local. Salve a configuração em Marca e rodapé para hospedá-lo.</p>}
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
