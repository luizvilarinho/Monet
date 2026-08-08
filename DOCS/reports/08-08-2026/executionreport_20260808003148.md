# Execution Report — Suporte a EPUB, Fase B1 (leitura)

## Documents

- Task report: `DOCS/reports/08-08-2026/taskreport_20260808002400.md`
- Execution report: `DOCS/reports/08-08-2026/executionreport_20260808003148.md`
- Explorer report (exploração inicial): `DOCS/reports/07-08-2026/explorerreport_20260807180845.md`
- Explorer report (spike de viabilidade): `DOCS/reports/07-08-2026/explorerreport_20260807202000.md`
- Execution report da Fase A: `DOCS/reports/07-08-2026/executionreport_20260807212101.md`
- Review report da Fase A: `DOCS/reports/07-08-2026/reviewreport_20260807221203.md`
- Plan report: não gerado
- Review report: não gerado

## Sessions

### Orchestrator — abertura — 20260808003148

- Summary: Coordenador aprovou dividir a Fase B em duas e mandou seguir com a B1. Esta task entrega **leitura de EPUB**: abrir, navegar, retomar a posição, sumário navegável e tamanho de fonte. Grifos, citação, chat e painel de notas ficam para a B2.
- Inputs:
  - `DOCS/docs.menu.md`
  - `DOCS/reports/08-08-2026/taskreport_20260808002400.md`
  - `DOCS/reports/07-08-2026/explorerreport_20260807202000.md`
  - `DOCS/reports/07-08-2026/executionreport_20260807212101.md`
- Decision: Pular o `plannerAgent` — o Task Report traz requisitos numerados, restrições e edge cases fechados, e o spike já eliminou as incógnitas de viabilidade. Ir direto para o `codeAgent` (Opus 5).
- Justificativa do corte B1/B2: ao fim da B1 dá para ler um EPUB de verdade — entrega testável e útil sozinha, diferente da Fase A. E o corte separa as duas direções do TOC: a B1 usa a **fácil** (clicar no sumário → navegar), enquanto a B2 precisa da **inversa** (posição → qual capítulo), que é a cara e alimenta a citação. Isolando, um problema na parte nova não trava a leitura básica.
- Next step: aguardar o `codeAgent`, devolver ao Coordenador para teste, e só então Etapa 2 (revisão).

## Dívidas da Fase A puxadas para dentro desta task

Registradas no encerramento da Fase A e agora com requisito próprio:

1. **`COALESCE` no `saveBook`** (`src/storage/tauri.ts:551`) — requisito 8. Deixa de ser teórico exatamente nesta task: a B1 é a que passa a chamar `saveBook` a cada troca de posição, e sem o `COALESCE` cada movimento apagaria o cache de `locations_json`.
2. **Checagem de locations parciais** (`src/lib/epub.ts`) — requisito 9. Spine declarado no OPF mas ausente do zip faz o `generate()` resolver com locations parciais; o livro importa com `totalPages` menor que o real, em silêncio, e o valor errado fica cacheado. A B1 constrói a posição em cima desse número.

## O que o spike NÃO cobre (verificar empiricamente nesta task)

O spike mediu render, paginação, grifo por CFI, locations e sandbox. **Não** exercitou:

- Repaginação ao redimensionar a janela, e preservação da posição através dela. É o edge case de maior risco desta task: reflow é o que diferencia EPUB de PDF, e **não há precedente no `Reader.tsx` para copiar**, porque o problema não existe em PDF.
- Mudança de tamanho de fonte (e seu efeito sobre a posição atual, que é o mesmo problema do resize).
- Restauração de posição por `rendition.display(cfi)`.
- Navegação por href do TOC.

## Decisões fechadas que valem para esta task

**Não reabrir:**

1. **Reader separado**: `Reader.tsx` (PDF) permanece intacto; nada de extrair shell compartilhada. Duplicar toolbar e painel lateral é o resultado esperado, não defeito. A costura só será extraída quando existir evidência de onde ela está — e essa evidência exige os dois leitores prontos.
2. **`page` é ordinal de leitura nos dois formatos**: página no PDF, índice de *location* no EPUB.
3. **Tabela única** para os dois formatos.
4. **Busca full-text fora** do EPUB (v2) — o botão Search não deve existir no leitor de EPUB.
5. **Citação = capítulo (do TOC) + porcentagem** — implementação é da B2; a assinatura `label: string` já está pronta desde a Fase A.

