# UX Report — Fatia 8: Mincer, conhecimento e configurações

- Data: 2026-11-19, branch `fix/divida-tecnica` (Fase A aplicada).
- Origem: plano `DOCS/reports/19-11-2026/uxplan_20261119214504.md`, fatia 8.
- Escopo: `src/components/Mincer/`, `src/components/KnowledgeBaseModal/`, `src/components/DocumentsModal/`, `src/components/Settings/`. Para confirmar comportamento, li também trechos de `src/lib/mincer.ts`, `src/hooks/useMincerJob.ts`, `src-tauri/src/mincer/{record,jobs,db}.rs`, `src-tauri/src/documents.rs`, `ConfirmModal`, `useConfirm`, `Toolbar.tsx` e `SaveToNoteModal.tsx`.
- Método: leitura do código, da spec `DOCS/specs/mincer.md` (com o teto de 6 h e a recuperação de gravação órfã), do PRD, da visão de produto, do backlog e dos relatórios de UX anteriores (`31-10-2026/uxreport_20261031020217.md` e `16-11-2026/uxreport_20261116133039.md`). O app não foi executado. O único print em `DOCS/prints/` mostra o modal de tipos de nota e não serve a esta fatia.
- Custo: P (horas, só front ou um ajuste local), M (1 a 2 dias, ou front + Rust), G (vários dias ou mudança de modelo de dados).

---

## 1. Resumo executivo

**Sim para o Mincer, com ressalvas. Parcial para a KB e o Settings.** O Mincer amadureceu muito desde o relatório de 31/10: há marca de novo, indicador de gravação, Discard, medidores, erros legíveis, origem na nota, rascunho preservado, vários arquivos e drop. Os problemas que restam estão na confiabilidade da gravação (o usuário não vê *quais* dispositivos estão sendo gravados), na identificação dos itens (gravação sem nome, histórico só com a data) e em trabalhar sobre o original (sem copiar nem levar um trecho à nota). Na KB, o problema central é que um documento adicionado não é usado por caderno nenhum até ser ligado em outro modal, e nada diz isso. Há ainda um risco transversal: o Escape fecha o modal pai e deixa a confirmação de remoção pendente, e ela volta com o botão destrutivo em foco quando o modal reabre. O Settings funciona, mas tem textos desatualizados e não verifica a chave, justo a que o Mincer consome em horas de áudio.

## 2. Contexto do app

- **Proposta de valor:** companheiro de aprofundamento num tema. O trabalho do usuário (notas, leituras, cadernos) fica no centro, e a IA é meio, ancorada no material dele (KB com RAG, pastas monitoradas, livro aberto).
- **Usuário-alvo:** autodidata em estudo de longo prazo (fichamento de livro, acompanhamento de curso). No uso real, o criador também usa o Monet para reuniões e entregas (inferido pelos presets Meeting, pelas Tasks e pelos estudos de 17/10).
- **Onde a fatia se encaixa:**
  - **Mincer** é a porta de entrada dos grandes volumes (aula gravada, reunião, vídeo, artigo). Só alimenta caderno e Chat por clique. É a exceção de volume das não-metas.
  - **Knowledge Base** e **Notebook Documents** definem *qual material do usuário* a IA enxerga, o que corresponde ao critério 2 da visão ("mantém o material do usuário no centro?").
  - **Settings** guarda as chaves e os modelos de que tudo isso depende.

## 3. O que a fatia entrega (do ponto de vista do usuário)

- **Mincer:** tela New com abas File, Paste, Record, YouTube e Web page (Summarize ou Capture text), presets e instruções salvas. A fila roda em background, com progresso, Cancel, Resume e Regenerate. O histórico marca New, Error, Queued, Interrupted e Sent to notebook. Na gravação: medidores por faixa, parada por silêncio, teto de 1 a 6 h, botão +30 min, Ctrl+Alt+R e o tray, e uma gravação órfã volta como "Recovered recording". As saídas são Send to notebook (com linha de origem), Send to Chat e Save .md.
- **Knowledge Base (global):** documentos soltos e pastas monitoradas, com alias, rescan por pasta, Rescan all, "Last checked", banner de índice desatualizado, pastas web órfãs e filtro.
- **Notebook Documents (por caderno):** liga e desliga cada documento ou pasta da KB para o caderno, e liga a indexação das notas do caderno.
- **Settings:** chaves OpenRouter e Tavily, modelo de reescrita do RAG, Agenda (capacidade), Mincer (modelos, silêncio, teto) e About & Updates.

