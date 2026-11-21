# Execution Report

## Documents
- Task report: `DOCS/reports/20-11-2026/taskreport_20261120115512.md`
- Execution report: `DOCS/reports/20-11-2026/executionreport_20261120115512.md`
- Explorer report (fases A–C): `DOCS/reports/20-11-2026/explorerreport_20261120120927_a-c.md`
- Explorer report (fases D–E): `DOCS/reports/20-11-2026/explorerreport_20261120121005_d-e.md`
- Plan report (fases A–C): `DOCS/reports/20-11-2026/planreport_20261120122642_a-c.md`
- Plan report (fases D–E): `DOCS/reports/20-11-2026/planreport_20261120131834_d-e.md`
- UX report (fatia 1, trackers e Log): `DOCS/reports/20-11-2026/uxreport_20261120132714_trackers-log.md`
- UX report (fatia 2, Radar e Papers): `DOCS/reports/20-11-2026/uxreport_20261120151417_radar-papers.md`
- UX triage: `DOCS/reports/20-11-2026/uxtriage_20261120133108.md`
- Review report (fases A–C): `DOCS/reports/20-11-2026/reviewreport_20261120151608_trackers-log.md`
- Review report (fases D–E, Radar e `/since`): `DOCS/reports/20-11-2026/reviewreport_20261120163711_radar-since.md`
- Review report (fases D–E, Papers e interface): `DOCS/reports/20-11-2026/reviewreport_20261120163843_papers-ui.md`

## Sessions
### Orchestrator — abertura — 20261120120053
- Summary: Task Report aprovado pelo Coordenador. Branch `feat/radar-trackers` criada a partir de `feat/mincer` (141f067). Execução contínua até a entrega para teste, sem parada entre as etapas.
- Inputs:
  - `DOCS/reports/20-11-2026/taskreport_20261120115512.md`
- Decision: a task toca Calendar, tipos de nota, agentes, busca, bibliotecário, Library e Mincer, e cria tabelas novas. Por isso há exploração e planejamento antes do código. A exploração roda em duas frentes paralelas, só leitura: fases A–C (trackers, Log e agentes) e fases D–E (Radar e Papers). Modelos: explorer e planner em Opus 5.5, `codeAgent` em Sonnet 5.5, `uxAgent` e `codereviewAgent` em Opus 5.5.
- Next step: `explorerAgent` (duas frentes) → `plannerAgent` → `codeAgent` por fase (A, B, C, D, E).

### ExplorerAgent — fases A–C — 20261120120927
- Summary: as fases A–C são viáveis sem Rust nem migration nova. As tabelas `trackers` e `tracker_marks` e a coluna `note_types.log` nascem por `ensure*` idempotente no storage, que vale para banco antigo e novo. As marcas precisam de um evento próprio entre janelas, no padrão do `tasks-changed`. O Log segue o padrão do Board e toca cerca de 6 pontos do `App.tsx`. A tool `query_trackers` segue o padrão da `query_tasks` e lê o storage na chamada. Decisões abertas: a regra do Coach sem plano, o formato do Plan week e os dias fora do trabalho, a "semana em foco", o denominador de "semanas na meta" e os chips na keep (que não tem `topSlot`). Nenhuma mudança de escopo obrigatória. `npm test` (105 testes) e `tsc --noEmit` estão limpos; `cargo check` não foi rodado.
- Output: `DOCS/reports/20-11-2026/explorerreport_20261120120927_a-c.md`

### ExplorerAgent — fases D–E — 20261120121005
- Summary: dificuldade Alta. O Radar e o Papers precisam de um pipeline do app dentro do `buildContext`, com `signal`, gancho de fim de turno e itens gravados na mensagem. As ações por item entram nos dois balões (`ChatMessageBubble` e `NotesChatPanel`). O `/since`, o filtro de data do Tavily (`start_date` + `filter_by_published_date`; `days` não existe mais) e o tipo Paper com board seguem padrões existentes. Para decidir: o Crossref não cobre arXiv nem a maior parte de ML (404 testado); `sort=is-referenced-by-count` com `query` descarta a relevância (testado), então é preciso reordenar no app; a política `web: true` segue o toggle e furaria o teto de 6 buscas; o "Add to KB" pode gravar sem que o chat leia (`webResearchEnabled`); `proceedings-article` fica fora pelo edge case. A última consulta vai numa tabela `radar_scope_state` criada por `ensure*`.
- Output: `DOCS/reports/20-11-2026/explorerreport_20261120121005_d-e.md`

### Orchestrator — decisão — 20261120121205
- Summary: decisões sobre os pontos abertos do explorer das fases A–C (§8 do relatório). Nenhuma muda o escopo do Task Report; todas detalham requisitos já aprovados.
- Inputs:
  - `DOCS/reports/20-11-2026/explorerreport_20261120120927_a-c.md`
- Decision:
  1. **Coach:** a regra "sem plano ativo, oferecer `/planner`" passa a valer só quando não há plano nem tracker ativo. Só com trackers, o Coach cobra os trackers.
  2. **Plan week:** o contrato dos dias não muda. Os trackers entram numa seção "Trackers" depois dos dias, com uma linha por tracker: as sessões que faltam e os dias sugeridos, que podem ser qualquer dia da semana, inclusive o fim de semana. As sessões não têm horas, não consomem capacidade e não entram no teto de 4 itens por dia.
  3. **Semana em foco:** derivada, sem estado novo. É a semana do dia selecionado quando ele está no mês exibido; senão, a semana de hoje se o mês exibido é o atual; senão, a última semana do mês exibido. Os dias da semana em foco que caem no mês vizinho continuam clicáveis.
  4. **Semanas na meta:** o denominador conta as semanas já terminadas e a semana atual só quando ela já bateu a meta. As semanas anteriores ao início do tracker ficam de fora; o início é a criação ou a primeira marca, o que vier antes. A semana pertence ao mês em que cai a quinta-feira dela.
  5. **Nota do tipo vinculado com data futura:** não conta; dias depois de hoje são ignorados.
  6. **Chips na keep:** entram, com inserção própria acima do editor, dependendo só da chave do dia.
  7. **`App.tsx`:** hooks e componentes ficam fora dele; no `App.tsx` só a fiação.
  8. **Período do Log:** janela móvel terminando hoje (30 dias, 90 dias, 12 meses).
  9. **Agrupamento por Text:** `trim().toLowerCase()`, mantendo os acentos.
  10. **Cadernos com IA desligada:** os dias vindos de nota contam, porque só a contagem vai aos agentes, sem texto.
  11. **Tipo vinculado apagado:** limpar o vínculo ao remover o tipo e ler de forma defensiva (tipo inexistente = sem vínculo).
  12. **Teto de pontos na célula do Calendar e largura de 220 px na keep:** o planejador define um teto inicial (até 3 pontos e "+"); o `uxAgent` avalia no fim.
- Next step: aguardar o explorer das fases D–E e então spawnar o `plannerAgent`.

### Orchestrator — decisão — 20261120121340
- Summary: decisões sobre os pontos do explorer das fases D–E ("Pontos que pedem decisão de escopo" e §12 do relatório). Um ponto muda o escopo aprovado e foi levado ao Coordenador; os demais detalham requisitos já aprovados. O planejamento foi dividido em dois planos para as fases A–C não esperarem essa resposta.
- Inputs:
  - `DOCS/reports/20-11-2026/explorerreport_20261120121005_d-e.md`
- Decision:
  1. **Fonte acadêmica (pendente do Coordenador):** o Crossref não cobre arXiv nem a maior parte dos anais de computação, e o OpenAlex está em "Fora de escopo" no Task Report. Abrir essa exceção é mudança de escopo. Conferido na documentação atual do OpenAlex (help.openalex.org, 2026-11-20): consultas básicas funcionam sem chave, com orçamento diário gratuito, e a chave gratuita aumenta o orçamento. A documentação não fala de CORS. Enquanto não houver resposta, vale o escopo aprovado (Crossref), e a fonte fica atrás de uma função única para poder ser trocada.
  2. **E2, fundamentais:** buscar por relevância (30 a 40 resultados) e reordenar por citações no app. Não usar `sort=is-referenced-by-count` junto com `query`.
  3. **D1, web do Radar e do Papers:** o app roda o pipeline dentro do `buildContext`, com `context: { rag: false, web: false, deepResearch: false }` e um campo novo no `ChatAgentDef` para o composer exigir a chave do Tavily. O modelo não recebe a tool `web_search`. O `AgentContextInput` ganha `signal` (o Stop cancela as buscas), há um gancho de fim de turno (a data do D5 só avança quando a resposta termina) e a mensagem guarda os itens que o app montou.
  4. **Triagem:** sem chamada extra ao bibliotecário. O app filtra por data, duplicados e URL já na KB, e o modelo principal escolhe até 8 itens por marcador de candidato. O app desenha os itens a partir do payload, então o Radar também não mostra item inventado.
  5. **Add to KB:** opção (a) do explorer. No chat sem pasta o botão não aparece. Com "Save web sources" desligado na pasta, a confirmação avisa e liga o toggle. O clique é a curadoria: sem triagem nem julgamento.
  6. **Tipos do Crossref:** `proceedings-article` entra, junto de `journal-article`, `posted-content`, `book-chapter`, `book` e `monograph`.
  7. **Filtro de data do Tavily:** parâmetro opcional novo em `webSearch`, com `start_date` e `filter_by_published_date`, sem mudar o body das chamadas atuais. A spec registra que o `published_date` pode ser a data de atualização da página.
  8. **Send to Mincer:** emitir `mincer://changed` depois do `mincerStart`, para a lista do Mincer atualizar.
  9. **Open in Library:** comando Rust novo em `books.rs` para baixar o PDF, `registerBookFile` extraído de `importBook`, vínculo com a nota por `setReaderNoteLink` e um jeito de abrir o livro de fora da Library.
  10. **Escopo dos agentes:** mover a resolução de escopo do tutor para um módulo comum e acrescentar tag e board, sem mudar o comportamento do tutor.
  11. **Última consulta do Radar:** tabela `radar_scope_state` criada por `ensure*`, sem migration nova.
- Next step: `plannerAgent` das fases A–C agora; `plannerAgent` das fases D–E depois, com a fonte acadêmica que o Coordenador escolher.

### PlannerAgent — fases A–C — 20261120122642
- Summary: o plano das fases A–C tem 12 etapas na A (tipos, storage por `ensureTrackersTables`, evento `trackers-changed`, `src/lib/trackers.ts` com testes, `useTrackers`, `IconPicker` extraído, `TrackersModal`, faixa e pontos no Calendar, chips na main e na keep), 12 na B (`NoteType.log`, `src/lib/noteLog.ts` com testes, coluna `note_types.log`, seção Log no modal de tipos, visão Log na coluna das notas, linhas na coluna de cadernos, `setUpPracticeType`, vínculo do tracker) e 10 na C (formatadores do app para a IA, `loadTrackerData`, `forceTrackersTool`, Coach, Plan week, `/week-review`, tool `query_trackers` com toggle e docs). Fecha os contratos (tipos, tabelas, storage, evento, hook, formato do resumo) e os pontos de contato com D–E. Sem mudança de escopo; as escolhas que detalham requisitos estão listadas no plano.
- Output: `DOCS/reports/20-11-2026/planreport_20261120122642_a-c.md`

### Orchestrator — decisão — 20261120123328
- Summary: plano das fases A–C aceito, com as sete escolhas da seção "Escolhas deste plano". A visão Log na coluna das notas (em vez da área inteira, como o board) fica para o `uxAgent` avaliar no fim.
- Inputs:
  - `DOCS/reports/20-11-2026/planreport_20261120122642_a-c.md`
- Decision: a Fase A é grande para um único `codeAgent`, como o planejador apontou. Ela roda em dois `codeAgent` em sequência: primeiro as etapas A1–A5 (tipos, storage, evento, lógica pura com testes e hook), depois as etapas A6–A12 (interface, fiação na main e na keep e verificação). As fases B e C seguem com um `codeAgent` cada. Todos em Sonnet 5.5.
- Next step: `codeAgent` da Fase A, etapas A1–A5.

### CodeAgent — implementação inicial (Fase A, etapas A1–A5) — 20261120123857
- Summary: tipos `Tracker`/`TrackerMark`; storage dos trackers (`ensureTrackersTables` e os seis métodos no `TauriStorage`, interface `StorageAdapter` e stubs do `BrowserStorage`); evento `trackers-changed` (`tasksEvents.ts` generalizado por nome de evento, sem mudar quem já o usa); lógica pura `src/lib/trackers.ts` com 35 testes; hook `useTrackers`. Sem migration e sem componentes. `npx tsc --noEmit` limpo; `npm test`: 10 arquivos, 140 testes (antes 9 e 105). Desvio: `formatMonthLine` usa "week" no singular com 1 semana contada.
- Files changed:
  - `src/types/index.ts`
  - `src/storage/tauri.ts`
  - `src/storage/index.ts`
  - `src/storage/browser.ts`
  - `src/lib/tasksEvents.ts`
  - `DOCS/reports/20-11-2026/planreport_20261120122642_a-c.md` (status A1–A5: FEITO)
- Files created:
  - `src/lib/trackers.ts`
  - `src/lib/trackers.test.ts`
  - `src/hooks/useTrackers.ts`
- Files removed:
  - nenhum
- Left behind: nada das etapas A1–A5. Seguem para o próximo `codeAgent` as etapas A6–A12 (IconPicker, TrackersModal, faixa e pontos no Calendar, chips, fiação na main e na keep, verificação). Não verificado em execução real: as tabelas e os métodos de storage só passaram por type-check (o app não foi iniciado).

### CodeAgent — implementação inicial (Fase A, etapas A6–A12) — 20261120124827
- Summary: `IconPicker` extraído do modal de tipos (sem mudança de comportamento); `TrackersModal` (lista com setas e grupo "Archived", detalhe com nome, meta, cor, ícone, Archive/Unarchive e Delete com contagem de marcas); `TrackersStrip` (faixa "Trackers" de 3 linhas por tracker, pensada para 220 px) e pontos na grade do Calendar (até 3 e "+", rótulo da célula com "<nome> done"); `TrackerChips`; fiação na main (`useTrackers`, chips no `topSlot` antes do `DueTodayBlock`, props do `CalendarView`, modal) e na keep (`useTrackers`, chips fora do `.body` num `.notePane` novo, dia pela chave do título, props do `CalendarView`, modal). `npx tsc --noEmit` limpo; `npm test`: 10 arquivos, 140 testes; `npx vite build` ok. Um teste de fumaça temporário (happy-dom, já removido) passou 11 asserções de faixa, chips, grade e modal.
- Files changed:
  - `src/components/NoteTypes/NoteTypesModal.tsx`
  - `src/components/CalendarView/CalendarView.tsx`
  - `src/components/CalendarView/CalendarView.module.css`
  - `src/components/KeepPanel/KeepPanel.tsx`
  - `src/components/KeepPanel/KeepPanel.module.css`
  - `src/App.tsx`
  - `DOCS/reports/20-11-2026/planreport_20261120122642_a-c.md` (status A6–A12: FEITO)
- Files created:
  - `src/components/NoteTypes/IconPicker.tsx`
  - `src/components/Trackers/TrackersModal.tsx`
  - `src/components/Trackers/TrackersModal.module.css`
  - `src/components/Trackers/TrackersStrip.tsx`
  - `src/components/Trackers/TrackersStrip.module.css`
  - `src/components/Trackers/TrackerChips.tsx`
  - `src/components/Trackers/TrackerChips.module.css`
- Files removed:
  - nenhum
- Left behind: nada das etapas A6–A12. Não verificado com o app aberto: aparência da faixa em 220 px, da célula com nota + task + 3 pontos (o conteúdo pode chegar a 31 px contra o mínimo de 28 px) e dos chips na keep; criação das tabelas na primeira leitura em duas janelas ao mesmo tempo (main e keep); persistência e sincronização das marcas entre main e keep. O uxAgent avalia o teto de 3 pontos e a altura da faixa na keep.

### CodeAgent — implementação inicial (Fase B, etapas B1–B4) — 20261120125500
- Summary: tipo `NoteLogConfig` e campo `NoteType.log` (literais atualizados); `src/lib/noteLog.ts` (config, resolução defensiva, limpeza de propriedade, período móvel, entradas, agregação e `practiceSaveChanges`) com 28 testes; coluna `note_types.log` por `addMissingColumns` (leitura, gravação e `deleteNoteType` que limpa `trackers.linked_type_id`); `useNoteTypes` (`removeDef` limpa board e Log numa gravação só; `removeType` emite `trackers-changed`). Sem migration e sem componentes. `npx tsc --noEmit` limpo; `npm test`: 11 arquivos, 168 testes (antes 10 e 140). O `validName` do `useTrackers` ficou como está (a B4 não mexe no do `useNoteTypes`).
- Files changed:
  - `src/types/index.ts`
  - `src/hooks/useNoteTypes.ts`
  - `src/lib/planNotes.ts`
  - `src/lib/noteSearch.test.ts`
  - `src/storage/tauri.ts`
  - `DOCS/reports/20-11-2026/planreport_20261120122642_a-c.md` (status B1–B4: FEITO)
- Files created:
  - `src/lib/noteLog.ts`
  - `src/lib/noteLog.test.ts`
- Files removed:
  - nenhum
- Left behind: nada das etapas B1–B4. Seguem para o próximo `codeAgent` as etapas B5–B12. Não verificado em execução real: a coluna `note_types.log` e o `UPDATE trackers` do `deleteNoteType` só passaram por type-check (o app não foi iniciado). O `removeType` não recarrega os trackers da própria janela (o evento ignora a origem); isso é seguro porque os dias vindos de nota e o `TrackersModal` leem o vínculo de forma defensiva.

### Orchestrator — decisão — 20261120125612
- Summary: o Coordenador aprovou a mudança de escopo da fonte acadêmica ("Sim, OpenAlex"). O OpenAlex sai de "Fora de escopo" e passa a ser a fonte do Papers e da parte de artigos do Radar. Semantic Scholar e arXiv direto continuam fora. O Task Report não foi reeditado; esta sessão registra a mudança.
- Inputs:
  - resposta do Coordenador à pergunta levantada na sessão de decisão 20261120121340, item 1
  - documentação do OpenAlex lida em 2026-11-20 (help.openalex.org: rate limits and authentication, search works, filter works, works attributes, pricing, sorting)
- Decision:
  1. **Fonte:** o Papers (E2 a E4) e as consultas de artigos novos do Radar (D6) usam o OpenAlex. O Crossref continua só no bibliotecário atual, sem mudança. A fonte fica atrás de uma função única.
  2. **Sem fallback** para o Crossref quando o OpenAlex falhar. Orçamento diário esgotado (429), erro de rede e offline viram mensagem legível.
  3. **Chave:** as consultas funcionam sem chave. Uma chave gratuita do OpenAlex é um campo opcional em Settings, no padrão das outras chaves; sem ela, o app chama sem chave. O e-mail não é enviado (a documentação atual não fala mais de `mailto`).
  4. **Custo limitado:** até 4 buscas no OpenAlex por execução do Papers e até 3 por execução do Radar.
  5. **Fundamentais:** continua valendo buscar por relevância e reordenar por citações no app. O planejador confere na documentação se `search` com `sort=cited_by_count:desc` preserva a relevância antes de usar.
  6. **CORS:** a documentação não diz. O planejador confere com uma requisição real (sem dados do usuário) se a API responde com `Access-Control-Allow-Origin` aberto. Se não responder, a chamada passa por um comando Rust.
  7. **Campos:** o planejador confere na documentação os campos de autores, de tipo e de PDF de acesso aberto antes de fechar o contrato, sem responder de memória. O Unpaywall existente pode continuar resolvendo o PDF do "Open in Library" quando o OpenAlex não der um link direto.
  8. **Identidade do artigo:** DOI quando houver; sem DOI (comum em preprint), o planejador define a chave de dedupe e onde ela fica na nota Paper.
  9. **Tipos de obra:** artigo, artigo de conferência, preprint, capítulo e livro, nos nomes de tipo do OpenAlex.
- Next step: `plannerAgent` das fases D–E agora, em paralelo com o `codeAgent` da Fase B (o planejador só lê código).

### CodeAgent — implementação inicial (Fase B, etapas B5–B12) — 20261120130500
- Summary: seção "Log" no modal de tipos (`NoteTypeLogSection`, com "Open log"); visão `NoteLog` na coluna das notas (período 30 days/90 days/12 months, totais, grupos com sparkline em SVG, lista clicável que mantém a visão aberta) e `Sparkline`; linhas "<Tipo> · Log" na coluna de cadernos (expandida e no trilho); `setUpPracticeType` (propriedades antes do tipo, uma execução por linha); campo "Counts notes of type" no `TrackersModal` com a opção "Create/Set up 'Practice' type", leitura defensiva do vínculo e avisos do Practice; fiação no `App.tsx` (`MainArea` `noteLog`, memo `logs`, "gone", `openNoteLog`, props da `NotebookList`, ramo do `NoteLog`, `onOpenLog` e props do `TrackersModal`) e na keep (`loadNoteTypes` no mount e no `keep-shown`, props do modal). `npx tsc --noEmit` limpo; `npm test`: 11 arquivos, 168 testes; `npx vite build` ok. Um teste de fumaça temporário (happy-dom, já removido) passou 7 casos: `NoteLog`, seção Log, vínculo e atalho Practice no modal e linhas do Log na `NotebookList`.
- Files changed:
  - `src/components/NoteTypes/NoteTypesModal.tsx`
  - `src/components/NotebookList/NotebookList.tsx`
  - `src/components/Trackers/TrackersModal.tsx`
  - `src/components/Trackers/TrackersModal.module.css`
  - `src/components/KeepPanel/KeepPanel.tsx`
  - `src/App.tsx`
  - `DOCS/reports/20-11-2026/planreport_20261120122642_a-c.md` (status B5–B12: FEITO)
