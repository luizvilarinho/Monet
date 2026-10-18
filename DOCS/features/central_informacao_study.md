# Estudo — Monet como central de informação

> Data: 2026-10-17 · Somente leitura (nenhum código alterado) · Base: develop v1.4.9 + cópia do banco de produção e do localStorage (24/06–17/10) · Material de mercado em `DOCS/features/mercado_2026-10/`
> Pergunta do Coordenador: "O Monet virou um grande gerenciador de informações — geradas pelo usuário, coletadas na web e geradas por IA —, tudo conectado à IA via RAG, o que tem funcionado bem. Dá pra melhorar como central de informação? Precisamos de mais RAG? De uma versão online simplificada? De planilhas mais sofisticadas ou de integração com Google Sheets?"
> Estudo irmão: `DOCS/features/tasks_entregas_study.md`.
> Privacidade: o repositório é público. Dados de trabalho aparecem agregados, sem nomes de empresa, pessoas ou sistemas.

---

## 1. TL;DR

- **Dá pra melhorar? Sim.** O RAG funciona bem para pergunta semântica de um turno, e foi isso que você sentiu. Mas a central tem quatro vazamentos medidos no seu uso:
  1. **O conhecimento mora no chat e quase nada volta para as notas.** São 659 mensagens e 1,9 M caracteres de chat, contra ~125 K de texto real em notas; o "Anotar" foi usado **6 vezes**.
  2. **Imagens são 98% do volume das notas e o RAG não as vê.** Prints de reunião, organogramas e telas viram `[image]`.
  3. **As fontes chegam à IA sem título, data ou tipo, e o chat não mostra o que usou.** O modelo recebe trechos como `resumo.md` ou um hash de URL.
  4. **Não há uma porta única de busca.** O Ctrl+P procura só em notas, por texto literal.
- **Mais RAG? Não mais fontes nem mais infraestrutura; RAG melhor, sim.** GraphRAG, Mem0, embeddings locais, multimodal e indexar o chat não se pagam em 3.530 chunks. O que se paga (~3 semanas, custo marginal de centavos):
  - consulta que entende follow-ups ("tenta de novo", "e na versão X?");
  - metadados e citações visíveis;
  - busca híbrida para termos exatos e rerank;
  - roteamento de perguntas que não são busca (agenda, tasks, "liste todos");
  - OCR das imagens;
  - um conjunto de perguntas reais para medir.

  Verifiquei na cópia do banco que o filtro por documento está **correto** (o `sqlite-vec` 0.1.9 aplica o escopo antes do KNN). O risco que o comentário do código sugere não existe.
- **Versão online? Para a central, não.** O valor de uma central online vem do **sync**, que é não-meta e a peça mais cara, e seu uso é de mesa.
  - Para **ler no tablet**, a única versão que vale é uma **PWA da Library sem sync** (M, 3–5 dias, depois de 1 dia de teste num iPad real). O Reader já roda todo no navegador, e o CORS de OpenRouter e Tavily funciona. Vale fazer **quando a leitura voltar a ser hábito**: ela está parada desde setembro.
  - Para acesso fora do PC sem nada disso, a saída barata é um **espelho Markdown numa pasta sincronizada**, para ler no celular pelo OneDrive. Nunca o `monet.db` (risco de corromper). Ele também resolve a "garantia de saída".
- **Planilhas / Google Sheets? Não.** As tabelas das suas notas são listas de referência geradas pela IA. A única tabela numérica (dieta) durou um dia, e a conta passou para o chat com memória e a tabela TACO na KB. O que vale é **dado tabular como fonte do RAG** (CSV/XLSX com chunk por linhas). Sheets: nenhuma evidência de demanda, nem no seu uso nem no mercado.
- **O que mais rende, fora o RAG:**
  - **"Anotar" em 1 clique e granular**, para o que vale guardar sair do chat;
  - **reuniões como fonte de primeira classe**, via um contrato VOLP → Monet;
  - **um servidor MCP local só leitura**, para que o Claude Code, que você já usa no trabalho, consulte specs, reuniões e decisões guardadas no Monet. É o padrão de 2026: o app de notas vira repositório que o agente consulta.

---

## 2. Como você usa (produção)

