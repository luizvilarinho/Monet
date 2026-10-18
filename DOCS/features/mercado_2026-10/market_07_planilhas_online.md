# Monet: planilhas nas notas e versão online — contexto para decisão

- **Data da pesquisa:** 2026-10-17
- **Escopo:** (1) se vale ter tabelas/planilhas mais sofisticadas dentro do app; (2) se vale uma versão online/web simplificada, e como.
- **Escala de esforço (dev solo):** P = até 1 dia · M = 2–4 dias · G = 1+ semana.
- **Convenções:** "verificado" = conferido nesta pesquisa em fonte primária (doc oficial, repositório, registro npm, teste com curl). "Inferência" = conclusão minha a partir das evidências. "n/v" = não verificado. Datas de release vêm do registro npm (UTC) ou do changelog oficial. `[Sx]` remete à lista de fontes da seção (e).

## Método e limitações

- A cota de WebSearch da sessão esgotou logo no início. A maior parte da pesquisa usou WebFetch em páginas oficiais, `npm view` (registro npm), páginas e API do GitHub, o JSON público de estatísticas de plugins do Obsidian, os dados de compatibilidade do MDN e testes de CORS com curl. Quando a cota voltou, usei cerca de 10 buscas para cobrir lacunas.
- O Reddit está bloqueado para fetch, e as buscas não trouxeram threads. No HN não encontrei nada relevante. Por isso o sentimento de usuários foi medido por proxies: o fórum oficial do Obsidian, downloads acumulados de plugins e decisões de produto dos concorrentes.
- Li o código do Monet sem alterar nada, para calibrar as estimativas de esforço (seção 1.6).

---

## (a) Resumo executivo

### Parte 1: vale ter planilhas/tabelas sofisticadas?

**Recomendação.** Não construir planilha completa (nível C) nem um "Bases genérico" (nível B2) agora. Se for investir em tabelas, fazer um **nível A enxuto** (P–M, 1–3 dias):

- ordenar por coluna;
- estatística da seleção (soma, média e contagem, como na barra de status do Excel);
- linha de total materializável;
- colar TSV/CSV do Excel/Sheets e exportar CSV;
- ações de IA sobre a tabela ("perguntar" e "transformar").

**Por quê.**

1. **Uso real do Monet (dado do usuário).** As tabelas são quase só listas de referência geradas pela IA. O único caso numérico (dieta) foi abandonado, e os metadados customizados de tasks nunca foram usados.
2. **O mercado pessoal escolheu "views + totais", não fórmulas.**
   - Anytype oferece só agregações no rodapé do Grid, descritas como "visual only" [S9].
   - O Obsidian Bases tem fórmulas por linha e *summaries* por coluna (Sum, Average, Median…) [S4].
   - O Capacities oferece tabelas simples, "sem a necessidade de funcionalidade completa de database", com `=SUM/AVG…` só no plano Pro [S11].
   - O Microsoft Loop tem resumo por coluna e não tem fórmulas estilo Excel (fonte terceira) [S15].
   - O Notion limita gráficos a 1 no plano Free [S7], ou seja, o recurso avançado vira alavanca de venda.
3. **Ecossistema Obsidian (downloads acumulados, snapshot de 2026-10-17)** [S6].
   - Advanced Tables tem **3,29 M** downloads; os três plugins de planilha somados têm **0,34 M** (cerca de 9,6× menos).
   - Dataview tem 5,15 M.
   - Os pedidos mais vistos sobre Bases tratam de visualização e UX (template, busca rápida, calendário, kanban, quebra de linha, imagens), não de cálculo [S5].
4. **As bibliotecas de planilha são pesadas ou têm licença problemática para um app fechado.**
   - Handsontable é comercial; a chave grátis vale só para uso não comercial ou avaliação [S21].
   - HyperFormula é GPL-3.0 ou comercial [S22].
   - No AG Grid, fórmulas são recurso Enterprise [S24].
   - No Univer, import/export, gráficos e pivot são Pro [S20].
   - FortuneSheet pesa cerca de 572 KB gzip [S28].

**Pré-requisito técnico (achado importante).** O Monet persiste markdown com `tiptap-markdown` 0.9.0.

- O README desse pacote diz para preferir a extensão oficial `@tiptap/markdown` (existente desde o Tiptap 3.7.0, de 2025-10-14) e que o autor "não planeja tratar issues/PRs" [S17][S26].
- O serializer de tabela dele cai para HTML em tabelas "complexas" (colspan/rowspan, mais de um bloco por célula, header fora da 1ª linha).
- O delimitador é sempre escrito como `---`, então o alinhamento se perde.
- A largura de coluna (`resizable: true`, configurado no Monet) não vai para o markdown [S17][código].

**Consequência:** qualquer metadado novo de tabela deve morar num nó próprio, serializado como elemento HTML customizado. É o mesmo padrão que o bloco `/tasks` já usa (`<tasks-query data-filter="…">`). Assim ele sobrevive a uma futura migração para `@tiptap/markdown`, que ainda é "early release" e aceita um único nó filho por célula [S16].

**Gatilhos para subir de nível.**

- **B1 (M):** modo "tabela/board" no bloco `/tasks` (colunas, ordenar, agrupar). Só vale se campos e visões de tasks passarem a ser usados de fato.
- **C (G):** só se surgirem 2–3 ou mais tabelas numéricas atualizadas com frequência e "abrir no Excel" não for aceitável. Mesmo nesse caso, começar pelo **C-lite** (P–M): anexar `.xlsx/.csv`, preview só-leitura (SheetJS CE) e botão "abrir no Excel".

### Parte 2: vale uma versão online/web simplificada? Como?

**Recomendação.** Sim, mas **só no escopo Library/Reader para tablet, como PWA standalone sem sync** (opção a). O esforço é M: 3–5 dias de MVP, podendo virar G se a seleção e o grifo por toque no iPad exigirem retrabalho. Antes, fazer **1 dia de spike num iPad real** (checklist em 2.6).

**Por quê.**

- **O Reader já é client-side** (pdf.js). O chat do Reader que foi validado usa contexto efêmero de página e highlights, e não depende do RAG/`sqlite-vec` (memória do projeto).
- **IA direto do browser funciona.** O CORS do OpenRouter (`Access-Control-Allow-Origin: *`, aceitando `Authorization`, `HTTP-Referer` e `X-Title`) e o do Tavily foram verificados por curl em 2026-10-17 [S44]. O OpenRouter tem OAuth PKCE para apps client-side e chaves com limite de crédito [S43].
- **O storage do Safari ficou utilizável.**
  - OPFS e `navigator.storage.persist()` existem desde o Safari 15.2 [S39].
  - A quota é de cerca de 60% do disco por origem no Safari 17+/iPadOS 17+, igual para web app instalado na Home Screen [S35][S36].
  - Web apps da Home Screen têm contador próprio de dias de uso no ITP, e a WebKit diz não esperar que percam dados [S37].
  - No iPadOS 26, qualquer site adicionado à Home Screen abre como web app [S38].
- **Hospedagem estática grátis** (Cloudflare Pages) e nenhum backend [S63]. Isso significa custo de operação praticamente zero e nenhum dado do usuário no servidor, o que deixa as obrigações de LGPD mínimas (inferência) [S66].

**Não fazer agora.**

- **(c) Web + backend + sync.** Esforço G+ (semanas), com operação, LGPD e suporte. Os fornecedores estão em churn:
  - o InstantDB Cloud encerra em 2027-08-31 [S51];
  - o Zero "não suporta escrita offline" [S48];
  - o Triplit não tem release desde 2025-07-31, e o cr-sqlite desde 2023-12-16 [S26];
  - os planos grátis de Supabase e PowerSync pausam após cerca de 1 semana sem uso [S53][S47].
- **(b) Tauri mobile.** Esforço G. O iOS exige macOS + Xcode e US$ 99/ano [S31][S34]. Plugins desktop que o Monet usa (single-instance, updater, window-state) não existem no mobile [S30]. E continua sendo um silo sem sync.
- **(d) Acesso remoto ao desktop.** Esforço G, aumenta a superfície de ataque e exige o desktop ligado.
- **(e) Colocar o `monet.db` numa pasta do OneDrive.** A documentação do SQLite descreve corrupção quando o arquivo é copiado durante uma transação e quando o file system tem locking defeituoso [S42].

**Se um dia for preciso ter as notas fora do desktop**, a decisão real é *qual sync*, não *qual front-end*.

- Mais alinhados ao Monet (SQLite no cliente): **PowerSync** (Postgres; SDK web; SDK Tauri em alpha) ou **Turso Sync** (SQLite↔SQLite, push/pull, escrita offline, conflito resolvido por "last push wins").
- Caminho E2EE: **Evolu** (LWW por coluna, relay MIT self-host) [S47][S52][S49].
- Ponte barata antes disso: export/import de highlights em JSON (P–M).

