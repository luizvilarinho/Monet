# Backlog

Bugs e ideias registrados pelo Coordenador ou deixados para trás nas entregas, ainda sem task. Ao virar task, mova o item para o Task Report correspondente e apague daqui.

---

## Bugs

- **Esc no "New TODOS…" do popover do card (2026-10-21):** no popover de campos do card (nota TODOS), Esc dentro do input do rascunho fecha o popover inteiro em vez de só cancelar o rascunho. O listener de Esc do `CardFieldsPopover` (`TaskRefView.tsx`) é de captura e roda antes do `onKeyDown` do `TodosControl`.
- **Tempos ausentes em resposta de erro no Chat/Assistant (2026-10-21):** o `ChatMessageBubble` não renderiza o rodapé em mensagem de erro, então a linha de tempos "interrupted" (com "Retrieval details" ligado) só aparece no NotesChat e no Reader.
- **Arquivo novo de pasta monitorada interrompido no embedding (2026-11-16):** se o app fecha enquanto um arquivo novo de uma pasta monitorada é embedado, o `cleanup_stuck_indexing` grava `error` "Indexing interrupted (app closed)" na linha. A linha já tem o `last_modified_ms` do disco, então o scan não tenta de novo, e o arquivo fica em erro até mudar no disco. A KB não lista os arquivos da pasta, por isso não há "retry" para ele. Já existia na base; com a indexação em sequência, só um arquivo por vez fica exposto. Caminho: o cleanup zerar o `last_modified_ms` do arquivo de pasta interrompido sem chunks, para o próximo scan refazê-lo. Apontado no review (`DOCS/reports/16-11-2026/reviewreport_20261116141011.md`).
- **Célula de tabela só com chip some ao gravar (2026-11-18):** numa célula de tabela cujo único conteúdo é um chip de lembrete ou de task, o chip some ao gravar. O serializer de tabela (`TableWithWidths.ts`, cópia do tiptap-markdown) decide pela célula ter texto, e o chip não tem texto. Corrigir muda como se gravam células sem texto (uma célula só com quebra de linha passaria a gravar `<br>`). Apontado no review (`DOCS/reports/18-11-2026/reviewreport_20261118003058.md`).
- **Cerca de código colada no fim de uma linha com texto (2026-11-18):** colar uma cerca ` ```mermaid ` ou ` ```js ` inteira no fim de uma linha que já tem texto vira texto do parágrafo, não um bloco. Numa linha vazia vira bloco. Vem da colagem do tiptap-markdown. Achado na passada final da task do Mermaid (`DOCS/reports/17-11-2026/executionreport_20261117155733.md`).
- **Preview de nota linkada descarta HTML bruto (2026-11-17):** o `renderNoteContent` (`src/lib/markdown.ts`) descarta o HTML bruto da nota, então toggles e tabelas gravadas em HTML (mescladas, sem cabeçalho, em toggle) somem do preview. Achado no explorer report da tabela (`DOCS/reports/17-11-2026/explorerreport_20261117161124.md`).
- **Alinhamento de coluna de tabela se perde (2026-11-17):** o alinhamento vindo da IA (`:---`, `---:`) se perde ao gravar a nota. Achado no explorer report da tabela.
- **Download do bibliotecário lê o corpo inteiro antes do teto (2026-11-20):** o `librarian_fetch_and_save_pdf` lê a resposta inteira na memória antes de conferir o tamanho. Uma resposta sem `Content-Length` ou um arquivo gigante ocupa memória até o tempo limite. O `books_download_pdf` (Papers) foi corrigido para ler em pedaços; falta aplicar o mesmo aqui. Apontado no review (`DOCS/reports/20-11-2026/reviewreport_20261120163843_papers-ui.md`).
- **Enter repetido no Chat e na Assistant com agente de mensagem padrão (2026-11-20):** com o Radar, o Papers, o Coach ou o Plan week selecionado e o rascunho vazio, dois Enter muito próximos podem enviar a mensagem padrão duas vezes, porque o `useChat.send` só marca o turno em andamento depois de alguns `await`. No Radar e no Papers isso roda duas buscas. O chat das Anotações já tem uma trava própria. Caminho: uma trava no início do `send` do `useChat`. Apontado na passada final (`DOCS/reports/20-11-2026/executionreport_20261120115512.md`).
- **Pontas do "Open in Library" na nota Paper (2026-11-20):** trocar da nota A para a B e voltar à A durante o download permite um segundo download em paralelo; com o livro ligado apagado, o botão diz "Opening…" durante o download; e quando a main devolve uma nota Paper que já existia, o modal mostra "Paper added". Apontado na passada final (mesmo arquivo).
- **Marca de tracker em gravação pode sumir da tela (2026-11-20):** uma recarga vinda da outra janela (evento `trackers-changed`) pode tirar da tela, por alguns milissegundos, uma marca que ainda está gravando. A marca fica no banco e reaparece na recarga seguinte. A correção pede um mapa de marcas pendentes mesclado no `reload` do `useTrackers`, que hoje não tem teste. Apontado no review (`DOCS/reports/20-11-2026/reviewreport_20261120151608_trackers-log.md`).