| Área | Números | Leitura |
| --- | --- | --- |
| Notas | 151 notas em 9 cadernos; 93 são notas diárias (53 com conteúdo). 6,6 M chars, **98% imagens base64** coladas (9 notas). Texto real ≈ 125 K chars | Muita informação visual; o texto das notas é curto (mediana de 205 chars) |
| KB | 309 documentos, **3.530 chunks**: uma documentação técnica TXT de 5,7 MB (1.633 chunks), livros (Odisseia 449), ~550 chunks de fontes web salvas pela IA, 174 de notas. 4 docs em erro (páginas web de 0,6–1,7 MB) | O corpus é dominado por documentação e web; as notas do usuário são minoria |
| Pastas monitoradas | Projeto de trabalho: **17 reuniões** (`dd-mm-yyyy_hh-mm-ss/{resumo.md, transcricao.md}`, geradas pelo VOLP) + PRD/spec + 1 PDF; `DOCS/specs` do próprio Monet. Uma pasta de aulas transcritas do MBA existe no disco, mas está fora da KB | A integração que funciona é por **arquivo local** |
| Web research | 7 pastas da IA (~90 arquivos, nome = hash da URL). **3 são órfãs** de chats apagados e seguem indexadas (~380 chunks, 11% da base), sem nenhum escopo que as enxergue | Não poluem respostas, mas são peso morto |
| Chat | 23 pastas, 57 conversas mantidas, **659 mensagens**. **62%** são de chats de livro (Odisseia: 262). Memória de pasta ativa em 10 pastas. Pico em julho (174 msgs do usuário), ~40/mês em set–out | O chat é a superfície de IA mais usada |
| Usos do chat | **Trabalho:** perguntas técnicas sobre a doc indexada, decisões de arquitetura, "extraia regras de negócio das reuniões", "liste os projetos". **Agenda:** "o que tenho pra fazer hoje?". **Pessoal:** dieta e treino com memória e a tabela TACO. **Estudo:** livro e MBA. **Produto:** Monet e VOLP. **Rápidas:** Ctrl+M | Central de informação de trabalho, vida e estudo |
| Slash commands | 77 no total: mai 37 → jul 14 → ago 16 → set 6 → **out 2**. O mais usado foi `/docs` (perguntar à base) | O chat com RAG substituiu os comandos |
| Ponte chat → nota | **6** blocos "Chat Response" em notas | A ponte existe, mas quase não é usada |
| Library | 5 livros, 253 grifos, 46 citações. Grifos: jul 198, ago 35, set 20, **out 0**. Progresso entre 1% e 43% | O estudo profundo esfriou; o trabalho cresceu |
| Tabelas | 7 notas com tabela, quase todas listas geradas pela IA (endpoints, ranking de modelos, lista de feira). 1 tabela numérica (dieta) usada num único dia | Pouca demanda por planilha |
| Modelos | Baratos e rápidos dominam (DeepSeek V4 Flash ~40%, Gemini Flash, GPT-5.4 mini/nano); premium de vez em quando | O custo por consulta precisa continuar baixo |

**Leitura geral:**
1. Entre julho e outubro o uso migrou do **estudo profundo** (persona do PRD) para **central de trabalho + entregas**.
2. O chat virou o **repositório de fato**.
3. A captura que funciona é **sem atrito**: colar print, gravar reunião e deixar a pasta monitorada levar.

---

## 3. Como a informação flui hoje (e onde vaza)

```
ENTRADAS                                ARMAZENA                          USA
você escreve (notas, diário) ──────┐
reuniões e aulas (VOLP → pasta) ───┤
uploads (docs, livros, TACO) ──────┼──► KB: 3.530 chunks (~4 K chars) ──► RAG top-5 por similaridade
web (o chat salva fontes) ─────────┘     sqlite-vec, 768 dim               (consulta = só a última msg)
                                                                              │ + contexto efêmero (nota/página)
                                                                              │ + memória da pasta
                                                                              ▼
chat (659 msgs, 1,9 M chars) ──── localStorage ─ ✗ fora do RAG ─ ✗ fora do Ctrl+P ── "Anotar" (6×) ──► nota
imagens coladas (98% do volume) ── ✗ viram "[image]"
fontes no prompt ───────────────── ✗ "resumo.md", "<hash>.md": sem título, data ou tipo; ✗ o chat não mostra fontes
```

