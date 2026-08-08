# Execution Report

## Documents

- Task report: `DOCS/reports/07-08-2026/taskreport_20260807185948.md`
- Execution report: `DOCS/reports/07-08-2026/executionreport_20260807190451.md`
- Explorer report: `DOCS/reports/07-08-2026/explorerreport_20260807180845.md`
- Plan report: não gerado
- Review report: `DOCS/reports/07-08-2026/reviewreport_20260807194534.md`

## Sessions

### Orchestrator — abertura — 20260807190451

- Summary: Task Report aprovado pelo Coordenador. Esta task é o **primeiro passo** de um objetivo maior (suporte a leitura de EPUB na Library) e é um refactor puro: extrair do `Reader.tsx` o fluxo de citação e o CRUD de grifos para uma camada reaproveitável, sem introduzir nada de EPUB e sem alterar comportamento.
- Inputs:
  - `DOCS/docs.menu.md`
  - `DOCS/reports/07-08-2026/taskreport_20260807185948.md`
  - `DOCS/reports/07-08-2026/explorerreport_20260807180845.md`
- Decision: Pular o `plannerAgent` — o Task Report já traz requisitos, restrições e edge cases fechados, e o escopo é uma extração delimitada em 3 arquivos novos + 1 arquivo alterado. Ir direto para o `codeAgent` (Opus 5), conforme instrução explícita do Coordenador.
- Next step: aguardar conclusão do `codeAgent`, depois devolver ao Coordenador para teste antes da Etapa 2 (revisão).

### Contexto da decisão de arquitetura (para quem ler depois)

O explorer report original recomendava extrair uma *shell* compartilhada do `Reader.tsx` antes de escrever o leitor de EPUB. **Essa recomendação foi revista em discussão com o Coordenador** e o desenho acordado é outro:

1. **Tabela única** para os dois formatos (`books` + `ADD COLUMN format`, `cfi`, `locations_json`), com union discriminada no TypeScript para segurança em tempo de compilação — em vez de tabelas separadas por formato.
2. **Reader separado**: o `Reader.tsx` de PDF permanece intacto e o EPUB ganha um `EpubReader.tsx` próprio. Nada de extração de shell — a costura entre os dois só será extraída quando existir evidência de onde ela realmente está.
3. **Camadas service + hook** para o que já é comprovadamente compartilhado — que é exatamente o escopo desta task.

Efeito no dimensionamento: a tarefa geral de suporte a EPUB caiu de **ALTA** para **MÉDIA**, e o risco deixou de ser "regressão em código validado" para ser "código novo que funciona ou não".

**Decisões ainda em aberto** (não bloqueiam esta task, mas bloqueiam o EPUB):
1. Formato da citação em EPUB — é por isso que a assinatura de `buildQuoteBlock` **não** é alterada aqui.
2. Se a busca full-text entra ou não na v1 do EPUB.
3. Tratamento de EPUBs com DRM (não abrem por nenhuma biblioteca open source).

### Orchestrator — decisão — 20260807193908

- Summary: Coordenador testou o refactor e confirmou que o leitor de PDF segue funcionando normalmente. Antes de repassar, o Orquestrador verificou os três arquivos novos e o diff completo do `Reader.tsx` (−158/+38): os edge cases do Task Report estão preservados um a um, e a opção do `codeAgent` por *getters* (em vez de arrays) no service está correta — o código original lia `notesRef.current` **depois** dos awaits, então array capturado teria mudado o comportamento silenciosamente.
- Inputs:
  - `DOCS/reports/07-08-2026/taskreport_20260807185948.md`
  - `DOCS/reports/07-08-2026/executionreport_20260807190451.md`
- Decision: Etapa 1 encerrada. Seguir para a Etapa 2 (revisão) com `codereviewAgent` em Opus 5, por instrução explícita do Coordenador, passando o contexto completo das decisões de arquitetura para que decisões deliberadas não sejam reportadas como falhas.
- Ponto que o Orquestrador quer olhado na revisão: `lib/bookQuotes.ts` importa de `components/Reader/QuoteToNoteModal` — dependência `lib → components`, direção invertida. A decisão foi correta dada a restrição de não mover `buildQuoteBlock`, mas a justificativa registrada pelo `codeAgent` ("o `useConfirm` já faz igual") não sustenta por si só: precedente não é razão.
- Next step: aguardar o `reviewreport`, atualizar a seção `## Documents` e disparar o `codeAgent` uma única vez para a passada final de ajustes.