## 4. Análise de usabilidade

### O que funciona bem

- **Mincer não bloqueia nada:** enfileira, avisa que "this one will wait in the queue" (`MincerNew.tsx:557-559`) e segue. É coerente com a promessa da spec §3.
- **Bloqueios acionáveis:** sem chave ou sem modelo, a tela diz o que falta e abre o Settings na seção certa (`MincerNew.tsx:472-489`).
- **Gravação mais segura que em 31/10:** medidores por faixa, linha de ajuda com as regras de parada ("Stops by itself after 10 min of silence or at 3 h. Ctrl+Alt+R or the tray icon also stop it.", `MincerNew.tsx:80-87`), Discard com confirmação e +30 min.
- **Erros legíveis com detalhe recolhido** (`MincerItemView.tsx:356-373`), e o banner neutro para Cancelled.
- **Regenerate honesto:** mostra "Current summary: Meeting + instructions" e só troca o resumo quando o novo fica pronto (`MincerItemView.tsx:448-459`).
- **KB:** o automático se mostra ("Checking folders for changes", "Last checked"), o resumo do Rescan all diz o que mudou, e há o aviso de pasta em erro no ícone. Os pedidos S2, S3 e S5 de 16/11 foram atendidos.
- **Notebook Documents:** a pasta de notas do próprio caderno aparece como "(always on)", o que evita a dúvida sobre se as notas entram.
- **Settings › Agenda:** grava sozinho e mostra "Saved…" ou o padrão em uso, com validação clara.

### Problemas encontrados

Severidade: Crítica / Alta / Média / Baixa. Custo: P / M / G.

#### Transversal (KB, Documents, Settings, ConfirmModal)

| # | Problema (usuário) | Evidência | Sev. | Proposta | Custo |
|---|---|---|---|---|---|
| T1 | **Escape numa confirmação fecha o modal pai e deixa a pergunta pendente.** Ao reabrir a KB, a confirmação "Remove folder…?" reaparece com o botão "delete" em foco: um Enter remove a pasta (numa pasta web, apaga os arquivos do disco). No Documents, a confirmação velha de "Turn off note indexing" pode reaparecer sobre outro caderno e agir sobre o caderno anterior (a closure guarda as props antigas, inferido). | `ConfirmModal.tsx` não trata Escape e tem `autoFocus` no confirmar (padrões `confirmLabel='delete'`, `destructive=true`); `KnowledgeBaseModal.tsx:194-201` (Escape global → `onClose`), `:232` (`return null` com o `useConfirm` vivo), `:367`; `DocumentsModal.tsx:93-100`, `:115-118`; `App.tsx:4446` e `:4461` (os dois modais ficam sempre montados) | Alta | O `ConfirmModal` trata o Escape (resolve como cancel e chama `stopPropagation`). Os modais pais ignoram o Escape enquanto há confirmação aberta. Ao fechar o pai, a promessa pendente resolve como cancel. | P |
| T2 | **Glifo e emoji contra a regra do projeto:** fechar com "×" e tipo de documento com 📁 e 📄. | `KnowledgeBaseModal.tsx:436`, `DocumentsModal.tsx:175`, `SettingsModal.tsx:365` ("×"); `DocumentsModal.tsx:57` (📁), `:263` (📄) | Baixa | Phosphor `X`, `Folder` e `FileText` (o `FileText` já é o ícone de documentos no `NotebookList`). | P |
| T3 | **Rótulos em caixa e verbos inconsistentes.** A KB usa "+ add document", "+ add folder", "rescan", "remove", "retry" e "uploading…"; o Settings, "save key", "remove key" e "saving..."; o Documents, "manage Knowledge Base"; o confirm, "delete" e "cancel". O Mincer, ao lado, usa caixa de frase ("Send to notebook", "Save .md"). O "+" é um glifo dentro do texto. | Linhas citadas; `ConfirmModal.tsx` (padrões) | Baixa | Caixa de frase em todos ("Add document", "Rescan", "Save key"), ícone `Plus` no lugar do "+" e verbo do confirm igual ao da ação (ver K2). | P |