---

## Ajustes

- **Avisos de licença de terceiros antes da Microsoft Store (2026-11-18):** o repositório não tem arquivo de third-party notices para nenhuma dependência. O `elkjs`, que veio com o Mermaid 12, é EPL-2.0 OR GPL-3.0; os demais são em geral MIT. Decidir e gerar os avisos antes de publicar. Apontado no review (`DOCS/reports/18-11-2026/reviewreport_20261118003058.md`).
- **Cursor de mão em nó de diagrama que tinha link (2026-11-18):** os links do diagrama Mermaid são removidos do SVG, mas o nó continua com cursor de mão. A classe do Mermaid que marca o nó também muda as cores do gantt, por isso não foi mexida.

- **Formatação do item ao renomear a task por fora (2026-10-21):** renomear a task no modal, na lista ou no quick add reescreve o item (origem e TODOS) como texto simples. Negrito/código do item somem e crases do título aparecem literais. O título da task guarda a sintaxe markdown do item (`extractTaskRefTitles` só tira escapes e entidades). Caminho: extrair o texto visível (renderizar o inline) e reescrever preservando as marcas quando possível.

- **`SELECT *` + `addMissingColumns` (2026-10-29):** na primeira abertura depois de uma coluna nova, o sqlx pode entrar em pânico (`index out of bounds`), porque uma conexão do pool prepara o `*` com o schema antigo. O `getNoteTypes` já foi corrigido com colunas explícitas (feat/board-view). Revisar as outras tabelas que usam o mesmo padrão em `src/storage/tauri.ts`.

- **Related content no modal da task e no "Edit note" do board (2026-11-02):** o botão "Related" da régua existe no modal da task (`TaskModalEditor.tsx`), mas o modal não mostra o painel do Related content; o mesmo vale para o "Edit note" do board. Sugestão S2 do uxAgent (`DOCS/reports/02-11-2026/uxreport_20261102035930.md`): montar o painel no modal e, no clique num card, fechar o modal e navegar como no Ctrl+P.

- **Glifos no lugar de ícones Phosphor (2026-11-02):** a busca na nota usa ↑ ↓ ×, o cabeçalho do Related content usa ›, e a régua usa ≡ ☐ ▶ 🖼 🔗. Trocar por ícones Phosphor (regra do projeto). Apontado pelo uxAgent (mesmo relatório).

- **Export .md com HTML das marcas (2026-11-02):** o export .md (`handleExport`, `App.tsx`) grava `<mark data-mark>` e `<span data-bg>` como HTML cru. O termo do Related content já sai limpo (`stripRelatedTermTags`). Caminho: desembrulhar os dois na mesma função. O text/plain do clipboard (`serializeBlocks` em `MonetClipboard.ts`, copiar para fora do Monet) vaza os mesmos dois do mesmo jeito; o termo já sai limpo ali também. Limpar o export e o clipboard juntos (o paste interno usa o HTML e não é afetado).

- **`/critique` marca "Inaccurate" sem contradição (2026-11-05, fase de qualidade dos prompts):** na nota do cap. 6 de *Fundamentals of Software Architecture* (caderno Arquitetura de Software), a crítica (Haiku 5.5) disse que a ressalva sobre IA generativa não era do autor. Ela era: o Coordenador lê a 2ª edição (2025). Duas causas:
  - o modelo supôs a edição de 2020;
  - o modelo tratou a ausência do trecho nos 5 excertos do RAG como prova de erro. A KB do caderno tem o PDF da 1ª edição (`OReilly.Fundamentals.of.Software.Architecture.2020.1.pdf`).

  Caminho: no `behavior` de `src/lib/agents/critique.ts`, só marcar "Inaccurate" quando os excertos ou um fato consolidado contradizem a nota de forma explícita. Não encontrar algo nos excertos não é erro, e o modelo não deve supor edição nem data da fonte. Quando faltar base, a crítica deve dizer "não encontrei nos trechos" em vez de corrigir. Incluir o caso no harness de prompts.

