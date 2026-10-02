# Workspace colaborativo

## Fonte oficial e autorização

D1 guarda campanhas e configurações compartilhadas; R2 guarda imagens. IndexedDB é cache e recuperação, incluindo alterações ainda não confirmadas. O login continua sendo do Sites. Todas as rotas abaixo passam por `requireEditor`, que exige os dois cabeçalhos confiáveis do dispatcher (`oai-authenticated-user-id` e `oai-authenticated-user-email`), verifica `EDITOR_EMAILS` e valida origem nas mutações. Identidades do JSON nunca alimentam auditoria. Todas as respostas de API usam `Cache-Control: no-store`.

Para liberar outro funcionário, o responsável pelo site deve incluir seu e-mail em `EDITOR_EMAILS` pelo gerenciamento de segredos do Sites. O botão de login não concede permissão por si só. Os URLs públicos de imagens e e-mails permanecem públicos; os rascunhos compartilhados exigem autorização.

## Modelo e migrations

- `0002_flashy_taskmaster.sql`: `campaigns`, `campaign_revisions`, `workspace_settings`, `workspace_mutations` (gerada por Drizzle).
- `0003_workspace_guards.sql`: índice de listagem, snapshots automáticos e proteção de imagens referenciadas em campanhas, históricos e marca, incluindo lixeira.
- `0004_lying_thunderbird.sql`: assinatura do conteúdo publicado; adiciona coluna sem modificar o HTML ou URLs antigos (gerada por Drizzle).
- `0005_workspace_history_guards.sql`: checkpoint antes de restaurações/exclusões e proteção de imagens na criação das configurações.
- `0006_workspace_asset_suffix.sql`: comparação direta das URLs de imagens, compatível com o limite de padrões do D1.

As migrations são aditivas. `campaigns.data` contém o Campaign completo; título, data, status e idioma são colunas para consulta. Revisão, datas, autores e exclusão lógica são metadados confiáveis do servidor. `created_by`/`updated_by`/`deleted_by` registram o e-mail autenticado; recibos de mutação também vinculam o ID autenticado.

## API

| Método e caminho | Entrada/resultado |
| --- | --- |
| `GET /api/campaigns` | Campanhas e tombstones, para reconciliar exclusões; a UI esconde excluídas da lista principal |
| `GET /api/campaigns/:id` | Campaign, revisão, auditoria e exclusão |
| `POST /api/campaigns` | `{ campaign, requestId }`; cria revisão 1, conflito se ID existe |
| `PUT /api/campaigns/:id` | `{ campaign, revision, requestId }`; CAS e nova revisão |
| `DELETE /api/campaigns/:id` | `{ revision, requestId }`; exclusão lógica |
| `POST /api/campaigns/:id/restore` | `{ revision, requestId }`; remove tombstone com CAS |
| `GET /api/campaigns/:id/history` | Snapshots, revisão, autor, data e motivo |
| `POST /api/campaigns/:id/history/:revision/restore` | `{ revision: revisãoAtual, requestId }`; conteúdo histórico vira nova revisão |
| `GET /api/workspace/settings` | Marca/rodapé e revisão (0 quando ainda não persistida) |
| `PUT /api/workspace/settings` | `{ brand, revision, requestId }`; criação ou atualização com CAS |

Erros: 400 para payload inválido/imagem local, 401 sem identidade, 403 sem autorização/origem válida, 404 recurso ausente, 409 conflito. Campos PT/EN/ES e estrutura de Campaign são validados. URLs `data:`/`blob:` não entram nas tabelas compartilhadas. O limite de corpo permanece 2 MB após hospedagem das fotos.

## Concorrência e idempotência

Cada alteração executa `UPDATE ... WHERE id=? AND revision=?` e incrementa a revisão. Uma atualização obsoleta não altera linha alguma e retorna 409. A marca segue a mesma regra. A interface conserva a revisão de marca enquanto seu formulário está aberto.

Gravação e recibo de `requestId` compartilham `DB.batch`, uma transação D1. Recibos são associados ao recurso, ID autenticado e hash do pedido. Reenviar exatamente um pedido cuja resposta se perdeu devolve a confirmação original. Reutilizar a chave para outro conteúdo é conflito. O cliente persiste o pedido enviado antes de fazer a requisição; edições mais novas ficam pendentes para a revisão seguinte.

