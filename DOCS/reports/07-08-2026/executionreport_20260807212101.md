# Execution Report — Suporte a EPUB, Fase A

## Documents

- Task report: `DOCS/reports/07-08-2026/taskreport_20260807211648.md`
- Execution report: `DOCS/reports/07-08-2026/executionreport_20260807212101.md`
- Explorer report (exploração inicial): `DOCS/reports/07-08-2026/explorerreport_20260807180845.md`
- Explorer report (spike de viabilidade): `DOCS/reports/07-08-2026/explorerreport_20260807202000.md`
- Execution report da task anterior (extração service/hook): `DOCS/reports/07-08-2026/executionreport_20260807190451.md`
- Plan report: não gerado
- Review report: `DOCS/reports/07-08-2026/reviewreport_20260807221203.md`

## Sessions

### Orchestrator — abertura — 20260807212101

- Summary: Task Report da Fase A aprovado pelo Coordenador. Esta é a primeira de duas tasks do suporte a EPUB. A Fase A entrega import, banco, tipos e CSP — ao final dela um `.epub` pode ser importado e aparece na Library, mas ainda não abre. A Fase B (`EpubReader.tsx`) vem em task própria.
- Inputs:
  - `DOCS/docs.menu.md`
  - `DOCS/reports/07-08-2026/taskreport_20260807211648.md`
  - `DOCS/reports/07-08-2026/explorerreport_20260807202000.md`
  - `DOCS/reports/07-08-2026/executionreport_20260807190451.md`
- Decision: Pular o `plannerAgent` — o Task Report já traz requisitos numerados, restrições e edge cases fechados, e o spike já eliminou as incógnitas técnicas. Ir direto para o `codeAgent` (Opus 5), seguindo a instrução do Coordenador.
- Justificativa da divisão em duas fases: a Fase A mexe em código existente e validado (storage, tipos, Library, CSP, e o fluxo de citação recém-refatorado), enquanto a Fase B é componente novo. Separadas, uma regressão no leitor de PDF tem causa única e identificável. É a mesma lógica que fez a extração service/hook ser feita antes, e que funcionou.
- Next step: aguardar o `codeAgent`, devolver ao Coordenador para teste, e só então Etapa 2 (revisão).

### CodeAgent — implementação inicial — 20260807214230

- Summary: Fase A entregue por inteiro (requisitos 1 a 10). Um `.epub` pode ser importado, aparece na Library com título/autor do OPF e selo de formato, e abrir mostra aviso de "ainda não disponível". O caminho de PDF (import, abertura, citação) não mudou de comportamento.
- Files changed:
  - `package.json` / `package-lock.json` (pin exato `@likecoin/epubjs` 0.3.93)
  - `src-tauri/src/books.rs`
  - `src-tauri/src/lib.rs` (migration 16)
  - `src-tauri/tauri.conf.json` (CSP)
  - `src/types/index.ts`
  - `src/lib/books.ts`
  - `src/lib/bookQuotes.ts`
  - `src/storage/tauri.ts`
  - `src/hooks/useBookQuotes.ts`
  - `src/components/Reader/QuoteToNoteModal.tsx`
  - `src/components/Reader/Reader.tsx`
  - `src/components/Library/Library.tsx`
  - `src/components/Library/Library.module.css`
- Files created:
  - `src/lib/epub.ts`
- Files removed:
  - nenhum
- Left behind: ver "Registrado, não feito" abaixo.

#### Validação executada

`npm run build` sem erros (tsc + vite) e `cargo check` limpo.

O caminho de EPUB foi exercitado **sem GUI**, em Chrome headless real (mesmo motor do WebView2) sobre `src/lib/epub.ts` de verdade, servido pelo Vite — o mesmo método do spike, e pelo mesmo motivo: em Node o epubjs cairia no `@xmldom/xmldom` em vez do `DOMParser` nativo e o teste mediria outro código. Quatro fixtures, derivadas do `Fausto_Edição_Especial_de_216_Anos.epub`:

