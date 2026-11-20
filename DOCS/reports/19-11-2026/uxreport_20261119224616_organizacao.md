# UX Report — Fatia 3: Organização de notas

> Varredura de UX (Fase B), fatia 3 do plano `DOCS/reports/19-11-2026/uxplan_20261119214504.md`.
> Escopo: `src/components/NoteTypes/`, `NoteBoard/`, `TagView/`, `MarksView/`, `SearchPalette/` (Ctrl+P e `MarkNotePicker`) e `CalendarView/`, mais os trechos de `App.tsx` que os montam.
> Base: branch `fix/divida-tecnica`. A análise foi feita pelo código, pelas specs (`noteboard.md`, `tags.md`, `notemark.md`), pelos estudos (`note_types_study.md`, `note_board_study.md`) e pelo único print disponível (`DOCS/prints/2026-10-29 12-14-03.png`, modal Note types). O app não foi executado.
> IDs dos achados: **O1…O27** (O = organização), para não colidir com as outras fatias. Custo: **P** (até 1 dia), **M** (2 a 4 dias), **G** (1 semana ou mais).

---

## 1. Resumo executivo

A organização do Monet está **boa no núcleo e cara nas bordas**. O board por tipo, a lista Marks e a lista da tag são maduros: têm estados vazios com ação, avisos contra perda silenciosa (opção apagada, filtro que esconde a nota nova) e confirmação com contagem nas exclusões. O Ctrl+P já normaliza acentos, ranqueia, mostra recentes e oferece a busca por significado só sob demanda, o que respeita a tese de IA à mão sem se impor.

O que mais atrapalha o usuário é **atrito para achar e classificar**:
- os filtros do Ctrl+P (`#caderno`, `tag:`, `mark:`) só funcionam com o nome exato e sem autocomplete;
- valores de propriedade não são buscáveis;
- criar uma opção de select exige ir ao modal de tipos e rolar até ela;
- o **Archive** está escondido no menu do tipo.

O Calendar tem inconsistências baratas de corrigir: a semana começa no domingo, enquanto nas Tasks começa na segunda; os marcadores não têm legenda; e os cartões só se distinguem pela cor.

## 2. Contexto do app

- **Proposta de valor:** companheiro de aprofundamento em um tema ao longo do tempo. O trabalho do usuário (notas, leituras) é o centro e a IA é meio (`productVision.md`).
- **Usuário-alvo:** o autodidata em estudo de longo prazo, que faz fichamento de livro e acompanha cursos (`PRD.md` §2).
- **Jobs de organização** (inferido das specs e do PRD):
  1. achar de novo uma nota ou um trecho (Ctrl+P, Marks);
  2. dar estrutura a notas de uma mesma espécie (tipos e propriedades, como um tipo "Fichamento");
  3. revisitar pontos de atenção (Marks);
  4. reunir um tema de vários cadernos (Tags);
  5. ver onde cada nota está numa classificação (Board);
  6. sustentar constância no tempo (Calendar).
- **Onde a fatia se encaixa:** é a camada transversal aos cadernos. O caderno é onde a nota mora; tipo, tag, marca e board são lentes por cima. Por isso, quatro lentes mais o caderno e a matéria somam **seis conceitos de organização**, o que torna a clareza de cada um crítica.

## 3. O que a fatia entrega

| Componente | O que o usuário faz |
|---|---|
| `NoteTypes/` | Cria tipos globais (nome, ícone, cor, template), propriedades (text, number, date, checkbox, select com opções coloridas e ordenáveis), "In list" e a seção Board. Na nota: "+ type", barra de propriedades, "Insert template". O TODOS tem o painel de progresso e o "Linked outside this checklist". |
| `NoteBoard/` | Board por tipo na área inteira: colunas pela propriedade, seções por um 2º select, chips, filtro de caderno, busca por título, "New" por coluna e seção, modal "Edit note" com Previous/Next, Export CSV (BYOR). |
| `TagView/` | Lista das notas de uma tag em todos os cadernos, agrupada por caderno, com filtro, chips de tags e arquivadas no rodapé. |
| `MarksView/` | Lista de revisão das marcas, agrupada por nota, com rótulo, contexto, chips de rótulo, filtro de texto e Resolve. |
| `SearchPalette/` | Ctrl+P com recentes, ranking normalizado, snippet, filtros (`#`, `type:`, `tag:`, `is:archived`, `has:mark`, `mark:`), seção de tasks, "Search by meaning" sob demanda e Alt+Enter para abrir ao lado. `MarkNotePicker`: seletor da citação `==texto==` do chat. |
| `CalendarView/` | Mês com marcadores (nota diária, checklist aberto, atividade, período e prazo de task), Today, ano editável, tasks do dia, "+ task", Overdue e cartões de notas datadas ou editadas no dia. |

