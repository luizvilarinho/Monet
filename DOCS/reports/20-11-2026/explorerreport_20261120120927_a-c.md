# Explorer Report — Fases A, B e C (Trackers, Log por tipo, constância nos agentes)

Task: `DOCS/reports/20-11-2026/taskreport_20261120115512.md` · Branch `feat/radar-trackers` · Só leitura.

## Problema
O app precisa contar a constância de hábitos por semana e por mês (trackers com marca por dia), somar e acompanhar a prática registrada em notas de um tipo (visão Log), e levar esses números calculados pelo app ao Coach, ao Plan week, ao `/week-review` e a uma tool só leitura no Chat. Quase tudo encaixa em padrões que já existem: tabelas criadas pelo storage, evento entre janelas, board por tipo, resumo de planos e tool "Tasks". Nada exige Rust novo.

## Dificuldade
- **Fase A (Trackers no Calendar):** Média-Alta. Há tabelas novas, um hook com sincronização entre janelas, a faixa no Calendar (coluna de 220 px), os pontos na grade, os chips na nota do dia (main e keep) e o modal de gestão.
- **Fase B (Log por tipo):** Média. A config segue o padrão do Board, a visão é nova e há cerca de 6 pontos de contato no `App.tsx`.
- **Fase C (agentes):** Média. São três montadores de contexto, mudanças de prompt (Coach e Plan week têm regras que conflitam, ver §8) e uma tool nova no padrão da `query_tasks`.
- **Geral:** Alta, pelo número de superfícies, não por uma barreira técnica.

---

## 1. Schema e persistência

**Como uma tabela nasce hoje.** Não é por migration.
- As migrations do tauri-plugin-sql vão da v1 à v18 (`src-tauri/src/lib.rs:1402-1756`) e são registradas em `lib.rs:1906`.
- O comentário em `lib.rs:1753-1755` diz que as migrations **não rodam no DB de produção** (checksum mismatch da v11 antiga; ver também `documents.rs:354-369`).
- Toda tabela posterior é criada pelo storage do frontend, de forma idempotente:
  - `ensureTasksTables` (`src/storage/tauri.ts:1140-1168`), com o SQL em `tauri.ts:501-540`;
  - `ensureNoteTypesTable` (`tauri.ts:1186-1215`);
  - `ensureTodosMigrationTable` (`tauri.ts:1290-1299`), o exemplo mais simples;
  - `ensureDataMigrationsTable` (`tauri.ts:873-883`).

**O padrão a seguir (Tauri).**
- Um `ensureTrackersTables(db)` memoizado (campo `private trackersTablesReady: Promise<void> | null`), dentro de `this.serialDdl(...)` (`tauri.ts:697-701`), que zera a memo se rejeitar (igual às linhas 1162-1166).
- Ele é chamado no início de **todo** método de leitura e escrita das tabelas novas.
- Um `CREATE TABLE IF NOT EXISTS` por `execute`, sem `BEGIN`/`COMMIT`.
- O mesmo código cobre banco antigo e banco novo, porque não depende do estado das migrations.
- Colunas futuras entram por `addMissingColumns` (`tauri.ts:592-607`): PRAGMA `table_info` e depois `ALTER`, com "duplicate column" contando como sucesso.
- **Não criar migration v19.**

**Schema sugerido** (tabelas só do frontend; o Rust não toca, conferido: nenhum `note_types`/`type_id` em `src-tauri/src`):
```sql
CREATE TABLE IF NOT EXISTS trackers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, weekly_target INTEGER NOT NULL,
  color TEXT, icon TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
  linked_type_id TEXT, archived_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)
CREATE TABLE IF NOT EXISTS tracker_marks (
  tracker_id TEXT NOT NULL, day TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY (tracker_id, day))
CREATE INDEX IF NOT EXISTS idx_tracker_marks_day ON tracker_marks(day)
```
- A PK composta garante uma marca por tracker por dia (A2).
- Marcar = `INSERT OR IGNORE`; desmarcar = `DELETE ... WHERE tracker_id = $1 AND day = $2`. As duas operações são idempotentes.
- Excluir o tracker: primeiro `DELETE FROM tracker_marks WHERE tracker_id`, depois `DELETE FROM trackers`. São duas execuções em sequência, seguras se falhar no meio (padrão de `deleteTaskStatus`, `tauri.ts:1351-1359`).
- A contagem da confirmação sai de `SELECT COUNT(*) ... WHERE tracker_id = $1`.
- Toda escrita termina com `this.scheduleCheckpoint()` (`tauri.ts:739-749`).