---

## (b) Parte 1 — Dados estruturados dentro de notas

### 1.1 Como o mercado resolve em 2026

A tabela consolidada está em **D1** (seção d). Os destaques verificados de 2025–2026:

- **Obsidian Bases** [S1–S4]
  - Lançado na 1.9.0 (2025-05-21) como "early beta" [S2].
  - A 1.10.0 (2025-10-01) trouxe Group by, *summaries* por coluna, List view, a "Initial Bases API" para plugins criarem views, o plugin oficial Maps, seleção e navegação por teclado, copiar/colar e undo/redo [S3].
  - A 1.13 (mai–jul/2026) trouxe redimensionamento de colunas [S1].
  - A 1.14 (set–out/2026) trouxe a view kanban, o menu Group, grupos recolhíveis e RTL na tabela [S1].
  - Os dados continuam nos `.md` e em suas propriedades. A view é definida em YAML, num arquivo `.base` ou num bloco embutido na nota [S4].
  - As fórmulas são por linha, com sintaxe encadeável (`file.name.contains("x")`), mais `reduce()`, `html()` e `random()`.
  - Os *summaries* disponíveis são Average, Min, Max, Sum, Range, Median, Stddev, Earliest, Latest, Checked, Unchecked, Empty, Filled e Unique [S4].
- **Notion** [S7][S70]
  - Views: table, board, timeline, calendar, list, gallery e chart.
  - Rollups com sum, avg, median, min, max e range; não é possível fazer rollup de um rollup.
  - Gráficos (barras, linha, donut, número), limitados a 1 no plano Free.
  - Existem "simple tables", sem filtros nem ordenação.
  - Modo offline desde a 2.53 (2025-08-19), só em desktop e mobile, não na web. Uma database baixa apenas as primeiras 50 linhas.
  - A 3.8 (2026-10-13) trouxe permissões por coluna e reconstruiu os *synced databases*, numa direção voltada a times e agentes.
- **Coda virou Superhuman Docs.** O site diz "Coda is now Superhuman Docs!", e `coda.io/pricing` redireciona para `superhuman.com/plans/docs` [S8].
- **Tana.** O outliner virou "Tana Outliner", produto separado da nova "Tana", que é uma plataforma de reuniões agêntica. Supertags geram coleções em tabela com Filter, Sort, Group e Display. Fórmulas e totais não são descritos [S10].
- **Anytype.** Layouts List, Grid, Calendar, Kanban, Gallery e Graph. As "fórmulas" são só agregações de rodapé no Grid, sem expressões customizadas, e não podem ser usadas em filtros [S9].
- **Capacities.** Queries funcionam como "smart views"; salvar ou embutir uma query exige o plano Pro. As tabelas simples nas notas aceitam `=SUM, AVG, COUNT, MEDIAN, MIN, MAX, PRODUCT`, também só no Pro [S11].
- **Logseq DB.** Propriedades tipadas (Number é armazenado como número) e views Table, List e Gallery, "editáveis como planilha". Pelo README, a versão DB está em beta, e o app mobile e o sync RTC estão em alpha [S14].
- **AFFiNE, Craft, Microsoft Loop.** AFFiNE e Craft anunciam "databases"/"collections", mas os detalhes não foram verificados [S12][S13]. O Loop tem tipos de coluna, sort, filter, board e resumo Sum, sem fórmulas Excel; isso vem de fontes terceiras [S15].

### 1.2 O que importa no uso pessoal e o que é raro

| Capacidade | Peso no uso pessoal | Evidência |
|---|---|---|
| Ordenar por coluna | Alto | Recurso central do Advanced Tables (3,29 M downloads) [S6][S18]; presente em todos os produtos de D1 |
| Busca ou filtro rápido | Alto | "Bases: Temporary / Quick Search / Filtering Columns" tem 6.483 views [S5] |
| Totais e agregação por coluna | Médio-alto | É o "cálculo" que Anytype, Loop, Bases e rollups do Notion escolheram oferecer [S9][S15][S4][S7] |
| Entrada e saída com planilhas (colar do Excel, exportar CSV) | Médio-alto | Plugin "Excel to Markdown Table" tem 206.853 downloads; Bases tem export CSV [S6][S1] |
| Tipos simples (número, data, checkbox) | Médio | "Support checkboxes in tables" é pedido desde 2020-05-26, com 47.686 views [S5]; Logseq DB e Loop têm tipos |
| Views alternativas (kanban, calendário, cards) | Médio (mais ligado a tasks) | Pedidos de kanban (11.767 views) e calendar (9.316) para Bases [S5] |
| Fórmulas entre linhas, pivot, dashboards | Baixo (power users, inferência) | Charts tem 331 k e Tracker 368 k downloads, contra 5,15 M do Dataview [S6] |
| Relações e rollups | Baixo para notas pessoais (inferência) | Concentrados em Notion e Coda, que miram times [S7][S8] |
| Permissões por coluna, synced DBs | Nulo para uso pessoal | Notion 3.8 voltado a times [S7] |

### 1.3 Evidência de demanda

**Downloads acumulados no Obsidian (snapshot de 2026-10-17)** [S6]

| Categoria | Plugin (downloads) |
|---|---|
| Queries e views | Dataview (5.154.828) · make.md (880.077) · Metadata Menu (354.742) · Datacore (349.318) |
| Tabela markdown melhorada | **Advanced Tables (3.286.564)** · Markdown Table Editor (123.965) · Sheets Extended (65.417) |
| Ponte com Excel | Excel to Markdown Table (206.853) · CSV Table (36.567) |
| Planilha embutida | Sheet Plus, baseado no Univer (211.224) · Excel (88.772; o próprio plugin manda usar o Sheet Plus) · Spreadsheets (42.414) |
| Números e gráficos | Tracker (367.859) · Charts (331.084) |
| Tasks e kanban (referência) | Tasks (4.438.109) · Kanban (2.757.046) |

**Fórum do Obsidian** [S5]

- Os tópicos de Bases mais vistos pedem propriedades YAML aninhadas (31.511 views), kanban (11.767), imagens na tabela (10.888), suporte a tasks (10.560), calendário (9.316), template para "New" (8.831), busca rápida (6.483) e quebra de linha em células (5.318).
- Nenhum tópico do topo pede fórmulas entre linhas ou planilha. O mais próximo é um pedido de função `upper()`.

**Meio-termo de mercado (via busca, páginas não abertas)** [S29]

- Há plugins que mantêm o cálculo fora da nota, como o Obxcel ("Excel recalcula ao abrir").
- Há plugins de fórmulas leves em tabelas markdown, como o Simple Table Formulas, pensado para quando "uma planilha dedicada é exagero".

**Leitura (inferência).** A demanda forte é por *tabelas markdown melhores* e *views sobre dados*. Planilha dentro da nota é nicho, cerca de 10× menor em downloads. Para cálculo sério, o padrão é levar os dados para o Excel ou Sheets.

### 1.4 Bibliotecas

A tabela completa (licença, último release, peso medido e adequação) está em **D2**. Os pontos de decisão:

- **Tabela do Tiptap 3 (`@tiptap/extension-table` 3.32.0, MIT).** Já cobre merge/split, headers, resize e atributos de célula. Não tem sort, filtro nem fórmula, e os planos pagos do Tiptap (Start a partir de US$ 49/mês no plano anual) não listam nenhum recurso de tabela [S16]. Desde 2025-06-20, extensões que eram Pro (drag-handle, table-of-contents, file-handler) estão publicadas como MIT no escopo `@tiptap` [S26]. **Tudo que for nível A será código próprio** sobre `prosemirror-tables` (1.8.5, MIT).
- **Precedente para fórmulas em markdown.** O `md-advanced-tables`, usado pelo Advanced Tables, grava fórmulas num comentário HTML logo após a tabela, por exemplo `<!-- TBLFM: @>$2=sum(@I..@-1) -->`. O resultado vai para as células como texto, e a avaliação é feita por um botão [S18]. Isso deixa os valores legíveis para a IA e o RAG. No Monet, um comentário HTML provavelmente seria descartado pelo parser do Tiptap sem um nó dedicado (inferência, testar). Por isso, prefira um elemento customizado, como no `<tasks-query>`.
- **Para nível C, a licença decide.**
  - Handsontable: comercial [S21].
  - HyperFormula: GPLv3, o que contamina um app distribuído fechado [S22].
  - AG Grid: fórmulas só na edição Enterprise [S24].
  - Opções viáveis: **jspreadsheet CE** (MIT, cerca de 35 KB gzip + jsuites, com fórmulas, tipos e filtros) [S23][S28] ou **Univer OSS** (Apache-2.0, com fórmulas, sort/filter, validação e formatação condicional; import/export, gráficos e pivot são Pro; o plugin Sheet Plus usa mais de 30 pacotes do Univer) [S20][S19].
  - O Luckysheet está arquivado ("upgraded to Univer") [S27].
