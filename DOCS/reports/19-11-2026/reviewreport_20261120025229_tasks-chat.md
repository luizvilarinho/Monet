# Code Review — Fase B, Fatia 4 (Tasks) e Fatia 5 (Chat principal)

- Task Report: `DOCS/reports/19-11-2026/taskreport_20261119214343.md`
- Execution Report: `DOCS/reports/19-11-2026/executionreport_20261119214343.md` (sessões "Fase B, Fatia 4 — Tasks" e "Fase B, Fatia 5 — Chat principal")
- Triagem: `DOCS/reports/19-11-2026/uxtriage_20261119224845.md`
- Escopo: os arquivos listados nas duas sessões, mais as chamadas que saem deles (`agenda.ts`, `CalendarView`, `DueTodayBlock`, `Library.handleDelete`, `NotesChatPanel` no IA-03, `ConfirmModal`, o comando de stream no `lib.rs`). A Fase A e as outras fatias ficaram fora.
- Verificação: `npx tsc --noEmit` sem erros. `npx vitest run src/lib/tasks.test.ts src/lib/taskQuickAdd.test.ts src/lib/openrouter.test.ts`: 3 arquivos e 41 testes passaram. O app não foi aberto.

## Veredito

**APROVADO COM RESSALVAS.** Nada bloqueia. Há dois pontos importantes: o Retry do chat pode perder a pergunta e os anexos, e o Undo das ações em lote nas Tasks fica escondido enquanto a seleção existe. O resto são ajustes menores.

---

## Importante