**Config do Log.** Coluna `log TEXT` (JSON) em `note_types`, acrescentada a `NOTE_TYPES_EXTRA_COLUMNS` (`tauri.ts:577`). Precisa entrar também em:
- `NoteTypeRow` (`tauri.ts:60-70`) e `rowToNoteType` (`tauri.ts:195-207`), com um `parseLogConfig` defensivo como o `parseBoardConfig` (`noteBoard.ts:16-37`);
- a lista de colunas do `getNoteTypes` (`tauri.ts:1437-1440`) e o INSERT/UPSERT do `saveNoteType` (`tauri.ts:1449-1468`);
- o tipo `NoteType` (`src/types/index.ts:151-164`);
- os 3 literais `board: null` (`useNoteTypes.ts:97`, `planNotes.ts:359`, `noteSearch.test.ts:28`);
- `NoteTypePatch` (`useNoteTypes.ts:13`).

**Interface.** Métodos novos em `StorageAdapter` (`src/storage/index.ts:27-112`), por exemplo `getTrackers`, `saveTracker`, `deleteTracker`, `countTrackerMarks`, `getTrackerMarks(from, to)`, `setTrackerMark(trackerId, day, on)`. O `BrowserStorage` (`src/storage/browser.ts`) ganha stubs que lançam "not implemented", que é o padrão do arquivo.

**Restrições conferidas:**
- **Migration aplicada não muda** (v18 e anteriores).
- **Corrida de lock no cold start:**
  - o `Database.load` já tem 15 tentativas (`tauri.ts:703-733`);
  - o rusqlite abre o mesmo `monet.db` com `busy_timeout` de 5 s (`documents.rs:253-263`);
  - as DDLs do frontend passam pela fila `serialDdl`;
  - a 1ª leitura dos registros usa `loadAndSyncWithRetry` (`src/lib/tasksEvents.ts:36-66`, novas tentativas em 1, 2, 4 e 8 s).
  O hook dos trackers deve carregar por esse helper.
- **Sem transação manual:** escrever uma linha por `execute` (comentários em `tauri.ts:1351`, `useNoteTypes.ts:137-138`).
- **Sem `SELECT *`:** listar colunas explícitas (motivo em `tauri.ts:1434-1436`; backlog `DOCS/backlog.md:26`).
- **Nunca chamar um `ensure*` de dentro de um `serialDdl`:** a fila trava (`tauri.ts:694-696`).

**Risco:** baixo. O único cuidado é chamar o `ensure` antes de **toda** leitura. Uma janela que lê antes da DDL de outra recebe "no such table" e, sem o retry, fica vazia na sessão.

## 2. Calendar

**Estrutura** (`src/components/CalendarView/CalendarView.tsx`):
- Estado: `year`, `month` e `yearInput` (106-108); `selectedDay`, padrão hoje (110); a virada do dia acompanha o novo hoje (117-125).
- Marcadores da grade:
  - `dayDotMap`: ponto de nota diária ou datada (129-147);
  - `taskDayMap`: barra de task, só nos dias do mês visível (213-230).
- Células: 42 células com a semana começando na segunda (255-274).
- Navegação: `prevMonth`/`nextMonth` (276-298) e `goToToday` (302-309).
- Rótulo acessível: `cellLabel` (334-350), que deve ganhar "Guitar done" e similares.
- Render:
  - grade e legenda (497-565): o ponto e a barra ficam em 538-548, e a célula é uma coluna flex (`CalendarView.module.css:207-218`, ponto de 4 px em 264-271);
  - abaixo da grade, os cards do dia selecionado (567-661): Overdue, Tasks, Dated, Edited this day.