- **I/O.** Papa Parse (cerca de 6 KB gzip) para colar e exportar CSV/TSV. SheetJS CE 0.20.3 para `.xlsx`, instalado pelo tarball do CDN, porque o pacote `xlsx` no npm parou em 0.18.5 (2022) [S25].

### 1.5 Os três níveis para o Monet

O comparativo resumido está em **D3**. Detalhes:

**Nível A-lite (recomendado; P–M, 1–3 dias conforme o recorte)**

1. **Ordenar (P).** Menu no cabeçalho com A→Z, Z→A, numérico e data. Uma transação ProseMirror reordena as linhas do corpo, o markdown muda e o Ctrl+Z desfaz. O tipo é inferido na hora (número com vírgula ou ponto, %, R$, datas ISO ou dd/mm/aaaa, `[x]`), sem persistir nada.
2. **Estatística da seleção (P).** Ao selecionar células (`CellSelection`), mostrar Σ, média e contagem num rodapé flutuante, como a barra de status do Excel. Nada é persistido, nada é serializado e o risco é mínimo. É o "cálculo" que o uso pessoal mais pede (inferência a partir de 1.2).
3. **"Inserir/recalcular linha de total" (P).** Escreve uma linha "Total" como texto, então IA e RAG passam a ver o valor. A atualização é por botão, como no Advanced Tables.
4. **Filtro rápido (P).** Uma caixa que oculta linhas por decoração, sem persistir.
5. **Colar e exportar (P–M).** TSV/CSV do clipboard viram tabela (Papa Parse). Copiar como CSV, TSV ou markdown. Salvar `.csv`. Ainda é preciso verificar como o Tiptap trata o `<table>` HTML vindo do Excel.
6. **IA sobre a tabela (P–M).** "Perguntar sobre esta tabela" manda o markdown da tabela como contexto. "Transformar" recebe a nova tabela da IA e substitui a atual, com undo. Totais devem ser calculados em JS, não pela IA (inferência: LLMs erram aritmética).

- **Persistência:** o GFM fica intacto.
- **RAG:** nada muda, a não ser o que for materializado (item 3).
- **Risco:** baixo. Testar o round-trip com o serializer sem manutenção.

**Nível A-full (M, 2–4 dias, além do A-lite).** Tipos de coluna e larguras persistidos, mais uma linha de fórmula no estilo TBLFM.

- Vai num nó/elemento customizado ao lado da tabela, por exemplo `<monet-table-meta data-types="text,number" data-widths="…">`.
- Também resolve o fato de as larguras de coluna, hoje, não persistirem.
- **Não vale enquanto o A-lite resolver.**

**Nível B1 (M).** Modo "tabela/board" no bloco `/tasks`.

- Novos atributos `display`, `columns`, `sort` e `group`, serializados como `data-*` no `<tasks-query>`, que já é um elemento customizado.
- A view pode ser um `<table>` simples ou usar TanStack Table v9 (headless, MIT).
- **RAG:** a lista é dinâmica e não está no markdown. Para indexar, gerar uma projeção textual ao salvar; o `resolveText(filter)` já existe para o clipboard.
- **Não vale enquanto os metadados de task seguirem sem uso.**

**Nível B2 (G, 1–3 semanas).** "Bases genérico".

- Propriedades tipadas em notas (tabela nova no SQLite ou frontmatter), UI de edição, motor de filtros, views (tabela, cards, kanban), *summaries* e migrações.
- **Não vale agora.** Não há demanda observada, e a parte cara (o modelo de propriedades) não existe hoje.

**Nível C (G, 1–3 semanas).** Planilha embutida.

- Implementação: entidade `sheets` no SQLite (JSON do workbook) e um bloco atômico `<monet-sheet data-id>` com NodeView carregado sob demanda.
- Para export markdown e RAG, gerar uma projeção CSV/markdown ao salvar.
- Riscos altos:
  - foco, teclado, seleção, undo e clipboard de um editor de planilha aninhado dentro do contenteditable do ProseMirror (a memória do projeto já registra problemas de drag em widgets Tiptap);
  - bundle entre 200 e 600 KB gzip;
  - licenças;
  - tema escuro e formatos numéricos pt-BR.
- **Não vale agora.**

**Nível C-lite (P–M).** Anexar `.xlsx/.csv`, preview só-leitura (SheetJS) e "abrir no Excel" (plugin opener). Para o RAG, indexar o CSV como documento. Ainda falta verificar se a KB atual já indexa CSV.

### 1.6 Observações do código do Monet (lido sem alterar)

- `src/components/Editor/extensions.ts`: configura `Table.configure({ resizable: true })` e `Markdown.configure({ html: true, … })`, este último do `tiptap-markdown`.
- `src/components/Editor/TasksQueryBlock.ts`: o bloco `/tasks` persiste só o filtro, em `<tasks-query data-filter="this week #PORTO">`, e a lista é renderizada ao vivo. É o precedente para B1 e para metadados de tabela.
- `src/storage/index.ts`: o `StorageAdapter` tem cerca de 40 métodos. Em `src/storage/browser.ts`, todos lançam "not implemented".
- 20 arquivos do front importam `@tauri-apps`, e há cerca de 52 comandos `invoke` distintos (chat/OpenRouter, chaves, `documents_*`/RAG, `notes_index_*`, `books_*`, deep research, librarian). Para o PWA da Library/Reader importam só `books_*`, `extract_pdf_text`, `openrouter_*` e as chaves, mais cerca de 9 métodos de storage (books, highlights, quotes).

---

## (c) Parte 2 — Versão online/web simplificada

### 2.1 Opções (fichas)

O comparativo resumido está em **D4**, e os motores de sync em **D5**.

**(a) PWA/web standalone, sem sync. Recorte: Library/Reader**

- **O que resolve:** ler PDF/EPUB, grifar e conversar com a IA no tablet (iPad ou Android), offline e sem conta.
- **Esforço:** M (3–5 dias de MVP). Vira G se a UX de toque precisar de ajustes.
- **Dependências:**
  - entrada web separada, sem imports `@tauri-apps`;
  - `BrowserStorage` só para books, highlights e quotes, em IndexedDB (Dexie 4.4.6 ou idb 8.0.4);
  - arquivos dos livros no OPFS;
  - streaming do OpenRouter via `fetch` (SSE);
  - Tavily chamado direto do browser;
  - `vite-plugin-pwa` 2.0.0 (2026-10-03) [S26];
  - hosting estático.
- **Riscos:**
  - armazenamento "best-effort" no Safari (mitigar com instalação na Home Screen, `persist()` e export);
  - o storage do web app na Home Screen é **isolado** do Safari: livros importados numa aba do Safari não aparecem no app instalado (bug WebKit 181849, marcado como "by design"; fonte antiga, confirmar no spike) [S69];
  - epub.js sem release desde 2022-02-16 [S26]; a alternativa foliate-js é MIT, mas o autor avisa que "não é estável" e não há release [S68];
  - chave BYOK guardada no browser (2.3);
  - dados divergentes entre tablet e desktop.
- **Manutenção:** baixa a média. São dois builds, e é preciso testar a cada versão do iPadOS.
- **Quando NÃO vale:** uso raro no tablet; necessidade de ver os highlights do tablet automaticamente no desktop (isso exige sync); exigência do RAG completo da KB no tablet.

**(b) Tauri 2 mobile (Android/iOS)**

- **O que resolve:** app nativo com o mesmo código, SQLite nativo e distribuição por loja.
- **Maturidade em 2026:**
  - O anúncio do 2.0 (2024-10-02) admitia que a DX mobile não estava no nível do desktop [S33].
  - O 2.12 saiu em 2026-09-26, e já existe `tauri v3.0.0-alpha.5` (2026-10-14), com runtime CEF, o que sinaliza uma migração futura [S33].
  - Plugins oficiais no mobile [S30]:
    - suportados: `sql`, `dialog`, `http`, `store`, `deep-link`, `opener`, `notification`;
    - status desconhecido: `fs`, `global-shortcut`, `shell`;
    - não suportados: `single-instance`, `updater`, `window-state`, `autostart`, `positioner`.
  - Plugins nativos exigem Kotlin ou Swift. O Tauri "não fornece mecanismo direto" para chamar Rust a partir do plugin; isso é feito à mão via JNI ou FFI [S32].
- **Esforço:** G (2–4+ semanas para um tablet utilizável).
- **Dependências:**
  - Android: Android Studio, NDK e o JDK embutido (funciona no Windows);
  - iOS: **"only available on macOS"** com Xcode [S31], mais o Apple Developer Program (US$ 99/ano) [S34];
  - cross-compile de rusqlite + `sqlite-vec` (o README diz "runs anywhere SQLite runs", mas não menciona Android nem iOS) [S41].
