'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Field, TextArea } from './ui';
import type { Campaign, CampaignContent, Language, StoneMaterial } from '@/types/campaign';
import { plainText, richText } from '@/campaigns/model';
import MaterialSelector from './MaterialSelector';
import ImagePicker from './ImagePicker';
import type { SaveState } from '@/lib/workspace-sync';
const MailyTextEditor = dynamic(() => import('./MailyTextEditor'), {
  ssr: false,
  loading: () => <p className="muted">Carregando editor…</p>,
});
export default function ContentFields({
  campaign,
  language,
  onChange,
  saveState,
}: {
  campaign: Campaign;
  language: Language;
  onChange: (update: Partial<Campaign>) => void;
  saveState: SaveState;
}) {
  const c = campaign.content[language];
  const [revision, setRevision] = useState(0);
  const edit = (patch: Partial<CampaignContent>) =>
    onChange({ content: { ...campaign.content, [language]: { ...c, ...patch } } });
  const editSharedImage = (field: 'heroImage' | 'applicationImage', value: string, suggestedAlt?: string) =>
    onChange({
      content: {
        pt: { ...campaign.content.pt, [field]: value },
        en: { ...campaign.content.en, [field]: value },
        es: { ...campaign.content.es, [field]: value },
        [language]: { ...campaign.content[language], [field]: value, ...(suggestedAlt ? { [field === 'heroImage' ? 'heroAlt' : 'applicationAlt']: suggestedAlt } : {}) },
      },
    });
  function applyMaterial(material: StoneMaterial, replace: boolean) {
    const next = {
      ...c,
      materialName: replace || !c.materialName ? material.name : c.materialName,
      body: replace || !plainText(c.body).trim() ? richText(material.description) : c.body,
      features: replace || !c.features ? material.features.join('\n') : c.features,
      applications: replace || !c.applications ? material.applications.join('\n') : c.applications,
      heroImage: replace || !c.heroImage ? material.heroImage : c.heroImage,
      applicationImage:
        replace || !c.applicationImage ? material.slabImage || material.images[0] || '' : c.applicationImage,
    };
    onChange({
      materialId: material.id,
      content: {
        ...campaign.content,
        pt: { ...campaign.content.pt, heroImage: next.heroImage, applicationImage: next.applicationImage },
        en: { ...campaign.content.en, heroImage: next.heroImage, applicationImage: next.applicationImage },
        es: { ...campaign.content.es, heroImage: next.heroImage, applicationImage: next.applicationImage },
        [language]: next,
      },
    });
    setRevision((current) => current + 1);
  }
  const has = (id: string) => campaign.blocks.some((b) => b.id === id && b.enabled);
  return (
    <>
      <section className="form-section">
        <div className="section-caption">
          01 <h3>Na caixa de entrada</h3>
        </div>
        <Field
          label="Assunto"
          value={c.subject}
          onChange={(e) => edit({ subject: e.target.value })}
          hint={`${c.subject.length} caracteres`}
        />
        <Field
          label="Preheader"
          value={c.preheader}
          placeholder="Um complemento para o assunto"
          onChange={(e) => edit({ preheader: e.target.value })}
          hint={`${c.preheader.length} caracteres`}
        />
      </section>
      {has('specs') && (
        <section className="form-section">
          <h3>Biblioteca de materiais</h3>
          <MaterialSelector content={c} selectedId={campaign.materialId} onApply={applyMaterial} />
          <small className="muted">
            Textos de exemplo em português. Revise os dados técnicos e adicione fotos reais.
          </small>
        </section>
      )}
      <section className="form-section">
        <div className="section-caption">
          02 <h3>Conteúdo do e-mail</h3>
        </div>
        <Field
          label="Kicker / data em destaque"
          value={c.kicker}
          placeholder="GRANISTONE A ROCHA"
          onChange={(e) => edit({ kicker: e.target.value })}
        />
        <TextArea
          label="Headline"
          value={c.headline}
          placeholder="O título principal da campanha"
          onChange={(e) => edit({ headline: e.target.value })}
        />
        <Field
          label="Subheadline"
          value={c.subheadline}
          onChange={(e) => edit({ subheadline: e.target.value })}
        />
        {has('body') && (
          <div className="field">
            <span>Texto editorial</span>
            <MailyTextEditor
              key={`${campaign.id}-${language}-${revision}`}
              value={c.body}
              onChange={(body) => edit({ body })}
            />
          </div>
        )}
        {has('hero') && (
          <ImagePicker
            label="Imagem principal"
            saveState={saveState}
            value={c.heroImage}
            alt={c.heroAlt}
            recommended="1200 × 700 px"
            materialId={campaign.materialId}
            onChange={(heroImage, suggestedAlt) => editSharedImage('heroImage', heroImage, suggestedAlt)}
            onAlt={(heroAlt) => edit({ heroAlt })}
          />
        )}
        {has('application') && (
          <ImagePicker
            label="Imagem de aplicação"
            saveState={saveState}
            value={c.applicationImage}
            alt={c.applicationAlt}
            recommended="1200 × 800 px"
            materialId={campaign.materialId}
            onChange={(applicationImage, suggestedAlt) => editSharedImage('applicationImage', applicationImage, suggestedAlt)}
            onAlt={(applicationAlt) => edit({ applicationAlt })}
          />
        )}
      </section>
      {has('specs') && (
        <section className="form-section">
          <h3>Material</h3>
          <Field
            label="Nome do material"
            value={c.materialName}
            onChange={(e) => edit({ materialName: e.target.value })}
          />
          <TextArea
            label="Características"
            value={c.features}
            onChange={(e) => edit({ features: e.target.value })}
          />
          <TextArea
            label="Aplicações"
            value={c.applications}
            onChange={(e) => edit({ applications: e.target.value })}
          />
        </section>
      )}
      {has('availability') && (
        <section className="form-section">
          <TextArea
            label="Disponibilidade"
            value={c.availability}
            onChange={(e) => edit({ availability: e.target.value })}
          />
        </section>
      )}
      {has('article') && (
        <section className="form-section">
          <h3>Artigo secundário</h3>
          <Field
            label="Título do artigo"
            value={c.articleTitle}
            onChange={(e) => edit({ articleTitle: e.target.value })}
          />
          <TextArea
            label="Resumo do artigo"
            value={c.articleText}
            onChange={(e) => edit({ articleText: e.target.value })}
          />
          <Field
            label="Link do artigo"
            value={c.articleUrl}
            onChange={(e) => edit({ articleUrl: e.target.value })}
          />
        </section>
      )}
      {has('event') && (
        <section className="form-section">
          <h3>Evento</h3>
          <Field
            label="Nome do evento"
            value={c.eventTitle}
            onChange={(e) => edit({ eventTitle: e.target.value })}
          />
          <TextArea
            label="Descrição do evento"
            value={c.eventText}
            onChange={(e) => edit({ eventText: e.target.value })}
          />
        </section>
      )}
      {has('project') && (
        <section className="form-section">
          <h3>Projeto</h3>
          <Field
            label="Nome do projeto"
            value={c.projectTitle}
            onChange={(e) => edit({ projectTitle: e.target.value })}
          />
          <TextArea
            label="Descrição do projeto"
            value={c.projectText}
            onChange={(e) => edit({ projectText: e.target.value })}
          />
        </section>
      )}
      {has('cta') && (
        <section className="form-section">
          <div className="section-caption">
            03 <h3>Próximo passo</h3>
          </div>
          <Field
            label="Texto do CTA"
            value={c.cta}
            onChange={(e) => edit({ cta: e.target.value })}
          />
          <Field
            label="URL do CTA"
            type="url"
            value={c.ctaUrl}
            placeholder="https://"
            onChange={(e) => edit({ ctaUrl: e.target.value })}
          />
        </section>
      )}
    </>
  );
}
