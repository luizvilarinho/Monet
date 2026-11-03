# Execution Report

## Documents
- Task report: DOCS/reports/03-11-2026/taskreport_20261103121310.md
- Execution report: DOCS/reports/03-11-2026/executionreport_20261103121310.md
- Explorer report: DOCS/reports/03-11-2026/explorerreport_20261103122328.md
- Plan report: DOCS/reports/03-11-2026/planreport_20261103123404.md
- UX report (estudo da coluna, R9): DOCS/features/notebook_column_study.md (mockups em DOCS/features/notebook_column_study/index.html)
- Review report: DOCS/reports/03-11-2026/reviewreport_20261103145614.md

## Sessions
### Orchestrator — abertura — 20261103121310
- Summary: Task Report gerado a partir de 10 itens do backlog (9 da análise de 2026-11-03 sobre agenda/IA e coluna de cadernos + o bug de Shift+Enter de 2026-11-02); os itens foram movidos do `DOCS/backlog.md` para o Task Report. O Coordenador pediu, na mesma mensagem, para iniciar o pipeline padrão (explorerAgent → plannerAgent) e, em paralelo, o uxAgent para o estudo da coluna de Notebooks com opções em HTML simples.
- Inputs:
  - DOCS/reports/03-11-2026/taskreport_20261103121310.md
  - DOCS/backlog.md
- Decision: spawn do uxAgent (escopo R9, com R7 e R8 como insumo) e do explorerAgent (R1–R10) em paralelo; plannerAgent depois do explorer. Implementação de R9 só depois da escolha do Coordenador entre as opções do uxAgent.
- Next step: aguardar explorerAgent e uxAgent; definir com o Coordenador a branch de trabalho antes do codeAgent (a atual, `feat/mincer`, está apartada).

### Orchestrator — decisão — 20261103122500
- Summary: o Coordenador decidiu que o código da task vai numa branch nova criada a partir da `develop`. A `develop` não tem o Mincer nem os termos do Related content (`feat/related-terms`), que só existem na `feat/mincer`; nos arquivos da task a diferença está em `App.tsx`, `useChat.ts`, `Editor/extensions.ts`, `DOCS/backlog.md` e `DOCS/docs.menu.md`. O explorerAgent e o uxAgent já rodam sobre a árvore da `feat/mincer`.
- Inputs:
  - git diff develop..feat/mincer
- Decision: não trocar de branch enquanto os agentes leem o código. Depois do explorer e do uxAgent, criar `feat/agenda-quicknotes` a partir da `develop` (o `DOCS/backlog.md` alterado na `feat/mincer` precisa ser tratado antes da troca) e pedir ao plannerAgent que planeje sobre a `develop`, tratando as referências de linha do explorer como aproximadas e ignorando o que só existe na `feat/mincer` (grupo Mincer do chat, termos do Related content no R10).
- Next step: aguardar explorerAgent e uxAgent.

### Orchestrator — decisão — 20261103123000
- Summary: o Coordenador mudou a decisão: a branch da task sai da `feat/mincer`. Criada `feat/agenda-quicknotes` a partir do HEAD da `feat/mincer` (a6a6c6a), sem troca de arquivos; a árvore em que o explorer e o uxAgent trabalham é a mesma. A sessão anterior (base `develop`) fica sem efeito: as referências do explorer valem como estão, e o Mincer e os termos do Related content (R10) estão no escopo.
- Inputs:
  - git switch -c feat/agenda-quicknotes
- Decision: trabalhar em `feat/agenda-quicknotes`; nada a tratar no `DOCS/backlog.md` (alteração segue na branch nova).
- Next step: aguardar explorerAgent e uxAgent.

### Orchestrator — decisão — 20261103123500
- Summary: o Coordenador saiu e autorizou dar andamento às atividades; ele testa no final.
- Inputs:
  - mensagem do Coordenador
- Decision: seguir explorer → planner → codeAgent sem nova aprovação intermediária. O codeAgent implementa R1–R8 e R10; R7 e R8 entram de forma independente do layout (Quick Notes como linha fixa no padrão da linha Tasks atual, subject "Tasks" fora da lista). R9 (novo layout da coluna) fica para depois da escolha do Coordenador entre as opções do uxAgent. Sem commit. A revisão (codereviewAgent) só depois do teste do Coordenador, como manda o fluxo.
- Next step: aguardar explorerAgent e uxAgent.

### ExplorerAgent — 20261103122328
- Summary: R1–R10 viáveis, sem mudança de escopo. R1: um só caminho (`handleCommand` → `buildUserMessage` → `useAi.start`) cobre todos os slash commands; o `getDatedNotes` atual não filtra cadernos com IA desligada (vazamento existente). R2: JSON1 confirmado (libsqlite3-sys 0.28 bundled, SQLite 3.45.0, `-DSQLITE_ENABLE_JSON1`; `json_each` testado em PRD só leitura); regra de "ongoing" proposta: só pelas propriedades de data (≥2), ignorando `notes.date`, o que tira as TODOS do ruído; ligar "Daily notes" por padrão exige migração do `localStorage`. R3–R5: módulo comum `src/lib/agenda.ts` reaproveitando `taskLineForAi`, `todosProgressByNote`, `notesByDateText`; `/planner` precisa de flag `optionalQuery`. R6: `CalendarView` e `KeepPanel` recebem `noteTypes`. R7: migrar o nome pelo state (reindexa o RAG), reservar "Quick Notes", Ctrl+N no listener de captura com ref, `setActiveMode('notebook')` e ignorar com modal aberto. R8: só o `NotebookList` mostra o subject; risco no `reorder` de subjects e na navegação para nota-corpo. R10: causa confirmada (`<br>` dentro de `<mark>`/`<strong>`/`<li>` tight trocado por `<p>`), correção por "br solto" proposta; atinge também negrito/link, listas tight e tabelas.
- Output: DOCS/reports/03-11-2026/explorerreport_20261103122328.md

### Orchestrator — decisão — 20261103124500
- Summary: o explorer deixou 5 decisões em aberto. Com o Coordenador ausente e autorização para seguir, o Orquestrador adotou padrões conservadores, a confirmar no teste final.
- Inputs:
  - DOCS/reports/03-11-2026/explorerreport_20261103122328.md
- Decision:
  - `/week` com parâmetro opcional (a pergunta/foco); sem parâmetro, devolve o resumo "Feito/Falta". Usa a mesma flag `optionalQuery` do `/planner`.
  - Nota do Calendar no futuro: "Feito" vai até min(hoje, D); "Falta" começa em hoje.
  - Quick Notes mantém o comportamento atual do Inbox quanto a subjects e ao "move notebook" (sem regra nova); só vira linha fixa, sem renomear/arrastar.
  - Nome "Quick Notes" reservado: bloquear criar/renomear outro caderno com esse nome (em PRD não há colisão).
  - "Daily notes" ligada por padrão para todos, com migração única do `localStorage` (`monet:chat-tools`).
  - Regra de "ongoing" do explorer adotada (só propriedades de data, ≥2 preenchidas, ignora `notes.date` e arquivadas).
