# Execution Report

## Documents
- Task report: DOCS/reports/04-11-2026/taskreport_20261104011432.md
- Execution report: DOCS/reports/04-11-2026/executionreport_20261104011432.md
- Explorer report: DOCS/reports/03-11-2026/explorerreport_20261103231208.md (reaproveitado)
- Plan report: DOCS/reports/04-11-2026/planreport_20261104012816.md
- UX report: DOCS/reports/04-11-2026/uxreport_20261104030009.md
- Review report: DOCS/reports/04-11-2026/reviewreport_20261104032127.md (cobre as fases 2–4)
- Fase 2 (sem commit, base desta task): DOCS/reports/04-11-2026/executionreport_20261104004816.md
- Estudo de origem: DOCS/features/agents_study.md

## Sessions
### Orchestrator — abertura — 20261104011432
- Summary: O Coordenador testou a fase 2 ("ficou bom e útil") e pediu para implementar os agentes restantes, deixando a revisão só para o final. O escopo é planner, coach e tutor, mais o contrato do plano.
- Inputs:
  - DOCS/reports/04-11-2026/taskreport_20261104011432.md
  - DOCS/features/agents_study.md
- Decision:
  - O Task Report segue sem rodada de aprovação, por instrução do Coordenador, com escopo já aprovado no estudo.
  - Um `plannerAgent` para as duas fases e dois `codeAgent` em sequência (planner + coach, depois tutor).
  - Teste do Coordenador e, por fim, um review único das fases 2–4 com uma passada final do `codeAgent`.
- Next step: plannerAgent

### PlannerAgent — 20261104012816
- Summary: Plano em duas partes, com as referências conferidas no working tree e a estrutura do PRD consultada na cópia somente leitura.
  - **Parte A** (A1–A9):
    - `buildContext` passa a receber `{ todayKey, notebookId, folderName, userMessages }`;
    - `forceNotesTool` e `ChatMessage.agentId`;
    - parser `src/lib/plan.ts`: formato novo com data em negrito e "Dia N" antigo; esperado × feito, atraso em itens e dias, itens/dia necessários; testes de mesa T1–T5, com o plano real dando 3/20, esperado 11 e 8 itens ou 7 dias de atraso em 04/11;
    - `src/lib/planNotes.ts`: plano = tipo com par de datas, mesma regra do "ongoing" do `matchNoteDates`, com o TODOS fora; Capacidade e Livro por alias e no idioma das datas do tipo, acrescentados de forma idempotente só no save, sem migração;
    - planner e coach (contexto, prompt v1 e política de perguntas);
    - gravação centralizada no `App`, com ponte para o Assistant;
    - `SaveAgentNoteModal`, com proteção contra duplicar por mensagem.
  - **Parte B** (B1–B5): tutor, com escopo pela pasta, o nome "Notebook - X" ou o caderno citado na mensagem; perfil pela tag `study profile`, salvável por botão; resumos por propriedade number de capítulo; glossário do caderno; docs finais.
  - Seis pontos para o Coordenador: sem migração de Capacidade, replanejar cria nota nova, perfil por tag, ritmo padrão de 1h/dia, escopo do tutor pela mensagem e sumário indisponível.
- Output: DOCS/reports/04-11-2026/planreport_20261104012816.md

### Orchestrator — decisão — 20261104013346
- Summary: Os pontos abertos pelo plano foram resolvidos pelo Orquestrador, todos de baixo risco e coerentes com o estudo.
- Inputs:
  - DOCS/reports/04-11-2026/planreport_20261104012816.md
- Decision:
  1. **Sem migração** de Capacidade e Livro. Elas entram no primeiro save. Até lá, o coach declara a suposição de 1h/dia.
  2. **Replanejar:** quando a resposta do planner for o replanejamento de um plano existente (o plano estava no contexto), o modal "Save as Plan note" oferece a opção "Archive previous plan", ligada por padrão, e grava `archived_at` no plano antigo. Isso evita que o coach cobre dois planos do mesmo objetivo. É um acréscimo pequeno, dentro do espírito do D14.
  3. **Perfil por tag** `study profile`, com o título como reserva: aceito. É visível e editável pelo usuário.
  4. **Ritmo padrão** de 1h/dia, todos os dias, como suposição declarada: aceito.
  5. **Escopo do tutor** recalculado por mensagem: aceito.
- Next step: codeAgent, parte A

