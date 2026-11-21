# Review Report — fatia A–C (trackers, Log por tipo de nota, constância nos agentes) e ajustes de UX da fatia 1

- Task report: `DOCS/reports/20-11-2026/taskreport_20261120115512.md`
- Execution report: `DOCS/reports/20-11-2026/executionreport_20261120115512.md`
- Plano: `DOCS/reports/20-11-2026/planreport_20261120122642_a-c.md`
- Triagem de UX: `DOCS/reports/20-11-2026/uxtriage_20261120133108.md`
- Spec: `DOCS/specs/trackers.md`
- Fora desta revisão: fases D e E (Radar, `/since`, Papers, OpenAlex, `radar_scope_state`) e os trechos delas nos arquivos compartilhados.

Verificação rodada: `npx tsc --noEmit` limpo; `npm test` com 22 arquivos e 524 testes passando (`trackers.test.ts` e `noteLog.test.ts`: 135 testes). O app não foi aberto.

## Veredicto

**Veredicto: APROVADO COM RESSALVAS**
As contas, o storage e a tool estão corretos e só leem. O ponto a corrigir antes do merge é que uma falha na leitura dos trackers derruba o contexto inteiro do Coach e do Plan week, inclusive para quem não tem tracker. O resto são ajustes pequenos.

---

## Defeitos confirmados

### 1. `[importante]` Falha ao ler os trackers derruba o contexto inteiro do Coach e do Plan week
- **Onde:** `src/lib/agents/coach.ts:52` e `src/lib/agents/planWeek.ts:158`.
- **O que está errado:** `loadTrackerData` é chamado com `await` e sem `catch`. Ele chama `storage.getTrackers()` e `getTrackerMarks()`, que rodam `ensureTrackersTables`, uma DDL de escrita. Se essa chamada falhar, o `buildContext` inteiro rejeita. O `useChat` (`src/hooks/useChat.ts:3878-3883`) troca então o bloco por "Coach context could not be loaded for this message…".
- **Cenário:** cold start com o `monet.db` travado (a corrida de lock registrada em 2026-06-24), ou qualquer erro do SQLite só nas tabelas novas. O usuário abre o Coach e aperta Enter. O modelo recebe "context could not be loaded" e perde também os planos, que leram sem erro. Isso vale mesmo para quem não tem nenhum tracker. É uma regressão: antes, o Coach e o Plan week não dependiam dessas tabelas.
- **Correção:** fazer como o `/week-review` já faz no `App.tsx` (`loadTrackersWeekText(...).catch(() => null)`). Envolver a parte dos trackers num `try/catch` (ou num `.catch(() => null)`) e seguir sem o bloco "Trackers" quando a leitura falhar, com um `console.warn`.

### 2. `[nit]` Código morto: o atributo `data-log-section` não é lido por ninguém, e "Settings" do Log não leva à seção Log
- **Onde:** `src/components/NoteTypes/NoteTypeLogSection.tsx:34`. Só o `data-board-section` tem leitor, em `NoteTypesModal.tsx:187` (`focusBoard`).
- **O que está errado:** o atributo foi criado e nenhum código o usa. O botão "Settings" da visão Log (`App.tsx`, `onOpenSettings={() => setNoteTypesOpen({ focusTypeId })}`) abre o modal no tipo, mas no topo. A seção Log fica abaixo de Board, e muitas vezes fora da área visível.
- **Cenário:** no Log do tipo Practice, clicar em "Settings". O modal abre em Name/Icon, e o usuário precisa rolar até achar "Log".
- **Correção:** remover o atributo, como manda a regra do projeto. A alternativa é ligá-lo: um `focusLog` no estado do modal, no mesmo padrão do `focusBoard`, passado pelo "Settings" do Log.

### 3. `[nit]` Dia com marca manual e nota vinculada: o tooltip ensina um "desfazer" que não desfaz
- **Onde:** `src/lib/trackers.ts:325-327` (`trackerDayTitle`), `TrackersStrip.tsx:214-217` e `TrackerChips.tsx:65-68`.
- **O que está errado:** quando o dia vem de nota, o clique sempre abre a nota, mesmo que o dia também tenha marca manual. O tooltip diz "To undo, archive the note or change its date."
- **Cenário:** o usuário marca Guitar na sexta à mão e depois cria uma nota Practice com a mesma data. Ele arquiva a nota, seguindo o tooltip, e o dia continua feito por causa da marca manual. Enquanto a nota existir, não há como tirar a marca manual.
- **Correção:** com `manual && fromNote`, mudar o texto para algo como "Done (marked and from a Practice note) · click to open the note. Unmark it after archiving the note." Outra opção é o clique desmarcar a marca manual e deixar o dia só "from note".