- Files created:
  - `src/components/NoteTypes/NoteTypeLogSection.tsx`
  - `src/components/NoteLog/NoteLog.tsx`
  - `src/components/NoteLog/NoteLog.module.css`
  - `src/components/NoteLog/Sparkline.tsx`
  - `src/lib/practiceSetup.ts`
- Files removed:
  - nenhum
- Deviations: (1) a `NotebookList` também trata o Log aberto como "view ativa" (nenhum caderno aparece ativo, como no board); (2) `onTypesChanged` do `TrackersModal` pode devolver uma `Promise` e o modal a espera antes de vincular, para o seletor já achar o tipo recém-criado; (3) defeito da B4 corrigido: o `onRemoved` do `useNoteTypes` no `App.tsx` agora também recarrega os trackers (`trackers.reload()`), porque sem isso um tracker salvo depois, na janela que apagou o tipo, regravaria o vínculo antigo (o banco já o limpou).
- Left behind: nada das etapas B5–B12. Segue para o `codeAgent` da Fase C. Não verificado com o app aberto: aparência da `NoteLog` (largura, rótulos longos, sparkline), da seção Log no modal, do campo "Counts notes of type" (o rótulo quebra em duas linhas em 92 px) e das linhas do Log na coluna de cadernos e no trilho; o atalho "Create 'Practice' type" contra o banco real (as gravações só passaram por type-check e pelo teste de fumaça com storage simulado); a sincronização do Practice entre main e keep.

### CodeAgent — implementação inicial (Fase C, etapas C1–C6) — 20261120131600
- Summary: C1 formatadores puros em `src/lib/trackers.ts` (`formatTrackersForAi`, `formatTrackersForPlanWeek`, `formatTrackersWeekForAi`, `TrackerQuery` e `queryTrackersText`), no texto do contrato, com 32 testes novos (o do Coach reproduz o exemplo do contrato literalmente). C2 `loadTrackerData`, `queryTrackersTool` e `loadTrackersWeekText` em `agentData.ts`. C3 `ChatAgentDef.forceTrackersTool` (false no General, Planner e Tutor; true no Coach e no Plan week) e os três textos do composer do Coach. C4 Coach: bloco dos trackers no contexto, regra "Trackers" no prompt, 1ª frase e parágrafo "Data" atualizados e a regra de perguntas só sem plano e sem tracker. C5 Plan week: bloco "Trackers" ao fim do contexto, conforme a cobertura (`thisWeek`/`nextWeek`), item em "Data", item "Trackers" em "Output" logo depois dos dias e o ajuste da regra de "no open tasks". C6 `/week-review`: `ContextPolicy.trackers`, seção "Trackers" no `behavior` ("Up to four short sections") e 3 linhas no `handleCommand` do `App.tsx`; o `/today` não muda. `npx tsc --noEmit` limpo; `npm test`: 11 arquivos, 200 testes (antes 168). A tool `query_trackers`, o toggle e a documentação ficam para C7–C10.
- Files changed:
  - `src/lib/trackers.ts`
  - `src/lib/trackers.test.ts`
  - `src/lib/agents/agentData.ts`
  - `src/lib/agents/chat.ts`
  - `src/lib/agents/planner.ts`
  - `src/lib/agents/tutor.ts`
  - `src/lib/agents/coach.ts`
  - `src/lib/agents/planWeek.ts`
  - `src/lib/agents/core.ts`
  - `src/lib/agents/weekReview.ts`
  - `src/App.tsx`
  - `DOCS/reports/20-11-2026/planreport_20261120122642_a-c.md` (status C1–C6: FEITO)
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Deviations: (1) `formatTrackersForPlanWeek` não recebe `typeNameById`: o texto do contrato não usa o nome do tipo e `noUnusedParameters` barra o parâmetro sem uso; a chamada da C5 foi escrita sem ele. (2) Singular em "1 day" e "1 week" (como o `formatMonthLine` da Fase A). (3) No resumo do Coach, a frase "Last month (…)" some quando o mês anterior não tem dia feito nem semana contada (o tracker ainda não existia), para o modelo não ler "0 days" como falha. (4) Textos de borda que o contrato não traz: `no candidate days left` (Plan week, domingo já feito) e `Days: none` (tool). (5) Na tool, o 1º item da linha "Weeks" leva "in the period" e os outros só o número, como no exemplo do contrato; as linhas "Weeks" e "Days" não terminam em ponto. (6) 1ª frase do Coach: "…and push for the pace needed to finish the plans" (o "them" ficaria ambíguo com os trackers).
- Left behind: nada das etapas C1–C6. Seguem C7 a C10 (tool `query_trackers` em `useChat.ts`, toggle "Trackers" no menu de tools, documentação, verificação da fase). Não verificado em execução real: os prompts do Coach, do Plan week e do `/week-review` não foram testados com um modelo (só o texto do contexto, por testes); `loadTrackerData` e `loadTrackersWeekText` leem o storage e só passaram por type-check (o app não foi iniciado). Não há harness de prompts no repositório, então nenhum foi rodado.

### CodeAgent — implementação inicial (Fase C, etapas C7–C10) — 20261120132000
- Summary: C7 tool `query_trackers` em `useChat.ts` (`ChatTools.trackers`, padrão da `query_tasks`: definição só com `supportsTools`, `mode !== 'reader'` e o toggle ou `forceTrackersTool` do agente do turno; ramo de execução que chama `queryTrackersTool` na hora; bucket `trackerResults`; mensagem de sistema `toolTrackersMessage` depois da de tasks). C8 switch "Trackers" no `ChatToolsMenu` (ícone `CheckCircle`, "On for <agente>" quando forçado, contagem no badge) e prop `trackersTool` no `ChatComposer` e no `NotesChatPanel`; o `ReaderChatPanel` não recebe. C9 `DOCS/specs/trackers.md` (10 seções), linha na tabela de Especificações do `docs.menu.md` e atualização do `PRD.md` (§4: Log por tipo de nota, Trackers de constância, Coach, Plan week, `/week-review` e a tool "Trackers"; §9: trackers nos mesmos termos de Tasks). C10 `npx tsc --noEmit` limpo; `npm test`: 11 arquivos, 200 testes; `npx vite build` ok. Conferido por busca: `forceTrackersTool` nos 5 agentes (General, Planner e Tutor `false`; Coach e Plan week `true`), sem `trackersTool` no `ReaderChatPanel`, só o `/week-review` tem `trackers: true` na política (o `/today` não recebe o bloco), nenhum "tracker" nas visões de Tasks e nenhum `SELECT *` novo.
- Files changed:
  - `src/hooks/useChat.ts`
  - `src/components/ChatPanel/ChatToolsMenu.tsx`
  - `src/components/ChatPanel/ChatComposer.tsx`
  - `src/components/NotesChat/NotesChatPanel.tsx`
  - `DOCS/docs.menu.md`
  - `DOCS/specs/PRD.md`
  - `DOCS/reports/20-11-2026/planreport_20261120122642_a-c.md` (status C7–C10: FEITO)
- Files created:
  - `DOCS/specs/trackers.md`
- Files removed:
  - nenhum
- Deviations: nenhum em relação ao plano. Pontos menores conferidos: a contagem de rodadas de tool é por chamada do handler e não depende do nome da tool; não há rótulo de "tool em uso" por tool no app (só os da web e do RAG), então nada foi acrescentado; o prompt base do chat (`CHAT_SYSTEM_PROMPT`) não cita tools pelo nome, então não ganhou `query_trackers`. `PRD.md`, a spec e o menu não falam de Radar nem de Papers.
- Left behind: nada das etapas C7–C10. Não verificado em execução real: a tool com um modelo de verdade (só type-check e os testes do texto `queryTrackersText`), o switch no menu de tools e o `loadTrackerData` contra o banco (o app não foi iniciado). O build do Vite avisa de chunks acima de 500 kB (mermaid e o bundle principal). A spec descreve o que está no código; o `uxAgent` ainda avalia o teto de 3 pontos na célula, a faixa em 220 px na keep e a visão Log na coluna das notas.

### Orchestrator — decisão — 20261120132110
- Summary: fases A, B e C implementadas por seis `codeAgent` em sequência (A1–A5, A6–A12, B1–B4, B5–B12, C1–C6, C7–C10). O Orquestrador rodou `npx tsc --noEmit` e `npm test` depois de cada bloco: type-check limpo e 11 arquivos com 200 testes passando no estado atual. Os `codeAgent` rodaram `npx vite build` sem erro nos blocos de interface. Nada foi executado com o app aberto.
- Inputs:
  - sessões dos `codeAgent` neste arquivo
  - `DOCS/reports/20-11-2026/planreport_20261120122642_a-c.md` (todas as etapas `FEITO`)
- Decision:
  1. Os desvios relatados pelos `codeAgent` foram aceitos: singular em "1 week" e "1 day"; a frase "Last month" do Coach some quando o tracker ainda não existia no mês; `formatTrackersForPlanWeek` sem `typeNameById`; `trackers.reload()` ao remover um tipo de nota na main; o Log aberto conta como visão ativa na coluna de cadernos; a faixa vazia mostra só "New tracker".
  2. Fica para o `codereviewAgent`: o `validName` duplicado entre `useTrackers` e `useNoteTypes`, e o CSS do `TrackersModal` que repete regras do `NoteTypesModal`.
  3. A rodada do `uxAgent` é dividida em duas fatias, como na task de 19-11-2026. A fatia 1 (trackers, Log e constância nos agentes) roda agora, só leitura, enquanto o plano das fases D–E termina. A fatia 2 (Radar, `/since` e Papers) roda depois da fase E. A triagem das duas fica num único `uxtriage`, e os ajustes aceitos entram em sequência com os `codeAgent` das fases D–E, um de cada vez na árvore de trabalho.
- Next step: `uxAgent` da fatia 1 agora; `codeAgent` da fase D quando o plano D–E chegar.

### PlannerAgent — fases D–E — 20261120131834
- Summary: o plano das fases D–E tem dois `codeAgent` por fase.
  - **Fase D:**
    - 1º `codeAgent`, D1–D14: contratos de agente e itens, `agentItems.ts` com marcadores `[W n]`/`[P n]`, escopo comum `agents/scope.ts` tirado do tutor (mais tag e board), perfil do Radar, mapa de foco com orçamento, `radar_scope_state` por `ensureRadarStateTable`, filtro de data do Tavily, cliente do OpenAlex, `radar_plan_queries` e as chaves do OpenAlex no Rust, `radar.ts` puro, helpers do bibliotecário e do Mincer, agente Radar, pipeline no `useChat` (`signal`, itens, `onDone`, finalização) e o `/since`;
    - 2º `codeAgent`, D15–D21: `AgentItemsList`, balões, "Save radar profile", composer e menu de tools, fiação nos painéis, `/since` no `handleCommand` e a chave do OpenAlex em Settings.
  - **Fase E:**
    - 1º `codeAgent`, E1–E6: `papers.ts` puro, `setUpPaperType`, agente Papers com duas passadas no OpenAlex, `books_download_pdf`, `registerBookFile` e `openPaperInLibrary`;
    - 2º `codeAgent`, E7–E12: pedido `paper`, ações de artigo, abertura do livro na main e na assistant, e a documentação (`radar.md`, menu, PRD §4 e §9).
  - **OpenAlex conferido** (help.openalex.org e requisições reais sem dado do usuário):
    - CORS aberto (`Access-Control-Allow-Origin: *`), então o `fetch` do frontend serve;
    - campos de autoria, tipo e acesso aberto confirmados;
    - `search` com `sort=cited_by_count:desc` perde a relevância (testado), então o app reordena.
  - Sem mudança de escopo nova. O indicador "(Unpaywall)" do E4 vira o `open_access` do OpenAlex, e o fallback do Unpaywall não entra (escolha 3 do plano).
- Output: `DOCS/reports/20-11-2026/planreport_20261120131834_d-e.md`

### Orchestrator — decisão — 20261120132737
- Summary: plano das fases D–E aceito, com as onze escolhas da seção "Escolhas deste plano" (entre elas: `review` nos tipos de obra, sem fallback do Unpaywall, "Open in Library" só depois de o artigo estar na fila, Send to Mincer e Add to KB só nos itens web, e a data do Radar avançando também em "Nothing new since…").
- Inputs:
  - `DOCS/reports/20-11-2026/planreport_20261120131834_d-e.md`
- Decision:
  1. O bloco 1 da Fase D (D1–D14) é grande para um único `codeAgent`. Ele roda em dois: D1–D7 (contratos, escopo, perfil, mapa de foco, storage, filtro de data e cliente do OpenAlex, tudo em TypeScript com testes) e D8–D14 (Rust, lógica do Radar, helpers, agente Radar, pipeline no `useChat`, `/since` e verificação). Os demais blocos seguem o corte do plano.
  2. `cargo check` nunca grava em `src-tauri\target`: os `codeAgent` usam `CARGO_TARGET_DIR` apontando para uma pasta no scratchpad da sessão. Um binário ou artefato gravado em `target` pelo sandbox herda rótulo de integridade baixo e quebra o app de dev do Coordenador ("attempt to write a readonly database", registrado em 2026-10-20).
- Next step: `codeAgent` da Fase D, etapas D1–D7.

### UxAgent — fatia 1 (trackers, Log e constância nos agentes) — 20261120132714
- Summary: a entrega atende ao objetivo. "Quantas vezes treinei mês passado?" se responde em dois cliques no Calendar, e a marca do dia leva um clique (pela keep são duas ações). Há 8 defeitos de comportamento:
  - D1: a falha de leitura aparece como "No trackers yet.";
  - D2: a falha ao marcar é silenciosa;
  - D3: o dia vindo de nota não tem saída (é igual ao manual, fica desabilitado e não leva à nota);
  - D4: tirar o vínculo com o tipo ou apagá-lo some com o histórico sem aviso;
  - D5: o tooltip "this week" aparece em qualquer semana;
  - D6: a tool `query_trackers` vem desligada no General, e a pergunta-âncora cai numa estimativa;
  - D7: o `/week-review` pode escrever "Trackers: none";
  - D8: a altura das linhas da grade muda ao marcar.
- Melhorias: 14, as principais sendo a M1 (faixa compacta e recolhível na keep e a linha do mês sem o nome do mês), a M4 ("New session" no Log) e a M5 (mês de calendário no Log e "N sessions on M days").
- Opinião sobre os pontos em aberto: manter o teto de 3 pontos, o Log na coluna das notas e as setas. Trocar o rótulo "Counts notes of type" por "From notes". No dia vindo de nota, o clique abre a nota e o botão usa `aria-disabled` em vez de `disabled`.
- Output: `DOCS/reports/20-11-2026/uxreport_20261120132714_trackers-log.md`
- Left behind: o app não foi aberto. A quebra da linha do mês em 188 px, a altura real da faixa na keep, o salto das linhas da grade, o encaixe de 3 pontos e do "+", o tooltip em botão desabilitado no WebView2 e o contraste da letra sobre as cores da paleta ficam para conferir na tela. Os prompts não foram rodados com um modelo.

### Orchestrator — decisão — 20261120133108
- Summary: triagem da fatia 1 do `uxAgent` (8 defeitos e 14 melhorias, mais as oportunidades do §6). Entram os 8 defeitos (o D4 com recorte) e 13 melhorias; ficam de fora 2 recusas parciais, 1 recusa e 4 adiamentos, com o motivo de cada um no `uxtriage`.
- Inputs:
  - `DOCS/reports/20-11-2026/uxreport_20261120132714_trackers-log.md`
- Decision: os ajustes aceitos da fatia 1 entram por um `codeAgent` próprio, logo depois do bloco D1–D7 e antes do D8–D14, um agente de cada vez na árvore de trabalho. Dois pontos mudam decisões anteriores do Orquestrador: o período do Log passa de janelas móveis para "This month · Last month · 90 days · 12 months" (decisão 8 de 20261120121205), e a linha do mês da faixa perde o nome do mês.
- Next step: aguardar o `codeAgent` D1–D7; depois, `codeAgent` dos ajustes de UX da fatia 1.

### CodeAgent — implementação inicial (Fase D, etapas D1–D7) — 20261120134432
- Summary: D1 contratos (`webPipeline?`, `signal`, `items?`/`onDone?` em `chat.ts`; `ChatMessage.agentItems` e `signal` no `contextInput` do `send()`) e `src/lib/agentItems.ts` (tipos, `ITEM_MARKER_RE`, `itemPrefix`, `expandItemMarkers`, `finalizeAgentItems`, `citedItemReason`, `dmy`). D2 `src/lib/agents/scope.ts`: a resolução de escopo saiu do tutor sem mudar a lógica (`resolveNotebookScope`), mais `resolveAgentScope`, `explicitScopeIn`, `scopeKey` e `scopeLabel` (tag, board e "tudo"). D3 `src/lib/radarProfile.ts`. D4 `src/lib/focusMap.ts` (`buildFocusMap`, com as constantes de orçamento exportadas). D5 `radar_scope_state` por `ensureRadarStateTable` e `getRadarLastRun`/`setRadarLastRun` (interface, `TauriStorage` e stub do `BrowserStorage`). D6 `webSearch` com o 5º parâmetro `opts` e `SearchResult.publishedDate`. D7 `src/lib/openalex.ts` (URL, parse, DOI, abstract, ranking, merge, erros e `searchWorks`). Sem Rust, sem migration, sem componente. `npx tsc --noEmit` limpo; `npm test`: 17 arquivos, 365 testes (antes 11 e 200).
- Files changed:
  - `src/lib/agents/chat.ts`
  - `src/hooks/useChat.ts` (só o campo `agentItems` e o `signal` no `contextInput`)
  - `src/lib/agents/tutor.ts` (apagou as cópias locais da resolução de escopo e importa de `./scope`)
  - `src/lib/search.ts`
  - `src/storage/tauri.ts`
  - `src/storage/index.ts`
  - `src/storage/browser.ts`
  - `DOCS/reports/20-11-2026/planreport_20261120131834_d-e.md` (status D1–D7: FEITO)
- Files created:
  - `src/lib/agentItems.ts` e `src/lib/agentItems.test.ts`
  - `src/lib/agents/scope.ts` e `src/lib/agents/scope.test.ts`
  - `src/lib/radarProfile.ts` e `src/lib/radarProfile.test.ts`
  - `src/lib/focusMap.ts` e `src/lib/focusMap.test.ts`
  - `src/lib/openalex.ts` e `src/lib/openalex.test.ts`
  - `src/lib/search.test.ts`
- Files removed:
  - nenhum
- Deviations: (1) `itemPrefix` codifica `(`, `)` e espaço no destino do link (`%28`, `%29`, `%20`), porque DOIs como `10.1016/S0140-6736(20)30183-5` fechariam o link markdown; o escape do título segue o plano. (2) `paperAuthors(item)` ficou exportada em `agentItems.ts`: o `paperCandidatesBlock` (D9) pede "autores como no prefixo". Sem autores, o prefixo do artigo começa pelo ano. (3) `radarFollowTerms(text)` ficou exportada em `radarProfile.ts` para o `terms` do mapa de foco (evita repetir a regex da linha Follow/Seguir); a linha aceita também `**Follow:** x`. (4) A linha "Active notebooks" usa "1 note edited" no singular. (5) `ensureRadarStateTable` recebe o `db`, como o `ensureTrackersTables` (o plano a escreveu sem parâmetro). (6) Ao podar, o `snippet` do item web vira `''` (o campo é obrigatório no contrato). (7) Dois arquivos de teste que o plano não listou: `search.test.ts` (prova que o body de `webSearch` sem `opts` é o de antes, com `invoke` e `fetch` simulados) e, em `openalex.test.ts`, os casos de `searchWorks` com `fetch` simulado (nenhum teste faz requisição). (8) `extractRadarProfileDraft` junta o `body` com `\n`, como o plano manda; o editor junta linhas simples num parágrafo, então a D17 pode precisar separar as linhas com linha vazia no "Save radar profile" (o `extractProfileDraft` do estudo faz isso).
- Left behind: nada das etapas D1–D7. Seguem D8–D14 (Rust, `radar.ts`, helpers do bibliotecário, agente Radar, pipeline no `useChat`, `/since`). Não verificado em execução real: `ensureRadarStateTable` e o UPSERT só passaram por type-check (o app não foi iniciado); o formato real do `published_date` do Tavily e a chamada ao OpenAlex (CORS e preflight) não foram exercitados, só a montagem da URL e a leitura de respostas fixas; a paridade do tutor está coberta pelos testes de `resolveNotebookScope`, não por uma conversa real; `cargo` não foi rodado (sem Rust). As chaves `get/save/clear/has_openalex_key` ainda não existem no Rust (D8): `getOpenAlexKey` devolve `null` até lá.