- **Não existe "semana em foco".** Só existe `selectedDay`.
- A faixa "Trackers" cabe entre `</div>` do `.month` (565) e o bloco `.cards` (567), dentro de `.body`, que já rola (css 40-49).
- O CalendarView é montado em dois lugares:
  - na main: `App.tsx:4738-4760`, só com o caderno Calendar ativo;
  - na keep: `src/components/KeepPanel/KeepPanel.tsx:708-733`, com largura fixa de 220 px e `resizable={false}`.

**Abertura da nota do dia.**
- Na main: `onDayClick` → `handleCalendarDayClick`; a nota diária é a do caderno `calendar` com título `dd/mm/yyyy` (`src/lib/calendar.ts`).
- O dia da nota aberta é calculado em `App.tsx:2166-2171` (`activeCalendarDay`).
- O análogo de "Due today" é o `DueTodayBlock` (`src/components/TasksView/DueTodayBlock.tsx`). Ele entra pelo `topSlot` do Editor (`Editor.tsx:125-127`) em `App.tsx:4298-4305`: um bloco acima das tags que não grava nada no conteúdo. **Os chips dos trackers devem ir no mesmo `topSlot`**, num fragmento junto do `DueTodayBlock`.
- **A keep não usa o `Editor` nem o `topSlot`.** Ela monta o `EditorContent` direto (`KeepPanel.tsx:734-762`), e por isso o "Due today" também não aparece lá. Os chips na keep exigem uma inserção própria acima do `EditorContent`, com o dia da nota carregada (título em `noteRef`).
- A nota do dia na keep pode ser um rascunho ainda não gravado (`KeepPanel.tsx:263-299`). Os chips devem depender só da chave do dia, nunca da existência da nota.

**Recomendações:**
- A semana em foco deve ser derivada, sem estado novo de navegação:
  - a semana do `selectedDay` quando ele está no mês exibido;
  - senão, a semana de hoje, se o mês exibido for o atual;
  - senão, a última semana do mês exibido.

  É decisão do planejador; a alternativa é uma setinha de semana própria na faixa.
- Os dias da semana em foco que caem no mês vizinho continuam clicáveis. O dia futuro fica desabilitado.
- O cálculo (dias feitos, n/meta, total do mês, semanas na meta) deve ficar num módulo puro `src/lib/trackers.ts` (testável). O CalendarView recebe a estrutura pronta e não as notas cruas, porque o `notes` da main que chega ao Calendar é só o do caderno Calendar (`App.tsx:4739`).

**Riscos:**
- A largura mínima de 220 px só comporta uma linha de tracker em 2 ou 3 linhas de texto: ícone, nome e n/meta; os 7 botões de dia (cerca de 24 px cada); "13 in October · 3 of 4 weeks on target" quebra em 2 linhas.
- A grade já tem ponto de nota e barra de task na célula de cerca de 30 px. Os pontos dos trackers precisam de teto (sugestão: até 3, depois "+").

Os dois pontos são para o uxAgent avaliar.

## 3. Eventos entre janelas

**Padrão** (`src/lib/tasksEvents.ts`):
- `TASKS_ORIGIN` por janela (7);
- `emitTasksChanged()` faz `emit` global (9-11);
- `onTasksChangedElsewhere` ignora a própria origem (15-28);
- `loadAndSyncWithRetry` faz a carga com retry e recarrega a cada evento de outra janela (56-66).

Hooks que usam: `useTasks`, `useTaskStatuses`, `useTaskViews`, `useMetadataDefs`, `useNoteTypes` (`useNoteTypes.ts:69-84`: `persist` grava e emite) e `useNotebooks`.

**Para as marcas:** criar um evento próprio (`trackers-changed`, com a mesma origem por janela), num `trackersEvents.ts` ou generalizando o helper por nome de evento. Não reaproveitar `tasks-changed`: cada clique de marca faria main, keep e assistant recarregarem tasks, status, visões, metadados, tipos e cadernos.

