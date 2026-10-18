# Monet — "Precisamos de mais RAG?" Estado da arte prático (2025–2026) e o que melhoraria de verdade

> **Nota de revisão (2026-10-17):** o ponto cego nº 3 / item 2 ("filtro por documento aplicado depois do KNN global") **não se confirma**. Testado na cópia do banco de produção com o `sqlite-vec` 0.1.9 (mesma versão do `Cargo.lock`): o `rowid IN (subquery)` é pré-aplicado, 100% dos resultados ficam no escopo e o top-5 coincide com a busca exata. Ver `DOCS/features/central_informacao_study.md` §3.

**Data:** 2026-10-17 · **Escopo:** chat do Monet sobre a base de conhecimento local (3.530 chunks, sqlite-vec, `text-embedding-3-small`@768 via OpenRouter, `top_k = 5`).
**Método:** a cota de busca web desta sessão já estava esgotada no início. Por isso, tudo veio de **fontes primárias abertas diretamente**: docs oficiais, arXiv, blogs dos fornecedores, código-fonte do sqlite-vec e do rusqlite, e as **APIs públicas do OpenRouter** (`/api/v1/models`, `/api/v1/embeddings/models`, `?output_modalities=rerank`), todas consultadas em 2026-10-17. Ao longo do texto, "(fornecedor)" marca alegações de quem vende o produto e "(estimativa)" marca contas minhas, com a premissa ao lado. As lacunas estão no fim.

---

## (a) Resumo executivo

### Resposta curta

**Não precisa de *mais* RAG, no sentido de mais infraestrutura.** GraphRAG, Mem0/Zep, ColPali, embeddings locais e indexação do histórico do chat não se pagam num corpus pessoal de 3,5 mil chunks. O que precisa é **corrigir 6 pontos cegos do pipeline atual**, todos baratos, e **rotear** as perguntas que não são de busca semântica. O RAG "funciona bem" para perguntas semânticas de um turno. As falhas aparecem justamente em classes de pergunta que o usuário faz todo dia, e são falhas silenciosas: o modelo responde com confiança a partir de trechos errados ou sem nenhum trecho.

### Diagnóstico: os pontos cegos do pipeline atual

| # | Ponto cego | Pergunta típica que sofre | Por que falha hoje |
|---|---|---|---|
| 1 | A consulta é **só a última mensagem** | "tenta de novo", "continue", "e na versão 9.0.0.1?" | O embedding de "continue" não recupera nada útil, e "e na versão…" perde o assunto da conversa |
| 2 | **Sem busca lexical** | Nomes exatos de API, versões, códigos | Embeddings densos "erram" identificadores exatos. A Anthropic dá o exemplo de "Error code TS-999" |
| 3 | **Filtro por documento aplicado depois do KNN global** | Perguntas sobre o livro aberto ou um documento específico | Com `k=5`, a sobre-amostra é `min(25, 200) = 25`. Se o documento não estiver entre os 25 vizinhos globais, volta com menos de 5 trechos ou com zero. O TXT de 5,7 MB deve ocupar ~45% dos chunks (estimativa: 5,7 M chars ÷ 3,6 k chars por passo ≈ 1.580 chunks) e domina o KNN global |
| 4 | **O contexto injetado não tem título, data nem tipo** (`[resumo.md]`, hash de URL) | "o que decidimos na última reunião?", "segundo qual nota?" | O modelo não sabe de quando nem de onde é o trecho, não consegue citar e não resolve perguntas temporais |
| 5 | **Imagens viram `[image]`** | "quem reporta ao diretor X?" (organograma), "como era a tela Y?" | 98% do volume das notas está invisível para a busca |
| 6 | **Perguntas que não são de busca vão para top-5** | "o que tenho pra fazer hoje?", "liste os projetos X", "extraia regras de negócio das reuniões" | Tarefas e agenda são dados estruturados (SQL). Enumerações e varreduras precisam do escopo inteiro, não de 5 trechos |

Há ainda um desequilíbrio no corpus: a doc técnica (~45% dos chunks, estimativa) e as ~550 fontes web salvas automaticamente competem com as 174 notas do usuário, que deveriam pesar mais.

### Lista priorizada (maior ganho por menor esforço primeiro)

Esforço: **P** = até 1 dia · **M** = 2–4 dias · **G** = 1+ semana.

| Ordem | Melhoria | Esforço | Custo marginal | Por que vem aqui |
|---|---|---|---|---|
| 0 | **Golden set mínimo + script de recall@k/MRR** (30–50 perguntas reais) | P–M | centavos por rodada | Sem isso, "funciona bem" é anedota e nenhuma das mudanças abaixo pode ser comprovada |
| 1 | **Gating + condensação da consulta**: reaproveitar o contexto em "continue"/"tenta de novo"; reescrever follow-ups com um LLM barato, que devolve também palavras-chave e filtros | P | ~US$ 0,0003/turno | Corrige o ponto cego 1. Reescrita por LLM ≥ reescrita humana em busca conversacional (CAsT-19 NDCG@3 0,515 vs 0,461) |
| 2 | **Pré-filtro correto no sqlite-vec** (`rowid IN (…)`, colunas de metadados ou busca exata) | P | zero | Corrige o ponto cego 3. Bug de corretude, não de qualidade |
| 3 | **Cabeçalho contextual determinístico** em cada chunk (título, tipo, data, caderno, seção) e **citações** com título/data no prompt | P | re-embed ≈ US$ 0,08 | Corrige o ponto cego 4. É a versão de custo zero da Contextual Retrieval. O Gemini Embedding 2 recomenda o formato `title: … \| text: …` |
| 4 | **Busca híbrida FTS5 BM25 + vetor com RRF** | P–M | zero | Corrige o ponto cego 2. Na Anthropic, somar BM25 levou a falha de 3,7% para 2,9% |
| 5 | **Rerank** (reusar o Cohere do deep research, ou Voyage `rerank-3-lite`): 40 candidatos → 6–10 no prompt, com limiar | P | ~US$ 0,001–0,002/consulta | Na Anthropic, a falha caiu de 2,9% para 1,9%. A Voyage relata +16,7% de NDCG@10 sobre OpenAI v3 (fornecedor) |
| 6 | **Roteamento**: ferramentas estruturadas (tarefas, agenda, notas por data) e "escopo inteiro" em contexto longo ou map-reduce para enumerações | M | 0 a ~US$ 0,02/turno | Corrige o ponto cego 6. Self-Route mostra contexto longo > RAG quando cabe, e a Anthropic recomenda mandar tudo quando há menos de 200k tokens |
| 7 | **Legenda + OCR dos prints colados** na indexação, com VLM barato | M | ~US$ 0,4–0,8 por 1.000 imagens | Corrige o ponto cego 5 e destrava 98% do volume das notas |
| 8 | **Higiene e peso por fonte**: dedup, órfãos, TTL para web, peso menor para web/IA, proteção contra injeção | P–M | zero | Viés pró-texto-de-LLM em retrievers (KDD 2024). PoisonedRAG: 5 textos bastam para 90% de sucesso de ataque |
| 9 | **Chunking por estrutura**: headings, páginas, turnos de fala; parent-child | M | re-embed ≈ US$ 0,1 | Chunks de ~1.000+ tokens são grandes para buscas precisas, e páginas dão citação "p. 123" no Reader |
| 10 | **Tool `search_knowledge_base`** (agentic) para multi-hop e refinamento, mantendo o RAG automático no 1º turno | M | 1–3 chamadas extras | Padrão "híbrido" da Anthropic. Com GPT-4o-mini, um agente com ferramentas simples chegou a 74% no LoCoMo (Letta) |
| 11 | **Contextual Retrieval com LLM**, só para transcrições e PDFs sem estrutura (ou `voyage-context-4`) | M | ~US$ 1–4 uma vez (estimativa) | Ganho real, mas só depois de 3–5. Notas curtas não precisam |
| 12 | **Trocar o modelo de embedding** (`qwen3-embedding-8b` a US$ 0,01/M ou `voyage-4`), **só com o golden set** | P | re-embed < US$ 1 | O MTEB-PT (2026) mostra que rankings multilíngues não predizem pt-BR. Exige teste próprio |
| 13 | **OCR de PDF escaneado sob demanda** (páginas sem texto) | P–M | ~US$ 1–2 por 1.000 páginas | Só se houver PDFs escaneados na Library |

**Não fazer agora:** GraphRAG, LightRAG e HippoRAG 2 (no máximo um índice leve de entidades). Mem0, Zep e Letta. ColPali ou embeddings multimodais. Indexar o histórico do chat (no máximo opt-in e curado). Embeddings ou reranker locais (salvo exigência de offline). HyDE.

### Sequência sugerida (~3 semanas de dev solo)

- **Semana 1:** itens 0, 1, 2, 3 e a montagem de contexto (merge de trechos adjacentes, ordem, limiar). O maior salto percebido vem daqui.
- **Semana 2:** itens 4, 5 e 8 (híbrida, rerank, higiene e pesos). Medir no golden set.
- **Semana 3:** itens 6 e 7 (roteamento para tarefas/agenda/escopo e legendas de imagens).
- **Depois, se o golden set apontar:** itens 9, 10, 11, 12 e 13.

**Ganho agregado de referência.** No benchmark da Anthropic (2024-09), embeddings contextuais + BM25 + rerank reduziram a taxa de falha de recuperação top-20 de 5,7% para 1,9% (−67%). No Monet, o ganho maior tende a aparecer nas classes que hoje falham quase sempre: follow-ups, termos exatos, documento filtrado, imagens e perguntas estruturadas. Médias agregadas escondem isso, por isso o golden set deve ser separado por classe de pergunta.

