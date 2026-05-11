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
| Banco local | **SQLite** via `tauri-plugin-sql` (`monet.db`) + `rusqlite` direto (`monet-vec.db`) | Notas/cadernos no plugin, vetores em arquivo separado com `sqlite-vec` |
| RAG | **OpenRouter** (`google/gemini-embedding-2-preview`, 768 dim) + **`sqlite-vec`** | Embeddings via API; KNN local em SQLite virtual table `vec0` |
| PDF parsing | **`pdf-extract`** (Rust) | Extração no backend, sem dependência de DOM |
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
│   │   ├── useDocuments.ts     # Lista de documentos por caderno + eventos de status
│   │   └── useCommands.ts      # Execução de /comandos
│   │
│   ├── lib/
│   │   ├── anthropic.ts        # Cliente Anthropic configurado
│   │   ├── rag.ts              # Pipeline RAG: chunk → embed → search
│   │   ├── commands.ts         # Definições e handlers dos /comandos
│   │   └── markdown.ts         # unified pipeline
│   │
│   └── types/
│       └── index.ts            # Note, Command, AiResponse, AiSource, Document...
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── MONET_PROJECT.md            # este arquivo
```

---