#### Mincer

| # | Problema (usuário) | Evidência | Sev. | Proposta | Custo |
|---|---|---|---|---|---|
| M1 | **A gravação não diz quais dispositivos grava.** O Monet grava o dispositivo de saída padrão e o microfone padrão, e a tela só diz "Records system audio and your microphone." Se o app da reunião toca num headset que não é a saída padrão (por exemplo, o "dispositivo de comunicação padrão" do Windows), o loopback grava silêncio. O medidor revela isso só se o usuário olhar, e uma reunião não se repete. (A frequência é inferida.) | `MincerNew.tsx:401`, `:410`; `record.rs:210-211` (`get_default_device`), `:381`; medidores em `MincerNew.tsx:403-406` | Alta | (1) Mostrar o nome dos dispositivos antes e durante a gravação: "System: Speakers (Realtek) · Mic: Headset (Jabra)". (2) Aviso em linha quando o System fica em zero por 60 s enquanto o Mic tem sinal: "No system audio detected. Is the meeting playing on another device?". | M |
| M2 | **Não há como trabalhar sobre o original dentro do Mincer.** Resumo e transcrição não têm "Copy", e um trecho selecionado não vai para uma nota nem para o Chat. O único caminho é mandar o resumo inteiro (e opcionalmente a transcrição inteira) para uma nota e garimpar lá. Isso contraria o que o PRD promete: transcrição de primeira classe para o usuário elaborar. | `MincerItemView.tsx:487-506` (só renderiza), ações em `:375-425`; PRD §9 (exceção de volume) | Média-Alta | Agora: botão "Copy" na aba ativa (P). Depois: popover na seleção da transcrição e do resumo com "Add to note" e "Ask in Chat", no padrão do grifo do Reader que vira citação (M). | P / M |
| M3 | **"Sent to notebook" não leva à nota.** O item guarda só a data do envio. O "Go to note" existe apenas na tela de sucesso do modal: depois de fechar, achar a nota exige busca, e reenviar duplica. | `MincerItemView.tsx:392-397`, `:518-526`; `SaveToNoteModal.tsx:507-511`; spec §4 (`sent_to_notebook_at`) | Média | Gravar `notebookId`/`noteId` do envio e tornar o selo um link "Open note" (se a nota foi apagada, voltar a "Send to notebook"). | M |
| M4 | **Gravações sem identidade.** O título é "Recording AAAA-MM-DD HH:MM" com a hora do *Stop*, não do início. Não há campo de título antes nem durante a gravação. O histórico mostra só a data. Com duas ou três reuniões ou aulas no dia, é preciso abrir uma por uma. | `record.rs:541` (`Local::now()` no finalize); `MincerHistory.tsx:84` (`toLocaleDateString`); `MincerNew.tsx:393-411` | Média | Campo "Title (optional)" na aba Record, editável durante a gravação e enviado no Stop. Sem ele, usar a hora de início. No histórico, mostrar a hora nos itens de hoje e agrupar em Today, Yesterday e Earlier. | P-M |
| M5 | **Item interrompido ou recuperado não pede atenção.** Um item interrompido por crash não marca `unseen`, então não acende o ponto na Toolbar. A gravação recuperada marca `unseen`, mas a Toolbar diz "Mincer has new results", e no histórico ela aparece como "Interrupted" em cinza. A recuperação no boot não emite evento, então o ponto pode só aparecer no próximo evento (inferido). O banner vermelho também não diz a duração do áudio nem quando ele foi gravado. | `db.rs:331-337` (sem `unseen`); `Toolbar.tsx:62-63`; `MincerHistory.tsx:50-51`; `jobs.rs:384`, `:443-445`; `MincerItemView.tsx:358` | Média | Estado "Needs attention": selo âmbar "Resume?" no histórico, título da Toolbar "Mincer: 1 item needs your attention", banner âmbar com a duração e o horário, e Resume + Discard. Emitir uma revisão ao fim do `on_startup`. Isso mantém a decisão de não mostrar toast no boot. | P |
| M6 | **"+30 min" aparece no teto de 6 h e só dá erro** ("Recordings are limited to 6 hours."). A linha de ajuda também não diz quanto falta. | `MincerNew.tsx:507-518` (condição `maxMinutes > 0`); `record.rs:53-56` | Baixa-Média | Desabilitar com `maxMinutes >= 360` e o title "Maximum length (6 h) reached". Na ajuda: "stops at 17:40 (in 25 min)". | P |
| M7 | **O preset fica travado durante a gravação.** As opções vão para o `options.json` no Start. Quem começou às pressas com o preset errado só corrige depois, com um Regenerate (mais espera e mais custo). | `MincerNew.tsx:462` (`disabled` gravando); `record.rs:364-366` | Baixa-Média | Manter preset e instruções editáveis até o Stop e enviá-los no `mincer_record_stop` (que reescreve o `options.json`). | M |
| M8 | **A memória do preset é global.** Quem alterna reunião (Record), aula do YouTube e artigo herda o último preset, e o erro custa um Regenerate. | `presets.ts:131`, `:168-179` | Baixa-Média | Lembrar o último preset por aba (Record, YouTube, Web, File, Paste). | P |
| M9 | **Soltar arquivos só funciona na tela New.** Com um item aberto, o drop não faz nada e não avisa. | `MincerNew.tsx:157-176` (listener só no New) | Baixa | Listener no `Mincer.tsx` que abre o New com os arquivos selecionados. | P |
| M10 | **A gravação em curso não aparece no histórico.** Quem está lendo outro item só vê o ponto na Toolbar. | `MincerHistory.tsx:57-94` | Baixa | Linha fixa no topo, "Recording · 12:34", que abre o New na aba Record. | P |
| M11 | **A linha de modelos mostra "Transcription: not set" em Paste e Web**, onde a transcrição não entra, e preocupa sem motivo. | `MincerNew.tsx:465-470` | Baixa | Mostrar só os modelos que a aba atual usa. | P |
| M12 | **"Change folder" salva de novo em outra pasta** (cria mais um par de .md), e o rótulo sugere só trocar a pasta. | `MincerItemView.tsx:442-444` (`handleSave(true)`) | Baixa | Renomear para "Save to another folder…". | P |
| M13 | **Item na fila sem posição:** "Queued — starts when the items ahead of it finish." não diz quantos estão na frente. | `MincerItemView.tsx:326` | Baixa | "2nd in queue", calculado pela lista. | P |
| M14 | **O histórico não escala:** não tem busca, filtro por tipo nem exclusão em lote. Cresce a cada reunião. | `MincerHistory.tsx:66-93` | Baixa (cresce com o uso) | Busca por título e fonte, filtro por kind e "Delete" múltiplo. | M |

