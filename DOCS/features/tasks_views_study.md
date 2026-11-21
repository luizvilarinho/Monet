# Estudo: visões Month e Deadlines em Tasks

> Data: 2026-11-21 · Só leitura: nenhum código, schema ou dado alterado · Base: branch `feat/mincer`, commit `55c0279`
> Pedido do Coordenador: "Em tasks eu sinto falta de uma visualização que pegue tanto Projeto quanto data de entrega: nenhuma visualização tem os 2 ao mesmo tempo. E eu quero uma visualização do mês para eu poder arrastar as tarefas e distribuí-las ao longo do mês (hoje só tem semana)."
> Task Report: `DOCS/reports/21-11-2026/taskreport_20261121085551.md`. Insumos: `explorerreport_20261121090550_usage.md` (uso real), `explorerreport_20261121090813_code.md` (código) e `uxreport_20261121095219.md` (proposta detalhada, medidas e alternativas), na mesma pasta.
> Mockups interativos: `DOCS/features/tasks_views_study/index.html`, `month.html` e `deadlines.html`. Abrir num navegador (Edge ou Chrome): o painel de preview do Claude mostra a página sem os scripts, e o arrasto não funciona lá.
> Dados de uso: cópia do `monet.db` de produção, lida em 2026-11-21 (dado mais recente das 08:48 do mesmo dia). O original não foi aberto.
> Privacidade: o repositório é público. Aqui só há contagens, com os projetos chamados de A, B e C. Os mockups usam projetos e títulos inventados.

---

## 1. TL;DR

- **As duas visões são viáveis sem mexer no banco, no Rust nem no modelo de task.** Esforço médio em cada uma, com uma base comum pequena antes.
- **Month:** grade em que cada linha é uma semana e cada coluna é um dia, com **5 semanas a partir da semana atual**. À esquerda, uma bandeja com Overdue e No date. Arrastar uma task para um dia muda o **do date**, com as regras do Week. Cada task é uma linha compacta de 22px.
- **Deadlines:** os **projetos em colunas** e as **semanas do deadline em faixas alinhadas** (Missed, This week, Next week, mais três semanas, Later, No deadline). Arrastar para outra faixa da mesma coluna muda o **deadline**. Não muda o projeto.
- **Nas duas, uma linha da tela é uma semana**, com o mesmo horizonte de 5 semanas. No Month as colunas são os dias e a data é o do date; no Deadlines as colunas são os projetos e a data é o deadline.
- **O "mês" virou uma janela de semanas, e não o mês de calendário.** Pelas regras do Week, dia passado não aceita drop e só mostra concluídas. Em 21/11, novembro ocuparia 6 linhas e 3 estariam inteiras no passado. É a primeira decisão a confirmar (D1).
- **O Projeto × entrega ficou com a orientação contrária à hipótese do Task Report.** Com projetos em linhas, cada coluna de semana teria cerca de 125px na janela padrão. Com 3 projetos em colunas, cada uma tem 321px e o título cabe inteiro em quase todos os casos.
- **O uso real é leve:** 8 tasks abertas hoje, mediana de 9 e pico de 17, em 3 projetos. Nenhum dia passou de 4 tasks pelo plano. As duas telas foram desenhadas para ficar boas quase vazias, e o ganho do Month é o horizonte, e não a densidade.
- **Reagendar é rotina:** 37% das tasks já mudaram de data, com 45 mudanças em 40 dias. O arrasto é a operação central das duas visões.
- **Ficam 7 decisões para o Coordenador** (seção 9). Duas mexem em regra que vale para o app todo: o "Postponed" ao mudar o deadline (D4) e um slot de controles no cabeçalho de Tasks (D2).

---

## 2. Diagnóstico: o eixo de cada visão hoje

Conferido no código (`src/components/TasksView/`).