### CodeAgent — ajuste de UX da fatia 1 (faixa, grade e textos: D1, D2, D5, D8, M1, M2, M3, M13, M14 linha do mês) — 20261120135453
- Summary: D1 faixa com "Trackers couldn't load." e "Retry" quando a leitura falha sem lista (sem "New tracker"); D2 linha de erro "Couldn't save <nome> · <dia>. Try again." sob o cabeçalho da faixa e acima dos chips, limpa ao abrir o modal (`clearErrors` na fiação do "Manage"); D5 tooltip do "n/meta" com o intervalo da semana ("this week" só na semana de hoje); D8 célula da grade com altura fixa de 28 px e pontos de tracker com 1 px de gap; M1 linha do mês "13 days · 3 of 4 weeks on target", faixa recolhível pelo cabeçalho (caret Phosphor, `localStorage` por janela) com "Trackers · 2/3 · 1/4"; M2 "Tracker done" na legenda e rotação de cor sem as cores do ponto de nota e da barra de task; M3 cabeçalho "This week · 16–22 Nov" e tooltip da linha do mês com o resultado de cada semana; M13 estado vazio "Trackers · New tracker"; M14 "Started 20 Nov" antes do início e nada em mês futuro. Texto novo em `src/lib/trackers.ts` com testes (17 novos). `npx tsc --noEmit` limpo; `npm test`: 17 arquivos, 382 testes; `npx vite build` ok. Um teste de fumaça temporário (happy-dom, já removido) passou 9 casos de faixa e chips.
- Files changed:
  - `src/lib/trackers.ts`
  - `src/lib/trackers.test.ts`
  - `src/hooks/useTrackers.ts`
  - `src/components/Trackers/TrackersStrip.tsx`
  - `src/components/Trackers/TrackersStrip.module.css`
  - `src/components/Trackers/TrackerChips.tsx`
  - `src/components/Trackers/TrackerChips.module.css`
  - `src/components/CalendarView/CalendarView.tsx`
  - `src/components/CalendarView/CalendarView.module.css`
  - `src/components/KeepPanel/KeepPanel.tsx`
  - `src/App.tsx` (só fiação: props do `CalendarView`, `error` dos chips e o `clearErrors` no "Manage")
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Deviations: (1) "Tracker done" na legenda só aparece quando há tracker ativo. (2) Com lista em memória e leitura que falha depois, a faixa segue mostrando a lista (a falha só vale sem lista). (3) O cabeçalho ficou em duas linhas ("Trackers" e "Manage" em cima, "This week · 16–22 Nov" embaixo), porque as duas partes não cabem juntas em 188 px. (4) D8 por altura fixa da célula (`height: 28px`, sem padding) em vez de pontos em posição absoluta. (5) O ano aparece em "Started 20 Nov 2026" quando o início é de outro ano que o do mês exibido.
- Left behind: nada dos itens do escopo. Não verificado com o app aberto: a altura das linhas da grade ao marcar, o "+" de 7 px sobre o gap, o encaixe do cabeçalho de duas linhas e do "Trackers · 2/3 · 1/4" em 188 px na keep, o caret e o foco do cabeçalho, o tooltip da linha do mês no WebView2 e a linha de erro (forçar uma falha de gravação).

### CodeAgent — ajuste de UX da fatia 1 (dia vindo de nota, vínculo e modal: D3, D4, M6, M7, M8, M9, M10, M11, M14 Delete) — 20261120140500
- Summary: D3 o dia vindo de nota abre a nota no clique (faixa e chip), com `aria-disabled` e foco por teclado no lugar de `disabled`, tooltip com a origem e como desfazer, anel interno no círculo e sufixo "· note" no chip; a keep usa a ponte que já existe (`open_note_in_main` e esconder a janela), sem ponte nova. D4 trocar o vínculo ("None" ou outro tipo) com dias que só contam pelas notas pede confirmação com a contagem; apagar um tipo cita os trackers vinculados. M6 rótulo "From notes", opções "<Tipo> notes" e dica curta só com vínculo. M7 linha de status do atalho Practice com "Open log" (só na main). M8 foco automático no "New tracker…" sem tracker ativo e mensagem própria para nome de tracker arquivado. M9 dica sob "Weekly target". M10 nota de dia futuro sem chips e `Check` no chip feito. M11 setas somem com um tracker ativo. M14 a confirmação de excluir tracker vinculado diz que as notas ficam. `npx tsc --noEmit` limpo; `npm test`: 17 arquivos, 394 testes (antes 382); `npx vite build` ok. Um teste de fumaça temporário (happy-dom, já removido) passou 11 casos de faixa, chips e modal.
- Files changed:
  - `src/lib/trackers.ts`
  - `src/lib/trackers.test.ts`
  - `src/lib/noteLog.ts`
  - `src/lib/noteLog.test.ts`
  - `src/lib/practiceSetup.ts`
  - `src/hooks/useTrackers.ts`
  - `src/components/Trackers/TrackersStrip.tsx`
  - `src/components/Trackers/TrackersStrip.module.css`
  - `src/components/Trackers/TrackerChips.tsx`
  - `src/components/Trackers/TrackerChips.module.css`
  - `src/components/Trackers/TrackersModal.tsx`
  - `src/components/Trackers/TrackersModal.module.css`
  - `src/components/CalendarView/CalendarView.tsx`
  - `src/components/KeepPanel/KeepPanel.tsx`
  - `src/components/NoteTypes/NoteTypesModal.tsx`
  - `src/App.tsx` (só fiação: `onOpenTrackerNote` no `CalendarView`, `onOpenNote` nos chips, `trackers` no `NoteTypesModal` e `onOpenLog` no `TrackersModal`)
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Deviations: (1) `TrackerDay` ganhou `noteId?` (a nota mais recente do dia, por `updatedAt` e depois `createdAt`), em vez de uma busca nas notas a cada clique: a faixa e os chips só repassam o id. (2) O hook `useTrackers` passou a calcular `days` para todos os trackers, arquivados incluídos, para o modal conferir os dias vindos de nota de qualquer tracker; os consumidores só leem os ativos. (3) O foco automático vale com nenhum tracker ativo, o que já cobre o modal aberto pelo "New tracker" da faixa (esse botão só existe sem tracker ativo). (4) O chip feito troca o ícone do tracker pelo `Check` (a largura do chip não muda ao marcar). (5) A confirmação de trocar o vínculo usa o padrão do `useConfirm` (botão "Change", foco no "Cancel").
- Left behind: nada dos itens do escopo. Não verificado com o app aberto: o anel interno do círculo e o sufixo "· note" (largura do chip na keep), o foco por teclado e o tooltip do botão `aria-disabled` no WebView2, a abertura da nota pela keep (janela esconde e a main navega), a linha de status e o "Open log" no modal, o foco automático do campo e as três confirmações (trocar vínculo, excluir tracker e excluir tipo) no app real.

### CodeAgent — ajuste de UX da fatia 1 (Log e chat: M4, M5, D6, D7, M14 ícone; documentação das três partes) — 20261120141414
- Summary: M4 botão "New session" (`Plus`) no Log: cria a nota do tipo (template e tipo aplicados) com a data de hoje no caderno da nota mais recente do tipo e a abre no editor com o Log ao lado. M5 período "This month · Last month · 90 days · 12 months" (padrão This month; os dois primeiros são meses de calendário) e totais "14 sessions on 12 days · 610 Minutes". D6 `query_trackers` ligada por padrão (`p.trackers !== false`) e só anexada com ao menos um tracker ativo (uma leitura do storage no envio; falha = sem a tool). D7 a regra "diga numa linha" do `/week-review` vale só para Done, Pending e Slipped; sem o bloco de trackers, a seção Trackers não aparece. M14 toggle "Trackers" com o ícone `Target`. Documentação: `DOCS/specs/trackers.md` reescrita nos pontos dos ajustes das três partes, e frases corrigidas no `PRD.md` (§4) e na linha da spec no `docs.menu.md`. `npx tsc --noEmit` limpo; `npm test`: 17 arquivos, 405 testes (antes 394); `npx vite build` ok. Um teste de fumaça temporário (happy-dom, já removido) passou o `NoteLog` (quatro períodos, totais com dias distintos, troca para Last month e o clique em "New session").
- Files changed:
  - `src/lib/noteLog.ts` e `src/lib/noteLog.test.ts`
  - `src/components/NoteLog/NoteLog.tsx` e `src/components/NoteLog/NoteLog.module.css`
  - `src/App.tsx` (só fiação: import, `handleCreateLogNote` e `onNewSession` no `NoteLog`)
  - `src/hooks/useChat.ts` (só o padrão da tool `trackers` e a condição que anexa a `query_trackers`)
  - `src/lib/agents/weekReview.ts`
  - `src/components/ChatPanel/ChatToolsMenu.tsx`
  - `DOCS/specs/trackers.md`
  - `DOCS/specs/PRD.md`
  - `DOCS/docs.menu.md`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Deviations: (1) M4, caderno: a regra do "New" do board não é reaproveitável (depende do filtro de caderno e do último caderno guardado por board em `localStorage`, que o Log não tem), então vale a regra de reserva da triagem: o caderno da nota mais recente do tipo (por criação, só notas ativas de caderno real; `logNewNoteNotebookId` em `noteLog.ts`, com testes), senão o caderno ativo, e se o ativo for o Calendar ou não houver, o Quick Notes. (2) M4, lugar do botão: ele fica numa linha própria logo abaixo do título do Log, e não na mesma linha do título, porque título, "Settings" e fechar já ocupam os 188 px úteis da coluna padrão. (3) M5: com quatro botões, o seletor de período quebra em duas linhas na coluna estreita (fio de 1 px entre os botões pelo `gap`, fora da escala de espaçamento por ser divisória); em coluna larga fica numa linha só. `sessionsLabel` saiu do componente para `noteLog.ts` (usado também nos grupos). (4) D6: o padrão ligado vale só para quem não tem a escolha gravada; quem já tem um objeto de tools no `localStorage` com `trackers: false` (qualquer troca de switch grava o objeto inteiro) continua com ela desligada até ligar uma vez. A condição "só com tracker ativo" vale também quando o agente a força (Coach e Plan week); sem tracker, a tool nem é enviada.
- Left behind: nada dos itens do escopo. Não verificado com o app aberto: a quebra do seletor de período em duas linhas na coluna de 220 px, o botão "New session" (aparência, a nota aberta ao lado do Log com a data de hoje e o caderno escolhido; com template no tipo, o editor não foca o título, como em "New <tipo>"), a linha de totais em duas linhas na coluna estreita e o ícone `Target` no menu de tools. Não verificado com um modelo de verdade: a `query_trackers` ligada por padrão no chat General ("quantas vezes fui em outubro?") e o `/week-review` sem trackers (que a seção Trackers não apareça). Não testado: o D6 em si (a condição no `useChat` só passou por type-check; não há teste do envio).

### CodeAgent — implementação inicial (Fase D, etapas D8–D14) — 20261120142900
- Summary: D8 Rust: `save/has/clear/get_openalex_key` (arquivo `openalex_key`) e `radar_plan_queries` (prompts `radar`, `papers` e `since` do plano, sobre `librarian_decide`; `kind` desconhecido devolve lista vazia), registrados no `generate_handler!`. D9 `src/lib/radar.ts` puro (janela, plano e limpeza de consultas, buckets, datas do Tavily, `normalizeUrl`, candidatos web, blocos de candidatos, corte do `/since` e `formatDatedResults`). D10 `findAiFolder` extraído do `runPipeline`, `loadKbSourceFilenames`, `addUrlToKb` (na cadeia da pasta) e `emitMincerChanged`. D11 agente Radar (`buildRadarContext`, `radarPrompt`, `radarAgent`, `sinceSearch`), registrado no `CHAT_AGENTS` com os textos do composer. D12 no `useChat`: chave do Tavily exigida pelo `webPipeline`, `signal` e indicador de busca no `buildContext`, `agentItems` e `agentDoneRef`, finalização dos marcadores e `onDone` no done final, `registerAiSourcesFolder` extraído e exposto. D13 `WebPolicy 'since'`, `tooShortMessage`, `sinceAgent` em `AGENTS` depois do `/expand`. D14 verificado: `npx tsc --noEmit` limpo; `npm test`: 19 arquivos, 467 testes (antes 17 e 405); `cargo check` (com `CARGO_TARGET_DIR` no scratchpad) sem erro nem aviso. Nada gravado em `src-tauri\target`.
- Files changed:
  - `src-tauri/src/lib.rs`
  - `src/hooks/useChat.ts`
  - `src/lib/librarian.ts`
  - `src/lib/mincer.ts`
  - `src/lib/agents/chat.ts`
  - `src/lib/agents/core.ts`
  - `src/lib/agents/index.ts`
  - `src/lib/focusMap.ts` (campo `types` do `FocusMapInput` removido por ser código morto; `focusEligibleNotes` extraída do `buildFocusMap`, sem mudar o comportamento)
  - `src/lib/focusMap.test.ts` (só o `types` do helper)
  - `src/lib/agentItems.ts` (só o `export` de `citationsText`, usada no bloco de candidatos)
  - `DOCS/reports/20-11-2026/planreport_20261120131834_d-e.md` (status D8–D14: FEITO)
- Files created:
  - `src/lib/radar.ts` e `src/lib/radar.test.ts` (40 testes)
  - `src/lib/agents/radar.ts` e `src/lib/agents/radar.test.ts` (22 testes, com comando Rust, Tavily, OpenAlex, storage e KB simulados)
  - `src/lib/agents/since.ts`
- Files removed:
  - nenhum
- Deviations: (1) `radarQueryBuckets` e `papersQueries` ganham um 3º parâmetro opcional `forbidCopyFrom`; o Radar passa o texto do mapa de foco, para barrar a consulta que copia 6+ palavras do perfil ou do perfil de estudo. A reserva pelos `terms` vale quando nenhuma consulta aproveitável sobra (não só com o plano literalmente vazio). (2) `cleanQueries` tira o `#` só no começo da palavra (hashtag), para "C#" e "F#" sobreviverem, e as aspas simples só nas bordas da palavra. (3) `toDateKeyLoose` só usa o `Date.parse` quando o texto tem nome de mês ou de dia (3+ letras): sem isso "5" ou "2026" virariam datas. (4) `addUrlToKb` não tem chave in-flight nem espera: ela roda na cadeia da pasta, então nenhum pipeline do bibliotecário roda junto e só o disco decide o dedupe (esperar a cadeia de dentro dela travaria). A data do cabeçalho "Retrieved" é a local. (5) O `onDone` decide pelo texto da rodada que acabou (`stream.roundText`, passado pelo `finalizeAgentItems` quando há itens), e não por uma releitura do `conversationsRef`: o ref fica um render atrás do updater e a resposta curta podia ser lida como vazia. A rodada de tools não emite done (o Rust só emite `openrouter://done` quando o stream termina sem tool call), então todo done é o final, como no bibliotecário. (6) A linha `Scope changed: A → B.` entra logo depois de "Radar context". (7) Teste extra `src/lib/agents/radar.test.ts`, não listado no plano.
- Left behind: nada das etapas D8–D14. Seguem D15–D21 (interface, fiação nos painéis, `/since` no `handleCommand`, Settings). Para o próximo `codeAgent`: (a) o `/since` já está em `AGENTS`, mas `App.tsx`, `commandParser.ts` e `CommandAutocomplete.tsx` ainda não conhecem a política `'since'` nem o `tooShortMessage` (o aviso ainda é o do `/critique`) até a D20; (b) o payload `agentItems` só é podado no done final: num turno com erro ou Stop a mensagem guarda todos os candidatos (até 20 web com trecho e 10 artigos com abstract), então a lista de itens não deve aparecer em mensagem `failed` ou `interrupted` (o texto dela ainda tem marcadores, que o `expandItemMarkers` resolve); (c) `registerAiSourcesFolder` já é devolvido por `useChat`. Não verificado com o app aberto nem com um modelo: os prompts do Radar e do `radar_plan_queries` (e o limite de 300 tokens do `librarian_decide` com até 9 consultas), o formato real do `published_date` do Tavily, a chamada ao OpenAlex (CORS e a chave opcional), o `addUrlToKb` contra o disco real, a data gravada em `radar_scope_state` e o Stop durante o pipeline (só testados com simulações e type-check). O `cargo test` não foi rodado.

### CodeAgent — implementação inicial (Fase D, etapas D15–D21) — 20261120144224
- Summary: D15 `AgentItemsList` (Open, Send to Mincer e Add to KB nos itens web, só Open nos artigos; estados "Sending…/Queued in Mincer" e "Adding…/In KB" locais, erro numa linha; `useConfirm` para o "Save web sources" desligado; some em streaming) e `hasAgentItems` (esconde a lista em mensagem `failed` ou `interrupted`, onde o payload ainda guarda todos os candidatos). D16 `AGENT_DRAFT_ACTION` e o rascunho `radarProfile` em `agentNotes.ts`; `ChatMessageBubble` e `NotesChatBubble` mostram o texto com `expandItemMarkers` (memoizado, `{ __html }` estável), a lista de itens e o botão do rascunho pelo mapa (ícone `Broadcast` no perfil do Radar). D17 `SaveAgentNoteModal` por mapa de textos por `kind` (os de plan e profile idênticos), `isValidAgentNote` aceita `radarProfile` e o `App.tsx` grava a nota com a tag `radar profile`. D18 composer com `pipelineTavily` (aviso "Radar needs a Tavily key for web search. Add it in Settings." só com "Open Settings", sem "Turn off") e linha Web search travada e ligada no menu de tools. D19 `itemActions` nos três painéis (Chat, Assistant, NotesChat). D20 `/since` no `handleCommand` (checagem da chave, `tooShortMessage`, corte de data, `sinceSearch`), no grupo Review depois do `/expand`, `title` do selo "web" e bloco "OpenAlex (optional)" no Settings. D21 `npx tsc --noEmit` limpo; `npm test`: 19 arquivos, 467 testes; `npx vite build` ok. Sem Rust (nenhum `cargo`), sem migration. Teste de fumaça temporário (happy-dom, já removido): 15 casos passaram (lista com e sem pasta, Send to Mincer web e YouTube, erro do Mincer, Add to KB com confirmação e sem chave do Tavily, balão com marcadores expandidos e sem lista em streaming, parado ou com erro, `Save radar profile`, modal gravando com linha vazia entre as linhas, menu de tools, aviso do composer, bloco do OpenAlex e o `/since` no autocomplete).
- Files changed:
  - `src/lib/agentNotes.ts`
  - `src/lib/assistantNoteBridge.ts`
  - `src/components/ChatPanel/ChatMessageBubble.tsx`
  - `src/components/ChatPanel/SaveAgentNoteModal.tsx`
  - `src/components/ChatPanel/ChatComposer.tsx`
  - `src/components/ChatPanel/ChatToolsMenu.tsx`
  - `src/components/ChatPanel/ChatPanel.tsx`
  - `src/components/AssistantPanel/AssistantPanel.tsx`
  - `src/components/NotesChat/NotesChatPanel.tsx`
  - `src/components/Editor/commandParser.ts`
  - `src/components/Editor/CommandAutocomplete.tsx`
  - `src/components/Settings/SettingsModal.tsx`
  - `src/components/Settings/SettingsModal.module.css` (a classe `.formNext`, espaço entre o bloco do Tavily e o do OpenAlex)
  - `src/App.tsx` (só fiação: 4 imports do `/since`, o import de `RADAR_PROFILE_TAG`, a checagem da chave, o `tooShortMessage`, o ramo `'since'` da parte de web e o ramo `radarProfile` do `handleCreateAgentNoteFromChat`)
  - `DOCS/reports/20-11-2026/planreport_20261120131834_d-e.md` (status D15–D21: FEITO)
- Files created:
  - `src/components/ChatPanel/AgentItemsList.tsx`
  - `src/components/ChatPanel/AgentItemsList.module.css`
- Files removed:
  - nenhum
- Deviations: (1) No `AssistantPanel`, o "Add to KB" usa a pasta da conversa aberta (a que contém o `activeId`) e só cai na pasta efetiva sem ela; o plano manda a efetiva, que apontaria para a pasta errada numa conversa retomada de outra pasta. (2) `hasAgentItems` (D15) é um acréscimo para o recado do agente anterior (sem lista em `failed` ou `interrupted`). (3) A separação das linhas do perfil com linha vazia é feita no `SaveAgentNoteModal` (`split('\n').join('\n\n')`), e não no `extractRadarProfileDraft`: o `body` do rascunho e os testes da D3 não mudam. (4) `AGENT_DRAFT_ICON` (ícone por `kind`) é exportado do `ChatMessageBubble`, para os dois balões não repetirem o mapa; o rótulo e o título vêm do `AGENT_DRAFT_ACTION` do plano. (5) A linha travada do menu de tools mostra o texto "Always on for Radar: the app runs the searches" (visível, como o "On for Coach" dos outros agentes) e o mesmo texto no `title`. (6) `AgentItemActions.onOpenNote` está no contrato e ligado nos três painéis, mas nada na Fase D o usa (é para a Fase E). (7) `.formNext` em `SettingsModal.module.css` não estava na lista de arquivos da D20.
- Left behind: nada das etapas D15–D21. Não verificado com o app aberto nem com um modelo: aparência da lista de itens (três botões com rótulo em 220–300 px, quebra das ações abaixo do título), do bloco "OpenAlex (optional)" e da linha travada no menu de tools; a confirmação do "Add to KB" e a janela assistant (confirmação, `open_note_in_main`); o "Send to Mincer" e o "Add to KB" contra o Mincer e o Tavily reais; o `/since` de ponta a ponta numa nota (card, data de corte e resposta), pois o `handleCommand` não tem teste; a gravação real da nota do "Save radar profile" (tag e linhas no editor); o formato do bloco "Radar profile" que o modelo escreve; o `NotesChatBubble` só passou por type-check (o teste de fumaça cobriu o `ChatMessageBubble`, que tem a mesma lógica). O `ChatToolsMenu` do `NotesChatPanel` não recebe o `agent` (já era assim), então lá o switch de Web search não aparece travado no Radar.

