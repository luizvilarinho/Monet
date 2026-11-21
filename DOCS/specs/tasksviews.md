# Visões Month e Deadlines de Tasks

> Spec de feature (2026-11-21, branch `feat/tasks-views`, Task Report `DOCS/reports/21-11-2026/taskreport_20261121102406.md`). Base: o estudo `DOCS/features/tasks_views_study.md` (decisões D1–D7, mockups em `DOCS/features/tasks_views_study/`), o `uxreport_20261121095219.md` e o plano `planreport_20261121103740.md`. Sem mudança de banco, de Rust, do tipo `Task` nem de `TaskViewConfig`.

## 1. Conceito

Duas visões novas no dropdown de Tasks, ao lado das atuais (que não mudam):

- **Month** (depois de Week): as tasks pelo **plano** (do date, senão deadline), numa janela de 5 semanas a partir da atual, com o deadline visível na grade. Arrastar uma task para um dia grava o **do date**.
- **Deadlines** (depois de Projects): as tasks pelo **deadline**, com projetos em colunas e semanas em faixas alinhadas. Arrastar uma task muda **só o deadline**, e só dentro da própria coluna.

As duas ocupam a área principal como o Week (`tasksBoardOpen`), com o cabeçalho de Tasks no topo (visão, projeto, resumo, busca, quick add). Filtro de projeto, busca, chips de resumo, quick add, atalhos (`x`, `s`, `t`, `d`, `p`, `z`, `Shift+z`, Delete), barra de lote e modal da task vêm das outras visões sem mudança. O horizonte comum é `TASK_WINDOW_WEEKS = 5`.

Uma visão salva com `base` `month` ou `deadlines` abre a visão certa; a visão ativa é lembrada entre sessões (`monet:tasks-main-view`). Um build antigo lendo esses ids cai em List.

## 2. Regra do "Postponed" (vale para o app todo)

`rescheduleCount` (chip "Postponed N×") soma 1, em `applyTaskPatch`, só quando um deadline **existente** vai para uma data **posterior** ou um do date existente é adiado (no máximo +1 por edição). Definir o primeiro valor, antecipar o deadline ou o do date e limpar o do date não contam; limpar o deadline zera. O `rescheduleCount` explícito no patch prevalece (é o que o Undo usa).

O Undo (`undoPatch`) restaura o total junto com qualquer data restaurada. Sem isso, desfazer uma antecipação do deadline (que não contou) pareceria um adiamento e somaria 1.

## 3. Month

### 3.1 Grade

- Linhas são semanas (seg–dom) e colunas são dias; 5 linhas, a primeira é a semana atual. A grade ocupa a altura disponível e **não rola**. Ao abrir a visão, a janela volta para a semana atual (estado local, como no Week; a virada do dia com o app aberto também volta).
- **Controles no slot do cabeçalho** (`controls` da `TasksHeader`, à direita da primeira linha; quebram para baixo em janela estreita): seta para trás, "This week", seta para a frente (uma semana por clique), o intervalo dos dias visíveis ("Nov 23 – Dec 25"; oculto o fim de semana, termina na sexta), "N later" e o botão do fim de semana. "N later" conta as tasks abertas com plano depois do último dia da janela (domingo da 5ª semana) e leva a janela para a semana da primeira; some com zero.
- **Dia**: a primeira linha mostra o dia da semana e o número ("Thu 26"), as outras só o número. O mês aparece na primeira célula e no primeiro dia visível de cada mês ("Mon, Nov 23" na primeira linha, "Dec 1" nas outras; o rótulo de mês novo em `--text-primary` 600). Hoje tem borda `--accent-task`; dia passado tem fundo `--bg-panel`.
- **Cabeçalho do dia** (18px): concluídas no dia (`Check` e contagem; o clique abre a lista), "N due" (deadlines de tasks abertas que caem no dia, estejam planejadas onde estiverem; vermelho em dia passado) e "N open" só quando o dia não cabe na célula ou tem 4 ou mais (em `--accent-task` 600 a partir de 4). As palavras "open", "due" e "done" somem numa célula de menos de 132px.
- **Onde cada task aparece** (`planCellOf`): My Day de hoje na célula de hoje; atrasada sem plano novo na bandeja (Overdue); sem data na bandeja (No date); as demais no dia do plano. Dia passado mostra só a contagem de concluídas, por `completedAt`. Descartadas não aparecem. Task com plano depois da janela só entra em "N later".

### 3.2 Linha compacta e altura da célula

