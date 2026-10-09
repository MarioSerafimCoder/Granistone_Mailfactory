# Blocos, templates compartilhados e backgrounds

## Auditoria e decisões

A aplicação existente é um frontend Next.js exportado estaticamente, com Worker, D1 e R2. Campanhas usam IndexedDB e a fila de sincronização existente; membros, edição exclusiva temporária (lease), revisão otimista, histórico, pré-flight e publicações imutáveis permanecem no mesmo fluxo.

Não houve reescrita nem novas dependências. Campanhas antigas continuam usando `blocks` e seu renderer original até uma operação de bloco; `sections` e `design` são campos opcionais no mesmo documento. Todos os nove templates permitem inserir blocos pela biblioteca do canvas e adicionar ou editar blocos em **Estrutura**, sem uma etapa prévia de conversão. Na primeira operação, a composição original é convertida em seções, preservando textos formatados, imagens, idiomas, alinhamento e histórico. A conversão reorganiza a composição e pode ser desfeita; revise o preview antes de publicar. **Estrutura → Controles da composição original** mantém as opções de ocultar e ordenar elementos sem converter. A conversão explícita continua disponível em **Usar blocos livres**.

O botão **Editar bloco** no canvas abre os campos do bloco no painel lateral. A biblioteca de templates aplica a escolha diretamente; o seletor em **Estrutura** também está disponível para campanhas com seções. Trocar de template substitui a estrutura e o design pelo modelo escolhido e pode ser desfeito. Selecionar o template atual preserva as edições. Alterar público ou tipo de conteúdo no planejamento não troca o template da campanha.

## Modelo e responsabilidades

- `types/design.ts`: seções com ID independente, tipo, conteúdo PT/EN/ES, estado ativo, configurações e rich text opcional; backgrounds tipados; blueprint de template; bloco/template salvo com revisão e autoria.
- `blocks/registry.ts`: 16 definições centrais com nome, ícone, campos/editor, defaults, validação, renderer e compatibilidade.
- `blocks/model.ts`: conversão, duplicação, ordenação e instanciação de templates.
- `blocks/renderers.ts`, `export/background.ts`, `export/rich-body.ts`: HTML de tabelas, estilos inline e texto Maily sanitizado. Preview e exportação chamam `export/render.ts`.
- `lib/tokens/backgrounds.ts`: cores e nove presets Granistone; não aceita CSS livre.
- `components/SectionsEditor.tsx`, `SectionFields.tsx`, `BackgroundEditor.tsx`: edição dividida em componentes.
- `components/SavedDesignLibrary.tsx`, `SavedDesignDialog.tsx`: biblioteca compartilhada, metadados, recuperação de rascunho e controle de edição.
- `server/designs.ts`, `server/worker.ts`, `lib/online.ts`: API D1 autenticada no mesmo workspace.

Os 16 blocos são hero editorial, hero de produto, imagem + texto, texto + imagem, texto centralizado, produto destaque, dois produtos, galeria, informações técnicas, aplicações, quote, CTA, divisor, espaçador, banner e rodapé complementar. Até 40 seções por campanha. Podem ser adicionados, ordenados pelos botões, desativados, duplicados ou removidos. Salvar um bloco e inseri-lo em outra campanha faz uma cópia independente, incluindo idiomas, imagens e configurações.

**Duplicar campanha** cria ID e IDs de seção novos, status Em produção nos três idiomas, data de planejamento vazia e histórico novo. Preserva textos, traduções, imagens e design; não copia origem de importação, aprovação, revisões ou publicações.

**Salvar como template** gera placeholders nos textos, remove rich text específico e limpa imagens de conteúdo/links específicos; mantém backgrounds escolhidos como parte do design. O formulário permite revisar tudo antes de salvar. Templates ficam em **Templates → Templates Granistone**. Editar um template não altera campanhas já criadas com ele. Os cinco templates padrão continuam imutáveis.

## Persistência, colaboração e migração

`drizzle/0011_reusable_designs.sql` cria `reusable_designs`, índice e proteções transacionais. Dados ficam em D1; bytes das imagens continuam em R2. Nenhuma migração reescreve campanhas ou publicações antigas.

- Listar/ler exige membro ativo. Criar/editar exige editor. Excluir exige administrador.
- Atualizar/excluir exige lease de `design` e revisão atual; o mesmo guard transacional verifica permissão e validade do lease.
- Criação tem ID escolhido pelo cliente para reenvio idempotente. Edição incrementa revisão e rejeita versões antigas.
- Referências a imagens locais são hospedadas com o helper existente antes da gravação; referências hospedadas são validadas. Triggers impedem apagar imagem usada por um design ativo ou salvar referência a imagem excluída.
- Campanhas mantêm fila offline no IndexedDB. Formulários de biblioteca usam o mecanismo existente de rascunho local e recuperação; salvar na biblioteca exige conexão. A coleção atualiza a cada 15 segundos, ao focar a janela ou por **Atualizar coleção**.
- A assinatura de publicação considera design, estrutura e conteúdo apenas do idioma publicado. Mudanças visuais invalidam aprovações pertinentes; alterar espanhol não invalida a aprovação nem a assinatura do português.
- Blocos e templates são cópias, não vínculos vivos. A exclusão lógica de um template não remove campanhas derivadas.