### CodeAgent — implementação inicial (Parte A) — 20261104014554
- Summary: Parte A (A1–A8) implementada conforme o plano e as decisões do Orquestrador (20261104013346):
  - **A1:** `AgentContextInput { todayKey, notebookId, folderName, userMessages }` no `buildContext`; `forceNotesTool` (liga `get_note`/`search_marks` no turno); `ChatMessage.agentId` gravado no placeholder do assistant quando o agente do turno não é o General. O plan-week só lê `todayKey`.
  - **A2:** `src/lib/plan.ts` puro, com as regex, regras, avisos e status do contrato; `extractPlanDraft` com aliases PT/EN. Testes de mesa T1–T5 rodados por script no scratchpad (esbuild + node): 36/36 passaram, incluindo "em 03/11: esperado 10 e 3 feitos".
  - **A3:** `src/lib/planNotes.ts` (tipo de plano = 2+ `date`, fora o TODOS; `planDefs`, `notePlanInfo`, `collectPlans`, `matchBook`, `formatPlanForAi`, `planSaveChanges`). Conferido por script: no tipo `Plan` do PRD (Início, Fim) gera `Capacidade` (number, sort 3) e `Livro` (text, sort 4); a 2ª chamada gera `[]`; sem tipo de plano cria "Plan" com Start, End, Capacity, Book; "Viagem" nunca é alvo da gravação.
  - **A4:** `src/lib/agents/agentData.ts` (`loadPlanData`, livros do Reader com destaque máximo, `bookLine`).
  - **A5/A6:** agentes `planner` (`/planner`, `ListChecks`) e `coach` (`/coach`, `Gauge`), com contexto e prompt v1 do plano; registrados em `CHAT_AGENTS` depois do plan-week.
  - **A7:** `src/lib/agentNotes.ts` (pedido, rascunho, vínculo resposta → nota em `monet:agent-note-by-message`, até 200); `useNoteTypes` expõe `reload`; `handleCreateNoteFromChat` ganha o 6º parâmetro `extra { tags, properties }`; `handleCreateAgentNoteFromChat` no `App` (relê tipos e defs, grava só o que falta, uma escrita por linha, `reload` + `emitTasksChanged`); ramo `create-agent-note` na ponte do Assistant.
  - **A8:** `SaveAgentNoteModal` (estágios already/form/saving/success/error, `requestId` reaproveitado no "Try again", z-index 1100) e o botão "Save as Plan note" (`CalendarPlus`) no chat principal, no Assistant e no chat das Anotações.
  - **Decisão de replanejar:** `PlanDraft.replaces` lê "Replaces: <título>" das premissas; `replacedPlanNote` acha a nota não arquivada cujo título abre esse texto; o modal mostra "Archive previous plan" marcado por padrão, e a main grava `archived_at` no plano antigo depois de criar a nota nova.
  - Verificação: `npx tsc --noEmit` sem erros. A9 (app dev) não executada: fica para o teste manual do Coordenador.
- Files changed:
  - src/lib/agents/chat.ts
  - src/lib/agents/planWeek.ts
  - src/hooks/useChat.ts
  - src/hooks/useNoteTypes.ts
  - src/App.tsx
  - src/lib/assistantNoteBridge.ts
  - src/components/ChatPanel/SaveToNoteModal.tsx (só exports de `loadLastNotebookId`/`saveLastNotebookId`)
  - src/components/ChatPanel/ChatMessageBubble.tsx
  - src/components/ChatPanel/ChatPanel.tsx
  - src/components/AssistantPanel/AssistantPanel.tsx
  - src/components/NotesChat/NotesChatPanel.tsx
  - src/components/NotesChat/NotesChatPanel.module.css (classe nova `.messageActionIcon`)
- Files created:
  - src/lib/plan.ts
  - src/lib/planNotes.ts
  - src/lib/agentNotes.ts
  - src/lib/agents/agentData.ts
  - src/lib/agents/planner.ts
  - src/lib/agents/coach.ts
  - src/components/ChatPanel/SaveAgentNoteModal.tsx
  - src/components/ChatPanel/SaveAgentNoteModal.module.css
- Files removed:
  - nenhum
- Left behind:
  - A9 (roteiro no app dev) não executada.
  - Parte B não iniciada.
  - Diferenças em relação ao plano:
    - `formatPlanForAi` ganhou o 4º parâmetro `todayKey` (para "End passed N days ago");
    - `NotePlanInfo` usa `capacityDefName`/`bookDefName` (null = o tipo não tem a propriedade) no lugar de `hasCapacityDef`/`hasBookDef`, porque o texto da IA cita o nome da propriedade;
    - `PlanDraft.replaces` e `AgentNoteRequest.archiveNoteId` (decisão de replanejar); o prompt do planner pede o título "exatamente como no bloco";
    - "Day N" do formato antigo vira o rótulo `Day N` (em inglês) no texto da IA;
    - data inválida no formato novo (ex.: 31/02) cai como item sem data, sem rótulo;
    - `planSaveChanges` respeita o máximo de 3 propriedades com "show in list" ao criar Start/End;
    - o modal sem cadernos (fora o Calendar) mostra "Create a notebook first" em vez de criar caderno.
  - Limitações: a falha ao arquivar o plano antigo não desfaz a nota nova (aparece no banner de erro das notas); o "Replaces" é casado por título (a janela Assistant só tem resumos de notas, sem tipo).

