# Review Report — Library para estudo de línguas, área VOCABULÁRIO E PRÁTICA (entregas 2 e 3)

- Task Report: `DOCS/reports/26-11-2026/taskreport_20261126233242.md`
- Execution Report: `DOCS/reports/26-11-2026/executionreport_20261126233242.md`
- Plano: `DOCS/reports/26-11-2026/planreport_20261127000656.md` (Etapas 20 a 31, Apêndices B, D.6 a D.9 e F)
- Branch `feat/language-study`, sem commit, sobre `43a9ae8`. O app nunca rodou com este código.
- Revisor: `codereviewAgent`, um de três revisores em paralelo. Esta área cobre vocabulário, banco do vocabulário, reencontro (marcas e popover), prática (perfil, professor, Retell), notas e citações, e os trechos dos dois leitores que ligam essas peças.

## Escopo lido

Lidos inteiros (novos): `src/lib/vocabulary.ts`, `src/lib/vocabularyDestination.ts`, `src/lib/vocabMatch.ts`, `src/lib/languageProfile.ts`, `src/lib/teacherContext.ts`, `src/lib/retell.ts`, `src/hooks/useBookVocabulary.ts`, `src/hooks/useVocabularySend.ts`, `src/hooks/useVocabularyRemoval.ts`, `src/hooks/useVocabularyMarks.ts`, `src/hooks/useReaderTeacher.ts`, `src/hooks/useRetell.tsx`, `src/components/LanguageTools/VocabularyTab.tsx`, `SendVocabularyModal.tsx`, `SavedWordPopover.tsx`, `src/components/Reader/readerContext.test.ts`, e a parte de `src/lib/pageMarks.ts` que monta as marcas.

Lidos pelo diff: `src/storage/tauri.ts`, `browser.ts`, `index.ts`, `src/types/index.ts`, `src/hooks/useBookQuotes.ts`, `src/components/Reader/readerContext.ts`, `QuoteToNoteModal.tsx`, `ReaderChatPanel.tsx` (+ CSS), `ReaderNotesPanel.tsx` (+ CSS). Em `Reader.tsx` e `EpubReader.tsx`, os trechos de vocabulário, marcas, popover da palavra, professor, Retell e as props do chat e da aba Notes, comparados com o `HEAD`. Para contexto: `src/lib/bookQuotes.ts` (sem diff), `src/lib/readerNoteLink.ts`, `src/lib/sentences.ts` (`findContextSentence`), o `Editor` (sincronização do `value`) e os pontos do `App.tsx` que criam notas.

Executado: `npx vitest run` nos 7 arquivos de teste da área (113 testes, todos passando). Um benchmark descartável no scratchpad, com o `vocabMatch.ts` real: 600 formas sobre 80.000 caracteres dão 2 a 6 ms; 600 formas sobre uma página de 4.000 caracteres, 0,3 ms. O mesmo script confirmou que texto em NFD não casa (ver N5).

## Pareceres pedidos pelo Orquestrador

### 1. "Open" depois de enviar vocabulário: o vínculo livro → nota

**O que acontece.** O "Open" do aviso de envio (`useVocabularySend.ts:140`) e o chip "Sent to notebook" (`useVocabularySend.ts:173`) chamam `openNote` do `useBookQuotes` (`useBookQuotes.ts:117-123`), que faz `linkNote` → `setReaderNoteLink(bookId, notebookId, noteId)`, sobe o `linkVersion` e mostra a aba Notes. O vínculo anterior não fica guardado em lugar nenhum: o registro é `Record<bookId, link>` em `monet:reader-book-note-link`, e a nota de vocabulário toma o lugar da nota do livro.

**Para onde vai o que vem depois.** Tudo que lê o vínculo passa a apontar para a nota de vocabulário:
- a próxima citação ("Add to note", `useBookQuotes.ts:152`), inclusive o "Add to note" do Translate e do item da aba;
- o próximo Retell (`useRetell.tsx:77`), e com ele o "Ask for feedback" passa a aparecer na nota de vocabulário;
- o "Save to note" de uma resposta do chat do leitor (`ReaderChatPanel.tsx:394`);
- a opção (b) "The book's note" do `SendVocabularyModal`, que passa a ser a própria nota de vocabulário.