### CodeAgent — implementação inicial (Fase E, etapas E1–E6) — 20261120145500
- Summary: E1 `src/lib/papers.ts` puro (`paperSaveChanges` com board por Status e opções do Status completadas, `readingListKeys`/`readingListMatch`, `paperNoteContent`, `paperNoteTitle`, `paperAuthorsText`, `paperProperties`, `paperPdfLink`) com 30 testes. E2 `src/lib/paperSetup.ts` (`setUpPaperType`, `loadReadingList`, `READING_LIST_CHANGED_EVENT`), no padrão do `practiceSetup`. E3 agente Papers (`src/lib/agents/papers.ts`: `buildPapersContext`, `papersPrompt`, `papersAgent`) registrado no `CHAT_AGENTS` com os textos do composer; 2 consultas, 2 passadas no OpenAlex por consulta (no máximo 4 buscas), fila de leitura fora dos candidatos, até 6 itens; 17 testes com tudo simulado. E4 Rust `books_download_pdf` em `books.rs` (só http/https, teto de 50 MB, `%PDF`, escrita atômica, UA "Monet" sem e-mail) registrado no `generate_handler!`. E5 `registerBookFile` extraído de `importBook` (que só chama `booksImportFile` e `registerBookFile`), `booksDownloadPdf`, `src/lib/libraryOpen.ts` (`OPEN_BOOK_KEY` e `requestOpenBook`, a `Library` só importa a constante), `findBookIdForNote` e `src/lib/paperPdf.ts` (`openPaperInLibrary`), com 10 testes. E6: `npx tsc --noEmit` limpo; `npm test`: 22 arquivos, 524 testes (antes 19 e 467); `cargo check` (com `CARGO_TARGET_DIR` no scratchpad) sem erro nem aviso. Nada gravado em `src-tauri\target`. Sem migration, sem componente e sem `App.tsx`.
- Files changed:
  - `src/lib/agents/chat.ts` (`papersAgent` no `CHAT_AGENTS` e `COMPOSER_HINTS.papers`)
  - `src/lib/agentItems.ts` (só o `export` de `linkUrl`)
  - `src/lib/books.ts` (`registerBookFile` extraído de `importBook`; `booksDownloadPdf`)
  - `src/lib/readerNoteLink.ts` (`findBookIdForNote`)
  - `src/components/Library/Library.tsx` (só o import de `OPEN_BOOK_KEY`; a constante e o comentário foram para `libraryOpen.ts`)
  - `src-tauri/src/books.rs` (`books_download_pdf`)
  - `src-tauri/src/lib.rs` (só o registro no `generate_handler!`)
  - `DOCS/reports/20-11-2026/planreport_20261120131834_d-e.md` (status E1–E6: FEITO)
- Files created:
  - `src/lib/papers.ts` e `src/lib/papers.test.ts` (30 testes)
  - `src/lib/paperSetup.ts`
  - `src/lib/agents/papers.ts` e `src/lib/agents/papers.test.ts` (17 testes, não listado no plano)
  - `src/lib/libraryOpen.ts`
  - `src/lib/paperPdf.ts` e `src/lib/paperPdf.test.ts` (10 testes, não listado no plano)
- Files removed:
  - nenhum
- Deviations: (1) `paperPdfLink` (pdf_url, ou oa_url terminado em `.pdf`) fica em `papers.ts`, puro e testado, e não como regex dentro do `openPaperInLibrary`: a E8 usa o mesmo critério para decidir entre "Open in Library" e o selo, sem repetir a regex. (2) `linkUrl` foi exportado do `agentItems.ts` (uma palavra) para o link do DOI da nota escapar parênteses como o prefixo do item faz. (3) O Papers tira da lista o que já está na fila de leitura antes de reordenar os fundamentais (`rankFoundational(fresh(r), 8)`), e não depois: assim as vagas vão a artigos novos em vez de encolherem quando os mais citados já estão na fila. O `exclude` por `id` continua no `mergePapers`. (4) `papersQueries` recebe o texto do mapa de foco como 3º parâmetro (`forbidCopyFrom`), como o Radar (desvio 1 da D8–D14). (5) A mensagem de escopo vazio do Papers diz "a notebook, a tag or everything" (sem "a board", que o Papers não resolve: `boardTypes: []`). (6) A linha de busca diz `<n> queries, <k> of <2n> searches failed: <motivo>`, porque cada consulta faz duas buscas. (7) Sem consulta aproveitável, o contexto devolve só o texto "Papers search: not done (…)", sem `items`. (8) `readingListKeys` lê o `Source:` de forma tolerante (o editor pode reescrever a URL como autolink ou link) e a nota ativa vence a arquivada na mesma chave; sem motivo, `paperNoteContent` não escreve a linha "AI suggestion". (9) No Rust, as falhas de conexão e de tempo viram "Download failed: could not reach the server" / "…took too long to respond" (e não o texto cru do reqwest), e a escrita do arquivo roda em `spawn_blocking`. (10) `booksDownloadPdf` devolve o `invoke` cru; a troca da string do Rust por `Error` fica no `openPaperInLibrary`.
- Left behind: nada das etapas E1–E6. Para o próximo `codeAgent` (E7–E12): `setUpPaperType()` devolve `{ typeId, ids, warnings }`, que entram em `paperProperties(ids, { year, authors, doi })`; `paperNoteTitle`, `paperNoteContent(item, reason, todayKey, agentLabel)` e `paperAuthorsText` estão em `papers.ts`; `loadReadingList()` devolve um `Map` e `readingListMatch(item, keys)` dá `{ noteId, notebookId }` ou `null` (o `notebookId` pode ser `null`); `READING_LIST_CHANGED_EVENT` está em `paperSetup.ts`; `requestOpenBook(bookId)` e `OPEN_BOOK_KEY` estão em `libraryOpen.ts`; `openPaperInLibrary(item, note)` devolve o `bookId` e lança `Error` legível (inclusive 'No open-access PDF'). Não verificado com o app aberto nem com rede: os prompts do Papers e do `radar_plan_queries` com `kind: 'papers'` num modelo real; as chamadas reais ao OpenAlex (`search.title_and_abstract` com 40 e 20 por página, a chave opcional); o `books_download_pdf` contra um servidor real (só compilou no `cargo check`; o `cargo test` não foi rodado) e a reação de editoras que bloqueiam o cliente (a mensagem "did not return a PDF"); o `registerBookFile` com um PDF baixado; o import de livro pela Library (só revisado por diff: `importBook` ficou `booksImportFile` + `registerBookFile`, sem outra mudança de comportamento). Com `webPipeline` presente, o chat acende o indicador de busca na web enquanto o Papers monta o contexto (é o contrato da D12); o `uxAgent` pode rever.

### CodeAgent — implementação inicial (Fase E, etapas E7–E12) — 20261120151000
- Summary: E7 pedido `paper`: `AgentNoteRequest` e `AgentNoteDraft` com o `paper`, `AGENT_DRAFT_ACTION.paper`, textos do `SaveAgentNoteModal` ("Add to reading list", título pelo `paperNoteTitle`, conteúdo e propriedades pelo `papers.ts`, evento `monet:reading-list-changed` depois de salvar), `isValidAgentNote` e o ramo `paper` do `handleCreateAgentNoteFromChat` (`setUpPaperType`, nota, `paperProperties`, "Try again" por `agentNoteByRequestRef`). E8 `AgentItemsList` com as ações de artigo (Add to reading list, In reading list, Open in Library, selo "Open-access PDF", "No open-access PDF" ou "Open access (no direct PDF)" e o link "DOI"; a fila relida do banco ao montar e a cada evento) e os balões passando `messageId` e `content`. E9 fiação nos três painéis (`onAddPaper` com o caderno do escopo, `onOpenBook`), `openBookInLibrary` no `App.tsx` (`requestOpenBook`, `<Library key>` remontada) e o evento `assistant-open-book` da janela assistant. E10 `DOCS/specs/radar.md`, a linha no `docs.menu.md` e o PRD (§4: `/since`, agentes Radar e Papers, ações por item, Open in Library e Send to Mincer; §9: a exceção sob demanda). E11 `npx tsc --noEmit` limpo; `npm test`: 22 arquivos, 524 testes; `npx vite build` ok. Teste de fumaça temporário (happy-dom, já removido): 8 casos passaram (lista de artigos fora e dentro da fila, rascunho com motivo, rótulo e caderno do escopo, "In reading list" abre a nota, Open in Library baixa e abre o livro, erro do download numa linha, sem PDF com e sem DOI, artigo do Radar já na fila por id do OpenAlex; o modal do Paper com caderno do escopo, título, pedido `paper` gravado, evento e "Paper added"). E12 status das etapas D e E no plano: todas `FEITO`. Sem Rust (nenhum `cargo`), sem migration.
- Files changed:
  - `src/lib/agentNotes.ts`
  - `src/lib/assistantNoteBridge.ts`
  - `src/components/ChatPanel/SaveAgentNoteModal.tsx`
  - `src/components/ChatPanel/AgentItemsList.tsx`
  - `src/components/ChatPanel/AgentItemsList.module.css`
  - `src/components/ChatPanel/ChatMessageBubble.tsx`
  - `src/components/ChatPanel/ChatPanel.tsx`
  - `src/components/NotesChat/NotesChatPanel.tsx`
  - `src/components/AssistantPanel/AssistantPanel.tsx`
  - `src/App.tsx` (só fiação: 3 imports, o ramo `paper` do `handleCreateAgentNoteFromChat`, `libraryNonce`/`openBookInLibrary`/ref, o listener `assistant-open-book`, `key` na `<Library>` e `onOpenBook` no `<ChatPanel>` e no `<NotesChatPanel>`)
  - `DOCS/docs.menu.md`
  - `DOCS/specs/PRD.md` (só acréscimos)
  - `DOCS/reports/20-11-2026/planreport_20261120131834_d-e.md` (status E7–E12: FEITO)
- Files created:
  - `DOCS/specs/radar.md`
- Files removed:
  - nenhum (os dois testes de fumaça temporários foram apagados)
- Deviations: (1) `AGENT_DRAFT_ICON.paper` (`BookmarkSimple`) no `ChatMessageBubble`: o `Record` por `kind` exige a entrada, embora o botão do artigo seja desenhado pela `AgentItemsList`. (2) A `AgentItemsList` só lê a fila de leitura quando o payload tem artigos (evita ler todas as notas por mensagem do Radar só com itens web); enquanto a fila carrega, o "Add to reading list" fica desabilitado e o estado do PDF (selo ou "Open in Library") não aparece. (3) O clique em "Add to reading list" relê a fila antes de abrir o modal e não o abre se o artigo já estiver nela (outra janela pode ter adicionado: a regra "mesma chave não duplica" vale entre janelas, e o evento de janela só atinge a janela onde o modal rodou). (4) `onAddPaper` e `onOpenBook` ausentes escondem o botão correspondente (os três painéis os passam). (5) No `AssistantPanel`, o `openSaveAgentNote` foi movido para acima do `itemActions`, porque o `useMemo` o usa nas dependências (leitura antes da declaração). (6) "In reading list" passa `notebookId ?? ''` ao `onOpenNote` quando a nota não tem caderno, o mesmo recurso do "Saved to" do balão. (7) O link "DOI" é um botão de texto sublinhado, não um botão com ícone: é um link, e o "Open" já tem o rótulo e o ícone. (8) O `radar.md` descreve o que está no código, inclusive os desvios aceitos das fases D e E (o Papers tira a fila de leitura antes de reordenar os fundamentais; o Radar não tira artigos da fila; consultas barradas por cópia do mapa de foco).
- Left behind: nada das etapas E7–E12. Não verificado com o app aberto, com rede nem com um modelo (a Fase E inteira e a D continuam só com simulações e type-check): (a) a aparência da `AgentItemsList` com os artigos (até quatro itens na linha: Open, Add to reading list, estado do PDF e DOI em 220–300 px, quebra das ações abaixo do título), do modal do Paper e do selo "Open-access PDF"; (b) o "Add to reading list" de ponta a ponta: criação do tipo Paper no banco real, o board por Status, o conteúdo da nota no editor (link do DOI, `Source:` e a linha "AI suggestion" no Tiptap) e o evento que troca o botão para "In reading list"; na janela assistant, a ponte `create-agent-note` com o pedido `paper`; (c) o "Open in Library" contra um PDF real (download, `registerBookFile`, vínculo com a nota, a Library remontada abrindo o livro, e a janela assistant mostrando a principal pelo `assistant-open-book`) e a reação de editoras que bloqueiam o cliente; (d) os prompts do Radar, do Papers, do `/since` e do `radar_plan_queries` num modelo real; as chamadas reais ao Tavily (formato do `published_date`) e ao OpenAlex (a chave opcional e o orçamento sem chave); (e) o `/since` de ponta a ponta numa nota; (f) o `NotesChatPanel`, que só passou por type-check nos novos props (o teste de fumaça cobriu a lista e o modal, que ele reaproveita). Para a rodada de UX: o aviso dos conflitos do `paperSaveChanges` só vai ao console (escolha 6 do plano); o "In reading list" de nota arquivada abre a nota arquivada; o botão "Save a copy" do modal "already" vale também para o Paper.

### Orchestrator — decisão — 20261120150608
- Summary: as cinco fases estão implementadas, mais os ajustes de UX da fatia 1 (três `codeAgent`). O Orquestrador rodou `npx tsc --noEmit` e `npm test` depois de cada bloco: type-check limpo e 22 arquivos com 524 testes passando no estado atual. Os `codeAgent` rodaram `npx vite build` nos blocos de interface e `cargo check` nos blocos com Rust, com `CARGO_TARGET_DIR` no scratchpad; o Orquestrador conferiu que nada foi gravado em `src-tauri\target`. Nada foi executado com o app aberto, com rede nem com um modelo real.
- Inputs:
  - sessões dos `codeAgent` neste arquivo
  - `DOCS/reports/20-11-2026/planreport_20261120131834_d-e.md` (todas as etapas `FEITO`)
- Decision:
  1. Os desvios relatados pelos `codeAgent` das fases D e E e dos ajustes de UX foram aceitos.
  2. Agora rodam em paralelo, só leitura: o `uxAgent` da fatia 2 (Radar, `/since` e Papers) e o `codereviewAgent` da fatia das fases A–C com os ajustes de UX delas, que não mudam mais.
  3. O code review das fases D–E roda depois dos ajustes de UX da fatia 2, para cobri-los. A passada final do `codeAgent` trata os relatórios de review.
  4. Pontos que os `codeAgent` deixaram e que vão para o review: os candidatos de uma resposta parada ou com erro continuam guardados na mensagem (localStorage do chat); o `validName` duplicado entre `useTrackers` e `useNoteTypes`; o CSS do `TrackersModal` que repete regras do `NoteTypesModal`; o menu de tools do chat das Anotações, que não recebe o agente.
- Next step: `uxAgent` (fatia 2) e `codereviewAgent` (fases A–C) em paralelo.

### UxAgent — fatia 2 (Radar, `/since` e Papers) — 20261120151417
- Summary: atende em parte. O desenho "o app busca, o modelo escolhe por marcador" é o ponto forte, e a 1ª consulta do Radar e a do Papers devem funcionar bem. Os problemas aparecem do 2º turno em diante. São 12 defeitos de comportamento, os principais:
  - D1: toda mensagem da conversa refaz o pipeline, e a janela do Radar já virou "hoje", o que leva a "Nothing new since <hoje>" no seguimento e gasta até 9 buscas por mensagem;
  - D2: escopo, janela e consultas só chegam ao modelo (nem ele vê o texto das consultas), e o escopo volta à pasta sem aviso;
  - D3: falha do planejador busca por nomes de caderno e avança a data;
  - D4: o perfil global do Radar vaza para o escopo de caderno e para o Papers;
  - D5: no chat das Anotações, o Radar sem chave do Tavily numa conversa vazia apaga o rascunho sem mostrar erro;
  - D6: o menu de tools das Anotações não recebe o agente;
  - D7: a confirmação do Add to KB não diz que ligar "Save web sources" faz o bibliotecário gravar sozinho;
  - D9: "/radar" + Enter dispara a consulta e consome a janela.
- Melhorias: 12, a principal sendo a M1: a nota Paper não guarda o link do PDF e o "Open in Library" só existe no balão efêmero.
- Opinião sobre os pontos em aberto:
  - manter os sete agentes, com separadores, `max-height` e a seção do Radar renomeada para "New papers";
  - levar o aviso de conflito do Paper ao modal;
  - trocar o rótulo da nota arquivada para "Archived (read)";
  - esconder "Save a copy" no Paper;
  - passar o agente ao menu das Anotações;
  - rótulo de status por agente.
- Output: `DOCS/reports/20-11-2026/uxreport_20261120151417_radar-papers.md`
- Left behind: o app não foi aberto e nenhum modelo nem rede foi usado. Ficam para conferir na tela: a densidade da lista em 220–300 px, o menu de 320 px nas Anotações e na Assistant, o popover das tools, o bloco do OpenAlex, a nota Paper no Tiptap e o board. Ficam para conferir com um modelo e com a rede: o seguimento do D1 e a prioridade do perfil do D4 (inferidos do código e do prompt), o `published_date` do Tavily (Releases podem vir vazias), a relevância e o orçamento do OpenAlex, o download de PDFs e o tempo do pipeline antes do 1º token.

### CodeReviewAgent — fatia A–C (trackers, Log e constância nos agentes) — 20261120151608
- Summary: as contas de semana e mês, o storage (`ensureTrackersTables`, coluna `note_types.log`, ordem das escritas) e a tool `query_trackers`, que só lê, estão corretos, e os testes cobrem as regras pedidas. Um defeito importante: a leitura dos trackers sem `catch` no Coach e no Plan week derruba o contexto inteiro desses agentes quando falha. Há uma suspeita importante: os textos do composer do Coach falam de trackers para quem não tem nenhum. O resto são nits: o `data-log-section` morto, o tooltip do dia manual mais nota, as propriedades órfãs do atalho Practice, o contador de tools, a spec da cor e os pontos deixados para a revisão (`validName`, CSS duplicado, `gap: 1px` aceito).
- Verdict: APROVADO COM RESSALVAS
- Output: `DOCS/reports/20-11-2026/reviewreport_20261120151608_trackers-log.md`

### Orchestrator — decisão — 20261120151928
- Summary: chegaram o relatório do `uxAgent` da fatia 2 (12 defeitos e 12 melhorias, mais oportunidades) e o review das fases A–C (aprovado com ressalvas: 1 defeito importante, 5 nits e 7 suspeitas).
- Inputs:
  - `DOCS/reports/20-11-2026/uxreport_20261120151417_radar-papers.md`
  - `DOCS/reports/20-11-2026/reviewreport_20261120151608_trackers-log.md`
- Decision:
  1. **Triagem da fatia 2:** entram os 12 defeitos (o D2 e o D10 com recorte) e 11 melhorias (várias com recorte), mais um caso de borda e uma frase de limite do OpenAlex. Ficam de fora 2 recusas e 8 adiamentos. Tudo está no `uxtriage`, dividido em três blocos (α pipeline e prompts, β interface do chat, γ fila de leitura e `/since`), um `codeAgent` por bloco.
  2. **Review das fases A–C:** um `codeAgent` trata o relatório agora, antes dos blocos de UX. Posição do Orquestrador sobre as suspeitas:
     - a mensagem padrão do Coach volta a "Check my plans", porque o texto fixo citava trackers para quem não tem nenhum;
     - a semana em que o tracker começa só entra em "semanas na meta" quando bateu a meta, a mesma regra da semana atual. Isso detalha a decisão 4 de 20261120121205;
     - a faixa não mostra "New tracker" antes da primeira leitura terminar;
     - o CSS repetido do `TrackersModal` fica como está: movê-lo sem ver a tela arrisca o modal de tipos;
     - o switch Trackers sem "On for Coach" no chat das Anotações se resolve no bloco β (D6).
- Next step: `codeAgent` das correções do review A–C; depois os blocos α, β e γ; depois o `codereviewAgent` das fases D–E e a passada final.