### CodeAgent — implementação inicial — 20260807191238

- Summary: Extraí do `Reader.tsx` o fluxo de citação e o CRUD de grifos para uma camada reaproveitável (service puro + dois hooks), sem alterar comportamento. `lib/bookQuotes.ts` monta o bloco de citação, grava a nota, registra o `BookQuote` e **devolve** a mensagem do toast (não exibe). `useBookQuotes` segura estado de toast/modal e delega ao service. `useHighlights` concentra carga por `bookId`, `persistHighlight`/`removeHighlight`/`changeColor` e os derivados `orderedHighlights`/`colorFilter`/`filteredHighlights`. O `Reader.tsx` passou a consumir os três; as versões locais e os refs `notesRef`/`notebooksRef` (que existiam só para esse fluxo) foram removidos.
- Files changed:
  - `src/components/Reader/Reader.tsx`
- Files created:
  - `src/lib/bookQuotes.ts`
  - `src/hooks/useBookQuotes.ts`
  - `src/hooks/useHighlights.ts`
- Files removed:
  - nenhum
- Left behind: nenhum item de escopo. Registros para quem continuar:
  - **Edge cases preservados um a um**: erro de `storage.saveQuote` engolido (só `console.error`) com o toast ainda exibido; toast só quando há `notebookId` resolvível; leitura de `notes`/`notebooks` por ref (no hook) e por *getter* (no service) para não capturar valor obsoleto — o service usa getters porque a mensagem do toast é montada **depois** de awaits, que é exatamente o momento em que o `notesRef.current` era lido antes; fallback para o modal quando `appendQuoteToNote` rejeita; timer do toast reiniciado a cada chamada e limpo no unmount; modal montado só com `quoteContext && quoteModalOpen` (agora `modal !== null`), preservando o reset do estado interno do `QuoteToNoteModal`; limpeza de estado + guarda de StrictMode na carga de grifos.
  - **`setRemovalCandidate(null)` continua no `Reader.tsx`**: o `changeColor` do hook faz só o guard de cor igual + persist; o fechamento do popover ficou num wrapper local (`handleChangeHighlightColor`), porque `removalCandidate` é estado pdf-específico. A ordem original (fecha o popover **antes** do early-return de cor igual) foi mantida.
  - **A limpeza do effect de `book.id` ficou dividida**: `highlights`/`colorFilter` no `useHighlights`; `selection`/`removalCandidate`/busca continuam num effect local com o mesmo `[book.id]`.
  - **Mudança de ordem de effects (avaliada, sem impacto)**: o effect de carga de grifos agora é registrado antes do de carga do documento, porque `useHighlights` é chamado no topo do componente. São duas operações independentes no storage (`SELECT` em `book_highlights` vs. `UPSERT` em `books`), pela mesma conexão cacheada — nenhuma depende da outra.
  - **`lib/bookQuotes.ts` importa de `components/Reader/QuoteToNoteModal`** (`buildQuoteBlock`, `appendQuoteToContent`), já que a restrição era não mexer na assinatura nem mover essas funções. É a mesma direção de dependência que o `useConfirm` já usa (`hooks` → `components`). Quando a decisão do rótulo de posição do EPUB for tomada, provavelmente vale mover essas duas funções puras para o service — fica como follow-up.
  - **Fora de escopo, não tocado** (conforme Task Report): toolbar, painel Summary/Highlights, debounce de página/zoom, controlador de seleção, busca, `pageHighlights`, `findHighlightAtPoint`, assinatura de `buildQuoteBlock` e as funções internas do `QuoteToNoteModal` (`appendToExistingNote`/`createAndSaveNewNote`).