Há um efeito que o Execution Report não registra: o vínculo também é o que liga a **nota Paper** ao PDF. `findBookIdForNote` (`readerNoteLink.ts:90`) procura a nota pelo vínculo, e a `PaperLibraryBar` relê esse vínculo pelo evento `READER_NOTE_LINK_EVENT`. Num artigo em língua estrangeira aberto pela nota Paper, um "Open" no vocabulário faz a nota Paper perder o livro ligado. O vínculo volta quando o usuário reabre o PDF pela nota Paper (`paperPdf.ts:46`). Enquanto isso, citações e respostas do chat vão para a nota de vocabulário. O chip "Sent to notebook" parece só um atalho para ver a nota, e por isso deve ser clicado bem mais vezes do que o "Open" do chat, que já tinha esse efeito.

**Existe um jeito pequeno e seguro?** Sim, com uma mudança contida na aba Notes:
1. `useBookQuotes` ganha `showNote(notebookId, noteId)`, que não chama `setReaderNoteLink`: só guarda um pedido `{ notebookId, noteId, seq }` em estado e chama `onShowNotes()`. O `openNote` continua como está para o "Open" do chat.
2. `ReaderNotesPanel` ganha a prop `viewRequest`. Um efeito por `seq` (igual ao do `linkVersion`, linhas 197-206) marca as duas restaurações como feitas e seleciona caderno e nota, sem gravar o vínculo. Um estado `viewingUnlinked` fica ligado até o usuário escolher outra nota ou outro caderno pelos seletores. Esses caminhos já gravam o vínculo e continuam iguais: escolher pelo seletor é vincular de propósito.
3. Com `viewingUnlinked`, o Efeito D (linhas 218-225) não pode gravar `setReaderNoteLink(book.id, notebook, null)` se a nota vista sumir. Ele só volta a mostrar a nota vinculada. Sem esse cuidado, apagar a nota de vocabulário apagaria o vínculo da nota do livro.
4. No cabeçalho, com `viewingUnlinked`, uma linha "Not linked to this book · Back to the book's note", que relê o vínculo, como já faz o efeito do `linkVersion`.
5. `useVocabularySend` passa a usar `showNote` no `onOpen` e no `openSent`.

O custo fica em cerca de 40 a 60 linhas em `ReaderNotesPanel` e `useBookQuotes`, mais as duas chamadas. Não há como testar sem teste de componente, então vira um passo novo no roteiro. O risco está nas restaurações A e B e no Efeito D. O comportamento da aba Notes de hoje continua o mesmo quando ninguém chama `showNote`. A edição na nota vista vai para ela (`handleUpdateActive` usa `activeNote`), que é o esperado. O Retell não muda: ele escreve na nota vinculada e chama `openNote` com ela mesma.

Uma alternativa ainda menor: o "Open" e o chip levam à nota no app principal (`handleNavigateToNote`), como o "Open the note" do perfil já faz. Custa uma prop nova App → Library → leitores e tira o usuário do livro, o que o roteiro 5.15 já pergunta se incomoda.

Parecer: com o efeito na nota Paper, a decisão aceita na entrega 2 tem um custo maior do que o registrado. Ver o achado I1.

### 2. Chat do leitor com o professor desligado: o contexto é byte a byte o de antes?

**Sim.** O que conferi:
- `buildReaderContext` (`readerContext.ts:85-88`) só acrescenta as duas linhas finais quando `input.teacherBlock` é verdadeiro. Ausente, `undefined` ou `''`, o `lines.join('\n')` é o mesmo de antes, e o resto da função não mudou no diff.
- `ReaderChatPanel.handleSend` passa `teacherBlock: teacherOn ? teacher?.block : undefined`, com `teacherOn = !!teacher?.available && teacher.on`. `available` é `toolsOn` (`useReaderTeacher.ts:55`). Com as ferramentas desligadas, ou com o interruptor desligado, vai `undefined`.
- As outras entradas do contexto são iguais às do `HEAD` nos dois leitores, conferidas lado a lado: o `getPageText` (PDF `Reader.tsx:778-801`, EPUB `EpubReader.tsx:1719-1732`), `highlights`, `positionLabel`, `highlightLabel` e `contextChipLabel`, e o `visibleRangeRef` do EPUB (`EpubReader.tsx:866`). O `getPageCleanText` novo é outro caminho e não entra no chat.
- O texto enviado (`override ?? draft`), o `send(text, undefined, undefined, { ephemeralContext })` e o `ensureScopedFolder` não mudaram. O texto da linha "AI sees" desligada também é o mesmo, agora montado numa string só.
- `readerContext.test.ts` compara a saída com uma string escrita à mão (`TODAY`) e com `teacherBlock` `undefined` e `''`. O teste não captura a saída do `HEAD`, mas o diff da função é só o `if` novo, e isso basta.