### CodeAgent — ajuste final (review fases A–C) — 20261120153002
- Summary: defeito 1: `loadTrackerDataSafe` (`agentData.ts`) no Coach e no Plan week; falha na leitura dos trackers = sem o bloco "Trackers" (com `console.warn`), com os planos e as tasks intactos. Nits: "Settings" do Log abre o modal já rolado até a seção Log (`focusLog`, o `data-log-section` ganhou leitor); tooltip do dia com marca manual e nota diz que arquivar a nota não basta; `setUpPracticeType` grava o tipo novo sem Log, depois as propriedades, depois o tipo com o Log; o contador do botão de tools não conta o Trackers (o menu não sabe se há tracker ativo); a spec diz o que o código faz com a cor. Suspeitas: textos do composer do Coach de volta aos de antes ("Check my plans"); a semana de início só conta quando bateu a meta (novo estado `startBelow` em `trackers.ts`, fora da linha do mês, do tooltip e das "Last 4 weeks"; o `/week-review` e a tool mostram o aviso); `useTrackers.loaded` e a faixa só com o título até a 1ª leitura; `loadNoteTypes` da keep com `loadWithRetry`. Revisão: `uniqueName` em `tasks.ts` no lugar do `validName` duplicado. Testes: virada de ano (regra da quinta-feira), semana de início e `uniqueName` (22 novos). `npx tsc --noEmit` limpo; `npm test`: 22 arquivos, 546 testes; `npx vite build` ok.
- Files changed:
  - `src/lib/trackers.ts` e `src/lib/trackers.test.ts`
  - `src/lib/tasks.ts` e `src/lib/tasks.test.ts` (`uniqueName`)
  - `src/lib/tasksEvents.ts` (só o `export` de `loadWithRetry`)
  - `src/lib/practiceSetup.ts`
  - `src/lib/agents/agentData.ts`, `src/lib/agents/coach.ts`, `src/lib/agents/planWeek.ts`
  - `src/lib/agents/chat.ts` (só os três textos do composer do Coach)
  - `src/hooks/useTrackers.ts` e `src/hooks/useNoteTypes.ts`
  - `src/components/Trackers/TrackersStrip.tsx`, `src/components/CalendarView/CalendarView.tsx`
  - `src/components/KeepPanel/KeepPanel.tsx`, `src/components/NoteTypes/NoteTypesModal.tsx`
  - `src/components/ChatPanel/ChatToolsMenu.tsx` (só a conta do contador)
  - `src/App.tsx` (só fiação: estado `log` do modal de tipos, "Settings" do Log, `focusLog` e `trackersLoaded`)
  - `DOCS/specs/trackers.md`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind: (a) S4, a recarga vinda da outra janela que tira da tela uma marca ainda em gravação: não corrigido (a janela é de poucos milissegundos, a marca já está gravada e volta na próxima recarga ou no próximo clique; a correção pede um mapa de marcas pendentes no hook, sem teste de hook para provar que é segura). (b) `useMetadataDefs.ts` tem uma terceira cópia do `validName`; fica como está (fora das fases A–C). (c) Sem ação, por decisão do Orquestrador: tipo Practice que já tinha Log (não sobrescreve a config do usuário) e o switch Trackers sem "On for Coach" no chat das Anotações (bloco β). (d) CSS repetido do `TrackersModal` e `gap: 1px`: não tocados. Não verificado com o app aberto nem com um modelo: a rolagem do modal até o Log, a faixa só com o título antes da 1ª leitura, o tooltip novo, o contador do botão de tools, a keep com nova tentativa dos tipos, e os prompts do Coach e do Plan week sem trackers e com a leitura falhando.


### CodeAgent — ajuste de UX da fatia 2, bloco α (pipeline, escopo e prompts: D1, D2 dados, D3, D4, D8 dados, D9, M2, M7 prompt e escopo sem notas com assunto) — 20261120155255
- Summary: D1: o `AgentContextInput` ganha `previousRun` (a última consulta concluída do mesmo agente na conversa, achada por `previousAgentRun` em `agentItems.ts` e calculada no `useChat` só para agente com pipeline). Mensagem de seguimento (`ragGate` skip ou reuse, sem escopo explícito nem data) não roda o pipeline: o contexto diz "Follow-up: the app did not search again…" com escopo, janela e consultas da consulta anterior, sem `items` e sem `onDone`, então a data do escopo não muda. Quando o pipeline roda de novo no mesmo escopo e no mesmo dia, o Radar usa o `since` da consulta anterior da conversa (`keptWindow`/`chooseRadarWindow`), e não a data já avançada. Os prompts do Radar e do Papers ganham a regra "perguntado sobre um item já mostrado, responda pela conversa". D2 (dados): `AgentItemsPayload.search` (`AgentSearchInfo`: `scopeKey`, `scopeLabel`, `since`, `windowNote`, `queries`, `profile`); o texto das consultas vai ao modelo na linha "Queries searched:". D3: o plano falho cai na reserva (Follow do perfil e tags do escopo; nome de caderno só em escopo de caderno, com 2+ palavras e nunca o Quick Notes; nunca nome de caderno em "tudo"; o nome do tipo do board não é assunto); a consulta de reserva (`radarQueryBuckets(...).reserve`) mostra os itens mas não grava a data; sem plano e sem reserva útil, o contexto diz "Search not done: could not plan the searches. Try again." D4: prompt do `radar_plan_queries` (Rust) com a regra de escopo estreito (Follow só para o que casa, Sources e Ignore sempre) e o Papers com o perfil reduzido à linha Ignore (`profileUse: 'ignore'` no `buildFocusMap`, `radarIgnoreText`); nos termos, o escopo vem antes do Follow. D8 (dados): `webPipeline.status` (Radar "Searching news, releases and papers…", Papers "Searching OpenAlex…"). D9: no `ChatComposer`, o atalho sozinho de agente com pipeline só seleciona o agente. M2: `requestedWindow` (data na mensagem, "since 01/11" sem ano, "last N days"/"últimos N dias") substitui a janela, com teto de 90 dias, e `recordedDate` garante que a data gravada nunca recua. M7 (prompt): o perfil só é proposto com "First check of this scope: yes" (linha nova do contexto), e os rótulos Follow, Sources e Ignore não se traduzem. Caso de borda: escopo sem notas e mensagem com assunto (`messageSubject`) busca pelo assunto no Radar e no Papers, que também usa o assunto como reserva (passa pelo `cleanQueries`). `npx tsc --noEmit` limpo; `npm test`: 22 arquivos, 626 testes (antes 546); `npx vite build` ok; `cargo check` (com `CARGO_TARGET_DIR` no scratchpad) sem erro nem aviso. Nada gravado em `src-tauri\target`.
- Files changed:
  - `src/lib/agentItems.ts` e `src/lib/agentItems.test.ts` (`AgentSearchInfo`, `AgentRun`, `previousAgentRun`)
  - `src/lib/radar.ts` e `src/lib/radar.test.ts` (`requestedWindow`, `keptWindow`, `chooseRadarWindow`, `recordedDate`, `isFollowUp`, `messageSubject`, `uniqueQueries`, `searchedQueries`, `reserve` em `radarQueryBuckets`, as duas notas de contexto)
  - `src/lib/radarProfile.ts` e `src/lib/radarProfile.test.ts` (`radarIgnoreText`)
  - `src/lib/focusMap.ts` e `src/lib/focusMap.test.ts` (`profileUse`, `profileUsed`, `terms` e `empty` novos)
  - `src/lib/agents/chat.ts` (`previousRun`, `webPipeline.status`)
  - `src/lib/agents/radar.ts` e `src/lib/agents/radar.test.ts`
  - `src/lib/agents/papers.ts` e `src/lib/agents/papers.test.ts`
  - `src/hooks/useChat.ts` (só o `previousRun` no `contextInput` e o import)
  - `src/components/ChatPanel/ChatComposer.tsx` (só a condição do D9)
  - `src-tauri/src/lib.rs` (só os prompts `radar` e `papers` de `radar_queries_prompt`)
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Deviations: (1) A janela do `since` da conversa só vale no mesmo dia da consulta anterior (o dia da mensagem, `AgentRun.ranOn`): sem isso, uma conversa retomada no dia seguinte repetiria a 1ª janela e o Radar deixaria de ser "desde a última consulta". (2) `parseDateInText` exige o ano, e o exemplo do bloco β é "since 01/11": o `requestedWindow` também lê "dd/mm" sem ano, só depois de since, from ou desde (o ano de hoje, ou o anterior se a data ainda não chegou); "last N days" também aceita "últimos N dias". (3) O payload só existe quando ao menos uma busca deu certo: busca toda falhada e "Search not done" ficam sem `items` (antes o Radar e o Papers devolviam o payload vazio), para um "try again" depois da falha não virar seguimento e a linha do app não dizer que buscou o que falhou. (4) O `search` guarda dois campos além dos pedidos: `scopeKey` (comparar o escopo da consulta anterior) e `profile` (a linha "radar profile"); `search` é opcional, porque mensagem gravada antes do campo não o tem. (5) Com o perfil reduzido ao Ignore, o escopo sem notas é `empty` no Papers mesmo com perfil. (6) "Ignore: nothing yet" (o que a proposta do Radar escreve) não conta como linha Ignore.
- Left behind: (a) O `NotesChatPanel` tem o mesmo atalho no `handleSend` (linha ~546) e continua enviando a mensagem padrão no "/radar" sozinho: é do bloco β, junto do D5. (b) As frases de "continue" do `ragGate` incluem "again", "try again" e "de novo": depois de uma consulta concluída, elas viram seguimento (sem busca). Quem quer refazer a consulta escreve outra frase. (c) Escopo estreito sem notas, com perfil do Radar e plano vazio do modelo: a reserva ainda usa o Follow do perfil (a triagem manda o Follow na reserva). (d) O indicador de busca do `useChat` acende também num seguimento, porque a decisão está dentro do `buildContext`. Não verificado com o app aberto nem com um modelo: se o modelo responde pela conversa no seguimento sem inventar item nem marcador; se o planejador obedece a regra de escopo estreito e a linha "Radar profile (ignore only)"; a leitura de "since 01/11" e "last 7 days" numa conversa real; a proposta do perfil só na 1ª consulta; a data gravada em `radar_scope_state` (só testada com simulações).

### CodeAgent — ajuste de UX da fatia 2, bloco β (interface do chat: D2 visual, D5, D6, D7, D8 visual, D9 nas Anotações, M2, M3, M4, M7 modal, M9, M10, M11, limite do Papers e correção do seguimento) — 20261120160816
- Summary: D2: o `AgentItemsList` mostra, acima da lista, a linha montada pelo app (`searchLine`, em `agentItems.ts`): `Notebook "ML" · since 13/11/2026 (last check) · radar profile · searched: graph neural networks, message passing`; sem janela no Papers; "radar profile" só como texto e antes do `searched:`; também sozinha quando a resposta não tem item (`hasAgentPayload`, que substitui `hasAgentItems` e passou para `agentItems.ts`, com teste); sem a linha em resposta parada, com erro, em streaming ou gravada antes do campo `search`. D5: no `NotesChatPanel`, o `handleSend` confere a chave do Tavily (deep research, web search ou pipeline do agente, como no `send()`) antes de limpar o rascunho; sem a chave o aviso fica na faixa de erro, com "Open Settings" (seção da busca, pelo novo `onOpenSettingsSection`, ligado no `App.tsx` ao `handleOpenMincerSettings`), e o rascunho fica; a faixa também mostra o erro `search` do `send()` com a conversa vazia. D6: o `ChatToolsMenu` das Anotações recebe o agente. D7: texto da confirmação do "Add to KB". D8: o composer mostra `agent.webPipeline.status` no lugar de "Searching the web..." (Chat e Assistant, em `ChatComposer`); nas Anotações, `RagSearchStatus` ganhou o `label` opcional. D9: o atalho sozinho de agente com pipeline só seleciona o agente também nas Anotações. M2: estado vazio do Radar com "To look further back, say 'since 01/11'." Limite visível: estado vazio do Papers diz que busca no OpenAlex e que artigos de conferência podem faltar. M3: o link "DOI" saiu (o `url` do artigo com DOI já é `https://doi.org/<doi>`, então o "Open" sempre o abre); a lista é um container (`container-type: inline-size`) e, com menos de 320 px, a linha de meta some e o selo do PDF encurta ("PDF available" / "No PDF"), com o texto completo no tooltip. M4: o menu de agentes ganhou `max-height: min(60vh, 440px)` com rolagem; a seção do Radar passou a "New papers" (prompt); descrição do Papers no seletor "Foundational and recent papers on a topic, not only new ones, for your reading list". M7: modal do perfil do Radar com a frase do escopo global. M9: nota de rodapé da chave do Tavily cita `/since`, Radar e Add to KB (com e sem chave); a confirmação de remover a chave cita o Radar; o erro de orçamento do OpenAlex mostra a hora local da renovação (`budgetResetTime`). M10: tooltip na data do item web. M11: tooltip no selo "Open-access PDF". Correção do seguimento: `isFollowUp` (em `lib/radar.ts`) ganhou o parâmetro `defaultMessage` e nunca é verdadeiro para a mensagem padrão do agente nem para pedido de refazer ("again", "try again", "check again", "refresh", "de novo", "novamente", "atualiza"); as mensagens padrão passaram a constantes (`RADAR_DEFAULT_MESSAGE`, `PAPERS_DEFAULT_MESSAGE`) usadas pelo composer e pelos agentes. Achado: a mensagem padrão ("What's new?", "Find essential papers") já não caía em seguimento (o `ragGate` devolve `search`); o defeito real eram "again", "try again", "de novo", "tenta de novo" e "tente de novo", que o `ragGate` lê como `reuse`. `npx tsc --noEmit` limpo; `npm test`: 22 arquivos, 645 testes (antes 626); `npx vite build` ok. Sem Rust: nada de `cargo check`.
- Files changed:
  - `src/lib/agentItems.ts` e `src/lib/agentItems.test.ts` (`searchLine`, `hasAgentPayload`)
  - `src/lib/radar.ts` e `src/lib/radar.test.ts` (`isFollowUp`, `RADAR_DEFAULT_MESSAGE`, `PAPERS_DEFAULT_MESSAGE`)
  - `src/lib/openalex.ts` e `src/lib/openalex.test.ts` (`budgetResetTime`, texto do erro de orçamento)
  - `src/lib/agents/chat.ts` (textos do estado vazio do Radar e do Papers, constantes da mensagem padrão)
  - `src/lib/agents/radar.ts` e `src/lib/agents/radar.test.ts` ("New papers", `defaultMessage`)
  - `src/lib/agents/papers.ts` e `src/lib/agents/papers.test.ts` (descrição, `defaultMessage`)
  - `src/components/ChatPanel/AgentItemsList.tsx` e `.module.css`
  - `src/components/ChatPanel/ChatMessageBubble.tsx` (só o `hasAgentPayload`)
  - `src/components/ChatPanel/ChatComposer.tsx` (só o texto do status)
  - `src/components/ChatPanel/RagSearchStatus.tsx` (`label` opcional)
  - `src/components/ChatPanel/AgentPicker.module.css` (`max-height`)
  - `src/components/ChatPanel/SaveAgentNoteModal.tsx` (só o resumo do perfil do Radar)
  - `src/components/NotesChat/NotesChatPanel.tsx` e `.module.css`
  - `src/components/Settings/SettingsModal.tsx` (só a nota de rodapé e a confirmação da chave do Tavily)
  - `src/App.tsx` (só a fiação: `onOpenSettingsSection` no `NotesChatPanel`)
- Files created:
  - nenhum
- Files removed:
  - nenhum (um teste temporário de renderização do `AgentItemsList` foi criado e apagado)
- Deviations: (1) O link "DOI" foi removido por inteiro (e o estilo `.link`): o `url` de todo artigo com DOI é `https://doi.org/<doi>`, então a condição "quando o Open já abre o DOI" é sempre verdadeira e manter o `if` seria código morto. (2) "radar profile" vem antes de "searched:" (e não no fim), para não parecer mais uma consulta. (3) `hasAgentItems` virou `hasAgentPayload` e saiu do componente para o `agentItems.ts`, para ter teste (a lista e a linha agora dependem de "tem itens ou tem `search`"). (4) O tooltip do selo "Open-access PDF" é "Open-access PDF. Add it to your reading list to read it in the Library.", para a forma curta "PDF available" ter o texto inteiro no tooltip e a frase do M11 sair intacta. (5) Nas Anotações, o `handleSend` espera a checagem da chave só nos turnos que a pedem, com uma trava contra Enter repetido durante a checagem.
- Left behind: (a) O indicador de busca do `useChat` continua aceso também num seguimento (a decisão está dentro do `buildContext`): agora ele diz "Searching news, releases and papers…" por um instante, mesmo sem buscar. (b) A mensagem de erro do download do PDF (`paperPdf.ts`) ainda diz "Open the DOI link instead.", e agora o link é o botão "Open": é do bloco γ. (c) O texto de ajuda do bloco da chave do Tavily no Settings ("Used by Web search, Deep research, /search, /profile and /expand…") não cita `/since`, Radar e Add to KB: só a nota de rodapé e a confirmação foram pedidas. (d) O alinhamento do menu de agentes (320 px) na coluna estreita das Anotações e na janela Assistant não mudou (fora do recorte do M4). Não verificado com o app aberto: a densidade da lista e a regra de coluna estreita (< 320 px) em 220 a 300 px, a quebra da linha do app com muitas consultas, a rolagem do menu de agentes, a faixa de erro e o aviso da chave nas Anotações (conversa vazia, rascunho mantido, "Open Settings" na seção da busca), o status do pipeline no composer das três superfícies e o menu de tools das Anotações com o Radar.

### CodeAgent — ajuste de UX da fatia 2, bloco γ (fila de leitura, nota Paper e /since: D10, D11, D12, M1, M5, M6, M8, dois textos do bloco β; documentação dos três blocos) — 20261120163000
- Summary: D10: `readingListMatch` devolve `archived` (`ReadingListEntry`); o artigo com a nota Paper arquivada mostra "Archived" (ícone `Archive`, botão neutro, tooltip "Archived Paper note · click to open") e o clique abre a nota. D11: o aviso de conflito virou "Saved without Year: your Paper type has Year as Text. Change it in Note types." e o sucesso do modal o mostra (o `inspectPaperType`, só leitura, lê o tipo antes de gravar). D12: sem "Save a copy" no "already saved" do Paper. M5: o sucesso do "Add to reading list" ganha "Open reading list" (`onOpenReadingList`, do App: `openNoteBoard` do board do tipo Paper, no ChatPanel e no NotesChatPanel; fora da Assistant e sem board, o botão não aparece) e, na primeira criação do tipo, "Your reading list is the Paper board in the notebook column." M1 (a): `paperNoteContent` grava `PDF: <url>` depois do `Source:` quando há `paperPdfLink`; `paperPdfFromContent` lê a linha com tolerância (texto, `<url>`, `[url](url)`, escapes). M1 (b): `PaperLibraryBar` (novo) no `topSlot`, depois da barra de propriedades, só em nota do tipo Paper (`isPaperType`): livro ligado e ainda na Library abre; sem livro e com a linha `PDF:` baixa, registra, liga e abre; sem os dois não aparece; "Downloading…" e o erro numa linha. O núcleo virou `openPdfInLibrary` (o `openPaperInLibrary` do chat é um invólucro) e o livro entra com o título da nota e a propriedade Authors (`paperNoteAuthors`). M6: "## Abstract (excerpt)" quando o abstract termina em "…" (o corte do `abstractFromIndex`), "## Abstract" quando inteiro, e "## My notes" vazio no fim, depois da sugestão da IA. M8: o corte padrão passa a ser o dia do último `/since` da própria nota (`lastSinceDay`, sobre as respostas embutidas na nota, concluídas e com texto), depois do `date`, do Calendar e da criação; sem instrução, a `query` gravada na resposta é "dd/mm/yyyy (origem)" (`sinceTitleQuery`) e o título do bloco vira "Since · 01/03/2026 (note created)". Textos: o erro do download do PDF (`books.rs`) agora diz "Use Open to read the paper in your browser." e o texto de ajuda do Tavily em Settings cita `/since` e o Radar. Documentação: `DOCS/specs/radar.md` reescrito nos pontos dos blocos α, β e γ (seguimento, janelas, reserva, perfil no escopo estreito e no Papers, linha do app, chat das Anotações, lista em coluna estreita, textos de Settings, erro de orçamento, nota Paper, Open in Library na nota, `/since`), mais PRD (§4 e §9) e a linha da spec no `docs.menu.md`. `npx tsc --noEmit` limpo; `npm test`: 24 arquivos, 682 testes (antes 22 e 645); `npx vite build` ok; `cargo check` (com `CARGO_TARGET_DIR` no scratchpad) sem erro nem aviso. Nada gravado em `src-tauri\target`.
- Files changed:
  - `src/lib/papers.ts` e `src/lib/papers.test.ts` (`ReadingListEntry.archived`, `isPaperType`, `paperPdfFromContent`, `paperNoteAuthors`, conteúdo da nota, texto do aviso)
  - `src/lib/paperPdf.ts` e `src/lib/paperPdf.test.ts` (`openPdfInLibrary`, texto do erro)
  - `src/lib/paperSetup.ts` (`inspectPaperType`)
  - `src/lib/radar.ts` e `src/lib/radar.test.ts` (`sinceCutoff` com `lastSince`, `lastSinceDay`, `sinceTitleQuery`, `isSinceTitleQuery`)
  - `src/components/ChatPanel/SaveAgentNoteModal.tsx` (aviso, "Open reading list", primeira criação, sem "Save a copy" no Paper)
  - `src/components/ChatPanel/AgentItemsList.tsx` e `.module.css` ("Archived")
  - `src/components/ChatPanel/ChatPanel.tsx` e `src/components/NotesChat/NotesChatPanel.tsx` (só a prop `onOpenReadingList`)
  - `src/components/Editor/commandParser.ts` e `src/components/Editor/CommandExtension.ts` (`responseCommandText`), `src/components/TasksView/TaskModalEditor.tsx` (usa o mesmo)
  - `src/components/Settings/SettingsModal.tsx` (só o texto de ajuda do Tavily)
  - `src/App.tsx` (só fiação: `PaperLibraryBar` no `topSlot`, `openReadingList`, `lastSince` e `startQuery` no `/since`, `responseCommandText`)
  - `src-tauri/src/books.rs` (só o texto do erro)
  - `DOCS/specs/radar.md`, `DOCS/specs/PRD.md`, `DOCS/docs.menu.md`