## 4. Análise de usabilidade

### O que funciona bem

- **O board não deixa nada sumir em silêncio.** A nota com opção apagada vai para "No value" com o aviso "N with a deleted option" (`NoteBoard.tsx:200-205`). O "New" limpa a busca e liga o chip da seção (`NoteBoard.tsx:231-240`). Os estados vazios trazem a ação certa (Clear filters ou Board settings, `NoteBoard.tsx:283-300`).
- **Exclusões com consequência explícita:** tipo, propriedade e opção pedem confirmação com a contagem de notas afetadas (`NoteTypesModal.tsx:238-290`). A troca de tipo lista as propriedades que ficam ocultas (`App.tsx:2684-2690`).
- **O Ctrl+P serve como quick switcher:** tem recentes com a consulta vazia, Enter antes do debounce abre o 1º resultado (`SearchPalette.tsx:332-353`) e Alt+Enter abre ao lado, com dica no rodapé.
- **A IA aparece sob demanda:** "Search by meaning" só roda por Enter ou clique e respeita os cadernos com IA desligada (`SearchPalette.tsx:207-217, 250`). Isso está alinhado com o critério ④ da visão.
- **O estado vazio da lista Marks ensina o gesto:** "Select a passage… click Mark (Ctrl+Shift+M)…" (`MarksView.tsx:132-139`).
- **O TODOS sugere arquivar sem decidir pelo usuário:** "All done · Archive" (`TodosPanel.tsx:31-38`).
- **Navegação por teclado nos pontos de entrada:** cards, linhas e células abrem com Enter, e o dnd-kit do modal de tipos aceita teclado com instruções para leitor de tela.

### Problemas encontrados (visão geral, por impacto)

| # | Componente | Problema (para o usuário) | Evidência | Severidade | Custo |
|---|---|---|---|---|---|
| O1 | Ctrl+P | Filtros `#caderno`, `tag:` e `mark:` sem autocomplete; um nome parcial falha em silêncio | `noteSearch.ts:315-331`, `tasks.ts:825-830`, `SearchPalette.tsx:421` | Alta | M |
| O2 | Ctrl+P | Valor de propriedade não é buscável (autor, opção do select) | `noteSearch.ts:87-109` | Alta | M |
| O3 | Tipos | O select da nota não cria opção nova: é preciso ir ao modal de tipos | `PropertyControls.tsx:205-229` | Alta | M |
| O4 | Tipos | "Archive" fica dentro do menu do tipo (na nota sem tipo, atrás do "+ type") | `NoteTypePicker.tsx:125-137`, `App.tsx:3873-3881` | Alta | P–M |
| O5 | Marks | A lista Marks não filtra por caderno (o recorte natural da revisão) | `MarksView.tsx:107-129` | Média | P–M |
| O6 | Tipos | Modal Note types: rolagem longa, com Board e Template enterrados | `NoteTypesModal.tsx:421-457, 350-357, 554-573`; print | Média | M |
| O7 | Tipos | Ações destrutivas do modal só com ícone (lixeira ao lado do nome) | `NoteTypesModal.tsx:409-419` | Baixa | P |
| O8 | Tipos | "New option…" só grava com Enter; o texto fica no campo, como se estivesse salvo | `NoteTypesModal.tsx:371-385` | Baixa | P |
| O9 | Tipos | Menu do tipo com z-index 30 e sem setas | `NoteTypePicker.module.css:50-54` | Baixa | P |
| O10 | TODOS | Glifo ⚑ para prazo, enquanto nas Tasks o Flag significa Important | `TodosPanel.tsx:30` | Baixa | P |
| O11 | Board | "New" com "All notebooks" escolhe o caderno em silêncio (o destino só aparece no tooltip) | `NoteBoard.tsx:146-149, 172-185` | Média | P |
| O12 | Board | Export CSV com colunas de Radar (ring/quadrant) em qualquer board | `NoteBoard.tsx:338-341` | Baixa | P |
| O13 | Board | A contagem não mostra o total quando há filtro | `NoteBoard.tsx:313-316` | Baixa | P |
| O14 | Ctrl+P | "Recent" mostra as notas editadas por último, não as abertas por último | `noteSearch.ts:486-491`, `SearchPalette.tsx:163` | Média | P |
| O15 | Ctrl+P | Linha fixa com todos os chips de tipo entre o input e os resultados | `SearchPalette.tsx:493-510` | Baixa | P |
| O16 | Ctrl+P | `.itemMeta` duplicado corta o tipo e o caderno do resultado a 40% | `SearchPalette.module.css:115-121, 165-174` | Baixa | P |
| O17 | Ctrl+P | Sem semântica de combobox/listbox e input sem rótulo | `SearchPalette.tsx:417-424, 512` | Baixa | P |
| O18 | Marks | Resolve sem "Undo" visível e sem ir para a próxima marca | `MarksView.tsx:179-190`, `App.tsx:3407-3410` | Média | P |
| O19 | Marks | Chips de rótulo sem limite de altura | `MarksView.module.css:100-105` | Baixa | P |
| O20 | Tags | O cabeçalho diz "Tags", não qual tag está aberta | `TagView.tsx:117-122` | Baixa | P |
| O21 | Calendar | A semana começa no domingo; nas Tasks começa na segunda | `CalendarView.tsx:37`, `tasks.ts:293-296` | Média | P |
| O22 | Calendar | Marcadores sem legenda, só por cor ou forma mínima, e células sem `aria-label` | `CalendarView.tsx:406-437` | Média | P |
| O23 | Calendar | Cartões "datada" e "editada no dia" diferem só pela cor da borda | `CalendarView.tsx:502-531`, CSS `298-310` | Média | P |
| O24 | Calendar | "+ task" com glifo | `CalendarView.tsx:461-467` | Baixa | P |
| O25 | Navegação | "Set up a board…" fixo para quem nunca usa board | `NotebookList.tsx:974-984` | Baixa | P |
| O26 | Tags | Seção Tags vazia sem instrução ("no tags") | `NotebookList.tsx:1083-1085` | Baixa | P |
| O27 | Tipos | A barra de propriedades fica sempre aberta e empurra o corpo da nota | `NotePropertiesBar.tsx:44-57` | Baixa | P–M |

