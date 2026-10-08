# Granistone Mail Studio — editor visual

Implementação iniciada em `codex/visual-mail-editor` e aprovada para publicação em 08/10/2026. Sem novas dependências e sem migração de banco.

## 1. Auditoria e fluxo preservado

O levantamento cobriu os componentes do editor e Studio, os nove templates, os 16 tipos de seção, modelos e validadores, renderizadores, tradução, armazenamento, sincronização, sessões de edição e testes existentes. A orientação local do Next.js 16.3.6 sobre componentes cliente foi consultada antes da implementação.

O fluxo permanece: `Studio` → `CampaignEditor` → `editCampaign` → salvamento do workspace → cache/fila local e D1. `Studio` mantém a verificação da sessão; o servidor continua verificando permissões, posse da sessão e revisão. Publicação e exportação continuam usando `renderEmail`, com os mesmos controles de imagens públicas, links, pré-flight, tabelas, RD Station e versões imutáveis.

## 2. Alterações implementadas

- Canvas React com edição direta de títulos, parágrafos, chamadas, textos secundários e rótulos de CTA. Cada campo mantém seu editor Tiptap durante digitação, salvamento e alterações de seleção.
- Formatação contextual: negrito, itálico, sublinhado, links seguros, alinhamento, desfazer/refazer e listas nos corpos editoriais compatíveis. O editor conserva a seleção enquanto o usuário preenche o link.
- Campos de assunto e preheader junto à composição. Idiomas, histórico local, modo de edição, HTML final e revisão acessíveis na barra superior.
- Biblioteca recolhível com os 16 blocos existentes, inserção em posição específica e biblioteca compartilhada de blocos salvos.
- Inspetor recolhível para links, alinhamento, cores, fundos, espaçamento e altura. Três estilos rápidos: Branco editorial, Mineral e Preto premium. Tipografia permanece limitada à identidade e ao suporte de e-mail existentes.
- Imagens selecionáveis diretamente no canvas, com biblioteca, upload, URL, ALT, remoção e recorte pelos componentes existentes. Recomendações de proporção preservadas por tipo de bloco e slot legado.
- Blocos livres com alça de arraste, indicador de destino, rolagem durante o arraste, movimentação por teclado, duplicação imediatamente abaixo, remoção recuperável, ocultação e salvamento como bloco reutilizável. IDs e PT/EN/ES são preservados nas movimentações; duplicação gera novo ID. O limite continua em 40 blocos.
- Histórico local de até 80 operações, agrupando digitação contínua em intervalos de 800 ms. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y, Delete fora de campos e Esc. O histórico interno do Tiptap do canvas está desativado para evitar duas pilhas concorrentes.
- Revisão dos idiomas planejados com verificações existentes e localização dos problemas de seções na composição.
- Workspace desktop com navegação compacta, painéis opcionais e área central rolável. Visualização do HTML final em 600 e 375 px permanece disponível.
- Configurações avançadas mantêm planejamento, seleção de material, tradução, estrutura antiga e formulários existentes.

## 3. Decisões técnicas

O `iframe` é somente o preview final. O canvas não injeta `contentEditable` no HTML gerado e não usa `srcDoc` como superfície de edição. O documento exportado não recebe controles ou atributos do novo canvas.

O objeto `Campaign` continua sendo o estado persistente comum. `richFields` é um campo opcional, por idioma, para a formatação de textos antes armazenados somente como strings. Os valores simples são atualizados junto aos documentos ricos para manter a compatibilidade com validação, revisão, tradução e leitores anteriores. Se um formulário antigo alterar o texto simples, uma formatação cujo texto não corresponda deixa de ser aplicada; texto antigo nunca substitui a edição nova. `body` e `richBody` existentes continuam aceitos.

O renderizador preserva os layouts de tabelas e só acrescenta marcação de formatação quando ela existe. A preparação dos campos ricos atua exclusivamente em campos de texto registrados, sem modificar URLs, atributos ou imagens. Conteúdo rico passa pela sanitização existente. Não são permitidas fontes, CSS, scripts ou nós HTML arbitrários vindos da colagem.

