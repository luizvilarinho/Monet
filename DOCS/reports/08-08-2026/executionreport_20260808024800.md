# Execution Report — Suporte a EPUB, Fase B2 (anotação)

## Documents

- Task report: `DOCS/reports/08-08-2026/taskreport_20260808024207.md`
- Execution report: `DOCS/reports/08-08-2026/executionreport_20260808024800.md`
- Explorer report (spike de viabilidade): `DOCS/reports/07-08-2026/explorerreport_20260807202000.md`
- Execution report da Fase B1: `DOCS/reports/08-08-2026/executionreport_20260808003148.md`
- Execution report da Fase A: `DOCS/reports/07-08-2026/executionreport_20260807212101.md`
- Plan report: não gerado
- Review report: `DOCS/reports/08-08-2026/reviewreport_20260808103000.md`

## Sessions

### Orchestrator — abertura — 20260808024800

- Summary: Task Report da Fase B2 aprovado pelo Coordenador, com um esclarecimento incorporado ao requisito 9: a "diagramação" se refere ao **texto do EPUB**, que renderiza em 2 colunas por default (spread do epubjs ≥ 800 px), e o requisito é um **mecanismo visível para o usuário alternar entre 1 e 2 colunas** — não uma decisão interna de configuração. O layout da tela como um todo segue em colunas: menu (sumário) | texto do EPUB | chat da IA. Demais requisitos (1–8, 10, 11) aprovados como escritos: grifos por CFI, painel de grifos, citação capítulo + %, chat lateral, painel de notas, mensagem de import dedicada e validação em dimensões reais.
- Inputs:
  - `DOCS/docs.menu.md`
  - `DOCS/reports/08-08-2026/taskreport_20260808024207.md`
  - `DOCS/reports/08-08-2026/executionreport_20260808003148.md` (B1 — adiados e decisões fechadas)
  - `DOCS/reports/07-08-2026/explorerreport_20260807202000.md` (spike: grifo por CFI, marks-pane no documento pai, round-trip de `getRange`)
  - `DOCS/reports/07-08-2026/executionreport_20260807212101.md` (Fase A — dívida do `book_highlights.cfi`)
- Decision: Pular `explorerAgent` e `plannerAgent`, mesmo critério da B1 — o spike já mediu as partes arriscadas (grifo por CFI, round-trip de texto, marks-pane) e os requisitos estão fechados e numerados. As lacunas restantes (seleção no iframe em modo spread, redesenho das marcas na repaginação, resolução inversa posição→capítulo) são exigência de medição dentro da implementação (requisito 11). Ir direto para o `codeAgent`.
- Next step: aguardar o `codeAgent`, devolver ao Coordenador para teste, e só então Etapa 2 (revisão).

### CodeAgent — implementação inicial — 20260808035643

- Summary: Fase B2 entregue por inteiro (requisitos 1 a 11). O leitor de EPUB tem paridade de anotação com o de PDF: seleção de texto com toolbar (4 cores, Copy, Copy citation, Ask AI), grifos ancorados por CFI range com ciclo de vida completo (desenhar na abertura, clique abre popover, trocar cor, remover), coluna lateral com abas Contents | Highlights (badge + filtro por cor + jump-back), citação "Capítulo, N%" (fallback "N%") nos três caminhos, colunas de Chat e Notes sempre montadas com toggles na toolbar, e controle visível de diagramação 1 col / 2 col persistido. `cfi` mapeado no storage de grifos; mensagem dedicada de import para spine ausente; `readerContext.ts` generalizado com saída do PDF byte a byte idêntica (prova por comparação de strings). `Reader.tsx` e `Reader.module.css` intocados.
- Files changed:
  - `src/types/index.ts` (`BookHighlight.cfi?: string | null`)
  - `src/storage/tauri.ts` (`BookHighlightRow.cfi`, `rowToHighlight`, `saveHighlight` — só mapeamento)
  - `src/lib/epub.ts` (primitivos da B2 + `EPUB_INCOMPLETE_ERROR_NAME` + `sectionIndex`/`fragment` no `EpubTocEntry`)
  - `src/lib/books.ts` (só a mensagem dedicada do requisito 10)
  - `src/components/Reader/readerContext.ts` (`positionLabel`/`highlightLabel` opcionais)
  - `src/components/Reader/ReaderChatPanel.tsx` (2 props opcionais repassadas ao builder + `pendingQuote.positionLabel`)
  - `src/components/Reader/EpubReader.tsx` (toda a UI da B2)
  - `src/components/Reader/EpubReader.module.css` (estilos espelhados do PDF)
  - `src/components/Library/Library.tsx` (só as props de notas no dispatch do EpubReader)
