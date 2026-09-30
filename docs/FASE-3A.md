# Fase 3A — infraestrutura e contrato para a interface

## Auditoria e arquitetura

A aplicação publicada anteriormente era um export estático do Next, com geração de HTML no navegador e IndexedDB para campanhas. A antiga rota `app/api/render/route.ts` já havia sido removida na publicação inicial. Não havia armazenamento online.

O Next continua responsável pelo editor estático e pelos cinco templates. Um Worker ESM em `server/worker.ts` atende as APIs, imagens e páginas de e-mail; o restante é servido pelo binding `ASSETS`. O mesmo `export/render.ts` é usado pelo navegador e pelo servidor. Não existe renderer alternativo.

O build produz `dist/server/index.js`, seu módulo WASM de imagem, `dist/client` e as migrações em `dist/.openai`. O GPT Sites provisiona os bindings lógicos **D1 `DB`** e **R2 `BUCKET`** do manifesto. Não há serviço de storage externo.

## Dados e migração

- `MediaAsset`: metadados no D1; arquivo otimizado no R2. IDs são hashes SHA-256 do conteúdo final, com deduplicação e URLs estáveis.
- `OnlineMaterial`: evolução persistente do material, com dados textuais e IDs de imagens. A relação `material_assets` permite uso em múltiplos materiais sem copiar arquivos. Dados técnicos ausentes ficam vazios.
- `EmailPublication`: snapshot do HTML, campanha, idioma, slug, versão e data. `publication_assets` retém suas imagens.
- Índices únicos garantem versões por campanha/idioma e idempotência. D1 `batch` mantém inserção da publicação e referências atômicas.
- Migrações Drizzle: `0000_sour_miracleman.sql` cria tabelas e índices; `0001_retention_guards.sql` instala proteção de referências e imutabilidade no próprio banco. Não há criação de schema em requests.
- Backups v1/v2 e IndexedDB permanecem compatíveis. O campo opcional `unsubscribeMode` não exige migração destrutiva. Upload aplica a URL ao draft apenas quando concluído; campanhas anteriores não são sobrescritas.
- Materiais demonstrativos locais não são importados automaticamente ao catálogo online nem apresentados como dados técnicos oficiais.

## Acesso e segurança

O Studio e as URLs de leitura são públicos. As APIs administrativas exigem identidade encaminhada pelo dispatcher do GPT Sites e e-mail incluído em `EDITOR_EMAILS`, configurado como segredo. A entrada é uma navegação superior para `/signin-with-chatgpt?return_to=/`. O Worker não implementa login próprio nem aceita identidade no JSON.

Mutações também exigem `Origin` exata e rejeitam `Sec-Fetch-Site: cross-site`. Uploads usam corpo binário limitado durante leitura (8 MB), validação de assinatura/MIME/extensão e dimensões (4 megapixels antes da decodificação). Photon/WASM decodifica e reencoda; o maior lado fica em até 1600 px. JPG vira JPG; PNG e WebP viram PNG para preservar alpha. Metadados de imagem/EXIF não são copiados. Nomes de arquivos com separadores são recusados e nunca compõem caminhos de storage.

GIF/APNG/WebP animado não são aceitos pelo upload online para evitar perda silenciosa da animação. GIF local continua compatível com rascunhos existentes.

Verificação remota usa somente HTTPS/443 sem credenciais, hosts exatos aprovados em `REMOTE_HOSTS`, DNS público verificado para A/AAAA, timeout de 6 s e no máximo três redirects. Cada destino é validado novamente. Não há wildcard ou autorização de host enviada pelo navegador. Isso impede solicitar domínios arbitrários controlados por atacante, inclusive a técnica de rebinding de DNS; a lista deve conter somente operadores confiáveis. Endereços privados, loopback, link-local, IPv4 normalizado e IPv6 especiais são recusados. HEAD é preferido; GET com Range é fallback, com cancelamento do corpo. Nenhuma página é rastreada. Domínio de imagem não autorizado gera erro; links não verificáveis geram aviso. Para imagens de outros domínios, o fluxo seguro é baixar e subir ao catálogo.

Imagens internas são verificadas diretamente no D1/R2, sem requisição a URL fornecida pelo usuário. Assets excluídos sem referências são ocultados; os bytes são retidos. Assets ligados a materiais ou publicações retornam 409 na exclusão. Triggers impedem a corrida entre excluir e publicar. Não há limpeza física automática nem endpoint de alteração/deleção de versões.

## APIs

Todas as APIs abaixo, inclusive listagens, exigem editor autorizado. Respostas usam `Cache-Control: no-store`. Os adaptadores para React estão em `lib/online.ts`; modelos em `types/online.ts`.

| Método e rota | Contrato |
| --- | --- |
| GET `/api/session` | `{ editor, email, origin }` |
| POST `/api/assets` | Corpo binário; `Content-Type` real; `X-Asset-Metadata` = JSON codificado com `encodeURIComponent`, contendo `fileName`, `name`, `alt`, `category`. Retorna `MediaAsset`. |
| GET `/api/assets?q=&category=&offset=` | Até 100 assets por página, busca por nome e categoria. |
| GET `/api/assets/:id` | Metadados. |
| PATCH `/api/assets/:id` | Edita `name`, `alt`, `category`; não altera bytes, URL ou dimensões. |
| DELETE `/api/assets/:id` | Exclusão lógica; 409 quando referenciado. |
| GET `/api/assets/:id/usage` | IDs das publicações e materiais associados. |
| GET `/api/materials` | Catálogo persistente (até 500). |
| GET `/api/materials/:id` | Um material. |
| POST `/api/materials` | Cria material. |
| PUT `/api/materials/:id` | Substitui dados e referências do material, validando assets. |
| POST `/api/render` | `{ campaign, brand, language }`; HTML oficial. |
| POST `/api/preflight` | Mesma entrada; `{ checks, hasErrors, warnings, html }`. |
| POST `/api/publications` | Mesma entrada e header `Idempotency-Key`. Reexecuta pré-flight no servidor; 422 e relatório se houver erros; 201 com publicação quando aprovado. Repetir a mesma chave retorna a publicação anterior. Nova intenção usa nova chave. |
| GET `/api/publications?campaignId=...` | Últimas 100 versões da campanha, com URLs e HTML. |

