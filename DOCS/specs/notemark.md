# Marcas de atenção (NoteMark) — v2

> Spec de feature. A **v2** (2026-10-24, refinamento) substitui a v1 do mesmo dia, cujo registro está em `DOCS/reports/24-10-2026/` (`planreport_20261024121941.md`, `reviewreport_20261024130514.md`). Relacionadas: `explorerreport_20261024022039.md` (tags e marcadores de trecho), `taskreport_20261024114506.md` (pedido de implementação) e `DOCS/specs/tags.md` (tags de nota).

## 1. Conceito

Uma **marca** é um trecho de nota que o usuário marcou para **voltar a ele**: um ponto de atenção (algo a pesquisar, a revisar, uma dúvida). Tem **rótulo opcional**, um texto curto livre ("Pesquisar", "Revisar", "Dúvida"), com autocomplete dos rótulos já usados. Sem rótulo, é um ponto de atenção genérico.

| Conceito | Pergunta que responde |
|---|---|
| Tag de nota | Que temas transversais a nota inteira aborda? (durável) |
| Highlight | Que trecho é importante na leitura? (ênfase visual) |
| **Marca** | Que trecho preciso revisitar, e por quê? (temporária, sai quando resolvida) |
| Task | Que ação tenho de executar e acompanhar? (prazo, status) |

Princípios:

- **A marca é do trecho, não da nota.** Acompanha o texto em edições, cópias e movimentos; apagar o texto apaga a marca (sem órfãos).
- **Criar, rotular e resolver é trivial.** Um clique (ou Ctrl+Shift+M) marca; o rótulo é opcional; "Resolve" desfaz a marca e mantém o texto.
- **Só em notas de caderno.** Library, tasks e chat não têm marcas próprias (o chat só *cita* marcas).
- **A IA lê e cita, nunca escreve.** Nenhum caminho da IA cria, remove ou resolve marca.
- "Temporária" = removível pelo usuário; nunca expira sozinha.

## 2. Persistência

- Markdown: `<mark data-mark="Rótulo">texto</mark>`; `data-mark=""` = sem rótulo. Mesmo padrão do highlight (`<span data-bg>`).
- **Por que HTML e não `==texto==`** (formato da v1): o `==` não volta no round-trip quando a borda da marca tem espaço — o clique duplo do Windows seleciona o espaço depois da palavra, e a marca virava `==palavra ==`, que ao reabrir a nota aparecia como texto com os `==`; perdia o `=` vizinho (`x` marcado + `=y` virava `xy`); dentro de toggles a marca já era gravada como `<mark>` e ficava invisível para a busca e a IA; e não há onde guardar o rótulo. Verificado no editor real (harness).
- O parse pede o atributo: `<mark>` sem `data-mark` (colado da web) não vira marca.
- `==texto==` **não é lido do markdown** (a dependência `markdown-it-mark` saiu): colar markdown do Obsidian ou inserir resposta da IA não cria marca. O `==` existe só como (a) atalho de digitação (input rule) e (b) a forma que a IA lê e cita (§6).
- Mark Tiptap `noteMark` (`src/components/Editor/NoteMark.ts`): atributo `label`, `priority: 1001` (mark mais externo: um `<mark>` só por trecho no DOM e no markdown), `inclusive: false` (digitar logo depois não estende a marca). Entra no schema compartilhado (`buildBaseExtensions`), senão Keep/Reader a descartariam no autosave.

## 3. No editor