Ressalva de comportamento, que não é do contexto desligado: o "Ask for feedback" liga o professor e grava isso por livro (`useReaderTeacher.ts:49` e `:61`). A partir daí, toda pergunta normal desse livro leva o bloco, até o usuário desligar. Ver N1.

## Achados

### Importantes

**I1 [importante, discordância com decisão aceita: Orquestrador na entrega 2, roteiro 4.7 e seção 7] — "Open" e o chip "Sent to notebook" trocam o vínculo do livro, e isso atinge a nota Paper.**
`src/hooks/useVocabularySend.ts:140` e `:173`, que chamam `src/hooks/useBookQuotes.ts:117-123`.
Cenário: um PDF de artigo em francês, aberto pela nota Paper, ligado a ela. O usuário envia o vocabulário a "Vocabulary — <título>" e clica no chip "Sent to notebook" para ver a nota. O vínculo do livro passa a ser a nota de vocabulário. A próxima citação, o próximo Retell e o próximo "Save to note" do chat vão para ela, e a nota Paper deixa de mostrar o livro ligado (`findBookIdForNote` devolve null) até o PDF ser reaberto pela nota Paper. A troca é silenciosa: só o tooltip do "Add to note" mostra o novo destino.
A decisão aceita fala da aba Notes e das citações. O efeito na nota Paper e no "Save to note" do chat não estava na conta. A correção pequena está descrita no parecer 1.

**I2 [importante] — A língua do item fica a do momento em que foi guardado, e corrigir a língua do livro não atualiza o vocabulário.**
`src/lib/vocabulary.ts:69` (`language: baseLanguage(input.book.language)`), `src/storage/tauri.ts:1949` (`setBookLanguage` só faz `UPDATE books`) e `src/storage/tauri.ts:2049` (`getVocabularyByLanguage` filtra pela coluna do item).
Cenário: a heurística detecta um PDF francês como italiano. As ferramentas aparecem, porque italiano também não é a língua nativa. O usuário guarda 30 palavras e depois corrige a língua para francês pelo "Change". Os 30 itens ficam com `language = 'it'`. Abrindo outro livro em francês, nenhuma dessas palavras é marcada; abrindo um livro em italiano, as palavras francesas que coincidirem com palavras do texto são marcadas e aparecem no popover como "Saved in another book". A F3.1 diz "livro de outra língua não recebe marcas", e o "Change" existe justamente porque a detecção erra. No próprio livro nada muda, porque `useVocabularyMarks` usa a lista viva.
Correção: no `setBookLanguage`, também `UPDATE book_vocabulary SET language = $1 WHERE book_id = $2`, com o `ensureVocabularyTable` antes. Ou fazer a consulta por língua com `JOIN books`. A primeira opção é uma linha e segue o padrão.

**I3 [importante] — No PDF, a frase do item é a primeira frase da página que contém o texto, e não a frase onde ele foi selecionado.**
`src/components/Reader/Reader.tsx:2003` (Add pela barra e `V`), `:1853` (Translate, cuja frase o Add do popover reusa) e `:2077` ("Add this sentence" e "Translate here" da palavra marcada). Todos usam `findContextSentence(textoDaPágina, termo)` (`src/lib/sentences.ts:106-110`), que devolve a primeira frase que **contém** o termo como substring.
Cenários:
- (a) A página tem "La malle était lourde." e, mais abaixo, "Elle ouvrit la malle.". O usuário guarda "malle" na primeira e, depois, seleciona "malle" na segunda e aperta `V`. A frase calculada é a primeira de novo, então `findDuplicate` responde "Already in your vocabulary" e nada entra. A F2.2 diz que "a mesma palavra em outra frase é um item novo".
- (b) "Add this sentence" clicado na segunda ocorrência marcada dá o mesmo "Already…". É a única função desse botão.
- (c) Com uma frase anterior que tenha "mallette", a frase guardada, a citada na nota e a lida pelo "Listen to list" é a de "mallette".
No EPUB o problema é menor: a busca roda só no bloco da seleção (`epubContextText`), então só aparece com a mesma palavra duas vezes no mesmo parágrafo.
Correção: os leitores já têm os offsets da seleção no texto juntado (`rangeToJoinedOffsets`). Basta contar quantas vezes o termo aparece antes de `start` e escolher a mesma ocorrência no texto limpo, com fronteira de palavra. Se não achar, fica a regra de hoje. O Translate da 1A, que é de outro revisor, ganha a mesma correção, porque o "Add to vocabulary" do popover herda a frase dele.

