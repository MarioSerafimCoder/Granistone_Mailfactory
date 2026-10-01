'use client';
import { useEffect, useState } from 'react';
import {
  LayoutGrid,
  Mail,
  Upload,
  Settings2,
  Download,
  Plus,
  ArrowUpRight,
  CircleHelp,
  Images,
  Trash2,
  LogIn,
  CircleCheckBig,
} from 'lucide-react';
import { useStudio } from '@/lib/use-studio';
import { createCampaign } from '@/campaigns/model';
import { getTemplate, templates } from '@/templates/registry';
import { templateContent } from '@/templates/starter';
import { downloadFile } from '@/export/download';
import { decodeBackup, isCampaign, STORAGE_KEY } from '@/lib/storage';
import type { Campaign, TemplateId } from '@/types/campaign';
import CampaignList from './CampaignList';
import CampaignEditor from './CampaignEditor';
import TemplateLibrary from './TemplateLibrary';
import { ImportDialog } from './ImportDialog';
import { BrandSettings } from './BrandSettings';
import { Modal, Field, Select } from './ui';
import LibraryPage from './LibraryPage';
import { online } from '@/lib/online';
export default function Studio() {
  const { data, save, saveState, error } = useStudio();
  const [view, setView] = useState<'campaigns' | 'templates' | 'library'>('campaigns');
  const [activeId, setActiveId] = useState<string>();
  const [importOpen, setImportOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState<TemplateId>();
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [deleteCampaignId, setDeleteCampaignId] = useState<string>();
  const [onlineEditor, setOnlineEditor] = useState(false);
  const active = data?.campaigns.find((c) => c.id === activeId);
  const deleteCampaign = data?.campaigns.find((c) => c.id === deleteCampaignId);

  useEffect(() => {
    let mounted = true;
    online.session()
      .then((session) => {
        if (mounted) setOnlineEditor(session.editor);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const allowedTemplates: TemplateId[] = [
      'institutional',
      'product-architect',
      'product-commercial',
      'newsletter',
      'notice',
    ];
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
          execute(input: unknown) {
            if (!input || typeof input !== 'object') throw new Error('Dados da campanha inválidos.');
            const value = input as { title?: unknown; template?: unknown };
            const title = typeof value.title === 'string' ? value.title.trim() : '';
            if (!title || title.length > 120 || !allowedTemplates.includes(value.template as TemplateId)) {
              throw new Error('Informe um título e um template válido.');
            }
            const current = data;
            const template = value.template as TemplateId;
            const campaignType: Campaign['campaignType'] = template.startsWith('product')
              ? 'Produto'
              : template === 'newsletter'
                ? 'Newsletter'
                : template === 'notice'
                  ? 'Aviso'
                  : 'Institucional';
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
  }, [data, save]);
  function start(template: TemplateId = 'institutional') {
    setName('');
    setNewTemplate(template);
  }
  function create() {
    if (!data || !newTemplate || !name.trim()) return;
    const type: Campaign['campaignType'] = newTemplate.startsWith('product')
      ? 'Produto'
      : newTemplate === 'newsletter'
        ? 'Newsletter'
        : newTemplate === 'notice'
          ? 'Aviso'
          : 'Institucional';
    const c = createCampaign({ title: name.trim(), template: newTemplate, campaignType: type, content: templateContent(newTemplate, name.trim()) });
    save({ ...data, campaigns: [c, ...data.campaigns] });
    setNewTemplate(undefined);
    setActiveId(c.id);
    setView('campaigns');
  }
  async function restore(file?: File) {
    if (!file || !data) return;
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
  return (
    <div className={`studio ${active ? 'editing' : ''}`}>
      <aside className="sidebar">
        <button
          className="brand-lockup"
          onClick={() => {
            setActiveId(undefined);
            setView('campaigns');
          }}
          aria-label="Granistone Mail Studio · início"
        >
          <img src="/brand/granistone-logo.png" alt="Granistone A Rocha" />
          <span>
            MAIL STUDIO
            <i />
          </span>
        </button>
        <div className="workspace-label">
          WORKSPACE <span>LOCAL</span>
        </div>
        <nav aria-label="Navegação principal">
          <button
            className={view === 'campaigns' ? 'active' : ''}
            onClick={() => {
              setActiveId(undefined);
              setView('campaigns');
            }}
          >
            <Mail size={18} />
            Campanhas<span className="nav-count">{data.campaigns.length}</span>
          </button>
          <button
            className={view === 'templates' ? 'active' : ''}
            onClick={() => {
              setActiveId(undefined);
              setView('templates');
            }}
          >
            <LayoutGrid size={18} />
            Templates<span className="nav-count">5</span>
          </button>
          <button
            className={view === 'library' ? 'active' : ''}
            onClick={() => { setActiveId(undefined); setView('library'); }}
          >
            <Images size={18} />
            Biblioteca
          </button>
          <button onClick={() => setImportOpen(true)}>
            <Upload size={18} />
            Importar planejamento
          </button>
        </nav>
        <button className="sidebar-create" onClick={() => start()}>
          <Plus size={16} />
          Nova campanha
        </button>
        {onlineEditor ? (
          <div className="sidebar-auth authenticated" role="status">
            <CircleCheckBig size={17} />
            <span>
              ChatGPT conectado
              <small>Tradução online liberada</small>
            </span>
          </div>
        ) : (
          <a
            className="sidebar-auth"
            href="/signin-with-chatgpt?return_to=/"
            target="_top"
          >
            <LogIn size={17} />
            <span>
              Entrar com ChatGPT
              <small>Necessário para usar a tradução</small>
            </span>
          </a>
        )}
        <div className="sidebar-bottom">
          <button onClick={() => setBrandOpen(true)}>
            <Settings2 size={17} />
            Marca e rodapé
          </button>
          <button
            onClick={() => {
              downloadFile(
                JSON.stringify(data, null, 2),
                'granistone-backup.json',
                'application/json',
              );
              setFeedback('Backup completo baixado.');
            }}
          >
            <Download size={17} />
            Baixar backup
          </button>
          <label className="restore-label">
            <Upload size={17} />
            Restaurar JSON
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                void restore(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <button onClick={() => setHelpOpen(true)}>
            <CircleHelp size={17} />
            Como funciona
          </button>
          <div className="local-note">
            <span className="local-dot" />
            Rascunhos locais<small>Biblioteca e publicações online</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            Granistone <span>/</span> Mail Studio <span>/</span>
            <strong>{active ? 'Editor' : view === 'templates' ? 'Templates' : view === 'library' ? 'Biblioteca' : 'Campanhas'}</strong>
          </div>
          <span className="topbar-note">Feito para a sua marca.</span>
        </header>
        {error && (
          <div className="persistent-error" role="alert">
            {error}
          </div>
        )}
        {feedback && (
          <div className="feedback global-feedback" role="status">
            {feedback}
            <button onClick={() => setFeedback('')} aria-label="Fechar mensagem">
              ×
            </button>
          </div>
        )}
        {active ? (
          <CampaignEditor
            key={active.id}
            campaign={active}
            brand={data.brand}
            saveState={saveState}
            onBack={() => setActiveId(undefined)}
            onSettings={() => setBrandOpen(true)}
            onChange={(campaign) =>
              save({
                ...data,
                campaigns: data.campaigns.map((c) => (c.id === campaign.id ? campaign : c)),
              }, campaign.status !== active.status)
            }
          />
        ) : view === 'templates' ? (
          <TemplateLibrary onUse={start} />
        ) : view === 'library' ? (
          <LibraryPage />
        ) : (
          <CampaignList
            campaigns={data.campaigns}
            onOpen={setActiveId}
            onDelete={setDeleteCampaignId}
            onCreate={() => start()}
            onImport={() => setImportOpen(true)}
          />
        )}
      </main>
      {importOpen && (
        <ImportDialog
          existing={data.campaigns}
          onImport={(campaigns) => {
            save({ ...data, campaigns: [...campaigns, ...data.campaigns] });
            setView('campaigns');
            setActiveId(undefined);
            setFeedback(`${campaigns.length} campanhas importadas.`);
          }}
          onClose={() => setImportOpen(false)}
        />
      )}
      {brandOpen && (
        <BrandSettings
          brand={data.brand}
          onSave={(brand) => {
            save({ ...data, brand });
          }}
          onClose={() => setBrandOpen(false)}
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
            O rascunho será removido deste Studio. Versões já publicadas permanecem disponíveis.
          </p>
          <div className="modal-actions">
            <button type="button" className="button" onClick={() => setDeleteCampaignId(undefined)}>
              Cancelar
            </button>
            <button
              type="button"
              className="button danger"
              onClick={() => {
                save({ ...data, campaigns: data.campaigns.filter((campaign) => campaign.id !== deleteCampaign.id) }, true);
                setDeleteCampaignId(undefined);
                setFeedback('E-mail excluído do planejamento.');
              }}
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
            Os dados ficam somente neste navegador. Baixe backups regularmente. Restaurar JSON
            adiciona campanhas ausentes sem substituir as que já existem.
          </p>
        </Modal>
      )}
    </div>
  );
}
