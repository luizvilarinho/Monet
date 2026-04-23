# Monet — Project Brief para Claude Code

## Nome e identidade

**Monet** — inspirado no pintor Claude Monet, obcecado em capturar a luz fugaz no momento em que ela acontece. O app faz o mesmo com o conhecimento: captura a *impressão* de uma aula, palestra ou leitura no exato momento em que ela acontece.

Assim como Monet não pintava objetos — pintava a *impressão* da luz sobre eles — o Monet não é um bloco de notas, é a impressão do conhecimento no momento em que ele passa.

## Visão do produto

Aplicativo de notas inteligente para estudo ativo. O usuário anota enquanto assiste palestras, lê livros ou artigos — e usa `/comandos` inline para acionar a IA em momentos específicos, sem interromper o fluxo de escrita.

A IA é silenciosa por padrão e só age quando chamada. Isso diferencia o produto de ferramentas como Notion AI ou ChatGPT, que são proativas demais para contextos de concentração.

**Plataforma inicial:** App desktop Windows (Tauri), distribuído pela Microsoft Store.  
**Futuro:** Webapp simplificado reaproveitando o mesmo código React.

---

## Stack técnica

| Camada | Tecnologia | Motivo |
|---|---|---|
| Desktop shell | **Tauri 2** (Rust) | Bundle leve ~10MB, gera `.msix` para Microsoft Store |
| UI | **React 18** + TypeScript | Componentização, reutilizável no webapp futuro |
| Editor | **CodeMirror 6** | Markdown em tempo real, extensível para parser de `/comandos` |
| Estilo | **CSS Modules** + variáveis CSS | Sem framework CSS, tema escuro nativo |
| Banco local | **SQLite** via `tauri-plugin-sql` | Notas + chunks de embeddings |
| RAG | **Transformers.js** (modelo `all-MiniLM-L6-v2`) | Embeddings locais, sem servidor externo |
| PDF parsing | **pdf.js** | Leitura e extração de texto de PDFs no frontend |
| Markdown render | **unified** + **remark** + **rehype** | Pipeline flexível para preview |
| IA | **Anthropic SDK** (`claude-sonnet-4-5`) | Streaming de respostas, tool use para web search |
| Portabilidade | **`storage.ts`** (abstraction layer) | Isola Tauri vs browser — mesmo React serve os dois |

---

## Estrutura de pastas

```
monet/
├── src-tauri/                  # Rust / Tauri backend
│   ├── src/
│   │   ├── main.rs
│   │   └── commands.rs         # Comandos Tauri expostos ao frontend
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                        # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── storage/
│   │   ├── index.ts            # Interface única (Storage interface)
│   │   ├── tauri.ts            # Implementação desktop (SQLite + FS)
│   │   └── browser.ts          # Implementação web (IndexedDB)
│   │
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── Editor.tsx      # CodeMirror 6 wrapper
│   │   │   ├── commandParser.ts # Parser de /comandos
│   │   │   └── Editor.module.css
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx     # Lista de notas, busca
│   │   │   └── Sidebar.module.css
│   │   ├── AiPanel/
│   │   │   ├── AiPanel.tsx     # Painel de respostas IA (toggle)
│   │   │   ├── AiCard.tsx      # Card individual de resposta
│   │   │   └── AiPanel.module.css
│   │   └── Toolbar/
│   │       ├── Toolbar.tsx     # Topbar: título, tags, export, preview toggle
│   │       └── Toolbar.module.css
│   │
│   ├── hooks/
│   │   ├── useNotes.ts         # CRUD de notas
│   │   ├── useAi.ts            # Streaming de respostas da IA
│   │   ├── useRag.ts           # Indexação e busca de PDFs
│   │   └── useCommands.ts      # Execução de /comandos
│   │
│   ├── lib/
│   │   ├── anthropic.ts        # Cliente Anthropic configurado
│   │   ├── rag.ts              # Pipeline RAG: chunk → embed → search
│   │   ├── commands.ts         # Definições e handlers dos /comandos
│   │   └── markdown.ts         # unified pipeline
│   │
│   └── types/
│       └── index.ts            # Note, Command, AiResponse, RagChunk...
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── MONET_PROJECT.md            # este arquivo
```

---

## Modelo de dados (SQLite)

```sql
-- Notas
CREATE TABLE notes (
  id          TEXT PRIMARY KEY,   -- nanoid
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,      -- markdown bruto
  tags        TEXT DEFAULT '[]',  -- JSON array de strings
  created_at  INTEGER NOT NULL,   -- unix timestamp
  updated_at  INTEGER NOT NULL
);

-- Chunks de documentos para RAG
CREATE TABLE rag_chunks (
  id          TEXT PRIMARY KEY,
  note_id     TEXT REFERENCES notes(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,      -- nome do PDF/arquivo original
  content     TEXT NOT NULL,      -- texto do chunk
  embedding   BLOB NOT NULL,      -- Float32Array serializado
  chunk_index INTEGER NOT NULL
);

-- Histórico de respostas IA (opcional, para revisão)
CREATE TABLE ai_responses (
  id          TEXT PRIMARY KEY,
  note_id     TEXT REFERENCES notes(id) ON DELETE CASCADE,
  command     TEXT NOT NULL,      -- ex: '/definir'
  query       TEXT,
  response    TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
```