- **`CompactTaskRow`** (22px, usada na grade, na bandeja e no popover): filete de 3px com a cor do projeto na borda esquerda (contorno quando o projeto não tem cor), quadrado de 7px com a cor do status (cantos quadrados), título em 13px com reticências e `title` com o texto inteiro. À direita, só quando existem: Sun (My Day de hoje), Flag (important) e o Target do deadline. O Target é neutro quando o deadline é naquele dia, `--accent-late` com "+Nd" quando o do date ficou N dias depois do deadline e `--accent-danger` quando o deadline estourou e a task foi replanejada (`deadlineMarkOn`). Cursor, seleção e abrir ao clicar (Ctrl e Shift selecionam) como nas outras visões; a linha não conclui a task nem mostra checklist.
- **A célula mede a própria altura** (`ResizeObserver` em `MonthDayCell`) e mostra as linhas que cabem (22px + 2px de espaço). Sobrando altura, os títulos que não cabem numa linha (medidos por canvas) ganham a segunda, de cima para baixo. O que não cabe vira "+N more" (sem espaço para nenhuma linha, "N tasks"). A regra é a função pura `fitDayRows`.
- **Popover do dia** ("+N more" e contagem de concluídas): as tasks abertas do dia (arrastáveis e clicáveis, título em até 2 linhas) e as concluídas. `z-index` 1010, 300px, `max-height` 320px. Fecha com Esc, com clique fora, quando um arrasto começa de dentro dele e quando uma task dele abre (o clique simples numa linha fecha o popover e abre o modal da task; Ctrl e Shift só selecionam, e o popover fica).
- **Hover preso**: a linha compacta avisa o pai (`onHoverChange(null)`) quando desmonta sob o mouse (concluir, apagar, reagendar por teclado, fechar o popover), porque o React não dispara `mouseleave` nesse caso; senão a barra do deadline ficaria no dia da task que sumiu. O realce do "N due" também acaba quando o dia fica sem deadline aberto.

### 3.3 Bandeja e fim de semana

- **Bandeja à esquerda (200px)**, com rolagem própria: Overdue (cabeçalho em `--accent-danger`, some vazia, não recebe drop) e No date (recebe drop; com arrasto mostra "Drop here to clear the do date"). Nas atrasadas a linha mostra a data que estourou: Target vermelho para o deadline, `CalendarBlank` amarelo para o do date. Título em até 2 linhas.
- Com as duas seções vazias vira um **trilho de 36px**, e a seta do cabeçalho recolhe à mão; o trilho mostra as contagens e continua recebendo drop em No date. O estado (`auto`, `open`, `closed`) fica em `localStorage['monet:tasks-month-tray']`. Reabrir pelo trilho com tasks na bandeja volta ao `auto` (esvaziar a bandeja a recolhe de novo); só o clique no trilho de uma bandeja vazia grava `open`, e ela fica aberta.
- **Fim de semana**: oculto ou visível pela mesma regra e pela **mesma chave de `localStorage` do Week** (`monet:tasks-week-hide-weekend`, hook `useWeekendToggle`). Oculto, vira um trilho de 36px à direita de cada semana com a contagem de abertas (rótulo "Sat–Sun" só na primeira linha; hoje no fim de semana oculto o trilho ganha a borda de hoje e o rótulo "Today"). Visível, sábado e domingo são colunas mais estreitas (0,62 da largura de um dia útil).

### 3.4 Arrasto

- Por `useCardDrag` + `reschedule` (Undo), sem mudar o hook. Soltar num dia de hoje em diante grava o do date; dia passado e a seção Overdue não aceitam e esmaecem; soltar no próprio dia não muda nada.
- Deadline já estourado e destino de hoje em diante: a pergunta "Move deadline too / Keep deadline", do `reschedule`.
- Soltar em **No date** limpa o do date; a task com deadline continua na grade, no dia do deadline (a barra de Undo diz "Still on its deadline day (Nov 27)." quando o deadline é de hoje em diante).
- Segurar a task ~400ms sobre o trilho do fim de semana abre sábado e domingo durante o arrasto, como no Week (`useWeekendPeek`).
- **Deadline visível**: com a task no ar, o dia do deadline dela (de hoje em diante) ganha uma barra `--accent-late` de 2px e o rótulo "Deadline", e os dias depois dele ficam com hachura amarela. Junto ao cursor (`DragCursorLabel`), um rótulo com a data do deadline ("After deadline" sobre um dia hachurado; vermelho quando o deadline já estourou). Fora do arrasto, passar o mouse numa task marca a barra no dia do deadline dela, e passar no "N due" realça as tasks que vencem naquele dia.
- **Soltar depois de um deadline que ainda não passou**: aceita. A linha fica com o Target `--accent-late`, a barra de Undo diz "It's after the deadline (Nov 27)." e ganha a ação **"Move deadline too"**, que leva o deadline para a mesma data. O mesmo Undo desfaz as duas mudanças, e o par conta como um adiamento só (`deadlineAlongPatch`).

