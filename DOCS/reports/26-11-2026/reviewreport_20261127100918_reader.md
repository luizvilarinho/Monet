# Code Review — Library para línguas: língua por livro, Translate e os leitores

- Branch: `feat/language-study` (sem commit, sobre `43a9ae8`)
- Escopo: `src/lib/language.ts`, `src/lib/languageDetect.ts`, mudanças em `src/lib/books.ts` e `src/lib/epub.ts`, `Library.tsx`/.css, `books.language` em `storage/tauri.ts`, `browser.ts`, `index.ts`, `types/index.ts`; `src/lib/translate.ts`, `LanguageTools/TranslatePopover.tsx`/.css, `LanguageTools/LanguageBar.tsx`/.css; `Reader.tsx`, `EpubReader.tsx` (leitura integral, inclusive voz e vocabulário) e os dois .module.css, `pdfTextLayer.ts`, `src/lib/pageMarks.ts`, `toolbarPlacement.ts`, `useColumnBox.ts`, `ReaderToast.module.css`; `App.tsx`, `SettingsModal.tsx`, `ShortcutsOverlay.tsx`; testes desses arquivos.
- Referências: Task Report `taskreport_20261126233242.md`, Execution Report `executionreport_20261126233242.md` (seção 7 do roteiro), Plano `planreport_20261127000656.md` (Apêndice F), Spec `DOCS/specs/languagestudy.md`.
- Estado: o app nunca rodou; nenhuma tradução real; marcas provadas só no harness. Revisão por leitura de código. Não rodei testes (tsc, `npm test` e `test:rust` já conferidos pelo Orquestrador).

## Pergunta central: livro na língua do usuário, ferramentas desligadas

Com `toolsOn === false` o leitor fica, pelo que li, igual ao de hoje, **desde que a língua do livro seja reconhecida como a nativa**. Conferido:

- Barra de seleção: os botões novos ficam fora; o wrapper `highlightToolbarContents` usa `display: contents` e não há seletor de filho direto (`>`) no CSS da barra que mude com ele.
- Banner, painel lateral (280/300 px, gap) e textos: JSX do caso nativo com o mesmo texto e o mesmo espaçamento.
- "Listen to page", aba Vocabulary, botão do trilho, ensinar no chat (`teacher` opcional, `available: toolsOn`): escondidos; o chip e o `canSend` do chat do leitor não mudam.
- Atalhos: T, V, L só com `toolsOn`; Space e R só com o player aberto (que fecha quando as ferramentas desligam).
- Rede: `useTtsCatalog(enabled)`, `useBookVocabulary(book, enabled)`, `useVocabularyMarks(enabled)` não buscam nada com as ferramentas desligadas.
- Marcas: limpas quando desliga; sem registro de Highlight com tudo desligado.
- Layout: o offset do toast (`--reader-toast-offset`) só existe com o player; `.pageArea` tem `scrollbar-gutter: stable`, então o espaçador do player não muda o zoom Fit.
- Banco: `books.language` por `ensureBooksColumns` → `addMissingColumns` (sem `BEGIN/COMMIT`), `BOOK_COLUMNS` explícito, gravado só no INSERT (o `ON CONFLICT` não apaga), `setBookLanguage` com `scheduleCheckpoint`; `browser.ts` lança "not implemented" como os outros.

As exceções estão nos achados 1 (metadado `und` liga as ferramentas num livro nativo), 4 (setas em `<select>` passam a virar página, só com ferramentas ligadas, então não é regressão do caso nativo) e 11 (primeira abertura mais lenta, uma vez).

---

## Achados

### [importante] 1. Metadado `und`/`mul`/`zxx` liga as ferramentas num livro na língua do usuário

