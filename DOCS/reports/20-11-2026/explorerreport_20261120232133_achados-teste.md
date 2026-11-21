# Achados do teste fora do roteiro (A, B, C)

Investigação só de leitura na branch `feat/radar-trackers`, comparando com o commit `141f067`. Fonte das observações: `DOCS/reports/20-11-2026/testresults_20261120231039_trackers-log.md` (observações A, B e D do testador; aqui A, B e C).

Nenhum arquivo do projeto foi alterado. Para fechar o ponto B rodei um teste vitest à parte, no scratchpad da sessão (fora de `src/`), com as extensões reais do editor.

Fato que vale para os três pontos: `src/components/Editor/Editor.tsx`, `Editor.module.css`, `CommandAutocomplete.module.css`, `extensions.ts` e `src/hooks/useNotes.ts` estão idênticos ao `141f067` (`git diff --quiet 141f067 -- ...` não devolve diferença). As mudanças da branch em `CommandAutocomplete.tsx`, `CommandExtension.ts`, `commandParser.ts` e `TaskModalEditor.tsx` só trocam a montagem da chave de "executado" por `responseCommandText()`, que dá o mesmo resultado que o código antigo para todo comando que não seja `/since`, e põem o `/since` no grupo Review.

| Ponto | Veredito | Causa em uma linha |
|---|---|---|
| A. Popover "CALENDAR · /today" sozinho e por cima de modais | Já existia no `141f067` | `updateAutocomplete()` abre o popover sem conferir se o editor tem foco; só o `blur` o fecha |
| B. `updated_at` muda ao só abrir a nota | Já existia no `141f067` | O TrailingNode do StarterKit acrescenta um parágrafo vazio na 1ª transação e o `onUpdate` grava sem comparar o markdown |
| C. Título "19/11/202— Thursday" cortado | Já existia no `141f067` (vem do `5d897d8`, 28/10) | `.titleCompact` tem `width: 12ch` com `box-sizing: border-box`, e o padding esquerdo (`--pad-note-x`) cresce com a largura do editor e come a largura do texto |

---

## A. Popover de comando que abre sozinho e fica por cima de modais

### Veredito

Já existia no `141f067`. Esta branch não mexeu no que abre ou fecha o popover. Ela só criou o modal "Trackers", que passou a ser mais um modal coberto pelo popover.

### Evidência

`src/components/Editor/Editor.tsx`, igual no `141f067`:

```ts
// 583-586
const updateAutocomplete = useCallback(() => {
  if (!editor) return
  if (disableSlashCommands || previewMode) return
  const info = getCurrentCommandLine(editor.state, isCalendarNoteRef.current)
  ...
// 640-651
useEffect(() => {
  if (!editor) return
  const handler = () => updateAutocomplete()
  const blurHandler = () => setAutocomplete(HIDDEN_AUTOCOMPLETE)
  editor.on('transaction', handler)
  editor.on('blur', blurHandler)
  updateAutocomplete()
  ...
```

- `getCurrentCommandLine` (`CommandExtension.ts:627-649`) só olha a seleção: seleção vazia num parágrafo de topo cujo texto começa com "/". Não confere o foco nem se a linha já foi executada.
- `getCommandSuggestions('/today', true)` (`commandParser.ts:117-126`) devolve `['/today']`, e o grupo "Calendar" (`commandParser.ts:102`, sem mudança) desenha o cabeçalho "CALENDAR".
- Na montagem, o editor dispara várias transações sem foco, e todas passam pelo `handler`: a chamada direta da linha 646, `syncExecuted` (656), `bumpResponses` (666), `taskStatus` (675) e a restauração do cursor salvo (733).
- O popover é portal no `body` com `position: fixed; z-index: 1100` (`CommandAutocomplete.module.css:2-4`). Os overlays de modal usam 1000 (ex.: `SearchPalette.module.css:9`), então ele fica por cima. O valor 1100 entrou no próprio `141f067` (antes era 1000), para ficar acima do modal da task.