Aplicação local: `pnpm db:migrate:local`. O empacotamento inclui a migration para aplicação pelo hosting Sites.

## Backgrounds e compatibilidade de e-mail

Disponíveis no e-mail, área de conteúdo e cada bloco: nenhum, cor sólida, gradiente de duas cores, imagem ou preset. A interface mostra uma prévia de cada escolha e uma galeria visual dos presets. Imagens aceitam cover/contain/tamanho original, posição vertical e horizontal, repetição, overlay escuro e fallback. Gradientes aceitam direção vertical/horizontal/diagonal e fallback. Presets: branco, off-white pedra, preto Granistone, bege quente, cinza mineral, gradiente escuro, preto/grafite, areia e imagem de material (exige escolher a imagem).

HTML mantém 600 px, tabelas, estilos inline, atributo `bgcolor` e cor de fundo explícita. Não depende de grid/flex, scripts ou CSS de variáveis. Gradientes e imagens CSS são melhorias progressivas; **Outlook desktop pode mostrar somente a cor sólida**. Não se usa VML para fundos. Webmail, aplicativos e versões variam; imagens bloqueadas, modo escuro e sanitização podem alterar cores, overlay e posicionamento. Não colocar informação essencial somente em backgrounds. Cabeçalho e rodapé institucional preservam seu próprio estilo.

O pré-flight verifica fallback, HTTPS público, disponibilidade, tamanho, formato, referência externa, contraste estimado e alertas de cliente. Contraste é estimado contra fallback e extremos do gradiente; não analisa os pixels da fotografia. Imagens de fundo são incluídas na retenção das publicações. Versões publicadas continuam armazenando HTML imutável.

## Interface e tema

`app/theme.css` concentra os tokens semânticos da interface, com tema claro e escuro. A preferência fica no navegador; sem preferência salva, a aplicação usa `prefers-color-scheme`. O botão fica em **Configurações**. O tema muda apenas a interface: a prévia do e-mail continua em seu próprio documento, e o HTML publicado não recebe tokens nem estilos do editor.

A biblioteca de blocos oferece busca, categoria, miniatura, seleção e ações diretas de inserir, editar, duplicar e excluir. A biblioteca de materiais mostra capas e filtros de nome/categoria/status; a edição abre em painel lateral. A galeria desse painel mostra até 80 imagens por vez e pode ser refinada por nome ou pasta. A lista atual de materiais da API tem limite de 500 itens; paginação de materiais continua como melhoria para catálogos maiores.

Pastas abaixo de **Imagens Catálogo** aparecem automaticamente como pedras na aba **Materiais**, inclusive suas fotos em subpastas. **Fotos institucionais** fica apenas em Imagens. Uma pedra ainda sem ficha própria pode ser aberta para ver as fotos, ir à pasta ou cadastrar descrição e características; a ficha salva substitui a entrada automática com o mesmo nome, sem duplicar a pedra. O seletor de materiais no editor também usa essas pastas e prioriza suas fotos na biblioteca de imagens. Isso aproveita a organização já hospedada, sem migração de banco ou cadastro em massa.

## Validação e próximos passos

`tests/designs.test.ts` cobre registro, renderização, cópia independente, backups legados, conversão rich text, tradução, aprovação por idioma, background/fallback, pré-flight, publicação imutável, D1, autorização, lease, CAS e proteção de imagens.

`tests/browser/designs.spec.ts` cobre adicionar/remover/duplicar/ordenar/desativar seções, salvar/inserir bloco, duplicar campanha, salvar/editar/duplicar/excluir template, derivar campanha, compartilhar entre dois navegadores, conversão legada, fundos sólidos/gradiente/imagem, HTML e pré-flight, desktop/mobile. `tests/browser/theme-ux.spec.ts` cobre tema, persistência, isolamento da prévia do e-mail, larguras de notebook/tablet, busca de blocos, filtros de materiais e abertura do painel por teclado. A suíte existente continua cobrindo importação, imagens, recorte, tradução, sincronização, colaboração e publicação.

Comandos: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec playwright test`.

Próximos trabalhos recomendados: homologação visual em clientes reais (Outlook desktop, Gmail e Apple Mail), paginação da coleção para workspaces maiores, histórico/restauração de versões dos próprios templates e análise de contraste sobre fotografias. Testes de navegador e HTML não equivalem a homologação nesses clientes.