### CodeAgent — implementação inicial (Parte B) — 20261104015416
- Summary: Parte B (B1–B4) implementada conforme o plano e as decisões do Orquestrador, sobre os ganchos da Parte A:
  - **B1:** `src/lib/studyProfile.ts` puro: `STUDY_PROFILE_TAG`, `isStudyProfileNote` (tag por `tagKey`, título como reserva), `findStudyProfile` (do caderno, não arquivada, a mais recente) e `extractProfileDraft` (cabeçalho "**Study profile — X**" ou "Perfil de estudo/do estudo", ":" dentro ou fora do negrito).
  - **B2:** agente `tutor` (`/tutor`, `GraduationCap`, `forceNotesTool: true`) em `src/lib/agents/tutor.ts`: escopo recalculado a cada mensagem (vínculo da pasta → "Notebook - X" → caderno citado nas mensagens do usuário, palavra inteira, nome 3+ caracteres, o mais longo ganha); contexto com perfil (até 1500 caracteres), resumos por `number` de capítulo, planos do caderno (`collectPlans({ notebookId })`), marcas abertas, glossário do `/define` das notas do caderno, demais notas com tipo e propriedades e os títulos do Reader; prompt v1 do plano. Registrado em `CHAT_AGENTS` depois do coach.
  - **B3:** `AgentNoteRequest`/`AgentNoteDraft` ganham `kind: 'profile'`; `agentNoteDraft` lê o perfil nas respostas do tutor; a main grava nota sem tipo com a tag `study profile` (`handleCreateNoteFromChat(..., null, { tags })`); o validador da ponte do Assistant aceita o `kind`; o `SaveAgentNoteModal` serve aos dois (título, resumo, "already", sucesso e caderno pré-selecionado pelo nome do cabeçalho); botão **Save study profile** (`IdentificationCard`) no chat principal, no Assistant e no chat das Anotações.
  - **B4:** PRD (agentes do Chat, Planner, Coach, Tutor, Save as Plan note, Archive previous plan, Save study profile), seção 9 do estudo (fases 3 e 4 feitas em 2026-11-04, com os desvios das duas partes) e a linha do estudo no `DOCS/docs.menu.md`.
  - Verificação: `npx tsc --noEmit` sem erros. Testes de mesa do perfil por script no scratchpad (esbuild + node): 10/10, incluindo o exemplo da B1 e o casamento do caderno por palavra inteira. B5 (app dev) não executada: fica para o teste manual do Coordenador.
- Files changed:
  - src/lib/agents/chat.ts
  - src/lib/agentNotes.ts
  - src/App.tsx
  - src/lib/assistantNoteBridge.ts
  - src/components/ChatPanel/SaveAgentNoteModal.tsx
  - src/components/ChatPanel/ChatMessageBubble.tsx
  - src/components/NotesChat/NotesChatPanel.tsx
  - src/components/AssistantPanel/AssistantPanel.tsx (só comentário e mensagem de log)
  - DOCS/specs/PRD.md
  - DOCS/features/agents_study.md
  - DOCS/docs.menu.md
- Files created:
  - src/lib/studyProfile.ts
  - src/lib/agents/tutor.ts
- Files removed:
  - nenhum
- Left behind:
  - B5 (roteiro no app dev) não executada.
  - Diferenças em relação ao plano:
    - `resolveTutorNotebook` não recebe os cadernos desligados (não usava); o desligado é tratado no `buildTutorContext`;
    - as marcas saem das notas já carregadas por `loadPlanData` (sem `storage.getMarkedNotes()`, que repetiria a leitura);
    - o corpo do perfil grava cada linha como parágrafo (o editor usa `breaks: false` e juntaria as linhas), com itens de lista seguidos na mesma lista;
    - o título do perfil também é reconhecido com ":" ou travessão sem espaço depois do alias;
    - a lista "Plans in this notebook" deixa de fora os planos sem datas (eles seguem em "Other notes");
    - os títulos de outras notas e o glossário mostram "(N more)" quando cortados por quantidade ou caracteres.
  - Limitação: o caderno citado na mensagem casa só pelo nome inteiro do caderno (sem apelidos); o tutor diz na 1ª linha qual caderno usou.

### Orchestrator — ajuste do teste — 20261104021505
- Summary: No teste, o Coordenador viu o coach repetir em toda resposta a linha técnica "formato antigo 'Dia N' = início + N − 1". Como a mudança é pequena e só de texto, o Orquestrador fez o ajuste diretamente:
  - `plan.ts`: os avisos de datas assumidas agora são genéricos e em linguagem simples, com a data de início do próprio plano (Dia 1 na data de início, um dia corrido por item, fins de semana incluídos) e a saída (refazer com /planner);
  - `planNotes.ts`: o prefixo do primeiro aviso passou de "Rule" para "Assumption";
  - `coach.ts`: datas assumidas e capacidade ausente são explicadas só na primeira resposta da conversa, numa linha, sem fórmula, e não se repetem.
  
  `npx tsc --noEmit` sem erros.
