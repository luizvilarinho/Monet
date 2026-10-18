# Estudo de mercado 04: ferramentas de leitura, estudo e aprendizado profundo

**Data:** 2026-10-17 · **Para:** Monet (app desktop Windows, local-first, grátis, IA via BYOK) · **Persona:** autodidata em aprofundamento de longo prazo, com duas atividades centrais: fichamento de livro e acompanhamento de curso.

**Escopo:** cerca de 55 produtos em seis grupos (leitura e highlights; PDF comercial; PDF/PKM de pesquisa e tablet; SRS; estudo com IA e pesquisa acadêmica; cursos, aulas e vídeo), mais métodos de estudo × suporte das ferramentas e lacunas de mercado.

**Método:** pesquisa web em sete frentes paralelas, todas em 2026-10-17, priorizando sites oficiais (pricing, changelog, help center), lojas (App Store, Microsoft Store), notícias de 2025–2026 e fóruns oficiais. Seis afirmações de alto impacto foram reconferidas na fonte na montagem do relatório:
- Zotero 10 lançado em 17/08/2026, com Reading Mode.
- GPT-6 Luna como modelo padrão dos resumos do Ghostreader desde 25/09/2026.
- Auto-summary do Reader ligado por padrão para documentos salvos.
- Nome "Gemini Notebook" na central de ajuda do antigo NotebookLM.
- Post "Anki's Growing Up" (02/02/2026).
- Acordo Coursera–Udemy (dez/2025).

**Limitações:**
1. A cota de buscas web da sessão acabou no meio da coleta; daí em diante as frentes seguiram só com acesso direto a URLs conhecidas.
2. O Reddit ficou inacessível. O sentimento de usuários vem de fóruns oficiais (Zotero, Obsidian, MarginNote, Anki), App Store, Trustpilot, AlternativeTo, Product Hunt e reviews.
3. Alguns sites bloquearam o acesso (SciSpace, Scholarcy, Udemy, páginas da OpenAI e da Amazon). O que dependia deles está marcado [não verificado].
4. Os preços estão em USD, como exibidos para os EUA ou na App Store dos EUA, e podem variar por região e por canal.

## (a) Resumo executivo

**1. O ciclo que o Monet persegue não existe pronto no Windows.** O ciclo é ler → grifar → nota ligada à página → elaborar → revisar → voltar ao texto. Quem chega mais perto ou está fora do Windows ou cobra em outra dimensão:
- **MarginNote 4:** cada grifo é ao mesmo tempo card, nó de mapa mental e flashcard com FSRS, com link bidirecional à página. Só existe na Apple.
- **LiquidText:** é o único leitor "de pensamento" no Windows, mas não tem revisão, recebe queixas de lentidão e cobra por multi-documento e sync.
- **RemNote:** a referência do grifo volta ao ponto exato do PDF e há flashcards inline. Em troca, exige conta, converte EPUB para PDF e empurra o "Learn PDF", em que a IA resume e gera os cards.
- **Heptabase:** tem Highlight Cards e whiteboards, mas roda em nuvem, custa US$ 8,99–53,99/mês, não tem SRS nem EPUB, e a IA faz a decomposição pelo usuário (AI Tutor, "Break down book").
- **SuperMemo 20:** incremental reading nativo e compra única de US$ 68, mas a UX é notoriamente hostil.
- **Zotero 10:** grátis e aberto, com anotação → nota e "Show on Page". Não tem IA nativa nem revisão.

Há espaço para um posicionamento claro: "o MarginNote do Windows", grátis, local-first e com IA convocada.

**2. IA ancorada com citação virou requisito mínimo, não diferencial.** Exemplos de 2025–2026:
- **Readwise Reader:** o Ghostreader v3 conversa com contexto da posição de leitura, cita e linka o trecho e fica "within what you've read". O Global Ghostreader (ago/2026) estende isso à biblioteca inteira.
- **Kindle:** Recaps, Story so Far e Ask this Book (dez/2025), sem spoiler.
- **NotebookLM:** renomeado Gemini Notebook em 16/07/2026, com flashcards e quizzes ancorados nas fontes e mais de 30 milhões de usuários.
- **Leitores e suítes de PDF:** PDF Expert Copilot, Acrobat AI Assistant/PDF Spaces e Foxit, com citação que volta ao ponto exato da fonte.
- **Acadêmico:** Consensus Citation Grounding e Ai2 Asta.

Consequência: o chat lateral do livro do Monet (página atual + grifos + RAG) acompanha o padrão de mercado, mas precisa de citação clicável que abra a página e o grifo, e de escopo "até onde li". Sozinho, não diferencia.

**3. O mercado de estudo foi para o polo oposto à tese do Monet.** A IA que resume, gera cards e "estuda pelo aluno" domina: Quizlet, Knowt, StudyFetch, Mindgrasp, Otter (study guides e quizzes, ago/2026), Recall 2.0, os insight cards do Acrobat PDF Spaces, o AI Tutor da Heptabase, o Learn PDF do RemNote e o "AI Book Breakdown" do MarginNote. Quiz e flashcards por IA viraram commodity (Goodnotes, Notability, PDF Expert, Foxit Skills, Gemini Notebook).

As big techs lançaram modos socráticos, todos como toggle que o usuário desliga:
- ChatGPT Study Mode (29/07/2025);
- Gemini Guided Learning (06/08/2025);
- Claude learning mode (14/08/2025 para todos).

Isso legitima a ideia de "IA como meio". A evidência também sustenta a tese:
- Dunlosky et al. (2013) dão "high utility" a practice testing e distributed practice, e "low" a grifar, reler e resumir.
- Em Bastani et al. (PNAS, 2025), o GPT-4 sem salvaguardas melhorou a prática em 48%, mas a nota na prova sem IA ficou 17% abaixo do controle. A versão tutor, com salvaguardas, mitigou boa parte do dano.

Alinhados à tese: Hypothesis ("AI Resistant Learning"), MarginNote (o usuário aceita, edita ou rejeita; BYOK; dicas on-device), SuperMemo (explicação ao extrair) e Zotero/Obsidian (IA só por plugin, com chave própria).

**4. A maior lacuna funcional do Monet é a revisão, que virou item básico do mercado.** O FSRS é o algoritmo comum:
- Anki: desde a 23.10; FSRS-6 na 25.07.
- RemNote: em beta.
- Mochi e MarginNote 4.
- Plugin Spaced Repetition do Obsidian: FSRS desde mai/2026.
- SuperMemo 20: roda o FSRS ao lado do SM-20.

Até o Quizlet lançou Spaced Repetition (ago/2026). Mesmo assim, quase ninguém revisa *grifos* no contexto do livro, exceto o Readwise (Daily Review + Mastery, US$ 9,99/mês no anual). Opções coerentes com a tese, da mais barata à mais cara:
1. Ressurgimento espaçado de grifos e notas na nota diária do Calendar, no padrão Readwise/Snipd.
2. Modo Recall que borra grifos e citações e revela no clique, como no MarginNote 4.4.
3. Perguntas e clozes escritos pelo usuário, agendados com FSRS. A crate fsrs-rs, a mesma do Anki, encaixa no backend Tauri.
4. /quiz convocado sobre os grifos e notas do próprio usuário, com resposta digitada e correção que cita a página.
5. Export para o Anki (CSV/.apkg com campo "Fonte").

**5. Grifos presos são a porta de entrada mais barata.**
- O Kindle trunca o export em cerca de 10–20% do livro (limite das editoras), não tem API e só entrega documentos pessoais pelo My Clippings.txt. A Amazon também encerrou o "Download & Transfer via USB" em 26/02/2025.
- O Apple Books não existe no Windows e não tem export oficial.
- O Zotero guarda as anotações no próprio banco, não no PDF.
- O Readwise cobra para centralizar tudo isso.

Importar My Clippings.txt, CSV/Markdown do Readwise e anotações padrão de PDF feitas no tablet resolve o onboarding e parte da ponte tablet ↔ desktop, sem sync (que é não-meta do PRD).

**6. Local-first e export aberto viraram argumento de venda, não detalhe técnico.** Casos recentes de serviços que fecharam ou mudaram:
- Pocket: encerrado em 08/07/2025, dados apagados depois de 08/10/2025.
- Omnivore: fechou em nov/2024, deu cerca de 15 dias para exportar, e importadores como o do wallabag não trazem os grifos.
- Logseq: dividido em OG (congelado) e DB (beta).
- Traverse: parado.
- Obsidian: plugins de PDF sem release (PDF++ desde ago/2025, Annotator desde jan/2024), e o Media Extended v4 passou a ser closed source.
- Anki: gestão em transição para a AnkiHub (fev/2026).

Falta ao Monet a "garantia de saída": export completo e documentado (Markdown com citação, página e cor; PDF com anotações embutidas) e identificação de arquivos por hash, no padrão do Hypothesis.

**7. Privacidade, direitos e assinatura são dores reais.**
- O Ask this Book do Kindle fica "always on", sem opt-out para autores; a Authors Guild protestou em 23/12/2025.
- A Otter enfrenta ação coletiva (ago/2025) por gravação sem consentimento.
- Quase todo produto cobra créditos de IA: Heptabase, Goodnotes AI Pass, MarginNote, Foxit, Glasp.

O BYOK do Monet, o princípio "nada sai sem comando" e um provedor local opcional formam um diferencial. O Foxit já mostra IA local no Windows via Microsoft Foundry Local.

**8. Fichamento brasileiro e acompanhamento de curso são nichos pouco atendidos.**
- **Fichamento:** nenhum app internacional modela os tipos de fichamento (citação, resumo, comentário) nem gera a referência ABNT (NBR 6023/10520) na ficha. O Zotero cobre só a referência, via CSL.
- **Curso:** o padrão de mercado é nota com link de timestamp e screenshot (Obsidian Media Extended, Glasp, Snipo) ou gravação + transcrição + IA proativa (Otter, Notability, gravador de aulas do Gemini Notebook). Coursera e Udemy embutiram tutores de IA, mas as notas ficam presas à plataforma. A aquisição da Udemy pela Coursera foi anunciada em dez/2025, e em set/2026 a Coursera já fala em "combined company".

Atalhos coerentes com a tese: uma entidade "Curso" (módulos → aulas → sessões) ligada a Calendar e Tasks; citação no formato "curso → aula → tempo"; importar a transcrição .srt/.vtt como um "livro" na Library (grifo, busca e RAG sem ASR); template Cornell.

**9. Ameaças.**
- O Gemini Notebook oferece flashcards e quizzes ancorados de graça.
- O Readwise Reader tem app Windows, offline e Global Ghostreader.
- O Kindle deve levar o Ask this Book aos e-readers em 2026.
- A Heptabase entrega rápido para a mesma persona.

Nenhum deles oferece um caderno perene, local e grátis, ligado à página por meses, em que o usuário faz a elaboração.

### Concorrentes mais próximos do ciclo do Monet

| Concorrente | O que faz melhor que o Monet hoje | Onde o Monet tem espaço |
|---|---|---|
| MarginNote 4 | Grifo = card + nó de mapa + FSRS; modo Recall; IA que o usuário aceita/edita/rejeita; BYOK | Não roda no Windows; sync iCloud frágil; preço fragmentado |
| RemNote | Flashcards inline com FSRS (beta); referência do grifo volta ao ponto do PDF; app Windows | Exige conta; EPUB convertido para PDF; "Learn PDF" gera os cards; UI carregada |
| LiquidText | Workspace de excerpts ligados à fonte; app Windows | Sem revisão; lento no Windows; multi-documento e sync pagos; IA quase ausente |
| Heptabase | Highlight Cards reutilizáveis; whiteboards; integração com Readwise e Zotero | Nuvem; US$ 8,99–53,99/mês; IA elabora pelo usuário; sem SRS nem EPUB |
| Zotero 10 | Anotação → nota com citação e "Show on Page"; Reading Mode; grátis e aberto | Sem IA nativa e sem revisão; cara de gerenciador de referências |
| Readwise + Reader | Revisão de grifos (Daily Review, Mastery); Ghostreader com citações; app Windows | Nuvem e conta; US$ 9,99/mês; export unidirecional; Reader ainda em "beta" |
| SuperMemo 20 | Incremental reading nativo; SM-20 + FSRS; Windows; compra única | UX hostil; público "hardcore" |
| Gemini Notebook (ex-NotebookLM) | IA ancorada com citação clicável; flashcards e quizzes grátis | Não é leitor nem anotador; sem SRS; nuvem Google |

### Oportunidades que se repetem nas seções (a validar contra a tese e o PRD)
1. **Revisão ancorada no grifo.** Ver as opções do item 4. É a lacuna de maior evidência (retrieval practice e spacing).
2. **Citação clicável nas respostas da IA**, abrindo página e grifo, com escopo "até onde li" (ex.: /recap até aqui).
3. **Importadores e export aberto.** Importar My Clippings.txt, Readwise e anotações padrão de PDF; exportar tudo em Markdown e PDF anotado; identificar arquivos por hash.
4. **Fichamento pt-BR.** Tipos citação/resumo/comentário, referência ABNT no cabeçalho da nota do livro e export em ABNT.
5. **Curso.** Entidade Curso/sessões no Calendar; citação com timestamp; transcrição como fonte na Library; template Cornell.
6. **Livros técnicos e escaneados.** OCR local (Tesseract/OCRmyPDF) e recorte de região (fórmula, figura) como citação com página. Nenhum dos dois conflita com a tese.
7. **Privacidade explícita.** Mostrar o que sai da máquina em cada /comando e oferecer um provedor local opcional.
8. **Comandos que pedem esforço antes da resposta.** O usuário escreve a paráfrase e a IA critica citando a página; a IA pergunta em vez de responder. Uma fila de "grifos sem elaboração" completa o desenho.

### Lacunas desta pesquisa
- **Sentimento de usuários:** Reddit inacessível e cota de buscas esgotada, então há pouca voz direta de usuários de 2025–2026.
- **Preços sem confirmação oficial:** Consensus, SciSpace, Scholarcy, Mindgrasp, Coursera/Udemy e Traverse; também o preço mensal e o trial do Heptabase e o período de cobrança do PDF Expert.
- **Status de recursos:**
  - Ask this Book e Story so Far nos e-readers Kindle em out/2026;
  - IA atual do LiquidText e do Drawboard;
  - quiz no OneNote;
  - recursos do Galaxy AI no Samsung Notes;
  - data de lançamento do Notability no Windows;
  - flashcards no Logseq DB;
  - notas com timestamp e export no Udemy e no Coursera.
- **Dados quantitativos:** não há dados sobre fadiga de assinatura em apps de estudo, nem relatos específicos sobre OCR, fórmulas ou notas de curso.

## (b) Produtos por grupo

Cada produto segue a mesma grade de 10 itens: (1) posicionamento e público; (2) fluxo leitura → captura → nota → revisão; (3) como o highlight vira nota; (4) revisão/recall; (5) IA, se convocada ou proativa e se ancorada na fonte; (6) plataformas, offline, sync e formatos; (7) preço; (8) novidades 2025–2026; (9) forças, fraquezas e reclamações; (10) relevância para o Monet. Nos produtos marcados como "só o essencial" no pedido, os itens que não se aplicam aparecem como "n/a" ou fundidos.

Os códigos entre colchetes (ex.: [S1-3]) remetem à lista de fontes da seção (f). "[não verificado]" indica informação que não foi possível confirmar em fonte primária ou recente. Salvo indicação em contrário, preços e features foram conferidos em 2026-10-17.


### Leitura + highlights

O grupo tem três tipos de produto: (a) leitores com captura própria (Kindle, Apple Books, Readwise Reader, Matter); (b) camadas de anotação sobre web e PDF (Glasp, Hypothesis); (c) o "hub" de highlights com revisão (Readwise). Em 2025–2026 a tendência mais forte é a IA **ancorada na posição de leitura, sem spoiler e com citação do trecho**: Ghostreader v3 e Global Ghostreader no Reader; Recaps, Story so Far e Ask this Book no Kindle. A revisão de highlights segue quase exclusiva do Readwise (Daily Review/Mastery). Os encerramentos do Omnivore (nov/2024) e do Pocket (jul/2025) mostraram o risco de guardar anos de acervo num serviço em nuvem.

#### Readwise (hub de highlights + revisão)

**1. Posicionamento e público:** "hub" que junta highlights de Kindle, Apple Books, Reader, Twitter, Snipd, livros físicos (OCR/scan), CSV e e-mail, e os ressurfaça para retenção [S1-10]. Atende leitores intensivos e usuários de PKM (Obsidian, Notion etc.).

**2. Fluxo leitura → captura → nota → revisão:** a leitura acontece fora do Readwise (Kindle, Apple Books, Reader, papel). A captura é por sync automático (extensão que lê o Kindle Notebook; ferramenta Mac para Apple Books), por scan de marcações a caneta em livro de papel ou por voz (Readwise 2.0, jul/2026). A nota é feita com tags, notas por highlight e "Chat with Highlights". A revisão usa Daily Review, Themed Reviews e Mastery [S1-3][S1-4][S1-11].

**3. Highlight → nota:** o export é **unidirecional e append-only**. No Obsidian, o plugin oficial avisa que "nothing in Obsidian will ever be overwritten", mas edições feitas lá não voltam ao Readwise. Usa templates Jinja2 e inclui link para a localização original quando ela existe (no Kindle, o link abre o app na *location*) [S1-8]. Outros destinos: Notion, Logseq, Roam, Evernote, Apple Notes, Markdown/CSV [S1-9]. O changelog acrescenta Craft (abr/2025), OneNote (ago/2025), Capacities (nov/2025), Reflect e Google Docs [S1-3]. Do Kindle só vem a *location*, sem número de página [S1-11].

**4. Revisão/recall:**
- Daily Review diário (e-mail e app); o feedback do usuário ajusta a frequência, que também pode ser regulada por livro.
- Themed Reviews com agenda (dias úteis, fins de semana, mensal…) e Audio Reviews (jun/2025) [S1-3].
- **Mastery** transforma o highlight em cloze ou Q&A, com repetição espaçada. O usuário não escolhe intervalos: responde "soon/later/someday/never" [S1-7].

**5. IA:**
- Convocada: "Chat with Highlights" (jan/2025).
- Proativas, mas desligáveis: "Automated Themed Reviews" escolhidas por IA (jun/2025) e "Themed Connections" (lote semanal temático; recomenda 150+ highlights) [S1-3][S1-5].
- ChatGPT Copilot: extensão que extrai ideias de conversas [S1-5].
- MCP (abr/2025) e MCP + CLI + Skills oficiais (mar/2026), para Claude, ChatGPT, Perplexity e outros [S1-3][S1-4].
- Cards de Mastery não são gerados por IA de forma nativa; existe um workflow com Ghostreader e a tag `.qa` [S1-7].

**6. Plataformas, offline, sync, formatos:** web, iOS e Android, com sync em nuvem e conta obrigatória. **Windows: só via web e extensão**; não há app nativo do Readwise, mas o Reader tem app desktop [S1-14][S1-15]. Offline do Readwise [não verificado].

**7. Preço:** verificado em 2026-10-17 em readwise.io/pricing [S1-1]:
- Lite: US$ 5,59/mês no anual (Daily Review e busca).
- Full: US$ 9,99/mês no anual (US$ 119,88/ano) ou US$ 12,99 no mensal; inclui o Reader.
- Trial de 30 dias; 50% de desconto para estudantes e acadêmicos.
- Na App Store os valores diferem (Full anual a US$ 94,99 e a US$ 119,99) [S1-17].

**8. Novidades 2025–2026:**
- 2025: Chat with Highlights (jan); MCP (abr); Audio Reviews e Themed Reviews por IA (jun); Themed Connections, webhooks e ChatGPT Copilot (nov–dez).
- 2026: MCP/CLI oficiais (mar); **Wikiwise** (abr), app Mac experimental de wiki Markdown local com agente de IA; **Readwise 2.0** (jul), apps móveis reconstruídos com scan, voz e chat; e-mails redesenhados (set) [S1-3][S1-4].

**9. Forças, fraquezas e reclamações recorrentes:**
- Forças: o maior ecossistema de import/export; hábito diário com *streaks*. Reviews da App Store de 2025 elogiam a retenção, a Audio Review e o chat com IA [S1-17].
- Preço recorrente: "$100/year is WAY too much" (review de 2021) [S1-17]. Sync de highlights de PDF foi criticado em 2021 [S1-17].
- Export unidirecional [S1-8].
- Dependência do Kindle, que não tem API [S1-11].
- Crítica conceitual: cloze sobre highlight gera menos compreensão que perguntas elaboradas pelo leitor [S1-19].

**10. Relevância para o Monet:**
- O que se paga no Readwise é a **camada de revisão**. O Monet pode ressurfaçar grifos localmente e oferecer cards cloze/Q&A **escritos pelo usuário**, coerente com a tese de esforço próprio.
- Importar o CSV/Markdown do Readwise e o `My Clippings.txt` do Kindle é uma alavanca de onboarding: traz anos de highlights para o Monet.
- Vale copiar o "link de volta à localização" e os templates de export Markdown, mantendo o Monet como fonte primária.

#### Readwise Reader

