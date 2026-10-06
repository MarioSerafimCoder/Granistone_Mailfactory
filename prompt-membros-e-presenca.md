# Feature: Membros do workspace, presença e proteção de edição

## Objetivo

Permitir que administradores do Granistone Mail Studio autorizem ou removam funcionários diretamente pela interface da aplicação, sem precisar alterar variáveis de ambiente, secrets ou republicar o projeto.

Também permitir que os membros vejam quem está online, onde outras pessoas estão navegando e quais campanhas ou materiais estão em edição. Evitar que duas pessoas alterem o mesmo recurso simultaneamente, mantendo a visualização disponível e preservando o trabalho em caso de desconexão.

O fluxo de autorização deve ser simples:

**Configurações → Membros do workspace → Adicionar membro → informar e-mail → Salvar**

A partir desse momento, quando essa pessoa entrar no Granistone Mail Studio autenticada com o mesmo e-mail, deverá ter acesso automaticamente ao workspace compartilhado.

---

## 1. Nova área na interface

Adicionar em:

**Configurações → Membros do workspace**

A tela deve mostrar:

- Nome, quando disponível.
- E-mail.
- Função.
- Status.
- Data de entrada.
- Último acesso, quando disponível.
- Presença atual: online, ausente ou offline.
- Local atual no aplicativo, quando online: navegando, visualizando ou editando um recurso.
- Ações disponíveis.

Exemplo:

| Usuário | Função | Status | Último acesso |
|---|---|---|---|
| Mario | Administrador | Ativo | Agora |
| flavia@granistone.com.br | Editor | Ativo | Hoje, 09:42 |
| marketing@granistone.com.br | Editor | Ativo | Ontem |

---

# 2. Adicionar membro

Botão:

**+ Adicionar membro**

Abrir modal:

### Adicionar ao workspace

Campo:

**E-mail**

Exemplo:

`flavia@granistone.com.br`

Campo:

**Permissão**

Inicialmente disponibilizar apenas:

- **Administrador**
- **Editor**
- **Visualizador**

Botão principal:

**Adicionar membro**

Não será necessário gerar senha, convite próprio ou cadastro dentro do Mail Studio.

O usuário continuará entrando através da autenticação já fornecida pelo ChatGPT Sites.

O sistema apenas verifica se o e-mail autenticado pertence à lista de membros autorizados.

---

# 3. Funções

## Administrador

Pode:

- Criar campanhas.
- Editar campanhas.
- Excluir/restaurar campanhas.
- Publicar.
- Gerenciar biblioteca.
- Alterar Marca e rodapé.
- Adicionar membros.
- Remover membros.
- Alterar permissões.

## Editor

Pode:

- Criar campanhas.
- Editar campanhas.
- Sincronizar campanhas.
- Utilizar biblioteca.
- Preparar conteúdo para RD Station.
- Publicar campanhas.

Não pode:

- Gerenciar membros.
- Alterar permissões administrativas.

## Visualizador

Pode:

- Consultar campanhas.
- Abrir previews.
- Consultar histórico.
- Consultar materiais e biblioteca.

Não pode alterar dados.

---

# 4. Banco de dados

Criar tabela:

`workspace_members`

Estrutura sugerida:

```text
id
email
name
role
status
created_at
created_by
updated_at
last_seen_at
```

Valores:

```text
role:
admin
editor
viewer

status:
active
disabled
```

O `email` deve:

- ser convertido para lowercase;
- remover espaços;
- possuir índice UNIQUE.

Exemplo:

```text
email: flavia@granistone.com.br
role: editor
status: active
```

---

# 5. Nova lógica de autenticação

Hoje:

```text
ChatGPT Login
↓
e-mail autenticado
↓
EDITOR_EMAILS
↓
permitido / bloqueado
```

Nova arquitetura:

```text
ChatGPT Login
↓
oai-authenticated-user-id
oai-authenticated-user-email
↓
workspace_members
↓
membro ativo?
↓
SIM → obter role
NÃO → bloquear acesso
```

O backend deverá continuar sendo a autoridade.

Não confiar em permissões fornecidas pelo frontend.