### 3.5 Painel de IA, teclado e barras

- Entrar no Month recolhe o painel de IA e sair o reabre se estava aberto, como o board de notas; trocar do Month direto para um board de notas não reabre o painel no meio (`wideAreaOpen` no efeito de `App.tsx`). Reabrir o painel com o Month aberto é permitido.
- O teclado segue a ordem: Overdue da bandeja, dias visíveis semana a semana (todas as abertas do dia, inclusive as escondidas atrás de "+N more") e No date. Fim de semana oculto e bandeja recolhida ficam fora. As setas só andam em uma dimensão (cima e baixo seguem essa ordem); `z` e `Shift+z` adiam a task um dia e uma semana.
- A barra de Undo e a de lote ficam **sobrepostas à grade** (rodapé do board), para a grade não encolher por 6s e as células não refazerem as linhas. Consequência: com 2 ou mais tasks selecionadas, a barra de lote cobre a 5ª semana. Com uma task no ar o ponteiro atravessa a barra (`pointer-events: none`), para o drop na faixa de baixo da 5ª semana valer; fora do arrasto ela é clicável.

## 4. Deadlines

### 4.1 Grade

- **Colunas** são os projetos com task aberta, na ordem dos cadernos (cadernos desconhecidos entram como "unnamed" no fim), com largura mínima de 200px: a grade rola na horizontal. **Linhas** são faixas pelo deadline (`deadlineBand`):
  - **Missed**: deadline antes de hoje, mesmo com do date novo (por isso o número difere do chip Overdue, que é pelo plano); some quando vazia;
  - **This week** e **Next week**, e as três semanas seguintes (as mesmas 5 semanas do Month), cada uma pela segunda-feira da semana do deadline;
  - **Later**: depois do domingo da 5ª semana;
  - **No deadline**: sem deadline, com ou sem do date.
- Um único grid rolável (`DeadlinesBoard`): cada faixa tem a altura da célula mais alta, o que alinha as semanas entre as colunas. A grade rola na vertical.
- **Faixa fina de 28px** quando não há task aberta nem "N done" em nenhum projeto (vale para qualquer faixa, inclusive Later e No deadline); continua recebendo drop.
- **Calha à esquerda (104px, fixa)**: nome da faixa, intervalo ("Nov 30 – Dec 6") e a contagem de abertas somada dos projetos. This week em `--accent-task`, Missed em `--accent-danger`. As semanas 3 a 5 usam o intervalo como rótulo.
- **Cabeçalho da coluna (fixo no topo)**: ponto com a cor do projeto (contorno sem cor), nome, abertas, progresso "concluídas/total" (sem as descartadas, sobre o conjunto filtrado por busca e chip) e uma barra de 2px. A calha e o cabeçalho têm fundo opaco e o canto fica fixo nos dois eixos.
- **Com o filtro de um projeto**, as colunas passam a ser as TODOS dele com task aberta (ordem alfabética, `byTodosId`), mais "No TODOS" no fim; o ícone `Checks` no lugar do ponto e o card sem o chip da TODOS. O arrasto, o progresso e o "N done" funcionam igual, por coluna.
- **Sem nenhum projeto com task aberta** sobram a calha e as faixas finas.

### 4.2 Task na célula

- A **variante de lista do `TaskCard`** com `deadlinesCell` (prop opcional, padrão `false`; sem ela o card é o de sempre). Em cima: caixa de concluir, título em até 3 linhas e o dia do deadline com Target ("Fri 27" dentro da janela de 5 semanas, "Apr 30" fora dela; `--accent-danger` em Missed). Embaixo, na linha de contexto (que quebra em coluna estreita): o status quando não é To do, o do date com `CalendarBlank` ("Thu 26"; `--accent-late` se já passou ou se ficou depois do deadline; "No do date" quando não há), a TODOS (abre a nota), os adiamentos e o Flag. Sem linha de projeto, sem metadados, sem rodapé (o ícone de recorrência não aparece nesta variante).
- Ordem na célula: pelo deadline, depois a ordem das outras visões (`byBoardOrder`). Clique abre a task; cursor, seleção, atalhos e barra de lote como nas outras visões; concluir pela caixa tira a task da célula.
- **"N done"**: no rodapé da célula das faixas de semana, a contagem das concluídas daquele projeto cujo deadline cai naquela semana (o `title` lista os títulos). Missed, Later e No deadline não têm "N done".

