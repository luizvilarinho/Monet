# Estudo — Tags: dar função útil ou remover

> Data: 2026-10-15 · Somente leitura (nenhum código alterado) · Base: develop (working tree com Tasks v2)
> Pergunta do Coordenador: "as tags estão sem função útil e eu nem as uso".

---

## 1. TL;DR

- Tags existem **só em notas** (`Note.tags: string[]`). **Task não tem campo de tag**; o que o Coordenador vê na barra da task é a linha de tags da *nota-corpo* da task.
- Hoje as tags fazem 4 coisas pequenas: filtro por tag na lista de notas (sidebar), busca textual, um peso (Jaccard) no ranking de "Related content", e uma linha `Tags: x, y` no texto enviado ao RAG/chat. Nada disso gera payoff visível.
- Não são usadas por **fricção sem retorno**: precisa digitar manualmente, não há autocomplete/sugestão, não aparece em Tasks, Calendar, Library, chat nem no Kanban, e o `#` (símbolo natural de tag) já é **projeto/caderno** no quick-add das tasks — conflito conceitual.
- Mercado: tags valem a pena quando (a) são **quase de graça de criar** (inline, autocomplete ou sugeridas) e (b) levam a **uma visão/filtro transversal** que o usuário reabre sempre.
- **Recomendação:** não remover ainda. Fase 1 mínima = **tags viram um eixo transversal de filtro** (chip de tag no filtro de Tasks + Notas, cruzando cadernos), com autocomplete das existentes e **sugestão sob demanda** pela IA. Se em ~4 semanas o Coordenador continuar sem usar, **remover** (custo baixo, projeto pré-lançamento).

---

## 2. Inventário (onde tags vivem hoje)

| Camada | Onde | O que faz de fato |
| --- | --- | --- |
| Tipo | `src/types/index.ts:25` `Note.tags: string[]` | Único modelo. `Task` não tem tag. `Notebook` tem `color`, tag não. |
| Storage | `src-tauri/src/lib.rs:1251` coluna `tags TEXT '[]'` (JSON); `src/storage/tauri.ts:141-159, 637-653` | Persistência. Busca SQL: `OR LOWER(tags) LIKE $1` (`tauri.ts:675`). |
| Editor | `Editor.tsx:806-905` linha "+ tag" abaixo do título, chips removíveis, input "new tag"; remove `#` | Única porta de entrada. Sem autocomplete, sem lista das existentes, sem cor. Também no Reader (`ReaderNotesPanel.tsx:280`). |
| Sidebar | `NotebookList.tsx:655-660` bloco "tags" + `App.tsx:1009, 1052-1057` filtro `activeTag` e busca por tag | Filtra a lista de notas do caderno atual por **uma** tag. Escondido; "no tags" na maioria dos casos. |
| Related content | `RelatedContent.tsx:61`, `scoreNotes.ts:67-88` | Jaccard de tags entra no score (`TAG_WEIGHT`) e mostra chips. Sem tags vale 0. |
| RAG / chat | `noteFileText.ts:256` linha `Tags: ...` no cabeçalho do arquivo da nota indexado | Entra como texto no embedding; **não há filtro/escopo por tag** no RAG nem no chat. |
| Tasks | `lib/tasks.ts:673`, `taskQuickAdd.ts` (`findProjectByTag`) | Atenção: aqui "tag" = `#Projeto` (caderno), não `Note.tags`. `tasks-query` com `#PORTO` = projeto. Tags reais **não** filtram tasks. |
| Calendar / KB / Library / Highlights | nenhum uso | Zero. |
| Criação | `App.tsx:578`, `useNotes.ts:73`, `KeepPanel.tsx:122` | Sempre `tags: []`. Nenhuma criação automática (IA, quick-add, importação). |

**Por que não são usadas**
1. **Custo de criar, zero retorno percebido:** clicar, digitar, e o resultado é um chip que não leva a lugar nenhum.
2. **Escopo errado:** o filtro só atua dentro do caderno aberto; tag só tem valor se **cruza** cadernos (o caderno já é o agrupador principal, a tag duplica o caderno).
3. **Colisão com `#`:** o Coordenador usa `#PROJETO` para projeto/caderno; tag e projeto competem pelo mesmo gesto.
4. **Tasks (onde ele vive hoje) não têm tag**; Tasks v2 já tem projeto, grupo, status, prioridade, scheduled/due, então o espaço "classificar" está ocupado.
5. **Sem descoberta:** a lista de tags na sidebar não tem contagem, cor nem saved view.

---

## 3. Mercado (o que faz tag valer a pena)

