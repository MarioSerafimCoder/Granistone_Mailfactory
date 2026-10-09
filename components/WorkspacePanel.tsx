'use client';
import { useEffect, useState } from 'react';
import type { WorkspaceSync } from '@/lib/workspace-sync';
import { saveLabels } from '@/lib/workspace-sync';
import type { CampaignRevision } from '@/types/workspace';
import type { EmailPublication } from '@/types/online';
import { languageStates, plainText } from '@/campaigns/model';
import { editorName, activityTime } from '@/lib/workspace-display';
import { online } from '@/lib/online';
import { downloadFile } from '@/export/download';
import { Modal } from './ui';
function historyAction(item: CampaignRevision, previous?: CampaignRevision) {
  if (item.reason === 'create') return 'Criou a campanha';
  if (item.reason === 'delete') return 'Enviou para a lixeira';
  if (item.reason === 'restore' || item.reason === 'revision') return 'Restaurou uma versão anterior';
  if (previous) for (const lang of ['pt', 'en', 'es'] as const) {
    if (languageStates(item.campaign)[lang].status !== languageStates(previous.campaign)[lang].status) return `Mudou o status ${lang.toUpperCase()} para ${languageStates(item.campaign)[lang].status}`;
    if (JSON.stringify(item.campaign.content[lang]) !== JSON.stringify(previous.campaign.content[lang])) return `Alterou conteúdo ${lang.toUpperCase()}`;
  }
  return 'Atualizou a campanha';
}
function dayLabel(value: string) {
  const date = new Date(value).toDateString();
  if (date === new Date().toDateString()) return 'Hoje';
  if (date === new Date(Date.now() - 86400000).toDateString()) return 'Ontem';
  return new Date(value).toLocaleDateString('pt-BR');
}
export default function WorkspacePanel({ workspace, activeId, trashOpen, onTrashClose, historyOpen, onHistoryClose, compact = false }: {
  workspace: WorkspaceSync; activeId?: string; trashOpen: boolean; onTrashClose: () => void; historyOpen: boolean; onHistoryClose: () => void; compact?: boolean;
}) {
  const [deferred, setDeferred] = useState(false);
  const [dismissedConflict, setDismissedConflict] = useState('');
  const [history, setHistory] = useState<CampaignRevision[]>();
  const [publications, setPublications] = useState<EmailPublication[]>([]);
  const [confirmRevision, setConfirmRevision] = useState<number>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!historyOpen || !activeId) return;
    let alive = true;
    Promise.all([online.campaigns.history(activeId), online.versions(activeId)]).then(([items, published]) => {
      if (alive) { setHistory(items); setPublications(published); }
    }).catch(error => { if (alive) setMessage(error instanceof Error ? error.message : 'Histórico indisponível.'); });
    return () => { alive = false; };
  }, [historyOpen, activeId]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Operação indisponível.'); }
    finally { setBusy(false); }
  }
  const local = workspace.localCampaigns;
  const meta = workspace.meta;
  const conflictId = Object.keys(meta.conflicts).find(id => id !== dismissedConflict);
  const conflict = conflictId ? meta.conflictDetails?.[conflictId] : undefined;
  const timeline = [
    ...(history || []).map((item, index) => ({ key: `r${item.revision}`, date: item.createdAt, title: historyAction(item, history?.[index + 1]), author: item.changedBy, revision: item.revision, item })),
    ...publications.map(item => ({ key: `p${item.id}`, date: item.publishedAt, title: `Publicou ${item.language.toUpperCase()} v${item.version}`, author: '', revision: 0, item: undefined })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return <section className={`workspace-panel sync-${workspace.state}${compact ? ' workspace-panel-compact' : ''}`} aria-label="Sincronização do workspace">
    {!compact && <div className="actions">
      <span aria-live="polite" className="workspace-save-label">{saveLabels[workspace.state]}</span>
      <button className="button" disabled={busy} onClick={() => void run(async () => { await workspace.refresh(); await workspace.sync(); })}>Sincronizar agora</button>
    </div>}
    {deferred && !!local.length && workspace.editor && <button className="button" onClick={() => setDeferred(false)}>Enviar campanhas locais ({local.length})</button>}
    {workspace.editor && !deferred && (!!local.length || (!meta.brandRevision && meta.localBrand)) && <div className="workspace-notice">
      <strong>Encontramos {local.length} campanhas salvas neste navegador.</strong>
      <p>Enviar para o workspace Granistone? As imagens serão hospedadas automaticamente. {meta.localBrand && !meta.brandRevision ? 'Suas configurações locais de marca também serão importadas.' : ''}</p>
      <div className="actions"><button className="button primary" disabled={busy} onClick={() => void run(() => workspace.migrate())}>Importar para o workspace</button><button className="button" onClick={() => setDeferred(true)}>Manter somente local por enquanto</button></div>
    </div>}
    {Object.keys(meta.conflicts).filter(id => id === dismissedConflict).map(id => <div className="workspace-notice" role="alert" key={id}><span>Conflito em {workspace.data.campaigns.find(c => c.id === id)?.title ?? 'campanha'}.</span> <button className="text-button" onClick={() => setDismissedConflict('')}>Resolver conflito</button></div>)}
    {meta.brandConflict && <div className="workspace-notice" role="alert"><strong>Marca e rodapé foram alterados por outro usuário.</strong><p>Baixe sua versão para comparar antes de carregar a configuração compartilhada.</p><button className="button" onClick={() => downloadFile(JSON.stringify(workspace.data.brand, null, 2), 'marca-recuperada.json', 'application/json')}>Baixar minha configuração</button><button className="button" onClick={() => void run(() => workspace.resolveBrand())}>Usar marca da nuvem</button></div>}
    {message && <p role="alert">{message}</p>}
    {conflictId && <Modal title="Conflito de edição" onClose={() => setDismissedConflict(conflictId)}>
      <p>Esta campanha foi alterada enquanto você estava editando. Sua versão foi preservada.</p>
      <p className="conflict-meta">{workspace.data.campaigns.find(c => c.id === conflictId)?.title}<br />Alterada por: {editorName(conflict?.updatedBy)}<br />Horário: {activityTime(conflict?.updatedAt) || 'Aguardando informações da equipe'}</p>
      <p>Nenhuma versão foi sobrescrita.</p>
      <div className="modal-actions wrap-actions"><button className="button" disabled={busy} onClick={() => setDismissedConflict(conflictId)}>Cancelar</button><button className="button" disabled={busy} onClick={() => void run(() => workspace.resolve(conflictId, false))}>Carregar versão mais recente</button><button className="button primary" disabled={busy} onClick={() => void run(async () => { await workspace.resolve(conflictId, true); await workspace.sync(); })}>Salvar minha versão como cópia</button></div>
    </Modal>}
    {trashOpen && <Modal title="Lixeira" onClose={onTrashClose} wide>
      <p>Restaurar devolve a campanha ao planejamento. Publicações anteriores permanecem intactas.</p>
      {meta.trash.length ? meta.trash.map(c => <div className="workspace-trash" key={c.id}><span><strong>{c.title}</strong><small>{meta.activity?.[c.id]?.deletedAt ? `Excluída por ${editorName(meta.activity[c.id].deletedBy)} · ${activityTime(meta.activity[c.id].deletedAt)}` : 'Excluída neste navegador'}</small></span><button className="button" disabled={busy || !!meta.pending[c.id]} onClick={() => void run(() => workspace.restore(c.id))}>Restaurar</button></div>) : <p>A lixeira está vazia.</p>}
      {message && <p role="alert">{message}</p>}
    </Modal>}
    {historyOpen && activeId && <Modal title="Histórico da campanha" onClose={onHistoryClose} wide>
      <p>Uma restauração cria uma nova revisão. As versões publicadas não mudam.</p>
      {!history ? <p role="status">Carregando histórico…</p> : timeline.length ? <div className="history-timeline">{timeline.map((entry, index) => {
        const day = dayLabel(entry.date); const heading = index === 0 || day !== dayLabel(timeline[index - 1].date);
        return <div key={entry.key}>{heading && <h3>{day}</h3>}<div className="workspace-trash"><div><strong>{new Date(entry.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {entry.author ? editorName(entry.author) : 'Publicação'}</strong><small>{entry.title}</small>{entry.item && <details className="history-version"><summary>Ver versão {entry.revision}</summary><p><strong>{entry.item.campaign.title}</strong> · {entry.item.campaign.template}</p>{(['pt', 'en', 'es'] as const).map(lang => <section key={lang}><h4>{lang.toUpperCase()}</h4><p>Assunto: {entry.item!.campaign.content[lang].subject || 'Não preenchido'}</p><p>{entry.item!.campaign.content[lang].headline}</p><p>{plainText(entry.item!.campaign.content[lang].body)}</p></section>)}</details>}</div>{entry.item && <button className="button" disabled={busy || !!meta.pending[activeId]} onClick={() => setConfirmRevision(entry.revision)}>Restaurar esta versão</button>}</div></div>;
      })}</div> : <p>Nenhuma alteração registrada.</p>}
      {confirmRevision !== undefined && <div className="restore-confirm" role="alert"><strong>Restaurar revisão {confirmRevision}?</strong><p>O conteúdo atual continuará disponível no histórico.</p><button className="button" onClick={() => setConfirmRevision(undefined)}>Cancelar</button><button className="button primary" disabled={busy} onClick={() => void run(async () => { await workspace.restore(activeId, confirmRevision); setConfirmRevision(undefined); setHistory(await online.campaigns.history(activeId)); })}>Confirmar restauração</button></div>}
      {message && <p role="alert">{message}</p>}
    </Modal>}
  </section>;
}