| Visão | Organiza por | Projeto aparece como | Data aparece como | Arrasto muda |
| --- | --- | --- | --- | --- |
| List | Um eixo por vez: data, projeto, status ou TODOS (Group by) | Seção (no Group by project) ou chip | Seção (no Group by date) ou chip | Nada |
| Week | Dia do plano (do date, senão deadline), 7 dias | Chip no card | Coluna; o deadline do dia só como "N due" no cabeçalho | Do date |
| Kanban | Status | Chip | Chip | Status |
| Projects | Projeto, com subseções por TODOS | Coluna | Só dentro do card | Projeto |
| TODOS | Nota TODOS | Chip, e o nome no cabeçalho da coluna | Chip | TODOS |
| My Day | Hoje × sugeridas | Chip | Chip | My Day |
| Review | Revisão da semana | Chip | Chip | Sem arrasto (reagenda o do date por botão) |

As duas lacunas do pedido aparecem na tabela:

1. **Projeto e data de entrega juntos.** Nenhuma visão tem os dois como eixo. Onde o projeto é coluna (Projects), a data fica dentro do card. Onde a data é coluna (Week), o projeto é um chip, e a data é a do plano, e não a da entrega.
2. **Mais de uma semana com arrasto.** Só o Week arrasta entre dias, e ele mostra 7. O Calendar mostra o mês, mas numa coluna de 220px, com a task como um traço no dia e sem arrasto.

---

## 3. Uso real em produção

Detalhe em `explorerreport_20261121090550_usage.md`. A amostra é de um usuário e 40 dias (a primeira task é de 2026-10-13).

| Medida | Valor | O que muda no desenho |
| --- | --- | --- |
| Tasks | 54 no total: 8 abertas, 44 concluídas, 2 descartadas | Telas boas com pouca coisa |
| Backlog aberto por dia | mediana 9, p90 11, pico 17 | Bandeja estreita, sem agrupamento |
| Projetos com task | 3 de 11 cadernos; nunca mais de 3 ao mesmo tempo | Projeto pode ser coluna larga |
| Com deadline / com do date / com os dois | 85% / 54% / 44% | Deadline é o campo dominante |
| Folga entre do date e deadline | mediana 1 dia; não coincidem em 21 de 24 | No Month o deadline precisa aparecer |
| Tasks no mesmo dia, pelo plano | máximo 4; até 3 em 83% dos dias com task | 3 linhas por dia cobrem o uso |
| Dias do mês sem nenhuma task | de 20 a 24 | A grade fica quase vazia |
| Fim de semana | 1 task planejada num domingo e 1 concluída num sábado | Oculto por padrão |
| Dia da semana do deadline | sexta em 17 de 46 | Regra da data ao soltar numa semana |
| Reagendadas | 20 de 54 (37%), 45 mudanças | Arrasto é a operação central |
| Sem deadline, entre as abertas | 4 de 8 | "No deadline" é faixa de primeira classe |
| Título | mediana 27 caracteres, p75 de 33 a 38, p90 56 | Largura por linha é o que decide o formato |
| TODOS | 6 das 8 abertas têm TODOS; a propriedade Entrega está em 40% das notas e não coincide com os deadlines | TODOS como chip; a Entrega fica fora |
| Horizonte hoje | todas as abertas com data caem na semana que vem, mais um marco em abril de 2027 | Pode ser efeito de só existir o Week |

Recorrência, important e task atrasada: nenhuma entre as abertas hoje. Metade das abertas está em status diferente de To do, então a linha compacta precisa mostrar o status.

---

## 4. Proposta A: Month

Mockup: `tasks_views_study/month.html`. Detalhe, medidas e respostas item a item ao R3: `uxreport_20261121095219.md`, seção 3.

### 4.1 A tela

