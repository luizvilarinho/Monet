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
- Painel IA com toggle (abrir/fechar)
- Seletor de modelo no painel IA (dados mockados — ainda não integrado)
- Barra de busca de anotações (UI presente)
- Botões `export .md` e `preview` na toolbar (UI presente)

### 🔧 Pendente — fase atual
- **Integração OpenRouter:** conectar o seletor de modelo à API real do OpenRouter com streaming de respostas
- **Sistema de /comandos:** parser no editor, autocomplete, execução e exibição de respostas no painel IA
- Chave de API deve ser armazenada via Tauri (Rust), nunca exposta no frontend

### 📋 Backlog fase 2
- RAG completo com Transformers.js + embeddings no SQLite
- Web search como tool call da IA
- Upload de PDF/TXT como contexto
- Preview de markdown (toggle)
- Exportar nota como `.md`
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
| Banco local | SQLite via `tauri-plugin-sql` |
| RAG | Transformers.js (`all-MiniLM-L6-v2`) — fase 2 |
| PDF parsing | pdf.js — fase 2 |
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
│   │   │   ├── AiCard.tsx      # Card individual de resposta
│   │   │   └── AiPanel.module.css
│   │   └── Toolbar/
│   │       ├── Toolbar.tsx     # export, preview, seletor de modelo
│   │       └── Toolbar.module.css
│   │
│   ├── hooks/
│   │   ├── useNotebooks.ts     # CRUD de cadernos
│   │   ├── useNotes.ts         # CRUD de notas
│   │   ├── useAi.ts            # Streaming de respostas da IA
│   │   └── useCommands.ts      # Execução de /comandos
│   │
│   ├── lib/
│   │   ├── openrouter.ts       # Cliente OpenRouter configurado
│   │   ├── commands.ts         # Definições e handlers dos /comandos
│   │   └── markdown.ts         # unified pipeline
│   │
│   └── types/
│       └── index.ts            # Notebook, Note, Command, AiResponse...
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

CREATE TABLE rag_chunks (
  id          TEXT PRIMARY KEY,
  note_id     TEXT REFERENCES notes(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   BLOB NOT NULL,
  chunk_index INTEGER NOT NULL
);

CREATE TABLE ai_responses (
  id          TEXT PRIMARY KEY,
  note_id     TEXT REFERENCES notes(id) ON DELETE CASCADE,
  command     TEXT NOT NULL,
  query       TEXT,
  response    TEXT NOT NULL,
  created_at  INTEGER NOT NULL
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