---

# 6. `EDITOR_EMAILS` não deve desaparecer

Não remover imediatamente `EDITOR_EMAILS`.

Transformá-lo em mecanismo de **bootstrap/emergência**.

Regra:

```text
email ∈ EDITOR_EMAILS
        ↓
SUPER ADMIN / OWNER
```

Esses usuários continuam tendo acesso mesmo em caso de:

- problema na tabela de membros;
- remoção acidental de administradores;
- migration incompleta;
- erro de configuração.

Portanto:

```text
EDITOR_EMAILS
= administradores de emergência

workspace_members
= usuários normais do sistema
```

O uso cotidiano deixa de depender de edição de secrets.

---

# 7. Primeiro administrador

Na primeira execução após a migration:

Se `workspace_members` estiver vazio:

os usuários presentes em `EDITOR_EMAILS` devem ser reconhecidos como administradores.

Opcionalmente, o sistema pode criar automaticamente seus registros:

```text
role = admin
status = active
```

Isso evita perda de acesso durante a migração.

---

# 8. Endpoint de sessão

Evoluir:

`GET /api/session`

Hoje retorna aproximadamente:

```json
{
  "editor": true,
  "email": "usuario@empresa.com"
}
```

Passar a retornar:

```json
{
  "authenticated": true,
  "member": true,
  "email": "usuario@granistone.com.br",
  "role": "admin",
  "permissions": {
    "editCampaigns": true,
    "publish": true,
    "manageMembers": true
  }
}
```

---

# 9. API de membros

Criar:

```text
GET    /api/workspace/members
POST   /api/workspace/members
PATCH  /api/workspace/members/:id
DELETE /api/workspace/members/:id
```

### GET

Lista membros.

Somente administrador.

### POST

Entrada:

```json
{
  "email": "flavia@granistone.com.br",
  "role": "editor"
}
```

### PATCH

Permite:

- mudar função;
- ativar/desativar.

### DELETE

Remove acesso ao workspace.

Somente administradores.

---

# 10. Remoção de usuário

Ao clicar em:

**Remover acesso**

mostrar confirmação:

> Remover acesso de flavia@granistone.com.br?

> Essa pessoa não poderá mais acessar o workspace Granistone. As campanhas e alterações realizadas anteriormente serão preservadas no histórico.

Botões:

**Cancelar**

**Remover acesso**

A exclusão do membro nunca deve apagar:

- campanhas;
- histórico;
- publicações;
- autoria;
- assets.

---

# 11. Segurança administrativa

Implementar regras obrigatórias:

### Não permitir remover o último administrador

Se existir apenas um administrador:

```text
Remover → bloqueado
```

Mensagem:

> O workspace precisa ter pelo menos um administrador.

### Não permitir auto-rebaixamento quando for o último administrador

Evita que o próprio administrador tranque o workspace.

### Verificação sempre no servidor

Não basta esconder botões no frontend.

Todas as rotas administrativas devem chamar algo semelhante a:

```text
requireRole("admin")
```

---

# 12. Auditoria

Registrar ações administrativas.

Exemplo:

```text
Mario adicionou flavia@granistone.com.br como Editor
06/10/2026 · 11:32
```

```text
Mario alterou João de Editor para Visualizador
07/10/2026 · 09:14
```

```text
Mario removeu acesso de usuario@granistone.com.br
08/10/2026 · 15:47
```

Tabela opcional:

`workspace_member_events`

Campos:

```text
id
member_id
action
actor_email
previous_role
new_role
created_at
```

---

# 13. UX para usuário sem acesso

Hoje o sistema simplesmente informa:

> Esta conta não está autorizada no workspace Granistone.

Melhorar para uma tela dedicada.

### Você não possui acesso ao workspace Granistone

Você está conectado como:

`usuario@email.com`

Para acessar este workspace, peça a um administrador para adicionar este e-mail em **Configurações → Membros do workspace**.

Botão:

**Entrar com outra conta**

Não mostrar erros técnicos, HTTP 403 ou detalhes internos.

---

# 14. UX para administrador