- Inputs:
  - feedback do Coordenador no teste do /coach
- Decision: Pedido do Coordenador: as instruções dos agentes são genéricas, sem dados do usuário. Isso entra como critério do review final.
- Next step: novo teste do Coordenador e, depois, o review final das fases 2–4

### Orchestrator — ajuste do teste (tutor) — 20261104024326
- Summary: No teste, o Coordenador perguntou sobre o Dom Quixote numa nota vazia. O tutor não tinha o que julgar, respondeu como explicador genérico, citou um plano de leitura sem relação com o livro e usou o caderno da pasta, embora a pergunta fosse de outro tema. Como os ajustes são pequenos e todos em `src/lib/agents/tutor.ts`, o Orquestrador os fez diretamente, de forma genérica:
  1. **Escopo:** quando a mensagem deste turno cita outro caderno, ela vence a pasta. A ordem antiga continua para o resto.
  2. **Livro em questão:** um livro do Reader citado na conversa entra no contexto, com a posição (a posição dita pelo usuário vence). Os planos listados ficam só os do livro (propriedade Livro ou título), e o prompt manda citar um plano só quando ele for do tema.
  3. **Pergunta de conteúdo ou nota vazia:** o tutor diz que ainda não há anotação para avaliar, orienta o ponto em que o usuário está sem revelar o que vem depois, deixa de fora detalhes incertos, propõe "What to note" e "Activity", sugere o chat do Reader para o texto exato e não pede o perfil.
  
  `npx tsc --noEmit` sem erros.
- Inputs:
  - feedback do Coordenador (comparação tutor × General sobre o Dom Quixote)
- Decision: Ajuste incorporado. Ele entra no review final das fases 2–4, com o critério de instruções genéricas.
- Next step: novo teste do Coordenador e, depois, o review final

### Orchestrator — ajuste do teste (contexto da nota) — 20261104024949
- Summary: O Coordenador perguntou se o modelo recebe caderno, subject e nota. Verificado: o chat das Anotações enviava o caderno, o título, o conteúdo, a seleção e as tasks, mas não o subject, o tipo nem as propriedades. O chat principal e o Assistant não recebem a nota aberta. O Coordenador pediu para incluir o que falta ("informações importantes sobre o tema trabalhado"). Ajuste genérico feito pelo Orquestrador:
  - `notesContext.ts`: `NoteMetaForAi` (subject, tipo, propriedades, tags) e as linhas "Subject", "Note type", "Properties" e "Tags" no bloco da nota aberta;
  - `NotesChatPanel.tsx`: prop `describeNote`;
  - `App.tsx`: `describeNoteForAi` (subjects efetivos, tipos e `propertiesForAi`);
  - `tutor.ts`: o subject de cada nota nas listas de resumos e de outras notas, lido com `storage.getSubjects`; uma falha não bloqueia.
  
  `npx tsc --noEmit` sem erros. O chat principal e o Assistant continuam sem a nota aberta (fora do pedido).
- Inputs:
  - pergunta e aprovação do Coordenador
- Decision: Incorporado. Entra no review final das fases 2–4.
- Next step: teste do Coordenador e, depois, o review final

### UxAgent — relatório — 20261104030009
- Summary: Relatório de UX das fases 1–4 (sem rodar o app). Veredito: a trilha serve ao usuário, com duas ressalvas estruturais: os agentes de chat herdam todo o contexto do chat (U1), e o contrato do plano só chega ao coach, ao planner e ao tutor (U2). São 19 problemas (U1–U19) e 5 oportunidades (U20–U24). Quatro itens contrariam decisões já tomadas: U12, U13, U22 e U23.
- Inputs:
  - pedido do Coordenador ("antes da revisão envie o uxAgent…")
- Output: `DOCS/reports/04-11-2026/uxreport_20261104030009.md`
- Next step: triagem do Orquestrador

### Orchestrator — triagem do UX Report — 20261104030500
- Summary: O Coordenador autorizou implementar as melhorias pertinentes antes do review. Triagem:
  - **Implementar agora** (alinhadas ao estudo e ao critério de instruções genéricas, sem mudar decisão):
    - U1: política de contexto por agente de chat. Coach, planner e plan-week ficam sem RAG, web e deep research; o tutor mantém o RAG. A nota aberta continua indo a todos, porque o Coordenador pediu os metadados dela;
    - U2: as notas de plano entram na agenda (plan-week, /today, /week-review) pelo `formatPlanForAi`, não pelo corpo cru;
    - U3: rótulo do agente na resposta;
    - U6: a leitura de "plano" exige o nome de tipo de plano ou um checklist no formato do contrato;
    - U7: o tutor cita o caderno só na 1ª resposta e quando o escopo muda; a troca pela mensagem exige o nome entre aspas ou junto de "caderno"/"notebook";
    - U8: exemplos dos prompts trocados por espaços reservados;
    - U9: texto de Settings › Agenda;
    - U14: `X` do Phosphor no modal, e setas no seletor;
    - U15: títulos de seção no idioma do usuário;
    - U16: título do bloco slash com a query.
  - **Adiadas** (não bloqueiam; ficam como próximos passos): U4, U5, U11, U17, U18, U19, U20, U21, U24.
  - **Levar ao Coordenador:**
    - U10, que é nomenclatura;
    - U12, U13, U22 e U23, que contrariam decisões já tomadas.