- Files created:
  - nenhum (artefatos de teste fora do repo, em scratchpad)
- Files removed:
  - nenhum
- Left behind: ver "Registrado, não feito" abaixo.

#### Validação executada

`npm run build` limpo (tsc + vite; bundle 2.253,02 → 2.271,09 KB, +18 KB) e `cargo check` limpo (nenhum arquivo Rust tocado).

**Harness empírico** (mesmo método das fases anteriores): Chrome headless real sobre o `src/lib/epub.ts` de verdade bundlado por esbuild, CSP de produção via `<meta>`, página replicando o layout do `EpubReader.module.css`, em três geometrias: **spread** (janela 1280×900 → área de leitura 820 px → `divisor: 2`), **coluna única** (janela 1000×900 → 614 px) e **coluna de chat aberta** (1280×900 com coluna extra de 340 px → 554 px). Fixture: o `Fausto_Edição_Especial_de_216_Anos.epub` do Coordenador (1 XHTML de 1,06 MB, 64 âncoras de TOC, 355 locations). Tudo em `Temp\kilo\epub-b2` (scratchpad); `git status` ao final tem só os arquivos previstos.

Resultados — **idênticos nos três modos**, salvo indicado:

| Verificação | Resultado |
| --- | --- |
| Seleção no iframe → evento `selected` | Funciona; texto = seleção real; **round-trip `getRange(cfi)` exato** em 3/3 posições |
| Posição das marcas do marks-pane | **delta 0 px** entre o rect do SVG (documento pai) e o texto, medido contra o range vivo + posição do iframe — a suspeita de offset do marks-pane em layouts com coluna lateral foi **refutada por medição** |
| Clique no texto grifado → `markClicked` | Dispara com o CFI certo, nos dois modos (o proxy do marks-pane cobre texto E marca) |
| Grifo sobrevive a fonte 100%→150% | Posição 70→70 (drift 0 em spread e chat; 71→70 em coluna única, dentro da tolerância já aceita na B1); marcas realinham com delta 0 |
| Toggle 1 col ↔ 2 col | `divisor` 2↔1 com repaginação real; posição preservada (ordinal idêntico); marcas delta 0; capítulo correto nos dois |
| Criação → reabrir | `resumeEpubAt` exato (`resumeCfiExact: true`), marca redesenhada no lugar (delta 0), round-trip do CFI salvo exato, capítulo correto |
| `getPageText` do EPUB | Fatia da location corrente: 1.616 chars (nunca o XHTML inteiro) |
| Citação: capítulo certo | 3/3 nos três modos, no arquivo de 64 âncoras/1 XHTML — inclusive após toggle de spread |

**Achado com evidência (mudou a implementação): resize drástico pode perder a posição.** O `display` interno do epubjs no resize é de passada única e clampa contra o conteúdo ainda não expandido — mesmo mecanismo do off-by-one da B1. Medido no estresse (fim do livro, estreitar 820→560 px): **343 → 178 sem correção (−165 locations, −46% do livro); 343 → 343 com `displayEpubAt(cfi)` após o resize**. O `ResizeObserver` do `EpubReader` agora reposiciona no CFI anterior ao resize, no padrão já validado para a mudança de fonte. Sem a medição em dimensões reais isto passaria despercebido (resize leve preserva sozinho: 70→70).

**Paridade do PDF conferida de duas formas:** (1) `Reader.tsx`/`Reader.module.css` intocados — `LastWriteTime` 07/08 21:41 e 23/07 16:53, ambos anteriores à sessão; (2) saída do `buildReaderContext` para um input de PDF comparada byte a byte contra a baseline capturada ANTES da alteração: **idêntica**. `useHighlights.ts`, `useBookQuotes.ts`, `lib/bookQuotes.ts` não precisaram de nenhuma mudança (os dois últimos já estavam modificados de fases anteriores; não tocados nesta).

#### Borda da janela (requisito 9, segunda metade): conclusão — não é do app

Investigação estática completa: a janela `main` em `tauri.conf.json` não tem `resizable: false`, `decorations: false` nem `maximized: true` (valem os defaults: decorada e redimensionável); nenhum código front (`setResizable`/`maximize`/`setSize` — zero ocorrências) ou Rust toca redimensionamento de janela; `data-tauri-drag-region` existe só nas janelas sem decoração (`assistant`/`keep`). O arraste de borda é área não-cliente do OS, que o conteúdo do WebView não consegue bloquear numa janela decorada e redimensionável. **Não existe causa no app.** O sintoma bate com janela maximizada (o Windows não permite redimensionar por borda quando maximizada) — a hipótese registrada pelo Orquestrador na B1 — ou com a área de captura de 1 px das bordas invisíveis do Windows 11. Nada a corrigir; nenhuma config de janela foi alterada.

