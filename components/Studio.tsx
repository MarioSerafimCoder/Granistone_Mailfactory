'use client';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutGrid,
  Mail,
  Upload,
  Settings2,
  Download,
  ArrowUpRight,
  CircleHelp,
  Images,
  Trash2,
  LogIn,
  Users,
} from 'lucide-react';
import { useStudio } from '@/lib/use-studio';
import { createCampaign } from '@/campaigns/model';
import { duplicateCampaign, campaignFromBlueprint } from '@/blocks/model';
import { getTemplate, templates } from '@/templates/registry';
import { templateContent } from '@/templates/starter';
import { downloadFile } from '@/export/download';
import { decodeBackup, isCampaign, STORAGE_KEY } from '@/lib/storage';
import type { TemplateId } from '@/types/campaign';
import CampaignList from './CampaignList';
import CampaignEditor from './CampaignEditor';
import TemplateLibrary from './TemplateLibrary';
import { ImportDialog } from './ImportDialog';
import { BrandSettings } from './BrandSettings';
import { Modal, Field, Select } from './ui';
import LibraryPage from './LibraryPage';
import WorkspacePanel from './WorkspacePanel';
import { saveLabels } from '@/lib/workspace-sync';
import { CollaborationContext, useEditLease, useWorkspacePresence } from '@/lib/use-collaboration';
import { EditLeaseBar, PresenceAvatars } from './WorkspacePresence';
import WorkspaceMembers from './WorkspaceMembers';
import type { ResourceType } from '@/types/collaboration';
import ThemeToggle from './ThemeToggle';
export default function Studio() {
  const { data, save, flushLocal, saveState, error, workspace } = useStudio();
  const [view, setView] = useState<'campaigns' | 'templates' | 'library'>('campaigns');
  const [activeId, setActiveId] = useState<string>();
  const [importOpen, setImportOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [resourceLocation, setResourceLocation] = useState<{ type: ResourceType; id: string }>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState<TemplateId>();
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [deleteCampaignId, setDeleteCampaignId] = useState<string>();
  const [trashOpen, setTrashOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const queuedNavigation = useRef<{ view: 'campaigns' | 'templates' | 'library'; campaignId?: string } | undefined>(undefined);
  const [pendingNavigation, setPendingNavigation] = useState<{ view: 'campaigns' | 'templates' | 'library'; campaignId?: string; message: string; localSaved: boolean }>();
  const onlineEditor = workspace?.editor ?? false;
  const session = workspace?.session;
  const onlineMember = session?.member ?? onlineEditor;
  const canEdit = !session?.authenticated || onlineEditor;
  const active = data?.campaigns.find((c) => c.id === activeId);
  const deleteCampaign = data?.campaigns.find((c) => c.id === deleteCampaignId);
  const campaignLease = useEditLease('campaign', active?.id, Boolean(active && workspace?.meta.revisions[active.id]), canEdit, true, async () => { await workspace?.refresh(); });
  const collaboration = useWorkspacePresence(session, membersOpen ? 'members' : resourceLocation?.type || (brandOpen ? 'brand' : active ? 'campaign' : view), resourceLocation?.type || (brandOpen ? 'brand' : active ? 'campaign' : ''), resourceLocation?.id || (brandOpen ? 'brand' : active?.id || ''));
  async function navigate(nextView: 'campaigns' | 'templates' | 'library', campaignId?: string) {
    if (leavingRef.current) { queuedNavigation.current = { view: nextView, campaignId }; return false; }
    if (!active || active.id === campaignId) { setView(nextView); setActiveId(campaignId); return true; }
    leavingRef.current = true; setLeaving(true); setPendingNavigation(undefined);
    let localSaved = false;
    let completed = false;
    try {
      await flushLocal(); localSaved = true;
      await workspace?.flush();
      if (workspace?.meta.pending[active.id] || workspace?.meta.conflicts[active.id]) throw new Error(workspace.error || 'Há alterações locais pendentes nesta campanha. Elas continuam salvas neste navegador.');
      await campaignLease.finish();
      setActiveId(campaignId); setView(nextView);
      completed = true;
      return true;
    } catch (caught) {
      setPendingNavigation({ view: nextView, campaignId, message: caught instanceof Error ? caught.message : 'Não foi possível sincronizar as alterações.', localSaved });
      return false;
    } finally {
      leavingRef.current = false; setLeaving(false);
      const queued = queuedNavigation.current; queuedNavigation.current = undefined;
      if (queued) {
        if (completed) { setActiveId(queued.campaignId); setView(queued.view); }
        else setPendingNavigation(current => current && { ...current, view: queued.view, campaignId: queued.campaignId });
      }
    }
  }
  async function copyActive() {
    if (!active || !data || !canEdit) return;
    const source = active;
    if (!await navigate('campaigns')) return;
    const copy = duplicateCampaign(source), current = workspace?.data ?? data;
    save({ ...current, campaigns: [copy, ...current.campaigns] }, true); setActiveId(copy.id); setFeedback('Campanha duplicada. A nova cópia está em produção e será sincronizada.');
  }
  function showBrand() {
    workspace?.setBrandEditing(true);
    setBrandOpen(true);
  }
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; });


  useEffect(() => {
    if (!data) return;
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const allowedTemplates: TemplateId[] = templates.map(template => template.id);
    void Promise.resolve(
      context.registerTool(
        {
          name: 'create_campaign',
          title: 'Criar campanha de e-mail',
          description:
            'Cria uma campanha no Granistone Mail Studio e abre o editor com o template escolhido.',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', minLength: 1, maxLength: 120 },
              template: { type: 'string', enum: allowedTemplates },
            },
            required: ['title', 'template'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input: unknown) {
            if (!canEdit) throw new Error('Sua função permite apenas visualizar campanhas.');
            if (!input || typeof input !== 'object') throw new Error('Dados da campanha inválidos.');
            const value = input as { title?: unknown; template?: unknown };
            const title = typeof value.title === 'string' ? value.title.trim() : '';
            if (!title || title.length > 120 || !allowedTemplates.includes(value.template as TemplateId)) {
              throw new Error('Informe um título e um template válido.');
            }
            if (!await navigateRef.current('campaigns')) throw new Error('Conclua a sincronização da campanha aberta antes de criar outra.');
            const current = workspace?.data ?? data;
            const template = value.template as TemplateId;
            const campaignType = getTemplate(template).campaignType;
            const campaign = createCampaign({
              title,
              template,
              campaignType,
              content: templateContent(template, title),
            });
            save({ ...current, campaigns: [campaign, ...current.campaigns] }, true);
            setView('campaigns');
            setActiveId(campaign.id);
            setFeedback('Campanha criada.');
            return { id: campaign.id, title: campaign.title, template: campaign.template };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [data, save, canEdit, workspace]);
  function start(template: TemplateId = 'institutional') {
    if (!canEdit) { setFeedback('Sua função permite apenas visualizar campanhas.'); return; }
    setName('');
    setNewTemplate(template);
  }
  function create() {
    if (!data || !canEdit || !newTemplate || !name.trim()) return;
    const type = getTemplate(newTemplate).campaignType;
    const c = createCampaign({ title: name.trim(), template: newTemplate, campaignType: type, content: templateContent(newTemplate, name.trim()) });
    save({ ...data, campaigns: [c, ...data.campaigns] });
    setNewTemplate(undefined);
    setActiveId(c.id);
    setView('campaigns');
  }
  async function restore(file?: File) {
    if (!file || !data || !canEdit) return;
    try {
      if (file.size > 100_000_000) throw new Error('O limite para backups com imagens é 100 MB.');
      const text = await file.text();
      const value: unknown = JSON.parse(text);
      if (isCampaign(value)) {
        const restored = { ...value, id: crypto.randomUUID() };
        save({ ...data, campaigns: [restored, ...data.campaigns] });
        setFeedback('Campanha JSON importada.');
      } else {
        const backup = decodeBackup(text);
        const existing = new Set(data.campaigns.map((c) => c.id));
        const additional = backup.campaigns.filter((c) => !existing.has(c.id));
        save({ ...data, campaigns: [...additional, ...data.campaigns] });
        setFeedback(
          `${additional.length} campanhas restauradas. IDs existentes e configurações atuais foram preservados.`,
        );
      }
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Não foi possível importar o JSON.');
    }
  }
  if (!data)
    return (
      <div className="loading-screen">
        <img src="/brand/granistone-logo.png" alt="Granistone" />
        <p>{error || 'Abrindo seu Mail Studio…'}</p>
        {error && (
          <button
            className="button"
            onClick={() =>
              downloadFile(
                localStorage.getItem(STORAGE_KEY) || '{}',
                'granistone-recuperacao.json',
                'application/json',
              )
            }
          >
            Baixar dados locais para recuperação
          </button>
        )}
      </div>
    );
  if (session?.authenticated && !session.member) return <div className="workspace-access-screen"><img src="/brand/granistone-logo.png" alt="Granistone" /><h1>Você não possui acesso ao workspace Granistone</h1><p>Você está conectado como <strong>{session.email}</strong>.</p><p>Peça a um administrador para adicionar este e-mail em <strong>Configurações → Membros do workspace</strong>.</p><a className="button primary" href="/signin-with-chatgpt?return_to=/" target="_top">Entrar com outra conta</a></div>;
  return (
    <CollaborationContext.Provider value={{ session, presence: collaboration.presence, setResource: setResourceLocation }}>
    <div className={`studio ${active ? 'editing' : ''}`}>
      <aside className="sidebar">
        <button
          className="brand-lockup"
          onClick={() => void navigate('campaigns')}
          aria-label="Granistone Mail Studio · início"
        >
          <img src="/brand/granistone-logo.png" alt="Granistone A Rocha" />
          <span>
            MAIL STUDIO
            <i />
          </span>
        </button>
        <nav aria-label="Navegação principal">
          <button
            className={view === 'campaigns' ? 'active' : ''}
            onClick={() => void navigate('campaigns')}
          >
            <Mail size={18} />
            Campanhas<span className="nav-count">{data.campaigns.length}</span>
          </button>
          <button
            className={view === 'templates' ? 'active' : ''}
            onClick={() => void navigate('templates')}
          >
            <LayoutGrid size={18} />
            Templates<span className="nav-count">{templates.length}</span>
          </button>
          <button
            className={view === 'library' ? 'active' : ''}
            onClick={() => void navigate('library')}
          >
            <Images size={18} />
            Biblioteca
          </button>
        </nav>
        <div className="sidebar-operations">
          <span className="workspace-label">OPERAÇÕES</span>
          <button disabled={!canEdit} onClick={() => void navigate('campaigns').then(ok => { if (ok) setImportOpen(true); })}>
            <Upload size={18} />
            Importar planejamento
          </button>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setSettingsOpen(true)}><Settings2 size={17} />Configurações</button>
          <button onClick={() => setHelpOpen(true)}><CircleHelp size={17} />Ajuda</button>
          {!onlineMember && <a className="sidebar-signin" href="/signin-with-chatgpt?return_to=/" target="_top"><LogIn size={16} />Entrar com ChatGPT</a>}
          <button className={`sidebar-sync sync-${workspace?.state ?? saveState}`} title="Sincronizar agora" onClick={() => void workspace?.refresh().then(() => workspace.sync()).catch(caught => setFeedback(caught instanceof Error ? caught.message : 'Não foi possível sincronizar.'))}>
            <span className="sync-dot" /><span>{saveLabels[workspace?.state ?? saveState]}</span>
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <strong>Mail Studio</strong>
          {onlineMember && <div className="topbar-team"><PresenceAvatars entries={collaboration.presence} />{collaboration.unavailable && <small>Presença indisponível</small>}</div>}
        </header>
        {error && (
          <div className="persistent-error" role="alert">
            {error}
          </div>
        )}
        {workspace && <WorkspacePanel workspace={workspace} activeId={activeId} compact trashOpen={trashOpen} onTrashClose={() => setTrashOpen(false)} historyOpen={historyOpen} onHistoryClose={() => setHistoryOpen(false)} />}
        {feedback && (
          <div className="feedback global-feedback" role="status">
            {feedback}
            <button onClick={() => setFeedback('')} aria-label="Fechar mensagem">
              ×
            </button>
          </div>
        )}
        {active ? (
          <>
          <CampaignEditor
            key={active.id}
            campaign={active}
            campaignRevision={workspace?.meta.revisions[active.id]}
            activity={workspace?.meta.activity?.[active.id]}
            brand={data.brand}
            saveState={workspace?.campaignState(active.id) ?? saveState}
            readOnly={!campaignLease.editing || leaving}
            leaseControls={workspace?.meta.revisions[active.id] ? <EditLeaseBar compact lease={campaignLease} type="campaign" id={active.id} onBegin={() => workspace.refresh()} onFinish={async () => { await flushLocal(); await workspace.flush(); if (workspace.meta.pending[active.id] || workspace.meta.conflicts[active.id]) { setFeedback('As alterações estão pendentes. Retome a conexão ou recupere uma cópia.'); throw new Error('Salvamento pendente.'); } }} onCopy={copyActive} /> : undefined}
            onSync={workspace ? () => { void flushLocal().then(() => workspace.refresh()).then(() => workspace.sync()).catch(caught => setFeedback(caught instanceof Error ? caught.message : 'Não foi possível sincronizar.')); } : undefined}
            onBack={() => void navigate('campaigns')}
            onSettings={showBrand}
            onHistory={() => setHistoryOpen(true)}
            onDuplicate={canEdit ? () => void copyActive() : undefined}
            campaignChoices={data.campaigns}
            onSwitchCampaign={id => void navigate('campaigns', id)}
            onChange={(campaign) => {
              if (!campaignLease.editing || leaving) return;
              save({
                ...data,
                campaigns: data.campaigns.map((c) => (c.id === campaign.id ? campaign : c)),
              }, campaign.status !== active.status);
            }}
          />
          </>
        ) : view === 'templates' ? (
          <TemplateLibrary onUse={start} onCustomUse={(blueprint, title) => { if (!canEdit) return; const campaign = campaignFromBlueprint(blueprint, title); save({ ...data, campaigns: [campaign, ...data.campaigns] }, true); setActiveId(campaign.id); setView('campaigns'); setFeedback('Campanha criada a partir do template. Preencha os textos indicados.'); }} />
        ) : view === 'library' ? (
          <LibraryPage />
        ) : (
          <CampaignList
            key={reviewIds.join(',')}
            campaigns={data.campaigns}
            canEdit={canEdit}
            canDelete={!onlineMember || session?.role === 'admin'}
            activity={workspace?.meta.activity}
            reviewIds={reviewIds}
            pendingIds={Object.keys(workspace?.meta.pending ?? {})}
            onOpen={setActiveId}
            onDelete={setDeleteCampaignId}
            onDuplicate={id => { const source = data.campaigns.find(c => c.id === id); if (!source || !canEdit) return; const copy = duplicateCampaign(source); save({ ...data, campaigns: [copy, ...data.campaigns] }, true); setActiveId(copy.id); setFeedback('Campanha duplicada. A nova cópia está em produção e será sincronizada.'); }}
            onCreate={() => start()}
          />
        )}
      </main>
      {settingsOpen && <Modal title="Configurações" onClose={() => setSettingsOpen(false)}>
        <div className="studio-settings-list">
          <button disabled={onlineMember && !session?.permissions.editBrand} onClick={() => { setSettingsOpen(false); showBrand(); }}><Settings2 size={18} /><span><strong>Marca e rodapé</strong><small>Identidade dos e-mails</small></span></button>
          {session?.permissions.manageMembers && <button onClick={() => { setSettingsOpen(false); setMembersOpen(true); }}><Users size={18} /><span><strong>Membros do workspace</strong><small>Acesso e permissões</small></span></button>}
          <ThemeToggle />
          <button onClick={() => { setSettingsOpen(false); setTrashOpen(true); }}><Trash2 size={18} /><span><strong>Lixeira</strong><small>{workspace?.meta.trash.length ?? 0} campanhas</small></span></button>
          <button onClick={() => { downloadFile(JSON.stringify(data, null, 2), 'granistone-backup.json', 'application/json'); setFeedback('Backup completo baixado.'); }}><Download size={18} /><span><strong>Baixar backup</strong><small>Exportar dados em JSON</small></span></button>
          <label className="restore-label"><Upload size={18} /><span><strong>Restaurar JSON</strong><small>Adicionar campanhas de um backup</small></span><input type="file" disabled={!canEdit} accept=".json" onChange={event => { void restore(event.target.files?.[0]); event.target.value = ''; }} /></label>
        </div>
      </Modal>}
      {membersOpen && <WorkspaceMembers onClose={() => setMembersOpen(false)} />}
      {pendingNavigation && <Modal title="Alterações pendentes" onClose={() => setPendingNavigation(undefined)}>
        <p role="alert">{pendingNavigation.message}</p>
        <p>{pendingNavigation.localSaved ? 'Seu rascunho está salvo neste navegador. Você pode tentar sincronizar agora ou sair mantendo as alterações locais para recuperar depois.' : 'O salvamento local não pôde ser confirmado. Mantenha esta página aberta e tente novamente.'}</p>
        <div className="modal-actions">
          <button className="button" onClick={() => setPendingNavigation(undefined)}>Continuar editando</button>
          <button className="button" onClick={() => void navigate(pendingNavigation.view, pendingNavigation.campaignId)}>Tentar sincronizar</button>
          {pendingNavigation.localSaved && <button className="button primary" onClick={() => void (async () => { await campaignLease.finish(); setActiveId(pendingNavigation.campaignId); setView(pendingNavigation.view); setPendingNavigation(undefined); })()}>Sair com rascunho local</button>}
        </div>
      </Modal>}
      {importOpen && (
        <ImportDialog
          existing={data.campaigns}
          onImport={(campaigns, focusPending) => {
            save({ ...data, campaigns: [...campaigns, ...data.campaigns] });
            setView('campaigns');
            setActiveId(undefined);
            setReviewIds(focusPending ? campaigns.filter(c => c.importIssues?.length).map(c => c.id) : []);
            setFeedback(`${campaigns.length} campanhas importadas · ${campaigns.filter(c => !c.date).length} sem data · ${campaigns.filter(c => c.importIssues?.length).length} para revisão.`);
          }}
          onClose={() => setImportOpen(false)}
        />
      )}
      {brandOpen && (
        <BrandSettings
          brand={data.brand}
          onlineMember={onlineMember}
          brandRevision={workspace?.meta.brandRevision}
          onSave={async (brand) => {
            if (workspace) { await workspace.save({ ...workspace.data, brand }); await workspace.flush(); if (workspace.meta.brandPending) throw new Error(workspace.error || 'Não foi possível compartilhar a marca. Seu rascunho foi preservado.'); }
            else save({ ...data, brand });
            workspace?.setBrandEditing(false);
          }}
          onClose={() => { workspace?.setBrandEditing(false); setBrandOpen(false); }}
        />
      )}
      {newTemplate && (
        <Modal title="Nova campanha" onClose={() => setNewTemplate(undefined)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <p className="muted">
              Escolha o nome e a estrutura que melhor representam este e-mail.
            </p>
            <Field
              label="Nome da campanha"
              required
              autoFocus
              value={name}
              placeholder="Ex.: Crystal Palace · Outubro"
              onChange={(e) => setName(e.target.value)}
            />
            <Select
              label="Template inicial"
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value as TemplateId)}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </Select>
            <div className="new-template-note">
              <strong>{getTemplate(newTemplate).label}</strong>
              <span>{getTemplate(newTemplate).description}</span>
            </div>
            <div className="modal-actions">
              <button type="button" className="button" onClick={() => setNewTemplate(undefined)}>
                Cancelar
              </button>
              <button type="submit" className="button primary" disabled={!name.trim()}>
                Criar campanha
                <ArrowUpRight size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleteCampaign && (
        <Modal title="Excluir e-mail" onClose={() => setDeleteCampaignId(undefined)}>
          <p>
            Excluir <strong>{deleteCampaign.title}</strong> do seu planejamento?
          </p>
          <p className="muted">
            A campanha irá para a lixeira e poderá ser restaurada. Versões já publicadas permanecem disponíveis.
          </p>
          <div className="modal-actions">
            <button type="button" className="button" onClick={() => setDeleteCampaignId(undefined)}>
              Cancelar
            </button>
            <button
              type="button"
              className="button danger"
              onClick={() => void (async () => { try { await workspace?.remove(deleteCampaign.id); setDeleteCampaignId(undefined); setFeedback('E-mail movido para a lixeira.'); } catch (caught) { setFeedback(caught instanceof Error ? caught.message : 'Não foi possível excluir.'); } })()}
            >
              <Trash2 size={16} />
              Excluir e-mail
            </button>
          </div>
        </Modal>
      )}
      {helpOpen && (
        <Modal title="Do planejamento ao e-mail" onClose={() => setHelpOpen(false)}>
          <ol className="help-steps">
            <li>
              <strong>Importe seu planejamento</strong>
              <p>
                Use uma planilha XLSX com Tema, Data de disparo, Tipo de conteúdo, Público, Idioma e
                CTA. Baixe o modelo na tela de importação.
              </p>
            </li>
            <li>
              <strong>Edite a campanha</strong>
              <p>
                Revise o template sugerido, preencha assunto, textos e imagens. Gere versões em
                inglês e espanhol sem apagar o original em português.
              </p>
            </li>
            <li>
              <strong>Confira o preview</strong>
              <p>
                Alterne desktop/mobile. A estrutura, a tipografia e o rodapé seguem o padrão da
                marca.
              </p>
            </li>
            <li>
              <strong>Prepare a exportação</strong>
              <p>
                Execute o pré-flight, publique a versão online e copie o HTML final para o RD Station.
              </p>
            </li>
          </ol>
          <p className="export-check">
            Campanhas compartilhadas ficam no workspace online, com cache neste navegador para recuperação. Baixe backups regularmente. Restaurar JSON
            adiciona campanhas ausentes sem substituir as que já existem.
          </p>
        </Modal>
      )}
    </div>
    </CollaborationContext.Provider>
  );
}