- `src/lib/language.ts:19-23` (`baseLanguage`), `src/lib/epub.ts:206-210` (`detectEpubLanguage`), `src/lib/language.ts:56-66` (`languageToolsOn`).
- Cenário: EPUB em português (usuário `pt`, modo `other`) cujo OPF traz `<dc:language>und</dc:language>`. O Calibre e vários conversores gravam `und` quando a língua não foi preenchida. `baseLanguage('und')` devolve `'und'`, que não é vazio, então `detectEpubLanguage` aceita o metadado e **não** cai na amostra de texto. `languageToolsOn('und', 'pt', 'other')` devolve `true`.
- Resultado: livro nativo abre com barra de língua, "Listen to page", aba Vocabulary e T/V/L ativos, e a Library mostra a língua como "UND" (código que o Intl não conhece volta em maiúsculas). É a regressão que a pergunta central quer evitar, e acontece de saída em livros existentes, na primeira abertura (detecção do F0).
- O mesmo vale para `mul`, `zxx`, `mis` e para qualquer código que não seja língua (`x-…`, lixo de conversor).
- Sugestão: em `baseLanguage` (ou em `detectEpubLanguage`), tratar `und`, `mul`, `zxx`, `mis` e subtags `x`/`i` como não reconhecidas e seguir para `detectLanguage(sample)`. Metadado válido mas errado (por exemplo `en` num livro em português) é caso aceito, resolvido no "Change", e não entra aqui.
- Teste faltando: `language.test.ts` não tem caso `und`.

### [importante] 2. No PDF, clicar no rótulo do rodapé do Translate fecha o popover

- `src/components/LanguageTools/TranslatePopover.tsx:311-313`, com `Reader.tsx:2818` (`onMouseUp={handleTextMouseUp}` no `pageWrap`), `Reader.tsx:1690-1698` e `Reader.tsx:2939-2940` (popover renderizado dentro do `pageWrap`).
- O `onMouseDown` da raiz do popover só deixa de chamar `preventDefault` quando o alvo está dentro de `select, input, textarea, label`. O rodapé é `<label className={styles.languageField}>Book language<select/></label>`, então um mousedown no **texto** do rótulo segue o comportamento padrão: começa uma seleção nova dentro do popover e desfaz a seleção do PDF.
- Cenário: PDF em francês, seleciona uma frase, T, clica em "Book language" (o texto, não a caixa) para trocar a língua. O mouseup do portal borbulha pela árvore do React até `handleTextMouseUp` no `pageWrap`. Com a seleção colapsada, ele faz `setSelection(null)`. O efeito em `Reader.tsx:1357-1359` fecha o Translate quando `!selection`. O popover some; o "Change" fica inutilizável para quem clica no rótulo.
- O mesmo caminho pode valer para o próprio `<select>` em alguns cliques (o WebView2 pode mover o foco e colapsar a seleção do documento). Precisa de conferência no roteiro (itens 2.11/2.12) antes de concluir.
- Sugestão: deixar sem `preventDefault` só `select, input, textarea`, ou parar a propagação do mouseup na raiz do popover (`onMouseUp={(e) => e.stopPropagation()}`), como já foi feito para o clique das marcas (`wrap.contains(e.target)`). O EPUB não tem esse caminho porque a seleção mora no iframe.

### [importante] 3. EPUB: "virar a página pausa" depende do ordinal da location e falha com página maior que uma location ou seleção na location seguinte

- `src/components/Reader/EpubReader.tsx:1210-1214` (pausa por `pageNum`), `EpubReader.tsx:1388-1413` (`handleListen`, `source.page = pageOfCfi(cfiRange)`) e `1418-1445` (`handleListenPage`).
- `pageNum` no EPUB é o ordinal da location do início da tela, não uma página visual.
  - Cenário A: fonte grande, uma coluna. Uma location (cerca de 1.600 caracteres) ocupa mais de uma tela. O usuário toca a frase na tela 1 e avança para a tela 2. A tela 2 ainda começa na mesma location, `pageNum` não muda, o efeito não dispara: o áudio continua tocando com o texto fora de vista e nenhum "Back to" aparece. É o contrário do que o F1.8 pede ("trocar de página pausa").
  - Cenário B: a seleção está no fim da tela e cai na location L+1 (`pageOfCfi` dá L+1) enquanto a tela começa em L. Ao avançar, a nova tela começa em L+1, `source.page === pageNum`, e não pausa; ao voltar, pausa mostrando "Back to p. L+1", que é a tela de onde o usuário acabou de sair.
- Sugestão: no EPUB, identificar a "página" pelo `start.cfi` do `relocated` (ou por um contador de viradas) e não pelo ordinal; para o "Back to", guardar o cfi da tela em que o áudio começou.