- **Quando NÃO vale:** sem sync (vira o mesmo silo da PWA, só que mais caro); sem Mac (não há iOS); em pré-lançamento.

**(c) Web + backend com sync**

- **O que resolve:** mesmos dados em todos os dispositivos e uma web de verdade.
- **Esforço:** G+ (4–8+ semanas). Inclui autenticação, política de conflitos, migração de schema, observabilidade, termos e política de privacidade, e suporte.
- **Riscos:**
  - churn de fornecedores (D5);
  - planos grátis que pausam após cerca de 1 semana de inatividade, ruim para app pessoal de pouco tráfego [S53][S47];
  - custo recorrente;
  - LGPD;
  - com E2EE, perda de senha significa perda de dados, o que gera suporte (Obsidian: "We're not able to recover your password, or any encrypted data"; Anytype: "Losing your key means losing access… permanently") [S58][S9].
- **Arquiteturas mais alinhadas ao Monet (SQLite local):**
  - PowerSync com Postgres (SDK web estável; SDK Tauri "alpha"; plugin 0.0.6 de 2026-08-03) [S47];
  - Turso Sync (push/pull, escrita offline, "last push wins"; SDKs em TS, Python e Go; em Rust via réplica embutida do libSQL) [S52];
  - Evolu, se E2EE for requisito [S49].
- **Quando NÃO vale:** sem usuários pedindo; dev solo em pré-lançamento; enquanto o diferencial do produto for local-first e privacidade.

**(d) Acesso remoto ao desktop (servidor local + Tailscale ou Cloudflare Tunnel)**

- **O que resolve:** usar o Monet "de verdade" do tablet, sem sync.
- **Esforço:** G. É preciso um servidor HTTP em Rust expondo os cerca de 52 comandos e o StorageAdapter, com autenticação e HTTPS (contexto seguro, necessário para service worker e várias APIs).
- **Dependências:**
  - Tailscale: há plano pessoal grátis, mas os limites **não foram verificados** (o fetch foi bloqueado e os agregadores divergem entre "3 usuários/100 dispositivos" e "6 usuários/dispositivos ilimitados") [S67];
  - ou Cloudflare Tunnel: o `cloudflared` abre conexões de saída, então não é preciso abrir portas [S63]; o preço não foi verificado.
- **Riscos:** superfície de ataque sobre o banco local; desktop ligado e acordado; possíveis restrições do empacotamento MSIX ou do firewall (n/v).
- **Quando NÃO vale:** como produto. No máximo como hack pessoal.

**(e) Sync por pasta na nuvem do usuário**

- **e1 (P–M): backup/export de mão única.** Snapshot via `VACUUM INTO` ou export markdown para uma pasta do OneDrive. É seguro. **Nunca** colocar o `monet.db`, com seus arquivos WAL, dentro de pasta sincronizada [S42].
- **e2 (G): bidirecional.** Arquivos de mudanças por dispositivo, com merge LWW por `updated_at`. Traz conflitos, além do OneDrive Files On-Demand.
- **e3 (G): PWA no iPad lendo e gravando via API da nuvem.** Usaria OAuth PKCE. O CORS do Microsoft Graph e do Google Drive foi verificado por curl [S44]; o do Dropbox não. Uma PWA no Safari **não acessa pastas locais**: `showDirectoryPicker` existe só no Chromium [S39].
- **Demanda (Obsidian):** Remotely Save, que sincroniza com S3, Dropbox, WebDAV, OneDrive e Google Drive, tem 2,31 M downloads; Self-hosted LiveSync tem 1,01 M; Google Drive Sync ("works for iOS") tem 191 k [S6].
- **Quando NÃO vale:** no recorte só-Reader, um export/import em JSON resolve.

**(f) Motores de sync e E2EE.** Ver **D5**. Resumo E2EE:

- **Obsidian Sync:** AES-256 em modo GCM, chave derivada com scrypt, sem recuperação. O servidor vê metadados (dispositivo, horários, mapeamento de caminhos). Há também uma opção de criptografia "standard", em que a chave fica no servidor [S58].
- **Anytype:** chaves geradas no dispositivo; nós de backup não leem o conteúdo; índices de busca são locais e não sincronizam; backup em data centers na UE; self-host via Docker [S9].
- **Standard Notes:** E2EE auditado, com marca "by Proton" [S59].
- **Capacities:** sem E2EE *por escolha*, porque IA e integrações no servidor precisam ler as notas [S11].
- **Implicação para o Monet (inferência):** como a IA é BYOK e chamada do cliente, E2EE seria compatível com IA, porque um servidor de sync nunca precisaria do texto em claro.

### 2.2 Armazenamento no browser em 2026

O resumo está em **D7**. Pontos de decisão:

- **Quotas** [S35][S36]
  - Chromium: até 60% do disco por origem.
  - Firefox: no modo best-effort, o menor entre 10% do disco e 10 GiB; no modo persistente, 50% do disco (até 8 TiB).
  - Safari 17+/iPadOS 17+: cerca de 60% para apps de navegador; o **web app na Home Screen usa a mesma quota**; apps que embutem web têm cerca de 15%; o total fica limitado a 80% ou 20% do disco, respectivamente.
- **Remoção de dados**
  - Sob pressão de espaço, vale LRU por origem, pulando origens persistentes [S35].
  - No Safari com prevenção de rastreamento, dados criados por script são apagados após 7 dias de uso do navegador sem interação com o site [S35].
  - Web apps da Home Screen "têm seu próprio contador de dias de uso", e a WebKit diz que "não espera" que percam dados [S37].
- **`persist()`**
  - Disponível no Safari desde a 15.2 [S39].
  - Safari e Chromium decidem por heurística, sem prompt; a WebKit considera, entre outras coisas, se o site roda como web app da Home Screen [S35][S36].
  - O Firefox mostra um prompt.
- **OPFS**
  - `getDirectory` e `FileSystemSyncAccessHandle` existem no Safari 15.2+ [S39].
  - A API de escrita por stream (WritableStream) chegou no Safari 26.0 [S38].
  - Bom lugar para PDFs e EPUBs grandes.
- **SQLite WASM oficial** (`@sqlite.org/sqlite-wasm` 3.53.4-build2, 2026-10-02) [S40][S26]
  - VFS `opfs`: exige COOP/COEP (SharedArrayBuffer); incompatível com Safari anterior ao 17.
  - VFS `opfs-sahpool`: não exige cabeçalhos, é o mais rápido, mas permite **uma conexão por banco** e roda só em worker.
  - VFS `opfs-wl` (desde 3.53): usa Web Locks e exige `Atomics.waitAsync`.
  - `kvvfs`: localStorage, cerca de 5 MB.
- **wa-sqlite.** O pacote npm original parou em 1.0.0 (2024-01-05). O fork `@journeyapps/wa-sqlite` está em 2.0.7 (2026-10-05) e é usado pelo PowerSync [S26]. O Safari 27 (2026-09-17) passou a suportar JSPI no WebAssembly, o que deve ajudar VFS assíncronos (inferência) [S38].
- **`sqlite-vec` no browser.** Só funciona via build estático customizado. O pacote de demonstração avisa que "pode mudar a qualquer momento", e o `sqlite-vec` em si é pré-v1 (0.1.9, 2026-03-31) [S41][S26]. **Para a PWA, evitar RAG vetorial.** O chat do Reader não precisa dele.
- **Escolha para o PWA Reader (inferência).** IndexedDB (Dexie ou idb) para metadados mais OPFS para arquivos é o caminho mais simples. SQLite WASM com `opfs-sahpool` só compensa se houver interesse em reaproveitar o SQL do `TauriStorage` (1.199 linhas). No recorte do Reader (cerca de 9 métodos), IndexedDB basta.

### 2.3 IA direto do browser com BYOK

**Teste de CORS por curl em 2026-10-17** [S44]

| Endpoint | Preflight (OPTIONS) | Cabeçalhos permitidos | Erro 401 legível no browser? |
|---|---|---|---|
| `openrouter.ai/api/v1/chat/completions` | 204, `Access-Control-Allow-Origin: *` | `Authorization`, `Content-Type`, `HTTP-Referer`, `X-Title`, entre outros | Sim (o 401 vem com ACAO `*`) |
| `api.tavily.com/search` | 200, a origem é refletida | `authorization`, `content-type` | Sim (o 401 com `Authorization` vem com ACAO `*`) |

**Recursos do OpenRouter para client-side** [S43]