---

## A interface `storage.ts`

Esta é a peça central da portabilidade. Todo acesso a dados passa por aqui.

```typescript
// src/storage/index.ts

export interface StorageAdapter {
  // Notas
  getNotes(): Promise<Note[]>
  getNote(id: string): Promise<Note | null>
  saveNote(note: Note): Promise<void>
  deleteNote(id: string): Promise<void>
  searchNotes(query: string): Promise<Note[]>

  // RAG
  saveChunks(chunks: RagChunk[]): Promise<void>
  searchChunks(embedding: Float32Array, topK: number): Promise<RagChunk[]>
  deleteChunks(noteId: string): Promise<void>

  // Arquivos
  exportMarkdown(note: Note): Promise<void>
  importFile(accept: string): Promise<{ name: string; content: string }>
}

// Detecção automática de ambiente
export function createStorage(): StorageAdapter {
  if (window.__TAURI__) {
    return new TauriStorage()   // src/storage/tauri.ts
  }
  return new BrowserStorage()   // src/storage/browser.ts
}

export const storage = createStorage()
```

---

## Sistema de /comandos

### Comandos disponíveis

| Comando | Comportamento | Exemplo |
|---|---|---|
| `/pesquisa [termo]` | Busca rápida, resposta objetiva | `/pesquisa Delta Sharing` |
| `/quem [nome]` | Perfil profissional de uma pessoa | `/quem Adriana Silva, Banco Inter` |
| `/definir [termo]` | Definição técnica concisa (2–3 parágrafos) | `/definir RAG` |
| `/resumir` | Resume o conteúdo da nota atual em bullet points | `/resumir` |
| `/flashcard` | Gera até 3 flashcards P:/R: baseados na nota | `/flashcard` |
| `/opiniao [tema]` | Resposta opinativa e direta | `/opiniao usar RAG vs fine-tuning` |
| `/deepsearch [tema]` | Pesquisa aprofundada e estruturada com subtópicos | `/deepsearch attention mechanism` |
| `/tabela [tema]` | Resposta formatada como tabela markdown | `/tabela comparar REST vs GraphQL` |
| `/conectar` | Identifica conexões entre conceitos na nota | `/conectar` |

### Como funciona o parser (CodeMirror 6)

1. O editor detecta linhas que começam com `/` em tempo real
2. Mostra autocomplete com os comandos disponíveis
3. Ao pressionar `Enter` em uma linha de comando válida:
   - O comando é marcado visualmente na nota (cor diferente)
   - O hook `useCommands` é chamado com `{ cmd, query, noteContext, ragContext }`
   - A resposta chega em streaming no `AiPanel`

```typescript
// src/lib/commands.ts

export interface CommandContext {
  cmd: string
  query: string
  noteContent: string       // conteúdo atual da nota (últimos 2000 chars)
  ragChunks?: RagChunk[]    // chunks relevantes se houver PDF indexado
}

export async function executeCommand(
  ctx: CommandContext,
  onChunk: (text: string) => void
): Promise<void> {
  const systemPrompt = buildSystemPrompt(ctx)
  const userMessage = buildUserMessage(ctx)
  await streamFromAnthropic(systemPrompt, userMessage, onChunk)
}
```

---

## RAG — fluxo completo

```
PDF/TXT carregado pelo usuário
        ↓
  pdf.js extrai texto
        ↓
  split em chunks de ~512 tokens com overlap de 50
        ↓
  Transformers.js gera embedding de cada chunk
  (modelo: Xenova/all-MiniLM-L6-v2, roda localmente)
        ↓
  chunks + embeddings salvos no SQLite
        ↓
  usuário usa /definir, /deepsearch, etc.
        ↓
  query → embedding → cosine similarity → top-K chunks
        ↓
  chunks relevantes injetados no system prompt da IA
```

### Código base do RAG

```typescript
// src/lib/rag.ts

import { pipeline } from '@xenova/transformers'

let embedder: any = null

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  return embedder
}

export async function embedText(text: string): Promise<Float32Array> {
  const model = await getEmbedder()
  const output = await model(text, { pooling: 'mean', normalize: true })
  return output.data
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] ** 2
    normB += b[i] ** 2
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function chunkText(text: string, size = 512, overlap = 50): string[] {
  const words = text.split(' ')
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(' '))
    if (i + size >= words.length) break
  }
  return chunks
}
```

---

## Visual e identidade

### Inspiração
A estética do app bebe da pintura impressionista de Monet — não literalmente (sem nenúfares na UI), mas nos **princípios**: difusão suave de luz, cores que se dissolvem, a sensação de algo sendo capturado no momento exato antes de desaparecer.

### Tema
Escuro exclusivo, estilo editor de código — mas com toques impressionistas sutis: acentos em tons que evocam as paletas de Monet (lilás, teal, âmbar dourado).

