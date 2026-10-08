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
import { changeTemplate, languageStates } from '@/campaigns/model';
import { saveLabels } from '@/lib/workspace-sync';
import { editorName, activityTime } from '@/lib/workspace-display';
import type { SyncMetadata } from '@/types/workspace';
import { templates, getTemplate, blockLabels, suggestTemplate } from '@/templates/registry';
import { Field, Select, TextArea, Modal } from './ui';
import ContentFields from './ContentFields';
import { ExportDialog } from './ExportDialog';
import PublishDialog from './PublishDialog';
import type { SaveState } from '@/lib/use-studio';
import { renderEmail } from '@/export/render';
import TranslateDialog from './TranslateDialog';
import SectionsEditor from './SectionsEditor';
import BackgroundEditor, { ColorField } from './BackgroundEditor';
import AlignmentControl from './AlignmentControl';
import SavedDesignDialog from './SavedDesignDialog';
import { blueprintFromCampaign, convertSections } from '@/blocks/model';
import { defaultDesign } from '@/lib/tokens/backgrounds';
import VisualWorkspace from './canvas/VisualWorkspace';
import { useCampaignHistory } from '@/lib/use-campaign-history';
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
  readOnly = false,
  onDuplicate,
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
  readOnly?: boolean;
  onDuplicate?: () => void;
}) {
  const [language, setLanguage] = useState<Language>(campaign.language === 'EN' ? 'en' : campaign.language === 'ES' ? 'es' : 'pt');
  const history = useCampaignHistory(campaign, language, readOnly, onChange);
  const [advanced, setAdvanced] = useState(false), [review, setReview] = useState(false);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        if (event.shiftKey || event.key.toLowerCase() === 'y') history.redo(); else history.undo();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [history]);
  const [saveTemplate, setSaveTemplate] = useState(false), [converting, setConverting] = useState(false);
  const [notice, setNotice] = useState('');
  const design = campaign.design ?? defaultDesign();
  const [translateTarget, setTranslateTarget] = useState<'en' | 'es'>();
  const [tab, setTab] = useState('content');
  const [mobile, setMobile] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [editImages, setEditImages] = useState(true);
  const [preview, setPreview] = useState({ html: '', signature: '', error: '' });
  const [loadedPreview, setLoadedPreview] = useState('');
  const previewSource = preview.html;
  const signature = JSON.stringify({ campaign, language, brand });
  const ready = preview.signature === signature && !!preview.html;
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      renderEmail(campaign, language, brand)
        .then((html) => {
          if (!cancelled) setPreview({ html, signature, error: '' });
        })
        .catch((error: Error) => {
          if (!cancelled) {
            setPreview({
              html: '',
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
  }, [brand, campaign, language, signature, readOnly]);
  const update = history.change;
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
          <details className="editor-secondary"><summary className="button">Mais ações</summary><div>
            {onDuplicate && <button className="button" title="Criar uma cópia completa desta campanha" onClick={onDuplicate}>Duplicar campanha</button>}
            <button className="button" title="Criar um modelo reutilizável com textos para preencher" disabled={readOnly} onClick={() => setSaveTemplate(true)}>Salvar como template</button>
          </div></details>
          <select
            aria-label="Status da campanha"
            disabled={readOnly}
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
          <button className="button" disabled={readOnly || ['saving', 'conflict', 'offline', 'error'].includes(saveState)} onClick={() => setPublishOpen(true)}>Publicar online</button>
        </div>
      </div>
      {notice && <p className="action-feedback" role="status">{notice} <button type="button" className="text-button" aria-label="Dispensar mensagem" onClick={() => setNotice('')}>Fechar</button></p>}
      {!!campaign.importIssues?.length && (
        <div className="import-issue-banner" role="status">
          <AlertCircle size={17} />
          <div>
            <strong>Revise os dados trazidos da planilha</strong>
            <span>{campaign.importIssues.map((issue) => issue.message).join(' ')}</span>
          </div>
        </div>
      )}
      <div className="editor-global-tools">
        <div className="language-tabs" aria-label="Idioma do canvas">{(['pt', 'en', 'es'] as const).map(lang => <button key={lang} className={language === lang ? 'active' : ''} onClick={() => setLanguage(lang)}>{lang === 'pt' ? 'PORTUGUÊS' : lang === 'en' ? 'ENGLISH' : 'ESPAÑOL'}</button>)}</div>
        <button className="button" disabled={!history.canUndo} onClick={history.undo}>↶ Desfazer</button><button className="button" disabled={!history.canRedo} onClick={history.redo}>↷ Refazer</button>
        <button className={`button ${editImages && !advanced ? 'primary' : ''}`} onClick={() => { setEditImages(true); setAdvanced(false); }}>Editar no canvas</button>
        <button className={`button ${!editImages ? 'primary' : ''}`} onClick={() => { setEditImages(false); setAdvanced(false); }}>Visualizar final</button>
        <button className="button" onClick={() => { setReview(true); setEditImages(true); setAdvanced(false); }}>Revisar</button>
        {advanced && <button className="text-button" onClick={() => { setAdvanced(false); setEditImages(true); }}>Fechar configurações</button>}
      </div>
      <div hidden={!editImages || advanced}>
        <VisualWorkspace campaign={campaign} brand={brand} language={language} onLanguage={setLanguage} readOnly={readOnly} onChange={update} onUndo={history.undo} onRedo={history.redo} saveState={saveState} onAdvanced={(tab = 'content') => { setAdvanced(true); setTab(tab); }} review={review} onReviewClose={() => setReview(false)} />
      </div>
      <div className={`editor-workspace${!advanced ? ' final-workspace' : ''}`} hidden={editImages && !advanced}>
        {advanced && <div className="edit-panel">
          <div className="language-tabs" aria-label="Idioma do conteúdo" hidden>
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
              <button type="button" disabled={readOnly || language === 'en'} onClick={() => setTranslateTarget('en')}>Converter para inglês</button>
              <button type="button" disabled={readOnly || language === 'es'} onClick={() => setTranslateTarget('es')}>Converter para espanhol</button>
            </div>
          </div>
          <div className="editor-tabs">
            <button className={tab === 'design' ? 'active' : ''} onClick={() => setTab('design')}>Fundos</button>
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
          <div className="editor-fields" inert={readOnly} aria-disabled={readOnly}>
            {tab === 'content' && !campaign.sections && (
              <ContentFields campaign={campaign} language={language} onChange={update} saveState={saveState} />
            )}
            {tab === 'content' && campaign.sections && <>
              <Field label="Assunto" value={campaign.content[language].subject} onChange={e => update({ content: { ...campaign.content, [language]: { ...campaign.content[language], subject: e.target.value } } })} />
              <Field label="Preheader" value={campaign.content[language].preheader} onChange={e => update({ content: { ...campaign.content, [language]: { ...campaign.content[language], preheader: e.target.value } } })} />
              <SectionsEditor sections={campaign.sections} language={language} onChange={sections => update({ sections })} />
            </>}
            {tab === 'design' && <>
              <BackgroundEditor label="Fundo do e-mail" value={design.email} onChange={email => update({ design: { ...design, email } })} />
              <BackgroundEditor label="Fundo do conteúdo" value={design.content} onChange={(content, textColor) => update({ design: { ...design, content, ...(textColor ? { textColor } : {}) } })} />
              <ColorField label="Cor do texto do conteúdo" value={design.textColor} onChange={textColor => update({ design: { ...design, textColor } })} />
            </>}
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
                {campaign.sections ? <SectionsEditor sections={campaign.sections} language={language} onChange={sections => update({ sections })} /> : <><p className="muted">Este e-mail usa a estrutura original do template.</p><button className="button primary" type="button" onClick={() => setConverting(true)}>Usar blocos livres</button>
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
                  <AlignmentControl value={campaign.alignment} onChange={alignment => update({ alignment })} />
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
                </>}
              </>
            )}
          </div>
        </div>
        }
        <div className="preview-panel">
          <div className="canvas-mode">
            <div>
              <button onClick={() => { setEditImages(true); setAdvanced(false); }}>Voltar ao canvas</button>
              <button className={!editImages ? 'active' : ''} onClick={() => setEditImages(false)}>HTML final</button>
            </div>
            <span>HTML final, sem controles de edição</span>
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
                  document.addEventListener('click', event => event.preventDefault());
                  setLoadedPreview(previewSource);
                }}
                aria-busy={loadedPreview !== previewSource}
                style={{ width: mobile ? 375 : 600, pointerEvents: loadedPreview === previewSource ? 'auto' : 'none' }}
              />
            ) : (
              <div className="preview-loading">Preparando seu e-mail…</div>
            )}
            <div className="preview-caption">
              {ready ? 'HTML final · Atualizado' : 'Atualizando preview…'}
              <span>{getTemplate(campaign.template).name}</span>
            </div>
          </div>
        </div>
      </div>
      {saveTemplate && <SavedDesignDialog initial={{ kind: 'template', payload: blueprintFromCampaign(campaign) }} onClose={() => setSaveTemplate(false)} onSaved={() => setNotice('Template salvo na biblioteca compartilhada.')} />}
      {converting && <Modal title="Converter em blocos livres" onClose={() => setConverting(false)}><p>A estrutura será reorganizada em seções independentes. Revise a nova composição no preview. O conteúdo original continuará preservado na campanha e no histórico.</p><div className="modal-actions"><button className="button" onClick={() => setConverting(false)}>Cancelar</button><button className="button primary" onClick={() => { update({ sections: convertSections(campaign) }); setConverting(false); setTab('content'); }}>Converter estrutura</button></div></Modal>}
      {publishOpen && <PublishDialog campaign={campaign} brand={brand} language={language} campaignRevision={campaignRevision} saveState={saveState} onChange={onChange} onClose={() => setPublishOpen(false)} />}
      {translateTarget && <TranslateDialog
        campaign={campaign}
        target={translateTarget}
          onApply={(next, selected) => { update(next); setLanguage(selected); }}
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