O hook `useTrackers()` deve ter **uma instância por janela**, em `App` e em `KeepPanel`, passada por props ou context. O evento ignora a mesma origem, então duas instâncias na mesma janela não se veriam.

As notas não usam evento de mudança:
- a main relê no foco e com `keep-notes-saved` (`App.tsx:2177-2215`);
- a keep relê com `keep-shown` (`KeepPanel.tsx:461`).

Os dias vindos de nota do tipo vinculado (B4) acompanham essas recargas, o que basta. A assistant lê do storage a cada mensagem.

## 4. Tipos de nota e board

**Config:**
- Modal: `src/components/NoteTypes/NoteTypesModal.tsx`. As props ficam em 120-134 (`focusBoard` rola até `[data-board-section]`, 176-178), e a seção Board é montada em 540-545 com `registry.updateType(t.id, { board })`.
- Seção: `NoteTypeBoardSection.tsx`. É o modelo direto para uma `NoteTypeLogSection` com toggle, três `<select>` de candidatas (Number para soma, Number para tendência, Select/Text para grupo) e "Open log".
- Regras puras do board: `src/lib/noteBoard.ts`. Ali estão `parseBoardConfig` (16-37), as candidatas (40-54), `resolveBoard` (68-83, que ignora propriedade apagada), `stripDefFromBoard` (105-121) e `isBoardNote`/`boardNotes` (125-133: do tipo, ativa, de caderno).
- Apagar uma propriedade limpa o board em `useNoteTypes.ts:208-223`. O Log precisa do mesmo `stripDefFromLog`.

**Coluna de cadernos e área:**
- `App.tsx:1164-1171` monta `boards` (tipo + board resolvido + contagem), passado ao `NotebookList` em 4582-4586.
- O `NotebookList` desenha as linhas em dois lugares:
  - no trilho recolhido (`NotebookList.tsx:827-857`);
  - na lista expandida (`NotebookList.tsx:1106-1141`), com as props em 434-441.
- `mainArea` é uma união (`App.tsx:274-281`) e o estado fica em 557. O board aberto ocupa a área inteira (4610-4626), sai quando o tipo ou a coluna somem (1184-1189), recolhe o painel de IA (1191-1205) e abre a nota num modal "Edit note" com Previous/Next (`openBoardNote` 1887-1893, `boardModalNav` 1898-1909, modal 4998-5014; "Open in notebook" 1912-1917).
- O `BoardColumns` (`TasksView/BoardColumns.tsx`) é o motor de colunas e drag. **Não serve ao Log**, que é lista com totais e não tem colunas.

**Onde entra o Log:**
- `mainArea` ganha `{ kind: 'noteLog'; typeId }`;
- um memo `logs` ao lado de `boards`;
- as linhas no `NotebookList` logo abaixo dos boards (props novas `logs`, `activeLogTypeId`, `onOpenLog`), com rótulo que diferencia o mesmo tipo com board e log (ex.: "Practice · Log");
- um componente `NoteLog` novo.

Para "clicar abre a nota", reaproveitar o modal do board exige generalizar `noteBoardOpen` em 1174-1175, 1197-1213 e 4998. **Isso soma cerca de 6 pontos de contato no `App.tsx`**, maior que as "edições pequenas" pedidas. Sugestão: concentrar a lógica num hook `useMainAreaViews`, ou aceitar a abertura direta no caderno (`openBoardNoteInNotebook`), que é mais barata.

**Notas de um tipo em todos os cadernos.** Não há consulta SQL por tipo. O board filtra o `notes` em memória: a main carrega todas as notas com `getNotes`, `tauri.ts:842-849`, e a keep tem `allNotes`. O dia da nota para B3/B4 sai de `note.date ?? dateKeyFromMs(note.createdAt)` (`calendar.ts`).