Formatação entra na invalidação das aprovações e assinaturas de publicação somente do idioma alterado. Tradução conserva as marcas dos campos ricos. Templates sem conteúdo removem também os documentos ricos; duplicação completa preserva-os.

O histórico local não substitui o histórico compartilhado. Ele reinicia quando a sessão de edição termina ou chega conteúdo externo diferente. A hospedagem automática de uma imagem local é reconhecida como normalização da mesma operação: suas referências são atualizadas também na pilha local, conservando desfazer/refazer.

Campanhas antigas não são convertidas automaticamente. Textos e imagens são editáveis no formato original. Para composição livre com inserção e duplicação arbitrárias, continua disponível a conversão explícita em **Configurações avançadas → Estrutura → Usar blocos livres**. Ela conserva o conteúdo original e pode ser desfeita na sessão; formatação compatível é levada às novas seções. A composição convertida deve ser revisada, como avisa o diálogo.

## 4. Arquivos criados e modificados

Criados:

- `components/canvas/InlineText.tsx`: ciclo de vida Tiptap, seleção, barra flutuante e comandos.
- `components/canvas/CanvasContent.tsx`: layouts React dos blocos e campanhas legadas.
- `components/canvas/VisualWorkspace.tsx`: biblioteca, inspetor, seleção, arraste, ações e revisão.
- `app/canvas.css`: layout desktop, estados e ferramentas do canvas.
- `lib/canvas-model.ts`: atualizações localizadas, conciliação de alterações simultâneas, histórico puro e normalização de imagens.
- `lib/use-campaign-history.ts`: integração do histórico com salvamento e alterações externas.
- `export/rich-fields.ts`: serialização segura dos campos ricos adicionais.
- `tests/canvas.test.ts` e `tests/browser/canvas.spec.ts`: testes específicos do novo editor.
- `docs/EDITOR-VISUAL.md`: este relatório.

Modificados:

- `components/CampaignEditor.tsx`, `components/TranslateDialog.tsx` e `app/layout.tsx`.
- `types/campaign.ts`, `types/design.ts` e `types/online.ts`.
- `blocks/model.ts`, `blocks/registry.ts`, `blocks/renderers.ts` e `campaigns/model.ts`.
- `export/render.ts`, `export/design-checks.ts`, `lib/publication-signature.ts`, `lib/rich-validation.ts`, `lib/storage.ts` e `lib/translation.ts`.
- Testes de navegador existentes em `asset-folders`, `collaboration`, `content`, `designs`, `image-picker`, `layouts`, `new-templates`, `online`, `studio`, `theme-ux`, `ux` e `workspace`: rotas de interação atualizadas para canvas ou configurações avançadas. A interface do editor é validada em desktop; os testes do HTML responsivo continuam em 375 px.

## 5. Recursos reaproveitados

Tiptap, sanitização e renderização rica Maily; registro e fábrica dos 16 blocos; `duplicateSection`, `moveSectionTo` e conversão; `ImagePicker`, `ImageCropEditor` e bibliotecas; `BackgroundEditor` e presets; controles de alinhamento; biblioteca e diálogo de designs; revisão e publicação; IndexedDB, fila de sincronização, D1/R2, histórico compartilhado e sessões de edição. Nenhuma biblioteca foi instalada.

## 6. Validação

Resultados finais em 08/10/2026:

- TypeScript e ESLint: aprovados, sem erros.
- Testes de lógica e integração: **62 aprovados, 0 falhas**, incluindo oito testes novos do modelo do canvas.
- Playwright no Microsoft Edge: **41 aprovados, 0 falhas** em 3 minutos, incluindo sete cenários novos do canvas.
- Regressão de upload seguido de ALT: três repetições adicionais de `content.spec.ts`, com **6 execuções aprovadas**.
- Build de produção do Next.js e preparação do Worker: concluídos com sucesso.
- Conferência visual de capturas em **1440 × 900** e **1366 × 768**; HTML final também verificado em **375 px**. Capturas locais: `test-results/canvas-desktop.png` e `test-results/canvas-properties.png` (artefatos temporários de teste).
- `git diff --check`: sem erros de whitespace.