### 1. Retry perde a pergunta e os anexos quando o `send()` sai cedo
- **Onde:** `src/hooks/useChat.ts:4736-4776` (`takeTurnForRetry`), `src/components/ChatPanel/ChatPanel.tsx:282-291` (`handleRetry`). As saídas cedo do `send()` estão em `src/hooks/useChat.ts:3285`, `:3287`, `:3447` e `:3462`.
- **Cenário:** `takeTurnForRetry` tira a pergunta e a resposta da conversa (ref e estado) e apaga os arquivos dos documentos (`delete_chat_doc`, `:4759`). Só depois o `handleSend` chama o `send()`. O `send()` ainda pode sair antes de inserir a mensagem:
  - sem modelo;
  - sem a chave do OpenRouter;
  - com web search ou deep research efetivos e sem a chave do Tavily;
  - com texto vazio e sem imagens, o que acontece quando a pergunta só tinha imagens e o app foi reaberto (as imagens não são gravadas).

  Nesses casos a pergunta some da conversa e os anexos somem do disco. A faixa mostra o motivo, mas não há como recuperar.

  Exemplos reais:
  - um 401 seguido de "Open Settings", em que o usuário apaga a chave ruim e clica Retry antes de colar a nova;
  - um turno que falhou por rede, depois o usuário liga Web Search sem chave do Tavily e clica Retry.

  O Retry não passa pela trava do composer (#17), então o "não consumir o rascunho" não vale aqui.
- **Correção sugerida:** fazer as mesmas checagens antes de tirar o turno. Pode ser uma função `canSendNow()` no `useChat` (modelo, chave do OpenRouter e, com web efetiva, chave do Tavily) chamada no início do `takeTurnForRetry`, que devolve `null` com a faixa. Outra opção: o `send()` devolve se aceitou o turno, e o `takeTurnForRetry` só apaga a pergunta e os arquivos depois do aceite (ou os devolve na recusa). Com a pergunta sem texto e sem imagens, não oferecer o Retry.

### 2. Undo das ações em lote fica escondido pela barra de lote
- **Onde:** `src/components/TasksView/TaskBatchBar.tsx:17-18`; `src/components/TasksView/useTaskKeyboard.ts:86`, `:118` e `:136` (`apply`, `schedule` e `snooze` não limpam a seleção).
- **Cenário:** com 2 ou mais tasks selecionadas, o `TaskUndoBar` só é renderizado quando `count < 2`. Depois de "Today", "Tomorrow", "Next week", "Pick date…", `s`, `t`, `z` ou `p` no lote, as tasks continuam visíveis em outro grupo ou coluna e a seleção continua com 2 ou mais. A barra de lote fica, o Undo não aparece, e o timer de 6 s expira sem o usuário vê-lo.

  Só "Done" e "Drop" na List costumam funcionar, porque as tasks vão para a seção recolhida e saem da seleção visível. O Execution Report diz que há Undo nas ações do lote (U5), e na prática ele quase nunca aparece.
- **Correção sugerida:** limpar a seleção depois de uma ação em lote que passa por `actions.update`/`actions.reschedule`. Outra opção: mostrar a mensagem e o botão Undo dentro da própria barra de lote quando `actions.undoMessage` existir.

---

## Menor

### 3. Mensagens de erro antigas (prefixo "Error:") não foram migradas
- **Onde:** `src/components/ChatPanel/ChatMessageBubble.tsx:98`. Não há migração em `parseConversations`/`loadConversations` (`src/hooks/useChat.ts:556-600`).
- **Cenário:** o balão agora detecta o erro só pela flag `failed`. Respostas gravadas antes da mudança com `content = "Error: …"` e sem a flag passam a aparecer como uma resposta normal: markdown, "Save to note", Copy e o rodapé de fontes. Também perdem o Retry quando são a última mensagem. Só a exibição muda, porque o histórico enviado ao modelo é o mesmo de antes.
- **Correção sugerida:** no `parseConversations`, marcar como `failed: 'retry'` a mensagem de assistant que começa com `"Error: "` e não tem `failed`. Na leitura isso é idempotente, e o próximo save grava a flag.

### 4. Retry aparece numa resposta que ainda está em streaming em outra janela
- **Onde:** `src/components/ChatPanel/ChatPanel.tsx:293` (`retryableId` olha só o `isStreaming` desta instância) e `src/components/ChatPanel/ChatMessageBubble.tsx:97`.
- **Cenário:** a janela do Assistant responde numa conversa da pasta Assistant, e o usuário abre essa conversa no Chat principal. O balão vazio aparece como "No response (interrupted)", o que já está registrado em "Left behind". Além disso, o balão ganha Retry.

  Clicar em Retry apaga o par e reenvia pela janela principal enquanto a outra ainda escreve na mesma chave (`CONVERSATIONS_KEY`, last-write-wins). O resultado pode ser um turno duplicado ou a resposta da outra janela sobrescrita.
- **Correção sugerida:** no balão vazio, só oferecer Retry quando a mensagem é mais velha que o timeout do stream (o `timestamp` da mensagem já existe). Outra opção: só oferecer quando o vazio veio de um corte conhecido por esta janela, como `cutMessageIds` ou uma marca gravada no corte.

### 5. Waiting e os status custom saíram também da agenda da IA e do bloco "this week"
- **Onde:** `src/lib/agenda.ts:176` e `src/lib/tasks.ts:992`, que usam o `isInProgress`, agora só `doing`.
- **Cenário:** U20 tirou Waiting de "In progress". Como efeito colateral, uma task Waiting sem data não entra mais nas "Open and overdue tasks" da agenda (/week, /planner, /today) nem no bloco de tasks "this week" das notas. Antes ela entrava pelo `isInProgress`. O "Left behind" cita a mudança no `agenda.ts`, mas não esse efeito, e a triagem não pediu.
- **Correção sugerida:** decisão do Coordenador. Se a agenda e o bloco devem continuar mostrando o que está aberto e parado, usar ali `isOpen(t) && t.status !== 'todo'` no lugar do `isInProgress`.

### 6. Calendar não segue a regra do My Day
- **Onde:** `src/components/CalendarView/CalendarView.tsx:227` (bloco Overdue) e o `dayTasks`, via `taskSpan`.
- **Cenário:** com U4, a task no My Day de hoje vai para Today na List, para a coluna de hoje no Week e para o "Due today", mesmo atrasada. No Calendar ela continua no bloco Overdue, ou no dia do plano. A triagem só pediu List, Week e Due today, então isso não é regressão, mas a regra ficou diferente entre as visões.
- **Correção sugerida:** tirar do `overdueTasks` do Calendar as que têm `plannedDay === todayKey` e incluí-las nas tasks de hoje. Outra opção: registrar no backlog como coerência pendente.

### 7. "Due today" mostra riscada uma task replanejada que foi concluída hoje
- **Onde:** `src/components/TasksView/DueTodayBlock.tsx:27-33` (`wasLate`).
- **Cenário:** uma task com deadline vencido e do date amanhã não está na lista de hoje, porque já foi replanejada. Se for concluída hoje, ela aparece riscada no bloco de hoje, porque `wasLate` olha `dueDate < today` sem considerar o replanejamento.
- **Correção sugerida:** em `wasLate`, usar a mesma regra do `isOverdue`. Ou seja, com deadline vencido, só contar quando `scheduledDate` é nulo ou anterior a hoje.

### 8. Aviso do Tavily só é rechecado no foco da caixa
- **Onde:** `src/components/ChatPanel/ChatComposer.tsx:129-140` e `:438`.
- **Cenário:** o usuário clica em "Open Settings", cola a chave do Tavily e fecha o Settings. O aviso e o Send desabilitado continuam até ele clicar na caixa de texto, porque clicar no Send não foca a caixa.
- **Correção sugerida:** rechecar também no `focus` da janela ou quando o Settings fecha. Outra opção: rechecar ao passar o mouse ou clicar no Send desabilitado.

### 9. Retry depois de reabrir o app reenvia sem as imagens, sem avisar
- **Onde:** `src/hooks/useChat.ts:4776` (`images: question.imageDataUrls ?? []`).
- **Cenário:** as imagens só ficam em memória. Depois de reabrir o app, o Retry de uma pergunta que tinha imagens manda só o texto, e o modelo responde sem elas.
- **Correção sugerida:** quando a pergunta original tinha imagens e elas não estão mais em memória, avisar ou não oferecer o Retry. Isso pede um indicador gravado na mensagem, por exemplo `imageCount`.

### 10. Ajustes pequenos (nit)
- `src/lib/openrouter.ts:171-174`: sem código, o fallback `/\b([45]\d\d)\b/` transforma qualquer número 4xx/5xx solto num erro HTTP, por exemplo "max 500 tokens" vira "OpenRouter is having trouble". **Correção:** usar só o padrão `OpenRouter responded NNN`.
- `src/hooks/useChat.ts:4441`: no caminho das tools, a falha de uma só fonte do `search_knowledge_base` liga `kbSearchFailed`, e o aviso diz "answered without them" mesmo quando as outras fontes trouxeram trechos. **Correção:** ligar a flag só se todas as buscas do turno falharam.
- `src/hooks/useChat.ts:3512`: o `turnAbortRef` não é limpo no fim normal do turno e fica com o controller velho, o que hoje é inofensivo. Ele também só nasce depois dos primeiros awaits (`hasOpenRouterKey`, `hasTavilyKey`, gravação dos documentos, leitura do histórico). Se o hook desmontar nessa janela, a web search e o RAG ainda rodam (chamadas pagas) até a checagem do `unmountedRef`. **Correção:** criar o controller no início do `send()` e limpar o ref no done, no error e no `failOnAssistant`.
- `src/components/TasksView/TaskModalEditor.tsx`: o título da task sem nota-corpo usa `defaultValue`, que não acompanha uma renomeação feita por fora com o modal aberto. É menor; trocar para controlado se incomodar.

---

## Conferido e sem achado

**Tasks:**
- **Regra de atraso:** `overdueKind` é a cor e `isOverdue` é o grupo e a coluna. Ficaram coerentes entre `taskBucket`, `taskSpan`, os chips de resumo e as visões: List com Overdue e Slipped, Week com `columnOf`, TodayBoard, DueTodayBlock, Calendar com período e bloco Overdue, e o bloco de tasks das notas. O progresso dos cadernos e a tool do chat seguem com `overdueKind !== null`, como registrado.
- **`applyTaskPatch`:** os campos explícitos do Undo (`rescheduleCount`, `completedAt`, `doingSince`) prevalecem sobre as regras de contagem e de status. O `undoPatch` restaura o `recurrenceNextId`.
- **Recorrência:**
  - `onOccurrenceCreated` só roda depois do save bem-sucedido. `copyBodyNoteRef` não copia corpo vazio. `uncheckChecklist` preserva as linhas `<task-ref`, e cópias não sincronizam, por design.
  - O Undo apaga a ocorrência e a nota-corpo dela pelo `deleteProjectTasks`, sem confirmação. A corrida entre a cópia e o Undo já está registrada (ms).
- **Drag no Week:**
  - soltar na mesma coluna não faz nada;
  - "Deadline passed" usa o `useConfirm().choose` da `useTaskActions`, e o modal é renderizado pela `TaskBatchBar` em todos os boards e pelo Review;
  - o Undo de "Move to project" move de volta pelo `relocateTask`, com a nota-corpo junto.
- **Quick-add:**
  - a sequência final de tokens funciona como esperado: abreviações ambíguas e `dd/mm` só no fim, com ponto ou com `!`;
  - o Enter no chip só confirma o chip;
  - o Enter no campo "New notebook name" cria, que é o contrato existente do `ProjectPicker`.
- **Atalho `?`:** o handler global (`App.tsx`, `handleHelpKey`) fica em bolha no `document` e ignora `defaultPrevented`. O React trata o evento na raiz antes, e o `stopPropagation` + `preventDefault` não deixam os dois abrirem juntos. O `TaskShortcuts` é `aria-modal` e fecha no Esc em captura.
- **Outros:**
  - os timers e listeners novos são limpos (`useTaskActions`, "Added", o evento de atalhos, `TaskShortcuts`);
  - o `useTaskViews` desfaz a mudança otimista e mostra o erro;
  - o `saveWeeklyReview` devolve `false` sem perder a reflexão.

**Chat:**
- **Stop:**
  - o `signal` chega ao `fetch` do Tavily e às etapas do `runDeepResearch`;
  - os setters de status ficam guardados pelo sinal ou por `isActive()`;
  - o Stop antes do stream encerra o turno na hora;
  - o comando de stream no Rust devolve `Ok` logo depois do spawn, então o cancel não rejeita o invoke e a marca "Stopped" não é trocada por "Interrupted".
- **`markTurnFailed`:** é idempotente para o evento de erro mais a rejeição do invoke (INVALID_MODEL e KEY_MISSING emitem os dois).
- **Undo do delete:**
  - volta à pasta (ou solta, se a pasta sumiu), à posição e à seleção;
  - os anexos e os vínculos só saem no fim do prazo, num novo delete ou ao desmontar;
  - entre janelas converge: o `CLEARED_KEY` remove na outra janela, e a lista restaurada chega pelo evento de `CONVERSATIONS_KEY`/`FOLDERS_KEY`.
- **Modais de pasta:** o "Discard changes" funciona no Escape, no clique fora, no X e no Cancel. O `ConfirmModal` trata o Esc em captura com `stopPropagation`, então o modal pai não fecha junto.
- **`writeChatKey`:** o cache só é atualizado depois do `setItem`, o que está correto para o estouro de cota.
- **Exportações novas:**
  - `countChatFolderConversations`/`countReaderBookChatConversations` só leem e não migram, e a Library usa a segunda;
  - `openConversationWithExchange` encadeia com o `ensureScopedFolder` pela fila de `setFolders`.
- **Arquivos dos documentos:** são gravados com nome `nanoid`, então o delete do Retry não apaga o arquivo regravado.
- **Ícones e rótulos:** os ícones são Phosphor e os rótulos estão em inglês, em caixa de frase.

## Divergência entre a triagem e a execução
- U5: o Undo no lote existe no código, mas fica invisível na maioria dos casos (ver o achado 2).
- #17: o rascunho não é consumido no Send do composer, mas o Retry contorna a trava (ver o achado 1).
- O resto bate com a triagem e com o "Left behind" das duas sessões.

## Bugs extras
Nenhum fora do recorte.