| Fixture | Resultado |
| --- | --- |
| EPUB íntegro | OK — `Fausto - Série Ouro` / `Johann Wolfgand Von Goethe`, **355 locations**, 29.618 B de `locationsJson`, 243 ms |
| EPUB com ofuscação de fonte (IDPF) | OK — idêntico ao íntegro (não é DRM) |
| EPUB com DRM (AES-256-CBC) | rejeita com `EpubDrmException` → mensagem de DRM + rollback |
| EPUB corrompido (zip truncado) | rejeita com `Corrupted zip: can't find end of central directory` → mensagem de corrompido + rollback |

355 locations e ~28,9 KB batem exatamente com o spike. Zero erros de console. As fixtures e a página de verificação foram removidas do repositório.

Paridade do PDF conferida por leitura de diff: `buildQuoteBlock` monta `` `— *${bookTitle}*, ${label}` `` e o PDF passa `label = "p. 47"` — saída byte a byte igual à anterior. `books_read_file`/`books_delete_file` validam por diretório (prefixo + canonicalize), nunca por extensão, então seguem funcionando com `.epub`.

#### Decisões tomadas dentro do escopo

1. **DRM não é "encryption.xml existe"** — o mesmo arquivo carrega os dois esquemas padrão de *ofuscação de fonte* (IDPF `2008/embedding` e Adobe `pdf/enc#RC`), comuns em livros de editora, que **não** impedem a leitura. O Task Report equipara os dois casos; a checagem implementada olha o `Algorithm` de cada `EncryptionMethod` e só acusa DRM quando há algum fora dessa lista. Sem isso, livros legítimos seriam recusados no import. XML ilegível ou sem método declarado é tratado como DRM (conservador).
2. **`new Book()` + `book.open()` em vez de `ePub(data)`** — o construtor do epubjs *engole* o erro de abertura (só emite evento), e com ele um arquivo corrompido deixaria a promise pendurada para sempre em vez de rejeitar. Idem para `book.ready`/`book.opened`: ambos podem nunca resolver (navegação ou `replacements` que falham não rejeitam, apenas não resolvem). Só `open()` é aguardado.
3. **`{ replacements: 'none' }` no open do import** — o epubjs cria blob URL de *todos* os assets ao abrir um arquivo compactado, o que só serve para renderizar (Fase B). Medido: resultado idêntico (mesmo título/autor, mesmas 355 locations) e os 4 erros de console do epubjs desaparecem. Atende diretamente ao edge case "o import não pode parecer travado".
4. **`ReaderProps.book` passou a ser `PdfBook`** — é o que faz o compilador garantir que um EPUB não chega ao leitor de PDF; a Library narrowa em `openReader`, na retomada via `localStorage` e no `handleBookChange`. Mudança só de tipo, nenhuma de comportamento.
5. **`openEpub` ficou privado** em `lib/epub.ts` (só `extractEpubInfo` é exportado): exportá-lo agora seria export sem consumidor. A Fase B exporta quando for renderizar.

#### Registrado, não feito (fora do escopo desta task)

- **`book_highlights.cfi` não é lido nem gravado.** A coluna foi criada (requisito 3), mas o requisito 7 limita o storage a `rowToBook`/`saveBook`. Como nenhum grifo de EPUB pode existir sem o leitor, nada se perde; o mapeamento (`BookHighlight.cfi`, `rowToHighlight`, `saveHighlight`) é da Fase B.
- **`blob:` em `default-src` também habilita `worker-src`.** `worker-src` não tem valor próprio e cai em `child-src` → `default-src`, então `new Worker(blobUrl)` passou a ser permitido — `script-src` não cobre workers. Na prática não abre caminho para EPUB de terceiro (o iframe do epubjs é sandbox **sem** `allow-scripts`, confirmado no spike), mas a CSP ficou uma nuance mais larga do que "script-src não recebe `blob:`" sugere. Se incomodar, um `worker-src 'self'` explícito fecha sem afetar nada.
- **Peso do bundle: +356 KB brutos / +107 KB gzip** (1.887 KB → 2.242 KB). É o epubjs com jszip, lodash, core-js, localforage e o `@xmldom/xmldom` que fica no bundle sem rodar. Esperado e inerente à escolha da lib.
- **Coluna `pages` da Library mostra nº de locations para EPUB**, sob um cabeçalho que diz "pages". Consistente com a decisão "`page` é ordinal de leitura nos dois formatos", mas o rótulo pode confundir. Não mexi — mudar cabeçalho de tabela não estava no requisito 9.

