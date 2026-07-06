# Proposta de fases para implementação do ebook reader

Proposta de fases

* \[x] Fase 1 — Biblioteca + Leitor básico (a fundação)
* Terceiro modo no Toolbar: Library. Tela com tabela de livros: título, autor, páginas, progresso (última página lida), data de adição, último acesso. Botão de importar PDF (reusa o file dialog do backend).
* Ao importar, copiar o PDF para o diretório do app (evita link quebrado se o usuário mover o arquivo) e criar registro numa tabela books no SQLite.
* Clicar no livro abre o leitor: renderização com pdfjs (canvas + text layer), navegação de páginas, zoom, e memória da última página lida por livro.
* \[ ] Fase 2 — Grifos e citações (o trabalho do leitor)
* Seleção de texto → grifar (highlight persistido: livro, página, texto, posição, cor, created\_at — a data é essencial para o contexto da IA depois).
* Seleção → copiar citação para caderno: modal para escolher caderno/nota (dá para reusar o padrão do SaveToNoteModal do chat), inserindo como blockquote com fonte e página.
* Painel lateral listando os grifos do livro (clicar navega até a página).
* \[ ] Fase 3 — Chat de leitura (a IA como auxiliar)
* Coluna direita com chat, toggle igual à tela de notas. Reusa useChat com pasta por livro.
* Contexto dinâmico injetado a cada mensagem (não no system prompt da pasta, porque muda o tempo todo):  
\[READING CONTEXT]  
Livro: X — página 142 de 300  
Texto da página atual: ...  
Grifos recentes (do mais novo ao mais antigo, com datas): ...  
Citações copiadas recentemente: ...
* Isso exige uma extensão pequena no send() do useChat (um parâmetro opcional de contexto efêmero) — é a única mudança real no motor do chat.
* RAG sobre o livro inteiro: como o livro foi indexado na KB no import, perguntas tipo "o que o autor disse sobre X lá atrás" funcionam via documentsSearchByIds restrito àquele livro.
* \[ ] Fase 4 — Refinamentos
* "Perguntar à IA" direto da seleção (botão flutuante → createPreloadedChatConversation com o trecho).
* Sumário/outline do PDF para navegação; busca dentro do livro.
* Sessões de leitura no calendário: nota automática "li páginas X–Y de Livro" — conecta com o pilar da constância da visão de produto.

Dois pontos que merecem sua decisão

Clipboard: em vez de ler o clipboard do sistema operacional (que pode conter qualquer coisa — senha, mensagem pessoal, código de outro projeto), sugiro rastrear as cópias feitas dentro do leitor (evento de copy na seleção). O sinal é muito mais limpo e evita vazar conteúdo alheio para a IA. O efeito para o usuário é o mesmo: "copiei um trecho, a IA sabe".

PDFs escaneados: sem camada de texto, seleção/grifo não funcionam (o backend já detecta esse caso hoje: "PDF has no extractable text"). Sugiro tratar como limitação declarada da v1 — OCR fica fora do escopo inicial.