### CodeAgent — implementação inicial — 20260808014500

- Summary: Fase B1 entregue por inteiro (requisitos 1 a 10). Clicar num EPUB na Library abre um leitor funcional: renderiza, navega por botões/setas, retoma pelo `cfi` salvo, repagina preservando a posição ao redimensionar, tem sumário navegável e controle de tamanho de fonte persistido. Sem grifo, citação, chat, painel de notas ou busca — nenhum botão inerte para eles. `Reader.tsx` e `Reader.module.css` intocados.
- Files changed:
  - `src/lib/epub.ts`
  - `src/storage/tauri.ts`
  - `src/components/Library/Library.tsx`
- Files created:
  - `src/components/Reader/EpubReader.tsx`
  - `src/components/Reader/EpubReader.module.css`
- Files removed:
  - nenhum
- Left behind: ver "Registrado, não feito" abaixo.

#### Validação executada

`npm run build` limpo (tsc + vite; bundle 2.242,79 → 2.252,84 KB, +10 KB do componente novo) e `cargo check` limpo (nenhum arquivo Rust tocado).

O caminho de EPUB foi exercitado **sem GUI**, em Chrome headless real sobre o `src/lib/epub.ts` de verdade bundlado por esbuild — mesmo método das fases anteriores, e pelo mesmo motivo (em Node o epubjs cairia no `@xmldom/xmldom`). Fixtures: o `Fausto_Edição_Especial_de_216_Anos.epub` do Coordenador e uma variante dele com um `<itemref>` fantasma no OPF. A página de teste replica o layout do `EpubReader.module.css` (incluindo a coluna lateral) e aplica a CSP de produção via `<meta>`. Tudo em scratchpad; `git status` ao final tem só os arquivos previstos.

Paridade do PDF conferida por leitura de diff: nenhuma linha de `Reader.tsx`/`Reader.module.css` tocada nesta passada, `importBook` inalterado, e o único ponto compartilhado (`saveBook`) mudou só na cláusula de `locations_json`, que é NULL para todo PDF — `COALESCE(NULL, NULL)` = NULL, mesmo resultado de antes.

#### Os quatro pontos sem cobertura do spike — agora medidos

| Ponto | Resultado |
| --- | --- |
| **Repaginação ao redimensionar** | **Funciona, e o epubjs reposiciona sozinho.** Container 396→504 px: colunas 1125→936 (repaginou de verdade) e a location ficou em 177 (0,5%→0,5%), pelos DOIS caminhos — o listener de window do próprio epubjs e o `ResizeObserver` do `EpubReader`. **Controle decisivo:** mudar a largura SEM avisar o epubjs (632→252 px) desloca o leitor de 177 para 196 (+5,4% do livro) — é o que prova que a notificação é necessária, não decorativa. |
| **Mudança de tamanho de fonte** | **O epubjs NÃO resolve sozinho** — e o estrago é grande. Só `themes.fontSize('150%')`: location 177 → 81, **−96 locations (−27% do livro)**. Com o reposicionamento que o `EpubReader` faz, drift 0. |
| **Restauração por `rendition.display(cfi)`** | **Funciona, mas exige duas passadas.** Numa das execuções a primeira passada caiu **22 locations (~6%) antes** do ponto salvo, reprodutível 4/4; a segunda passada acertou exatamente, 4/4. |
| **Navegação por href do TOC** | **Funciona, inclusive por fragmento.** 64 entradas, todas resolvíveis; alvos em 25%, 37% e 98,6% do livro, 42–86 ms. |

#### Achado que mudou a implementação: uma passada de `display` pode não chegar ao alvo

O `moveTo` do epubjs clampa o destino contra `container.scrollWidth`; quando o iframe ainda não terminou de expandir, o alvo é cortado e o leitor para **antes** do ponto pedido. Medido com passadas isoladas:

| Ação | 1ª passada | 2ª passada (imediata) | 3ª passada (após 300 ms) |
| --- | --- | --- | --- |
| fonte → 190% | **−108 locations (−30%)** | **0** | 0 |
| fonte → 140% | −5 | −1 | −1 |
| fonte → 80% / 100% | 0 | 0 | 0 |
| retomada por `cfi` | −22 (numa execução), 0 (noutra) | **0** | 0 |

Duas conclusões: a segunda passada é o que resolve, e **esperar não ajuda** (a 3ª passada nunca melhorou a 2ª). Daí o `displayAt`, com as duas chamadas em sequência — usado na retomada, na mudança de fonte e na navegação do sumário. A segunda chamada é barata: com a seção já montada, o epubjs só reposiciona o scroll.

#### Bug encontrado no próprio CSS, pelo teste

`.pageArea` sem `min-width: 0` **não encolhe**: com a janela estreitando, a área de leitura transbordava em vez de repaginar (medido: `#reader` em 640 px com `#pageArea` teimando em 908 px). O leitor de PDF não sofre disso porque lá a área tem `overflow: auto`, que já cria contexto de scroll. Corrigido com `min-width: 0` + `overflow: hidden`, e **é essa correção que faz a repaginação por resize existir de fato** — antes dela os três testes de resize mediam uma largura que nunca mudava.

#### Decisões tomadas dentro do escopo

1. **Faixa de fonte 80%–200%, passo 10%**, persistida na coluna `zoom`. Cabe inteira dentro do clamp do storage (0,5–3,0), então nenhum livro antigo quebra e nenhum schema muda; `clampFontScale` também arredonda para o passo, para o rótulo nunca virar "79%".
2. **Detecção de locations parciais (requisito 9) envolvendo `Locations.process`.** É o único ponto onde a falha de um item de spine é observável: a fila do epubjs engole a rejeição. O envelope conta as falhas **e** elimina a unhandled rejection que a lib deixava escapar. Import de livro íntegro segue passando (355 locations, 29.618 B — idênticos ao spike e à Fase A) e o livro com `itemref` fantasma é rejeitado. Na **leitura** a mesma checagem não bloqueia: locations parciais são melhores que não abrir o livro.
3. **Sem mensagem própria para o EPUB incompleto.** `lib/epub.ts` rejeita com um `Error` comum e o `importBook` cai na mensagem genérica *"This file is corrupted or is not a valid EPUB."* — que é verdadeira (o arquivo declara conteúdo que não entrega) e já aciona o rollback. Uma mensagem dedicada exigiria mexer em `src/lib/books.ts`, que não está no escopo de arquivos desta task. Ver "Registrado, não feito".
4. **`width`/`height` em `'100%'` no `renderTo`.** Passar números fixaria o container em pixels: o Stage guarda o tamanho recebido na criação e nunca o atualiza, então uma medida em px gravada agora jamais voltaria a acompanhar o pai. Por isso o `resizeEpubRendition` chama `resize()` sem argumentos, com um cast — o `.d.ts` exige width/height, e o cast fica em `lib/epub.ts` junto com os outros desvios da lib.
5. **`ResizeObserver` além do listener do epubjs.** O epubjs só escuta `window`; recolher a coluna lateral muda a largura do container sem nenhum resize de janela. Os dois caminhos convergem na mesma função e o guard de `_stageSize` do epubjs torna a chamada redundante um no-op.
6. **`rendition.on('keydown')` além do listener de `window`.** O texto vive num iframe: sem isso as setas param de funcionar assim que o foco entra nele.
7. **Sumário resolvido contra o spine em `lib/epub.ts`** (`EpubTocEntry.href = null` quando não resolve), espelhando o `OutlineList` do PDF, que desabilita destino irresolúvel. O carregamento tem teto de 15 s porque o `loadNavigation` do epubjs não tem `.catch`: com o arquivo de navegação ausente, `book.loaded.navigation` **nunca settla** e o painel ficaria em "Loading…" para sempre.
8. **Chave de localStorage própria** (`monet:epub-reader-sidepanel-collapsed`): o painel do EPUB tem só o sumário, não as abas Summary/Highlights do PDF — compartilhar a chave misturaria duas preferências diferentes.