Dentro de Configurações:

```text
Configurações

Marca e rodapé
Membros do workspace
Integrações
```

Em **Membros do workspace**:

```text
Membros do workspace                         + Adicionar membro

3 membros

[M]
Mario
mario@granistone.com.br
Administrador
Você

[F]
Flavia
flavia@granistone.com.br
Editor
⋯

[J]
João
joao@granistone.com.br
Visualizador
⋯
```

Menu `⋯`:

```text
Alterar função
Desativar acesso
Remover membro
```

---

# 15. Experiência de entrada

O objetivo principal da feature é que o processo completo passe a ser:

### Administrador

1. Abre Granistone Mail Studio.
2. Acessa Configurações.
3. Acessa Membros do workspace.
4. Clica em Adicionar membro.
5. Digita o e-mail.
6. Seleciona Editor.
7. Salva.

### Funcionário

1. Recebe o link do Mail Studio.
2. Entra no ChatGPT com aquele e-mail.
3. Abre o Mail Studio.
4. O sistema identifica automaticamente sua conta.
5. O workspace é carregado.

Nenhuma configuração de servidor deve ser necessária para o administrador no uso cotidiano.

---

# 16. Compatibilidade com arquitetura atual

Preservar completamente:

- D1 como fonte oficial das campanhas.
- R2 para imagens.
- IndexedDB como cache/offline.
- sistema de revisions;
- conflitos;
- histórico;
- auditoria de campanhas;
- `oai-authenticated-user-id`;
- `oai-authenticated-user-email`;
- proteção de origem;
- sincronização atual.

A gestão de membros deve modificar a camada de autorização. A presença e a proteção de edição devem acrescentar uma camada de coordenação aos recursos compartilhados, integrada às verificações existentes de revisions e conflitos.

Alterar os pontos de gravação somente quando necessário para validar a reserva de edição e a versão do recurso no servidor. Preservar o comportamento de sincronização, cache e histórico, sem permitir que uma sincronização antiga ignore essas verificações.

---

# 17. Migração

Criar uma migration nova.

Exemplo:

```text
0007_workspace_members.sql
```

Não editar migrations anteriores.

A migration deve ser aditiva.

Adicionar:

```text
workspace_members
workspace_member_events
```

se a auditoria for implementada.

Adicionar também `workspace_presence_sessions` e `workspace_edit_locks`, conforme as seções abaixo. Usar a próxima numeração disponível no projeto; `0007` é apenas um exemplo.

---

# 18. Critérios de aceite

A feature estará concluída quando:

- Um administrador conseguir adicionar um e-mail pela interface.
- O novo usuário conseguir acessar imediatamente o mesmo workspace.
- Não for necessário editar `EDITOR_EMAILS`.
- Não for necessário republicar o site para adicionar membros.
- Um administrador conseguir alterar funções.
- Um administrador conseguir remover acesso.
- Usuário removido receber `403` nas APIs protegidas.
- Usuário removido não perder autoria registrada anteriormente.
- Editor não conseguir acessar gerenciamento de membros.
- Viewer não conseguir modificar campanhas.
- O último administrador não puder ser removido.
- `EDITOR_EMAILS` continuar funcionando como acesso administrativo de emergência.
- Todas as verificações críticas acontecerem no backend.
- As campanhas existentes continuarem intactas.
- Membros autorizados conseguirem ver quem está online e o recurso atual de cada pessoa.
- Avatares distinguirem visualização de edição, com nome e estado acessíveis.
- Abrir um recurso para consultar não adquirir uma reserva de edição.
- Duas tentativas simultâneas de editar o mesmo recurso resultarem em apenas uma reserva válida.
- O servidor rejeitar alterações sem reserva válida ou com revision desatualizada.
- Uma segunda aba, inclusive do mesmo usuário, não conseguir gravar usando a reserva da primeira.
- Desconexão, fechamento inesperado ou sessão expirada liberarem a reserva após seu prazo de validade.
- Um cliente com reserva expirada não conseguir salvar, renovar ou liberar a reserva de outro cliente.
- Alterações locais serem preservadas quando houver perda da reserva, sem sobrescrita automática ao reconectar.
- Remover ou rebaixar um membro invalidar sua possibilidade de editar na próxima operação protegida, mesmo com reserva anterior.
- Falha na presença não bloquear a navegação; indisponibilidade da validação de edição impedir gravações compartilhadas e preservar o rascunho local.