Inventário técnico:
- **Busca:** só KNN no `sqlite-vec` (`src-tauri/src/documents.rs:1062-1168`), com escopo `rowid IN (…)` pré-aplicado. Verificado na cópia do banco: 100% dos resultados ficam no escopo e o top-5 coincide com a busca exata. O comentário em `documents.rs:1079` está desatualizado.
- **Recuperação no chat:** `topK = 5` (`src/hooks/useChat.ts:2423`), 5/8 no `/docs` (`src/App.tsx:1413`). Sem FTS/híbrido, sem rerank (o rerank existe só no deep research).
- **Consulta:** o embedding usa só a última mensagem (`useChat.ts:2422`), em todo turno, inclusive em "valeu!".
- **Contexto injetado:** `[documentName]\nsnippet` (`useChat.ts:2426-2431`). O `/docs` mostra fontes (`AiCard.tsx`); o chat não.
- **Chunking:** 4.000 chars com overlap de 400, por parágrafo (`documents.rs:45-46, 322`).
- **Persistência das notas:** `tiptap-markdown` 0.9.0 (`src/components/Editor/extensions.ts:8`), sem manutenção desde 2025-09 (ver I18).
- **Imagens:** viram `[image]` no texto indexado (`src/lib/noteFileText.ts:19-21, 137-139`).
- **Related content:** léxico, Jaccard de tokens e tags (`RelatedContent/scoreNotes.ts`). **Ctrl+P:** `storage.searchNotes`, LIKE só em notas.
- **Chat:** fica no localStorage por decisão de produto (chat = rascunho). Hoje ocupa ~3,8 MB em UTF-16; a cota do WebView2 fica entre 5 e 10 MiB [não verificado], e `saveConversations` engole o erro de cota (`src/hooks/useChat.ts:405-423`).

---

## 4. Mercado: o que os líderes fazem com "minha informação + IA"

Detalhes e fontes em `mercado_2026-10/` (01 generalistas, 02 PKM, 03 IA em notas, 04 leitura e estudo, 05 negócio, 08 RAG).

| Produto | Ideia central | O que vale adaptar (ou evitar) |
| --- | --- | --- |
| **Gemini Notebook** (ex-NotebookLM, renomeado em 07/2026) | Respostas ancoradas nas fontes com **citação clicável**; > 30 M de usuários; virou "fábrica de saídas" (áudio, slides, flashcards) e agente | **Adaptar:** citação clicável até o trecho. **Evitar:** a IA produzindo o artefato final |
| **Readwise Reader** (Ghostreader v3) | Chat com o contexto da posição de leitura, cita e linka o trecho, escopo "até onde li"; Global Ghostreader (08/2026) na biblioteca inteira | O mesmo padrão do seu chat de livro, mais **citação** e **escopo** |
| **Notion AI** | Agentes que escrevem direto na página; créditos; "suggest edits" opt-in | **Evitar:** o agente que edita sozinho (é a reclamação nº 1) |
| **Obsidian** | Sem IA no núcleo; **CLI oficial (1.12) para agentes**; os tópicos mais vistos do fórum são trazer Claude Code e Codex para o vault | O usuário avançado quer **o próprio agente** sobre as próprias notas |
| **Reflect Open** (07/2026) | Tauri + Rust, Markdown local, BYOK com OpenRouter, MCP; Mac-first, Windows experimental | Concorrente de arquitetura mais parecida. Sinal de que **Markdown + MCP** é o caminho |
| **Capacities** | Objetos tipados, conectores MCP para ChatGPT, Claude e Cursor; leitor de PDF; **encerrou o BYOK** (08/2026) | BYOK virou traço de apps indie, e é argumento de posicionamento |
| **Heptabase** | Highlight cards, whiteboards, AI Tutor, `/break-down-book`, MCP + CLI; aceita BYOK com OpenRouter; app Windows; nuvem e conta, US$ 8,99–53,99/mês | **Concorrente mais direto da persona.** O agente e o Tutor escrevem no workspace (contra a tese) |
| **Tana** | Pivô para "agentic meeting platform"; MCP local com modal de aprovação no app | Reunião → registro; aprovação dentro do app |
| **Granola** | O usuário escreve o esqueleto, a IA aumenta; avaliação de US$ 1,5 bi | Valida "o usuário escreve, a IA aumenta", em reuniões |
| **Mem 2.0 / Recall / mymind** | Auto-organização, resurfacing e nudges proativos | **Evitar:** IA proativa |
| **Joplin 3.7** | IA desligada por padrão, BYOK (OpenRouter/Ollama), mas edita a nota direto | O mais próximo da tese entre os generalistas |
| **Evernote / OneNote / Loop / Craft** | Revisar antes de aplicar ("Edit mode", "Add to doc", "Insert", "Explore") | **"A IA não escreve direto" virou padrão**, não diferencial |

