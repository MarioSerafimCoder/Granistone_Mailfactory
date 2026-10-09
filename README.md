# Granistone Mail Studio

Workspace de campanhas de e-mail da Granistone: planejamento XLSX, nove templates com blocos editáveis, editor Maily, imagens e materiais online, tradução PT/EN/ES, pré-flight e publicação de HTML imutável para RD Station.

Aplicação: https://granistone-mail-studio.mario-92.chatgpt.site/

## Dados e acesso

**Cloudflare D1 é a fonte oficial das campanhas compartilhadas e de Marca e rodapé.** Funcionários autenticados com ChatGPT e autorizados em `EDITOR_EMAILS` consultam o mesmo workspace. IndexedDB mantém cache e fila de alterações para recuperação. Visitantes podem trabalhar em rascunhos locais, mas não consultar nem modificar as APIs protegidas.

Campanhas antigas deste navegador não são enviadas silenciosamente. Após entrar, escolha **Importar para o workspace** ou **Manter somente local por enquanto**. Imagens `data:` são hospedadas no R2 antes de salvar a campanha. IDs existentes, inclusive da importação XLSX, são preservados; colisões exigem resolução explícita. Configuração de marca local pode ser importada junto quando o workspace ainda não tem configuração própria.

O editor distingue **Salvando…**, **Salvo na nuvem**, **Salvo localmente**, **Sem conexão · alterações pendentes**, **Conflito de edição** e **Erro ao sincronizar**. Uma gravação só recebe confirmação de nuvem depois do servidor. A sincronização consulta alterações a cada 15 segundos, ao recuperar conexão e ao voltar à janela; há um botão para atualizar manualmente.

Na lista, ordene por disparo, alteração, nome ou status e use filtros rápidos ou avançados. A autoria e a data da última alteração aparecem quando a campanha já foi sincronizada. O editor mostra o status do idioma aberto, acesso ao histórico e a última pessoa que salvou. Um conflito abre uma janela com autor, horário e opções para carregar a versão recente ou guardar seu trabalho como cópia.

Cada gravação usa a revisão aberta pelo usuário. Se outra pessoa gravar antes, o servidor retorna `409`: o Studio permite usar a versão da nuvem ou salvar o trabalho local como uma nova cópia. Ao escolher a nuvem, a versão local fica na lixeira como cópia recuperada. Não há sobrescrita automática nem mesclagem silenciosa.

Veja [o guia do workspace](docs/WORKSPACE.md) para concorrência, endpoints, recuperação e limitações.

## Executar localmente