- Next step: plannerAgent.

### Orchestrator — decisão — 20261103130000
- Summary: plano recebido (E1–E15) e estudo do uxAgent recebido (R9, opções A–D, recomendação B em duas etapas, decisões D1–D13 para o Coordenador). O plano diverge do padrão adotado em um ponto: para um caderno "Quick Notes" já existente, renomeia o do usuário para "Quick Notes (old)" em vez de só bloquear o nome; aceito, porque em PRD não há colisão e o caso só ocorre num banco que já tenha esse nome.
- Inputs:
  - DOCS/reports/03-11-2026/planreport_20261103123404.md
  - DOCS/features/notebook_column_study.md
- Decision: código em três codeAgents. codeAgent 1: E1–E8 (agenda/IA). codeAgent 2, em paralelo: E14 (R10, só `Editor/extensions.ts`). codeAgent 3, depois do 1: E9–E13 (Calendar, Quick Notes, Ctrl+N, subject Tasks) e E15. Os estágios do R9 do uxAgent ficam para a escolha do Coordenador; o codeAgent 3 não antecipa o layout.
- Next step: codeAgents 1 e 2.

### uxAgent — estudo da coluna de cadernos (R9) — 20261103
- Summary: diagnóstico da coluna Notebooks conferido no código (11 pontos com linhas de `NotebookList.tsx`/`.module.css`/`App.tsx`), princípios, o que vale para todas as opções (Quick Notes fixo com contagem, idade e Ctrl+N; subject "Tasks" filtrado; um fundo de seleção só; ações que só ocupam espaço no hover) e 4 opções: A (seções Views × Notebooks, menor mudança), B (views + árvore de cadernos com seta, Tags/Marks em acordeão, trilho com iniciais), C (grade de views + árvore; tira Tags/Marks da coluna, contra as specs) e D (caderno em foco, dois níveis; contra as specs). Recomendação: B em duas etapas (etapa 1 = A, junto de R7/R8; etapa 2 = árvore e trilho). 13 decisões pendentes (D1–D13) no estudo. Não gerei uxreport separado: o behavior do uxAgent prevê relatório pós-implementação; aqui o entregável é o estudo.
- Outputs:
  - DOCS/features/notebook_column_study.md
  - DOCS/features/notebook_column_study/index.html (comparação e links)
  - DOCS/features/notebook_column_study/current.html (coluna hoje)
  - DOCS/features/notebook_column_study/option-a.html
  - DOCS/features/notebook_column_study/option-b.html (recomendada; inclui mockup da revisão do Quick Notes na coluna Notes)
  - DOCS/features/notebook_column_study/option-c.html
  - DOCS/features/notebook_column_study/option-d.html
  - DOCS/docs.menu.md (linha do estudo em "Estudos")
- Notes: HTML+CSS puro com ícones Phosphor em sprite SVG inline (gerado de node_modules/@phosphor-icons/react, peso regular); JS só para abrir/fechar subjects nas opções B e C. Nenhuma alteração em src/ ou src-tauri/; sem commit.
- Next step: Coordenador escolher a opção e responder D1–D13; depois, plannerAgent/codeAgent implementam R9 junto da parte visual de R7/R8.

### PlannerAgent — 20261103123404
- Summary: plano de R1–R8 e R10 em 15 etapas (R9 fora). Trilha de IA: E1 data no `handleCommand`/`buildUserMessage` (objeto) + regra no `SYSTEM_PROMPT`; E2 `src/lib/agenda.ts` com `matchNoteDates` (propriedades `date` do tipo atual, `ongoing` com ≥2 propriedades); E3 SQL pré-filtro com `json_each` em `getNotesByDateRange` (com `ensureNotesColumns`/`ensureTasksTables`), cabeçalho com o campo que casou, descrições novas das tools, "Daily notes" ligada com migração única; E4 troca do `getDatedNotes` (corrige vazamento de caderno com IA desligada); E5 `selectAgenda`/`formatAgendaContext`/`lastOpenDeadline` com orçamentos por bloco; E6 `optionalQuery` sobre `takesQuery: true`; E7 `/week` Done/To do (split = min(D, hoje)); E8 `/planner` (âncora, semana detalhada, horizonte até o último prazo, 6 h padrão). Coluna/UI: E9 tipo nos cards do Calendar (main e keep); E10 nome "Quick Notes" via `saveNotebook` no bootstrap + nome reservado; E11 linha fixa abaixo do Calendar com `renderSubjects` extraído; E12 Ctrl+N no listener de captura com ref e bloqueio por `[aria-modal="true"]` (completado em 3 modais); E13 subject "Tasks" filtrado na coluna, `reorder` preservando ids, navegação para nota-corpo sem subject ativo; E14 regra do "br solto" no `updateDOM`; E15 build + roteiro de teste. Prompts novos em inglês no plano. Sem mudança de escopo; decisões menores do plano listadas no fim do planreport para confirmação no teste.
- Output: DOCS/reports/03-11-2026/planreport_20261103123404.md

### CodeAgent — implementação inicial (E14, R10) — 20261103124439
- Summary: no `parse.updateDOM` do `ParagraphWithBlankLines` só o `<br>` "solto" (fora de `<p>`, com pai de bloco ou a raiz, sem vizinho inline) vira `<p></p>`; os demais são hardBreak e ficam. Helpers `BLOCK_TAGS`, `hasInlineNeighbor`, `isBlankLineBr` exatamente como no plano, colocados acima do comentário do `ParagraphWithBlankLines`; comentário do `updateDOM` atualizado; `serialize` intocado. Validado no harness do editor (Vite no scratchpad, porta 5211 porque a 5199 estava ocupada; Edge headless via CDP), round-trip doc → markdown → doc em 3 ciclos com a extensão real (`buildBaseExtensions` num `useEditor` de `@tiptap/react`, não o componente `Editor` inteiro: os extras do `Editor` não entram no parse/serialize). Antes da correção: 12/37 passavam (marca, highlight, termo, negrito, itálico, riscado, link, itens tight e célula partiam). Depois: 43/44. Casos: marca (com e sem rótulo), highlight, termo do Related content, negrito, itálico, riscado e link com 1 e 2 Shift+Enter; marca+negrito aninhados; item de lista e checklist com Shift+Enter (com e sem marca/highlight); célula de tabela; blockquote; markdown escrito à mão no formato do banco; regressão de linha em branco (1, 2 e 3 consecutivas, inicial, em volta de embed/linked-note/tasks-query/lista, dentro de checklist, com marca+Shift+Enter ao lado): estável. `tsc --noEmit` limpo; `vite build` falhou em `src/App.tsx:2171` (`isWeekOnly` declarado duas vezes), arquivo do outro codeAgent em edição.
- Files changed:
  - src/components/Editor/extensions.ts
