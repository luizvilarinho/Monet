# Estudo — Tasks e entregas: a agenda sofisticada

> Data: 2026-10-17 · Somente leitura (nenhum código alterado) · Base: develop v1.4.9 + cópia do banco de produção (24/06–17/10) · Material de mercado em `DOCS/features/mercado_2026-10/`
> Pergunta do Coordenador: "Dá pra melhorar como gerenciamento de tasks e entregas? Vale a pena alguma integração agora, como Google Calendar? Precisamos de planilhas mais sofisticadas? Integração com Google Sheets? Precisamos de uma versão online (simplificada)?"
> Estudo irmão: `DOCS/features/central_informacao_study.md`. Antecessor: `DOCS/features/tasks_study.md` (Tasks v2).
> Privacidade: o repositório é público. Dados de trabalho aparecem agregados, sem nomes de empresa, pessoas ou sistemas.

---

## 1. TL;DR

- **Dá pra melhorar? Sim, mas não com mais organização.** O núcleo que você usa é *deadline + do date + group + status + reagendar*. O que a v3 adicionou de estrutura quase não pegou: metadados custom (0 usos), recorrência (0), My Day (1), descrição (0), visões salvas (1). Falta o que liga as tasks ao seu dia real:
  1. as **pendências esquecidas nas notas diárias** (54 itens de checklist abertos);
  2. **lembretes que não falham** (hoje só disparam com o app aberto);
  3. **prazo em dias úteis** (você pediu essa conta à IA);
  4. **saída para fora** (status da semana e horas por projeto);
  5. **captura a partir de reuniões e do chat**, sempre com sua confirmação.
- **Google Calendar agora? A API completa não.** Os escopos de Calendar são *sensitive*:
  - para escapar dos limites é preciso verificar o app (~10 dias úteis, com domínio, política de privacidade e vídeo);
  - sem verificação, no modo de teste o login expira a cada 7 dias, e em produção há teto vitalício de 100 usuários;
  - no Outlook corporativo, a política padrão da Microsoft impede você mesmo de autorizar o acesso ao calendário.

  Se valer algo, é **leitura via ICS** (M) mais **"criar nota de reunião a partir do evento"** (P). Antes, uma resposta sua: onde estão suas reuniões e se dá para gerar um link ICS (§6, D1). **Sync bidirecional, não**: nem o Todoist faz por completo.
- **Planilhas? Não para tasks.** Faltam *export* (CSV/XLSX) para status e horas, não fórmulas. **Google Sheets: não** (demanda fraca no mercado e zero no seu uso).
- **Versão online? Não para tasks agora.** Sua captura acontece na mesa (58% dos dias úteis com nota diária, mais o Ctrl+K). Mobile só se a captura fora do PC virar dor real.
- **A "integração" com mais retorno não é calendário:**
  - **autostart** (P);
  - **contrato VOLP → Monet** para reuniões (P–M; ver estudo irmão);
  - **link para o Jira** na task (P), já que as tarefas oficiais vivem lá;
  - mais adiante, um **servidor MCP local só leitura** (M), que permite ao Claude cruzar suas tasks com o calendário dele sem nenhum OAuth no Monet.

---

## 2. Como você usa (produção)

