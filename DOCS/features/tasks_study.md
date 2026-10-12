# Estudo — Tasks v2: visão e controle "num olhar"

> Data: 2026-10-12 · Base: Tasks MVP (commit `109ca0c`) + 4 tasks reais em produção
> Pergunta do Coordenador: "quero saber, só batendo o olho, o que eu tenho que fazer, o que falta e o que tenho que entregar essa semana".

---

## 1. TL;DR

O MVP já tem a espinha certa (grupos Overdue/Today/This week, status `doing`, `rescheduleCount`, vínculo com notas e Calendar). O que falta não é "mais campos", é **leitura rápida**: hoje tudo é uma lista vertical única numa sidebar estreita, sem números, sem visão da semana em colunas e sem distinguir *quando vou fazer* de *quando tenho que entregar*.

As 5 mudanças de maior retorno, em ordem:

1. **Faixa de resumo** no topo: `2 overdue · 3 today · 1 this week · 4 done this week` + barra de progresso da semana.
2. **Week board**: visão em colunas Seg→Dom (+ Overdue e No date), arrastar task entre dias para reagendar.
3. **"Fazer em" ≠ "Entregar até"**: separar *do date* de *deadline* (padrão Things 3 / Logseq).
4. **Sinal de procrastinação visível**: badge `↻2` usando o `rescheduleCount` que já é gravado e nunca mostrado.
5. **Focus/Doing no topo**: o que está em `doing` sempre visível, separado do resto.

---

## 2. Como você está usando (produção)

| Task | Status | Prazo | Reagendada |
| --- | --- | --- | --- |
| autofrotaweb \| passar para o ng 21 | todo | 13/10 | 2× |
| autofrotaweb \| coletar prints | doing | 13/10 | 1× |
| ajustePremioAutoWeb \| add segurança | doing | 13/10 | 0 |
| ajustePremioAutoWeb \| migração completa | todo | 16/10 | 0 |

Leituras:

- **Uso é de trabalho/entregas**, não só pendências de estudo. Todas no projeto PORTO. Isso já contradiz o texto atual do PRD ("tasks leves nascidas das notas") — ver §6.
- **O prefixo `sistema |` é um sub-agrupamento improvisado.** Você precisa de um nível entre projeto e task (épico/frente/sistema). Hoje o único jeito é o título.
- **3 de 4 vencem no mesmo dia** e 2 já foram empurradas — exatamente o cenário em que uma visão por dia + contador de reagendamento ajuda.
- **`doing` está sendo usado de verdade** (2 tasks) — merece destaque próprio.
- Prazo = data de entrega. Não há como dizer "vou fazer na quarta, entrega na sexta".

---

## 3. Estado atual (MVP)

- Sidebar `TasksView`: input "New task…" + seletor de projeto, filtro por projeto, grupos Overdue / Today / This week / Later / No date / Done (50 últimas).
- Campos: título, status (todo/doing/done/dropped), projeto (= caderno), prazo, nota-corpo, nota de origem, `rescheduleCount`, `completedAt`.
- Calendar: task ocupa do dia de criação até o prazo (laranja); vencida vai para bloco Overdue (vermelho).

Lacunas para o "bater o olho":

| Lacuna | Efeito |
| --- | --- |
| Sem números/contadores | Precisa rolar e contar para saber o tamanho da semana |
| Semana é um grupo linear | Não se vê a distribuição por dia (sobrecarga na segunda, sexta vazia) |
| `doing` misturado nos grupos de data | O que está em andamento se perde |
| `rescheduleCount` invisível | O dado mais honesto do sistema não aparece |
| Prazo único | Não separa planejamento de compromisso |
| Sidebar estreita é a única visão | Não há uma "tela de controle" |
| Sem agrupamento abaixo do projeto | Usuário improvisa com `sistema \|` no título |

---

## 4. Estudo de mercado