- Files created:
  - nenhum (harness só no scratchpad)
- Files removed:
  - nenhum
- Left behind: caso "linha em branco dentro de item de lista com vários parágrafos" (`- a` / `<br>` / `b` / `- c`) muda a lista de tight para loose no 1º salvamento e depois fica estável; falha igual antes da correção, não tem relação com o R10 e ficou fora do escopo. Notas já gravadas com o trecho partido não se recuperam (o estrago já está no markdown).

### CodeAgent — implementação inicial (E1–E8, agenda/IA) — 20261103124807
- Summary: E1 data de hoje (e da nota do Calendar) na 1ª linha da user message de todo slash command, montada no `handleCommand`; `buildUserMessage` com objeto; regra de datas relativas no `SYSTEM_PROMPT` (sem data). E2/E5 `src/lib/agenda.ts`: `noteDateFields`/`matchNoteDates`/`formatNoteDateMatch`/`withWeekday` (ongoing só com 2+ propriedades de data, ignora `date` e arquivadas) e `selectAgenda`/`agendaContents`/`formatAgendaContext`/`lastOpenDeadline` com orçamentos por bloco (tasks 12k, TODOS 8k, datadas 16k, diárias 8k). E3 `getNotesByDateRange` com pré-filtro `json_each` (+ `ensureNotesColumns`/`ensureTasksTables`), `notesByDateText` com `matchNoteDates` e o campo que casou no cabeçalho, descrições novas de `get_day`/`notes_by_date`, frase extra no `query_tasks` com Daily notes ligada, "Daily notes" ligada por padrão com migração única (`monet:chat-tools-daily-notes-default-migrated`) e texto novo no menu. E4 `getDatedNotes` trocado por `datedNotesForDay` (filtra caderno com IA desligada, arquivadas, notas-corpo; inclui propriedades e ongoing). E6 `optionalQuery` no `CommandDef`, `getCommandLineStatus` e `handleCommand`. E7 `/week` como resumo Done/To do (D−7..D+7, split = min(D, hoje)), sem `getWeekCalendarNotes`/`formatWeekContext` e sem o erro "No calendar notes…". E8 `/planner` (âncora hoje ou nota do Calendar, semana detalhada, horizonte até o último prazo aberto, 6 h padrão) com regra no `SYSTEM_PROMPT` e a linha de exceção às regras de complemento.
- Files changed:
  - src/App.tsx
  - src/hooks/useChat.ts
  - src/storage/tauri.ts
  - src/components/ChatPanel/ChatToolsMenu.tsx
  - src/components/Editor/commandParser.ts
  - src/lib/commands.ts
  - src/types/index.ts
- Files created:
  - src/lib/agenda.ts
- Files removed:
  - nenhum
- Desvios do plano:
  - Migração da "Daily notes": a chave de migração é gravada no 1º `loadTools` mesmo sem `monet:chat-tools` salvo (usuário novo); senão, quem desligasse a tool antes de existir a chave a veria religada no reinício seguinte.
  - TODOS no bloco da agenda sem data no período (entra por ter tasks na janela): o cabeçalho traz as datas dela sem dia da semana (`Entrega: 2026-12-01`), para o "To do"/planner não perder o prazo de entrega.
  - `matchNoteDates` devolve `matched`/`other` ordenados por data (a "1ª data casada" da ordenação é a menor).
- Verificação:
  - `npm run build` (tsc + vite) sem erros; só os avisos de chunk/dynamic import que já existiam.
  - SQL novo do `getNotesByDateRange` rodado em Python `sqlite3` (3.45.1) numa cópia RO do PRD no scratchpad (apagada depois): semana 02–08/11 traz "contratoapoliceautoweb" (Entrega 06/11), "plano leitura - Fundamentos de Arq." (ongoing) e "Plano dev. modo agente"; 12/11 traz só o "plano leitura".
  - `agenda.ts` testado com esbuild + node sobre os dados do PRD (cópia RO): plano leitura ongoing (Início 25/10 → Fim 17/11); contrato `Entrega: 2026-11-06 (Friday) (also: Date 2026-10-25)`; nenhuma TODOS ongoing; `/week` 03/11 = 9 concluídas e 4 atrasadas (todas sob as TODOS), 7 TODOS, 12 notas datadas, 6 diárias, 27,6k caracteres, cada task uma vez; nota futura com "Done" até hoje; caderno desligado sai de notas e tasks; `/planner` sem bloco de concluídas (último prazo aberto em PRD: 2027-04-30, então o horizonte vai até lá).
- Left behind: `DOCS/specs/PRD.md` (inventário de comandos, l. 83) não cita o `/planner` (fora dos arquivos do plano). `/week` e `/planner` continuam passando pelo RAG de documentos do caderno como os outros comandos (o plano não tratou; no Calendar normalmente não há documentos). Teste no `tauri:dev` pendente (Coordenador).