- OAuth PKCE: o usuário conecta a conta e o app recebe uma chave controlada pelo usuário. O código expira em 10 minutos. Os exemplos da documentação rodam no browser, e ela sugere guardar a chave "no browser do usuário ou no seu banco".
- Chaves podem ter **limite de crédito** com reset diário, semanal ou mensal. A recomendação é usar uma chave dedicada ao tablet, com limite baixo.

**Tavily:** 1.000 créditos grátis por mês; depois, a partir de US$ 30/mês ou US$ 0,008 por crédito [S45]. Não verifiquei se as chaves podem ter escopo.

**Riscos e mitigações**

- A OWASP recomenda não guardar dados sensíveis em localStorage: "um único XSS rouba todos os dados" [S46]. IndexedDB também é acessível por JS.
- Mitigações:
  - CSP estrita (`connect-src` só para `openrouter.ai` e `api.tavily.com`; sem scripts inline; zero scripts de terceiros ou analytics);
  - **sanitizar o HTML renderizado a partir das respostas da IA** (markdown→HTML é vetor de XSS);
  - isolar o conteúdo dos EPUBs, que podem conter scripts (o foliate-js manda usar CSP) [S68];
  - opção "esquecer chave";
  - preferir o PKCE (chave revogável).
- Criptografar a chave com senha (WebCrypto) protege em repouso, mas não contra XSS em execução (inferência).

### 2.4 Como concorrentes escopam web/mobile e o que dizem os usuários

A tabela está em **D6**. Padrões (inferência a partir de D6):

- **Apps local-first com arquivos ou chaves locais** (Obsidian, Anytype) fizeram mobile, mas **não web**. O Logseq tem web para os grafos DB, mas o app mobile está em alpha ou por convite [S14].
- **Apps cloud-first** (Notion, Capacities, Heptabase, Readwise Reader, Tana Outliner, Craft) têm web, mobile e desktop.
- **O Bear continua só Apple** (Mac, iPhone, iPad) [S60].
- Para o Monet (local-first), um "companheiro de leitura no tablet" está dentro do padrão. Uma web completa mudaria a categoria do produto.

**O que usuários de app desktop-first dizem (fórum do Obsidian)** [S5]

- **"Obsidian for web"** está aberto desde 2020-06-17 e segue ativo em 2026-10-02, com **247 respostas e 262.885 views**. Os casos citados são PCs corporativos sem permissão de instalar programas, nuvens bloqueadas pela TI, Chromebook e Linux ARM.
- "Obsidian Sync: Self-Hosted Server" tem 140.909 views; "Make Obsidian Sync work in background (on Mobile)" tem 125 respostas.
- A demanda por sync "faça você mesmo" é grande mesmo existindo o Sync pago (US$ 4/mês no plano anual): Remotely Save tem 2,31 M downloads e LiveSync tem 1,01 M [S6][S58].

### 2.5 Custos, operação e LGPD

| Caminho | Custo fixo típico | Observações |
|---|---|---|
| (a) PWA estática | **US$ 0** | Cloudflare Pages Free: 500 builds/mês, 20.000 arquivos, 25 MiB por asset; o limite de banda não é citado na página [S63]. Restrições de outras opções: GitHub Pages não pode ser usado para "negócio online/SaaS" [S64], e o Vercel Hobby é "non-commercial, personal use only" [S65]. Para uma PWA estática, VPS (Hostinger ou Lightsail, cogitados antes) é desnecessário (inferência). |
| (b) Tauri mobile | US$ 99/ano (Apple) + um Mac ou CI macOS | Taxa do Google Play n/v [S34] |
| (c) Sync gerenciado | US$ 0 → US$ 25–49/mês (ver ao lado) | **Supabase Free:** 500 MB de DB, 1 GB de arquivos, 5 GB de egress, 50 k MAU, **pausa após 1 semana inativo**; Pro a partir de US$ 25/mês [S53]. **PowerSync Free:** 2 GB sincronizados/mês, 500 MB hospedados, 50 clientes simultâneos, desativado após inatividade (a página fala em 1 e em 2 semanas); Pro a partir de US$ 49/mês [S47]. **Turso Free:** 5 GB e 3 GB de syncs/mês; Developer US$ 4,99/mês [S52]. **Zero Cloud:** a partir de US$ 30/mês [S48]. **Jazz Cloud:** por uso [S50]. |
| (d) Acesso remoto | US$ 0 (planos pessoais, n/v) | Tempo de engenharia alto |
| (e) Pasta na nuvem | US$ 0 | Usa o armazenamento do usuário |

**LGPD (não é parecer jurídico)**

- **(a) PWA sem backend.** O Monet não recebe dados: o usuário fala direto com OpenRouter e Tavily usando as próprias chaves. A exposição fica mínima, mas uma política de privacidade transparente continua recomendável (inferência).
- **(c) Backend com contas.** O Monet passa a ser *controlador* dos dados das notas: base legal, direitos do titular, segurança e incidentes. Transferência internacional, se o servidor estiver fora do Brasil, não foi verificada nesta pesquisa.
- **Regime de pequeno porte (Res. CD/ANPD nº 2/2022)** [S66]
  - Vale para microempresa, EPP, startup e pessoa natural.
  - **Dispensa de encarregado (DPO)**, mas é preciso manter um canal de comunicação com o titular.
  - Registro de operações simplificado.
  - Medidas de segurança essenciais.
  - **Prazos em dobro** (titulares, incidentes, ANPD).
  - **Não se aplica a tratamento de alto risco.** Alto risco exige um critério geral (larga escala ou impacto significativo em direitos) somado a um específico (tecnologia emergente, dados sensíveis, crianças/idosos, decisões automatizadas…). IA conta como "tecnologia emergente", mas só configura alto risco se combinada com um critério geral.
- **Suporte (inferência).** Sync gera tickets de conflito, de restauração e, com E2EE, de senha perdida. A PWA gera tickets de "sumiram meus dados" no Safari. Por isso export e backup visíveis são obrigatórios.

### 2.6 Arquitetura sugerida para o caminho recomendado (PWA Library/Reader)

**Build**

- Entrada web separada (por exemplo `reader.html` ou `apps/reader-web`) com a mesma base React.
- Um `platform.ts` com `isTauri` e shims para os imports de `@tauri-apps`.
- `vite-plugin-pwa` para manifest e cache do app shell. Não cachear respostas de IA.

**Dados**

- `BrowserStorage` implementando só books, highlights e quotes, em Dexie ou idb.
- Arquivos no OPFS.
- Chamar `navigator.storage.persist()` no primeiro import.
- Tela "Armazenamento" mostrando `estimate()` e `persisted()`.
- Onboarding: "instale na Home Screen **antes** de importar livros", por causa do isolamento entre Safari e web app.

**Leitura**

- pdf.js (6.4.299, 2026-10-03), que já é usado no desktop.
- epub.js, com risco de manutenção. Avaliar o foliate-js mais adiante.

**Chat**

- `fetch` com streaming para o OpenRouter, enviando `HTTP-Referer` e `X-Title`, e `AbortController` para o Stop.
- Tavily chamado direto.
- O mesmo contexto efêmero de página e highlights validado no desktop.
- Sem `documents_*` nem RAG.

**Chaves:** OAuth PKCE do OpenRouter, ou uma chave dedicada com limite de crédito. Guardar em IndexedDB e aplicar CSP estrita e sanitização.

**Ponte com o desktop:** export/import de um arquivo `.monet-highlights.json`, com o livro identificado por hash do arquivo (P–M). O formato serve de base para um sync futuro.

**Hosting:** Cloudflare Pages Free, sem backend.

**Spike de 1 dia num iPad real, com o app instalado na Home Screen.** Critério: se os itens 1–3 falharem, reavaliar.

1. Importar um PDF grande (300+ páginas, 50+ MB) via `<input type=file>` para o OPFS, fechar o app e reabrir.
2. Selecionar texto e criar um grifo com toque no TextLayer do pdf.js (iPadOS 26).
3. Conferir o retorno de `persist()` e o resultado de `estimate()` com o app instalado.
4. Streaming do OpenRouter no Safari, com cancelamento.
5. EPUB: paginação e seleção no Safari do iPad.
6. Abrir sem rede (service worker) e ler um livro já importado.

---

## (d) Tabelas comparativas

### D1 — Dados estruturados em apps de notas (2026)