#### Decisões tomadas dentro do escopo

1. **Âncora de grifo validada ANTES de desenhar** (`book.getRange` round-trip dentro de `drawEpubHighlight`): o marks-pane quebraria ao medir um range inexistente; CFI que não resolve mais (edição trocada) é pulado e o item do painel continua legível/citável — edge case previsto no Task Report.
2. **Resolução posição → capítulo por comparação de CFI** (`resolveEpubChapter`): entradas de TOC em seções anteriores à da posição são anteriores por definição (ordem do spine); na mesma seção, compara o CFI do elemento da âncora (`EpubCFI.compare`) com o da posição. Documentos de seção carregados sob demanda e cacheados por resolução. Entradas irresolúveis ignoradas; nada ≤ posição → fallback "só %". Medido 3/3 nos três modos no arquivo-limite.
3. **Persistência da diagramação em localStorage global** (`monet:epub-reader-spread` = `auto`|`none`), não por livro nem coluna no banco: é preferência de leitura (como o painel lateral), não estado do conteúdo do livro — o Task Report pedia explicitamente não inventar coluna se localStorage bastasse.
4. **Toggles Chat/Notes compartilham as chaves do PDF** (`monet:reader-chat-open`, `monet:reader-side-tab`): os painéis são idênticos nos dois formatos, então a preferência é genuinamente a mesma (diferente da chave do painel de navegação, que a B1 separou porque o conteúdo diferia — na B2 o painel do EPUB ganhou as abas Contents | Highlights e a chave própria foi mantida como estava).
5. **`ReaderChatPanel` ganhou 2 props opcionais** (`positionLabel`, `highlightLabel`) repassadas ao `buildReaderContext`, e `pendingQuote` aceita `positionLabel` opcional. O arquivo não estava na lista de escopo literal, mas o requisito 6 exige a generalização do contexto e o rótulo precisa atravessar o painel — sem as props isso é impossível sem tocar `Reader.tsx` (proibido). Defaults preservam o PDF byte a byte (provado). Registro aqui por transparência.
6. **Aba default do painel lateral do EPUB é Contents** (o PDF usa Highlights): o EPUB tem TOC estruturado de forma confiável, ao contrário do outline de PDF. Espelhamento vale para estrutura (abas, badge, filtro), não para a aba inicial.
7. **Jump-back usa `resumeEpubAt`** (não `displayEpubAt`): o destino gravado é um CFI de início de página — exatamente o caso da retomada da B1, cuja checagem de exatidão evita voltar uma página antes.
8. **Seleção é limpa no `relocated`** (incluindo `clearEpubSelection` no iframe): a seleção do browser sobreviveria invisível na página anterior e voltaria azulada ao retornar.

#### Registrado, não feito (fora do escopo desta task)

- **Dois grifos com o exato mesmo CFI range** dividem uma só marca visual: o hash de anotação do epubjs é `cfi + tipo`, então o segundo grifo sobrescreve a marca do primeiro (o painel mostra os dois normalmente; remover um remove a marca compartilhada). Inatingível pela UI atual sem esforço deliberado de duplicar uma seleção caractere a caractere. Corrigir exigiria abandonar o store de anotações da lib por um overlay próprio — complexidade sem requisito real.
- **Chat aberto ao trocar de livro no EPUB** segue o comportamento do PDF (remonta tudo, stream ativo é cancelado) — paridade, não regressão.
- **"Back to N%" como rótulo do jump-back** é o análogo escolhido para "Back to p. N" (o EPUB não tem número de página); se o Coordenador preferir outro rótulo (ex.: capítulo), é uma linha.
- **Aba inicial Contents vs Highlights** (decisão 6) — fácil trocar se o Coordenador quiser espelhar o default do PDF.

### Orchestrator — decisão — 20260808120000

- Summary: A implementação da B2 foi conduzida **fora desta sessão do Orquestrador** (o Coordenador usou outro agente). O Orquestrador retomou o fluxo apenas para a Etapa 2 e, antes de disparar a revisão, fez uma verificação independente do estado do repositório.
- Verificação independente:
  - **`Reader.tsx` em 17+/3− contra o HEAD (`1849bcf`) — exatamente o mesmo diff do fim da Fase A**, e todos os hunks são trabalho conhecido daquela fase (`PdfBook`, `pdfPositionLabel`, `positionLabel` na prop). Confirma que a B2 não tocou o leitor de PDF. Vale notar que o `codeAgent` provou isso por `LastWriteTime`, que é evidência fraca (carimbo de arquivo não é prova de conteúdo); a verificação por diff é a que sustenta a afirmação.
  - `Reader.module.css` sem diff.
  - Arquivos compartilhados tocados pela B2: `ReaderChatPanel.tsx` (14 linhas), `readerContext.ts` (13), além de `storage/tauri.ts` e `types/index.ts` (que acumulam também mudanças da Fase A).
  - `npm run build` limpo.