```
mensagem ─► gating ("continue" = reusar contexto) ─► condensação + palavras-chave + filtros (LLM barato, JSON)
              │
              ├─► roteador ─► ferramentas SQL (tarefas, agenda, notas por data)
              │            └► escopo inteiro (livro/caderno/reuniões) em contexto longo ou map-reduce
              │
              └─► FTS5 BM25 (palavras-chave) ─┐
                  vec0 KNN + pré-filtro ──────┴─► RRF (+ peso por fonte/recência) ─► rerank ─► limiar
                                                   ─► montagem (merge de adjacentes, título/data/tipo, citações [n]) ─► LLM
```

---

## (b) Seções por tema

### 1. Busca híbrida (FTS5 BM25 + vetores, RRF) em SQLite

**Evidência**
- **Anthropic, Contextual Retrieval (2024-09-19).** Adicionar BM25 contextual aos embeddings contextuais reduziu a falha top-20 de 3,7% para 2,9%: cerca de 22% das falhas restantes. A explicação do post: "embedding models … can miss crucial exact matches"; o BM25 é "particularly effective for queries that include unique identifiers or technical terms" (exemplo "Error code TS-999").
- **Jason Liu (2024-05-22).** Em ensaios, full-text e embeddings empataram, com o full-text ~10× mais rápido. Em issues do GitHub, o full-text teve recall ~55% contra ~65% dos embeddings. Os dois métodos se complementam, e o resultado depende do corpus.
- **Alex Garcia (sqlite-vec, 2024-10-02)** descreve três padrões com FTS5 + vec0: keyword-first, **RRF** (`rrf_k = 60`, pesos 1,0/1,0, `FULL OUTER JOIN`) e re-rank semântico dos acertos do FTS. Ele recomenda RRF para "RAG over internal documents, where exact names matter". O post não traz benchmark numérico.
- **Voyage, rerank-3 (2026-09-30, fornecedor):** o reranker acrescenta +20,33% de NDCG@10 sobre BM25 puro. BM25 é um bom primeiro estágio quando há reranker depois.

**FTS5 para pt-BR (documentação oficial do SQLite)**
- `tokenize = "unicode61 remove_diacritics 2"`. O valor `2` remove diacríticos de todos os caracteres latinos. O valor `1` falha em codepoints com mais de um diacrítico, que o próprio doc chama de "technically a bug". Assim "ação" casa com "acao".
- **O `porter` serve só para inglês.** Não há stemmer pt-BR embutido. Há duas opções: a extensão C `fts5-snowball` (BSD-3, `tokenize='snowball …'`, que exige compilar e carregar no Tauri) ou aplicar stemming em Rust (Snowball português) numa coluna separada. **Recomendação:** começar sem stemming. O lado vetorial cobre morfologia, e o BM25 entra justamente para termos exatos.
- **Não ponha `.` em `tokenchars`.** "9.0.0.1" ficaria um token só, mas toda palavra no fim de frase ganharia o ponto ("fim." ≠ "fim"). O melhor é **citar cada termo como frase**: `"9.0.0.1"` é tokenizado como `9 0 0 1` e casa a sequência adjacente. O mesmo vale para `snake_case` e `kebab-case`.
- Para substrings de identificadores (por exemplo "UserServ" casar com "UserService"), dá para criar uma segunda tabela com `tokenize='trigram'`. Ela casa qualquer substring de 3 ou mais caracteres e também acelera `LIKE`/`GLOB`. É opcional: o índice fica bem maior.
- `bm25()`: valor menor é melhor; k1 = 1,2 e b = 0,75 são fixos; aceita peso por coluna (`bm25(fts, 5.0, 1.0)` para título e corpo). `ORDER BY rank` é mais rápido que chamar `bm25()`.
- Use uma tabela *external content* sobre a tabela de chunks, sincronizada por triggers ou pela aplicação, com `INSERT INTO fts(fts) VALUES('rebuild')` para reconstruir. Em deleções, atualize o FTS antes.
- **Sanitize a consulta:** remova stopwords pt-BR (lista Snowball), cite cada token entre aspas duplas (escapando `"`) e una com `OR`. Sem isso, "o que tenho pra fazer hoje" casa com o corpus inteiro e certos caracteres viram erro de sintaxe do FTS5.
- O **rusqlite `bundled` compila o SQLite com `-DSQLITE_ENABLE_FTS5`**, e o master atual empacota o SQLite 3.54.0. `FULL OUTER JOIN` (3.39+) e `IN` em virtual table (3.38+) estão disponíveis.

**Esboço (RRF em SQL)**
```sql
WITH fts AS (
  SELECT f.rowid AS id, row_number() OVER (ORDER BY f.rank) AS r
  FROM chunks_fts f JOIN chunks c ON c.id = f.rowid
  WHERE chunks_fts MATCH :q_fts            -- '"9.0.0.1" OR "configuração" OR "módulo"'
    AND c.source_type IN ('upload_doc','note')   -- filtros por join (FTS5 não tem metadados)
  ORDER BY f.rank LIMIT 40
),
vec AS (
  SELECT chunk_id AS id, row_number() OVER (ORDER BY distance) AS r
  FROM vec_chunks
  WHERE embedding MATCH :q_vec AND k = 40
    AND source_type IN ('upload_doc','note')     -- pré-filtro (ver tema 2)
)
SELECT coalesce(fts.id, vec.id) AS id,
       :w_fts * coalesce(1.0/(60 + fts.r), 0) + :w_vec * coalesce(1.0/(60 + vec.r), 0) AS score
FROM fts FULL OUTER JOIN vec ON fts.id = vec.id
ORDER BY score DESC LIMIT 40;   -- depois: pesos por fonte/recência → rerank
```
Uma heurística útil, a validar no golden set: aumentar `w_fts` quando a consulta tiver dígitos, pontos, `_` ou CamelCase.

**Ganho:** alto para perguntas sobre a doc técnica (nomes de API, versões, códigos). Médio no geral (Anthropic: −22% das falhas restantes).
**Custo:** zero por consulta e alguns ms. O índice ocupa mais disco.
**Esforço:** P–M (1–2 dias, com sanitização e sincronização).
**Riscos:** erro de sintaxe do FTS5 com entrada do usuário; FTS e vetores dessincronizados após deleção; stopwords mal tratadas gerando ruído.
**Quando não vale:** corpus só conversacional, sem identificadores. Não é o caso do Monet.

---

### 2. Pré-filtro no sqlite-vec e busca exata

**Estado do sqlite-vec (GitHub, 2026-10-17)**
- Versão estável: **v0.1.9 (2026-03-31)**. A v0.1.7 (2026-03-17, "back from hiatus") trouxe `DELETE` que libera espaço e restrições `>`, `>=`, `<`, `<=` sobre `distance`, úteis para paginação.
- Pré-release: **v0.1.10-alpha.4 (2026-05-18)**, com índices ANN novos (rescore com quantização bit/int8 e DiskANN; IVF experimental e desligado por padrão). Na versão estável, o **vec0 continua força bruta**.
- **Colunas de metadados (v0.1.6, 2024-11-20):** até 16 por tabela; tipos `boolean`, `integer`, `float`, `text`. Operadores no `WHERE` do KNN: `=`, `!=`, `>`, `>=`, `<`, `<=`, e `IN (…)` para integer/text (SQLite 3.38+). Não suportam `LIKE`, `GLOB`, `REGEXP` nem `NULL`. Texto com mais de 12 caracteres é armazenado de forma menos eficiente.
- **Partition key:** até 4 por tabela, só com `=` (sem `IN`). Cada partição deve ter "centenas" de vetores ou mais; partições pequenas deixam a consulta mais lenta. Num teste de ~3 M linhas, particionar por ano deixou a consulta ~3× mais rápida.
- **Colunas auxiliares (`+col`):** até 16; servem para retornar dados sem join e **não** podem ser filtradas.
- **`rowid IN (…)` em KNN é suportado.** O comentário de `vec0BestIndex` no código-fonte diz "KNN when: MATCH … LIMIT … rowid in (...) OPTIONAL", e só um `rowid in` é permitido por consulta. Não está na documentação. Teste com subquery antes de depender disso; uma alternativa é `rowid IN (SELECT value FROM json_each(?))`.

**O bug do Monet.** Filtrar depois do KNN global com sobre-amostra de 25 perde trechos do documento filtrado sempre que ele não domina a vizinhança global. Os três consertos possíveis:

```sql
-- (A) rowid IN: mínimo de mudança no schema
SELECT chunk_id, distance FROM vec_chunks
WHERE embedding MATCH :q AND k = 10
  AND chunk_id IN (SELECT id FROM chunks WHERE doc_id = :doc);

-- (B) metadados no vec0: recriar a tabela; os vetores podem ser copiados, sem re-embed
CREATE VIRTUAL TABLE vec_chunks USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding float[768] distance_metric=cosine,
  source_type TEXT,      -- note | meeting_summary | meeting_transcript | book | upload_doc | web | ai
  doc_id INTEGER, notebook_id INTEGER, doc_date INTEGER,   -- sem NULL: use 0 como sentinela
  +title TEXT
);

-- (C) busca EXATA numa tabela comum: qualquer WHERE, sem limitações do vec0
SELECT id, vec_distance_cosine(embedding, :q) AS d
FROM chunks WHERE doc_id = :doc OR notebook_id = :nb
ORDER BY d LIMIT :k;
```

**Latência da força bruta.** No benchmark oficial (2024-08-01), 100 mil vetores de até 1.024 dimensões ficaram abaixo de 75 ms por consulta; com 1.536 dimensões, 105 ms. Extrapolando linearmente, **3.530 × 768 dá ~2–3 ms** (estimativa). Mesmo com 30–50 mil chunks a força bruta continua viável, então **ANN não faz sentido nesta escala**.
**Ganho:** corretude em toda pergunta com escopo (livro aberto, caderno, tipo de fonte).
**Custo:** zero. **Esforço:** P.
**Riscos:** migrar o schema do vec0 exige recriar a tabela (o projeto aceita breaking changes); metadados não aceitam `NULL`.
**Quando não vale:** nunca deixa de valer. É corrigir um bug.