**I4 [importante] — O destino padrão de uma nota nova é o primeiro caderno da lista, que tende a ser o Calendar, e o mesmo vale para a nota de perfil.**
`src/components/LanguageTools/SendVocabularyModal.tsx:69` (`notebooks[0]` quando não há nota vinculada nem "último caderno de citação") e `src/App.tsx:4111` (`orderedNotebooks[0]` no `handleOpenLanguageProfile`).
O Calendar é criado com id fixo e **posto no começo da ordem** (`App.tsx:1426-1428`). A lista que chega aos leitores é a `orderedNotebooks` (`App.tsx:4721`), e nem o modal nem o handler tiram o `CALENDAR_NOTEBOOK_ID`.
Cenários:
- (a) No primeiro envio, num livro sem nota vinculada e sem citação feita antes, o modal abre com "New note: Vocabulary — <título> in Calendar" já marcado, e "Send" cria a nota no Calendar.
- (b) "Open the note" do perfil, sem a nota existir, cria "Language profile" no Calendar.
- (c) Se o primeiro caderno tiver a IA desligada, a nota de perfil nasce num caderno que o `findLanguageProfile` ignora: o professor não a lê e cada "Open the note" cria outra.
O Radar não tem esse problema porque o usuário escolhe o caderno no chat. A ordem depende do que o usuário já reordenou, então isso entra no roteiro, mas o código não protege nenhum dos casos.
Correção: escolher o primeiro caderno que não seja o Calendar e, no perfil, que não esteja em `disabledNotebookIds`. O Quick Notes (`ensureInbox`) é um bom padrão para o perfil.

### Nits

**N1 [nit, pode ser decisão] — "Ask for feedback" deixa o professor ligado para sempre naquele livro.** `src/hooks/useReaderTeacher.ts:61` (`turnOn` → `setReaderTeacher(book.id, true)`). Depois de um pedido de comentário, toda pergunta normal desse livro leva o bloco do professor, até alguém desligar. A alternativa é mandar o bloco só nessa mensagem: um `teacherBlock` forçado no `pendingSend`, sem gravar o interruptor.

**N2 [nit] — O modo destino do `QuoteToNoteModal` fala de vocabulário também quando quem o abre é o Retell.** `src/components/Reader/QuoteToNoteModal.tsx:337` ("Create a notebook to send the vocabulary to.") e `:486` (placeholder "e.g.: Vocabulary"). No Retell sem nota vinculada, o modal sugere criar uma nota "Vocabulary" para o reconto. Passe o texto por prop ou use um texto neutro.

**N3 [nit] — O chip e o bloco do professor contam coisas diferentes.** `src/hooks/useReaderTeacher.ts:59` conta `words.length`, com a mesma palavra guardada em duas frases contada duas vezes. `teacherContext.ts:28-41` tira a repetição e corta em 20. O chip diz "· 5 saved" e a prévia lista 4 palavras.

**N4 [nit] — No EPUB, "saved on this page" é só a location do começo da tela.** `src/components/Reader/EpubReader.tsx:450-453` (`item.page === pageNum`). Com duas colunas, ou com uma tela que atravessa duas locations, os itens da segunda ficam fora do bloco e do chip. O trecho visível (`visibleRangeRef`) é o critério que o contexto do chat já usa.