Padrões de 2026:
1. **Citação clicável é requisito mínimo** de qualquer "pergunte às suas fontes".
2. **A IA entra de fora:** MCP e CLI em Obsidian, Logseq, Roam, Heptabase, Capacities, Anytype, RemNote, Reflect, Tana, SiYuan e Trilium. São mais de 10 mil servidores MCP públicos.
3. **Markdown e arquivos abertos voltaram a ser vantagem**, por causa dos agentes e do medo de lock-in (Pocket, Omnivore e Notion Mail fecharam; o Evernote apertou o plano grátis).
4. **Revisar antes de aplicar virou convenção.** Defensável no Monet é a **combinação**: nota perene + chat descartável + BYOK + contexto por pasta + Library, com a curadoria como regra do app inteiro.
5. **IA local no Windows ficou viável** (Microsoft Foundry Local, SDK em Rust), mas só para busca, embeddings e resumos simples.
6. **Há cansaço de IA forçada e de "segundo cérebro".** A tese "IA convocada" tem público, desde que seja dita explicitamente.

**Sobre o PRD §3** (`mercado_2026-10/market_03_ia_em_notas.md` §f). A frase "nenhum app usa a IA como mecanismo de aprofundamento mantendo a curadoria do usuário" **não se sustenta como absoluta**. Ela foi testada contra quatro critérios: IA convocada, ancorada no material do usuário, registro só por ação explícita, foco em aprofundamento.
- O **MarginNote 4** cumpre os quatro ("You stay the author"; só Apple, sem BYOK).
- O **Readwise Reader** e o **Heptabase** cumprem quase todos.

O que continua sem equivalente é a **combinação**: Windows, local-first, sem conta, BYOK, fichamento com leitor integrado, chat descartável por pasta e curadoria como regra de arquitetura do app inteiro (ver D1).

Duas ressalvas da mesma pesquisa:
- **"Convocada" não basta.** Um `/summarize` chamado pelo usuário continua delegando o trabalho de geração. A perda de aprendizado vem de a IA fazer a elaboração, não da proatividade (Bastani, PNAS 2025: −17% na prova sem IA; RCT da Anthropic 2026: 50% × 67% de maestria; Melumad & Yun 2025: resumo de LLM gera conhecimento mais raso).
- **Os usuários preferem a condição que aprende menos.** No RCT Cambridge/Microsoft (2025), anotar sozinho ou com LLM ao lado venceu "só LLM" em retenção, mas os alunos preferiram o LLM.

---

## 5. Respostas às perguntas

### 5.1 Dá pra melhorar como central de informação?

Sim, em três eixos, nesta ordem:
1. **Confiança:** ver de onde veio cada resposta, com data e tipo, e poder abrir a fonte.
2. **Recuperação:** acertar follow-ups, termos exatos e perguntas de agenda ou varredura.
3. **Captura sem atrito, nos dois sentidos:**
   - o que entra hoje sem ser visto: imagens e reuniões sem metadados;
   - o que não sai do chat por falta de uma ponte barata.

### 5.2 Precisamos de mais RAG?

**Não mais fontes nem mais infraestrutura.** Seis pontos cegos baratos explicam as falhas que você encontraria:

| Ponto cego | Pergunta que sofre | Correção | Esforço |
| --- | --- | --- | --- |
| Consulta = só a última mensagem | "tenta de novo", "continue", "e na versão 9.0.0.1?" | Gating ("continue" reusa o contexto anterior; "valeu" não busca) + reescrita do follow-up por um LLM barato (~US$ 0,0003/turno), que devolve também palavras-chave e filtros de data | P |
| Sem busca lexical | Nomes exatos de API, versões, códigos | FTS5 (`unicode61 remove_diacritics 2`) + vetor com RRF | P–M |
| Contexto sem título, data ou tipo | "o que decidimos na última reunião?", "segundo qual nota?" | Cabeçalho por chunk (título · tipo · data · caderno), com data da reunião tirada da pasta e `Source/Retrieved` da web; citações [n] no prompt e na UI | P–M |
| Top-5 por similaridade para tudo | "o que tenho pra fazer hoje?", "liste os projetos", "regras de todas as reuniões" | Roteamento: completar as ferramentas estruturadas (o `query_tasks` já existe; faltam a nota do dia e as notas por data); para varreduras, o escopo inteiro em contexto longo (100 K tokens no DeepSeek V4.1 Flash ≈ US$ 0,015, preço de out/2026) ou map-reduce | M |
| Imagens invisíveis | Organograma, print de tela, diagrama | OCR local + legenda opcional (§6, I7) | M |
| Sem rerank e sem peso por fonte | Fontes web e IA competem com suas notas (a doc técnica sozinha tem 46% dos chunks) | Rerank (reusar o Cohere do deep research, ~US$ 0,001–0,002/consulta) + peso maior para o que você escreveu | P |