- **Grade.** Colunas são os dias (seg–dom) e linhas são as semanas. A primeira linha é a semana atual e são sempre 5 linhas, o que garante pelo menos 4 semanas inteiras à frente em qualquer dia. A grade não rola.
- **Navegação.** À direita da primeira linha do cabeçalho de Tasks: setas (uma semana por clique), "This week", o intervalo ("Nov 23 – Dec 25"), "N later" e o botão do fim de semana. "N later" conta o que está planejado depois da última semana visível e pula para lá.
- **Dia.** A primeira linha da grade mostra o dia da semana ("Thu 26"); as outras, só o número. O mês aparece no primeiro dia visível de cada mês. No cabeçalho do dia: as concluídas (ícone Check e contagem), "N due" (deadlines que caem naquele dia) e "N open" só quando o dia não cabe na célula ou tem 4 ou mais.
- **Task.** Linha de 22px, peça nova: filete de 3px com a cor do projeto, quadrado de 7px com a cor do status, título em 13px. À direita, só quando há o que dizer: Sun (My Day), Flag (important) e Target (deadline). O Target aparece neutro quando o deadline é naquele dia, amarelo com "+Nd" quando o do date ficou depois do deadline, e vermelho quando o deadline estourou e a task foi replanejada.
- **Título em duas linhas.** Quando sobra altura na célula, o título que não cabe ganha a segunda linha. Com 1 task no dia cabem cerca de 44 caracteres na janela padrão.
- **Bandeja, à esquerda (200px).** Overdue (some quando vazia) e No date. Recolhe para um trilho de 36px quando as duas estão vazias ou pela seta.
- **Fim de semana.** Oculto quando os dias de trabalho do Settings não incluem sábado e domingo, com a mesma preferência do Week. Vira um trilho de 36px com a contagem por semana.
- **Dia cheio.** O que não cabe vira "+N more", que abre a lista do dia.
- **Concluídas.** Só a contagem, no dia da conclusão. Dia passado mostra só isso.

### 4.2 O arrasto

- Soltar num dia grava o **do date**, com Undo, pela mesma ação do Week (`reschedule`). Dia passado e a seção Overdue não aceitam.
- **Com a task no ar, o deadline dela aparece na grade:** o dia do deadline ganha uma barra amarela e o rótulo "Deadline", e os dias depois dele ficam hachurados. Dá para ver até onde a task pode ir sem estourar o prazo. Fora do arrasto, passar o mouse numa task marca o dia do deadline dela.
- Deadline já estourado e destino de hoje em diante: a pergunta que o Week já faz ("Move deadline too / Keep deadline").
- Destino depois de um deadline que ainda não passou: aceita, a linha fica com o Target amarelo e a barra de Undo oferece "Move deadline too". Hoje o app aceita esse caso sem avisar, e no Month ele vai ser comum.
- Soltar em No date limpa o do date. A task com deadline continua na grade, no dia do deadline.
- Segurar a task sobre o trilho do fim de semana abre sábado e domingo durante o arrasto, como no Week.
- Task do My Day de hoje que vai para outro dia sai do My Day.

### 4.3 Medidas

Tiradas do mockup, com a bandeja aberta e o fim de semana oculto.

| Janela | Dia (largura × altura) | Título em 1 linha | Linhas por dia |
| --- | --- | --- | --- |
| 1280×800 (padrão) | 164 × 102px | ~22 caracteres | 3 |
| 1920×1080 | 284 × 158px | ~43 caracteres | 5 |
| 1280×800 com o painel da direita aberto | 104 × 102px | ~12 caracteres | 3 |
| 960×600 (mínima) | 100 × 62px | ~11 caracteres | 1 |

- As 3 linhas por dia na janela padrão dependem de a navegação ficar na primeira linha do cabeçalho. Numa barra própria, como a do Week, seriam 2 (D2).
- Com o painel da direita aberto a visão fica apertada. A proposta é recolher o painel ao entrar no Month, como o board de notas já faz (D7).

### 4.4 Casos de borda

| Caso | Comportamento |
| --- | --- |
| Só do date | No dia do do date |
| Só deadline | No dia do deadline, com o Target. Arrastar cria o do date; o deadline fica e vira "N due" no dia dele |
| As duas datas | No dia do do date; o deadline conta no "N due" do dia dele |
| Sem data | Bandeja, em No date |
| Atrasada sem plano novo | Bandeja, em Overdue, com a data que estourou |
| Do date depois do deadline | Target amarelo com "+Nd" |
| My Day de hoje | Na célula de hoje, com o Sun, mesmo com outra data |
| Recorrente | Só a ocorrência atual; as próximas ficam para depois |
| Além da janela | "N later"; para soltar lá, andar a janela pelas setas antes |
| Filtro de projeto, busca, chips | Como nas outras visões |
| Visão salva | Funciona. A semana em exibição, a bandeja e o fim de semana não entram na visão salva, como no Week |

### 4.5 Alternativas descartadas