## Decisões fechadas que valem para esta task

Consolidadas de `executionreport_20260807190451.md` e da discussão com o Coordenador. **Não reabrir:**

1. **Tabela única** para os dois formatos, só `ADD COLUMN` — sem tabela separada por formato, sem rebuild.
2. **`page` é ordinal de leitura nos dois formatos**: página no PDF, índice de *location* no EPUB.
3. **Reader separado na Fase B**; `Reader.tsx` (PDF) permanece intacto. Sem extração de shell.
4. **Citação em EPUB = nome do capítulo (vindo do TOC) + porcentagem.** Nunca um número de capítulo gerado por nós — o TOC inclui capa e pré-textual, e numerar por conta faria "cap. 3" cair em item errado. Fallback: só porcentagem.
5. **Busca full-text fica fora** do EPUB (v2). Não é decisão de performance — no EPUB a extração de texto é mais barata que no PDF; é que nada da implementação atual se aproveita.
6. **Conversão EPUB→PDF descartada** — o usuário já pode converter por fora; não adiciona capacidade que valha código nosso.

## Pendências herdadas, endereçadas nesta task

- **Inversão `lib → components`** (achado do `codereviewAgent` na task anterior): `src/lib/bookQuotes.ts` é hoje o único arquivo de `src/lib` que importa de `components`. O requisito 8 resolve, movendo `buildQuoteBlock`/`appendQuoteToContent` para `src/lib` na mesma alteração que troca a assinatura para `label: string`.

## Pendências NÃO endereçadas aqui (task própria)

- **Bug pré-existente no `QuoteToNoteModal.tsx:110-117`**: o effect de reset roda em `[open, notebooks.length]`; no caminho "You have no notebooks yet", criar o primeiro caderno joga o usuário para a lista em vez do campo de título. Confirmado por leitura, não reproduzido em execução.
- **Advisory do `pdfjs-dist`**: *"Arbitrary JavaScript execution upon opening a malicious PDF"*, faixa `>=5.6.83 <6.2.108`; o projeto está em `^5.6.205`, dentro da faixa. Afeta o leitor de PDF já em produção. Correção é subir para `>=6.2.108` (major).

### Orchestrator — decisão — 20260807215527

- Summary: Coordenador testou e confirmou os dois lados. **EPUB**: o Fausto importou e aparece na Library como `epub / Fausto - Série Ouro / Johann Wolfgand Von Goethe / 355 / — / 07/08/2026 / Never`. **PDF**: import, abertura e citação continuam idênticos, nos dois caminhos (com e sem nota vinculada).
- Verificação independente do Orquestrador antes do repasse:
  - Paridade da citação: `Reader.tsx:57` monta `p. ${page}` e passa nos 3 call sites; `buildQuoteBlock` interpola `${label}` exatamente onde antes havia `p. ${page}`.
  - Inversão `lib → components`: resolvida (grep confirma que nenhum arquivo de `src/lib` importa de `components`).
  - CSP: `blob:` presente em `default-src`/`style-src`/`img-src`/`font-src` + `frame-src 'self' blob:`, com `script-src` intocado.
  - Migration 16 presente; pin de `@likecoin/epubjs` exato em `0.3.93`.
- **Confirmação cruzada relevante:** as 355 locations batem exatamente com a medição do spike, feita em execução independente. Isso demonstra que a geração é determinística — que é a premissa que torna seguro cachear `locations_json` e reusar entre sessões. Se variasse, as posições salvas derivariam e os grifos de EPUB apontariam para o lugar errado com o tempo.
- Sobre a decisão de DRM do `codeAgent`: ele **contrariou a letra do Task Report e estava certo**. A especificação equiparava DRM a "`encryption.xml` existe", o que teria recusado no import EPUBs legítimos de editora que usam ofuscação de fonte. Os dois algoritmos permitidos foram conferidos pelo Orquestrador e a lógica conservadora (XML ilegível → trata como DRM) está adequada. Fica registrado como erro da especificação, não do executor.
- Decision: Etapa 1 encerrada. Seguir para a Etapa 2 (revisão) com `codereviewAgent` em Opus 5.
- Next step: aguardar o `reviewreport`, atualizar `## Documents` e decidir a passada final.