### 4. `[nit]` O atalho Practice pode deixar propriedades órfãs
- **Onde:** `src/lib/practiceSetup.ts:14-15`.
- **O que está errado:** a ordem de gravação é: as propriedades novas primeiro, depois o tipo. Para um tipo novo, se `saveNoteType` falhar depois das propriedades, ficam linhas em `metadata_defs` com `note_type_id` de um tipo que não existe. A próxima tentativa gera um tipo com id novo e outro conjunto de propriedades. As primeiras nunca são limpas.
- **Cenário:** "Create 'Practice' type" com falha de escrita exatamente no `saveNoteType`. As 4 propriedades órfãs ficam no banco, invisíveis, e se acumulam a cada falha.
- **Correção:** gravar em três passos: o tipo com `log: null`, depois as propriedades, depois o tipo com o `log`. Assim, uma falha deixa no máximo um tipo sem Log, que a próxima chamada completa (`typeChanged` continua `true` porque `log === null`). Não sobra órfão nem referência solta.

### 5. `[nit]` O contador do menu de tools sobe 1 para todo mundo, mesmo sem tracker
- **Onde:** `src/components/ChatPanel/ChatToolsMenu.tsx:100`.
- **O que está errado:** o switch "Trackers" vem ligado por padrão e entra no contador do botão de tools. Só que a tool não é enviada sem tracker ativo (`useChat.ts:4261-4273`).
- **Cenário:** um usuário que nunca criou tracker passa a ver o contador de tools com +1, por uma tool que nunca vai ao modelo.
- **Correção:** aceitar como está, ou passar ao menu se há tracker ativo e só contar nesse caso. Isso é opcional; registro porque muda a tela de quem não usa a feature.

### 6. `[nit]` A spec diz "sem o cinza", mas a escolha manual permite o cinza
- **Onde:** `DOCS/specs/trackers.md:13`. O código está em `TrackersModal.tsx:295` (`ColorDots` com a paleta inteira) e em `trackers.ts:24` (só a rotação automática pula o cinza).
- **Correção:** trocar o texto da spec para "cor da paleta das tasks (a rotação automática pula o cinza e as duas cores dos marcadores da grade)".

---

## Suspeitas (li o código; o efeito depende de uso real ou de um modelo)

### S1. `[importante]` O Coach sem tracker mudou o texto que o próprio app envia
- **Onde:** `src/lib/agents/chat.ts:123-125`.
- **O que muda:** o placeholder, o texto vazio e a `defaultMessage` do Coach agora dizem "Check my plans and trackers" para todos, inclusive para quem não tem tracker. O prompt manda "Without a Trackers section, do not mention trackers", mas a mensagem do usuário, gerada pelo app ao apertar Enter, pede trackers. É provável que o modelo responda algo como "você não tem trackers". Isso contraria o edge case do Task Report ("Sem tracker: os agentes não tocam no assunto") e a exigência de o Coach sem trackers se comportar como antes.
- **Correção:** voltar a `defaultMessage` para "Check my plans" (o Coach lê os trackers de qualquer jeito, pelo bloco). Também dá para deixar o placeholder e o texto vazio neutros ou condicionais. Sem um modelo real não dá para confirmar.

### S2. `[nit]` A semana de criação conta como "abaixo da meta"
- **Onde:** `src/lib/trackers.ts:177` (`end < trackerStartDay`). O teste em `trackers.test.ts:285-292` fixa esse comportamento.
- **O que acontece:** só ficam de fora as semanas que terminaram antes do início. A semana em que o tracker nasceu conta inteira.
- **Cenário:** Guitar, meta 3, criado no domingo 22/11. Na segunda 23/11, a semana 16–22/11 aparece como "0/3 below target" nas "Last 4 weeks" do Coach, na tool e no denominador do mês ("0 of 1 week on target").
- **Avaliação:** a decisão 4 do Orquestrador, lida ao pé da letra, aceita isso. Mesmo assim, é provável que o Coordenador estranhe no primeiro teste, porque vai criar os trackers no meio da semana. Uma opção é tirar a semana do início quando ela ficou abaixo da meta, ou contá-la só se bateu a meta. Fica para o Orquestrador decidir.

### S3. `[nit]` A faixa mostra "Trackers · New tracker" antes da primeira leitura terminar
- **Onde:** `src/hooks/useTrackers.ts` (não há estado `loaded`) e `TrackersStrip.tsx:127-143`.
- **Cenário:** no cold start, com a primeira leitura lenta ou em nova tentativa (1, 2, 4 e 8 s), quem tem trackers vê por um instante o estado vazio com "New tracker" e pode clicar nele.
- **Correção:** um `loaded` no hook, e a faixa vazia só depois dele.