**1. Posicionamento e público:** read-it-later "para power readers". Junta artigos, RSS, newsletters, PDFs, EPUBs, YouTube (transcrição), threads, podcasts (transcrição) e Markdown [S1-15][S1-4]. Ainda leva o rótulo "Public Beta" (Update #14, ago/2026) [S1-6].

**2. Fluxo leitura → captura → nota → revisão:**
1. Salvar por extensão, e-mail, share sheet ou upload.
2. Organizar em Inbox, Library e Feed.
3. Ler em visão original de PDF ou "clean text", com TTS.
4. Grifar, anotar e tagear; em tablet, com stylus desde dez/2025.
5. Sync automático com o Readwise, que cuida da revisão e dos exports [S1-5][S1-15].

**3. Highlight → nota:** notas e tags por highlight; export de PDF anotado e de "Full Files and Articles". Respostas do chat podem virar nota. O link de um highlight de YouTube leva ao momento do vídeo (corrigido em jun/2026) [S1-3]. No EPUB, o highlight leva nome de capítulo e número de página impressa quando o arquivo traz essa informação (ago/2026) [S1-4].

**4. Revisão/recall:** herda Daily Review e Mastery do Readwise. Flashcards saem via prompt `.qa` [S1-7].

**5. IA:** Ghostreader.
- **Convocado** por atalho (G na seleção, Shift+G no documento) ou pelo chat lateral (v3, dez/2025). Faz resumo, definição, explicação e tradução, e aceita prompts próprios em Jinja2 [S1-12][S1-13].
- As respostas **citam e linkam o trecho** (chunking + embeddings), conhecem a posição de leitura e ficam "within what you've read" [S1-5][S1-3].
- **Global Ghostreader** (ago/2026, web/desktop): chat com a biblioteca inteira, com citações e ações agênticas (tagear, mover, editar metadados). Cada ação tem permissão "always allow / ask first / disabled" [S1-3][S1-4].
- Quick Lookup no celular: definição contextual, glossário do termo até a posição atual e tradução [S1-4].
- Proativo: o auto-summary vem **ligado por padrão** para documentos salvos manualmente e pode ser desligado nas preferências do Ghostreader; o auto-tagging é opcional [S7-14][S1-13].
- Modelos: GPT-5 Mini incluso segundo a doc; GPT-6 Luna é o padrão dos resumos desde 25/set/2026; modelos maiores via BYOK [S1-13][S1-3].

**6. Plataformas, offline, sync, formatos:**
- Web, iOS, Android, extensões (Chrome, Firefox, Safari), modo e-ink e apps desktop Mac e **Windows: sim** [S1-2][S1-14]. Em 2025 houve um bug do chat no app Windows, já corrigido [S1-3].
- Offline em web, mobile e desktop (Offline v2, dez/2025) [S1-2][S1-5].
- Sync em nuvem, com conta obrigatória.

**7. Preço:** incluso no Readwise Full, US$ 9,99/mês no anual ou US$ 12,99 no mensal. Quem assinou antes de 18/fev/2024 mantém o preço legado (verificado em 2026-10-17) [S1-2][S1-1].

**8. Novidades 2025–2026:**
- 2025: Chat with Documents, EPUBs v2 e PDF Clean View v2 (jun); suporte a tablet e transcrição de podcasts (dez).
- 2026: MCP/CLI (mar); upload de Markdown (jul); Global Ghostreader, chat no celular, Better Search e Quick Lookup (ago); temas de leitura e 16 vozes TTS beta (out) [S1-3][S1-4][S1-5][S1-6].

**9. Forças, fraquezas e reclamações recorrentes:**
- Forças: amplitude de formatos, IA com citação e consciência de posição, TTS. Na App Store tem 4,6 (585 avaliações), com elogios a TTS, RSS e integrações [S1-16].
- Fraquezas: anos em "beta". Um review de mar/2025 aponta parsing falho com frequência e preço alto ("basically Pocket with an AI summarise button") [S1-18].
- No PDF, o stylus funciona só no text view, não no PDF original (dez/2025) [S1-5]. Houve bugs com PDFs grandes, corrigidos em set/2026 [S1-3].
- Nuvem obrigatória.

**10. Relevância para o Monet:**
- É o benchmark do chat lateral do Monet. O Ghostreader v3 já faz contexto de posição, citação clicável e escopo "até onde li"; o Monet precisa igualar citação com salto para a página e escopo anti-spoiler.
- O Global Ghostreader equivale ao RAG do Monet. A diferenciação está em ser local-first, grátis, nativo no Windows e focado em fichamento perene; o Reader é inbox de consumo.
- Auto-summary e auto-tag no Monet: não fazer, ou deixar desligados por padrão.

#### Kindle (apps, Notebook, Kindle Scribe)

**1. Posicionamento e público:** ecossistema dominante de e-books (loja, e-readers, apps). O Kindle Scribe mira estudantes, pesquisadores e "heavy annotators" [S1-23][S1-22].

**2. Fluxo leitura → captura → nota → revisão:** leitura em e-reader ou app, highlights e notas, Notebook (no app e em read.amazon.com/notebook). A revisão é mínima. No Scribe há escrita à mão em notebooks e notas manuscritas no livro [S1-24].

**3. Highlight → nota:**
- O export do Notebook tem **limite definido pela editora**: o texto é truncado ao passar do teto, "typically around 10% to 20%" do livro [S1-11].
- Documentos pessoais ou sideloaded **não vão para a nuvem**; só saem via `My Clippings.txt` no aparelho ou pelo e-mail do app [S1-11].
- Não há API ("Kindle doesn't offer an API for developers") e os highlights têm só *location*, sem página [S1-11].
- O app exporta por e-mail (HTML com estilos de citação) [não reverificado].

**4. Revisão/recall:** o app gera flashcards a partir de highlights, mas um review diz que "only one side gets filled" [S1-31]. Vocabulary Builder nos e-readers [não reverificado]. Não há SRS de highlights.

**5. IA:** toda **convocada e ancorada no livro, sem spoiler**.
- **Recaps** (abr/2025): resumos dos volumes anteriores de séries, feitos com GenAI mais moderadores. Só EUA, em dispositivos Kindle, com iOS "soon"; no Reddit, leitores questionaram a precisão [S1-20].
- **Story so Far** (resumo até onde o leitor parou) e **Ask this Book** (selecionar um trecho e perguntar sobre motivo de personagem ou papel da cena): anunciados com os Scribes lançados em 10/dez/2025 [S1-21]. O Ask this Book chegou ao app Kindle para iOS nos EUA em dez/2025 e responde só até a posição de leitura [S7-42]; a expansão para aparelhos Kindle e Android estava prevista para "later in 2026" [S7-45]. O status em out/2026 nos e-readers [não verificado].
- No Scribe: Summarize e Refine de manuscrito, e busca com IA nos notebooks com "Ask Notebooks AI" [S1-22].
- Envio de notas para a Alexa+ estava prometido para 2026 [S1-21] [status não verificado].
- Reação de autores: a Amazon informou que o Ask this Book "is always on" e que autores e editoras não podem excluir seus títulos [S7-43]; a Authors Guild (23/12/2025) protestou que o recurso foi adicionado sem permissão e que esses usos "must be licensed and compensated" [S7-44].

**6. Plataformas, offline, sync, formatos:**
- E-readers, iOS, Android, Mac, web e Kindle for PC (**Windows: sim** [não reverificado; página da Amazon indisponível]).
- Offline sim; sync de posição, highlights e notas para livros comprados.
- Desde 20/jan/2026, autores KDP podem liberar EPUB/PDF sem DRM [S1-25].

**7. Preço:**
- Apps grátis.
- Scribe 3ª geração: US$ 499,99 com luz, US$ 429,99 sem luz; Scribe Colorsoft US$ 629,99 (dez/2025) [S1-21]. O review de fev/2026 cita até US$ 679,99 [S1-22].
- Linha Kindle 2026: de US$ 149,99 a US$ 319,99 [S1-28].

**8. Novidades 2025–2026:**
- 2025: Recaps (abr); Kindle Translate para autores (nov) [S1-29]; novos Scribes com IA (dez) [S1-21].
- 2026: KDP sem DRM opcional (jan) [S1-25]; Audible "Read & Listen" (fev) [S1-29]; fim de suporte aos Kindles de até 2012 (20/mai) [S1-26]; nova linha Kindle e Kindle Click (set–out), mas "on the software front, nothing has really changed" [S1-28][S1-30].

**9. Forças, fraquezas e reclamações recorrentes:**
- Forças: catálogo, e-ink e sync. App com 4,9 de 5,9 milhões de avaliações [S1-31].
- Highlights presos: limite de export, sem API, documentos pessoais fora do Notebook [S1-11].
- A remoção do "download and transfer via USB" "angered many Kindle owners", e o DRM novo dos Kindles de 11ª/12ª geração bloqueia backup [S1-25].
- O fim de suporte gerou críticas e jailbreaks [S1-26][S1-27].
- A IA do Scribe foi "not perfect", e o aparelho é caro [S1-22][S1-23].

**10. Relevância para o Monet:**
- O Kindle é a principal fonte de "highlights que morrem". Importar `My Clippings.txt` (que inclui sideloaded) e o HTML do Notebook é um diferencial barato.
- A Amazon legitimou a IA sem spoiler e ancorada na posição. Com o contexto de página e o RAG que já tem, o Monet pode oferecer um "/recap até aqui" sob comando, para os PDFs e EPUBs do próprio usuário.
- O lock-in (USB, DRM, fim de suporte) reforça a mensagem local-first do Monet.

#### Apple Books

**1. Posicionamento e público:** leitor e loja de e-books e audiolivros do ecossistema Apple, para o público geral [S1-32].

**2. Fluxo leitura → captura → nota → revisão:** compra ou importação de EPUB/PDF; highlight (cores ou sublinhado) e nota; painel Highlights, em que o clique leva à página; e "Study Cards" em alguns livros [S1-33][S1-34].

**3. Highlight → nota:** notas por trecho e painel com salto à página [S1-33]. O guia oficial não documenta export; só há "Share book or audiobook information" [S1-32]. O Readwise depende de uma ferramenta Mac que lê a biblioteca local (adaptada ao macOS 27 em out/2026) [S1-3], o que indica que não existe export nem API oficial.

**4. Revisão/recall:** em "some interactive books", highlights, notas e glossário viram Study Cards. Não há agendamento nem SRS descrito [S1-34].

**5. IA:** nenhuma IA de leitura ou resumo aparece no guia do Books para macOS 27 [S1-32].

**6. Plataformas, offline, sync, formatos:** iPhone, iPad e Mac. **Windows: não**, não existe Books para Windows. Offline sim; sync por iCloud [S1-32]. Formatos: EPUB, PDF e audiolivros.

**7. Preço:** app grátis; livros pagos à parte.

**8. Novidades 2025–2026:** nada relevante para estudo nas fontes oficiais consultadas.

**9. Forças, fraquezas e reclamações recorrentes:**
- Forças: leitura fluida e sync iCloud.
- Limites: "Highlighting and notes might not be available for all book types" [S1-33]; preso ao ecossistema Apple; sem export oficial; sem revisão real.
- Reclamações de usuários não foram levantadas (Reddit inacessível).

**10. Relevância para o Monet:**
- Quem lê no Windows não tem Apple Books: é espaço natural para o Monet como leitor pessoal de EPUB/PDF.
- Os Study Cards mostram o caminho mínimo de revisão: grifo na frente, nota do usuário no verso. É barato de implementar.

#### Matter

**1. Posicionamento e público:** "the modern read-later app for iPhone, iPad, and web", focado em newsletters, artigos e áudio [S1-35].

**2. Fluxo leitura → captura → nota → revisão:** salvar (extensão, e-mail, Gmail, feeds); organizar a fila com "power queuing"; ler ou ouvir (TTS; YouTube e podcasts transcritos com texto sincronizado); grifar, inclusive com Apple Pencil ou em "Audio Highlights" durante a escuta; sincronizar com o PKM [S1-35].

**3. Highlight → nota:** highlights e notas com sync para Notion, Obsidian, Roam e Readwise; "Quoteshots" para compartilhar [S1-36][S1-35]. Link de volta ao trecho [não verificado].

**4. Revisão/recall:** não tem. Um review pede mais ressurfacing de highlights [S1-36].

**5. IA:** "AI Co-Reader" premium, **convocado**, que responde perguntas sobre o texto selecionado. TTS com vozes HD [S1-36].

**6. Plataformas, offline, sync, formatos:** iPhone, iPad, web e extensão. Android [não verificado; o site não lista]. **Windows: só pela web**. Offline com busca full-text [S1-35]. Formatos: web, newsletters, PDF, YouTube e podcasts; EPUB [não verificado].

**7. Preço:** Premium US$ 7,99/mês ou US$ 79,99/ano, conforme as compras in-app da App Store em 2026-10-17. A listagem também mostra variantes "Pro" (US$ 59,99–79,99/ano) e "Patron" (US$ 149,99) [S1-36].

**8. Novidades 2025–2026:** redesign para iOS 26 e vozes melhores (out/2025); Co-Reader redesenhado e escuta em 15 idiomas (mar); aba Discover com recomendações (jun). Nos dois últimos o ano não aparece na loja; 2026 é inferido pela sequência de versões [S1-36].

**9. Forças, fraquezas e reclamações recorrentes:**
- Forças: TTS "most human-like", design limpo, newsletters e read-later num lugar só (4,6, cerca de 1,2 mil avaliações) [S1-36].
- Fraquezas: preço (cerca de US$ 60/ano citado), RSS falho, bugs de login e de salvamento, extração de texto incompleta [S1-36].

**10. Relevância para o Monet:**
- Sobreposição baixa: é consumo de artigos, não estudo de livros. A lição é que TTS e "grifar ouvindo" pesam em leituras longas.
- Confirma que IA sobre o trecho selecionado é o padrão mínimo esperado, o que o Monet já tem.

#### Glasp

**1. Posicionamento e público:** "social web highlighter", com highlights públicos e perfil social. Foi selecionado para o GSV Cup 50 de 2025 [S1-39][S1-40].

**2. Fluxo leitura → captura → nota → revisão:** a extensão grifa web, PDF, YouTube e imagens; o usuário acrescenta notas, tags e links; tudo vai para um perfil público e pode ser copiado ou exportado para o app de notas. Sincroniza highlights do Kindle e do Snipd (podcasts) [S1-40][S1-39].

**3. Highlight → nota:** cópia de tudo com metadados "in one click"; export em Markdown, HTML, CSV e JSON em todos os planos; auto-sync diário com Notion [S1-37][S1-40]. Obsidian e Readwise [não verificado].

**4. Revisão/recall:** não identificada.

**5. IA:** resumos de YouTube, artigos e PDF (com ChatGPT, Claude, Mistral e Gemini), chat com PDF, páginas e vídeos (por créditos), transcrição de áudio e um "AI clone" treinado nos highlights e notas do usuário [S1-37][S1-40]. Quase tudo é convocado; a sugestão automática de tags é proativa [S1-39].

**6. Plataformas, offline, sync, formatos:** extensão Chrome (500 mil usuários, nota 4,3 com 992 avaliações, atualizada em 17/out/2026) [S1-40]. **Windows: pelo navegador**. Offline: não [não verificado]. Formatos: web, PDF (30 arquivos no Free), YouTube e Kindle.

**7. Preço:** vigente desde 1/mai/2026, verificado em 2026-10-17 [S1-37][S1-38]:
- Free: **sem highlights privados**, só públicos.
- Pro: US$ 12,50/mês no anual (US$ 150) ou US$ 15 no mensal.
- Unlimited: US$ 30/mês no anual ou US$ 36 no mensal.
- 40% de desconto para estudantes no Pro anual.
- O aumento de cerca de 25% foi justificado por custos de infraestrutura [S1-38].

**8. Novidades 2025–2026:** reajuste de preço (mai/2026); sync com Snipd; sugestão automática de tags; GSV Cup 2025 [S1-38][S1-39].

**9. Forças, fraquezas e reclamações recorrentes:**
- Forças: útil no plano grátis e no ensino de idiomas/ESL [S1-40].
- Reclamações (jul–out/2026): falha de login, toolbar que cobre a página, não grifa em iFrame nem em Shadow DOM, pedidos de sidebar fixa [S1-40].
- Privacidade: no plano gratuito tudo é público [S1-37].

**10. Relevância para o Monet:**
- Contraste de privacidade: no Glasp, o gratuito é público; no Monet, o gratuito é 100% local.
- Importar Kindle de graça já é o mínimo esperado em ferramentas de highlight.
- "AI clone" e camada social contrariam a tese do Monet: evitar.

#### Hypothesis

**1. Posicionamento e público:** "the market-leading social annotation platform" para o ensino superior (300+ instituições), com integração a LMS (Canvas, Blackboard, Moodle, D2L via LTI 1.3) [S1-41][S1-44].

**2. Fluxo leitura → captura → nota → revisão:** abrir a página ou o PDF com a extensão; grifar (privado por padrão) ou anotar em público, em grupo ou só para si; discutir em threads com @mentions; consultar no Notebook (buscar e filtrar); exportar [S1-48][S1-47].

**3. Highlight → nota:**
- Anotação ancorada ao trecho, com Markdown, LaTeX, imagens e vídeo.
- O PDF é identificado por **"fingerprint", não pelo caminho do arquivo**, e as anotações seguem cópias idênticas [S1-46].
- Export em JSON (reimportável), TXT, CSV e HTML [S1-47]. O Readwise importa do Hypothesis [S1-3].

**4. Revisão/recall:** não tem.

**5. IA:** não tem. O posicionamento é explícito em favor de "real engagement" e contra resumos de IA ("AI Resistant Learning") [S1-41][S1-43].

**6. Plataformas, offline, sync, formatos:**
- Navegador: extensão Chrome; bookmarklet no Firefox, que não funciona em PDF local a partir do Firefox 153.
- **Windows: sim, pelo navegador**. PDF local só em desktop ou laptop. Offline: não.
- Formatos: web, PDF online e local, YouTube, imagens, VitalSource e JSTOR. PDF escaneado precisa de OCR antes [S1-46][S1-41].

**7. Preço:** Free (anotação e grupos privados). Planos institucionais Bronze, Silver e Gold cobrados "per student/yearly", sem preço público (2026-10-17) [S1-42].

**8. Novidades 2025–2026:** "Paced Social Annotation" (anotar em privado e revelar depois; anunciada em out/2026, com revelação por calendário no roadmap) [S1-45]. Relatório 2025–26 do próprio fornecedor: 20 mil+ cursos e 3 milhões+ de alunos desde 2019 [S1-44].

**9. Forças, fraquezas e reclamações recorrentes:**
- Forças: grátis para indivíduos, export completo, ancoragem robusta.
- Fraquezas: sem PDF local no celular, dependência de extensão, anotações "orphans/unanchored" quando o texto muda, foco institucional [S1-48][S1-46].
- Reclamações no Reddit não foram levantadas.

**10. Relevância para o Monet:**
- Identificar o PDF por hash ou fingerprint preserva os grifos quando o arquivo é movido ou renomeado.
- O discurso "IA não substitui a leitura" valida a tese do Monet.
- JSON/CSV/HTML/TXT é o patamar mínimo de portabilidade.

#### Pocket (encerrado em 2025) — lições

**1. Posicionamento e público:** read-later da Mozilla, integrado ao Firefox [S1-49][S1-51].
**2. Fluxo leitura → captura → nota → revisão:** n/a.
**3. Highlight → nota:** n/a.
**4. Revisão/recall:** n/a.
**5. IA:** n/a.
**6. Plataformas, offline, sync, formatos:** web, Android, iOS, macOS e extensões, todos encerrados [S1-51]. O export (listas, arquivo, favoritos, notas e highlights) ficou disponível até 08/out/2025 [S1-50], e a API parou na mesma data [S1-49].
**7. Preço:** n/a.
**8. Novidades 2025–2026:**
- 22/mai/2025: anúncio, com fim de downloads e de novas assinaturas.
- 08/jul/2025: fim do serviço; reembolso automático para assinantes anuais.
- Após 08/out/2025: dados apagados de forma permanente [S1-49].
- Motivo declarado: "the way people save and consume content on the web has evolved" [S1-49].
**9. Forças, fraquezas e reclamações recorrentes:** usuários reclamaram nas redes [S1-50]. As alternativas mais votadas no AlternativeTo são Raindrop.io, wallabag e Inoreader [S1-52]. A Kobo passou a integrar o Instapaper (jul–ago/2025) [S1-53]; que tenha sido para substituir o Pocket [não verificado].
**10. Relevância para o Monet:**
- Nem uma fundação grande garante longevidade, e dados em nuvem foram apagados. Local-first com export aberto é argumento de venda.
- Comunicar de forma explícita "seus dados ficam no seu disco".

#### Omnivore (encerrado em 2024) — lições

**1. Posicionamento e público:** read-later gratuito e open source; "500,000 globally", segundo a ElevenLabs [S1-54].
**2. Fluxo leitura → captura → nota → revisão:** n/a.
**3. Highlight → nota:** n/a.
**4. Revisão/recall:** n/a.
**5. IA:** n/a.
**6. Plataformas, offline, sync, formatos:** a nuvem foi descontinuada em nov/2024. Hoje é "completely Self-Hosted" (16,3 mil stars) [S1-55].
**7. Preço:** n/a (era grátis).
**8. Novidades 2025–2026:** o time entrou na ElevenLabs (29/out/2024) [S1-54], e o serviço foi "discontinued after November 15th 2024" [S1-56].
**9. Forças, fraquezas e reclamações recorrentes:** a principal queixa foi o aviso curto: "They give us 15 days to act", sem alerta prévio. Houve migração para wallabag (que tem importador de Omnivore) e Raindrop.io [S1-56]; para o Readwise Reader [não verificado].
**10. Relevância para o Monet:**
- Grátis, em nuvem e sem modelo de negócio significa risco de encerramento abrupto. O Monet, grátis e local, deve deixar claro que o acervo sobrevive ao app (SQLite + export Markdown).
- Código aberto não basta; o que protege o usuário é a portabilidade dos dados (inferência).


### PDF e anotação aprofundada (apps comerciais)

O grupo tem dois polos. De um lado, ferramentas de "leitura ativa" que fazem do trecho um objeto de pensamento (MarginNote 4, LiquidText, Highlights): as três ligam o trecho de volta à página, mas só o LiquidText roda no Windows. Do outro, suítes de PDF generalistas (Acrobat, Foxit, PDF Expert, Xodo, Drawboard) que em 2025–2026 empilharam IA de "chat com PDF com citações", workspaces multi-documento (PDF Spaces, Foxit Workspace) e até quiz/flashcards gerados por IA. Essas suítes, porém, tratam anotação como comentário dentro do arquivo, não como nota perene. Revisão espaçada nativa só existe no MarginNote (FSRS, e só no ecossistema Apple). No Windows, a combinação "leitor + fichamento ligado à página + revisão" praticamente não existe fora do LiquidText, que não tem SRS.

#### MarginNote 4

**1. Posicionamento e público:** "Where deep reading leaves a trace". O público declarado são candidatos a exames de pós/concursos, estudantes de medicina e direito, pesquisadores/teses, aprendizes de idiomas e leitores de não ficção de longo prazo [S2-3]. Desenvolvedor: Beijing Yunsi Software; ecossistema Apple [S2-2].

**2. Fluxo leitura → captura → nota → revisão:** lê PDF/EPUB/web/vídeo/áudio em "Study Sets". Cada grifo vira um card automaticamente ("Every highlight becomes a card automatically"). O card é ao mesmo tempo grifo no PDF, nó de mind map/outline (10 estilos: árvore, fishbone, timeline, concept map, matriz) e flashcard, o chamado "Card Axis". Depois vêm a revisão FSRS e o modo Recall [S2-2][S2-3]. "Extended Note" abre um espaço de escrita ao lado do PDF. "Title Link" faz anotações antigas reaparecerem quando o conceito surge em outro documento (resurfacing sem IA) [S2-2].

**3. Highlight → nota:** links bidirecionais card↔página de origem, links wiki entre cards e auto-link por palavra-chave [S2-3]. O Zotero Connector (plugin oficial, ~fev/2026) navega nos dois sentidos e escreve backlinks nos dois lados [S2-4]. Desde a MN 4.2, manuscrito e fórmulas viram Markdown para Obsidian/Notion [S2-4]. Exporta documento, mind map e "Card Outline" [S2-2]. Export completo para Anki/Markdown em 2026: [não verificado]. O próprio site diz que o MN4 "reduziu a dependência" de exportar para o Anki [S2-4]. O backup completo usa o formato proprietário `.marginbackupall` [S2-4].

**4. Revisão/recall:** FSRS nativo. O site alega ~30% menos tempo de revisão que os agendadores tradicionais do Anki [S2-3]. O "Immersive Mode" (MN 4.4, mai/2026) alterna entre Read·Write·Recall: no Recall os grifos ficam borrados até o clique, e o AI Hint Mode dá dicas em três níveis [S2-4].

**5. IA:** convocada. Popover "Ask" e Chat lateral ficam no documento, no mind map e nos cards. Há function calls para Q&A do livro inteiro, auto-highlight, reorganização da estrutura, prática de cloze e polimento em lote. Também há Smart TOC e os modos Guide/Quiz/Explain (MN 4.2, out/2025) [S2-4]. Inclui "AI Book Breakdown" e geração de cards e resumos, com a regra "every suggestion can be accepted, edited, or rejected" [S2-3]. As dicas do Recall são geradas on-device por Apple Foundation Models (iOS 26+), com fallback offline [S2-4]. Tem BYOK, com presets de provedor custom (Base URL) desde a 4.4.6 [S2-2]. O plano Max inclui 500 créditos/mês [S2-1].

**6. Plataformas, offline, sync, formatos:** iPhone, iPad, Mac e Vision Pro. **Windows: não**; Android: não [S2-1][S2-2]. Funciona offline [S2-3]. Sync só por iCloud. A MN 4.3 trouxe backup agendado para Local/WebDAV/Google, e o "Cloud Drive Sync" está "coming soon" [S2-4]. Formatos: PDF, EPUB, web, vídeo (YouTube/Bilibili desde mai/2024) e áudio [S2-2][S2-4].

**7. Preço:** verificado em 2026-10-17 em marginnote.com/en/pricing [S2-1]:
- Pro Lifetime US$12,99, só iPhone/iPad ("Pro doesn't run on Mac").
- Max Annual US$16,99/ano (iOS + Mac, 500 créditos de IA/mês).
- Max Lifetime US$51,99 (créditos mensais só nos 3 primeiros anos).
- DMG Standard (Mac) US$35, mais Premium por +US$10.
- Pacotes de créditos de US$1,39 (500) a US$44,99 (20.000).

A App Store US também lista "Subscription to MAX (Annually)" a US$12,99 e um plano de 3 meses a US$4,99 [S2-2]. Trial de 14 dias.

**8. Novidades 2025–2026:**
- MN 4.2 (out/2025): IA integrada ao documento, mind map e cards.
- Zotero Connector α (~fev/2026).
- MN 4.3 (~mar/2026): nova arquitetura de dados, "git for study notes", com versionamento automático e snapshots antes do sync e de conflitos.
- MN 4.4 (mai/2026): Immersive Mode e visual Liquid Glass.
- 4.4.6 (23/ago, ano inferido 2026): editor de fórmulas MathLive, caixas de texto em Markdown e melhorias no "AI Extract Questions" [S2-2][S2-4].

**9. Forças, fraquezas e reclamações recorrentes:** é o produto mais completo do segmento, com grifo→card→mapa→SRS num só objeto. Reclamações no fórum oficial:
- Sync por iCloud instável, flashcards que não sincronizam entre dispositivos, crashes e suporte que não responde ("the team simply doesn't answer", jan/2025) [S2-6].
- Em ago–set/2025, novatos ainda perguntavam se havia perda de dados. O suporte atribui a maioria dos problemas de sync ao Study Set de exemplo [S2-5].
- Preço confuso: Pro sem Mac, DMG como canal separado e créditos de IA à parte [S2-1].

Reddit ficou inacessível nesta coleta, e a queixa de curva de aprendizado íngreme aparece só em relatos antigos [não verificado para 2025–2026].

**10. Relevância para o Monet:**
- É o benchmark funcional do fichamento: trecho = card com link à página + estrutura + recall. No Windows não existe equivalente, e esse espaço está livre.
- Vale copiar o modo Recall (borrar grifos/citações e revelar no clique) como primeiro passo de active recall, mais barato que um SRS completo.
- A postura de IA (aceitar/editar/rejeitar, BYOK, on-device) valida a tese do Monet. O que evitar: excesso de modos, preço fragmentado e sync frágil. A MN 4.3 só ganhou versionamento e backup depois das queixas.

#### LiquidText

**1. Posicionamento e público:** apresentado como alternativa digital "better than paper" para revisar documentos, achar fatos e ver conexões. É forte no jurídico (Enterprise Edition, Legalweek), no acadêmico e em pesquisa [S2-8][S2-11][S2-13].

**2. Fluxo leitura → captura → nota → revisão:** importa PDF, Word, PowerPoint ou páginas web. O usuário arrasta trechos ("excerpts") para o workspace lateral, onde agrupa, comenta (digitado ou à mão) e liga tudo com "Ink Links" entre páginas, documentos e notas. Dá para comprimir o documento com pinça e comparar páginas distantes, ou colapsar o texto para ver só as partes anotadas e os resultados de busca lado a lado [S2-10]. Não há etapa estruturada de revisão.

**3. Highlight → nota:** o excerpt mantém link vivo com a origem; um toque mostra o contexto original [S2-8][S2-10]. Exporta PDF (workspace + documentos), Word (notas e excerpts como documento linear) e o arquivo nativo LiquidText. O Pro acrescenta o export combinado do projeto [S2-9][S2-10]. Export Markdown/Obsidian não aparece na documentação consultada [não verificado]. Não há sync bidirecional com outras ferramentas de notas.

**4. Revisão/recall:** não tem SRS, quiz nem daily review.

**5. IA:** em mai/2023 a empresa anunciou um beta (iPad, só assinantes) com ChatGPT. O beta responde perguntas sobre "any or all project documents" e sugere citações que ligam uma frase escrita pelo usuário aos trechos-fonte. O uso era pago por créditos (pay-as-you-go), com opção de desligar a IA por privacidade [S2-12]. A listagem atual da App Store não menciona IA [S2-10]. Na Legalweek 2026 houve um "sneak preview" de "advanced AI features coming soon", sem detalhes [S2-13]. O estado atual da IA é [não verificado]; no que foi descrito, ela é convocada.

**6. Plataformas, offline, sync, formatos:** iPad, iPhone, Mac, Vision Pro e **Windows 10/11 (sim, Microsoft Store)** [S2-8][S2-10][S2-11]. Funciona offline como app local. Sync em tempo real e backup contínuo só existem no LIVE. Sem LIVE, conecta-se a Dropbox/Box/OneDrive/iCloud [S2-9]. Formatos: PDF, Word, PowerPoint e web, com OCR. EPUB não é citado [S2-10].

**7. Preço:** App Store US, verificado em 2026-10-17 [S2-10]:
- Basic: grátis.
- Live: US$10,90/mês ou US$99,99/ano.
- Unlimited: US$189,99/ano.
- Pro II: US$89,99, compra única.
- Estudante: Live a US$5,49/mês ou US$54,90/ano.

A página oficial não mostra valores ("clique Buy Now para ver preços atualizados"). Ela descreve o Pro como "paid once" e põe multi-documento e tinta como recursos pagos [S2-9].

**8. Novidades 2025–2026:** colaboração em equipe em tempo real (17/abr/2025), com bibliotecas compartilhadas e workspaces compartilhados ou privados [S2-11]. Versão 7.3.16 (24/set, ano não exibido), só correções [S2-10]. Prévia de IA na Legalweek 2026 [S2-13].

**9. Forças, fraquezas e reclamações recorrentes:** o "excerpt ligado à fonte" no workspace é a materialização mais forte da relação nota↔texto. Fraquezas relatadas:
- Windows: buscas muito mais lentas que no iPad e um projeto grande que parou de carregar após a 7.2.2 (dez/2025); app "still unstable" (mar/2025); scroll ruim em PDFs longos (2020) [S2-14].
- Suporte lento mesmo no Live Unlimited (dez/2025) [S2-14].
- Recursos-chave atrás de paywall: multi-documento, tinta e sync [S2-9].
- Problemas de sync entre Windows e Apple, citados num review do Capterra [S2-51].

**10. Relevância para o Monet:**
- É o principal concorrente direto do Monet no Windows para leitura profunda. Suas dores são brechas: performance com PDFs grandes, multi-documento pago e IA praticamente ausente.
- O gesto "arrastar o trecho para a nota e tocar para voltar ao contexto" é a referência para a citação do Monet. O blockquote com fonte/página deveria abrir o livro exatamente na página e no grifo.
- O canvas espacial não precisa ser copiado. O diferencial do Monet é a nota textual perene mais a revisão.

#### Highlights (highlightsapp.net)

**1. Posicionamento e público:** "The PDF Reader for Research". Atende pesquisadores e acadêmicos que anotam muito e querem levar as anotações como notas para outro app [S2-16]. Desenvolvedor indie: Jonas Myren Ribe [S2-15].

**2. Fluxo leitura → captura → nota → revisão:** abre PDFs de iCloud, Dropbox, Google Drive, OneDrive ou Box ("Open In Place"). O usuário grifa, sublinha, risca, seleciona imagens e comenta. As anotações são extraídas automaticamente para uma lista de notas, que pode ser ordenada ou filtrada por cor, e daí exportadas para o app de notas [S2-15]. Não há revisão.

**3. Highlight → nota:**
- Export para Markdown, TextBundle, HTML, WebArchive e PDF, e envio direto a Apple Notes, Bear, Craft, Evernote, DEVONthink, Notion, Obsidian, Roam e Ulysses [S2-15].
- Arquivos "sidecar" Markdown/TextBundle salvos ao lado do PDF, no macOS (Pro) [S2-17].
- Link de volta pelo esquema de URL `highlights://`, que abre o arquivo numa página específica ("backend for page-links") [S2-19].
- Smart Copy (tabelas→CSV, citações→BibTeX), busca de DOI e integração com gerenciadores de referência, no Pro [S2-15][S2-17].

O export é unidirecional; não há sync bidirecional.

**4. Revisão/recall:** não tem.

**5. IA:** discreta e convocada. Usa as Writing Tools da Apple Intelligence para resumir o trecho selecionado e revisar notas (iOS 2024.2, nov/2024). A "Siri AI" (2026.2, set/2026) responde perguntas sobre o PDF aberto e faz buscas "fuzzy" de documentos. Ela exige iOS/iPadOS/macOS 27, funciona só em inglês e vem com o aviso de que a precisão "can vary greatly" [S2-18][S2-19]. O app não gera resumos nem flashcards automaticamente.

**6. Plataformas, offline, sync, formatos:** iPhone, iPad, Mac e Vision Pro. **Windows: não** [S2-15]. Funciona offline, com arquivos locais. Sincroniza pelo provedor de arquivos (iCloud e outros). Formatos: só PDF; EPUB e web não são citados [S2-16].

**7. Preço:** verificado em 2026-10-17 em highlightsapp.net/pro [S2-17]. Grátis para ler, anotar e exportar Markdown/HTML/TextBundle/PDF. Pro: US$4,99/mês ou US$29,99/ano, com trial. A App Store também lista um "Legacy Upgrade" de US$29,99 [S2-15].

**8. Novidades 2025–2026:**
- 2025.1 (set/2025): redesign Liquid Glass.
- 2025.1.4 (out/2025): correções em links internos e URL-schemes.
- 2026.2 (set/2026): Siri AI.
- 2026.3 (10/out/2026): layout "Auto" para o iPhone dobrável ("iPhone Duo") e múltiplas janelas [S2-15][S2-18][S2-19].

**9. Forças, fraquezas e reclamações recorrentes:** é simples e rápido, tem export limpo com links de página e nota 4,5 (1,6 mil avaliações) [S2-15]. Fraquezas: só Apple; sem estrutura nem revisão, é um "extrator" que depende de outro app de notas. Uma avaliação na App Store chama o app de caro para a função principal [S2-15, via resultado de busca].

**10. Relevância para o Monet:**
- Mostra que há demanda por "grifo → Markdown com link de volta à página". O Monet poderia exportar o fichamento de um livro em Markdown com links de página, o que reduz o medo de lock-in de quem usa Obsidian.
- O modelo de deixar o export básico grátis e cobrar só integrações cabe num Monet gratuito.

#### PDF Expert (Readdle)

**1. Posicionamento e público:** editor/leitor de PDF premium para Mac e iOS, voltado à produtividade geral (editar, assinar, preencher, anotar). O público é amplo e inclui estudantes [S2-21][S2-23].

**2. Fluxo leitura → captura → nota → revisão:** abre o PDF e anota com grifo, sublinhado, caneta, notas, comentários e notas de áudio. Outline e bookmarks ajudam a navegar. A IA resume as anotações [S2-21][S2-23]. A única "revisão" é o "Generate quiz" da IA, no Mac [S2-24].

**3. Highlight → nota:** as anotações ficam no próprio PDF. "Summarize annotations" funciona via IA [S2-21][S2-23]. Não há nota separada ligada ao trecho. Formatos de export do resumo de anotações e export Markdown/Obsidian: [não verificado].

**4. Revisão/recall:** sem SRS. Quiz gerado por IA, só no Mac [S2-24].

**5. IA:** PDF Copilot, painel lateral convocado:
- Ações: Summarize, List main points (cada ponto com referência de página), Explain (clique direito), Translate, Generate quiz (Mac) e chat com perguntas sugeridas.
- As respostas se limitam ao documento aberto, trazem links para a página e destacam os trechos relevantes ("point you to the exact paragraph it came from") [S2-23][S2-24].
- Privacidade: usa OpenAI, a Readdle diz não treinar modelos com dados do usuário, e o arquivo só é escaneado quando o Copilot é ativado [S2-23].

**6. Plataformas, offline, sync, formatos:** Mac (o Copilot exige macOS 13+), iPhone, iPad e Vision Pro. **Windows: não** ("PDF Expert isn't available on Windows"); só o Copilot tem versão web (copilot.pdfexpert.com) [S2-23]. Funciona offline; a IA, não. Sincroniza por iCloud e serviços de nuvem [S2-25]. Formatos: PDF; EPUB não é citado.

**7. Preço:** o site oficial mostrou preços em BRL (geolocalizado): anual R$459,90 (iPhone/iPad/Mac) e vitalício R$999,90 (só Mac), com Copilot incluído nos dois [S2-20]. Na App Store US (2026-10-17) aparecem "PDF Expert Mac & iOS" a US$79,99, "Premium" a US$49,99 (iOS) e "PDF Expert" a US$139,99 no Mac [S2-21][S2-22]. A loja não rotula os períodos; o mais provável é anual e vitalício [inferido]. Trial de 7 dias [S2-23].

**8. Novidades 2025–2026:** um guia oficial de 17/dez/2025 descreve as quick actions do Copilot, incluindo "Generate quiz" "para retenção ao estudar" [S2-24]. A versão Mac 3.13.4 (28/set) prepara o app para o macOS 27 [S2-22]. A versão iOS 7.26.x (set–out/2026) é manutenção [S2-21].

**9. Forças, fraquezas e reclamações recorrentes:** polido e leve, nota 4,7 (216 mil avaliações) [S2-21]. Reclamações: modelo de assinatura em vez de licença (out/2023), app "overpriced" e versão grátis limitada (set/2026) [S2-25]. Não há versão Windows.

**10. Relevância para o Monet:**
- A IA convocada, ancorada no documento e com link para a página é o padrão que o chat do livro do Monet já segue. Vale garantir que as respostas citem página e grifo clicáveis.
- Quiz gerado do documento já é commodity em leitores. O Monet pode oferecer um /quiz sobre os grifos e notas do próprio usuário, e não sobre o PDF bruto, preservando o esforço de elaboração.

#### Adobe Acrobat (AI Assistant, Acrobat Studio, PDF Spaces)

**1. Posicionamento e público:** padrão de mercado em PDF. Desde ago/2025, o Acrobat Studio reúne Acrobat Pro, PDF Spaces, AI Assistant e Adobe Express Premium, voltado a profissionais e equipes que lidam com muitos documentos [S2-31][S2-33].

**2. Fluxo leitura → captura → nota → revisão:** o usuário abre o PDF e grifa ou comenta no arquivo; o AI Assistant resume e responde perguntas. O PDF Spaces reúne até 100 arquivos (PDF, Word, PowerPoint, planilhas, texto, links web e notas próprias) e gera insight cards. O Space pode ser compartilhado ou virar apresentação ou áudio via Express [S2-32][S2-33]. Não há revisão.

**3. Highlight → nota:** grifos e comentários vivem no PDF (lista de comentários; export de comentários [não verificado em 2026]). Nos Spaces o usuário pode adicionar notas, e as respostas da IA trazem "verifiable citations" que levam ao trecho-fonte [S2-27][S2-28][S2-33]. Não dá para editar o PDF dentro do Space [S2-32].

**4. Revisão/recall:** sem SRS nem flashcards. As páginas oficiais não citam quiz [S2-27][S2-30]. O mais próximo de estudo é o assistente no modo "Instructor" [S2-33].

**5. IA:**
- AI Assistant: resumos estruturados, Q&A com citações e referências de página, edição por linguagem natural; em geral convocado [S2-27].
- PDF Spaces gera insight cards automaticamente (resumos, temas, prompts sugeridos, tabelas), um comportamento semi-proativo.
- Assistentes customizáveis ("Analyst", "Instructor", "Entertainer") e audio overviews "podcast-style" [S2-31][S2-32][S2-33].

A Adobe promete não treinar modelos com dados do usuário [S2-32]. Os reviews alertam para alucinações e para a necessidade de verificar as respostas [S2-32][S2-33].

**6. Plataformas, offline, sync, formatos:** desktop (**Windows: sim**; Mac), web e mobile [S2-27][S2-32]. Leitura e edição funcionam offline no desktop; IA e Spaces exigem nuvem. Sync pela nuvem Adobe (100 GB no Studio) [S2-32]. Formatos: PDF, mais Office e links dentro dos Spaces; EPUB não.

**7. Preço:** adobe.com, verificado em 2026-10-17:
- Reader: grátis [S2-26].
- Standard US$14,99/mês e Pro US$19,99/mês, ambos sem IA [S2-26].
- Studio: US$24,99/mês no anual cobrado mensalmente; US$34,99 no mensal; US$299,88/ano pré-pago [S2-26].
- "Acrobat Express": US$9,99/mês, com IA (resumos, Q&A com citações, PDF Spaces compartilháveis) [S2-27][S2-29].
- Estudantes: Pro a US$19,99/mês, mais o add-on AI Assistant a US$1,99/mês ou US$19,99/ano [S2-30].

A Macworld (nov/2025) registrou US$35/mês ou US$300/ano como preço "early access" [S2-32].

**8. Novidades 2025–2026:** Acrobat Studio e PDF Spaces lançados em ago/2025, com IA grátis até 1º/set/2025 [S2-31]. Plano Acrobat Express [data não verificada]. Audio overviews e Spaces compartilháveis com um assistente para quem recebe [S2-29].

**9. Forças, fraquezas e reclamações recorrentes:** citações verificáveis, escala de 100 arquivos e confiabilidade para extrair dados [S2-32]. Contras nos reviews: preço alto e bundle com coisas que não se usa, bloatware no Mac, fluxo dividido entre Acrobat, Spaces, Assistant e Express, e respostas de IA que exigem verificação [S2-32][S2-33]. Reclamações de usuários sobre pop-ups e upsell de IA no Reader: [não verificado; Reddit inacessível nesta coleta].

**10. Relevância para o Monet:**
- Define a expectativa do mercado: toda resposta de IA cita a fonte e leva ao trecho. O Monet já tem RAG do livro, então citação clicável à página é obrigatória.
- PDF Spaces e insight cards são o oposto da tese do Monet: IA proativa e resumos prontos. Dá para posicionar o Monet como "o lugar onde quem resume é você", grátis e local.

#### Foxit (PDF Editor/Reader + AI Assistant + Workspace)

**1. Posicionamento e público:** alternativa ao Acrobat para empresas e usuários Windows, com um Reader gratuito [S2-35].

**2. Fluxo leitura → captura → nota → revisão:** o usuário anota e comenta no PDF, com o AI Assistant no painel. O Workspace (app desktop Windows/Mac ou web) organiza projetos de até 100 arquivos e gera relatórios, slides, diagramas, Markdown ou HTML [S2-34].

**3. Highlight → nota:** comentários ficam no PDF. As saídas do Workspace são editáveis em Markdown/HTML [S2-34]. Nota ligada ao trecho: [não verificado].

**4. Revisão/recall:** sem SRS. O Workspace tem Skills prontas "Quiz" e "Flashcards", geradas por IA [S2-34].

**5. IA:** convocada.
- Chat com "citations pointing back to the exact place in the source", resumo, tradução lado a lado, AI Bookmark e Smart Podcast.
- **Local AI:** chat, resumo, tradução e AI Bookmark rodam no próprio PC via Microsoft Foundry Local, offline depois do download e sem gastar créditos.
- BYOM (modelo compatível com OpenAI) e MCP host/conectores [S2-34][S2-38].

**6. Plataformas, offline, sync, formatos:** **Windows: sim**; também macOS, web e iOS/Android (no Editor+) [S2-35][S2-36]. Funciona offline, inclusive com IA local. Formatos: PDF.

**7. Preço:** foxit.com ("list rates in the US as of July 2026"):
- IA grátis: 300 créditos/mês com uma conta.
- Assinatura de IA: US$4,99/mês ou US$49,99/ano (2.000 créditos/mês).
- PDF Editor: US$129,99/ano. Editor+: US$159,99/ano.
- Licença perpétua Editor 14: US$209,99, sem IA [S2-34][S2-35][S2-36].

**8. Novidades 2025–2026:**
- Aba de IA no ribbon (abr/2025).
- Research Agent (jun/2025).
- MCP host na v2025.2 (ago/2025).
- v2025.3 (dez/2025).
- Integração com ChatGPT (abr/2026).
- Editor 2026.2 (set/2026), com Workspace, Local AI e BYOM [S2-37][S2-38].

**9. Forças, fraquezas e reclamações recorrentes:** é a IA mais local-first entre as suítes, com preços claros. Fraquezas: foco empresarial, e a anotação continua sendo comentário no PDF. Sentimento de usuários: [não verificado].

**10. Relevância para o Monet:**
- A Local AI via Foundry Local é uma referência técnica direta para um app Windows local-first: IA offline, sem conta.
- Flashcards e quiz por IA viraram "skill" padrão. O diferencial do Monet não pode ser "gerar flashcards", e sim o ciclo de elaboração do próprio usuário.

#### Xodo (Apryse)

**1. Posicionamento e público:** suíte de PDF barata (web, desktop e mobile) da Apryse. Historicamente foi popular como anotador grátis no Windows [S2-44].

**2. Fluxo leitura → captura → nota → revisão:** o Reader grátis permite grifos, notas, comentários e desenho. Há ferramentas web e o AskPDF [S2-41][S2-43]. Não há revisão.

**3. Highlight → nota:** comentários ficam no PDF. Notas ligadas ou export estruturado: [não verificado].

**4. Revisão/recall:** não tem.

**5. IA:** o AskPDF, na web, conversa com o PDF e o resume; é convocado. Não há menção a citações. O grátis permite 1 PDF por dia; o uso é ilimitado no trial e nos planos [S2-41]. "Summarize PDFs using AI" aparece na tabela de planos [S2-39].

**6. Plataformas, offline, sync, formatos:** Xodo PDF Studio no desktop (Windows, macOS e Linux, offline), Xodo Web e iOS/Android. **Windows: sim** [S2-40][S2-42]. Formatos: PDF.

**7. Preço:** xodo.com, verificado em 2026-10-17:
- Free: 1 ação por dia na web.
- Xodo Web: US$39,99/ano.
- PDF Studio (desktop): US$119,88/ano (US$9,99/mês) ou US$19,99 no mensal; perpétuo US$240.
- Document Suite: US$107,93/ano, em promoção de −40% até 31/dez/2026 [S2-39][S2-42].

**8. Novidades 2025–2026:** o desktop aparece como Xodo PDF Studio (data da mudança [não verificada]); AskPDF; promoção de 2026 [S2-39][S2-42].

**9. Forças, fraquezas e reclamações recorrentes:** barato e multiplataforma, inclusive Linux. Reclamações: lentidão no Windows (2020–2022), recursos pagos no Android (jun/2024) e limite diário no plano grátis [S2-41][S2-44]. Se o antigo app grátis da Microsoft Store foi descontinuado: [não verificado].

**10. Relevância para o Monet:**
- Estudantes sensíveis a preço migram quando o grátis encolhe. Um Monet grátis no Windows pode capturar esse público.
- A IA genérica do Xodo, sem citação nem recursos de estudo, é commodity; não serve de referência de fluxo.

#### Drawboard PDF

**1. Posicionamento e público:** marcação com caneta "with the ease of pen and paper", nascida no Windows/Surface. Atende AEC/engenharia (com o produto Projects) e educação [S2-45][S2-48]. Na Microsoft Store aparece como "Drawboard PDF + Notes" [S2-50].

**2. Fluxo leitura → captura → nota → revisão:** o usuário abre um PDF ou slide de aula e anota com tinta sensível à pressão, grifos, formas e notas de áudio. Há templates de página pautada ou em grade, além de bookmarks e tags. O Store+Share permite marcação colaborativa em tempo real [S2-45][S2-47][S2-48].

**3. Highlight → nota:** a anotação fica no PDF; não há nota separada ligada ao trecho. Export estruturado: [não verificado].

**4. Revisão/recall:** não tem.

**5. IA:** a página de estudantes lista créditos mensais de IA (150 mil no Pro Plus, 600 mil no Pro Unlimited), mas não descreve as funções [S2-48]. As páginas de produto não mencionam IA [S2-45][S2-47]. Status: [não verificado].

**6. Plataformas, offline, sync, formatos:** **Windows: sim** (é a origem do produto); também web, iOS, macOS e Android, com sync ao vivo entre dispositivos [S2-45][S2-48]. Offline: [não verificado]. Formatos: PDF.

**7. Preço:** drawboard.com/pricing, verificado em 2026-10-17:
- Free: sem anúncios; Store+Share com até 10 documentos.
- Pro Plus: "usually" US$83,92/ano.
- Pro Unlimited: US$159,99/ano.
- Estudantes e educadores: US$10 (Pro Plus) ou US$20 (Unlimited), pagamento único válido por 3 anos [S2-46][S2-48].

**8. Novidades 2025–2026:** oferta "3 years of Pro, from $10" (data [não verificada]). O foco recente está no Drawboard Projects, com integrações Revit/Forma [S2-45][S2-46].

**9. Forças, fraquezas e reclamações recorrentes:** a melhor experiência de caneta no Windows, com nota 4,7 (13 mil avaliações na Microsoft Store, dado de set/2021) [S2-45]. Fraquezas: no Android é limitado e "only for Pro users" (dez/2024) [S2-49]; o plano grátis restringe a 7 ferramentas e 2 assinaturas [S2-47]; não é ferramenta de notas nem de estudo estruturado.

**10. Relevância para o Monet:**
- Mostra a demanda de estudantes Windows por anotar PDFs e slides de aula, o cenário de acompanhamento de curso.
- O Monet não compete em tinta. Compete no "depois do grifo" (fichamento, notas por sessão, revisão), que o Drawboard não cobre.


### PDF/PKM para pesquisa e tablet com IA

Este grupo tem dois modelos opostos. Zotero, Obsidian e Logseq são gratuitos e local-first (dados em disco, sync opcional) e não têm IA nativa: a IA chega por plugins de terceiros, e só o Zotero já tinha cerca de 50 plugins de IA em ago/2026, pela contagem de um usuário do fórum [S3-13]. Heptabase e os apps de tablet (Goodnotes, Notability, OneNote, Samsung Notes) funcionam em nuvem ou assinatura e vêm empurrando IA de estudo (tutor, quiz, flashcards, "break down book"), cobrada por créditos. O elo highlight → nota com link de volta à página está maduro no Zotero e no PDF++, e é o que mais se aproxima do fichamento do Monet. Nenhum dos quatro produtos principais tem revisão espaçada nativa sobre grifos; no Obsidian ela existe só via plugin.

#### Zotero (7 → 8 → 9 → 10)

**1. Posicionamento e público:** gerenciador de referências gratuito e open-source, voltado a pós-graduandos, pesquisadores e bibliotecas. O leitor embutido o transformou também em ambiente de leitura e anotação. A versão atual é o Zotero 10 (17/ago/2026); a 10.0.6 saiu em 07/out/2026 [S3-6].

**2. Fluxo leitura → captura → nota → revisão:** a captura acontece pelo Zotero Connector, que traz metadados e o PDF ou um snapshot da página. A leitura é no reader embutido, que abre PDF, EPUB e snapshots web desde o Zotero 7 (ago/2024) [S3-2]. As anotações podem ser highlight, underline, nota, imagem/área, ink e texto; ink e texto só funcionam em PDF [S3-2]. Em seguida vem "Add Note from Annotations" (ou arrastar anotações para uma nota) e, por fim, a citação no Word/LibreOffice. O Zotero 9 criou a coleção "Recently Read" [S3-5]. O Zotero 10 trouxe o Reading Mode: o PDF vira texto refluível com fonte e espaçamento ajustáveis, e as anotações feitas nele ficam sincronizadas com a vista original [S3-6].

**3. Highlight → nota:** a anotação entra na nota com a citação do item e um link para a página; "Show on Page" reabre o PDF no local exato [S3-7]. As anotações ficam no banco, não no arquivo, então leitores externos só as veem depois de exportar o PDF com anotações [S3-7]. Desde o Zotero 9, dá para inserir anotações direto no documento do Word com citação ativa [S3-5]. Notas exportam para Markdown [S3-10]. No Zotero 8, as anotações passaram a ser itens pesquisáveis e taggeáveis [S3-3].

**4. Revisão/recall:** não tem SRS, quiz nem daily review. O mais próximo é a coleção "Recently Read" e o Read Aloud (TTS) com a ação "Annotate Sentence", que grifa a última frase ouvida [S3-5].

**5. IA:** nenhuma nativa. O time não comenta o roadmap, e no fórum a defesa é deixar a IA para plugins [S3-13]. Os principais plugins são todos convocados pelo usuário:
- **Beaver:** chat com a biblioteca inteira e leitura assistida, com citações por página ou por frase que abrem o PDF no trecho. É grátis com chave própria; o plano pago está em beta por convite [S3-14].
- **llm-for-zotero:** AGPL, chat no reader, resumos, comparação de papers, modo agente e modelos locais; declara compatibilidade com Zotero 7 a 9 [S3-16].
- **PapersGPT:** chat com o PDF aberto, com modelos locais via Ollama [S3-17].
- **ARIA:** há relato de incompatibilidade com versões novas do Zotero [S3-15].

O Read Aloud usa vozes "Zotero Voices"; as Premium passam por provedores externos [S3-5].

**6. Plataformas, offline, sync, formatos:** Windows sim, além de macOS e Linux (ARM64 desde o Zotero 8) [S3-4]. Há app para iOS/iPadOS e para Android (≈jun/2025); no Android, só PDF, e a doc de 04/jun/2025 diz que EPUB/snapshot vem "coming soon" [S3-11][S3-12]. Funciona 100% offline, com banco local. O sync de dados é grátis e ilimitado; os arquivos sincronizam via Zotero Storage ou WebDAV [S3-9].

**7. Preço:** o app é grátis. O storage tem 300 MB grátis; 2 GB custam US$ 20/ano, 6 GB US$ 60/ano e ilimitado US$ 120/ano (verificado em 2026-10-17 em zotero.org/storage) [S3-8]. No Read Aloud, a voz Standard é ilimitada para assinantes de storage e limitada a 2 h/mês nas contas grátis; a Premium dá até 2 h/mês aos assinantes [S3-1].

**8. Novidades 2025–2026:**
- App Android (2025) [S3-12].
- Ciclo de releases de 6–10 semanas, anunciado em 22/jan/2026 [S3-1].
- Zotero 8 (22/jan/2026): novo diálogo de citação, notas em abas, busca de anotações, cores de fundo no PDF [S3-3][S3-4].
- Zotero 9 (10/abr/2026): Read Aloud, Recently Read, anotações direto no Word [S3-5].
- Zotero 10 (17/ago/2026): Reading Mode, undo/redo, busca avançada nova, edição em lote [S3-6].
- Read Aloud no iOS (05/out/2026) [S3-1].

**9. Forças, fraquezas e reclamações recorrentes:**
- **Forças:** grátis, aberto e local, e a citação com link à página é o padrão-ouro do fichamento acadêmico.
- **Releases rápidos quebram plugins:** o Zotero 8 criou um campo próprio de citation key e quebrou o Better BibTeX, com crashes e chaves perdidas até a 8.0.4 (mar/2026) [S3-18].
- **Sync de anotações confunde:** como as anotações ficam no banco, há relatos de anotações do iPad "sumidas" ou invisíveis em leitores externos [S3-19][S3-20].
- **Android sem EPUB** [S3-11].
- **IA fragmentada:** os plugins de IA passaram de ~29 para ~50 entre jun e ago/2026 [S3-13].
- **Cara de gerenciador de referências**, não de caderno.

**10. Relevância para o Monet:**
- Copiar o contrato "anotação → nota com citação + Show on Page" e oferecer export do PDF com as anotações embutidas, para o usuário não ficar preso.
- O Reading Mode refluível sincronizado com os grifos e o Read Aloud com "Annotate Sentence" são ideias concretas para o leitor da Library.
- O Zotero não tem SRS nem IA nativa: o Monet pode ocupar o recall sobre grifos sem virar gerenciador de referências.

#### Heptabase

**1. Posicionamento e público:** "an intelligent, visual knowledge base built for students, researchers, and lifelong learners", com o slogan "Master anything you learn. Do your best research with AI." [S3-21].

**2. Fluxo leitura → captura → nota → revisão:** as fontes podem ser PDF, YouTube, podcast (com transcrição), Web Clipper, Readwise ou Zotero [S3-21][S3-25]. Cada highlight vira um "Highlight Card", que o usuário arrasta para o whiteboard e embute em note cards. O método oficial tem cinco passos: grifar; extrair conceitos em cards cujo título é uma frase; conectar no whiteboard; agrupar; integrar com outras leituras [S3-26].

**3. Highlight → nota:** o Highlight Card é objeto de primeira classe e entra em outras notas via "Copy link" e "Paste as embed" [S3-25]. Insights de páginas web voltam ao trecho original, e os de YouTube voltam ao timestamp [S3-25]. Para PDF, a doc de IA promete "traceability to page numbers and paragraphs" [S3-27]; o link de volta exato do highlight de PDF não está documentado [não verificado]. Exporta Markdown (desde 2022) e PDF; desde ago/2026 também exporta o PDF parseado em Markdown [S3-24][S3-23].

**4. Revisão/recall:** não tem SRS, flashcards nem quiz; nada disso aparece no changelog de 2026 nem no roadmap [S3-23][S3-24]. A "revisão" é informal: revisitar o whiteboard e lembrar os conceitos pelos títulos [S3-26].

**5. IA:** é a mais agressiva do grupo.
- **Chat sobre PDF:** pode ser limitado a um intervalo de páginas ou a um parágrafo, com links para os blocos-fonte [S3-27].
- **Opção "Space":** vem ligada por padrão e faz a IA buscar na base inteira a cada pergunta [S3-27].
- **AI Tutor (31/mar/2026):** monta curso e lições a partir das fontes e cards do usuário [S3-23][S3-28].
- **Goal Discovery (20/abr/2026):** "AI reads across your recent whiteboards" e sugere direções de aprendizado [S3-23].
- **AI Skills (14/ago/2026):** o skill "Break down book" transforma livro ou capítulo num whiteboard "paragraph-complete, citation-backed" [S3-23].
- **Agente e integrações:** o agente edita cards (mai/2026); há MCP e CLI para Claude Code e Codex [S3-23][S3-21].

A IA é quase sempre convocada, mas a proposta é ela fazer a decomposição e a elaboração.

**6. Plataformas, offline, sync, formatos:** Windows sim, além de Mac, Linux, iOS, Android e web [S3-21]. O site diz "Access all notes and files without an internet connection", mas o modelo é conta + sync em nuvem [S3-21]; o formato local não foi verificado [não verificado]. A anotação de PDF no mobile só existe em iOS/iPadOS (abr–mai/2026), com Android "to follow" [S3-23]. Não abre EPUB nativamente: e-books entram só via highlights do Readwise [S3-25].

**7. Preço:** valores de heptabase.com/pricing em 2026-10-17, com o seletor padrão em "Yearly (Save 25%)", portanto provavelmente na cobrança anual:
- **Pro: US$ 8,99/mês.** 100 créditos de IA/mês, só modelos Gemini, PDF highlights.
- **Premium: US$ 17,99/mês.** PDFs e OCR ilimitados, AI Tutor, 1.800 créditos/mês.
- **Premium+: US$ 53,99/mês.** 8.100 créditos/mês [S3-22].

Não há plano grátis visível; trial e preço mensal [não verificado].

**8. Novidades 2025–2026:** tudo de 2026, segundo o changelog [S3-23]:
- Zotero integration (beta) em 23/fev.
- Premium+ e créditos Premium dobrados em 05/mar.
- AI Tutor em 31/mar.
- PDF no mobile iOS em abr/mai.
- OpenRouter e modelos abertos em jul.
- AI Skills em 14/ago.
- MCP baixando os PDFs originais em 16/out.

**9. Forças, fraquezas e reclamações recorrentes:**
- **Forças:** espacializa o conhecimento extraído de leituras, o time entrega muito rápido e há integrações (Readwise, Zotero).
- **Performance:** whiteboards grandes com muitos highlights de PDF ficam "slow and laggy" (reviews antigas, 2023–2024) [S3-29].
- **Faltas:** não tem SRS nem EPUB.
- **Custo e lock-in:** custo recorrente com créditos de IA, e dados presos a uma nuvem proprietária (sem reviews de 2026 verificadas).

**10. Relevância para o Monet:**
- É o concorrente mais próximo da persona de aprofundamento, mas a IA dele faz a elaboração ("Break down book", AI Tutor), o oposto da tese do Monet. Isso dá uma diferenciação clara e comunicável.
- O Highlight Card como objeto reutilizável (arrastável e embutível em várias notas) é um padrão a copiar para os grifos.
- Lacunas que o Monet pode ocupar: EPUB nativo, revisão espaçada, local-first e custo zero.

#### Obsidian (+ PDF++, Annotator, Zotero Integration, Spaced Repetition, Web Clipper)

**1. Posicionamento e público:** editor de Markdown local-first para PKM, com público técnico e de pesquisa. É grátis inclusive para uso comercial desde 20/fev/2025 ("Starting today, the Obsidian Commercial license is optional") [S3-32].

**2. Fluxo leitura → captura → nota → revisão:** o PDF abre no visualizador nativo. Com o PDF++, selecionar um trecho gera um link `[[arquivo.pdf#page=1&selection=…&color=red]]` para colar numa nota; o "grifo" é o próprio backlink desenhado sobre o PDF [S3-36]. Depois vêm as notas atômicas e Zettelkasten (backlinks, Bases) e, por fim, a revisão via plugin Spaced Repetition. Para a web, o Web Clipper oficial grifa na página e salva Markdown no vault [S3-33].

**3. Highlight → nota:** são três caminhos, todos em Markdown aberto, então o export é trivial:
- **PDF++:** link para página, seleção ou anotação, com hover sincronizado com o painel de backlinks. O PDF não é alterado, mas há a opção (limitada) de gravar a anotação no arquivo [S3-36].
- **Annotator:** baseado no Hypothesis; anota PDF, EPUB e web e guarda tudo num .md com block refs [S3-38].
- **Zotero Integration:** importa anotações e citações do Zotero via templates; exige Better BibTeX e aceita EPUB/snapshot desde a 3.2.0 [S3-39][S3-40].

**4. Revisão/recall:** nada nativo. O plugin Spaced Repetition faz flashcards inline (`pergunta::resposta`, cloze com `==grifo==`) e revisão de notas inteiras (#review). O FSRS opcional chegou na 1.15.0 (24/mai/2026) [S3-41][S3-42].

**5. IA:** nenhuma no core; o changelog de ago a out/2026 não menciona IA [S3-31]. O Web Clipper Interpreter usa LLM sob demanda, com chave própria (Anthropic, OpenAI, Gemini etc.) ou Ollama local, e "Obsidian does not collect or store data about your requests" [S3-34]. O resto da IA vem de plugins comunitários [não verificado nesta pesquisa].

**6. Plataformas, offline, sync, formatos:** Windows sim, além de macOS, Linux, iOS e Android; 100% offline. O sync é opcional, pelo Obsidian Sync (E2EE) ou soluções de terceiros [S3-30]. PDF é nativo; EPUB só via plugin. A 1.14 (set–out/2026) abre arquivos .md fora do vault, adiciona kanban em Bases e seis cores de highlight no editor [S3-31].

**7. Preço:** valores de obsidian.md/pricing em 2026-10-17 [S3-30]:
- App grátis.
- Sync: US$ 4/usuário/mês no anual ou US$ 5 no mensal.
- Publish: US$ 8/site/mês no anual ou US$ 10 no mensal.
- Commercial license opcional: US$ 50/usuário/ano.
- Catalyst: US$ 25, pagamento único.
- 40% de desconto em Sync/Publish para educação.

**8. Novidades 2025–2026:**
- Licença comercial opcional (fev/2025) [S3-32].
- Core plugin Bases: visões de banco em tabela, cards, kanban e mapa, gravadas nas propriedades dos .md [S3-35].
- Versão 1.14 (set/2026) [S3-31].
- Spaced Repetition com FSRS (mai/2026) [S3-42].

**9. Forças, fraquezas e reclamações recorrentes:**
- **Forças:** dados abertos, extensibilidade e ecossistema.
- **PDF depende de plugins frágeis:** a última release do PDF++ é de 30/ago/2025; o autor reescreve a 1.0 e avisa que o plugin usa APIs privadas que "may break" [S3-36][S3-37]. O Annotator está parado desde 06/jan/2024 e não funciona no iOS ≥ 16.3 [S3-38]. O Zotero Integration não tem release desde 11/ago/2024 [S3-40].
- **Demanda não atendida:** o pedido "Highlighting / annotation of PDFs as a core feature of Obsidian" tem 107 respostas e ~67 mil views no fórum [S3-43].

**10. Relevância para o Monet:**
- Há prova de demanda: anotação de PDF nativa é pedido antigo e não atendido no Obsidian, e o Monet já entrega isso integrado.
- O formato de âncora do PDF++ (página + seleção + cor num link) é uma boa referência para a citação grifo → nota do Monet.
- Flashcards inline na própria nota (`::`, cloze sobre grifo) com FSRS é o padrão de SRS que o público PKM já conhece.

#### Logseq

**1. Posicionamento e público:** outliner open-source (AGPL) e local-first, com journals diários e blocos referenciáveis, para público de PKM e pesquisa. Está em transição para a versão DB.

**2. Fluxo leitura → captura → nota → revisão:** no Logseq OG (baseado em arquivos), o PDF abre no leitor embutido, só no desktop. O usuário faz grifo de texto, ou de área com Cmd/Shift, escolhe a cor e cola a referência em qualquer bloco [S3-50]. Os grifos ficam numa página `hls__<arquivo>`, um bloco por grifo, com número de página; clicar na referência reabre o PDF no ponto [não reverificado em 2026]. Daí seguem journals e outline e, para revisão, flashcards #card [não reverificado em 2026].

**3. Highlight → nota:** cada grifo é um bloco endereçável (block ref) que pode ser transcluído em várias notas e leva de volta ao PDF. A integração com Zotero existe desde 2022 [S3-44], e o importador da versão DB "now supports Zotero PDFs" [S3-47].

**4. Revisão/recall:** flashcards nativos via tag #card no OG [não reverificado em 2026]; na versão DB, [não verificado].

**5. IA:** nada nativo, só plugins de terceiros [não verificado]. O roadmap foca em API de plugins, sync, mobile e gravação/transcrição de voz [S3-48].

**6. Plataformas, offline, sync, formatos:** Windows sim, além de macOS, Linux, iOS e Android; offline. Em 24/abr/2026 a empresa dividiu o produto em dois [S3-47]:
- **Logseq OG:** Markdown, só manutenção ("will continue to be maintained", sem features novas).
- **Logseq:** versão DB, "the main version going forward".

A versão DB está em beta: 2.0.1 (13/jul/2026, "early beta… back up your important data") e 2.0.2 (07/out/2026) [S3-45][S3-46]. O sync é E2EE, e há self-hosted sync [S3-47].

**7. Preço:** o app é grátis. Sync e early access ficam com quem apoia pelo Open Collective: Backers US$ 5/mês, Sponsors US$ 15/mês ("Logseq DB beta and RTC sync are ready for all active monthly backers", verificado em 2026-10-17) [S3-49]. Há um item "Logseq Pro" no roadmap, sem detalhes [S3-48].

**8. Novidades 2025–2026:**
- 0.10.14 (18/set/2025): atualiza o pdf.js para corrigir uma vulnerabilidade de RCE [S3-45].
- 0.10.15 (01/dez/2025) [S3-45].
- Divisão OG/DB (24/abr/2026) [S3-47].
- Logseq 2.0 beta (jul–out/2026) [S3-45].

**9. Forças, fraquezas e reclamações recorrentes:**
- **Forças:** o grifo como bloco é o modelo mais granular de highlight → nota do grupo, e tudo é gratuito e aberto.
- **Fraquezas:** a transição para DB se arrasta há anos, e o blog oficial está parado desde 31/ago/2024 [S3-44]. A versão de arquivos está congelada em features, a DB ainda é beta, o PDF só funciona no desktop [S3-50] e o preço futuro do sync é incerto.

**10. Relevância para o Monet:**
- O grifo como bloco referenciável, transcluível em várias notas, é um padrão a avaliar para as citações em blockquote do Monet: uma fonte, vários usos.
- Usuários de Logseq em transição (OG congelado, DB em beta) são público potencial para uma alternativa local e estável no Windows.

#### GoodNotes

Caderno digital de handwriting, com anotação de PDF à mão, voltado a estudantes e, cada vez mais, a profissionais [S3-52].

**IA (Goodnotes AI):** convocada pelo usuário e "works best in English" [S3-53][S3-51].
- Busca em manuscrito e PDF.
- "Ask Goodnotes" para resumos e takeaways.
- Geração de quizzes a partir das notas.
- Math Assist: on-device e grátis; o Essential acrescenta "Teach Me/Solve".
- Meeting AI e Create Mode no Pro.

Um post do blog de jul/2026 cita "Quiz Me" e flashcards para preparar provas [S3-54]; os detalhes não foram verificados.

**Plataformas:** iOS/iPadOS, Mac, Windows, Android e web (Windows sim). Sincronizar entre Apple e não-Apple exige o Goodnotes Cloud, incluído no Pro [S3-51].

**Preço (2026-10-17):** Free com 3 cadernos e 100 MB; Essential US$ 11,99/ano; Pro US$ 35,99/ano; AI Pass +US$ 9,99/mês, com cerca de 12× mais créditos [S3-51].

**Relevância para o Monet:** "quiz a partir das suas notas" já é commodity no mercado de estudante. O Monet pode entregar o mesmo por /comando, ancorado em grifos e notas próprias e sem créditos.

#### Notability

App de estudo com handwriting e gravação de áudio: "Stop just taking notes. Start learning from them." [S3-56].

**IA:** convocada pelo usuário; limitada no Plus e ilimitada no Pro [S3-55][S3-56].
- Quizzes, practice questions e flashcards gerados das notas.
- Resumos de texto, documentos importados e áudio.
- "Chat with your notes".
- YouTube link-to-note, com transcrição e resumo.
- Transcrição ao vivo.

**Plataformas:** o site lista iPad, iPhone, Mac, Windows, Android e web (Windows sim); a data de lançamento em Windows/Android não foi verificada [S3-55][S3-56].

**Preço (2026-10-17, com banner "Get 20% off all plans"):** Starter grátis (5 notas); Lite US$ 11,99/ano; Plus US$ 15,99/ano; Pro US$ 79,99/ano. Os preços cheios provavelmente são US$ 14,99, US$ 19,99 e US$ 99,99, valores inferidos do desconto de 20% [S3-55].

**Relevância para o Monet:** o fluxo aula gravada → transcrição → resumo → quiz é a referência de mercado para "acompanhamento de curso", justamente o que o Monet não cobre (sem transcrição).

#### Microsoft OneNote no tablet (Copilot)

Caderno do ecossistema Microsoft 365, padrão de quem estuda no Windows e em tablets com caneta.

**IA:** o Copilot é invocado pelo usuário pelo botão Copilot na guia Home. Ele resume páginas, inclusive o áudio transcrito e o manuscrito da página (o exemplo da doc cita as fontes), e gera to-dos e planos [S3-59]. Vem incluído no Microsoft 365 Personal/Family desde 16/jan/2025, com aumento de US$ 3/mês e créditos mensais de IA; há planos "Classic" sem Copilot [S3-58]. Quiz e flashcards não foram verificados.

**PDF:** entra como "printout" para escrever com tinta por cima; não é um leitor com grifos de texto [não verificado nesta pesquisa].

**Plataformas:** Windows, Mac, iPad, Android e web, com sync via OneDrive.

**Preço (2026-10-17):** app grátis. A IA começa no M365 Personal, US$ 9,99/mês ou US$ 99,99/ano; Family US$ 129,99/ano; Premium US$ 199,99/ano [S3-57].

**Relevância para o Monet:** o OneNote é o caderno default no Windows, mas fraco em leitura e fichamento de livro. É aí que o Monet compete.

#### Samsung Notes (Galaxy AI)

App nativo dos Galaxy (Tab S, celulares) com S Pen, importação e anotação de PDF à mão.

**IA (Galaxy AI):** convocada pelo usuário [não verificado nesta pesquisa].
- Note Assist: resumir, auto-formatar, corrigir, traduzir e gerar capa.
- Tradução de PDF.
- Transcript Assist para gravações feitas no próprio Notes.

A página oficial confirma apenas o Note Assist e o Transcript Assist [S3-60]; o resto [não verificado nesta pesquisa].

**Plataformas:** Android Galaxy, e um app no Microsoft Store para Windows (aparentemente voltado a Galaxy Book [não verificado]) [S3-61].

**Preço:** app grátis. "Galaxy AI basic features provided by Samsung are free", com a ressalva de que recursos futuros podem ser pagos (página "As of July 2026") [S3-60].

**Relevância para o Monet:** IA de estudo grátis embutida no hardware pressiona apps pagos, mas o Samsung Notes não é concorrente direto do Monet no Windows desktop.


### Estudo e revisão espaçada (SRS)

Em 2026 o grupo se divide em dois blocos. De um lado ficam os motores de SRS sem leitor (Anki, Mochi, Brainscape): a fonte fica fora do app e o cartão perde o contexto de onde veio. Do outro, as suítes que tentam unir leitura, nota e cartão (RemNote, SuperMemo com incremental reading, Traverse). O FSRS virou o algoritmo comum: Anki, RemNote e Mochi o oferecem, e até o SuperMemo 20 o roda em paralelo ao SM-20. A IA entra quase sempre como geração de cartões ou quiz, convocada pelo usuário a partir de um upload, e as reclamações recaem sobre a fidelidade desses cartões à fonte. A mudança estrutural do ano é a transferência gradual da stewardship do Anki para a AnkiHub (fev/2026).

#### RemNote

**1. Posicionamento e público:** "The AI note taking tool that actually helps you learn". Reúne notas, flashcards inline, PDFs e IA num só app e mira estudantes, do ensino médio ao pré-med/MCAT e a provas de idiomas [S4-2].

**2. Fluxo leitura → captura → nota → revisão:** a fonte (PDF, web, YouTube, ou DOCX/PPTX/EPUB convertidos) abre no RemNote Reader, com um Notes pane ao lado. O usuário grifa, cola a referência na nota, transforma uma linha em flashcard e revisa na Flashcards Home ou no Exam Scheduler [S4-3][S4-4].

**3. Highlight → nota:** colada na nota, a referência leva "to the location of the highlight in the PDF". Os grifos usam 6 cores, e a aba Highlights lista cada um com as notas anexadas. Para exportar, só há o "Download PDF" com os grifos embutidos ou a cópia em texto puro, sem export dedicado de grifos [S4-3]. Importa decks do Anki [S4-14].

**4. Revisão/recall:** o padrão é o "Anki SM-2". O FSRS v6 é opcional e segue marcado como "beta" (help atualizado em 21/ago/2026) [S4-8][S4-9]. Há ainda o Exam Scheduler V2 com metas diárias e streaks, quizzes e AI Grading [S4-1][S4-13].

**5. IA:** em geral convocada. O "Learn PDF"/Guided Learn Mode resume a fonte por seção e só cria cards quando o usuário clica em "Generate Cards"; o AI Chat cita a página exata [S4-5][S4-6][S4-7]. Há um toque proativo: grifar já dispara uma explicação [S4-15]. Desde ago/2026 o desktop tem um MCP server em beta para agentes locais [S4-13]. Sobre qualidade, uma review de abr/2026 conta que um PDF de vocabulário rendeu "a whopping 4 flashcards", nenhum fiel à fonte [S4-15].

**6. Plataformas, offline, sync, formatos:** Windows sim (download direto; a página não menciona Microsoft Store), além de macOS, Linux, iOS, Android e web [S4-12]. É local-first: o desktop guarda os PDFs localmente e sincroniza ao reconectar [S4-10]. Exige conta [inferido]. O Lecture Recorder grava e transcreve aulas com timestamps [S4-11].

**7. Preço:** Free (3 documentos anotados, 250 AI credits/mês); Pro US$ 96/ano; Pro with AI US$ 216/ano. Valores oficiais verificados em 2026-10-17 [S4-1]. Na cobrança mensal, US$ 10 e US$ 20, segundo review de abr/2026 [S4-15].

**8. Novidades 2025–2026:** 1.26 (28/abr/2026: infinite canvases e mind maps); Gemini Pro e Opus no AI Tutor (jun); 1.27 com Exam Scheduler V2 (17/jul); 1.28 e MCP server (5/ago); OCR ao vivo e quizzes que leem imagens (set/2026) [S4-13].

**9. Forças, fraquezas e reclamações recorrentes:** usuários elogiam o SRS, "like using Anki without the clunk", e o offline grátis [S4-16]. As críticas: UI carregada e curva íngreme [S4-17]; app de iPad "fundamentally unreliable" num thread do Reddit citado pela tl;dv (correção em abr/2026); preço alto do plano com IA [S4-15]; e o histórico de falhas de sync e perda de dados na 1.8, em 2022 [S4-18]. Não consultei o Reddit diretamente [não verificado].

**10. Relevância para o Monet:**
- É o mesmo gesto do Monet (grifo → citação que volta à página). O Monet pode se diferenciar com EPUB nativo (o RemNote converte para PDF) e sem exigir conta.
- O "Learn PDF", em que a IA resume e gera os cards, é o contraponto direto à tese do Monet e serve ao posicionamento.
- Se o Monet tiver SRS: criar o card inline na nota de fichamento, preservando o link do grifo.

#### Anki

**1. Posicionamento e público:** o SRS open-source de referência, com desktop grátis. É forte em medicina (decks AnKing/AnkiHub), idiomas e entre autodidatas avançados [S4-26][S4-34].

**2. Fluxo leitura → captura → nota → revisão:** não há leitor. O usuário lê fora, cria notas e campos à mão (ou por add-ons) e revisa por deck. O Image Occlusion é nativo desde a 23.10, que também adotou a numeração ano.mês [S4-20].

**3. Highlight → nota:** não existe nativamente. O vínculo com a fonte depende de um campo "Source" preenchido pelo usuário. Exporta .apkg, .colpkg e texto; integrações via AnkiConnect [não verificado nesta rodada].

**4. Revisão/recall:** SM-2 legado, com FSRS integrado desde a 23.10 e ativação manual e global. A retenção desejada padrão é de 90%, e o botão Optimize ajusta os parâmetros [S4-25]. O FSRS-6 chegou na 25.07 (21 parâmetros, exige reotimizar) [S4-21][S4-40] e a retenção por deck na 25.09 [S4-22]. Segundo relato no fórum (mai/2026), um PR do FSRS-6 foi fechado porque "FSRS-6 with default parameters doesn't outperform SM-2" [S4-31].

**5. IA:** não há IA oficial; tudo vem do ecossistema e é convocado. O AnkiHub Premium traz Smart Search e AI chatbot [S4-34][S4-35]. Há add-ons como AI-Hints e Notes2Flash [S4-38][S4-39], e o anki-mcp-server (53 ferramentas, ~516 estrelas) deixa assistentes criarem e revisarem cards [S4-36]. O autor de um add-on de revisão por IA avisa: "don't trust 100% the AI review" [S4-37].

**6. Plataformas, offline, sync, formatos:** Windows sim (10+ x64 e 11 ARM; instalador MSI desde a 26.05), macOS 13+ e Linux. O AnkiWeb sincroniza de graça, o AnkiMobile é pago e o AnkiDroid é grátis e autogovernado. Funciona 100% offline [S4-26][S4-23][S4-27].

**7. Preço:** desktop, AnkiWeb e AnkiDroid grátis. O AnkiMobile é "a $25US one-time purchase" (Damien Elmes, 4/fev/2026) [S4-29]. O AnkiHub cobra US$ 6/mês no Core e US$ 10/mês no Premium (2026-10-17); a página mostra outros valores, como lifetime de US$ 450 [S4-34].

**8. Novidades 2025–2026:** em 2/fev/2026, no post "Anki's Growing Up", Damien Elmes anunciou a transferência gradual das operações e da stewardship para a AnkiHub. As promessas: código aberto, sem mudança de preço e design de UI profissional [S4-27][S4-28]. A 26.05 (16/jun/2026) trouxe instalador padrão, build Windows ARM64 e build macOS assinado por "Anki Software LLC" [S4-23][S4-30]. A 26.08 trouxe um editor experimental [S4-24] e a 26.09 correções de segurança [S4-19]. O AnkiDroid chegou a ~4,0 milhões de usuários no Google Play [S4-33].

**9. Forças, fraquezas e reclamações recorrentes:** as forças são o preço zero, o offline, o FSRS e o ecossistema de add-ons e decks. As fraquezas: UI datada (a própria AnkiHub promete deixá-lo "more approachable") [S4-28]; atualização travada para quem usa o launcher das versões 25.07–25.09, que não chega à 26.05 pelo atualizador interno [S4-32]; add-ons que quebram a cada mudança [S4-24]; e receio de paywall com a AnkiHub [S4-27]. Não consultei o Reddit [não verificado].

**10. Relevância para o Monet:**
- O Anki é o destino natural dos cards: exportar CSV/.apkg com campo "Fonte" (livro/página) evita reinventar o SRS.
- A lacuna do Anki é o contexto (cards órfãos da leitura), e o Monet já tem leitor e citação.
- O FSRS do Anki é a crate Rust fsrs-rs [S4-24], que encaixa no backend Tauri.

#### Mochi

**1. Posicionamento e público:** notas em Markdown com flashcards e SRS, "Local first", forte em idiomas. Atende quem quer algo mais leve que o Anki; o Free dispensa cadastro ("no sign-up is necessary") [S4-42][S4-41].

**2. Fluxo leitura → captura → nota → revisão:** não há leitor. O usuário escreve notas e cards em Markdown, liga notas por References bidirecionais e usa templates com dynamic fields (dicionário, TTS, tradução, imagem, IA) [S4-42][S4-44].

**3. Highlight → nota:** não se aplica, porque não há grifos. Importa Anki e CSV com anexos. Exporta .mochi (com histórico de revisões), Markdown e CSV compatível com Anki. O Pro tem API HTTP [S4-45][S4-43][S4-41].

**4. Revisão/recall:** usa algoritmo próprio por padrão, com multiplicadores fixos. O FSRS é opcional (prévia beta em jun/2025), com avaliação binária Remembered/Forgot e sem otimizador embutido. Há ainda o modo "Inbox" (fev/2026) e cramming [S4-43][S4-45][S4-46].

**5. IA:** convocada via template. O campo "AI Text Generator" cria flashcard a partir de um texto, pergunta, frase de exemplo, LaTeX ou responde a um prompt custom [S4-44]. Os limites são 5 mil tokens/mês no Free e 500 mil no Pro [S4-41]. Não há IA ancorada em livro.

**6. Plataformas, offline, sync, formatos:** Windows sim, além de macOS, Linux, iOS, Android e web. O offline é ilimitado no Free; sync só no Pro (10 GB) [S4-42][S4-41]. Aceita Markdown, imagens, áudio e LaTeX.

**7. Preço:** Free; Pro a US$ 5/mês com cobrança anual ("Yearly billing saves you $12 a year"), verificado em 2026-10-17 [S4-41]. O valor mensal avulso não é informado [não verificado].

**8. Novidades 2025–2026:** FSRS beta (16/jun/2025); export CSV compatível com Anki (out/2025); modo "Inbox" (26/fev/2026); correção de perda de dados no macOS Tahoe (abr/2026); numeração 26.x a partir de ago/2026 [S4-45].

**9. Forças, fraquezas e reclamações recorrentes:** as forças são a simplicidade, o Markdown, o local-first sem conta e o preço baixo. As fraquezas: sem leitor/PDF, avaliação binária, FSRS sem otimizador e um bug de perda de dados no macOS, já corrigido [S4-45]. Sentimento no Reddit [não verificado].

**10. Relevância para o Monet:**
- Valida o modelo "local grátis sem conta, cobrando só sync e IA".
- Mostra um "SRS mínimo viável": FSRS com parâmetros padrão e avaliação binária.

#### SuperMemo

**1. Posicionamento e público:** pioneiro do SRS e do incremental reading. O SuperMemo for Windows atende autodidatas "hardcore". Já o supermemo.com (SuperMemo World) é um app de cursos de idiomas [S4-50][S4-52]. As páginas de super-memo.com redirecionam (301) para supermemo.store (observado em 2026-10-17) [S4-49].

**2. Fluxo leitura → captura → nota → revisão:** o incremental reading funciona assim: importar artigos (no SM20 também PDF, EPUB e YouTube), ler em porções numa fila priorizada, extrair trechos (extracts) e destilá-los em cloze deletions. "Both extracts and flashcards are scheduled independently from the original article" [S4-51][S4-47].

**3. Highlight → nota:** o extract é o "grifo que vira nota", um elemento filho do artigo na árvore de conhecimento. A herança de referências da fonte e o export [não verificado nesta rodada].

**4. Revisão/recall:** o SM20 roda cinco algoritmos em paralelo (SM-20, SM-19, FSRS, SM-15, SM-2) e dá mais peso ao melhor preditor [S4-47]. Leituras e itens têm filas próprias, ou seja, a resurfacing da leitura é nativa [S4-51].

**5. IA:** convocada e pontual. O SM20 oferece "AI explanations while extracting text", com chave gratuita da API do Google [S4-47]. O supermemo.com tem IA para idiomas (Live mode, MemoChat) [S4-52]. Em 2026 veio a SuperMemo API, com agendamento SM-20 como serviço [S4-53][S4-54].

**6. Plataformas, offline, sync, formatos:** o SM20 roda só no Windows 10/11 (64-bit; há build 32-bit), local e offline [S4-47]. Sync nativo [não verificado]. O supermemo.com roda na web, iOS e Android [S4-52].

**7. Preço:** SuperMemo 20 a US$ 68, "One-time purchase, lifetime license"; SM19 a US$ 34. Ambos apareciam como "Sold out" em 2026-10-17 [S4-47][S4-48]. O SM16 segue freeware [S4-65]. O Premium do supermemo.com [não verificado].

**8. Novidades 2025–2026:** SuperMemo 20 (estável 20.00.32 em 29/jun/2026, segundo a Wikipedia): SM-20, PDF nativo, MathJax, IA, 64-bit e dark mode [S4-50][S4-47]. Quem comprou o SM19 em mar/2026 ganha o upgrade [S4-48].

**9. Forças, fraquezas e reclamações recorrentes:** as forças são o incremental reading nativo, o algoritmo de ponta e a compra única. As fraquezas: só Windows e UI de curva notoriamente íngreme [amplamente relatado; não verificado nesta rodada]. Há poucas reviews públicas [S4-55].

**10. Relevância para o Monet:**
- O incremental reading é o método mais próximo do fichamento: agendar a revisita de grifos e notas de um livro sem exigir cards.
- Adotou IA convocada (explicar ao extrair), a mesma filosofia do Monet.
- É o único rival local-first de Windows para estudo profundo, com UX hostil. Há espaço para um incremental reading amigável.

#### Traverse

**1. Posicionamento e público:** "Mind mapping, spaced repetition flashcards and connected note-taking in one app" ("Notion + Miro + Anki"), criado por Dom Zijlstra (Mandarin Blueprint) [S4-56].

**2. Fluxo leitura → captura → nota → revisão:** mapas num whiteboard infinito e notas atômicas com links bidirecionais. O usuário seleciona um texto e cria um cloze. As notas aceitam PDF, áudio, vídeo e LaTeX [S4-56][S4-57].

**3. Highlight → nota:** seleção → cloze dentro da nota. Grifo de PDF com link de volta [não verificado].

**4. Revisão/recall:** SRS com dashboard de streaks e mastery. O algoritmo não é nomeado [não verificado]. Importa decks do Anki ("100% Anki-compatible") [S4-56].

**5. IA:** não é mencionada no site nem na App Store [não verificado].

**6. Plataformas, offline, sync, formatos:** web (no desktop e no navegador mobile), então Windows só pelo navegador; há app iOS [S4-56][S4-57]. Offline [não verificado].

**7. Preço:** freemium. Na App Store, a compra "Traverse Member" custa US$ 15,00, sem periodicidade informada [S4-57]. O AlternativeTo cita US$ 9–15/mês [S4-58]. A página de preços não renderizou (2026-10-17).

**8. Novidades 2025–2026:** nenhuma encontrada. O app iOS parou na 1.0.8 (18/jul/2024) [S4-57], sinal de baixa atividade.

**9. Forças, fraquezas e reclamações recorrentes:** a força é juntar visual, SRS e import do Anki. As fraquezas: nota 2,7/5 na App Store (24 avaliações) e nenhum app desktop [S4-57].

**10. Relevância para o Monet:**
- Para o estudo de longo prazo, a durabilidade dos dados pesa mais que features: um produto parado é risco, o que favorece o local-first do Monet.

#### Brainscape

**1. Posicionamento e público:** flashcards "made for serious learners focused on long-term retention", com decks "Certified" feitos por especialistas para exames, idiomas e certificações. Atende estudantes, profissionais e escolas (Enterprise) [S4-60][S4-59].

**2. Fluxo leitura → captura → nota → revisão:** não há leitor. O usuário cria cards à mão ou os gera com IA a partir de notas, PDFs ou imagens. O Drill Mode estuda o deck inteiro sem SRS [S4-60][S4-61].

**3. Highlight → nota:** não se aplica. Link de volta à fonte [não verificado].

**4. Revisão/recall:** Confidence-Based Repetition: o usuário dá uma nota de confiança de 1 a 5, e os itens de baixa confiança voltam antes [S4-63][S4-61]. Em out/2026 a empresa prometeu um algoritmo customizável e um modo Quiz [S4-62].

**5. IA:** AI flashcard maker convocado pelo usuário: "100s" de cards no Free e ilimitado no Pro [S4-59].

**6. Plataformas, offline, sync, formatos:** web, iOS e Android; Windows só via web [S4-60]. Offline [não verificado].

**7. Preço:** o site mostra Pro a "$7.99/mo" com o rótulo "Year". Na App Store: US$ 19,99/mês, US$ 59,99/6 meses, US$ 95,99/ano ou US$ 199,99 vitalício (2026-10-17) [S4-59][S4-61].

**8. Novidades 2025–2026:** criação por IA a partir de notas/PDF; app 4.20260923 (out/2026) [S4-61].

**9. Forças, fraquezas e reclamações recorrentes:** nota 4,8/5 no Trustpilot (599 reviews). Os elogios vão para a simplicidade e a preparação para provas. A reclamação recorrente é o agendamento: um card bem avaliado "can go months and months without appearing again" (6/out/2026). Também aparecem um bug de criação no iOS "since February 2025" e decks prontos atrás do paywall [S4-62].

**10. Relevância para o Monet:**
- A autoavaliação de 1 a 5 é um recall simples, mas um agendamento opaco gera desconfiança. Se o Monet tiver revisão, deve mostrar por que cada item voltou.
- Decks prontos para provas não são a persona do Monet; não vale competir aqui.

#### Algoritmos de SRS em 2026 (FSRS vs. SM-2 etc.)

O FSRS (open-source, de Jarrett Ye) virou o padrão fora do SuperMemo. Está no Anki desde a 23.10, como opção manual, e na versão FSRS-6 desde a 25.07 [S4-20][S4-21][S4-25]. O RemNote o oferece em beta, com SM-2 como padrão [S4-8], e o Mochi como opção sem otimizador [S4-43]. O SuperMemo 20 o roda ao lado do SM-20 [S4-47]. No srs-benchmark (~350 milhões de revisões de ~10 mil coleções), o FSRS-6 tem log loss de 0,3460, contra 0,3945 do baseline AVG; o FSRS-7 experimental (0,337) e redes RWKV (0,277) vão além [S4-64]. O debate continua: com parâmetros padrão, o FSRS-6 não superaria o SM-2 [S4-31], e fontes secundárias divergem sobre qual algoritmo vem como padrão [S4-54].


### Estudo com IA e pesquisa acadêmica

Nas ferramentas de estudo de massa (Quizlet, Knowt, StudyFetch), domina a IA **geradora**: o aluno envia notas, PDF ou slides, ou grava a aula, e o produto produz sozinho resumos, flashcards, quizzes, podcasts e um "tutor". A elaboração fica com a IA, e o dinheiro vem de paywalls sobre essas gerações. Em 2025–2026 a revisão espaçada virou item básico: o Knowt tem modo SRS no estilo Anki e o Quizlet lançou "Spaced Repetition" em ago/2026. O NotebookLM, renomeado **Gemini Notebook** em jul/2026, fica no meio do caminho: gera artefatos de estudo, mas ancorados nas fontes, com citações clicáveis. As ferramentas acadêmicas (Elicit, Consensus, SciSpace, Asta) convergem para IA **convocada e ancorada**, com citação por sentença ou trecho exato do paper, e caminham para agentes, MCP e preços mais altos. Nenhuma cobre o ciclo leitura longa → grifo → nota → revisão de um livro. O mais próximo de "leitura aumentada" é o Semantic Reader.

#### Quizlet

**1. Posicionamento e público:** Plataforma de flashcards de massa (ensino médio e graduação, foco EUA), hoje vendida como "AI study", com uma enorme biblioteca comunitária de sets.

**2. Fluxo leitura → captura → nota → revisão:** Não é leitor. O aluno digita, cola ou envia notas, ou grava/carrega uma aula ("Audio Recording"), e o app gera o set de flashcards e o study guide. A revisão acontece em Flashcards, Learn (adaptativo), Practice Tests, Match e no novo Spaced Repetition [S5-1][S5-2].

**3. Highlight → nota:** Inexistente. Não há grifo nem vínculo com a página da fonte; a "captura" é o upload que vira set.

**4. Revisão/recall:** Learn adaptativo e testes simulados. "Spaced Repetition" com "Retention Insights" foi anunciado em 2026-08-04 [S5-2][S5-3]. No plano grátis, Learn e Test têm limite diário [S5-5].

**5. IA:** Disparada pelo upload, mas **geradora**. O Magic Notes, que a App Store hoje descreve como "Flashcards & Study Guides" a partir de notas enviadas, cria cards, guias e testes. "Ask Quizlet" dá explicações e "Podcasts" transforma notas em áudio [S5-1]. O Q-Chat (tutor) teria sido descontinuado em jun/2025, segundo terceiros; não achei anúncio oficial [S5-7][S5-8] [não verificado]. Não há ancoragem com citação documentada.

**6. Plataformas, offline, sync, formatos:** Web, iOS e Android; no Windows, só pelo navegador. Reviews citam offline no app móvel como benefício do Plus [não verificado em fonte oficial]. Entradas: texto, notas/PDF e áudio/vídeo de aula.

**7. Preço:** Grátis com anúncios e limites. Na web, segundo terceiros (checado em 2026-09-08 e 2026-10-15): Plus US$7,99/mês ou US$35,99/ano; Plus Unlimited US$9,99/mês ou US$44,99/ano [S5-5][S5-6]. Na App Store (oficial, 2026-10-17): Plus US$9,99 e US$44,99; Plus Unlimited US$44,99; "Quizlet Go" US$44,99 [S5-1]. A página oficial de upgrade bloqueou o acesso (403).

**8. Novidades 2025–2026:** fev/2026: aquisição do Coconote (áudio/vídeo → notas, quizzes, flashcards) e ferramentas de "explicação → prática" [S5-4]. mar/2026: app nativo dentro do ChatGPT [S5-9]. ago/2026: Audio Recording, Podcasts, Spaced Repetition, Charms (jogo), Study With Friends e add-on para Google Classroom [S5-2].

**9. Forças, fraquezas e reclamações recorrentes:** Forças: escala, biblioteca de sets e gamificação. Fraquezas: o paywall avança sobre Learn e Test. A nota no Trustpilot é 1,4/5, com queixas de "predatory pricing" e cobranças após o trial; reviews apontam fragilidade em STEM com problemas de várias etapas [S5-5].

**10. Relevância para o Monet:**
- O SRS deixou de ser nicho: até o Quizlet o adotou (ago/2026). A falta de revisão é a maior lacuna funcional do Monet diante do mercado de estudo.
- A hostilidade ao paywall de funções básicas de estudo reforça o diferencial "grátis + local".
- "Upload → a IA gera os cards" contraria a tese do Monet. A alternativa coerente é o card nascer do grifo ou da nota do usuário, com IA só via /comando.

#### Knowt

**1. Posicionamento e público:** "The #1 Quizlet Alternative with AI Study Tools". Flashcards grátis e foco em provas AP/SAT/ACT (ensino médio e graduação, EUA) [S5-10].

**2. Fluxo leitura → captura → nota → revisão:** O usuário importa sets do Quizlet ou cria flashcards e notas, à mão ou com IA, a partir de PDF, vídeo, PPT, imagem ou gravação ao vivo de aula ("Live Lecture Note Taker"). Estuda nos modos Flashcards, Learn, Spaced Repetition, Practice Test e Match [S5-10][S5-12].

**3. Highlight → nota:** Não há grifo. "Create flashcards from my notes" transforma a nota em cards, sem vínculo com a página da fonte [S5-12].

**4. Revisão/recall:** O modo Spaced Repetition usa os botões Again/Hard/Good/Easy e permite ajustar o limite de cards novos por dia e os intervalos; o algoritmo não é documentado [S5-13]. O Learn mode é "unlimited" no grátis [S5-10].

**5. IA:** Convocada (upload ou pedido) e geradora: summarizers, "AI to write my notes", flashcards por IA e "Kai" (chat, "Call Kai" por voz, quiz falado, podcast), além do "Kai Complete", um autocompletar que pode ser desligado [S5-12]. O grátis tem cota mensal de IA com contador ("AI usage resets in N days"), e as funções do Ultra são marcadas com coroa [S5-14]. Ancoragem com citação: não documentada.

**6. Plataformas, offline, sync, formatos:** Web, iOS, Android e extensão Chrome. No Windows, só pelo navegador. Offline [não verificado] [S5-10].

**7. Preço:** Basic grátis: criação ilimitada, colaboração e 5 milhões de recursos. Ultra: US$24,99/mês ou US$149,99/ano pagos à vista (a página exibe "US$12,99 por mês"), com trial de 3 dias. O Ultra inclui summarizers de PDF/vídeo/PPT, resumo de aula gravada, gerador de podcast, tutor por voz e AP/SAT/ACT Prep (knowt.com/plans, 2026-10-17) [S5-11].

**8. Novidades 2025–2026:** "Call Kai" (voz), "Snap & Solve" e turmas/assessments para professores aparecem na central de ajuda [S5-12]. Datas exatas [não verificado].

**9. Forças, fraquezas e reclamações recorrentes:** Forças: grátis generoso para cards e SRS, e importação do Quizlet. Fraquezas: a IA que importa migrou para o Ultra, com mensal caro para estudante, e o foco é prova padronizada, não leitura longa. Sentimento no Reddit [não verificado nesta rodada].

**10. Relevância para o Monet:**
- O padrão Anki (Again/Hard/Good/Easy) é o modelo mental de SRS que o usuário espera, inclusive em apps de massa.
- "Importar do concorrente" foi a alavanca de aquisição do Knowt. Para o Monet, importar Kindle, Readwise ou Anki pode cumprir o mesmo papel.

#### StudyFetch

**1. Posicionamento e público:** "The trusted AI learning platform for students". Transforma o material do curso em ferramentas de estudo e em um tutor de IA, para universitários [S5-15].

**2. Fluxo leitura → captura → nota → revisão:** O aluno envia PDF, PPT, vídeo, link do YouTube, foto de notas ou gravação, ou só digita um tema. O app gera notas estruturadas, flashcards, quizzes, testes, jogos ("Arcade") e um Study Plan com "cram mode". O "Live Lecture" gera notas e dicas durante a própria gravação da aula [S5-15][S5-16].

**3. Highlight → nota:** Não há grifo. O FAQ diz que cada item gerado cita sua fonte [S5-15] (granularidade [não verificado]).

**4. Revisão/recall:** Flashcards, quizzes, testes, Study Plan com prazos e streaks. SRS não documentado [não verificado].

**5. IA:** Proativa, geradora e em papel de tutor. O tutor agora se chama "Sparky" (antes Spark.E; a App Store ainda vende "Call Spark.E") e oferece chat, tutoria por voz ("Tutor Me"), explainer videos e audio recaps [S5-15][S5-16]. Um review relata recaps com conteúdo que não estava nas notas [S5-17].

**6. Plataformas, offline, sync, formatos:** Web, iOS e Android com sync. No Windows, só pelo navegador; não há modo offline [S5-15][S5-17]. São 20+ idiomas, mas só um por vez na transcrição e nos cards [S5-16][S5-17].

**7. Preço:** Plano grátis com limites vagos. Na App Store (oficial, 2026-10-17): Premium US$19,99/mês, US$29/trimestre ou US$96/ano; "Call Spark.E" US$7,49 por 1 h ou US$25 por 5 h; "Explainers" de US$9,99 a US$19,99 [S5-16]. Não há página pública de preços [S5-17].

**8. Novidades 2025–2026:** Tutor renomeado "Sparky", "Tutor Me" (beta em 2026) e Live Lecture com notas em tempo real [S5-15][S5-18].

**9. Forças, fraquezas e reclamações recorrentes:** Forças: aceita muitos formatos, e flashcards e chat foram bem avaliados no review do tl;dv (mar/2026). A queixa mais consistente é cobrança após o cancelamento. Também aparecem limites imprevisíveis no grátis, Live Lecture só para um locutor, notas com markdown quebrado, app Android instável e desempenho fraco com diagramas e matemática. No Trustpilot, 4,1/5 (255 reviews) [S5-17][S5-18].

**10. Relevância para o Monet:**
- É o "anti-Monet": uma IA que estuda pelo aluno. Serve de contraste claro no posicionamento.
- Gravar a aula e virar nota é demanda real no acompanhamento de curso, mas as queixas mostram que qualidade e confiabilidade pesam mais que a quantidade de features.
- Transparência de limites e de cobrança é um diferencial barato.

#### Notion for students

**1. Posicionamento e público:** Workspace genérico (docs + databases) com plano educacional gratuito. O estudante o usa como planner, caderno de curso e "second brain" [S5-20].

**2. Fluxo leitura → captura → nota → revisão:** Captura por digitação, Web Clipper ou upload/embed de PDF; organização em databases (cursos, leituras); revisão manual. Não há leitor com grifos nem SRS nativo, então o fichamento de livro depende de templates.

**3. Highlight → nota:** Não há grifo em PDF. A citação é copiar e colar, sem link para a página (integrações de terceiros, como Readwise, exportam para o Notion, mas estão fora deste escopo).

**4. Revisão/recall:** Sem SRS nativo. Existem templates comunitários de flashcards e Cornell [não verificado nesta rodada].

**5. IA:** Convocada: Notion Agent, AI Meeting Notes, Enterprise Search e Research mode. Pelo FAQ, "Notion AI is available on Business and Enterprise Plans"; Free e Plus recebem só "a limited number of complimentary AI responses" [S5-23][S5-19]. Custom Agents são grátis para testar e depois custam US$10 por 1.000 créditos/mês [S5-19]. A página de educação não diz que o estudante tem IA [S5-20].

**6. Plataformas, offline, sync, formatos:** Web, Windows, macOS, iOS e Android. Offline: qualquer usuário pode marcar páginas como "Available offline"; Business e Enterprise baixam as recentes e favoritas automaticamente. De um database, só as 50 primeiras linhas baixam sozinhas [S5-22]. Exige conta e sync em nuvem.

**7. Preço:** Free; Plus US$10; Business US$20; Enterprise sob consulta, por membro/mês, com até 20% de desconto no anual (notion.com/pricing, 2026-10-17) [S5-19]. Education Plan: o Plus com 1 membro é grátis para quem tem e-mail de universidade credenciada (K-12 não entra), com reverificação anual [S5-19][S5-20].

**8. Novidades 2025–2026:** Em 2026: model picker com scorecards (ago), agentes que propõem edições para aprovação (ago), app iOS para Notion Agents e sub-agentes (Notion 3.7, set) e MCP com 150+ ferramentas externas (Notion 3.8, 2026-10-13) [S5-21]. De 2025, a mudança que concentrou a IA no Business, o Notion 3.0 com Agents e o offline mode [não verificado nesta rodada: a página de releases só mostrou jul–out/2026].

**9. Forças, fraquezas e reclamações recorrentes:** Forças: flexibilidade, plano estudantil grátis e templates. Para estudo profundo, faltam leitor com grifo e SRS; a IA completa só vem no Business (US$20); o offline é parcial; e é trabalhoso montar o próprio sistema. Sentimento [não verificado].

**10. Relevância para o Monet:**
- O estudante do Notion monta à mão o que o Monet oferece pronto: leitor + grifo → nota com fonte.
- A IA paga e voltada a equipes (Business) deixa o estudante individual sem IA, o que abre espaço para a IA por /comando do Monet.
- "Offline por página marcada" contra local-first total é um argumento claro de comunicação.

#### NotebookLM (agora Gemini Notebook) — modo estudo

**1. Posicionamento e público:** "AI Research Tool & Thinking Partner" sobre as fontes do próprio usuário. Foi renomeado Gemini Notebook em 2026-07-16 (Wikipedia, citando The Verge) [S5-33], e a central de ajuda já usa o nome novo [S5-26]. Os notebooks aparecem também no app Gemini, sincronizados [S5-32].

**2. Fluxo leitura → captura → nota → revisão:** Fontes (PDF, ePub, ebooks do Play Books, Docs/Slides/Sheets, Word, Markdown, web, YouTube, áudio, imagens; até 500 mil palavras ou 200 MB por fonte) [S5-30] → chat → "Save to note" → Studio (Flashcards, Quizzes, Mind Maps, Reports, Audio/Video Overviews, Slide Decks, Infographics) [S5-24][S5-26].

**3. Highlight → nota:** "Save to note" preserva "clickable inline citations" [S5-31]. Grifo ou anotação nas fontes: não encontrado [não verificado].

**4. Revisão/recall:** Flashcards e quizzes com dificuldade, quantidade e botão "Explain". O usuário marca "Got it!/Missed it!", o progresso é guardado e dá para treinar só os cards errados; exporta CSV. Não há SRS documentado [S5-29].

**5. IA:** Convocada e ancorada: as respostas usam "direct quotes… from your sources as citations"; passar o mouse mostra o trecho e clicar abre no contexto. O estilo "Learning Guide" faz tutoria socrática [S5-31][S5-24]. O Studio gera artefatos sob demanda.

**6. Plataformas, offline, sync, formatos:** Web e apps Android/iOS (versões de out/2026) [S5-33]; sem app Windows e sem offline [não verificado].

**7. Preço:** Standard grátis: 100 notebooks, 50 fontes por notebook. Pro: 500/300 [S5-27]. As cotas são por computação, renovam a cada 5 h até um teto semanal; o AI Plus dá 2× e o AI Pro 4× o padrão [S5-28]. AI Plus US$4,99/mês e AI Pro US$19,99/mês; no Brasil, R$24,99 e R$96,99 (2026-10-17) [S5-34][S5-35].

**8. Novidades 2025–2026:** Flashcards, quizzes e Learning Guide em 2025-09-08 [S5-24][S5-25]. Slide Decks e Infographics em nov/2025, Short Video Overviews em jul/2026 e o rename em 2026-07-16 [S5-33].

**9. Forças, fraquezas e reclamações recorrentes:** Força: a ancoragem com citação é a referência do mercado. Fraquezas: não é leitor nem anotador, e os flashcards não têm agendamento [S5-29]. Sentimento [não verificado].

**10. Relevância para o Monet:**
- É o benchmark de "IA ancorada": citação clicável até o trecho e nota salva com a citação. O Monet deveria igualar isso (citação → página do PDF/EPUB).
- Flashcards sem SRS real, em um produto que não é leitor, deixam aberto o nicho "grifo do usuário → nota → revisão".

#### Elicit

**1. Posicionamento e público:** "Assistente de pesquisa" para revisão de literatura e decisões baseadas em evidência. Em 2026 o blog mira claramente pharma/biopharma [S5-37].

**2. Fluxo leitura → captura → nota → revisão:** Busca em 138M+ papers → resumos e tabelas de extração em colunas → Reports e Systematic Review → Library compartilhada [S5-36][S5-37].

**3. Highlight → nota:** n/a. Não há grifo; importa do Zotero [S5-36].

**4. Revisão/recall:** n/a. Alerts e Routines (monitoramento recorrente de evidências) [S5-37].

**5. IA:** Convocada e ancorada: "View sources for answers" e explicações das respostas geradas. O Research Agent (2026-08-04) executa tarefas de várias etapas [S5-36][S5-37].

**6. Plataformas, offline, sync, formatos:** Só web, sem offline. API e MCP desde 2026 [S5-37].

**7. Preço:** Basic grátis: busca, resumos e chat com papers ilimitados; Agent e Reports limitados. Pro US$49/usuário/mês (US$588/ano); Scale US$169 (US$2.028/ano); Enterprise sob consulta (elicit.com/pricing, 2026-10-17) [S5-36]. Desde jul/2026, o uso vem de um pool mensal [S5-38].

**8. Novidades 2025–2026:** Systematic Review, Reports e Série A de US$22M (fev/2025); Alerts (jun/2025); API (mar/2026); fluxo PRISMA 2020 (mai/2026); Research Agent (ago/2026); Routines (set/2026) [S5-37].

**9. Forças, fraquezas e reclamações recorrentes:** Força: rastreabilidade. Fraqueza: entrada paga cara para indivíduos. Sentimento [não verificado].

**10. Relevância para o Monet:**
- O mercado acadêmico de IA está subindo de preço e saindo do alcance do autodidata.

#### Consensus

**1. Posicionamento e público:** "AI academic search engine for peer-reviewed literature" e "research OS" [S5-39].

**2. Fluxo leitura → captura → nota → revisão:** Pergunta em linguagem natural → Consensus Meter (grau de concordância) → Pro ou Deep (síntese com tabela de evidências, linha do tempo e lacunas) → Study Snapshots e Ask Paper → Library/coleções e Citation Graph [S5-39][S5-42].

**3. Highlight → nota:** Exporta RIS/BibTeX/CSV e importa de Zotero, EndNote e Mendeley [S5-42].

**4. Revisão/recall:** n/a.

**5. IA:** Convocada e fortemente ancorada. O "Citation Grounding" liga cada citação a uma frase exata do paper, com a seção e o trecho destacado no PDF; um check indica que o texto completo foi lido [S5-41][S5-42]. O Research Agent registra cada passo [S5-41].

**6. Plataformas, offline, sync, formatos:** Web; roda dentro do ChatGPT, do Claude e do Microsoft 365 Copilot ("Consensus Everywhere", set/2026) [S5-43]. Sem offline.

**7. Preço:** "Free to start" [S5-43]. A página de preços só renderiza com JS; os metadados mostram 5 ofertas a partir de US$0 [S5-39]. Valores [não verificado].

**8. Novidades 2025–2026:** Corpus ampliado de ~250M para 400M+ fontes via editoras e Citation Grounding (mai–ago/2026) [S5-41]. Parceria com a AAAS, Research Gaps Matrix, figuras nas respostas e Skills (set–out/2026) [S5-40].

**9. Forças, fraquezas e reclamações recorrentes:** Sentimento [não verificado].

**10. Relevância para o Monet:**
- "Citação → trecho destacado no PDF" é exatamente o elo de que o chat do livro do Monet precisa.
- Distribuir o produto via MCP e assistentes é tendência.

#### SciSpace

**1. Posicionamento e público:** "AI research assistant for understanding scientific literature", para pós-graduandos e pesquisadores [S5-44].

**2. Fluxo leitura → captura → nota → revisão:** O usuário lê o paper/PDF no navegador. O "Copilot" explica o trecho selecionado (jargão, siglas, parágrafos) e recortes de equações e tabelas; acha papers relacionados ao trecho; salva em coleções; e há Literature Review sobre 270M+ papers [S5-44].

**3. Highlight → nota:** Explicação sobre a seleção; notas [não verificado].

**4. Revisão/recall:** n/a.

**5. IA:** Convocada sobre a seleção. O follow-up responde "with citations" e indica a "location of the source" [S5-44].

**6. Plataformas, offline, sync, formatos:** Web e extensão Chrome: cerca de 300 mil usuários, v1.5.9, atualizada em 2026-10-09, nota 4,3/5 [S5-44].

**7. Preço:** [não verificado]. O site scispace.com bloqueou o acesso (403) em 2026-10-17.

**8. Novidades 2025–2026:** [não verificado].

**9. Forças, fraquezas e reclamações recorrentes:** [não verificado].

**10. Relevância para o Monet:**
- "Explique este trecho" sobre a seleção, com citação de onde ele está, é o /comando mais natural no leitor do Monet (grifo → /explicar).

#### Scholarcy

**1. Posicionamento e público:** Resumo estruturado de artigos ("Summary Flashcards") para estudantes e pesquisadores [S5-45].

**2. Fluxo leitura → captura → nota → revisão:** Ao abrir o artigo (HTML ou PDF), a extensão gera um "referenced summary with important points highlighted", uma lista de leitura de fundo, PDFs abertos das referências, as figuras e tabelas e uma "Comparative Analysis" de como o paper se apoia em trabalhos anteriores [S5-45].

**3. Highlight → nota:** Os Summary Flashcards (premium) podem ser salvos, compartilhados, anotados e exportados [S5-45].

**4. Revisão/recall:** "Flashcard" aqui é ficha-resumo, não SRS.

**5. IA:** Proativa: resume ao abrir o artigo.

**6. Plataformas, offline, sync, formatos:** Web e extensão Chrome: cerca de 80 mil usuários, v5.4.0, atualizada em 2026-03-14 [S5-45].

**7. Preço:** [não verificado]; o site retornou 403. Assinantes da Scholarcy Library têm uso ilimitado da extensão [S5-45].

**8. Novidades 2025–2026:** [não verificado].

**9. Forças, fraquezas e reclamações recorrentes:** [não verificado].

**10. Relevância para o Monet:**
- É um "fichamento automático" e serve de contraexemplo: o Monet pode expor a estrutura (seções, referências) sem escrever o fichamento pelo usuário.

#### ResearchRabbit

**1. Posicionamento e público:** Descoberta de literatura: "analyzes papers you love and finds the research you've been missing". Declara 310M+ papers e 1M+ pesquisadores [S5-46].

**2. Fluxo leitura → captura → nota → revisão:** Seed papers → mapa de ideias e grafo de citações configurável → coleções compartilháveis, integradas à biblioteca de referências [S5-46].

**3. Highlight → nota:** n/a.

**4. Revisão/recall:** Alertas "Signals" no RR+ [S5-47].

**5. IA:** Recomendação algorítmica que "aprende" com as buscas, sem gerar texto [S5-46].

**6. Plataformas, offline, sync, formatos:** Web.

**7. Preço:** Free: buscas e coleções ilimitadas, até 50 seeds. RR+: US$10/mês no anual ou US$12,5 no mensal, com 300 seeds, múltiplos projetos e Signals; descontos por paridade de compra em 100+ países. Institution sob consulta (2026-10-17) [S5-47].

**8. Novidades 2025–2026:** Nova versão com plano pago RR+; o site cita Aaron Tay elogiando "a more configurable citation graph". O rodapé diz "Copyright © Litmap Limited. 2016-2026", indício de que o ResearchRabbit passou à empresa do Litmaps; anúncio formal [não verificado] [S5-46][S5-47].

**9. Forças, fraquezas e reclamações recorrentes:** [não verificado].

**10. Relevância para o Monet:**
- Baixa: descoberta por grafo de citações está fora do fichamento de livro.

#### Litmaps

**1. Posicionamento e público:** "Your Literature Review Assistant": mapas visuais de citações, com 350k+ pesquisadores declarados [S5-49].

**2. Fluxo leitura → captura → nota → revisão:** Seed → Discover → Visualize (data × citações) → Share → Monitor (alertas de novos papers) [S5-49].

**3. Highlight → nota:** n/a.

**4. Revisão/recall:** n/a (só alertas).

**5. IA:** Algoritmos de recomendação; o site não menciona IA generativa [S5-49].

**6. Plataformas, offline, sync, formatos:** Web.

**7. Preço:** Free: até 20 inputs, mapas de 100 artigos, resumo mensal. Pro: US$10/mês ou US$120/ano; o anual exige e-mail acadêmico. Team sob consulta (2026-10-17) [S5-48].

**8. Novidades 2025–2026:** Provável incorporação do ResearchRabbit (ver acima) [não verificado].

**9. Forças, fraquezas e reclamações recorrentes:** [não verificado].

**10. Relevância para o Monet:**
- Baixa.

#### Semantic Reader (Ai2) + Asta

**1. Posicionamento e público:** Leitor "aumentado" e gratuito de papers científicos, da Ai2/Semantic Scholar [S5-50].

**2. Fluxo leitura → captura → nota → revisão:** PDF no navegador com Citation Cards (TLDR do paper citado, inline), "Skimming highlights" de IA (Goal/Method/Result, com número e opacidade ajustáveis), definições sob demanda ao clicar num termo, sumário e "Save to Library" [S5-50].

**3. Highlight → nota:** Grifos e notas via conta Hypothesis (beta) [S5-50].

**4. Revisão/recall:** Research Feeds e alertas [S5-51].

**5. IA:** Mista. Os overlays são proativos, mas opcionais; as definições e o "Ask This Paper" (respostas com trechos de apoio, em parte dos papers) são convocados [S5-50][S5-51].

**6. Plataformas, offline, sync, formatos:** Web, pensada para tela grande; cobre sobretudo papers do arXiv [S5-50].

**7. Preço:** Grátis.

**8. Novidades 2025–2026:** O Asta foi anunciado em 2025-08-26, com Paper Finder, Scholar QA ("every claim backed by a clickable citation and often an inline excerpt") e análise de dados (beta), em agentes open source [S5-52][S5-53].

**9. Forças, fraquezas e reclamações recorrentes:** Força: leitura assistida sem chat. Fraqueza: cobertura limitada ao arXiv.

**10. Relevância para o Monet:**
- Definição sob clique e card da citação são ótimas ideias de /comando para o leitor.
- Até a Ai2 terceiriza a anotação para o Hypothesis: grifo + nota ancorados seguem como diferencial.

> **Nota de contexto (pesquisa acadêmica):** Aaron Tay (bibliotecário, 2026-06-08) argumenta que "the freeform chatbot is the wrong mental model for academic search". Para ele, "Deep Research is mostly meant for helping to orientate yourself", e a cobertura desses motores depende de editoras que "now have a strong commercial incentive to close off" o texto completo [S5-54].


### Anotação de cursos, aulas e vídeo

O grupo se divide em três polos. (i) **Anotação manual ancorada no tempo**: plugins do Obsidian (Media Extended, Timestamp Notes, Timecodes), extensões que levam notas com tempo ao Notion (Snipo), grifo de transcrição no Glasp e as notas nativas das plataformas de curso. Aqui a nota guarda um link de volta ao instante do vídeo. (ii) **Captura + IA proativa** (Recall, Mindgrasp, Otter.ai, Notta): resumo, flashcards, quiz e "study guides" são gerados automaticamente, e o esforço de elaboração passa para a máquina. (iii) **Áudio/podcast** (Snipd): snips criados por gesto e um "daily recap" com spaced repetition. Em 2025–2026 houve três movimentos: plataformas de curso se consolidaram e embutiram tutor de IA (Coursera + Udemy, agora uma só empresa); transcritores passaram a mirar estudantes (Otter "Back to School" 2026, com quizzes); e a questão de consentimento em gravação virou processo judicial (ação coletiva contra a Otter). Nenhum produto pesquisado une timestamp, fichamento estruturado multi-sessão e revisão de longo prazo num app local-first para Windows.

#### Obsidian — Media Extended (e Timestamp Notes / Timecodes)
**1. Posicionamento e público:** plugins comunitários para estudar vídeo e áudio dentro do vault Markdown local. O público é PKM, autodidata [S6-1][S6-4].
**2. Fluxo leitura → captura → nota → revisão:** abre vídeo local, YouTube ou Vimeo dentro do Obsidian → um clique ou comando insere link para o instante e screenshot (com recorte) → nota Markdown comum → revisão apenas com outros plugins, como o Spaced Repetition [S6-1][S6-44].
**3. Highlight → nota:** link de timestamp clicável que volta ao momento, e screenshot embutido com link à fonte. Transcrições `.srt`/`.vtt` podem ser vinculadas à mídia para navegação e busca [S6-1][S6-2]. O Timecodes torna clicáveis os timestamps digitados abaixo de um link do YouTube [S6-6].
**4. Revisão/recall:** nenhuma nativa.
**5. IA:** nenhuma no plugin.
**6. Plataformas, offline, sync, formatos:** Media Extended é "Desktop only" (roda no Windows) e exige Obsidian 1.14.4+. Timestamp Notes também é desktop only: v1.0.8, sem atualização há 4 anos, 26 mil downloads [S6-1][S6-4]. Funciona offline com mídia local; o sync é o do Obsidian.
**7. Preço:** grátis no diretório oficial, sem preço exibido (aceita GitHub Sponsors). Consulta em out/2026 [S6-1].
**8. Novidades 2025–2026:** a v4 passou a ter código fechado; a v3 continua MIT [S6-1]. A 4.0.0-beta.1 saiu em abr/2025 [S6-3] e o diretório mostra a v4.2.9 atualizada em out/2026 [S6-1]. O plugin Timecodes surgiu em fev/2025, instalável via BRAT [S6-6].
**9. Forças, fraquezas e reclamações recorrentes:** a força é o dado local com link exato ao instante. As fraquezas são plugins órfãos, ausência de mobile e o risco trazido pelo fechamento do código. No fórum (fev/2025), um usuário reclama que os guias estão "all over 2 years old"; outro diz "I don't want content generated for me" [S6-5].
**10. Relevância para o Monet:**
- "Link de timestamp + screenshot na nota" é o equivalente, em vídeo, da citação de grifo do Monet: a fonte deixa de ser página e passa a ser tempo.
- Vincular `.srt`/`.vtt` à mídia sugere um atalho barato: tratar a transcrição da aula como um "livro" na Library, com grifo, busca e RAG, sem construir ASR.

#### Notion (embeds + extensões como Snipo; AI Meeting Notes)
**1. Posicionamento e público:** workspace generalista muito usado por estudantes. O plano Plus é grátis para estudantes e educadores com e-mail escolar (limite de 1 membro) [S6-7].
**2. Fluxo leitura → captura → nota → revisão:** o vídeo é embutido na página, mas o Notion não sincroniza nota com o tempo do vídeo. Extensões como a Snipo capturam nota com tempo e screenshot de YouTube, Udemy, Coursera, Skillshare e LinkedIn Learning e enviam ao Notion [S6-9]. A revisão é manual ou feita com databases.
**3. Highlight → nota:** pela Snipo, "Take notes with time while watching videos" mais screenshots. O site não diz se há link de volta ao instante [S6-9]. Sem extensão, o caminho é colar links do YouTube com parâmetro de tempo [não verificado].
**4. Revisão/recall:** sem SRS nativo. A Snipo gera "AI Flashcards" com export para o Anki "in one click" [S6-9].
**5. IA:** Notion AI é convocada; nos planos Free/Plus há só trial. O AI Meeting Notes transcreve e resume em tempo real, com "Consent disclosures", e fica no plano Business [S6-7][S6-8]. Na Snipo, os flashcards são gerados por IA sob comando.
**6. Plataformas, offline, sync, formatos:** web, desktop e mobile, com sync na nuvem. A Snipo roda em Chrome, Edge e Firefox [S6-9]. Offline [não verificado].
**7. Preço:** a página lista Plus a US$ 10 e Business a US$ 20 por membro/mês, com "Save up to 20%" no anual (out/2026) [S6-7]. A Snipo diz "Install for free" e não mostra preço de plano pago [S6-9].
**8. Novidades 2025–2026:** Notion Agent, AI Meeting Notes, Enterprise Search e Research mode concentrados no Business. Custom Agents custam US$ 10 por 1.000 créditos mensais [S6-7].
**9. Forças, fraquezas e reclamações recorrentes:** as forças são onipresença e templates. As fraquezas são depender de extensões de terceiros para timestamp e ter a IA de transcrição só no plano mais caro [análise].
**10. Relevância para o Monet:**
- O estudante de curso já resolve o timestamp com extensão + Notion. O Monet compete na organização multi-sessão e na revisão, não na captura.
- Gravar e transcrever aula presencial virou recurso premium de suíte (Notion Business), fora do escopo local-first do Monet.

#### Glasp (YouTube)
**1. Posicionamento e público:** "social web highlighter" com extensão de resumo e grifo de YouTube, para aprendizes de web e vídeo [S6-10].
**2. Fluxo leitura → captura → nota → revisão:** assiste no YouTube → abre a transcrição no painel da extensão → grifa trechos da transcrição → os highlights vão ao perfil Glasp → export/sync [S6-11].
**3. Highlight → nota:** o highlight é salvo com timestamp; "clicking the timestamp (Ex: 03:23) opens the original YouTube video and starts playing from that time". Dá para adicionar nota por highlight [S6-11]. Export: auto-sync diário com o Notion (todos os planos), plugin Obsidian, integração Readwise e Markdown/HTML/CSV/JSON [S6-10].
**4. Revisão/recall:** sem SRS ou quiz identificado [não verificado].
**5. IA:** convocada. O resumo "Basic" envia transcrição e prompt ao ChatGPT, Claude ou Gemini escolhido; o "Advanced" é escrito pela Glasp e exibido ao lado do vídeo [S6-10].
**6. Plataformas, offline, sync, formatos:** extensão de navegador desktop; no mobile só se veem os highlights [S6-11]. Formatos: web, YouTube, PDF e áudio (cotas). Sem offline.
**7. Preço:** Free com 3 resumos básicos/dia e highlights públicos ilimitados (privados não incluídos). Pro: US$ 15/mês ou US$ 150/ano. Unlimited: US$ 30/mês ou US$ 360/ano. Fonte: glasp.co/pricing, out/2026 [S6-10].
**8. Novidades 2025–2026:** tutorial de grifo em transcrição com timestamp (set/2025) [S6-11]; cotas para PDF, chat e transcrição de áudio no Free [S6-10].
**9. Forças, fraquezas e reclamações recorrentes:** as forças são o export aberto e o timestamp clicável. As fraquezas são os highlights públicos por padrão no Free e a dependência de vídeos com transcrição [S6-10][análise].
**10. Relevância para o Monet:**
- Grifo em transcrição com timestamp clicável é o modelo mais próximo do "grifo → citação" do Monet aplicado a aula em vídeo.
- Privacidade por padrão (tudo local) diferencia o Monet de highlights públicos.

#### Snipd
**1. Posicionamento e público:** app de podcast com IA para capturar, revisar e reutilizar o que se ouve, voltado a quem aprende por podcast e audiobook [S6-13].
**2. Fluxo leitura → captura → nota → revisão:** ouve → toca o fone (ou triple-tap) → "Our AI creates a snip for you with audio, transcript, and summary" → nota privada → sync com o PKM → "daily recap with spaced repetition" [S6-12][S6-13].
**3. Highlight → nota:** o snip guarda trecho de áudio, transcrição, resumo e nota. O plugin oficial do Obsidian sincroniza transcrição, resumo, notas e "Link to snip"; a transcrição completa do episódio é Premium [S6-14]. Também sincroniza com Readwise, Notion, Glasp, Bear e Logseq, ou exporta Markdown [S6-13].
**4. Revisão/recall:** daily recap com spaced repetition, recurso "core" dos dois planos [S6-12].
**5. IA:** o snip é disparado pelo usuário, mas a IA gera resumo, capítulos e mini-resumos sozinha. O chat com o episódio é convocado e só existe no Premium [S6-12][S6-13].
**6. Plataformas, offline, sync, formatos:** mobile (App Store, com CarPlay, Android Auto e Apple Watch), com downloads automáticos para ouvir offline [S6-12]. Sem app Windows [não verificado: web app]. Formatos: podcast, YouTube, audiobooks Libro.fm e arquivos de áudio [S6-13].
**7. Preço:** Free com IA limitada a 2 episódios/semana. Premium a US$ 6,99/mês, trial de 1 semana; o preço anual não aparece e "Prices may vary by country". Consulta em out/2026 [S6-12].
**8. Novidades 2025–2026:** importação de YouTube e audiobooks e IA em 26 idiomas [S6-13]. Plugin Obsidian v1.3.2, atualizado em set/2026 [S6-14].
**9. Forças, fraquezas e reclamações recorrentes:** a força é a captura "hands-free" com contexto automático e export aberto. As fraquezas são o limite de IA no Free e o foco mobile [análise; sentimento não verificado].
**10. Relevância para o Monet:**
- Uma revisão diária leve de trechos (SRS sobre highlights, sem flashcards) cabe na nota diária do Calendar.
- Captura com um gesto que já traz trecho, fonte e tempo é a referência de baixa fricção.

#### Recall (recall.it, ex-getrecall.ai)
**1. Posicionamento e público:** "personal AI knowledge base" que salva e resume artigos, YouTube, podcasts e PDFs. Diz ter "Over 700,000 people" [S6-16].
**2. Fluxo leitura → captura → nota → revisão:** salva pela extensão ou app → a IA "summarizes the content, organizes it into your knowledge base, connects it to related ideas" → chat sobre a base → quizzes com spaced repetition [S6-15][S6-16].
**3. Highlight → nota:** resumos com timestamps (concise ou detailed) mais notas do usuário; grafo de conhecimento automático [S6-15].
**4. Revisão/recall:** quizzes espaçados ("When you answer a question correctly, you see it less often"), no plano Plus [S6-15][S6-16].
**5. IA:** proativa: resume, organiza e liga conteúdos ao salvar. O chat é convocado, sobre a base e/ou a web, com GPT, Claude ou Gemini. Oferece API e MCP [S6-15][S6-17].
**6. Plataformas, offline, sync, formatos:** web, extensões para Chrome, Firefox, Edge e Safari, iOS e Android. Não há app desktop listado nem offline descrito; o "augmented browsing" é "local-first" [S6-15][S6-16].
**7. Preço:** Free com 10 resumos de IA/mês. Plus: US$ 10/mês (anual). Max: US$ 38/mês (anual). Consulta em out/2026 [S6-15].
**8. Novidades 2025–2026:** Recall 2.0 (14/04/2026) trouxe novo nome e domínio, chat agêntico, API/MCP, importação de X e Reddit, o plano Max e aumento de preço do Plus [S6-17].
**9. Forças, fraquezas e reclamações recorrentes:** a força é unir captura, resumo e revisão. A fraqueza é a IA fazer a síntese pelo usuário [análise]; sentimento de usuários [não verificado].
**10. Relevância para o Monet:**
- É o concorrente mais próximo em "captura → revisão" de vídeo, mas com IA proativa. O Monet se diferencia pela elaboração feita pelo usuário.
- Quiz com SRS sobre o material salvo é o que falta ao Monet; pode ser convocado (ex.: /quiz) sobre grifos e notas.

#### Mindgrasp
**1. Posicionamento e público:** "AI study tool" para estudantes. Diz ter "5m+" usuários e 1.500+ escolas (autodeclarado) [S6-18].
**2. Fluxo leitura → captura → nota → revisão:** upload (PDF, DOCX, MP3/MP4, PPT, links, YouTube/Vimeo) ou gravação de aula pelo celular → a IA gera notas, resumo, flashcards e quizzes por "study session" → tutor via chat → progresso por sessão [S6-18].
**3. Highlight → nota:** as notas são geradas por IA; o site não menciona timestamps [S6-18].
**4. Revisão/recall:** flashcards e quizzes automáticos [S6-18]; SRS [não verificado].
**5. IA:** proativa (gera tudo no upload); o tutor é convocado.
**6. Plataformas, offline, sync, formatos:** web, iOS e extensão Chrome que puxa conteúdo de Canvas, Blackboard e Panopto. Android e Windows não são citados [S6-18].
**7. Preço:** o site não mostra preços e a URL /pricing retorna 404 (out/2026). Há um CTA de "free study session" [não verificado].
**8. Novidades 2025–2026:** [não verificado].
**9. Forças, fraquezas e reclamações recorrentes:** a força é a integração com LMS. As fraquezas são preço pouco transparente e IA que substitui o esforço de anotar [análise].
**10. Relevância para o Monet:**
- Representa o polo oposto à tese do Monet ("IA como fim") e serve de contraste de posicionamento.
- "Sessão de estudo por aula" com indicador de progresso é um bom modelo de UI para acompanhamento de curso.

#### Otter.ai
**1. Posicionamento e público:** transcrição e assistente de reuniões, agora mirando estudantes que gravam aulas [S6-19][S6-20].
**2. Fluxo leitura → captura → nota → revisão:** grava a aula (presencial ou virtual) → transcrição ao vivo com falantes → highlights, notas, comentários e imagens em tempo real, com captura de slides → resumo automático → study guides, quizzes e exam prep [S6-19][S6-20].
**3. Highlight → nota:** anotações na transcrição com time codes editáveis e palavra destacada na reprodução. O AI Chat vincula respostas ao ponto exato da gravação [S6-19][S6-20].
**4. Revisão/recall:** "Notes are turned into study guides, quizzes, and exam prep sheets, generated automatically or with a single prompt" (ago/2026) [S6-20]; SRS [não verificado].
**5. IA:** majoritariamente proativa (resumos e outlines automáticos). O chat é convocado e cobre todas as aulas, com cotas de 20, 50 ou 200 perguntas/mês conforme o plano [S6-19][S6-20].
**6. Plataformas, offline, sync, formatos:** web, iOS, Android, apps desktop para Windows e Mac e extensão Chrome; integra com Zoom, Teams e Meet [S6-19]. Offline [não verificado].
**7. Preço:** Basic grátis com 300 min/mês, 30 min por conversa e 3 imports na vida. Pro: US$ 16,99/mês ou US$ 8,33/mês no anual, com 90 min por conversa. Estudantes .edu têm 20% off (US$ 79,99/ano). A promoção de 50% no Pro anual valeu até set/2026. Consulta em out/2026 [S6-19][S6-20].
**8. Novidades 2025–2026:** pacote para estudantes (26/08/2026) [S6-20]. Polêmica: ação coletiva *Brewer v. Otter.ai* (N.D. Cal., 5:25-cv-06911-EKL, 15/08/2025), que alega gravação sem consentimento de não-usuários e uso das gravações para treinar modelos [S6-21][S6-22]. Desfecho [não verificado].
**9. Forças, fraquezas e reclamações recorrentes:** as forças são transcrição madura e busca entre aulas. As fraquezas são privacidade e consentimento, além de limites de minutos e de duração por conversa [S6-19][S6-22].
**10. Relevância para o Monet:**
- Ser local-first e não gravar ninguém é argumento de privacidade contra o modelo Otter.
- "Resposta que linka ao ponto exato da gravação" é a mesma régua de citação ancorada que o RAG do Monet deve manter (página ou tempo).

#### Notta
**1. Posicionamento e público:** transcrição multilíngue de reuniões e conteúdo, com desconto para educação [S6-23].
**2. Fluxo leitura → captura → nota → revisão:** grava ou importa áudio, vídeo ou link do YouTube → transcrição → notas com timestamp → resumo por IA → perguntas sobre várias gravações [S6-23].
**3. Highlight → nota:** "Time stamped notes" em todos os planos [S6-23].
**4. Revisão/recall:** nenhuma identificada [não verificado].
**5. IA:** resumo automático com cota (10/mês no Free, 100 no Pro). Perguntas entre reuniões consomem créditos do Notta Brain [S6-23].
**6. Plataformas, offline, sync, formatos:** web, iOS, Android, extensão Chrome e Notta Desktop para Mac e Windows ("Record bot-free"). Há também o gravador físico Notta Memo [S6-23].
**7. Preço:** Free com 120 min/mês e 3 min por gravação. Pro: US$ 8,17/mês no anual (US$ 97,99/ano), 1.800 min. Business: US$ 16,67/mês no anual. "50% OFF education discount" com e-mail educacional. Consulta em out/2026 [S6-23].
**8. Novidades 2025–2026:** Notta Brain (créditos de IA) e add-ons de tradução bilíngue [S6-23].
**9. Forças, fraquezas e reclamações recorrentes:** as forças são preço baixo e app Windows. A fraqueza é o Free quase inútil para aula, com limite de 3 min por gravação [S6-23].
**10. Relevância para o Monet:**
- Transcrição de aula virou commodity barata. O Monet ganha mais importando o texto da transcrição do que transcrevendo.

#### Coursera (notas do player + Coursera Coach)
**1. Posicionamento e público:** MOOCs e certificados. Em dez/2025 a Coursera acordou adquirir a Udemy (≈ US$ 930 mi em ações; Reuters, 17/12/2025) [S6-27][S6-28]. Em set/2026 o blog já fala da "combined company" [S6-24][S6-26].
**2. Fluxo leitura → captura → nota → revisão:** aula em vídeo com transcrição → notas e destaques no player [não verificado nesta sessão] → quizzes do curso → Coach para dúvidas.
**3. Highlight → nota:** vínculo da nota ao instante do vídeo e export [não verificado]. Extensões de terceiros como a Snipo cobrem o Coursera [S6-9].
**4. Revisão/recall:** avaliações do curso; o Coach gera "custom practice quizzes" [S6-29].
**5. IA:** Coach é tutor convocado dentro do curso: responde dúvidas, resume aulas e slides, traduz termos e dá "grounded references" ao material da aula. Está em cursos selecionados (fonte secundária) [S6-29]. O site de RI cita "AI-powered personalized guide", Role Play e Course Builder [S6-26].
**6. Plataformas, offline, sync, formatos:** web e apps; download offline [não verificado].
**7. Preço:** assinatura ou curso pago; valores [não verificado nesta sessão].
**8. Novidades 2025–2026:** Project Helix (09/09/2026), plataforma de skills com IA para empresas, prevista para o 1º sem/2027 [S6-24]. Autoria assistida por IA de Dialogue e Role Play (06/10/2026) [S6-25].
**9. Forças, fraquezas e reclamações recorrentes:** a força é a IA ancorada no conteúdo do curso. A fraqueza provável é a nota presa na plataforma [não verificado].
**10. Relevância para o Monet:**
- Tutor de IA embutido e ancorado virou padrão das plataformas. O Monet deve competir no caderno perene, multi-curso e fora da plataforma, não no tutor.
- A consolidação Coursera + Udemy concentra o mercado e reforça o argumento das "notas que sobrevivem à plataforma".

#### Udemy (notas do player + AI Assistant)
**1. Posicionamento e público:** marketplace de cursos, agora parte da empresa combinada com a Coursera [S6-25][S6-27].
**2. Fluxo leitura → captura → nota → revisão:** assiste → notas no player ligadas ao momento da aula [não verificado nesta sessão; o site da Udemy bloqueou o acesso (403)] → quizzes e exercícios → AI Assistant.
**3. Highlight → nota:** nota por timestamp e falta de export nativo [não verificado]. Extensões (Snipo e outras) preenchem a lacuna [S6-9].
**4. Revisão/recall:** quizzes do curso; Graded Role Play e Graded Labs no Udemy Business [S6-24].
**5. IA:** Udemy AI Assistant, "Introduced in late 2024", é uma interface de chat em linguagem natural, convocada [S6-27].
**6. Plataformas, offline, sync, formatos:** web e apps [não verificado].
**7. Preço:** por curso ou assinatura [não verificado nesta sessão].
**8. Novidades 2025–2026:** Udemy Communities (espaço pago conduzido pelo instrutor) e perfis de instrutor redesenhados (06/10/2026) [S6-25].
**9. Forças, fraquezas e reclamações recorrentes:** a força é o catálogo amplo. A fraqueza é a portabilidade das notas [não verificado].
**10. Relevância para o Monet:**
- Registrar "Curso → Seção → Aula → tempo" como fonte de citação (o análogo de livro → página) é algo que nenhuma plataforma entrega fora dela.


## (c) Métodos de estudo × suporte das ferramentas

Os métodos que os usuários praticam se dividem em duas famílias. A primeira reúne **métodos de organização e escrita de notas**: Zettelkasten, progressive summarization, Cornell e fichamento. É o que o usuário "faz" dentro do app, mas quase não há evidência experimental sobre esses métodos em si. A segunda reúne **técnicas de aprendizagem com evidência**. A revisão de Dunlosky et al. (2013) classificou *practice testing* e *distributed practice* como de "high utility"; *elaborative interrogation*, *self-explanation* e *interleaved practice* como "moderate"; e *summarization*, *highlighting*, *rereading*, *keyword mnemonic* e *imagery* como "low" [S6-30]. Daí a tensão central do mercado: os leitores vendem sobretudo as técnicas de baixa utilidade (grifar, reler, resumir), e poucos ligam o grifo à recuperação ativa espaçada. Abaixo, cada método traz definição, evidência, suporte nas ferramentas deste estudo e a implicação para o Monet.

### Zettelkasten
**Definição.** Notas atômicas (uma ideia por nota), escritas com as próprias palavras, com endereço único e links que explicam por que existem. O lema é "connecting and not collecting". Luhmann "published 50 books and over 600 articles" com o método [S6-38]. Foi popularizado por Ahrens em *How to Take Smart Notes* (2017) [S6-51].
**Evidência.** Não foi encontrado ensaio controlado sobre o método [não verificado]. Seus componentes, escrever com as próprias palavras e ligar ao que já se sabe, se aproximam da elaboração, de utilidade moderada [S6-30].
**Suporte.**
- Nativo: Obsidian (links e backlinks), Logseq, RemNote e Heptabase ("bi-directional links", cards e whiteboards) [S6-47].
- Parcial: MarginNote (cards ligados à página de origem) [S6-46], Notion (backlinks e databases), Zotero (notas; integração com o Obsidian) e Readwise (export para PKMs).
- Ausente: Kindle, Anki, Quizlet e NotebookLM.

**Implicação para o Monet.**
- A citação de grifo com fonte e página já é a *literature note*. Falta o passo da *permanent note* ligada a outras notas (links e backlinks, se ainda não existirem).
- Um /comando como "sugira conexões com minhas notas" mantém a IA convocada, sem auto-linking proativo (o modelo do Recall).

### Progressive summarization
**Definição.** Tiago Forte (2017, atualizado em 2023) propõe camadas: captura (1), negrito (2), realce do melhor negrito (3), resumo executivo com as próprias palavras (4) e remix (5). O trabalho é feito de modo "oportunista", quando a nota é revisitada para um projeto [S6-37]. O método integra *Building a Second Brain* (2022) [S6-52].
**Evidência.** Não há estudos diretos. Grifar e resumir têm baixa utilidade como estratégia de memorização [S6-30], mas Forte apresenta o método como forma de tornar notas "discoverable" para o eu futuro, não como técnica de memória [S6-37].
**Suporte.**
- Nativo em editores com negrito e realce: Obsidian, Logseq, Notion, RemNote e Heptabase.
- Grifos multicoloridos cobrem as camadas 1–3 no próprio texto-fonte: MarginNote, Zotero, Kindle e Readwise Reader.
- O Readwise exporta highlights para os PKMs onde acontecem as camadas 2–4.

**Implicação para o Monet.**
- Grifos em várias cores com filtro por cor já são camadas nativas. Uma convenção de cores (captura × essencial) e um bloco de "resumo nas minhas palavras" no topo da nota do livro fechariam o método.
- A IA não deve escrever a camada 4 pelo usuário. No máximo, pode ser convocada para criticar o resumo que ele escreveu.

### Método Cornell
**Definição.** Criado por Walter Pauk (Cornell; *How to Study in College*) [S6-39][S6-53]. A página tem três áreas: coluna de notas, coluna de pistas/perguntas e área de resumo. O ciclo clássico é record → reduce/question → recite → reflect → review [descrição clássica; os passos não aparecem na página da LSC].
**Evidência.** Estudos específicos são escassos [não verificado]. O ganho esperado vem do autoteste, que é *retrieval practice*: cobrir as notas e responder às pistas [S6-31][S6-32]. A LSC de Cornell afirma que notas à mão superam as digitadas [S6-39]. A réplica de Morehead, Dunlosky & Rawson (2019) questionou esse efeito [S6-36; o resumo não foi reverificado nesta sessão], ponto relevante para um app de digitação.
**Suporte.**
- Nativo: papéis com template Cornell em apps de tablet como Goodnotes [não verificado nesta sessão].
- Via template: Notion, Obsidian, Logseq e RemNote. No RemNote, pergunta e resposta viram cards.
- Ausente: leitores (Kindle, Zotero, LiquidText) e Anki.

**Implicação para o Monet.**
- Um template "Cornell digital" (perguntas | notas | resumo) para notas de aula é barato no Tiptap e atende diretamente o acompanhamento de curso.
- A coluna de perguntas é a ponte natural para um modo de revisão futuro, em que as perguntas viram itens de recall.

### Fichamento acadêmico (citação, resumo, comentário)
**Definição.** Prática escolar e universitária brasileira de registrar uma obra em fichas, com cabeçalho de referência completa. A Galoá, citando o manual da UFSC, lista os tipos [S6-40][S6-41]:
- bibliográfico;
- de citação: transcrição literal com a página;
- de resumo/conteúdo: síntese nas próprias palavras;
- de esboço;
- de comentário/analítico: interpretação e crítica.

A recomendação é "Separe as transcrições literais dos seus comentários" e registrar a página de cada citação [S6-40].
**Normas.** Referências seguem a ABNT NBR 6023 (versão de 2018 [não reverificada nesta sessão]); citações seguem a NBR 10520:2023. O estilo CSL "Associação Brasileira de Normas Técnicas (Português - Brasil)", usado por Zotero e Mendeley, declara seguir "ABNT-NBR 10520.2023 and ABNT-NBR 6023.2002" (atualizado em 20/08/2023) [S6-42]. Ou seja, o estilo cita a edição de 2002 da NBR 6023, não a de 2018.
**Como fazem.** Fichas de papel, Word ou Google Docs, pastas e bases digitais [S6-40]; Zotero com estilo ABNT para as referências [S6-42]; templates em Notion e Obsidian [não verificado].
**Suporte.**
- Nativo, o mais próximo do método: Zotero (anotação com página → nota; referência ABNT via CSL).
- Parcial: Readwise, Kindle, MarginNote, LiquidText, Obsidian (PDF++, Zotero Integration) e Notion (templates).
- Ausente: Anki e Quizlet.

**Implicação para o Monet.**
- O Monet já faz nativamente o fichamento de citação (grifo → blockquote com fonte e página). Faltam os tipos explícitos (citação, resumo, comentário) e a referência ABNT no cabeçalho da nota do livro.
- Exportar o fichamento em ABNT (Markdown ou DOCX) seria um diferencial claro para a persona pt-BR. É raro em apps internacionais.

### Active recall / retrieval practice
**Definição.** Recuperar a informação da memória (teste, flashcard, pergunta aberta) em vez de reler.
**Evidência.**
- Roediger & Karpicke (2006): com teste final após 5 min, reestudar foi melhor; nos testes tardios (2 dias e 1 semana), "prior testing produced substantially greater retention than studying" [S6-31].
- Metanálise em sala de aula (Yang et al., 2021): g = 0,499, com 222 estudos e 48.478 estudantes [S6-32].
- Dunlosky et al. (2013): "high utility" [S6-30].

**Suporte.**
- Nativo:
  - Anki, RemNote, SuperMemo, Quizlet e Logseq (cards);
  - MarginNote 4 (flashcards e quiz por IA que o usuário "accepted, edited, or rejected") [S6-46];
  - NotebookLM (flashcards e quiz);
  - Readwise Mastery (Q&A) [S6-48];
  - Recall (quiz) [S6-16];
  - Goodnotes AI ("test you on your material") [S6-49].
- Via plugin: Obsidian (Spaced Repetition) [S6-44].
- Ausente: LiquidText e Zotero. O site da Heptabase não menciona o recurso [S6-47].

**Implicação para o Monet.**
- É a maior lacuna do Monet frente à evidência: hoje nada pede ao usuário que recupere o que leu.
- Um formato coerente com a tese: /quiz convocado sobre grifos e notas do livro ou curso, com resposta digitada pelo usuário e correção com citação da página.

### Elaboração (self-explanation, elaborative interrogation, técnica Feynman)
**Definição.** Explicar com as próprias palavras por que algo é verdadeiro e como se liga ao que já se sabe. "Técnica Feynman" é o rótulo popular para explicar como se fosse ensinar.
**Evidência.** *Elaborative interrogation* e *self-explanation* têm "moderate utility" [S6-30]. A metanálise de Bisra et al. (2018) sobre indução de *self-explanation* encontrou efeito positivo [S6-35; tamanho do efeito não reverificado nesta sessão]. Não foram encontrados estudos específicos sobre a "técnica Feynman" [não verificado].
**Suporte.** Quase sempre implícito: há espaço para escrever, mas nada provoca o usuário. Tutores de IA socráticos vão além: NotebookLM (modo de aprendizagem, ver seção de estudo), Goodnotes AI como "tutor in your notebook" [S6-49] e o "AI Tutor" da Heptabase [S6-47]. O MarginNote propõe perguntas que o usuário aceita ou edita [S6-46].
**Implicação para o Monet.**
- É o coração da tese do Monet, em que o usuário faz o esforço. /comandos como "me pergunte por quê" ou "avalie minha explicação" usam o chat ancorado na página sem escrever a nota pelo usuário.
- Ao citar um grifo, um prompt opcional e discreto ("por que isso importa?") transforma a citação em comentário. Na terminologia do fichamento, é a passagem do fichamento de citação ao de comentário.

### Interleaving
**Definição.** Alternar tópicos ou tipos de problema na prática, em vez de estudar em blocos.
**Evidência.** A metanálise de Brunmair & Richter (2019) encontrou g = 0,42 no geral. O efeito é forte para pinturas (0,67), pequeno para matemática (0,34), ambíguo para textos expositivos e invertido para palavras (−0,39). Os autores recomendam cautela com textos expositivos [S6-34]. Dunlosky et al. classificam como "moderate" [S6-30].
**Suporte.**
- Nativo em sistemas com fila global de revisão: Anki, SuperMemo, Logseq e RemNote [mistura de baralhos não reverificada nesta sessão].
- O Daily Review do Readwise mistura highlights de várias fontes, mas é ressurgimento, não prática [S6-48].
- Ausente nos leitores de PDF.

**Implicação para o Monet.**
- Prioridade baixa: para leitura de textos expositivos a evidência é ambígua [S6-34]. Só faz sentido quando houver revisão, misturando livros e cursos na mesma fila.

### Spaced repetition (bônus)
**Definição.** Revisar em intervalos crescentes.
**Evidência.** Cepeda et al. (2006) reuniram "839 assessments of distributed practice in 317 experiments"; o intervalo ótimo cresce com o tempo de retenção desejado [S6-33]. Dunlosky et al. classificam como "high utility" [S6-30].
**Suporte.**
- Nativo:
  - Anki: FSRS desde a versão 23.10, com retenção desejada padrão de 90% [S6-43];
  - MarginNote 4 (FSRS) [S6-46], RemNote [S6-50], SuperMemo e Logseq;
  - Readwise: Daily Review e Mastery com "recall probability half-life" [S6-48];
  - Snipd (daily recap) [S6-12] e Recall (quiz espaçado) [S6-16].
- Via plugin: Obsidian, com FSRS ou SM-2 e revisão de notas inteiras pela tag #review [S6-44].
- Ausente: Zotero, LiquidText, Notion e Heptabase. Kindle e NotebookLM/Gemini Notebook têm flashcards, mas sem agendamento [S1-31][S5-29]. O Quizlet passou a ter Spaced Repetition em ago/2026 [S5-2].

**Implicação para o Monet.**
- Duas camadas possíveis: (a) ressurgimento espaçado de grifos e notas na nota diária do Calendar, barato e no estilo Readwise/Snipd; (b) flashcards com FSRS (há implementações open source), só se houver demanda.
- "Revisar a nota inteira" (o padrão #review do plugin do Obsidian) combina melhor com fichamento de longo prazo do que cards atômicos.

### Incremental reading (bônus)
**Definição.** Método do SuperMemo (P. Woźniak): importar muitos textos, ler em fatias por prioridade, extrair trechos, convertê-los em cloze e agendar a releitura dos próprios textos [S6-54; a página oficial bloqueou o acesso (403) nesta sessão].
**Evidência.** Não há estudos controlados sobre o método [não verificado]. Ele combina spacing e retrieval.
**Suporte.**
- Nativo: SuperMemo (Windows).
- Via plugin: Obsidian Incremental Writing, com filas priorizadas. Não roda no mobile e o autor alerta que "could break when Obsidian updates" [S6-45].
- Ausente nos demais.

**Implicação para o Monet.**
- Uma "fila de leitura" na Library, com prioridade e retomada agendada, é um passo pequeno e serve à persona de leituras extensas. O passo "extrair → citar" já existe.

### Matriz método × ferramentas
Legenda: ✓ nativo · ◐ parcial ou via template/plugin/export · ✗ ausente · ? não verificado. As células foram conferidas com as seções de produto da parte (b) em 2026-10-17; o detalhe de cada ferramenta está lá.

| Método | Readwise | Kindle | MarginNote 4 | LiquidText | Zotero | Obsidian | Logseq | Heptabase | RemNote | Anki | SuperMemo | Quizlet | NotebookLM | Goodnotes | Notion | **Monet hoje** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Zettelkasten | ◐ | ✗ | ◐ | ◐ | ◐ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ | ◐ |
| Progressive summarization | ◐ | ◐ | ✓ | ◐ | ◐ | ✓ | ✓ | ✓ | ✓ | ✗ | ◐ | ✗ | ✗ | ◐ | ✓ | ✓ |
| Cornell | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ | ◐ | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ | ✓? | ◐ | ✗ |
| Fichamento (citação/resumo/comentário + ABNT) | ◐ | ◐ | ◐ | ◐ | ✓ | ◐ | ◐ | ◐ | ◐ | ✗ | ◐ | ✗ | ◐ | ◐ | ◐ | ◐ |
| Active recall | ✓ | ◐ | ✓ | ✗ | ✗ | ◐ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ |
| Elaboração | ◐ | ✗ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ✗ | ✗ | ? | ✓ | ◐ | ◐ | ◐ |
| Interleaving | ◐ | ✗ | ? | ✗ | ✗ | ◐ | ◐ | ✗ | ◐ | ✓ | ✓ | ◐ | ◐ | ✗ | ✗ | ✗ |
| Spaced repetition | ✓ | ✗ | ✓ | ✗ | ✗ | ◐ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ? | ✗ | ✗ |
| Incremental reading | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ | ✗ | ✗ | ? | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

**Leitura da coluna "Monet hoje":**
- **Progressive summarization ✓:** grifos multicoloridos, filtro por cor e notas formatáveis.
- **Fichamento ◐:** o fichamento de citação (grifo → nota com fonte/página) é nativo; faltam os tipos explícitos e a referência ABNT.
- **Zettelkasten ◐:** há notas, citação com fonte e notas vinculadas (LinkedNoteBlock), mas não há [[wikilinks]], backlinks nem grafo explícitos (inventário interno do Monet, 2026-10-17).
- **Active recall ◐ e Elaboração ◐:** só é possível pedindo ao chat convocado, sem agendamento nem registro.
- **Cornell, Interleaving, SRS e Incremental reading ✗.**

Em resumo, o Monet é forte nas etapas de baixa evidência (grifar, citar, resumir) e na elaboração convocada, e ausente nas duas técnicas de "high utility": retrieval practice e spacing [S6-30].


## (d) Lacunas de mercado para estudo profundo de longo prazo

O mercado resolve bem a captura (grifar, salvar, perguntar a uma IA) e mal o que vem depois: elaborar, revisitar e manter o vínculo com o texto por meses. As lacunas abaixo valem para o mercado inteiro. Vêm de documentação oficial, fóruns e pesquisas de 2024–2026 e estão ordenadas pela relevância para a persona do Monet: autodidata no Windows que ficha livros e acompanha cursos em várias sessões. Nota de método: o orçamento de buscas da sessão acabou nesta etapa, então há pouca evidência direta de Reddit. As lacunas se apoiam em documentação oficial, fóruns (MobileRead, fórum do MarginNote, Goodreads) e estudos, e [não verificado] marca o que não foi confirmado em fonte primária.

### 1. Do grifo à elaboração: highlights que se acumulam e nunca são revisitados

**Descrição.** Grifar é barato e dá sensação de progresso. Elaborar (parafrasear, conectar, testar a si mesmo) custa caro. Quase todas as ferramentas param na captura, e a revisão, quando existe, fica num app separado (Anki, RemNote), sem vínculo com a página.

**Evidência.**
- Christian Tietze (2014) cunhou o *collector's fallacy*: "'to know about something' isn't the same as 'knowing something'" e "If we read without taking notes, our knowledge increases for a short time only" [S7-1].
- Andy Matuschak: juntar abas, PDFs e bookmarks "feels like progress, but we systematically overrate its value". Ele sugere processar em ciclos curtos e usar repetição espaçada para poucos detalhes-chave [S7-2].
- Dunlosky et al. (2013) classificam grifar e reler como técnicas de baixa utilidade; testes práticos e prática distribuída, como de alta utilidade [S7-3] [não verificado nesta sessão: as páginas retornaram 403].
- Numa enquete do Goodreads (não científica, 624.638 votos), 43,3% dos usuários de e-reader "never highlight" e 29,1% gostam de grifar [S7-4]. Fichar é nicho até entre leitores digitais.
- No fórum do MarginNote, uma usuária no meio de uma certificação teme perder os notebooks: "I would HATE to start all over again" (jun/2023) [S7-5]. O valor está no acervo acumulado, e o acervo prende o usuário à ferramenta.

**Quem resolve parcialmente.** Readwise (Daily Review traz os grifos de volta, mas fora da leitura); Anki, RemNote e Mochi (SRS, com cartas soltas do livro); NotebookLM e ChatGPT (flashcards gerados pela IA; as fontes consultadas não mencionam agendamento de revisão); MarginNote (só Apple).

**Oportunidade para o Monet.**
- Fechar o ciclo no próprio app: grifo → citação na nota (já existe) → pergunta de recall escrita pelo usuário → revisão agendada que reabre a página original.
- Uma fila passiva de "grifos sem elaboração", que ataca o *collector's fallacy* sem IA proativa.

### 2. IA que resume demais e terceiriza a elaboração

**Descrição.** Resumos automáticos, chat com o livro e flashcards gerados pela máquina entregam o produto final do estudo e tiram do usuário o esforço que gera aprendizado. A evidência converge: sem salvaguardas, o desempenho imediato sobe e o aprendizado cai; com design pedagógico, a IA ajuda.

**Evidência.**
- MIT Media Lab, "Your Brain on ChatGPT" (preprint, v1 em 10/06/2025, v2 em 31/12/2025): 54 participantes. Quem usou LLM teve a menor conectividade cerebral no EEG, dificuldade de citar o próprio texto e menos senso de autoria [S7-6]. A amostra é pequena e o estudo não passou por revisão por pares.
- Bastani et al. (PNAS, online em 25/06/2025), com cerca de 1.000 alunos de ensino médio na Turquia: o GPT-4 sem salvaguardas melhorou a prática em 48%. Sem a IA, porém, as notas na prova ficaram 17% abaixo do grupo de controle. A versão "GPT Tutor", com salvaguardas, mitigou boa parte do dano [S7-7][S7-8].
- Lee et al. (CHI 2025, Microsoft Research/CMU), com 319 profissionais: "higher confidence in GenAI is associated with less critical thinking" [S7-9]. Fan et al. (dez/2024), com 117 universitários: o ChatGPT melhorou a nota da redação sem ganho de conhecimento nem de transferência, efeito que os autores chamam de "metacognitive laziness" [S7-10].
- Anthropic Education Report (08/04/2025): cerca de 47% de 574.740 conversas acadêmicas são "diretas", e o relatório alerta para "a crutch for students" [S7-11].
- Contraponto: em Harvard, um tutor de IA com passos sequenciais e soluções verificadas superou a aula ativa, mas os autores ressalvam que "pedagogical best practices must be explicitly and carefully built" (Kestin et al., Scientific Reports, 03/06/2025) [S7-12]. Gerlich (2025) liga o *cognitive offloading* a menos pensamento crítico [S7-13] [não verificado: 403].
- Nos produtos: o Readwise Reader resume por padrão os documentos salvos [S7-14]. A XDA (06/10/2026) elogia o Learning Overview do NotebookLM porque "does a lot of that thinking for me" [S7-15]. A Procreate faz o contrário e se posiciona com "AI is not our future" [S7-16].

**Quem resolve parcialmente.** Os modos socráticos dos LLMs (ver subseção), mas são *toggles* que o usuário desliga quando quer a resposta.

**Oportunidade para o Monet.**
- A tese "IA convocada por /comando; o usuário elabora" é o design que a evidência sustenta. Vale dizer isso no posicionamento.
- Comandos que pedem o esforço antes da resposta: o usuário escreve a paráfrase e a IA critica citando a página, ou a IA faz perguntas em vez de dar respostas. Nada de resumo automático de livro.

### 3. Highlights e anotações presos (DRM, limites de cópia, formatos fechados)

**Descrição.** Grifos de anos ficam presos à loja onde o livro foi comprado ou ao formato do app.

**Evidência.**
- Kindle: as editoras impõem à Amazon um "copyright export limit", "typically around 10% to 20%" do texto; acima disso, os grifos são truncados. Grifos de documentos sideloaded não vão para a nuvem e exigem copiar o My Clippings.txt por USB ou mandar o Notebook por e-mail [S7-17].
- No Google Play Books, salvar notas no Drive vem desligado. Grifos podem faltar por limite de cópia da editora, e edições feitas no Drive são sobrescritas [S7-18].
- A queixa é antiga. Em 2009, Shelley Powers chamou os limites não documentados de "deceptive business practice" [S7-19]. Em 2012, um usuário do MobileRead relatou: "You have 267 highlighted passages but we can only show 175 of them" [S7-20].
- A Amazon encerrou o "Download & Transfer via USB" em 26/02/2025, fechando a via de backup dos livros comprados [S7-21].
- O Apple Books só existe em iOS, iPadOS e macOS. O Readwise importa os grifos por uma ferramenta para Mac ou por e-mail, livro a livro, e não traz grifos de PDFs [S7-22].
- No Zotero, as anotações ficam no banco do app, não no PDF, e leitores externos não as veem sem exportar "a PDF with embedded annotations". Em compensação, a anotação levada para a nota ganha link de volta à página [S7-23].

**Quem resolve parcialmente.** Readwise (reúne e exporta para Obsidian e Notion); Zotero; Highlights (exporta Markdown, HTML e PDF, só na Apple) [S7-24]; calibre e Thorium para EPUB sem DRM.

**Oportunidade para o Monet.**
- Ser a porta de entrada dos grifos presos: importar My Clippings.txt e exportações do Readwise como fichamentos ligados ao livro na Library.
- Exportar grifos em formato aberto (Markdown com citação, página e cor; PDF com anotações embutidas).

### 4. Acompanhamento de curso em várias sessões

**Descrição.** As notas de aula ficam espalhadas (plataforma, caderno, documentos), sem ligação com o momento do vídeo, o slide ou o material e sem visão de progresso por módulo. A transcrição gera texto, mas não organiza o estudo.

**Evidência.**
- O plugin Media Extended do Obsidian toca vídeo (inclusive do YouTube), insere links para momentos específicos e liga transcrições .srt/.vtt. Tem 956 estrelas no GitHub, e a v4 será closed source [S7-25].
- O NotebookLM (out/2026) ganhou um gravador de aulas que vira fonte [S7-15]. O Goodnotes para Windows ainda lista gravação de áudio e transcrição ao vivo como recursos futuros [S7-26].
- [não verificado] As notas com timestamp de Udemy e Coursera ficam presas às plataformas. Não houve coleta de relatos do Reddit.

**Quem resolve parcialmente.** Obsidian + Media Extended, Notion, Glasp, Snipd, Otter/Notta, NotebookLM (ver seção de vídeo e aulas).

**Oportunidade para o Monet.**
- Uma entidade "Curso" (módulos → aulas → sessões) ligada ao Calendar e às Tasks, com nota por sessão, link para o material (PDF na Library, URL com timestamp) e revisão ao fim de cada módulo.
- A nota diária do Calendar como diário de estudo, com backlinks para o curso e o livro.

### 5. Windows como plataforma de segunda classe para leitura profunda

**Descrição.** As ferramentas de leitura estruturada mais admiradas são da Apple. No Windows sobram leitores de PDF genéricos ou versões reduzidas.

**Evidência.**
- O MarginNote oferece "Download for Mac & iPad" [S7-27]. O Highlights se define como "The PDF Reader for Research on Mac, iPad & iPhone" [S7-24].
- No AlternativeTo (17/10/2026), só 3 das 12 principais alternativas ao MarginNote listam Windows: Xodo, Noteshelf e LiquidText [S7-28].
- O Goodnotes para Windows "does not offer the full range of features in Goodnotes 6 on iPad", e o plano grátis limita o usuário a 3 cadernos [S7-26].
- Contraponto: o Notability já lista apps para Windows, Android e Web [S7-29], e o LiquidText roda em Windows 10 [S7-30]. Um usuário no Zhihu descreve o dilema: no Windows há o BookXNote, mas ele não roda em iPad nem Mac [S7-31] [via resumo de busca].

**Quem resolve parcialmente.** LiquidText, Drawboard PDF, Xodo, Zotero, Obsidian, Heptabase.

**Oportunidade para o Monet.**
- Posicionar-se como "o MarginNote/Highlights do Windows": nativo e grátis na Microsoft Store, com fichamento ligado à página.
- Explorar a caneta do Surface e de notebooks 2-em-1 para grifar [sugestão não validada].

### 6. A ponte tablet/celular ↔ desktop

**Descrição.** Muita gente lê no tablet ou no e-reader e ficha no computador. A maioria das ferramentas só sincroniza dentro do próprio ecossistema, ou cobra pelo sync.

**Evidência.**
- No Goodnotes, o sync com o iPad ainda está em "Not yet but it's coming soon!" [S7-26]. MarginNote e Highlights só sincronizam entre aparelhos Apple [S7-27][S7-24].
- O sync em tempo real do LiquidText é o LIVE, um "Cloud Based subscription service" [S7-30]. No fórum do MarginNote, um usuário reclamou em 2023: "they still haven't fixed the sync issue" [S7-5].
- O Zotero para iOS leva as anotações do iPad para as notas no computador [S7-32]. O calibre sincroniza anotações com o leitor do Content server [S7-33]. O Kindle só sincroniza grifos de livros comprados na Amazon [S7-17].

**Quem resolve parcialmente.** Zotero, Readwise Reader, Kindle (Whispersync), calibre.

**Oportunidade para o Monet.**
- Uma ponte local-first: importar anotações padrão de PDF feitas em qualquer app de tablet, importar My Clippings e Readwise e, opcionalmente, usar uma pasta sincronizada (OneDrive) com arquivos abertos.
- Reconhecer o limite: quem lê no iPad tende ao Zotero ou ao Readwise. O Monet deve conviver com eles, não competir.

### 7. Serviços que morrem e a demanda por local-first e arquivos abertos

**Descrição.** Apps de leitura e captura fecham, e os grifos costumam ser a parte que se perde na migração.

**Evidência.**
- Pocket: fechamento anunciado em 22/05/2025, serviço encerrado em 08/07/2025 e export liberado até 08/10/2025. Depois disso, "All user data remaining in Pocket will be permanently deleted" [S7-34].
- O Omnivore fechou no fim de novembro de 2024, e o importador do wallabag "is not expected to support highlights" [S7-35]. No Windows, o Edge ganhou suporte a EPUB em 2017 e o perdeu entre 2018 e 2019 [S7-36].
- Duas respostas a esse problema: o "File over app" de Steph Ango, CEO da Obsidian (2023), com "Apps are ephemeral, but your files have a chance to last" [S7-37], e os ideais local-first da Ink & Switch (2019), como "You retain ultimate ownership and control" [S7-38]. Até plugins se fecham, como o Media Extended v4 [S7-25].

**Quem resolve parcialmente.** Obsidian (Markdown), Zotero (open source), wallabag, Logseq.

**Oportunidade para o Monet.**
- O Monet já é local-first e grátis. Falta a "garantia de saída": export completo em Markdown, com anexos e grifos com página, num formato documentado.
- Comunicar essa garantia como resposta direta a Pocket e Omnivore.

### 8. EPUB no desktop, PDFs escaneados e livros técnicos

**Descrição.** É raro um leitor de EPUB para Windows com anotação e export bons. PDF escaneado não tem camada de texto, então não aceita grifo, busca nem RAG. Fórmulas copiadas chegam quebradas.

**Evidência.**
- O Thorium Reader (Windows, macOS e Linux) lista só "Manage shareable Annotations" [S7-39]. O manual do calibre cobre grifos e notas, mas não documenta export [S7-33]. O Edge abandonou o EPUB [S7-36] e o Apple Books não existe no Windows [S7-22].
- O OCRmyPDF adiciona uma camada de texto pesquisável a PDFs escaneados [S7-40]. O Mathpix Snip captura "equations, text, and tables", com plano Pro "from $4.99/mo" [S7-41].
- [não verificado] Não houve coleta de reclamações de usuários sobre PDFs escaneados ou fórmulas.

**Quem resolve parcialmente.** Acrobat e PDF-XChange (OCR), calibre e Thorium (EPUB), Mathpix (fórmulas).

**Oportunidade para o Monet.**
- OCR local (Tesseract ou OCRmyPDF): alto valor e nenhum conflito com a tese, porque não é IA generativa.
- Recortar uma região do PDF (fórmula ou figura) e citá-la como imagem, com a página.

### 9. Privacidade e direitos ao mandar livros para a nuvem de IA

**Descrição.** A IA "dentro do livro" manda o texto para a nuvem, muitas vezes sem que usuário ou autor possam escolher.

**Evidência.**
- O Kindle "Ask this Book" (iOS, EUA, dez/2025) responde até a posição de leitura e chegou junto com os Recaps [S7-42]. A Amazon disse que o recurso "is always on, and there is no option for authors or publishers to opt titles out" [S7-43]. A Authors Guild (23/12/2025) cobra que esses usos "must be licensed and compensated" [S7-44]. A expansão para aparelhos Kindle e Android está prevista para "later in 2026" [S7-45].
- O Ghostreader do Readwise usa só a OpenAI e diz que nada é guardado nem usado para treino [S7-14]. A Adobe (06/06/2024) garantiu que "does not train Firefly Gen AI models on customer content", mas mantém uma licença limitada de acesso ao conteúdo e revisão humana em certos casos [S7-46]. Entre os ideais local-first está "Security and privacy by default" [S7-38].

**Quem resolve parcialmente.** Ferramentas com chave própria (BYOK) ou modelos locais (plugins de Obsidian e Zotero).

**Oportunidade para o Monet.**
- Mostrar exatamente o que sai da máquina em cada /comando e oferecer um provedor local.
- Diferenciar-se dos recursos "always on": nada é enviado sem comando.

### 10. Fadiga de assinatura

**Descrição.** As ferramentas de estudo migraram para assinatura, às vezes cobrada por plataforma, enquanto as big techs oferecem estudo com IA de graça.

**Evidência.**
- No fórum do MarginNote (mar/2024), sobre o LiquidText: "the only deal breaker was the cost" [S7-5]. O Goodnotes cobra planos anuais por plataforma [S7-26]; o LiquidText cobra pelo sync [S7-30], o Notability tem planos pagos [S7-29] e o Mathpix Pro sai a partir de US$ 4,99/mês [S7-41].
- A XDA afirma que os recursos grátis do NotebookLM "outperform apps people pay $15 a month for" [S7-15]. [não verificado] Não foram encontrados dados quantitativos sobre fadiga de assinatura em apps de estudo.

**Quem resolve parcialmente.** Anki (desktop), Zotero, Obsidian e calibre, todos gratuitos.

**Oportunidade para o Monet.** Ser grátis e sem conta é uma vantagem real. O custo da IA pode ficar com o usuário (chave própria ou modelo local), sem assinatura.

### Contexto: modos de estudo dos grandes LLMs (2025–2026)

| Produto | Quando | O que faz | Observação |
|---|---|---|---|
| ChatGPT Study Mode | 29/07/2025 | Faz perguntas para testar o entendimento e pode "refuse to offer direct answers unless students engage" [S7-47] | "Students can easily switch into the regular mode" [S7-47] |
| OpenAI em 2026 | Plugins Edu (04/08); ChatGPT for Teens (ago); quizzes no chat (14/08); flashcards para adolescentes (07/10) | O plugin College Student gera quizzes, guias e flashcards a partir do material do aluno [S7-48]; o Study Mode é o "hallmark" do ChatGPT for Teens [S7-49] | As datas de 14/08 e 07/10 vêm de páginas da OpenAI que retornaram 403 [S7-50][S7-51] [não verificado] |
| Claude learning mode | Abril/2025 (Education); 14/08/2025 para todos | Estilo "Learning" socrático e desligável; no Claude Code, o estilo "Learning" deixa #TODOs para o usuário escrever o código [S7-52][S7-53] | O mais próximo da tese, mas opcional |
| Gemini Guided Learning | 06/08/2025 | Perguntas abertas, passo a passo, diagramas e quizzes, com base no LearnLM [S7-54] | Distribuído via Google Classroom |
| NotebookLM → Gemini Notebook | Flashcards, quizzes e Learning Guide (08/09/2025); Gemini 3.5 (08/06/2026); renomeado (16/07/2026); Learning Overviews, voice chat e gravador (out/2026) | Flashcards "grounded entirely in your sources", com "explain" citando a fonte [S7-55][S7-56][S7-57]; mais de 30 milhões de usuários [S7-58][S7-15] | As fontes não mencionam agendamento de revisão espaçada |
| IA no leitor | Kindle Ask this Book (dez/2025); Ghostreader | Perguntas sem spoiler [S7-42]; resumo automático e busca na biblioteca com citações [S7-14] | O hábito de perguntar ao livro vai para onde o livro está |

**Como reforçam a tese do Monet.**
- As big techs admitem que a resposta pronta atrapalha o aprendizado e lançaram modos socráticos, o que legitima a ideia de "IA como meio".
- Esses modos são toggles que o usuário desliga [S7-47]. O Monet pode fazer do esforço parte da estrutura, com o usuário escrevendo e a IA perguntando e citando.
- Nenhum deles é um caderno durável, local e ligado à página por meses: os chats somem e os notebooks vivem na nuvem.

**Como ameaçam.**
- Chat com o livro, flashcards e quizzes ancorados nas fontes agora são grátis para dezenas de milhões de pessoas. Sozinho, o chat com RAG do Monet não diferencia.
- No acompanhamento de curso, voz no celular, gravador de aulas e plugins institucionais chegam ao aluno antes de um app desktop.
- Se o Ask this Book chegar aos aparelhos Kindle e ao Android em 2026 [S7-45], o hábito de perguntar ao livro vai para o leitor dominante.

### Síntese

- A lacuna central é elaborar e revisar, não capturar: quase ninguém fecha o ciclo grifo → nota própria → revisão → volta à página.
- A evidência de 2024–2026 favorece a IA convocada que o Monet adota. Como os LLMs já ocupam o discurso socrático, o diferencial precisa estar na estrutura do app e na durabilidade das notas.
- Grifos presos (limites do Kindle, Apple Books fora do Windows, bancos internos) abrem uma porta de entrada barata: importação e export abertos.
- O Windows segue mal servido em leitura estruturada, e isso dá ao Monet um espaço claro de posicionamento.
- Sem sync, o Monet precisa de uma ponte local-first com o tablet, ou perde quem lê no iPad.
- O acompanhamento de curso em várias sessões é pouco atendido, e Calendar, Tasks e nota por sessão são ativos que o Monet já tem.
- Local-first, grátis e "nada sai sem comando" respondem a três dores reais (serviços que morrem, assinatura, privacidade) e devem ser comunicados como garantia.
- OCR local e recorte de fórmulas e figuras são lacunas de baixo risco e alto valor para livros técnicos.


## (e) Tabela comparativa

Legenda: **convocada** = a IA só age quando o usuário pede (botão, comando, chat); **proativa** = a IA age sem pedido (resumo automático ao importar, sugestões, geração automática de cartões). "—" = não se aplica; "?" = não verificado. Preço = plano pago individual mais barato, em USD, na data indicada (cobrança anual quando o produto só exibe esse valor). A primeira linha é o Monet, como referência.

| Produto | Leitura (PDF/EPUB/web/vídeo) | Highlight → nota | Revisão/SRS | IA (convocada/proativa) | Windows | Offline | Preço de entrada pago (USD, data) |
|---|---|---|---|---|---|---|---|
| **Monet (hoje, referência)** | PDF, EPUB | grifo → nota (blockquote com fonte/página) | não tem | convocada (/comandos, chat lateral), ancorada em página/grifos + RAG | sim (nativo) | leitor/notas sim; IA requer internet | grátis (IA via BYOK: OpenRouter/Tavily) |
| ***Leitura + highlights*** | | | | | | | |
| Readwise | não é leitor; agrega Kindle, Apple Books, Reader, papel | notas/tags; export Obsidian/Notion/Logseq com link de origem | Daily Review + Mastery (cloze/Q&A, SRS) | chat convocado; Themed Connections proativas opcionais | só web/extensão | ? | Lite US$ 5,59/mês anual (out/2026) |
| Readwise Reader | PDF, EPUB, web, RSS, YouTube, podcasts, Markdown | notas/tags; sync Readwise; export PDF anotado | via Readwise (Daily Review/Mastery) | Ghostreader convocado c/ citações; auto-resumo ligado por padrão (desligável) | sim (app desktop) | sim | Readwise Full US$ 9,99/mês anual (out/2026) |
| Kindle | e-books Kindle; EPUB/PDF via Send to Kindle | Notebook; export limitado ~10–20%; My Clippings.txt | flashcards simples no app; sem SRS | Recaps, Story so Far, Ask this Book (convocadas; sem opt-out p/ autores) | sim (Kindle for PC) | sim | apps grátis; Scribe US$ 429,99+ (dez/2025) |
| Apple Books | EPUB, PDF, audiolivros | notas; painel salta à página; sem export oficial | Study Cards (alguns livros), sem SRS | não | não | sim | grátis (livros pagos) |
| Matter | web, newsletters, PDF, YouTube/podcasts transcritos | highlights/notas; sync Readwise/Notion/Obsidian | não | AI Co-Reader convocado (premium) | só web | sim (iOS) | US$ 7,99/mês ou US$ 79,99/ano (out/2026) |
| Glasp | web, PDF, YouTube; import Kindle | notas/tags; export MD/CSV/JSON; Notion sync | não | resumos/chat convocados; "AI clone"; auto-tags | via navegador | ? | Pro US$ 12,50/mês anual (mai/2026) |
| Hypothesis | web, PDF online/local, YouTube, VitalSource | anotação ancorada; export JSON/CSV/HTML/TXT | não | não (posição anti-IA) | via navegador | não | grátis individual; institucional sem preço público |
| Pocket | — (encerrado 08/jul/2025) | export até 08/out/2025 | — | — | — | — | — (anuais reembolsados) |
| Omnivore | — (nuvem encerrada 15/nov/2024) | ~15 dias para exportar; self-host | — | — | — | — | — (era grátis) |
| ***PDF e anotação (comerciais)*** | | | | | | | |
| MarginNote 4 | PDF, EPUB, web, vídeo, áudio | Grifo vira card com link bidirecional à página; mind map | FSRS nativo + modo Recall (grifos borrados) | Convocada (Ask/Chat, quiz, cards); dicas on-device; BYOK | Não | Sim (IA em nuvem; dicas on-device) | Pro US$12,99 vitalício (iOS); Max US$16,99/ano (out/2026) |
| LiquidText | PDF, Word, PowerPoint, web | Excerpt no workspace; toque volta ao contexto original | Não tem | Beta convocada (2023); prévia 2026 sem detalhes (?) | Sim | Sim (sync só no Live) | Live US$10,90/mês ou US$99,99/ano; Pro II US$89,99 (out/2026) |
| Highlights | PDF | Notas extraídas; Markdown/Obsidian com links highlights:// à página | Não tem | Convocada (Writing Tools; Siri AI sobre PDF aberto) | Não | Sim | Pro US$4,99/mês ou US$29,99/ano (out/2026) |
| PDF Expert | PDF | Anotações no PDF; resumo de anotações por IA | Quiz por IA (Mac); sem SRS | Convocada; PDF Copilot com links de página | Não (só Copilot web) | Sim (IA online) | US$79,99 Mac+iOS na App Store US, período ? (out/2026) |
| Adobe Acrobat (AI Assistant/Studio) | PDF; Office e links nos PDF Spaces | Comentários no PDF; notas em Spaces; citações clicáveis | Não tem | Convocada + insight cards automáticos nos Spaces | Sim | Parcial (IA só online) | Express US$9,99/mês; Studio US$24,99/mês (out/2026) |
| Foxit (Editor/Reader + AI) | PDF | Comentários no PDF; Workspace exporta Markdown/HTML | Skills Quiz/Flashcards por IA; sem SRS | Convocada; citações; Local AI offline (Foundry Local) | Sim | Sim (inclui IA local) | IA US$4,99/mês; Editor US$129,99/ano (jul/2026) |
| Xodo | PDF | Comentários no PDF | Não tem | Convocada (AskPDF web; sem citações) | Sim (PDF Studio) | Sim (desktop) | Web US$39,99/ano; Desktop US$119,88/ano (out/2026) |
| Drawboard PDF | PDF | Tinta/anotação no PDF; sem nota ligada | Não tem | ? (créditos listados; funções não descritas) | Sim | ? | Pro Plus US$83,92/ano; estudante US$10 por 3 anos (out/2026) |
| ***PDF/PKM de pesquisa e tablet*** | | | | | | | |
| Zotero 10 | PDF, EPUB, snapshots web | Anotação→nota com citação + "Show on Page" | Não tem | Sem IA nativa; plugins convocados (Beaver etc.) | Sim | Sim (banco local) | Storage 2 GB US$ 20/ano (2026-10-17) |
| Heptabase | PDF, YouTube, podcast, web; EPUB só via Readwise | Highlight Cards embutíveis; rastreio de página/parágrafo | Não tem | Convocada, mas elabora por você (Tutor, Break down book) | Sim | Parcial (offline, mas conta/nuvem) | Pro US$ 8,99/mês, provável anual (2026-10-17) |
| Obsidian + PDF++/Annotator | PDF nativo; EPUB/web via plugins e Web Clipper | Link página+seleção+cor em Markdown (PDF++) | Plugin Spaced Repetition (FSRS opcional) | Sem IA no core; Interpreter BYO key/Ollama | Sim | Sim | Sync US$ 4/mês no anual (2026-10-17) |
| Logseq (OG / DB beta) | PDF (só desktop) | Grifo vira bloco referenciável com página | Flashcards #card no OG (?) | Sem IA nativa | Sim | Sim | Grátis; sync via Open Collective US$ 5/mês |
| GoodNotes | PDF (handwriting), áudio | Manual (tinta/texto sobre PDF) | Quiz IA a partir das notas | Convocada; créditos (AI Pass) | Sim | ? | Essential US$ 11,99/ano (2026-10-17) |
| Notability | PDF, áudio, YouTube | Manual; áudio junto das notas | Quizzes/flashcards IA | Convocada; limitada no Plus | Sim (listado no site) | ? | Lite US$ 11,99/ano promo (2026-10-17) |
| OneNote (Copilot) | Printout de PDF, tinta, áudio | Manual | Não tem (?) | Copilot convocado | Sim | Parcial (?) | M365 Personal US$ 99,99/ano (2026-10-17) |
| Samsung Notes (Galaxy AI) | PDF (S Pen), áudio | Manual | ? | Galaxy AI convocada | Parcial (app na Store, Galaxy Book?) | ? | Grátis (Galaxy AI básico grátis, jul/2026) |
| ***Estudo e SRS*** | | | | | | | |
| RemNote | PDF/web nativos; EPUB/DOCX/PPTX convertidos; YouTube; áudio | Referência volta ao ponto exato do PDF | SM-2 padrão; FSRS v6 beta; Exam Scheduler | Convocada (Learn PDF, Generate Cards); explicação ao grifar | Sim (app desktop) | Sim, local-first no desktop | Pro US$ 96/ano; Pro with AI US$ 216/ano (2026-10-17) |
| Anki | Nenhum leitor nativo | Não nativo (campo Source manual; add-ons) | SM-2 padrão; FSRS-6 opt-in | Nenhuma nativa; AnkiHub/add-ons/MCP, convocadas | Sim (x64 e ARM64) | Sim, total | Desktop grátis; AnkiMobile US$ 25 único (fev/2026) |
| Mochi | Nenhum leitor (Markdown, imagens, áudio) | — | Algoritmo próprio; FSRS opcional; avaliação binária | Convocada (campo dinâmico de IA, Pro) | Sim | Sim, local-first sem conta | Pro US$ 5/mês, cobrança anual (2026-10-17) |
| SuperMemo 20 (Windows) | Web, PDF, EPUB, YouTube | Extracts → clozes (incremental reading) | SM-20 + 4 algoritmos (inclui FSRS) | Convocada (explicação ao extrair; chave Google) | Sim (só Windows) | Sim, local | US$ 68 único, vitalício (2026-10-17) |
| Traverse | Notas com PDF/vídeo/áudio | Seleção → cloze | SRS (algoritmo ?) | ? (não mencionada) | Só via navegador | ? | IAP iOS US$ 15, periodicidade ? (2026-10-17) |
| Brainscape | Nenhum leitor; IA importa PDF/notas | — | Confidence-Based Repetition (1–5) | Convocada (AI flashcard maker) | Só via navegador | ? | US$ 95,99/ano na App Store (2026-10-17) |
| ***Estudo com IA e pesquisa acadêmica*** | | | | | | | |
| Quizlet | Não é leitor; upload de notas/PDF, gravação de aula | — | Learn adaptativo, testes; SRS lançado ago/2026 | Convocada, geradora (cria sets/guias) | Só web | ? (Plus no app móvel, segundo reviews) | Plus US$7,99/mês ou US$35,99/ano (web, terceiros, set/2026) |
| Knowt | Não é leitor; upload de PDF/vídeo/PPT, aula ao vivo | — (nota → cards) | SRS Again/Hard/Good/Easy, Learn, testes | Convocada, geradora; tutor Kai | Só web | ? | Ultra US$24,99/mês ou US$149,99/ano (out/2026) |
| StudyFetch | Não é leitor; upload de PDF/PPT/vídeo/YouTube; Live Lecture | — (itens gerados citam fonte) | Flashcards, quizzes, study plan; SRS ? | Proativa/geradora; tutor Sparky | Só web | Não | Premium US$19,99/mês ou US$96/ano (App Store, out/2026) |
| Notion (for students) | Embed de PDF, Web Clipper; sem leitor com grifo | Manual (copiar/colar), sem link à página | Sem SRS nativo (templates) | Convocada; IA completa só no Business | Sim (app desktop) | Parcial (páginas marcadas) | Plus US$10/mês (Education grátis); IA no Business US$20 (out/2026) |
| NotebookLM / Gemini Notebook | Fontes PDF, EPUB, web, YouTube, áudio (não é leitor) | Save to note mantém citações; grifo ? | Flashcards/quizzes sem SRS (só "missed") | Convocada, ancorada com citação clicável | Só web | Não | Google AI Plus US$4,99/mês; Pro US$19,99 (out/2026) |
| Elicit | Papers (138M+); PDFs enviados no Pro | — | — (Alerts, Routines) | Convocada, ancorada em fontes | Só web | Não | Pro US$49/mês (US$588/ano, out/2026) |
| Consensus | Papers (400M+); PDF com trecho destacado | Library; export RIS/BibTeX/CSV | — | Convocada, citação exata (Citation Grounding) | Só web (+ChatGPT/Claude/Copilot) | Não | ? (grátis para começar; página só em JS) |
| SciSpace | PDF/paper no navegador + extensão | Explain sobre seleção; coleções | — | Convocada, cita fonte e localização | Só web/extensão | Não | ? (site bloqueado, out/2026) |
| Scholarcy | Artigo HTML/PDF via extensão | Summary Flashcards exportáveis (premium) | — (fichas-resumo, não SRS) | Proativa (resume ao abrir) | Só web/extensão | ? | ? (site bloqueado, out/2026) |
| ResearchRabbit | — (descoberta por citações) | — | — (alertas Signals no RR+) | Recomendação algorítmica | Só web | Não | RR+ US$10/mês anual; US$12,5 mensal (out/2026) |
| Litmaps | — (mapas de citações) | — | — (alertas Monitor) | Recomendação algorítmica | Só web | Não | Pro US$120/ano, e-mail acadêmico (out/2026) |
| Semantic Reader (+Asta) | PDF de papers (sobretudo arXiv) no navegador | Grifos/notas via Hypothesis (beta) | — (Research Feeds) | Mista: overlays automáticos opcionais; definições sob clique | Só web | Não | Grátis |
| ***Cursos, aulas e vídeo*** | | | | | | | |
| Obsidian + Media Extended | vídeo local/YouTube/Vimeo; .srt/.vtt | link de timestamp + screenshot na nota | ◐ só via plugin (Spaced Repetition) | — (sem IA) | sim (desktop only) | sim (mídia local) | grátis; sem plano pago (out/2026) |
| Notion + Snipo | vídeo (YouTube, Udemy, Coursera…) via extensão | nota com tempo + screenshot → Notion | ✗ nativo; Snipo exporta flashcards ao Anki | Notion AI convocada; Meeting Notes só Business | sim | ? | Plus US$ 10/membro/mês; grátis p/ estudante (out/2026) |
| Glasp (YouTube) | web, YouTube (transcrição), PDF | grifo de transcrição c/ timestamp clicável; export | ✗ ? | convocada (resumo via LLM escolhido) | via extensão de navegador | não | Pro US$ 15/mês ou US$ 150/ano (out/2026) |
| Snipd | podcast; YouTube/áudio importado | snip c/ áudio, transcrição, resumo; sync Obsidian/Readwise/Notion | daily recap com spaced repetition | gesto do usuário; resumos automáticos | não (mobile) | áudio baixado | Premium US$ 6,99/mês (out/2026) |
| Recall (recall.it) | web, YouTube, podcast, PDF | resumo c/ timestamps + notas; grafo automático | quiz com spaced repetition (Plus) | proativa (resume/conecta ao salvar) | web/extensão; sem app desktop | ? | Plus US$ 10/mês, anual (out/2026) |
| Mindgrasp | PDF, DOCX, PPT, MP3/MP4, YouTube, gravação | notas geradas por IA; sem timestamp citado | flashcards e quizzes automáticos | proativa (gera tudo no upload) | só web | ? | ? (preço não exibido, out/2026) |
| Otter.ai | aula ao vivo/reunião; import de áudio/vídeo | notas/grifos na transcrição c/ timecode | quizzes e study guides gerados (2026) | proativa (resumos) + chat convocado | sim (app desktop) | ? | Pro US$ 8,33/mês anual; US$ 16,99 mensal (out/2026) |
| Notta | áudio, vídeo, link YouTube, gravação | notas com timestamp | ✗ ? | proativa (resumo) + Q&A por créditos | sim (Notta Desktop) | ? | Pro US$ 8,17/mês anual = US$ 97,99/ano (out/2026) |
| Coursera (notas + Coach) | vídeo de curso + transcrição | notas no player ? | quizzes do curso; Coach gera prática | convocada (tutor no curso) | só web; apps ? | ? | assinatura/curso; valor ? |
| Udemy (notas + AI Assistant) | vídeo de curso | notas por timestamp no player ? | quizzes do curso | convocada (chat AI Assistant) | só web; apps ? | ? | por curso/assinatura; valor ? |

Notas da tabela:
- Glasp e Notion aparecem duas vezes, com recortes diferentes: como ferramenta de leitura/workspace (grupos 1 e 5) e como ferramenta de vídeo/aula (grupo 6).
- "Windows: via navegador/web" significa que não há app nativo. "?" na coluna Offline significa que o modo offline não foi confirmado.
- Preços: valor mensal equivalente na cobrança anual quando o produto só exibe esse número. Quando a página oficial não carregou, o valor vem da App Store (EUA) ou de terceiros, como indicado na seção do produto. Preços variam por região e por canal (web × loja).
- Créditos de IA (Heptabase, Goodnotes AI Pass, MarginNote, Foxit, Glasp, Notion Custom Agents) não entram no preço de entrada e podem encarecer o uso real.

## (f) Fontes

Fontes agrupadas por seção, no formato código — título — URL — tipo — data. "Acessado 2026-10-17" é a data da consulta; quando conhecida, a data de publicação aparece antes. Threads de Reddit e fóruns registram sentimento de usuários e não são verificação de fato.


### S1 — Leitura + highlights

- [S1-1] Readwise — Pricing — https://readwise.io/pricing — oficial — sem data (© 2026); acessado 2026-10-17
- [S1-2] Readwise Reader — FAQ (Basics) — https://docs.readwise.io/reader/docs/faqs — oficial — sem data; acessado 2026-10-17
- [S1-3] Readwise & Reader Changelog — https://docs.readwise.io/changelog — oficial — entradas jan/2025–09/out/2026; acessado 2026-10-17
- [S1-4] Reader Public Beta Update #14 (Global Ghostreader, Readwise 2.0, Mobile Chat, Better Search, MCP) — https://readwise.io/reader/update-aug2026 (espelho: https://blog.readwise.io/update-aug2026/) — oficial — 2026-08-06; acessado 2026-10-17
- [S1-5] Reader Public Beta Update #13 (Tablet, Offline v2, Podcast Transcripts, Ghostreader v3) — https://blog.readwise.io/update-dec2025/ — oficial — 2025-12-03; acessado 2026-10-17
- [S1-6] Readwise Blog (índice de updates) — https://blog.readwise.io/ — oficial — acessado 2026-10-17
- [S1-7] Readwise — Mastery guide — https://docs.readwise.io/readwise/guides/mastery — oficial — sem data; acessado 2026-10-17
- [S1-8] Readwise — How does the Readwise to Obsidian export integration work? — https://docs.readwise.io/readwise/docs/exporting-highlights/obsidian — oficial — sem data; acessado 2026-10-17
- [S1-9] Readwise — Exporting Highlights — https://docs.readwise.io/readwise/docs/exporting-highlights — oficial — sem data; acessado 2026-10-17
- [S1-10] Readwise — Importing Highlights — https://docs.readwise.io/readwise/docs/importing-highlights — oficial — sem data; acessado 2026-10-17
- [S1-11] Readwise — Kindle import (limites de export, My Clippings, sem API) — https://docs.readwise.io/readwise/docs/importing-highlights/kindle — oficial (Readwise) — sem data; acessado 2026-10-17
- [S1-12] Readwise — Ghostreader overview — https://docs.readwise.io/reader/guides/ghostreader/overview — oficial — sem data; acessado 2026-10-17
- [S1-13] Readwise — Ghostreader Prompt Customization — https://docs.readwise.io/reader/guides/ghostreader/custom-prompts — oficial — sem data; acessado 2026-10-17
- [S1-14] Readwise — Desktop apps (Mac/Windows) — https://docs.readwise.io/get-started/desktop-apps — oficial — sem data; acessado 2026-10-17
- [S1-15] Readwise Reader — landing page — https://readwise.io/read — oficial — sem data; acessado 2026-10-17
- [S1-16] App Store — Readwise Reader (avaliações) — https://apps.apple.com/us/app/readwise-reader/id1567599761 — loja/review — reviews 2023–2024; acessado 2026-10-17
- [S1-17] App Store — Readwise (avaliações e IAPs) — https://apps.apple.com/us/app/-/id1476885528 — loja/review — reviews 2021–2025; acessado 2026-10-17
- [S1-18] AlternativeTo — Readwise Reader (review de usuário) — https://alternativeto.net/software/readwise-reader/about/ — review — review de 2025-03-10; acessado 2026-10-17
- [S1-19] Andy Matuschak — nota sobre Readwise/cloze vs. Q&A — https://notes.andymatuschak.org/z2ewMN8Hzd8gt4qyfQV1ognJ5PQs3CXxDfCJ — review/opinião — sem data; conteúdo obtido via resumo de resultado de busca (página não aberta); acessado 2026-10-17
- [S1-20] TechCrunch — Amazon Kindle's new feature uses AI to generate recaps for books in a series — https://techcrunch.com/2025/04/03/amazon-kindles-new-feature-uses-ai-to-generate-recaps-for-books-in-a-series/ — notícia — 2025-04-03; acessado 2026-10-17
- [S1-21] TechCrunch — Amazon's new Kindle Scribe and Kindle Scribe Colorsoft launch on December 10 — https://techcrunch.com/2025/12/04/amazon-unveils-new-kindle-scribe-and-kindle-scribe-colorsoft/ — notícia — 2025-12-04; acessado 2026-10-17
- [S1-22] TechCrunch — The Kindle Scribe Colorsoft is a pricey but pretty e-ink color tablet with AI features — https://techcrunch.com/2026/02/06/kindle-scribe-colorsoft-review-e-ink-color-tablet/ — review — 2026-02-06; acessado 2026-10-17
- [S1-23] TechCrunch — The Kindle Scribe Colorsoft is a lot of fun, but it's not a must-have — https://techcrunch.com/2026/08/08/the-kindle-scribe-colorsoft-is-a-lot-of-fun-but-its-not-a-must-have/ — review — 2026-08-08; acessado 2026-10-17
- [S1-24] TechCrunch — Amazon revamps Kindle line with faster page turns, AI, and a new green color — https://techcrunch.com/2024/10/16/amazon-revamps-kindle-line-with-faster-page-turns-ai-and-a-new-green-color/ — notícia — 2024-10-16; acessado 2026-10-17
- [S1-25] TechCrunch — Amazon changes how copyright protection is applied to Kindle Direct's self-published e-books — https://techcrunch.com/2025/12/10/amazon-changes-how-copyright-protection-is-applied-to-kindle-directs-self-published-ebooks/ — notícia — 2025-12-10; acessado 2026-10-17
- [S1-26] TechCrunch — Amazon to end support for older Kindle devices — https://techcrunch.com/2026/04/08/amazon-to-end-support-for-older-kindle-devices-2012/ — notícia — 2026-04-08; acessado 2026-10-17
- [S1-27] TechCrunch — Users turn to jailbreaking their older Kindles as Amazon ends support — https://techcrunch.com/2026/05/16/users-turn-to-jailbreaking-their-older-kindles-as-amazon-ends-support/ — notícia — 2026-05-16 (só o título foi visto no índice de tags); acessado 2026-10-17
- [S1-28] About Amazon — Amazon introduces a completely redesigned Kindle family — https://www.aboutamazon.com/news/devices/new-kindle-lineup-2026 — oficial — set/out 2026 (data não explícita na página); acessado 2026-10-17
- [S1-29] TechCrunch — índice da tag Kindle (Kindle Translate 2025-11-06; Audible "Read & Listen" 2026-02-18; Kindle Click 2026-10-01) — https://techcrunch.com/tag/kindle/ — notícia (índice) — acessado 2026-10-17
- [S1-30] The eBook Reader — 2026 Kindles vs 2024 Kindle Comparison Review (Video) — https://blog.the-ebook-reader.com/2026/10/10/2026-kindles-vs-2024-kindle-comparison-review-video/ — review — 2026-10-10 (trecho visto no índice); acessado 2026-10-17
- [S1-31] App Store — Amazon Kindle (descrição, versões, review sobre flashcards) — https://apps.apple.com/us/app/amazon-kindle/id302584613 — loja/review — acessado 2026-10-17
- [S1-32] Apple — Books User Guide (macOS 27) — https://support.apple.com/guide/books/welcome/mac — oficial — acessado 2026-10-17
- [S1-33] Apple — Highlight book passages and add notes in Books on Mac — https://support.apple.com/guide/books/highlight-book-passages-and-add-notes-ibks3975f128/mac — oficial — acessado 2026-10-17
- [S1-34] Apple — Use study cards in Books on Mac — https://support.apple.com/guide/books/use-study-cards-ibks836b154c/mac — oficial — acessado 2026-10-17
- [S1-35] Matter — site oficial — https://getmatter.com/ — oficial — acessado 2026-10-17
- [S1-36] App Store — Matter: Reading App (IAPs, histórico de versões, reviews) — https://apps.apple.com/us/app/matter-reading-app/id1501592184 — loja/review — reviews 2022–2025; versões out/2025–out/2026; acessado 2026-10-17
- [S1-37] Glasp — Pricing — https://glasp.co/pricing — oficial — sem data (© 2026); acessado 2026-10-17
- [S1-38] Glasp — Updates to Glasp Pricing: Effective May 1, 2026 — https://blog.glasp.co/price-update-2026-05-01/ — oficial — 2026 (vigência 2026-05-01); acessado 2026-10-17
- [S1-39] Glasp Blog (índice: GSV Cup 2025, Snipd, auto-tag) — https://blog.glasp.co/ — oficial — acessado 2026-10-17
- [S1-40] Chrome Web Store — Glasp Web Highlighter (descrição, usuários, reviews) — https://chromewebstore.google.com/detail/glasp-web-highlighter-pdf/blillmbchncajnhkjfdnincfndboieik — loja/review — atualizado 2026-10-17; reviews jul–out/2026; acessado 2026-10-17
- [S1-41] Hypothesis — site oficial — https://web.hypothes.is/ — oficial — acessado 2026-10-17
- [S1-42] Hypothesis — Pricing — https://web.hypothes.is/pricing-page/ — oficial — sem data (© 2026); acessado 2026-10-17
- [S1-43] Hypothesis — Blog (índice) — https://web.hypothes.is/blog/ — oficial — posts jun–out/2026; acessado 2026-10-17
- [S1-44] Hypothesis — How College Students Are Reading in the Age of AI — https://web.hypothes.is/blog/how-college-students-are-reading-in-the-age-of-ai/ — oficial — 2026-09-01; acessado 2026-10-17
- [S1-45] Hypothesis — What our users taught us about Paced Social Annotation — https://web.hypothes.is/blog/feedback-conversations-and-interviews-what-our-users-taught-us-about-paced-social-annotation-before-it-was-a-thing/ — oficial — 2026-10-16; acessado 2026-10-17
- [S1-46] Hypothesis — Annotating Locally-saved PDFs — https://web.hypothes.is/help/annotating-locally-saved-pdfs/ — oficial — acessado 2026-10-17
- [S1-47] Hypothesis — Exporting and Importing Annotations — https://web.hypothes.is/help/exporting-and-importing-annotations/ — oficial — acessado 2026-10-17
- [S1-48] Hypothesis — Help: Annotating with Hypothesis — https://web.hypothes.is/help-categories/annotating-with-hypothesis/ — oficial — acessado 2026-10-17
- [S1-49] Mozilla — Building what's next (fim do Pocket e do Fakespot) — https://blog.mozilla.org/en/mozilla/building-whats-next/ — oficial — 2025-05-22; acessado 2026-10-17
- [S1-50] TechCrunch — Mozilla is shutting down read-it-later app Pocket — https://techcrunch.com/2025/05/22/mozilla-is-shutting-down-read-it-later-app-pocket/ — notícia — 2025-05-22; acessado 2026-10-17
- [S1-51] Pocket — getpocket.com (aviso de phase-out) — https://getpocket.com/ — oficial — acessado 2026-10-17
- [S1-52] AlternativeTo — Pocket (alternativas e comentários) — https://alternativeto.net/software/pocket/about/ — review/fórum — acessado 2026-10-17
- [S1-53] Instapaper Blog (índice: integração Kobo jul–ago/2025, PDF ago/2025) — https://blog.instapaper.com/ — oficial — acessado 2026-10-17
- [S1-54] ElevenLabs — Omnivore joins ElevenLabs — https://elevenlabs.io/blog/omnivore-joins-elevenlabs — oficial — 2024-10-29; acessado 2026-10-17
- [S1-55] GitHub — omnivore-app/omnivore (README: nuvem descontinuada nov/2024, self-hosted) — https://github.com/omnivore-app/omnivore — oficial — acessado 2026-10-17
- [S1-56] AlternativeTo — Omnivore (marcado como descontinuado após 15/nov/2024; comentários) — https://alternativeto.net/software/omnivore/about/ — review/fórum — acessado 2026-10-17


### S2 — PDF e anotação aprofundada (apps comerciais)

- [S2-1] MarginNote — Pricing — https://www.marginnote.com/en/pricing/ — oficial — sem data de publicação; acessado 2026-10-17
- [S2-2] MarginNote 4: AI Notes·MindMap — App Store (US) — https://apps.apple.com/us/app/-/id1531657269 — oficial (loja) — versão 4.4.6 de 23/ago (ano não exibido, inferido 2026); acessado 2026-10-17
- [S2-3] MarginNote — página inicial ("Where deep reading leaves a trace") — https://www.marginnote.com/en/ — oficial — © 2026, cita MN4.4; acessado 2026-10-17
- [S2-4] MarginNote — What's New — https://www.marginnote.com/en/whats-new/ — oficial — entradas de out/2025 (MN 4.2), ~fev/2026 (Zotero Connector), ~mar/2026 (MN 4.3), mai/2026 (MN 4.4); acessado 2026-10-17
- [S2-5] MarginNote Forum — "The current state of sync and other common bugs?" — https://forum.marginnote.com/t/the-current-state-of-sync-and-other-common-bugs/10790 — Reddit/fórum (fórum oficial) — posts de 22/ago a 13/set/2025; acessado 2026-10-17
- [S2-6] MarginNote Forum — "It's non production product, probably beta if not alpha" — https://forum.marginnote.com/t/its-non-production-product-probably-beta-if-not-alpha/9978 — Reddit/fórum (fórum oficial) — posts de 05/jan e 10/fev/2025; acessado 2026-10-17
- [S2-7] MarginNote Forum — "Sync Issue Between MacBook and iPad in MarginNote 4" — https://forum.marginnote.com/t/sync-issue-between-macbook-and-ipad-in-marginnote-4/10373 — Reddit/fórum — data não verificada (visto só via resultado de busca); acessado 2026-10-17
- [S2-8] LiquidText — página inicial — https://www.liquidtext.net/ — oficial — sem data; acessado 2026-10-17
- [S2-9] LiquidText — Pricing & Features — https://www.liquidtext.net/pricing-features — oficial — sem data (planos Basic, Pro 2023, LIVE, LIVE Unlimited; sem valores); acessado 2026-10-17
- [S2-10] LiquidText — App Store (US) — https://apps.apple.com/us/app/liquidtext-pdf-document-reader/id922765270 — oficial (loja) — versão 7.3.16 de 24/set (ano não exibido); preços de IAP em USD; acessado 2026-10-17
- [S2-11] LiquidText — News — https://www.liquidtext.net/news-2 — oficial — item "Real-Time Team Collaboration" de 17/abr/2025; links da Microsoft Store (ID 9N9Z9NSV47FL); acessado 2026-10-17
- [S2-12] MarTech Series — "LiquidText Announces Integration With ChatGPT and OpenAI Tools" — https://martechseries.com/predictive-ai/ai-platforms-machine-learning/liquidtext-announces-integration-with-chatgpt-and-openai-tools/ — notícia — 17/mai/2023; acessado 2026-10-17
- [S2-13] LiquidText — página da empresa no LinkedIn (post sobre a Legalweek 2026, "sneak preview" de IA) — https://linkedin.com/company/liquidtext — oficial (rede social) — 2026; visto só via resultado de busca, não aberto; acessado 2026-10-17
- [S2-14] AlternativeTo — LiquidText (reviews) — https://alternativeto.net/software/liquidtext/about — review — comentários de out/2020 a 30/dez/2025; acessado 2026-10-17
- [S2-15] Highlights: PDF Reader & Notes — App Store (US) — https://apps.apple.com/us/app/highlights-extract-pdf-notes/id1498912833 — oficial (loja) — versão 2026.3 de 10/out/2026; avaliação "overpriced" vista via resultado de busca; acessado 2026-10-17
- [S2-16] Highlights — página inicial ("The PDF Reader for Research") — https://highlightsapp.net/ — oficial — sem data; acessado 2026-10-17
- [S2-17] Highlights Pro — preços e recursos — https://highlightsapp.net/pro/ — oficial — sem data; acessado 2026-10-17
- [S2-18] Highlights Blog — "A New Siri" — https://highlightsapp.net/blog/2026/09/14/Siri-AI/ — oficial — 14/set/2026; acessado 2026-10-17
- [S2-19] Highlights — Changelog — https://highlightsapp.net/changelog/ — oficial — entradas de 2014 a set/2026; acessado 2026-10-17
- [S2-20] PDF Expert — Pricing — https://pdfexpert.com/pricing — oficial — preços exibidos em BRL (geolocalização); acessado 2026-10-17
- [S2-21] PDF Expert: Editor & Reader — App Store iOS (US) — https://apps.apple.com/us/app/pdf-expert-pdf-editor-reader/id743974925 — oficial (loja) — versão 7.26.2 (out/2026); acessado 2026-10-17
- [S2-22] PDF Expert — Mac App Store (US) — https://apps.apple.com/us/app/pdf-expert-edit-sign-pdfs/id1055273043 — oficial (loja) — versão 3.13.4 de 28/set (prepara para o macOS 27); acessado 2026-10-17
- [S2-23] PDF Expert — PDF Copilot — https://pdfexpert.com/pdf-copilot — oficial — sem data; acessado 2026-10-17
- [S2-24] PDF Expert — "How to explain PDFs with PDF Copilot" — https://pdfexpert.com/how-to-explain-pdfs-with-pdf-copilot — oficial — 17/dez/2025; acessado 2026-10-17
- [S2-25] AlternativeTo — PDF Expert (reviews) — https://alternativeto.net/software/pdf-expert/about/ — review — comentários de 2017 a 15/set/2026; acessado 2026-10-17
- [S2-26] Adobe — Acrobat pricing (individuals) — https://www.adobe.com/acrobat/pricing/pricing.html — oficial — sem data; acessado 2026-10-17
- [S2-27] Adobe — Acrobat AI Assistant / generative AI PDF — https://www.adobe.com/acrobat/generative-ai-pdf.html — oficial — sem data (inclui preços de Express e Studio); acessado 2026-10-17
- [S2-28] Adobe — Acrobat Studio — https://www.adobe.com/acrobat/acrobat-studio.html — oficial — © 2026; acessado 2026-10-17
- [S2-29] Adobe — Acrobat Express — https://www.adobe.com/acrobat/acrobat-express.html — oficial — sem data; acessado 2026-10-17
- [S2-30] Adobe — Acrobat pricing for students and teachers — https://www.adobe.com/acrobat/pricing/students.html — oficial — sem data; acessado 2026-10-17
- [S2-31] CXO Digital Pulse — "Adobe Launches Acrobat Studio, Reinventing the Future of PDFs with AI" — https://www.cxodigitalpulse.com/?p=36564 — notícia — 21/ago/2025; acessado 2026-10-17
- [S2-32] Macworld — "Adobe Acrobat Studio review: The most popular PDF editor goes all in on AI" — https://www.macworld.com/article/2960950/adobe-acrobat-studio-review.html — review — 12/nov/2025; acessado 2026-10-17
- [S2-33] PCWorld — Adobe Acrobat Studio review — https://www.pcworld.com/article/3146022/adobe-acrobat-studio-review-2.html — review — 28/mai/2026; acessado 2026-10-17
- [S2-34] Foxit — AI (PDF AI Assistant, Workspace, Local AI) — https://www.foxit.com/ai/ — oficial — "competitive comparison data as of July 2026"; acessado 2026-10-17
- [S2-35] Foxit — PDF Editor — https://www.foxit.com/pdf-editor/ — oficial — "published list rates in the US region as of July 2026"; acessado 2026-10-17
- [S2-36] Foxit — PDF Editor pricing — https://www.foxit.com/pdf-editor/pricing/ — oficial — © 2026; acessado 2026-10-17
- [S2-37] Foxit — PDF Editor version history (Windows) — https://www.foxit.com/pdf-editor/version-history.html — oficial — versões de 22/abr/2025 a 23/set/2026; acessado 2026-10-17
- [S2-38] Foxit — Press releases (página 1) — https://www.foxit.com/company/press.html — oficial — releases de abr/2025 a 01/set/2026 (títulos e datas; os textos individuais não carregaram); acessado 2026-10-17
- [S2-39] Xodo — Pricing — https://xodo.com/pricing — oficial — promoção válida até 31/dez/2026; acessado 2026-10-17
- [S2-40] Xodo — página inicial — https://xodo.com/ — oficial — posts do blog de set/2026; acessado 2026-10-17
- [S2-41] Xodo — AskPDF — https://xodo.com/ask-pdf — oficial — sem data; acessado 2026-10-17
- [S2-42] Xodo — PDF Studio — https://xodo.com/pdf-studio — oficial — sem data; acessado 2026-10-17
- [S2-43] Xodo — Free PDF Reader — https://xodo.com/pdf-studio/free-pdf-reader — oficial — sem data; acessado 2026-10-17
- [S2-44] AlternativeTo — Xodo (reviews) — https://alternativeto.net/software/xodo/about/ — review — comentários de 2016 a jun/2024; acessado 2026-10-17
- [S2-45] Drawboard — Drawboard PDF — https://www.drawboard.com/pdf — oficial — © 2026; acessado 2026-10-17
- [S2-46] Drawboard — Pricing — https://www.drawboard.com/pricing — oficial — sem data; acessado 2026-10-17
- [S2-47] Drawboard — Drawboard PDF Pro — https://www.drawboard.com/pdf/pro — oficial — © 2026; acessado 2026-10-17
- [S2-48] Drawboard — For students — https://www.drawboard.com/solutions/for-students — oficial — sem data; acessado 2026-10-17
- [S2-49] AlternativeTo — Drawboard PDF (reviews) — https://alternativeto.net/software/drawboard-pdf/about/ — review — comentários de jun/2022 e dez/2024; acessado 2026-10-17
- [S2-50] Microsoft Store — "Drawboard PDF + Notes" — https://apps.microsoft.com/detail/9wzdncrfhwqt — oficial (loja) — só o título carregou (página renderizada por JS); acessado 2026-10-17
- [S2-51] Capterra — LiquidText (reviews; menciona problemas de sync entre Windows e Apple) — https://www.capterra.co.uk/software/1033403/liquid-text — review — data não verificada (visto só via resultado de busca); acessado 2026-10-17


### S3 — PDF/PKM para pesquisa e tablet com IA

- [S3-1] Zotero Blog (índice: "A Faster Release Cycle", Zotero 9, Zotero 10, Read Aloud on iOS) — https://www.zotero.org/blog/ — oficial — posts de 2026-01-22 a 2026-10-05; acessado 2026-10-17
- [S3-2] Zotero 7: Zotero, redesigned — https://www.zotero.org/blog/zotero-7/ — oficial — ago/2024; acessado 2026-10-17
- [S3-3] Announcing Zotero 8 (fórum oficial) — https://forums.zotero.org/discussion/comment/506159 — oficial (fórum) — 2026-01-22; acessado 2026-10-17
- [S3-4] Zotero 8 brings unified citation dialog, improved reading, note tabs and Linux ARM support — https://alternativeto.net/news/2026/1/zotero-8-brings-unified-citation-dialog-improved-reading-note-tabs-and-linux-arm-support — notícia — jan/2026; acessado 2026-10-17
- [S3-5] Zotero 9 — https://www.zotero.org/blog/zotero-9/ — oficial — 2026-04-10; acessado 2026-10-17
- [S3-6] Zotero Version History / changelog (série 10.0; 10.0 em 2026-08-17, 10.0.6 em 2026-10-07) — https://www.zotero.org/support/changelog — oficial — 2026; acessado 2026-10-17
- [S3-7] Zotero PDF Reader (documentação) — https://www.zotero.org/support/pdf_reader — oficial — data não informada; acessado 2026-10-17
- [S3-8] Zotero Storage (planos e preços) — https://www.zotero.org/storage — oficial — preços vigentes; acessado 2026-10-17
- [S3-9] Zotero Sync (documentação: dados grátis e ilimitados; Zotero Storage vs WebDAV) — https://www.zotero.org/support/sync — oficial — acessado 2026-10-17
- [S3-10] Zotero for iOS (documentação) — https://www.zotero.org/support/ios — oficial — atualizado 2023-01-01; acessado 2026-10-17
- [S3-11] Zotero for Android (documentação) — https://www.zotero.org/support/android — oficial — atualizado 2025-06-04; acessado 2026-10-17
- [S3-12] Zotero for Android (blog) — https://www.zotero.org/blog/zotero-for-android/ — oficial — ≈jun/2025 (data exata não verificada); acessado 2026-10-17
- [S3-13] AI ‘Elephant in the Room’: What Is Zotero’s Strategy? — https://forums.zotero.org/discussion/comment/514084/ — Reddit/fórum (Zotero Forums) — 2026-06-03 a 2026-08-12; acessado 2026-10-17
- [S3-14] Beaver: Zotero AI plugin to chat with your library… — https://forums.zotero.org/discussion/126573/beaver-zotero-ai-plugin-to-chat-with-your-library-organize-discover-research-and-read-papers/p1 — Reddit/fórum (anúncio do desenvolvedor) — 2025-09-07, editado 2026-02-08, respostas até 2026-03-20; acessado 2026-10-17
- [S3-15] CASRAI — Best Zotero AI plugins (comparativo) — https://casrai.org/compare/best-zotero-ai-plugins — review — atualizado 2026-07-30; acessado 2026-10-17
- [S3-16] llm-for-zotero (GitHub, yilewang) — https://github.com/yilewang/llm-for-zotero — oficial (repositório) — acessado 2026-10-17
- [S3-17] papersgpt-for-zotero (GitHub) — https://github.com/papersgpt/papersgpt-for-zotero — oficial (repositório) — acessado 2026-10-17
- [S3-18] Zettlr — On the recent issues with Zotero 8 and Better BibTeX — https://zettlr.com/post/on-the-recent-issues-with-zotero-8-and-better-bibtex — notícia (blog de produto terceiro) — 2026-03-07; acessado 2026-10-17
- [S3-19] Zotero iPad annotations missing — Zotero Sync issue? — https://forums.zotero.org/discussion/comment/505479 — Reddit/fórum — data não verificada; acessado 2026-10-17
- [S3-20] Annotations made in iOS Zotero not appearing in external reader on a PC — https://forums.zotero.org/discussion/comment/417756/ — Reddit/fórum — data não verificada; acessado 2026-10-17
- [S3-21] Heptabase (home) — https://heptabase.com/ — oficial — © 2026; acessado 2026-10-17
- [S3-22] Heptabase Pricing — https://heptabase.com/pricing — oficial — preços vigentes; acessado 2026-10-17
- [S3-23] Heptabase Changelog — https://wiki.heptabase.com/changelog — oficial — entradas jan–out/2026; acessado 2026-10-17
- [S3-24] Heptabase Roadmap — https://wiki.heptabase.com/roadmap — oficial — acessado 2026-10-17
- [S3-25] Heptabase Wiki — Read PDFs, media, eBooks & webpages — https://wiki.heptabase.com/pdf-annotation — oficial — acessado 2026-10-17
- [S3-26] Heptabase Wiki — The best way to acquire knowledge from readings — https://wiki.heptabase.com/the-best-way-to-acquire-knowledge-from-readings — oficial — acessado 2026-10-17
- [S3-27] Heptabase Wiki — Work with AI — https://wiki.heptabase.com/work-with-ai — oficial — acessado 2026-10-17
- [S3-28] Heptabase AI Tutor — https://heptabase.com/ai-tutor — oficial — acessado 2026-10-17
- [S3-29] Heptabase reviews (Product Hunt) — https://www.producthunt.com/products/heptabase/reviews — review — reviews de ~2023–2024 (datas relativas); acessado 2026-10-17
- [S3-30] Obsidian Pricing — https://obsidian.md/pricing — oficial — preços vigentes; acessado 2026-10-17
- [S3-31] Obsidian Changelog — https://obsidian.md/changelog/ — oficial — entradas 2026-08-07 a 2026-10-05; acessado 2026-10-17
- [S3-32] Obsidian is now free for work — https://obsidian.md/blog/free-for-work/ — oficial — 2025-02-20; acessado 2026-10-17
- [S3-33] Obsidian Web Clipper — https://obsidian.md/clipper — oficial — acessado 2026-10-17
- [S3-34] Obsidian Help — Web Clipper Interpreter — https://obsidian.md/help/web-clipper/interpreter — oficial — acessado 2026-10-17
- [S3-35] Obsidian Help — Bases — https://obsidian.md/help/bases — oficial — acessado 2026-10-17
- [S3-36] PDF++ (GitHub, RyotaUshio/obsidian-pdf-plus) — https://github.com/RyotaUshio/obsidian-pdf-plus — oficial (repositório) — acessado 2026-10-17
- [S3-37] PDF++ releases (GitHub API; 0.40.31 em 2025-08-30) — https://api.github.com/repos/RyotaUshio/obsidian-pdf-plus/releases — oficial (repositório) — acessado 2026-10-17
- [S3-38] Obsidian Annotator (GitHub, elias-sundqvist) — https://github.com/elias-sundqvist/obsidian-annotator — oficial (repositório) — última release 0.2.11 em 2024-01-06; acessado 2026-10-17
- [S3-39] Obsidian Zotero Integration (GitHub, mgmeyers) — https://github.com/mgmeyers/obsidian-zotero-integration — oficial (repositório) — acessado 2026-10-17
- [S3-40] Obsidian Zotero Integration releases (GitHub API; 3.2.1 em 2024-08-11) — https://api.github.com/repos/mgmeyers/obsidian-zotero-integration/releases — oficial (repositório) — acessado 2026-10-17
- [S3-41] Obsidian Spaced Repetition (GitHub, st3v3nmw) — https://github.com/st3v3nmw/obsidian-spaced-repetition — oficial (repositório) — acessado 2026-10-17
- [S3-42] Obsidian Spaced Repetition releases (GitHub API; FSRS na 1.15.0 em 2026-05-24; 1.15.4 em 2026-06-14) — https://api.github.com/repos/st3v3nmw/obsidian-spaced-repetition/releases — oficial (repositório) — acessado 2026-10-17
- [S3-43] Obsidian Forum — Feature requests (top, all time) — https://forum.obsidian.md/c/feature-requests/8/l/top?period=all — Reddit/fórum — acessado 2026-10-17
- [S3-44] Logseq Blog — https://blog.logseq.com/ — oficial — último post 2024-08-31; acessado 2026-10-17
- [S3-45] Logseq releases (GitHub API; 0.10.14 em 2025-09-18, 0.10.15 em 2025-12-01, 2.0.1 em 2026-07-13, 2.0.2 em 2026-10-07) — https://api.github.com/repos/logseq/logseq/releases — oficial (repositório) — acessado 2026-10-17
- [S3-46] Logseq Desktop App 2.0.1 (DB version, Beta) — https://github.com/logseq/logseq/releases/tag/2.0.1 — oficial — 2026-07-13; acessado 2026-10-17
- [S3-47] Big update: Logseq is splitting into two versions — https://logseq.io/p/e3YDyX5AYr — oficial — 2026-04-24; acessado 2026-10-17
- [S3-48] Logseq live roadmap — https://logseq.io/p/NX4mc_ggEV — oficial — página datada 2026-10-07; acessado 2026-10-17
- [S3-49] Logseq — Open Collective (tiers) — https://opencollective.com/logseq — oficial — acessado 2026-10-17
- [S3-50] Logseq docs — PDF highlights — https://raw.githubusercontent.com/logseq/docs/master/pages/PDF%20highlights.md — oficial (documentação) — data não informada; acessado 2026-10-17
- [S3-51] Goodnotes Pricing (inclui FAQ de AI Pass e plataformas) — https://www.goodnotes.com/pricing — oficial — preços vigentes; acessado 2026-10-17
- [S3-52] Goodnotes (home) — https://www.goodnotes.com/ — oficial — © 2026; acessado 2026-10-17
- [S3-53] Goodnotes AI — https://www.goodnotes.com/ai — oficial — © 2026; acessado 2026-10-17
- [S3-54] Goodnotes Blog (índice; posts jul–out/2026, incl. "What's new in Goodnotes: July - September 2026") — https://www.goodnotes.com/blog — oficial — 2026; acessado 2026-10-17
- [S3-55] Notability Pricing — https://www.notability.com/pricing — oficial — preços vigentes (banner "20% off"); acessado 2026-10-17
- [S3-56] Notability (home) — https://www.notability.com/ — oficial — © 2026; acessado 2026-10-17
- [S3-57] Compare all Microsoft 365 plans — https://www.microsoft.com/en-us/microsoft-365/buy/compare-all-microsoft-365-products — oficial — preços vigentes; acessado 2026-10-17
- [S3-58] Copilot is now included in Microsoft 365 Personal and Family — https://www.microsoft.com/en-us/microsoft-365/blog/2025/01/16/copilot-is-now-included-in-microsoft-365-personal-and-family/ — oficial — 2025-01-16; acessado 2026-10-17
- [S3-59] Microsoft Support — Copilot in OneNote — https://support.microsoft.com/en-us/copilot-onenote — oficial — data não informada; acessado 2026-10-17
- [S3-60] Samsung Galaxy AI (US) — https://www.samsung.com/us/galaxy-ai/ — oficial — "As of July 2026"; acessado 2026-10-17
- [S3-61] Samsung Notes — Microsoft Store — https://apps.microsoft.com/detail/9nblggh43vhv — oficial (loja) — acessado 2026-10-17


### S4 — Estudo e revisão espaçada (SRS)

- [S4-1] RemNote — Pricing — https://www.remnote.com/pricing — oficial — acessado 2026-10-17
- [S4-2] RemNote — homepage — https://www.remnote.com/ — oficial — acessado 2026-10-17
- [S4-3] RemNote Help — Learning from PDFs and Files with the RemNote Reader — https://help.remnote.com/en/articles/6690975-learning-from-pdfs-and-files-with-the-remnote-reader — oficial — atualizado 2026-08-21; acessado 2026-10-17
- [S4-4] RemNote Help — Supported File Types for Annotation — https://help.remnote.com/en/articles/7925615-supported-file-types-for-annotation — oficial — atualizado 2026-08-12; acessado 2026-10-17
- [S4-5] RemNote Help — Guided Learn Mode — https://help.remnote.com/en/articles/15724936-guided-learn-mode — oficial — 2026-09-04; acessado 2026-10-17
- [S4-6] RemNote — Annotate PDF (feature page) — https://www.remnote.com/feature/annotate-pdf — oficial — acessado 2026-10-17
- [S4-7] RemNote — Learn Any PDF (feature page) — https://www.remnote.com/feature/learn-any-pdf — oficial — acessado 2026-10-17
- [S4-8] RemNote Help — The FSRS Spaced Repetition Algorithm — https://help.remnote.com/en/articles/9124137-the-fsrs-spaced-repetition-algorithm — oficial — atualizado 2026-08-21; acessado 2026-10-17
- [S4-9] RemNote — FSRS v6: Remember Anything (feature page) — https://www.remnote.com/feature/fsrs — oficial — acessado 2026-10-17
- [S4-10] RemNote — Offline Mode (feature page) — https://www.remnote.com/feature/offline-mode — oficial — acessado 2026-10-17
- [S4-11] RemNote — Lecture Recorder (feature page) — https://www.remnote.com/feature/lecture-recorder — oficial — acessado 2026-10-17
- [S4-12] RemNote — Download — https://www.remnote.com/download — oficial — acessado 2026-10-17
- [S4-13] RemNote — Changelog (RSS) — https://feedback.remnote.com/rss/changelog.xml — oficial — entradas de 2026-04-23 a 2026-10-16; acessado 2026-10-17
- [S4-14] RemNote Help — Importing & Exporting (coleção) — https://help.remnote.com/en/collections/3939596-importing-exporting — oficial — acessado 2026-10-17
- [S4-15] tl;dv — "TL;DR: Is RemNote a Worthy Study Companion in 2026?" — https://tldv.io/blog/remnote/ — review — 2026-04-20; acessado 2026-10-17
- [S4-16] Trustpilot — RemNote — https://www.trustpilot.com/review/remnote.com — review — reviews de 2025–2026 (12 no total); acessado 2026-10-17
- [S4-17] Product Hunt — RemNote reviews — https://www.producthunt.com/products/remnote/reviews — review — reviews de ~2025 (datas relativas); acessado 2026-10-17
- [S4-18] RemNote Forum — Top topics — https://forum.remnote.io/top?period=yearly — Reddit/fórum — tópicos de 2022–2023; acessado 2026-10-17
- [S4-19] Anki — GitHub Releases — https://github.com/ankitects/anki/releases — oficial — última 26.09.3 (23/set/2026); acessado 2026-10-17
- [S4-20] Anki 23.10 release notes — https://github.com/ankitects/anki/releases/tag/23.10 — oficial — 31/out/2023; acessado 2026-10-17
- [S4-21] Anki 25.07 release notes (espelho newreleases.io) — https://newreleases.io/project/github/ankitects/anki/release/25.07 — oficial (espelho) — jul/2025; acessado 2026-10-17
- [S4-22] Anki 25.09 release notes — https://github.com/ankitects/anki/releases/tag/25.09 — oficial — 06/set/2025; acessado 2026-10-17
- [S4-23] Anki 26.05 release notes — https://github.com/ankitects/anki/releases/tag/26.05 — oficial — 16/jun/2026; acessado 2026-10-17
- [S4-24] Anki 26.08 release notes — https://github.com/ankitects/anki/releases/tag/26.08 — oficial — 01/ago/2026; acessado 2026-10-17
- [S4-25] Anki Manual — Deck Options (FSRS) — https://docs.ankiweb.net/deck-options.html — oficial — acessado 2026-10-17
- [S4-26] Anki — Downloads — https://apps.ankiweb.net/ — oficial — acessado 2026-10-17
- [S4-27] Anki Forums — "Anki's Growing Up" (dae) — https://forums.ankiweb.net/t/ankis-growing-up/68610 — oficial (fórum) — 2026-02-02; acessado 2026-10-17
- [S4-28] Anki Forums — resposta da AnkiHub em "Anki's Growing Up" — https://forums.ankiweb.net/t/ankis-growing-up/68610/2 — oficial (fórum) — 2026-02-02; acessado 2026-10-17
- [S4-29] Anki Forums — esclarecimento de dae (post 110) — https://forums.ankiweb.net/t/ankis-growing-up/68610/110 — oficial (fórum) — 2026-02-04; acessado 2026-10-17
- [S4-30] Anki Forums — "Anki 26.05 Beta 1" — https://forums.ankiweb.net/t/anki-26-05-beta-1/69707 — Reddit/fórum — 2026-05-11; acessado 2026-10-17
- [S4-31] Anki Forums — "Regarding the road-map" — https://forums.ankiweb.net/t/regarding-the-road-map/69621 — Reddit/fórum — 2026-05-03; acessado 2026-10-17
- [S4-32] Anki Forums — "An important note about updating to 26.05 (and later)" — https://forums.ankiweb.net/t/an-important-note-about-updating-to-26-05-and-later/70139/1 — oficial (fórum) — 2026 (conteúdo visto via resultado de busca); acessado 2026-10-17
- [S4-33] Anki Forums — "AnkiDroid 2025 #wrapped" — https://forums.ankiweb.net/t/ankidroid-2025-wrapped/68014 — oficial (fórum) — 2025-12-31; acessado 2026-10-17
- [S4-34] AnkiHub — homepage (planos) — https://www.ankihub.net/ — oficial — acessado 2026-10-17
- [S4-35] Anki Forums — "AnkiHub subscription" — https://forums.ankiweb.net/t/ankihub-subscription/70515 — Reddit/fórum — 2026 (visto via resultado de busca); acessado 2026-10-17
- [S4-36] GitHub — ankimcp/anki-mcp-server — https://github.com/ankimcp/anki-mcp-server — oficial (projeto comunitário) — v0.27.0; acessado 2026-10-17
- [S4-37] Anki Forums — "Anki add-on: review cards using AI" — https://forums.ankiweb.net/t/anki-add-on-review-cards-using-ai/70363 — Reddit/fórum — 2026-07-10; acessado 2026-10-17
- [S4-38] Anki Forums — "AI-Hints Anki Add-on" — https://forums.ankiweb.net/t/ai-hints-anki-add-on/69651 — Reddit/fórum — 2026 (visto via resultado de busca); acessado 2026-10-17
- [S4-39] GitHub — Colmmm/notes2flash — https://github.com/Colmmm/notes2flash — oficial (projeto comunitário) — visto via resultado de busca; acessado 2026-10-17
- [S4-40] Anki Forums — "Bug?: New FSRS 6 parameters not appearing after reoptimizing" — https://forums.ankiweb.net/t/bug-new-fsrs-6-parameters-not-appearing-after-reoptimizing/64921 — Reddit/fórum — 2025 (visto via resultado de busca); acessado 2026-10-17
- [S4-41] Mochi — Pricing & Plans — https://mochi.cards/pricing/ — oficial — acessado 2026-10-17
- [S4-42] Mochi — homepage — https://mochi.cards/ — oficial — acessado 2026-10-17
- [S4-43] Mochi Docs — FSRS — https://mochi.cards/docs/reviewing/fsrs/ — oficial — acessado 2026-10-17
- [S4-44] Mochi Docs — Dynamic Fields — https://mochi.cards/docs/templates/dynamic-fields/ — oficial — acessado 2026-10-17
- [S4-45] Mochi — Changelog — https://mochi.cards/changelog/ — oficial — entradas de fev/2025 a 21/set/2026; acessado 2026-10-17
- [S4-46] Mochi Docs — índice — https://mochi.cards/docs/ — oficial — acessado 2026-10-17
- [S4-47] SuperMemo Store — SuperMemo 20 for Windows — https://supermemo.store/products/supermemo-20-for-windows — oficial — acessado 2026-10-17
- [S4-48] SuperMemo Store — SuperMemo 19 for Windows — https://supermemo.store/products/supermemo-19-for-windows — oficial — acessado 2026-10-17
- [S4-49] SuperMemo Store — home (destino do redirect 301 de super-memo.com) — https://supermemo.store/ — oficial — acessado 2026-10-17
- [S4-50] Wikipedia — SuperMemo — https://en.wikipedia.org/wiki/SuperMemo — secundária (enciclopédia) — infobox: 20.00.32, 29/jun/2026; acessado 2026-10-17
- [S4-51] Wikipedia — Incremental reading — https://en.wikipedia.org/wiki/Incremental_reading — secundária (enciclopédia) — acessado 2026-10-17
- [S4-52] SuperMemo World — supermemo.com — https://www.supermemo.com/en — oficial — acessado 2026-10-17
- [S4-53] SuperMemo API — About — https://api.supermemo.com/about — oficial — acessado 2026-10-17
- [S4-54] Migaku — "Spaced Repetition in 2026: How It Actually Works" — https://migaku.com/blog/language-fun/spaced-repetition-in-2026-how-it-actually-works — notícia/blog (secundária; contém imprecisões) — atualizado 2026-05-03; acessado 2026-10-17
- [S4-55] Trustpilot — supermemo.com — https://www.trustpilot.com/review/supermemo.com — review — 1 review (2026-06-19); acessado 2026-10-17
- [S4-56] Traverse — homepage — https://traverse.link/ — oficial — acessado 2026-10-17
- [S4-57] App Store — "Traverse - Learn Effectively" — https://apps.apple.com/us/app/traverse-learn-effectively/id6446630278 — oficial (loja) — última versão 1.0.8 (18/jul/2024); acessado 2026-10-17
- [S4-58] AlternativeTo — Traverse — https://alternativeto.net/software/traverse/about — review (agregador) — página atualizada em 2023-03-30; acessado 2026-10-17
- [S4-59] Brainscape — Pricing — https://www.brainscape.com/pricing — oficial — acessado 2026-10-17
- [S4-60] Brainscape — homepage — https://www.brainscape.com/ — oficial — acessado 2026-10-17
- [S4-61] App Store — "Brainscape - Study Flashcards" — https://apps.apple.com/us/app/brainscape-study-flashcards/id442415567 — oficial (loja) — versão 4.20260923; acessado 2026-10-17
- [S4-62] Trustpilot — Brainscape — https://au.trustpilot.com/review/brainscape.com — review — reviews e respostas da empresa até 2026-10-09; acessado 2026-10-17
- [S4-63] Wikipedia — Brainscape — https://en.wikipedia.org/wiki/Brainscape — secundária (enciclopédia) — acessado 2026-10-17
- [S4-64] GitHub — open-spaced-repetition/srs-benchmark — https://github.com/open-spaced-repetition/srs-benchmark — oficial (projeto open-source) — acessado 2026-10-17
- [S4-65] supermemo.guru — SuperMemo (wiki) — https://supermemo.guru/wiki/SuperMemo — oficial — visto só via resultado de busca (acesso direto retornou 403); acessado 2026-10-17


### S5 — Estudo com IA e pesquisa acadêmica

- [S5-1] Quizlet: AI Study Flashcards — App Store (EUA) — https://apps.apple.com/us/app/quizlet-ai-study-flashcards/id546473125 — oficial — v10.56 (out/2026); acessado 2026-10-17
- [S5-2] Quizlet: 2º relatório "How America Learns" e novos recursos (press release sindicado) — https://www.webull.ca/news-detail/15344458957874176 — notícia — 2026-08-04; acessado 2026-10-17
- [S5-3] Quizlet: novos recursos com o relatório How America Learns 2026 — https://techrseries.com/?p=184470 — notícia — 2026-08-04; acessado 2026-10-17
- [S5-4] Quizlet Adds AI-Powered Tools for Active Practice, Note-taking — THE Journal — https://thejournal.com/articles/2026/02/13/quizlet-adds-ai-powered-tools-for-active-practice-notetaking.aspx — notícia — 2026-02-13; acessado 2026-10-17
- [S5-5] Quizlet Review 2026: Pricing, Free Tier Cuts, and Best Alternatives — My Engineering Buddy — https://www.myengineeringbuddy.com/blog/quizlet-reviews-alternatives-pricing-offerings/ — review (empresa de tutoria, interesse comercial) — atualizado 2026-10-15; acessado 2026-10-17
- [S5-6] Quizlet Cost in 2026: What Free vs. Paid Gets You — Nibble — https://nibble-app.com/blog/quizlet-cost — review (concorrente) — preço checado 2026-09-08 segundo resultado de busca; não aberto diretamente; acessado 2026-10-17
- [S5-7] Quizlet Q-Chat Was Discontinued: 7 Alternatives for 2026 — Quizgecko — https://quizgecko.com/blog/best-q-chat-alternative — review (concorrente; conteúdo via resultado de busca, página 403) — 2026; acessado 2026-10-17
- [S5-8] Quizlet Q-Chat guide — artificial-intelligence-wiki.com — https://artificial-intelligence-wiki.com/industry-ai/ai-in-education/quizlet-q-chat-guide/ — review (conteúdo via resultado de busca) — data desconhecida; acessado 2026-10-17
- [S5-9] Quizlet Launches as Native App in ChatGPT (PR Newswire, via StreetInsider) — https://www.streetinsider.com/PRNewswire/Quizlet+Launches+as+Native+App+in+ChatGPT+to+Transform+AI-Powered+Learning/26142955.html — notícia (página 403; data mar/2026 via resultado de busca) — mar/2026; acessado 2026-10-17
- [S5-10] Knowt — página inicial — https://knowt.com/ — oficial — acessado 2026-10-17
- [S5-11] Knowt — Plans — https://knowt.com/plans — oficial — acessado 2026-10-17
- [S5-12] Knowt Help Center — coleção "Studying" — https://help.knowt.com/en/collections/11169506-studying — oficial — acessado 2026-10-17
- [S5-13] Knowt Help — How do I use Spaced Repetition mode? — https://help.knowt.com/en/articles/10714645-how-do-i-use-spaced-repetition-mode — oficial — acessado 2026-10-17
- [S5-14] Knowt Help — How do I see how much AI I'm using? — https://help.knowt.com/en/articles/10714626-how-do-i-see-how-much-ai-i-m-using — oficial — acessado 2026-10-17
- [S5-15] StudyFetch — página inicial e FAQ — https://www.studyfetch.com/ — oficial — acessado 2026-10-17
- [S5-16] StudyFetch: Make Learning Easy — App Store (EUA) — https://apps.apple.com/us/app/studyfetch-make-learning-easy/id6663574866 — oficial — v3.1.1 (out/2026); acessado 2026-10-17
- [S5-17] Is StudyFetch Worth Your Money in 2026? — tl;dv — https://tldv.io/blog/studyfetch-review/ — review — 2026-03-25; acessado 2026-10-17
- [S5-18] Study Fetch review — Dupple — https://dupple.com/reviews/study-fetch — review (conteúdo via resultado de busca) — jul/2026; acessado 2026-10-17
- [S5-19] Notion — Pricing — https://www.notion.com/pricing — oficial — acessado 2026-10-17
- [S5-20] Notion for Education — https://www.notion.com/product/notion-for-education — oficial — acessado 2026-10-17
- [S5-21] Notion — Releases (jul–out/2026) — https://www.notion.com/releases — oficial — 2026-07-24 a 2026-10-13; acessado 2026-10-17
- [S5-22] Working offline in Notion — Help Center — https://www.notion.com/help/guides/working-offline-in-notion-everything-you-need-to-know — oficial — acessado 2026-10-17
- [S5-23] Notion AI FAQs — Help Center — https://www.notion.com/help/notion-ai-faqs — oficial — acessado 2026-10-17
- [S5-24] 6 ways to use NotebookLM to master any subject — Google Keyword blog — https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-student-features/ — oficial — 2025-09-08; acessado 2026-10-17
- [S5-25] NotebookLM flashcards and quizzes — 9to5Google — https://9to5google.com/2025/09/08/notebooklm-flashcards-quizzes/ — notícia (via resultado de busca) — 2025-09-08; acessado 2026-10-17
- [S5-26] Gemini Notebook Help Center (antigo NotebookLM Help) — https://support.google.com/notebooklm/ — oficial — acessado 2026-10-17
- [S5-27] Learn about Gemini Notebook's plans — https://support.google.com/gemininotebook/answer/16213268?hl=en — oficial — acessado 2026-10-17
- [S5-28] Manage your Gemini Notebook usage limits — https://support.google.com/gemininotebook/answer/17670842?hl=en — oficial — acessado 2026-10-17
- [S5-29] Generate Flashcards or Quizzes in Gemini Notebook — https://support.google.com/gemininotebook/answer/16958963?hl=en — oficial — acessado 2026-10-17
- [S5-30] Add or discover new sources for your notebook — https://support.google.com/gemininotebook/answer/16215270?hl=en — oficial — acessado 2026-10-17
- [S5-31] Use chat in Gemini Notebook — https://support.google.com/gemininotebook/answer/16179559?hl=en — oficial — acessado 2026-10-17
- [S5-32] Notebooks in Gemini Apps — https://support.google.com/gemininotebook/answer/17003757?hl=en — oficial — acessado 2026-10-17
- [S5-33] Gemini Notebook (antigo NotebookLM) — Wikipedia — https://en.wikipedia.org/wiki/NotebookLM — enciclopédia (rename em 2026-07-16 citando The Verge; página com aviso de possível texto não verificado) — editada 2026-10-17; acessado 2026-10-17
- [S5-34] Google AI Plans (EUA) — https://gemini.google/us/subscriptions/?hl=en — oficial — acessado 2026-10-17
- [S5-35] Planos Google AI (Brasil, BRL) — https://gemini.google/subscriptions/ — oficial — acessado 2026-10-17
- [S5-36] Elicit — Pricing — https://elicit.com/pricing — oficial — acessado 2026-10-17
- [S5-37] Elicit — Blog (2025–2026) — https://elicit.com/blog — oficial — posts de 2025-01-30 a 2026-09-30; acessado 2026-10-17
- [S5-38] A more powerful Research Agent, with updated usage limits — Elicit — https://elicit.com/blog/more-powerful-research-agent-with-updated-usage-limits — oficial — 2026-06-30; acessado 2026-10-17
- [S5-39] Consensus — página inicial (com metadados de oferta) — https://www.consensus.app/ — oficial — acessado 2026-10-17
- [S5-40] Consensus — Blog (set–out/2026) — https://consensus.app/home/blog/ — oficial — 2026-09-01 a 2026-10-08; acessado 2026-10-17
- [S5-41] What's Changed in Consensus? (Summer '26) — https://consensus.app/home/blog/what-has-changed-in-consensus-summer-26/ — oficial — 2026-09-09; acessado 2026-10-17
- [S5-42] How to Use Consensus for Research — https://consensus.app/home/blog/how-to-use-consensus-for-research/ — oficial — 2026-10-08; acessado 2026-10-17
- [S5-43] Consensus Everywhere — https://consensus.app/home/blog/consensus-everywhere/ — oficial — 2026-09-14; acessado 2026-10-17
- [S5-44] SciSpace: Do hours of research in minutes — Chrome Web Store — https://chromewebstore.google.com/detail/scispace-do-hours-of-rese/cipccbpjpemcnijhjcdjmkjhmhniiick — oficial (loja) — atualizado 2026-10-09; acessado 2026-10-17
- [S5-45] Scholarcy Browser Extension — Chrome Web Store — https://chromewebstore.google.com/detail/scholarcy-browser-extensi/oekgknkmgmaehhpegfeioenikocgbcib — oficial (loja) — atualizado 2026-03-14; acessado 2026-10-17
- [S5-46] ResearchRabbit — página inicial — https://www.researchrabbit.ai/ — oficial — acessado 2026-10-17
- [S5-47] ResearchRabbit — Pricing (rodapé "Copyright © Litmap Limited. 2016-2026") — https://www.researchrabbit.ai/pricing — oficial — acessado 2026-10-17
- [S5-48] Litmaps — Pricing — https://www.litmaps.com/pricing — oficial — acessado 2026-10-17
- [S5-49] Litmaps — página inicial — https://www.litmaps.com/ — oficial — acessado 2026-10-17
- [S5-50] Semantic Reader — Semantic Scholar — https://www.semanticscholar.org/product/semantic-reader — oficial — acessado 2026-10-17
- [S5-51] Semantic Scholar — Product — https://www.semanticscholar.org/product — oficial — acessado 2026-10-17
- [S5-52] Anúncio do Asta (Ai2 blog; título exato não registrado) — https://allenai.org/blog/asta — oficial — 2025-08-26; acessado 2026-10-17
- [S5-53] Asta — Ai2 — https://allenai.org/asta — oficial — acessado 2026-10-17
- [S5-54] What a year of testing & thinking about AI academic search taught me — Aaron Tay (Substack) — https://aarontay.substack.com/p/what-a-year-of-testing-and-thinking — review/blog especializado — 2026-06-08; acessado 2026-10-17


### S6 — Anotação de cursos/vídeo e métodos de estudo

- [S6-1] Media Extended (diretório oficial de plugins do Obsidian) — https://community.obsidian.md/plugins/media-extended — oficial — v4.2.9 "last updated last week"; acessado 2026-10-17
- [S6-2] aidenlx/media-extended (README no GitHub) — https://github.com/aidenlx/media-extended — oficial — sem data de release visível; acessado 2026-10-17
- [S6-3] Media Extended — Obsidian Stats (histórico de versões; 4.0.0-beta.1 em 2025-04-25) — https://www.obsidianstats.com/plugins/media-extended — review/agregador — 2025; acessado 2026-10-17 (via resultado de busca)
- [S6-4] Timestamp Notes (diretório oficial de plugins do Obsidian) — https://community.obsidian.md/plugins/obsidian-timestamp-notes — oficial — v1.0.8, "last updated 4 years ago"; acessado 2026-10-17
- [S6-5] "Taking Notes while watching Video in 2025" — https://forum.obsidian.md/t/taking-notes-while-watching-video-in-2025/96837 — Reddit/fórum — 2025-02-17 a 2025-02-19; acessado 2026-10-17
- [S6-6] "Clickable YouTube timestamps (Timecodes plugin)" — https://forum.obsidian.md/t/clickable-youtube-timestamps-timecodes-plugin/96253 — Reddit/fórum — 2025-02-06 (última resposta 2025-12-31); acessado 2026-10-17
- [S6-7] Notion — Pricing — https://www.notion.com/pricing — oficial — sem data; acessado 2026-10-17
- [S6-8] Notion — AI Meeting Notes — https://www.notion.com/product/ai-meeting-notes — oficial — sem data; acessado 2026-10-17
- [S6-9] Snipo — "Video Notes to Notion in One Click" — https://snipo.io/ — oficial — sem data; acessado 2026-10-17
- [S6-10] Glasp — Pricing — https://glasp.co/pricing — oficial — sem data; acessado 2026-10-17
- [S6-11] Glasp — "How to Highlight YouTube Transcript" — https://glasp.co/posts/how-to-highlight-youtube-transcript — oficial — 2025-09-01; acessado 2026-10-17
- [S6-12] Snipd — Pricing — https://www.snipd.com/pricing — oficial — sem data; acessado 2026-10-17
- [S6-13] Snipd — página inicial — https://www.snipd.com/ — oficial — sem data; acessado 2026-10-17
- [S6-14] Snipd Official (plugin no diretório do Obsidian) — https://community.obsidian.md/plugins/snipd-official — oficial — v1.3.2, atualizado ~set/2026; acessado 2026-10-17
- [S6-15] Recall — Pricing (redirecionado de getrecall.ai/pricing) — https://www.recall.it/pricing — oficial — sem data; acessado 2026-10-17
- [S6-16] Recall — About — https://www.recall.it/about — oficial — sem data; acessado 2026-10-17
- [S6-17] Recall — Release notes "Recall 2.0" — https://feedback.recall.it/changelog/recall-release-notes-april-14-2026-recall-20 — oficial — 2026-04-14; acessado 2026-10-17
- [S6-18] Mindgrasp — página inicial — https://www.mindgrasp.ai/ — oficial — sem data (/pricing retornou 404); acessado 2026-10-17
- [S6-19] Otter.ai — Pricing — https://otter.ai/pricing — oficial — sem data; acessado 2026-10-17
- [S6-20] Otter.ai Blog — "Back to school, half the price: Otter.ai offers students 50% off…" — https://otter.ai/blog/back-to-school-half-the-price-otter-ai-offers-students-50-off-to-turn-lectures-into-study-guides-quizzes-and-exam-prep — oficial — 2026-08-26; acessado 2026-10-17
- [S6-21] NPR — "Class-action suit claims Otter AI secretly records private work conversations" — https://www.npr.org/2025/08/15/g-s1-83087/otter-ai-transcription-class-action-lawsuit — notícia — 2025-08-15; acessado 2026-10-17 (conteúdo via resultado de busca; o fetch expirou)
- [S6-22] PPC Land — "Otter.ai faces class action lawsuit for unauthorized meeting recording" — https://ppc.land/otter-ai-faces-class-action-lawsuit-for-unauthorized-meeting-recording/ — notícia — 2025-08 (ação ajuizada em 2025-08-15); acessado 2026-10-17
- [S6-23] Notta — Pricing — https://www.notta.ai/en/pricing — oficial — sem data; acessado 2026-10-17
- [S6-24] Coursera Blog — "Announcing Project Helix: A skills platform for the AI era" — https://blog.coursera.org/announcing-project-helix/ — oficial — 2026-09-09; acessado 2026-10-17
- [S6-25] Coursera Blog — "Announcing 30+ new programs across Coursera and Udemy…" — https://blog.coursera.org/announcing-30-new-programs-across-coursera-and-udemy-to-help-learners-build-ai-and-human-skills/ — oficial — 2026-10-06; acessado 2026-10-17
- [S6-26] Coursera Investor Relations — página inicial ("Coursera recently combined with Udemy…") — https://investor.coursera.com/ — oficial — sem data; acessado 2026-10-17
- [S6-27] Wikipedia — Udemy (fusão com a Coursera anunciada em dez/2025; AI Assistant "Introduced in late 2024") — https://en.wikipedia.org/wiki/Udemy — referência secundária — sem data; acessado 2026-10-17
- [S6-28] Wikipedia — Coursera (cita Reuters de 2025-12-17 sobre a aquisição da Udemy) — https://en.wikipedia.org/wiki/Coursera — referência secundária — sem data; acessado 2026-10-17
- [S6-29] Build Fast with AI — "Coursera Coach AI Review 2026" — https://buildfastwithai.com/ai-tools/coursera-coach — review — 2026 (sem data exata); acessado 2026-10-17
- [S6-30] Dunlosky, J. et al. "Improving Students' Learning With Effective Learning Techniques" (Psychological Science in the Public Interest, 14(1):4–58) — https://doi.org/10.1177/1529100612453266 — acadêmico — 2013 (resumo lido via Europe PMC); acessado 2026-10-17
- [S6-31] Roediger, H. L.; Karpicke, J. D. "Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention" (Psychological Science, 17(3):249–255) — https://doi.org/10.1111/j.1467-9280.2006.01693.x — acadêmico — 2006 (resumo via Crossref); acessado 2026-10-17
- [S6-32] Yang, C. et al. "Testing (quizzing) boosts classroom learning: A systematic and meta-analytic review" (Psychological Bulletin, 147(4):399–435) — https://doi.org/10.1037/bul0000309 — acadêmico — 2021 (resumo via Europe PMC); acessado 2026-10-17
- [S6-33] Cepeda, N. J. et al. "Distributed practice in verbal recall tasks: A review and quantitative synthesis" (Psychological Bulletin, 132(3):354–380) — https://doi.org/10.1037/0033-2909.132.3.354 — acadêmico — 2006 (resumo via Europe PMC); acessado 2026-10-17
- [S6-34] Brunmair, M.; Richter, T. "Similarity matters: A meta-analysis of interleaved learning and its moderators" (Psychological Bulletin, 145(11):1029–1052) — https://doi.org/10.1037/bul0000209 — acadêmico — 2019 (resumo via Europe PMC); acessado 2026-10-17
- [S6-35] Bisra, K. et al. "Inducing Self-Explanation: a Meta-Analysis" (Educational Psychology Review, 30(3)) — https://doi.org/10.1007/s10648-018-9434-x — acadêmico — 2018 (só metadados via Crossref; resumo não acessado); acessado 2026-10-17
- [S6-36] Morehead, K.; Dunlosky, J.; Rawson, K. A. "How Much Mightier Is the Pen than the Keyboard for Note-Taking? A Replication and Extension of Mueller and Oppenheimer (2014)" (Educational Psychology Review, 31(3):753–780) — https://doi.org/10.1007/s10648-019-09468-2 — acadêmico — 2019 (só metadados via Crossref); acessado 2026-10-17
- [S6-37] Forte, T. "Progressive Summarization: A Practical Technique for Designing Discoverable Notes" — https://fortelabs.com/blog/progressive-summarization-a-practical-technique-for-designing-discoverable-notes/ — review (autor de referência) — 2017-12-27, atualizado 2023-05-16; acessado 2026-10-17
- [S6-38] Zettelkasten.de — "Introduction to the Zettelkasten Method" — https://zettelkasten.de/introduction/ — review (referência do método) — sem data; acessado 2026-10-17
- [S6-39] Cornell University Learning Strategies Center — "The Cornell Note Taking System" — https://lsc.cornell.edu/how-to-study/taking-notes/cornell-note-taking-system/ — acadêmico (universidade) — sem data; acessado 2026-10-17
- [S6-40] Galoá — "O que é um fichamento?" (cita manual da UFSC) — https://galoa.com.br/gerenciamento-referencias/blog/o-que-um-fichamento — review — 2017-03-03, atualizado 2026-09-18; acessado 2026-10-17
- [S6-41] Wikipédia (pt) — Fichamento — https://pt.wikipedia.org/wiki/Fichamento — referência secundária — sem data; acessado 2026-10-17
- [S6-42] Citation Style Language — estilo "Associação Brasileira de Normas Técnicas (Português - Brasil)" — https://github.com/citation-style-language/styles/blob/master/associacao-brasileira-de-normas-tecnicas.csl — oficial (repositório CSL usado por Zotero/Mendeley) — atualizado 2023-08-20; acessado 2026-10-17
- [S6-43] Anki Manual — Deck Options (FSRS) — https://docs.ankiweb.net/deck-options.html — oficial — sem data; acessado 2026-10-17
- [S6-44] st3v3nmw/obsidian-spaced-repetition (GitHub) — https://github.com/st3v3nmw/obsidian-spaced-repetition — oficial — sem data de release visível; acessado 2026-10-17
- [S6-45] bjsi/incremental-writing (GitHub) — https://github.com/bjsi/incremental-writing — oficial — sem data visível; acessado 2026-10-17
- [S6-46] MarginNote — página inicial (MarginNote 4) — https://www.marginnote.com/ — oficial — sem data; acessado 2026-10-17
- [S6-47] Heptabase — página inicial — https://heptabase.com/ — oficial — sem data; acessado 2026-10-17
- [S6-48] Readwise Docs — FAQ "Reviewing highlights" (Daily Review, Mastery, Themed Reviews) — https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights — oficial — sem data; acessado 2026-10-17
- [S6-49] Goodnotes — Students — https://www.goodnotes.com/learning/students — oficial — sem data; acessado 2026-10-17
- [S6-50] RemNote — página inicial — https://www.remnote.com/ — oficial — sem data; acessado 2026-10-17
- [S6-51] Ahrens, S. *How to Take Smart Notes* — livro (referência bibliográfica; não acessado online) — acadêmico — 2017
- [S6-52] Forte, T. *Building a Second Brain* — livro (referência bibliográfica; não acessado online) — review (livro) — 2022
- [S6-53] Pauk, W. *How to Study in College* (cap. 10) — livro (citado via S6-39) — acadêmico — várias edições
- [S6-54] SuperMemo Help — "Incremental reading" — https://help.supermemo.org/wiki/Incremental_reading — oficial — sem data (HTTP 403 nesta sessão; definição não reverificada online); acessado 2026-10-17


### S7 — Lacunas de mercado e contexto de IA na aprendizagem

- [S7-1] Christian Tietze, "The Collector's Fallacy" (zettelkasten.de) — https://zettelkasten.de/posts/collectors-fallacy/ — review (blog/ensaio) — 2014-01-20; acessado 2026-10-17
- [S7-2] Andy Matuschak, "Collecting material feels more useful than it usually is" — https://notes.andymatuschak.org/Collecting_material_feels_more_useful_than_it_usually_is — review (notas públicas de pesquisador) — sem data; acessado 2026-10-17
- [S7-3] Dunlosky et al., "Improving Students' Learning With Effective Learning Techniques", Psychological Science in the Public Interest 14(1) — https://doi.org/10.1177/1529100612453266 — acadêmico — 2013 [não verificado nesta sessão: SAGE/APS/PubMed retornaram 403 ou página vazia]; acessado 2026-10-17
- [S7-4] Goodreads, enquete "EReader users: do you highlight?" — https://www.goodreads.com/poll/show/66601-ereader-users-do-you-highlight — Reddit/fórum (enquete não científica, 624.638 votos) — sem data; acessado 2026-10-17
- [S7-5] Fórum MarginNote, "Alternatives to MarginNote?" (página 3) — https://forum.marginnote.com/t/alternatives-to-marginnote/3479?page=3 — Reddit/fórum — posts de 2023-05-09 a 2024-03-28; acessado 2026-10-17
- [S7-6] Kosmyna et al., "Your Brain on ChatGPT: Accumulation of Cognitive Debt when Using an AI Assistant for Essay Writing Task" (arXiv 2506.08872) — https://arxiv.org/abs/2506.08872 — acadêmico (preprint) — v1 2025-06-10, v2 2025-12-31; acessado 2026-10-17
- [S7-7] Bastani et al., "Generative AI without guardrails can harm learning: Evidence from high school mathematics", PNAS 122(26) — https://doi.org/10.1073/pnas.2422633122 — acadêmico — epub 2025-06-25 (PMID 40560616; correção publicada 2025-08-26); acessado 2026-10-17
- [S7-8] Knowledge at Wharton, "Without Guardrails, Generative AI Can Harm Education" — https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education/ — notícia (universidade) — 2024-08-27; acessado 2026-10-17
- [S7-9] Lee et al. (Microsoft Research/CMU), "The Impact of Generative AI on Critical Thinking: Self-Reported Reductions in Cognitive Effort and Confidence Effects From a Survey of Knowledge Workers" (CHI 2025) — https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/ — acadêmico — 2025-04; acessado 2026-10-17
- [S7-10] Fan et al., "Beware of Metacognitive Laziness: Effects of Generative Artificial Intelligence on Learning Motivation, Processes, and Performance" (arXiv 2412.09315) — https://arxiv.org/abs/2412.09315 — acadêmico (preprint; versão em periódico não verificada) — 2024-12-12; acessado 2026-10-17
- [S7-11] Anthropic, "Anthropic Education Report: How University Students Use Claude" — https://www.anthropic.com/news/anthropic-education-report-how-university-students-use-claude — oficial (estudo da empresa) — 2025-04-08; acessado 2026-10-17
- [S7-12] Kestin et al., "AI tutoring outperforms in-class active learning: an RCT introducing a novel research-based design in an authentic educational setting", Scientific Reports 15:17458 — https://www.nature.com/articles/s41598-025-97652-6 — acadêmico — 2025-06-03; acessado 2026-10-17
- [S7-13] Gerlich, "AI Tools in Society: Impacts on Cognitive Offloading and the Future of Critical Thinking", Societies 15(1):6 — https://www.mdpi.com/2075-4698/15/1/6 — acadêmico — 2025 [não verificado: página retornou 403]; acessado 2026-10-17
- [S7-14] Readwise Docs, Ghostreader FAQ — https://docs.readwise.io/reader/docs/faqs/ghostreader — oficial — sem data; acessado 2026-10-17
- [S7-15] XDA Developers, "NotebookLM's new study features cost $0 and outperform apps people pay $15 a month for" — https://www.xda-developers.com/notebooklms-new-study-features-outperform-apps-people-pay-for/ — review — 2026-10-06; acessado 2026-10-17
- [S7-16] Procreate, "AI is not our future" — https://procreate.com/ai — oficial — sem data (rodapé © 2026); acessado 2026-10-17
- [S7-17] Readwise Docs, Kindle import (inclui "Why are my Kindle highlights truncated or showing ellipses?") — https://docs.readwise.io/readwise/docs/importing-highlights/kindle — oficial — sem data; acessado 2026-10-17
- [S7-18] Google Play Help, notas, destaques e marcadores do Play Livros salvos no Google Drive — https://support.google.com/googleplay/answer/3165868?hl=en — oficial — sem data; acessado 2026-10-17
- [S7-19] Shelley Powers (Burningbird), "Kindle clipping limits" — https://burningbird.net/kindle-clipping-limits/ — review (blog) — 2009-05-19; acessado 2026-10-17
- [S7-20] MobileRead Forums, "Highlights and Notes Revisited" — https://www.mobileread.com/forums/showthread.php?p=2032863 — Reddit/fórum — 2012-04-06/07; acessado 2026-10-17
- [S7-21] AlternativeTo News, "Amazon will remove the option to download/transfer Kindle e-books via USB by February 2025" — https://alternativeto.net/news/2025/2/amazon-will-remove-the-option-to-download-transfer-kindle-e-books-via-usb-by-february-2025 — notícia — 2025-02-17; acessado 2026-10-17
- [S7-22] Readwise Docs, Apple Books import — https://docs.readwise.io/readwise/docs/importing-highlights/apple-books — oficial — sem data; acessado 2026-10-17
- [S7-23] Zotero Documentation, PDF reader — https://www.zotero.org/support/pdf_reader — oficial — sem data; acessado 2026-10-17
- [S7-24] Highlights (site oficial) — https://highlightsapp.net/ — oficial — sem data; acessado 2026-10-17
- [S7-25] Media Extended (plugin do Obsidian), repositório GitHub — https://github.com/aidenlx/media-extended — oficial (repositório) — sem data de release visível; 956 estrelas; acessado 2026-10-17
- [S7-26] Goodnotes for Windows — https://www.goodnotes.com/windows — oficial — sem data; acessado 2026-10-17
- [S7-27] MarginNote (site oficial) — https://www.marginnote.com/ — oficial — sem data; acessado 2026-10-17
- [S7-28] AlternativeTo, "MarginNote Alternatives" — https://alternativeto.net/software/marginnote — review (agregador) — sem data; acessado 2026-10-17
- [S7-29] Notability (site oficial) — https://notability.com/ — oficial — sem data; acessado 2026-10-17
- [S7-30] LiquidText (site oficial) — https://www.liquidtext.net/ — oficial — sem data; acessado 2026-10-17
- [S7-31] Zhihu, resposta "MarginNote windows上面有没有功能一样的替代软件?" — https://www.zhihu.com/tardis/jm/ans/2014654523940038137 — Reddit/fórum — data desconhecida [conteúdo via resumo do buscador; página não aberta]; acessado 2026-10-17
- [S7-32] Zotero Documentation, Zotero for iOS — https://www.zotero.org/support/ios — oficial — página "last updated 2023-01-01"; acessado 2026-10-17
- [S7-33] calibre User Manual, E-book viewer — https://manual.calibre-ebook.com/viewer.html — oficial — sem data; acessado 2026-10-17
- [S7-34] AlternativeTo News, "After 17 years, Mozilla is shutting down the popular bookmarking tool Pocket, and Fakespot" — https://alternativeto.net/news/2025/5/after-17-years-mozilla-is-shutting-down-the-popular-bookmarking-tool-pocket-and-fakespot — notícia — 2025-05-22; acessado 2026-10-17
- [S7-35] wallabag, "Migrate from Omnivore to wallabag" — https://wallabag.org/news/20241031-migrate-from-omnivore/ — oficial (projeto terceiro) — 2024-11-01; acessado 2026-10-17
- [S7-36] Wikipedia, "Microsoft Edge Legacy" (suporte a EPUB adicionado em 2017 e removido em 2018–2019) — https://en.wikipedia.org/wiki/Microsoft_Edge_Legacy — review (enciclopédia) — sem data; acessado 2026-10-17
- [S7-37] Steph Ango, "File over app" — https://stephango.com/file-over-app — review (blog do CEO da Obsidian) — 2023-07-01; acessado 2026-10-17
- [S7-38] Kleppmann, Wiggins, van Hardenberg, McGranaghan (Ink & Switch), "Local-first software: You own your data, in spite of the cloud" — https://www.inkandswitch.com/essay/local-first/ — acadêmico (ensaio de pesquisa) — 2019-04; acessado 2026-10-17
- [S7-39] EDRLab, Thorium Reader — https://www.edrlab.org/software/thorium-reader/ — oficial — sem data (rodapé © 2026); acessado 2026-10-17
- [S7-40] OCRmyPDF Documentation — https://ocrmypdf.readthedocs.io/en/latest/ — oficial — sem data; acessado 2026-10-17
- [S7-41] Mathpix, Pricing — https://mathpix.com/pricing — oficial — sem data; acessado 2026-10-17
- [S7-42] Engadget, "Kindle's in-book AI assistant can answer all your questions without spoilers" — https://www.engadget.com/ai/kindles-in-book-ai-assistant-can-answer-all-your-questions-without-spoilers-190609961.html — notícia — 2025-12-14; acessado 2026-10-17
- [S7-43] Writer Beware, "Kindle's New Gen AI-Powered 'Ask This Book' Feature Raises Rights Concerns" — https://writerbeware.blog/2025/12/12/kindles-new-gen-ai-powered-ask-this-book-feature-raises-rights-concerns/ — review (blog de associação de escritores) — 2025-12-12 (atualizado em 2025-12-23 e 2025-12-30); acessado 2026-10-17
- [S7-44] Authors Guild, "Authors Guild Raises Concerns About Kindle's New 'Ask This Book' AI Feature" — https://authorsguild.org/news/statement-on-amazon-kindle-ask-this-book-ai-feature/ — oficial (associação) — 2025-12-23 (atualizado em 2026-01-07); acessado 2026-10-17
- [S7-45] Kindlepreneur, "What Amazon's 'Ask This Book' Feature Means for Authors" — https://kindlepreneur.com/amazon-ask-this-book/ — review — atualizado em 2026-02-21; acessado 2026-10-17
- [S7-46] Adobe Blog, esclarecimento sobre os Termos de Uso — https://blog.adobe.com/en/publish/2024/06/06/clarification-adobe-terms-of-use — oficial — 2024-06-06; acessado 2026-10-17
- [S7-47] TechCrunch, "OpenAI launches Study Mode in ChatGPT" — https://techcrunch.com/2025/07/29/openai-launches-study-mode-in-chatgpt — notícia — 2025-07-29; acessado 2026-10-17
- [S7-48] The Register, "OpenAI wants teachers and profs to foist their work off on ChatGPT" (plugins K-12 Educator, College Educator, College Student) — https://www.theregister.com/ai-and-ml/2026/08/04/openai-wants-teachers-and-profs-to-foist-their-work-off-on-chatgpt/5283064 — notícia — 2026-08-04; acessado 2026-10-17
- [S7-49] Northeastern Global News, "OpenAI introduces ChatGPT for Teens. What do teachers think?" — https://news.northeastern.edu/2026/08/21/chatgpt-for-teens-ai-classroom/ — notícia — 2026-08-21; acessado 2026-10-17
- [S7-50] OpenAI Help Center, ChatGPT release notes (entrada sobre quizzes interativos, 2026-08-14) — https://help.openai.com/en/articles/6825453-chatgpt-release-notes — oficial — [não verificado: 403 no acesso direto; data via resumo de busca]; acessado 2026-10-17
- [S7-51] OpenAI, "Helping teens learn, plan, and shape the future of AI" — https://openai.com/index/teens-learn-and-plan/ — oficial — 2026-10-07 [não verificado: 403 no acesso direto; conteúdo via resumo de busca]; acessado 2026-10-17
- [S7-52] Anthropic, "Introducing Claude for Education" — https://www.anthropic.com/news/introducing-claude-for-education — oficial — abr/2025 [conteúdo e data via cobertura de imprensa; página não lida na íntegra]; acessado 2026-10-17
- [S7-53] Engadget, "Anthropic brings Claude's learning mode to regular users and devs" — https://engadget.com/ai/anthropic-brings-claudes-learning-mode-to-regular-users-and-devs-170018471.html — notícia — 2025-08-14; acessado 2026-10-17
- [S7-54] Google Blog (Maureen Heymans), Guided Learning no Gemini — https://blog.google/outreach-initiatives/education/guided-learning/ — oficial — 2025-08-06; acessado 2026-10-17
- [S7-55] Google Blog, "6 ways to use NotebookLM to master any subject" — https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-student-features/ — oficial — 2025-09-08; acessado 2026-10-17
- [S7-56] 9to5Google, NotebookLM adiciona Flashcards e Quizzes — https://9to5google.com/2025/09/08/notebooklm-flashcards-quizzes/ — notícia — 2025-09-08; acessado 2026-10-17
- [S7-57] TechCrunch, "NotebookLM's new update will help you build source repository from chat" — https://techcrunch.com/2026/06/08/notebooklms-new-update-will-help-you-build-source-repository-from-chat/ — notícia — 2026-06-08; acessado 2026-10-17
- [S7-58] Google Blog (Josh Woodward), "NotebookLM is now Gemini Notebook" — https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/ — oficial — 2026-07-16; acessado 2026-10-17