### CodeReviewAgent — 20260807221203

- Summary: Fase A cumpre os 10 requisitos e o leitor de PDF não regrediu — citação byte a byte idêntica, união discriminada sem nenhum cast que a derrote, migration 16 correta e tolerante a linhas antigas, rollback do import íntegro. Dois achados `[importante]`, ambos no import de EPUB: (1) `locations.generate()` custa ~110 ms por item de spine por causa do `pause = 100` default do epubjs — medido 13,3 s num EPUB de 120 seções contra 249 ms num de 2 seções com o mesmo texto (o arquivo do spike tinha spine de 2, por isso os 175 ms não generalizam); correção verificada em uma linha (`book.locations.pause = 0` → 2,0 s, com `locations.save()` byte a byte idêntico, determinismo preservado); (2) `extractEpubInfo` sem timeout — se o epubjs não settlar, o `catch` de `importBook` nunca roda, não há rollback e o botão fica preso em "Importing…" até reiniciar o app. Mais 7 nits. `npm run build` e `cargo check` limpos nesta review.
- **Questão aberta do `worker-src` — respondida com medição: a observação do `codeAgent` está incorreta e nenhuma correção é necessária.** A cadeia de fallback é `worker-src → child-src → script-src → default-src` (passa por `script-src`, não vai direto ao `default-src`), e como `script-src 'self' 'wasm-unsafe-eval'` é explícito e não tem `blob:`, a resolução para nele. Medido em Chrome headless real: a CSP nova bloqueia `new Worker(blob:)` exatamente como a antiga, e a variante com `worker-src 'self'` se comporta igual. Dois controles provam o mecanismo (sem `script-src` → libera; com `child-src blob:` → libera o blob e bloqueia o same-origin). O pdf.js também não seria afetado por um `worker-src 'self'`: o worker é asset same-origin (`/assets/pdf.worker.min-*.mjs`) e o wrapper `blob:` do pdf.js só entra em cena para workerSrc cross-origin. Tabela completa no reviewreport.
- Verdict: APROVADO COM RESSALVAS
- Output: `DOCS/reports/07-08-2026/reviewreport_20260807221203.md`

### Orchestrator — decisão — 20260807222900

- Summary: Review recebida (APROVADO COM RESSALVAS). Coordenador autorizou corrigir os dois achados `[importante]`. Seção `## Documents` atualizada com o path do review.
- Correções que o Orquestrador precisou fazer no próprio registro anterior:
  1. **O "≈175 ms" do `locations.generate()` reportado no spike é enganoso.** Confirmado no fonte: `locations.js:17` (`this.pause = pause || 100`), `book.js:143` (constrói sem pause) e `locations.js:88` (`setTimeout(..., this.pause)` por seção) — são 100 ms de sono POR ITEM DE SPINE. O arquivo do spike tem spine de 2 itens; um EPUB normal tem 50–150 seções. Erro de raciocínio do Orquestrador: a atipicidade do arquivo (livro inteiro num XHTML) foi corretamente usada para argumentar "bom pior caso de render", mas era o **melhor caso possível** para locations, e essa inversão passou batida.
  2. **A observação do `codeAgent` sobre `worker-src` estava incorreta**, e foi repassada ao Coordenador como preocupação legítima. A cadeia real é `worker-src → child-src → script-src → default-src`: passa por `script-src`, que é explícito e sem `blob:`, então a resolução para ali. `blob:` em `default-src` não alargou `worker-src`. O `codereviewAgent` demonstrou com 5 variantes de CSP medidas e dois controles. **Nenhuma alteração de CSP é necessária.**
- Decision: disparar o `codeAgent` (Opus 5) para a passada final única, com os dois achados `[importante]` e liberdade para julgar os 7 nits.
- Next step: encerramento após a passada final.

### CodeAgent — ajuste final — 20260807232411