### Detalhe dos achados

#### Ctrl+P (SearchPalette)

**O1 — Filtros sem autocomplete e só com o nome exato** · Alta · M
- **Onde:** `src/lib/noteSearch.ts:315-331` (o `tag:` só casa uma tag inteira e o `#` chama `findProjectByTag`); `src/lib/tasks.ts:825-830` (o nome do caderno precisa vir inteiro, sem espaços: `normalizeName(n.name).replace(/\s+/g, '') === wanted`); `src/components/SearchPalette/SearchPalette.tsx:421` (a única dica é o placeholder). Viram chips clicáveis só os tipos e o "Marks" (`:465-510`).
- **Problema:** o usuário digita `#estat` para "Estatística" e o token não é reconhecido. Ele vira texto literal "#estat" e a palette responde "No results found". Para "Machine Learning", é preciso adivinhar `#machinelearning`. Com `tag:` e `mark:` acontece o mesmo com tags e rótulos de várias palavras. A sintaxe existe, mas não é descobrível, e o erro não explica o motivo.
- **Proposta:**
  - Quando a palavra sob o cursor começa com `#`, `tag:`, `type:` ou `mark:`, mostrar uma faixa de sugestões logo abaixo do input com os cadernos, tags, tipos ou rótulos que casam pelo prefixo normalizado.
  - Tab ou Enter completa com o token canônico; as setas navegam.
  - Prefixo único já conta como filtro.
  - Opcional: quando o token não casa com nada, o vazio diz "No notebook named “estat”".

**O2 — Valores de propriedade fora da busca literal** · Alta · M
- **Onde:** `src/lib/noteSearch.ts:87-109`. O `buildEntry` indexa só título, conteúdo e tags.
- **Problema:** num tipo "Fichamento" com a propriedade Author = "Kahneman", buscar "kahneman" não acha a nota se o nome não estiver no corpo. Uma opção de select ("Adopt", "Reading") também não é buscável. O estudo de tipos (§3) registra que o Capacities busca valores de propriedade, e o RAG já recebe as propriedades (§4.6, inferido). Assim, a busca por significado acha o que a busca literal não acha.
- **Proposta:**
  - Incluir no texto buscável a linha "Nome: valor" de cada propriedade com valor (nome da opção no select, data formatada), com peso abaixo do título.
  - Mostrar a propriedade que casou na linha do resultado, como a tag já é mostrada (`SearchPalette.tsx:621-626`).
  - Invalidar o cache também por `properties`.

