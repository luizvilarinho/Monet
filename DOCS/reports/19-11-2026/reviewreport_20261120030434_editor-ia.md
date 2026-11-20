# Code Review — Fase B, Fatia 2 (Editor) e Fatia 6 (IA contextual)

**Veredito: REPROVADO**

Há um crítico: o toggle que embrulha a seleção grava um título com linha em branco, e a nota volta vazia ao reabrir. Também há 4 importantes e 9 nits.

## Escopo e verificação
- **Fatia 2:**
  - os arquivos da sessão "CodeAgent — implementação inicial (Fase B, Fatia 2 — Editor) — 20261120023538": `src/components/Editor/`, `src/components/RelatedContent/` e as edições pequenas do `App.tsx`;
  - os novos `InsertMenu`, `LinkPopover`, `anchoredPosition`, `iconMarkup` e `formattingActions.test.ts`;
  - a saída do `onRemoveResponse` do `TaskModalEditor`.
- **Fatia 6:**
  - os arquivos da sessão "CodeAgent — implementação inicial (Fase B, Fatia 6) — 20261119233900": `types/index.ts`, `useAi.ts`, `AiPanel/`, `NotesChat/`, `AssistantPanel/`, `KeepPanel/`, `lib/agents/` e as edições do `App.tsx` da fatia.
- **Fora (Fase A, já revisada):**
  - o serializer e a regra `monet_toggle_legacy` do `ToggleBlock.ts`;
  - o `markdownRoundTrip.test.ts`;
  - na keep, a recarga no foco, o `failedNoteIdRef` e o banner;
  - o `selectionToHtml`.
- **`npx tsc --noEmit`:** exit 0.
- **`npm test`:** 8 arquivos e 87 testes passaram.
- **Reproduções:** feitas num vitest isolado no scratchpad, que importa o `src` sem alterar o projeto:
  - (A) código como título;
  - (B) link e marca no 1º bloco;
  - (C) Turn into com subitens;
  - (D) desfazer do wrap e do Turn into;
  - (E) toggle em citação;
  - (F) quebra de linha no 1º bloco;
  - (G) Turn into num item simples.
- **Sem teste no app:** o Tauri não foi aberto.

---

## Crítico

### C1 — Toggle com linha em branco no título apaga o resto da nota ao reabrir
- **Onde:**
  - `src/components/Editor/formattingActions.ts:163-165`: o título é o `textContent` do 1º bloco de texto, e o bloco de código conta como bloco de texto;
  - `src/components/Editor/ToggleBlock.ts:11-17` e `:98`: o `escapeAttr` não trata quebra de linha.
- **Cenário:**
  1. O usuário seleciona um trecho de um bloco de código ou de um Mermaid com linha em branco e clica em Toggle na régua.
  2. O código vira o título, e o bloco de código sai do corpo.
  3. O autosave grava `<div data-type="toggle-block" data-title="const a = 1\n\nconst b = 2" data-collapsed="false">`.
  4. No markdown-it, o `html_block` termina na linha em branco, e o resto do título vira parágrafo com `&quot;`.
  5. No HTML, o valor do atributo não fecha até o fim do texto, e a tag inteira é descartada.
- **Efeito:** ao reabrir a nota, ela vem vazia. A reprodução A deu o doc reaberto como `[paragraph]`, com o markdown regravado `""`. O texto depois do toggle some junto, e a próxima edição grava a nota vazia. Um título de toggle com quebra simples sobrevive (reprodução A2).
- **Origem:** o caminho já existia no toggle antigo, que punha no título o texto selecionado. O wrap novo (E2) manteve o caminho, e a correção do item 4 da Fase A não cobre o título.
- **Correção sugerida:**
  - no `escapeAttr`, codificar `\n` como `&#10;` e `\r` como `&#13;`, para a tag de abertura ficar numa linha só. Isso cobre também o título colado no span e as notas antigas. O `parseHTML` e o `replaceToggleBlocks` já decodificam as entidades;
  - no `wrapSelectionInToggle`, só paragraph ou heading viram título. O bloco de código vai inteiro para o corpo;
  - um teste de round-trip com título que tem `\n\n`.

---

## Importantes

