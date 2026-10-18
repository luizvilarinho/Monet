# Integrações externas para o Monet: calendários, Google Sheets, MCP e outras

**Data da pesquisa:** 2026-10-17
**Escopo:** app desktop Windows local-first (Tauri 2 + React 19, SQLite), sem backend, sem conta, dev solo, IA BYOK (OpenRouter + Tavily). O Monet já tem um caderno Calendar e um módulo Tasks, e nenhuma integração externa.
**Método:** documentação oficial (Google Identity/Workspace, Microsoft Learn/Graph/Entra, Tauri, modelcontextprotocol.io), changelogs e páginas de produto, todas acessadas em 2026-10-17. Como indicador de sentimento, usei boards de feedback, fóruns de fornecedores e estatísticas de download de plugins. Quando a página exibe "última atualização", a data está indicada.
**Limitação importante:** a cota de WebSearch desta sessão, compartilhada entre agentes, esgotou várias vezes. Por isso a coleta foi feita principalmente via WebFetch de URLs oficiais conhecidas. Opiniões de Reddit e Hacker News ficaram pouco representadas (ver "Lacunas").
**Legenda de confiança:** **[V]** verificado em fonte nesta pesquisa · **[S]** fonte secundária ou de terceiros · **[I]** inferência ou conhecimento prévio não reverificado nesta sessão.

---

## (a) Resumo executivo

### O que mudou ou está valendo em 2026 (achados principais)

