# Estudo de Usabilidade de Tabelas

**Data:** 11/08/2026
**Contexto:** O Coordenador relatou dificuldade em copiar/colar trechos de tabelas e em mover tabelas como um todo dentro das notas do Monet. Este documento analisa o problema atual, as limitações da biblioteca de tabela em uso e propõe caminhos de melhoria.

---

## 1. Problemas Relatados

1. **Copiar e colar trechos da tabela** é difícil — selecionar um conjunto de células e copiar para outro lugar não preserva a estrutura tabular de forma intuitiva.
2. **Copiar/colar a tabela como um todo** para movimentá-la dentro da nota não funciona como esperado (ex.: arrastar ou copiar uma tabela inteira para outra posição no documento).
3. **Reordenar linhas ou colunas** exige deletar e recriar manualmente — não há drag-and-drop nativo para reposicionar uma linha dentro da tabela.

---

## 2. Stack Atual

- **Editor:** TipTap v3 (`@tiptap/react` 3.23.4)
- **Extensão de tabela:** `@tiptap/extension-table` 3.23.4 (com `TableCell`, `TableHeader`, `TableRow`)
- **Configuração:** `Table.configure({ resizable: true })` em `src/components/Editor/extensions.ts`
- **Drag-and-drop existente:** `@dnd-kit/sortable` 10.0.0 está instalado, mas é usado apenas na sidebar (`NotebookList`), não no editor. Há drag handles customizados implementados em `CommandExtension.ts` para slash commands e task items — mas não para tabelas.
- **Formatação de tabela:** A `FormattingToolbar` (bubble menu) já oferece ações de tabela quando o cursor está dentro de uma: adicionar/remover colunas e linhas, deletar tabela (`TABLE_GROUPS`).

### Limitações conhecidas do `@tiptap/extension-table` v3

- **Sem drag-and-drop nativo** para mover linhas, colunas ou a tabela inteira dentro do documento.
- **Copy/paste de tabelas** depende do comportamento do ProseMirror — copiar células selecionadas funciona dentro do mesmo editor, mas colar em outras notas ou apps pode perder a estrutura.
- **Movimentação da tabela como bloco** não é suportada nativamente — a tabela é um node de nível de bloco, mas não há handle de arrasto para reposicioná-la no documento (como existe para parágrafos no Notion).
- O ProseMirror subjacente tem suporte a `TableMap` e seleção de células (com `Ctrl+click` / `Shift+click`), mas isso não é exposto de forma amigável ao usuário casual.

---

## 3. Propostas de Melhoria

### Proposta A — Drag Handles para Linhas (e Colunas)

**Descrição:** Adicionar handles de arrasto (similar aos já existentes para tasks e slash commands em `CommandExtension.ts`) nas linhas da tabela, permitindo reordená-las verticalmente. Poderia ser estendido para colunas com handles horizontais.

**Implementação:**
- Criar `Decoration.widget` com um handle `⋮⋮` na primeira célula de cada `tableRow` (similar a `makeTaskDragHandle`).
- No `mousedown`, capturar a linha, calcular o destino via `posAtCoords`, e usar `tr.insert`/`tr.delete` para mover a linha.
- Reaproveitar a infraestrutura de `computeDropTarget` e `monetCmdDropIndicator` já existentes.

**Prós:**
- Reutiliza padrão já familiar no app (mesmo estilo dos handles de tasks).
- Solução direta para o problema de reordenar linhas.
- Baixo risco de breaking change — é puramente aditivo (decoração + handler).

**Contras:**
- Não resolve copiar/colar trechos nem mover a tabela inteira.
- Drag de colunas é mais complexo (requer cálculo horizontal) e pode confundir com o `column-resize-handle` existente.
- Mais uma peça de UI para manter.

**Esforço estimado:** Médio (1–2 dias). A maior parte da lógica de drag já existe em `CommandExtension.ts` e pode ser adaptada.

---

### Proposta B — Atalhos de Teclado

**Descrição:** Adicionar atalhos para operações comuns de tabela:
- `Alt+↑` / `Alt+↓` — mover linha atual para cima/para baixo.
- `Ctrl+Shift+C` — copiar tabela inteira para a área de transferência (como HTML).
- `Ctrl+Shift+V` — colar tabela preservando estrutura.