#### Knowledge Base

| # | Problema (usuário) | Evidência | Sev. | Proposta | Custo |
|---|---|---|---|---|---|
| K1 | **Documento adicionado não é usado por ninguém, e a KB não diz isso.** A visibilidade é opt-in por caderno (só valem as linhas explícitas de `notebook_document_visibility`). A KB diz "Add documents to use them as AI context…", mas não diz *onde* ligar, e depois de adicionar não aparece nenhuma pista. O usuário pergunta à IA do caderno e ela não acha o PDF. O ajuste fica num ícone de 13 px que só aparece no hover da linha do caderno. | `documents.rs:1838-1843`; `KnowledgeBaseModal.tsx:529-531`, `:554-689` (sem coluna de uso); `NotebookList.tsx:188-196` | Alta | Coluna "Used in" ("2 notebooks · 1 chat folder") com popover de caixas por caderno. Depois do upload, um aviso em linha: "Added. Use it in: [caderno ativo] ✓", com o caderno ativo pré-marcado. | M |
| K2 | **"Remove folder" confirma com "delete"** e não diz que os arquivos do disco ficam. Numa pasta da IA, os arquivos são apagados do disco: duas consequências diferentes com o mesmo botão. O mesmo "delete" aparece em "Turn off note indexing" no Documents. | `KnowledgeBaseModal.tsx:254-258`, `:361-368`; `DocumentsModal.tsx:115-118`; padrão do `ConfirmModal` | Média | Pasta monitorada: "Remove from Knowledge Base" + "Your files on disk are not changed.". Pasta da IA: "Delete folder and files". Documento: "Remove document". Indexação de notas: "Turn off". | P |
| K3 | **Adicionar sem a chave da OpenRouter "funciona" e falha depois:** a linha fica vermelha, e a causa ("OpenRouter key not configured") aparece só no tooltip ou na mensagem pequena. | `documents.rs:1076-1082`; `KnowledgeBaseModal.tsx:234-252`, `:44-58`; o modal recebe `hasApiKey`, mas só o usa no rodapé (`:704-706`) | Média | Com `!hasApiKey`, banner no topo: "Add your OpenRouter key to index documents" + "Open Settings" (nova prop `onOpenSettings`, como no Mincer). Avisar antes de abrir o seletor. | P-M |
| K4 | **Pasta monitorada é uma caixa-preta:** a tabela só mostra a contagem. Não lista os arquivos, o status de cada um, o erro nem um retry por arquivo. O backlog já registra um arquivo interrompido que fica em erro sem retry porque "a KB não lista os arquivos da pasta". | `KnowledgeBaseModal.tsx:628`; `DOCS/backlog.md:11` | Média | Linha de pasta expansível com os arquivos (nome, status, quando foi indexado, erro, retry). Responde a "por que a IA não achou X?". | M |
| K5 | **Editar o alias e clicar fora descarta o texto.** No Mincer, renomear e clicar fora salva. | `KnowledgeBaseModal.tsx:584` (`onBlur` → cancela); `MincerItemView.tsx:288` (`onBlur` → salva) | Baixa | Salvar no blur; o Escape cancela. | P |
| K6 | **"Last checked 14:32" sem data.** O Monet fica dias na bandeja, então a hora pode ser de anteontem. | `KnowledgeBaseModal.tsx:98-100`, `:707` | Baixa | Tempo relativo: "5 min ago", "yesterday 14:32". | P |
| K7 | **Um arquivo por vez, sem drop e sem os tipos aceitos.** O seletor é de arquivo único; aceita PDF, TXT e MD, mas a tela não diz isso. | `documents.rs:21-27` (`pick_file`); `KnowledgeBaseModal.tsx:527-549` | Baixa-Média | Seleção múltipla, drop no modal e a dica "PDF, TXT or Markdown". | P-M |