**Antes de tudo, o golden set:** 30–50 perguntas reais tiradas do seu histórico de chat, separadas por classe (follow-up, termo exato, documento, temporal, varredura, imagem), com recall@k e MRR. Sem ele, "funciona bem" é impressão e nenhuma melhoria se prova.

**Não fazer agora:**
- **Fora de escala para 3.530 chunks:** GraphRAG, LightRAG e HippoRAG; Mem0, Zep e Letta; ColPali e embeddings multimodais; embeddings ou reranker locais; HyDE.
- **Só com evidência:** indexar o histórico do chat (vale reavaliar depois da D2); trocar o modelo de embedding (só com o golden set, porque os rankings multilíngues não predizem o pt-BR, segundo o MTEB-PT 2026).

### 5.3 Precisamos de uma versão online (simplificada)?

**Para a central, não. Para a leitura no tablet, só uma PWA da Library, e só quando a leitura voltar.** Detalhes em `mercado_2026-10/market_07_planilhas_online.md` Parte 2.

| Caminho | O que resolve | Custo | Veredito |
| --- | --- | --- | --- |
| **PWA da Library/Reader, sem sync** | Ler PDF/EPUB e conversar com o livro no tablet (o padrão do chat que você validou) | M: MVP de 3–5 dias, mais 1 dia de teste num iPad real. Pode virar G se o grifo por toque exigir retrabalho. O Reader (pdf.js) já é client-side; o CORS de OpenRouter e Tavily foi verificado; o Safari tem OPFS, `persist()` e quota de ~60% do disco para web app instalado; hospedagem estática grátis (Cloudflare Pages) | **A única que vale, quando a leitura voltar a ser hábito.** Para não virar ilha, incluir export/import de grifos em JSON (P–M) entre tablet e desktop |
| **Tauri 2 mobile (Android/iOS)** | Mesmo código, nativo | G (iOS exige macOS, Xcode e US$ 99/ano; plugins desktop como single-instance e updater não existem no mobile) | Não: mesma ilha sem sync |
| **Web + backend com sync** | A central em qualquer lugar | G+ (semanas) e operação contínua (contas, LGPD, suporte). Fornecedores instáveis: o InstantDB Cloud encerra em 2027-08; o Zero não grava offline; planos grátis de Supabase e PowerSync pausam por inatividade | Não: contraria a arquitetura e as não-metas. Se um dia for preciso, a decisão é *qual sync* (PowerSync ou Turso Sync; Evolu para E2EE), não *qual front-end* |
| **Acesso remoto ao desktop** (túnel) | Usar o Monet de casa pelo celular | G | Não: aumenta a superfície de ataque e exige o PC ligado |
| **Espelho Markdown numa pasta escolhida (OneDrive/Drive)** | Ler as notas no celular pelo app de nuvem; garantia de saída; arquivos que outros agentes leem | P–M: o Monet já grava um `.md` por nota no appData para o RAG | **Sim** (I15). Só leitura. **Nunca** pôr o `monet.db` na pasta sincronizada (a documentação do SQLite descreve corrupção nesse cenário) |

Se a necessidade for **captura** fora do PC, comece por um arquivo de inbox numa pasta sincronizada, lido pelo Monet, e não por um app web (ver o estudo irmão, §5.4).

### 5.4 Precisamos de planilhas mais sofisticadas? E de Google Sheets?

| Nível | O que é | Evidência no seu uso | Veredito |
| --- | --- | --- | --- |
| A enxuto | Na tabela que já existe: ordenar por coluna; soma, média e contagem da seleção (como a barra do Excel); linha de total materializável; colar TSV/CSV do Excel e exportar CSV; "perguntar à tabela" / "transformar" sob comando | Tabelas de referência; 1 tabela numérica que durou um dia | Opcional, baixa prioridade (P–M, 1–3 dias) |
| B | "Database view" estilo Notion/Obsidian Bases sobre propriedades | Os metadados custom das tasks (o "B" que já existe) têm 0 usos | **Não** (B1, uma visão em tabela no bloco `/tasks`, só se os campos de task passarem a ser usados) |
| C | Planilha completa com fórmulas | Nenhuma | **Não.** Esforço G, briga com a persistência em Markdown e com o RAG, e as bibliotecas pesam ou têm licença ruim: Handsontable é comercial, HyperFormula é GPL-3.0, fórmulas do AG Grid são Enterprise, Univer cobra import/export, gráficos e pivot. Se surgirem tabelas numéricas frequentes, começar por "C-lite": anexar `.xlsx/.csv`, preview só-leitura e "abrir no Excel" |
| Fonte tabular no RAG | CSV/XLSX na KB com chunk por linhas, repetindo o cabeçalho | A tabela TACO é usada pela pasta de saúde, mas como TXT corrido | **Sim** (P–M, I17) |
| Google Sheets | Embed ou API | Zero menções; no mercado, a planilha local do Obsidian tem 211 K downloads contra ~2 K do embed do Google | **Não** |