- Decision: Implementação pelo codeAgent; depois, codereviewAgent nas fases 2–4 com os ajustes.
- Next step: codeAgent

### CodeAgent — melhorias do UX Report — 20261104031336
- Summary: Itens da triagem 20261104030500 (U1, U2, U3, U6, U7, U8, U9, U14, U15, U16) implementados. `npx tsc --noEmit` sem erros.
  - **U1:** `ChatAgentDef.context` (`rag`, `web`, `deepResearch`; true = segue o toggle/pasta). General: tudo true (conversa sem agente igual a antes). Coach, planner e plan-week: tudo false. Tutor: RAG e web (toggle), sem deep research. Em `useChat.ts`, `targetConvFolderId` e `turnAgent` passaram para antes da busca web; `useDeepResearch`/`useWebSearch` substituem o toggle na busca pré-turno e nas tools `deep_research`/`web_search`; `ragScope` fica null sem `context.rag` (sem RAG automático, sem `search_knowledge_base` e sem "Sources" do RAG). A nota aberta do chat das Anotações continua indo a todos.
  - **U2:** `agendaPlanSummaries` (`planNotes.ts`) monta o `formatPlanForAi` de cada nota de plano entre as notas datadas da agenda; `formatAgendaContext` (`agenda.ts`) recebe o mapa e troca o corpo cru pelo resumo. Sem ciclo: a agenda não importa `planNotes` (que já importa a agenda); quem chama (plan-week e o slash em `App.tsx`) passa o mapa. Os livros do Reader vêm de `loadReaderBooks` (agora exportado de `agentData.ts`). Prompts: plan-week (o resumo "[Plan …]" com os números do app; o plano ocupa a Capacity, 1 h se vazia, em cada dia planejado até o End, como um bullet com o item do dia), `/today` (o item do dia vem do resumo) e `/week-review` (Slipped pelos números do resumo). Nenhum pede para contar dias.
  - **U3:** `agentLabelIds` e `AgentReplyLabel` em `ChatMessageBubble.tsx` (ícone Phosphor + nome, CSS `.agentLabel`): o rótulo aparece quando o `agentId` da resposta existe e difere do da resposta anterior do assistant. Usado no chat principal, no Assistant e no `NotesChatBubble` do chat das Anotações.
  - **U6:** `collectPlans` recebe `types` e só conta a nota quando o tipo tem nome de plano (`isPlanTypeName`, por `PLAN_TYPE_NAMES`) ou o checklist tem ao menos um item do contrato (data dd/mm em negrito ou "Dia N"/"Day N": `rule !== 'none'`). A regra das 2 datas e a exclusão do TODOS ficam em `isPlanType`. A lista "Plan note types" do planner passou a mostrar só os tipos com nome de plano (os que o "Save as Plan note" usa); o texto do coach sobre o que é plano foi ajustado.
  - **U7:** o caderno da mensagem deste turno só vence a pasta quando vem entre aspas (retas, curvas ou angulares) ou junto de "caderno"/"caderno de/do/da"/"notebook" (`explicitNotebookIn`); citação casual segue a ordem antiga (pasta → "Notebook - X" → mensagens, da mais nova). O app recalcula o escopo da mensagem anterior: se mudou, o contexto pede para dizer o novo caderno na 1ª linha; senão, só na 1ª resposta da conversa (padrão do coach: "check your earlier replies").
  - **U8:** espaços reservados em `coach.ts` ("behind N items (D days)", "<item>"), `planner.ts` ("<dd/mm of that day>", "until <dd/mm>", "<N>h a day", "Ch. <n> (p. <first>–<last>)"), `planWeek.ts` ("<Wkd dd/mm> · ~Nh", "focus on <task>", "<N>h on <weekday>"; o "default 6h/day" vem de `DEFAULT_WORK_HOURS_PER_DAY`), `today.ts` (sem "In Waiting") e `critique.ts` ("a summary note with a chapter number"). Grep nos prompts de `src/lib/agents/`: o que sobrou são regras do app (1 h/dia padrão do plano, 60 itens, "Day 1" como rótulo, "Perfil de estudo" como alias) e exemplos genéricos do `/define`.
  - **U9:** rótulo "Hours available for tasks on a work day (leave out meetings)" e a linha "Study plans have their own pace (the Capacity property of each plan)." em Settings › Agenda.
  - **U14:** `X` do Phosphor no fechar do `SaveAgentNoteModal`. `AgentPicker`: foco no agente atual ao abrir, ↑/↓ (circulares), Home/End, roving `tabIndex` e Escape devolve o foco ao botão.
  - **U15:** coach e tutor pedem os títulos de seção no idioma do usuário (não há núcleo comum aos prompts dos agentes de chat).
  - **U16:** `getToggleTitle(command, query?)` e `getAiBlockTitle(command, query?)` dão "<rótulo> · <query>" com a query cortada em 40 caracteres e reticências. A query fica em `AiResponse.query` (tabela de respostas); passada no `EmbedBlockView`, no export (`App.tsx`), no bloco de IA da nota que vai ao slash (`App.tsx`) e no texto para a IA (`noteFileText.ts`).
  - Verificação: `npx tsc --noEmit` sem erros. Testes de mesa no scratchpad (esbuild + node): U6 (tipo com nome de plano sem checklist, tipo "Viagem" com checklist de mala fora, com itens datados ou "Dia N" dentro) e o resumo da agenda; U7 (7 casos: menção casual não troca; "caderno X", "caderno de X", aspas retas e curvas, "X notebook" trocam). App não rodado.