- **Mês de calendário:** linhas mortas no passado (3 de 6 em 21/11). É a D1.
- **4 semanas:** 4 linhas por dia, mas perto do fim da semana sobram 3 semanas à frente.
- **6 semanas ou rolagem contínua:** 2 linhas por dia, e rolar pediria rolagem automática no arrasto.
- **Card do Week ou linha da List na célula:** 80px e 58px por task; caberia uma por dia.
- **Bandeja em faixa acima da grade:** tira uma linha de task de todos os dias.
- **Task em todos os dias do período, como no Calendar:** multiplica as linhas e tira o lugar único de onde se arrasta.
- **Dia do deadline escrito em cada linha:** tira cerca de 4 caracteres do título de todas as tasks.

---

## 5. Proposta B: Deadlines

Mockup: `tasks_views_study/deadlines.html`. Detalhe, medidas e respostas item a item ao R2: `uxreport_20261121095219.md`, seção 4.

### 5.1 A tela

- **Colunas:** os projetos que têm task aberta, na ordem dos cadernos. O cabeçalho da coluna tem a cor do projeto, o nome, as abertas e o progresso (concluídas / total), e fica fixo quando a grade rola.
- **Faixas (linhas), pelo deadline da task:**
  - **Missed:** deadline estourado, mesmo que a task já tenha um do date novo. Some quando vazia.
  - **This week, Next week e as três semanas seguintes:** as mesmas 5 semanas do Month. Semana sem nada em nenhum projeto vira uma faixa fina de 28px, que continua recebendo drop.
  - **Later:** deadline depois da quinta semana.
  - **No deadline:** tasks sem deadline, com ou sem do date.
- **Calha à esquerda (104px):** nome da faixa, intervalo ("Nov 30 – Dec 6") e a contagem somada dos projetos.
- **Task:** a variante de lista do card atual, em duas faixas (58px com o título em uma linha). Em cima, a caixa de concluir, o título em até 3 linhas e o dia do deadline ("Fri 27"). Embaixo, o status quando não é To do, o do date (ou "No do date"), a TODOS, os adiamentos e o Flag.
- **"N done"** no rodapé da célula: concluídas com deadline naquela semana. Mostra o que o projeto já entregou da semana.
- **Com o filtro de um projeto,** as colunas passam a ser as TODOS desse projeto, mais "No TODOS".

### 5.2 O arrasto

- Muda **só o deadline**, e só entre faixas da mesma coluna. As outras colunas esmaecem, e Missed e Later também.
- O card no ar mostra a data que vai receber, e a faixa de destino acende na calha.
- **Data ao soltar numa semana:** o mesmo dia da semana do deadline atual. Sem deadline anterior, o último dia de trabalho da semana (sexta, pelo Settings). Nunca antes de hoje.
- Soltar em No deadline limpa o deadline.
- O do date não muda. Se ficar depois do deadline novo, o chip dele fica amarelo e a barra de Undo avisa (D5).
- **Mover de projeto por arrasto fica fora.** Trocar de projeto regrava a nota da task, em mais de uma gravação e sem retorno de erro para a visão, e aconteceria sem querer num arrasto em diagonal. Continua no Projects board.

### 5.3 Medidas

Tiradas do mockup, com 3 projetos.

| Janela | Coluna | Título em 1 linha | Cabe sem rolar? |
| --- | --- | --- | --- |
| 1280×800 (padrão) | 321px | ~39 caracteres | O retrato de hoje (8 abertas) cabe: 461 de 513px. Com 12, rola 108px. Com 18, rola 338px |
| 1920×1080 | 534px | ~77 caracteres | Com 12 cabe; com 18 rola 18px |
| 1280×800 com o painel da direita aberto | 221px | ~21 caracteres | Rola |

- Com 5 projetos ou mais na janela padrão, a coluna chega ao mínimo de 200px e a grade rola na horizontal, com a calha fixa.
- Como a grade rola na vertical quando há mais tasks, arrastar para uma faixa fora da tela precisa de rolagem durante o arrasto (D6).

### 5.4 Em que ela difere do que já existe

| Visão | Diferença |
| --- | --- |
| Projects | Mesmas colunas. Lá as subseções são as TODOS e a data fica no card; aqui são semanas alinhadas entre as colunas, e o arrasto muda a data, e não o projeto |
| List › Group by project | Uma coluna só, sem eixo de tempo |
| Week | Lá a data é a do plano e o projeto é um chip; aqui a data é a da entrega e o projeto é o eixo |
| Month | Outra data (do date) e outro eixo (dias). Um dia do Month não tem largura para se dividir em 3 projetos, por isso são duas visões |