**Implementação:**
- Usar `addKeyboardShortcuts` em uma extensão customizada ou no `editorProps.handleKeyDown` existente.
- Para mover linha: identificar a `tableRow` atual via `$from.node(...)`, trocar de posição com a linha vizinha via `tr`.
- Para copy/paste: interceptar o clipboard, serializar a tabela como HTML (preserva estrutura ao colar de volta) e markdown (para apps externos).

**Prós:**
- Não adiciona UI — ideal para usuários avançados que preferem teclado.
- Rápido de implementar para o caso de mover linhas.
- Pode ser combinado com outras propostas.

**Contras:**
- Atalhos não são descobertos naturalmente pelo usuário (precisam de documentação/tooltip).
- Copy/paste cross-application é complexo e pode ter resultados inconsistentes.
- Não resolve o problema de mover a tabela como bloco dentro da nota.

**Esforço estimado:** Baixo–Médio (0,5–1 dia para atalhos de mover linha; 1–2 dias para copy/paste robusto).

---

### Proposta C — Menu de Contexto (Botão Direito) na Tabela

**Descrição:** Estender o menu de contexto recém-criado (Tarefa 6) para detectar quando o clique direito ocorre dentro de uma tabela e oferecer ações específicas:
- "Copiar linha"
- "Colar linha"
- "Mover tabela para cima/abaixo" (reposiciona o bloco da tabela no documento)
- "Duplicar linha"
- "Copiar tabela inteira"

**Implementação:**
- No handler `contextmenu` existente em `Editor.tsx`, verificar `editor.isActive('table')`.
- Se ativo, mostrar o menu com ações de tabela em vez das ações de formatação genéricas.
- "Copiar tabela inteira" serializa o node `table` para HTML e usa `navigator.clipboard.write`.
- "Mover tabela para cima/abaixo" troca o node `table` de posição com o node irmão anterior/posterior via `tr`.

**Prós:**
- Aproveita o menu de contexto já implementado (Tarefa 6).
- Resolve diretamente "mover tabela como um todo" — o problema mais difícil.
- Descoberta natural (botão direito é um padrão conhecido).

**Contras:**
- Adiciona complexidade ao menu de contexto (lógica condicional tabela vs. texto).
- "Copiar linha" requer serialização parcial e pode ter edge cases.
- Precisa de cuidado para não conflitar com o menu nativo de spell-check.

**Esforço estimado:** Médio (1–1,5 dias).

---

### Proposta D — Handle de Arrasto para Mover o Bloco da Tabela

**Descrição:** Adicionar um handle de arrasto (estilo Notion) no canto superior esquerdo da tabela que permite arrastar a tabela inteira para outra posição no documento. Semelhante ao que editores como Notion e Tiptap Pro oferecem para blocos.

**Implementação:**
- Criar `Decoration.widget` com um handle `⠿` posicionado absoluto no canto da tabela.
- No `mousedown`, capturar o node `table` inteiro (via `$from.node(depth)` até achar a tabela).
- Calcular destino via `computeDropTarget` (já existe em `CommandExtension.ts`).
- Mover o node via `tr.delete` + `tr.insert`.
- Adicionar indicador visual de drop (reutilizar `monetCmdDropIndicator`).

**Prós:**
- Resolve o problema de "mover tabela como um todo" de forma visual e intuitiva.
- Padrão conhecido (Notion, Notion-like editors).
- Pode ser generalizado para outros blocos (blockquotes, code blocks) no futuro.

**Contras:**
- Maior esforço de implementação (posicionamento CSS, cálculo de drop entre blocos).
- Risco de conflito com o `column-resize-handle` existente.
- Precisa de polishing visual considerável.

**Esforço estimado:** Alto (2–3 dias).

---

### Proposta E — Avaliar Bibliotecas Externas

**Descrição:** Avaliar substituir ou complementar o `@tiptap/extension-table` por uma solução mais rica:

1. **`prosemirror-tables`** (de onde o `@tiptap/extension-table` é derivado): oferece mais funcionalidades (merge cells, fix rows/cols), mas não resolve drag-and-drop de blocos. O TipTap v3 já é uma camada sobre este pacote.

2. **Tiptap Pro `Table` extension**: oferece drag handles nativos, merge de células visual, redimensionamento melhorado. **É um produto pago** (requer subscription Tiptap Cloud).

3. **`@tiptap/extension-drag-handle`** ou **`@tiptap/extension-drag-handle-react`** (Pro/Pago): adiciona drag handles para todos os blocos, incluindo tabelas.