- **R1 — Régua de seleção:** botão **Mark** (marca ou desmarca o trecho; apara espaços e fronteiras de bloco nas bordas) e a **seta** ao lado, que abre os rótulos e marca já com o escolhido. Estender uma marca mantém o rótulo dela.
- **R2 — Atalhos:** Ctrl+Shift+M (marca/desmarca; sem seleção, desmarca a marca sob o cursor) e `==texto==` digitado (sem espaço nas bordas; não aplica em código).
- **R3 — Rótulo:** popover com os rótulos já usados (mais usados primeiro), filtro sem caixa nem acento; Enter completa o existente ("revi" → "Revisar"); "New label" no fim cria o digitado. Até 40 caracteres.
- **R4 — Menu da marca:** abre no **clique** numa marca (não ao passar o cursor digitando ou com as setas); some ao editar, ao sair da marca ou com Esc. Ações: rótulo (trocar/adicionar), **Ask AI** (trecho para o chat do caderno), **Copy**, **List** (lista de marcas no rótulo dela) e **Remove mark**. Ancorado na 1ª linha da marca.
- **R5 — Ctrl+clique** numa marca = **List**.
- **R6 — Visual:** texto na cor do tema, sublinhado âmbar de 2px (`--nm`, separado do laranja das tasks e do amarelo do highlight) e fundo sutil; o rótulo aparece como pílula pequena depois do trecho (não entra na seleção nem na cópia).

## 4. Encontrar e revisar

- **R7 — Coluna de cadernos, seção "Marks"** (abaixo de Tags): "all marks" e um item por rótulo, com contagem. O clique abre a lista de marcas no filtro; clicar no filtro ativo fecha a lista.
- **R8 — Lista Marks** (coluna das notas, como a visão Tasks): todas as marcas das notas de caderno **não arquivadas**, agrupadas por nota (notas mexidas por último primeiro), com caderno, rótulo e o trecho no contexto do bloco. Filtro por texto e chips de rótulo (All, cada rótulo, No label). O clique abre a nota **na marca** e a lista fica (navegação da própria lista); **Resolve** desfaz a marca pela nota aberta no editor. Navegar por fora (caderno, busca, link) fecha a lista, como na Tasks.
- **R9 — Ctrl+P:** `has:mark` (chip **Marks**, sempre visível) lista marcas — uma linha por marca, com rótulo e contexto; `mark:Rótulo` filtra o rótulo (chips dos rótulos aparecem com o filtro ligado); combina com `#Caderno`, `type:`, `tag:` e `is:archived` (arquivadas por último). A busca por significado não se aplica às marcas.
- **R10 — Abrir na marca:** a nota abre rolada até a marca, com o cursor nela, o menu da marca aberto e um flash curto.

## 5. Identidade da marca (navegação e Resolve)

- A marca é identificada por **índice em ordem de documento + texto**. A extração para listas e IA (`extractNoteMarks`, `src/lib/noteMarks.ts`) usa o **mesmo parser do editor** (markdown-it com HTML) e as mesmas regras de run do ProseMirror (`noteMarkRuns`): marcas coladas com o mesmo rótulo são um run; trecho só de espaço é descartado nos dois lados. Paridade verificada em parágrafo, lista, título, citação, tabela, toggle, quebra de linha e negrito dentro da marca.
- O Editor confere o texto do run do índice; se não bater (nota editada desde a lista), usa o run de mesmo texto mais perto do índice. `reveal` ainda vai ao índice sem texto igual; **`resolve` não mexe em nada** sem texto igual (nunca desmarca a marca errada).
- Contexto: até 90 caracteres antes e depois, dentro do bloco, com o espaço da borda como está (a marca pode estar no meio de uma palavra).
- Imagens coladas (data URL de MB) ficam fora do parse: a extração da nota com imagem custa ~5 ms em vez de ~100 ms.

## 6. IA