### CodeAgent — implementação inicial (E9–E13, E15) — 20261103125810
- Summary:
  - E9 (R6): `CalendarView` ganhou a prop opcional `noteTypes` (`typeById` memoizado); o card de nota do dia tem uma linha de meta com o tipo (`TypeIcon` + nome na cor do tipo, como o eyebrow do `Sidebar`) seguido do caderno; a linha só aparece com tipo ou caderno. CSS novo `.noteCardMeta`/`.noteCardType`, `.noteCardNotebook` com `min-width: 0` e ellipsis (só tokens). App passa `noteTypes.types`; `KeepPanel` carrega `storage.getNoteTypes()` uma vez e passa ao `CalendarView`.
  - E10 (R7 nome): `QUICK_NOTES_NAME = 'Quick Notes'` em `lib/tasks.ts` (id `inbox` mantido); `ensureInbox` cria com o nome novo; migração no efeito de bootstrap via `saveNotebook` (state → reindexa o RAG), com o caderno do usuário homônimo renomeado para "Quick Notes (old)"; helper `isReservedNotebookName`: criar pelo "+" abre o Quick Notes, criar pelo chat devolve o Quick Notes, renomear para o nome reservado (ou renomear o `inbox`) é ignorado. `NoteBoard` usa `QUICK_NOTES_NAME`; `noteboard.md` atualizado. `findProjectByTag` conferido: `#QuickNotes` casa sem mudança.
  - E11 (R7 coluna): `NotebookList` com `userNotebooks` (sem Calendar e sem `inbox`) na lista ordenável; bloco de subjects extraído para `renderSubjects(nbId)` (markup igual); linha fixa Quick Notes logo abaixo do Calendar (ícone `NotePencil`, progresso de tasks, botão de documentos, subjects quando ativo; sem arrasto, rename, mover ou excluir). Removido o `isInbox` do `SortableNotebookItem`. CSS `.quickNotesIcon`.
  - E12 (R7 Ctrl+N): `handleQuickNote` (cria nota vazia no Quick Notes, modo notebook, subject `null`, busca limpa, nota ativa) chamado por `quickNoteRef` no listener de captura do Ctrl+P (`preventDefault` + `stopPropagation`; ignora com `[aria-modal="true"]` no DOM; Ctrl+Shift/Alt+N fora). `role="dialog"` + `aria-modal="true"` no painel de `NotebookPickerModal`, `SearchPalette` e `MergeNoteModal`.
  - E13 (R8): `columnSubjects` (sem o subject "Tasks") vai ao `NotebookList`; `activeSubjectId` passado direto; removidos o ramo `isTasksSubject` de `handleSelectSubject`, a condição do `onCreateTyped` do `Sidebar` e o ramo `isTasks` do `SortableSubjectItem` (e o import de `isTasksSubject` no `NotebookList`); `handleNavigateToNote` mapeia o subject "Tasks" para `null`; `useSubjects.reorder` mantém no state os subjects fora de `newIds` sem regravá-los.
  - E15: `npm run build` limpo (só os avisos antigos de chunk/dynamic import). Grep de sobras: `getWeekCalendarNotes`, `formatWeekContext`, `getDatedNotes`, `weekContext`, `isInbox`: nenhuma ocorrência; "Inbox" não aparece em texto de UI (só no nome `ensureInbox`/`INBOX_NOTEBOOK_ID` e em comentários de `ProjectsBoard.tsx`/`TasksHeader.tsx`, fora do escopo mapeado); comentários do `App.tsx` que diziam "Inbox" passaram a "Quick Notes". Conferido no harness (Vite no scratchpad + painel do navegador, dados falsos): linha fixa Quick Notes com ícone, progresso e documentos; subjects abrem sob o Quick Notes e sob um caderno do usuário (com folder, "turn into notebook" e excluir); cards do Calendar com TODOS (ícone e cor), Plan (ícone padrão, sem cor) e nota sem tipo (só caderno), texto longo cortado com reticências.
- Files changed:
  - src/App.tsx
  - src/lib/tasks.ts
  - src/hooks/useSubjects.ts
  - src/components/CalendarView/CalendarView.tsx
  - src/components/CalendarView/CalendarView.module.css
  - src/components/KeepPanel/KeepPanel.tsx
  - src/components/NotebookList/NotebookList.tsx
  - src/components/NotebookList/NotebookList.module.css
  - src/components/NoteBoard/NoteBoard.tsx
  - src/components/NotebookPickerModal/NotebookPickerModal.tsx
  - src/components/SearchPalette/SearchPalette.tsx
  - src/components/Sidebar/MergeNoteModal.tsx
  - DOCS/specs/noteboard.md
- Files created:
  - nenhum (harness só no scratchpad)
- Files removed:
  - nenhum
- Desvios do plano:
  - `handleCreateNotebookFromChat` com nome reservado devolve o caderno `inbox` do state; se ele ainda não estiver no state (acabou de ser criado pelo `ensureInbox`), devolve um objeto `{ id: 'inbox', name: 'Quick Notes', … }` em vez de criar outro caderno.
  - A migração do nome roda no mesmo efeito do bootstrap, sem esperar o `ensureInbox()` (que só cria quando o `inbox` não existe, e aí já nasce com o nome novo).
  - Comentários com "Inbox" no `App.tsx` (resolveProject, exclusão de caderno, board) trocados por "Quick Notes", além dos do `NoteBoard`.
- Left behind:
  - Na lista ordenável, os botões de documentos/mover/excluir ocupam espaço mesmo invisíveis e cortam nomes curtos numa coluna estreita; já era assim (diagnóstico do uxAgent, R9).
  - Caderno só com o subject "Tasks" mostra o cabeçalho "Subjects" com o "+" e nenhum item (decisão de layout do R9, como no plano).
  - Na janela do Assistant, "Save to note" › novo caderno "Quick Notes" devolve o Quick Notes mas o acrescenta de novo à lista local do modal (cosmético, só até fechar o modal).
  - Para encerrar o servidor do harness, parei os processos `node` com `server.mjs` na linha de comando (2 processos: o meu e, provavelmente, o harness que o codeAgent do E14 deixou aberto).
  - Teste no `tauri:dev` pendente (Coordenador; roteiro abaixo).

#### Roteiro de teste final no `npm run tauri:dev` (R1–R8, R10)
Banco dev (`com.monet.app.dev`), nunca o de produção. Se o app não subir: matar o `monet.exe` órfão de `src-tauri\target\debug` (memória `project-dev-orphan-instance.md`); "readonly database": `icacls src-tauri\target /setintegritylevel M` (memória `project-sandbox-low-integrity-exe.md`). Abrir o DevTools (F12) para ver os logs `[Monet AI]` (`Command contexts`, `userMessage`). Antes do item 7, anotar `SELECT COUNT(*) FROM notes WHERE subject_id LIKE 'tasks-%'` no banco dev (só leitura).

1. **R1 — data nos slash commands**
   - Numa nota comum: `/ask o que temos pra fazer essa semana`. No log, a user message começa com `Today: 2026-11-03 (Tuesday)` e não tem a linha `Calendar note date`. A resposta trata a semana de 02 a 08/11.
   - Numa nota do Calendar de amanhã: o mesmo `/ask`. Aparece a 2ª linha `Calendar note date: 2026-11-04 (Wednesday) …`; "essa semana" continua resolvida a partir de hoje.
   - Numa nota comum com título `dd/mm/aaaa` fora do caderno Calendar: sem a 2ª linha.
2. **R2 — notas datadas e "Daily notes"**
   - Chat › menu de tools: "Daily notes" aparece ligada (inclusive para quem a tinha desligada antes; só uma vez). Desligar, reiniciar o app: continua desligada. Religar.
   - Chat principal e Assistant: "o que tenho pra fazer na semana de 02 a 08/11?". Com o modelo chamando `notes_by_date`: notas TODOS com `Entrega: …` no cabeçalho, planos com Início/Fim no período como o campo que casou, e plano que atravessa a semana como `ongoing: Início … → Fim …`. Nenhuma TODOS aparece como ongoing.
   - Desligar a IA de um caderno de teste com uma nota datada nesta semana: ela não aparece no chat nem nos slash commands.
   - Numa nota do Calendar de um dia com nota datada (data ou propriedade): `/ask` traz o bloco `Notes dated on this day:` com o campo no cabeçalho; nota de caderno com IA desligada fora.
