'use client';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Monitor,
  Smartphone,
  Languages,
} from 'lucide-react';
import type { BrandSettings, Campaign, Language, TemplateId } from '@/types/campaign';
import { campaignTypes, statuses } from '@/types/campaign';
import { changeTemplate, editCampaign, languageStates } from '@/campaigns/model';
import { saveLabels } from '@/lib/workspace-sync';
import { editorName, activityTime } from '@/lib/workspace-display';
import type { SyncMetadata } from '@/types/workspace';
import { templates, getTemplate, blockLabels, suggestTemplate } from '@/templates/registry';
import { Field, Select, TextArea, Modal } from './ui';
import ImagePicker from './ImagePicker';
import type { ImageSlot } from '@/lib/images';
import ContentFields from './ContentFields';
import { ExportDialog } from './ExportDialog';
import PublishDialog from './PublishDialog';
import type { SaveState } from '@/lib/use-studio';
import { renderEmail } from '@/export/render';
import TranslateDialog from './TranslateDialog';
export default function CampaignEditor({
  campaign,
  brand,
  onChange,
  onBack,
  onSettings,
  saveState,
  campaignRevision,
  activity,
  onHistory,
}: {
  campaign: Campaign;
  brand: BrandSettings;
  onChange: (c: Campaign) => void;
  onBack: () => void;
  onSettings: () => void;
  saveState: SaveState;
  campaignRevision?: number;
  activity?: NonNullable<SyncMetadata['activity']>[string];
  onHistory: () => void;
}) {
  const [language, setLanguage] = useState<Language>(campaign.language === 'EN' ? 'en' : campaign.language === 'ES' ? 'es' : 'pt');
  const [translateTarget, setTranslateTarget] = useState<'en' | 'es'>();
  const [tab, setTab] = useState('content');
  const [mobile, setMobile] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [imageSlot, setImageSlot] = useState<ImageSlot>();
  const [editImages, setEditImages] = useState(true);
  const [preview, setPreview] = useState({ html: '', editorHtml: '', signature: '', error: '' });
  const [loadedPreview, setLoadedPreview] = useState('');
  const previewSource = editImages ? preview.editorHtml : preview.html;
  const signature = JSON.stringify({ campaign, language, brand });
  const ready = preview.signature === signature && !!preview.html;
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all([
        renderEmail(campaign, language, brand),
        renderEmail(campaign, language, brand, true),
      ])
        .then(([html, editorHtml]) => {
          if (!cancelled) setPreview({ html, editorHtml, signature, error: '' });
        })
        .catch((error: Error) => {
          if (!cancelled) {
            setPreview({
              html: '',
              editorHtml: '',
              signature,
              error: error.message || 'Não foi possível gerar o preview.',
            });
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [brand, campaign, language, signature]);
  const update = (patch: Partial<Campaign>) => onChange(editCampaign(campaign, patch, language));
  const imageField = imageSlot === 'application' ? 'applicationImage' : 'heroImage';
  const altField = imageSlot === 'application' ? 'applicationAlt' : 'heroAlt';
  const resolvedIssues = (field: NonNullable<Campaign['importIssues']>[number]['field']) =>
    campaign.importIssues?.filter((issue) => issue.field !== field);
  function reorder(index: number, direction: number) {
    const blocks = [...campaign.blocks];
    [blocks[index], blocks[index + direction]] = [blocks[index + direction], blocks[index]];
    update({ blocks });
  }
  return (
    <div className="editor-page">
      <div className="editor-heading">
        <div className="editor-name">
          <button className="icon-button" aria-label="Voltar às campanhas" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <span className="eyebrow">CAMPANHA {campaign.demo ? '· DEMONSTRAÇÃO' : ''}</span>
            <h1>{campaign.title}</h1>
          </div>
        </div>
        <div className="actions">
          <span className={`save-indicator ${saveState === 'error' ? 'unsaved' : ''}`} role="status">
            <Check size={14} />
            {saveLabels[saveState]}
          </span>
          {activity?.updatedAt && <span className="editor-activity" title={activityTime(activity.updatedAt)}>Última alteração por {editorName(activity.updatedBy)} · {activityTime(activity.updatedAt)}</span>}
          {campaignRevision && <button className="text-button" onClick={onHistory}>Histórico</button>}
          <select
            aria-label="Status da campanha"
            title={`Status de ${language.toUpperCase()}`}
            value={languageStates(campaign)[language].status}
            onChange={(e) => update({ status: e.target.value as Campaign['status'] })}
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <small className="language-status-label">{language.toUpperCase()}</small>
          <button className="button primary" disabled={!ready} onClick={() => setExportOpen(true)}>
            <Download size={16} />
            Exportar
          </button>
          <button className="button" disabled={['saving', 'conflict', 'offline', 'error'].includes(saveState)} onClick={() => setPublishOpen(true)}>Publicar online</button>
        </div>
      </div>
      {!!campaign.importIssues?.length && (
        <div className="import-issue-banner" role="status">
          <AlertCircle size={17} />
          <div>
            <strong>Revise os dados trazidos da planilha</strong>
            <span>{campaign.importIssues.map((issue) => issue.message).join(' ')}</span>
          </div>
        </div>
      )}
      <div className="editor-workspace">
        <div className="edit-panel">
          <div className="language-tabs" aria-label="Idioma do conteúdo">
            <button className={language === 'pt' ? 'active' : ''} onClick={() => setLanguage('pt')}>
              PORTUGUÊS
            </button>
            <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
              ENGLISH
            </button>
            <button className={language === 'es' ? 'active' : ''} onClick={() => setLanguage('es')}>
              ESPAÑOL
            </button>
          </div>
          <div className="translation-bar">
            <span><Languages size={14} /> Tradução a partir do português</span>
            <div>
              <button type="button" disabled={language === 'en'} onClick={() => setTranslateTarget('en')}>Converter para inglês</button>
              <button type="button" disabled={language === 'es'} onClick={() => setTranslateTarget('es')}>Converter para espanhol</button>
            </div>
          </div>
          <div className="editor-tabs">
            <button className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')}>
              Conteúdo
            </button>
            <button
              className={tab === 'planning' ? 'active' : ''}
              onClick={() => setTab('planning')}
            >
              Planejamento
            </button>
            <button className={tab === 'blocks' ? 'active' : ''} onClick={() => setTab('blocks')}>
              Estrutura
            </button>
          </div>
          <div className="editor-fields">
            {tab === 'content' && (
              <ContentFields campaign={campaign} language={language} onChange={update} saveState={saveState} />
            )}
            {tab === 'planning' && (
              <>
                <section className="form-section">
                  <h3>Planejamento da campanha</h3>
                  <Field
                    label="Nome da campanha"
                    value={campaign.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                  <Field
                    label="Data de disparo"
                    type="date"
                    value={campaign.date}
                    onChange={(e) =>
                      update({
                        date: e.target.value,
                        importIssues: e.target.value
                          ? resolvedIssues('date')
                          : campaign.importIssues,
                      })
                    }
                  />
                  <Select
                    label="Tipo de conteúdo"
                    value={campaign.campaignType}
                    onChange={(e) => {
                      const campaignType = e.target.value as Campaign['campaignType'];
                      update({
                        ...changeTemplate(
                          campaign,
                          suggestTemplate(campaignType, campaign.audience),
                        ),
                        campaignType,
                        importIssues: resolvedIssues('campaignType'),
                        status: undefined,
                      });
                    }}
                  >
                    {campaignTypes.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                  <Field
                    label="Público"
                    value={campaign.audience}
                    onChange={(e) => {
                      const audience = e.target.value;
                      update({
                        ...changeTemplate(
                          campaign,
                          suggestTemplate(campaign.campaignType, audience),
                        ),
                        audience,
                        importIssues: audience
                          ? resolvedIssues('audience')
                          : campaign.importIssues,
                        status: undefined,
                      });
                    }}
                  />
                  <TextArea
                    label="Objetivo"
                    value={campaign.objective}
                    onChange={(e) => update({ objective: e.target.value })}
                  />
                  <Select
                    label="Idiomas planejados"
                    value={campaign.language}
                    onChange={(e) =>
                      update({
                        language: e.target.value as Campaign['language'],
                        importIssues: resolvedIssues('language'),
                      })
                    }
                  >
                    <option>PT</option>
                    <option>EN</option>
                    <option>ES</option>
                    <option>PT / EN</option>
                    <option>PT / ES</option>
                    <option>EN / ES</option>
                    <option>PT / EN / ES</option>
                  </Select>
                  <TextArea
                    label="Observações internas"
                    value={campaign.notes}
                    onChange={(e) => update({ notes: e.target.value })}
                  />
                </section>
              </>
            )}
            {tab === 'blocks' && (
              <>
                <section className="form-section">
                  <h3>Template Granistone</h3>
                  <Select
                    label="Template"
                    value={campaign.template}
                    onChange={(e) =>
                      update({
                        ...changeTemplate(campaign, e.target.value as TemplateId),
                        status: undefined,
                      })
                    }
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                  <p className="muted">{getTemplate(campaign.template).description}</p>
                  <Select
                    label="Alinhamento"
                    value={campaign.alignment}
                    onChange={(e) => update({ alignment: e.target.value as Campaign['alignment'] })}
                  >
                    <option value="left">À esquerda</option>
                    <option value="center">Centralizado</option>
                  </Select>
                </section>
                <section className="form-section">
                  <h3>Blocos do e-mail</h3>
                  <div className="fixed-block">
                    Cabeçalho Granistone <span>Fixo</span>
                  </div>
                  {campaign.blocks.map((b, i) => (
                    <div className="block-control" key={b.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={b.enabled}
                          onChange={(e) =>
                            update({
                              blocks: campaign.blocks.map((block) =>
                                block.id === b.id ? { ...block, enabled: e.target.checked } : block,
                              ),
                            })
                          }
                        />
                        {blockLabels[b.id]}
                      </label>
                      {getTemplate(campaign.template).reorder && (
                        <div>
                          <button
                            className="icon-button"
                            disabled={i === 0}
                            aria-label={`Subir ${blockLabels[b.id]}`}
                            onClick={() => reorder(i, -1)}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            className="icon-button"
                            disabled={i === campaign.blocks.length - 1}
                            aria-label={`Descer ${blockLabels[b.id]}`}
                            onClick={() => reorder(i, 1)}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="fixed-block">
                    Rodapé Granistone <span>Fixo</span>
                  </div>
                  <button className="text-button" onClick={onSettings}>
                    Configurar marca e rodapé →
                  </button>
                </section>
              </>
            )}
          </div>
        </div>
        <div className="preview-panel">
          <div className="canvas-mode">
            <div>
              <button className={editImages ? 'active' : ''} onClick={() => setEditImages(true)}>Montar e-mail</button>
              <button className={!editImages ? 'active' : ''} onClick={() => setEditImages(false)}>Visualizar final</button>
            </div>
            <span>{editImages ? 'Clique nas áreas de imagem para adicionar ou trocar fotos' : 'HTML final, sem os controles de edição'}</span>
          </div>
          <div className="preview-toolbar">
            <div>
              <span className="eyebrow">PREVIEW DO E-MAIL</span>
              <span className="preview-size">{mobile ? '375' : '600'} px</span>
            </div>
            <div className="device-tabs">
              <button
                className={!mobile ? 'active' : ''}
                aria-label="Preview desktop"
                onClick={() => setMobile(false)}
              >
                <Monitor size={16} />
                <span>Desktop</span>
              </button>
              <button
                className={mobile ? 'active' : ''}
                aria-label="Preview mobile"
                onClick={() => setMobile(true)}
              >
                <Smartphone size={16} />
                <span>Mobile</span>
              </button>
            </div>
          </div>
          <div className="preview-stage">
            <div className="mail-envelope">
              <span>Assunto</span>
              <strong>{campaign.content[language].subject || 'Seu assunto aparece aqui'}</strong>
              <small>{campaign.content[language].preheader || 'Preheader do e-mail'}</small>
            </div>
            {preview.error ? (
              <p className="alert" role="alert">
                {preview.error}
              </p>
            ) : preview.html ? (
              <iframe
                title={`Preview ${mobile ? 'mobile' : 'desktop'} do e-mail`}
                sandbox="allow-same-origin"
                srcDoc={previewSource}
                onLoad={(event) => {
                  const document = event.currentTarget.contentDocument;
                  if (!document) return;
                  const choose = (target: EventTarget | null) => {
                    const element = target as HTMLElement | null;
                    const slot = element?.closest?.('[data-image-slot]')?.getAttribute('data-image-slot');
                    if (slot === 'hero' || slot === 'application') setImageSlot(slot);
                  };
                  document.addEventListener('click', (click) => { click.preventDefault(); if (editImages) choose(click.target); });
                  document.addEventListener('keydown', (key) => {
                    if (editImages && (key.key === 'Enter' || key.key === ' ')) {
                      if ((key.target as HTMLElement)?.closest?.('[data-image-slot]')) {
                        key.preventDefault(); choose(key.target);
                      }
                    }
                  });
                  setLoadedPreview(previewSource);
                }}
                aria-busy={loadedPreview !== previewSource}
                style={{ width: mobile ? 375 : 600, pointerEvents: loadedPreview === previewSource ? 'auto' : 'none' }}
              />
            ) : (
              <div className="preview-loading">Preparando seu e-mail…</div>
            )}
            <div className="preview-caption">
              {ready ? editImages ? 'Layout editável · Atualizado' : 'HTML final · Atualizado' : 'Atualizando preview…'}
              <span>{getTemplate(campaign.template).name}</span>
            </div>
          </div>
        </div>
      </div>
      {imageSlot && <Modal title={imageSlot === 'hero' ? 'Imagem principal' : 'Imagem de aplicação'} onClose={() => setImageSlot(undefined)}>
        <ImagePicker
          key={`${imageSlot}-${language}`}
          label={imageSlot === 'hero' ? 'Imagem principal' : 'Imagem de aplicação'}
          saveState={saveState}
          value={campaign.content[language][imageField]}
          alt={campaign.content[language][altField]}
          recommended={imageSlot === 'hero' ? '1200 × 700 px' : '1200 × 800 px'}
          materialId={campaign.materialId}
          onChange={(value) => update({ content: {
            pt: { ...campaign.content.pt, [imageField]: value },
            en: { ...campaign.content.en, [imageField]: value },
            es: { ...campaign.content.es, [imageField]: value },
          } })}
          onAlt={(value) => update({ content: { ...campaign.content, [language]: { ...campaign.content[language], [altField]: value } } })}
        />
        <div className="modal-actions"><button className="button primary" onClick={() => setImageSlot(undefined)}>Concluir</button></div>
      </Modal>}
      {publishOpen && <PublishDialog campaign={campaign} brand={brand} language={language} campaignRevision={campaignRevision} saveState={saveState} onChange={onChange} onClose={() => setPublishOpen(false)} />}
      {translateTarget && <TranslateDialog
        campaign={campaign}
        target={translateTarget}
        onApply={(next, selected) => { onChange(next); setLanguage(selected); }}
        onClose={() => setTranslateTarget(undefined)}
      />}
      {exportOpen && (
        <ExportDialog
          campaign={campaign}
          language={language}
          brand={brand}
          html={ready ? preview.html : ''}
          onClose={() => setExportOpen(false)}
          onExported={() => update({ status: 'Exportado' })}
          onSettings={() => {
            setExportOpen(false);
            onSettings();
          }}
        />
      )}
    </div>
  );
}