#### Registrado, não feito (fora do escopo desta task)

- **Mensagem dedicada para EPUB com spine ausente.** Duas linhas em `src/lib/books.ts` (um `EPUB_INCOMPLETE_ERROR_NAME` no padrão do DRM/timeout) trocariam *"corrupted or not a valid EPUB"* por algo como *"This EPUB is missing part of its content"*. Não feito por estar fora do escopo de arquivos.
- **Ruído de console do epubjs na leitura:** `File not found in the epub: /OEBPS/_page_map_.xml`, um por abertura de livro. Vem do `replacements()` criando blob URL para cada item do manifesto do OPF; o erro é capturado item a item pela própria lib (`resources.js:148`), então **não** vaza rejeição nem trava a abertura. É específico deste arquivo de teste (o OPF declara um `_page_map_.xml` que não existe no zip) e não afeta o render.
- **`book_highlights.cfi` continua sem mapeamento** — é da B2, como registrado na Fase A.
- **Coluna "pages" da Library exibindo nº de locations para EPUB** segue como está.
- **`storage.saveBook` fora do `try` do `importBook`** segue pré-existente e idêntico ao caminho do PDF.
- **Nada mudou em `Reader.tsx`** e nada precisou mudar: não apareceu nenhum ponto em que o leitor de PDF atrapalhasse o de EPUB. A duplicação de toolbar e painel lateral ficou como esperado; a semelhança real entre os dois é a estrutura visual (toolbar + `readerBody` + coluna retrátil + botões flutuantes), não a lógica — que é completamente diferente (canvas/página vs. iframe/CFI).

### Orchestrator — decisão — 20260808020000

- Summary: Coordenador testou a B1. Leitura, navegação, sumário, tamanho de fonte e paridade do PDF: OK. Três achados, com decisão do Coordenador sobre cada um.
- **Adiados para a B2 por decisão do Coordenador:** (a) não conseguir arrastar a borda da janela e (b) a diagramação em duas colunas. Motivo dado: a B2 acrescenta as colunas de chat e anotações, mudando a largura disponível — calibrar diagramação e redimensionamento agora seria acertar uma tela prestes a mudar. Sobre (a), o Orquestrador verificou que a janela `main` não tem `resizable: false` nem `decorations: false` e que nada nesta task tocou em config de janela; a hipótese principal é janela maximizada.
- **A corrigir agora, único item:** ao sair e voltar, o leitor retoma **uma página antes** de onde parou.

#### Diagnóstico do Orquestrador: por que o teste passou e a realidade falhou

O `codeAgent` mediu a retomada como exata (drift 0 com a dupla passada do `displayAt`), mas o Coordenador vê desvio consistente. A causa da divergência foi localizada:

`layout.js:120` do epubjs — `if (this._spread && width >= this._minSpreadWidth)`, com `minSpreadWidth = 800` (`rendition.js:55`). As medições da B1 rodaram em containers de **396, 504, 632 e 252 px**, todos **abaixo de 800** → **coluna única**. A janela real do Coordenador (1280 px) dá área de leitura acima de 800 → **duas colunas (spread)**.

Ou seja: **toda a suíte de validação da B1 exercitou um modo de paginação que não é o que o usuário usa.** O `renderTo` não passa `spread`, então vale o default `'auto'`. A hipótese principal para o off-by-one é que `location.start.cfi` é o início da coluna ESQUERDA de um spread, e a restauração cai num limite de spread diferente.

Fica a lição de método: harness de teste precisa reproduzir as dimensões reais de uso, não só o comportamento isolado.

- Decision: disparar `codeAgent` (Opus 5) para correção pontual, com exigência de reproduzir primeiro em largura ≥ 800 px.
- **Restrição explícita:** a correção NÃO pode ser desabilitar o spread. Trocar para `spread: 'none'` faria o sintoma sumir enquanto decide, por tabela, a diagramação que o Coordenador adiou de propósito para a B2. A retomada tem que ficar correta COM duas colunas.
- Next step: teste do Coordenador e, se OK, Etapa 2 (revisão da B1).