#### Notebook Documents

| # | Problema (usuário) | Evidência | Sev. | Proposta | Custo |
|---|---|---|---|---|---|
| D1 | **A coluna "Visible" é ambígua.** Visível para quem? O rodapé só explica a regra do status. | `DocumentsModal.tsx:227`, `:286-288` | Baixa-Média | Cabeçalho "Use in AI" e a linha "Checked items are searched by this notebook's chat and /commands.". | P |
| D2 | **Pastas de notas de outros cadernos e pastas web da IA aparecem como "Folder" comuns**, sem os selos que a KB mostra ("Notes", "AI-generated", "Orphan"). | `DocumentsModal.tsx:50-77`, `:240-254`; `KnowledgeBaseModal.tsx:604-613` | Baixa-Média | Reusar os selos e agrupar em "Your files and folders", "Notes from other notebooks" e "Web sources". | P |
| D3 | **Falha ao ligar ou desligar só vai para o console**: a caixa não muda, ou volta, sem explicação. | `DocumentsModal.tsx:125`, `:140`, `:148` | Baixa | Mensagem de erro em linha. | P |
| D4 | **Sem filtro** (a KB tem um): com muitos documentos, o usuário rola uma tabela de caixas. | `DocumentsModal.tsx:221-281` | Baixa | Reusar o `documentMatchesFilter` e o campo da KB. | P |

