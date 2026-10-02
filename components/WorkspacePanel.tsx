'use client';
import { useState } from 'react';
import type { WorkspaceSync } from '@/lib/workspace-sync';
import { saveLabels } from '@/lib/workspace-sync';
import type { CampaignRevision } from '@/types/workspace';
import { online } from '@/lib/online';
import { downloadFile } from '@/export/download';
import { Modal } from './ui';
export default function WorkspacePanel({ workspace, activeId }: { workspace: WorkspaceSync; activeId?: string }) {
  const [deferred, setDeferred] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [history, setHistory] = useState<CampaignRevision[]>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Operação indisponível.'); }
    finally { setBusy(false); }
  }
  const local = workspace.localCampaigns;
  const meta = workspace.meta;
  return <section className="workspace-panel" aria-label="Sincronização do workspace">
    <div className="actions">
      <span aria-live="polite">{saveLabels[workspace.state]}</span>
      <button className="button" disabled={busy} onClick={() => void run(async () => { await workspace.refresh(); await workspace.sync(); })}>Sincronizar agora</button>
      <button className="button" onClick={() => setTrashOpen(true)}>Lixeira ({meta.trash.length})</button>
      {activeId && meta.revisions[activeId] && <button className="button" onClick={() => void run(async () => setHistory(await online.campaigns.history(activeId)))}>Histórico</button>}
      {deferred && !!local.length && workspace.editor && <button className="button" onClick={() => setDeferred(false)}>Enviar campanhas locais ({local.length})</button>}
    </div>
    {workspace.editor && !deferred && (!!local.length || (!meta.brandRevision && meta.localBrand)) && <div className="workspace-notice">
      <strong>Encontramos {local.length} campanhas salvas neste navegador.</strong>
      <p>Enviar para o workspace Granistone? As imagens serão hospedadas automaticamente. {meta.localBrand && !meta.brandRevision ? 'Suas configurações locais de marca também serão importadas.' : ''}</p>
      <div className="actions"><button className="button primary" disabled={busy} onClick={() => void run(() => workspace.migrate())}>Importar para o workspace</button><button className="button" onClick={() => setDeferred(true)}>Manter somente local por enquanto</button></div>
    </div>}
    {Object.entries(meta.conflicts).map(([id, detail]) => <div className="workspace-notice" role="alert" key={id}>
      <strong>Conflito de edição · {workspace.data.campaigns.find(c => c.id === id)?.title ?? 'Campanha'}</strong>
      <p>{detail} Nenhuma versão foi sobrescrita.</p>
      <div className="actions"><button className="button" disabled={busy} onClick={() => void run(() => workspace.resolve(id, false))}>Usar versão da nuvem</button><button className="button primary" disabled={busy} onClick={() => void run(async () => { await workspace.resolve(id, true); await workspace.sync(); })}>Salvar meu trabalho como cópia</button></div>
      <small>Ao usar a versão da nuvem, seu rascunho fica na lixeira como cópia recuperada.</small>
    </div>)}
    {meta.brandConflict && <div className="workspace-notice" role="alert"><strong>Marca e rodapé foram alterados por outro usuário.</strong><p>Baixe sua versão para comparar antes de carregar a configuração compartilhada.</p><button className="button" onClick={() => downloadFile(JSON.stringify(workspace.data.brand, null, 2), 'marca-recuperada.json', 'application/json')}>Baixar minha configuração</button><button className="button" onClick={() => void run(() => workspace.resolveBrand())}>Usar marca da nuvem</button></div>}
    {message && <p role="alert">{message}</p>}
    {trashOpen && <Modal title="Lixeira" onClose={() => setTrashOpen(false)}>
      <p>Restaurar devolve a campanha ao planejamento. Publicações anteriores permanecem intactas.</p>
      {meta.trash.length ? meta.trash.map(c => <div className="workspace-trash" key={c.id}><span>{c.title}</span><button className="button" disabled={busy || !!meta.pending[c.id]} onClick={() => void run(() => workspace.restore(c.id))}>Restaurar</button></div>) : <p>A lixeira está vazia.</p>}
      {message && <p role="alert">{message}</p>}
    </Modal>}
    {history && activeId && <Modal title="Histórico da campanha" onClose={() => setHistory(undefined)}>
      <p>Uma restauração cria uma nova revisão. As versões publicadas não mudam.</p>
      {history.map(item => <div className="workspace-trash" key={item.revision}><span>Revisão {item.revision} · {new Date(item.createdAt).toLocaleString('pt-BR')}<small>{item.changedBy} · {item.reason}</small></span><button className="button" disabled={busy || !!meta.pending[activeId]} onClick={() => void run(async () => { await workspace.restore(activeId, item.revision); setHistory(await online.campaigns.history(activeId)); })}>Restaurar revisão {item.revision}</button></div>)}
      {message && <p role="alert">{message}</p>}
    </Modal>}
  </section>;
}