`getNotesByDateRange` (`tauri.ts:982-1014`) existe, mas filtra só por `date` e por propriedades de data, nunca pela criação. **Não serve ao B3** e não precisa ser usada: o cálculo em memória cobre arquivar, excluir e mudar a data (edge cases) sem invalidação.

**Tipo "Practice" (B5).** Padrão do "Save as Plan note":
- `planSaveChanges` (`src/lib/planNotes.ts:341-405`), uma função pura que acha o tipo pelo nome (`nameKey`), monta o tipo novo e acrescenta só as defs que faltam;
- aplicada em `App.tsx:3585-3594`, que relê tipos e defs do storage, grava um por `execute`, depois `noteTypes.reload()` e `emitTasksChanged()`.

O `practiceSaveChanges(types, defs)` deve seguir esse padrão e devolver também a config `log`.

**Risco B5:** um "Practice" existente com "Minutes" como Text impede criar "Minutes" Number, porque o nome é único no tipo (`useNoteTypes.ts:20-34`). Recomendação: casar por nome e tipo de dado; se houver conflito, deixar a soma ou a tendência vazia na config e avisar.

## 5. Agentes

**Definição:**
- Chat: `ChatAgentDef` (`src/lib/agents/chat.ts:10-23`), com id, command, label, icon, `prompt(language)`, `buildContext` (reconstruído a cada mensagem, vai como system efêmero), `forceTasksTool`, `forceNotesTool` e `context` (rag/web/deepResearch). Ordem em `CHAT_AGENTS` (61); placeholder e mensagem padrão em `COMPOSER_HINTS` (97-116).
- Slash: `AgentDef` e `ContextPolicy` (`core.ts:32-49`).

**Dados:** `loadPlanData()` (`agentData.ts:37-54`) lê notas, defs, tipos, cadernos, cadernos com IA desligada e livros a cada mensagem. O resumo dos planos é puro, em `collectPlans` e `formatPlanForAi` (`planNotes.ts:122-161`, `241-292`).

**Onde entra o resumo dos trackers (C1):** uma função pura `formatTrackersForAi(trackers, marks, notes, today, opts)` em `src/lib/trackers.ts`, mais um `loadTrackerData()` em `agentData.ts` que lê trackers ativos e marcas de cerca de 9 semanas (últimas 4 semanas e mês anterior).

- **Coach:** `buildCoachContext` (`coach.ts:13-51`) acrescenta a seção quando há tracker ativo. O prompt (53-70) precisa de uma regra nova para os trackers, e a linha 69 precisa mudar (ver §8). A def (72-83) ganha `forceTrackersTool: true`.
- **Plan week:** `buildPlanWeekContext` (`planWeek.ts:78-158`) acrescenta "sessões que faltam" usando `planWeekWindow` (48-67). Se a cobertura for `nextWeek`, falta a meta inteira da semana seguinte. O prompt (160-189) precisa de uma regra e de um lugar no formato de saída (ver §8). A def (191-202) ganha `forceTrackersTool: true`.
- **`/week-review`:** o contexto do slash é montado no `App.tsx`:
  - janela da agenda em 2450-2482 (o `weekReviewAgenda` dá a semana, `weekReview.ts:9-25`);
  - resumo dos planos e `agendaContext` em 2701-2721.

  Sugestão: um campo `trackers?: boolean` em `ContextPolicy`, ligado só no `weekReviewAgent`. No `App.tsx`, quando o campo estiver ligado, acrescentar `formatTrackersWeekForAi(from, to)` ao `agendaContext`; é uma linha. Ajustar o `behavior` (`weekReview.ts:38-44`) para uma seção ou linha "Trackers: <nome> n/meta".

O `/today` usa a mesma via e não deve receber o bloco (Task Report só pede C4).

## 6. Tools do Chat

**Tool "Tasks"** (TS, sem Rust, em `src/hooks/useChat.ts`):
- `ChatTools` (370-382), `DEFAULT_TOOLS` (404-410) e `loadTools` em localStorage (412-437);
- definição da `query_tasks` (4131-4184), que só entra se `toolsRef.current.tasks || turnAgent.forceTasksTool` e se houver snapshot;
- execução (4458-4492);
- mensagem de sistema com os resultados (4591-4598);
- `turnAgent` (3496).

