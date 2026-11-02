# Backlog

Bugs e ideias registrados pelo Coordenador ou deixados para trás nas entregas, ainda sem task. Ao virar task, mova o item para o Task Report correspondente e apague daqui.

---

## Bugs

- **Esc no "New TODOS…" do popover do card (2026-10-21):** no popover de campos do card (nota TODOS), Esc dentro do input do rascunho fecha o popover inteiro em vez de só cancelar o rascunho. O listener de Esc do `CardFieldsPopover` (`TaskRefView.tsx`) é de captura e roda antes do `onKeyDown` do `TodosControl`.
- **Tempos ausentes em resposta de erro no Chat/Assistant (2026-10-21):** o `ChatMessageBubble` não renderiza o rodapé em mensagem de erro, então a linha de tempos "interrupted" (com "Retrieval details" ligado) só aparece no NotesChat e no Reader.
- **Trecho marcado que atravessa Shift+Enter se parte no reload (2026-11-02):** marca de atenção, highlight ou termo do Related content sobre um trecho com quebra de linha (Shift+Enter) volta, ao reabrir a nota, com o parágrafo partido em dois e a 2ª linha sem a marcação. Já existia antes do termo do Related content (achado pelo codeAgent da task feat/related-terms). Causa provável no `updateDOM` do `ParagraphWithBlankLines` (`src/components/Editor/extensions.ts`), caminho `br.closest('p')`.

---

## Ajustes

- **Formatação do item ao renomear a task por fora (2026-10-21):** renomear a task no modal, na lista ou no quick add reescreve o item (origem e TODOS) como texto simples. Negrito/código do item somem e crases do título aparecem literais. O título da task guarda a sintaxe markdown do item (`extractTaskRefTitles` só tira escapes e entidades). Caminho: extrair o texto visível (renderizar o inline) e reescrever preservando as marcas quando possível.

- **`SELECT *` + `addMissingColumns` (2026-10-29):** na primeira abertura depois de uma coluna nova, o sqlx pode entrar em pânico (`index out of bounds`), porque uma conexão do pool prepara o `*` com o schema antigo. O `getNoteTypes` já foi corrigido com colunas explícitas (feat/board-view). Revisar as outras tabelas que usam o mesmo padrão em `src/storage/tauri.ts`.

- **Related content no modal da task e no "Edit note" do board (2026-11-02):** o botão "Related" da régua existe no modal da task (`TaskModalEditor.tsx`), mas o modal não mostra o painel do Related content; o mesmo vale para o "Edit note" do board. Sugestão S2 do uxAgent (`DOCS/reports/02-11-2026/uxreport_20261102035930.md`): montar o painel no modal e, no clique num card, fechar o modal e navegar como no Ctrl+P.

- **Glifos no lugar de ícones Phosphor (2026-11-02):** a busca na nota usa ↑ ↓ ×, o cabeçalho do Related content usa ›, e a régua usa ≡ ☐ ▶ 🖼 🔗. Trocar por ícones Phosphor (regra do projeto). Apontado pelo uxAgent (mesmo relatório).

- **Export .md com HTML das marcas (2026-11-02):** o export .md (`handleExport`, `App.tsx`) grava `<mark data-mark>` e `<span data-bg>` como HTML cru. O termo do Related content já sai limpo (`stripRelatedTermTags`). Caminho: desembrulhar os dois na mesma função. O text/plain do clipboard (`serializeBlocks` em `MonetClipboard.ts`, copiar para fora do Monet) vaza os mesmos dois do mesmo jeito; o termo já sai limpo ali também. Limpar o export e o clipboard juntos (o paste interno usa o HTML e não é afetado).

---

## Ideias

- **Tipos de nota/TODOS — fase 5 (2026-10-20):** remover `task_group` 4 semanas após o release da 1.5.0.
- **Busca FTS5 — plano B (2026-10-20):** só se a busca do Ctrl+P voltar a ficar lenta (ver `DOCS/features/note_types_study.md`).
- **`get_note` — próximos passos (2026-10-21):** opcional detectar localmente um título citado na pergunta para pular o RAG; depois, avaliar o Jev (TypeSafe, via OpenRouter) como porteiro antes do RAG.
- **Tags — depois do uso real (2026-10-24):** renomear/mesclar tags globalmente; combinar tags (A e B) na lista; chat com escopo nas notas de uma tag. Ver `DOCS/specs/tags.md` §6.
- **Marcas — depois do uso real (2026-10-24):** teclado na lista Marks (↑↓, Enter, "resolver e ir para a próxima"); converter marca em task (sempre explícito, preservando a origem); marcas em grifos da Library; renomear/mesclar rótulos. Ver `DOCS/specs/notemark.md` §9.