---

### 3. Reranking

**Disponibilidade em 2026-10-17**

| Opção | Onde | Contexto | Preço | Observações |
|---|---|---|---|---|
| Voyage `rerank-3` / `rerank-3-lite` (2026-09-30) | API Voyage e OpenRouter | 32k | US$ 0,05 / 0,02 por M tokens; 200 M tokens grátis na API direta | Tokens = (tokens da query × nº de docs) + tokens dos docs. Aceita **instruções em linguagem natural** (+8–11% na 2.5, fornecedor). Scores calibrados com a 2.5 |
| Voyage `rerank-2.5` / `-lite` | API Voyage e OpenRouter | 32k | US$ 0,05 / 0,02 por M | Multilíngue: +3,26% sobre Cohere 3.5 em 31 idiomas (fornecedor) |
| Cohere `rerank-v4.0-pro` / `-fast` | API Cohere e OpenRouter | 32k | PAYG não aparece mais na página de preços (só Model Vault, US$ 5/h) | 1 "search" = 1 query + até 100 docs; docs com mais de 500 tokens contam como vários |
| Cohere `rerank-v3.5` | API Cohere e OpenRouter | 4k | Historicamente US$ 2 por 1.000 buscas (não confirmado hoje) | **É o que o deep research do Monet já usa** |
| `qwen/qwen3-reranker-8b` | OpenRouter (Fireworks) | 40k | Não exposto | Pesos abertos (0,6B/4B/8B, Apache-2.0); MMTEB-R 72,94 no 8B (2025-06) |
| `nvidia/llama-nemotron-rerank-vl-1b-v2:free` | OpenRouter | 10k | grátis | Multimodal (texto + imagem). Endpoints `:free` podem reter dados |
| Jina `reranker-v3.5` (0,6B, 131k, 2026-08-03) | API Jina (Elastic) | 131k | Por token (preço não exibido) | Pesos CC-BY-NC: uso comercial self-hosted exige licença. Fora do OpenRouter |
| `bge-reranker-v2-m3` (0,6B, Apache-2.0) | Local (fastembed-rs/ONNX) | ~512 nos exemplos | zero | Latência em CPU **não medida**. Para 30–40 pares, provavelmente centenas de ms a segundos (estimativa) |

O OpenRouter tem **`POST /api/v1/rerank`**, o que deixa usar uma chave só. A API de modelos não expõe preço de rerank (os campos vêm zerados), mas a resposta traz `usage.cost` e, no Cohere, `search_units`. O próprio guia do OpenRouter sugere pular o rerank quando a base é pequena e a recuperação por embedding já é boa. Com 3,5k chunks dominados por uma doc técnica, não é o caso.

**Evidência de ganho**
- **Anthropic:** com rerank Cohere sobre a busca híbrida, a falha top-20 caiu de 2,9% para 1,9% (−34% relativo). O setup: top-150 → rerank → top-20.
- **Voyage `rerank-3` (fornecedor):** +16,67% de NDCG@10 sobre OpenAI v3 large, +20,33% sobre BM25; +2,72% contra Cohere v4 Pro e +3,02% contra Qwen3-Reranker-8B em 95 datasets.
- **LLM como reranker, "The Case Against LLMs as Rerankers" (Voyage, 2025-10-22, fornecedor e parcial):** `rerank-2.5` superou GPT-5 em 12,6% de NDCG@10, custou 25–60× menos e rodou 9–48× mais rápido. LLMs baratos chegaram a **piorar** um primeiro estágio forte (Gemini 2.0 Flash: 79,49 contra 81,58 sem rerank). A conclusão é usar um reranker dedicado, não um LLM barato.

**Aplicação no Monet**
1. Reusar a integração Cohere do deep research, ou `rerank-3-lite`.
2. Pipeline: híbrida com 40 candidatos → rerank → **6–10 trechos no prompt**. A Anthropic achou 20 > 10 > 5 com Claude, mas modelos baratos sofrem mais com distratores (Chroma), então ajuste no golden set.
3. **Limiar de score:** se nada passar, não injete nada. Isso evita poluir respostas a perguntas que não são sobre a base.
4. Com `rerank-3`, uma instrução do tipo "priorize notas e reuniões do próprio usuário; documentos da versão mencionada" pode substituir parte do peso por fonte (validar).

**Custo** (estimativa, chunks de ~1.100 tokens): 30×40 + 40×1.100 ≈ 45k tokens por consulta, ou seja **US$ 0,0009** com `rerank-3-lite` e US$ 0,0023 com `rerank-3`. Os 200 M tokens grátis da Voyage cobrem ~4.400 consultas. Com chunks menores (tema 5), o custo cai 3–4×.
**Esforço:** P (há código Cohere no projeto). **Riscos:** +1 chamada HTTP de latência; dependência externa; trechos enviados a mais um provedor.
**Quando não vale:** perguntas resolvidas pelo contexto efêmero (página aberta, grifos) ou por ferramentas SQL.

---

### 4. Contextual Retrieval (Anthropic) e variantes

**Original (Anthropic, 2024-09-19).** Antes de embutir e indexar no BM25, cada chunk recebe um contexto de **50–100 tokens** gerado por LLM a partir do documento inteiro. Resultado: falha top-20 de 5,7% → 3,7% com embeddings contextuais (−35%), → 2,9% com BM25 contextual (−49%) e → 1,9% com rerank (−67%). O custo foi de **US$ 1,02 por milhão de tokens de documento**, uma vez, com Claude 3 Haiku e prompt caching (chunks de 800 tokens, documentos de 8k). Resumos genéricos de documento deram "very limited gains". E o post recomenda: **com menos de 200k tokens de base, ponha tudo no prompt** em vez de RAG.

**Variantes**

| Variante | Como funciona | Evidência | No stack do Monet |
|---|---|---|---|
| **Cabeçalho determinístico** (título, tipo, data, caderno, caminho de headings) | Prefixo fixo no texto do chunk, para o embedding e para o FTS | O Gemini Embedding 2 (doc de 2026-10) pede `title: {título} \| text: {conteúdo}` em documentos e `task: search result \| query: …` em consultas | **Fazer já (P)**, custo zero. Em reuniões, título = nome da pasta (data/hora) + H1 do `resumo.md` |
| **LLM-CR** (Anthropic) | LLM gera 50–100 tokens de contexto por chunk | −35% a −49% de falhas no benchmark deles | Só em transcrições (pronomes, "aquele sistema") e PDFs sem estrutura. Com DeepSeek V4.1 Flash ou Gemini 3.5 Flash-Lite: **~US$ 1–4 para o corpus inteiro** (estimativa; preços do OpenRouter em 2026-10-17 e cache de prefixo) |
| **Late chunking** (Jina) | Embute o documento longo e faz pooling por chunk | NDCG@10 médio no BEIR: 52,2 → 54,0 (chunks fixos de 256), 52,4 → 54,3 (por sentença) | Exige embeddings token a token: só via API Jina (`late_chunking=true`) ou modelo local. **Não funciona pelo OpenRouter** |
| **Contextualized chunk embeddings** (`voyage-context-4`, 2026-06-29) | O modelo vê o documento todo e devolve um vetor por chunk, sem chamar LLM | +2,08% sobre a `context-3` no nível de chunk. A `context-3` já superava a Contextual Retrieval da Anthropic em 6,76% e o late chunking em 23,66% (fornecedor). US$ 0,12/M | Só na API direta da Voyage; **não está** na lista de embeddings do OpenRouter (2026-10-17) |

**Vale para corpus pessoal?**
- **O cabeçalho determinístico vale sempre.** É o caso de "e na versão 9.0.0.1?": a seção da doc ganha "Versão 9.0.0.1 > Capítulo Y" no texto embutido e indexado.
- **LLM-CR vale só para documentos longos sem estrutura**, depois que a híbrida, o rerank e os cabeçalhos estiverem prontos.
- **Notas curtas não precisam.** Cada nota já é praticamente um chunk.

**Esforço:** cabeçalho P; LLM-CR M (pipeline, cache e reprocessamento ao editar).
**Riscos:** contexto alucinado pelo LLM; contexto desatualizado quando o documento muda; reindexação.

---

### 5. Chunking: tamanho e estratégia por tipo de fonte

**Evidência**
- **Chroma (2024-07-03):** splitter recursivo de **200 tokens sem overlap** foi o default mais consistente (recall 88,1 com `text-embedding-3-large`). O default antigo da OpenAI, **800 tokens com overlap de 400**, "performs poorly" nas métricas de eficiência (precisão/IoU). Estratégias diferiram até 9% em recall, e overlap só ajudou recall com embeddings pequenos.
- **NVIDIA (2025-06-18):** chunk **por página** teve a melhor média (0,648) e o menor desvio. Por tipo de pergunta: factuais com página ou 256–512 tokens; analíticas com página ou 1.024 tokens. Overlap de 15% foi o melhor no FinanceBench com chunks de 1.024.
- **Chunking semântico:** "not justified by consistent performance gains" (Qu et al., arXiv 2410.13070, 2024-10).
- **Hamel Husain (2026-09):** tamanho de chunk é hiperparâmetro a validar. Para tarefas expansivas (listar, resumir), use map-reduce sobre chunks menores.

**Diagnóstico.** 4.000 chars ≈ 1.000–1.200 tokens em pt-BR (estimativa de ~3,5–4 chars por token). Está na ponta grande da faixa ("analítica"). É bom para perguntas abertas e ruim para busca precisa de identificadores na doc técnica, além de diluir o sinal do embedding. O overlap de 10% está dentro do comum.

**Recomendação por tipo de fonte**