**O14 — "Recent" é por edição, não por abertura** · Média · P
- **Onde:** `SearchPalette.tsx:163` → `recentNotes` (`noteSearch.ts:486-491`, ordena por `updatedAt`). O app já registra aberturas (Opened today, `openedAt` em `App.tsx:1608-1626`).
- **Problema:** a persona consulta notas (revisita o fichamento) mais do que edita. A nota lida há cinco minutos não aparece em "Recent", e o Ctrl+P falha como troca rápida justamente no uso de revisão.
- **Proposta:** "Recent" com as aberturas do log, da mais nova para a mais antiga, completadas pelas editadas por último.

**O15 — Parede de chips de tipo** · Baixa · P
- **Onde:** `SearchPalette.tsx:493-510`. Todos os tipos aparecem sempre; o print de 29/10 mostra 9 tipos, o que dá 10 chips com o "Marks", em duas linhas.
- **Problema:** no uso mais frequente (pular para uma nota), duas linhas de chips ficam entre o input e os resultados.
- **Proposta:** mostrar os chips de tipo só com a consulta vazia ou ao digitar `type:`, ou trocá-los por um único chip "Type ▾" com menu. O tipo ativo continua visível como chip removível.

**O16 — Meta do resultado cortada por CSS duplicado** · Baixa · P
- **Onde:** `SearchPalette.module.css:115-121` define `.itemMeta` como a linha de tipo + caderno, e `:165-174` redefine a mesma classe para o "TODOS" da task, com `max-width: 40%`, `nowrap` e `overflow: hidden`. A segunda definição vale para as duas (`SearchPalette.tsx:585, 611`).
- **Problema:** o nome do caderno, que é o que distingue duas notas "Chapter 3", é cortado a cerca de 200 px, sem reticências (o contêiner é flex).
- **Proposta:** renomear a classe da task (por exemplo, `.itemTodos`) e deixar `.itemMeta` só para a linha de meta.

**O17 — Acessibilidade da lista** · Baixa · P
- **Onde:** `SearchPalette.tsx:417-424` (input sem `aria-label`) e `:512-650` (divs sem `role`, sem `aria-activedescendant`).
- **Proposta:** padrão combobox: `role="combobox"` no input, `listbox`/`option` nas linhas, `aria-activedescendant` na seleção e `aria-label="Search notes"`.

#### Tipos de nota (NoteTypes)

**O3 — Sem "New option" no select da nota** · Alta · M
- **Onde:** `src/components/TasksView/PropertyControls.tsx:205-229` (select nativo com "Empty" mais as opções), usado por `NotePropertiesBar.tsx:44-57`. As opções só se criam em `NoteTypesModal.tsx:371-385`.
- **Problema:** para classificar uma nota numa categoria nova, o caminho é: menu do tipo → "Edit type…" → rolar até a propriedade → digitar a opção e dar Enter → "Done" → voltar ao select. O mesmo vale no modal "Edit note" do board. É o atrito que mais pesa no uso diário de tipos com select, que é justamente o caso do board.
- **Proposta:**
  - Último item do select: "New option…". Ele abre um campo inline que cria a opção no tipo, com a mesma validação de `validOptionName` (sem nome repetido), e já a aplica à nota.
  - Alternativa: um combobox leve com filtro e "Create “X”".

**O4 — Archive escondido no menu do tipo** · Alta · P–M
- **Onde:** `src/components/NoteTypes/NoteTypePicker.tsx:125-137`. Na nota **sem tipo**, o picker é o botão "+ type" (`App.tsx:3873-3881`), então arquivar pelo editor significa clicar em "+ type". Na nota com tipo, a ação fica no menu do rótulo do tipo (`App.tsx:3929-3930`).
- **Problema:** arquivar tira a nota das listas, da tag e das marcas. É uma ação de organização importante, e ninguém a procura em "type". Fora da coluna de notas (TagView, modal do board, nota aberta pelo Ctrl+P), o usuário não tem outro caminho visível.
- **Proposta:** tirar "Archive"/"Unarchive" do menu do tipo e colocar uma ação "Archive" (ícone `Archive` com rótulo) no cabeçalho da nota, perto do breadcrumb ou num menu "…" da nota. O cabeçalho é da fatia 2 (Editor), então a mudança precisa ser coordenada com ela.