### Em que condições ele abre sozinho

Ele abre quando uma transação acontece com o editor sem foco e a seleção está numa linha que é prefixo de comando e não tem espaço (`/today`, `/week-review`, `/define`...). A seleção chega nessa linha de três jeitos:

1. **Seleção inicial.** Sem `autofocus`, o ProseMirror põe a seleção no início do documento. Na nota do dia do Calendar, a primeira linha costuma ser `/today`, e muitas vezes é o único parágrafo com texto (`/today` mais o bloco da resposta). O popover abre já na montagem, pela chamada da linha 646 ou pela transação `syncExecuted`.
2. **Cursor restaurado** (`Editor.tsx:723-750`). Se o cursor salvo da nota (`viewStateKey`) estava na linha `/today`, a transação da linha 733 abre o popover. O foco só vem no `requestAnimationFrame` seguinte, e só se ninguém estiver digitando em outro campo (`typing`, linhas 744-749). Se outro campo tem o foco (busca do Ctrl+P, título, chat), o editor fica sem foco.
3. **Texto novo vindo de fora** (`Editor.tsx:691-704`, ex.: a keep gravou a nota do dia). O `setContent` troca o documento inteiro e a seleção vai para o fim. Se a última linha com texto é `/today`, o popover abre.

Ele não fecha porque o único gatilho de fechamento fora do teclado é o `blur` (linha 643). Se o editor nunca ganhou foco, o `blur` nunca dispara. Com o editor focado o problema não aparece: abrir o Ctrl+P ou clicar em "Manage" tira o foco e o popover fecha.

### Correção mínima recomendada

Em `src/components/Editor/Editor.tsx`, dentro de `updateAutocomplete` (logo depois da linha 585), esconder e sair quando o editor não tem foco:

```ts
if (!editor.isFocused) {
  if (autocompleteRef.current.visible) setAutocomplete(HIDDEN_AUTOCOMPLETE)
  return
}
```

O Tiptap marca `editor.isFocused = true` antes de disparar a transação de foco (`FocusEvents`, `@tiptap/core` 3.23.4). Então, quando o usuário clica na linha ou o foco é restaurado, a transação de foco roda `updateAutocomplete` de novo e o popover aparece normalmente. Só um arquivo muda.

Opcional, como decisão de UX: não abrir o popover numa linha já executada (marca `executed` no estado do `commandPluginKey`). Hoje, com o foco na linha `/today` executada, ele ainda abre. Isso não causa o bloqueio, só incomoda.

Não recomendo "fechar quando um modal abre". Seriam vários pontos de abertura de modal para cobrir, e o gatilho real é a falta de foco.

### Risco

Baixo. O popover deixa de abrir só quando ninguém está no editor. Um caso para conferir no app: digitar "/" logo depois de `acceptSuggestion`. Ele chama `editor.view.focus()` antes do próximo `updateAutocomplete`, então deve funcionar. Não há teste automatizado do autocomplete (`formattingActions.test.ts` só importa o parser).

### O que confirmaria no app

Com a nota de hoje aberta e o popover visível sem clique, rodar `document.activeElement` e `document.querySelector('[data-note-editor] .ProseMirror') === document.activeElement`. A segunda expressão deve dar `false`. Depois clicar na linha `/today` e em outro lugar: o popover deve fechar no blur.

---

## B. Abrir a nota muda o `updated_at` sem mudar o conteúdo

### Veredito

Já existia no `141f067`. Não tem relação com a chave `responseCommandText` nem com a extensão de comandos.

### Causa

Não é uma diferença na ida e volta do markdown, e não é gravação da extensão de comandos. A causa é o **TrailingNode do StarterKit** (`@tiptap/extensions` 3.23.4, ativo por padrão no `StarterKit.configure` de `extensions.ts:139`) junto com um `onUpdate` que grava sem comparar:

1. A nota é gravada sem o parágrafo vazio final, porque o serializer descarta o parágrafo em branco do fim (`extensions.ts:78-83, 94-99`). Uma nota que termina num bloco que não é parágrafo (aqui, o `<embed-block>` da resposta) volta do banco terminando nesse bloco.
2. Na montagem, o `Editor.tsx` dispara transações só de meta (`syncExecuted` na 656, `bumpResponses` na 666, `taskStatus` na 675). Na primeira delas, o `appendTransaction` do TrailingNode insere um parágrafo vazio no fim, porque o último nó não é parágrafo.
3. O Tiptap emite `update` quando alguma transação do lote mudou o documento (`@tiptap/core`, `dispatchTransaction`: `!transactions.some(tr => tr.docChanged)`). A transação acrescentada conta.
4. `onUpdate` (`Editor.tsx:546-549`) chama `onChange(md)` sem comparar com o texto gravado. `updateActive` (`App.tsx:2905-2908`) grava `{ ...activeNote, content, updatedAt: Date.now() }`, e `useNotes.saveNote` (`useNotes.ts:53-83`) também não compara. O `content` gravado é igual ao anterior; só o `updated_at` muda.

### Evidência (teste no scratchpad, com `buildBaseExtensions` real e uma transação só de meta)

| Markdown da nota | Último nó ao abrir | Último nó depois | `update` emitido | Markdown igual |
|---|---|---|---|---|
| `/planner` + `<embed-block …>` | embedBlock | paragraph | 1 | sim |
| `/planner` + parágrafo de texto | paragraph | paragraph | 0 | sim |
| texto + lista `- a / - b` | bulletList | paragraph | 1 | sim |
| texto + `## Titulo` | heading | paragraph | 1 | sim |

### Em que notas acontece

Acontece em **toda nota cujo último bloco de topo não é um parágrafo**: bloco de IA (embed), lista, checklist, título, tabela, code block ou Mermaid, imagem, toggle, nota vinculada, bloco de tasks, citação. Acontece a cada abertura, e também a cada remontagem do editor (trocar de nota e voltar), mesmo sem clique. Notas que terminam em parágrafo de texto não mudam, o que explica as outras notas que o testador abriu sem efeito. As três afetadas têm resposta de comando inserida como bloco no fim, então a coincidência com `ai_responses` é indireta.

O mesmo vale para o editor da keep: `KeepPanel.tsx:239-246` grava `updatedAt: Date.now()` em todo `onUpdate`, também sem comparar.

### Correção mínima recomendada

Em `src/components/Editor/Editor.tsx`, guardar o último markdown conhecido e só chamar `onChange` quando ele mudar:

```ts
const lastMdRef = useRef(value)
// onUpdate (546):
const md = getMarkdown(editor)
if (md === lastMdRef.current) return
lastMdRef.current = md
onChangeRef.current(md)
// efeito do texto vindo de fora (691): lastMdRef.current = value antes do setContent
```

A comparação deve ser com o último markdown emitido (ref), e não com a prop `value`. Comparar com `value` perderia uma edição feita e desfeita antes do re-render. Essa mudança cobre o editor principal, o modal da task, o painel de notas do Reader e a nota lateral, que usam todos o mesmo componente. Para a keep, a mesma guarda em `KeepPanel.tsx:239` (comparar `md` com `noteRef.current.content`) é a segunda parte, se o Coordenador quiser cobrir as duas janelas.

Não recomendo desligar o TrailingNode (`StarterKit.configure({ trailingNode: false })`): o usuário perderia a linha para clicar e escrever depois de um bloco. Marcar as transações de montagem com `preventUpdate` também não basta, porque o parágrafo seria acrescentado no primeiro clique do usuário e gravaria do mesmo jeito.

### Risco

Baixo. Só deixa de gravar quando o markdown é idêntico ao último gravado ou emitido. O que não entra no markdown já não era persistido antes. Rodar `npm test`, que cobre a ida e volta do markdown e o `formattingActions`.