3. **R3/R4 — `/week`**
   - `/week` sozinho numa nota do Calendar de hoje fica válido (não "incompleto") e responde em duas seções "Feito"/"Falta" (ou "Done"/"To do", no idioma do usuário): concluídas dos últimos 7 dias em "Feito"; abertas, atrasadas, TODOS com tasks restantes e planos em andamento em "Falta", por prazo. Sem distribuição por dia e sem estimativa.
   - No log: bloco `Agenda — week summary around …` com `"Done" period` e `"To do" period`; seções Completed tasks, Open and overdue tasks, TODOS deliverables, Dated notes, Calendar daily notes; tasks de TODOS só sob a TODOS.
   - Numa nota do Calendar de uma data futura (ex.: 10/11): o "Done" vai até hoje.
   - `/week foco no MBA` foca no tema.
   - Fora do Calendar o `/week` continua indisponível (`calendarOnly`).
4. **R5 — `/planner`**
   - `/planner` sozinho numa nota comum: âncora hoje; detalha seg–dom da semana atual dia a dia e agrupa por semana até o último prazo aberto; estimativas marcadas como da IA; diz que usou 6 h/dia; seção de riscos quando não cabe.
   - Numa nota do Calendar da semana que vem: detalha aquela semana. Numa nota de semana passada: volta para a semana atual.
   - Na mesma nota, nova linha `/planner 4h por dia`: roda (não nasce "executed") e usa 4 h.
   - Num banco/caderno sem pendências: resposta curta dizendo que não há o que planejar.
   - Nada é alterado em tasks ou datas.
5. **R6 — tipo nos cards do Calendar**
   - Calendar (janela principal): num dia com notas datadas, o card de uma nota TODOS/Plan mostra ícone + nome do tipo na cor do tipo, antes do caderno; nota sem tipo só com o caderno; título/caderno longos cortam com reticências.
   - Janela keep: mesmos cards com o tipo.
6. **R7 — Quick Notes**
   - Ao abrir o app, o antigo Inbox aparece como "Quick Notes" (coluna, seletores de projeto, mover nota, Ctrl+P, Projects board, "New" do board sem caderno). Num caderno com documentos/RAG, as notas dele reindexam com "Notes — Quick Notes".
   - Coluna: linha fixa "Quick Notes" logo abaixo do Calendar, com ícone; sem alça de arrasto, sem rename por duplo clique, sem mover/excluir; botão de documentos e progresso de tasks quando houver. Clicar abre o caderno e mostra os subjects (dá para criar subject). Os outros cadernos continuam arrastáveis e com mover/excluir. Mover um caderno: o Quick Notes aparece como destino.
   - `/tasks #QuickNotes` numa nota e, no chat, "tasks do projeto QuickNotes" (`query_tasks`) acham o caderno.
   - "+" de caderno com o nome "quick notes": não cria; abre o Quick Notes. Renomear outro caderno para "Quick Notes": volta ao nome anterior. No chat, "Save to note" › novo caderno "Quick Notes": salva no Quick Notes, sem duplicata.
   - **Ctrl+N** com o foco no editor, no título, na busca da lista, no Chat, no Reader/Library, no Mincer e com a visão Tasks/board/Marks aberta: abre uma nota nova vazia no Quick Notes, com o cursor no título, sem abrir janela nova e sem o editor tratar a tecla.
   - Ctrl+N com modal aberto (Settings, Knowledge Base, Ctrl+P, confirmação de exclusão, mover caderno, merge de notas, tipos de nota): não faz nada. Nas janelas keep e Assistant: não faz nada. Ctrl+Shift+N: comportamento de antes.
7. **R8 — subject "Tasks" fora da coluna**
   - Abrir um caderno com tasks: a lista de subjects não mostra "Tasks"; caderno só com o subject "Tasks" mostra "Subjects" com o "+" e nenhum item.
   - Arrastar subjects num caderno com tasks; depois criar uma task nesse caderno: funciona, sem subject novo duplicado.
   - Ctrl+P › abrir uma nota-corpo de task (rótulo "Task"): abre a nota, com o caderno ativo e nenhum subject ativo; a lista de notas mostra as notas do caderno.
   - "New <tipo>" na lista de notas continua disponível.
   - Repetir o `SELECT COUNT(*) … LIKE 'tasks-%'`: mesmo número de antes.
8. **R10 — Shift+Enter dentro de marcação**
   - Em parágrafos separados: marca de atenção (com e sem rótulo), highlight, termo do Related content, negrito e link sobre um trecho com 1 e com 2 Shift+Enter; item de lista e de checklist com Shift+Enter (com e sem marca); célula de tabela com quebra. Trocar de nota e voltar (ou reiniciar): tudo continua num parágrafo/item/célula, com a marcação em todas as linhas.
   - Regressão: linhas em branco na raiz, consecutivas e em volta de embed/linked note/bloco `/tasks` continuam iguais após reabrir (1 linha em branco não duplica nem some).

### Orchestrator — decisão — 20261103140000
- Summary: Etapa 1 (desenvolvimento) concluída para R1–R8 e R10 em três codeAgents (E1–E8; E14; E9–E13 + E15). `npm run build` conferido pelo Orquestrador: passa. Nada commitado. R9 aguarda a escolha do Coordenador entre as opções do uxAgent (`DOCS/features/notebook_column_study/index.html`, decisões D1–D13).
- Inputs:
  - sessões dos codeAgents neste report
  - DOCS/features/notebook_column_study.md
- Decision: parar para o teste do Coordenador (roteiro consolidado na sessão do codeAgent de E9–E13/E15). Pontos a confirmar no teste: horizonte sem teto do `/planner` (em PRD o último prazo aberto é 2027-04-30); `/week` e `/planner` ainda fazem RAG nos documentos do caderno; renomeação "Quick Notes (old)" se já houver caderno com esse nome; `DOCS/specs/PRD.md` sem o `/planner` na lista de comandos. Revisão (codereviewAgent) só depois da confirmação do Coordenador.
- Next step: aguardando Coordenador (teste de R1–R8/R10 e escolha do R9).

### Orchestrator — decisão — 20261103150000
- Summary: o Coordenador escolheu a **Opção A (seções separadas)** do estudo do uxAgent para o R9 e pediu a implementação. As decisões D1–D13 não foram respondidas uma a uma; o Orquestrador segue o mockup `option-a.html` e, onde ele não define, o comportamento atual.
- Inputs:
  - DOCS/features/notebook_column_study.md (§4, §5 Opção A, §7)
  - DOCS/features/notebook_column_study/option-a.html