### I1 — O wrap descarta link, marca de atenção e nós inline do 1º bloco
- **Onde:** `src/components/Editor/formattingActions.ts:163-165`.
- **Cenário:**
  - "See [docs](https://example.com) and ==this==" + corpo, com Toggle, vira o título "See docs and this". O `href` e a marca somem, e a marca tinha rótulo e aparecia na lista Marks (reprodução B);
  - um task ref ou um lembrete no 1º bloco não entram no `textContent` e somem;
  - duas quebras Shift+Enter colam as palavras ("line1line2", reprodução F);
  - o Ctrl+Z desfaz, mas nada avisa. A triagem pedia "a formatação preservada".
- **Correção sugerida:** usar o 1º bloco como título só quando ele é paragraph ou heading só com texto, sem link, sem marca e sem nó inline. Nos outros casos, o título fica vazio e todos os blocos vão para o corpo.

### I2 — "Turn into" num item com subitens converte os subitens, e não o item
- **Onde:** `src/components/Editor/formattingActions.ts:299-319`. A unidade vem de `blockUnit.ts:39-41`, e o menu, de `BlockGutter.tsx:209`.
- **Cenário:**
  - "- parent / - child one / - child two" com Turn into › Heading 1 no "parent": o "parent" continua item, e os dois filhos viram H1 (reprodução C);
  - a seleção vai de `pos + 1` ao fim do item e cobre a lista aninhada, e o `clearNodes` com o `setHeading` agem nela;
  - numa citação com vários blocos, todos são convertidos;
  - num item simples, funciona (reprodução G).
- **Correção sugerida:** oferecer o Turn into só para a unidade com um bloco de texto (item com `childCount === 1`, citação com um filho), ou limitar a seleção ao 1º filho. Acrescentar o caso ao `formattingActions.test.ts`.

### I3 — Ctrl+K do link não chega ao editor
- **Onde:** `src/components/Editor/Editor.tsx:394-399`. Os títulos que prometem o atalho estão em `formattingActions.ts:59` ("Link (Ctrl+K)") e `LinkPopover.tsx:107`.
- **Cenário:**
  - `src-tauri/src/lib.rs:1795` registra Ctrl+K como atalho global do sistema, que alterna a keep (`:1892`). O registro global consome a tecla antes do WebView;
  - no editor, Ctrl+K abre ou esconde a keep, e a popover do link nunca abre pelo teclado. Ela só abre assim se o registro do atalho falhar;
  - a triagem pediu Ctrl+K (E6) sem ver o conflito, que o próprio relatório da fatia 6 aponta (IA-08).
- **Correção sugerida:** decisão do Coordenador:
  - outro atalho para o link;
  - ou o handler global, com a main em foco, manda um evento para a main abrir a popover em vez de alternar a keep.

  Até a decisão, tirar "(Ctrl+K)" dos títulos.

### I4 — Keep: a recarga ao exibir pode duplicar a nota do dia ou apagar o que foi digitado (fatia 6)
- **Onde:** `src/components/KeepPanel/KeepPanel.tsx:248-307` (`doLoadOrCreateDayNote`) e `:332-358`.
- **Cenário:**
  1. A keep é reexibida com o editor já focado.
  2. O usuário digita durante o `storage.getNotes()`.
  3. O `persistNote` grava a cada tecla, sem debounce (`:100`), e termina antes de a leitura voltar.
- **Com rascunho (IA-20):**
  - a 1ª tecla zerou o `draftNoteIdRef` (`:211`), e o `hasPendingLocalEdit()` já é falso;
  - nasce outro rascunho com outro id, e o `setContent('')` tira o texto da tela, embora ele esteja gravado com o id anterior;
  - a próxima tecla cria uma 2ª nota com o mesmo título.
- **Com nota existente:** a versão lida antes da tecla substitui a local. Essa janela já existia na Fase A.
- **Correção sugerida:**
  - guardar o `writeSeqRef.current` antes do `await` e manter a versão local se ele mudou;
  - no ramo sem nota no banco, manter o `local` do mesmo dia que já foi gravado;
  - outra opção é comparar o `updatedAt` local com o lido.

---

## Nits