- Summary: Corrigidos os dois achados `[importante]` do review, na ordem exigida (performance primeiro, timeout dimensionado depois). `locations.generate()` deixou de dormir 100 ms por item de spine — 13,3 s → 2,0 s num EPUB de 120 seções, com `locations.save()` **byte a byte idêntico** (SHA-256 + nº de bytes conferidos). `extractEpubInfo` ganhou teto de 60 s, dimensionado por medição, que rejeita com erro nomeado e cai no rollback já existente. Mais 2 nits aplicados (3 e 5); 5 nits recusados com justificativa abaixo.
- Files changed:
  - `src/lib/epub.ts`
  - `src/lib/books.ts`
  - `src/lib/bookQuotes.ts`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind: ver "Nits recusados" e "Registrado, não feito" abaixo.

#### Achado 1 — `pause` do `Locations`

`;(book.locations as unknown as { pause: number }).pause = 0` antes do `generate()`. O cast é necessário porque `pause` existe só no runtime (`locations.js:30`); o `.d.ts` da lib não declara o campo. É o único cast do caminho de livros e está comentado com o motivo.

**Medido** em Chrome headless real (mesmo motor do WebView2), sobre o `src/lib/epub.ts` de verdade bundlado por esbuild — em Node o epubjs cairia no `@xmldom/xmldom` e mediria outro código. Fixtures derivadas do `Fausto`, variando **só** a divisão do spine (mesmo texto total):

| Fixture | Seções de spine | Antes | Depois | locations | `save()` |
| --- | --- | --- | --- | --- | --- |
| `spine2` | 1 | 247 ms | **128 ms** | 355 → 355 | idêntico |
| `spine120` | 119 | 13.285 ms | **1.997 ms** | 412 → 412 | idêntico |
| `spine400-big` | 395 | 44.826 ms | **6.830 ms** | 1.648 → 1.648 | idêntico |
| `Fausto` (arquivo real) | 1 | — | **99 ms** | 355 | 29.618 B |

O baseline reproduz a medição do `codereviewAgent` (247 vs. 249 ms; 13.285 vs. 13.309 ms), o que valida o método.

**Determinismo confirmado, não só afirmado:** comparação de SHA-256 **e** do nº de bytes do `locations.save()` entre a execução com `pause = 100` e a com `pause = 0`, nas três fixtures — idêntico nas três. E o `Fausto` real devolve as mesmas **355 locations / 29.618 B** do spike e da implementação inicial, então **o `locations_json` já gravado no banco do Coordenador continua válido** — a correção não invalida cache existente.

#### Achado 2 — timeout do `extractEpubInfo`

`extractEpubInfo` virou um envelope com `Promise.race` em volta de `readEpubInfo` (o corpo anterior, agora privado). O teto cobre o `openEpub` inteiro também — `book.open()` passa pelo mesmo `Archive.request` sem `.catch`, então limitar só o `generate()` deixaria metade do buraco aberto.

Rejeita com `EPUB_TIMEOUT_ERROR_NAME` (`EpubTimeoutException`), espelhando o `EPUB_DRM_ERROR_NAME` já existente: `lib/epub.ts` identifica a causa, `importBook` decide a mensagem — *"This EPUB took too long to read and was not imported."*. Assim a falha entra no `catch` de `importBook` → rollback da cópia → `finally` do `handleImport` → `setImporting(false)`. `clearTimeout` no `finally` para não deixar timer de 60 s pendurado num import bem-sucedido.

**60 s foi dimensionado por medição, não por chute**, e só depois da correção do achado 1:

| Caso | Seções | Tempo (pós-correção) | Folga até 60 s |
| --- | --- | --- | --- |
| EPUB normal de editora | 119 | 2,0 s | 30x |
| Coletânea grande (1,7 MB) | 395 | 6,8 s | 8,8x |
| Extremo (10x o texto de um clássico completo, 3,8 MB) | 1.268 | 21,9 s | 2,7x |

O caso extremo é deliberadamente absurdo (dez volumes num arquivo só) e ainda cabe com folga de 2,7x — sobra margem até para uma máquina 2x mais lenta que a de teste. Antes da correção, esse mesmo arquivo levaria ~140 s e o timeout dispararia num livro legítimo, que é exatamente o motivo de a ordem dos dois achados importar.