**Prós:**
- Solução mais robusta e mantida.
- Menos código custom para manter.

**Contras:**
- **Custo financeiro** (Tiptap Pro é pago, sem preço público — tipicamente $99+/mês).
- Migração pode introduzir regressões.
- `prosemirror-tables` puro exigiria abandonar a camada de abstração do TipTap.
- Pode ser excessivo para o tamanho atual do projeto.

**Esforço estimado:** Alto (2–4 dias para avaliação + migração); custo recorrente se for Tiptap Pro.

---

## 4. Análise Comparativa

| Proposta | Resolve "copiar trechos" | Resolve "mover tabela" | Resolve "reordenar linhas" | Esforço | Custo |
|----------|:---:|:---:|:---:|:---:|:---:|
| **A** Drag handles linhas | ❌ | ❌ | ✅ | Médio | Grátis |
| **B** Atalhos teclado | ⚠️ | ❌ | ✅ | Baixo | Grátis |
| **C** Menu contexto tabela | ⚠️ | ✅ | ⚠️ | Médio | Grátis |
| **D** Handle bloco tabela | ❌ | ✅ | ❌ | Alto | Grátis |
| **E** Lib externa | ✅ | ✅ | ✅ | Alto | $99+/mês |

Legenda: ✅ resolve totalmente · ⚠️ resolve parcialmente · ❌ não resolve

---

## 5. Recomendação

**Recomendação: Combinar Proposta C (Menu de contexto na tabela) + Proposta B (Atalhos de teclado para mover linhas).**

### Justificativa

1. **A Proposta C** resolve o problema mais doloroso — mover a tabela como um todo — com o menor esforço incremental, pois o menu de contexto já existe (Tarefa 6 implementada nesta mesma sessão). Basta adicionar um ramo condicional quando `editor.isActive('table')`.

2. **A Proposta B** complementa com atalhos `Alt+↑`/`Alt+↓` para reordenar linhas rapidamente sem tirar as mãos do teclado — a forma mais eficiente de rearranjar conteúdo tabular.

3. **A Proposta A** (drag handles de linhas) é tentadora pela familiaridade, mas adicionaria uma terceira interação de drag no editor (já temos drag de slash commands e de tasks), aumentando a complexidade visual. Os atalhos de teclado (Proposta B) cobrem o mesmo caso de uso com menos UI.

4. **A Proposta D** (handle de bloco) seria a ideal em termos de UX, mas tem o maior esforço e sobreposição com a Proposta C. Recomendo deixar como evolução futura se o menu de contexto não for suficiente.

5. **A Proposta E** (lib externa) é descartada neste momento pelo custo financeiro e pela complexidade de migração. Pode ser reavaliada se o projeto crescer.

### Próximos Passos Sugeridos

Se o Coordenador aprovar esta recomendação, a implementação seguiria nesta ordem:

1. **Fase 1 — Menu de contexto na tabela (Proposta C):**
   - Detectar `editor.isActive('table')` no handler `contextmenu`.
   - Adicionar ações: "Mover tabela ↑", "Mover tabela ↓", "Copiar tabela", "Duplicar linha", "Deletar linha".
   - Implementar a lógica de mover o node `table` no documento via transações ProseMirror.

2. **Fase 2 — Atalhos de teclado (Proposta B):**
   - `Alt+↑` / `Alt+↓` para mover a linha atual dentro da tabela.
   - Adicionar tooltip ou hint visual para descoberta.

3. **Fase 3 (opcional) — Drag handles de linhas (Proposta A):**
   - Apenas se as Fases 1 e 2 não forem suficientes para o fluxo de trabalho do Coordenador.

---

## 6. Referências

- Código atual de drag handles: `src/components/Editor/CommandExtension.ts` (`makeTaskDragHandle`, `computeTaskDropTarget`).
- Configuração de tabela: `src/components/Editor/extensions.ts` (linhas 113–116).
- Ações de tabela na BubbleMenu: `src/components/Editor/formattingActions.ts` (`TABLE_GROUPS`).
- Handler de menu de contexto: `src/components/Editor/Editor.tsx` (handler `contextmenu`, linhas ~560–576).
- Documentação TipTap Tables: https://tiptap.dev/docs/editor/extensions/nodes/table
- ProseMirror tables: https://github.com/prosemirror/prosemirror-tables