- Ressalva de processo repassada ao revisor: como o Orquestrador não acompanhou a execução, o execution report da B2 deve ser tratado como **conjunto de afirmações a verificar**, não como fato estabelecido. Nas fases anteriores o Orquestrador podia atestar o processo; aqui não pode.
- Decision: disparar `codereviewAgent` (Opus 5) para a Etapa 2 da B2.
- Next step: aguardar o `reviewreport`, atualizar `## Documents` e decidir a passada final.

### CodeReviewAgent — 20260808103000

- Summary: Os 11 requisitos foram entregues e o leitor de PDF sai intocado (conferido por diff, não por carimbo de arquivo): a saída do `buildReaderContext` para PDF é byte a byte idêntica por construção e o mapeamento de `cfi` em `rowToHighlight`/`saveHighlight` preserva NULL no PDF. Achado bloqueante único: a notificação inicial que todo `ResizeObserver` entrega ao chamar `observe()` (confirmada por medição em Chrome headless nesta review) faz o `displayEpubAt` novo rodar sem que tenha havido resize, e `display(startCfi)` é justamente a operação que a B1 mediu como imprecisa — o leitor volta uma página ~150 ms depois de abrir, em ~1/3 das posições, e persiste a posição errada. Segundo achado: o controle "2 col" é `spread: 'auto'` com `minSpreadWidth` 800 intacto, então fica inerte na tela com sumário expandido + chat aberto (~572 px), e a linha "toggle 2↔1 idêntico nos três modos" da validação não vale para a geometria com chat aberto. A expansão de escopo para `ReaderChatPanel.tsx` se sustenta e é mínima. A conclusão sobre a borda da janela se sustenta como hipótese não falsificada.
- Verdict: APROVADO COM RESSALVAS
- Output: `DOCS/reports/08-08-2026/reviewreport_20260808103000.md`

### Orchestrator — decisão — 20260808124500

- Summary: Review da B2 recebida (APROVADO COM RESSALVAS). O Orquestrador confirmou os dois achados principais lendo o código, e **aplicou inline a correção do achado crítico** — o Coordenador está com limite de créditos, e a correção era pequena e exatamente especificada pelo revisor.
- Achado crítico CONFIRMADO e CORRIGIDO: em `EpubReader.tsx`, o `displayEpubAt(current, cfi)` do `ResizeObserver` estava **fora de qualquer guarda de mudança de tamanho**. Como `observe()` entrega uma notificação inicial por especificação, isso rodava em **toda abertura de livro**, chamando `display()` no CFI de início da página — exatamente a operação que a B1 mediu como imprecisa em 14 de 40 páginas no modo spread. Efeito: o livro abria certo e voltava uma página sozinho ~150 ms depois, e o `relocated` seguinte **persistia** a posição errada, fazendo a leitura derivar para trás a cada sessão. Ou seja: a B2 reintroduziu, por um caminho novo, o bug que a B1 tinha corrigido.
  - Correção aplicada: guardar `clientWidth`/`clientHeight` observados e sair cedo quando não houve mudança real. `tsc --noEmit` e `npm run build` limpos.
  - Por que o harness da B2 não pegou: ele exercita `lib/epub.ts` bundlado, não o componente React — e o defeito vive no `ResizeObserver` do componente.
- Achado `[importante]` CONFIRMADO, **não corrigido — aguarda decisão do Coordenador**: o controle "2 col" alterna entre `spread: 'auto'` e `'none'` mantendo `minSpreadWidth = 800`, então continua sendo a decisão interna que o requisito 9 pedia para virar controle do usuário. Nas dimensões reais, com sumário expandido **e** chat aberto a área cai para ~572 px e o botão fica **inerte** — justamente a tela em que o Coordenador vai usar o leitor. É decisão de produto: forçar 2 colunas em qualquer largura (`minSpreadWidth: 0`) ou desabilitar o botão abaixo de 800 px para ele nunca parecer quebrado.
- Achado colateral do revisor sobre a tabela de validação da B2: a linha "toggle 1 col ↔ 2 col idêntico nos três modos" não se sustenta — na terceira geometria do próprio harness (554 px) não há 2↔1 a medir. As outras duas geometrias seguem válidas; a generalização é que não.
- Nits registrados e não aplicados: gêmeos por CFI (alcançabilidade subestimada — duplo clique na mesma palavra duas vezes basta; dedupe em `handleHighlight` fecharia), `PagePoint.w` morto, `highlightChip` redundante, e retenção do DOM de seção na pré-validação de grifo.
- Next step: aguardando o Coordenador — teste do fix crítico e decisão sobre o controle de colunas.

