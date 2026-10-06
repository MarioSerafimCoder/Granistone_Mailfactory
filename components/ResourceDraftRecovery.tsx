'use client';
export default function ResourceDraftRecovery({ draft }: { draft: { available: boolean; error: string; recover: () => void; clear: () => void; download: () => void } }) {
  return <>{draft.error && <p className="alert" role="alert">{draft.error}</p>}{draft.available && <div className="resource-draft-recovery"><span>Rascunho preservado neste navegador. A versão compartilhada será verificada ao salvar.</span><button type="button" className="text-button" onClick={draft.recover}>Recuperar rascunho</button><button type="button" className="text-button" onClick={draft.download}>Baixar rascunho</button><button type="button" className="text-button" onClick={draft.clear}>Descartar rascunho local</button></div>}</>;
}