Conflitos não são automaticamente reenviados com a nova revisão. O usuário escolhe carregar a versão compartilhada ou criar uma cópia independente. A versão local descartada da tela é guardada como cópia recuperada na lixeira local. Configurações conflitantes podem ser baixadas como JSON antes de adotar a marca da nuvem, e a cópia também permanece no cache.

## Sincronização e migração

1. Ler IndexedDB e recuperar diário de saída da página, preservando fila e recibos.
2. Exibir cache imediatamente; consultar sessão, campanhas e configuração compartilhada.
3. Aplicar alterações remotas apenas sobre registros sem pendências/conflitos. Tombstones movem campanhas limpas para a lixeira.
4. Preservar campanhas sem revisão remota como locais. O botão de migração transforma essas campanhas em criações pendentes, preservando IDs. Nenhuma migração é enviada antes da escolha do usuário.
5. Para cada gravação, hospedar `data:image` no R2 através da API existente e reutilizar o mesmo upload para conteúdos repetidos entre idiomas. O R2 também deduplica por hash. Preview continua local durante upload; falha de upload não apaga o original.
6. Persistir pedido no cache, enviar para D1, aplicar a confirmação somente ao snapshot correspondente. Edições feitas enquanto a rede responde continuam na fila.
7. Repetir ao editar (800 ms), a cada 15 s, ao voltar à janela, recuperar conexão ou clicar em sincronizar.

Falhas de rede mantêm o cache e mostram pendência. Falhas 409 preservam ambos os trabalhos. Importações repetidas não geram duplicatas: recibos repetidos são idempotentes, IDs existentes não são recriados. Backups v1/v2 continuam aceitos; importação de backup não reutiliza metadados de sincronização antigos para sobrescrever a nuvem.

## Histórico, idiomas e publicação

Snapshots são gravados na criação, mudanças de status, exclusão, restauração e resolução explícita; autosaves têm intervalo de 5 minutos para evitar uma versão por tecla. Antes de substituir por revisão histórica, um checkpoint preserva a revisão atual. Publicar inclui snapshot da revisão sincronizada quando ela ainda não estava registrada. Snapshots são reutilizados quando a mesma revisão já existe.

`languageState.pt/en/es` contém status, data de mudança de conteúdo e aprovação. Campanhas antigas migram o status global para idiomas planejados. Alterar conteúdo de EN invalida apenas sua aprovação/exportação; mudanças estruturais afetam todos os idiomas. Aprovação online recebe autor/data do servidor. O status global permanece como resumo compatível: se planejados divergem, mostra Em produção; a lista exibe o status de cada idioma.

Publicação de campanha compartilhada exige a revisão sincronizada e conteúdo correspondente. A transação impede publicar após uma revisão concorrente durante o pré-flight. A assinatura publicada usa conteúdo do idioma, estrutura e marca; alterações em outro idioma não sinalizam uma nova publicação necessária. Versões antigas sem assinatura usam a data do idioma como fallback. As proteções existentes de HTML/URLs/snapshots imutáveis e SSRF permanecem.

## Recuperação e operação

- Baixar backup antes de limpar dados do navegador. O arquivo inclui campanhas ativas e metadados de recuperação; restauração normal importa campanhas sem reutilizar recibos remotos.
- Recuperar campanha excluída pela Lixeira. Não existe purga física nesta etapa.
- Recuperar conteúdo anterior pelo Histórico, que cria uma nova revisão sem alterar publicações.
- Manter as migrations no build (`dist/.openai/drizzle`) e aplicá-las antes de servir a nova versão. Para ambiente local: `pnpm db:migrate:local`.
- Monitorar tamanho de D1/R2, quantidade de recibos/históricos e erros de sincronização. Ainda não há paginação, política de expurgo ou editor colaborativo em tempo real.
- Cache/pendências pertencem ao navegador. Duas abas fazem CAS independentemente; prefira uma aba por rascunho durante trabalho offline, pois o cache IndexedDB do workspace é compartilhado entre abas.

As notas FASE-3A/3B documentam etapas anteriores; este documento e README descrevem a arquitetura atual.