### Rotas anônimas

- Imagem: `/assets/<hash>`, GET/HEAD, MIME real, ETag, cache imutável de um ano.
- Vigente: `/emails/<titulo-normalizado>-<hash-da-campanha>/<pt|en>`, GET/HEAD, revalidação de cache.
- Versão fixa: `/emails/<slug>/<pt|en>/v/<numero>`, GET/HEAD, ETag/cache imutável.

O slug é fixado na primeira publicação e preservado quando o título muda. PT e EN têm sequências independentes. O HTML público contém somente o e-mail, com CSP sem scripts, sem cookies, editor ou dependência de IndexedDB. Assets de marca embarcados são copiados para versões fixas no R2 durante publicação para que alterações futuras da logo não alterem v1.

## Pré-flight e RD Station

Checks extensíveis têm `id`, `category`, `severity` e `message`. Há conteúdo obrigatório, assunto/preheader e limites recomendados, slot ativo sem imagem, HTTPS, ALT, CTA, links do rodapé/editoriais, carregamento remoto, peso/formato/dimensões/orientação quando conhecidos e inspeção do HTML final (scripts/eventos/iframe, data URLs, paths relativos, endereços privados, viewport, tabelas, 600 px e peso).

Descadastro tem duas opções explícitas: `link` exige URL real fornecida pelo operador; `rd-managed` exige URL manual vazia e omite o descadastro do HTML, avisando que o RD deve inseri-lo no disparo. Não existe token inventado, URL fictícia ou duplicação automática. A homologação de importação e disparo dentro de uma conta real do RD Station continua necessária.

## Interface mínima

- Editor: `Publicar online` abre hospedagem das fotos locais, pré-flight, publicação e links para versões.
- Imagens: `Hospedar esta imagem` e `Escolher da biblioteca online`.
- Marca e rodapé: opção explícita de descadastro.
- A camada de API permite gestão completa de assets e materiais para a próxima etapa visual. A UI geral não foi redesenhada.

## Desenvolvimento e testes

`pnpm install`, `pnpm db:migrate:local`, `pnpm build` e `pnpm start` iniciam o Worker local. `pnpm dev` permanece para edição visual rápida do Next; as APIs online são do Worker, não do servidor Next.

Para a suíte completa de navegador, iniciar o Worker com `pnpm exec wrangler dev --ip 127.0.0.1 --port 3000 --var SITE_ORIGIN:https://studio.example.com`. Essa origem virtual é interceptada apenas nos testes. A identidade simulada nos testes locais não deve ser usada como mecanismo de login em produção. Sites encaminha a identidade real.

Validação exigida: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec playwright test`. Testes usam SQLite com as migrações reais, além do Worker local com D1/R2 e Playwright. Cobrem retenção, autorização, MIME, corrupção, transparência, deduplicação, SSRF, redirects, fallback de HEAD, pré-flight, idempotência e publicação imutável PT/EN.

### Resultado em 30/09/2026

- Typecheck, lint e build: aprovados.
- Testes de domínio/servidor: 17 aprovados.
- Playwright: suíte original de 8 cenários aprovada, mais 1 cenário adicional aprovado para abertura do diálogo de publicação e bloqueio de escrita anônima (9 cenários cobertos).
- O teste integrado local usa o Worker, D1 e R2 reais do emulador: upload, URL HTTPS virtual, pré-flight, PT v1/v2, EN v1, carregamento anônimo de todas as imagens, retenção e comparação integral do HTML de v1 após v2.
- Publicação GPT Sites versão 2 concluída, com variáveis de ambiente revisão 1 e fonte `02fb5175f80f1b67b656e9a44d7c8732d36a5afd`.
- Produção: `/` retorna 200 sem sessão; `/api/session` e `/api/assets` retornam 401 sem sessão. Cabeçalhos de identidade forjados também retornam 401. Consulta a e-mail inexistente retorna 404, sem erro de banco.
- **Pendente de sessão válida:** repetir upload/publicação autenticados no domínio real. O login do ChatGPT retornou erro 400 do provedor (`Invalid content type`) e, na repetição, permaneceu na verificação de segurança. A autenticação não foi contornada. Isso limita a homologação em produção, não substituída pelos testes locais.
- Uma campanha local identificada como `Homologação técnica · Fase 3A` foi criada para essa verificação; nenhum e-mail dessa campanha foi publicado ou enviado.

## Limites conhecidos

- Imagens externas podem ser alteradas pelo seu provedor; para retenção garantida, usar o catálogo. O HTML da publicação nunca muda.
- Dimensões de imagens externas não são inferidas por HEAD; geram aviso. Imagens do catálogo têm dimensões verificadas na decodificação.
- Rascunhos continuam específicos do navegador; apenas assets, materiais e publicações são online. Backups JSON ainda são necessários para transportar rascunhos entre computadores.
- Exclusão lógica retém bytes, portanto não reduz automaticamente o consumo de R2.
- A configuração de editores é administrativa, pela variável protegida do Sites; não existe tela de gestão de usuários nesta etapa.
- Não é possível homologar entrega, descadastro e importação real do RD Station sem acesso à conta e um disparo de teste.