#### Validação executada

`npm run build` limpo (bundle 2.242,79 KB — sem mudança de peso) e `cargo check` limpo (nenhum arquivo Rust tocado nesta passada).

Caminhos de erro re-exercitados em Chrome headless após a reestruturação do `openEpub`:

| Caso | Resultado |
| --- | --- |
| EPUB íntegro (119 seções) | OK — `Fausto - Série Ouro`, 412 locations, 1.995 ms |
| Ofuscação de fonte IDPF | OK — idêntico ao íntegro (corretamente **não** tratado como DRM) |
| DRM (AES-256-CBC) | rejeita `EpubDrmException` em 4 ms |
| Zip corrompido (truncado) | rejeita `Corrupted zip: can't find end of central directory` em 2 ms |
| Timeout (bundle-gêmeo com teto de 50 ms) | rejeita `EpubTimeoutException` em 51 ms |

Zero unhandled rejections, inclusive no caso do timeout — o `Promise.race` já tem handler anexado na promise perdedora, então a rejeição tardia do `readEpubInfo` não vaza.

Todas as fixtures, bundles e páginas de teste ficaram fora do repositório (diretório de scratchpad). `git status` ao final tem exatamente o mesmo conjunto de arquivos do início da passada.

#### Nits aplicados

- **Nit 3** (`openEpub` não destruía o book quando `getText` falhava): o `try/catch` agora cobre `open()` + `getText` + checagem de DRM, com um único ponto de `destroy()`. Fecha mais do que o achado pedia — o caminho de zip corrompido (`book.open()` rejeitando) também vazava o book, e não estava no relatório.
- **Nit 5** (comentário desatualizado em `bookQuotes.ts:82-84`): reescrito, a seta de dependência agora está descrita na direção certa.
- **Extra, não estava no review:** o comentário do `LOCATION_CHARS` citava o "≈175 ms → 355 locations" do spike — justamente o número que o próprio achado 1 desmentiu. Reescrito para registrar que o custo acompanha o nº de itens de spine, não o tamanho do arquivo. Deixar a medição enganosa no código seria plantar a mesma armadilha para a Fase B.

#### Nits recusados

- **Nit 4** (`locations_json = COALESCE(...)` no `saveBook`) — **não feito de propósito.** Não é bug hoje: nenhum chamador passa null para um EPUB já gravado, e o próprio revisor recomenda fazer junto com a Fase B, "quando o footgun deixa de ser teórico". Aplicar agora criaria uma semântica de storage que nenhum código desta fase exercita, e a Fase B pode muito bem gravar posição por um caminho dedicado em vez do `saveBook` inteiro — aí o `COALESCE` seria sobra. **Fica registrado como pré-requisito da Fase B:** antes de o `EpubReader` chamar `saveBook` a cada troca de posição, trocar `locations_json = excluded.locations_json` por `locations_json = COALESCE(excluded.locations_json, locations_json)` em `src/storage/tauri.ts:551`. O `cfi` deve continuar sobrescrevendo.
- **Nit 6** (contar `EncryptedData` sem `EncryptionMethod`) — não feito. Fecharia uma brecha teórica que, pelo próprio texto do review, nenhum esquema de DRM real explora ("nenhum esquema de DRM real omite o algoritmo"), e o custo de errar é assimétrico: um falso positivo **recusa um livro legítimo no import**, que é exatamente o modo de falha que a decisão 1 da implementação inicial existiu para evitar. O default conservador atual (nenhum método declarado → trata como DRM) já cobre o caso ambíguo de verdade.
- **Nit 7** (ordem da checagem de DRM) — não feito. O próprio review conclui que ADEPT, LCP e FairPlay deixam `container.xml` e OPF em claro e que a ordem atual é a pragmática, já que é o epubjs que abre o zip. Inverter exigiria abrir o zip por fora do epubjs só para essa checagem.
- **Nit 8** (aviso de "EPUB ainda não disponível" no banner de erro) — não feito. É o ponto mais fraco do requisito 9 e o (b) é real (numa lista longa, clicar num EPUB lá embaixo pode não produzir nada visível na viewport), mas o caso **deixa de existir na Fase B**, quando o EPUB abre. Investir estilo novo agora é trabalho que a próxima task apaga. Registrado para quem fizer a Fase B remover o ramo inteiro em vez de estilizá-lo.
- **Nit 9** (`buildQuoteBlock` com `label` vazio) — não feito. Impossível nos dois formatos: `p. ${page}` nunca é vazio e o fallback previsto para EPUB ("só porcentagem") também não. Guarda para um caso que não existe.