- Files changed:
  - src/lib/agents/chat.ts
  - src/lib/agents/coach.ts
  - src/lib/agents/planner.ts
  - src/lib/agents/planWeek.ts
  - src/lib/agents/tutor.ts
  - src/lib/agents/today.ts
  - src/lib/agents/weekReview.ts
  - src/lib/agents/critique.ts
  - src/lib/agents/agentData.ts
  - src/lib/planNotes.ts
  - src/lib/agenda.ts
  - src/lib/noteFileText.ts
  - src/hooks/useChat.ts
  - src/App.tsx
  - src/components/ChatPanel/ChatMessageBubble.tsx
  - src/components/ChatPanel/ChatMessageBubble.module.css
  - src/components/ChatPanel/ChatPanel.tsx
  - src/components/AssistantPanel/AssistantPanel.tsx
  - src/components/NotesChat/NotesChatPanel.tsx
  - src/components/ChatPanel/AgentPicker.tsx
  - src/components/ChatPanel/SaveAgentNoteModal.tsx
  - src/components/Settings/SettingsModal.tsx
  - src/components/Editor/commandParser.ts
  - src/components/Editor/EmbedBlockView.tsx
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - O "›" do `EmbedBlockView.tsx` é anterior à trilha (commit 421afae, 2026-05-15) e não foi trocado.
  - U2: planos vencidos (End passado com itens abertos) continuam fora da agenda do plan-week e do `/today`, porque `selectAgenda` só pega datas no período ou planos em andamento; o coach os vê. O resumo mostra até 3 itens em "Next", então os últimos dias de uma semana podem sair só com o título do plano.
  - U3: o `agentId` da resposta continua gravado depois da busca web do turno (só o tutor ainda busca), então o rótulo do tutor com web aparece quando a busca termina. Sem ícone na sidebar (fora do pedido).
  - U6: basta um item no formato do contrato para um tipo sem nome de plano contar (um roteiro de viagem com "Dia 1" conta).
  - Sem aviso de UI para toggle ignorado pelo agente (fora do pedido).

### CodeReviewAgent — 20261104032127
- Summary: Review único das fases 2–4, dos ajustes pós-teste e das melhorias do UX Report, sobre todo o diff não commitado da `feat/mincer`.
  - Verificado:
    - `npx tsc --noEmit` sem erros;
    - nenhum ciclo de imports de runtime em `src/`, por script;
    - nenhum BEGIN/COMMIT;
    - ícones Phosphor;
    - prompts genéricos;
    - a conversa General sem regressão.
  - Sem críticos.
  - Cinco importantes:
    - I1: `/today` em dia passado ou futuro recebe o item do plano do dia real;
    - I2: o rascunho aceita End antes de Start, e a data sem ano mais de ~6 meses à frente cai no passado;
    - I3: o parser do formato novo é rígido (dia da semana antes da data, ISO, sem negrito, "Dias N–M");
    - I4: "Archive previous plan" casa qualquer nota pelo título e vem ligado;
    - I5: o tutor com escopo vindo da mensagem segue com o RAG da pasta.
  - Doze nits, entre eles o glifo "→" no modal, dados reais em comentários e a documentação defasada depois do U1/U6.
- Verdict: APROVADO COM RESSALVAS
- Output: DOCS/reports/04-11-2026/reviewreport_20261104032127.md