| App | Ideia central | O que vale adaptar ao Monet |
| --- | --- | --- |
| **Things 3** | Separação *When* (quando vou fazer) × *Deadline* (quando tem que estar pronto); listas Today / Upcoming / Anytime / Someday; *Logbook*; anel de progresso por projeto; *headings* dentro do projeto | Do date × deadline; anel de progresso no caderno; **headings = solução para o seu `sistema \|`** |
| **Todoist** | Quick add com linguagem natural (`amanhã #Projeto p1`); Today/Upcoming; filtros salvos; meta diária/semanal | Parser de "New task…" (`sex`, `amanhã`, `#PORTO`, `@doing`); meta semanal simples |
| **TickTick** | Matriz de Eisenhower; visões Lista/Kanban/Timeline; resumo de período | Kanban por status; "resumo da semana" |
| **Sunsama** | Ritual de planejamento diário (puxar do backlog para hoje), *rollover* com contador ("adiada 3×"), planejamento e revisão semanal, *shutdown* do dia | Badge de rollover; **Weekly review** guiado; "Plan today" |
| **Microsoft To Do** | *My Day*: lista diária curada que zera todo dia, com sugestões (atrasadas, vencendo) | Botão "Add to Today" / estrela, independente do prazo |
| **Linear** | Ciclos semanais com progresso, *My issues*, teclado-first (Cmd+K, atalhos de 1 tecla), triagem | Barra de progresso da semana; atalhos `x` done, `d` data, `s` status |
| **Logseq / Obsidian Tasks** | Tasks vivem nas notas; **bloco de query** dentro da nota (`tasks due this week`); a nota diária mostra o que vence | **Bloco `/tasks` embutido na nota diária do Calendar** — encaixe perfeito com o Monet |
| **Akiflow / Motion** | Time-blocking (arrastar task para horário); Motion agenda sozinho | Só o arrastar-para-dia. Agendamento automático por IA **não** (contraria a tese) |
| **Notion / Capacities** | Mesma base exibida como tabela, board, calendário | Uma única fonte com múltiplas visões (lista ↔ semana ↔ kanban) |

Padrões que se repetem em quase todos os líderes:

1. **Hoje e Semana como telas de primeira classe**, não só filtros.
2. **Números à vista** (contagem por grupo, progresso).
3. **Captura em 1 linha** com data/projeto inline.
4. **Reagendar por arrastar.**
5. **Ritual** (planejar o dia / revisar a semana) — é o que faz a ferramenta ser usada.

---

## 5. Sugestões para o Monet (priorizadas)

### P1 — "Bater o olho" (maior retorno, baixo/médio esforço)

**S1. Faixa de resumo (summary strip)** — *esforço baixo*
Topo da TasksView: chips clicáveis `Overdue 2 · Today 3 · Week 4 · Doing 2 · Done this week 1`, e uma barra "semana: 1/5 concluídas". Clicar no chip filtra. Overdue em vermelho, mesma paleta do Calendar.

**S2. Week board (tela de controle)** — *esforço médio*
Nova visão expandida (ocupa a área do editor, como uma nota especial), alternável com a lista: colunas **Overdue | Seg … Dom | No date**. Cards com projeto, status e badges. **Arrastar entre colunas reagenda** (usar mousedown/mousemove manual, padrão já adotado no projeto). Cabeçalho de cada dia com a contagem — sobrecarga fica evidente. Responde direto "o que tenho que entregar essa semana".

**S3. Do date × Deadline** — *esforço médio (migração de schema)*
- `dueDate` atual vira **deadline** (entrega). Novo campo `scheduledDate` (quando vou fazer).
- Agrupamento Today/Week usa `scheduledDate ?? deadline`; deadline sempre aparece como etiqueta `⚑ sex 16`.
- Calendar: span = `scheduledDate → deadline`; o dia da entrega ganha marcador próprio.
- Tasks "atrasadas no planejamento" (scheduled passou, deadline não) ≠ "estouradas" (deadline passou): amarelo vs vermelho.

**S4. Badge de reagendamento** — *esforço trivial*
`↻2` no card quando `rescheduleCount ≥ 1`; ≥ 3 em destaque. Tooltip "postponed 2×". Dado já existe.

**S5. Doing fixo no topo** — *esforço baixo*
Grupo "In progress" acima de Overdue, independentemente da data. Opcional: limite suave (aviso se > 3 em doing).

**S6. Quick add com linguagem natural** — *esforço médio*
No "New task…": `migração completa sex #PORTO`, `coletar prints hoje @doing`, `!sex` para deadline. Mostrar preview dos tokens reconhecidos (chips) antes do Enter. Em inglês e português (`today/hoje`, `tomorrow/amanhã`, dias da semana).

### P2 — Controles e estrutura