- Decision:
  - D1: Opção A apenas (sem a etapa 2 da B).
  - D2: bloco fixo com o rótulo "Views".
  - D3: Quick Notes com ícone `Lightning` em `--accent-late`, como no mockup (substitui o `NotePencil` da E11).
  - D4: selo de idade quando a nota mais antiga passa de 7 dias; contagem de notas (sem notas-corpo e arquivadas); "+" no hover com tooltip "New quick note (Ctrl+N)". A revisão na coluna Notes (mais antigas primeiro, "Move to…") fica fora.
  - D5: "All notes" no topo da seção Notebooks.
  - D7: ações do caderno como hoje (documentos, mover, excluir), ocupando espaço só no hover; o ícone de documentos aceso continua visível.
  - D8: mantém a alça de arraste.
  - D9: Tags e Marks recolhíveis, abertas por padrão, com total no cabeçalho e estado lembrado em `localStorage`.
  - D10: coluna recolhida com o trilho da Opção A (ícones das views, botão "Notebooks" com menu flutuante, ícones de Tags e Marks).
  - D11: sem o caminho "Caderno › Subject" no cabeçalho da coluna Notes.
  - D12: sem contagem por subject.
  - D13: mantém a linha "Set up a board…".
  - Comuns a todas as opções (§4): sem rótulo "Subjects" ("New subject" como última linha), um fundo de seleção só, subject com cara de subnível (12px, `--text-muted`, `FolderSimple`, linha-guia).
- Next step: codeAgent para o R9 (Opção A).

### CodeAgent — implementação inicial (R9, Opção A) — 20261103135000
- Summary:
  - Coluna em seções, como o `option-a.html`: **Views** (cabeçalho com o botão de recolher) com Quick Notes, Calendar, Tasks e os boards (ou "Set up a board…"); **Notebooks** (cabeçalho com o "+") com "All notes" no topo e só os cadernos do usuário; **Tags** e **Marks** recolhíveis.
  - Quick Notes: 1ª view, ícone `Lightning` em `--accent-late` (sai o `NotePencil` da E11), contagem de notas (sem notas-corpo de task e sem arquivadas), selo `Nd` quando a nota mais antiga passa de 7 dias (tooltip "Oldest note: N days"), progresso de tasks, documentos e "+" no hover ("New quick note (Ctrl+N)", chama o mesmo `handleQuickNote` do Ctrl+N). Os subjects continuam abrindo sob ele quando ativo.
  - Caderno do usuário: ícone `Notebook` 14px + nome em 500. Subjects só no caderno ativo, sem o rótulo "Subjects": 12px, `--text-muted`, `FolderSimple` 12px, linha-guia de 1px em `--hair` alinhada ao centro do ícone do caderno; "New subject" (itálico) como última linha, inclusive em caderno sem subjects (resolve o "Subjects" vazio deixado pela E13).
  - Um fundo de seleção só: com subject aberto, o caderno (ou o Quick Notes) fica como "pai" (texto `--text-primary`, ícone roxo, sem fundo).
  - Ações de hover (documentos, mover, excluir, "+", e as do subject) com `display: none` fora do hover; o ícone de documentos aceso continua sempre visível.
  - Tags/Marks: cabeçalho-botão com seta (`CaretRight` gira 90°) e total à direita (nº de tags; total de marcas); abertos por padrão; estado em `localStorage` (`monet:notebook-tags-collapsed`, `monet:notebook-marks-collapsed`) com try/catch. "all marks" passou a "All marks", como "All notes".
  - Coluna recolhida (48px): trilho com expandir, Quick Notes (contagem em badge), Calendar, Tasks, boards (ou o ícone de "Set up a board…"), botão "Notebooks" com menu flutuante (All notes + cadernos com progresso; fecha ao escolher, com Esc ou clique fora; `position: fixed`, z-index 1100) e ícones de Tags (`Hash`) e Marks (`Highlighter`); rodapé com Knowledge Base e Settings empilhados.
  - App: `quickNotesStats` (memo sobre `notes`) e as props `quickNotesCount`, `quickNotesOldestAt`, `onNewQuickNote`.
  - Código morto removido: cabeçalho "Subjects" com o "+" (`.subjectHeader`, `.subjectHeaderLabel`, `.subjectAdd`), `.dragHandle`/`.subjectDragHandle` (a alça agora divide o lugar do ícone), `.collapsedTop`, as regras `:focus-visible`/`opacity` das ações e os imports `Folder`/`NotePencil`.
- Files changed:
  - src/components/NotebookList/NotebookList.tsx
  - src/components/NotebookList/NotebookList.module.css
  - src/App.tsx
- Files created:
  - nenhum (harness só no scratchpad)
- Files removed:
  - nenhum
- Desvios do mockup:
  - Alça de arraste (D8) no lugar do ícone: o mockup não tem alça; com a alça antes do ícone, a linha-guia dos subjects ficaria 22px mais à direita e os subjects cortariam a 180px. Em repouso aparece o ícone `Notebook`/`FolderSimple`; no hover ele vira o `DotsSixVertical`. Clicar na alça não seleciona (como hoje).
  - Quick Notes tem também o progresso de tasks e o botão de documentos (o mockup só mostra selo, contagem e "+"); o §4 do estudo pede documentos acessíveis. No hover, numa coluna estreita, o nome encurta.
  - O botão de documentos não fica mais visível só por a linha estar ativa (antes `.active .rowDocs`); aparece no hover ou quando aceso, como no mockup.
  - Ícone Tags do trilho abre a TagView na 1ª tag em ordem alfabética (a TagView exige uma tag; os chips trocam); fica desabilitado sem tags. Marks abre "All marks"; desabilitado sem marcas. Clicar no ativo fecha.
  - Badge do trilho com 10px (o mockup usa 9px; o piso dos badges numéricos é 10px).
  - "no notebooks" aparece sempre que não há caderno do usuário (antes só quando também não havia Calendar).
- Verificação:
  - `npm run build` (tsc + vite) sem erros; só os avisos antigos de chunk/dynamic import.
  - Harness no scratchpad (`h/main.tsx`, Vite na 5231, dados falsos com os nomes do mockup) no painel do navegador, a 220px e 180px: caderno ativo com subject ativo (só o subject com fundo, caderno "pai"; guia alinhada ao ícone: ícone em 28–46px, guia em 36px); hover do caderno (alça no lugar do ícone + documentos, mover, excluir) e do subject (alça + turn into notebook, excluir); "+" do Quick Notes chama `onNewQuickNote` sem selecionar a linha; "New subject" chama `onCreateSubject`; Quick Notes ativo com o subject dele; Tags e Marks recolhidos (estado gravado no `localStorage`); coluna recolhida com o menu "Notebooks" aberto (escolher fecha e seleciona; Esc fecha); Tags do trilho abre a 1ª tag. Linhas de 34px, subjects de 28px. Servidor derrubado ao final. App não rodado.