### S4. `[nit]` Uma recarga vinda da outra janela pode apagar da tela uma marca ainda em gravação
- **Onde:** `src/hooks/useTrackers.ts:64-76` e `202-221`.
- **Cenário:** com a keep e a main abertas, o usuário marca um dia na keep. Antes do `INSERT` terminar, chega um `trackers-changed` da main (por exemplo, por outra marca). O `reload` troca as marcas pela lista do banco, ainda sem a nova. A marca some da tela da keep, mas está gravada. Ela só volta numa próxima recarga, já que o evento da própria janela é ignorado.
- **Avaliação:** a chance é baixa, e o padrão é o mesmo dos outros hooks de registro.

### S5. `[nit]` Na keep, os tipos de nota são lidos sem nova tentativa
- **Onde:** `src/components/KeepPanel/KeepPanel.tsx`, `loadNoteTypes`.
- **Cenário:** no cold start com lock, `getNoteTypes` falha e `noteTypes` fica `[]`. No modal da keep, o tracker vinculado aparece com "From notes: None". Se o usuário escolher outro tipo nesse estado, a confirmação do D4 não aparece (`handleLink` não acha o `current`), e os dias vindos de nota somem sem aviso. A situação se corrige no próximo `keep-shown`.
- **Correção:** usar o `loadWithRetry` (de `tasksEvents.ts`) no `loadNoteTypes` da keep.

### S6. `[nit]` Practice que já tinha Log: as propriedades novas não entram no Log
- **Onde:** `src/lib/noteLog.ts:311-314`.
- **Cenário:** existe um tipo "Practice" com o Log ligado e sem Sum, Trend nem Group. O usuário roda "Set up 'Practice' type". Minutes, BPM e Piece são criados, mas o Log continua sem referências, e a mensagem é "Updated the Practice type: added Piece, Minutes, BPM, Focus." Pela regra "reaproveita e só acrescenta", o comportamento está certo, mas o usuário espera ver os minutos somados.
- **Correção possível:** preencher só as referências que estão `null`.

### S7. `[nit]` No chat das Anotações, o switch "Trackers" não mostra "On for Coach"
- **Onde:** `src/components/NotesChat/NotesChatPanel.tsx:682`. O `ChatToolsMenu` não recebe `agent`, o que já acontecia antes desta task.
- **Cenário:** com o Coach no chat das Anotações e o switch desligado pelo usuário, o menu mostra Trackers desligado, mas o `useChat` anexa a tool, porque o agente a força.
- **Avaliação:** o Orquestrador já listou esse ponto. Corrigir passando o agente da conversa ao menu.

---

## Pontos que os `codeAgent` deixaram para a revisão

- **`validName` duplicado** (`useTrackers.ts:29-42` e `useNoteTypes.ts:23-35`). `[nit]` A lógica é igual (aparar, cortar no máximo, conferir colisão sem caixa nem acento). Só a mensagem de colisão do tracker muda, por depender de o outro estar arquivado. Sugestão: um helper `uniqueName(name, max, others, exceptId): { name } | { clash }` em `src/lib/` (por exemplo, junto de `normalizeName` em `tasks.ts`), com cada hook montando a sua mensagem. Pode entrar na passada final. Deixar como está também é defensável, porque são 12 linhas.
- **CSS do `TrackersModal` repetindo regras do `NoteTypesModal`.** `[nit]` Cerca de 80 linhas são iguais ou quase: `.card` (só muda o `max-width`), `.columns` (só a largura da 1ª coluna), `.list`/`.types`, `.row`/`.typeRow`, `.rowActive`/`.typeRowActive`, `.rowButton`/`.typeButton`, `.detail`, `.detail > *`, `.field`, `.iconField`, `.select`, `.select:focus` e `.empty`. O `IconPicker` já importa `NoteTypesModal.module.css`. Sugestão: um `TwoPaneModal.module.css` comum (ou `composes:`), com a largura das colunas por variável CSS. Não é um defeito funcional, e o Orquestrador decide se entra agora.
- **`gap: 1px` fora da escala** (`CalendarView.module.css`, `.trackerDots`, e `NoteLog.module.css:132`). Sem ação. Nos dois casos a escolha está justificada no comentário: no Log é um fio divisório (o fundo aparecendo pelo gap), não um espaçamento; na grade, `--space-0` (2 px) não deixaria caber 3 pontos e o "+" nos cerca de 25 px úteis da célula a 220 px. São os dois únicos `gap: 1px` do projeto.

---

## O que foi conferido e está correto