**Mercado:** o uso pessoal escolheu "views + totais", não fórmulas. No Obsidian, o Advanced Tables (tabela Markdown melhor) tem 3,29 M downloads, contra 0,34 M dos três plugins de planilha somados. Os pedidos sobre o Bases tratam de visualização, não de cálculo. Anytype, Loop e Capacities oferecem agregação de coluna, não Excel.

A conta da dieta mostra o padrão: o "cálculo" acontece no chat (memória + TACO), não numa planilha. O investimento certo é a IA ler bem dados tabulares, não o Monet virar Excel.

**Pré-requisito técnico, se mexer em tabelas:** o `tiptap-markdown` 0.9.0, que grava todas as notas, está sem manutenção (o autor diz no README que não vai tratar issues nem PRs). Ele já perde largura de coluna e alinhamento, e cai para HTML em tabelas complexas. Qualquer metadado novo de tabela deve morar num elemento customizado (como o `<tasks-query>` já faz). Ver I18.

---

## 6. Propostas priorizadas

Esforço: P (até 1 dia), M (2–4 dias), G (1+ semana). "PRD §9" = conflito com as não-metas.

### Bloco 1 — Confiança e recuperação (RAG melhor)

| # | Proposta | Valor | Esforço | Riscos | PRD §9 |
| --- | --- | --- | --- | --- | --- |
| I1 | **Golden set:** 30–50 perguntas reais do seu histórico, por classe, com script de recall@k e MRR, rodado a cada mudança de RAG | Habilita todo o resto | P–M | Viciar o set: manter separado do ajuste | Nenhum |
| I2 | **Consulta com histórico:** gating + reescrita do follow-up (LLM barato, saída JSON com consulta, palavras-chave e filtros de data) | **Alto** | P | +1 chamada barata por turno | Nenhum |
| I3 | **Metadados e fontes visíveis:** cabeçalho por chunk (título · tipo · data · caderno; reunião = data da pasta; web = `Source`/`Retrieved`; livro = título + página); citações [n] no prompt; **"Fontes (n)" abaixo da resposta do chat**, clicável, abrindo nota, documento ou página | **Alto** | P–M (re-embed ≈ US$ 0,08) | Reindexação completa | Nenhum |
| I4 | **Busca híbrida:** FTS5 + vetor com RRF | Alto para doc técnica | P–M | Tokenização pt-BR | Nenhum |
| I5 | **Rerank + peso por fonte:** 30–40 candidatos → rerank → 6–8 com limiar; o que você escreveu pesa mais que web/IA | Médio-alto | P | Custo por consulta (centavos/100) | Nenhum |
| I6 | **Roteamento:** ferramentas `get_day(data)` e `notes_by_date` ao lado do `query_tasks`; para varreduras ("todas as reuniões"), escopo inteiro em contexto longo ou map-reduce; tool `search_knowledge_base` com filtros (tipo, data, caderno) para o modelo refinar | **Alto** | M | Custo maior nas varreduras (centavos) | Nenhum |
| I7 | **Imagens visíveis:** OCR **local** dos prints colados (API de OCR do próprio Windows, sem rede); legenda por modelo de visão **opt-in por caderno** (~US$ 0,4–0,8 por 1.000 imagens); o texto fica no índice, não na nota. Junto: guardar imagens como arquivo, não base64 no banco | **Alto** (98% do volume) | M | Privacidade: prints de trabalho saem da máquina se a legenda for ligada (D3) | Nenhum (a IA não escreve na nota) |
| I8 | **Higiene da KB:** remover as 3 pastas web órfãs (~380 chunks) e, ao apagar uma pasta de chat, oferecer apagar a pasta web dela; reprocessar os 4 erros (truncar páginas enormes); validade ou revisão para fontes web; dedup | Médio | P–M | — | Nenhum |

### Bloco 2 — Fechar o ciclo chat → registro (sem ferir a tese)