- Files created:
  - `src/components/NoteTypes/PaperLibraryBar.tsx` e `PaperLibraryBar.module.css`
  - `src/lib/paperSetup.test.ts`
  - `src/components/Editor/commandParser.test.ts`
- Files removed:
  - nenhum
- Deviations: (1) D11 e M5: o modal lê o estado do tipo Paper no storage antes de gravar (`inspectPaperType`), em vez de o `onCreate` devolver os avisos: devolver exigiria mudar o tipo de retorno do `onCreateAgentNote` em cinco arquivos e na ponte da Assistant. O `console.warn` do App continua. (2) M8: o título do bloco vem de `command` e `query`, sem coluna nova (schema fora do escopo), então a data e a origem vão como `query`. Isso tiraria a marca de "executada" da linha `/since` ao reabrir a nota, e por isso o `responseCommandText` (usado no App, no `CommandExtension` e no `TaskModalEditor`) ignora esse rótulo. Com instrução (data ou outro texto), a `query` fica como o usuário escreveu e o título mostra a instrução, sem rótulo de origem. O Retry do card lê o rótulo como instrução com data: a data e o título não mudam. (3) O texto do erro do PDF ("Use Open to read the paper in your browser.") aponta para o botão "Open" do item do chat, como pedido; a nota Paper não tem um "Open" (o link do DOI no topo faz o papel), então ali a frase é só aproximada. (4) "Archived" usa o ícone `Archive` e o botão neutro (sem a cor de "feito" do "In reading list"). (5) O último `/since` conta pelo dia em que o bloco foi gerado, não pelo corte dele, e só vale com o bloco embutido na nota; rodar o `/since` duas vezes no mesmo dia dá corte de hoje.
- Left behind: (a) O "Open in Library" da nota não tem botão no card do board (recorte da triagem). (b) Nota Paper criada antes desta mudança não tem a linha `PDF:`: o botão só aparece nela se já houver livro ligado. (c) O abstract é "(excerpt)" por terminar em "…"; um abstract inteiro que termine em "…" seria marcado por engano (raro). (d) Não verificado com o app aberto: o botão na nota Paper no Tiptap (posição abaixo da barra de propriedades, espaçamento e a linha de erro), a leitura da linha `PDF:` depois de o editor reescrever a URL, a seção "## My notes" vazia como último bloco da nota, o sucesso do modal com o aviso e a frase da primeira vez, o "Open reading list" nas três superfícies (Chat, Anotações e a ausência na Assistant), o "Archived" na lista, o título "Since · …" no bloco e a linha `/since` ainda marcada como executada depois de reabrir a nota. Com rede e modelo: o download de PDFs de editoras e o `/since` desde o último bloco.

### Orchestrator — decisão — 20261120162802
- Summary: as correções do review das fases A–C e os três blocos de ajustes de UX da fatia 2 (α, β e γ) estão implementados. O Orquestrador rodou `npx tsc --noEmit` e `npm test` depois de cada bloco: type-check limpo e 24 arquivos com 682 testes passando no estado atual. Os blocos com Rust rodaram `cargo check` com `CARGO_TARGET_DIR` no scratchpad, e nada foi gravado em `src-tauri\target`. Nada foi executado com o app aberto, com rede nem com um modelo real.
- Inputs:
  - sessões dos `codeAgent` neste arquivo
  - `DOCS/reports/20-11-2026/uxtriage_20261120133108.md`
- Decision:
  1. Os desvios relatados nos blocos α, β e γ foram aceitos, entre eles: a janela da conversa do Radar só vale no mesmo dia; "since 01/11" sem ano é aceito; o link "DOI" saiu por inteiro; o modal do Paper lê o tipo no storage para mostrar o aviso de conflito e a frase da primeira vez.
  2. O code review das fases D–E roda agora em duas frentes paralelas, só leitura: (1) pipeline e lógica do Radar e do `/since`; (2) Papers, fila de leitura, Library e a interface do chat.
  3. Pontos que vão com destaque para o review: a mudança na chave que marca um comando de slash como executado (`responseCommandText`, em `App.tsx`, `CommandExtension.ts` e `TaskModalEditor.tsx`), que vale para todos os comandos; os candidatos que ficam guardados na mensagem de uma resposta parada ou com erro; o indicador de busca que acende num seguimento sem busca; e a extração de `registerBookFile`, conferida só por leitura do diff.
- Next step: `codereviewAgent` das fases D–E (duas frentes); depois a passada final do `codeAgent` e a entrega ao Coordenador.

### CodeReviewAgent — fases D–E, frente 1 (pipeline e lógica do Radar e do `/since`) — 20261120163711
- Summary: lógica pura, tetos, privacidade das consultas, storage, Rust e `responseCommandText` corretos; type-check limpo e 682 testes passando. Três defeitos importantes: (1) o turno que termina só com a tool de memória (e o tool call sem handler) não passa pela finalização e mostra todos os candidatos; (2) resposta parada ou com erro guarda o payload inteiro (cerca de 30 KB) e marcadores crus no histórico; (3) voltar a um escopo já consultado na mesma conversa e no mesmo dia encolhe a janela para hoje. Nits: indicador de busca no seguimento, planejador não cancelável, `/since` sem linha de busca vazia, lógica do `/since` no `App.tsx`. Cinco suspeitas, entre elas a pergunta sobre um item que refaz o pipeline inteiro.
- Verdict: APROVADO COM RESSALVAS
- Output: `DOCS/reports/20-11-2026/reviewreport_20261120163711_radar-since.md`

### CodeReviewAgent — fases D–E, frente 2 (Papers, fila de leitura, Library e interface do chat) — 20261120163843
- Summary: dedupe, tipo Paper, `importBook` depois da extração, Library, lista de itens, modal e chat das Anotações corretos no essencial. Type-check, 682 testes e `cargo check` limpos. Três defeitos importantes: (1) o `_` que o editor escapa (`\_`) não é desescapado na linha `PDF:`, então o "Open in Library" da nota baixa a URL errada (confirmado numa ida e volta pelo editor real, no scratchpad); (2) o `PaperLibraryBar` aplica o resultado do download à nota aberta depois (falta `key` e guarda); (3) `books_download_pdf` lê o corpo inteiro na memória antes do teto de 50 MB. Seis nits: `.tmp` parcial, vínculo órfão que baixa a cada clique, ordem das gravações do tipo Paper, duplicação entre janelas com o modal aberto, rascunho perdido com `/radar <texto>` sem chave no Chat, erro enganoso com livro apagado. Uma suspeita importante: Enter repetido nas Anotações pode rodar a consulta duas vezes.
- Verdict: APROVADO COM RESSALVAS
- Output: `DOCS/reports/20-11-2026/reviewreport_20261120163843_papers-ui.md`

### Orchestrator — decisão — 20261120164128
- Summary: os dois reviews das fases D–E saíram aprovados com ressalvas, sem defeito crítico. Frente 1 (Radar e `/since`): 3 defeitos importantes, 4 nits e 5 suspeitas. Frente 2 (Papers, Library e interface): 3 defeitos importantes, 6 nits, 2 nits de texto e 5 suspeitas.
- Inputs:
  - `DOCS/reports/20-11-2026/reviewreport_20261120163711_radar-since.md`
  - `DOCS/reports/20-11-2026/reviewreport_20261120163843_papers-ui.md`
- Decision:
  1. A passada final roda em dois `codeAgent` em sequência, um por relatório, porque os dois mexem em arquivos vizinhos.
  2. **Frente 1:** entram os 3 defeitos importantes e os 4 nits. Decisão sobre a suspeita principal: a regra de seguimento é ampliada para cobrir a referência a um item já mostrado ("the second one", "esse artigo") e o pedido sobre a resposta anterior ("summarize", "explique"), que era o caso que o D1 da triagem devia resolver e continuava rodando a busca inteira. Uma pergunta nova com assunto próprio continua buscando.
  3. **Frente 2:** entram os 3 defeitos importantes (URL do PDF corrompida pelo escape do editor, download que vaza para outra nota, corpo lido inteiro na memória antes do teto de 50 MB), os nits e os dois textos. Das suspeitas, entram a trava do Enter repetido no chat das Anotações (S1), a recusa de endereço local no download, quando couber num ajuste pequeno (S2), e o `%PDF` aceito nos primeiros 1024 bytes (S3). Ficam registradas no backlog a releitura da fila a cada nota criada (S4) e a main que não relê a fila quando a nota vem da assistant (S5).
  4. O mesmo padrão de leitura do corpo inteiro existe no `librarian_fetch_and_save_pdf`, anterior a esta task: vai para o `DOCS/backlog.md`, sem correção aqui.
- Next step: aguardar o `codeAgent` da frente 1; depois o `codeAgent` da frente 2; depois a verificação final e a entrega ao Coordenador.

### CodeAgent — ajuste final (review fases D–E, frente 1: Radar e `/since`) — 20261120165640
- Summary: defeito 1: `finishAgentTurn` (`useChat.ts`) extraído do done (finaliza os marcadores, poda o payload e roda o `onDone` quando há texto) e chamado também no turno que termina só com `update_folder_memory`; o tool call sem handler só poda (`settleMessageItems`), sem `onDone`. Defeito 2: erro, Stop e corte na desmontagem aplicam a mesma poda (marcadores viram link, só os citados ficam, sem trecho); balão vazio de erro apaga o `agentItems`; a data não avança. Defeito 3: `AgentContextInput.previousRuns` (`agentRuns`) e `keptWindow` pela consulta mais recente do mesmo escopo e dia. Decisão do Orquestrador: `isFollowUp` também é seguimento quando a mensagem cita um item já mostrado (ordinal, número, demonstrativo com o tipo) ou começa pedindo para trabalhar a resposta anterior, em inglês e português; a `FOLLOW_UP_NOTE` diz que o usuário pode pedir "again". Nits: `onSearchStart` acende o status só antes do planejador (Radar e Papers); o Stop antes e durante o `radar_plan_queries` não deixa começar busca; `/since` sem resultado na janela ganha a linha "Web search: done, no results…"; a lógica do `/since` saiu do `App.tsx` para `prepareSinceContext`. Suspeitas pequenas: a janela mantida pedida antes vira "asked in an earlier message"; cabeçalho de seção órfão sai na finalização; artigo do Radar com data futura é descartado. `npx tsc --noEmit` limpo; `npm test`: 25 arquivos, 720 testes (antes 24 e 682); `npx vite build` ok. Sem Rust (nenhum `cargo`).
- Files changed:
  - `src/hooks/useChat.ts`
  - `src/lib/agentItems.ts` e `src/lib/agentItems.test.ts` (`agentRuns`, `finalizeMessageItems`, `settleMessageItems`, cabeçalho órfão)
  - `src/lib/radar.ts` e `src/lib/radar.test.ts` (`isFollowUp`, `keptWindow`, `chooseRadarWindow`, `FOLLOW_UP_NOTE`)
  - `src/lib/agents/chat.ts` (`previousRuns` e `onSearchStart` no `AgentContextInput`)
  - `src/lib/agents/radar.ts` e `src/lib/agents/radar.test.ts`
  - `src/lib/agents/papers.ts` e `src/lib/agents/papers.test.ts` (só `onSearchStart` e o Stop no planejador; o seguimento vem do `isFollowUp`)
  - `src/lib/agents/since.ts` (`prepareSinceContext`)
  - `src/App.tsx` (só o ramo `'since'` do `handleCommand`: a chamada e os imports)
  - `DOCS/specs/radar.md`
- Files created:
  - `src/lib/agents/since.test.ts`
- Files removed:
  - nenhum
- Left behind: (a) S5 (limite de 300 tokens do `librarian_decide`): sem ação, como combinado. (b) O Stop não cancela a requisição do planejador no Rust (só descarta o resultado); a spec registra. (c) A regra de seguimento é por frase: "why…", "explain…" ou "tell me more about X" com assunto novo também não busca (o modelo oferece "again"); "the last paper/release" e "the first paper on X" buscam. (d) Sem teste do `useChat` (done, Stop, erro, `memoryOnly`, corte): a poda e a finalização estão em funções puras testadas (`finalizeMessageItems`, `settleMessageItems`), mas a fiação dos eventos só passou por type-check e leitura. (e) Não verificado com o app aberto, com rede nem com um modelo: o indicador de status no composer, o `/since` de ponta a ponta, e se o modelo obedece à linha de seguimento sem inventar item.

### CodeAgent — ajuste final (review fases D–E, frente 2: Papers, Library e interface do chat) — 20261120171300
- Summary: defeito 1: `paperPdfFromContent` tira as barras que o editor grava na URL (`\_`, `\~`, `\*`, `\[`, inclusive o escape duplicado do autolink regravado), a regex da linha `PDF:` aceita o caractere com barra, a leitura da `Source:` desfaz o escape antes de achar o `openalex.org/W…`, e a URL do PDF é escrita com `_ * ~ \` [ ]` escapados (o editor lia `/_final_/` como itálico e perdia os sublinhados); teste de ida e volta pelo editor real (`paperNoteRoundTrip.test.ts`, 15 URLs) e testes com o texto como o editor o grava. Defeito 2: `PaperLibraryBar` com `key` pela nota no `App.tsx` e guarda por ref (erro, livro e `onOpenBook` de uma nota que já não está aberta são descartados). Defeito 3: `books_download_pdf` lê em pedaços (`resp.chunk()`) e para ao passar de 50 MB. Nits: `.tmp` apagado quando o `fs::write` falha; `openPdfInLibrary` remove o vínculo com o livro apagado antes de baixar (um clique, uma cópia) e lança `LinkedBookGoneError` ("The linked book is no longer in the Library, and the note has no PDF link.") quando não há link, e a barra mostra o erro e esconde o botão; `setUpPaperType` na ordem do Practice (tipo sem board, propriedades, tipo com board); fila conferida na main no ramo `paper` (`findReadingListNote`, o pedido `paper` leva `openalexId`; devolve a nota existente; o "Try again" com nota já criada não passa por ela); `/radar <texto>` com outro agente e sem a chave do Tavily no `ChatComposer` confere a chave antes de limpar o rascunho (sem ela só seleciona o agente e o aviso aparece); spec "HTTP 403 Forbidden" e a confirmação de remover a chave do Tavily cita `/since` e Add to KB. Suspeitas: S1 o `useChat.send` só guarda por `isStreaming` do render (não descarta turno concorrente), então a trava do `NotesChatPanel` (`sendingRef`) vai da conferência da chave até o `send()` voltar (ele volta quando o stream começa); S2 recusa `localhost`, `*.localhost` e IP literal de loopback, rede privada, link-local, `100.64.0.0/10` e IPv6 equivalentes, na URL e em cada redirecionamento (política custom, até 10); S3 `%PDF-` aceito nos primeiros 1024 bytes (com aborto assim que os 1024 primeiros chegam sem a assinatura). S4 e S5 sem ação, como combinado. 6 testes Rust novos em `books.rs` (`cargo test books::`, no scratchpad). `npx tsc --noEmit` limpo; `npm test`: 26 arquivos, 751 testes (antes 25 e 720); `npx vite build` ok; `cargo check` sem erro nem aviso.
- Files changed:
  - `src-tauri/src/books.rs`
  - `src/lib/papers.ts` e `src/lib/papers.test.ts`
  - `src/lib/paperPdf.ts` e `src/lib/paperPdf.test.ts`
  - `src/lib/paperSetup.ts` e `src/lib/paperSetup.test.ts`
  - `src/components/NoteTypes/PaperLibraryBar.tsx`
  - `src/App.tsx` (`key` no `PaperLibraryBar`, o import e a conferência da fila no ramo `paper`)
  - `src/lib/agentNotes.ts`, `src/lib/assistantNoteBridge.ts` e `src/components/ChatPanel/SaveAgentNoteModal.tsx` (`openalexId` no pedido `paper`)
  - `src/components/ChatPanel/ChatComposer.tsx`
  - `src/components/NotesChat/NotesChatPanel.tsx`
  - `src/components/Settings/SettingsModal.tsx` (a frase da confirmação)
  - `DOCS/specs/radar.md`
- Files created:
  - `src/lib/paperNoteRoundTrip.test.ts`
- Files removed:
  - nenhum
- Left behind: (a) S4 (cada balão relê todas as notas a cada nota Paper criada) e S5 (a main não relê a fila quando a nota vem da assistant): backlog do Orquestrador. (b) `librarian_fetch_and_save_pdf` (`documents.rs`) segue lendo o corpo inteiro: backlog. (c) O guarda do `useChat.send` é por `isStreaming` do render e há `await` antes de o turno marcar o stream (chave, histórico, tools): fora das Anotações, o Enter repetido com um agente de mensagem padrão (Radar, Papers, Coach, Plan week) ainda pode abrir dois turnos no `ChatComposer`; fechar isso é no `useChat` (fora do combinado). (d) A recusa de endereço local não cobre um nome que resolve para IP local (sem DNS). (e) A política de redirecionamento e o fluxo de pedaços do download não têm teste automatizado (sem rede): só a lógica pura (host, assinatura, mensagem) tem `cargo test`. (f) Sem teste de componente para `PaperLibraryBar`, `ChatComposer` (atalho sem chave) e `NotesChatPanel` (trava), nem para o ramo `paper` do `App.tsx`: só type-check e leitura. (g) Com a fila conferida na main, o modal mostra "Paper added" e "Go to note" também quando devolve a nota que já existia. (h) Com o livro apagado e o botão ainda lendo `hasBook` velho, o rótulo diz "Opening…" durante o download. (i) Não verificado com o app aberto, com rede nem com editoras reais.

### Orchestrator — encerramento — 20261120171503
- Summary: as cinco features do Task Report estão implementadas na branch `feat/radar-trackers`, sem commit: trackers de constância no Calendar, Log por tipo de nota, constância nos agentes, Radar com `/since`, e Papers com fila de leitura. A rodada do `uxAgent` (duas fatias) foi triada e os itens aceitos foram implementados. Os três relatórios de review saíram aprovados com ressalvas, e as correções foram aplicadas.
- Inputs:
  - todos os documentos da seção `## Documents`
- Decision:
  1. Verificação final feita pelo Orquestrador no estado entregue: `npx tsc --noEmit` limpo; `npm test` com 26 arquivos e 751 testes passando (eram 9 arquivos e 105 testes no início); `npx vite build` sem erro; `cargo check` sem erro nem aviso, com `CARGO_TARGET_DIR` no scratchpad. Nada foi gravado em `src-tauri\target` (o arquivo mais recente lá é das 11:58, anterior à task). Nenhum commit foi feito: a branch aponta para 141f067.
  2. Nada foi executado com o app aberto, com rede nem com um modelo real, por instrução do Coordenador, que testa no final. Ficam sem verificação a aparência de todas as telas novas, as gravações contra o SQLite, a sincronização entre as janelas, as chamadas ao Tavily e ao OpenAlex, o download de PDF e os prompts dos agentes.
  3. Mudança de escopo aprovada pelo Coordenador durante a task: o OpenAlex como fonte acadêmica do Papers e dos artigos do Radar, no lugar do Crossref e do Unpaywall citados no Task Report.
  4. O que ficou para trás está registrado no `DOCS/backlog.md` (entradas de 2026-11-20) e nas listas "Fica de fora" do `uxtriage`.
  5. Um processo `monet.exe` de `src-tauri\target\release` está rodando desde as 12:54, aberto pelo gerenciador de arquivos do Coordenador. Não foi iniciado por nenhum agente e não foi tocado. Esse executável é anterior à task e não tem as features novas.
- Next step: concluído. Aguardando o teste do Coordenador.

### Orchestrator — decisão — 20261120211206
- Summary: ajuste pedido pelo Coordenador durante o teste. Ele adicionou um artigo de acesso fechado à fila de leitura, baixou o PDF por fora, importou na Library e perguntou como associar o livro à nota Paper. Hoje o vínculo só se faz pelo painel Notes do Reader, e o botão "Open in Library" não aparece no modal "Edit note" do board, que é por onde a fila de leitura abre a nota. O Coordenador aprovou a correção ("Sim, adiciona").
- Inputs:
  - mensagem do Coordenador com os prints da nota Paper no modal do board e do livro na Library
  - `src/lib/readerNoteLink.ts`, `src/components/NoteTypes/PaperLibraryBar.tsx`, `src/components/Reader/ReaderNotesPanel.tsx`, `src/App.tsx` (montagem da barra)
- Decision: um `codeAgent` (Sonnet 5.5) com contexto mínimo, como prevê o orquestrador para ajustes pedidos no teste, sem novo Task Report. Escopo:
  1. Na barra da nota Paper, a ação "Link a Library book…" quando não há livro ligado, com um seletor dos livros da Library; com livro ligado, "Open in Library" e "Unlink".
  2. A mesma barra no modal "Edit note" do board.
  3. A barra reflete na hora um vínculo feito ou desfeito em outro lugar (o painel Notes do Reader).
  Sem Rust: o app de dev do Coordenador está aberto e recebe as mudanças pelo recarregamento do Vite.
- Next step: `codeAgent` do ajuste; depois a conferência do Orquestrador e a atualização do roteiro de teste.