- Left behind:
  - O `<li>` vazio do `subjectContainer` de cada caderno fechado continua somando 2px de gap na lista (já era assim).
  - Caminho "Caderno › Subject" no cabeçalho da coluna Notes (D11) e a revisão do Quick Notes na coluna Notes (D4) ficaram fora, como decidido.
  - Teste no `tauri:dev` pendente (Coordenador; roteiro abaixo).

#### Roteiro de teste do R9 no `npm run tauri:dev`
Banco dev (`com.monet.app.dev`). Se o app não subir: matar o `monet.exe` órfão de `src-tauri\target\debug`; "readonly database": `icacls src-tauri\target /setintegritylevel M`.

1. **Seções:** a coluna mostra "Views" (Quick Notes, Calendar, Tasks, boards ou "Set up a board…"), "Notebooks" ("All notes" + cadernos do usuário, sem Calendar e sem Quick Notes), "Tags" e "Marks". O botão de recolher fica no cabeçalho "Views"; o "+" de caderno, no de "Notebooks".
2. **Quick Notes:** ícone de raio amarelo; contagem igual ao número de notas da lista do Quick Notes (sem notas-corpo de task e sem arquivadas; arquivar uma nota baixa a contagem). Com uma nota criada há mais de 7 dias (ou com o `created_at` alterado no banco dev), aparece o selo `Nd`. No hover: documentos e "+"; o "+" abre uma nota nova no Quick Notes com o foco no título (igual ao Ctrl+N). Sem arrastar, sem rename por duplo clique.
3. **Cadernos:** ícone de caderno + nome em peso 500; no hover o ícone vira a alça e aparecem documentos, mover e excluir; em repouso nenhuma ação ocupa espaço (nome curto não é cortado), só o ícone de documentos aceso. Arrastar pela alça reordena (e persiste após reiniciar); duplo clique renomeia; mover e excluir pedem confirmação como antes; documentos abre o modal.
4. **Subjects:** só no caderno ativo, menores e mais apagados, com pasta e linha-guia; sem o rótulo "Subjects"; a última linha "New subject" cria um subject (também num caderno que só tem o subject "Tasks"). Clicar num subject: só ele fica com fundo; o caderno fica com texto claro, sem fundo. Arrastar subjects, renomear por duplo clique, "Turn into notebook" e excluir funcionam. O subject "Tasks" continua fora.
5. **Views:** Calendar, Tasks e boards abrem como antes; com uma view aberta nenhum caderno aparece ativo. Progresso de tasks (`2/5`, vermelho com atraso) nos cadernos e no Quick Notes.
6. **Tags/Marks:** clicar no cabeçalho recolhe/abre (a seta gira); total no cabeçalho; reiniciar o app mantém o estado de cada uma. Clicar numa tag/rótulo abre a lista; clicar no ativo fecha.
7. **Coluna recolhida:** recolher pelo botão de "Views". Trilho: expandir, Quick Notes (badge com a contagem), Calendar, Tasks, boards, "Notebooks", Tags e Marks, com tooltips. "Notebooks" abre o menu flutuante ao lado (por cima da coluna Notes) com "All notes" e os cadernos; escolher um troca de caderno e fecha; Esc ou clique fora fecha. Tags abre a lista de tags (1ª tag, chips para trocar); Marks abre "All marks"; clicar de novo fecha. Knowledge Base e Settings no rodapé. Expandir volta à coluna.
8. **Larguras:** arrastar a borda da coluna de 140 a 320px: nada quebra; nomes longos com reticências.

### Orchestrator — decisão — 20261103170000
- Summary: R9 (Opção A) implementado; `npm run build` conferido pelo Orquestrador: passa. Com isso, R1–R10 estão no código da `feat/agenda-quicknotes`, sem commit e sem teste no app. Os dados de PRD foram clonados para o dev (`clone_prod_to_dev`, backup em `com.monet.app.dev.bak-20261103164313`); a chave do OpenRouter do dev (antiga, de 22/06) foi trocada pela de produção a pedido do Coordenador. Na primeira abertura do dev depois do clone a tela veio vazia, sem gravação no banco: provável corrida de lock da abertura a frio (reindexação pós-clone segurando o `monet.db`); orientado F5.
- Inputs:
  - sessão do codeAgent do R9 neste report
- Decision: aguardar o teste final do Coordenador (roteiros consolidados nas sessões dos codeAgents de E9–E15 e do R9). Revisão (codereviewAgent) só depois da confirmação.
- Next step: aguardando Coordenador.

### Orchestrator — decisão — 20261103171500
- Summary: tela vazia no dev depois do clone de PRD investigada. Banco íntegro (integrity ok, 214 notas, migrations iguais às do código, lock de escrita livre); código compila e o Vite serve todos os módulos. Com o clone de volta e o app aberto pelo Orquestrador (exe já compilado + Vite novo + `--remote-debugging-port=9333`), as três janelas carregaram os dados (11 cadernos, 214 notas), a coluna mostrou a Opção A e a migração "Inbox" → "Quick Notes" rodou. A causa das aberturas vazias anteriores não foi reproduzida; hipóteses: corrida de lock da primeira abertura a frio após o clone (reindexação pesada) ou o Vite antigo servindo o código no meio da edição do codeAgent do R9.
- Inputs:
  - CDP nas janelas main, keep e assistant
- Decision: dev fica com o clone de PRD; o dev anterior está em `com.monet.app.dev.restored`. Se a tela vazia voltar numa abertura fria, investigar com CDP desde o primeiro segundo (log do `TauriStorage.load`).
- Next step: aguardando o teste do Coordenador.