### [importante] 4. Seta esquerda/direita num `<select>` também vira a página

- `src/components/Reader/Reader.tsx:1463-1467`, `src/components/Reader/EpubReader.tsx:719-720`.
- O ramo das setas não passa por `plain`, que é onde está a exclusão de `SELECT`. Antes desta entrega não havia `<select>` no leitor; agora há o seletor de língua no rodapé do Translate e o de modelo/voz no menu ⋯ do player (`VoiceModelPicker`).
- Cenário: player aberto, menu ⋯, foco no seletor de voz, seta para a direita para trocar de opção. O select muda **e** o leitor vai para a página seguinte, o que pausa o áudio ("away"). Com Shift, pula frase e vira a página ao mesmo tempo.
- Só aparece com as ferramentas ligadas; não muda o caso nativo.
- Sugestão: sair do handler cedo quando o alvo for `SELECT`/`INPUT`/`TEXTAREA`/`contenteditable`, antes de qualquer ramo.

### [importante] 5. Detecção de língua sem teste para pt, es, it, de, nl nem para a confusão pt × es

- `src/lib/languageDetect.test.ts`: só testa francês e inglês positivos, mais texto curto, símbolos e mistura dando `null`.
- O caso nativo do usuário (PDF em português, sem metadado) depende de `detectLanguage` acertar `pt` para manter as ferramentas desligadas. Se uma amostra em português der `es` (as listas de palavras funcionais das duas línguas se sobrepõem bastante: `de`, `que`, `a`, `o`/`os`, `en`/`em`, `por`, `para`, `con`/`com`), o livro abre com as ferramentas ligadas, que é o achado 1 por outro caminho. Os limiares (`MIN_SCORE 0.12`, `MIN_MARGIN 1.4`) não têm teste que mostre a margem entre as duas.
- Sugestão: um caso positivo por língua suportada e um par pt/es com texto real de cada, conferindo a margem.

### [nit] 6. EPUB: popovers que fecham sozinhos não fecham com clique no texto do livro

- `src/components/Reader/EpubReader.tsx:941-946` (`onEpubViewMouseDown` limpa seleção, remoção e `savedWord`), com os listeners de clique fora no `document` principal (`EpubReader.tsx:1161-1173`), que não recebem eventos do iframe.
- Cenário: abre o Translate de um item da aba Vocabulary (`itemTranslate`) ou o "Translate here" (`hereTranslate`), depois clica no texto do livro. O popover continua aberto sobre a página. O menu ⋯ do player tem o mesmo problema: o Esc e o clique fora são escutados no documento pai.
- Sugestão: limpar também `itemTranslate`/`hereTranslate` no `onEpubViewMouseDown`, e repassar o evento ao menu do player.

### [nit] 7. "Paused: this audio is from p. N" continua depois de voltar à página N

- `MiniPlayer` mostra o aviso enquanto `status === 'paused' && awayFromPage !== null`; `awayFromPage` só é limpo por toggle ou `goTo`.
- Cenário: áudio na p. 5, vai à p. 6 (pausa, aviso), volta à p. 5 com a seta. O aviso "this audio is from p. 5 / Back to p. 5" continua na p. 5. Voltar não retoma sozinho (decisão aceita), mas o texto do aviso fica errado.
- Sugestão: limpar `awayFromPage` quando `pageNum` volta à página da fonte.

### [nit] 8. Clique dentro do Translate sobre um grifo abre o popover de remoção (PDF)

- `src/components/Reader/Reader.tsx:2184-2191`: `findHighlightAtPoint(e.clientX, e.clientY)` roda sem conferir `wrap.contains(e.target)`, ao contrário do ramo das marcas logo abaixo, que já confere (e o comentário explica o motivo: o portal borbulha até aqui).
- Cenário: Translate aberto em cima de um trecho grifado; com a seleção já colapsada (por exemplo, depois do achado 2), um clique no corpo do popover cai em `handlePageClick`, o ponto bate no retângulo do grifo por baixo e abre o "Remove highlight".
- Sugestão: mover o `wrap.contains(e.target)` para o início da função.

### [nit] 9. Confirmação de exclusão perdeu a frase sobre as citações