| Fonte | Chunking sugerido | Metadados essenciais |
|---|---|---|
| Notas do usuário | 1 nota = 1 chunk até ~1.500 tokens; acima disso, por heading. Legendas de imagem em linha | título, caderno, `updated_at`, data (se for nota de calendário) |
| `resumo.md` de reunião | Inteiro (é curto e denso) | data/hora da pasta, título (H1), participantes se houver |
| `transcricao.md` | Janelas de ~300–600 tokens alinhadas a turnos de fala; parent de ~2k tokens | data, título da reunião, falante/timestamp |
| Livros PDF | **Por página** (ou 2 páginas), com número de página e parent = capítulo/seção se detectável | título, autor, **página** (citação "p. 123" e integração com o Reader) |
| Doc técnica (TXT de 5,7 MB) | Por heading com breadcrumb; chunks de ~300–500 tokens e parent de ~1,5–2k; blocos de código e tabelas inteiros | caminho de headings, **versão** |
| Tabela de alimentos | Uma linha por registro, ou melhor, uma ferramenta SQL/CSV em vez de RAG | nome da tabela, colunas |
| Fontes web | Por heading/parágrafo | URL canônica, título, data de acesso |

**Small-to-big (parent-child):** busque o chunk pequeno (precisão) e devolva o pai (contexto), deduplicando pais. Junte com a montagem de contexto: trechos adjacentes do mesmo documento viram um bloco só, sem o overlap duplicado.
**Ganho:** médio, sobretudo na doc técnica e nos livros (citação de página). **Custo:** re-embed ≈ US$ 0,1.
**Esforço:** M (um chunker por tipo e reindexação). **Riscos:** chunks menores trazem mais ruído sem rerank (faça o tema 3 antes) e perdem contexto sem o cabeçalho do tema 4.

---

### 6. Consulta: reescrita com histórico, multi-query, HyDE e agentic RAG

**Evidência**
- **LLM4CS (Findings of EMNLP 2023):** reescrita de consulta conversacional por LLM, nos benchmarks TREC CAsT. NDCG@3 de **0,515 contra 0,461 da reescrita humana** no CAsT-19 (0,455 contra 0,422 no CAsT-20). Um método zero-shot sem reescrita (ZeCo) ficou em 0,238/0,176.
- **HyDE (2022):** gera um documento hipotético e embute esse documento. TREC DL19 NDCG@10: Contriever 44,5 → **61,3**. Mas o ganho foi sobre um encoder **não supervisionado e fraco**. Com embeddings modernos + BM25 + rerank, o ganho esperado é marginal (inferência minha), e a técnica custa uma chamada de LLM por consulta.
- **Adaptive-RAG (NAACL 2024):** um classificador escolhe entre sem recuperação, recuperação de 1 passo e multi-passo, melhorando eficiência e acurácia.
- **Anthropic, "Effective context engineering" (2025-09-29):** recomenda a estratégia **híbrida**, com parte do contexto recuperada antes e o resto "just-in-time" por ferramentas (o Claude Code usa glob/grep). Avisa que a exploração em tempo de execução é mais lenta e precisa de boas ferramentas.
- **Letta (2025-08-12):** um agente GPT-4o-mini com ferramentas simples (grep, busca semântica, abrir arquivo) chegou a **74,0% no LoCoMo**. "Memory quality depends more on whether the agent knows when and how to use a retrieval tool."
- **Hamel (2026-09):** "RAG is dead" vale para busca vetorial ingênua em agentes de código. Recuperação continua necessária; a questão é "how to retrieve effectively".

**Aplicação no Monet (em ordem)**
1. **Gating (P, custo zero).** Uma regex pt-BR (`continue|continua|tenta de novo|de novo|refaça|reformule|mais detalhes|resuma isso`) **reaproveita o conjunto recuperado no turno anterior**, guardado por conversa, sem buscar de novo.
2. **Condensação (P).** Se a mensagem for curta (menos de ~12 palavras) ou tiver anáfora ("e na…?", "isso", "esse"), um LLM barato recebe os últimos 3–4 turnos e devolve um JSON:
   `{needs_retrieval, standalone_query, bm25_keywords[], filters:{source_types, doc_id, notebook, date_from, date_to}}`.
   Custo de ~1.500 tokens de entrada e 80 de saída: **~US$ 0,0003/turno** com DeepSeek V4.1 Flash e ~US$ 0,00005 com Qwen3.7 Flash (estimativa, preços do OpenRouter). Faça busca com **a consulta original e a reescrita** e funda por RRF, para conter desvio de significado. Sem LLM, um fallback simples é concatenar a mensagem anterior do usuário.
3. **Usar o contexto efêmero na busca.** Com livro ou nota aberta, acrescente o título do documento à consulta e/ou filtre por ele, o que depende do pré-filtro do tema 2.
4. **Agentic (M).** Ferramentas `search_knowledge_base({query, source_types?, notebook?, doc_id?, date_from?, date_to?, k?})`, `read_document(doc_id, page|section)`, `list_tasks(date, status)` e `list_notes(date|notebook)`. Mantenha o RAG automático no primeiro turno. Com modelos baratos, limite a ~3 chamadas de ferramenta por turno.
5. **Multi-query:** mantenha no deep research. No chat, 1 reescrita + a original já bastam. **HyDE:** pular.

**Riscos:** a reescrita mudar o sentido (mitigado pela fusão com a original); latência de uma chamada extra (use modelo sem reasoning); modelos baratos chamando ferramentas demais ou de menos.
**Quando não vale:** a condensação não vale quando a mensagem já é autocontida. Por isso o gating vem antes.

---

### 7. Metadados, filtros, recência, peso por fonte e citações

**Evidência**
- **Jason Liu:** extraia metadados (datas, nomes de arquivo, autoria) e use *query understanding* para transformar a pergunta em filtros.
- **LongMemEval (ICLR 2025):** expansão de consulta consciente de tempo e decomposição por sessão "greatly improve" a recuperação. Não há números no resumo.
- **Viés de fonte (Dai et al., KDD 2024):** retrievers e rerankers neurais **ranqueiam texto gerado por LLM acima de texto humano**, porque é mais "focado". Sem correção, as fontes web (muitas escritas por IA) e respostas de IA tendem a ganhar das notas do usuário.
- **Voyage rerank-2.5:** instruções no reranker deram +8,13% (in-house) e +11,48% (datasets reais, fornecedor). Os exemplos são favorecer tipos de documento e títulos.

**Schema sugerido para cada chunk:** `doc_id`, `source_type` (note · meeting_summary · meeting_transcript · book · upload_doc · table · web · ai), `author` (user · ai · web), `notebook_id`, `title`, `doc_date` (data da pasta, da nota de calendário ou de criação), `updated_at`, `url`, `page`, `heading_path`, `doc_version`, `pinned`, `last_cited_at`.

**Regras práticas**
- **Datas relativas viram filtros.** "hoje", "ontem", "semana passada", "última reunião" passam por um parser determinístico pt-BR antes de qualquer embedding.
- **Recência como reforço, não como filtro**, e só em tipos sensíveis ao tempo (reuniões, notas diárias): `score × (1 + α·e^(−idade/τ))`.
- **Peso por fonte** (heurística, validar no golden set): nota do usuário 1,2; reunião 1,1; upload 1,0; web 0,7–0,8; IA 0,6. Alternativa: cotas, como no máximo 2 trechos web no top-8 quando houver fontes do usuário relevantes.
- **Citações.** Injete `[n] Título — tipo — 2026-09-12 — caderno (p. 123 / seção)` e peça ao modelo que cite `[n]`. Na UI, a citação abre a nota, a página ou a reunião. Isso reduz alucinação percebida e permite conferir.

**Esforço:** P–M. **Riscos:** pesos errados escondem informação web útil; parser de datas com falhas.
**Quando não vale:** nunca deixa de valer. Metadados são a base para filtros, citações e roteamento.

---

### 8. GraphRAG / LightRAG / HippoRAG 2

**Evidência**
- **HippoRAG 2 (ICML 2025)**, F1 médio de QA em 7 benchmarks: HippoRAG 2 **59,8**; recuperação densa (NV-Embed-v2) **57,0**; GraphRAG 49,6; RAPTOR 48,8; LightRAG **6,6**. GraphRAG e LightRAG ficaram **abaixo do RAG denso** em QA factual. O ganho do HippoRAG 2 está no multi-hop (2Wiki: 71,0 contra 61,5).
- **Custo de indexação** (MuSiQue, 11.656 passagens): GraphRAG usou 115,5 M tokens de entrada e 36,1 M de saída (277 min); LightRAG 68,5 M e 18,3 M (235 min); HippoRAG 2 9,2 M e 3,0 M (99,5 min); embeddings densos, 12,1 min.
- **"RAG vs. GraphRAG" (Han et al., arXiv 2502.11371; v3 em 2026-03-04):** cada paradigma tem forças distintas, e estratégias de seleção ou integração dão ganhos consistentes.
- **LazyGraphRAG (Microsoft, 2024-11-25):** indexação com o mesmo custo do RAG vetorial (0,1% do GraphRAG); em perguntas globais, qualidade comparável ao GraphRAG global com custo de consulta mais de 700× menor (julgamento por LLM, consultas sintéticas).

**Para o Monet:** **não vale agora.** O corpus é pequeno, as notas mudam todo dia (atualização incremental de grafo é cara e frágil), QA factual não melhora e a complexidade é alta. Os casos em que grafo ajudaria ("liste os projetos X", "quem participou das reuniões sobre o sistema Y e o que decidiram?") se resolvem mais barato assim:
1. **Escopo inteiro em contexto longo** (tema 9), como os 17 resumos de reunião, que cabem com folga.
2. **Índice leve de entidades (M).** Na indexação, um LLM barato extrai **por documento** (não por chunk) `{pessoas, sistemas, projetos, decisões, datas}` para tabelas SQLite: `entity(id, nome, tipo, aliases)` e `mention(entity_id, chunk_id, doc_id, data)`. Elas viram filtros e ferramentas (`list_entities(tipo)`, `find_mentions(entidade)`). Custo: centavos para as reuniões e notas (estimativa).