### O que confirmaria no app (só leitura)

`SELECT id, substr(content, -100) FROM notes WHERE id IN ('eNtbMz2g_wlH1QKl7bolH','0Hqwx_QrOtBtnbJffWHyx','oBxNRAHxEH4iy2h2gJRUz')`. As três devem terminar em `</embed-block>` (ou outro bloco que não seja parágrafo). Em seguida, abrir uma nota que termine em lista: o `updated_at` dela deve mudar do mesmo jeito.

---

## C. Título da nota do Calendar cortado na janela principal

### Veredito

Já existia no `141f067`. O corte vem do `5d897d8` ("fix: largura corpo da nota", 28/10). Os chips de trackers no `topSlot` não influem: o `topSlot` é renderizado depois do `.titleRow` (`Editor.tsx:1159-1177`), como irmão, e o `.editor` tem `container-type: inline-size`, então o conteúdo não muda a largura dele.

### Evidência

`src/components/Editor/Editor.module.css`, igual no `141f067`:

```css
/* 16 */ --pad-note-x: max(var(--pad-editor-body), calc((100cqw - var(--measure-note-col)) / 2));
/* 40-47 */ .title { flex: 1; min-width: 0; ... padding: var(--space-2) var(--pad-content-x) var(--space-3) var(--pad-note-x); font-size: 24px; }
/* 60-64 */ .titleCompact { flex: 0 0 auto; width: 12ch; padding-right: 0; }
```

Mais `App.css:95`: `*, *::before, *::after { box-sizing: border-box; }`, e `App.css:51,70`: `--pad-editor-body` = 56px e `--measure-note-col` = 867px.

### Causa

Na nota do Calendar, o `input` do título recebe `.titleCompact` (`Editor.tsx:1163`, quando há dia da semana), com largura fixa de `12ch`. Com `border-box`, essa largura inclui o padding esquerdo. Até o `5d897d8`, esse padding era fixo (`--pad-editor-body`, 56px). Desde então ele é `--pad-note-x`, que cresce quando o editor passa de 867px, para centralizar a coluna. Sobra para o texto `12ch − max(56px, (largura do editor − 867px) / 2)`.

Numa janela principal larga, o padding passa do mínimo e o último dígito da data some. Na keep, `--pad-note-x` é fixo em 24px (`KeepPanel.module.css:129`), por isso lá o título aparece inteiro. Com o testador, faltavam 12px (116px de texto em 104px úteis), o que dá um padding esquerdo de 12px a mais do que cabe.

### Correção mínima recomendada

Em `src/components/Editor/Editor.module.css`, no `.titleCompact`, fazer a largura valer só para o texto:

```css
.titleCompact {
  flex: 0 0 auto;
  box-sizing: content-box; /* 12ch para "DD/MM/YYYY"; o padding do eixo fica por fora */
  width: 12ch;
  padding-right: 0;
}
```

Só um arquivo de CSS muda. Uma alternativa equivalente é `width: calc(12ch + var(--pad-note-x))`, mas ela quebraria no modo foco, onde `.editor.focus .title` troca o padding por `--pad-editor-body`. O `content-box` funciona nos dois casos.

### Risco

Baixo. O dia da semana fica sempre logo depois de 12ch de texto, em qualquer largura. Na keep, o título fica 24px mais largo que hoje, sem efeito visível, porque `12ch` já sobra para "DD/MM/YYYY". Se o testador quiser, pode conferir no modo foco e na coluna estreita do Reader.

### O que confirmaria no app

Na nota do Calendar da main, ler `getComputedStyle(document.querySelector('[data-note-title]'))`: `width` e `paddingLeft`, e a largura do `[data-note-editor]`. O esperado é `paddingLeft` acima de 56px e `width − paddingLeft` menor que a largura do texto. Depois, estreitar a janela até o editor ficar com menos de ~1000px: o corte some.