#### Fora de escopo, identificado nesta passada

- **`storage.saveBook(book)` está fora do `try` do `importBook`** (já apontado pelo review): uma falha de banco deixa o arquivo em `books/` sem registro. É pré-existente e idêntico no caminho do PDF, então não é regressão desta task — mas o rollback só cobre metade do fluxo. Não mexi: mudar isso altera o caminho de import do PDF, e o critério de aceite nº 1 é o PDF não regredir.
- Os dois bugs de unhandled rejection **do epubjs** (spine quebrado em `locations.js`, `loadNavigation` sem `.catch` em `book.js:489`) seguem sem ação: são da lib, e o timeout novo não os cobre porque neles o `generate()` resolve — só com locations parciais. Um EPUB com item de spine ausente do zip importa com `totalPages` menor que o real, silenciosamente. Vale como candidato a task própria, não como ajuste desta.

### Orchestrator — encerramento — 20260807232500

- Summary: Fase A concluída. Passada final aplicou os dois achados `[importante]` do review, mais 3 nits. Orquestrador conferiu `src/lib/epub.ts` linha a linha, o `git status` (nenhum artefato de teste no repo) e rodou `npm run build` (limpo).
- Inputs:
  - `DOCS/reports/07-08-2026/reviewreport_20260807221203.md`
- Estado da entrega: import de EPUB funcionando com metadados, locations e detecção de DRM; leitor de PDF sem regressão; CSP ajustada; migration 16 aplicada; união discriminada protegendo em tempo de compilação.

#### Pendência que o Orquestrador destaca para a Fase B

**Locations parciais silenciosas.** Registrado pelo `codeAgent` e confirmado pelo Orquestrador: quando um item de spine está declarado no OPF mas ausente do zip, o `generate()` do epubjs **resolve mesmo assim**, com locations parciais. O EPUB importa com `totalPages` menor que o real, sem erro nenhum — e o valor errado é cacheado em `locations_json`, persistindo entre sessões.

Não é regressão desta task e não bloqueia a Fase A (que só importa). Mas é o único ponto do sistema onde um dado errado entra em silêncio e fica, e **a Fase B constrói posição e grifos em cima dele**: progresso exibido errado e ordinais de grifo deslocados. Recomendação: tratar antes ou junto do `EpubReader`, com uma checagem de sanidade que compare os itens de spine processados com os declarados e transforme o caso em erro claro de import, em vez de importação silenciosamente truncada.

#### Demais pendências herdadas (task própria, sem urgência)

- `locations_json` no `saveBook`: trocar para `COALESCE(excluded.locations_json, locations_json)` em `src/storage/tauri.ts:551` **antes** de o `EpubReader` chamar `saveBook` a cada troca de posição. O `cfi` deve continuar sobrescrevendo. Pré-requisito explícito da Fase B.
- `book_highlights.cfi` criada mas ainda não mapeada — Fase B.
- `storage.saveBook` fora do `try` do `importBook`: pré-existente e idêntico no caminho do PDF; o rollback cobre só metade do fluxo.
- Bug pré-existente no `QuoteToNoteModal.tsx:110-117` (primeiro caderno joga o usuário para a lista em vez do campo de título).
- Advisory do `pdfjs-dist` (execução arbitrária de JS ao abrir PDF malicioso, faixa `>=5.6.83 <6.2.108`; projeto em `^5.6.205`) — afeta o leitor já em produção.
- Coluna "pages" da Library exibe nº de locations para EPUB sob cabeçalho "pages".

- Next step: concluído. Aguardando o Coordenador para a Fase B (`EpubReader.tsx`).