- **Papers e Radar não seguem a nota aberta no chat das Anotações (2026-11-20):** no teste do Coordenador, "Find essential papers" numa nota "Dom Quixote" do caderno "Livros" trouxe artigos de arquitetura de software. Causas conferidas no código: o escopo é o caderno da pasta e nunca a nota anexada (`buildPapersContext`, `src/lib/agents/papers.ts`); o mapa de foco inclui os livros em andamento da Library sem filtrar pelo escopo (`src/lib/focusMap.ts`, "Books in progress"); e sem assunto na mensagem o planejador escolhe o tema dominante do mapa. Nomear o assunto na mensagem ("artigos sobre Dom Quixote") resolveu no teste. O Coordenador pediu para não mudar ainda. Caminho, se ele decidir: com nota anexada e mensagem padrão, a nota vira o assunto (título e conteúdo lidos só para achar os termos, como no `/since`); livros em andamento só no escopo "tudo" ou os ligados a notas do escopo; e o assunto nomeado na mensagem valendo também na etapa de escolha, que hoje só o considera quando o caderno está vazio. **Evidência do reteste (2026-11-21):** numa consulta do Radar num caderno de RAG, uma das 6 buscas foi "Dante Divine Comedy analysis", vinda dos livros em andamento (`DOCS/reports/20-11-2026/testresults_20261121004220_reteste.md`, R1). O vazamento do "Follow" do perfil para o escopo estreito, que era o mesmo tipo de problema, já foi corrigido.

- **Número com separador de milhar no card e na lista (2026-11-21):** o card do board e a linha da lista de notas mostram a propriedade numérica com separador ("Year 2,025", "2,006"); o editor de propriedades mostra "2025". É a formatação antiga das propriedades numéricas, que o tipo Paper deixou à mostra. Decidir: sem separador sempre, ou só para inteiros de até 4 dígitos.

- **Cabeçalho do chat das Anotações no mínimo de 300 px (2026-11-21):** o seletor de modelo cobre o botão de tools e o contador. Visto no teste (`DOCS/reports/20-11-2026/testresults_20261120235817_radar-papers.md`).

- **Nota diária vazia não se apaga pela interface (2026-11-21):** abrir um dia no Calendar cria a nota diária, e uma nota diária vazia não aparece em nenhuma lista para ser apagada. O teste deixou uma em 22/11/2026; já havia outras (18/11, 19/11, 21/11, 23/11).

- **Fila de leitura entre janelas (2026-11-20):** quando a nota Paper é criada pela janela assistant, a main não relê a fila, e o botão do artigo continua "Add to reading list" num balão já aberto na main até a próxima leitura. Além disso, cada balão com artigos relê todas as notas a cada nota Paper criada. Caminho: um evento entre janelas para a fila e uma leitura única compartilhada pelos balões. Suspeitas S4 e S5 do review (`DOCS/reports/20-11-2026/reviewreport_20261120163843_papers-ui.md`).

- **`validName` em `useMetadataDefs` (2026-11-20):** o `useTrackers` e o `useNoteTypes` passaram a usar o `uniqueName` de `src/lib/tasks.ts`. O `useMetadataDefs.ts` ainda tem a cópia antiga da mesma lógica.

- **CSS repetido do `TrackersModal` (2026-11-20):** cerca de 80 linhas do `TrackersModal.module.css` repetem regras de layout do `NoteTypesModal`. Mover para um módulo comum pede conferir os dois modais na tela.

- **Testes de hook e de componente (2026-11-20):** o projeto só tem teste de lógica pura. Ficaram sem teste automático o `useTrackers` (gravação otimista e desfazer), a fiação de fim de turno do `useChat` (done, Stop, erro, corte), o `handleCommand` do `/since`, a `AgentItemsList`, o `PaperLibraryBar` e o `SaveAgentNoteModal`. Os `codeAgent` usaram testes de fumaça temporários com happy-dom, apagados depois. Decidir se vale adotar `@testing-library`.

---

## Ideias

- **Mincer no MSIX (2026-10-31):** quando o `build-msix.ps1` for recuperado, copiar `ffmpeg.exe` e `yt-dlp.exe` de `target/release` para o staging; declarar `<DeviceCapability Name="microphone"/>` no AppxManifest; risco de certificação do modo YouTube na Store (flag de build para escondê-lo no MSIX).
- **Mincer — licença e tamanho (2026-10-31):** aviso de licença GPLv3 do ffmpeg (origem: gyan.dev essentials 8.1.1) no About, ou troca por build LGPL só de áudio; o instalador cresce ~35–50 MB.
- **Mincer — clique no toast (2026-10-31):** o `tauri-plugin-notification` 2.3.3 não tem callback de clique no Windows desktop, então o toast de fim de item só avisa. Ideia: toast via WinRT (`windows` crate, `ToastNotification` com `Activated`) para mostrar a janela e abrir o Mincer no item.
- **Mincer — fase 2 (2026-10-31):** RAG das transcrições longas (pasta gerenciada da KB na pasta Mincer do Chat), card no Calendar, legendas do YouTube antes do áudio, ffmpeg mínimo, "Update yt-dlp" (cópia em appData), flag de build para o YouTube. Ver `DOCS/specs/mincer.md` §10.
  - O RAG por trechos é o passo seguinte ao aviso de transcrição cortada no Chat (uxreport 31-10-2026, P2/E): o contexto efêmero passaria a escolher os trechos relevantes à pergunta em vez dos primeiros 60k caracteres.