**Esforço:** GraphRAG G; índice de entidades M.
**Riscos:** entidades duplicadas ou aliases ("Sistema Y" = "SY") e extração errada (mostre a fonte).

---

### 9. RAG × contexto longo (modelos de 1M tokens, prompt caching e context rot)

**Evidência**
- **Self-Route (EMNLP 2024 industry):** contexto longo superou RAG em média (Gemini-1.5-Pro 49,70 contra 37,33; GPT-4o 48,67 contra 32,60), mas **~63% das predições foram idênticas**. Rotear por auto-reflexão manteve a qualidade usando 38–61% dos tokens (−39% a −65% de custo). O baseline de RAG era fraco (Contriever, k=5, chunks de 300 palavras).
- **LaRA (2025-02):** "No Silver Bullet". A escolha depende do modelo, do tamanho do contexto, do tipo de tarefa e dos chunks.
- **Databricks (2024-08-12):** a acurácia sobe com mais contexto recuperado e depois satura ou cai, conforme o modelo. Muitos atingem o pico entre 16k e 32k tokens; o GPT-4o, em 64–96k.
- **Chroma "Context Rot" (2025-07-14):** os 18 modelos testados degradam com o tamanho da entrada, mesmo em tarefas simples. Um único distrator já piora o resultado. No LongMemEval, o prompt **focado (~300 tokens)** foi bem melhor que o **completo (~113k)**.
- **"Lost in the Middle" (TACL):** desempenho em U, pior quando a informação relevante está no meio.
- **Anthropic:** com menos de 200k tokens de base, ponha tudo no prompt com caching (latência mais de 2× menor, custo até −90%).

**Preços (API pública do OpenRouter, 2026-10-17, US$ por milhão de tokens)**

| Modelo | Contexto | Entrada | Leitura de cache | Saída | 100k tokens por turno: sem / com cache |
|---|---|---|---|---|---|
| `deepseek/deepseek-v4.1-flash` | 1,05 M | 0,15 | 0,003 | 0,60 | US$ 0,015 / 0,0003 |
| `qwen/qwen3.8-flash` | 1,0 M | 0,15 | 0,016 | 0,47 | 0,015 / 0,0016 |
| `qwen/qwen3.7-flash` | 1,0 M | 0,03 | 0,006 | 0,13 | 0,003 / 0,0006 |
| `openai/gpt-5.6-luna` | 1,05 M | 0,20 (escrita de cache 0,25) | 0,02 | 1,20 | 0,020–0,025 / 0,002 |
| `anthropic/claude-haiku-5.5` | 1,0 M | 0,10 (escrita 0,125) | 0,01 | 0,50 | 0,010–0,0125 / 0,001 |
| `google/gemini-3.1-flash-lite` | 1,05 M | 0,25 | 0,025 | 1,50 | 0,025 / 0,0025 |
| `google/gemini-3.8-flash` | 1,05 M | 0,825 | 0,0825 | 4,125 | 0,083 / 0,008 |
| `openai/gpt-5.4-mini` | 400k | 0,75 | 0,075 | 4,50 | 0,075 / 0,0075 |
| *Premium:* `anthropic/claude-sonnet-5.5` | 1,0 M | 2,00 (escrita 2,50) | 0,10 | 10,00 | 0,20–0,25 / 0,01 |
| *Premium:* `openai/gpt-5.6-sol` | 1,05 M | 4,00 | 0,40 | 20,00 | 0,40 / 0,04 |
| *Premium:* `google/gemini-4-argon` | 1,05 M | 2,00 | 0,10 | 10,00 | 0,20 / 0,01 |

Para comparar: um turno de RAG com 8k tokens de contexto custa US$ 0,0012 no DeepSeek V4.1 Flash e US$ 0,016 no Sonnet 5.5. O DeepSeek também tem preço por horário: 2× em dias úteis, das 01h às 04h UTC.

**Como o cache funciona** (guia do OpenRouter): é automático na OpenAI (prompts de 1.024+ tokens; a família GPT-5.6 cobra escrita a 1,25×), no DeepSeek e no Gemini 2.5+ (implícito, TTL médio de 3–5 min). No Anthropic é explícito, com `cache_control` (TTL de 5 min a 1,25× ou de 1 h a 2×; leitura a 0,1×). O OpenRouter mantém "sticky routing" por 10 min. Na prática, o **cache só ajuda dentro de uma conversa com follow-ups próximos**, não entre dias.

**Dimensionamento do Monet (estimativas)**
- Base inteira: ~3–4 M tokens. **Não cabe** em 1M.
- TXT técnico: ~1,4–1,6 M tokens. Não cabe, então é RAG.
- Um livro: ~100–200k tokens. Cabe, a ~US$ 0,015–0,03 por turno sem cache num flash barato.
- Os 17 resumos de reunião: provavelmente 20–40k tokens. **Cabem com folga.**
- Todas as transcrições: talvez 150–400k tokens. Cabem, mas sofrem context rot; prefira map-reduce por reunião.
- Texto das notas de um caderno: normalmente abaixo de 100k.

**Recomendação: "escopo primeiro".** Se a pergunta for **exaustiva ou agregativa** (extrair, listar, comparar, resumir tudo) **e** houver um escopo (livro aberto, caderno, "reuniões"), mande o escopo inteiro quando couber em ~100–200k tokens, ou faça map-reduce por documento. Caso contrário, use RAG. Implemente com o JSON da condensação (`intent: lookup|exhaustive`) ou uma ferramenta `read_scope`.
**Riscos:** custo dispara com modelo premium (100k tokens = US$ 0,20–0,40 por turno); latência maior (o tempo até o primeiro token cresce com o prompt; meça); context rot em modelos baratos.
**Quando não vale:** buscas pontuais ("qual o parâmetro X da API Y?"). Aí RAG é melhor e ~10–100× mais barato.

---

### 10. Embeddings em 2026

**Disponíveis no OpenRouter** (`/api/v1/embeddings/models`, 2026-10-17; a API aceita `dimensions` e `input_type`, e o Batch API tem 50% de desconto)

| Modelo | US$/M tokens | Entrada / modalidade | Notas |
|---|---|---|---|
| `openai/text-embedding-3-small` (atual) | 0,02 (batch 0,01) | 8k, texto | Anúncio de 2024-01: MTEB 62,3 / MIRACL 44,0 (números de memória; a página deu 403 hoje) |
| `openai/text-embedding-3-large` | 0,13 | 8k, texto | Mesmo anúncio: MTEB 64,6 / MIRACL 54,9 (idem) |
| `qwen/qwen3-embedding-8b` | **0,01** | 40k, texto | **Nº 1 do MMTEB (70,58) em 2025-06-05**; 4.096 dims com MRL; pede instrução no prefixo da consulta |
| `qwen/qwen3-embedding-4b` | 0,02 | 32k, texto | 2.560 dims, MRL |
| `voyageai/voyage-4-lite` / `voyage-4` / `voyage-4-large` | 0,02 / 0,06 / 0,12 | 32k, texto | **Espaço compartilhado** (consulta com lite, documentos com large). Large: +14% sobre OpenAI v3 large no RTEB (fornecedor). Os 200 M grátis valem só na API direta |
| `voyageai/voyage-multimodal-3.5` | 0,12 | texto + imagem + vídeo | Imagens a US$ 0,60 por bilhão de pixels (API Voyage) |
| `google/gemini-embedding-001` | 0,15 | **2.048 tokens** por entrada | O limite pequeno explica a falha anterior do Monet |
| `google/gemini-embedding-2` (2026-04/05) | 0,20 (imagem 0,45) | 8.192, **multimodal** | Sem `task_type`: usa prefixos. Espaço **incompatível** com o 001 |
| `baai/bge-m3` | 0,01 | 8k, texto | Multilíngue, pesos abertos |
| `intfloat/multilingual-e5-large` | 0,01 | 512 tokens | Contexto curto demais para os chunks atuais |
| `perplexity/pplx-embed-v1-4b` / `-0.6b` | 0,03 / 0,004 | 32k | Novos (2026-03) |
| `nvidia/nemotron-3-embed-1b:free`, `llama-nemotron-embed-vl-1b-v2:free` | grátis | 32k; o VL aceita imagem | Endpoints `:free` podem reter dados (a descrição do LFM-350M grátis diz isso explicitamente) |
| `mistralai/mistral-embed-2312` | 0,10 | 8k | Antigo |

**Fora do OpenRouter:** Cohere `embed-v5.0-pro`/`-fast` e `embed-v4.0` (128k, texto + imagem, API Cohere); Jina v5 (`v5-text-small` com 677M e MMTEB 67,0; `v5-text-nano` com 239M e 65,5; `v5-omni` multimodal, 2026-05), com pesos CC-BY-NC que exigem licença Elastic para uso comercial self-hosted; `voyage-context-4`.

**Qualidade em pt-BR.** O **MTEB-PT** (arXiv 2607.04071, BRACIS 2026) avaliou 17 modelos em 14 datasets e concluiu que **"multilingual rankings do not reliably predict Portuguese results within each task family"** e que **nenhum modelo lidera tudo**. Modelos de contexto longo foram melhor em recuperação e reranking, e fine-tuning em português ajuda. Não obtive os scores por modelo; há um benchmark `MTEB(por, v1)` no repositório do MTEB. Moral: **o leaderboard não decide; o golden set decide.**