#### Settings

| # | Problema (usuário) | Evidência | Sev. | Proposta | Custo |
|---|---|---|---|---|---|
| S1 | **Não dá para saber se a chave funciona nem quanto crédito resta.** A validação é só o prefixo. O Mincer gasta crédito em horas de áudio, e o 402 só aparece no meio do job. | `SettingsModal.tsx:197-225`; spec §3 ("Erros da API legíveis") | Média | Ao salvar e ao abrir a seção, consultar a chave na OpenRouter (endpoint de info da chave: uso e limite) e mostrar "Key works · $X.XX left", ou a frase de erro legível. Mostrar os 4 últimos caracteres da chave configurada. | M |
| S2 | **"remove key" sem confirmação**, e a OpenRouter mostra a chave uma vez só. O Enter não salva a chave da OpenRouter, mas salva a do Tavily. | `SettingsModal.tsx:420-429`; `:397-410` (sem `onKeyDown`) × `:489` | Baixa-Média | Confirmar: "Remove the key? AI features stop until you add one again." + Enter salva. | P |
| S3 | **Textos desatualizados ou técnicos.** "Without the key, the AI panel cannot start requests." (na verdade param o Chat, os /comandos, a indexação da KB e o Mincer); "never exposed to the frontend" (jargão); o Tavily diz que serve só ao /search e ao /profile, mas o Web search e o Deep research do Chat exigem a chave; "tavily.com" não é link. | `SettingsModal.tsx:391-392`, `:445`, `:470-471`, `:517-519`; `useChat.ts:3337-3340`, `:3377-3380` | Baixa-Média | Reescrever dizendo o que cada chave liga ("Used by Chat, /commands, Knowledge Base indexing and Mincer"; "Used by Web search, Deep research, /search, /profile and /expand"); link com `openUrl`. | P |
| S4 | **O modelo de resumo é texto livre, sem validação.** Um erro de digitação só aparece quando o item falha no resumo, depois da transcrição. O placeholder "same as Chat model" não diz qual modelo é esse. | `SettingsModal.tsx:612-629`; `mincer.ts:167-169` | Baixa-Média | Datalist com os modelos de texto da OpenRouter e validação no blur ("Model not found on OpenRouter"). O placeholder mostra o modelo que vale no lugar ("Chat model: …"). | M |
| S5 | **O modelo de reescrita do RAG fica dentro de "OpenRouter Integration"** e não há seção de Knowledge Base. | `SettingsModal.tsx:447-462` | Baixa | Seção "Knowledge Base" com o modelo de reescrita e a regra da verificação automática das pastas. | P |
| S6 | **Sem chave, o select de transcrição diz "Add your OpenRouter key first." sem levar até lá.** A navegação de seções não marca a ativa para leitor de tela. | `SettingsModal.tsx:591-597`; `:371-381` (sem `aria-current`) | Baixa | Link "Go to OpenRouter Integration"; `aria-current="page"` na seção ativa. | P |
| S7 | **Os campos gravados sozinhos (Mincer, modelo de reescrita) não confirmam nada**, enquanto a Agenda diz "Saved…" e as chaves pedem botão: são três modelos de salvar. | `SettingsModal.tsx:244-256`, `:561-565` | Baixa | Uma confirmação discreta "Saved" nos campos gravados sozinhos. | P |

### Cenários de borda não cobertos