- `src/components/Library/Library.tsx` (diálogo de excluir livro): o texto passou a ser "…Its vocabulary list and saved audio are deleted too. What you already sent to a note stays in the note." e saiu "Quotes already saved in your notes are kept.". O D.5 pedia para **acrescentar** a frase de vocabulário/áudio. A frase nova cobre parte do sentido ("sent to a note"), mas não fala das citações, que são o caso mais comum.
- Se a troca foi de propósito para encurtar, tudo bem; não achei a decisão registrada.

### [nit] 10. Não dá para selecionar nem copiar o texto da tradução

- `src/components/LanguageTools/TranslatePopover.tsx:311-313`: o `preventDefault` no mousedown de qualquer área fora de campos impede selecionar o texto traduzido e as notas de gramática.
- Cenário: o usuário quer copiar a tradução para colar numa nota à mão. O arrasto não seleciona. O "Send to note" cobre parte disso, mas copiar um trecho fica impossível.
- Sugestão: permitir seleção dentro do corpo da tradução (por exemplo, não prevenir em `[data-selectable]`), com cuidado para não reabrir o achado 2.

### [nit] 11. Primeira abertura de cada livro existente faz a detecção antes da primeira página (EPUB)

- `src/components/Reader/EpubReader.tsx:826-833`: com `book.language === null`, `detectEpubLanguage(handle)` roda antes do `renderTo`. Sem metadado, `sampleEpubText` carrega itens do spine até juntar a amostra. Em EPUB grande, a primeira página demora mais, uma vez por livro.
- Não é defeito de comportamento, só um atraso visível na primeira abertura. Rodar a detecção depois do primeiro `display` resolveria.

### [nit] 12. MiniPlayer abaixo de z-index 1000

- `LanguageTools/MiniPlayer` usa z-index 900 no portal; o menu ⋯ tem 1100, mas dentro do contexto de empilhamento do player, então na prática fica em 900. A regra da casa pede popover acima de 1000. Área do revisor de voz; registro aqui porque o menu abre sobre o leitor.

### [nit] 13. Atalhos de uma tecla não respeitam modal aberto

- `Reader.tsx:1426-1507`, `EpubReader.tsx:680-760`: Space, R, L, T e V são ignorados para `plain === false` e para `SELECT`, mas não quando o foco está num `[aria-modal="true"]` (Settings, confirmação).
- Cenário: player aberto, um modal com o foco num botão, Space. O player alterna em vez de o botão ser acionado.

---

## Divergências com decisões aceitas (não são defeitos)

- **Abrir o perfil de língua tira o usuário do leitor** (`App.tsx`, `handleOpenLanguageProfile`): aceito no roteiro. Mantenho a observação de que, vindo do leitor, o usuário perde a página aberta; a reabertura volta ao último ponto, então o custo é baixo.
- **PDF: palavra dividida em vários spans não casa marcas de vocabulário** (`buildJoinedPageText` junta spans com espaço): limitação que já existia na busca e está no roteiro. Sem divergência, só confirmo que continua.

---

## Avaliação por arquivo

### `src/lib/language.ts`
- Correção: achado 1 (`und`/`mul`/`zxx`). O resto (`pt-BR`/`pt_BR`, ISO 639-2, modos) está correto e testado.
- Simplicidade, Padrões, Organização: ok.
- Efeitos colaterais: `languageName` instancia `Intl.DisplayNames` uma vez, com fallback; ok.

### `src/lib/languageDetect.ts`
- Correção: heurística coerente com o plano; a falta de teste por língua é o achado 5.
- Simplicidade: ok.

### `src/lib/books.ts`, `src/lib/epub.ts`
- Correção: amostra do PDF (p. 3–10) e do EPUB (spine com `unload` no `finally`) corretas; item ilegível é pulado. Achado 1 na escolha do metadado.
- Efeitos colaterais: achado 11.
- `epubLiveRange`, `epubCfiFromRange`, `epubRangeScreenRect`, `epubContextText` (janela de 6.000 caracteres do bloco): corretos pelo que li.

### `src/components/Library/Library.tsx` / .module.css
- Correção: coluna Language, edição por `<select>` (Esc cancela), aviso do import (12 s, Change/Choose, fechar), `handleBookLanguageChange` atualiza a lista e o livro aberto, `saveEdit` só grava se mudou, exclusão chama `ttsClearBook`. Achado 9.
- Padrões: ícones Phosphor, texto em inglês; ok.

