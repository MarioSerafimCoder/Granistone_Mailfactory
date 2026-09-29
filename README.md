# Granistone Mail Studio

Aplicativo interno para transformar um planejamento mensal de CRM em campanhas de e-mail com o design da Granistone. O MVP cobre XLSX → campanhas → template → edição Maily → preview desktop/mobile → HTML para importação manual no RD Station. A segunda fase reforçou deduplicação, avisos por linha, autosave, materiais, identidade da marca e diferenças reais entre os cinco templates.

## Executar

Requisitos: Node.js 22 ou superior e pnpm. Não precisa de chaves, banco de dados nem variáveis de ambiente.

```sh
pnpm install
pnpm dev
```

Abra http://127.0.0.1:3000. Os comandos `npm install` e `npm run dev` também podem ser usados; o lockfile versionado é o do pnpm. Para repetir exatamente as versões verificadas, prefira `pnpm install --frozen-lockfile`.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm start
```

Com o servidor de produção ativo, `pnpm exec playwright test` executa a verificação de navegador. No Windows usa o Microsoft Edge instalado; em outros sistemas, instale o Chromium com `pnpm exec playwright install chromium`.

O script `Iniciar Studio.ps1` permite iniciar o projeto no Windows com as dependências já instaladas. Ele também reconhece o runtime local do Codex quando Node não estiver no PATH.

## Primeiros passos

1. **Importar planejamento**: baixe a planilha modelo, carregue XLSX/XLS e confira resumo, campanhas, templates sugeridos e avisos. Nenhuma linha é salva sem clicar em Importar.
2. Abra a campanha. O template é sugerido pelo tipo e pelo público. Edite o planejamento e selecione outro template em **Estrutura**, se necessário.
3. Preencha assunto, preheader, conteúdo, imagens e CTA. **Português / English** alterna conteúdos independentes. Não existe tradução automática.
4. Use **Estrutura** para exibir/ocultar blocos. A newsletter permite mudar a ordem. Cabeçalho e rodapé são fixos; largura, fontes e espaçamentos não são livres.
5. Confira o preview desktop/mobile. Ele recebe o HTML real da mesma função usada na exportação.
6. Abra **Marca e rodapé** e configure os links da empresa, descadastro e endereço público das imagens.
7. Exporte HTML, JSON, assunto ou preheader. Faça um disparo de teste no RD Station antes de publicar.

As cinco campanhas iniciais são **demonstrações**. Os materiais Crystal Palace, Speranza e Amazon Green contêm textos de exemplo, sem fotos nem propriedades técnicas atribuídas a materiais reais. Confira tudo com a equipe antes de usar comercialmente.

## Arquitetura

| Pasta                   | Responsabilidade                                                      |
| ----------------------- | --------------------------------------------------------------------- |
| `app/`                  | Next.js App Router, estilos, página e rota de renderização            |
| `components/`           | Campanhas, editor, importação, exportação, biblioteca, configurações  |
| `components/email/`     | Blocos exclusivos da marca, cabeçalho e rodapé                        |
| `campaigns/`            | Modelo de domínio, criação, troca de template e status                |
| `templates/registry.ts` | As cinco famílias e a regra de sugestão                               |
| `import/`               | Leitura SheetJS e normalização independente da interface              |
| `export/`               | Renderização, verificação de prontidão e downloads                    |
| `lib/tokens/`           | Cores, tipografia, espaçamentos e dimensões do e-mail                 |
| `lib/storage.ts`        | Persistência versionada e validação de backups                        |
| `lib/safety.ts`         | Escape, URLs permitidas e normalização de texto rico                  |
| `types/`                | Tipos de campanha, conteúdo, marca e material                         |
| `data/`                 | Configuração inicial, materiais e campanhas demonstrativas            |
| `public/brand/`         | Logo original fornecida e ícones PNG para e-mail                      |
| `tests/`                | Testes de domínio, importação, segurança, render e fluxo no navegador |

### Dados e persistência

`Campaign.content.pt` e `Campaign.content.en` compartilham `template`, `blocks`, `alignment` e, pela interface, as imagens principais. Cada idioma mantém assunto, preheader, texto rico Maily, alt text, CTA e blocos editoriais próprios. Alterar tipo/público recalcula a sugestão; a seleção manual fica disponível em Estrutura.

IndexedDB armazena as campanhas, imagens e configurações da marca. Dados válidos das chaves `granistone-mail-studio:v1` e `v2` são migrados na primeira abertura. O estado só é carregado após a hidratação do navegador. O autosave usa debounce de 500 ms e mostra **Salvando…**, **Salvo** ou erro. Falhas de leitura/escrita são exibidas e os dados corrompidos não são descartados automaticamente. Se faltar espaço, a edição fica em memória e o aviso solicita backup.

**Baixar backup** exporta todo o estado. **Restaurar JSON** aceita uma campanha individual ou um backup versionado; adiciona IDs ausentes sem substituir campanhas existentes nem configurações atuais. Uma campanha individual importada recebe novo ID. Dados não sincronizam entre navegadores, origens, portas ou computadores. Limpar os dados do navegador apaga a cópia local.

Status: Pendente, Em produção, Revisão, Aprovado e Exportado. Alterar uma campanha aprovada/exportada retorna o status a Em produção. Exportar o HTML final do idioma atual marca a campanha como Exportado. O MVP ainda não controla aprovação/exportação separadamente por idioma. Baixar rascunho/JSON não altera o status.

### Templates e novos blocos

As cinco famílias são Institutional, Product Architect, Product Commercial, Newsletter e Notice. A regra de seleção está em `suggestTemplate`: Produto + arquitetos/especificadores/designers usa Product Architect; outros públicos de produto e campanhas promocionais usam Product Commercial.

- **Institutional** prioriza hero, narrativa curta, espaço em branco e CTA discreto.
- **Product Architect** posiciona o nome do material antes da headline e conduz a leitura por imagem, conceito, aplicação e especificação.
- **Product Commercial** usa um quadro objetivo de diferenciais/aplicações, disponibilidade destacada e CTA comercial.
- **Newsletter** separa artigo, material, agenda e projeto por módulos com divisores; seus blocos podem ser ocultados e reordenados.
- **Notice** centraliza data, título e informação complementar para produção rápida.

Os tokens de largura, cores, tipografia, padding, títulos, botões, divisores e rodapé ficam em `lib/tokens/email.ts`. Todos os templates usam 600 px e os mesmos componentes de cabeçalho e rodapé.

Para criar um template:

1. Adicione um identificador em `TemplateId` e uma entrada no registro, com os blocos permitidos e a regra de reordenação.
2. Ajuste `suggestTemplate` caso a sugestão automática deva usá-lo.
3. Reutilize os blocos existentes. Todas as famílias passam por `renderEmail` e pelo mesmo cabeçalho/rodapé.
4. Acrescente um caso aos testes e confira desktop/mobile.

Para criar um bloco Granistone:

1. Adicione seu identificador em `BlockId`, o rótulo no registro e os campos de conteúdo tipados.
2. Inicialize os campos em `emptyContent`, atualize os dados demonstrativos e a validação/migração de armazenamento quando necessário.
3. Implemente a edição em `ContentFields` e a renderização em `components/email/blocks.ts`.
4. Registre a saída em `export/render.ts` e os critérios de exportação em `export/validate.ts`.
5. Escape textos com `escapeHtml` e aceite somente URLs validadas. Não permita HTML fornecido pelo usuário.

### Integração Maily e decisões técnicas

Usa `@maily-to/core` 0.3.7 para edição real, com toolbar própria. O kit nativo mantém os recursos internos exigidos pelos menus; os comandos livres e as extensões de layout foram desativados. O schema de documento é adaptado para `block+`, pois o upstream referencia explicitamente o grupo `columns`, mesmo quando a opção de colunas está desligada. O conteúdo salvo e renderizado passa por uma lista restrita de nós/marcas.

O código do renderer `@maily-to/render` 0.2.3 não oferece um registro público de renderizadores para tipos arbitrários: a seleção interna de nós é fechada. Por isso os blocos de marca são compostos na camada do produto, e o texto rico é renderizado por `Maily.children()`. Isso evita um fork da biblioteca e não expõe HTML/CSS livre ao usuário.

`@react-email/render` serializa a árvore produzida pelo Maily. É a mesma dependência de renderização usada internamente pelo Maily e evita a importação direta de `react-dom/server`, que o compilador de rotas do Next rejeita. O Maily continua sendo o editor e renderer do conteúdo rico; não houve substituição silenciosa de editor.

`POST /api/render` é uma função sem estado que valida o payload e devolve HTML. Não salva campanhas, não envia e-mails, não busca URLs externas e não se conecta a nenhum CRM. A interface usa uma requisição curta com debounce e cancela respostas antigas. A exportação só fica habilitada para o preview correspondente ao estado atual.

Referência consultada: [repositório oficial Maily](https://github.com/arikchakma/maily.to) e tipos/código das versões instaladas.

### Importação XLSX

SheetJS 0.20.3 vem do [endpoint oficial](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), pois a versão do registro npm está desatualizada.

- Até 10 MB por arquivo. Processamento no navegador; a planilha não é enviada a um serviço externo.
- Todas as abas são analisadas. O parser procura a primeira linha com cabeçalho Tema, Nome, Título, Campanha ou Title; tolera linhas de título anteriores.
- Normaliza espaços, caixa, acentos e aliases das colunas.
- Suporta datas Excel, objetos Date, DD/MM/AAAA e AAAA-MM-DD; rejeita datas inexistentes.
- Linhas sem título são ignoradas e informadas. Datas inválidas ficam vazias com aviso. Colunas desconhecidas são ignoradas.
- As abas sem cabeçalho reconhecido aparecem nos avisos. Os nomes das abas lidas são exibidos.
- Cada campanha importada recebe um ID estável derivado de data + título + tipo + público + idioma. Duplicatas existentes ou repetidas dentro da planilha são ignoradas automaticamente.
- O resumo mostra campanhas com data, totais por tipo, versões EN e quantidade de avisos. Cada campanha incompleta mantém avisos próprios, e os detalhes incluem aba e número da linha.
- A regra precisa ser adaptada se o CRM tiver cabeçalhos mesclados complexos ou distribuições diferentes das colunas convencionais.

### HTML e imagens

O e-mail tem 600 px, tabelas de apresentação, atributos de largura, estilos inline, tipografia com fallback, imagens fluidas, preheader oculto, regras responsivas e condicionais para Outlook. O preview fica em `iframe` isolado e sem scripts, nas larguras desktop/mobile, usando exatamente o HTML da exportação. O CTA tem fallback de espaçamento para Outlook.

Uploads locais (PNG/JPG/WebP até 20 MB; GIF até 1 MB) são preparados no navegador e armazenados com a campanha. **Não são imagens prontas para disparo**: hospedagem pública é necessária. O app informa as dimensões recomendadas e bloqueia o HTML final quando uma imagem relevante não tem alt text, há URLs locais, assunto/título/texto necessários vazios, CTA inválido ou links do rodapé pendentes. Não testa a disponibilidade de cada URL externa; o disparo de teste continua necessário.

Em **Marca e rodapé**, o endereço público deve servir `/brand/granistone-logo.png`, `/brand/facebook.png`, `/brand/instagram.png`, `/brand/link.png` e `/brand/whatsapp.png`. Pode ser a origem HTTPS de um deploy ou uma hospedagem de assets com essa estrutura. Uma URL específica de logo substitui só a logo. Os links oficiais de Facebook, Instagram, site e WhatsApp já vêm de `data/granistone.config.ts` e podem ser ajustados na interface.

Os downloads usam nomes previsíveis, como `granistone-crystal-palace-arquitetos-pt.html`. A exportação agrupada também oferece JSON, assunto e preheader.

### Materiais

`StoneMaterial` prepara a biblioteca para dezenas de itens com `id`, `slug`, categoria, descrição, características, aplicações e imagens. A busca funciona por nome ou categoria. Ao selecionar um material em uma campanha já editada, a interface exige escolher entre preencher apenas campos vazios ou substituir o conteúdo; nada é sobrescrito silenciosamente. Crystal Palace, Speranza e Amazon Green continuam como dados demonstrativos, sem alegações técnicas reais.

Enquanto existirem pendências, **Baixar HTML com fotos locais** permite uma conferência local com os arquivos da marca embutidos. Esse arquivo recebe o sufixo `-local` e é destinado à visualização no computador. O link de descadastro deve ser validado no RD Station; o MVP não inventa uma variável de integração nem remove a necessidade de descadastro.

O HTML foi verificado estruturalmente e em navegador, mas não passou por uma matriz de clientes reais (Outlook, Gmail, Apple Mail e Yahoo) nem por testes no RD Station. WebP e GIF podem exigir conversão a JPG/PNG de acordo com os clientes da sua base.

### Vercel

Importe esta pasta como projeto Next.js. Use `pnpm install --frozen-lockfile` e `pnpm build`; não configure exportação estática, pois o render usa uma rota Node. Nenhuma variável de ambiente é exigida. Os assets em `public/brand` são publicados automaticamente.

O MVP não tem login, como solicitado. O deploy não compartilha dados entre usuários: cada navegador possui seu próprio planejamento. Avalie proteção de acesso na plataforma antes de disponibilizar uma ferramenta interna. Nenhum deploy foi realizado nesta entrega.

## Limitações e próximos passos

- Dados locais e limite de armazenamento do navegador; backup manual.
- Sem envio, login, contatos, analytics, backend persistente, IA, tradução automática ou integração RD Station.
- Registro de materiais demonstrativo e editável no código; sem gestão de catálogo ou hospedagem de imagens.
- Status único por campanha e sem histórico multiusuário.
- Não valida imagens remotamente nem executa testes em clientes de e-mail reais.
- Próximos passos: importar uma planilha real para ajustar aliases; cadastrar dados/fotos aprovados; publicar imagens; homologar HTML e descadastro no RD Station; depois avaliar integrações.

## Assets

Logo: arquivo `Granistone_logo_2026.png` fornecido pelo usuário, copiado sem modificações. Rodapé implementado em HTML a partir da referência anexada. Ícones de Facebook, Instagram e WhatsApp derivados de [Simple Icons](https://github.com/simple-icons/simple-icons) (CC0); ícone Link de [Lucide](https://lucide.dev/license) (ISC), rasterizados em PNG para compatibilidade de e-mail. As marcas pertencem aos respectivos titulares.

## Layouts pré-montados e fotos do computador

Na biblioteca, as miniaturas são geradas pelo mesmo renderer dos e-mails. Cada modelo tem uma composição própria:

- Institutional: capa panorâmica e título centralizado.
- Product Architect: foto de material e aplicação ao lado das especificações.
- Product Commercial: vitrine com foto à esquerda e chamada/CTA à direita.
- Newsletter: abertura editorial, banner e módulos com imagem/artigo e agenda/projeto.
- Notice: comunicado centralizado e faixa de imagem compacta.

Novas campanhas manuais abrem com texto inicial editável e espaços de imagem. Em **Montar e-mail**, clique em uma área de imagem para escolher **Computador** ou **Link da web**. Também é possível arrastar o arquivo para o seletor. JPG, PNG e WebP de até 20 MB são otimizados localmente para até 1600 px; GIFs de até 1 MB preservam a animação. Fotos PNG grandes são compostas sobre fundo branco durante a otimização. Imagens pequenas mantêm o arquivo original, inclusive transparência. A origem web exige o link direto de uma imagem e verifica se ela abre antes de substituir a foto atual.

**Visualizar final** mostra o HTML sem controles nem espaços vazios. A edição visual usa um iframe sem permissão de scripts; os cliques são tratados pelo aplicativo, e nenhum controle de edição é incluído na exportação.

**Baixar HTML com fotos locais** incorpora as fotos carregadas e os arquivos locais da marca em um HTML que pode ser aberto no computador. Imagens vindas de URLs externas continuam dependendo dessas URLs. Para enviar pelo RD Station, as imagens precisam estar hospedadas em endereços públicos: o HTML com imagens incorporadas é para visualização local, não uma promessa de compatibilidade com clientes de e-mail.

O armazenamento passou a usar **IndexedDB** no navegador, adequado a campanhas com fotos. Na primeira abertura, os dados existentes do localStorage v1/v2 são migrados automaticamente e a cópia anterior é preservada. O backup JSON continua incluindo as imagens e todo o conteúdo. A interface só indica **Salvo** após a confirmação da gravação. Dados continuam locais, sem upload de fotos a serviços externos e sem sincronização entre computadores.


Backups JSON com fotos aceitam arquivos de até 100 MB. Além do autosave, uma recuperação compacta protege edições ainda pendentes durante a recarga da página; fotos já gravadas são referenciadas sem duplicá-las no armazenamento pequeno do navegador.