**Recomendação.** O `3-small`@768 é aceitável e trocar não é a primeira alavanca. Quando o golden set existir, teste:
- **`qwen3-embedding-8b`**: mais barato que o atual e forte em multilíngue. Truncar e renormalizar para 768/1.024 funciona por MRL. Precisa de prefixo de instrução na consulta.
- **`voyage-4`**: usa `input_type`.
- **`gemini-embedding-2`**: só se quiser imagens no mesmo espaço.

Re-embutir o corpus inteiro (~3,5–4 M tokens) custa US$ 0,04 (Qwen 8B), US$ 0,08 (3-small), US$ 0,23 (voyage-4) ou US$ 0,80 (Gemini 2). Trocar de modelo exige apagar o `monet-vec.db`, como registrado em memória do projeto.

**Opção local (G).** EmbeddingGemma: 308M parâmetros, menos de 200 MB de RAM quantizado, 2k tokens de contexto, 768 dims com MRL, mais de 100 idiomas (2025-09-04). Roda via **fastembed-rs** (ONNX Runtime pelo crate `ort`, variante `EmbeddingGemma300MQ4`, DirectML no Windows) ou Ollama. O EmbeddingGemma 2 (Ollama, 2026) tem uma variante de texto de 270m (~304–378 MB) e MTEB multilíngue v2 de 61,36. Pelo fastembed-rs (backend candle) também há Qwen3-Embedding-0.6B e `bge-m3`. **Só vale se offline/privacidade for requisito de produto**: aumenta o instalador MSIX em centenas de MB, a indexação em CPU leva minutos ou mais, e a qualidade fica abaixo dos líderes via API.

---

### 11. Imagens e PDF

**Situação atual:** imagens viram `[image]`, e são 98% do volume das notas (organogramas, telas, diagramas). O `pdf-extract` não faz OCR.

**Opção A, recomendada (M): legenda + OCR na indexação com VLM barato.** O texto gerado entra no chunk, por exemplo `[Imagem: organograma da Diretoria X — Fulano (Diretor) → Beltrano (Gerente)…; texto visível: …]`, e passa a ser coberto por embedding **e** FTS.
- **Custo** (estimativa): o Gemini 3.x conta **1.120 tokens por imagem** na resolução padrão ("high"; "low" = 280, doc de 2026-10-13). Com `gemini-3.1-flash-lite` (US$ 0,25/M entrada, US$ 1,50/M saída): ~1.320 tokens de entrada + ~300 de saída ≈ **US$ 0,0008 por imagem**, ou **~US$ 0,8 por 1.000** (~US$ 0,4 em batch). Com `qwen3.7-flash` (US$ 0,03/0,13) é ainda mais barato, mas a qualidade de OCR pt-BR não foi verificada.
- **Engenharia:** hash da imagem para deduplicar e cachear a legenda; reprocessar só imagens novas ou ao trocar de modelo; prompt pedindo **transcrição literal do texto visível + estrutura** (hierarquia, setas, campos de tela).
- **Na resposta:** se o trecho recuperado for uma imagem e o modelo do chat aceitar visão (o Monet já envia imagens por visão), **anexe a imagem original**. O modelo lê os detalhes direto, o que compensa erros da legenda, e a citação mostra a imagem.
- **Risco:** VLMs erram relações em organogramas. Mostre a fonte e não trate a legenda como verdade.

**Opção B: embeddings multimodais** (`gemini-embedding-2`, `voyage-multimodal-3.5`, Nemotron VL grátis, Cohere Embed 5). Recupera a imagem por semântica sem depender da legenda. Em compensação, exige re-embutir todo o texto no mesmo espaço, fica sem FTS, e o LLM continua precisando ver a imagem. É secundária à opção A.

**Opção C: ColPali e late interaction** (ICLR 2025). Excelente para documentos visualmente ricos (ViDoRe), mas usa **multi-vetor**, e o sqlite-vec não tem tensores nem MaxSim (o autor cita a falta de suporte "ColBERT-style"). **Não agora.**

**PDF**
- Detecte páginas com menos de ~50 caracteres extraídos e mande só essas para OCR. Opções: **Mistral OCR 3** (2025-12-17: US$ 2 por 1.000 páginas, US$ 1 em batch; a geração atual é o OCR 4.1, preço não verificado) ou Gemini Flash-Lite com o PDF como entrada (~US$ 1,2 por 1.000 páginas, estimativa).
- Chunk por página, com número de página (tema 5).
- Se o Reader já renderiza com PDF.js, a extração de texto por página no front pode ser mais robusta e coerente com a numeração do que o `pdf-extract`. Outra alternativa em Rust é o `pdfium-render`, que exige distribuir a DLL do PDFium.

**Vale para prints de reunião e organogramas?** **Sim, via legenda + OCR (opção A).** É barato, destrava o maior volume de conteúdo invisível e reaproveita todo o resto do pipeline. Embeddings multimodais e ColPali, não por enquanto.

---

### 12. Indexar o histórico de conversas

**Riscos documentados**
- **Reciclagem de alucinação:** respostas da IA viram "fontes" e são citadas como fato depois.
- **Viés de fonte:** retrievers preferem texto de LLM (KDD 2024), então respostas antigas da IA tendem a superar notas humanas.
- **Injeção de memória:** o MINJA (arXiv 2503.03704, v5 em 2026-02) planta registros maliciosos na memória de agentes só por consultas normais. O PoisonedRAG (USENIX Security 2025) chega a 90% de sucesso com 5 textos por pergunta-alvo numa base de milhões, e as defesas avaliadas foram insuficientes.
- **Distratores:** degradam a resposta (Chroma).

**Prática recomendada, se um dia fizer:** opt-in. Indexe só (a) o que o usuário escreveu, (b) respostas que **o usuário salvou** ("salvar como nota") e (c) um resumo datado por conversa, marcado `author=ai`. Use `source_type=chat` com peso baixo, fora da recuperação padrão; ative só quando a pergunta for sobre conversas passadas, via ferramenta `search_past_chats`. TTL e limite de tamanho.

**Para o Monet:** **não indexar por padrão.** O chat em localStorage é efêmero por decisão de produto, e a memória por pasta já guarda os fatos duráveis. Prioridade baixa.

---

### 13. Avaliação para dev solo

**Evidência e boas práticas**
- **Hamel Husain (2026-09):** avalie primeiro a **recuperação como problema de busca** (Recall@k, Precision@k, MRR) e depois a geração. Prefira julgamentos **binários** (passa/falha) a escalas de 1 a 5. Comece por análise de erros (~100 traces, anotando pelo menos 30). Valide o juiz LLM contra rótulos humanos (TPR/TNR). Não use prompts de juiz prontos sem validar.
- **Jason Liu:** gere perguntas sintéticas por chunk e meça se o chunk de origem volta. Em perguntas sintéticas, o recall deveria chegar perto de ~97%; abaixo disso, o problema está na recuperação.
- **RAGAS** (página de 2025-12-09): context precision, context recall, context entities recall, noise sensitivity, response relevancy, faithfulness e variantes multimodais. É Python; útil como referência de métricas, mas não obrigatório.

**Receita para o Monet (P–M)**
1. **Golden set** em `eval/golden.jsonl` com **40–60 perguntas reais**, por classe: termo exato na doc, follow-up (com 2–3 turnos anteriores), reunião/temporal, nota, livro com filtro de documento, estruturada (tarefas/data), enumeração e imagem. Cada item traz `doc_id`/`chunk_id` esperados, a ferramenta esperada, ou fatos-chave.
2. **Script** (teste de integração em Rust ou comando dev em TS) que roda o pipeline e calcula **recall@5/@10/@20 e MRR por classe**. Uma rodada leva segundos e custa centavos (embeddings).
3. **Sintético:** 150 chunks aleatórios → um LLM barato gera uma pergunta pt-BR e uma variante de follow-up → mede recall@k.
4. **Geração:** em ~30 perguntas, juiz binário de *faithfulness* (cada afirmação suportada pelo contexto?) e de *correção* (fatos-chave presentes?), calibrado com seus próprios rótulos. Menos de US$ 1 por rodada.
5. Rode antes e depois de cada mudança dos temas 1 a 12 e guarde um CSV com o histórico.

---

### 14. Qualidade da base ao longo do tempo

**Problemas e evidência:**
- Conteúdo de IA e web fraca é favorecido pelos retrievers (viés de fonte).
- **Injeção indireta de prompt** via conteúdo recuperado (Greshake et al., 2023): "blur the line between data and instructions". Uma página web salva automaticamente que contenha instruções vira um ataque **persistente** em chats futuros.
- Duplicatas: a mesma URL salva várias vezes, notas copiadas.
- Órfãos: arquivos apagados, pastas monitoradas.
- Versões antigas da doc.

**Práticas (P–M)**
- **Dedup:** hash do texto normalizado por chunk e por documento, mais URL canônica (sem `utm_*`, sem fragmento).
- **Varredura de órfãos** periódica: reconciliar chunks com as fontes existentes, respeitando `is_external`, para nunca apagar arquivo do usuário.
- **TTL para web automática:** arquivar ou excluir após 60–90 dias sem citação (`last_cited_at`); itens fixados ficam isentos. Melhor ainda: salvar web na KB **só quando citada** ou com confirmação do usuário.
- **Versionamento:** `doc_version`; prefira a versão mais recente, a menos que a pergunta cite outra (o caso "9.0.0.1").
- **Peso menor** para `author=ai|web` (tema 7).
- **Anti-injeção:** delimite o conteúdo recuperado (`<fonte id=…>…</fonte>`), com uma regra no system prompt dizendo que é dado e não instrução. Nunca execute ferramentas por instrução vinda de uma fonte.
- **Painel simples da KB:** contagem por `source_type`, duplicatas, órfãos, itens mais antigos e nunca citados.

---

### 15. Memória de conversa (Mem0, Letta, Zep/Graphiti) × memória de pasta em texto livre