**Toggle.** `ChatToolsMenu.tsx`:
- props `tasksTool` (32-41);
- estado forçado pelo agente: `tasksForced` (80-94), exibido como "On for <agente>" e com o switch desabilitado (149-182).

Superfícies que passam `tasksTool`: `ChatComposer.tsx:545` (Chat e Assistant) e `NotesChatPanel.tsx:651`. O Reader (`ReaderChatPanel.tsx:475`) não passa, e a nova tool também não deve aparecer lá.

**Tool "Trackers" (`query_trackers`):**
1. `trackers: boolean` em `ChatTools` e `loadTools` (padrão desligada).
2. `forceTrackersTool` em `ChatAgentDef`, nos 5 agentes: true em Coach e Plan week.
3. A definição só entra com o toggle ligado ou com o agente forçando, e `supportsTools`.
4. Parâmetros:
   - `from`/`to` em YYYY-MM-DD, como `notes_by_date` (4202-4220), que responde "outubro" sem enum;
   - `tracker` opcional, por nome.
5. Execução: ler do storage na hora da chamada, como `notesByDateText` (4529-4540), sem snapshot. Assim funciona nas três janelas.
6. Saída: contagem por tracker, por semana (feitos/meta) e os dias com a origem (manual ou nota).
7. Linha no `ChatToolsMenu` com ícone Phosphor e "On for Coach".
8. Bucket próprio de resultados e mensagem de sistema: "numbers from the app; do not estimate".

É só leitura (C6).

## 7. Testes, type-check e cargo

- `npm test` = `vitest run`.
  - Config: `vitest.config.ts` (happy-dom, `src/**/*.test.ts(x)`).
  - Os testes ficam ao lado do módulo: `src/lib/tasks.test.ts`, `taskQuickAdd.test.ts`, `noteSearch.test.ts`, `markdown.test.ts`, `noteFileText.test.ts`, `openrouter.test.ts`.
  - Bom modelo de lógica pura com datas: `tasks.test.ts`, com `TODAY` fixo e fábrica `task(patch)`.
  - Rodado agora: **9 arquivos, 105 testes, todos passando**.
- Type-check: `npx tsc --noEmit` (o `tsconfig.json` já tem `noEmit`). Rodado agora: **limpo**.
- `cargo check --manifest-path src-tauri/Cargo.toml` (o script `test:rust` roda `cargo test`). **Não rodado**: as fases A–C não tocam Rust.
- Helpers de data prontos para os testes e o cálculo:
  - `addDaysKey`, `startOfWeekKey`, `weekDayKeys` e `endOfWeekKey` (`src/lib/tasks.ts:356-375`);
  - `toDateKey` e `dateKeyFromMs` (`src/lib/calendar.ts`);
  - `withWeekday` (`src/lib/agenda.ts`).
- Testes sugeridos: n/meta da semana; total do mês com semana que cruza o mês; semana atribuída pela quinta-feira; marca manual e nota no mesmo dia contando uma vez; dia futuro ignorado; meta alterada; agregação do Log (período, soma, grupo de Text normalizado, tendência primeiro → último); `practiceSaveChanges` idempotente; `formatTrackersForAi`.

## 8. Riscos, decisões abertas e escopo

**Mudança de escopo: nenhuma obrigatória.** Os pontos abaixo pedem decisão do planejador e do Orquestrador antes do código; dois deles mudam regras de prompt já existentes.