### 5.5 Casos de borda

| Caso | Comportamento |
| --- | --- |
| Só do date, ou sem data | Faixa No deadline, com o do date no chip ou "No do date" |
| Deadline estourado já replanejado | Continua em Missed (o prazo segue vencido), com o do date novo no chip |
| Arrastar para Missed ou Later | Não aceita. Deadline distante se marca no campo da task |
| Arrastar para outra coluna | Não aceita |
| Projeto sem task aberta | Não vira coluna |
| Projeto com muitas tasks | A coluna cresce para baixo e a grade rola |
| Concluídas e descartadas | Concluídas em "N done", na semana do deadline. Descartadas fora |
| Recorrente | Só a ocorrência atual |

### 5.6 Alternativas descartadas

- **Projetos em linhas e semanas em colunas (hipótese do Task Report):** cerca de 125px por coluna, e o tempo cresce para o lado.
- **Card de board na célula:** de 80 a 100px por task; o retrato de hoje pediria cerca de 690px numa área de 513.
- **Linha compacta do Month:** cabe muito, mas esconde do date, status por extenso e TODOS, que são o que esta visão cruza.
- **Dias no eixo do tempo:** 25 linhas quase todas vazias; a semana é a unidade real.
- **Modo "linhas por projeto" dentro do Month, ou raias por projeto no Week:** cruzam o projeto com a data do plano, e não com a entrega.
- **Gantt, com barra do do date ao deadline:** fora pelo PRD, e a folga real é de 1 dia.
- **A propriedade Entrega da nota TODOS como marco:** preenchida em 40% das notas e sem coincidir com os deadlines.

---

## 6. Mercado

De conhecimento de produto, sem pesquisa nova. A pesquisa de `mercado_2026-10/` não cobre calendário mensal de tasks nem cruzamento de projeto com prazo. Vale conferir antes de citar fora daqui.

| Produto | O que faz | O que entra na proposta |
| --- | --- | --- |
| Google Calendar | Visão personalizada de 4 semanas, que começa na semana atual | Janela de semanas em vez do mês de calendário |
| TickTick | Calendário mensal e de várias semanas com arrasto; painel "Arrange Tasks" com as tasks sem data, de onde se arrasta para os dias | Bandeja de onde se distribui |
| Notion | Calendário de database com a lista "No date" para arrastar; board com subgrupos (colunas por uma propriedade, faixas por outra) | Bandeja; matriz de dois eixos |
| Linear e Jira | Board com raias (swimlanes) por projeto ou épico | Projeto como eixo de um board. O Jira é a ferramenta oficial do trabalho do Coordenador |
| Trello | Visão Calendar com arrasto entre dias; Timeline com raias | Arrasto no mês |
| Todoist | Upcoming com os dias em sequência e arrasto; layout de calendário mensal | Reagendar por arrasto como gesto padrão |

Dois padrões se repetem: quem tem calendário com arrasto tem um lugar para as tasks sem data, e quem cruza dois eixos usa board com raias, e não Gantt.

---

## 7. Viabilidade e esforço

Detalhe com `arquivo:linha` em `explorerreport_20261121090813_code.md`.

### 7.1 O que se reaproveita sem mudança

`TasksHeader` (filtro de projeto, busca, chips, quick add), `useTaskKeyboard` (cursor, seleção, atalhos; `z` e `Shift+z` já movem um dia e uma semana), `useTaskActions` (`reschedule` com "Move deadline too" e Undo), `TaskBatchBar`, `useCardDrag` (a chave de drop é livre), o modal da task, as visões salvas, a persistência da visão ativa e as regras de data de `lib/tasks.ts`.

### 7.2 O que é novo