**Evidência**
- **Mem0 (arXiv 2504.19413, 2025-04-28, fornecedor):** +26% relativo sobre a memória da OpenAI no LoCoMo; p95 de latência −91% e tokens −90% em relação ao contexto completo.
- **Letta (2025-08-12):** um agente com **arquivos e ferramentas simples** (grep, busca, abrir) e GPT-4o-mini fez **74,0%** no LoCoMo, contra os 68,5% reportados pelo Mem0 (variante com grafo). A Letta chama os números do Mem0 de "controversial".
- **Zep/Graphiti (arXiv 2501.13956, fornecedor):** DMR 94,8% contra 93,4% do MemGPT; LongMemEval até +18,5% de acurácia e −90% de latência.
- **LongMemEval (ICLR 2025):** assistentes comerciais e LLMs de contexto longo perdem ~30% de acurácia em interações longas.
- **Memory tool da Anthropic (doc atual):** memória **em arquivos, no cliente**. Recomenda limitar o tamanho dos arquivos e do `view`, **expirar memórias não acessadas há muito tempo** e proteger contra path traversal.

**Para o Monet:** a memória por pasta em texto livre, gerida pela IA via tool, **é o padrão que se sustenta nos benchmarks** (arquivo + ferramentas). Mem0 ou Zep trariam infraestrutura nova (extração por LLM a cada mensagem, grafo, invalidação temporal) **sem ganho claro** para um único usuário. **Não adotar.** Melhorias baratas (P):
- Linhas datadas com fonte: "2026-10-12 — decidiu X (fonte: reunião Y)".
- Regra de **substituir** um fato desatualizado em vez de acrescentar outro, à moda da invalidação do Zep.
- Teto de tamanho com compactação.
- Memória visível e editável na UI.
- Incluir perguntas dependentes de memória no golden set.

---

## (c) Tabela final

| Melhoria | Ganho esperado (evidência) | Custo (consulta / indexação) | Esforço | Risco | Vale para corpus pessoal? |
|---|---|---|---|---|---|
| Golden set + recall@k/MRR | Torna os ganhos mensuráveis (Hamel; J. Liu) | centavos por rodada | P–M | Set pequeno ou enviesado | **Sim, primeiro** |
| Gating "continue/tenta de novo" | Elimina buscas inúteis em follow-ups (qualitativo) | zero | P | Regex falhar em variações | **Sim** |
| Condensação da consulta + palavras-chave + filtros | Reescrita LLM ≥ humana (CAsT-19 NDCG@3 0,515 vs 0,461) | ~US$ 0,0003/turno; +1 chamada | P | Desvio de sentido (fundir com a original) | **Sim** |
| Pré-filtro correto (rowid IN / metadados / exato) | Corrige perdas silenciosas com documento filtrado | zero; ~2–3 ms (estimativa) | P | Migração do vec0 | **Sim (bug)** |
| Cabeçalho contextual determinístico | Parte do ganho da CR (−35% falhas com contexto LLM); recomendação oficial Gemini | re-embed ≈ US$ 0,08 | P | Metadado errado no prefixo | **Sim** |
| Citações com título/data/tipo e montagem de contexto (merge, limiar, ordem) | Menos distratores (Chroma); efeito U (Lost in the Middle) | zero | P | — | **Sim** |
| Híbrida FTS5 + RRF | Falha 3,7% → 2,9% somando BM25 (Anthropic); termos exatos | zero; ms | P–M | Sanitização FTS5; sincronização | **Sim** |
| Rerank (Cohere reuso / Voyage rerank-3-lite) | Falha 2,9% → 1,9% (Anthropic); +16,7% NDCG sobre OpenAI v3 (Voyage, fornecedor) | ~US$ 0,001–0,002/consulta | P | +latência; outro provedor | **Sim** |
| Roteamento para ferramentas SQL (tarefas/agenda/datas) | Resposta exata onde top-k estruturalmente falha | zero | M | Roteador errar a intenção | **Sim** |
| Escopo inteiro em contexto longo / map-reduce | LC > RAG quando cabe (Self-Route); < 200k → tudo no prompt (Anthropic) | US$ 0,003–0,03 por 100k tokens em modelo barato | M | Context rot; custo com premium | **Sim, para perguntas exaustivas** |
| Legenda + OCR de imagens | Destrava 98% do volume das notas | ~US$ 0,4–0,8 por 1.000 imagens | M | Erros do VLM em organogramas | **Sim** |
| OCR de PDF escaneado sob demanda | Texto onde hoje não há nada | ~US$ 1–2 por 1.000 páginas | P–M | Custo em livros grandes | Só se houver escaneados |
| Chunking por estrutura + parent-child | Página/512–1.024 > fixo (NVIDIA); chunks menores dão mais precisão (Chroma) | re-embed ≈ US$ 0,1 | M | Ruído sem rerank | **Sim, depois do rerank** |
| Peso por fonte + recência + filtros de metadados | Neutraliza o viés pró-texto-LLM (KDD 2024); temporal (LongMemEval) | zero | P–M | Pesos mal calibrados | **Sim** |
| Higiene (dedup, órfãos, TTL web, anti-injeção) | Menos poluição; PoisonedRAG mostra o risco | zero | P–M | Apagar algo útil | **Sim** |
| Tool `search_knowledge_base` (agentic) | Multi-hop e refinamento (Anthropic híbrido; Letta 74% LoCoMo) | +1–3 chamadas por turno | M | Uso errático por modelos baratos | **Sim, depois do básico** |
| Contextual Retrieval por LLM (docs longos) | −35% a −49% de falhas (Anthropic) | ~US$ 1–4 uma vez (estimativa) | M | Contexto alucinado; reprocessar | Só transcrições e PDFs sem estrutura |
| `voyage-context-4` | +6,76% vs CR Anthropic (via context-3, fornecedor) | US$ 0,12/M | M | API extra; fora do OpenRouter | Talvez, se a CR mostrar valor |
| Late chunking (Jina) | +1,5–1,9 pt NDCG@10 no BEIR | API Jina ou local | M–G | Fora do stack atual | Não |
| Troca de embedding (Qwen3-8B / Voyage-4 / Gemini-2) | Incerto em pt-BR (MTEB-PT) | re-embed < US$ 1 | P | Trocar sem medir | **Só com o golden set** |
| Embeddings locais (EmbeddingGemma/Qwen3-0.6B) | Offline e custo zero; qualidade menor | zero / CPU | G | Instalador maior; tempo de indexação | Só se offline for requisito |
| Reranker local (bge-reranker-v2-m3) | Similar às APIs, latência em CPU incerta | zero / CPU | M | Latência | Só se offline |
| Multi-query no chat | Pequeno sobre a condensação | +1 chamada | P | Custo e latência | Opcional (já existe no deep research) |
| HyDE | Ganho grande só sobre encoder fraco (44,5 → 61,3) | +1 chamada | P | Documento hipotético enviesa | **Não** |
| Índice leve de entidades | Enumerações e "quem/qual sistema" | centavos | M | Aliases e duplicatas | Talvez (fase 2) |
| GraphRAG / LightRAG / HippoRAG 2 | QA factual ≤ RAG denso (49,6 / 6,6 / 59,8 vs 57,0) | 7–13× mais tokens que HippoRAG 2 | G | Complexidade; atualização incremental | **Não** |
| Embeddings multimodais / ColPali | Bom em docs visuais (ViDoRe) | re-embed tudo; multi-vetor | G | sqlite-vec sem multi-vetor | **Não agora** |
| Indexar histórico do chat | Baixo; risco de reciclar alucinação | baixo | M | Poluição; injeção (MINJA) | **Não** (no máximo opt-in curado) |
| Mem0 / Zep / Letta | Alegações fortes, contestadas (Letta vs Mem0) | infra nova | G | Complexidade | **Não** |
| Memória de pasta: datas, substituição de fatos, teto | Coerência; segue o padrão da Anthropic | zero | P | — | **Sim** |

---

## (d) Fontes (todas acessadas em 2026-10-17; data de publicação ou atualização entre parênteses)

**sqlite-vec, SQLite, rusqlite**
- Alex Garcia, *Hybrid full-text search and vector search with SQLite* (2024-10-02): https://alexgarcia.xyz/blog/2024/sqlite-vec-hybrid-search/index.html
- Alex Garcia, *sqlite-vec v0.1.6: metadata columns, partition keys, auxiliary columns* (2024-11-20): https://alexgarcia.xyz/blog/2024/sqlite-vec-metadata-release/index.html
- Alex Garcia, *sqlite-vec stable release* (benchmarks, 2024-08-01): https://alexgarcia.xyz/blog/2024/sqlite-vec-stable-release/index.html
- sqlite-vec, docs de KNN e vec0: https://alexgarcia.xyz/sqlite-vec/features/knn.html · https://alexgarcia.xyz/sqlite-vec/features/vec0.html
- sqlite-vec, releases (v0.1.9 em 2026-03-31; v0.1.10-alpha.4 em 2026-05-18): https://github.com/asg017/sqlite-vec/releases
- sqlite-vec, código-fonte (`rowid in (...)` em KNN; ANN): https://raw.githubusercontent.com/asg017/sqlite-vec/main/sqlite-vec.c
- SQLite FTS5 (tokenizers, bm25, external content): https://www.sqlite.org/fts5.html
- fts5-snowball (stemmers Snowball para FTS5): https://github.com/abiliojr/fts5-snowball
- rusqlite, `libsqlite3-sys/build.rs` (FTS5 habilitado; SQLite 3.54.0): https://raw.githubusercontent.com/rusqlite/rusqlite/master/libsqlite3-sys/build.rs