| Produto | Função que dá payoff |
| --- | --- |
| Obsidian | `#tag` inline no texto (zero fricção) + painel com contagem + busca `tag:` + aninhamento `#a/b`; queries (Dataview). |
| Notion | Multi-select vira **filtro/grupo/vista** de database. Tag só vale por causa das views. |
| Todoist labels | `@label` como **contexto transversal** ao projeto; filtros salvos (`@casa & hoje`). Caso mais próximo de Tasks. |
| Things | Tags de contexto/pessoa/ferramenta; filtro por tag dentro de qualquer lista (Hoje, Próximos). Leve e opcional. |
| Readwise / Reader | Tag em documento e em highlight; **auto-tag por IA** opcional; revisão filtrável por tag. Payoff = revisitar. |
| Capacities | Substitui tag por **tipos de objeto**; tag fica secundária. Sinal de que tipo/caderno frequentemente basta. |
| Logseq | Tag = link para página (`[[x]]`/`#x`) com backlinks. Payoff = agregação automática. |

Padrões comuns: (1) inline/sugerida, não formulário; (2) **uma visão que agrega tudo com a tag**; (3) filtro combinável em listas que o usuário já abre todo dia; (4) IA como sugeridora, não obrigação.

---

## 4. Propostas priorizadas

Esforço: P (até 1 dia), M (2-4 dias), G (1+ semana).

| # | Proposta | Valor | Esforço | Riscos | Conflito com PRD §9 |
| --- | --- | --- | --- | --- | --- |
| A | **Autocomplete + lista de tags existentes** no "+ tag" (ordenada por uso) | Médio (tira fricção) | P | Nenhum | Nenhum |
| B | **Filtro transversal por tag**: chip de tag no filtro de Tasks e na lista de notas, **cruzando cadernos**; `tasks-query` aceita `tag:x` | Alto | M | Task não tem tag: usar tags da nota-corpo/nota de origem (derivado) ou adicionar `Task.tags` | Nenhum (segue pessoal, sem PM) |
| C | **Tags em Tasks**: `Task.tags` + token `@contexto` no quick-add (`#` segue = projeto) | Alto para uso real | M | Vira "mini-Todoist"; manter 1 nível, sem hierarquia/automação | Tangencia "não é PM"; aceitável se for só filtro |
| D | **Tag como escopo do RAG/chat** ("perguntar só sobre notas #x") | Alto p/ persona autodidata | M | Metadado no retrieval (`monet-vec.db`); reindexar | Alinha com a tese (material do usuário no centro) |
| E | **Saved views por tag** (pin de tag na sidebar) | Médio | P-M | Só vale se B existir | Nenhum |
| F | **Auto-sugestão sob demanda** (botão "suggest tags": IA propõe entre as existentes + novas) | Médio | P-M | Não pode ser automática (IA convocada, preserva elaboração) | Nenhum se sob demanda e confirmada |
| G | **Tags em highlights/livros da Library** + revisão por tag | Alto no longo prazo | G | Highlight hoje sem tag; ligar Library e notas | Nenhum |
| H | **Tag como "tema" no Calendar** (cor/filtro nos cards datados) | Baixo-médio | M | Mais ruído visual | Nenhum |
| I | **Tag colorida** (paleta de `ColorDots`) | Baixo | P | Cosmético | Nenhum |
| J | **Remover tags** | Corta código/UI | P | Perde dados existentes (aceitável, pré-lançamento); perde o peso no Related | Nenhum |

Arquitetura: o ganho de B/C/D/E vem de **um conceito único** (tag = eixo transversal de filtro) reaproveitando o filtro de projeto de Tasks v2. O `allTags` derivado já existe (`App.tsx:1009`).

---

## 5. Recomendação

**Fase 1 (mínima, ~3-4 dias): tag como filtro transversal**
1. A (autocomplete) e, opcional, I (cor).
2. B: filtro de tag na lista de notas **sem limitar ao caderno** e no filtro de Tasks (via tags da nota-corpo, sem campo novo). `tasks-query` aceita `tag:x`.
3. F como botão sob demanda (reusar o modelo barato já usado no roteamento de web search).
4. Medir: quantas notas/tasks têm tag após 4 semanas.

**Fase 2 (só se a Fase 1 pegar):** C (`@contexto` com `Task.tags`), E (saved views), D (escopo do RAG/chat).

**Descartar por ora:** H (ruído no Calendar), G (depende do modelo da Library), hierarquia `#a/b`, tags automáticas sem confirmação (contraria a tese).

**Critério de corte:** sem uso do filtro transversal em 4 semanas, **remover tags (J)**: linha do editor, bloco da sidebar, peso em `scoreNotes` e `Tags:` em `noteFileText`. Caderno + projeto + grupo + Related por conteúdo já cobrem a classificação.

---

## 6. Decisões necessárias do Coordenador

1. **Tentar a Fase 1 ou remover já?** Prazo de avaliação (sugestão: 4 semanas)?
2. **Tags em Tasks:** derivar da nota-corpo (sem campo novo) ou criar `Task.tags` com `@contexto`? (`#` fica reservado a projeto.)
3. **Filtro cruza cadernos?** (recomendado: sim.)
4. **IA sugere tags?** Só sob demanda e confirmada, ou não usar IA aqui?
5. **Tag como escopo do chat/RAG** vale a reindexação? (Fase 2)
6. **Descartar dados:** aceitável apagar `notes.tags` se for removido? (pré-lançamento, em princípio sim)