- **Mincer — busca na transcrição (2026-10-31, uxreport P13):** a transcrição é um bloco único (pedaços de 20 min unidos por linha em branco), sem busca nem tempos. Ideia: busca dentro do texto e, se o provedor devolver segmentos, parágrafos com tempo.
- **Mincer — conversas no Assistant (2026-10-31, uxreport P14):** a janela Assistant (Ctrl+M) mostra as pastas do Mincer sem o contexto efêmero, embora o system prompt da pasta diga que ele vem em cada mensagem. Ideia: aviso no Assistant para pastas do Mincer, ou ocultá-las ali.
- **Mincer — sidecars das fontes oficiais (2026-10-31):** hoje o ffmpeg (gyan.dev essentials 8.1.1) e o yt-dlp vivem só em `src-tauri/binaries/` (fora do git) e o `scripts/fetch-sidecars.ps1` apenas confere o SHA-256 ou copia de uma pasta informada. Pedido do Coordenador: baixar das fontes oficiais (gyan.dev e GitHub do yt-dlp) com versão e SHA-256 fixados, na primeira instalação, em vez de depender de uma cópia local. Isso tira o risco de perder os binários (clone novo, `git clean -x`, outra máquina), reduz o instalador (~115 MB a menos) e abre caminho para atualizar o yt-dlp, que envelhece rápido com as mudanças do YouTube. Decidir: baixar no build (script) ou no app no primeiro uso do Mincer (pasta em appData, com progresso e verificação de hash; o resolvedor de `sidecar.rs` passa a olhar também lá). Para o MSIX, avaliar o que a Store aceita.
- **Mincer — gravação pelo uso do microfone (2026-10-31):** parar (e sugerir iniciar) a gravação quando o app da reunião (Teams, Zoom, navegador) solta/pega o microfone, lendo `LastUsedTimeStart/Stop` em `HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone`. Mais preciso que o silêncio, mas depende de detalhe interno do Windows e o navegador segura o microfone com a aba aberta. Hoje a parada é por silêncio + teto + tray/Ctrl+Alt+R.
- **Mincer — guardar o áudio da gravação (2026-10-31):** hoje o áudio é apagado depois da transcrição. Ideia: opção "Keep recording audio" que salva o MP3 junto do item (e no Save .md).
- **Mincer — duração e custo antes de iniciar (2026-10-31, uxreport G):** nada informa a duração do arquivo/vídeo nem o custo estimado da transcrição antes do Start; um vídeo longo do YouTube pode gerar conta inesperada. Ideia: ler a duração (ffprobe/yt-dlp) e estimar pelo preço por minuto do modelo, se o OpenRouter expuser.
- **Notas de contexto para a IA (2026-11-05):** o Coordenador gostou do padrão "nota que o agente lê", como o "Perfil de estudo" que o tutor exige. O padrão já existe de três formas:
  - o perfil de estudo (tag `study profile` ou título, `src/lib/studyProfile.ts`), lido só pelo tutor;
  - as notas de plano (Plan/Capacidade/Livro), lidas pelo planner e pelo coach;
  - notas como "Dados do livro", que só chegam pelo RAG;
  - o perfil do Radar (tag `radar profile`, 2026-11-20), lido pelo Radar e, só na linha Ignore, pelo Papers.

  **2026-11-20:** depois de usar o perfil do Radar no teste, o Coordenador disse que gostou de ter notas que servem de configuração e que a ideia pode ser mais útil no futuro. Continua sem decisão sobre a convenção única.

  A ideia é uma convenção única de contexto por caderno, lida por todos os agentes. Os dados pessoais ficam em notas e os prompts continuam genéricos.

  **Antes de decidir:** o Coordenador vai avaliar se o system prompt da pasta do chat (`FolderSystemPromptModal`) basta ou se faltam campos. Com agente, esse prompt já entra como "Folder instructions" em append (D9, `useChat.ts`). Diferenças em relação a uma nota:
  - ele vive no localStorage do chat, que é efêmero de propósito;
  - os slash da nota (`/critique`, `/define`…) não o enxergam.

  **Riscos:** nota desatualizada orientando a IA sem ninguém perceber; contexto inflado em toda chamada.

  **Primeiro passo concreto, independente da decisão:** o `/critique` também ler o perfil de estudo do caderno. Com "lendo a 2ª edição (2025)" no perfil, o falso positivo de edição registrado em Ajustes teria sido evitado.