**O6 — Modal Note types longo, com as seções principais enterradas** · Média · M
- **Onde:**
  - `NoteTypesModal.tsx:421-457`: grade de ícones sempre aberta, com até 192 px (`NoteTypesModal.module.css:124-131`);
  - `:350-357`: paleta de 9 bolinhas em **cada** linha de opção;
  - `:554-573`: Board e Template depois de todas as propriedades.
- **Problema:** no print de 29/10, o tipo Radar, com 2 selects de 4 opções, já empurra "New property", Board e Template para fora da dobra. O CSS atual corrige o vazamento do card, mas a rolagem continua longa. As opções viram uma grade de cerca de 80 bolinhas, com muito ruído para pouca informação.
- **Proposta:**
  - ícone como um botão com o ícone atual, que abre a grade num popover (z-index > 1000);
  - cor da opção como um único swatch que abre a paleta;
  - no topo do detalhe, âncoras ou abas "Properties · Board · Template", ou seções recolhíveis.

**O7 — Ações destrutivas só com ícone** · Baixa · P
- **Onde:** `NoteTypesModal.tsx:409-419` (lixeira ao lado do campo Name: excluir o tipo), `:512-520` (lixeira da propriedade) e `:358-366` (X da opção).
- **Problema:** a lixeira ao lado do nome é ambígua (apaga o nome ou o tipo?) e contraria a regra "ação importante com rótulo escrito". A confirmação existe, então o risco é baixo; o problema é clareza.
- **Proposta:** botão "Delete type" com texto no fim do detalhe, em estilo de perigo. Na propriedade e na opção, usar o mesmo ícone (Trash) nas duas.

**O8 — "New option…" só grava com Enter** · Baixa · P
- **Onde:** `NoteTypesModal.tsx:371-385`.
- **Problema:** o usuário digita a opção e clica em outro lugar (a cor, "Done"). O texto fica num input visualmente igual às opções salvas, parece gravado e se perde ao fechar.
- **Proposta:** gravar no blur quando o campo não está vazio (como os campos de renomear) ou dar ao campo o mesmo par input + "Add" do "New property".

**O9 — Menu do tipo: z-index e teclado** · Baixa · P
- **Onde:** `NoteTypePicker.module.css:50-54` (`z-index: 30`) e `NoteTypePicker.tsx:40-58` (só Esc).
- **Proposta:** z-index ≥ 1100, como o `MarkLabelPopover`, pela regra do projeto (popover acima de 1000), ou portal. Setas, Home/End e foco no 1º item ao abrir (o `role="menu"` já promete isso a quem usa leitor de tela). Não vi sobreposição real, só o descumprimento da regra.

**O10 — Glifo ⚑ e semântica conflitante** · Baixa · P
- **Onde:** `TodosPanel.tsx:30` (e `Sidebar.tsx:263`, fatia 1). Nas Tasks, prazo é `Target` (`TaskCard.tsx:197`, `TaskLine.tsx:153`, `CalendarView.tsx:328`) e `Flag` é **Important** (`TaskCard.tsx:324`).
- **Proposta:** `Target` da Phosphor para "Next deadline", no painel e na lista.

**O27 — Barra de propriedades sempre aberta** · Baixa · P–M
- **Onde:** `NotePropertiesBar.tsx:44-57`, que mostra todas as propriedades, vazias ou não. O estudo (§8, N3) já previa a barra recolhível como mitigação.
- **Problema:** um tipo com 5 ou 6 propriedades empurra o corpo da nota toda vez que ela abre, também no modal do board.
- **Proposta:** botão de recolher no cabeçalho da barra, lembrado por tipo. Recolhida, a barra mostra numa linha só os valores preenchidos.

#### Board (NoteBoard)

**O11 — "New" escolhe o caderno em silêncio** · Média · P
- **Onde:** `NoteBoard.tsx:146-149` (último "New", senão o caderno com mais notas do tipo, senão o Quick Notes) e `:172-185` (o destino só aparece no `title`). O breadcrumb do modal é texto fixo (`Editor.tsx:1064-1066`), sem como mover a nota.
- **Problema:** com "All notebooks", a nota cai num caderno que o usuário não escolheu e não vê, e só será descoberta depois no lugar errado.
- **Proposta:** com "All notebooks", mostrar ao lado do select de caderno "New notes go to: <Caderno ▾>", gravado como `lastNotebookId`. Em alternativa mínima, o rótulo visível "New · <Caderno>" no hover da coluna.