**S7. Headings/frentes dentro do projeto** — resolve o `autofrotaweb |`. Um campo leve `group` (texto livre com autocomplete por projeto), exibido como subtítulo no agrupamento por projeto. Sem hierarquia profunda. Migração opcional: oferecer converter `xxx | título` em group `xxx`.

**S8. Agrupar por** (data | projeto | status) + **Kanban por status** (todo/doing/done) — mesma fonte, outra visão.

**S9. Progresso por projeto no NotebookList** — anel ou `3/7` ao lado do caderno que tem tasks abertas; vermelho se houver vencida.

**S10. Atalhos de teclado** na TasksView: `↑/↓` navegar, `x` concluir, `s` ciclar status, `t` mover para hoje, `d` editar data, `Delete` dropar. Multi-seleção com Shift para reagendar em lote ("empurrar tudo de hoje para amanhã").

**S11. Bloco `/tasks` em notas** (inspirado em Logseq/Obsidian Tasks) — bloco vivo que lista tasks por filtro (`this week`, `#PORTO`, `overdue`). A nota diária do Calendar ganha automaticamente um bloco "Due today" no topo (só leitura, não grava em `note.content`). É o diferencial Monet: tasks no fluxo das notas.

**S12. Weekly review** — tela guiada (ex.: sexta/domingo): ① o que foi concluído na semana; ② o que escorregou (com ↻); ③ arrastar pendências para a próxima semana; ④ campo de reflexão salvo como nota no Calendar. Pode chamar o `/week` existente **sob demanda** para um resumo — a IA convocada, nunca automática.

### P3 — Requer revisitar não-metas do PRD

| Sugestão | Por que pode valer | Conflito |
| --- | --- | --- |
| **Prioridade leve** (flag ⚑ "importante", 1 nível) | Ordenar o dia quando há 3 entregas no mesmo dia (seu caso de 13/10) | PRD: "sem prioridades" |
| **Recorrência** simples (diária/semanal) | Sustenta constância de estudo ("revisar fichamento toda segunda") — alinhado à visão | PRD: "sem recorrência" |
| **Progresso por checklist da nota-corpo** (`2/5`) | Dá "subtarefas" sem entidade nova: o checklist dentro da nota-corpo da task vira barra de progresso | Contorna "sem subtarefas" |
| **Lembrete de deadline** (reaproveitar ReminderChip / scheduler de 30s) | Avisar véspera da entrega | Nenhum forte |
| **Tool de tasks no chat** ("o que vence essa semana no PORTO?") | IA à mão, ancorada nos dados do usuário | Só se acionada |

### Não recomendado

- Agendamento automático por IA (Motion), sugestões proativas, gamificação/karma — contrariam "IA convocada, não oferecida" e a sobriedade do app.
- Time-blocking por hora — o Calendar do Monet é por dia; adicionar grade horária é outro produto.
- Colaboração/atribuição — fora de escopo (PRD).

---

## 6. Decisões necessárias do Coordenador

1. **PRD — escopo de Tasks.** O uso real (entregas de trabalho no PORTO) já excede "tasks leves nascidas das notas". Proposta de novo texto: *"Tasks é um gerenciador pessoal de entregas, integrado às notas e ao Calendar; continua sem colaboração e sem automação por IA."* Isso libera prioridade leve e recorrência (P3), mantendo subtarefas fora.
2. **Do date × deadline (S3)** — aceita a migração de schema? (É a mudança estrutural; o resto se apoia nela.)
3. **Onde mora o Week board (S2)** — área principal (recomendado) ou só sidebar?
4. **Frentes/headings (S7)** — campo `group` leve, ou tags livres?

## 7. Proposta de fases

| Fase | Conteúdo | Resultado |
| --- | --- | --- |
| **Fase 1 — Glance** | S1 resumo, S4 badge ↻, S5 Doing no topo, S9 progresso no caderno | Em 1 olhar: quanto falta e o que está escorregando. Sem migração. |
| **Fase 2 — Week** | S3 do date × deadline, S2 Week board com arrastar, S6 quick add | "O que entregar essa semana" e replanejamento rápido |
| **Fase 3 — Fluxo** | S7 frentes, S8 kanban/agrupar, S10 atalhos, S11 bloco `/tasks` na nota diária | Controle fino e tasks dentro das notas |
| **Fase 4 — Ritual** | S12 weekly review, P3 conforme decisão do PRD | Hábito de uso sustentado |