| Produto | Modelo | Views | Fórmulas | Totais/agregação | Gráficos | Relações | Fonte |
|---|---|---|---|---|---|---|---|
| Notion | Databases; "simple tables" sem DB | Table, Board, Timeline, Calendar, List, Gallery, Chart | Sim (lógica, listas, `style()`, refs a relações) | Rollups e cálculo no rodapé | Sim (Free: 1) | Sim, 1 ou 2 vias | S7 |
| Coda → Superhuman Docs | Docs com tabelas conectadas | n/v | Sim (+ botões e automações) | n/v | n/v | Tabelas "conversam" entre si | S8 |
| Obsidian Bases | Views sobre propriedades dos `.md`; YAML | Table, List, Cards, Kanban (1.14), Map (plugin) | Sim, por linha | Summaries por coluna (14 funções + custom) | Não nativo | Via links | S1–S4 |
| Anytype | Types/Properties; Queries e Collections | List, Grid, Calendar, Kanban, Gallery, Graph | Não | Rodapé do Grid, "visual only" | Não | Sim | S9 |
| Tana Outliner | Supertags → campos | Tabela + filter/sort/group | Não descrito | Não descrito | Não descrito | Campos | S10 |
| Capacities | Object types; queries; tabela simples | Queries | `=SUM…` na tabela simples (Pro) | Via fórmulas | Não | Sim | S11 |
| AFFiNE | "Databases and tables" | n/v | n/v | n/v | n/v | n/v | S12 |
| Microsoft Loop | Tabela com tipos; board | Table, Board | Sem fórmulas Excel | Sum por coluna | n/v | — | S15 (terceiros) |
| Craft | Collections | n/v | n/v | n/v | n/v | n/v | S13 |
| Logseq DB | Tags-classe + propriedades tipadas | Table, List, Gallery | Não descrito | Não descrito | — | Propriedade Node | S14 |

### D2 — Bibliotecas (versões do registro npm em 2026-10-17)

O peso foi medido baixando o arquivo min/UMD do jsDelivr e aplicando gzip (sem tree-shaking).

| Biblioteca | Licença | Versão (data) | Peso | Nível | Observação |
|---|---|---|---|---|---|
| @tiptap/extension-table | MIT | 3.32.0 (2026-10-13) | já no app | A | Sem sort, filtro ou fórmula; nenhum recurso de tabela nos planos pagos [S16] |
| prosemirror-tables | MIT | 1.8.5 (2025-12-24) | — | A | Base dos comandos de tabela |
| @tiptap/markdown | MIT | 3.32.0 (desde 2025-10-14) | — | persistência | "Early release"; 1 nó por célula [S16] |
| tiptap-markdown (atual) | MIT | 0.9.0 (2025-09-08) | — | persistência | Autor recomenda o oficial e não trata issues [S17] |
| md-advanced-tables | MIT | 3.11.0 (2024-09-05) | pequeno | A (precedente) | Fórmulas `<!-- TBLFM -->` [S18] |
| Papa Parse | MIT | 5.7.0 (2026-08-24) | ~6 KB | A | CSV/TSV |
| SheetJS CE | Apache-2.0 | 0.20.3 (CDN); npm parado em 0.18.5 (2022) | n/m | A/C-lite | Instalar pelo CDN [S25] |
| formula.js | MIT (npm) | 4.6.1 (2026-07-28) | ~44 KB | A | Só funções, sem motor de dependências |
| HyperFormula | GPL-3.0 ou comercial | 3.5.0 (2026-10-09) | ~205 KB | C | 400+ funções, headless [S22] |
| TanStack Table | MIT | 9.3.1 (2026-10-12); v9 em 2026-08-04 | headless | B | API nova |
| react-datasheet-grid | MIT | 4.11.6 (2026-03-03) | n/m | B/C leve | Grade estilo Airtable/Excel |
| react-data-grid | MIT | 7.0.0-beta.61 (2026-07-14) | n/m | B | Ainda beta |
| Glide Data Grid | MIT | 6.0.3 (2024-02-03) | n/m | B | Release npm parado; push no repo em 2026-01 |
| AG Grid Community | MIT | 36.2.0 (2026-09-16) | ~512 KB | B | Fórmulas só Enterprise [S24] |
| jspreadsheet CE | MIT | 5.0.4 (2025-08-25) | ~35 KB + jsuites | C leve | Fórmulas, tipos, filtros, wrapper React [S23] |
| FortuneSheet | MIT | 1.0.4 (2025-11-06) | ~572 KB | C | Derivado do Luckysheet |
| Luckysheet | MIT | 2.1.13 (2021-01-19) | — | não usar | Repositório arquivado [S27] |
| Univer | Apache-2.0 + Pro comercial | 1.1.0 (2026-10-17); 1.0 em 2026-09-23 | n/m (core 4,4 MB descompactado) | C | xlsx, gráficos e pivot no Pro [S20] |
| Handsontable | Comercial | 18.1.2 (2026-10-07) | ~441 KB | C | Grátis só para uso não comercial/avaliação [S21] |

### D3 — Níveis A/B/C para o Monet

| Nível | Entrega | Esforço | Markdown | RAG | Risco | Quando NÃO vale |
|---|---|---|---|---|---|---|
| **A-lite (recomendado)** | Ordenar, Σ da seleção, linha de total materializável, filtro rápido, colar/exportar CSV, IA sobre a tabela | **P–M** | GFM intacto | Igual; o total materializado entra | Baixo | Se ninguém ordena nem soma |
| A-full | Tipos e larguras persistidos, fórmula estilo TBLFM | M | Elemento customizado ao lado da tabela | Valores calculados como texto | Médio (serializer) | Enquanto o A-lite bastar |
| B1 | Tabela/board no bloco `/tasks` | M | Só a config no `<tasks-query>` | Requer projeção textual | Baixo-médio | Metadados de tasks sem uso |
| B2 | "Bases" genérico com propriedades tipadas | G | Config no markdown; dados no SQLite | Requer projeção | Alto | Agora |
| C | Planilha embutida (Univer OSS ou jspreadsheet CE) | G | Workbook no SQLite + `<monet-sheet>` | Requer projeção CSV/MD | Alto (editor aninhado, bundle, licença) | Agora |
| C-lite | Anexo .xlsx/.csv + preview + abrir no Excel | P–M | Link/anexo | CSV indexado como documento | Baixo | Sem planilhas reais |

### D4 — Opções online

| Opção | Resolve | Esforço | Dependências-chave | Riscos | Manutenção | Quando NÃO vale |
|---|---|---|---|---|---|---|
| **(a) PWA standalone (Reader)** | Ler, grifar e usar IA no tablet, offline | **M** | IndexedDB + OPFS, fetch para OpenRouter/Tavily, hosting estático | Remoção de dados no Safari, epub.js parado, XSS/chave, silo | Baixa-média | Uso raro; necessidade de sync |
| (b) Tauri mobile | App nativo nas lojas | G | Mac + Xcode (iOS), NDK, US$ 99/ano | Plugins ausentes, Kotlin/Swift, Tauri 3 | Média-alta | Sem sync, sem Mac, pré-lançamento |
| (c) Web + backend + sync | Dados em todos os dispositivos | G+ | Provedor de sync, auth, Postgres | Churn, pausas do Free, LGPD, suporte | Alta | Sem demanda, dev solo |
| (d) Acesso remoto | Usar o Monet real do tablet | G | Servidor HTTP em Rust, Tailscale ou Tunnel | Segurança, desktop ligado | Média | Como produto |
| (e1) Backup em pasta na nuvem | Cópia segura | P–M | Export/`VACUUM INTO` | Baixo | Baixa | Se já há export |
| (e2/e3) Sync por pasta ou API da nuvem | Sync "do usuário" | G | Merge LWW, OAuth (Graph/Drive) | Conflitos, Files On-Demand | Média-alta | Recorte só-Reader |

### D5 — Motores de sync (versões do npm em 2026-10-17)