Os testes abrangem edição contínua sem perda de foco, formatação, alinhamento, parágrafos, colagem segura, links, imagens/recortes, inserção intermediária, arraste e teclado, duplicação, remoção, histórico, idiomas, recarga, modelos antigos e novos, colaboração, permissões, exportação limpa e HTML mobile. A suíte de navegador usa dados locais de QA e não altera campanhas de produção.

Comandos de verificação:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:browser
```

O navegador usa o Worker local com D1/R2 e identidades de teste. Isso não publica a aplicação no Sites. `pnpm dev` sozinho não fornece as APIs do workspace.

## 7. Problemas encontrados e correções

- `setEditable` do Tiptap emite uma atualização por padrão: chamá-lo a cada atualização de props podia restaurar texto anterior. Agora só muda quando a permissão muda e não emite atualização de conteúdo.
- O foco do campo de URL fechava a barra contextual. A seleção agora permanece preservada durante a interação dentro da barra, que fecha ao sair dela.
- O botão de inserção inicialmente tinha altura nula. Recebeu uma área clicável real sem acrescentar espaço ao e-mail.
- Ferramentas de bloco podiam desaparecer na travessia do ponteiro entre bloco e barra. O fechamento por hover recebeu uma pequena tolerância, e seleção/teclado mantêm as ações disponíveis.
- A recomendação genérica de imagem alterava a proporção de recorte legada. As recomendações originais por tipo foram restauradas.
- Mudanças de formatação precisavam invalidar a publicação mesmo sem mudança do texto simples. Assinatura e aprovação agora incluem os campos ricos do idioma correto.
- A hospedagem de uma foto não deve apagar o histórico da troca: referências são normalizadas sem criar nova operação.
- A conclusão de um upload e a edição imediata do ALT podiam enviar cópias defasadas do mesmo conteúdo na mesma atualização do React. A atualização agora aplica somente os campos realmente alterados sobre a versão mais recente, preservando ambos os resultados; seções são conciliadas por ID. Há um teste de regressão específico e o fluxo de navegador passou em três repetições consecutivas.
- A conferência visual ajustou o tamanho do nome do material no template arquitetônico, o alinhamento do corpo de comunicados e a largura máxima de fotos em seções para acompanhar as regras do HTML final.

## 8. Limitações e validação de publicação

- O canvas é uma representação de edição em React; o HTML final em tabelas continua sendo a referência para a composição enviada. Espaços de inserção, placeholders vazios e blocos ocultos são exclusivos da edição. Não foi realizada uma matriz de screenshots em clientes reais como Outlook e Gmail.
- As operações livres de blocos exigem `sections`. Campanhas legadas preservam suas regras originais até conversão explícita. Não se cria uma conversão silenciosa só para permitir duplicação.
- O histórico de desfazer é local à sessão e limitado a 80 checkpoints; a recuperação entre sessões usa o histórico compartilhado existente. Ele não reativa aprovações antigas.
- Painéis são recolhíveis, com larguras fixas; não há redimensionamento manual. Não foi criada uma nova UX mobile para o Studio.
- A tradução real depende da configuração e disponibilidade do provedor existente. Os testes usam respostas controladas; não há consumo intencional de API de tradução real.
- A revisão identifica diretamente problemas de seções. Configurações gerais de marca continuam em **Marca e rodapé**; pré-flight de rede e recursos continua no fluxo de publicação.

Para iniciar a revisão local:

```sh
pnpm db:migrate:local
pnpm build
pnpm start
```

Abrir `http://127.0.0.1:3000/`, entrar com a identidade local autorizada e abrir uma campanha antiga e uma baseada em blocos. Editar no canvas, conferir os três idiomas e alternar para **Visualizar final** em desktop/mobile. Conferir salvamento, **Revisar** e pré-flight antes de publicar. A publicação desta versão foi autorizada pelo usuário; o resultado e a versão ativa devem ser conferidos no histórico do projeto Sites.