| Sinal | Números | Leitura |
| --- | --- | --- |
| Volume | 23 tasks criadas em 5 dias (12–16/out), todas de trabalho, em 3 projetos (Inbox, migração e projeto principal) | Tasks virou ferramenta de entregas de trabalho, não de pendências de estudo |
| Vazão | 15 concluídas; mediana de **1 dia** entre criar e concluir (máx. 3,2) | Ciclo curto: entregas táticas da semana |
| Datas | **100%** com deadline; **52%** com do date; **1** com My Day | Deadline é o dado central; o planejamento por dia é usado em metade; My Day não pegou |
| Estrutura | **91%** com group (frente/sistema); 1 status custom (Waiting, WIP 3); 1 visão salva (filtro de projeto) | Group resolveu o "`sistema \|` no título" do estudo v2. Waiting já aparece |
| Reagendamento | **11 de 23** reagendadas ao menos 1×; máx. 3× | Metade das entregas escorrega; o badge ↻ tem uso real |
| Nota-corpo | 12 tasks com nota-corpo; 9 com checklist (até 8 itens) | A nota-corpo virou o "como fazer" da entrega |
| Origem | 3 vieram de checklist de nota ("Add to Tasks") | A ponte nota→task existe, mas a maioria nasce no quick add |
| Não usado | metadados custom **0**, recorrência **0**, descrição **0**, Important 4 | Ver §3 |
| Notas diárias | 53 com conteúdo; 48 em dias úteis = **58% dos dias úteis**; 26 com checklist (**54 itens abertos** e 71 feitos); 21 com horários; 8 com reuniões | A nota diária é o diário de trabalho. Muita pendência fica para trás |
| Lembretes | 21 disparados (11 em outubro) | Uso crescente; depende do app estar aberto |
| Reuniões | 17 reuniões gravadas e transcritas pelo VOLP, entrando via pasta monitorada | A agenda real tem reuniões, mas elas entram por arquivo, não por calendário |
| Chat | "O que eu tenho pra fazer hoje?" (chat do Calendar); "quantos dias úteis de 21/9 até 9/12?"; "grave em memória sobre o lançamento de horas" (obrigação mensal: dia 15, período 22→21, horas por trabalho) | A obrigação recorrente foi parar na memória da IA, e não numa task recorrente |
| Fora do Monet | A memória do chat registra que as tarefas oficiais do trabalho ficam no **Jira** | O Monet é sua camada pessoal acima do Jira |

---

## 3. O que a v3 entregou × o que é usado

| Recurso | Uso real | Decisão sugerida |
| --- | --- | --- |
| Quick add NLP (`fri`, `!17/10`, `#Projeto`, `@status`, `!!`) | Principal porta de entrada | Manter; adicionar recorrência (T13) |
| Deadline / do date / atraso amarelo × vermelho | 100% / 52% | Manter; adicionar dias úteis (T2) |
| Groups | 91% | Manter |
| Status custom + WIP | 1 status (Waiting) | Manter; enriquecer o Waiting (T14) |
| Kanban / Week / Projects / Groups | Visão padrão = List agrupada por data | Manter (custo já pago) |
| My Day | 1 task | Esconder ou fundir com a nota diária (T12) |
| Weekly Review | 1 uso (14/10, salvo na nota diária) | Transformar em relatório de status (T6) |
| Metadados custom | **0 definições** | Esconder em "avançado" (T12) |
| Recorrência | **0** (a obrigação mensal foi para a memória da IA) | Facilitar a criação (T13), não remover |
| Visões salvas | 1 | Manter discreto |
| Bloco `/tasks`, "Due today" na nota diária | — | Base para T3 |
| Tool `query_tasks` no chat | Usada ("o que tenho pra fazer hoje?") | Manter; base para T5 |

> Leitura: a v3 cresceu em **organização**; o uso pede **continuidade**: nada esquecido, prazos reais e saída para o mundo. O PRD já diz que Tasks "não é PM", e o uso confirma: nenhum recurso de PM pesado pegou.

---

## 4. Mercado (agenda e entregas)

Complementa a tabela de `tasks_study.md` §4 (Things, Todoist, TickTick, Sunsama, To Do, Linear, Logseq/Obsidian Tasks, Akiflow/Motion, Notion/Capacities). Detalhes e fontes em `mercado_2026-10/market_06_integracoes.md` §3.

| App | Calendário | O que vale adaptar |
| --- | --- | --- |
| **Todoist** | Eventos Google/Outlook **só leitura** em Today/Upcoming; tasks *com horário* vão para um **calendário dedicado "Todoist"**; um provedor por vez | Ler eventos ≠ sincronizar tasks. Escrita, se houver, num calendário próprio |
| **Things 3** | Eventos do Apple Calendar só leitura no Today; não envia to-dos ao calendário | Mostrar a agenda ao lado do plano basta para a maioria |
| **NotePlan** | Time blocks viram eventos num calendário dedicado, com link de volta para a nota diária (pedido de 121 votos) | Se um dia escrever no calendário: calendário dedicado + link `monet://` |
| **Obsidian Day Planner** | Timeline local a partir da nota diária + ICS; **~905k downloads**. O plugin Google Calendar está parado; o Full Calendar foi **arquivado em 08/2026** | Local + ICS envelhece bem; OAuth de terceiros envelhece mal |
| **Reflect / Tana / Capacities / Amie** | Reuniões ao lado da nota diária; **"criar nota de reunião" a partir do evento** | O evento vira registro por decisão do usuário: encaixa na tese |
| **Sunsama / Akiflow / Morgen** | Planejamento diário com calendário; time-blocking; *rollover* com contador | O ritual diário e o rollover (o Monet já tem ↻) |
| **Motion** | Auto-agenda e re-otimiza o dia sozinho | **Não**: a IA decide pelo usuário |
| **Bullet Journal / rollover (Logseq, Obsidian)** | Migração manual das pendências do dia anterior | Bloco de "pendências de dias anteriores" (T3) |