- Validação: `npm run build` (tsc + vite) passou sem erros. Os únicos avisos são os pré-existentes (chunk size e o import dinâmico/estático de `lib/documents.ts`), sem relação com esta alteração. `tsconfig` tem `noUnusedLocals`/`noUnusedParameters` ligados, então o build também confirma que não sobrou import nem símbolo órfão no `Reader.tsx`.

### CodeReviewAgent — 20260807194534
- Summary: Refactor revisado contra o baseline `b7d8d0e`. Os sete edge cases do Task Report estão preservados um a um; as dependências de `useCallback`/`useMemo`/`useEffect` estão corretas e sem closure obsoleta; não há código morto no `Reader.tsx`; `npm run build` passa limpo (só avisos pré-existentes). Confirmei — não só aceitei — a avaliação do `codeAgent` sobre a mudança de ordem dos effects: `TauriStorage.db()` memoiza o `Promise<Database>`, e `SELECT book_highlights` vs. `UPSERT books` são independentes. Sobre o ponto levantado pelo Orquestrador (`lib → components`): a decisão está certa dada a restrição, mas a justificativa ("o `useConfirm` já faz igual") deve ser descartada — os casos não são análogos (hook renderizando componente é a direção esperada; service declarado "sem React" importando de `.tsx` não é) e `bookQuotes.ts` é o único arquivo de `src/lib` que importa de `components`. O custo real não é bundle: é que a promessa de "lógica pura, testável fora do React" não se sustenta (o import puxa `react-dom` e um CSS module), e o follow-up já registrado fecharia um ciclo `QuoteToNoteModal ↔ bookQuotes`. Saída limpa: mover `buildQuoteBlock`/`appendQuoteToContent` verbatim para `src/lib` na mesma alteração em que o rótulo de posição do EPUB for decidido — mover não viola a restrição, que era sobre a *assinatura*. Achado adicional próprio: o comentário de `useHighlights` promete agnosticismo de formato, mas `orderedHighlights` ordena por `page` numérica e o tipo `BookHighlight` exige `page`/`rects` — é o segundo ponto de vazamento do modelo de posição do PDF, e precisa entrar na mesma lista do `p. ${page}`. Nenhum defeito de comportamento encontrado; os quatro achados são `[nit]`.
- Verdict: APROVADO
- Output: `DOCS/reports/07-08-2026/reviewreport_20260807194534.md`

### Orchestrator — encerramento — 20260807194859

- Summary: Review APROVADO, sem defeito de comportamento — os 4 achados são nits. O Orquestrador optou por **não** disparar o `codeAgent` para a passada final: o único achado com ação concreta era um comentário impreciso, corrigido inline, e os demais ou não são acionáveis agora ou seriam desvio de escopo. Gastar uma rodada de agente para reescrever um comentário não se justifica.
- Inputs:
  - `DOCS/reports/07-08-2026/reviewreport_20260807194534.md`
- Ajuste aplicado inline: cabeçalho de `src/hooks/useHighlights.ts`. O comentário dizia "agnóstico de formato", o que o `codereviewAgent` corretamente apontou como promessa maior que a entrega — `orderedHighlights` ordena por `a.page - b.page`. Reescrito para declarar o contrato real: `page` é um ordinal de leitura crescente.
- Correção de severidade (contexto que o `codereviewAgent` não tinha): ele tratou a ordenação por `page` como "segundo ponto onde o modelo de posição do PDF vaza", ao lado do `p. ${page}`. **Os dois casos não são equivalentes.** No desenho acordado, `page` guarda o índice de *location* no EPUB — que também é ordinal crescente em ordem de leitura. Portanto `orderedHighlights` continua correto para EPUB sem nenhuma alteração; o que estava errado era só o comentário. Já o `p. ${page}` do `buildQuoteBlock` é vazamento de verdade, porque renderiza texto visível ao usuário.
- Nits deliberadamente não aplicados:
  - `quoteModalOpen` + `quoteContext` redundantes no `useBookQuotes`: procede, mas o par foi herdado do código original e preservá-lo é o que torna o refactor fiel. Consolidar é mexer em estado recém-validado por ganho cosmético.
  - `appendQuoteToNote` vs. `appendQuoteToContent`: preferência de nomenclatura, sem impacto.
  - `lib → components`: nada a fazer agora. O `codereviewAgent` confirmou a decisão e melhorou a fundamentação (os casos de `useConfirm` e `bookQuotes` **não** são análogos: o hook renderiza um componente, o service se declara sem React e importa de um `.tsx`). A saída limpa — mover `buildQuoteBlock`/`appendQuoteToContent` para `src/lib` — fica para a mesma alteração que decidir o rótulo de posição do EPUB, já que os 3 chamadores serão tocados de qualquer forma.