### `src/storage/tauri.ts`, `browser.ts`, `index.ts`, `src/types/index.ts` (books)
- Correção, Segurança, Padrões: ok (ver pergunta central). `deleteBook` apaga `book_vocabulary`.

### `src/lib/translate.ts`
- Correção: classificação da seleção, prompt, parse, cache por sessão, listeners antes do `invoke`, abort com `cancelOpenRouterStream`, `no_key`/`failed`. Sem achados.
- Segurança: não lê a chave no front; ok.

### `src/components/LanguageTools/TranslatePopover.tsx` / .css
- Correção: achados 2 e 10. Reposicionamento por `placeFloatingPanel` a cada fase/edição, Esc com `stopPropagation`; ok.
- Padrões: portal, `position: fixed`, z-index 1100; ok.

### `src/components/LanguageTools/LanguageBar.tsx` / .css
- Sem achados (Phosphor, mousedown prevenido para manter a seleção).

### `src/components/Reader/Reader.tsx` / .module.css
- Correção: achados 2, 4, 7, 8, 13. Efeitos de fechar, seguir a leitura, pausar fora da página e reposicionar a barra (`[selection, translateOpen, toolsOn]`) corretos.
- Efeitos colaterais: listeners de janela e documento removidos no cleanup; handlers por ref.
- Organização: o arquivo tem 3.240 linhas; a parte de língua poderia ir para um hook, mas segue o padrão do arquivo.

### `src/components/Reader/EpubReader.tsx` / .module.css
- Correção: achados 3, 4, 6, 11, 13. Cache de marcas por documento (WeakMap), `rendered`/`relocated` reaplicando marcas e limpando `savedWord`/`hereTranslate`, clique com `setTimeout 0` e sequência: ok.

### `src/components/Reader/pdfTextLayer.ts`, `src/lib/pageMarks.ts`, `toolbarPlacement.ts`, `src/hooks/useColumnBox.ts`, `ReaderToast.module.css`
- Funções movidas sem mudança; `rangeToJoinedOffsets` devolve `null` quando a ponta cai fora dos spans (por exemplo `endOfContent`), e quem chama trata. `setPageMarks` usa o `Highlight` da janela certa (iframe). `placeFloatingPanel` cobre abaixo, acima e o lado maior com 4 testes. `useColumnBox` mede por ResizeObserver e resize só enquanto ativo. Sem achados.

### `src/App.tsx`, `SettingsModal.tsx`, `ShortcutsOverlay.tsx`
- Correção: seção `language`, `handleOpenSettingsSection`, `mincerRecording`, `disabledNotebookIds`; grupo "In a book (Library)" com ícones Phosphor de seta. Sem achados além da divergência registrada.

### Testes
- Achado 5 e o caso `und` do achado 1. `translate.test`, `pageMarks.test`, `pdfTextLayer.test`, `toolbarPlacement.test` cobrem bem a lógica; sem teste de componente (decisão aceita).

---

## Bugs extras (no código lido, fora do diff)

- Nenhum novo. A junção de spans com espaço no PDF (busca e marcas) já era conhecida.

## Código morto

- Não encontrei código morto deixado pela entrega nos arquivos da minha área.

## Veredicto

**APROVADO COM RESSALVAS** — o caso do livro na língua do usuário fica igual ao de hoje quando a língua é reconhecida, mas o metadado `und` e a detecção pt × es sem teste podem ligar as ferramentas num livro nativo, e no PDF o rótulo do rodapé do Translate fecha o popover.

Contagem: 0 crítico, 5 importante, 8 nit.

---

### CodeReviewAgent — 20261127100918

- **Summary:** revisão da língua por livro, Translate, leitores PDF/EPUB e casca do app na `feat/language-study`, por leitura de código (app não executado, sem chamadas pagas, sem testes rodados). Caso nativo conferido item a item; 13 achados.
- **Verdict:** APROVADO COM RESSALVAS (0 crítico, 5 importante, 8 nit).
- **Output:** `DOCS/reports/26-11-2026/reviewreport_20261127100918_reader.md`
