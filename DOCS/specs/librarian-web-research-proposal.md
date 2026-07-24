# Proposta: "Bibliotecário" — persistência de fontes web via modelo secundário em background

> Documento de proposta para segunda opinião antes de implementação.
> Relacionado à feature implementada em `DOCS/reports/23-07-2026/` (web research persistida via KB por chat-folder).

## Contexto

O Monet (app Tauri: React + Rust + SQLite com busca vetorial, modelos via OpenRouter) implementou uma feature de **gravação de fontes web na base de conhecimento (RAG) por pasta de chats**. A implementação atual funciona, mas ficou frágil: ela exige que o **modelo principal do chat** execute uma coreografia de 3–4 rodadas de tool-calling (`web_search` → `read_web_source` → `save_web_source` → texto final). Isso gerou 5 sessões de correção de bugs: loop de tools improvisado (teto `MAX_TOOL_ROUNDS = 8`), race condition no input durante execução de tools, respostas finais vazias, modelo negando ter salvado, e latência alta percebida pelo usuário. A coreografia depende da disciplina de modelos rápidos/baratos, que falha com frequência.

## A proposta

**Separar o agente conversacional do agente de manutenção ("bibliotecário").** O modelo principal volta a fazer só o que já fazia bem (buscar e responder, 1–2 rodadas de tools, como era antes da feature). Todo o trabalho de avaliar/ler/limpar/salvar fontes web migra para um **pipeline em background orquestrado por código**, disparado automaticamente após cada busca web, usando um **modelo secundário rápido e barato** (ex.: família DeepSeek via OpenRouter).

## Fluxo proposto

```
1. Usuário pergunta → web_search (snippets) → modelo principal responde
   (turno do usuário termina aqui — zero latência extra percebida)
2. Background (disparado pelo código, não pelo modelo):
   a. Dedupe: descarta URLs já salvas (hash SHA-256 da URL — já existe)
   b. Triagem: modelo secundário recebe pergunta do usuário + snippets
      → decide quais URLs valem o extract (0 a N; turbo: URLs que o
      modelo principal citou na resposta ganham prioridade)
   c. Extract: tavilyExtract em lote só nas candidatas (endpoint já existe)
   d. Julgamento: modelo secundário lê o conteúdo real e decide se presta
      (descarta paywall/boilerplate/teaser — caso real observado: Medium)
   e. Limpeza: se aprovado, o mesmo modelo devolve o texto limpo
      (remove nav/ads, SEM parafrasear — restrição de produto existente)
   f. Persistência: write .md + scan + embeddings (comandos Rust já existem)
   g. Feedback: evento de UI "N fontes salvas" (não texto do modelo)
```

## O que já existe e é 100% reaproveitado

- `tavilyExtract()` (endpoint `/extract`, aceita lote de URLs) — `src/lib/search.ts`
- `hashUrlToFilename()` (dedupe determinístico) — `src/lib/search.ts`
- `documents_ensure_ai_folder` / `documents_write_ai_source_file` (comandos Tauri) — `src-tauri/src/documents.rs`
- RAG dinâmico pasta→filhos, toggle `webResearchEnabled` por pasta, badge "AI-generated", deleção física condicional — tudo implementado
- Indicadores visuais "Saving source..." — já existem no ChatPanel

## O que muda

- Remove `read_web_source`/`save_web_source` do chat; o loop multi-rodada pode ser drasticamente simplificado (volta a 1–2 rodadas)
- Novo: função de pipeline background (~1 função no frontend) + 2 chamadas de modelo secundário com saída estruturada (JSON)
- Modelo do bibliotecário: **fixo/config interna** (decisão do sistema, não do usuário), fallback silencioso em caso de falha
- Dois modos de gatilho: **explícito** (usuário pediu "salva isso" → salva direto, só limpa) e **oportunista** (barra alta de relevância)

## Pontos de atenção (para a segunda opinião focar)

1. **Contexto mínimo para julgamento**: pergunta do usuário + 1-2 mensagens recentes é suficiente? Ou precisa de mais histórico?
2. **Poluição da KB**: barra de relevância do modo oportunista — como calibrar para não degradar o RAG ao longo do tempo?
3. **Corrida save↔RAG**: fonte salva em background pode não estar indexada ainda quando o usuário pergunta algo relacionado no turno seguinte (gap já conhecido — aceitável?)
4. **Limpeza verbatim vs. síntese**: o modelo secundário precisa obedecer estritamente "remover boilerplate sem parafrasear" — esse é o teste de aceite do modelo escolhido
5. **Custo marginal por turno**: no caso comum (nada durável), custo = 1 chamada barata + 0 extracts — aceitável?

## Pergunta aos revisores

Essa separação (conversacional vs. bibliotecário) é de fato superior à coreografia atual de tools no modelo principal? Há vantagens da abordagem atual que eu esteja subestimando? Os pontos de atenção acima estão corretos ou há riscos não mapeados?