Padrões:
1. Quase todos **leem** o calendário e quase ninguém sincroniza tasks nos dois sentidos (duplicatas, recorrência, conflitos).
2. **Nota de reunião a partir do evento** é o recurso de maior valor por custo.
3. Integrações que dependem de **OAuth próprio** quebram e envelhecem; **ICS e arquivo local** duram.
4. O mercado de IA vai para agentes que **agendam sozinhos** (Motion) ou **criam tasks sozinhos**. O Monet fica no polo oposto: **a IA propõe, você aprova**.
5. Em 2026, quem integra calendário de terceiros cada vez mais é o **assistente** (via MCP), não o app de notas.

---

## 5. Respostas às perguntas

### 5.1 Vale integrar com Google Calendar agora?

| Opção | Valor para você | Esforço | Bloqueios | Veredito |
| --- | --- | --- | --- | --- |
| **Assinatura ICS só leitura** (endereço iCal secreto do Google, ICS publicado do Outlook, qualquer URL) → eventos no Calendar, na nota diária e no My Day | Alto **se** suas reuniões estiverem num calendário que gere ICS | M | Nenhum externo. A URL secreta é credencial; o feed tem latência | **Vale, condicionado à D1** |
| **"Criar nota de reunião" a partir do evento** | Alto (você já escreve reuniões na nota diária) | P (sobre o ICS) | — | **Vale junto com o ICS** |
| **Google Calendar API, só leitura** (OAuth loopback + PKCE, polling com `syncToken`) | Alto para usuário Google | G + 2–6 semanas de verificação | Projeto no Google Cloud, domínio, política de privacidade, vídeo; sem verificação, login a cada 7 dias (Testing) ou teto de 100 usuários | **Não agora**: só se o ICS provar uso e faltar dado (participantes, link) |
| **Time-blocking num calendário dedicado "Monet"** | Médio | M sobre a API | Igual à anterior | Não agora |
| **Sync bidirecional de tasks** | Desejado, mas a satisfação é baixa no mercado | G+ | Duplicatas, recorrência, conflitos | **Não** |
| **Outlook corporativo via Microsoft Graph** | Alto quando liberado | G + admin | Consentimento bloqueado por padrão em tenants novos | **Não** (depende de TI) |
| **MCP local só leitura** (Claude cruza as tasks do Monet com o conector de calendário *dele*) | Médio, crescente | M | Você precisa de um cliente MCP (o Claude Code você já usa) | **Vale como experimento** (compartilhado com o estudo irmão, I14) |

**Resposta:** não vale fazer a integração com o **Google** agora. Vale **ler a agenda por ICS** se a D1 confirmar que suas reuniões estão acessíveis por ICS. Se o calendário for corporativo e a publicação de ICS estiver bloqueada, nenhuma integração direta resolve. Aí o caminho é o **MCP** (Claude + conector de calendário + Monet) ou nada.

### 5.2 Precisamos de planilhas mais sofisticadas?

Não para tasks. Os metadados custom (o recurso "tipo planilha" que já existe) têm 0 usos; as visões cobrem leitura e organização. O que aparece no uso é a necessidade de **levar dados para fora**:
- o status da semana para o time;
- as horas por trabalho no período 22→21 para o lançamento mensal.

Isso é **export** (CSV/XLSX via SheetJS) e **relatório** (T6–T8), não uma planilha embutida. A planilha embutida aparece no estudo irmão (§5.4), com a mesma conclusão.

### 5.3 Integração com Google Sheets?

Não. Não há nenhuma menção no seu uso. No mercado, o plugin de planilha local do Obsidian tem 211k downloads, contra ~2k do embed do Google Drive, e nenhum plugin sincroniza o Sheets ao vivo. Se um dia precisar, o caminho barato é **CSV/XLSX local** (P–M). A Sheets API pede OAuth separado (`drive.file` + Picker) e não se paga.