### CodeAgent — correções do review — 20261104033520
- Summary: Passada final sobre o `reviewreport_20261104032127.md`: I1–I5, N1, N2, N4, N5, N7, N8, N11 e N12 corrigidos; dos opcionais, N3, N9 e N10 (parte do slash e do plan-week) feitos, N6 como limitação. `npx tsc --noEmit` sem erros. Testes de mesa (esbuild + node, scratchpad): 48 casos, todos ok.
  - **I1** (`/today` fora de hoje): `AgendaWindow.planDays` (`core.ts`); o `/today` passa o dia da nota (`today.ts`) e `agendaPlanSummaries` acrescenta ao resumo "Items dated <dia>: …" com os itens do plano nesse dia, feitos e abertos (`planNotes.ts`). Os números do progresso seguem no dia real; o `/week-review` não muda. Prompt do `/today` aponta para essa linha. `App.tsx` passa o `planDays` da janela.
  - **I2** (datas sem ano): `extractPlanDraft` resolve o Start sem ano na janela [hoje − 7, +364] e o End sem ano a partir do Start; `PlanDraft.issue = 'endBeforeStart'` quando End < Start. Prompt do planner: "keep the bold and the dates exactly in the format above (dd/mm/yyyy for Start and End, dd/mm at the start of each item)".
  - **I3** (parser rígido): `NEW_ITEM_RE` aceita o dia da semana PT/EN antes da data (curto, com ponto/vírgula ou por extenso) e a data ISO; `PLAIN_ITEM_RE` lê a data sem negrito seguida de separador (·, :, —, -, |); `OLD_ITEM_RE` aceita `(…)` depois do número e "Dias N–M"/"Days N to M" (datado no 1º dia, rótulo "Days N–M"). `extractPlanDraft` só devolve null sem checklist; checklist sem item datado vira `issue = 'noDates'`. `agentNoteDraft` mostra o botão também com `issue`, e o modal explica o motivo (sem salvar). O resumo do modal mostra "N items (M without a date)" no plano parcial.
  - **I4** (arquivamento): `replacedPlanNote` recebe só notas de plano (`PlanEntry` de `collectPlans`, lidas do storage por `loadPlanEntries` ao abrir o modal, nas três superfícies, fora os cadernos com a IA desligada) e casa título exato (o mais recente) ou, sem ele, o único plano ativo/vencido cujo Livro casa com o Book do rascunho (`matchBook`) ou aparece no texto de "Replaces:" (chave com 6+ caracteres). Sem prefixo solto. Enquanto carrega, o checkbox não aparece.
  - **I5** (RAG do tutor): `buildContext` devolve `AgentContext { text, ragNotebookId? }` (`chat.ts`; coach, planner e plan-week devolvem só `text`). O tutor devolve o caderno quando o escopo vem da mensagem (outro caderno que o da pasta, ou chat sem pasta), ou null se a IA dele está desligada. Em `useChat.ts`, o `ragScope` passa a ser esse caderno (como o slash `/docs`, `includeAiFolders: true`), e o contexto do agente com RAG ganha "Knowledge base search: available | not available" (tools suportadas e escopo). O prompt do tutor cita `search_knowledge_base` só quando o bloco diz "available". O General não muda (sem `buildContext`).
  - **N1:** "Start … to End …" no modal. **N2:** espaços reservados nos comentários de `agentData.ts` e `planNotes.ts`. **N3:** `PAGES_RE` sobre `label + text`.
  - **N4:** `notePlanInfo` lê Início e Fim das defs com nome de início/fim; sem nome, menor e maior data. `collectPlans`: sem End = `undated`; só com End, o plano é cobrado (ativo/vencido). Coach: "start not set" na lista sem checklist.
  - **N5:** `planLine` do tutor: "behind (N days late)" sem número de itens quando o diff não é negativo.
  - **N7:** `PLAN_TYPE_NAMES` só com nomes inequívocos (plan, plans, plano, planos, study plan, plano de estudo(s), plano de leitura, reading plan). "Schedule", "Cronograma", "Planejamento" e "Planning" saíram: contam como plano só pelo checklist do contrato e nunca são alvo do "Save as Plan note".
  - **N8:** "Try again" sem duplicar: o modal já repetia o `requestId`; agora o chat principal e o das Anotações o repassam, a ponte do Assistant o entrega ao handler, e `handleCreateAgentNoteFromChat` guarda `requestId → nota` até as propriedades gravarem (a nota é criada com o tipo; as propriedades e o arquivamento são refeitos).
  - **N9:** o plan-week passa os dias a planejar como `planDays`: o resumo de cada plano traz os itens desses dias ("Items dated …"), e o prompt usa essa linha para o item do dia.
  - **N10:** no slash da agenda e no plan-week, `loadReaderBooks` só roda se alguma nota datada tem tipo com par de datas (`isPlanType`).
  - **N11:** texto do padrão em Settings montado de `DEFAULT_WORK_HOURS_PER_DAY` e `DEFAULT_WORK_DAYS` ("6 h, Mon, Tue, Wed, Thu, Fri").
  - **N12:** PRD (política de contexto U1, rótulo U3, resumo dos planos U2, definição de plano U6/N7, escopo do tutor U7/I5, título `<rótulo> · <query>` U16, formatos aceitos e motivos do modal) e seção 9 do estudo (subitem "Melhorias do UX Report e correções do review"; a definição de plano da fase 3 aponta para o U6).
  - Testes de mesa (`scratchpad/review_fix/test.ts`): 24 variações de item (dia da semana antes, por extenso, ISO, sem negrito, escapado, "Dia N (seg)", "Dias 2–3", "Days 4 to 5", "Day 1 to read", data inválida, virada de ano), N3, I2 (End 30/06 → 2027, Start ~6 meses à frente, Start 3 dias atrás, End < Start com ano), I3 (`noDates`, parcial, resposta sem checklist), extração PT, N4 (3ª data, só End), N7 (Schedule sem/com checklist, alvo do save), I1/N9 (dia passado com item feito, dia futuro além do Next, intervalo do plan-week, sem `planDays`) e I4 (título exato, nota que não é plano, paráfrase pelo livro do rascunho e pelo citado, prefixo solto, `exceptId`). App não rodado.