| # | Proposta | Valor | Esforço | Riscos | PRD §9 |
| --- | --- | --- | --- | --- | --- |
| I9 | **"Anotar" em 1 clique e granular, em todos os chats:** o chat das Anotações já tem "Insert selection" e inserir no cursor ou no fim (`NotesChatPanel.tsx:279`); levar o mesmo ao Chat principal, ao Reader e ao Assistant. Destino padrão = a nota ligada à pasta (a do livro, a aberta do caderno ou a diária); link de volta para a conversa; o modal atual vira "Anotar em…". Com `decisoes_study.md`: "Salvar como termo / decisão / nota" | **Alto** | P–M | — | Nenhum |
| I10 | **"Registrar decisões" de uma conversa (sob comando):** a IA **propõe** um bloco curto (decisões, pendências, por quê) com prévia editável; nada entra sem "Salvar". Em pastas de estudo, a proposta é **perguntas para você responder**, não um resumo, para preservar a elaboração | Alto (trabalho) | M | Virar "resumo automático" se não for sob comando | Nenhum, se for sob comando e com aprovação |
| I11 | **Aviso de cota + export das conversas** (.md por pasta), honrando a decisão de chat descartável | Médio | P | — | Nenhum |

### Bloco 3 — Portas de entrada e de saída

| # | Proposta | Valor | Esforço | Riscos | PRD §9 |
| --- | --- | --- | --- | --- | --- |
| I12 | **Busca única (Ctrl+P):** notas, documentos da KB, grifos e citações, tasks; lexical (FTS5 do I4) + semântica; ícone por tipo; abre no lugar certo | Alto | M | — | Nenhum |
| I13 | **Contrato VOLP → Monet:** front-matter no `resumo.md` (título, data, projeto, participantes). O Monet lê, mostra a reunião como card no dia do Calendar, cita "Reunião 14/10 15:38" e oferece "Extrair ações" (T4 do estudo irmão). Incluir a pasta de aulas do MBA como fonte do caderno do curso | **Alto** | P–M (você controla os dois apps) | — | Nenhum |
| I14 | **Servidor MCP local só leitura** + deep links `monet://`: `search_knowledge`, `get_note`, `get_day`, `list_tasks`, devolvendo links `monet://`. Desligado por padrão, com escopo por caderno (reusar `notebook_document_visibility`). Binário separado `monet-mcp.exe` (crate `rmcp`, stdio, pacote MCPB). Escrita só como **proposta** num inbox do Monet, numa fase 2 | Alto para você (Claude Code no trabalho) | M (leitura) / G (propostas) | Injeção indireta via conteúdo web colado; concorrência no SQLite (abrir read-only, com WAL e `busy_timeout`); no MSIX, o servidor precisa de *package identity* para enxergar o AppData do pacote | Nenhum (só leitura) |
| I15 | **Espelho Markdown / export aberto:** notas com front-matter, grifos e citações (página e cor) e tasks numa pasta escolhida. No OneDrive, é leitura no celular e garantia de saída | Médio-alto | P–M | Conflito se o usuário editar o espelho (deixar claro que é só leitura) | Nenhum |
| I16 | **Entidades leves (opcional):** `@pessoa`, `@sistema` e `@projeto` criam ou linkam uma página com backlinks (reuniões, tasks, notas). A memória do chat do Calendar já começou a listar "pessoas e sistemas citados" sozinha | Médio-alto | G | Escopo: não virar CRM | Nenhum |
| I17 | **Dado tabular como fonte:** CSV/XLSX na KB, com chunk por grupo de linhas repetindo o cabeçalho (ex.: a tabela TACO) | Médio | P–M | — | Nenhum |

### Bloco 4 — Fundação técnica

| # | Proposta | Valor | Esforço | Riscos | PRD §9 |
| --- | --- | --- | --- | --- | --- |
| I18 | **Plano de saída do `tiptap-markdown`** (sem manutenção desde 2025-09). Agora: testes de ida e volta (Markdown → editor → Markdown) com notas reais anonimizadas, cobrindo tabelas, toggles, notas vinculadas, blocos `/tasks` e lembretes, e a regra "metadado novo = elemento customizado". Depois: migrar para o oficial `@tiptap/markdown` (3.32, ainda "early release") quando ele estabilizar | Alto (protege 100% das notas) | P (testes) / G (migração) | A migração pode mudar a serialização de notas antigas: rodar os testes antes | Nenhum |

---

## 7. Possíveis usos que o Monet pode ter (coerentes com a tese)