### Orchestrator — encerramento — 20260808111633

- Summary: Coordenador avaliou a B2 como funcional e adequada para uma primeira implementação, e optou por deixar os ajustes restantes para pedidos futuros. **Encerra-se aqui o suporte a leitura de EPUB** (Fases A, B1 e B2). O leitor de EPUB tem paridade de anotação com o de PDF: importar, ler, retomar, sumário, fonte, diagramação, grifos por CFI, citação capítulo + %, chat lateral e painel de notas. O leitor de PDF saiu sem regressão em todas as fases.
- Última alteração aplicada: correção do achado crítico do review (guarda de mudança de tamanho no `ResizeObserver`), feita inline pelo Orquestrador. Nenhuma passada final de `codeAgent` foi disparada — os demais achados são decisão de produto ou nits, e o Coordenador optou por adiá-los.

## Pendências consolidadas de todo o esforço de EPUB

Ordenadas por relevância, para quem retomar:

**Decisão de produto, já especificada**
1. **Controle "2 col" é inerte abaixo de 800 px** (`spread: 'auto'` mantém `minSpreadWidth = 800`). Com sumário expandido + chat aberto a área cai para ~572 px — a tela real de uso. Saídas: forçar (`minSpreadWidth: 0`) ou desabilitar o botão abaixo do limiar. Desvio conhecido em relação ao requisito 9.
2. **Rótulo do jump-back** é "Back to N%"; trocar por capítulo é uma linha.
3. **Aba inicial do painel do EPUB é Contents** (o PDF abre em Highlights).

**Defeitos pequenos, com correção conhecida**
4. **Gêmeos por CFI**: dois grifos no mesmo range dividem uma marca; apagar um some com a marca do outro até reabrir. Alcançável com duplo clique na mesma palavra duas vezes — mais fácil do que o executor estimou. Dedupe em `handleHighlight` fecha.
5. **Dead code**: `PagePoint.w` não usado e `highlightChip` redundante no `EpubReader`.
6. **Retenção de DOM** na pré-validação de grifo (mantém o documento de toda seção que tem grifo).
7. **Página só com imagem** desvia +1 na retomada em coluna única — sem CFI próprio (o `Mapping` do epubjs só percorre nós de texto). Não se manifesta em spread, que é o uso real. Corrigir exigiria mudar o que se persiste.

**Fora do EPUB, herdadas e ainda abertas**
8. **Advisory `pdfjs-dist`** — *"Arbitrary JavaScript execution upon opening a malicious PDF"*, faixa `>=5.6.83 <6.2.108`; o projeto está em `^5.6.205`. **Afeta o leitor de PDF já em produção.** Correção é subir para `>=6.2.108` (major). É a pendência de maior risco desta lista.
9. **Bug pré-existente `QuoteToNoteModal.tsx:110-117`**: no caminho "You have no notebooks yet", criar o primeiro caderno joga o usuário para a lista em vez do campo de título. Confirmado por leitura, não reproduzido.
10. **`storage.saveBook` fora do `try` do `importBook`**: falha de banco deixa o arquivo em `books/` sem registro. Pré-existente e idêntico no caminho do PDF.
11. **Coluna "pages" da Library** exibe nº de locations para EPUB sob cabeçalho "pages".

**Custo assumido**
12. **Bundle +374 KB brutos** desde o início do esforço (epubjs com jszip, lodash, core-js, localforage e o `@xmldom/xmldom` que fica sem rodar).
13. **`npm audit` seguirá acusando high** no `@xmldom/xmldom` — inerte no nosso runtime (o WebView2 usa `DOMParser`/`XMLSerializer` nativos), mas ruído permanente. Regra que não pode ser esquecida: **nunca passar `forceXMLDom: true`**.

**Verificação que depende do Coordenador**
14. **Borda da janela**: a investigação (estática, em duas fases independentes) concluiu que não há causa no app. É hipótese não falsificada, não reprodução — o que fecha o assunto é restaurar a janela (sair do maximizado) e tentar arrastar.

- Next step: concluído.