- Files changed:
  - src/lib/plan.ts
  - src/lib/planNotes.ts
  - src/lib/agentNotes.ts
  - src/lib/assistantNoteBridge.ts
  - src/lib/agents/core.ts
  - src/lib/agents/today.ts
  - src/lib/agents/chat.ts
  - src/lib/agents/coach.ts
  - src/lib/agents/planner.ts
  - src/lib/agents/planWeek.ts
  - src/lib/agents/tutor.ts
  - src/lib/agents/agentData.ts
  - src/hooks/useChat.ts
  - src/App.tsx
  - src/components/ChatPanel/SaveAgentNoteModal.tsx
  - src/components/ChatPanel/ChatPanel.tsx
  - src/components/NotesChat/NotesChatPanel.tsx
  - src/components/Settings/SettingsModal.tsx
  - DOCS/specs/PRD.md
  - DOCS/features/agents_study.md
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind:
  - **N6** (livro "em questão" do tutor preso a mensagem antiga; casamento só pelo título inteiro): não corrigido. Limitar às últimas mensagens perde o livro em sequências de perguntas de acompanhamento, e o casamento parcial por prefixo do título confunde frases comuns ("o senhor…"). Fica para a fase de qualidade.
  - **N10** em parte: coach, planner e tutor continuam lendo todas as notas e um `getHighlights` por livro a cada mensagem; a query agregada de destaques exige mudar o storage (fora do escopo).
  - I3: a data sem negrito aceita qualquer `d/m` seguido de separador ("1/2 — ler metade" vira 01/02); o dia da semana antes da data só em PT/EN.
  - I4: o casamento pelo livro exige um único plano ativo ou vencido daquele livro; com dois, o checkbox não aparece. O modal lê todas as notas do storage ao abrir quando há "Replaces:".
  - I5: com o escopo do tutor vindo do nome "Notebook - X" (pasta sem vínculo), o RAG segue o da pasta, como antes.
  - N7: com dois tipos de nome inequívoco (ex.: "Plan" e "Reading plan"), o save usa o 1º por ordem, como antes.

### Orchestrator — fechamento — 20261104035000
- Summary: Trilha das fases 2–4 fechada no código.
  - Implementadas as melhorias do UX Report escolhidas na triagem.
  - Review aprovado com ressalvas, e a passada final corrigiu I1–I5 e a maior parte dos nits.
  - `npx tsc --noEmit` sem erros (conferido pelo Orquestrador); 48 testes de mesa do parser ok.
  - Nada commitado; o app não foi rodado depois das últimas mudanças.
- Pendências:
  - **Teste do Coordenador no app:**
    - política de contexto dos agentes (sem "Sources" no coach);
    - rótulo do agente na resposta;
    - `/today` em nota de outro dia;
    - "Save as Plan note" com datas em formatos variados e o aviso quando faltam datas;
    - arquivamento só de planos;
    - tutor com o caderno citado entre aspas;
    - título do bloco slash com a query.
  - **Decisões do Coordenador:**
    - U10 (nomes "Plan week" × "Planner");
    - U12 (atualizar o plano no replanejamento), que contraria uma decisão já tomada;
    - U13 (gravar o plano da semana), que contraria uma decisão já tomada;
    - U22 (coach cobrar TODOS), que contraria uma decisão já tomada;
    - U23 (persistir o sumário do Reader), que contraria uma decisão já tomada.
  - **Adiados:**
    - itens do UX Report: U4, U5, U11, U17–U21 e U24;
    - limitações: N6, o resto de N10 e as de I3, I4, I5 e N7 registradas na sessão anterior.
  - **Antes da release:** backup do banco de PRD (a migração `dedupe_daily_notes_v1` roda nele).
  - **Fase seguinte:** qualidade das respostas (harness de prompts).
- Decision: Aguardando o teste do Coordenador e o pedido de commit.