- **N1 — O Ctrl+F abre e grava toggles enquanto se digita a busca.**
  - **Onde:** `SearchInNote.tsx:136-147`, com o `revealMatch` em `:76-91`.
  - **Cenário:** a cada tecla, a 1ª ocorrência pode estar num toggle fechado. O toggle abre e fica aberto, inclusive os abertos pelas buscas intermediárias. Só por buscar, a nota é gravada, o `updatedAt` muda e a nota é reexportada para o RAG.
  - **Correção:** abrir o toggle só na navegação (Enter, setas), ou fechar ao sair da busca os toggles que ela abriu.
- **N2 — Mais de uma ocorrência no mesmo título de toggle.**
  - **Onde:** `ToggleBlockView.tsx:13-16`.
  - **Cenário:** o `decorations.find` pega a 1ª decoração. Quando a ocorrência atual é a 2ª do título, ele não aparece como "current".
  - **Correção:** preferir `'current'` quando houver.
- **N3 — Código morto (a regra do projeto pede remover).**
  - **Onde:**
    - `CommandExtension.ts:15-22` (`CommandRun.at`) e `:164-176` (fallback do card de erro sem `commandId`);
    - `Editor.tsx:497` (`at: Date.now()`);
    - `useAi.ts:318-329` (`commandId` opcional e fallback `nanoid()`, que levam o import junto);
    - `useAi.ts:368` e `:377` (`hasActiveStream`, que ninguém lê).
  - **Motivo:** as 12 chamadas de `addErrorCard` (`App.tsx:2397-2688` e `:2785`) passam o `commandId`.
- **N4 — Retry de um card interrompido (fatia 6, com efeito na linha da fatia 2).**
  - **Onde:** `App.tsx:4803-4807` e `AiCard.tsx:152-153`.
  - **Cenário:**
    - o Retry apaga sem confirmação a resposta parcial;
    - ele usa um `commandId` novo, e a linha guarda o antigo. O `canRunAgain` (`CommandExtension.ts:180-186`) não acha a resposta, e o Enter na linha já verde roda o comando de novo, num pedido pago.
  - **Correção:** reaproveitar o `commandId`, tirando-o do `stoppedRef` no `prepare` (`useAi.ts:185`), ou religar a execução da linha ao id novo. Também não apagar o texto parcial sem confirmação.
- **N5 — Card de erro com a query crua.**
  - **Onde:** as chamadas de `addErrorCard` em `App.tsx:2397-2688` e `:2785`.
  - **Cenário:** o card de erro grava a query de um comando que não aceita query, como "/summarize foo". O `prepare` e o `start` normalizam com `def.takesQuery`, e o Retry repassa a query crua.
  - **Correção:** normalizar a query uma vez só e usá-la em todas as chamadas.
- **N6 — O "Settings" do Assistant não respeita o onboarding.**
  - **Onde:** `App.tsx:2262-2267`.
  - **Cenário:** o modal fica aberto por trás do onboarding e aparece quando ele termina. Também abre a seção padrão, mesmo quando o clique vem da faixa da chave.
  - **Correção:** chamar o mesmo caminho do `handleOpenSettings` (seção OpenRouter), com a guarda.
- **N7 — Duplicate de toggle ou item com um par /comando + bloco de IA dentro.**
  - **Onde:** `BlockGutter.tsx:212`, que só olha a unidade.
  - **Cenário:** a cópia leva o mesmo `commandId`, e com o wrap novo é fácil o par ir para dentro de um toggle. Ficam dois blocos da mesma resposta, e a exclusão pelo card (IA-02) esvazia os dois.
  - **Correção:** esconder o Duplicate quando o intervalo da unidade tem um `embedBlock`.
- **N8 — Dentro de um toggle, o Toggle da régua desfaz o toggle de fora.**
  - **Onde:** `formattingActions.ts:129-131`.
  - **Cenário:** com blocos selecionados dentro de um toggle, o botão desfaz o toggle de fora em vez de embrulhá-los. O title "Toggle: the first block becomes the title" não diz isso.
  - **Correção:** trocar o title quando o botão está ativo, por exemplo "Remove toggle (the title becomes a paragraph)".
