# Explorer Report — uso real de Tasks em produção (R1)

Task: estudo das visões Projeto × data de entrega e do mês com arrasto (`taskreport_20261121085551.md`).
Esta parte cobre só o segundo item do R1: números agregados de produção que dimensionam a densidade das duas visões. A viabilidade no código está no outro explorer report.

## Descrição do problema
As duas visões novas dependem de volume: quantas tasks cabem numa célula do mês, quantos projetos viram linha na matriz, quantas semanas à frente têm task. O Task Report pede esses números do uso real, somente leitura e sem títulos nem nomes (o repositório é público). Os projetos aparecem como A, B e C, em ordem de volume.

**Nível de dificuldade:** não se aplica a esta parte (levantamento de dados, sem código).

## Resumo
- O volume é **pequeno**: 54 tasks em 40 dias de uso (a primeira é de 2026-10-13), **8 abertas hoje**, 44 concluídas e 2 descartadas, em **3 projetos** (de 11 cadernos).
- O backlog aberto, reconstruído dia a dia, ficou em mediana 9, p90 11 e pico 17 tasks. Nunca houve mais de 3 projetos com task aberta.
- **Deadline é o campo dominante**: 46 das 54 tasks têm deadline (85%), 29 têm do date (54%) e 24 têm os dois. Quando há os dois, o do date fica antes do deadline, com 1 dia de folga na mediana.
- Pico num mesmo dia: 4 tasks por plan date, 5 por deadline e 8 por conclusão (um dia da semana de adoção; fora dela o máximo é 4).
- O horizonte de planejamento é curto: hoje todas as abertas com data caem na semana que vem, mais um marco a 5 meses.
- Reagendar é comum: 20 das 54 tasks (37%) já mudaram de data, 45 mudanças contadas em 40 dias.
- Hoje não há nenhuma task atrasada, nenhuma recorrente e nenhuma marcada como important.

