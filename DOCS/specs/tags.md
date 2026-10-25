# Tags de nota — tema transversal aos cadernos

> Spec de feature (2026-10-24, branch `feat/tag`). Base: `DOCS/features/tags_study.md` (dar função às tags ou removê-las) e `DOCS/reports/24-10-2026/explorerreport_20261024022039.md` §4.1. Par das marcas de atenção (`DOCS/specs/notemark.md`): a tag classifica a **nota inteira** por tema, durável; a marca aponta um **trecho** para revisitar, temporária.

## 1. Conceito

A tag diz **que temas a nota aborda**, atravessando cadernos e matérias: a "Física" de uma aula, de um livro e de uma nota diária. O caderno continua sendo onde a nota vive; o tipo, que espécie de nota ela é. A tag só vale porque leva a **uma lista** que reúne o tema de todos os cadernos.

## 2. Na nota

- **"+ tag"** abaixo do título, com **autocomplete** das tags já usadas (sem caixa nem acento, fora as da nota); ↑↓ e Enter, ou clique.
- Tag igual a uma existente (sem caixa nem acento) entra com a **grafia existente**; não duplica na nota. As tags gravadas não são fundidas nem renomeadas.
- **Clicar na tag** da nota abre a lista dessa tag (§3); o "×" ao lado remove a tag da nota.

## 3. Lista da tag (coluna das notas)

- Abre pela **seção "Tags" da coluna de cadernos** (cada tag com a contagem de notas) ou pela tag no editor. Clicar na tag ativa da seção fecha a lista.
- Mostra as notas com a tag **de todos os cadernos**, agrupadas por caderno na ordem da coluna de cadernos; em cada grupo, as mexidas por último primeiro. Cada linha: tipo (na cor do tipo), título, rótulo Daily/Task quando é nota diária ou nota de task, prévia do texto e as **outras tags da nota** — clicar numa delas troca a lista para ela.
- Filtro de texto (título, tags e prévia) e chips com todas as tags e a contagem, para trocar de tag sem a coluna de cadernos (que pode estar recolhida).
- **Arquivadas** ficam fora; o rodapé "Archived · N" mostra/esconde (no fim de cada grupo). A contagem da tag inclui as arquivadas.
- O clique abre a nota no editor e **a lista fica**; navegar por fora (caderno, Ctrl+P, link) fecha, como na visão Tasks e na lista de marcas. Marcas e tag dividem o lugar: abrir uma fecha a outra.
- A lista de notas do caderno não filtra mais por tag (o filtro antigo agia só dentro do caderno aberto, que era o motivo de a tag não ter uso).

## 4. Busca

- Ctrl+P **`tag:Nome`** (sem espaços, como o `type:`): filtra pela tag (sem caixa nem acento), com chip removível; combina com `#Caderno`, `type:`, `is:archived` e com as marcas (`has:mark tag:Nome` = marcas das notas com a tag); tira a seção de tasks. O resultado mostra a tag que explica a nota (a do filtro ou a que casou com a busca). Sem boost de ranking por tag.
- A busca por significado respeita o `tag:`.

## 5. Regras de comparação

- Chave da tag: sem caixa, sem acento, espaços colapsados (`src/lib/noteTags.ts`, `tagKey`). Variações contam juntas e aparecem com a grafia mais usada.
- Entram notas de caderno (incluindo notas de task e diárias); notas sem caderno (legado do Reader) ficam de fora, porque não abrem pela lista.

## 6. Fora de escopo / depois

- Renomear/mesclar tags globalmente (adiar até haver volume real).
- Combinar tags (notas com A **e** B).
- Conversar com a IA só sobre as notas de uma tag (escopo explícito do chat, sem boost no RAG).
- Tags em tasks (a task usa projeto, TODOS e status).