### 5.4 Versão online para tasks?

Não agora. Seu uso é de mesa: dias úteis, nota diária e Ctrl+K. Tasks online só tem valor com **sync**, que é não-meta do PRD e a peça mais cara (ver estudo irmão §5.3). Se a captura no celular virar dor, o caminho mais barato que um app web é um arquivo de *inbox* numa pasta sincronizada (OneDrive): você escreve linhas no celular, e o Monet as lê como tasks no Inbox, com o mesmo parser do quick add. O MCP local (T11) não ajuda aqui, porque só atende clientes no próprio PC.

---

## 6. Propostas priorizadas

Esforço: P (até 1 dia), M (2–4 dias), G (1+ semana). "PRD §9" = conflito com as não-metas.

### Bloco 1 — Agenda confiável

| # | Proposta | Valor | Esforço | Riscos | PRD §9 |
| --- | --- | --- | --- | --- | --- |
| T1 | **Iniciar com o Windows, minimizado na bandeja.** Plugin autostart no instalador direto; no MSIX, `StartupTask` no manifesto. Lembretes, "Deadline tomorrow" e "Due today" passam a disparar sem você abrir o app | Alto | P | No MSIX exige declarar a extensão e o usuário pode desligar em Configurações | Nenhum |
| T2 | **Prazo em dias úteis.** "faltam 3 d.u." no card e no detalhe, com feriados nacionais (calculados: fixos + Páscoa) e lista de feriados próprios (ponte, recesso); no quick add, `!+10du` = deadline em 10 dias úteis | Médio-alto | P–M | Feriados estaduais e municipais ficam por conta da lista própria | Nenhum |

### Bloco 2 — Nada fica para trás

| # | Proposta | Valor | Esforço | Riscos | PRD §9 |
| --- | --- | --- | --- | --- | --- |
| T3 | **"Pendências de dias anteriores" na nota diária.** Bloco vivo, como o "Due today", com os itens de checklist abertos das notas diárias passadas (hoje: 54). Por item: *trazer para hoje* (move a linha), *virar task* (o "Add to Tasks" que já existe) ou *descartar* (marca como riscado). Contador no Calendar | **Alto** | M | Bloco grande demais → paginar e começar pelos últimos 14 dias | Nenhum |
| T4 | **Reunião → ações.** Na nota de reunião ou no `resumo.md` do VOLP, o botão "Extrair ações" faz a IA **propor** cards de task (título, deadline sugerido, projeto/group); você aceita ou edita um por um. Nada é criado sem clique | Alto | M | Exige a D3; ações vagas → o card pede edição | Tangencia "sem criação por IA" → D3 |
| T5 | **Chat → task com confirmação.** Tool `propose_task`: quando você pedir ("me lembra de lançar horas todo dia 15"), o chat devolve um **card de proposta** com título, recorrência, deadline e projeto, e um botão "Adicionar". É o "Anotar" das tasks | Médio-alto | P–M | Mesmo da T4 | D3 |

### Bloco 3 — Entregas visíveis para fora

| # | Proposta | Valor | Esforço | Riscos | PRD §9 |
| --- | --- | --- | --- | --- | --- |
| T6 | **Relatório de status.** O Weekly Review gera um markdown determinístico, sem IA: concluídas, em andamento, aguardando e escorregadas (↻) por projeto/group. Botão de copiar para Teams, e-mail ou comentário no Jira. `/week` resume, se você pedir | Alto | P–M | — | Nenhum |
| T7 | **Horas por projeto/group no período.** Estimativa a partir do tempo em `doing` (`doing_since` já existe), com período configurável (22→21), ajuste manual e export CSV para o lançamento mensal | Médio-alto | M | Vira time-tracker se crescer: manter só "estimativa + ajuste" | Tangencia "não é PM" → D4 |
| T8 | **Export CSV/XLSX** de tasks, visões e Weekly Review (SheetJS 0.20.3 do CDN oficial; o pacote npm `xlsx` está desatualizado) | Médio | P–M | — | Nenhum |
| T9 | **Link externo na task.** Campo "link" (URL ou chave do Jira) no detalhe, clicável. Quick add: `J:ABC-123` vira link montado com a URL base configurada. O Monet fica como camada pessoal acima do Jira, sem integrar | Médio | P | — | Nenhum |