**OpenRouter (dados ao vivo)**
- API de modelos (preços e contexto): https://openrouter.ai/api/v1/models
- API de embeddings (33 modelos): https://openrouter.ai/api/v1/embeddings/models
- Modelos de rerank: https://openrouter.ai/api/v1/models?output_modalities=rerank
- Cookbook *RAG with Embeddings & Rerank*: https://openrouter.ai/docs/cookbook/evaluate-and-optimize/rag.md
- API de rerank: https://openrouter.ai/docs/api/api-reference/rerank/submit-a-rerank-request.md
- API de embeddings: https://openrouter.ai/docs/api/api-reference/embeddings/submit-an-embedding-request.md
- Guia de prompt caching: https://openrouter.ai/docs/guides/best-practices/prompt-caching.md

**Reranking**
- Voyage, *rerank-3 and rerank-3-lite* (2026-09-30): https://blog.voyageai.com/2026/09/30/rerank-3/
- Voyage, *rerank-2.5 and rerank-2.5-lite* (2025-08-11): https://blog.voyageai.com/2025/08/11/rerank-2-5/
- Voyage, *The Case Against LLMs as Rerankers* (2025-10-22): https://blog.voyageai.com/2025/10/22/the-case-against-llms-as-rerankers/
- Voyage, preços (atualizado em 2026-09-29): https://docs.voyageai.com/docs/pricing
- Cohere, preços (Model Vault; definição de "search"): https://cohere.com/pricing
- Cohere, Rerank overview e modelos: https://docs.cohere.com/docs/rerank-overview · https://docs.cohere.com/docs/models
- Jina Reranker (v3.5 em 2026-08-03; licenças): https://jina.ai/reranker/
- BAAI bge-reranker-v2-m3: https://huggingface.co/BAAI/bge-reranker-v2-m3

**Contextual Retrieval, chunking**
- Anthropic, *Introducing Contextual Retrieval* (2024-09-19): https://www.anthropic.com/news/contextual-retrieval
- Voyage, *voyage-context-4* (2026-06-29): https://blog.voyageai.com/2026/06/29/voyage-context-4/
- Günther et al., *Late Chunking* (arXiv 2409.04701; v3 em 2025-07-07): https://arxiv.org/abs/2409.04701
- Chroma, *Evaluating Chunking Strategies for Retrieval* (2024-07-03): https://www.trychroma.com/research/evaluating-chunking
- NVIDIA, *Finding the Best Chunking Strategy for Accurate AI Responses* (2025-06-18): https://developer.nvidia.com/blog/finding-the-best-chunking-strategy-for-accurate-ai-responses/
- Qu et al., *Is Semantic Chunking Worth the Computational Cost?* (arXiv 2410.13070, 2024-10-16): https://arxiv.org/abs/2410.13070

**Consulta e agentic**
- Mao et al., *LLM4CS* (Findings of EMNLP 2023; arXiv 2303.06573): https://arxiv.org/abs/2303.06573
- Gao et al., *HyDE* (arXiv 2212.10496, 2022-12-20): https://arxiv.org/abs/2212.10496
- Jeong et al., *Adaptive-RAG* (NAACL 2024; arXiv 2403.14403): https://arxiv.org/abs/2403.14403
- Anthropic, *Effective context engineering for AI agents* (2025-09-29): https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

**Contexto longo**
- Li et al., *RAG or Long-Context LLMs? (Self-Route)* (EMNLP 2024; arXiv 2407.16833): https://arxiv.org/abs/2407.16833
- Li et al., *LaRA* (arXiv 2502.09977, 2025-02-14): https://arxiv.org/abs/2502.09977
- Databricks, *Long Context RAG Performance of LLMs* (2024-08-12): https://www.databricks.com/blog/long-context-rag-performance-llms
- Chroma, *Context Rot* (2025-07-14): https://www.trychroma.com/research/context-rot
- Liu et al., *Lost in the Middle* (TACL; arXiv 2307.03172): https://arxiv.org/abs/2307.03172

**Grafos e memória**
- Gutiérrez et al., *HippoRAG 2 / From RAG to Memory* (ICML 2025; arXiv 2502.14802): https://arxiv.org/abs/2502.14802 (tabelas na versão HTML v2)
- Han et al., *RAG vs. GraphRAG* (arXiv 2502.11371; v3 em 2026-03-04): https://arxiv.org/abs/2502.11371
- Microsoft Research, *LazyGraphRAG* (2024-11-25): https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/
- Chhikara et al., *Mem0* (arXiv 2504.19413, 2025-04-28): https://arxiv.org/abs/2504.19413
- Letta, *Benchmarking AI Agent Memory: Is a Filesystem All You Need?* (2025-08-12): https://www.letta.com/blog/benchmarking-ai-agent-memory
- Rasmussen et al., *Zep* (arXiv 2501.13956, 2025-01-20): https://arxiv.org/abs/2501.13956
- Wu et al., *LongMemEval* (ICLR 2025; arXiv 2410.10813): https://arxiv.org/abs/2410.10813
- Anthropic, *Memory tool* (doc atual): https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool

**Embeddings**
- Qwen, *Qwen3 Embedding* (2025-06-05): https://qwenlm.github.io/blog/qwen3-embedding/
- Google, *Introducing EmbeddingGemma* (2025-09-04): https://developers.googleblog.com/en/introducing-embeddinggemma/
- Ollama, *embeddinggemma-2* (2026): https://ollama.com/library/embeddinggemma-2 · lista de embeddings: https://ollama.com/search?c=embedding
- Google, *Gemini API — Embeddings* (atualizado em 2026-10-09): https://ai.google.dev/gemini-api/docs/embeddings
- Voyage, *The Voyage 4 model family* (2026-01-15): https://blog.voyageai.com/2026/01/15/voyage-4/ · índice do blog: https://blog.voyageai.com/
- Jina, *Embeddings* (v5, 2026): https://jina.ai/embeddings/
- Enevoldsen et al., *MMTEB* (ICLR; arXiv 2502.13595, v4 em 2025-11-13): https://arxiv.org/abs/2502.13595
- Okamura et al., *MTEB-PT* (BRACIS 2026; arXiv 2607.04071, 2026-07-05): https://arxiv.org/abs/2607.04071 · definição no MTEB: https://raw.githubusercontent.com/embeddings-benchmark/mteb/main/mteb/benchmarks/benchmarks/benchmarks.py
- fastembed-rs (ONNX/ort, modelos suportados): https://github.com/Anush008/fastembed-rs
- OpenAI, *New embedding models and API updates* (2024-01-25): https://openai.com/index/new-embedding-models-and-api-updates/ (retornou 403 nesta verificação)

**Imagens e PDF**
- Google, *Media resolution* (tokens por imagem; atualizado em 2026-10-13): https://ai.google.dev/gemini-api/docs/media-resolution
- Mistral, *Mistral OCR 3* (2025-12-17): https://mistral.ai/news/mistral-ocr-3 · *Mistral OCR* (2025-03-06): https://mistral.ai/news/mistral-ocr · modelos (OCR 4.1 atual): https://docs.mistral.ai/getting-started/models/models_overview/
- Faysse et al., *ColPali* (ICLR 2025; arXiv 2407.01449): https://arxiv.org/abs/2407.01449

**Avaliação, qualidade e segurança**
- RAGAS, métricas disponíveis (2025-12-09): https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- Jason Liu, *Systematically Improving Your RAG* (2024-05-22): https://jxnl.co/writing/2024/05/22/systematically-improving-your-rag/
- Hamel Husain, *LLM Evals FAQ* (2026-09-18, revisado em 2026-09-21): https://hamel.dev/blog/posts/evals-faq/
- Dai et al., *Neural Retrievers are Biased Towards LLM-Generated Content* (KDD 2024; arXiv 2310.20501): https://arxiv.org/abs/2310.20501
- Zou et al., *PoisonedRAG* (USENIX Security 2025; arXiv 2402.07867): https://arxiv.org/abs/2402.07867
- Greshake et al., *Indirect Prompt Injection* (arXiv 2302.12173, 2023): https://arxiv.org/abs/2302.12173
- Dong et al., *MINJA: Memory Injection Attacks on LLM Agents* (arXiv 2503.03704; v5 em 2026-02-12): https://arxiv.org/abs/2503.03704

---

## Lacunas e limitações desta pesquisa

1. **Sem busca web:** a cota estava esgotada. Usei só URLs primárias conhecidas e APIs públicas, então artigos e relatos de produção de 2026 que não conheço podem ter ficado de fora.
2. **Preços de rerank no OpenRouter não confirmados:** a API mostra `0`, e o custo só aparece em `usage.cost` na resposta. O preço PAYG do Cohere (Rerank 3.5/4) não está mais na página de preços; o "US$ 2 por 1.000 buscas" é histórico e não foi confirmado.
3. **Sem medições de latência:** rerank, condensação, contexto de 100k tokens, rerankers e embeddings locais em CPU não foram medidos. Os ~2–3 ms da força bruta no sqlite-vec são extrapolação linear do benchmark oficial.
4. **pt-BR:** não obtive os scores por modelo do MTEB-PT, e o leaderboard atual do MTEB/MMTEB (página dinâmica) não foi lido. Os números de 2024 do `text-embedding-3` vêm do anúncio original (a página deu 403 nesta verificação).
5. **Itens não verificados:** se o `rowid IN` do sqlite-vec aceita subquery (o código mostra suporte via `sqlite3_vtab_in`; testar), o preço do Mistral OCR 4.1 e a qualidade de OCR pt-BR do Qwen3.7 Flash.
6. **Vieses dos fornecedores:** os números da Voyage, Mem0, Zep e Jina são alegações de quem vende. Onde houve, citei contraponto (Letta × Mem0).
7. **Código do Monet não inspecionado,** por escopo da tarefa. O diagnóstico usa a descrição fornecida. As estimativas de tamanho (~45% dos chunks no TXT; tokens por reunião e por caderno) assumem ~3,5–4 chars por token e um TXT majoritariamente ASCII; confirme com uma contagem no banco.
