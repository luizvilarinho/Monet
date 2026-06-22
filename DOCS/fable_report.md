# Relatório de Análise Geral — Monet

> Autor: Claude (Fable 5) · Data: 2026-06-11 · Versão analisada: 1.3.12
> Escopo: revisão de consistência, bugs funcionais e segurança de dados do usuário.
> Método: leitura estática do backend Rust (`src-tauri`), frontend React (`src`),
> configuração Tauri, capabilities, histórico git e endpoints públicos.

---

## TL;DR

O Monet é um app sólido e bem arquitetado para a fase em que está: o backend Rust
trata erros com cuidado, valida tipos de arquivo/tamanho, usa transações no SQLite e
sanitiza a maior parte do HTML renderizado. **Porém há um problema de segurança grave
que precisa de ação imediata:** a chave privada de assinatura do auto-updater está
commitada num repositório GitHub **público**. Isso, no pior caso, permite a um atacante
forjar atualizações maliciosas que se instalam sozinhas na máquina dos usuários.

Abaixo, os achados em ordem de severidade.

---

## 🔴 CRÍTICO

### C1. Chave privada de assinatura do updater commitada em repositório público

**Evidência:**
- `git ls-files` lista `~/.tauri/monet.key` e `~/.tauri/monet.key.pub` como arquivos versionados.
- A chave entrou no histórico no commit `0f72a8b` ("fix: scroll do chat e auto-update").
- O repositório `https://github.com/luizvilarinho/Monet` responde **HTTP 200 público**
  (página e endpoint de releases acessíveis sem autenticação).
- `tauri.conf.json` configura o updater com `pubkey` correspondente e endpoint
  `github.com/luizvilarinho/monet/releases/latest/download/latest.json`.
- O `.gitignore` ignora `/AI`, `/worktree`, `.claude` e `latest.json`, mas **não** ignora `~/`.

**Por que é grave:**
O auto-updater do Tauri instala qualquer release cuja assinatura bata com a `pubkey`
embutida no app. A chave privada (`monet.key`) é o único segredo que impede um terceiro
de assinar um instalador falso. Ela está protegida por senha (formato `rsign encrypted
secret key`), mas estar num repo público significa que qualquer pessoa pode baixá-la e
fazer **brute-force offline da senha sem limite de tentativas**. Se a senha for fraca ou
vazar, o atacante assina um `.msi` malicioso, publica num `latest.json` e — para qualquer
usuário cujo updater aponte para um endpoint que o atacante controle — o malware se
instala com a confiança do app.

**Ação recomendada (nesta ordem):**
1. **Rotacionar a chave já.** Gere um novo par (`tauri signing generate`), troque a `pubkey`
   no `tauri.conf.json` e publique uma nova versão assinada com a nova chave. A chave antiga
   deve ser considerada comprometida.
2. **Remover do histórico do git**, não só do HEAD: use `git filter-repo` (ou BFG) para
   apagar `~/.tauri/monet.key` e `.key.pub` de todos os commits, depois `push --force`.
   Apagar só no próximo commit não adianta — o arquivo continua acessível no histórico.