| Peça | Para qual visão | Observação |
| --- | --- | --- |
| Linha compacta de task (22px) | Month | Nenhum card atual serve: Week ~80px, List ~58px, `TaskLine` de 30 a 48px |
| Componente `MonthBoard` | Month | No molde do `WeekBoard`. A casca `BoardView` não serve: é fixa em colunas de cards |
| Medir a célula (`ResizeObserver`) | Month | Quantas linhas cabem e se o título ganha a segunda. É a parte menos trivial |
| Componente da grade do Deadlines | Deadlines | Cabeçalho e calha fixos |
| `TaskCard` de lista com os chips na linha de contexto | Deadlines | Deadline como dia da semana, texto "No do date" |
| 6 a 8 funções puras em `lib/tasks.ts`, com testes | As duas | Semanas da janela, célula de uma task, faixa do deadline, data ao soltar numa semana. `columnOf` e `byBoardOrder` já existem, locais no `WeekBoard`: promover para a lib |
| Slot de controles na `TasksHeader` | Month | Prop opcional; o Week pode usar depois |
| Ação extra na barra de Undo | Month | "Move deadline too" depois de soltar além do deadline |
| Texto que muda no fantasma do arrasto | As duas | Data nova no Deadlines, "After deadline" no Month. Gancho opcional no `useCardDrag` ou rótulo desenhado pela visão |
| Ação de mudar o deadline | Deadlines | Hoje só existe no campo da task aberta. Sai com `actions.update`, e o Undo já cobre o campo |

### 7.3 Fases

| Fase | Conteúdo | Esforço |
| --- | --- | --- |
| 1. Base comum | Funções puras com testes, linha compacta, slot na `TasksHeader`. Nada visível muda | P |
| 2. Month | Grade, bandeja, arrasto de uma task, destaque do deadline, "+N more", "N later", fim de semana com trilho, "Move deadline too" na barra de Undo | M |
| 3. Deadlines | Grade, linha de lista, arrasto de deadline na coluna, regra do dia da semana, "N done", colunas por TODOS no filtro, regra do "Postponed" (D4) | M |
| 4. Extras, por demanda | Arrastar várias selecionadas (P), andar a janela segurando a task sobre a seta (P), "Set deadline…" na barra de lote (P), criar task clicando no dia (P–M), setas em duas dimensões no teclado (M), rolagem automática no arrasto (M) | — |

As fases 2 e 3 são independentes depois da 1. O Deadlines só leitura, sem arrasto, é a entrega mais barata (P–M) se a prioridade for ver antes de planejar.

### 7.4 Riscos

1. **Espaço na tela.** A janela padrão dá 3 linhas por dia no Month e uma coluna de 321px no Deadlines. Com o painel da direita aberto, o Month cai para cerca de 12 caracteres por linha.
2. **Peças comuns.** `useCardDrag` serve 6 lugares e `useTaskKeyboard` serve 6 visões. Tudo o que entrar neles precisa ser opcional. A regra do "Postponed" fica em `applyTaskPatch` e vale para todas as visões.
3. **Regras parecidas com resultados diferentes.** O Calendar mostra a task em todos os dias do período e o Month num dia só. O chip Overdue do cabeçalho conta pelo plano e a faixa Missed conta pelo deadline: por isso os nomes são diferentes.
4. **Ramo esquecido na montagem.** Em `App.tsx:4830` o `WeekBoard` é o resto da cadeia: um id de visão novo sem ramo próprio abre o Week, sem erro.
5. **Cor.** Status e projeto usam a mesma paleta. Na linha compacta eles têm formas diferentes (quadrado e filete) por isso.

---

## 8. O que as duas visões não fazem

Fora do escopo pelo PRD e pelo estudo de 2026-10-12: grade por hora, agendamento automático por IA, dependências entre tasks e Gantt. Nenhuma das duas cria campo novo na task: não há estimativa de esforço, então o "dia carregado" do Month é só a contagem.

---

## 9. Decisões necessárias do Coordenador