**N5 [nit] — Texto em NFD não recebe marca.** `src/lib/vocabMatch.ts:64-76`: a forma é NFC (`normalizeTerm`), e a regex roda sobre o texto cru. O benchmark confirmou que "entrebâillée" em NFD dá 0 ocorrências. É raro no pdf.js, que normaliza, e possível em EPUB. Normalizar o texto exigiria refazer o mapa de offsets, então fica para o roteiro.

**N6 [nit] — Add antes da primeira carga da lista.** `src/hooks/useBookVocabulary.ts:30-45` e `:49-64`. Se o usuário apertar `V` antes de o `getBookVocabulary` resolver (cold start com a fila de DDL), a duplicata não é vista. Pior: o `commit(list)` da carga pode chegar depois e tirar do estado o item recém-gravado, porque a lista do banco pode ter sido lida antes do INSERT. O item some da aba e das marcas até reabrir o livro. Correção: na carga, juntar a lista do banco com os itens novos do estado (pelo id).

**N7 [nit] — Falha ao marcar como enviado depois de o bloco já estar na nota.** `src/hooks/useVocabularySend.ts:124-127`: o erro só vai ao console, o aviso diz "Sent N items" e os itens continuam em "New" (o `markSent` reverte o estado). O próximo envio repete o bloco. Basta um aviso de erro.

**N8 [nit] — Undo de vários itens removidos com `Promise.all`.** `src/hooks/useVocabularyRemoval.ts:26`, com `useBookVocabulary.ts:68-80`: cada `put` reverte para o retrato que tirou. Se a primeira gravação falhar depois de as outras entrarem, o estado volta sem os itens que foram gravados. Fazer em sequência, como o remove já faz, evita isso.

**N9 [nit] — "Change" abre com "New note" marcado mesmo com destino lembrado.** `src/components/LanguageTools/SendVocabularyModal.tsx:72-74`. Com uma nota de vocabulário já em uso, "Change" → "Send" (ou "Save destination") cria uma segunda "Vocabulary — <título>". O destino atual só aparece como opção se for a nota vinculada. Uma opção "Current: <nota>" marcada por padrão resolve.

**N10 [nit] — Termo em negrito por substring.** `src/lib/vocabulary.ts:238-251` (`splitAtTerm`), usado na aba e no popover. Com "malle" guardada numa frase que tem "mallette" antes, o negrito cai em "malle" de "mallette". A fronteira de palavra do `vocabMatch` serve aqui também.

**N11 [nit] — Sobras no localStorage ao apagar o livro.** `monet:vocab-destinations` e `monet:reader-teacher` guardam o `bookId` para sempre. Não quebra nada, e o vínculo de nota de hoje já faz igual.

**N12 [nit, organização] — Dependências invertidas.** `src/lib/vocabulary.ts:4` importa o tipo `ListenSource` de `hooks/useListenPlayer`. `src/hooks/useReaderTeacher.ts:3` e `src/hooks/useVocabularySend.ts:28-31` importam tipos de componentes (`ReaderTeacher`, `SendVocabularyModalProps`). `src/hooks/useRetell.tsx` devolve JSX (o modal). Funciona, mas os tipos compartilhados caberiam em `types/` ou em `lib/`, e o modal do Retell, no leitor.

## Testes: cobrem o que importa?

- **Bem coberto (funções puras):** duplicata, montagem do item, âncora, bloco da nota (com e sem tradução, frase, forma base), anexar e desfazer, o bloco passando pelo editor real (ponto fixo, toggles recolhidos), rótulos, agrupamento para o Undo, casamento de palavras (fronteira, caixa, forma base, expressão em duas linhas, apóstrofo, sobreposição entre lotes, regex literal, tempo), âncoras de frase, perfil, bloco do professor, contexto sem professor, Retell (extração, dois recontos, cabeçalho seguinte) e mensagem de feedback.
- **Sem teste (onde moram os riscos de execução):**
  - o `deliver` do `useVocabularySend`: os caminhos novo × existente; o `onUndone` só com `ok`; a marca devolvida por grupo no reenvio; o `markSent` que falha;
  - o rollback e a carga do `useBookVocabulary` (N6);
  - `applyVocabMarks` nos dois leitores e o clique com prioridade do grifo;
  - o efeito do `pendingSend`;
  - o modo destino do `QuoteToNoteModal`;
  - o SQL no plugin (só foi validado em SQLite em memória).

  O `announceAppendedBlock` com `onUndone` dá para testar sem React, com `showToast` simulado. O mesmo vale para o `deliver`, se for extraído para `lib/`: é a lógica que mexe na nota e no banco ao mesmo tempo.