- **N9 — O `[[` da nota lateral (aba Open) busca só o caderno dela.**
  - **Onde:** `App.tsx:4350`, que passa só as notas do caderno da nota lateral e não passa `notebooks` nem `currentNotebookId`.
  - **Motivo:** o E5 pede "busca em todos os cadernos". O codeAgent registrou a lacuna, e a correção é passar as mesmas props do editor principal.

---

## Conferido sem achado

### Editor
- **Undo e round-trip:**
  - o wrap e o Turn into › Toggle desfazem com um Ctrl+Z (reprodução D);
  - o unwrap, o Duplicate, o Delete do bloco de IA, o Delete da linha e o Insert são uma transação cada;
  - o toggle numa citação, o wrap de parágrafos e o de listas têm round-trip estável (reprodução E e testes do codeAgent).
- **E1:**
  - o `deleteBlockUnit` e o Delete da linha do /comando tiram o bloco só da nota;
  - o `onRemoveResponse` saiu de `Editor`, `BlockGutter`, `CommandExtension` e `TaskModalEditor`, e o grep por ele, pelo `insertNewFormattedLine` e pelo `ContextMenu.module` não acha nada.
- **Menus por portal:**
  - Insert, link, NotePicker, autocomplete, TimePicker, AddTaskPopover e o menu do bloco usam `position: fixed`, z-index 1100 e `useAnchoredPosition` (vira para cima com `lineTop`);
  - o Esc fecha e devolve o foco à nota;
  - os listeners de `document`, `window` e `editor.on` são removidos no cleanup;
  - o `iconMarkup` desmonta a raiz.
- **Paste:**
  - segue o pipeline do Ctrl+V: `pasteHTML` e `pasteText` passam pelo `transformPastedText` do Mermaid e do tiptap-markdown;
  - a imagem vira data URL, como no `handlePaste`;
  - o `handlePaste` aceita o `clipboardData` nulo do evento sintético;
  - sem acesso ao clipboard, aparece a mensagem.
- **Ctrl+F:**
  - a busca dobra o texto caractere a caractere e guarda a posição de cada um;
  - ela atravessa negrito e link, não cruza nó inline e pega o título do toggle.
- **`[[` e `@`:**
  - nenhum dos dois abre dentro de código (bloco, Mermaid ou inline), e o `@` só abre no começo de palavra;
  - cancelar o NotePicker devolve o `[[`;
  - o NotePicker ignora acento, deixa de fora as notas arquivadas e põe o caderno atual primeiro.
- **Drag de bloco:** o `trackHandlePress` e o alvo pelo Y não mudaram. O menu do bloco só mudou o conteúdo e a posição.
- **Contrato do `AiResponseStatus` na linha do /comando:**
  - `preparing` e `streaming` ficam roxos, com o `statusText` e depois "Responding…";
  - `completed` fica verde, `error` usa o estilo de erro e `interrupted` mostra "Stopped";
  - "Running…" aparece até o card chegar;
  - o Enter só executa no topo (`getCurrentCommandLine` lê `node(1)`);
  - o selo "web" vem de `findAgent(cmd)?.context.web`.
- **`isPotentialCommandLine` novo:** os nomes de todos os comandos casam com a regra, e todo comando que pede query tem `example` para a dica.

### Fatia 6
- O `preparing` e o `statusText` nunca vão para o banco.
- Toda saída do preparo vira card de erro com o `commandId`.
- O Stop no preparo funciona.
- IA-07: a resposta é gravada na nota do Enter.
- IA-03: a chamada bate com a assinatura de `openConversationWithExchange` (`useChat.ts:2531`).
- O `{ __html }` está memoizado no `AiCard`.
- Os listeners novos são limpos.

## Registro (fora do veredito)
- Apagar a nota durante o slash não cancela mais o pedido (o `cancelForNote` saiu do `useAi`). O pedido é pago, e a resposta fica sem nota. O destino das respostas órfãs é decisão do autor.
- Não deu para conferir sem o app:
  - a permissão do `navigator.clipboard.read()` no WebView2 (o fallback existe);
  - o Expand do Mermaid com rótulos em `foreignObject` dentro de `<img>`.