---

# 19. Presença no workspace

## Conceito

Combinar dois mecanismos complementares:

1. **Presença:** mostrar quem está usando o workspace e onde está navegando.
2. **Reserva temporária de edição:** permitir apenas uma sessão editora por recurso, com validação no backend.

Os avatares ajudam a equipe a se coordenar. A reserva e a verificação de revision são responsáveis por impedir sobrescritas.

## Indicadores visuais

No cabeçalho do aplicativo, mostrar os avatares dos membros online. Usar foto quando disponível ou iniciais, com cor consistente por usuário e identificação de “Você”. Agrupar múltiplas abas da mesma pessoa no indicador geral; ao expandir, mostrar seus locais ativos.

Ao clicar ou passar o mouse, exibir:

```text
[F] Flavia · Online
Editando “Campanha de outubro”

[J] João · Online
Visualizando a biblioteca

[M] Mario · Ausente
```

Nas listas de campanhas e materiais, mostrar junto ao recurso:

- Avatares das pessoas que estão visualizando.
- Ícone de lápis e nome de quem está editando.
- “+N” para participantes adicionais, com lista expansível.

No editor, manter um indicador discreto:

> Flavia está editando esta campanha. Você está no modo de visualização.

Permitir abrir previews e consultar conteúdo mesmo quando houver uma reserva ativa.

Não depender apenas de cores, ícones ou hover. Disponibilizar texto, foco de teclado e nomes acessíveis. Em dispositivos móveis, permitir consultar os detalhes por toque.

## Estados

- **Online:** sessão com sinal recente de conexão e atividade recente.
- **Ausente:** conexão ativa, mas sem interação por alguns minutos.
- **Offline:** não há mais nenhuma sessão válida desse membro.
- **Visualizando:** está consultando um recurso sem reserva de edição.
- **Editando:** possui uma reserva válida de edição daquele recurso.

“Editando” deve ser derivado da reserva confirmada pelo servidor. Não aceitar esse estado como uma afirmação do frontend.

O status de acesso `active/disabled` e a presença `online/away/offline` são informações distintas. Uma pessoa offline pode continuar com acesso ativo.

---

# 20. Fluxo de edição protegida

1. O usuário abre uma campanha ou material em modo de visualização.
2. Clica em **Editar**.
3. O backend verifica autenticação, função e disponibilidade do recurso.
4. Se estiver livre, concede uma reserva temporária exclusiva para aquela sessão e aba.
5. A interface habilita a edição somente após a confirmação.
6. Cada gravação valida a reserva e a revision atual no servidor.
7. Ao concluir, o usuário clica em **Salvar e encerrar edição**. A reserva é liberada após confirmação do salvamento.

Se o editor atual inicia a edição automaticamente ao abrir, preservar a experiência somente se a reserva for adquirida antes de habilitar alterações.

Se outra pessoa já estiver editando, abrir em modo de visualização e mostrar:

> Flavia está editando “Campanha de outubro”. Você pode acompanhar o conteúdo e editar quando ela terminar.

Ações:

- **Continuar visualizando**.
- **Editar uma cópia**, para campanhas e recursos que já suportem duplicação. Criar um novo recurso, sem alterar o original.

Quando o recurso ficar disponível, avisar discretamente:

> A edição foi encerrada. Esta campanha está disponível para editar.

Não entrar automaticamente no modo de edição; o usuário deve clicar em **Editar**.

Não é necessário implementar chat, cursores compartilhados ou edição colaborativa dentro do mesmo documento nesta etapa.

## Escopo da reserva

Reservar o recurso completo: campanha, material editável da biblioteca ou configuração compartilhada, como Marca e rodapé. Usar identificadores estáveis, sem depender do nome ou da URL.