### CodeAgent — ajuste pedido no teste (ligar livro da Library pela nota Paper) — 20261120212700
- Summary: (1) `PaperLibraryBar` ganhou "Link a Library book…" (`Link`; sem livro ligado e com caderno; secundária quando há a linha `PDF:`, única ação quando não há), "Unlink" (`LinkBreak`; com livro ligado, sem confirmação) e passa a aparecer em toda nota Paper de caderno. O seletor (`PaperBookPicker`, popover z-index 1100 sob a linha da barra) lista os livros de `storage.getBooks()` com título e autor (ou "—") na ordem da Library, tem filtro com mais de 10 livros, ↑↓/Enter/Esc/clique fora, e marca "linked to another note"; esse livro pede `useConfirm` ("Link"). Escolher grava `setReaderNoteLink` e não navega; o vínculo com livro apagado é removido ao ligar o novo. (2) A barra já estava montada no modal "Edit note" do board: o modal renderiza o mesmo `noteEditor` do `App.tsx` (um único ponto de montagem, sem props duplicadas); ela só ficava escondida sem livro e sem `PDF:`. O que faltava era o "Open in Library" fechar o modal: o `onOpenBook` da barra agora chama `setNoteBoardModalId(null)` antes de `openBookInLibrary`. (3) `readerNoteLink.ts` avisa a janela (`monet:reader-note-link-changed`) só quando o registro muda (valor igual não grava nem avisa); a barra relê o vínculo pelo evento. Caminho contrário: o `ReaderNotesPanel` só existe com a Library aberta, que não convive com o editor da nota na mesma janela, e lê o vínculo ao montar; nenhuma mudança nele. Lógica pura em `bookList.ts` (ordem e filtro, que a Library passa a usar) e `readerNoteLink.ts` (`sameReaderNoteLink`, `isLinkedToOtherNote`), com testes. Verificado também num harness de Vite à parte (storage simulado; apagado): modal e coluna de 300 px, teclado, Esc sem fechar o modal, confirmação, Library vazia e com erro, vínculo mudado por fora. `npx tsc --noEmit` limpo; `npm test`: 28 arquivos, 765 testes (antes 26 e 751); `npx vite build` ok.
- Files changed:
  - `src/lib/readerNoteLink.ts`
  - `src/components/NoteTypes/PaperLibraryBar.tsx` e `src/components/NoteTypes/PaperLibraryBar.module.css`
  - `src/components/Library/Library.tsx` (ordem e filtro vêm de `bookList.ts`; sem mudança de comportamento)
  - `src/App.tsx` (só o `onOpenBook` da `PaperLibraryBar`)
  - `DOCS/specs/radar.md` (§11 e §12) e `DOCS/specs/PRD.md` (Library)
- Files created:
  - `src/lib/bookList.ts` e `src/lib/bookList.test.ts`
  - `src/lib/readerNoteLink.test.ts`
  - `src/components/NoteTypes/PaperBookPicker.tsx` e `src/components/NoteTypes/PaperBookPicker.module.css`
- Files removed: nenhum
- Left behind: (a) Sem teste de componente para a barra e o seletor (o projeto não tem testing-library); a conferência foi no harness, não no app real nem no modal real do `App.tsx`. (b) Nota com mais de um livro ligado (pelo painel Notes do Reader): a barra mostra o primeiro e o Unlink tira um por vez; o `findBookIdForNote` já era assim e a spec registra. (c) "linked to another note" não confere se a outra nota ainda existe (um vínculo órfão pede a confirmação à toa); o painel do Reader limpa esse vínculo quando abre.

### Orchestrator — decisão — 20261120212644
- Summary: o ajuste do vínculo entre o livro da Library e a nota Paper foi entregue e conferido pelo Orquestrador: `npx tsc --noEmit` limpo, `npm test` com 28 arquivos e 765 testes passando, `npx vite build` sem erro. Sem Rust. O `codeAgent` usou um harness de Vite à parte para conferir a barra; não ficou servidor na porta 5199, o `node_modules` do projeto é um diretório normal e não sobrou arquivo temporário. O app de dev do Coordenador continuou aberto.
- Inputs:
  - sessão do `codeAgent` acima (20261120212700)
- Decision:
  1. O desvio do item 2 foi aceito e corrige o diagnóstico do Orquestrador: a barra já estava montada no modal "Edit note" do board, que usa o mesmo editor. Ela não aparecia porque a nota não tinha livro ligado nem a linha `PDF:`. O que faltava era o "Open in Library" fechar o modal.
  2. A extração da ordem e do filtro dos livros da `Library.tsx` para `src/lib/bookList.ts` foi aceita: é o que faz o seletor seguir a mesma ordem da Library.
  3. `setReaderNoteLink` deixou de regravar um valor igual ao que já está gravado. Aceito.
  4. No mesmo teste, o Coordenador notou que o Papers numa nota "Dom Quixote" trouxe artigos de arquitetura de software, viu que nomear o assunto na mensagem resolve e pediu para não mudar nada ainda. As causas e o caminho de correção estão no `DOCS/backlog.md` (entrada de 2026-11-20).
  5. O roteiro de teste ganhou os itens 7.23 a 7.30, do vínculo pela nota.
- Next step: aguardando o teste do Coordenador.

### Orchestrator — decisão — 20261120213256
- Summary: pedido novo do Coordenador durante o teste, fora do escopo do Task Report: a janela de busca do Ctrl+P (`src/components/SearchPalette/`) é muito útil e pequena demais para a importância que tem. Pedido, nas palavras dele: "Faça ela maior e mais imponente".
- Inputs:
  - mensagem do Coordenador com o print da janela (cerca de 520 px de largura, pouco mais de quatro resultados visíveis)
- Decision: tratado como ajuste visual pedido no teste, sem novo Task Report, porque é uma mudança de aparência pequena e com instrução direta. Vai para o agente de `DOCS/agents/designer.md`, em Sonnet 5.5, com contexto mínimo. Só aparência: a busca, os filtros, o teclado e os atalhos não mudam. Sem Rust, porque o app de dev do Coordenador está aberto.
- Next step: agente designer; depois a conferência do Orquestrador.

### Designer — janela do Ctrl+P maior e mais imponente — 20261120215000
- Summary: só aparência, sem mudar busca, filtros, ordem, teclado, atalhos ou textos. A janela foi de 520 px para 840 px de largura (`min(840px, 100%)`, margem lateral de 32 px) e de 506 px para até 720 px de altura total, sempre limitada à janela (`max-height: min(720px, 100vh - topo - 32px)`, topo de 8vh). O campo foi de 15 px para 20 px, com lupa Phosphor e a faixa inteira clicável (o foco continua como antes). Os chips foram de 12 px/24 px para 13 px/28 px, o título e o trecho das linhas de 14 px/12 px para 16 px/13 px e o rodapé de 11 px para 12 px, com faixa mais escura. A linha selecionada ganhou barra de destaque à esquerda. A sobreposição passou a ser a dos modais grandes (`rgba(10, 10, 14, 0.7)` e desfoque de 2 px), o painel usa raio `--radius-xl`, borda `--hair` e sombra maior. A linha passou de 79 px para 84 px de altura. Em janela baixa (`max-height: 700px`) o campo e os chips descem um degrau e a lista fica com 365 px (antes 360 px); em janela estreita (`max-width: 720px`) o respiro lateral cai para 16 px. O `MarkNotePicker` usa a mesma base de CSS e não mudou: a captura dele antes e depois é idêntica byte a byte.
- Medidas no harness (Vite à parte, dados simulados, 10 notas recentes): janela 1280x800: antes 4 linhas inteiras (5 com a parcial), depois 5 inteiras (6 com a parcial; 6 inteiras sem o rodapé); 1920x1080: 5 inteiras e a sexta parcial; 960x600 (mínimo do app): 4 inteiras e a quinta parcial, como antes. Com 9 `ArrowDown` o item selecionado ficou visível nos dois tamanhos (a lista rola, `scrollTop` 364 e 423).
- Files changed:
  - `src/components/SearchPalette/SearchPalette.module.css` (variáveis locais `--pal-*`; classes `.paletteOverlay`, `.palettePanel`, `.searchRow`, `.searchIcon`; regras escopadas em `.palettePanel` para as classes compartilhadas com o `MarkNotePicker`; blocos `@media` de janela baixa e estreita)
  - `src/components/SearchPalette/SearchPalette.tsx` (só classes extras no overlay e no painel, a lupa `MagnifyingGlass` na faixa do campo e os tamanhos dos ícones dos chips e das linhas; nenhuma mudança de lógica)
  - `DOCS/reports/20-11-2026/executionreport_20261120115512.md` (esta sessão)
- Files created: nenhum no projeto. As capturas (`before-*.png` e `after-*.png`) ficaram na pasta `ctrlp` do scratchpad da sessão.
- Files removed: nenhum. O harness (Vite na porta 5299, Edge headless na 9333, cópia do componente anterior) foi desmontado; nenhum arquivo no projeto e `node_modules` do projeto intacto (nunca houve junction).
- Verification: `npx tsc --noEmit` limpo; `npm test` com 28 arquivos e 765 testes passando; `npx vite build` sem erro.
- Left behind: (a) Não conferido no app real: aparência com as notas, tipos e cadernos reais, barra de rolagem e desfoque do fundo no WebView2. (b) O campo agora usa `font-family: inherit` (Inter); antes caía na fonte padrão de input do navegador, ao contrário do padrão do projeto. (c) O selo do tipo vem do `TypeEyebrow` (outra pasta, 10 px fixo) e foi ampliado por seletor `[title]` no CSS da palette, sem tocar no componente; se o selo deixar de ter `title`, ele volta ao tamanho antigo sem quebrar. (d) Sugestões não aplicadas: dica "Esc" à direita do campo, largura que cresce em janela grande (hoje fixa em 840 px) e chips de tipo numa linha só com rolagem horizontal.

### Orchestrator — decisão — 20261120214859
- Summary: o redesenho da janela do Ctrl+P foi entregue pelo agente designer e conferido pelo Orquestrador: `npx tsc --noEmit` limpo, `npm test` com 28 arquivos e 765 testes passando, `npx vite build` sem erro. O diff fica só em `src/components/SearchPalette/` (CSS e classes do `.tsx`), sem Rust. Não ficou servidor do ambiente de teste (portas 5299 e 9333), o `node_modules` do projeto está intacto e não sobrou arquivo no projeto. O Orquestrador viu as capturas de antes e de depois em 1280x800, tiradas no ambiente de teste com dados simulados.
- Inputs:
  - sessão do designer acima
  - capturas em `scratchpad\ctrlp\` (`before-recent-1280x800.png`, `after-recent-1280x800.png`)
- Decision: aceito. A janela passa de 520 para 840 px de largura e de 506 para até 720 px de altura, o campo de busca vai de 15 para 20 px com uma lupa, as linhas ficam mais legíveis e a selecionada ganha uma barra de destaque, e o fundo atrás escurece com desfoque. O comportamento não mudou. As três sugestões de comportamento do designer (dica "Esc" no campo, largura que cresce em janela grande, chips numa linha só com rolagem) não foram aplicadas e ficam para o Coordenador decidir.
- Next step: aguardando o teste do Coordenador.

### Orchestrator — decisão — 20261120221302
- Summary: o Coordenador viu a janela do Ctrl+P no app e pediu: "a font tá grande demais. Diminua as fontes e coloque mais borda nas laterais (respiro)". O ajuste é de valores no `SearchPalette.module.css`, e o Orquestrador o fez direto, sem agente, porque são números numa escala que já estava em variáveis e o Coordenador acompanha o resultado ao vivo.
- Inputs:
  - mensagem do Coordenador
  - `src/components/SearchPalette/SearchPalette.module.css`
- Decision:
  1. **Fontes de volta à escala do app:** campo de busca de 20 para 16 px (lupa de 22 para 18), título do resultado de 16 para 14, trecho de 13 para 12, caderno e metadados de 12 para 11, chips de 13 para 12 (altura de 28 para 24), cabeçalho "Recent", rodapé e dicas de 12 para 11, teclas de 11 para 10, estado vazio de 15 para 13. A ampliação do selo do tipo foi removida: ele volta ao tamanho do próprio componente (10 px).
  2. **Respiro lateral:** a margem interna da janela passa de 24 para 40 px (`--space-10`, a mesma margem lateral do editor). Em janela com até 720 px de largura continua em 16 px.
  3. O tamanho da janela (840 px, até 720 px de altura), o fundo escurecido, a sombra e a barra da linha selecionada ficam como estavam.
  4. Verificação: `npx vite build` e `npx tsc --noEmit` sem erro. O Orquestrador tentou ver a janela abrindo o servidor de dev no navegador, mas o app não sobe fora do Tauri (tela em branco); a conferência visual fica com o Coordenador, que está com o app aberto.
- Next step: aguardando o retorno do Coordenador sobre o novo tamanho.

### Orchestrator — decisão — 20261120221936
- Summary: no teste, o Coordenador mandou um item do Radar para o Mincer e recebeu "The page returned HTTP 403 Forbidden." (`https://pubsonline.informs.org/doi/10.1287/opre.2025.1837`). O Orquestrador reproduziu o 403 fora do app, com o mesmo User-Agent do Mincer e com cabeçalhos completos de navegador: a resposta vem com `Server: cloudflare` e `Cf-Mitigated: challenge`. Não é defeito do app, e o `src-tauri/src/mincer/webpage.rs` não foi alterado nesta branch. O que o app faz mal é a mensagem. O Coordenador aprovou duas melhorias ("Sim, os dois").
- Inputs:
  - mensagem do Coordenador com o print do item no Mincer
  - `src-tauri/src/mincer/webpage.rs`, `src-tauri/src/mincer/jobs.rs` (chamada de `fetch_article`), comandos da chave do Tavily em `src-tauri/src/lib.rs`
- Decision: um `codeAgent` (Sonnet 5.5) com contexto mínimo. Escopo:
  1. Quando o site barra o pedido, a mensagem do Mincer diz que o site exige um navegador e orienta abrir a página e colar o texto.
  2. Quando o site barra e há chave do Tavily, o Mincer tenta ler a página pelo Tavily antes de falhar.
  É mudança de comportamento do Mincer, fora do escopo do Task Report (que só previa a entrada "Send to Mincer"), feita a pedido do Coordenador. Mexe em Rust: o `tauri dev` do Coordenador recompila e reinicia o app.
- Next step: `codeAgent` do ajuste; depois a conferência do Orquestrador.

### CodeAgent — ajuste pedido no teste (página web barrada pelo site: mensagem e segunda tentativa pelo Tavily) — 20261120223000
- Summary: (1) `webpage.rs`: `fetch_article` passa a devolver `FetchError` (`Blocked` | `Failed(String)`; `From<String>` mantém os `?` e as mensagens de hoje). É barrada (`is_blocked`) a resposta 401 ou 403 e qualquer resposta com o cabeçalho `cf-mitigated`, conferida antes do `is_success`; 404, 500, tempo esgotado, "not a web page", "larger than 10 MB" e "no readable content" não mudam e não chamam o Tavily. (2) Segunda tentativa (`extract_with_tavily`): `POST https://api.tavily.com/extract` com `{"urls": [url], "format": "markdown"}` (o contrato do `tavilyExtract` de `src/lib/search.ts`, conferido na documentação atual do Tavily), `Authorization: Bearer` com a chave lida no Rust (`read_key("tavily_key")`), tempo limite de 30 s e resposta lida com teto (2 × 10 MB, por causa do escape do JSON); `parse_tavily_extract` lê `results[0].raw_content` (com `trim`), o motivo de `failed_results[0].error` ou "returned no text", e aplica o teto de 10 MB ao texto. (3) `jobs.rs`: no ramo `web_summary`/`web_capture`, `Blocked` chama `read_blocked_page`: sem chave, falha com `blocked_message()`; com chave, estágio `fetching_tavily` e `extract_with_tavily` dentro de um `select!` com `ctx.cancelled()` (Cancel e Quit abandonam o pedido); com falha, `tavily_failure_message`. O texto do Tavily segue o caminho normal (captura ou resumo); o Resume refaz o caminho inteiro. Os dois modos de página passam por `fetch_article`, então valem os dois. (4) `STAGE_LABELS.fetching_tavily` = "The site blocked direct access — reading the page through Tavily". Mensagens: sem chave, "This site blocked direct access because it requires a web browser. Open the page in your browser, copy the text and paste it in the Paste tab of Mincer. With a Tavily key in Settings (Web Search), Mincer tries to read the page through Tavily."; com chave e o Tavily falhando, "This site blocked direct access because it requires a web browser, and reading it through Tavily failed too. Open the page in your browser, copy the text and paste it in the Paste tab of Mincer." mais, depois da linha em branco, o motivo ("Tavily returned HTTP 432.", "Tavily could not read the page (…).", "Tavily returned no text for this page.", "Could not reach Tavily: …", "Tavily sent an unexpected response."); texto do Tavily acima do teto: "The page is larger than 10 MB.". Sem campo para a nota "texto lido pelo Tavily" depois de pronto: a única coluna de texto livre que o item tem é `error`, que só vale para item que falha, e usá-la num item `done` seria desvio de significado (e o banner só lê `error` nos estados de falha); o aviso fica só no estágio. 12 testes Rust novos em `webpage.rs` (classificação de 401/403/`cf-mitigated`, mensagens, corpo do pedido só com a URL, leitura da resposta do Tavily, teto), sem rede. Rust escrito num espelho do crate no scratchpad (check e test lá) e aplicado em duas gravações seguidas (`webpage.rs` e `jobs.rs`), para o `tauri dev` recompilar uma vez; nenhum build dentro de `src-tauri\target`.
- Files changed:
  - `src-tauri/src/mincer/webpage.rs`
  - `src-tauri/src/mincer/jobs.rs`
  - `src/lib/mincer.ts` (só o rótulo do estágio `fetching_tavily`)
  - `DOCS/specs/mincer.md` (§2 linhas Web page, §3 stages e bullet "Página que barra o acesso direto", §6)
  - `DOCS/specs/radar.md` (frase do "Send to Mincer")
  - `DOCS/reports/20-11-2026/executionreport_20261120115512.md` (esta sessão)
- Files created: nenhum no projeto
- Files removed: nenhum
- Verification: `cargo check` limpo e `cargo test` com 93 passados e 3 ignorados (CARGO_TARGET_DIR do scratchpad; 12 deles são os novos de `webpage.rs`); `npx tsc --noEmit` limpo; `npm test` com 28 arquivos e 765 testes passando; `npx vite build` sem erro.
- Left behind: (a) Não conferido com o app aberto nem com chave real do Tavily: o caminho completo (barrada, Tavily lê, resumo ou captura) e o Cancel durante o Tavily dependem disso; o Tavily pode não passar pelo desafio da Cloudflare no `extract_depth` padrão (`basic`), e o `advanced` (2 créditos a cada 5 URLs, contra 1) não foi ligado por não estar no pedido. (b) O Tavily não devolve título: um item lido por ele fica com a URL como título. (c) O toast de falha corta em 180 caracteres a mensagem sem chave (a frase do Tavily sai incompleta nele; o banner mostra tudo). (d) O texto do Settings › Web Search lista o que usa a chave e não cita o Mincer (`SettingsModal.tsx`, fora do escopo). (e) Depois de pronto, o item não diz que o texto veio pelo Tavily.

### Orchestrator — decisão — 20261120222924
- Summary: o ajuste do Mincer para página barrada pelo site foi entregue e conferido pelo Orquestrador: os 12 testes Rust novos de `webpage.rs` passam (`cargo test webpage`, com `CARGO_TARGET_DIR` no scratchpad), `npx tsc --noEmit` limpo, `npm test` com 28 arquivos e 765 testes, `npx vite build` sem erro. O `tauri dev` do Coordenador recompilou e o app de dev reiniciou às 22:25:54.
- Inputs:
  - sessão do `codeAgent` acima (20261120223000)
- Decision:
  1. Aceito. Resposta 401 ou 403, ou qualquer resposta com `cf-mitigated`, passa a ser "barrada": com chave do Tavily, o Mincer tenta ler a página por ele (só a URL vai ao Tavily); sem chave, ou se o Tavily também falhar, a mensagem explica o bloqueio e orienta abrir a página e colar o texto.
  2. O aviso de que o texto veio pelo Tavily aparece só no estágio de progresso. Depois de pronto, o item não guarda a origem, porque não há campo para isso sem mudar o schema. Aceito como limite e levado ao Coordenador.
  3. Ponto em aberto para o teste do Coordenador: a extração usa o modo padrão do Tavily (`basic`), o mesmo do "Add to KB". Não se sabe se ele passa pelo desafio do Cloudflare na página da INFORMS. Se não passar, a alternativa é o modo `advanced`, que custa mais créditos; a decisão é do Coordenador.
  4. O roteiro de teste ganhou os itens 5.27 a 5.30.
- Next step: aguardando o teste do Coordenador com o mesmo link.

### Orchestrator — decisão — 20261120223500
- Summary: o Coordenador testou o mesmo link depois do ajuste. A segunda tentativa rodou e o Tavily também não leu a página ("Tavily could not read the page (Failed to fetch url)."). O item mostrou a mensagem prevista, com o motivo em "Technical details".
- Inputs:
  - print do Coordenador com o item em erro no Mincer
- Decision: o Coordenador aceitou o resultado: quando não der para ler direto, ele busca a informação e cola no Mincer. O modo `advanced` de extração do Tavily não será ligado agora. O ajuste fica como está.
- Next step: aguardando a continuação do teste do Coordenador.

