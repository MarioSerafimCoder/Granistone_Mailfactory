'use client';
import { useMemo, useState } from 'react';
import { Languages, Sparkles } from 'lucide-react';
import type { Campaign, Language } from '@/types/campaign';
import { online } from '@/lib/online';
import { applyTranslation, translationItems } from '@/lib/translation';
import { Modal } from './ui';

export default function TranslateDialog({ campaign, target, onApply, onClose }: {
  campaign: Campaign;
  target: 'en' | 'es';
  onApply: (campaign: Campaign, language: Language) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(true);
  const label = target === 'en' ? 'inglês' : 'espanhol';
  const items = useMemo(() => translationItems(campaign.content.pt), [campaign.content.pt]);
  const hasTarget = translationItems(campaign.content[target]).length > 0;
  async function generate() {
    setBusy(true); setError('');
    try {
      if (!items.length) throw new Error('Escreva primeiro o conteúdo em português.');
      const translated = await online.translate({ target, items });
      const generated = applyTranslation(campaign.content.pt, campaign.content[target], translated);
      const next = replace || !hasTarget ? generated : {
        ...campaign.content[target],
        ...Object.fromEntries(Object.entries(generated).filter(([key, value]) => {
          const current = campaign.content[target][key as keyof typeof generated];
          return key === 'body' || (typeof current === 'string' && !current.trim() && typeof value === 'string');
        })),
      };
      onApply({
        ...campaign,
        language: target === 'en'
          ? campaign.language.includes('ES') ? 'PT / EN / ES' : 'PT / EN'
          : campaign.language.includes('EN') ? 'PT / EN / ES' : 'PT / ES',
        content: { ...campaign.content, [target]: next },
        updatedAt: new Date().toISOString(),
      }, target);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível traduzir agora.');
    } finally { setBusy(false); }
  }
  return <Modal title={`Converter para ${label}`} onClose={onClose}>
    <div className="translation-intro">
      <span><Languages size={22} /></span>
      <div><strong>O português será preservado</strong><p>A tradução cria uma versão independente. Imagens, links e formatação continuam iguais.</p></div>
    </div>
    {hasTarget && <fieldset className="translation-options">
      <legend>Já existe conteúdo em {label}</legend>
      <label><input type="radio" checked={replace} onChange={() => setReplace(true)} /> Atualizar toda a versão</label>
      <label><input type="radio" checked={!replace} onChange={() => setReplace(false)} /> Preencher apenas campos vazios</label>
    </fieldset>}
    <p className="muted">Revise nomes de materiais, medidas e termos técnicos antes de publicar.</p>
    {error && <p className="alert" role="alert">{error}</p>}
    <div className="modal-actions">
      <button className="button" onClick={onClose} disabled={busy}>Cancelar</button>
      <button className="button primary" onClick={() => void generate()} disabled={busy || !items.length}>
        <Sparkles size={15} /> {busy ? 'Traduzindo…' : `Gerar em ${label}`}
      </button>
    </div>
  </Modal>;
}