### 4.3 Arrasto

- Muda **só o deadline**, e só entre faixas da **mesma coluna** (não move de projeto nem de TODOS). Só as faixas de semana e No deadline da coluna da task, fora a faixa de origem, aceitam (têm `data-drop-key` `coluna::faixa`); as outras colunas, Missed e Later esmaecem (0,4) e não aceitam. Soltar na própria faixa não muda nada.
- A faixa sob o cursor ganha o contorno tracejado e **acende na calha**, e um rótulo junto ao cursor mostra a data que a task vai receber ("Fri, Dec 11", ou "No deadline").
- **Data ao soltar numa semana** (`deadlineDropDate`): o mesmo dia da semana do deadline atual; sem deadline anterior, o último dia de trabalho da semana (pelos dias de trabalho de Settings › Agenda, `loadWorkCapacity`); nunca antes de hoje (se o dia já passou, o último dia de trabalho da semana; se esse também passou, hoje). Soltar em No deadline limpa o deadline.
- Tudo com Undo (`actions.update`: "Task deadline moved to Dec 11." / "Task deadline cleared."). O do date **não muda**; se ficar depois do deadline novo, o chip do do date fica `--accent-late` e a barra diz "The do date (Dec 3) is now after it.". O "Postponed" segue a regra da §2: adiar soma, antecipar não, limpar zera.
- **Rolagem durante o arrasto**: a roda do mouse rola a grade com a task no ar (nada na visão a intercepta). O `useCardDrag` só recalcula o alvo no `mousemove`, então, depois de rolar com o mouse parado, a grade repete o último movimento (`mousemove` sintético no `onScroll`) para o alvo e o rótulo acompanharem. **Não há rolagem automática na borda.**
- O painel de IA não recolhe no Deadlines. A barra de Undo e a de lote ficam no fluxo, abaixo da grade, como no Week.
- O teclado segue coluna a coluna, faixa a faixa. Mudar o deadline pelo teclado não existe.

## 5. Fora de escopo / depois

- Arrastar várias tasks selecionadas; andar a janela segurando a task sobre a seta; setas em duas dimensões no teclado; criar task clicando no dia; próximas ocorrências de recorrentes; rolagem automática na borda no arrasto; "Set deadline…" na barra de lote; mover de projeto por arrasto no Deadlines; concluir pela linha compacta do Month.
- Week no slot do cabeçalho, sinal "After deadline" nos cards atuais, opções na visão salva (semana em exibição, bandeja e fim de semana não entram na visão salva), refatorar o `CalendarView`.
- Fora pelo PRD: grade por hora, agendamento automático por IA, dependências entre tasks e Gantt.

## 6. Arquivos

- `src/components/TasksView/views.ts`: registro de `month` e `deadlines`.
- Month: `MonthBoard.tsx` (+ `.module.css`, também usado por `MonthDayCell` e `MonthDayPopover`), `MonthDayCell.tsx`, `MonthDayPopover.tsx`, `CompactTaskRow.tsx` (+ `.module.css`).
- Deadlines: `DeadlinesBoard.tsx` (+ `.module.css`) e a variante `deadlinesCell` de `TaskCard.tsx`.
- Comuns: `DragCursorLabel.tsx` (rótulo junto ao cursor, portal no `body`, `pointer-events: none`), `useWeekendToggle.ts` (fim de semana do Week e do Month), o slot `controls` de `TasksHeader.tsx`, `UndoOptions` (`note` e `extra`) em `useTaskActions.ts` e `TaskBatchBar.tsx`. `useCardDrag.ts` e `useTaskKeyboard.ts` não mudaram.
- `src/lib/tasks.ts` (testes em `tasks.test.ts`): `TASK_WINDOW_WEEKS`, `PLAN_OVERDUE`/`PLAN_NODATE`, `planCellOf`, `byBoardOrder`, `openDeadlinesByDay`, `weekWindow`, `BAND_*`, `deadlineBand`, `deadlineDropDate`, `formatDeadlineDay`, `deadlineMarkOn`, `fitDayRows`, `deadlineAlongPatch`, a regra do "Postponed" em `applyTaskPatch` e o total de adiamentos em `undoPatch`.
- `src/App.tsx`: os ramos `month` e `deadlines` antes do ramo final do Week e o efeito do painel de IA com `wideAreaOpen`.