| Uso | O que já existe | O que falta | Encaixe na tese |
| --- | --- | --- | --- |
| **Memória de projeto** ("o que decidimos sobre X?", "pendências da reunião de 14/10") | Reuniões via VOLP, specs na pasta monitorada, chat por pasta | I3, I6, I13, I10 | O registro é seu; a IA busca e cita |
| **Contexto para o Claude Code** (specs, ADRs, decisões e reuniões disponíveis ao agente de código) | `.md` por nota, KB, docs | I14 (+ I15) | A IA externa só lê; escrever = proposta |
| **Retomar a leitura** (livros parados em 36–43%) | Memória da pasta do livro guarda onde você parou | "Retomar": recap até a página atual, sob comando; grifos antigos voltando na nota diária (estilo Readwise) | Sustenta a permanência no tema |
| **Revisão ativa** do que você leu e estudou | Grifos, citações, notas de aula | `/quiz` sobre **seus** grifos e notas, com resposta digitada e correção que cita a página; mais tarde, revisão espaçada (FSRS) | Retrieval practice: o esforço é seu (Dunlosky; Bastani, PNAS 2025) |
| **Curso como fonte** (MBA) | Aulas transcritas pelo VOLP no disco | Incluir na KB do caderno do curso (I13); citação "aula → tempo" | Acompanhamento de curso, a 2ª atividade da persona |
| **Diário de saúde** | Chat com memória + TACO + nota diária | Nada novo: funciona como está (I17 melhora a TACO) | Não virar app de dieta (fora de escopo) |

---

## 8. Fases

| Fase | Conteúdo | Resultado |
| --- | --- | --- |
| **1 — Confiança** (~1 semana) | I1 golden set, I2 consulta com histórico, I3 metadados + "Fontes (n)", I8 higiene, I11 aviso de cota, I18 testes de ida e volta do Markdown | Você vê de onde veio cada resposta; os follow-ups funcionam; as notas ficam protegidas contra regressão de serialização |
| **2 — Recuperação** (~1 semana) | I4 híbrida, I5 rerank + peso por fonte, I6 roteamento, I9 "Anotar" em 1 clique | Termos exatos, agenda e varreduras acertam; o que vale guardar sai do chat |
| **3 — Captura** (~1–2 semanas) | I7 imagens, I13 contrato VOLP, I12 busca única, I17 tabular | O que você cola e grava passa a ser encontrável |
| **4 — Abertura** (experimento) | I14 MCP só leitura + deep links, I15 espelho Markdown, I10 "Registrar decisões"; I16 se houver fôlego | O Monet vira fonte para o seu agente de código e ganha garantia de saída |

Medir no fim de cada fase: golden set (recall@5 e MRR por classe), número de "Anotar"/mês e uso do Ctrl+P.

---

## 9. Decisões necessárias do Coordenador

1. **D1 — PRD (persona e §3).** Incluir a persona **"profissional do conhecimento que usa o Monet como central de trabalho + entregas"** ao lado do autodidata? E trocar a frase "nenhum app…" pela redação sugerida na pesquisa: *"Os líderes (Notion, Gemini Notebook, Evernote) e vários AI-native (Mem, Recall, mymind) concentram a IA em produzir ou reorganizar o artefato. Alguns apps já oferecem curadoria resposta a resposta como recurso (OneNote, Capacities, Tana, Readwise, Reflect), e poucos a combinam com foco em estudo (MarginNote 4, Heptabase). Nenhum faz da curadoria uma regra de arquitetura do app inteiro, com chat descartável, fichamento local-first, leitor integrado e BYOK no Windows."* Junto, a ressalva: comandos que entregam o produto pronto (ex.: `/summarize`) também são offloading.
2. **D2 — Chat.** Em junho você decidiu que o chat é efêmero (rascunho) e a nota é durável. O uso mostra o chat como repositório principal (1,9 M chars contra 125 K em notas; 6 "Anotar"). Recomendação: **manter a decisão** e baratear a ponte (I9–I11); reavaliar só se, depois disso, o que importa continuar preso no chat.
3. **D3 — Imagens.** OCR local por padrão e legenda por modelo de visão (a imagem sai da máquina) **só por opt-in por caderno**: de acordo?
4. **D4 — MCP.** Vale o experimento do servidor local só leitura (I14) para usar com o Claude Code? Quais cadernos expor por padrão (sugestão: nenhum, você marca)?
5. **D5 — Peso por fonte.** No RAG, o que **você escreveu** pesa mais que fontes web e respostas de IA?
6. **D6 — VOLP.** Definir o front-matter no output do VOLP (I13) e trazer as aulas transcritas do MBA para a KB?
7. **D7 — Online.** Confirmar:
   - central online, **não**;
   - espelho Markdown (I15) como acesso de leitura fora do PC;
   - PWA da Library só **quando a leitura voltar**, começando por 1 dia de teste num iPad real (seleção e grifo por toque no pdf.js; isolamento de dados entre Safari e app instalado), com export/import de grifos em JSON para não virar ilha.