- Bug pré-existente encontrado fora de escopo, NÃO corrigido: `QuoteToNoteModal.tsx:110-117`. O effect de reset roda em `[open, notebooks.length]`; no caminho "You have no notebooks yet", `handleCreateNotebookFromEmpty` seta `stage: 'new-note-title'` enquanto `notebooks.length` vai de 0→1, e o effect sobrescreve com `'notebook-select'` — o usuário cai na lista em vez do campo de título. Confirmado por leitura do código pelo Orquestrador, **não reproduzido em execução**. Só afeta o primeiro uso do app (zero cadernos), o que explica ter passado despercebido. Merece task própria.
- Next step: concluído. Aguardando o Coordenador para o próximo passo do objetivo maior (suporte a EPUB).

## Decisões em aberto que bloqueiam o EPUB

Consolidadas aqui para quem retomar:

1. ~~**Formato da citação em EPUB.**~~ **DECIDIDO pelo Coordenador em 07-08-2026: capítulo + porcentagem.**

   Consequências a implementar:
   - `buildQuoteBlock` (`QuoteToNoteModal.tsx:70`) troca o parâmetro `page: number` por um `label: string` já formatado. Os 3 chamadores (`Reader.tsx`, e `QuoteToNoteModal.tsx:187` e `:227`) passam a montar o rótulo; no PDF continua `p. ${page}`, mantendo a saída atual byte a byte.
   - **Isto destrava a inversão `lib → components`** apontada pelo `codereviewAgent`: como os 3 chamadores serão tocados de qualquer forma, `buildQuoteBlock` e `appendQuoteToContent` (funções puras de string) devem ser movidas para `src/lib` na MESMA alteração, invertendo a seta de dependência de `lib/bookQuotes.ts`. Uma edição em vez de duas, sem shim de re-export.
   - **Fallback obrigatório:** EPUB sem TOC utilizável cai em só porcentagem.
   - **Ponto em aberto de menor porte** (recomendação do Orquestrador, sujeito a correção do Coordenador): usar o **título do capítulo vindo do TOC**, não um número gerado por nós. O TOC inclui capa, colofão e outros itens de pré-textual, então numerar as entradas nós mesmos faria "cap. 3" cair em coisa que não é o capítulo 3 do livro. Título é o que a própria obra chama aquela seção, e é verificável contra a edição impressa.
   - Custo de runtime é desprezível: as âncoras do TOC são resolvidas uma vez na abertura e cacheadas; "em que capítulo estou" vira busca binária num array (64 entradas no arquivo de teste).

2. **Busca full-text entra na v1 do EPUB?** — AINDA EM ABERTO. Recomendação do Orquestrador: **ficar para a v2**. Não é questão de processamento (no EPUB a extração de texto é mais barata que no PDF); é que nada da implementação atual se aproveita — ela é colada na text layer do pdf.js (`buildJoinedPageText:312`, `findAllOccurrenceRanges:363`, `computeSearchMatchRects:1229`) e a navegação entre ocorrências é por número de página. No EPUB seria busca no DOM real + destaque por CFI: subsistema novo, reaproveitando só a barra de busca.

3. **EPUBs com DRM.** Não abrem por nenhuma biblioteca open source. Definir se basta mensagem de erro clara no import. O arquivo de teste do Coordenador não tem DRM (sem `META-INF/encryption.xml`).

4. ~~**Spike do epubjs.**~~ **CONCLUÍDO em 07-08-2026** — ver `DOCS/reports/07-08-2026/explorerreport_20260807202000.md`. Veredicto: viável. Mudança obrigatória identificada: `blob:` na CSP (sem ela as imagens do EPUB são bloqueadas; o texto renderiza normalmente).