| # | Decisão | Recomendação | Alternativa |
| --- | --- | --- | --- |
| D1 | O que é o "mês" no Month | Janela de 5 semanas a partir da semana atual | Mês de calendário, com as semanas passadas na tela |
| D2 | Onde fica a navegação do Month | Num slot novo na primeira linha do cabeçalho de Tasks (3 linhas por dia na janela padrão) | Barra própria, como no Week (2 linhas por dia) |
| D3 | Soltar no Month depois de um deadline que ainda não passou | Aceitar, sinalizar na linha e oferecer "Move deadline too" na barra de Undo | Só sinalizar, ou perguntar em diálogo |
| D4 | "Postponed" ao mudar o deadline | Contar só quando o deadline vai para depois. Muda `applyTaskPatch` e vale para todas as visões | Manter a regra atual: qualquer mudança conta, inclusive antecipar |
| D5 | Do date ao mover o deadline no Deadlines | Fica onde está, com aviso se passar do deadline novo | Acompanha o deadline, mantendo a folga em dias |
| D6 | Rolagem durante o arrasto no Deadlines | Lançar contando com a roda do mouse e conferir no app; escrever a rolagem automática só se a roda não funcionar no arrasto | Escrever a rolagem automática no `useCardDrag` já na primeira versão (recomendação do `uxAgent`) |
| D7 | Painel da direita aberto no Month | Recolher o painel ao entrar na visão, como o board de notas | Não fazer nada, ou recolher a bandeja |

Na D6 a recomendação do Orquestrador difere da do `uxAgent`. A rolagem automática mexe numa peça usada em 6 lugares, e o retrato de hoje cabe na tela sem rolar. A roda do mouse durante o arrasto funciona no mockup, que usa a mesma técnica do app, mas isso não foi conferido no app.

**Padrões adotados na proposta, que valem se o Coordenador não disser o contrário:**

- Nomes: "Month" e "Deadlines". No menu, Month depois de Week e Deadlines depois de Projects.
- Faixa de deadline estourado chamada "Missed", e não "Overdue", para não mostrar dois números diferentes com o mesmo nome na mesma tela.
- Dia carregado no Month: "N open" em laranja a partir de 4, que é o pico real pelo plano.
- Task na célula do Deadlines: linha de lista em duas faixas, e não o card de board.
- Data ao soltar numa semana no Deadlines: o mesmo dia da semana; sem deadline anterior, o último dia de trabalho.
- Hachura amarela nos dias depois do deadline, só durante o arrasto. É um padrão visual novo no app, e fica carregado quando o deadline é nesta semana.
- Arrasto de uma task por vez na primeira versão.

---

## 10. Oportunidades relacionadas

Sugestões do `uxAgent` que apareceram no caminho. Estão fora do escopo deste estudo e ficam para a triagem do Coordenador.

| Sugestão | Problema que resolve | Esforço |
| --- | --- | --- |
| Week usar o mesmo slot do cabeçalho | A barra de navegação do Week custa 38px de altura | P |
| Sinal "After deadline" nos cards das visões atuais | Hoje o aviso só existe nos campos da task aberta | P |
| "Set deadline…" na barra de lote | O deadline só muda pelo campo, uma task por vez | P |
| Concluir pela linha compacta | No Month, concluir pede o atalho ou abrir a task | P |
| Semana e opções na visão salva | A visão salva não lembra a janela nem o fim de semana | M |

---

## 11. Como foi conferido, premissas e limites

- **Mockups.** Renderizados no Edge headless em 1280×800 e 1920×1080, com as imagens revisadas pelo `uxAgent` e de novo pelo Orquestrador. Os arrastos foram repetidos nos arquivos finais por CDP, com eventos reais de mouse, sem erro de script: soltar depois do deadline com "Move deadline too" e Undo, recusa em dia passado, bandeja para um dia, No date nos dois sentidos, fim de semana aberto no arrasto; no Deadlines, arrasto na coluna, recusa em outra coluna, sem deadline para uma semana e Missed para This week.
- **O que os mockups não têm:** teclado; clicar numa task só marca o cursor; os chips de resumo contam, mas não filtram; no Deadlines com o filtro de um projeto, o "N done" não é calculado.
- **Medidas.** Lidas do DOM do mockup, e não do app. O app não foi executado em nenhuma etapa. As alturas e larguras dos componentes atuais foram calculadas pelo CSS.
- **Esforço.** P, M e G são relativos, estimados pela leitura do código.
- **Amostra.** Um usuário, 40 dias, 54 tasks. O horizonte curto de hoje (uma semana) pode ser efeito de só existir a visão de 7 dias. Depois de um mês de uso do Month, vale olhar quantas tasks passam a ter do date além da semana e quantos arrastos saem da bandeja.
- **Mercado.** De conhecimento de produto, sem pesquisa nova.