| Motor | Modelo | Escrita offline | Backend | Licença | Último release | Status | Encaixe no Monet |
|---|---|---|---|---|---|---|---|
| Yjs | CRDT de documento | Sim | Qualquer; Hocuspocus 4.7.1 (MIT) | MIT | 13.6.33 (2026-09-23) | Maduro | Só se houver colaboração em tempo real; conflita com markdown como fonte da verdade |
| Automerge | CRDT JSON; v3 (jul/2025) cortou memória em mais de 10× | Sim | automerge-repo + servidor | MIT | 3.5.0 (2026-09-16) | Maduro e ativo [S56] | Idem |
| cr-sqlite | CRDT no SQLite | Sim | Próprio | MIT | 0.16.0 (2023-12-16) | Sem release há cerca de 3 anos | Evitar |
| ElectricSQL | Sync de *leitura* do Postgres ("read-path") | Escrita via sua API | Postgres + Electric | Apache-2.0 | 1.5.28 (2026-09-09); 1.0 em 2025-03 | Ativo [S54] | Exige backend e API de escrita |
| PowerSync | SQLite cliente ↔ Postgres/Mongo/MySQL/SQL Server | Sim | Cloud ou self-host (Open Edition) | Apache-2.0 (SDK) | web 2.4.2 (2026-10-01) | Maduro; SDK Tauri em alpha [S47] | **Melhor encaixe "SQLite local + servidor"** |
| Turso Sync | SQLite ↔ Turso Cloud, push/pull | Sim | Turso Cloud | MIT (SDK) | 0.8.3 (2026-10-12) | 0.x [S52] | Simples; "last push wins"; lock-in |
| Zero (Rocicorp) | Réplica Postgres + queries locais | **Não** | Postgres + zero-cache | Apache-2.0 | 1.11.0 (2026-10-16) | Estável [S48] | Ruim para local-first |
| Evolu | SQLite + relay E2EE, LWW por coluna | Sim | Relay MIT self-host | MIT | 8.23.2 (2026-10-17) | "Library is ready" [S49] | Bom se E2EE; troca a camada de dados |
| Triplit | DB full-stack sincronizado | Sim | Próprio | AGPL-3.0 | 1.0.50 (2025-07-31) | Parado | Evitar |
| Jazz | "v2" relacional sobre sync | Sim | Jazz Cloud ou self-host | MIT | jazz-tools 0.20.19 (2026-07-03) | v2 reescrito, "Classic" separado [S50] | Esperar |
| InstantDB | Backend realtime | — | Instant Cloud | Apache-2.0 | 1.0.67 (2026-08-31) | **Cloud encerra em 2027-08-31** [S51] | Evitar |
| LiveStore | Event sourcing + SQLite | Sim | Cloudflare, Electric, S2 | Apache-2.0 | 0.5.0 (2026-10-15) | "BETA" [S55] | Exige reescrever os dados como eventos |
| Supabase | Postgres + auth + storage | Sync você implementa | Cloud ou self-host | MIT/Apache | 2.118.0 (2026-10-15) | Maduro | Backend genérico; combina com PowerSync |

### D6 — Concorrentes: plataformas

| App | Desktop | Web | Mobile | Sync | E2EE | Fonte |
|---|---|---|---|---|---|---|
| Obsidian | Sim | **Não** | iOS/Android | Sync US$ 4/mês (anual) | Sim, por padrão | S58 |
| Logseq (DB) | Sim | app.logseq.com | iOS alpha/convite; Android "em breve" | RTC alpha (pago, self-host) | n/v | S14 |
| Bear | Mac | Não | iPhone/iPad | iCloud (Pro) | n/v | S60 |
| Craft | Mac/Win | Sim | iOS/iPadOS (Android incerto) | Nuvem | Listado | S13 |
| Capacities | Mac/Win/Linux | Sim | iOS/Android | Nuvem (não desliga) | **Não, por escolha** | S11 |
| Heptabase | Mac/Win/Linux | app.heptabase.com | iOS/Android | Nuvem | n/v | S61 |
| Readwise Reader | Mac/Win | Sim | iOS/Android | Nuvem | n/v | S62 |
| Anytype | Mac/Win/Linux | Não citado | iOS/Android | P2P local + backup na UE; self-host | Sim | S9 |
| Notion | Sim | Sim | Sim | Nuvem; offline só em desktop/mobile | Não | S7 |
| Tana Outliner | Mac/Win/Linux | Sim | iOS/Android | Nuvem | n/v | S10 |
| Standard Notes | n/v | Sim | iOS (na página) | Nuvem | Sim (auditado) | S59 |

### D7 — Armazenamento no browser (Safari/iPadOS em destaque)

| Recurso | Suporte | Nota para o PWA Reader | Fonte |
|---|---|---|---|
| IndexedDB | Universal | Metadados de livros e highlights | S35 |
| OPFS (`getDirectory`, `SyncAccessHandle`) | Safari 15.2+; WritableStream no 26.0 | Arquivos PDF/EPUB | S39, S38 |
| `navigator.storage.persist()` | Safari 15.2+ (heurística, sem prompt) | Chamar após instalar e importar | S39, S36 |
| `navigator.storage.estimate()` | Safari 17+ | Tela de armazenamento | S39 |
| `showDirectoryPicker` | Só Chromium (desktop 86+, Android 132+) | Sem acesso a pasta local no iPad | S39 |
| SQLite WASM `opfs-sahpool` | Sem COOP/COEP; 1 conexão; worker | Opcional (reaproveitar SQL) | S40 |
| SQLite WASM `opfs` | Exige COOP/COEP; Safari 17+ | Evitar (cabeçalhos) | S40 |
| `sqlite-vec` WASM | Build custom; demo | Não usar | S41 |
| Quota | Cerca de 60% do disco (inclusive web app da Home Screen) | Suficiente | S35, S36 |
| Remoção de dados | LRU sob pressão; regra de 7 dias do ITP (web app instalado tem contador próprio) | Instalar, chamar `persist()` e lembrar de exportar | S35, S37 |
| iPadOS 26 | Todo site na Home Screen abre como web app | Instalação trivial | S38 |

---

## (e) Fontes

Todas acessadas em 2026-10-17; a data de publicação aparece quando é conhecida.

**Parte 1 — produtos**

- [S1] Obsidian Changelog (1.13–1.14, 2026): https://obsidian.md/changelog · https://obsidian.md/changelog/page/2/
- [S2] Obsidian 1.9.0 (2025-05-21): https://obsidian.md/changelog/2025-05-21-desktop-v1.9.0/
- [S3] Obsidian 1.10.0 (2025-10-01): https://obsidian.md/changelog/2025-10-01-desktop-v1.10.0/
- [S4] Obsidian Help — Bases, Syntax, Functions: https://obsidian.md/help/bases · https://obsidian.md/help/bases/syntax · https://obsidian.md/help/bases/functions
- [S5] Fórum do Obsidian:
  - Feature requests (top): https://forum.obsidian.md/c/feature-requests/l/top?period=all
  - Tag bases: https://forum.obsidian.md/tag/bases/l/top?period=all · https://forum.obsidian.md/tag/bases
  - "Obsidian for web" (desde 2020-06-17): https://forum.obsidian.md/t/obsidian-for-web/2049
  - "Support checkboxes in tables" (desde 2020-05-26): https://forum.obsidian.md/t/support-checkboxes-in-tables/554
- [S6] Estatísticas de plugins do Obsidian (snapshot de 2026-10-17): https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json · https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json
- [S7] Notion:
  - Releases (3.8 em 2026-10-13; 3.7 em 2026-09-15): https://www.notion.com/releases
  - Ajuda: https://www.notion.com/help/charts · https://www.notion.com/help/formulas · https://www.notion.com/help/relations-and-rollups · https://www.notion.com/help/views-filters-and-sorts · https://www.notion.com/help/tables · https://www.notion.com/help/guides/working-offline-in-notion-everything-you-need-to-know
- [S8] Coda / Superhuman Docs: https://coda.io/ · redirecionamento de https://coda.io/pricing para https://superhuman.com/plans/docs
- [S9] Anytype Docs: https://doc.anytype.io/anytype/organize/views.md · https://doc.anytype.io/anytype/features/formulas.md · https://doc.anytype.io/anytype/getting-started/install.md · https://doc.anytype.io/anytype/data/privacy-and-encryption.md · https://doc.anytype.io/anytype/data/sync-and-backup.md · https://doc.anytype.io/anytype/data/sync-and-backup/self-host.md
- [S10] Tana Outliner: https://outliner.tana.inc/learn/features/supertags · https://outliner.tana.inc/
- [S11] Capacities Docs: https://docs.capacities.io/raw/reference/tables.md · https://docs.capacities.io/raw/faq/editing/running-total-tables.md · https://docs.capacities.io/raw/reference/queries.md · https://docs.capacities.io/raw/faq/general/device-support.md · https://docs.capacities.io/raw/misc/offline-support.md · https://docs.capacities.io/raw/more/end-to-end-encryption.md
- [S12] AFFiNE: https://affine.pro/ · https://github.com/toeverything/AFFiNE/releases (canaries de out/2026)
- [S13] Craft: https://www.craft.do/
- [S14] Logseq: https://github.com/logseq/logseq (README) · https://github.com/logseq/docs/blob/master/db-version.md
- [S15] Microsoft Loop (fontes terceiras, via busca, não abertas): https://petri.com/microsoft-loop-filters-tables-boards/ · https://learn.microsoft.com/en-us/answers/a/8496165 · https://petri.com/microsoft-loop-export-tables-excel/

**Parte 1 — bibliotecas e editor**