3. **Adicionar ao `.gitignore`:** `~/` e `*.key` (a entrada atual não cobre a pasta `~`).
4. Guardar a nova chave fora do repo (gerenciador de segredos / variável de ambiente de CI).
   O `package.json` já lê a senha de `$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — mantenha
   só o caminho do arquivo fora da árvore versionada.
5. Considerar tornar o repositório **privado** enquanto não houver razão para ele ser público.

> Observação: como a distribuição principal é a Microsoft Store (que reassina o pacote MSIX
> com a identidade do Partner Center), o vetor do updater do Tauri afeta sobretudo quem instala
> via `.msi`/NSIS direto do GitHub. Ainda assim, a chave vazada é um problema que precisa ser
> resolvido independentemente do canal.

---

## 🟠 ALTO / MODERADO

### A1. HTML não sanitizado ao renderizar nota vinculada (XSS → IPC)

**Evidência:**
- `src/lib/markdown.ts` tem dois pipelines: `renderMarkdown` (com `rehype-sanitize`, seguro)
  e `renderNoteContent` (com `allowDangerousHtml: true`, **sem sanitização**).
- `renderNoteContent` alimenta `dangerouslySetInnerHTML` em
  `src/components/Editor/LinkedNoteBlockView.tsx:75`.

**Risco:**
O conteúdo de uma nota pode conter HTML bruto (o usuário cola texto da web, ou cola uma
resposta de IA que inclui `<img src=x onerror=...>`, ou usa o bloco toggle que serializa
`innerHTML`). Quando essa nota é exibida como **nota vinculada** dentro de outra, o HTML é
injetado sem filtro. No webview do Tauri, JavaScript injetado tem acesso ao bridge IPC e
pode invocar comandos do backend (ler/escrever arquivos via `save_chat_doc`, etc.). Os
painéis de chat e o `AiCard` usam o pipeline **sanitizado** — só o caminho de nota vinculada
é perigoso.

**Ação:** usar o mesmo `rehype-sanitize` no `renderNoteContent`, ou ao menos passar o HTML
por um sanitizador (DOMPurify) antes do `dangerouslySetInnerHTML`. Se a intenção é permitir
embeds legítimos, criar uma allowlist explícita de tags/atributos em vez de `allowDangerousHtml`.

### A2. `save_chat_doc` não valida path traversal (escrita arbitrária de arquivo)

**Evidência (`src-tauri/src/lib.rs:217-225`):**
```rust
let file_path = docs_dir.join(&filename);   // filename vem do frontend, sem validação
std::fs::write(&file_path, &content)...
```
Compare com `read_chat_doc` (linha 228) e `delete_chat_doc` (linha 244), que **canonicalizam
o path e verificam `starts_with(canonical_docs)`**. O `save_chat_doc` não faz isso.

**Risco:** `PathBuf::join` com um caminho absoluto ou com `..\..\` escapa do diretório
`chat-docs`. O frontend sempre passa `${nanoid()}.txt`, mas o comando é exposto ao webview —
combinado com o A1 (XSS), vira primitiva de **escrita arbitrária de arquivo**.

**Ação:** aplicar a mesma validação de `read_chat_doc`/`delete_chat_doc` — rejeitar `filename`
que contenha separadores de path, ou canonicalizar o destino e exigir `starts_with(docs_dir)`.

### A3. Conversas de chat ficam 100% em `localStorage` — perda silenciosa de dados

**Evidência:**
- Notas/cadernos/respostas vão para SQLite (`storage/tauri.ts`), mas **todo o histórico de chat**
  (conversas, pastas, ordem) vive em `localStorage` — `useChat.ts:89-96`, `saveConversations`
  (linha 270).
- `saveConversations` engole erros: `catch (err) { console.error(...) }` (linha 286).

**Risco:** `localStorage` tem cota de ~5 MB. Conversas longas, especialmente com resultados de
web search/deep research embutidos no histórico, crescem rápido. Quando a cota estoura, o
`setItem` lança `QuotaExceededError`, que é apenas logado no console — **o usuário perde a
conversa sem nenhum aviso**, e a UI continua como se tivesse salvado. Isso é uma
inconsistência arquitetural (notas são duráveis, chats não) e um bug funcional real.

**Ação:** migrar o armazenamento de conversas de chat para SQLite (uma tabela `chats`/`chat_messages`),
como já é feito para notas. No mínimo, detectar `QuotaExceededError` e avisar o usuário.

---

## 🟡 BAIXO / QUALIDADE

### B1. Código morto: `src/lib/rag.ts` + dependência `@xenova/transformers`

`src/lib/rag.ts` implementa embeddings client-side com `@xenova/transformers`
(`all-MiniLM-L6-v2`, 384 dim). **Nada importa esse arquivo** — o `embedText` realmente usado
em `App.tsx` e `useChat.ts` vem de `lib/documents.ts` (backend, OpenRouter,
`text-embedding-3-small`, 768 dim). O `@xenova/transformers` é uma dependência pesada baixada
no bundle sem uso. Pelo princípio de remoção de dead code do projeto, vale apagar `rag.ts` e
remover a dependência do `package.json`.

### B2. Artefato `encoded.txt` versionado

`encoded.txt` (150 KB, UTF-16, conteúdo de bytes em hex que decodifica para um trecho de
código) está rastreado no git e parece ser lixo de alguma iteração. Remover do repo e adicionar
ao `.gitignore`.

### B3. Tavily key é exposta ao contexto JavaScript

Diferente da OpenRouter key (que nunca sai do Rust — todas as chamadas são proxied pelo backend),
a Tavily key é lida via `get_tavily_key` e usada **direto no `fetch` do frontend** (`lib/search.ts`).
Isso significa que a chave fica acessível no contexto do webview e seria exfiltrável caso o A1
(XSS) seja explorado. Não é crítico (a Tavily key é de menor valor e revogável), mas o ideal é
fazer as chamadas Tavily também pelo backend, como já é feito para OpenRouter — fechando o
padrão e tirando o segredo do alcance do JS.

### B4. Chaves de API em texto puro no disco

`save_key`/`read_key` (`lib.rs:141`) gravam as chaves como arquivos de texto puro em
`app_config_dir`. É o padrão de muitos apps desktop, mas no Windows há a opção de proteger via
DPAPI (`CryptProtectData`), que cifra os dados com a credencial do usuário do SO. Melhoria de
defesa em profundidade, não urgente.

### B5. `monet.db` aberto por duas conexões independentes

O mesmo arquivo `monet.db` é aberto pelo `tauri-plugin-sql` (frontend) e por uma conexão
`rusqlite` separada (`DocDb`, backend). O WAL mitiga, e o comentário no topo de `documents.rs`
documenta o invariante (frontend só lê documentos, nunca escreve). Funciona, mas é frágil:
sob contenção, dois pools distintos no mesmo arquivo podem gerar `database is locked`. Manter o
invariante bem vigiado; se aparecer lock no futuro, considerar unificar o acesso.

### B6. Imagens somem do chat ao recarregar

`saveConversations` remove `imageDataUrl` antes de persistir (`useChat.ts:274-278`) — decisão
deliberada para não estourar a cota do localStorage. O efeito colateral é que, ao reabrir uma
conversa, mensagens que tinham imagem mostram só o texto, sem a imagem. Se o B3/A3 forem
resolvidos migrando chat para SQLite + filesystem (como os docs anexados já fazem), dá para
persistir as imagens também.

### B7. `window.prompt` para criar caderno/assunto e inserir link

`App.tsx:638`, `App.tsx:689` e `FormattingToolbar.tsx:138` usam `window.prompt`. Funciona no
webview, mas é inconsistente com o resto do app (que tem `ConfirmModal`/modais próprios) e o
visual do prompt nativo destoa. Cosmético.

---

## ✅ Pontos fortes observados

Para equilibrar — coisas que estão bem feitas e que vale **não** regredir:

- **Tratamento de erro no backend Rust** é consistente: `pdf_extract` roda em
  `spawn_blocking` com captura de panic, validação de tipo/tamanho de arquivo (50 MB),
  rejeição de arquivos vazios e mensagens de erro claras para o usuário.
- **Backoff exponencial com jitter** nos embeddings (HTTP 429) evita thundering herd.
- **Transações SQLite** no armazenamento de chunks e no reindex, com proteção contra
  duplo-clique em "retentar" (checa status `indexing` atomicamente).
- **`read_chat_doc`/`delete_chat_doc`** validam path traversal corretamente (só o
  `save_chat_doc` ficou de fora — ver A2).
- **`is_valid_model_id`** valida o identificador de modelo antes de enviar à API.
- **CSP restritiva** em `tauri.conf.json`: `connect-src` limitado a `openrouter.ai` e
  `api.tavily.com`; bloqueio de IPs privados/loopback nas imagens de markdown
  (`markdown.ts`, `BLOCKED_PATTERNS`) — boa defesa contra SSRF via imagem.
- **`is_external`** preserva arquivos do usuário em watched folders (não apaga o original do disco).
- A maior parte da renderização de markdown passa por `rehype-sanitize`.

---

## Plano de ação sugerido (prioridade)

| # | Ação | Severidade | Esforço |
| - | ---- | ---------- | ------- |
| 1 | Rotacionar chave do updater + remover do histórico git + tornar repo privado | 🔴 Crítico | Médio |
| 2 | Sanitizar `renderNoteContent` (A1) | 🟠 Alto | Baixo |
| 3 | Validar path em `save_chat_doc` (A2) | 🟠 Alto | Baixo |
| 4 | Migrar histórico de chat para SQLite (A3) | 🟠 Moderado | Alto |
| 5 | Mover chamadas Tavily para o backend (B3) | 🟡 Baixo | Médio |
| 6 | Remover `rag.ts` + `@xenova/transformers` + `encoded.txt` (B1/B2) | 🟡 Baixo | Baixo |
| 7 | DPAPI para chaves (B4) | 🟡 Baixo | Médio |

Os itens 1, 2 e 3 são rápidos (exceto a parte de filtrar o histórico git) e fecham os
vetores mais sérios. O item 4 é o maior, mas elimina a perda silenciosa de dados de chat —
provavelmente o bug funcional que mais impacta um usuário real do app hoje.