**O12 — Export CSV de Radar em todo board** · Baixa · P
- **Onde:** `NoteBoard.tsx:338-341`; formato BYOR na spec (§10: `name,ring,quadrant,isNew,description`).
- **Problema:** um board "Reading · by Status" exporta colunas "ring" e "quadrant". O botão não diz que o formato é para o Build your own Radar.
- **Proposta:**
  - P: rótulo "Export for Radar (CSV)", com tooltip explicando o BYOR.
  - M: menu "Export CSV ▾" com "Build your own Radar" e "Plain (property names)".

**O13 — Contagem sem total** · Baixa · P
- **Onde:** `NoteBoard.tsx:313-316`.
- **Proposta:** "5 of 12 notes" quando há caderno, chip ou busca ativos.

#### Marks (MarksView)

**O5 — Sem recorte por caderno** · Média · P–M
- **Onde:** `MarksView.tsx:107-129`: só filtro de texto e chips de rótulo. O Ctrl+P já combina `has:mark #Caderno` (`noteSearch.ts`).
- **Problema:** a persona revisa por livro ou curso, ou seja, por caderno. Com marcas em vários cadernos, "revisar as marcas deste livro" depende da sintaxe do Ctrl+P ou de digitar no filtro.
- **Proposta:** select de caderno no cabeçalho ("All notebooks" mais os cadernos com marcas), lembrado no localStorage como no board. As contagens dos chips de rótulo seguem o caderno escolhido.

**O18 — Resolve sem desfazer visível e sem "próxima"** · Média · P
- **Onde:** `MarksView.tsx:179-190`; `App.tsx:3407-3410` (abre a nota e resolve pelo editor).
- **Problema:** numa sessão de revisão, Resolve tira a linha e o foco se perde. Não há "Undo" à vista (o Ctrl+Z do editor deve desfazer, mas isso foi inferido, não verificado) e a marca seguinte não é selecionada. Revisar 20 marcas custa cerca de 40 cliques.
- **Proposta:** depois do Resolve, uma linha de status "Mark resolved · Undo" por uns 6 s no topo da lista, e a seleção (com reveal) da próxima marca. A spec deixa "resolver e ir para a próxima" para depois (§9); proponho fazer agora, porque é o ciclo central da lista.

**O19 — Chips de rótulo sem limite** · Baixa · P
- **Onde:** `MarksView.module.css:100-105`, enquanto o TagView limita a 3 linhas com rolagem (`TagView.module.css:96-103`).
- **Proposta:** o mesmo `max-height` do TagView.

#### Tags (TagView)

**O20 — Cabeçalho sem a tag aberta** · Baixa · P
- **Onde:** `TagView.tsx:117-122` (título "Tags"); a tag só aparece no placeholder (`:129`) e no chip ativo.
- **Proposta:** cabeçalho "#Física · 12 notes". Os chips continuam para trocar de tag.

**O26 — Seção Tags vazia sem instrução** · Baixa · P
- **Onde:** `NotebookList.tsx:1083-1085` ("no tags"), fatia 1. A lista Marks, ao contrário, ensina o gesto.
- **Proposta:** "Add a tag under a note’s title (+ tag) to gather notes from every notebook."

#### Calendar (CalendarView)

**O21 — Semana começa no domingo** · Média · P
- **Onde:** `CalendarView.tsx:37` (`DAY_LABELS` Sun…Sat) e `:222` (`getDay()`); nas Tasks a semana vai de segunda a domingo (`tasks.ts:293-296`), e Settings › Agenda trabalha de segunda a sexta.
- **Problema:** a mesma semana aparece com dois formatos. O usuário planeja no Week board (seg–dom) e revisa no Calendar (dom–sáb).
- **Proposta:** grade começando na segunda, coerente com as Tasks; opcionalmente, um ajuste em Settings › Agenda.

**O22 — Marcadores sem legenda** · Média · P
- **Onde:** `CalendarView.tsx:428-437`:
  - ponto de 4 px cheio: nota com conteúdo;
  - ponto vazado: checklist aberto;
  - ponto verde: atividade;
  - barra de 10 px: período de task;
  - barra de 14 px: deadline.

  CSS em `:249-281`. As células não têm `aria-label` (`:406-426`).
- **Problema:** o significado de cada marca não está escrito em lugar nenhum. A diferença é só de cor ou forma mínima, e um leitor de tela anuncia só "19".
- **Proposta:**
  - `title` e `aria-label` por célula, como "Wed 19 Nov · daily note with open items · 2 tasks · deadline";
  - uma legenda de uma linha abaixo da grade, recolhível.