- **Pasta órfã com áudio e nome fora do padrão** é preservada e só vai para o log (`jobs.rs:427-429`). O usuário nunca sabe que há uma gravação no disco, e ela ocupa cerca de 1 GB/h. Ver a oportunidade O5.
- **Tray por dias:** "Last checked" sem data (K6). A fila retomada no boot gasta API sem aviso (já aceito na spec; o ponto na Toolbar é o único sinal).
- **Muitos itens no Mincer:** sem busca nem agrupamento (M14). Itens do mesmo dia só se distinguem pelo título (M4).
- **Valor antigo no teto:** um teto salvo como 5 h é aceito (`getMaxRecordHours`), mas o select só tem 1, 2, 3, 4 e 6 h (`SettingsModal.tsx:659`). O select fica sem opção correspondente (inferido).
- **Chave removida com a fila cheia:** cada item falha com "Add your OpenRouter key…", e o usuário precisa dar Resume em um por um. Não há "Resume all" (inferido pelo fluxo).
- **Instrução salva apagada sem confirmação** (`SummaryOptions.tsx:52-55`). O custo é baixo, mas é o único Delete sem confirmação da fatia.

## 5. Avaliação frente aos objetivos do usuário

| Objetivo | Consegue? | Esforço e o que atrapalha |
|---|---|---|
| Gravar uma aula ou reunião sem perder nada | Sim, com risco | O fluxo é bom (medidores, parada automática, +30 min, tray). O risco é o loopback mudo por dispositivo diferente (M1), e o preset fica travado no início (M7). |
| Achar depois a gravação certa | Parcial | Sem título na gravação, com a hora do Stop e o histórico só com a data (M4); sem busca (M14). |
| Usar o resultado no estudo | Parcial | Send to notebook e Send to Chat funcionam bem. Faltam copiar e levar um trecho (M2), e voltar à nota enviada (M3). |
| Retomar o que falhou | Sim | Resume e erros legíveis são bons. O item interrompido ou recuperado não chama atenção (M5). |
| Fazer a IA do caderno usar o meu PDF ou a minha pasta | Parcial | Exige descobrir que precisa ligar o documento em outro modal, num ícone de hover (K1). Sem chave, falha depois e em silêncio (K3). |
| Entender por que a IA não achou algo | Parcial | A pasta não mostra os arquivos nem os erros por arquivo (K4). |
| Configurar chaves e modelos | Sim | Não confirma que a chave funciona nem o saldo (S1); um modelo de resumo digitado errado só aparece no fim do job (S4). |

**Alinhamento à tese.** O Mincer respeita a exceção de volume: nada entra no caderno sem clique, a nota leva a origem e o rótulo de IA, e o Capture text continua sem IA. O que mais serviria à tese agora é M2 (trabalhar sobre a transcrição) e K1 (garantir que o material do usuário de fato alimenta a IA).

## 6. Oportunidades: funcionalidades relacionadas

| Sugestão | Problema que resolve | Impacto | Esforço | Prioridade |
|---|---|---|---|---|
| O1. Trechos da transcrição para a nota ou o Chat (popover na seleção), além do "Copy" | Elaboração sobre o original em vez de colar o resumo inteiro (M2). É o padrão já validado no Reader. | Alto | Médio | Agora (Copy) / Próximo (seleção) |
| O2. "Used in" na KB, com ligação por caderno dentro da própria KB | O documento adicionado sem efeito (K1) | Alto | Médio | Agora |
| O3. Teste de áudio antes de gravar: medidores ativos e nome dos dispositivos antes do Start | Reunião perdida por loopback mudo (M1) | Alto | Médio | Próximo |
| O4. Crédito da OpenRouter no Settings e na tela New do Mincer (junto com a duração e o custo do backlog) | Medo de conta inesperada e 402 no meio do job (S1, backlog "duração e custo") | Médio | Médio | Próximo |
| O5. Settings › "Data & storage": pasta de dados, tamanho de `appData/mincer` (gravações, pastas órfãs com áudio), "Open folder" e dica de backup | Local-first sem visibilidade do disco: 1 GB/h de WAV, órfãs mantidas sem aviso | Médio | Médio | Depois |
| O6. "Add to Knowledge Base" no item do Mincer (a transcrição vira .md numa pasta gerenciada "Mincer", opt-in por caderno) | Transcrições longas fora do alcance do RAG; adianta a fase 2 da spec §10 sem RAG genérico | Médio | Médio | Depois |