1. **Google OAuth em app desktop.** O fluxo é sempre navegador do sistema + redirect *loopback* (`http://127.0.0.1:porta`) + PKCE. A documentação diz: *"Custom URI schemes are no longer supported due to the risk of app impersonation"*. O fluxo copiar/colar (OOB) acabou, e webviews embutidos são bloqueados (`disallowed_useragent`) [V, doc atualizada em 2026-10-16]. Um deep link `monet://` **não serve** como redirect do Google.
2. **Escopos de Calendar são "sensitive", não "restricted".** Isso exige verificação do app, mas dispensa a auditoria de segurança CASA. Pelo FAQ do Google, a revisão de escopo sensível leva cerca de 10 dias úteis, sem taxa; a de escopo restrito leva cerca de 6 semanas, mais o CASA anual [V FAQ; classificação dos escopos de Calendar via Nylas, 2026-10-07, S].
3. **Sem verificação, o Google impõe dois limites:**
   - Em modo *Testing*: até 100 test users, e a autorização expira em 7 dias.
   - Em *produção não verificada*: tela de aviso e teto vitalício de 100 usuários novos ([V](https://support.google.com/cloud/answer/15549945)).
4. **Push de mudanças exige webhook HTTPS público**, tanto no Google quanto no Microsoft Graph. Sem backend, a saída é polling incremental (`syncToken` no Google, `deltaLink` no Graph) [V].
5. **Microsoft corporativo é um muro.** A política *"Let Microsoft manage your consent settings"* é o padrão para tenants novos. Ela impede o usuário de consentir sozinho `Calendars.Read`, `Calendars.ReadWrite` e afins (doc atualizada em 2026-08-28) [V]. Calendário de empresa via Graph, na prática, depende do admin. Contas pessoais (Outlook.com) funcionam.
6. **Concorrentes convergem num padrão barato:** ler os eventos no dia e criar nota de reunião a partir do evento (Reflect, Tana, Capacities, Things, Todoist e plugins do Obsidian). Quando escrevem no calendário, usam um **calendário dedicado**, como o "Todoist" do Todoist e o "NotePlan Timeblocks" do NotePlan. Sync bidirecional completo é raro e cheio de ressalvas. O próprio Todoist (doc de 2026-10-07) mantém os eventos read-only, aceita um provedor por vez e não sincroniza de volta edições numa ocorrência de evento recorrente [V].
7. **Sinal do ecossistema local-first (Obsidian):**
   - Day Planner (planejamento local + ICS): cerca de 905k downloads.
   - Full Calendar: 470k downloads, **arquivado em 2026-08-01**.
   - Plugin Google Calendar: cerca de 200k downloads, em "stale mode". Ele exige que cada usuário crie o próprio projeto e cliente OAuth no Google Cloud [V].
   - ICS é a via sem atrito. Um plugin novo (maio de 2026) usa ICS justamente para evitar *"the endless data-sharing you have to accept when integrating platforms"* [V].
8. **Google Sheets tem pouca demanda em apps de notas pessoais.** No Obsidian, "Sheet Plus" (planilha local, import/export XLSX) tem 211k downloads, contra cerca de 2k do "GDocs" (embed do Google Drive). Não encontrei plugin que sincronize o Sheets ao vivo [V/S]. Se um dia for necessário, o caminho técnico existe: `drive.file` (escopo não sensível) + Google Picker para desktop no navegador do sistema [V, 2026-10-12].
9. **MCP (Model Context Protocol), estado em out/2026:**
   - A spec atual é a **2026-07-28**: sem estado, sem sessões e sem o handshake `initialize`. O registro dinâmico de cliente (DCR) foi depreciado em favor de CIMD. Os recursos Roots, Sampling e Logging também foram depreciados [V].
   - Os SDKs Tier 1 somam cerca de 0,5 bilhão de downloads por mês [V].
   - Clientes relevantes: Claude (servidores locais via MCPB e conectores remotos), ChatGPT (remoto, com confirmação manual para escrita), VS Code/Copilot, Gemini CLI/Antigravity e Copilot Studio [V].
   - O Windows tem um registro on-device de MCP (ODR), em preview, com registro feito via manifesto MSIX [V].
   - Têm MCP oficial: Notion, Todoist, Linear, Capacities, Tana (local), Craft e Amie. Obsidian e Heptabase apostam em CLI para agentes. O Things não tem MCP e alerta que servidores de terceiros podem corromper o banco [V].
10. **O MCP oficial do Google Calendar não resolve a burocracia.** Ele está em Developer Preview desde 2026-04-22 e exige projeto no Google Cloud, cliente OAuth do tipo *Web application* marcado como "agentic" (obrigatório a partir de 2026-11-11) e programa de preview [V].

### Recomendação condicional

**Calendário: vale, se for leitura via ICS primeiro.** Mostrar eventos no Calendar e na nota diária, mais um botão "Criar nota de reunião" a partir do evento. O esforço é M, não há dependências externas e a ideia casa com a tese do produto: a IA não age sozinha e o usuário decide o que vira registro.

**Google Calendar API (OAuth): vale apenas se** o ICS mostrar uso real *e* a dor for latência ou falta de dados (participantes, link da reunião, vários calendários, escrita). O custo é G de desenvolvimento, mais 2 a 6 semanas de calendário para verificação (gratuita) e manutenção contínua. Dá para validar antes de verificar usando a fase de produção não verificada (até 100 usuários).

**Não vale agora:**
- Sync bidirecional de tasks.
- Outlook corporativo via Graph.
- Sheets API.
- E-mail → task.
- Zapier/Make.

Esses itens têm custo alto ou exigem backend, quase sempre falham por política (consentimento corporativo, verificação) e conflitam com a tese do produto.

**MCP: vale expor um *servidor* local, read-only e opt-in (M), se o público usa Claude, VS Code ou Cursor.** Com isso o Monet vira fonte de contexto para assistentes e permite **integração por composição**: o usuário combina o MCP do Monet com o conector de Google Calendar do Claude, disponível para todos os usuários [V], e o Monet não precisa fazer OAuth com o Google. A escrita entraria apenas como **proposta** aprovada dentro do Monet. Virar *cliente* MCP com OAuth remoto não vale agora: é G e a spec ainda muda rápido.

**Fundação barata: deep links `monet://` (P–M).** Eles destravam:
- lançadores (bookmarks do Command Palette com `{query}`, Raycast, Flow Launcher);
- App Actions do Windows;
- um web clipper futuro;
- links "abrir no Monet" dentro de respostas de IA e do MCP.

### Sequência sugerida (dev solo)

| Fase | Duração | Entregas |
|---|---|---|
| F0 | ≤ 1 semana | deep links (declarados no MSIX); export e import de `.ics` |
| F1 | 1–2 semanas | assinatura ICS read-only; "nota de reunião a partir do evento"; eventos no Calendar e no My Day |
| F2 | 1–2 semanas, experimento | MCP server local read-only (stdio + pacote MCPB); medir uso |
| F3 | condicional à demanda | Google Calendar API só leitura → time-blocking num calendário "Monet" dedicado |
| Evitar | — | sync bidirecional de tasks; Graph corporativo; Sheets API; e-mail → task; Zapier |

---

## (b) Seções por pergunta

### 1. Google Calendar a partir de um app desktop sem backend

#### 1.1 OAuth 2.0 para "installed apps" [V]

- **Redirect e PKCE**
  - Tipo de cliente **Desktop app**.
  - Redirect *loopback* `http://127.0.0.1:porta` (ou `[::1]`). A doc o chama de *"the recommended mechanism"* para Windows, macOS e Linux.
  - O loopback está depreciado para Android, iOS e Chrome apps, mas não para desktop.
  - PKCE é sempre exigido (*"Always use PKCE"*); recomenda-se `S256`.
- **Bloqueios**
  - *Custom URI scheme*: *"no longer supported due to the risk of app impersonation"*.
  - OOB (copiar/colar): *"no longer supported"*.
  - Webview embutido: bloqueado (`disallowed_useragent`). É preciso abrir o navegador do sistema; o Monet já usa `tauri-plugin-opener`.
- **Cliente público:** *"Desktop apps are public clients and cannot keep secrets confidential."* O `client_secret` emitido para clientes Desktop não é segredo. Consequência [I]: qualquer pessoa pode extrair o client ID e o secret do binário e consumir a cota do seu projeto, então vale monitorar o uso.
- **Consentimento:**
  - O usuário pode recusar parte dos escopos. É preciso conferir o campo `scope` na resposta do token.
  - *"Incremental authorization is not supported for installed apps or devices."* Acrescentar um escopo depois (por exemplo, escrita) exige um novo consentimento completo e, se o escopo for sensível, nova verificação.
- **Limites operacionais:**
  - 100 refresh tokens por conta Google por client ID. Ao passar disso, o mais antigo é invalidado sem aviso.
  - Clientes OAuth **sem uso por 6 meses são excluídos automaticamente** (aviso 30 dias antes) ([Manage OAuth Clients](https://support.google.com/cloud/answer/15549257)).

#### 1.2 Como fazer em Tauri 2 [V/I]

- **Captura do redirect**
  - `tauri-plugin-oauth` (FabianLars): versão 2, 216 stars, sem releases publicadas na página. Ele sobe um servidor localhost temporário. O README alerta: *"Because of the unprotected localhost port, you must verify the URL here."*
  - Alternativa [I]: crate `oauth2` + um listener próprio (o `reqwest` já é dependência do Monet).
- **Deep link plugin (`tauri-plugin-deep-link`)**
  - No Windows, a URL chega como argumento de linha de comando de um novo processo. Integra-se ao `tauri-plugin-single-instance`, que o Monet já usa.
  - *"Deep links are only triggered for installed applications on desktop."*
  - Serve para o Microsoft (que aceita custom scheme) e para as integrações do §6. Não serve para o Google.
- **MSIX:** em apps empacotados virtualizados, *"All writes under HKCU are copied on write to a private per-user, per-app location"* [V]. Logo, registrar o protocolo em tempo de execução não vale para o sistema todo. É preciso **declarar `windows.protocol` no AppxManifest** do `build-msix.ps1` [I sobre o plugin; V sobre a virtualização].
- **Armazenamento de tokens**
  - Hoje o Monet guarda as chaves BYOK em **arquivos de texto puro** em `app_config_dir` (`save_key` em `src-tauri/src/lib.rs`). Para um refresh token com acesso à agenda, o ideal é subir o padrão:
    - **Windows Credential Manager**, via crate `keyring` 4.2.0. Limite de **2.560 bytes** por credencial (`CRED_MAX_CREDENTIAL_BLOB_SIZE = 5*512`). Tokens da Microsoft podem se aproximar disso [I].
    - DPAPI.
    - `tauri-plugin-stronghold`; a doc atual não traz aviso de depreciação.

#### 1.3 Escopos disponíveis em 2026

A [página de escopos](https://developers.google.com/workspace/calendar/api/auth) (atualizada em 2026-09-03) lista 20 escopos **sem a classificação de sensibilidade**. Isso é diferente das páginas de Gmail, Drive e Sheets, que publicam a classificação [V].

| Escopo | O que permite (texto oficial resumido) | Classificação |
|---|---|---|
| `calendar` | ver, editar, compartilhar e apagar tudo | sensitive [S] |
| `calendar.readonly` | ver e baixar qualquer calendário | sensitive [S] |
| `calendar.events` | ver e editar eventos de todos os calendários | sensitive [S] |
| `calendar.events.readonly` | ver eventos | sensitive [S] |
| `calendar.events.owned` / `.owned.readonly` | eventos só dos calendários que o usuário possui | **não publicada** |
| `calendar.app.created` | *"Make secondary Google calendars, and see, create, change, and delete events on them"* | **não publicada** — ideal para time-blocking num calendário "Monet" |
| `calendar.calendarlist(.readonly)` | lista de calendários assinados | não publicada |
| `calendar.calendars(.readonly)`, `calendar.acls(.readonly)`, `calendar.freebusy`, `calendar.events.freebusy`, `calendar.settings.readonly`, `calendar.events.public.readonly`, `calendar.addons.*` | metadados, compartilhamento, disponibilidade, add-ons | não publicada |

- **Escopos restritos:** Gmail (`gmail.readonly`, `gmail.modify` e outros) e Drive (`drive`, `drive.readonly`, `drive.metadata` e outros) [V]. O Calendar não aparece como restrito. O guia da Nylas (atualizado em 2026-10-07) classifica `calendar`, `calendar.readonly` e `calendar.events(.readonly)` como **sensitive, sem CASA** [S].
- **Mínimo recomendado para leitura:** `calendar.events.readonly` + `calendar.calendarlist.readonly` (para o usuário escolher os calendários).
- **Teste de 5 minutos antes de decidir F3:** adicionar `calendar.app.created` no console (Data Access) e ver em qual seção ele cai. Se for *non-sensitive*, escrever time-blocks num calendário próprio fica sem verificação de escopo sensível, e a conta muda bastante [lacuna].

#### 1.4 Verificação do app OAuth

- **Testing:** até 100 test users. *"Authorizations by a test user will expire seven days from the time of consent"*, e o refresh token também expira. A exceção são os escopos básicos de perfil [V].
- **Produção não verificada:** tela "unverified app" e teto de *"100 new users in total"*, que *"applies over the entire lifetime of the project, and it cannot be reset or changed"* [V]. Ao esgotar, o login pode parar de funcionar [V FAQ].
- **Isenções:** uso pessoal (*"fewer than 100 users"*), dev/test/staging, uso interno (organização Workspace), service account e apps marcados como confiáveis pelo admin [V].
- **Prazos (estimativas do FAQ):**
  - brand verification: "2-3 Business days";
  - escopo sensível: "10 Business days";
  - escopo restrito: "6 weeks", mais CASA anual.
  - O Google não cobra taxa. O CASA, quando aplicável, é pago ao assessor [V].
- **Requisitos:**
  - domínios autorizados verificados;
  - homepage e política de privacidade;
  - justificativa de cada escopo;
  - **vídeo** mostrando o fluxo OAuth e o uso dos escopos;
  - escopos mais estreitos possíveis, sob risco de rejeição [V].
  - Na prática, o mais simples é ter um domínio próprio [I].
- **Política de dados (*Limited Use*):** os dados só podem ser usados para funções visíveis ao usuário, sem venda, sem anúncios e sem leitura humana (política de 2024-02-15) [V]. Como o Monet manda conteúdo ao LLM do próprio usuário, a política de privacidade deve declarar que dados de agenda podem ser enviados ao provedor de IA escolhido quando o usuário aciona a IA [I]. Eventuais regras específicas de IA da Workspace API não foram reverificadas [lacuna].
- **Caminho de validação barato:**
  1. dogfood em Testing (o criador como test user, reautorizando toda semana);
  2. beta em produção não verificada (até 100 usuários, com aviso);
  3. verificação, quando houver tração.
- **Alternativa no espírito BYOK: "traga seu próprio cliente OAuth"** (modelo do Obsidian). O usuário cria um projeto no Google Cloud e cola client ID e secret. O plugin Google Calendar do Obsidian (cerca de 200k downloads) **nunca entregou um cliente público** (*"The creation of a public OAUTH client to skip this setup is WIP"*), e o usuário precisa clicar em "Go to … (unsafe)" [V]. Há issues de login com 403 `access_denied` (fev/2025) e problemas de autorização (ago/2025) [V]. O atrito é alto e a opção só serve a power users.

#### 1.5 Cotas da API

- **Limites atuais:**
  - **10.000 req/min por projeto**;
  - **600 req/min por usuário por projeto**;
  - **1.000.000 req/dia por projeto** como "daily billing threshold" (abaixo disso não há cobrança).
- **Erros e boas práticas:** respostas `403`/`429 usageLimits` pedem backoff exponencial com jitter e variação de intervalos de ±25%. Fazer polling de todos os calendários é chamado de *"anti-pattern"* (doc atualizada em 2026-09-11) [V].
- **Mudança de 2026, modelo de tiers:**
  - projetos criados a partir de **2026-05-01** recebem "novas cotas padrão";
  - "mais tarde em 2026", com 90 dias de aviso, aumentos de cota exigirão billing ativo, e uso acima do limiar diário será cobrado;
  - segundo o Google, *"less than 1% of active developers"* sairá do tier padrão (doc atualizada em 2026-09-03) [V].
- **Para o Monet:** polling de 5 a 15 minutos por usuário fica ordens de grandeza abaixo desses limites. A cota não é o gargalo. Os riscos reais são política (verificação) e manutenção [I].

#### 1.6 Sync incremental e push [V]

- **`syncToken`:**
  - a sincronização completa devolve `nextSyncToken` na última página;
  - as incrementais trazem só o que mudou, **inclusive exclusões** (*"will always contain deleted entries"*; não se pode usar `showDeleted=false`);
  - `410 Gone` significa apagar o cache e refazer a sincronização completa.
- **Parâmetros incompatíveis com `syncToken`:** `iCalUID, orderBy, privateExtendedProperty, q, sharedExtendedProperty, timeMin, timeMax, updatedMin`. Ou seja, o incremental cobre o **calendário inteiro**, não uma janela de datas.
- **Push (`events.watch`):**
  - exige servidor HTTPS com certificado válido (self-signed não serve);
  - *"there's no automatic way to renew a notification channel"*;
  - *"Notifications are not 100% reliable"*.
  - Sem servidor público, sobra polling: ao abrir o app, ao focar a janela e a cada N minutos com jitter.

#### 1.7 Armadilhas do sync bidirecional

- **Recorrência:**
  - há evento "mestre" + exceções;
  - `singleEvents=true` expande as instâncias;
  - com `showDeleted` e `singleEvents` ligados, só voltam as instâncias excluídas, não o recorrente [V];
  - no Todoist, editar uma ocorrência não atualiza a task, e padrões como "every other" e "every!" não existem no Google nem no Outlook [V].
  - A "recorrência simples" do Monet mapeia bem para RRULE, mas a recorrência por conclusão não mapeia [I].
- **Fuso e dia inteiro:**
  - evento de dia inteiro usa `date`, sem hora; evento recorrente exige `timeZone` [I].
  - O "deadline" do Monet exportado como dia inteiro pode poluir a agenda. O padrão Todoist é sincronizar **só tasks com horário** (*"Tasks only sync to Google Calendar if they have a date and time"*) [V].
- **Exclusões e duplicatas:** há relatos recorrentes de eventos duplicados após sincronizar no TickTick, Toodledo e Week Plan [S]. A correção comum é desconectar, apagar o calendário criado e reconectar.
- **Conflitos:** desde 2024-06, operações em lote retornam `409 Conflict` para itens conflitantes [V]. Use `etag`/`If-Match` [I].
- **Tipos de evento:** `birthday` (2024), `fromGmail` (2024), `focusTime`, `outOfOffice` e `workingLocation`. Filtre com `eventTypes` [V].
- **Ambiente corporativo:** quando políticas bloqueiam ou desconectam a integração, o Todoist orienta o usuário a pedir ao TI que libere o app [V]. Calendários secundários passaram a ter dono único (GA em 2025-11-10) [V].

#### 1.8 Alternativas mais leves

- **Endereço secreto iCal (leitura)** [V]
  - Caminho: Configurações → Integrar agenda → "Secret address in iCal format".
  - Read-only (*"a read-only view of one calendar"*). O endereço pode ser resetado (*"Only you should know the Secret Address"*).
  - Em contas de trabalho ou escola, o admin pode ter mudado o compartilhamento.
  - O Monet controla a frequência de polling. **A frequência com que o Google regenera o feed não é documentada** [lacuna].
  - O sentido inverso (Google assinando um ICS externo) atualiza a cada 8 a 24 horas, segundo terceiros [S], e exigiria URL pública, que o Monet não tem.
- **Import/export `.ics` (arquivo):** zero conta e zero permissão. Use UIDs estáveis para reimportar sem duplicar [I].
- **CalDAV:**
  - o CalDAV do Google **exige OAuth 2.0 + projeto no Cloud**, não suporta VTODO/VJOURNAL e segue as cotas da Calendar API [V, 2026-10-09]. Não é atalho para o Google.
  - Serve para iCloud (senha de app, como no Reflect), Fastmail e Nextcloud. O Capacities adicionou CalDAV em 2026-09, e o Morgen também suporta [V]. No Windows é nicho [I].
- **MCP oficial do Google Calendar:** ver §5.4.

### 2. Microsoft/Outlook (relevante por ser Windows-first)

#### 2.1 Graph + "public client" num app Tauri [V]

- **Registro do app:** plataforma *Mobile and desktop applications*, redirect `http://localhost` para navegador do sistema e *Allow public client flows* = Yes.
- **Bibliotecas MSAL para desktop:** .NET (WPF/UWP), Java, macOS e Node/Electron (esta em *public preview*). **Não há MSAL para Rust.** O caminho é implementar authorization code + PKCE à mão, com o mesmo loopback do Google [I].
- **WAM** (o broker de contas do Windows) dispensa redirect, mas só via MSAL. Em Tauri, exigiria WinRT direto [I].
- **Regras de redirect:**
  - `http` só para localhost;
  - **a porta é ignorada** na comparação de redirects localhost (RFC 8252);
  - preferir `127.0.0.1`, o que exige editar o manifesto do registro;
  - `[::1]` não é suportado;
  - apps que aceitam contas pessoais **não aceitam query params** no redirect.

#### 2.2 Permissões delegadas [V]

| Permissão | Admin consent exigido? | Contas pessoais |
|---|---|---|
| `Calendars.Read`, `Calendars.ReadBasic`, `Calendars.ReadWrite`, `Calendars.Read.Shared` | Não | sim |
| `Calendars.ReadWrite.Shared` | Não | não informado |

#### 2.3 Consentimento em contas corporativas

- A política **"Let Microsoft manage your consent settings"** é, segundo a doc, *"also the default for a new tenant"*. Por ela, o usuário consente qualquer permissão delegada, **EXCETO** uma lista que inclui `Calendars.Read`, `Calendars.ReadBasic`, `Calendars.ReadWrite`, `Calendars.Read.Shared`, `Calendars.ReadWrite.Shared`, `Mail.*`, `Tasks.*`, `Files.Read.All` e outras (ms.date 2026-01-22; atualizada em 2026-08-28) [V].
- **Step-up consent por risco:** desde nov/2020, quando habilitado, usuários não conseguem consentir apps multi-tenant **não verificados** registrados após 2020-11-08 que pedem mais que login e perfil [V].
- **Publisher verification:**
  - gratuita e *"verified in minutes"* quando os pré-requisitos estão prontos;
  - exige conta verificada no **Microsoft AI Cloud Partner Program** (partner global account);
  - o app precisa ser registrado com **conta de trabalho ou escola** num tenant Entra (*"Apps that are registered by using a Microsoft account can't be publisher verified"*);
  - o publisher domain precisa ser verificado e não pode ser `*.onmicrosoft.com`;
  - MFA obrigatório [V].
  - Para um dev solo sem empresa, não confirmei se a verificação no programa de parceiros é viável [lacuna].
- **Conclusão:** em tenants modernos, espere o fluxo "pedir aprovação do admin". O valor existe só para quem tem um TI disposto a aprovar. Em empresas restritivas, até publicar o calendário em ICS pode estar bloqueado (ver 2.6).

#### 2.4 Contas pessoais (Outlook.com)

Registre o app para "qualquer diretório + contas Microsoft pessoais". As permissões `Calendars.*` funcionam com contas pessoais [V]. O limite é de 100 redirect URIs para esse público [V].

#### 2.5 Sincronização e limites [V]

- **Delta:** `calendarView/delta` exige `startDateTime`/`endDateTime` (janela fixa) e funciona **por calendário**, com estado em `@odata.deltaLink`. Delta sem janela fixa só existe em beta. `$select` não é suportado.
- **Throttling do Outlook:**
  - **10.000 requisições a cada 10 minutos** por app por mailbox;
  - **4 requisições concorrentes**;
  - 150 MB de upload a cada 5 minutos.
- **Notificações:** change notifications do Graph também dependem de endpoint público (webhook) [I]. No desktop, mais uma vez, sobra polling.

#### 2.6 Publicação ICS do Outlook

- **Outlook na web:** Configurações → Calendários compartilhados → **Publicar**. Gera links HTML e **ICS, ambos read-only**.
- A doc avisa: *"Calendar sharing may not be available for your account"* (depende da organização) [V]. As sharing policies do Exchange Online controlam o compartilhamento externo, e o admin pode desabilitá-lo [V].
- O plugin ICS do Obsidian lista explicitamente URLs de calendários publicados do Office 365 e o iCal secreto do Google como fontes [V].
- Uma armadilha comum relatada é o ICS do Outlook usar nomes de fuso do Windows em `TZID` [I, testar].

#### 2.7 Contexto Windows

- O Windows Mail & Calendar **perdeu suporte em 2024-12-31** [V]. Não há um "calendário do sistema" no Windows equivalente ao EventKit do Mac, que o Things e o NotePlan usam para ler e escrever sem OAuth.
- O MCP oficial da Microsoft para calendário (Work IQ Calendar, Agent 365) está em preview, exige licença Microsoft 365 Copilot e registro de app pelo admin, e não atende contas pessoais [S].

### 3. Como os concorrentes integram calendário e o que os usuários valorizam

#### 3.1 Comparativo por direção

Direções: (a) eventos no dia ou na nota diária; (b) nota de reunião a partir do evento; (c) time-blocking ou escrita no calendário; (d) sync bidirecional de tasks.

| App | (a) Eventos no dia | (b) Nota de reunião | (c) Time-blocking / escrever | (d) Bidirecional de tasks | Provedores · observações | Fonte |
|---|---|---|---|---|---|---|
| **Todoist** | eventos Google/Outlook em Today/Upcoming, **read-only e não armazenados** | — | tasks *com horário* → calendário novo "Todoist"; layout de calendário só nos planos pagos | **parcial**: edições no evento voltam para a task; novos eventos no calendário "Todoist" não viram tasks; 1 provedor por vez | Google, Outlook; disponível em todos os planos | help 2026-10-07 [V] |
| **Things** | eventos do Apple Calendar em Today/Upcoming, read-only, exibidos localmente | — | **não**: *"you can't send to-dos from Things to Apple Calendar"*; sugere um Shortcut | não | só Apple Calendar | support [V] |
| **Tana** | "Agenda" na página diária; sync semanal em intervalos | **sim**: transcrição, resumo e Meeting agent | — | **não**: one-way; edições no Tana são sobrescritas | **só Google**, 1 conta, plano pago, consome créditos de IA | docs [V] |
| **Reflect** | reuniões "next to your daily notes" | "Add a meeting" + nota por participante com backlink | — | não (só importação) | Google, Office 365, iCloud (senha de app) | reflect.academy [V] |
| **Capacities** | calendário central; integrações que *"power planning and meeting notes"* | sim | n/v | n/v | Google, Microsoft + CalDAV desde 2026-09; requer Pro | release 70 [V] |
| **Notion Calendar** | itens de bancos do Notion aparecem no calendário | contexto do Notion nas reuniões | página de agendamento; bloqueio de horário ocupado | **não**: *"Importing Google events into Notion isn't supported yet"* | Google, Outlook, iCloud | produto [V] |
| **Sunsama** | sim | n/v | *"timebox tasks directly on your schedule"* | *"Bi-directional"* (não detalha tasks) | Google, Outlook, Apple | homepage [V] |
| **Akiflow** | sim | n/v | *"time-blocking planner"*, auto-agendamento | *"perfect sync"* (sem detalhe) | iCloud citado; "10+ integrações nativas" | homepage [V] |
| **Morgen** | sim | n/v | time-block de tasks do Todoist, Notion, Linear e ClickUp | Notion: due date e status sincronizam | Google, Outlook, iCloud, Fastmail, **CalDAV**; integração **local com Obsidian** | /integrations [V] |
| **Motion** | sim | meeting notes (suíte) | auto-agenda e re-otimiza *"dozens of times a day"* | n/v | Google, Outlook, iCloud | homepage [V] |
| **Amie** | sim | **pivô para notas de reunião com IA** | agenda automática (marketing) | consolida to-dos do Notion e Todoist | Google, Apple; oferece **MCP** para Claude e ChatGPT | homepage [V] |
| **TickTick** | sim | — | visão de calendário e assinaturas | two-way com Google, segundo nota da App Store; relatos de duplicatas | Google e outros | busca [S] |
| **Craft** | "Calendar View" + Daily Notes | caso de uso citado | n/v | n/v | provedores externos não citados; **MCP** para Claude, ChatGPT etc. | homepage [V] |
| **Heptabase** | journal "with calendar and todos" (só imagem) | n/v | n/v | n/v | n/v; tem **CLI** para Claude Code e Codex | homepage [V] |
| **Obsidian** (plugins) | ICS (32k downloads), Day Planner (905k) | Meeting Plus (via ICS), templates | Day Planner: timeline local a partir da nota diária, sem escrever no Google | plugin Google Calendar: CRUD de eventos, com OAuth próprio do usuário | Full Calendar 470k (**arquivado em 2026-08-01**); Google Calendar 200k (**stale**) | community.obsidian.md [V] |
| **Logseq** | plugin Agenda (997★), visões de calendário e kanban | — | visões de agenda | n/v | ICS (só em screenshot) | GitHub [V] |
| **NotePlan** (extra) | sim | — | **time blocks → eventos** num calendário escolhido ou em "NotePlan Timeblocks", com link de volta para a nota diária | — | calendários do sistema; pedido com 121 votos, entregue em 2023 | board/changelog [V] |
| **Amplenote** | não verificado (o site bloqueou o acesso) | | | | | lacuna |

*n/v = não verificado nas fontes acessadas.*

#### 3.2 O que os usuários elogiam, pedem e reclamam

- **Pedido forte: ver a agenda e escrever o plano.** No board do NotePlan, um pedido de 121 votos dizia: *"I want the time blocks to actually be persisted in my calendar so other colleagues will see"* (2021-03-12). Outro comentário pedia *"time blocks created in NotePlan would synchronise with Calendar Events"*. A solução entregue (v3.9.10) usa calendário dedicado + link de volta para a nota [V].
- **A adoção concentra-se na leitura e no planejamento local:** Day Planner 905k e ICS 32k. Plugins que dependem de OAuth envelheceram mal: Google Calendar em "stale mode" e Full Calendar arquivado [V].
- **Reclamações:**
  - eventos duplicados após sync (TickTick, Toodledo, Week Plan) [S];
  - desconexões por política de TI (Todoist) [V];
  - login Google quebrado (issues #304, *"Google Login 403 access_denied"*, 2025-02-19, e #318, 2025-08-03) [V];
  - Tana: só Google, uma conta, títulos de evento travados [V];
  - incômodo com permissões: o autor do Meeting Plus criou o plugin para evitar *"the endless data-sharing you have to accept when integrating platforms"* [V].
- **Os próprios fornecedores recuam da bidirecionalidade total.** No Todoist, eventos são read-only e só tasks com horário viram eventos. Things e Tana são read-only. O Notion Calendar não importa eventos.

#### 3.3 Qual direção dá mais valor com menos custo

1. **(a) Leitura no dia + (b) nota de reunião.** Maior relação valor/custo. Via ICS: esforço M e manutenção baixa. Para o Monet é natural: o Calendar já tem nota diária e cards datados, e a nota de reunião é **o usuário convertendo um evento em registro permanente**, exatamente a tese do produto.
2. **(c) Time-blocking num calendário dedicado ("Monet").** Valor médio-alto para quem planeja o dia; custo G porque exige OAuth e verificação. Seguir o padrão Todoist/NotePlan: só tasks com horário, calendário separado e link `monet://` no evento.
3. **(d) Bidirecional de tasks.** Custo e manutenção altos, satisfação baixa (duplicatas, recorrência, conflitos). Não recomendado.

### 4. Google Sheets

#### 4.1 Escopos e sensibilidade [V]

| Escopo | Classificação oficial | Comentário |
|---|---|---|
| `spreadsheets` | **Sensitive** | ver, editar, criar e apagar todas as planilhas → verificação |
| `spreadsheets.readonly` | **Sensitive** | idem, só leitura |
| `drive.file` | **Recommended, Non-sensitive** | só arquivos que o usuário abre ou escolhe no app ou no Picker |
| `drive` / `drive.readonly` | **Restricted** | exige CASA anual; evitar |

- **Google Picker para desktop (doc atualizada em 2026-10-12):**
  - abre no **navegador padrão do sistema** e *"Can no longer be displayed within an embedded webview"*;
  - basta acrescentar `prompt=consent&trigger_onepick=true` à URL de autorização;
  - o redirect devolve `picked_file_ids` + `code`;
  - **só `drive.file` é permitido, e não pode ser combinado com outros escopos**, logo é um OAuth separado do Calendar;
  - exige um client ID por plataforma;
  - a opção "AI-powered agent" do cliente não pode ser alterada depois.
  - Com isso, ler uma planilha escolhida pelo usuário via Sheets API dispensa a verificação de escopo sensível; brand verification é opcional [V/I].
- **"Publish to web":**
  - gera link ou embed (iframe); planilha inteira ou abas;
  - republica automaticamente (*"might take a few minutes"*);
  - **fica visível para qualquer pessoa na web** (ou só para a organização);
  - *"your administrator might have turned off the ability to publish a file"*;
  - o Google alerta contra publicar dados sensíveis [V].
  - No Monet seria um nó de iframe no Tiptap, com ajuste de CSP. Barato (P), porém público e somente leitura [I].
- **Alternativa local, SheetJS:**
  - a fonte oficial é `cdn.sheetjs.com` (versão **0.20.3**);
  - o pacote `xlsx` do npm *"is out of date"* (parado em 0.18.5) [V];
  - licença Apache-2.0 [I].
  - Serve para importar CSV ou XLSX como tabela Tiptap e exportar Tasks e Weekly Review para XLSX ou CSV.

#### 4.2 O que apps de notas fazem e evidência de demanda

- **Notion:** embed do Google Drive (`/drive`). Permite buscar no Drive dentro do Notion, colar URL de Doc ou Sheet e conectar várias contas [V]. É embed, não sincronização de dados. Não verifiquei se o Notion sincroniza Sheets [lacuna].
- **Obsidian:**
  - "GDocs" (embed de atalhos `.gsheet` numa web view): cerca de **2k downloads**;
  - "Sheet Plus" (planilha local estilo Excel; recursos como XLSX e API REST são pagos): **211k downloads**, atualizado 2 dias antes da consulta [V];
  - **nenhum plugin sincroniza uma tabela do Google Sheets ao vivo**; a alternativa citada é exportar CSV ou usar o serviço externo "Plus" [S].
- **Coda e Craft:** não verifiquei integração com Sheets [lacuna].
- **Conclusão:** há demanda por **planilhas locais e XLSX em notas**. Não encontrei evidência de demanda por integração com o Google Sheets em apps de notas pessoais. Se fizer algo, comece por import/export CSV/XLSX (P–M).

### 5. MCP (Model Context Protocol) em 2026

#### 5.1 Estado da spec [V]

- **Versão atual: 2026-07-28.**
- **Mudanças maiores:**
  - remoção das sessões (`Mcp-Session-Id`) e do handshake `initialize`; cada requisição carrega versão e capacidades em `_meta`;
  - `server/discover` obrigatório;
  - `subscriptions/listen` substitui o stream GET;
  - padrão **MRTR** (pedidos ao cliente embutidos no resultado);
  - `tasks` virou extensão;
  - fim da retomada de streams SSE.
- **Depreciações:**
  - **Roots, Sampling e Logging**;
  - transporte HTTP+SSE (com um ano de transição);
  - **Dynamic Client Registration**, em favor de **Client ID Metadata Documents (CIMD)**.
- **Transportes:**
  - **stdio** (subprocesso iniciado pelo cliente) e **Streamable HTTP**;
  - servidores HTTP locais **devem validar `Origin`** (contra DNS rebinding), devem fazer bind só em `127.0.0.1` e devem autenticar.
- **Autorização:**
  - vale só para transportes HTTP (OAuth 2.1, Protected Resource Metadata RFC 9728, PKCE, `resource` RFC 8707, validação de `iss` RFC 9207);
  - *"Implementations using an STDIO transport SHOULD NOT follow this specification, and instead retrieve credentials from the environment."*
- **Ferramentas:** *"there SHOULD always be a human in the loop with the ability to deny tool invocations"*. Anotações de ferramentas (`readOnlyHint` e afins) **devem ser tratadas como não confiáveis** se o servidor não for confiável.
- **Roadmap (2026-08-22):** próximas prioridades são identidade de agentes (DPoP, Workload Identity), unificação do transporte HTTP (*"local servers speaking Streamable HTTP over stdio"*) e segurança corporativa. Ou seja, mais mudanças à frente para servidores locais.
- **Governança e adoção:** o site é *"a Series of LF Projects, LLC"*. Os SDKs Tier 1 somam *"close to half-a-billion downloads a month"*, e os SDKs TypeScript e Python passaram de 1 bilhão de downloads cada [V].

#### 5.2 Adoção nos assistentes

| Cliente | Suporte | Observações |
|---|---|---|
| **Claude Desktop / claude.ai / Claude Code** | servidores locais via **MCPB** (ex-DXT), com instalação em um clique *"for macOS and Windows"*; conectores remotos personalizados | conectores remotos exigem plano Pro/Max/Team/Enterprise; Claude Desktop **não conecta direto em servidor HTTP local** (precisa de `mcp-remote`, segundo o Tana); conectores Gmail, Calendar e Drive *"available for all users"* [V] |
| **ChatGPT / OpenAI API** | servidores **remotos** (custom MCP server em Plugins/Apps; ferramenta `mcp` na Responses API) | *"ChatGPT currently requires manual confirmation in any conversation before write actions can be taken"*; OAuth com CIMD/DCR [V] |
| **Gemini CLI / Google Antigravity** | MCP via `settings.json` | usuários gratuitos foram migrados para o **Antigravity CLI** em 2026-06-18; o Antigravity é cliente documentado dos MCPs do Workspace [V] |
| **VS Code (GitHub Copilot)** | stdio e HTTP | confirmação por invocação; diálogo de confiança na primeira execução (doc de 2026-10-14) [V] |
| **Copilot Studio** | tools e resources via MCP | requer generative orchestration (ms.date 2026-08-26) [V] |
| **Windows (ODR)** | registro on-device de servidores MCP locais e remotos; *"contained in a separate environment"* | preview; agentes como VS Code/Visual Studio Copilot e o conector de Settings [V] |

#### 5.3 Servidores MCP de apps de notas e tasks

| App | MCP | Detalhes |
|---|---|---|
| **Notion** | **oficial, remoto** (hospedado pelo Notion), OAuth | busca, leitura, criação e atualização; admin controla clientes (restringir exige plano Enterprise) [V] |
| **Todoist** | **oficial** (Doist), Streamable HTTP em `ai.todoist.net/mcp` ou `npx @doist/todoist-mcp` | OAuth; 559★; ferramentas como `findTasksByDate` e `addTasks` [V] |
| **Linear** | **oficial, remoto** em `mcp.linear.app/mcp` (há endpoint read-only) | OAuth 2.1 com DCR; Streamable HTTP [V] |
| **Capacities** | **oficial** ("AI Chat Connectors") + nova REST API | consentimento por espaço; a API antiga foi descontinuada em 2026-09-01 [V] |
| **Tana** | **oficial e local** em `http://localhost:8262/mcp`, roda com o app aberto | OAuth com **modal de aprovação no app** ou token pessoal; ferramentas de leitura **e escrita** (incluindo "get or create calendar nodes"); Claude Desktop via `mcp-remote` [V] |
| **Obsidian** | sem MCP oficial; **CLI oficial** (*"Give agentic tools the ability to interact with your vault"*, exige o app aberto) | plugin comunitário Local REST API (~3,0k★) com MCP embutido em `/mcp/` (HTTPS com certificado local + API key) [V] |
| **Things** | **sem MCP oficial** | *"Each one we are aware of uses unsafe methods that can corrupt your database"*; recomenda URL scheme, Shortcuts, AppleScript e Mail to Things (2026-04-02) [V] |
| **TickTick** | só comunitários (sobre a Open API e uma API web não oficial) | nenhum oficial encontrado [S] |
| **Google Workspace** | **oficiais, Developer Preview**: Gmail, Drive, Docs, Sheets, Slides, Calendar, Chat, People, Classroom (`https://<produto>mcp.googleapis.com/mcp/v1`) | exigem cliente OAuth "agentic" (rejeição dos demais a partir de 2026-11-11); alertam sobre *indirect prompt injection* [V] |
| **Craft / Amie** | MCP anunciado nas homepages | detalhes não verificados [V/n/v] |
| **Heptabase** | CLI para Claude Code e Codex | [V] |

Tendência: apps de notas expõem os **próprios dados** a assistentes (MCP ou CLI). Integrar calendário de terceiros dentro do app fica, cada vez mais, a cargo do assistente.

#### 5.4 Esforço para o Monet

**(a) Expor um MCP server local** (ler notas, tasks e calendar; escrever com confirmação)

- **Arquitetura recomendada**
  - Um binário separado, `monet-mcp.exe` (Rust, crate oficial `rmcp`, que *"implements the stable MCP 2026-07-28 specification"* e mantém compatibilidade com 2025-11-25), com transporte **stdio**.
  - Por que separado [I]: `monet.exe --mcp` seria interceptado pelo `single-instance`.
  - Por que stdio: é o que o Claude Desktop aceita para servidores locais, e a spec recomenda *"Use the stdio transport to limit access to just the MCP client"*.
- **Detalhes de MSIX (Store)**
  - Declarar o servidor como `uap5:AppExecutionAlias`, como faz o exemplo oficial da Microsoft. Assim ele roda com *package identity* e enxerga o **AppData virtualizado** onde o banco do pacote MSIX vive. Um processo de fora do pacote pode não ver o mesmo arquivo [V sobre a virtualização; I sobre a consequência].
  - Concorrência no SQLite: o Monet já teve uma corrida de lock no cold start (plugin SQL + rusqlite). Opções:
    - abrir **read-only** com WAL e `busy_timeout`;
    - ou repassar as requisições ao app em execução via named pipe. Isso exige o app aberto, como fazem o Tana e a CLI do Obsidian [I].
- **Ferramentas sugeridas**
  - Leitura: `search_notes`, `get_note`, `get_day(date)` (nota diária, cards datados e tasks), `list_tasks(view|status|range)`.
  - Escrita opt-in: `propose_task`, `propose_note` e `append_to_daily_note` geram **propostas num inbox do Monet**, que o usuário aprova. Isso respeita a tese "o usuário decide o que vira registro permanente".
  - Sem ferramentas de apagar. Os resultados devolvem links `monet://`.
  - Expor só cadernos marcados como visíveis. Se o controle de visibilidade por caderno já usado no RAG puder ser reaproveitado, melhor [I].
- **Distribuição**
  - pacote **MCPB** (`server.type = "binary"`) para o Claude Desktop;
  - trechos de configuração para Claude Code, VS Code e Cursor;
  - registro no **Windows ODR** (opcional): AppExtension `com.microsoft.windows.ai.mcpServer` + `manifest.json` do MCPB. Exige **Windows build 26220.7262+** (preview) e roda contido por padrão (*"won't have access to protected resources like the files of the current user"*). Testar se o banco fica acessível [V/lacuna].
- **Esforço**
  - read-only + MCPB: **M**;
  - escrita via propostas + UI de aprovação: **G**;
  - registro no ODR: **M**, mais o risco de a API de preview mudar.

**(b) Ser cliente MCP no chat** (por exemplo, plugar um MCP de Google Calendar)

- O backend já envia `tools`/`tool_choice` à OpenRouter e trata `tool_calls` em streaming (`run_openrouter_stream` em `lib.rs`). Mapear as ferramentas de servidores MCP para esse loop é viável [V no código].
- **Esforço:**
  - **M** para servidores locais via stdio (cliente `rmcp`, UI de confirmação mostrando os argumentos, timeouts, log de auditoria);
  - **G** para servidores remotos com OAuth (descoberta via PRM, metadados do servidor de autorização, PKCE, `resource`, validação de `iss`, CIMD ou DCR).
  - O CIMD exige uma URL HTTPS como `client_id`. Um JSON estático no GitHub Pages resolveria sem backend [I].
- **Plugar o MCP oficial do Google Calendar não elimina a burocracia.** Ele exige:
  - participação no Developer Preview (pré-requisito *"for users and developers"*);
  - projeto no Google Cloud com Calendar API + Calendar MCP API habilitadas;
  - cliente OAuth do tipo **Web application** marcado como agentic;
  - consent screen, com os mesmos escopos sensíveis.
  - Os MCPs comunitários de Google Calendar pedem o mesmo "traga seu projeto no Google Cloud" dos plugins do Obsidian [V/I].
- **Alternativa mais barata: composição.** Um usuário com Claude Desktop usa o conector Google Calendar do Claude [V] + o MCP do Monet. Pedido típico: "para cada reunião de amanhã, proponha uma nota no Monet". O Monet não implementa OAuth com o Google.

#### 5.5 Riscos de segurança

- **Prompt injection indireta via calendário:**
  - na pesquisa *"Invitation Is All You Need"* (SafeBreach, 2025-08-06), um convite de calendário com instruções ocultas fez o Gemini apagar eventos, abrir URLs para exfiltrar e-mails e acionar dispositivos [V];
  - o Google respondeu com *"enhanced user confirmations for sensitive actions"* e classificadores [V];
  - a própria doc do MCP do Calendar diz *"you must screen prompts and responses for malicious content or prompt injection attacks"* [V].
- **"Lethal trifecta"** (Simon Willison, 2025-06-16): dados privados + conteúdo não confiável + canal de saída = exfiltração. O MCP facilita juntar os três [V]. Notas do Monet podem conter conteúdo colado da web, e calendários podem conter convites hostis.
- **Escrita sem supervisão:** a spec pede humano no circuito. O ChatGPT exige confirmação manual para escrita, e o VS Code confirma cada invocação [V]. O Things alerta que servidores de terceiros que escrevem no banco causam corrupção [V].
- **Servidor HTTP local:** DNS rebinding (validar `Origin`, bind em 127.0.0.1, token) e qualquer processo local acessando a porta [V].
- **Mitigações para o Monet:**
  - MCP desligado por padrão e read-only por padrão;
  - escrita só como proposta, sem nenhuma ferramenta destrutiva;
  - escopo por caderno;
  - nenhuma ferramenta do Monet que envie dados para fora (sem fetch de URL);
  - log de auditoria;
  - rate limit.

### 6. Outras integrações comuns em apps de tasks e notas pessoais

| Integração | O que entrega | Esforço | Dependências | Riscos | Manutenção | Evidência |
|---|---|---|---|---|---|---|
| **URL scheme / deep links `monet://`** (open/note, day/AAAA-MM-DD, task/new, capture) | "abrir no Monet" a partir de qualquer lugar; base para clipper, launchers, App Actions e MCP | **P–M** | declarar o protocolo no AppxManifest (MSIX); deep-link + single-instance (já presente) | URL forjada (validar parâmetros); criação externa deve cair num inbox; `update`/`delete` exigem token, como faz o Things | baixa | Things: `add`, `update` (*requires auth token*), `show`, `search`, `json` [V] |
| **Bookmarks do Command Palette / Quicklinks do Raycast** apontando para `monet://capture?text={query}` | captura rápida pelo launcher sem escrever extensão | **P** (só documentação) | deep links | nenhum relevante | baixa | Command Palette tem Bookmarks com `{query}` [V] |
| **App Actions on Windows** | ações do Monet sugeridas pelo Windows e por outros apps (por exemplo, "salvar texto como nota/task") | **M** | *package identity* (MSIX); ativação por URI ou COM; JSON de ações | API nova (doc de 2026-10-14) | média | [V] |
| **Extensão do Raycast (Windows)** | buscar e criar notas e tasks no Raycast | **M** | deep links ou API local | Raycast Windows v2.8.2; extensões sem código nativo rodam nas duas plataformas | média | [V] |
| **Plugin do Flow Launcher** | idem | **M** | Python ou JS via JSON-RPC (C# nativo) | nicho | média | [V] |
| **Extensão do Command Palette** | listas e formulários nativos | **G** | app .NET + WinRT + servidor COM fora de processo + manifesto | stack diferente de Tauri/Rust | média | [V] |
| **CLI (`monet-cli`)** | automação por scripts e por agentes (Claude Code via Bash) | **M** | reaproveita o núcleo do MCP sidecar | concorrência no SQLite | média | Obsidian CLI, Heptabase CLI [V] |
| **Web clipper (extensão de navegador)** | salvar páginas, trechos e highlights como notas | **G** (M–G partindo de um fork) | Chrome/Edge/Firefox stores; clipboard + URI `monet://` | revisão nas lojas; sites mudam; tamanho da URI | média-alta | o clipper do Obsidian passa conteúdo pela área de transferência + URI; o "Legacy mode" via URI é limitado em tamanho; código MIT, 5,4k★ (marcas excluídas) [V] |
| **Import do Kindle (`My Clippings.txt`)** | importar highlights | **P–M** | nenhuma | variações de formato e idioma | baixa | [I] |
| **Readwise (import)** | highlights de Kindle, web, PDF | **M** | token do usuário (`readwise.io/access_token`); Readwise é pago após 30 dias | API de terceiro | baixa-média | `/api/v2/export/` com `updatedAfter`; 240 req/min, 20 req/min nas listas [V] |
| **Webhooks de saída** | avisar outro serviço quando uma task muda | **P** | nenhuma | vazamento se mal configurado | baixa | [I] |
| **Zapier / Make / n8n** | automações | **G** + backend | API pública e webhooks de entrada, que o Monet não tem | contraria "sem backend" | alta | [I] |
| **E-mail → task** | encaminhar e-mail e virar task | **G** + backend (servidor de e-mail de entrada) | serviço na nuvem | custo, privacidade | alta | o Things faz via **Things Cloud** (`@things.email`, 100 e-mails/24h, 4.000 caracteres, sem anexos) [V]. Alternativa local: arrastar `.eml`/`.msg` para o app (M) [I] |
| **Captura rápida global** (já existe `global-shortcut`) | capturar sem integração externa | P | nenhuma | — | baixa | [V no código] |

---

## (c) Tabela final: opção × valor × esforço × dependências × riscos × manutenção

Esforço: **P** = até 1 dia · **M** = 2–4 dias · **G** = 1+ semana.

| # | Opção | Valor para o usuário | Esforço | Dependências | Riscos | Manutenção |
|---|---|---|---|---|---|---|
| 1 | **Assinatura ICS read-only** (iCal secreto do Google, ICS publicado do Outlook, qualquer URL) → eventos no Calendar, nota diária e My Day | **Alto** | **M** | nenhuma (o usuário copia a URL) | URL secreta é credencial (guardar com cuidado); latência do feed; fusos (`TZID` do Windows); RRULE | baixa-média |
| 2 | **"Criar nota de reunião" a partir do evento** | **Alto** | **P** (sobre 1 ou 4) | 1 ou 4 | recorrência (guardar UID + recurrence-id) | baixa |
| 3 | **Export/import `.ics` (arquivo)** de tasks e deadlines | Médio | **P** (export) / **P–M** (import) | nenhuma | duplicatas na reimportação (UIDs estáveis) | baixa |
| 4 | **Google Calendar API, leitura** (loopback + PKCE, `syncToken`, polling) | Alto para usuários de Google | **G** + 2–6 semanas de verificação | projeto no Google Cloud; domínio, política de privacidade, vídeo; verificação de escopo sensível (gratuita) | teto de 100 usuários até verificar; cliente apagado após 6 meses sem uso; mudanças de cota e billing em 2026; tokens no Credential Manager | **alta** |
| 5 | **Time-blocking num calendário dedicado "Monet"** (`calendar.app.created`) | Médio-alto | **M** sobre o 4 | 4 + possível re-verificação | tasks sem horário poluem a agenda; conflitos | média-alta |
| 6 | **Sync bidirecional de tasks** com Google/Outlook | Desejo alto, satisfação baixa | **G+** (semanas) | 4 ou 8 | duplicatas, recorrência, conflitos, exclusões | **muito alta** |
| 7 | **"Traga seu próprio cliente OAuth do Google"** (estilo BYOK) | Médio (power users) | mesmo código do 4, **sem** verificação | o usuário cria o projeto no Google Cloud | atrito alto; aviso "unsafe"; 7 dias em Testing se o usuário não publicar o projeto | média |
| 8 | **Microsoft Graph, contas pessoais** | Médio | **G** (reusa parte do 4) | registro no Entra (tenant) | sem MSAL para Rust; delta por janela | alta |
| 9 | **Microsoft Graph, contas corporativas** | Alto quando liberado | **G** + burocracia | consentimento do admin; publisher verification (conta no programa de parceiros) | bloqueado por padrão em tenants novos (política gerenciada pela Microsoft) | alta |
| 10 | **CalDAV, leitura** (iCloud, Fastmail, Nextcloud) | Baixo no Windows | **M–G** | senha de app do provedor | cada provedor tem peculiaridades | média |
| 11 | **MCP oficial do Google Calendar via cliente MCP no Monet** | Baixo agora | **G** | Developer Preview + Google Cloud + cliente agentic + verificação | preview; não remove burocracia | alta |
| 12 | **Import/export CSV/XLSX (SheetJS 0.20.3 via CDN)** | Médio | **P–M** | nenhuma | arquivos grandes | baixa |
| 13 | **Embed "Publish to web" do Sheets** (iframe) | Baixo | **P** | o usuário publica a planilha | **dados públicos**; admin pode bloquear; ajuste de CSP | baixa |
| 14 | **Sheets API + Picker para desktop (`drive.file`)** | Baixo | **M–G** | projeto no Google Cloud; OAuth separado (`drive.file` sozinho) | demanda fraca | média |
| 15 | **MCP server local read-only** (stdio, `rmcp`, MCPB) | Médio, crescente (power users) | **M** | nenhuma (o usuário tem um cliente MCP) | trifecta/injection se combinado com web; concorrência no SQLite; spec mudando | média |
| 16 | **MCP com escrita via propostas** (inbox de aprovação no Monet) | Médio | **G** | 15 | injection gerando lixo (mitigado pela aprovação) | média |
| 17 | **Registro no Windows ODR** (MSIX) | Baixo-médio (futuro) | **M** | Windows build 26220.7262+ (preview) | API de preview; *containment* | média |
| 18 | **Cliente MCP no chat, stdio local** | Baixo-médio | **M** | o usuário instala servidores | servidores maliciosos ou execução local; confirmações | média |
| 19 | **Cliente MCP no chat, remoto com OAuth** | Baixo-médio | **G** | CIMD (JSON estático) ou DCR | SSRF, mix-up, tokens | alta |
| 20 | **Deep links `monet://`** | Médio (habilitador) | **P–M** | manifesto MSIX | URL forjada | baixa |
| 21 | **Bookmarks do Command Palette / Quicklinks do Raycast** (documentar) | Baixo-médio | **P** | 20 | — | baixa |
| 22 | **App Actions on Windows** | Baixo-médio | **M** | MSIX | API nova | média |
| 23 | **Extensões Raycast / Flow Launcher** | Baixo | **M** cada | 20 ou API local | nicho | média |
| 24 | **Extensão do Command Palette (.NET)** | Baixo | **G** | stack .NET/COM | stack diferente | média |
| 25 | **CLI** | Baixo-médio (agentes) | **M** | 15 (núcleo compartilhado) | concorrência no SQLite | média |
| 26 | **Web clipper** | Médio-alto (PKM) | **G** (M–G via fork) | lojas de extensão; 20 | revisão nas lojas; manutenção | média-alta |
| 27 | **Import Kindle (`My Clippings.txt`)** | Médio para leitores | **P–M** | nenhuma | formatos | baixa |
| 28 | **Import Readwise** | Médio para leitores | **M** | token do usuário; Readwise pago | API de terceiro | baixa-média |
| 29 | **Webhooks de saída** | Baixo | **P** | nenhuma | configuração | baixa |
| 30 | **Zapier / Make / n8n** | Baixo (pessoal) | **G** + backend | backend | contraria a arquitetura | alta |
| 31 | **E-mail → task** | Médio | **G** + backend | servidor de e-mail | custo, privacidade | alta |

---

## (d) Fontes (acessadas em 2026-10-17; "atual." = data exibida na página)

### Google: OAuth, verificação e políticas
- OAuth para apps nativos/desktop — https://developers.google.com/identity/protocols/oauth2/native-app (atual. 2026-10-16)
- Visão geral do OAuth 2.0 (expiração de refresh token, limite de 100 tokens) — https://developers.google.com/identity/protocols/oauth2 (atual. 2026-10-16)
- Unverified apps — https://support.google.com/cloud/answer/7454865
- Manage App Audience (Testing, 7 dias, teto de 100 usuários) — https://support.google.com/cloud/answer/15549945
- Manage OAuth Clients (tipos de cliente, opção agentic, exclusão após 6 meses) — https://support.google.com/cloud/answer/15549257
- OAuth App Verification Help Center — https://support.google.com/cloud/answer/9110914
- Escopos sensíveis e restritos — https://support.google.com/cloud/answer/13463073
- Requisitos de verificação — https://support.google.com/cloud/answer/13464321
- Quando a verificação não é necessária — https://support.google.com/cloud/answer/13464323
- FAQ de verificação (prazos) — https://support.google.com/cloud/answer/13463817
- Security assessment (CASA) — https://support.google.com/cloud/answer/13465431
- Envio para verificação (vídeo, justificativa) — https://support.google.com/cloud/answer/13461325
- Configurar consent screen — https://developers.google.com/workspace/guides/configure-oauth-consent (atual. 2026-09-03)
- Escopos do Gmail (exemplo de escopos restritos) — https://developers.google.com/workspace/gmail/api/auth/scopes (atual. 2026-09-10)
- Escopos do Drive — https://developers.google.com/workspace/drive/api/guides/api-specific-auth (atual. 2026-09-03)
- Escopos do Sheets — https://developers.google.com/workspace/sheets/api/scopes (atual. 2026-09-03)
- API Services User Data Policy — https://developers.google.com/terms/api-services-user-data-policy (atual. 2024-02-15)
- Nylas, guia de verificação Google (classificação dos escopos de Calendar) — https://developer.nylas.com/docs/provider-guides/google/google-verification-security-assessment-guide/ (atual. 2026-10-07) [S]

### Google Calendar
- Escopos — https://developers.google.com/workspace/calendar/api/auth (atual. 2026-09-03)
- Cotas — https://developers.google.com/workspace/calendar/api/guides/quota (atual. 2026-09-11)
- Modelo de tiers de cota (2026) — https://developers.google.com/workspace/tools-safety (atual. 2026-09-03)
- Sync incremental — https://developers.google.com/workspace/calendar/api/guides/sync (atual. 2026-09-11)
- `events.list` (parâmetros incompatíveis com `syncToken`) — https://developers.google.com/workspace/calendar/api/v3/reference/events/list
- Push notifications — https://developers.google.com/workspace/calendar/api/guides/push (atual. 2026-09-11)
- Release notes (MCP 2026-04-22, tiers 2026-05-01, cliente agentic 2026-10-12) — https://developers.google.com/workspace/calendar/release-notes
- Configurar o Calendar MCP server — https://developers.google.com/workspace/calendar/api/guides/configure-mcp-server (atual. 2026-10-12)
- MCP servers do Google Workspace — https://developers.google.com/workspace/guides/configure-mcp-servers (atual. 2026-10-13)
- Endereço secreto iCal — https://support.google.com/calendar/answer/37648
- CalDAV — https://developers.google.com/workspace/calendar/caldav/v2/guide (atual. 2026-10-09)
- Frequência de atualização de feeds externos [S] — https://knowledge.cheqroom.com/helpcenter/how-often-does-google-update-its-calendar-feeds ; https://oneuptime.com/docs/en/on-call/calendar-feeds

### Google Sheets, Drive e Picker
- Picker (visão geral) — https://developers.google.com/workspace/drive/picker/guides/overview (atual. 2026-09-14)
- Picker para desktop e mobile — https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker (atual. 2026-10-12)
- Publish to web — https://support.google.com/docs/answer/183965
- SheetJS (instalação) — https://docs.sheetjs.com/docs/getting-started/installation/frameworks
- Notion: embeds e Google Drive — https://www.notion.com/help/embed-and-connect-other-apps
- Plugin GDocs (Obsidian) — https://community.obsidian.md/plugins/gdocs
- Plugin Sheet Plus (Obsidian) — https://community.obsidian.md/plugins/sheet-plus
- Busca sobre plugins de Sheets no Obsidian [S] — https://plusai.com/apps/google-sheets/integrations/obsidian

### Microsoft
- Configurar consentimento do usuário — https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-user-consent (atual. 2026-08-04)
- App consent policies (política gerenciada pela Microsoft bloqueia `Calendars.*`) — https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-app-consent-policies (ms.date 2026-01-22; atual. 2026-08-28)
- Publisher verification — https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview (atual. 2026-06-15)
- Referência de permissões do Graph — https://learn.microsoft.com/en-us/graph/permissions-reference
- Redirect URIs — https://learn.microsoft.com/en-us/entra/identity-platform/reply-url (atual. 2026-06-15)
- Configuração de app desktop (libs MSAL) — https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-configuration (atual. 2026-06-15)
- Delta de eventos — https://learn.microsoft.com/en-us/graph/delta-query-events (atual. 2025-08-06)
- Throttling (limites do Outlook) — https://learn.microsoft.com/en-us/graph/throttling-limits
- Compartilhar e publicar calendário no Outlook na web — https://support.microsoft.com/en-us/office/share-your-calendar-in-outlook-on-the-web-7ecef8ae-139c-40d9-bae2-a23977ee58d5
- Sharing policies do Exchange Online — https://learn.microsoft.com/en-us/exchange/sharing/sharing-policies/sharing-policies (atual. 2023-08-21)
- Fim do Windows Mail & Calendar — https://support.microsoft.com/en-us/office/outlook-for-windows-the-future-of-mail-calendar-and-people-on-windows-11-715fc27c-e0f4-4652-9174-47faa751b199
- Work IQ / MCP do Outlook [S] — https://chatforest.com/reviews/outlook-mcp-servers/ ; https://www.scalekit.com/blog/outlook-mcp-vs-api
- Estrutura CREDENTIALW (limite de 2.560 bytes) — https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw
- Como apps MSIX rodam (virtualização de HKCU e AppData) — https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes (atual. 2026-10-12)

### Tauri e Rust
- Plugin de deep linking — https://v2.tauri.app/plugin/deep-linking/
- tauri-plugin-oauth — https://github.com/FabianLars/tauri-plugin-oauth
- Plugin Stronghold — https://v2.tauri.app/plugin/stronghold/
- Crate keyring (4.2.0) — https://docs.rs/keyring/latest/keyring/
- SDK Rust oficial do MCP (rmcp) — https://github.com/modelcontextprotocol/rust-sdk
- Código local do Monet: `src-tauri/Cargo.toml` (opener, single-instance, notification, global-shortcut, reqwest, rusqlite) e `src-tauri/src/lib.rs` (`save_key` em texto puro; `run_openrouter_stream` com `tools`/`tool_choice`)

### MCP: spec, ecossistema e segurança
- Versionamento (atual = 2026-07-28) — https://modelcontextprotocol.io/specification/versioning
- Changelog da 2026-07-28 — https://modelcontextprotocol.io/specification/2026-07-28/changelog
- Autorização — https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- Transportes — https://modelcontextprotocol.io/specification/2026-07-28/basic/transports
- Streamable HTTP — https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
- Tools — https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- Boas práticas de segurança — https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices
- Anúncio da spec 2026-07-28 — https://blog.modelcontextprotocol.io/posts/2026-07-28/
- Roadmap (2026-08-22) — https://blog.modelcontextprotocol.io/posts/mcp-roadmap/
- MCPB (ex-DXT) — https://github.com/modelcontextprotocol/mcpb
- Claude: construir conectores — https://claude.com/docs/connectors/building
- Claude: servidores MCP locais no Desktop — https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop
- Claude: conectores do Google Workspace — https://support.claude.com/en/articles/10166901-using-the-google-workspace-connectors
- OpenAI: MCP — https://developers.openai.com/api/docs/mcp/
- Gemini CLI — https://github.com/google-gemini/gemini-cli
- VS Code: servidores MCP — https://code.visualstudio.com/docs/copilot/customization/mcp-servers (2026-10-14)
- Copilot Studio: MCP — https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-extend-action-mcp (ms.date 2026-08-26)
- MCP no Windows (visão geral) — https://learn.microsoft.com/en-us/windows/ai/mcp/overview (atual. 2026-06-04)
- Servidores MCP no Windows — https://learn.microsoft.com/en-us/windows/ai/mcp/servers/mcp-server-overview (atual. 2025-11-18)
- Registro via package identity — https://learn.microsoft.com/en-us/windows/ai/mcp/servers/mcp-windows-identity (atual. 2025-12-16)
- Notion MCP — https://developers.notion.com/docs/mcp
- Linear MCP — https://linear.app/docs/mcp
- Todoist MCP (Doist) — https://github.com/Doist/todoist-ai
- Obsidian CLI — https://obsidian.md/cli
- Obsidian changelog — https://obsidian.md/changelog/
- Obsidian Local REST API — https://github.com/coddingtonbear/obsidian-local-rest-api
- Capacities: API antiga — https://docs.capacities.io/developer/api
- Capacities: consentimento MCP — https://docs.capacities.io/faq/general/space-missing-mcp-consent
- Capacities: nova API — https://developers.capacities.io
- Tana: Local API e MCP — https://outliner.tana.inc/docs/local-api-mcp
- Things e ferramentas de IA de terceiros — https://culturedcode.com/things/support/articles/5510170/ (2026-04-02)
- MCPs comunitários do TickTick [S] — https://glama.ai/mcp/servers/i9wnz1ggcb
- Homepages — https://www.craft.do/ ; https://heptabase.com/ ; https://amie.so/
- SafeBreach, *Invitation Is All You Need* (2025-08-06) — https://www.safebreach.com/blog/invitation-is-all-you-need-hacking-gemini/
- Simon Willison, *The lethal trifecta* (2025-06-16) — https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/

### Concorrentes e sentimento
- Todoist: integração de calendário — https://www.todoist.com/help/articles/use-google-calendar-with-todoist-rCqwLCt3G (atual. 2026-10-07)
- Todoist: troubleshooting — https://www.todoist.com/help/articles/troubleshoot-google-calendar-integration-issues-in-todoist-SsSatVeir (atual. 2026-10-12)
- Things: calendário — https://culturedcode.com/things/support/articles/2803583/
- Things: URL scheme — https://culturedcode.com/things/support/articles/2803573/
- Things: Mail to Things — https://culturedcode.com/things/support/articles/2908262/
- Things: Microsoft To Do — https://culturedcode.com/things/support/articles/7597548/
- Tana: integração de calendário — https://outliner.tana.inc/learn/features/calendar-integration
- Reflect: calendário e contatos — https://reflect.academy/calendar-and-contacts
- Capacities: release 70 (set/2026) — https://capacities.io/whats-new/release-70
- Notion Calendar — https://www.notion.com/product/calendar
- Morgen: integrações — https://www.morgen.so/integrations
- Sunsama — https://www.sunsama.com/
- Akiflow — https://akiflow.com/
- Motion — https://www.usemotion.com/
- Obsidian Day Planner — https://community.obsidian.md/plugins/obsidian-day-planner
- Obsidian Full Calendar — https://community.obsidian.md/plugins/obsidian-full-calendar ; https://github.com/obsidian-community/obsidian-full-calendar (arquivado em 2026-08-01)
- Obsidian Google Calendar — https://community.obsidian.md/plugins/google-calendar ; https://github.com/YukiGasai/obsidian-google-calendar ; https://yukigasai.github.io/obsidian-google-calendar/Setup ; https://github.com/YukiGasai/obsidian-google-calendar/issues
- Obsidian ICS — https://community.obsidian.md/plugins/ics ; https://github.com/open-horizon-labs/obsidian-ics
- Day Planner (GitHub) — https://github.com/ivan-lednev/obsidian-day-planner
- Meeting Plus (2026-05-31) — https://forum.obsidian.md/t/meeting-plus-one-click-calendar-integration-and-meeting-notes/114819
- Logseq Agenda — https://github.com/haydenull/logseq-plugin-agenda
- NotePlan: pedido de time block no calendário — https://feedback.noteplan.co/board/p/send-timeblock-to-calendar
- NotePlan: changelog — https://noteplan.co/changelog/time-block-calendar-sync
- Duplicatas em sync [S] — https://static.toodledo.com/forums/2/26985/-121127/read.html ; https://support.weekplan.net/communities/1/topics/4075-duplicated-events-in-google-calendar
- TickTick na App Store (via busca) [S] — https://apple.co/2GWFNL5

### Lançadores, Windows e outros
- Command Palette (visão geral) — https://learn.microsoft.com/en-us/windows/powertoys/command-palette/overview (atual. 2026-08-25)
- Extensões do Command Palette — https://learn.microsoft.com/en-us/windows/powertoys/command-palette/extensibility-overview (atual. 2026-04-16)
- Raycast para Windows — https://www.raycast.com/windows
- Flow Launcher (plugins) — https://raw.githubusercontent.com/Flow-Launcher/docs/main/plugin-dev.md
- App Actions on Windows — https://learn.microsoft.com/en-us/windows/ai/app-actions/ (atual. 2026-10-15)
- Obsidian Web Clipper — https://obsidian.md/clipper ; https://obsidian.md/help/web-clipper/troubleshoot ; https://github.com/obsidianmd/obsidian-clipper
- Readwise API — https://readwise.io/api_deets

---

## Lacunas de pesquisa (o que não consegui confirmar)

1. **Classificação de `calendar.app.created` e `calendar.events.owned`** (sensitive ou non-sensitive) não é publicada. Decide o custo do time-blocking. Teste: adicionar o escopo no Cloud Console e ver em qual seção ele aparece.
2. **Latência de regeneração** do iCal secreto do Google e do ICS publicado do Outlook não tem documentação oficial. Medir na prática.
3. **Sentimento em Reddit e Hacker News** ficou pouco coberto (cota de busca esgotada). Usei boards, fóruns de fornecedores e downloads como proxy.
4. **Não verificados:** Amplenote (site bloqueou o acesso); detalhes de tasks bidirecionais e preços de Sunsama e Akiflow; comportamento oficial do TickTick; sync de Sheets no Notion; Coda e Craft com Sheets; conectores de calendário do ChatGPT e seus planos.
5. **Microsoft:** viabilidade do Partner Program e da publisher verification para um dev individual, e se contas pessoais veem aviso de "não verificado".
6. **Testes técnicos necessários:**
   - deep links em MSIX (declaração no manifesto);
   - MCP sidecar com AppExecutionAlias enxergando o AppData virtualizado;
   - *containment* do Windows ODR permitindo acessar o banco do Monet;
   - concorrência de SQLite com um segundo processo.
7. Regras específicas de IA da **Workspace API User Data Policy** não foram reverificadas. Revisar antes de enviar dados de agenda ao LLM.