- **Texto para a IA e o RAG** (`cleanNoteContentForAi`): cada marca vira `==texto==`, seguida de ` [mark: Rótulo]` quando há rótulo — inclusive dentro de toggles.
- **System prompt (seção "Marks"):** marcas são pontos de atenção do usuário; citar verbatim como `==texto==` (sem o rótulo); `==` só em volta de marcas; a IA nunca cria, remove ou resolve marcas.
- **Tool `search_marks`** (sob o toggle "Notes", sem toggle novo): parâmetros `query`, `label`, `notebook`; devolve trecho, rótulo, contexto, nota e caderno, mais a linha "Labels in use" (a IA mapeia "o que marquei para pesquisar?" para o rótulo certo). Read-only; cadernos com a IA desligada ficam de fora; orçamento de 5000 caracteres / 60 marcas; lê só as notas com marca (`storage.getMarkedNotes`).
- **R11 — Citação clicável:** nos chats, `==texto==` da resposta vira marca clicável (`<mark data-nm>`, fora de código). Clique: texto igual (sem caixa nem acento) e, sem isso, citação parcial; **uma** nota abre na marca; **várias ou nenhuma** abrem o seletor ("This mark no longer exists…" quando não há). Na janela Assistant (Ctrl+M) o clique traz a janela principal e abre a nota. No chat do Reader a citação só aparece marcada (navegar tiraria o usuário do livro).
- **R12 — A IA não cria marcas:** "Insert" e "Save to note" transformam a citação `==texto==` em texto simples; o `data-nm` do chat não é lido como marca ao colar/inserir HTML.

## 7. Tags de nota

A metade de tags do pedido (autocomplete, `tag:` no Ctrl+P) e a lista transversal da tag estão em `DOCS/specs/tags.md`. A lista da tag divide a coluna das notas com a lista de marcas: abrir uma fecha a outra.

## 8. Edge cases

| Caso | Comportamento |
|---|---|
| Texto marcado editado/movido/apagado | A marca segue o conteúdo; apagado o texto, some a marca. |
| Copiar/colar trecho marcado | Duplica a marca (é do trecho); ocorrências repetidas navegam pelo índice. |
| Marca com espaço na borda | O Mark apara; se a edição deixar espaço na borda, o HTML grava e reabre igual. |
| `<mark>` colado da web / `==x==` em markdown colado | Não vira marca. |
| Marca em código | Impossível no editor; texto literal em código não conta. |
| Nota arquivada | Fora da lista Marks e das contagens; no Ctrl+P (`is:archived`/por último) e para a IA (marcada como archived). |
| Caderno com a IA desligada | Fora da IA (tool e RAG); visível nas listas. |
| Nota de task e nota diária | Entram nas listas (são notas de caderno). |
| Rótulos com caixa/acento diferentes | Contam juntos; aparece a grafia mais usada. |
| Citação no chat de marca resolvida | Seletor avisa que a marca não existe mais. |

## 9. Fora de escopo / depois

- Converter marca em task (sempre explícito).
- Marcas em grifos da Library.
- Teclado na lista Marks (↑↓, Enter, "resolver e ir para a próxima").
- Renomear/mesclar rótulos e tags globalmente.
- Expiração automática (não fazer).

## 10. Decisões

**Coordenador (v1, 2026-10-24):** marca de trecho genérica no lugar do label fixo `Pesquisar`; criar pela régua e por `==texto==`; `has:mark` com chip no Ctrl+P; tool sob o toggle "Notes"; seletor quando a marca citada no chat existe em várias notas; seção "Marks" abaixo de Tags; Ctrl+clique na marca; atalho de marcas no Ctrl+P.

**Refinamento (v2, 2026-10-24)** — ver a sessão correspondente em `DOCS/reports/24-10-2026/executionreport_20261024115058.md`: persistência em HTML com `data-mark`; rótulo opcional; botão "Mark" (não "Tag", para não confundir com a tag de nota) com seta de rótulos e Ctrl+Shift+M; menu só no clique; lista Marks como caixa de revisão com Resolve; seção "Marks" com rótulos e contagens (não a lista de trechos); Ctrl+clique e "List" abrem a lista no rótulo (o seletor por texto ficou só para o chat); `mark:` no Ctrl+P; identidade por índice + texto com o mesmo parser do editor; IA vê `==texto== [mark: Rótulo]` e não cria marcas por Insert/Save; tags de nota com autocomplete e `tag:`.