1. **Coach sem plano e com tracker (conflito de prompt).** A regra atual (`coach.ts:69`) diz que, sem plano ativo, o Coach pergunta qual objetivo seguir e oferece `/planner`. Com só trackers, ele faria isso em vez de cobrar os trackers. A regra precisa mudar ("sem plano e sem tracker ativo"). O placeholder "Check my plans" (`chat.ts:107-111`) também pode precisar de ajuste. Mexe no comportamento do Coach, mas dentro de C2.
2. **Plan week × formato e dias de trabalho (conflito de contrato).**
   - O plano só tem linhas para os dias de trabalho, com até 4 bullets e horas no total do dia (`planWeek.ts:179`).
   - Hábitos como atividade física caem no fim de semana, e sessões de tracker não têm duração.
   - Decidir:
     - onde as sessões aparecem (bullet próprio no dia ou linha "Trackers: …" ao fim);
     - se consomem capacidade (sugestão: não, sem horas);
     - se dias fora do trabalho entram.
   - Sem isso, o modelo vai improvisar.
3. **"Semana em foco" não existe** no Calendar. A regra precisa ser definida (sugestão no §2).
4. **"Semanas na meta" no mês corrente e antes do tracker existir.** Definir:
   - se o denominador conta só semanas terminadas;
   - se a semana atual conta quando já bateu a meta;
   - se as semanas anteriores à criação (ou à 1ª marca) entram como falha.

   Como a marca retroativa é permitida, contar desde a semana da 1ª marca ou de `created_at`, o que vier antes, evita "0 of 4" num tracker criado hoje.
5. **Dia vindo de nota no futuro** (nota do tipo vinculado com `date` futura): ignorar dias depois de hoje, coerente com A2.
6. **Chips na keep:** a keep não tem `topSlot` nem "Due today". Incluir chips lá custa uma inserção própria e o hook na keep, que já é necessário para a faixa. Recomendo incluir: a keep é a nota do dia por excelência.
7. **`App.tsx` compartilhado:** a visão Log toca cerca de 6 pontos (união `MainArea`, memo `logs`, "gone", painel de IA, modal, props do `NotebookList`). Os trackers tocam 3 ou 4 (hook, `topSlot`, props do CalendarView, contexto do `/week-review`). É viável, mas é maior que as "edições pequenas". Sugestão: hooks e componentes fora do `App.tsx` e só a fiação nele.
8. **Período do Log** ("mês, 3 meses, ano"): decidir entre mês corrente de calendário e janela móvel de 30/90/365 dias. Sugestão: janela móvel terminando hoje, que é o que "3 meses" sugere.
9. **Agrupamento por Text:** `normalizeName` (`tasks.ts:935-937`) também tira acentos. O B1 só pede caixa e espaços. Usar `trim().toLowerCase()` ou aceitar o acento como ruído é decisão menor.
10. **Cadernos com IA desligada:** a tool Tasks os exclui (`useChat.ts:4470`). Para os dias vindos de nota, que vão aos agentes só como contagem e sem texto, sugiro contar mesmo assim, mas o planejador deve registrar a escolha.
11. **Tipo vinculado apagado:** `deleteNoteType` (`tauri.ts:1476-1495`) não conhece trackers. A leitura deve ser defensiva (tipo inexistente = sem vínculo), ou limpar `linked_type_id` no `removeType`.
12. **Decisões registradas respeitadas:** sem `BEGIN`/`COMMIT`; sem `SELECT *` nas leituras novas (as antigas `subjects`, `task_statuses`, `task_views` e `books` seguem com `*`, fora do escopo, `DOCS/backlog.md:26`); ícones Phosphor (o conjunto do `TypeIcon`/`TYPE_ICON_GROUPS` serve ao ícone do tracker, e a paleta `TASK_COLOR_PALETTE`/`ColorDots` à cor); confirmação por `useConfirm`. O PRD não tem nenhuma não-meta que barre os trackers; a atualização do §4/§9 já está no Task Report.

## O que não foi verificado
- `cargo check`, que não foi rodado (sem mudança em Rust nas fases A–C).
- O comportamento real da faixa a 220 px e dos pontos na célula, porque não abri o app.
- O texto completo de `useChat.ts` fora dos trechos citados (o arquivo é grande). A integração da tool nova pode ter outros pontos menores, como a contagem de rodadas e os rótulos de "tool em uso".
- O `CHAT_SYSTEM_PROMPT` do General, para ver se cita as tools pelo nome.