**1. Contas (`src/lib/trackers.ts`)**
- A semana vai de segunda a domingo (`startOfWeekKey` por chave local).
- A semana pertence ao mês da quinta-feira (`monthWeekStarts`). Conferi na mão a virada de ano: dezembro de 2026 termina na semana de 28/12, e janeiro de 2027 começa em 04/01.
- O total do mês conta só os dias do mês.
- O denominador inclui a semana atual só com a meta batida.
- O início é a criação ou o 1º dia feito, o que vier antes.
- A meta atual vale para todas as semanas.
- Dia futuro fica fora nas marcas e nas notas.
- Marca manual mais nota no mesmo dia conta uma vez.
- `noteDayKey` usa a `date` ISO ou a criação local.
- A tool valida as datas (`isDateKey` recusa 2026-02-31), inverte `from`/`to` trocados, limita a 366 dias, lista até 120 dias e aceita parte do nome sem caixa nem acento.

**Testes:** cobrem de verdade as regras pedidas, não só o caminho feliz: quinta-feira, semana que cruza o mês, denominador com a semana atual, início recuado por marca retroativa, meta alterada, futuro, dia duplo, arquivado e período inválido. Lacunas:
- não há teste da virada de ano;
- não há testes do hook (`setMark` com desfazer, `markError`, `loadFailed`), do `setUpPracticeType` com storage simulado nem da condição que anexa a `query_trackers`.

**2. Storage**
- `ensureTrackersTables` é idempotente e memoizado, zera em falha e só roda DDL dentro do `serialDdl`.
- A coluna `note_types.log` entra por `addMissingColumns` dentro do `ensureNoteTypesTable`, o que cobre banco antigo e novo.
- Nenhum `ensure*` é chamado dentro de um `serialDdl`. O `deleteNoteType` chama os quatro em sequência, fora da fila.
- Não há `BEGIN`/`COMMIT`.
- Os SELECT novos listam as colunas (`TRACKER_COLUMNS`, `TRACKER_MARK_COLUMNS`, `getNoteTypes` com `log`).
- O `deleteTracker` apaga as marcas e depois o tracker. O `deleteNoteType` limpa o vínculo antes de apagar o tipo.

**3. Estado**
- A gravação otimista da marca desfaz para o estado anterior.
- `markError` some na próxima marca gravada.
- `loadFailed` não esconde uma lista que já estava em memória.
- O `trackers-changed` usa a origem da janela.
- A main recarrega ao apagar um tipo; a keep recebe o evento.
- A leitura do vínculo é defensiva em todos os consumidores.
- Calcular os dias de todos os trackers a cada mudança de `notes` custa pouco: no máximo T × (marcas + notas), sem efeito em cascata. As memos têm as dependências certas.

**4. Tool `query_trackers`**
- É só leitura: nenhum caminho da IA chega a `saveTracker`, `setTrackerMark` ou `deleteTracker`. Só o hook os chama, por clique.
- Vem ligada por padrão, só é anexada com tracker ativo, é forçada no Coach e no Plan week e fica fora do Reader (`mode !== 'reader'`).
- Os argumentos são validados como texto.

**5. Regressão**
- `/week-review` sem trackers: o bloco não entra (`.catch(() => null)`), e o prompt manda omitir a seção.
- O modal de tipos depois da extração do `IconPicker` se comporta igual, inclusive o estado da busca.
- `tasksEvents.ts`: as assinaturas antigas foram mantidas.
- A célula do Calendar com 28 px fixos cabe o pior caso (27 px).
- `deleteNoteType`: a ordem é segura.

**6. Regras do projeto**
- Os ícones são Phosphor (`Target`, `Check`, `ChartLineUp`, `CaretDown`/`CaretRight`, `Plus`, `Archive`…), e `target` e `music` existem no `TYPE_ICONS`.
- A UI está em inglês.
- Não há `{ __html }` novo nesta fatia.
- O `App.tsx` só faz fiação. O `handleCreateLogNote` tem cerca de 10 linhas, no padrão de `handleCreateNoteFromSearch`.
- Não há streak, lembrete nem notificação.

**7. Documentação**
- A spec descreve o código, salvo o item 6.
- O PRD (§4 e §9) e a linha do `docs.menu.md` estão coerentes.

---

## Bugs extras

Nenhum no código lido fora do escopo.

## Não verificado
- O app aberto: altura real da grade, faixa e chips em 220 px na keep, anel interno, `aria-disabled` com tooltip no WebView2, quebra do seletor de período.
- As tabelas criadas em banco real (antigo e novo) e a criação simultânea na main e na keep.
- Os prompts do Coach, do Plan week e do `/week-review`, com e sem trackers, num modelo real (inclusive a S1).
- A tool `query_trackers` com um modelo real.
- O atalho Practice contra o banco real.