## Fonte e frescor do dado
- Arquivo físico lido: `C:\Users\User\AppData\Roaming\com.monet.app\monet.db` (com `-wal` e `-shm`), o banco real de produção. A pasta de virtualização do MSIX (`%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\com.monet.app\`) **não existe**, então a sessão enxergou o banco verdadeiro.
- Data de modificação: `monet.db` em 2026-11-21 08:48:26 e `monet.db-wal` em 2026-11-21 08:48:37.
- Dado mais recente das tasks: `updated_at` em 2026-11-21 08:48:26, `completed_at` em 2026-11-21 08:33:08 e `created_at` em 2026-11-18 15:04:03. **O dado é de hoje**, sem defasagem.
- Leitura feita numa cópia dos três arquivos no scratchpad da sessão, aberta em modo somente leitura (`PRAGMA quick_check` = ok). Nada foi gravado em `%APPDATA%` e o app não foi iniciado.
- Hoje é 2026-11-21, sábado. A semana atual vai de 16/11 a 22/11.

Definições usadas (as mesmas de `src/lib/tasks.ts`): aberta = status diferente de `done` e `dropped`; plan date = `scheduled_date`, senão `due_date`; overdue = data anterior a hoje; semana de segunda a domingo. Percentis pelo método do posto mais próximo.

**Limite da amostra:** são 8 abertas, 54 no total, um usuário e 40 dias. Os percentis das abertas são indicativos; onde ajuda, a tabela traz também o histórico das 54.

## 1. Totais e projetos

| | Tasks |
| --- | --- |
| Total | 54 |
| Abertas | 8 |
| Concluídas | 44 |
| Descartadas | 2 |

| Projeto | Abertas | Concluídas | Descartadas | Total |
| --- | --- | --- | --- | --- |
| A | 3 | 23 | 2 | 28 |
| B | 3 | 1 | 0 | 4 |
| C | 2 | 20 | 0 | 22 |

- Existem 11 cadernos. Só 3 têm task, e os 3 têm task aberta.
- Backlog aberto no fim de cada dia (13/10 a 21/11): mínimo 2, mediana 9, p90 11, máximo 17.
- Projetos com task aberta no mesmo dia: mediana 3, máximo 3. Maior projeto num dia: mediana 4, máximo 10 abertas.

| Semana (segunda) | Pico de abertas | Maior projeto |
| --- | --- | --- |
| 12/10 | 7 | 5 |
| 19/10 | 17 | 10 |
| 26/10 | 10 | 8 |
| 02/11 | 10 | 4 |
| 09/11 | 14 | 9 |
| 16/11 | 9 | 4 |

## 2. Datas entre as abertas

| Abertas (8) | Tasks |
| --- | --- |
| Só deadline | 3 |
| Só do date | 2 |
| As duas | 1 |
| Nenhuma data | 2 |

- Com deadline: 4 de 8. Com do date: 3 de 8.
- Do date depois do deadline: 0.
- Deadline estourado: 0 (logo, 0 replanejadas). Só o do date vencido: 0. A coluna Overdue está vazia hoje.
- No My Day de hoje: 2, as duas com plan date em outro dia, no futuro (aparecem em hoje só pelo My Day). Nenhum `planned_day` velho entre as abertas.
- Das 4 sem deadline, 3 estão em status custom e 1 em To do.

Histórico das 54 tasks, para não depender do retrato de hoje:

| Todas (54) | Tasks |
| --- | --- |
| Com deadline | 46 (85%) |
| Com do date | 29 (54%) |
| Com as duas | 24 (44%) |
| Sem nenhuma data | 3 |

- Nas 24 com as duas datas: do date antes do deadline em 21, no mesmo dia em 2 e depois do deadline em 1. Folga entre do date e deadline: mediana 1 dia, p90 3 dias, máximo 6.
- Das 42 concluídas com deadline: 17 antes do prazo, 13 no dia e **12 depois (29%)**.
- Das 44 concluídas, em relação ao plan date: 10 antes, 15 no dia e 19 depois (43%).
- My Day: `planned_day` preenchido em 20 tasks, em 8 dias diferentes, de 1 a 5 tasks por dia.

## 3. Abertas por semana

| Faixa | Período | Por deadline | Por plan date |
| --- | --- | --- | --- |
| Overdue | antes de 21/11 | 0 | 0 |
| Semana atual | 21/11 a 22/11 | 0 | 0 |
| +1 | 23/11 a 29/11 | 3 | 5 |
| +2 | 30/11 a 06/12 | 0 | 0 |
| +3 | 07/12 a 13/12 | 0 | 0 |
| +4 | 14/12 a 20/12 | 0 | 0 |
| +5 | 21/12 a 27/12 | 0 | 0 |
| +6 | 28/12 a 03/01 | 0 | 0 |
| +7 | 04/01 a 10/01 | 0 | 0 |
| Depois | após 10/01 | 1 | 1 |
| Sem data | | 4 | 2 |

A task de "Depois" tem data em 2027-04-30. Como hoje é sábado, a "semana atual" só tem 2 dias pela frente.

Histórico por semana de deadline (todas as tasks não descartadas com deadline, 46):

| Semana do deadline | 19/10 | 26/10 | 02/11 | 09/11 | 16/11 | 23/11 | 26/04/2027 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tasks | 14 | 6 | 15 | 3 | 4 | 3 | 1 |

## 4. Abertas por dia, mês atual e próximo

| | Tasks | Dias ≥1 | Dias ≥3 | Dias ≥5 | Dias ≥8 | Máximo no dia | Mediana (dias com task) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Novembro, por plan date | 5 | 2 | 1 | 0 | 0 | 3 | 2,5 |
| Novembro, por deadline | 3 | 2 | 0 | 0 | 0 | 2 | 1,5 |
| Dezembro, por plan date | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Dezembro, por deadline | 0 | 0 | 0 | 0 | 0 | 0 | — |

- As 5 tasks de novembro estão em dois dias úteis da semana que vem (uma segunda com 3 e uma sexta com 2). Nenhuma em fim de semana, nenhuma nos dias já passados do mês.
- Célula de hoje, pela regra do Week (plan date de hoje ou My Day de hoje): 2 tasks.
- Dezembro está vazio: nada planejado além da semana que vem, fora o marco de abril.

## 5. Histórico por mês (para dimensionar a grade)

Agosto e setembro não têm nenhuma task: o uso de Tasks começa em 2026-10-13. Outubro tem 19 dias de uso e novembro, 21 dias corridos.

Duas medidas por dia: **(i)** concluídas no dia (`completed_at`) mais abertas planejadas para o dia, que é como o Week mostra; **(ii)** plan date de todas as tasks, abertas e concluídas, que é como o mês ficaria no momento de planejar.

| Mês | Medida | Tasks | Dias com task | Máximo | p90 | Mediana | Dias úteis com task | Fim de semana com task |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Agosto | (i) e (ii) | 0 | 0 de 31 | 0 | — | — | 0 | 0 |
| Setembro | (i) e (ii) | 0 | 0 de 30 | 0 | — | — | 0 | 0 |
| Outubro | (i) | 24 | 7 de 31 | 8 | 8 | 2 | 7 | 0 |
| Outubro | (ii) | 24 | 9 de 31 | 4 | 4 | 2 | 8 | 1 |
| Novembro | (i) | 25 | 10 de 30 | 4 | 4 | 3 | 9 | 1 |
| Novembro | (ii) | 25 | 13 de 30 | 4 | 3 | 2 | 13 | 0 |

p90 e mediana são entre os dias com task. Contando todos os dias do mês, a mediana é 0 e o p90 fica entre 2 e 3.

Quantos dias tiveram cada carga:

| Tasks no dia | 1 | 2 | 3 | 4 | 6 | 8 |
| --- | --- | --- | --- | --- | --- | --- |
| Outubro (i) | 1 | 3 | 1 | 0 | 1 | 1 |
| Novembro (i) | 3 | 1 | 4 | 2 | 0 | 0 |
| Outubro (ii) | 1 | 4 | 1 | 3 | 0 | 0 |
| Novembro (ii) | 5 | 5 | 2 | 1 | 0 | 0 |

- Os dois dias de pico por conclusão (8 e 6) são quarta 21/10 e quinta 22/10, na semana de adoção (18 criadas e 15 concluídas). Fora dela, o máximo é 4.
- Por plan date, somando os dois meses: 23 dias com task, com 1 task em 7 dias, 2 em 9, 3 em 3 e 4 em 4. Até 3 tasks cobre 19 dos 23 dias (83%); até 4 cobre todos.
- Por deadline (46 tasks, 24 dias com deadline): máximo 5 no dia, mediana 1, p90 4.
- Fim de semana: 1 task planejada num domingo e 1 concluída num sábado em 40 dias.
- Dia da semana do deadline: sexta 17, quarta 9, segunda 8, terça 6, quinta 5, domingo 1. Conclusões: quarta 13, quinta 12, terça 11, segunda 5, sexta 2, sábado 1.
- Projetos diferentes num mesmo dia de plan date: no máximo 2.

## 6. Densidade da matriz Projeto × semana de deadline (abertas)

| Projeto | Overdue | Semana atual | +1 | +2 | +3 | +4 | +5 | Later | Sem deadline | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 3 |
| B | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 2 | 3 |
| C | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |

- Linhas (projetos): 3. Colunas: 9. Células: 27, das quais **5 não vazias** (19%).
- Tasks por célula não vazia: máximo 2, mediana 2. Só nas colunas com data: 3 células, máximo 2, mediana 1.
- Maior linha: 3 tasks.
- Só 3 das 9 colunas têm alguma task: +1, Later e Sem deadline. A coluna mais cheia é Sem deadline (4 das 8).

Carga histórica por célula, contando também as concluídas (limite superior: as tasks nasceram e foram fechadas ao longo da semana, não estiveram todas abertas juntas):

| Projeto | 19/10 | 26/10 | 02/11 | 09/11 | 16/11 | 23/11 | 26/04/2027 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 9 | 2 | 7 | 3 | 1 | 1 | 0 |
| B | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| C | 5 | 4 | 7 | 0 | 3 | 2 | 0 |

13 células não vazias, máximo 9, mediana 3, p90 7.

## 7. TODOS

- Abertas com `parent_note_id`: 6 de 8. No histórico, 44 das 52 não descartadas (85%).
- Notas TODOS com task aberta: 3, uma por projeto (A 1, B 1, C 1), cada uma com 2 tasks abertas. Abertas sem TODOS: 1 no projeto A e 1 no B.
- Notas do tipo TODOS: 20, das quais 17 arquivadas. As 3 ativas são as 3 com task aberta.
- No histórico, 18 TODOS tiveram task: mediana 2 tasks por TODOS, p90 4, máximo 4. Por projeto: A 10, B 1, C 7.
- Propriedade de data "Entrega": existe no tipo TODOS (é a única de data entre as 4 propriedades do tipo) e está preenchida em **8 das 20 notas (40%)**. Entre as 3 com task aberta, só 1 tem Entrega, e o valor já passou. As 8 datas preenchidas são todas anteriores a hoje.
- Deadline da task × Entrega da nota, nas 6 abertas com TODOS: 4 estão em TODOS sem Entrega, 1 não tem deadline e a nota tem Entrega, 1 tem deadline depois da Entrega. Em nenhuma as duas datas coincidem.
- Deadlines diferentes dentro de uma mesma TODOS (histórico, 18 notas): 1 deadline em 6 notas, 2 em 9, 3 em 1 e 4 em 2. Em 12 das 18, as tasks da TODOS se espalham por mais de um deadline.

## 8. Tamanho dos títulos

| Caracteres | Abertas (8) | Todas (54) |
| --- | --- | --- |
| Mediana | 27 | 26,5 |
| p75 | 33 | 38 |
| p90 | 56 | 56 |
| Máximo | 56 | 108 |

| Título cabe em | Abertas | Todas |
| --- | --- | --- |
| 20 caracteres | 3 de 8 | 21 de 54 (39%) |
| 24 caracteres | 4 de 8 | 24 de 54 (44%) |
| 30 caracteres | 4 de 8 | 32 de 54 (59%) |
| 40 caracteres | 6 de 8 | 41 de 54 (76%) |
| 60 caracteres | 8 de 8 | 49 de 54 (91%) |

## 9. Reagendamento

O contador `reschedule_count` sobe quando um deadline existente muda para outro ou quando um do date existente é adiado. Definir a primeira data, antecipar o do date e limpar a data não contam, e limpar o deadline zera o contador (`applyTaskPatch` em `src/lib/tasks.ts`). O número é, portanto, um piso das mudanças de data.

| | Tasks | Com reagendamento | Média (todas) | Média (reagendadas) | Máximo | Soma |
| --- | --- | --- | --- | --- | --- | --- |
| Todas | 54 | 20 (37%) | 0,83 | 2,25 | 10 | 45 |
| Abertas | 8 | 4 (50%) | 1,5 | 3 | 5 | 12 |
| Concluídas | 44 | 16 (36%) | 0,75 | 2,06 | 10 | 33 |

Distribuição nas 54: 34 nunca reagendadas, 11 uma vez, 4 duas, 2 três, 2 cinco e 1 dez vezes. São 45 mudanças em 40 dias, perto de 8 por semana.

## 10. Recorrentes e status custom

- Recorrentes abertas: 0. Nenhuma das 54 tasks usou recorrência.
- Status custom: 3 definidos, 2 em uso, com 3 e 1 tasks. O terceiro tem limite de WIP 3 e nenhuma task.
- Status das 8 abertas: 3 em To do, 1 em Doing e **4 em status custom**.
- Important: nenhuma aberta.
- Visões salvas: 1, com base List.

## 11. Ritmo por semana

| Semana (segunda) | Criadas | Concluídas | Descartadas |
| --- | --- | --- | --- |
| 28/09 | 0 | 0 | 0 |
| 05/10 | 0 | 0 | 0 |
| 12/10 | 7 | 0 | 0 |
| 19/10 | 18 | 15 | 0 |
| 26/10 | 8 | 9 | 0 |
| 02/11 | 7 | 7 | 0 |
| 09/11 | 8 | 4 | 2 |
| 16/11 (atual, parcial) | 6 | 9 | 0 |

- Passada a semana de adoção, o ritmo é de 6 a 8 criadas e de 4 a 9 concluídas por semana.
- Tempo entre criar e concluir: mediana 3 dias, p90 10 dias. Idade das abertas: mediana 12 dias, máximo 23.
- A semana das descartadas usa o `updated_at` (não há data de descarte no schema), então é aproximada.

## O que o schema não responde
- **Histórico do plano.** O banco guarda só a data final de cada task. A medida (ii) usa o último plan date das concluídas, e não o que estava planejado em cada dia do passado.
- **Arrasto de fato usado.** Não há registro de qual gesto mudou a data (arrasto no Week, snooze, campo). `reschedule_count` mede as mudanças, e não o meio.
- **Data de descarte.** Não existe; usei `updated_at`.

## Leituras para o desenho

1. **Três linhas de task por célula do mês bastam na maioria dos dias.** Por plan date, 83% dos dias com task tiveram até 3 e nenhum passou de 4. Com 4 linhas visíveis, o histórico por plan date cabe inteiro; com 3, o "+N more" apareceria em 4 dos 23 dias. Se as concluídas ficarem no dia da conclusão, entram mais dois dias fora da curva (6 e 8, na semana de adoção).
2. **A grade do mês vai estar quase vazia.** De 20 a 24 dias do mês não têm task, dezembro inteiro está vazio e o horizonte hoje é de uma semana. O mês não vai resolver aperto de espaço; o ganho dele é enxergar e distribuir para além dos 7 dias do Week. Vale o estudo dizer isso com clareza, e considerar que o horizonte curto pode ser efeito de só existir a visão de 7 dias.
3. **Fim de semana oculto como padrão é defensável.** Em 40 dias houve 1 task planejada em domingo e 1 concluída em sábado. Com 5 colunas, a célula fica mais larga e cabe mais título.
4. **Título pede largura ou segunda linha.** A mediana é 27 caracteres e o p75 fica entre 33 e 38. Uma linha de cerca de 20 caracteres mostra inteiro só 39% dos títulos; com 30, mostra 59%. Como há poucas tasks por dia, quebrar o título em duas linhas custa pouco. A largura real da célula precisa ser conferida no mockup.
5. **A matriz tem 3 linhas, e não uma dúzia.** Só 3 dos 11 cadernos têm task, e nunca houve mais de 3 ao mesmo tempo. Com tão poucas linhas, a célula pode levar o card normal em vez de um chip compacto, e cabe a TODOS como subnível (3 ativas hoje, uma por projeto). Projeto sem task não deve virar linha.
6. **Seis colunas de semana é mais do que o uso pede.** Hoje só +1 tem task; +2 a +7 estão vazias. No histórico, cada semana de deadline somou de 3 a 15 tasks, e a célula chegou a 9 no pico, com mediana 3. Menos semanas, ou semanas vazias recolhidas, com Later logo depois, descreve melhor o dado.
7. **"Sem deadline" é coluna de primeira classe.** É a mais cheia hoje (4 das 8 abertas), embora 85% das tasks acabem tendo deadline. Três das quatro sem deadline estão em status custom, e duas delas têm do date.
8. **Deadline e do date andam juntos.** O deadline é o campo mais preenchido (85% contra 54%) e o do date costuma ficar 1 dia antes. Na prática, a matriz por deadline e o mês por plan date mostram quase a mesma semana; a diferença aparece no dia. No mês, o marcador do deadline no dia importa, porque em 21 de 24 casos ele não coincide com o do date.
9. **O arrasto entre dias é operação central.** 37% das tasks já mudaram de data, com 45 mudanças em 40 dias, e 29% das concluídas com deadline fecharam depois do prazo. Como o contador não conta a primeira data, o uso real do arrasto para distribuir tasks é maior que isso.
10. **A bandeja de Overdue e No date é pequena.** Hoje são 0 atrasadas e 2 sem data, com backlog mediano de 9. Ela pode ser uma faixa estreita, que não precisa de rolagem nem de agrupamento.
11. **A Entrega da nota TODOS não serve de marco.** Está em 40% das notas, nunca coincide com o deadline das tasks abertas e todas as datas preenchidas já passaram. Além disso, as tasks de uma mesma TODOS se espalham por mais de um deadline em 12 de 18 casos. O eixo da matriz deve ser o deadline da task, como o Coordenador confirmou.
12. **O que a linha compacta precisa mostrar.** O status, porque metade das abertas está em status custom. O My Day de hoje conta (2 tasks hoje aparecem em hoje só por ele). Recorrência e important não têm uso hoje e podem ficar fora da primeira versão.

**Ressalva geral:** a amostra é de um usuário, 40 dias e 54 tasks. Os números mostram um uso leve e regular (de 6 a 8 tasks novas por semana). As duas visões devem funcionar bem com pouca coisa na tela, e não ser otimizadas para dias cheios que ainda não existem.