Campanhas diferentes podem ser editadas simultaneamente. A reserva de uma campanha não bloqueia o workspace inteiro.

Visualizadores nunca adquirem reservas. Editores e administradores só podem reservar recursos que suas permissões já permitem modificar.

Operações que substituam, excluam ou modifiquem o recurso reservado também devem respeitar a reserva. Aplicar a regra à publicação quando ela gravar estado no mesmo recurso. Downloads e previews podem continuar disponíveis.

---

# 21. Conexão, expiração e recuperação

Implementar presença e renovação da reserva com sinais periódicos enviados ao servidor. Como referência inicial ajustável:

- Heartbeat a cada 15 segundos enquanto a sessão estiver ativa.
- Presença expirada após 60 segundos sem heartbeat.
- Reserva expirada após 90 segundos sem renovação válida.
- Estado ausente após 3 minutos sem interação.

Usar o horário do servidor para decisões de validade. Os intervalos podem ser adaptados às limitações da hospedagem e ao comportamento de abas em segundo plano.

No MVP, usar atualização periódica das informações, com pausa/redução de consultas em abas ocultas e consulta imediata ao voltar para a aba. Renovar a reserva enquanto a sessão estiver editando. Ao recuperar o foco, revalidar a reserva antes de permitir novas gravações. Não adicionar infraestrutura de WebSocket sem necessidade.

Mostrar, quando necessário, **Reconectando…** ou **Presença indisponível**. Não apresentar uma pessoa como online com base em registros expirados.

Tentar liberar a reserva ao sair do editor ou encerrar a sessão, mas garantir recuperação por expiração mesmo quando a aba fechar inesperadamente. Não depender exclusivamente de eventos de fechamento do navegador.

Se houver desconexão ou perda da reserva:

- Preservar alterações locais usando o mecanismo de rascunho/cache existente.
- Pausar salvamento e publicação no recurso compartilhado.
- Informar: “Sua conexão de edição foi interrompida. Suas alterações locais foram preservadas.”
- Ao reconectar, consultar a reserva e a revision atual.
- Readquirir a reserva somente se disponível e comparar a versão antes de salvar.
- Se houver alterações de outra pessoa, usar o fluxo existente de conflitos, com opção de recuperar o conteúdo em uma cópia quando suportado.

Nunca sincronizar automaticamente um rascunho antigo por cima de uma versão mais recente. Itens já existentes na fila offline também precisam passar pelas validações ao sincronizar.

Nesta etapa, não incluir tomada forçada de edição por administrador. Administradores também respeitam reservas ativas; reservas abandonadas são recuperadas por expiração.

---

# 22. Dados e regras de concorrência

## Presença por sessão e aba

Criar `workspace_presence_sessions` com estrutura sugerida:

```text
id
workspace_id
member_id
authenticated_user_id
session_id
tab_id
location_key
resource_type
resource_id
last_activity_at
last_seen_at
expires_at
```

Associar a identidade à autenticação validada pelo servidor. Não confiar em `member_id`, nome, função ou e-mail enviados pelo navegador. Para administradores de emergência, resolver uma identidade estável sem retirar o acesso de bootstrap existente.

Cada aba deve ter identificação própria. Encerrar uma aba não pode marcar a pessoa como offline se outra sessão ainda estiver ativa.

## Reserva de edição

Criar `workspace_edit_locks` com estrutura sugerida:

```text
workspace_id
resource_type
resource_id
holder_user_id
session_id
tab_id
lock_token
lock_generation
acquired_at
renewed_at
expires_at
```

Garantir unicidade por `(workspace_id, resource_type, resource_id)`.

A aquisição, inclusive a substituição de uma reserva expirada, precisa ser atômica no D1: duas requisições simultâneas nunca devem obter reservas válidas para o mesmo recurso. Não implementar como uma consulta seguida de gravação sem proteção contra concorrência.

Cada nova concessão gera um token exclusivo e uma geração monotônica. Renovação e liberação só podem atuar sobre a reserva exata da sessão solicitante. O token não deve aparecer na listagem pública de presença.