**O23 — Cartões "datada" × "editada no dia" só pela cor** · Média · P
- **Onde:** `CalendarView.tsx:502-531`; CSS `:298-310`: roxo para a nota datada e `--accent-ai` (a cor da IA) para a editada no dia.
- **Problema:** o usuário não sabe por que a nota está ali. Num dia de muito uso, todas as notas mexidas entram, sem limite, misturadas às datadas de propósito. Usar a cor da IA para algo que não é IA confunde a semântica visual.
- **Proposta:**
  - subseções "Dated" e "Edited this day", a segunda recolhida acima de 5 itens;
  - outra cor para "editada";
  - "untitled" → "Untitled" (`:528`), como no resto do app.

**O24 — "+ task" com glifo** · Baixa · P
- **Onde:** `CalendarView.tsx:461-467`.
- **Proposta:** `Plus` da Phosphor com o rótulo "Task", como o "New" do board.

#### Navegação para boards

**O25 — "Set up a board…" fixo** · Baixa · P
- **Onde:** `NotebookList.tsx:974-984` (fatia 1).
- **Problema:** uma linha permanente, logo abaixo de Tasks, para um recurso avançado e opcional. Quem só faz fichamento e curso vê o convite para sempre.
- **Proposta:** mostrar a linha só quando algum tipo tem select ou checkbox (board possível), ou deixar dispensá-la ("Hide"). A entrada continua no modal de tipos.

### Cenários de borda não cobertos

- **Calendar lista arquivadas e notas sem caderno.** Os cartões "editada no dia" vêm de `notes.filter((n) => !isTaskBodyNote(n))` (`App.tsx:4296`), sem tirar as arquivadas nem as notas sem caderno (legado do Reader). O clique numa nota sem caderno só faz `setActiveId` (`App.tsx:4298-4303`), e não verifiquei se ela abre corretamente (inferido). Proposta: excluir as duas ou rotular a arquivada.
- **`#caderno` com nomes que só diferem por espaços** ("Data Science" e "DataScience") colidem: vale o primeiro (`tasks.ts:825-830`).
- **`mark:` e `type:` com espaços:** o token tira os espaços (`mark:pesquisardepois`). Os chips cobrem isso, mas quem digita de memória erra. O O1 resolve.
- **Renomear um tipo** quebra os `type:` que o usuário aprendeu de memória (sem alias). Baixo impacto.
- **Ano do Calendar:** o campo aceita qualquer inteiro positivo (`CalendarView.tsx:274-281`); um erro como "20261" leva ao ano 20261 sem aviso.
- **Board com um select de muitas opções** (10 colunas ou mais): a rolagem horizontal não foi verificada (o app não foi executado).
- **Migração TODOS:** "Unchecked groups are not offered again" (`TodosMigrationModal.tsx:45-47`) é irreversível pela UI. Provavelmente já foi usada uma vez; vale só como registro.

## 5. Avaliação frente aos objetivos do usuário

| Objetivo | Consegue? | Esforço | O que atrapalha |
|---|---|---|---|
| Achar uma nota | Sim, no básico (título e conteúdo, com acento ou sem) | Baixo | O1 (filtros não descobríveis), O2 (propriedades), O14 (recentes por edição) |
| Dar estrutura com tipos | Sim | Médio a alto na manutenção | O3 (opção nova exige o modal), O6 (modal longo), O27 (barra alta) |
| Revisitar pontos de atenção | Sim | Médio | O5 (sem recorte por caderno), O18 (revisão em série custosa) |
| Reunir um tema de vários cadernos | Sim | Baixo | Só detalhes (O20, O26) |
| Ver a classificação no board | Sim, recurso maduro | Baixo | O11 (destino do "New"), O12 (export de Radar genérico) |
| Constância no tempo (Calendar) | Sim, como agenda | Baixo | O21 (semana diferente das Tasks), O22 e O23 (marcadores e cartões opacos); datas dos tipos não aparecem (oportunidade 1) |
| Arquivar o que terminou | Sim, se achar | Alto na descoberta | O4 |

## 6. Oportunidades: funcionalidades relacionadas