- **Fonte:** `JetBrains Mono` para o editor; `system-ui` para UI
- **Paleta base:**
  - Background: `#0e0e10` (app), `#161618` (sidebar/panels)
  - Superfícies: `#1e1e22`, `#26262c`, `#2e2e36`
  - Texto: `#e8e8f0` (primário), `#a0a0b8` (secundário), `#606070` (muted)
  - Acento principal: `#7c6af5` (lilás — violeta impressionista)
  - Acento IA: `#5dcaa5` (teal — água dos nenúfares)
  - Acento aviso: `#ef9f27` (âmbar dourado — luz da tarde em Giverny)
  - Borda: `#333340`

### Nome do app na UI
`monet` — sempre em minúsculas, sem tagline. A elegância está na simplicidade.

### Layout principal (3 colunas)

```
┌──────────────────────────────────────────────────────┐
│ titlebar: [dots] monet       [export .md] [preview]  │
├──────────────┬───────────────────────┬───────────────┤
│   sidebar    │       editor          │   ai panel    │
│   200px      │       flex: 1         │   300px       │
│              │                       │  (toggle off) │
│ lista notas  │  CodeMirror 6         │               │
│ busca        │  markdown highlight   │  stream cards │
│ tags         │  /cmd highlight       │  por comando  │
│              │                       │               │
├──────────────┴───────────────────────┴───────────────┤
│ cmd bar: [/pesquisa] [/definir] ...    [+ subir PDF] │
└──────────────────────────────────────────────────────┘
```

---

## Funcionalidades do MVP (fase 1)

- [ ] Setup Tauri 2 + React + TypeScript + Vite
- [ ] Editor CodeMirror 6 com highlight de markdown
- [ ] Parser de `/comandos` com autocomplete
- [ ] Streaming de respostas via Anthropic SDK
- [ ] AiPanel com toggle (abrir/fechar)
- [ ] Sidebar com lista de notas, busca, criação
- [ ] Persistência de notas no SQLite local
- [ ] Upload de PDF/TXT como contexto (sem RAG ainda)
- [ ] Preview de markdown (toggle)
- [ ] Exportar nota como `.md`
- [ ] Build `.msix` para Windows

## Funcionalidades da fase 2

- [ ] RAG completo com Transformers.js + embeddings no SQLite
- [ ] Web search integrado como tool call da IA
- [ ] Tags e organização por tema
- [ ] Modo flashcard (revisão das notas)
- [ ] Publicação na Microsoft Store

## Funcionalidades da fase 3

- [ ] `storage.ts` implementação browser (IndexedDB)
- [ ] Webapp React puro (sem Tauri) reaproveitando tudo
- [ ] Sync opcional na nuvem (Supabase ou similar)
- [ ] Build para Mac e Linux

---

## Como iniciar o desenvolvimento

```bash
# Pré-requisitos
# - Node.js 20+
# - Rust (rustup)
# - VS Build Tools (Windows) para Tauri

# 1. Criar projeto Tauri + React
npm create tauri-app@latest monet -- --template react-ts
cd monet

# 2. Instalar dependências frontend
npm install @codemirror/view @codemirror/state @codemirror/lang-markdown
npm install @anthropic-ai/sdk
npm install @xenova/transformers
npm install pdfjs-dist
npm install unified remark-parse remark-rehype rehype-stringify
npm install nanoid

# 3. Instalar plugin SQL do Tauri
npm install @tauri-apps/plugin-sql
# adicionar ao Cargo.toml: tauri-plugin-sql = { features = ["sqlite"] }

# 4. Rodar em dev
npm run tauri dev
```

---

## Contexto do protótipo

Um protótipo funcional foi desenvolvido como widget interativo com:
- Editor de texto com parser de `/comandos` em tempo real
- Autocomplete de comandos ao digitar `/`
- Painel de IA com streaming real via Anthropic API
- Sidebar com lista de notas e busca
- Toggle do painel IA
- Upload de PDF como contexto
- Preview markdown
- Exportar `.md`
- Tema escuro com fonte monoespaçada

O protótipo valida a UX central: o usuário anota livremente e usa `/comandos` para acionar a IA sem sair do editor. As respostas chegam em streaming em um painel lateral organizado por comando.

---

## Decisões de design importantes

**Por que Tauri e não Electron?**  
Bundle ~10MB vs ~150MB. Performance nativa. Gera `.msix` nativamente para Microsoft Store. Segurança melhor (Rust backend com permissões explícitas).

**Por que RAG local e não sempre mandar tudo para a API?**  
PDFs acadêmicos podem ter 50–200 páginas. Mandar tudo para a API é caro e lento. Com RAG local, apenas os chunks mais relevantes para cada `/comando` são incluídos no contexto.

**Por que `storage.ts` como abstração?**  
O objetivo é ter webapp no futuro sem reescrever nada. Toda a lógica de produto fica em React. Só a implementação da interface de storage muda entre Tauri e browser.

**Por que CodeMirror 6 e não um textarea simples?**  
O parser de `/comandos` precisa de controle fino sobre o texto (decorações, posição do cursor, autocomplete). CodeMirror 6 tem uma API de extensões moderna que permite isso de forma limpa.