**O1, trabalhar sobre o original.** A transcrição é o material bruto que a não-meta protege. Hoje ela é um bloco de leitura só. Uma seleção com "Add to note" (cria ou acrescenta numa nota, com a linha de origem do Mincer) e "Ask in Chat" (abre a pasta do item com o trecho citado) leva para o Mincer o fluxo do Reader (grifo → citação → nota), que o usuário já validou. O "Copy" por aba é o primeiro passo, de custo P.

**O2, "Used in".** A KB é global e a visibilidade é por caderno, mas a única ponte entre as duas é o link "manage Knowledge Base", de mão única. Mostrar na KB onde cada documento é usado, e permitir ligá-lo ali, fecha o ciclo "adicionei, então a IA usa". O aviso logo depois do upload, com o caderno ativo pré-marcado, resolve o caso mais comum com um clique.

**O3, teste de áudio.** Reaproveita a captura WASAPI e os medidores que já existem. O usuário vê o nome dos dispositivos e o nível antes de começar a reunião, que é quando ainda dá para corrigir.

## 7. Próximos passos recomendados

1. **T1** (Escape e confirmação pendente) e **K2** (rótulos de confirmação): custo P e risco de perda de dados.
2. **K1 / O2** ("Used in" e o aviso depois do upload) e **K3** (bloqueio sem chave na KB).
3. **M1** (nome dos dispositivos e aviso de System mudo) e **M6** (+30 min no teto).
4. **M2** (Copy agora), **M4** (título e hora da gravação, hora no histórico) e **M3** (link para a nota enviada).
5. **M5** (estado "Needs attention").
6. **S1 a S3** (verificar a chave e o crédito, confirmar a remoção, textos do Settings).
7. Baixas: **T2, T3** (ícones e caixa dos rótulos), M7 a M13, K4 a K7, D1 a D4, S4 a S7.
8. Oportunidades O3, O4, O5 e O6 conforme a triagem.

## 8. Premissas e limites da análise

- O app não foi executado (outros agentes usam a mesma árvore de trabalho). Tudo vem do código e das specs. As frequências de M1 (headset fora do dispositivo padrão) e a corrida de M5 (recuperação no boot antes ou depois do `refreshUnseen`) são inferidas.
- T1 foi deduzido pela leitura: o `ConfirmModal` não trata Escape, os modais pais fecham com Escape global e ficam montados. Vale reproduzir uma vez no app dev (abrir a KB, clicar em "remove" numa pasta, Esc, reabrir a KB).
- Não verifiquei se a OpenRouter expõe um endpoint de saldo por chave na versão em uso (S1 e O4). Conferir antes de planejar.
- Validações úteis com uso real: quantas gravações por dia e com que dispositivos (M1, M4); se o usuário liga os documentos da KB por caderno ou desiste (K1, contar documentos sem nenhum caderno); quantas vezes um resumo é regenerado por preset errado (M7, M8).

---

## Top 5 por impacto

1. **T1:** o Escape numa confirmação fecha a KB ou o Documents e deixa a pergunta pendente; ao reabrir, "Remove folder" volta com "delete" em foco. Custo P.
2. **K1:** um documento adicionado à KB não é usado por caderno nenhum até ser ligado em outro modal, e a KB não diz isso. Custo M.
3. **M1:** a gravação não mostra quais dispositivos grava; se a reunião toca em outra saída, o loopback grava silêncio sem aviso. Custo M.
4. **M2:** o Mincer não tem Copy nem seleção de trecho para nota ou Chat. A transcrição, que é o material bruto, fica só para leitura. Custo P (Copy) / M (seleção).
5. **M4:** a gravação não tem nome nem hora de início, e o histórico mostra só a data; achar a reunião certa exige abrir item por item. Custo P-M.