| Sugestão | Problema que resolve | Impacto | Esforço | Prioridade |
|---|---|---|---|---|
| **Propriedades de data no Calendar** ("Show on calendar" na propriedade date do tipo) | Plans (Start/End), entregas e prazos de leitura não aparecem no dia; a constância depende de lembrar | Alto | Médio | Próximo |
| **"Use this note as template"** no menu do tipo | O template é Markdown cru num textarea (`NoteTypesModal.tsx:561-573`); o bom modelo de fichamento nasce de uma nota real | Médio | Baixo | Próximo |
| **"Create note “…”" no Ctrl+P** sem resultado (caderno ativo ou Quick Notes; com `type:` ativo, já tipada) | Achar e criar viram um gesto só; hoje o vazio é "No results found" | Médio | Baixo | Próximo |
| **Modo revisão na lista Marks** (↑↓, Enter, `r` = resolver e ir à próxima) | Revisar dezenas de marcas sem mouse; complementa o O18 | Médio | Baixo a médio | Depois |
| **Ordem "Recently updated" no board** (além de título) | Board de status (TODOS, leituras) pede o que mexeu por último | Baixo | Baixo | Depois |
| **Renomear e mesclar tags e rótulos** | Variações acumuladas; a spec adia até haver volume | Médio | Médio | Depois (com volume) |

**As três mais promissoras:**
1. **Datas dos tipos no Calendar.** O Planner já cria notas Plan com Start e End (PRD, Planner), e o Coach as cobra. Mostrar "Plan · <livro> ends" no dia fecha o ciclo planejar → ver no tempo → cumprir, que é o critério ① da visão (permanência no tema), sem IA nenhuma. Na configuração, um checkbox "On calendar" ao lado do "In list" na propriedade date; no Calendar, uma terceira cor de cartão e um marcador no dia.
2. **"Use this note as template".** O usuário refina o primeiro fichamento à mão e promove a nota a modelo com um clique. Reforça o critério ③ (a estrutura é do usuário; o template não escreve por ele).
3. **"Create note" no Ctrl+P.** É o par natural do quick switcher (padrão Obsidian e Capacities) e reduz o caminho para capturar uma ideia no caderno certo enquanto o usuário procura algo.

## 7. Próximos passos recomendados

1. **Correções de atrito alto:** O4 (Archive fora do menu do tipo; coordenar com a fatia 2), O3 (opção nova no select), O1 (autocomplete dos filtros do Ctrl+P), O2 (propriedades na busca).
2. **Revisão e recorte:** O5 (caderno na lista Marks), O18 (Undo e próxima), O14 (recentes por abertura).
3. **Calendar barato:** O21, O22, O23 e O24 (um lote só, tudo P).
4. **Modal de tipos:** O6, O7 e O8 (um lote, mesmo arquivo).
5. **Ajustes P soltos:** O9, O10, O11, O12, O13, O15, O16, O17, O19, O20, O25, O26 e O27.
6. **Oportunidades:** datas no Calendar, "Use this note as template" e "Create note" no Ctrl+P.

Sugestão de lotes sem arquivo em comum para os codeAgents:
- **A:** `SearchPalette.*` + `noteSearch.ts` (O1, O2, O14, O15, O16, O17);
- **B:** `NoteTypesModal.*` + `NoteTypePicker.*` + `PropertyControls.tsx` + `TodosPanel.tsx` (O3, O6–O10);
- **C:** `MarksView.*` + `TagView.*` (O5, O18–O20);
- **D:** `CalendarView.*` (O21–O24);
- **E:** `NoteBoard.*` (O11–O13).

O4, O25 e O26 tocam `App.tsx`, `Editor` e `NotebookList` (fatias 1 e 2) e devem ir junto com essas fatias.

## 8. Premissas e limites da análise

- **O app não foi executado** (por instrução: outros agentes usam a mesma árvore). Tudo vem do código, das specs e de um único print (29/10, modal Note types). O vazamento do card visível no print já foi corrigido no CSS (`NoteTypesModal.module.css:11-20`); o que fica do print é a rolagem longa (O6).
- **Inferências:**
  - que o Ctrl+Z do editor desfaz o Resolve (O18);
  - que o RAG recebe as propriedades (O2, pelo estudo §4.6);
  - que a nota sem caderno nos cartões do Calendar não abre corretamente (cenário de borda).
- **O9:** a sobreposição do menu do tipo não foi observada; o achado é o descumprimento da regra de z-index do projeto.
- **Validação útil com uso real** (sem telemetria no app, vale a observação do Coordenador por uma ou duas semanas):
  - quantas buscas do Ctrl+P terminam em "No results found" e se tinham `#` ou `tag:` (O1);
  - quantas vezes o modal de tipos é aberto só para criar uma opção (O3);
  - quantas marcas são resolvidas por sessão de revisão (O18);
  - se o Calendar é usado para olhar a semana ou só para abrir a nota do dia (O21 e O22);
  - se algum board além do Radar e do TODOS ganhou uso (O12 e O25).