- Nenhum teste pega I2 (falta um caso "língua do livro trocada") nem I3 (falta um caso de `findContextSentence` com duas frases e o mesmo termo).

## Conferências sem achado

- **Banco:** a tabela entra por `ensureVocabularyTable` (memoizado, `serialDdl`, zera em falha), sem migration e sem `BEGIN`/`COMMIT`. As leituras listam as colunas (`VOCABULARY_COLUMNS`). O upsert grava todos os campos, os placeholders do `IN` (`$4…`) estão certos e o `deleteBook` apaga o vocabulário antes do livro. Um build antigo ignora a tabela.
- **Undo:** `removeAppendedBlock` tira a última ocorrência do bloco exato. Um Retell ou uma citação acrescentados depois não atrapalham, e, com a nota editada em outro trecho e o bloco intacto, o Undo ainda funciona. O toast é único (`useReaderToast`), então só o último Undo fica clicável, e não há como desfazer o bloco errado. O `Editor` aplica o `value` de fora sem emitir `onUpdate` (`Editor.tsx:706-720`), então a nota aberta na aba Notes não regrava o bloco ao recebê-lo.
- **Enviado sem ter ido:** o `markSent` só roda depois de o `appendBlockToNote` ou o `onCreateNote` resolverem. O `onSaveNote` do App rejeita na falha (`App.tsx:4726-4728`).
- **Desempenho das marcas:** o casamento é barato (2 a 6 ms para 600 formas em 80.000 caracteres). No EPUB, o resultado fica guardado por documento até a lista de formas mudar. O custo que sobra é a criação dos Ranges e a pintura das centenas de ocorrências de uma forma base muito comum, que fica para o roteiro 5.12.
- **Regras da casa:** ícones Phosphor (sem emoji), textos de UI em inglês, popovers e modal com `z-index` 1100. Não há flashcard, repetição espaçada, estado de palavra, "I know this" nem contador na aba. Os números dos botões ("Send 6 new", "5 saved") são os pedidos no Task Report. Não achei código morto na área: os exports sem chamador externo (`sentMarkOf`, `vocabularyDedupKey`, `isLanguageProfileNote`) são usados dentro do próprio módulo.

## Bugs extras

Nenhum fora do escopo.

## Veredicto

Veredicto: APROVADO COM RESSALVAS
O vocabulário, o envio com Undo, as marcas e o professor estão corretos no essencial. O contexto do chat com o professor desligado é idêntico ao de antes, e não há perda de dado na nota nem SQL errado. Quatro pontos devem entrar na passada final: o vínculo trocado pelo "Open" e pelo chip, que agora sabemos atingir a nota Paper; a língua do item que não acompanha a correção da língua do livro; a frase errada no PDF quando a palavra se repete na página; e o caderno padrão (Calendar) para a nota nova de vocabulário e para a nota de perfil.

Contagem: 0 críticos, 4 importantes (um deles é discordância com decisão aceita), 12 nits.

---

### CodeReviewAgent — 20261127101149 (área vocabulário e prática; para o Orquestrador registrar no Execution Report)
- Summary: Revisão das entregas 2 e 3 (vocabulário, `book_vocabulary`, envio e Undo, marcas e popover da palavra, perfil, professor e Retell). Sem críticos. Importantes: I1, o "Open" e o chip "Sent to notebook" trocam o vínculo livro → nota e com isso a nota Paper perde o livro (discordância com decisão aceita, com uma correção pequena descrita); I2, a língua do item não acompanha a correção da língua do livro; I3, no PDF a frase do item é a primeira da página que contém o termo (duplicata falsa, frase errada na nota); I4, o caderno padrão da nota nova de vocabulário e da nota de perfil é o primeiro da lista, em geral o Calendar. Com o professor desligado, o contexto do chat é byte a byte o de antes.
- Verdict: APROVADO COM RESSALVAS
- Output: `DOCS/reports/26-11-2026/reviewreport_20261127101149_vocab.md`