### Orchestrator — decisão — 20261103172000
- Summary: causa da tela vazia achada (não é bug do código). O Claude desktop é um app MSIX e o Windows virtualiza o AppData dos processos dele: o clone, a troca da chave e as trocas de pasta feitos pelo Orquestrador foram gravados em `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\` e só são vistos por processos iniciados pela sessão. O `npm run tauri:dev` do Coordenador lê o `%APPDATA%\com.monet.app.dev` real, que continua sendo o dev de antes (2 cadernos, sem chave). Confirmado por CDP: no app do Coordenador, `appConfigDir` = `...\Roaming\com.monet.app.dev` com 2 cadernos; na leitura do Orquestrador, o mesmo caminho tinha 214 notas. Produção nunca foi gravada.
- Inputs:
  - CDP nas janelas do `tauri:dev` do Coordenador
- Decision: o clone de PRD para o dev tem de ser feito pelo Coordenador no terminal dele (ou copiando a pasta virtualizada para a real). Nenhuma escrita em `%APPDATA%` a partir da sessão.
- Next step: Coordenador copia os dados e testa.

### Orchestrator — decisão — 20261103180000
- Summary: dois ajustes pedidos pelo Coordenador e feitos pelo Orquestrador. (1) Views: Calendar passou para a 1ª posição (Calendar, Quick Notes, Tasks, boards), no trilho recolhido e na lista aberta (`NotebookList.tsx`). (2) Filtro da lista de notas: o select de tipo ganhou a seção "Subjects" (optgroups "Types"/"Subjects", valores `type:`/`subject:`; "All" limpa os dois; escolher um subject = clicar nele na coluna, via `handleSelectSubject`; só aparece com caderno aberto, sem o subject oculto "Tasks") em `Sidebar.tsx`, `Sidebar.module.css` e `App.tsx`. `npm run build` passa; não visto no app (dev real quase vazio).
- Inputs:
  - pedidos do Coordenador no chat
- Decision: o Coordenador pediu para seguir sem o teste dele: uxAgent sobre a task completa (R1–R10 + os dois ajustes), triagem das sugestões pelo Orquestrador (implementar só as que valem a pena), depois Etapa 2 (codereviewAgent + passada final do codeAgent).
- Next step: uxAgent.

### uxAgent — revisão da task — 20261103144040
- Summary: boa para o usuário, com ressalvas; sem problema crítico ou alto. A trilha de IA (data de hoje, `/week` Done/To do, `/planner` que só sugere) e o Ctrl+N resolvem os objetivos; a coluna ficou mais clara. 17 achados (U1–U17), 7 médios: Ctrl+N grava nota vazia a cada toque (U1), ações de hover empurram o nome do caderno (U2), linha do Quick Notes sobrecarregada (U3), selo `Nd` sem caminho de triagem (U4), filtro de subject mistura filtro e navegação (U5), `/planner` sem regra de fim de semana e com 6 h fixas (U6) e sem teto de horizonte (U7). 5 oportunidades (U18–U22), a principal: Calendar mostrar notas pelas datas das propriedades, como a IA já faz (U18). Larguras e hover são estimativa de CSS, não medidas (app não rodado).
- Output: DOCS/reports/03-11-2026/uxreport_20261103144040.md

### Orchestrator — decisão — 20261103184500
- Summary: triagem do uxreport e ajustes feitos pelo Orquestrador. Implementados: U1 (Ctrl+N ignora `e.repeat`; reaproveita a nota vazia do Quick Notes, a aberta primeiro, em vez de criar outra; nota vazia não entra na contagem nem no selo de idade; `aria-modal` no `NotePicker` e no `MarkNotePicker`), U2/U3 (ações de hover em `.rowActions`: por cima do fim da linha, com o fundo da própria linha, sem encolher o nome; o "+" do Quick Notes cabe a 180px), U9 (as ações aparecem com o foco pelo Tab, via `:focus-within`), U6 (`/planner`: sábado e domingo sem trabalho, salvo Parameter ou do date), U7 (`/planner`: semana do cabeçalho dia a dia + 3 semanas por semana; depois, uma linha por entrega com prazo e horas), U8 (descrições curtas de `/week` e `/planner`), U12 (separador `·` e reticências no tipo do card do Calendar), U14 (`/week` abre cada seção com o período). `npm run build` passa; hover/foco medidos no harness do scratchpad a 180px (DOM: overlay absoluto, nome com a largura inteira, botões visíveis).
- Inputs:
  - `DOCS/reports/03-11-2026/uxreport_20261103144040.md`
- Decision: ficam para depois (decisão ou proposta ao Coordenador): U4 (ordenar Quick Notes por idade), U5 (filtro de subject sem trocar a nota aberta), U10, U11, U13, U15, U17; decisões de produto U16 (subjects no Quick Notes) e U19 (`/week` fora do Calendar); oportunidades U18 (Calendar pelas datas das propriedades), U20, U21, U22. Limite aceito do U2: a 180px o overlay das 3 ações cobre a maior parte do nome no hover (sem reflow).
- Next step: Etapa 2 (codereviewAgent).

### CodeReviewAgent — 20261103145614
- Summary: R1–R10 conferidos no diff (27 arquivos de código + `src/lib/agenda.ts`); `npm run build` passa. Sem crítico. 2 importantes: `/planner` numa nota do Calendar anterior a hoje perde o conteúdo da nota aberta (`noteContent` zerado e a janela começa em hoje); clicar no ícone-alça de caderno/subject não seleciona e o `:focus-within` deixa a linha acesa (2º fundo na coluna). 8 nits (orçamento das tasks sob TODOS, diária arquivada, janela longa do planner, Ctrl+N com board por cima e com debounce, select com tipo+subject, tipos na keep). `src-tauri/Cargo.toml` sem mudança de conteúdo (mesmo blob do índice; só stat/EOL), não é desta task.
- Verdict: APROVADO COM RESSALVAS
- Output: DOCS/reports/03-11-2026/reviewreport_20261103145614.md

### Orchestrator — encerramento — 20261103190000
- Summary: passada final sobre o reviewreport feita pelo Orquestrador (no lugar do codeAgent, com o contexto da sessão). Corrigidos os dois [importante]: (1) `/planner` numa nota do Calendar de dia passado volta a mandar o conteúdo da nota aberta (zerado só com `calendarKey >= todayKey`); (2) coluna: o ícone/alça do caderno e do subject deixa de parar o clique (clique sem arraste seleciona; o PointerSensor só arrasta depois de 5px) e as regras de foco usam `:has(:focus-visible)` (o foco do clique não deixa mais um segundo fundo nem as ações à mostra). Nits corrigidos: nota diária arquivada fora da agenda (`selectAgenda`); Ctrl+N sobre Tasks/board com a nota vazia já aberta fecha a área. `npm run build` passa.
- Inputs:
  - `DOCS/reports/03-11-2026/reviewreport_20261103145614.md`
- Decision: ficam como estão (nits): tasks sob uma TODOS sem orçamento de tamanho; janela de dados do `/planner` até o último prazo (só o prompt limita); Ctrl+N logo após digitar numa nota vazia pode voltar a ela (debounce); select mostra só o tipo quando tipo e subject filtram juntos (junto com U5); tipos de nota carregados uma vez na janela keep; RAG de documentos em `/week`/`/planner` (bug extra já registrado). `Cargo.toml` aparece `M` só por fim de linha/data, sem diff de conteúdo. Pendências de UX da triagem 20261103184500. Nada testado no app real; sem commit.
- Next step: teste do Coordenador no `npm run tauri:dev` (com os dados de PRD copiados pelo terminal dele).