- **Tipos de nota/TODOS — fase 5 (2026-10-20):** remover `task_group` 4 semanas após o release da 1.5.0.
- **Busca FTS5 — plano B (2026-10-20):** só se a busca do Ctrl+P voltar a ficar lenta (ver `DOCS/features/note_types_study.md`).
- **`get_note` — próximos passos (2026-10-21):** opcional detectar localmente um título citado na pergunta para pular o RAG; depois, avaliar o Jev (TypeSafe, via OpenRouter) como porteiro antes do RAG.
- **Tags — depois do uso real (2026-10-24):** renomear/mesclar tags globalmente; combinar tags (A e B) na lista; chat com escopo nas notas de uma tag. Ver `DOCS/specs/tags.md` §6.
- **Marcas — depois do uso real (2026-10-24):** teclado na lista Marks (↑↓, Enter, "resolver e ir para a próxima"); converter marca em task (sempre explícito, preservando a origem); marcas em grifos da Library; renomear/mesclar rótulos. Ver `DOCS/specs/notemark.md` §9.
- **Rescan all — arquivos da pasta no banner (2026-11-16):** o progresso do Rescan all é por pasta. Numa pasta com centenas de arquivos novos (`git checkout`, cópia de pasta), o banner fica parado nela até a fila acabar e parece travado. Ideia: mandar no evento `documents://rescan-progress` a contagem de arquivos da pasta atual e mostrar "Livros · 37/300 files". Sugestão S7 do uxAgent (`DOCS/reports/16-11-2026/uxreport_20261116133039.md`).
- **KB — "Recent changes" (2026-11-16):** seção recolhível (ou filtro "Changed today") na Knowledge Base com os arquivos das pastas monitoradas reindexados nas últimas 24 h, com a hora. Mostra o que o rescan automático pegou e responde "por que a IA citou isto?". Sai do `updated_at` das linhas que já existem, sem schema novo. Sugestão S15 do uxAgent (`DOCS/reports/16-11-2026/uxreport_20261116133039.md`).
- **Opened today na nota do dia (2026-11-16):** botão "Add today's trail to the daily note" no Opened today, que grava na nota do dia a lista de notas e tasks abertas, com links. Por clique explícito, o rastro do dia (hoje no localStorage, zerado à meia-noite) vira registro perene e alimenta `/today` e `/week-review`. Sugestão S16 do uxAgent (`DOCS/reports/16-11-2026/uxreport_20261116133039.md`).
- **Trackers e Log — depois do uso real (2026-11-20):** itens adiados na triagem de UX (`DOCS/reports/20-11-2026/uxtriage_20261120133108.md`, fatia 1):
  - ícone do tipo no trilho recolhido, para distinguir dois ou mais Logs;
  - filtrar a lista do Log ao clicar num grupo, e "Show all N" nos grupos;
  - comando no Ctrl+P para marcar um tracker hoje;
  - tool do Chat com as somas do Log ("quantos minutos pratiquei em outubro?").
- **Radar e Papers — depois do uso real (2026-11-20):** itens adiados na triagem de UX (mesmo arquivo, fatia 2) e limites conhecidos (`DOCS/specs/radar.md`):
  - separar "ler as páginas salvas" de "salvar automaticamente" no toggle "Save web sources";
  - lista de itens recolhível nas colunas estreitas;
  - "Queued in Mincer" clicável, abrindo o Mincer no item;
  - caderno com nome de 2 caracteres como escopo (a regra é compartilhada com o Tutor);
  - "Add to note" por item, anexando a novidade à nota que ela toca;
  - títulos de nota citados na resposta virando link;
  - o Radar não repetir URLs já mostradas no mesmo escopo;
  - "Show the rest", com os candidatos que o modelo não escolheu;
  - trocar o "Reading" do Tutor, que vem da memória do modelo, pela busca real do Papers;
  - cobertura de artigos de conferência, que é baixa no OpenAlex: avaliar uma segunda fonte se o `/papers` sair fraco em computação;
  - cancelar de verdade a chamada do planejador de consultas no Stop (hoje o resultado é descartado).