### CodeAgent — correção pontual (retomada uma página antes) — 20260808040000

- Summary: Reproduzido e corrigido o off-by-one da retomada. A causa não era o spread: o CFI que o epubjs reporta como início da página é um ponto colapsado que, quando a página começa no meio de um parágrafo, é **renderizado no fim da linha anterior — na página anterior**. `display()` ancora pelo x renderizado, então retomava uma página atrás. O spread só tornou a falha muito mais frequente. Corrigido com uma verificação de exatidão na retomada (`resumeEpubAt`), sem tocar em `spread`, colunas ou redimensionamento.
- Files changed:
  - `src/lib/epub.ts`
  - `src/components/Reader/EpubReader.tsx`
- Files created:
  - nenhum
- Files removed:
  - nenhum
- Left behind: ver "Limitação que ficou" abaixo.

#### Reprodução (primeiro), no modo de paginação real

Harness novo em scratchpad: mesmo método das fases anteriores (Chrome headless sobre o `src/lib/epub.ts` REAL bundlado por esbuild, CSP de produção, CSS copiado do `EpubReader.module.css`), mas agora com **janela de 1280×900** — que é o que faltava. Nessa janela a área de leitura fica em **820 px** (`.viewerSurface` bate no `max-width: 860px`, menos 40 px de padding), acima do `minSpreadWidth` de 800 → **duas colunas**, `divisor: 2`, `delta: 820`. O ciclo é o real: abre o livro, anda N páginas, salva o `location.start.cfi` do evento `relocated`, **destrói tudo, reabre do zero** e retoma.

Bug reproduzido de imediato: em 8 posições de teste, 2 retomaram exatamente `−820 px` (uma página). Régua usada: `container.scrollLeft`, não `location` — uma location tem ~1600 caracteres e cabe mais de uma por spread, então a métrica da B1 (drift em locations) **não conseguia enxergar um erro de uma página**. Esse é o segundo motivo pelo qual a B1 passou.

#### Causa real

Sondando página a página (`locationOf(cfi)` contra `scrollLeft`), o padrão é inequívoco:

| Modo | Páginas cujo `start.cfi` renderiza FORA da própria página |
| --- | --- |
| spread (820 px, 2 colunas) | **14 de 40** |
| coluna única (563 px) | **12 de 40** |

Em todas as falhas o CFI renderiza em `scrollLeft − gap/2` (−34 px no spread, −23 px em coluna única) com `top ≈ 638` — ou seja, **no fim da última linha da coluna anterior**.

Mecanismo: `Mapping.page` acha a primeira palavra visível da página e faz `startRange.collapse(true)`, guardando o **ponto anterior à palavra**. Quando a página começa no meio de um parágrafo, esse ponto é uma quebra de linha — e um caret em quebra de linha é desenhado no fim da linha anterior. Se essa linha é a última da última coluna da página anterior, o ponto está fisicamente na página anterior. `DefaultViewManager.moveTo` faz `Math.floor(offset.left / layout.delta) * layout.delta`, então `display(cfi)` leva para a página onde o ponto é **desenhado**, não para a página que ele **representa**.

Isso derruba a hipótese do Orquestrador de que o problema era do spread: **falha nos dois modos de paginação**. O spread apenas a torna muito mais visível, porque com `divisor: 2` cada erro de uma coluna vira erro de uma página inteira de leitura. E explica por que a B1 mediu "drift 0, 4/4": ela sorteou poucas posições, e ~2/3 das páginas são imunes (as que começam em parágrafo novo, onde o ponto colapsado cai no offset 0 de um nó de texto novo).

#### O que mudou