### Bloco 4 — Agenda externa (condicional)

| # | Proposta | Valor | Esforço | Riscos | PRD §9 |
| --- | --- | --- | --- | --- | --- |
| T10 | **Assinatura ICS + nota de reunião a partir do evento** (§5.1). Eventos no Calendar e na nota diária; "Criar nota" preenche título, horário e participantes (se o feed trouxer) e linka na nota diária | Alto se D1 = sim | M + P | URL secreta = guardar no Credential Manager do Windows; recorrência (RRULE) e fusos | Nenhum |
| T11 | **MCP local só leitura** (`list_tasks`, `get_day`): o Claude responde "o que vence essa semana?" e, com o conector de calendário dele, bloqueia horário na **sua** agenda. O Monet não faz OAuth | Médio | M (o mesmo servidor de I14 no estudo irmão) | Injeção via conteúdo de notas e convites: só leitura e desligado por padrão | Nenhum |

### Bloco 5 — Menos superfície, mais uso

| # | Proposta | Valor | Esforço | Riscos | PRD §9 |
| --- | --- | --- | --- | --- | --- |
| T12 | **Esconder o que não pegou:** metadados custom, My Day e visões salvas vão para "Mais/avançado". Reavaliar em 4 semanas; se seguirem sem uso, remover (regra do projeto: código morto sai) | Médio (menos ruído) | P | Remover cedo demais → por isso "esconder" primeiro | Nenhum |
| T13 | **Recorrência no quick add:** `todo dia 15`, `toda seg`, `mensal`, `every mon`. A obrigação mensal vira task, não memória da IA | Médio | P | Parser PT/EN | Nenhum |
| T14 | **Waiting com "de quem / desde / cobrar em"**, com lembrete de follow-up | Médio | P–M | — | Nenhum |

**Não recomendado:** sync bidirecional com Google ou Outlook; Microsoft Graph corporativo; Sheets API; e-mail → task (exige backend); Zapier/Make; IA que agenda ou cria tasks sozinha (Motion); time-blocking por hora (o Calendar do Monet é por dia).

---

## 7. Fases

| Fase | Conteúdo | Resultado |
| --- | --- | --- |
| **1 — Confiável** (≤ 1 semana) | T1 autostart, T2 dias úteis, T13 recorrência no quick add, T9 link externo, T12 esconder | Lembretes que não falham, prazos reais, obrigação mensal como task |
| **2 — Nada esquecido** (~1 semana) | T3 pendências de dias anteriores, T5 `propose_task` no chat, T14 Waiting | As 54 pendências voltam ao radar; o chat vira porta de entrada com confirmação |
| **3 — Entregas visíveis** (~1 semana) | T6 relatório de status, T8 export, T7 horas por período | Status e lançamento de horas sem retrabalho |
| **4 — Agenda externa** (condicional) | T10 ICS + nota de reunião (se D1); T4 reunião → ações (com o contrato VOLP, I13 do estudo irmão); T11 MCP (se D4 do estudo irmão) | Reuniões e tasks no mesmo dia, sem OAuth |

---

## 8. Decisões necessárias do Coordenador

1. **D1 — Onde estão suas reuniões?** Calendário corporativo (Outlook/Teams), Google pessoal ou ambos? Dá para publicar ou obter um link ICS (a política da empresa permite)? Isso decide a T10. Sem ICS, o calendário fica fora, ou entra via MCP (T11).
2. **D2 — Jira:** basta o link na task (T9) ou você quer, mais adiante, ler "minhas issues" (exige saber se o Jira é Cloud ou Data Center e se token pessoal é permitido)?
3. **D3 — IA propondo tasks (T4, T5):** aceita mudar o PRD §9 de "sem criação automática por IA" para **"a IA pode propor tasks; nada é criado sem confirmação explícita"**? É o mesmo mecanismo do "Anotar".
4. **D4 — Horas por período (T7):** entra no escopo "gerenciador pessoal de entregas" ou é PM demais?
5. **D5 — Simplificação (T12):** esconder agora e remover em 4 semanas o que seguir sem uso (metadados custom, My Day, visões salvas)?
6. **D6 — Autostart (T1):** ligado por padrão (recomendado, para os lembretes valerem) ou opt-in no onboarding?