### Orchestrator — decisão — 20261121000500
- Summary: o Coordenador pediu que o Orquestrador executasse o resto do roteiro de teste. Ele reabriu o app de dev com a depuração remota (porta 9333), e dois testadores (Sonnet 5.5), em sequência, dirigiram o app real por CDP, com um driver escrito no scratchpad. Em paralelo ao segundo, uma investigação só de leitura (Opus 5.5) apurou três comportamentos estranhos vistos pelo primeiro.
- Inputs:
  - `DOCS/reports/20-11-2026/testresults_20261120231039_trackers-log.md` (regressão, trackers, Log, vínculo livro–nota, Ctrl+P): 60 passaram, 0 falharam, 4 não feitos
  - `DOCS/reports/20-11-2026/testresults_20261120235817_radar-papers.md` (agentes, Radar, `/since`, Papers, Settings): 59 passaram, 4 falharam, 8 não feitos
  - `DOCS/reports/20-11-2026/explorerreport_20261120232133_achados-teste.md`
- Decision:
  1. **Defeitos do que foi entregue nesta task, para corrigir agora** (um `codeAgent`, sem Rust):
     - o perfil do Radar vaza para o escopo de caderno, tag ou board (5.21): a restrição só existe no texto dos prompts e o modelo que gera as consultas não a segue. Passa a ser garantida pelo app: em escopo estreito, o "Follow" do perfil não entra no mapa de foco nem na reserva de consultas, e um caderno sem notas é vazio mesmo com perfil;
     - numa busca repetida na mesma conversa ("again", "since 01/11"), o modelo não dá a lista e "corrige" as respostas anteriores dizendo que não vinham dos candidatos, o que é falso (5.14, 5.16, 7.10);
     - o menu de agentes sai 29 px da janela com o painel de chat no mínimo de 300 px (5.26);
     - o texto de ajuda do Tavily em Settings não cita o Add to KB (8.2);
     - o "+" dos pontos de tracker sai 1 px abaixo da célula da grade (2.17);
     - um link de redirecionamento do Google apareceu como item do Radar;
     - o Stop durante o planejamento das consultas deixa a conversa só com a mensagem do usuário, sem "Stopped" e sem Retry (5.22).
  2. **6.4 não é defeito do app:** o corte "(last /since)" só vale com o bloco anterior inserido na nota, como a spec diz. O roteiro estava errado e foi corrigido.
  3. **Já existiam antes desta branch** (investigação): o popover do `/today` que abre sem foco e cobre modais, a data de edição que muda ao só abrir uma nota que termina em bloco que não é parágrafo, e o título da nota do Calendar cortado na main. As três têm correção pequena, fora do escopo; a decisão foi levada ao Coordenador.
  4. **Para o Coordenador decidir:** a faixa de trackers começar recolhida na keep (com dois trackers, os cards do dia ficam abaixo da dobra da janela de 600 px), e o número com separador de milhar em "Year 2,025" no card do board e na lista de notas (formatação antiga das propriedades numéricas).
  5. Depois das correções, um reteste dirigido dos itens corrigidos, com modelo real.
- Next step: `codeAgent` das correções; depois o reteste.

### Orchestrator — decisão — 20261121005500
- Summary: as correções dos defeitos do teste foram entregues e conferidas (`npx tsc --noEmit` limpo, `npm test` com 28 arquivos e 813 testes, `npx vite build` sem erro). O reteste dirigido, com modelo real, passou em nove de dez pontos.
- Inputs:
  - `DOCS/reports/20-11-2026/testresults_20261121004220_reteste.md`
- Decision:
  1. **Passaram:** o perfil não vaza mais para o caderno (nenhuma das 18 buscas trouxe assunto do perfil), a busca repetida na conversa dá lista nova sem retratação (Radar e Papers), o caderno vazio recusa e busca pelo assunto quando a mensagem o traz, o menu de agentes a 300 px, o "+" na célula do Calendar e o texto de ajuda do Tavily.
  2. **Stop durante o planejamento:** falhou no app como estava carregado, por causa de uma versão antiga do módulo `ChatMessageBubble.tsx` na memória da página (carregada às 22:35), e passou com um contorno do testador. O Orquestrador conferiu que o servidor de dev serve a versão do disco. Fica para o reteste final, com carga nova da página.
  3. **Defeito novo, introduzido pela correção do perfil:** com o Follow fora do escopo estreito e um perfil só com Follow, o contexto não diz que há perfil, e o Radar propõe "Save radar profile" na primeira consulta de cada caderno. Um `codeAgent` corrige: o contexto passa a dizer que o perfil existe, e o app esconde o botão quando já há perfil.
  4. **Evidência para decisão pendente do Coordenador:** uma busca "Dante Divine Comedy analysis" num caderno de RAG, vinda dos livros em andamento da Library, que entram no mapa de foco de qualquer escopo. Sem mudança, a pedido dele.
  5. **O Coordenador aprovou a correção dos três defeitos antigos do editor** ("Sim, os três"): o popover do `/today` sem foco, a data de edição que muda ao abrir a nota e o título do Calendar cortado. Entram por um `codeAgent` logo depois do atual, seguindo `DOCS/reports/20-11-2026/explorerreport_20261120232133_achados-teste.md`.
- Next step: `codeAgent` da proposta de perfil (rodando); depois o dos três defeitos do editor; depois o reteste final.

### CodeAgent — correções do reteste (perfil no escopo estreito, busca repetida, Stop no planejamento, redirecionamento do Google, "+", menu de agentes, ajuda do Tavily) — 20261121001959
- Summary: (1) Perfil do Radar no escopo estreito garantido pelo app: em caderno, tag ou board, a linha Follow não entra no mapa de foco (nem no texto do gerador de consultas nem no do chat) nem nos `terms` de reserva; entram só Sources e Ignore, sob `Radar profile (sources and ignore only):`. O perfil não torna esse escopo "não vazio" (vazio com perfil: assunto na mensagem busca por ele, sem assunto recusa). Em "tudo" nada mudou. `search.profile` passa a ser `focus.profileUsed`. O texto de contexto e o prompt do escopo sem notas mandam escolher pelo assunto nomeado, sem exigir ligação com o mapa, e proíbem "Nothing new" havendo candidato sobre ele (Radar) e "nada serve" (Papers). (2) Busca repetida: função pura `repeatSearchNotes` (`hasEarlierSearch` + `asksOnlyRepeatOrWindow`) em `src/lib/radar.ts` põe no contexto das duas agentes a linha "This is a new search…" e, quando a mensagem só pede de novo ou só muda a janela, a linha do escopo inteiro; os prompts ganham a seção "Repeated searches" (sem retratar, sem pedir confirmação) e "ignore older versions" passa a valer só para o bloco; `messageSubject` ignora "again/try/refresh/novamente…". (3) Stop no planejamento: `cancel()` do `useChat.ts` deixa o balão parado (`interrupted: 'stopped'` e modelo, via `markStoppedBeforeReply`) quando o agente tem `webPipeline` e ainda monta o contexto; o balão mostra "Stopped before the response started" e o Retry onde o chat o tem; a data não avança. (4) `resolveResultUrl` em `src/lib/radar.ts`: `google.com/url?…` vira o destino (`url` ou `q`), fonte e hash da KB do destino; sem destino legível, o candidato sai. (5) "+" do Calendar de 7 para 5 px (caixa 23–28 px na célula de 28 px, medida em Edge headless com a mesma CSS). (6) Menu de agentes `width: min(320px, 100cqw)` com container no `.composer` das Anotações (medido em Edge headless: 300 px de painel, menu de 284 px, 8 px dentro da janela; 618 px continua 320 px). (7) Ajuda do Tavily cita o Add to KB. Specs `radar.md` e `trackers.md` atualizadas. Verificação: `npx tsc --noEmit` limpo; `npm test` com 28 arquivos e 813 testes; `npx vite build` sem erro.
- Files changed:
  - `src/lib/focusMap.ts`, `src/lib/focusMap.test.ts`
  - `src/lib/radarProfile.ts`, `src/lib/radarProfile.test.ts`
  - `src/lib/radar.ts`, `src/lib/radar.test.ts`
  - `src/lib/agents/radar.ts`, `src/lib/agents/radar.test.ts`
  - `src/lib/agents/papers.ts`, `src/lib/agents/papers.test.ts`
  - `src/lib/agentItems.ts`, `src/lib/agentItems.test.ts`
  - `src/hooks/useChat.ts`
  - `src/components/ChatPanel/ChatMessageBubble.tsx`
  - `src/components/NotesChat/NotesChatPanel.tsx`, `src/components/NotesChat/NotesChatPanel.module.css`
  - `src/components/ChatPanel/AgentPicker.module.css`
  - `src/components/CalendarView/CalendarView.tsx`, `src/components/CalendarView/CalendarView.module.css`
  - `src/components/Settings/SettingsModal.tsx`
  - `DOCS/specs/radar.md`, `DOCS/specs/trackers.md`
  - `DOCS/reports/20-11-2026/executionreport_20261120115512.md` (esta sessão)
- Files created: nenhum
- Files removed: nenhum
- Left behind: (a) O prompt do planejador de consultas no Rust (`lib.rs`, `radar_plan_queries`) ainda traz a regra do Follow em escopo estreito; ela deixou de ser a garantia (o app não manda o Follow), e só muda numa task com Rust. (b) Escopo sem notas e a mensagem "again" (sem assunto): como "again" deixou de ser assunto, o Radar recusa em vez de repetir o assunto da pergunta anterior; o usuário repete o assunto na mensagem. (c) Sem Retry no balão parado do chat das Anotações e da Assistant (só o Chat principal tem Retry). (d) Nada disso foi testado com modelo real: o comportamento dos prompts novos (retratação, assunto do escopo sem notas, "Nothing new") só o reteste confirma. (e) O "+" mede 23–28 px na célula e termina na base dela, no mesmo alcance dos pontos; não foi visto no app aberto.

### CodeAgent — perfil do Radar existe: contexto, prompt e botão "Save radar profile" (defeito do reteste) — 20261121004816
- Summary: (1) Em caderno, tag ou board, com uma nota de perfil da qual nenhuma linha entra (só o Follow, ou `Sources: any` e `Ignore: nothing yet`), o mapa de foco traz `Radar profile: saved. Its Follow line applies only to the "all notebooks" scope, so nothing from it is used here. Do not propose a profile.` (`RADAR_PROFILE_SAVED_NOTE`, em `src/lib/focusMap.ts`); sem nota de perfil continua `Radar profile: none.`; com Sources ou Ignore, o bloco `Radar profile (sources and ignore only)` de antes; em "tudo" nada mudou; no Papers (`profileUse: 'ignore'`) nada mudou. (2) Prompt do Radar: só propõe perfil quando a linha do bloco diz exatamente `Radar profile: none.`, na 1ª consulta do escopo e sem proposta anterior; qualquer outra linha de perfil (inclusive "saved") quer dizer que o perfil existe, e o prompt manda nunca propor nem dizer que não há. (3) Garantia pelo app: campo novo e opcional `search.hasProfileNote` no payload (`AgentSearchInfo`, `src/lib/agentItems.ts`), gravado pelo Radar como `profile !== null`, distinto do `search.profile` (que segue dizendo o que entrou e alimenta o "radar profile" da linha do app). A função pura `radarProfileDraftAllowed` (`agentItems.ts`) é chamada por `agentNoteDraft` (`src/lib/agentNotes.ts`), de onde o balão do Chat/Assistant e o das Anotações tiram o botão: com `hasProfileNote: true` não há rascunho de perfil, mesmo que o modelo proponha; mensagem sem o campo fica como antes. Os dois balões não precisaram de edição. (4) Papers: conferido, não propõe perfil (o contexto dele nunca traz `Radar profile: none.`, o prompt não tem regra de proposta e `agentNoteDraft` só gera o rascunho para o Radar); nenhum código do Papers mudou, só um teste que fixa isso. Specs: `radar.md` §3, §4 e §6. Verificação: `npx tsc --noEmit` limpo; `npm test` com 29 arquivos e 826 testes; `npx vite build` sem erro. O servidor de dev (1420) serve a versão do disco de `focusMap.ts`, `agentItems.ts`, `agentNotes.ts`, `agents/radar.ts`, `ChatMessageBubble.tsx` e `NotesChatPanel.tsx` (conferido pelo conteúdo do source map de cada módulo servido contra o arquivo; só leitura).
- Files changed:
  - `src/lib/focusMap.ts`, `src/lib/focusMap.test.ts`
  - `src/lib/agentItems.ts`, `src/lib/agentItems.test.ts`
  - `src/lib/agentNotes.ts`
  - `src/lib/agents/radar.ts`, `src/lib/agents/radar.test.ts`
  - `src/lib/agents/papers.test.ts`
  - `DOCS/specs/radar.md`
  - `DOCS/reports/20-11-2026/executionreport_20261120115512.md` (esta sessão)
- Files created:
  - `src/lib/agentNotes.test.ts`
- Files removed: nenhum
- Left behind: (a) A trava do botão depende do payload: a resposta sem payload (seguimento, que não busca, e busca toda falhada) não a tem; nesses casos o contexto não traz o bloco de proposta e o prompt só propõe com `Radar profile: none.`, então a proposta não deveria vir, mas a garantia do app não cobre. (b) A trava lê a nota de perfil que o app via na hora da consulta: um perfil salvo depois, na mesma conversa, não esconde o botão de uma resposta anterior. (c) O texto novo do prompt e do contexto só foi testado com resposta simulada; o reteste com modelo real é que confirma que o Radar deixa de propor perfil na 1ª consulta do caderno.

### CodeAgent — três defeitos antigos do editor (popover sem foco, data de edição ao abrir, título do Calendar cortado) — 20261121005434
- Summary: (A) `updateAutocomplete` (`Editor.tsx`) esconde o popover e sai quando `editor.isFocused` é falso; o clique na linha roda a função de novo pela transação de foco. (B) `Editor.tsx` guarda o último markdown em `lastMdRef` (inicia com `value`; atualizado a cada emissão e no efeito do texto vindo de fora) e o `onUpdate` só chama o `onChange` quando o markdown muda; a keep (`KeepPanel.tsx`) compara `md` com `noteRef.current.content` no `onUpdate`. O TrailingNode ficou ligado. Teste novo `openNoteUpdate.test.ts` fixa a base da guarda (abrir nota que termina em bloco que não é parágrafo emite `update` com o markdown igual ao gravado; a 1ª tecla e apagar tudo mudam o markdown) em oito formas de nota. (C) `.titleCompact` ganhou `box-sizing: content-box` em `Editor.module.css`. Nenhuma spec descrevia o comportamento antigo. Verificação: `npx tsc --noEmit` limpo; `npm test` com 30 arquivos e 851 testes; `npx vite build` sem erro; o servidor de dev (1420) serve a versão do disco dos três arquivos.
- Files changed:
  - `src/components/Editor/Editor.tsx`
  - `src/components/Editor/Editor.module.css`
  - `src/components/KeepPanel/KeepPanel.tsx`
  - `DOCS/reports/20-11-2026/executionreport_20261120115512.md` (esta sessão)
- Files created:
  - `src/components/Editor/openNoteUpdate.test.ts`
- Files removed: nenhum
- Left behind: (a) A guarda do B é uma comparação com ref dentro do componente (não há testing-library no projeto): o que o teste cobre é a base dela, não o `onUpdate`; os casos de edição foram conferidos por leitura. (b) Nota gravada em forma que o editor não reproduz igual (markdown fora do padrão do serializer) ainda grava uma vez ao abrir, se termina em bloco que não é parágrafo, porque o markdown do editor difere do `value`. (c) Enter no fim da nota (só um parágrafo vazio final) deixou de gravar, porque o markdown não muda. (d) Na keep o título é um texto da barra de título, não o `input` do `.titleCompact`, e o modo foco não tem regra própria de título no CSS do Editor; a mudança de CSS não afeta a keep e vale igual no modo foco. (e) Só o app aberto confirma: o popover sem clique na nota de hoje, o `updated_at` de uma nota que termina em lista, e o título "19/11/2026" inteiro na janela larga.

### Orchestrator — encerramento — 20261121012500
- Summary: fim da rodada de testes dirigida pelo Orquestrador. O roteiro foi executado no app de dev real por CDP (dois blocos), os defeitos achados foram corrigidos, um reteste e um reteste final confirmaram as correções com modelo real, e os três defeitos antigos do editor, aprovados pelo Coordenador, foram corrigidos e conferidos no app.
- Inputs:
  - `DOCS/reports/20-11-2026/testresults_20261120231039_trackers-log.md` (60 passaram, 0 falharam, 4 não feitos)
  - `DOCS/reports/20-11-2026/testresults_20261120235817_radar-papers.md` (59 passaram, 4 falharam, 8 não feitos)
  - `DOCS/reports/20-11-2026/testresults_20261121004220_reteste.md` (9 de 10 passaram; o décimo falhou por módulo antigo na memória da página)
  - `DOCS/reports/20-11-2026/testresults_20261121011023_reteste-final.md` (8 de 8 passaram, depois de uma carga nova das três janelas)
  - `DOCS/reports/20-11-2026/explorerreport_20261120232133_achados-teste.md`
- Decision:
  1. Verificação final do Orquestrador no estado entregue: `npx tsc --noEmit` limpo; `npm test` com 30 arquivos e 851 testes passando; `npx vite build` sem erro. Sem Rust desde o ajuste do Mincer. Nenhum commit: a branch aponta para 141f067.
  2. Corrigido e confirmado no app, com modelo real: o perfil do Radar não vaza para o escopo estreito; a busca repetida na conversa dá lista nova sem retratação (Radar e Papers); o caderno vazio recusa e busca pelo assunto da mensagem; o Stop no planejamento deixa o balão "Stopped before the response started"; o Radar não propõe perfil a quem já tem; o menu de agentes cabe a 300 px; o "+" fica dentro da célula do Calendar; o popover de comando só abre com foco; abrir uma nota não muda a data de edição; o título da nota do Calendar aparece inteiro.
  3. Não exercitado no reteste: a troca do link de redirecionamento do Google (não apareceu nenhum), e a regra "a mensagem que só muda a janela vale para o escopo inteiro" com uma pergunta de assunto antes na conversa.
  4. Continua com o Coordenador: importar um livro pela Library (item 1.4), o estado sem nenhum tracker (2.1 e 2.2), reordenar trackers (2.5) e arquivar todos para ver os agentes calados (4.6), que mexeriam nos dados dele; e os itens que tiram a chave do Tavily (5.23 e 5.29).
  5. Decisões pendentes do Coordenador, registradas no `DOCS/backlog.md`: a faixa de trackers recolhida por padrão na keep; os livros em andamento da Library no mapa de foco de qualquer escopo (apareceu uma busca "Dante Divine Comedy analysis" num caderno de RAG); o Papers e o Radar seguirem a nota aberta no chat das Anotações; e o número com separador de milhar ("Year 2,025").
  6. Sobras no banco de dev depois das limpezas: uma nota diária vazia em 22/11/2026, uma resposta de IA órfã do comando de teste, a data de edição de quatro notas do Coordenador (três mudadas pelo defeito antigo, antes da correção, e a nota de 21/11, onde o testador escreveu e apagou uma linha), 12 entradas no "Opened today" e a data de última abertura de um livro.
- Next step: concluído. Aguardando o Coordenador.

### Orchestrator — decisão — 20261121013500
- Summary: o Coordenador aprovou a faixa de trackers recolhida por padrão na keep ("sim, recolhida"). O ajuste é pequeno e o Orquestrador o fez direto, sem agente.
- Inputs:
  - resposta do Coordenador à pendência 5 do encerramento de 20261121012500
  - `src/components/Trackers/TrackersStrip.tsx`, `src/components/CalendarView/CalendarView.tsx`, `src/components/KeepPanel/KeepPanel.tsx`
- Decision:
  1. A `TrackersStrip` ganhou a prop `defaultCollapsed`: sem escolha gravada no localStorage, vale o padrão da janela; com escolha gravada (`1` ou `0`), vale a escolha. A keep passa `true` pelo `CalendarView` (`trackersDefaultCollapsed`); a main continua expandida.
  2. Verificação: `npx tsc --noEmit` limpo e `npm test` com 30 arquivos e 851 testes. No app real, por CDP, depois de recarregar a keep: sem escolha gravada, a faixa abre recolhida e mostra "Trackers · 1/3 · 0/4"; na main, onde havia a escolha `0`, continua expandida. Nenhuma tela de erro.
  3. `DOCS/specs/trackers.md` §4 atualizada. A entrada correspondente saiu do `DOCS/backlog.md`.
- Next step: concluído. Restam com o Coordenador as três outras pendências do backlog e os testes que mexem nos dados dele.

### Orchestrator — encerramento — 20261121014500
- Summary: o Coordenador encerrou o desenvolvimento desta task para usar o app por alguns dias e colher impressões, e pediu o merge na `feat/mincer`.
- Inputs:
  - pedido do Coordenador ("vou finalizar o desenvolvimento e usar por alguns dias para pegar as impressões. Faça merge na feat/mincer")
- Decision:
  1. Verificação antes do commit: `npx tsc --noEmit` limpo, `npm test` com 30 arquivos e 851 testes passando, `npx vite build` e `cargo check` sem erro. Nenhum padrão de chave de API nos arquivos alterados.
  2. Um commit na `feat/radar-trackers` com o código, os testes, as specs e os relatórios desta pasta, e merge fast-forward na `feat/mincer`, que continuava em 141f067. Sem push. Ficaram de fora o `tsconfig.node.tsbuildinfo` (artefato de build que já estava sem versionar) e o `src-tauri/Cargo.toml` (só diferença de fim de linha, sem mudança de conteúdo).
  3. As pendências que ficam para depois do período de uso estão no `DOCS/backlog.md`, nas entradas de 2026-11-20 e 2026-11-21.
- Next step: concluído.