Requisitos: Node.js 22+ e pnpm. O servidor completo usa o emulador D1/R2 do Wrangler:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm build
pnpm start
```

Abra http://127.0.0.1:3000/. `pnpm dev` inicia apenas o frontend Next.js; para testar APIs, use `pnpm build` + `pnpm start`. O build gera o frontend estático em `dist/client` e o Worker em `dist/server`.

O emulador não implementa o login do Sites. Os testes locais injetam identidades exclusivamente no Worker local. Em produção, somente o dispatcher do Sites encaminha a identidade confiável. Nunca exponha esse Worker diretamente com cabeçalhos de identidade controláveis por visitantes.

Configuração de produção gerenciada no Sites (não incluir segredos no Git):

- `SITE_ORIGIN`: origem HTTPS da aplicação.
- `EDITOR_EMAILS`: e-mails autorizados separados por vírgula; autenticar sozinho não concede acesso.
- `GEMINI_API_KEY`, `GEMINI_MODEL`: tradução via Gemini. A conta ChatGPT identifica o funcionário; o conteúdo é traduzido pelo Gemini.
- `REMOTE_HOSTS`: política adicional de hosts remotos quando utilizada.
- `DB`, `BUCKET`, `ASSETS`: bindings de D1, R2 e arquivos estáticos.

Sem uma chave Gemini válida, os outros recursos continuam funcionando, mas tradução fica indisponível. Limites gratuitos do provedor podem suspender traduções; não há ativação automática de plano pago.

## Fluxo de trabalho

1. Entre com ChatGPT usando uma conta autorizada; importe rascunhos locais se desejar.
2. Importe XLSX/XLS ou clique em **Nova campanha** e escolha o template inicial.
3. Edite assunto, textos Maily, imagens, cortes e CTA. Fotos locais são otimizadas para preview e hospedadas automaticamente ao sincronizar.
4. Gere versões em inglês/espanhol preservando o português. Status, aprovação e data de edição são independentes por idioma. A estrutura visual é compartilhada.
5. Confira desktop/mobile e escolha **Preparar para RD Station**. O fluxo hospeda imagens locais e executa o pré-flight real de conteúdo, imagens, links e compatibilidade. O relatório técnico fica em **Ver detalhes do pré-flight**.
6. Publique a versão e leve HTML/URL para o RD Station. Publicações anteriores e seus assets permanecem imutáveis.
7. Use **Histórico** para restaurar um snapshot e **Lixeira** para recuperar campanhas excluídas. Baixe backups regularmente.

## Arquitetura

Blocos livres, templates compartilhados e backgrounds: veja [arquitetura, migration e compatibilidade](docs/blocos-e-backgrounds.md).

| Caminho | Responsabilidade |
| --- | --- |
| `app/`, `components/` | Interface Next.js, Maily, preview e fluxos de trabalho |
| `campaigns/`, `types/` | Modelo, estados por idioma e contratos |
| `lib/workspace-sync.ts` | Fila persistente, reconciliação, conflitos e migração |
| `lib/use-studio.ts`, `lib/storage.ts` | Integração React, IndexedDB, recuperação e backups |
| `lib/workspace-images.ts` | Hospedagem deduplicada antes da gravação |
| `server/campaigns.ts`, `server/worker.ts` | API compartilhada, revisões e autorização |
| `db/schema.ts`, `drizzle/` | Schema Drizzle, migrations e proteções transacionais |
| `server/assets.ts`, `server/materials.ts` | Biblioteca e catálogo em D1/R2 |
| `server/publications.ts`, `server/preflight.ts` | Publicação imutável e validação |
| `templates/`, `components/email/`, `export/` | Templates e HTML de e-mail com 600 px |
| `tests/` | Testes de domínio, Worker/D1/R2, sincronização e navegador |

## Verificação

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

O teste de navegador inicia o servidor local automaticamente; aplique as migrations locais antes. No Windows usa Microsoft Edge; em outros sistemas instale Chromium com `pnpm exec playwright install chromium`. O GitHub Actions executa esses comandos em push e pull request, incluindo Chromium e o D1/R2 local.

## Limitações

- Sincronização por consulta periódica, presença por sessão e edição exclusiva temporária por recurso; não há edição simultânea por caractere.
- Campanhas, históricos e fila ainda não têm paginação/política de retenção. Um workspace muito grande exigirá essas evoluções.
- A fila offline depende do armazenamento deste navegador; limpar IndexedDB pode remover alterações que ainda não chegaram ao servidor. Backup JSON continua importante.
- R2 aceita JPG/PNG/WebP pelo fluxo atual. GIF animado pode continuar no rascunho local, mas precisa ser convertido para sincronizar.
- Não há envio de e-mails, gestão de contatos, analytics ou integração direta com RD Station.
- HTML precisa de homologação nos clientes reais usados pela base, especialmente Outlook, WebP e recursos específicos de cada cliente.

## Assets

### Pastas da biblioteca

A biblioteca permite **Importar pasta** (incluindo subpastas) e enviar várias imagens. O envio prepara JPG/PNG/WebP de até 20 MB no navegador e mantém os arquivos em R2. Caminhos de pastas ficam em D1, na tabela `asset_folders` (migration `0007_asset_folders`); uma mesma imagem pode pertencer a várias pastas sem duplicar seus bytes. Imagens antigas continuam disponíveis em **Todas as imagens**.

Clique nas pastas para navegar; a busca considera nome, texto alternativo e caminho. Os detalhes da imagem permitem editar as pastas, uma por linha. A biblioteca consulta todas as páginas de 100 registros e atualiza a organização compartilhada ao voltar à janela, a cada 30 segundos ou pelo botão **Atualizar**. O importador mostra progresso, falhas por arquivo e permite interromper depois do arquivo atual; repetir uma importação reutiliza imagens já recebidas. Mantenha a biblioteca aberta durante o envio.

HEIC e RAW precisam ser convertidos antes de uma futura importação pelo navegador. O catálogo fornecido em outubro de 2026 foi preparado em cópias otimizadas, preservando os originais; o PDF da pasta não faz parte da biblioteca de imagens.

Logo fornecida pelo usuário; rodapé baseado na referência Granistone. Ícones sociais derivados de Simple Icons (CC0) e Link de Lucide (ISC), rasterizados para compatibilidade de e-mail. Materiais demonstrativos precisam de revisão da equipe antes do uso comercial.
