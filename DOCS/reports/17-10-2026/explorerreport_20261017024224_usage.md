# Explorer Report — Estudo de uso de Tasks em produção (req. 6)

## Problema
Entender como Tasks está sendo usado de verdade no banco de produção e propor melhorias priorizadas, conectando com as features em andamento (cards, metadados personalizados). Somente estudo, nenhum código alterado.

## Método
- Banco de prod confirmado em `%APPDATA%\com.monet.app\monet.db` (dev fica em `com.monet.app.dev`, não usado). O `-wal` estava vazio (0 bytes), então o `.db` estava atualizado.
- `monet.db`, `-wal` e `-shm` copiados para o scratchpad (`...\scratchpad\proddb\`). Análise só na cópia, aberta com `mode=ro` (Python `-I` + sqlite3). Nada foi escrito no banco de produção.
- Schema conferido em `src-tauri/src/lib.rs` (migration v18 `notebook_tasks`), `src/storage/tauri.ts` (`TASKS_TABLES_SQL`, `TASKS_EXTRA_COLUMNS`, `task_statuses`, `task_views`), `src/lib/tasks.ts` (`applyTaskPatch`, `checklistProgress`) e `src/types/index.ts` (`Task`).

**Aviso importante sobre o tamanho da amostra:** são só **23 tasks em 5 dias** (12/10 a 16/10). Os números abaixo mostram tendências e hábitos, não estatística confiável. Vale repetir o estudo com 4 a 6 semanas de uso.

## Achados

### Volume e ritmo
- 23 tasks: 12 criadas no 1º dia (carga inicial do backlog), depois de 1 a 4 por dia.
- 15 concluídas (65%), 3 em Doing, 4 em To do, 1 em Waiting (status personalizado). Nenhuma Dropped.
- Conclusões: 3 a 5 por dia. Tempo até concluir (lead time): mediana de **~24h**, máximo de ~77h. Duas foram criadas já concluídas (registro do que já tinha sido feito).
- 13 de 15 concluídas dentro do prazo (due).

### Projetos (cadernos) e groups
- 3 cadernos com tasks: Inbox (11, todas concluídas), APUC (6), Migração (6).
- Os cadernos APUC e Migração foram criados no 3º dia (14/10 14:28); 1 minuto depois, 12 tasks foram editadas em lote. Até ali, **o group fazia o papel de projeto** dentro do Inbox.
- `group` é o campo mais usado depois das datas: **21/23**. Valores: autoFrotaWeb (8), APUC (6), premioFrotaWeb (4), ajustepremioautoweb (3).
- Sobreposição: o group `APUC` repete o nome do caderno `APUC` (redundante). O group `autoFrotaWeb` aparece em dois cadernos (Inbox e Migração), ou seja, ele é o **sistema** e atravessa projetos. Projeto e sistema são eixos diferentes para o usuário.

### Padrões de título
- 3 títulos antigos usam o prefixo "sistema | ação" (ex.: `autofrotaweb | coleta prints`, `APUC | ...`). O prefixo **parou de aparecer** quando o campo group passou a existir, e o group absorveu essa informação. Confirma que o prefixo era um metadado escondido no título.
- Diferença de caixa entre prefixo e group (`autofrotaweb` vs `autoFrotaWeb`): o mesmo sistema escrito de dois jeitos.
- Um título carrega um status embutido entre crases (`` `PENDENTE` ``), outro usa `->` para separar contexto e detalhe. Isso indica vontade de ter marcadores/metadados curtos visíveis.
- 1 duplicata quase idêntica criada com 2 min de diferença (uma pelo editor, outra a partir de nota com `source_note_id`). Ambas concluídas.
- Títulos curtos e verbais ("publicar", "Publicar", "teste e prints"). Sem o group/projeto ao lado, vários ficam ambíguos ("Publicar" existe em dois projetos). Os cards precisam mostrar projeto e group.

### Datas
- **due_date: 23/23 (100%)**. 13 das 23 apontam para o mesmo dia (sexta 16/10), que funciona como "entrega da semana", não como prazo individual.
- **scheduled_date: 12/23 (52%)**. Nunca depois do due (0 casos). O usuário entende a diferença entre "quando faço" e "quando entrego".
- **Reagendamentos:** 11/23 (48%) reagendadas ao menos uma vez (8×1, 1×2, 2×3). Taxa alta para 5 dias, e coerente com o due usado como "sexta da entrega" sendo empurrado.
- **Atrasadas hoje (17/10):** 2 abertas com due 16/10 (uma em Waiting, uma em Doing).

### Status e fluxo
- Status personalizado criado: **Waiting** (cor laranja, WIP 3). Usado em 1 task cujo corpo registra "aguardando arrumarem...". O bloqueio externo é um estado real do fluxo.
- WIP limit configurado em Doing (3), e o uso está no limite (3 em Doing). Também há WIP 3 em Waiting, o que provavelmente não faz sentido para um estado de espera.
- `doing_since` preenchido nas 3 em Doing (OK).

### Nota-corpo (corpo da task)
- 23/23 têm nota-corpo (subject "Tasks"). 12 (52%) têm conteúdo e 11 estão vazias.
- **Estrutura repetida nos corpos:** `# Status` (8 corpos), `# TODO` / `## Etapas` (9 corpos). O "Status" é um **log manual com data e hora** (ex.: `15/10/2026 - 18:51 -> Aguardando...`), presente em vários corpos.
- **Checklists:** 9/23 tasks (39%) têm checklist em markdown (`- [ ]`/`- [x]`), de 1 a 8 itens. O `checklistProgress` já cobre esse uso. As 2 tasks em To do com checklist têm 0/3, então o x/y no card é útil.
- 1 corpo é só um `linked-note` (link para outra nota).

### Campos nunca ou quase nunca usados
| Campo | Uso | Leitura |
|---|---|---|
| `description` | 0/23 | Coluna morta (documentada como não usada em `tauri.ts`) |
| `recurrence` / `recurrence_next_id` | 0/23 | Não usado (trabalho de projeto, não rotina) |
| `planned_day` (Plan today) | 1/23 | Quase não usado |
| `task_views` (saved views) | 0 | Nunca criada |
| `important` | 4/23 | Pouco usado |
| `source_note_id` | 3/23 | Criação a partir de nota existe, mas é minoria |
| Tags da nota-corpo | 1/23 | Praticamente não usado |

## Recomendações priorizadas (impacto × esforço)

| # | Melhoria | Evidência | Impacto | Esforço |
|---|---|---|---|---|
| 1 | **Card mostra projeto + group + due/scheduled + checklist x/y + ↻N** em todas as visões (já está no req. 2). Group com destaque igual ao do projeto. | Títulos ambíguos sem contexto ("Publicar" ×2); group em 91%; datas em 100%; checklist em 39%; reagendamento em 48% | Alto | (já no escopo) |
| 2 | **Linha "último status" no card**: mostrar a última entrada datada da seção `# Status` da nota-corpo (ou um campo "status note" curto). | Log manual `# Status` com data em 8/23 corpos; Waiting com motivo só no corpo | Alto | Baixo–Médio (parse do markdown, igual ao `checklistProgress`) |
| 3 | **Metadados personalizados (req. 4) — primeiro caso de uso real: "System" (Text)**. Avaliar se o próprio group vira o metadado "System" ou se continua group. Sugestão: manter o group (já usado e agrupável) e não duplicar. Usar metadados para o que hoje vai no título/corpo (ex.: ticket, ambiente, branch, responsável externo do Waiting). | Prefixo "sistema \| ação" migrou para o group; `` `PENDENTE` `` e "branch integração" no título | Médio | (já no escopo) |
| 4 | **Normalização/autocomplete de group sem diferenciar maiúsculas** (sugerir `autoFrotaWeb` ao digitar `autofrotaweb`) e aviso quando group = nome do projeto. | `autofrotaweb` vs `autoFrotaWeb`; group `APUC` = caderno `APUC` | Médio | Baixo |
| 5 | **Waiting como estado de primeira classe**: ao mover para Waiting, pedir motivo ("waiting on...") e exibir no card; sem WIP por padrão em status de espera. | Waiting criado pelo usuário; motivo registrado só no corpo; WIP 3 configurado em Waiting | Médio | Baixo–Médio |
| 6 | **Sinal de reagendamento repetido**: destacar no card/Review tasks com ↻≥2 e ações rápidas ("split", "drop", "move due"). | 48% reagendadas em 5 dias; 3 com ↻≥2 | Médio | Baixo (Review já lista "slipped") |
| 7 | **Data de entrega padrão por projeto/semana** (ex.: "due = próxima sexta"), já que o due é usado como marco semanal. | 13/23 com o mesmo due de sexta | Baixo–Médio | Baixo |
| 8 | **Detecção de duplicata na criação** (título igual no mesmo projeto, criado há poucos minutos). | 1 duplicata em 23 | Baixo | Baixo |
| 9 | **Não investir agora** em recorrência, saved views, Plan today e `important`. Revisitar quando houver mais dados. Remover a coluna `description` só quando houver outra migração de schema (pré-lançamento permite). | 0, 0, 1 e 4 usos | — | — |

### Conexão com as features em andamento
- **Cards (req. 2):** a hierarquia sugerida pelos dados é: título → (projeto · group) → datas (due com destaque se atrasada, scheduled) → checklist x/y → ↻N → metadados. Status por cor (Waiting já tem cor; os built-ins têm `color` nulo, então é preciso uma cor padrão para eles, edge case já previsto no Task Report).
- **Metadados (req. 4):** o MVP Text/Number/Date/Checkbox atende. O candidato real mais claro é Text (ticket/branch/aguardando quem). Date pode servir para "data de publicação" separada do due. Evitar criar um metadado que replique o group.
- **Week (req. 3):** o due concentrado na sexta e o uso só em dias úteis (nenhuma task com data em fim de semana) confirmam que ocultar sáb/dom é útil.

## Dificuldade
**Baixa** para o estudo (concluído). As melhorias 2, 4, 5, 6, 7 e 8 são de dificuldade **Baixa a Média** cada. Nenhuma exige mudar o schema, exceto o "motivo do Waiting" se ele virar campo próprio, e mesmo esse pode ser um metadado.

## Recomendação de escopo
Não alterar o escopo atual. Como próximo passo depois desta entrega, sugiro o item 2 (último status no card) e o item 4 (normalizar group), que têm a melhor relação impacto/esforço. Refazer este estudo em ~1 mês para validar recorrência, Plan today e saved views antes de investir ou remover essas funções.