`src/lib/epub.ts`
- `displayEpubAt(rendition, target)` — o antigo `displayAt` do `EpubReader`, movido para cá **sem mudança de comportamento**. Motivo do movimento: é compensação de peculiaridade do epubjs (mesma natureza do `resizeEpubRendition`) e, aqui, o harness exercita a função de verdade em vez de uma cópia.
- `resumeEpubAt(rendition, cfi)` — novo, usado **só na retomada**. Depois do `displayEpubAt`, compara o início reportado da página com o CFI pedido; se não for igual, avança uma página e compara de novo; se ainda não casar, volta ao destino original. Não é heurística: a comparação é a **inversa exata da conta que gerou o valor salvo** — a página certa é a única cujo início reportado é aquele CFI. Quando nada casa (posição salva com outra largura de janela ou outro tamanho de fonte), não existe página equivalente e o comportamento é o de antes.
- `currentStartCfi` (privado) — o `.d.ts` do epubjs declara `currentLocation()` como um `DisplayedLocation` solto, mas a lib devolve o par start/end de `Rendition.located`; o cast fica em `lib/epub.ts`, junto com os outros desvios.

`src/components/Reader/EpubReader.tsx`
- `displayAt` local removido (virou `displayEpubAt` na lib); retomada passou a chamar `resumeEpubAt`. Fonte e sumário continuam em `displayEpubAt`, sem alteração nenhuma de comportamento.

**Por que a correção não vale para a mudança de fonte:** ali a diagramação muda por definição, a comparação nunca casaria, e o passo extra custaria um pulo visível de ida e volta a cada clique — a fila do epubjs agenda cada `display`/`next` num `requestAnimationFrame`, então há repintura entre eles. Deixar de fora é o que mantém intacto o caminho já validado.

#### Prova, nos dois modos de paginação

Mesmas 18 posições, mesmo harness, com e sem a correção (chaveada por `define` do esbuild — o "antes" roda o código exato da B1):

| Modo | Container | `divisor` | ANTES | DEPOIS |
| --- | --- | --- | --- | --- |
| **spread** | 820 px | 2 | **12 de 18 erradas** (todas −1 página, −820 px) | **0 de 18** |
| **coluna única** | 563 px | 1 | **7 de 18 erradas** (6 de −1 página, 1 de +1) | **1 de 18** |

Nas 35 posições corrigidas o ciclo fecha exato: `scrollLeft` idêntico ao salvo, `location` idêntica, e o CFI reportado na volta é byte a byte o CFI salvo.

**Tamanho de fonte em modo spread** (não tinha cobertura): funciona, com repaginação real e reancoragem correta — 100%→150% repagina de 592 para 1330 colunas com drift **0 location**; 150%→80% vai a 394 colunas com drift **−1**; 80%→100% volta a 592 com drift **0**.

**Sumário em modo spread** (também sem cobertura): 3 de 3 navegações OK, `divisor: 2`, 309–369 ms, todas caindo no capítulo pedido (locations 90, 132 e 349).

Console: só o ruído já conhecido do `_page_map_.xml` deste arquivo de teste (um por abertura, capturado pela própria lib). Nenhuma unhandled rejection.

#### Limitação que ficou (pré-existente, não é regressão)

Em coluna única, uma posição continua com desvio de **+1 página** — e continua igual antes e depois da correção. Investigada: é uma página que **contém apenas uma imagem, sem nenhum texto**. O `Mapping` do epubjs percorre só nós de texto, então essa página não tem CFI próprio: ela reporta exatamente o mesmo `start.cfi` da página seguinte. Nenhuma âncora consegue distinguir as duas, e o valor gravado já era o da página seguinte — a retomada é consistente com o que foi salvo. Corrigir exigiria trocar o que se persiste (e.g. guardar também um deslocamento dentro da seção), o que está fora do escopo deste ajuste. Em modo spread — o modo real de uso — a página não se manifesta, porque a imagem divide o spread com texto.

#### Validação

`npm run build` limpo (bundle 2.252,84 → 2.253,02 KB) e `cargo check` limpo (nenhum arquivo Rust tocado). `Reader.tsx` e `Reader.module.css` intocados. Nada de spread, colunas ou redimensionamento foi alterado — `renderTo` continua sem passar `spread`, valendo o default `'auto'`. Todo artefato de teste ficou em scratchpad; `git status` traz só os arquivos previstos.