- [S16] Tiptap: https://tiptap.dev/docs/editor/extensions/nodes/table · https://tiptap.dev/pricing · https://tiptap.dev/docs/editor/markdown · https://github.com/ueberdosis/tiptap/tree/main/packages
- [S17] tiptap-markdown: https://github.com/aguingand/tiptap-markdown · serializer de tabela: https://github.com/aguingand/tiptap-markdown/blob/main/src/extensions/nodes/table.js
- [S18] Advanced Tables e md-advanced-tables: https://github.com/tgrosinger/advanced-tables-obsidian/blob/main/docs/help.md · https://github.com/tgrosinger/md-advanced-tables/blob/main/docs/formulas.md
- [S19] Sheet Plus: https://github.com/ljcoder2015/obsidian-sheet-plus · "30+ pacotes Univer" (via busca): https://deepwiki.com/ljcoder2015/obsidian-sheet-plus
- [S20] Univer: https://github.com/dream-num/univer
- [S21] Handsontable: https://handsontable.com/docs/javascript-data-grid/license-key/ · https://handsontable.com/pricing
- [S22] HyperFormula: https://github.com/handsontable/hyperformula
- [S23] Jspreadsheet CE: https://github.com/jspreadsheet/ce
- [S24] AG Grid Formulas (Enterprise): https://www.ag-grid.com/react-data-grid/formulas/
- [S25] SheetJS (instalação): https://docs.sheetjs.com/docs/getting-started/installation/frameworks
- [S26] Registro npm (`npm view`, versões e datas em 2026-10-17): https://registry.npmjs.org/
- [S27] Repositórios no GitHub (metadados via API em 2026-10-17): https://github.com/dream-num/Luckysheet (arquivado) · https://github.com/ruilisi/fortune-sheet · https://github.com/glideapps/glide-data-grid · https://github.com/nick-keller/react-datasheet-grid · https://github.com/ProseMirror/prosemirror-tables · https://github.com/formulajs/formulajs · https://github.com/mholt/PapaParse
- [S28] Pesos medidos a partir do jsDelivr (gzip local): https://cdn.jsdelivr.net/npm/ (handsontable@18.1.2, hyperformula@3.5.0, @formulajs/formulajs@4.6.1, papaparse@5.7.0, ag-grid-community@36.2.0, jspreadsheet-ce@5.0.4, @fortune-sheet/react@1.0.4)
- [S29] Plugins de meio-termo (via busca, não abertos): https://community.obsidian.md/plugins/simple-table-formulas · https://www.obsidianstats.com/plugins/obxcel · https://community.obsidian.md/plugins/bases-toolbox

**Parte 2 — plataforma, storage, IA**

- [S30] Tauri plugins-workspace (tabela de suporte por plataforma): https://github.com/tauri-apps/plugins-workspace
- [S31] Tauri — pré-requisitos (iOS só em macOS): https://v2.tauri.app/start/prerequisites/
- [S32] Tauri — plugins mobile: https://v2.tauri.app/develop/plugins/develop-mobile/
- [S33] Tauri: anúncio do 2.0 (2024-10-02) https://v2.tauri.app/blog/tauri-20/ · blog (2.12 em 2026-09-26) https://v2.tauri.app/blog/ · releases (v2.12.4 e v3.0.0-alpha.5 em 2026-10-14) https://github.com/tauri-apps/tauri/releases
- [S34] Apple Developer Program (US$ 99/ano): https://developer.apple.com/programs/
- [S35] MDN — Storage quotas and eviction criteria: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- [S36] WebKit — Updates to Storage Policy (2023-08-10): https://webkit.org/blog/14403/updates-to-storage-policy/
- [S37] WebKit — Full Third-Party Cookie Blocking and More (2020-03-24; regra de 7 dias e web apps da Home Screen): https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- [S38] WebKit — Safari 26.0 (2025-09-15) https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ · Safari 27.0 (2026-09-17) https://webkit.org/blog/18325/webkit-features-for-safari-27-0/
- [S39] MDN browser-compat-data (api/Window.json, api/StorageManager.json, api/FileSystemSyncAccessHandle.json): https://github.com/mdn/browser-compat-data
- [S40] SQLite WASM — Persistence: https://sqlite.org/wasm/doc/trunk/persistence.md
- [S41] sqlite-vec: https://alexgarcia.xyz/sqlite-vec/wasm.html · https://github.com/asg017/sqlite-vec
- [S42] SQLite — How To Corrupt: https://www.sqlite.org/howtocorrupt.html
- [S43] OpenRouter: OAuth PKCE https://openrouter.ai/docs/use-cases/oauth-pkce · limites por chave https://openrouter.ai/docs/guides/overview/auth/provisioning-api-keys
- [S44] Testes de CORS por curl (2026-10-17): `openrouter.ai/api/v1/chat/completions`, `api.tavily.com/search`, `graph.microsoft.com/v1.0/me/drive/root/children`, `www.googleapis.com/drive/v3/files`. O Dropbox não respondeu.
- [S45] Tavily — créditos e preços: https://docs.tavily.com/documentation/api-credits
- [S46] OWASP HTML5 Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html

**Parte 2 — sync, concorrentes, custos, LGPD**

- [S47] PowerSync: https://www.powersync.com/pricing · https://docs.powersync.com/llms.txt (SDK Tauri "alpha")
- [S48] Zero: https://zero.rocicorp.dev/ · https://zero.rocicorp.dev/docs/offline
- [S49] Evolu: https://www.evolu.dev/
- [S50] Jazz: https://jazz.tools/
- [S51] InstantDB — "Instant team joins OpenAI" (2026; Cloud até 2027-08-31): https://www.instantdb.com/essays/instant_team_joins_openai
- [S52] Turso: https://turso.tech/pricing · https://docs.turso.tech/sync/usage.md · https://docs.turso.tech/sync/conflict-resolution.md · https://docs.turso.tech/sdk/rust/guides/tauri.md
- [S53] Supabase: https://supabase.com/pricing
- [S54] Electric (README): https://github.com/electric-sql/electric
- [S55] LiveStore: https://livestore.dev/
- [S56] Automerge Blog (3.0 em jul/2025): https://automerge.org/blog/
- [S57] Triplit e cr-sqlite: https://github.com/aspen-cloud/triplit · https://github.com/vlcn-io/cr-sqlite
- [S58] Obsidian: https://obsidian.md/pricing · https://obsidian.md/help/sync/security · https://obsidian.md/help/sync/troubleshoot
- [S59] Standard Notes: https://standardnotes.com/
- [S60] Bear: https://bear.app/ · https://bear.app/faq/
- [S61] Heptabase: https://heptabase.com/
- [S62] Readwise Reader: https://readwise.io/read
- [S63] Cloudflare: limites do Pages https://developers.cloudflare.com/pages/platform/limits/ · Tunnel https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- [S64] GitHub Pages — limites: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- [S65] Vercel Hobby (atualizado em 2026-09-14): https://vercel.com/docs/plans/hobby
- [S66] ANPD — Resolução CD/ANPD nº 2/2022: https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/regulamentacoes-da-anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022
- [S67] Tailscale (não verificado; agregadores com dados divergentes): https://costbench.com/software/business-vpn/tailscale/free-plan · https://www.ssdnodes.com/learn/is-tailscale-free-plan-limits
- [S68] foliate-js e epub.js: https://github.com/johnfactotum/foliate-js · https://github.com/futurepress/epub.js
- [S69] Isolamento de storage da Home Screen (via busca, fontes antigas): https://bugs.webkit.org/show_bug.cgi?id=181849 · https://developer.apple.com/forums/thread/710157
- [S70] Notion 2.53, modo offline (2025-08-19; via busca): https://notion.com/releases/2025-08-19 · https://designcompass.org/en/2025/08/22/notion-offline-mode-release/

**Código do Monet (lido em 2026-10-17, sem alterações):** `src/components/Editor/extensions.ts`, `src/components/Editor/TasksQueryBlock.ts`, `src/storage/index.ts`, `src/storage/browser.ts`, mais a contagem de imports `@tauri-apps` e de comandos `invoke`.

## Lacunas

- **Sentimento no Reddit e no HN não acessado.** O Reddit bloqueia fetch e a busca não trouxe threads. O sentimento foi inferido por fórum, downloads e decisões de produto.
- **Preços e limites não verificados:** Tailscale (fetch bloqueado por certificado; fontes divergentes), Cloudflare Zero Trust e Tunnel, Google Play.
- **CORS do Dropbox não verificado.**
- **LGPD:** só a Res. ANPD 2/2022 foi verificada. O texto da lei (Planalto) não abriu, e transferência internacional não foi checada.
- **Detalhes não verificados:** databases do AFFiNE e do Craft; Microsoft Loop (só fontes terceiras).
- **Pesos parciais:** os pesos são de builds min/UMD, não tree-shaken, e o Univer não foi medido.
- **Tauri mobile:** não encontrei relatos confiáveis de produção em 2026; a compilação do `sqlite-vec` para Android e iOS não foi verificada.
- **A testar no spike:** se comentários HTML sobrevivem ao parse do Tiptap; memória do pdf.js no iPad com PDFs grandes; seleção de texto por toque; isolamento entre Safari e Home Screen no iPadOS 26.