A validação da reserva, das permissões e da revision deve fazer parte da mesma operação atômica de gravação, conforme os recursos transacionais disponíveis no projeto. Não deixar um intervalo entre verificar a reserva e gravar que permita sua substituição.

Uma sessão antiga não pode salvar depois da expiração ou depois de uma nova concessão. O token/geração identifica essa situação; a revision continua protegendo contra versões desatualizadas.

Revalidar o acesso atual em toda operação protegida. Ao remover, desativar ou rebaixar um membro, revogar suas reservas incompatíveis e remover sua presença visível quando perder acesso. A proteção permanece válida mesmo se a limpeza falhar.

Limpar registros expirados periodicamente; consultas já devem desconsiderá-los antes da limpeza. Presença é estado transitório, sem necessidade de registrar cada heartbeat no histórico de auditoria.

---

# 23. API e integração

Rotas sugeridas, adaptáveis ao padrão do projeto:

```text
GET    /api/workspace/presence
POST   /api/workspace/presence/heartbeat
DELETE /api/workspace/presence/session

POST   /api/workspace/edit-locks/acquire
POST   /api/workspace/edit-locks/renew
POST   /api/workspace/edit-locks/release
```

A presença pode ser consultada por todos os membros ativos para permitir coordenação. O gerenciamento de membros continua exclusivo de administradores.

A aquisição informa o tipo e o identificador do recurso. O backend valida a existência, o workspace e a permissão correspondente. Quando ocupado, retorna o estado e a identificação exibível de quem edita; quando livre, retorna a reserva e sua validade apenas à sessão titular.

Integrar token/geração e revision às APIs existentes de alteração, sem criar uma rota alternativa que ignore essas validações. Mapear todos os pontos de gravação, incluindo sincronização, restauração e mutações de publicação.

Tratar reserva ocupada, reserva perdida e revision divergente como estados claros na interface. Não exibir erros técnicos ao usuário.

Consultar apenas informações do workspace autorizado. Mostrar nome, avatar e localização funcional necessária à colaboração, sem expor URLs completas, parâmetros, conteúdo digitado, tokens ou dados de outros workspaces.

A presença não precisa depender da API administrativa de membros, que continua restrita. Ela deve fornecer apenas o perfil mínimo necessário para os indicadores.

---

# 24. Validação de presença e edição

Verificar, com sessões independentes e operações concorrentes:

- Dois usuários navegando aparecem corretamente nos indicadores.
- Dois usuários visualizam o mesmo recurso sem bloqueio.
- Dois usuários solicitam edição simultaneamente e apenas um recebe a reserva.
- Duas abas do mesmo usuário não alteram o mesmo recurso simultaneamente.
- Recursos diferentes podem ser editados em paralelo.
- Gravação direta na API sem reserva válida é rejeitada.
- Fechamento inesperado e perda de rede resultam em expiração e recuperação.
- Uma requisição atrasada da sessão antiga não grava nem libera a reserva da nova sessão.
- Um rascunho offline preserva o conteúdo e encontra um conflito se o recurso mudou.
- Remoção ou mudança de função impede as próximas operações incompatíveis.
- Indisponibilidade da presença permite consultar conteúdo; indisponibilidade da coordenação de edição preserva rascunhos e impede gravação insegura.

Priorizar testes que comprovem exclusividade, expiração, autorização e proteção contra sobrescrita, aproveitando a estrutura de testes existente.

---

# Resultado esperado

A gestão do workspace deixa de ser uma configuração técnica:

```text
Secret → EDITOR_EMAILS → republicar
```

e passa a ser uma função normal da aplicação:

```text
Configurações
↓
Membros do workspace
↓
Adicionar funcionário
↓
Acesso liberado
```

O usuário continua utilizando sua própria conta ChatGPT para autenticação, enquanto o Granistone Mail Studio passa a controlar internamente quem possui acesso e qual nível de permissão cada pessoa possui.

Além da gestão de acesso, o workspace passa a mostrar a presença da equipe e proteger cada recurso durante a edição: todos podem acompanhar o conteúdo, cada recurso tem apenas uma sessão editora por vez e alterações locais são preservadas quando a conexão falha.
