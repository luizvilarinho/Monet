# Monet — Project Brief

## Nome e identidade

**Monet** — inspirado no pintor Claude Monet, obcecado em capturar a luz fugaz no momento em que ela acontece. O app faz o mesmo com o conhecimento: captura a *impressão* de uma aula, palestra ou leitura no exato momento em que ela acontece.

Assim como Monet não pintava objetos — pintava a *impressão* da luz sobre eles — o Monet não é um bloco de notas, é a impressão do conhecimento no momento em que ele passa.

---

## Visão do produto

Aplicativo de notas inteligente para estudo ativo. O usuário anota enquanto assiste palestras, lê livros ou artigos — e usa `/comandos` inline para acionar a IA em momentos específicos, sem interromper o fluxo de escrita.

A IA é silenciosa por padrão e só age quando chamada. Isso diferencia o produto de ferramentas como Notion AI ou ChatGPT, que são proativas demais para contextos de concentração.

**Plataforma inicial:** App desktop Windows (Tauri 2), distribuído pela Microsoft Store.
**Futuro:** Webapp simplificado reaproveitando o mesmo código React.

---

## Estado atual do projeto

### ✅ Implementado e funcionando
- Setup Tauri 2 + React + TypeScript + Vite
- Layout 4 colunas: Cadernos | Anotações | Editor | Painel IA
- Persistência de cadernos e notas no SQLite local
- Criação e listagem de cadernos e anotações
- Tags por nota (ex: #aovivo, #importante)
- Painel IA com toggle e seletor de modelo (OpenRouter real, com streaming)
- Sistema de `/comandos` no editor (parser, autocomplete, execução)
- Barra de busca de anotações
- Export `.md` e preview de markdown
- Web search via Tavily como contexto opcional dos comandos
- Chat livre (modo `chat`)
- Mini-navegador de títulos
- **RAG por caderno:** upload de PDF/TXT/MD, indexação em background com `sqlite-vec` (768 dim, OpenRouter embeddings), busca KNN filtrada por caderno e injeção automática de trechos nos `/comandos`. UI: ícone de documentos no caderno + modal com tabela de status e ações.

### 📋 Backlog
- Modo flashcard
- Build `.msix` para Microsoft Store

### 📋 Backlog fase 3
- `storage.ts` implementação browser (IndexedDB)
- Webapp React puro sem Tauri
- Sync opcional na nuvem (Supabase ou similar)
- Build para Mac e Linux

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| UI | React 18 + TypeScript |
| Editor | CodeMirror 6 |
| Estilo | CSS Modules + variáveis CSS |
| Banco local | SQLite via `tauri-plugin-sql` (`monet.db`) + `rusqlite` direto (`monet-vec.db`) |
| RAG | OpenRouter (`google/gemini-embedding-2-preview`, 768 dim) + `sqlite-vec` |
| PDF parsing | `pdf-extract` (Rust, no backend) |
| Markdown render | unified + remark + rehype |
| IA | OpenRouter API (multi-modelo, com streaming) |
| Portabilidade | `storage.ts` abstraction layer |

> **Nota sobre IA:** o projeto usa **OpenRouter** como gateway de modelos, não o Anthropic SDK diretamente. O seletor de modelo na UI permite trocar o modelo em uso. A chave de API do OpenRouter deve ser gerenciada pelo backend Rust via Tauri commands, nunca exposta como variável de ambiente no frontend.

---

## Estrutura de pastas

```
monet/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   └── commands.rs         # Comandos Tauri expostos ao frontend
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── storage/
│   │   ├── index.ts            # Interface StorageAdapter
│   │   ├── tauri.ts            # Implementação desktop (SQLite)
│   │   └── browser.ts          # Implementação web (IndexedDB) — fase 3
│   │
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── Editor.tsx
│   │   │   ├── commandParser.ts
│   │   │   └── Editor.module.css
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx     # Cadernos, anotações, tags, busca
│   │   │   └── Sidebar.module.css
│   │   ├── AiPanel/
│   │   │   ├── AiPanel.tsx     # Painel de respostas IA (toggle)
│   │   │   ├── AiCard.tsx      # Card individual de resposta + seção Fontes (RAG)
│   │   │   └── AiPanel.module.css
│   │   ├── DocumentsModal/
│   │   │   ├── DocumentsModal.tsx     # Modal de gerenciamento de docs do caderno
│   │   │   └── DocumentsModal.module.css
│   │   └── Toolbar/
│   │       ├── Toolbar.tsx     # export, preview, seletor de modelo
│   │       └── Toolbar.module.css
│   │
│   ├── hooks/
│   │   ├── useNotebooks.ts     # CRUD de cadernos
│   │   ├── useNotes.ts         # CRUD de notas
│   │   ├── useAi.ts            # Streaming de respostas da IA
│   │   ├── useDocuments.ts     # Lista de documentos por caderno + eventos de status
│   │   └── useCommands.ts      # Execução de /comandos
│   │
│   ├── lib/
│   │   ├── openrouter.ts       # Cliente OpenRouter configurado
│   │   ├── documents.ts        # Wrappers dos commands de RAG + listener de status
│   │   ├── commands.ts         # Definições e handlers dos /comandos
│   │   └── markdown.ts         # unified pipeline
│   │
│   └── types/
│       └── index.ts            # Notebook, Note, Command, AiResponse, AiSource, Document...
│
├── DOCS/
│   ├── doc.menu.md             # Índice de documentação para o modelo
│   ├── setup/
│   │   └── project.md          # Este arquivo (overview do produto)
│   └── behavior/
│       ├── BDD/                # Specs em Gherkin por feature
│       └── design/
│           └── SKILL.md        # Skill de design e usabilidade
│
├── AI/
│   └── TASKS.md                # Tarefas com flags PENDENTE / FEITO
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Modelo de dados (SQLite)

```sql
CREATE TABLE notebooks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE notes (
  id           TEXT PRIMARY KEY,
  notebook_id  TEXT REFERENCES notebooks(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,      -- markdown bruto
  tags         TEXT DEFAULT '[]',  -- JSON array de strings
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE documents (
  id             TEXT PRIMARY KEY,
  notebook_id    TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  original_path  TEXT NOT NULL,        -- arquivo copiado em app_data_dir/documents/
  mime           TEXT NOT NULL,
  size           INTEGER NOT NULL,
  status         TEXT NOT NULL,        -- 'indexing' | 'available' | 'error'
  error_message  TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE ai_responses (
  id          TEXT PRIMARY KEY,
  note_id     TEXT REFERENCES notes(id) ON DELETE CASCADE,
  command     TEXT NOT NULL,
  query       TEXT,
  model       TEXT NOT NULL DEFAULT '',
  response    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'completed',
  command_id  TEXT,
  sources     TEXT,                    -- JSON array de AiSource (RAG)
  created_at  INTEGER NOT NULL
);
```

Os vetores ficam em arquivo separado **`monet-vec.db`** (aberto só pelo Rust via `rusqlite` + extensão `sqlite-vec`):

```sql
CREATE VIRTUAL TABLE vec_chunks USING vec0(embedding float[768]);

CREATE TABLE chunks_meta (
  rowid        INTEGER PRIMARY KEY,    -- mesma rowid de vec_chunks
  document_id  TEXT NOT NULL,
  notebook_id  TEXT NOT NULL,
  source_name  TEXT NOT NULL,
  content      TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL
);
```

---

## Sistema de /comandos

| Comando | Comportamento |
|---|---|
| `/pesquisa [termo]` | Busca rápida, resposta objetiva |
| `/quem [nome]` | Perfil profissional de uma pessoa |
| `/definir [termo]` | Definição técnica concisa |
| `/resumir` | Resume o conteúdo da nota atual em bullet points |
| `/opiniao [tema]` | Resposta opinativa e direta |
| `/tabela [tema]` | Resposta formatada como tabela markdown |
| `/aprofundar` | Adiciona informações novas e úteis que não estão explícitas na nota |
| `/explicar [conceito]` | Explica um conceito de forma simples (técnica Feynman) |
| `/guia [tópico]` | Cria um roteiro de estudos com tópicos e sequência lógica |
| `/mapa-mental` | Gera um mapa mental hierárquico da nota atual em markdown |
| `/perguntar [pergunta]` | Faz uma pergunta livre ao modelo |

### Fluxo do parser (CodeMirror 6)
1. Editor detecta linhas que começam com `/` em tempo real
2. Mostra autocomplete com os comandos disponíveis
3. Ao pressionar `Enter` em linha de comando válida:
   - Comando marcado visualmente na nota (cor diferente)
   - Hook `useCommands` chamado com `{ cmd, query, noteContext }`
   - Resposta chega em streaming no `AiPanel`

---

## Integração OpenRouter

O OpenRouter é um gateway que unifica acesso a múltiplos modelos (Claude, GPT, Gemini, etc.) com uma API compatível com o padrão OpenAI.

```typescript
// src/lib/openrouter.ts

export async function streamFromOpenRouter(
  model: string,           // ex: "anthropic/claude-sonnet-4-5"
  systemPrompt: string,
  userMessage: string,
  onChunk: (text: string) => void
): Promise<void> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${await getApiKey()}`, // via Tauri command
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  })
  // processar SSE stream...
}
```

> A função `getApiKey()` deve invocar um Tauri command Rust que lê a chave de um arquivo seguro local — nunca de `import.meta.env`.

---

## Visual e identidade

### Tema
Escuro exclusivo, estilo editor de código com toques impressionistas sutis.

- **Fonte:** `JetBrains Mono` para o editor; `system-ui` para UI
- **Paleta:**
  - Background: `#0e0e10` (app), `#161618` (painéis)
  - Superfícies: `#1e1e22`, `#26262c`, `#2e2e36`
  - Texto: `#e8e8f0` (primário), `#a0a0b8` (secundário), `#606070` (muted)
  - Acento principal: `#7c6af5` (lilás)
  - Acento IA: `#5dcaa5` (teal)
  - Acento aviso: `#ef9f27` (âmbar)
  - Borda: `#333340`

### Layout (4 colunas)

```
┌─────────────────────────────────────────────────────────────┐
│ titlebar: [monet]          [buscar]     [export .md][preview][ai] │
├────────────┬──────────────┬──────────────────┬──────────────┤
│  CADERNOS  │  ANOTAÇÕES   │     EDITOR       │  PAINEL IA   │
│   180px    │    200px     │    flex: 1       │   300px      │
│            │              │                  │  (toggle)    │
│ + novo     │ + nova       │  título          │              │
│            │              │  tags            │  stream por  │
│ Caderno 1  │ Nota A       │                  │  /comando    │
│ Caderno 2  │ Nota B       │  CodeMirror 6    │              │
│            │              │  markdown        │              │
│ ── TAGS ── │              │  /cmd highlight  │              │
│ #aovivo    │              │                  │  [modelo ▼]  │
│ #importante│              │                  │              │
└────────────┴──────────────┴──────────────────┴──────────────┘
```

---

## Decisões de arquitetura

**OpenRouter em vez de Anthropic SDK direto**
Permite trocar de modelo sem mudar código. O usuário escolhe o modelo na UI. Mantém o custo flexível.

**Chave de API no Rust, não no frontend**
O frontend nunca deve ter acesso direto à chave. Um Tauri command Rust lê e injeta nos headers das requisições.

**Por que Tauri e não Electron?**
Bundle ~10MB vs ~150MB. Performance nativa. Gera `.msix` para Microsoft Store. Segurança por design (permissões explícitas em Rust).

**Por que `storage.ts` como abstração?**
Permite webapp futuro sem reescrever a lógica de produto. Só a implementação da interface muda.

**Por que CodeMirror 6?**
O parser de `/comandos` precisa de controle fino sobre o texto — decorações, posição do cursor, autocomplete. CodeMirror 6 tem API de extensões moderna para isso.