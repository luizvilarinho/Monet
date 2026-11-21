# UX Report — Trackers de constância, Log por tipo de nota e constância nos agentes (fatia 1)

> `uxAgent`, 2026-11-20, branch `feat/radar-trackers`, código sem commit das fases A–C. Análise só a partir do código, do CSS e dos textos: o app não foi aberto. Base: `taskreport_20261120115512.md`, `executionreport_20261120115512.md`, `planreport_20261120122642_a-c.md` e `DOCS/specs/trackers.md`.

## 1. Resumo executivo

Sim, a entrega atende ao objetivo. "Quantas vezes eu treinei mês passado?" se responde em dois cliques no Calendar (‹ e ler a linha do mês). Uma sessão de violão se registra com um clique, pela faixa ou pelo chip, e a janela keep é o caminho mais rápido. As contas são do app, a IA só lê, e não há streak nem lembrete. Os problemas estão nas bordas:
- falhas de leitura e de gravação aparecem como estado vazio ou passam em silêncio;
- o dia vindo de nota não tem saída: é igual ao manual, fica desabilitado e não leva à nota;
- tirar o vínculo com o tipo apaga em silêncio parte do histórico do tracker;
- no chat padrão, a pergunta "quantas vezes" cai numa estimativa, porque a tool vem desligada;
- registrar a sessão com minutos (o Log) continua lento.

## 2. Contexto do app

- **Proposta de valor:** companheiro de quem se aprofunda num tema. O trabalho do usuário fica no centro e a IA é meio (`productVision.md`). A constância entra porque "sustenta a permanência no tema", nos mesmos termos de Tasks (PRD §9).
- **Usuário-alvo:** uma pessoa que estuda e trabalha com notas datadas, Calendar diário, tasks e agentes (Coach, Plan week). Ela quer contar hábitos por semana (violão 3x, atividade física 4x) sem ganhar um app de hábitos.
- **Onde entra:** no Calendar (faixa, grade e nota do dia), nos tipos de nota (Log), na coluna de cadernos e nos agentes do chat (Coach, Plan week, `/week-review` e a tool `query_trackers`).

## 3. O que a task entrega

- Uma faixa "Trackers" no Calendar (main e keep) com a semana em foco, "n/meta", os 7 dias clicáveis e a linha do mês. A grade ganha pontos por tracker (até 3 e um "+").
- Chips na nota do dia: na main acima do "Due today", na keep acima do editor.
- O modal "Trackers": criar, renomear, meta, cor, ícone, setas, arquivar, excluir com contagem, "Counts notes of type" e o atalho Practice.
- O Log por tipo de nota: a config no modal de tipos e a visão na coluna das notas, com período, totais, grupos, sparkline e lista. Há linhas "<Tipo> · Log" na coluna de cadernos e no trilho.
- O Coach, o Plan week e o `/week-review` recebem um resumo calculado. A tool `query_trackers` tem toggle próprio e fica forçada no Coach e no Plan week.

## 4. Análise de usabilidade

### O que funciona bem
- **Leitura num olhar:** a linha "13 in October · 3 of 4 weeks on target" muda com a navegação do mês, sem precisar clicar dia a dia (`TrackersStrip.tsx:134-136`). É a resposta direta à pergunta do Coordenador.
- **Registro em um clique:** nos círculos da faixa e nos chips, com gravação otimista. Na keep, abrir a janela e clicar no dia de hoje bastam.
- **Rótulos e tooltips claros:** "Guitar · Fri 20/11 · not done (click to mark)" (`trackers.ts:198-212`), também como `aria-label`, com `aria-pressed` nos dias e nos chips.
- **Ação destrutiva protegida:** Delete pede confirmação com a contagem de marcas lida no momento do clique. Archive é reversível e não confirma, o que está certo.
- **Agentes sem estimativa:** os blocos dizem "use them as given, never estimate". O Coach só fala de tracker quando há tracker, e o Plan week põe as sessões fora da capacidade e do teto de 4 itens.
- **Visão de produto respeitada:** sem streak, sem cor de "falha" e sem lembrete. A meta batida não ganha festa.

### Problemas encontrados — defeitos de comportamento (enganam o usuário ou põem trabalho em risco)

| # | Problema | Evidência | Severidade | Impacto no usuário | Recomendação | Custo |
|---|----------|-----------|------------|--------------------|--------------|-------|
| D1 | Falha na leitura dos trackers aparece como "No trackers yet." com "New tracker" | `useTrackers.ts:61-64` (`loadFailed` só vira `saveError`), `TrackersStrip.tsx:79-88` (só olha `trackers.length`) | Alta | Quem tem 3 trackers lê que não tem nenhum e é convidado a recriar. A unicidade do nome é checada na lista em memória, que está vazia, e a tabela `trackers` não tem `UNIQUE` em `name` (`tauri.ts:1275`). Se a escrita funcionar, recriar "Guitar" grava um duplicado | Passar `loadFailed` para a faixa. Nesse estado, mostrar "Trackers couldn't load." e um botão "Retry" (`reload`), e esconder "New tracker" | P |
| D2 | Falha ao marcar um dia é silenciosa na faixa e nos chips | `useTrackers.ts:183-196` (desfaz na memória), spec §3 ("o erro aparece no modal de gestão") | Média | O círculo enche e esvazia sem explicação. O usuário acha que errou o clique ou nem percebe, e o erro só aparece se abrir Manage, depois, sem contexto | Uma linha curta no cabeçalho da faixa (e acima dos chips): "Couldn't save Guitar · Fri 20/11. Try again." Limpar o `saveError` antigo quando o modal abre | P |
| D3 | O dia vindo de nota não tem saída | `TrackersStrip.tsx:123` e `TrackerChips.tsx:39` (`disabled`), `trackers.ts:207-209` ("change the note to undo"), `trackers.ts:33-35` (qualquer nota ativa do tipo conta, até vazia) | Alta | Na faixa e no chip, esse dia parece igual ao marcado à mão. O clique não faz nada, o teclado não chega ao botão e o tooltip não diz qual nota é nem o que mudar. Uma nota Practice vazia ou criada por engano marca o dia, e não há caminho até ela | (a) Trocar `disabled` por `aria-disabled` e abrir a nota no clique (com várias no dia, a mais recente). Tooltip: "Done from a Practice note · click to open it. To undo, archive the note or change its date." (b) Diferenciar no visual: anel interno (`box-shadow: inset 0 0 0 2px var(--bg-panel)`) no círculo e sufixo "· note" no chip. Na keep, abrir na main como já se faz com task (`open_task_in_main`) | M |
| D4 | Tirar o vínculo com o tipo, ou apagar o tipo, apaga em silêncio o histórico do tracker | `TrackersModal.tsx:113-117` ("None" grava direto), spec §6 (apagar o tipo zera `linked_type_id`) | Alta | Três meses de dias vindos de notas Practice somem da faixa, da grade, de "3 of 4 weeks" e dos agentes, sem aviso. As notas continuam existindo, mas o número que o usuário acompanhava muda | Antes de trocar o vínculo com N dias vindos de nota, confirmar: "Guitar counts 23 days from Practice notes. Keep them as marked days?" com os botões [Keep as marks] [Stop counting]. A confirmação de apagar o tipo cita os trackers vinculados | M |
| D5 | O tooltip de "n/meta" diz "this week" em qualquer semana | `TrackersStrip.tsx:104` | Baixa | Em outubro, mostra "1 of 3 this week", o que é falso | `${done} of ${target} in ${range}`, com "this week" só quando a semana contém hoje | P |
| D6 | No chat General, "quantas vezes treinei em outubro?" cai numa estimativa | `useChat.ts:411` (`trackers: false`), com Daily notes e Notes ligadas por padrão (`useChat.ts:412-413`) | Média | O modelo não sabe que os trackers existem: conta notas pelo `get_day`/`notes_by_date` ou diz que não sabe. O número difere do Calendar justamente na pergunta que motivou a feature | Ligar `query_trackers` por padrão quando houver tracker ativo, como Daily notes e Notes (é só leitura e custa só a definição da tool). O switch continua servindo para desligar | P |
| D7 | O `/week-review` pode citar trackers para quem não tem nenhum | `weekReview.ts:44` (seção condicional) contra `weekReview.ts:45` ("If a section has nothing, say so in one line") | Média | O modelo pode gravar "Trackers: none" na nota diária, contra a regra "sem tracker, não toca no assunto" | "If Done, Pending or Slipped has nothing, say so in one line. Without a 'Trackers in this week' block, leave out the Trackers section." | P |
| D8 | A altura das linhas da grade muda ao marcar (a confirmar na tela) | `CalendarView.module.css:207-218` (célula em coluna, `min-height` de 28 px) e `:300-314` (pontos) | Média | O dia com ponto de nota, barra de task e pontos de tracker chega a ~34 px, e só aquela linha da semana cresce. Marcar o primeiro tracker de uma semana faz a grade e a faixa "pularem". A 220 px, 3 pontos mais o "+" ocupam ~25 px, a largura inteira da célula | Reservar sempre a altura dos marcadores (célula de 34 px fixa, ou uma fileira de marcadores sempre presente) ou pôr os pontos de tracker em `position: absolute` no rodapé da célula. Gap de 1 px entre os pontos | P |

### Problemas encontrados — melhorias

| # | Problema | Evidência | Severidade | Recomendação | Custo |
|---|----------|-----------|------------|--------------|-------|
| M1 | Na keep, a faixa ocupa ~250 px com 3 trackers e empurra os cards do dia | `TrackersStrip.module.css:80-91,178-184`; keep de 760×600 (`tauri.conf.json`) e Calendar de 220 px | Média | (a) Tirar o nome do mês da linha: "13 days · 3 of 4 weeks on target". O mês já está no cabeçalho do Calendar, e o texto atual (~38 caracteres a 11 px, cerca de 205 px) provavelmente quebra em 2 linhas em 188 px. Isso economiza ~16 px por tracker e resolve a ambiguidade "13 o quê?". (b) Tornar o cabeçalho "Trackers" recolhível, com caret Phosphor e estado por janela em localStorage. Recolhida, a faixa mostra "Trackers · 2/3 · 1/4". Na keep, os chips acima do editor continuam registrando o dia, então recolher a faixa não atrapalha o registro rápido | P + P |
| M2 | A legenda não explica os pontos de tracker, e a cor de um tracker pode ser igual à do ponto de nota ou à da barra de task | `CalendarView.tsx:608-617`; paleta em `tasks.ts:78-87` (`#ef9f27` = `--accent-task`, `#7b6ed4` ≈ `--accent`/`--dot-content`) e rotação em `useTrackers.ts:102` | Baixa | Adicionar "Tracker done" à legenda. Pular essas duas cores na rotação automática (elas continuam disponíveis para escolha). **Teto de 3 pontos: manter.** A ordem decide quais aparecem, e as setas servem para isso | P |
| M3 | O cabeçalho da faixa não diz se a semana é a atual e não mostra quais semanas falharam | `TrackersStrip.tsx:70-77,134-136` | Baixa | "This week · 16–22 Nov" quando a semana contém hoje. Um tooltip na linha do mês com o resultado de cada semana ("29 Sep–5 Oct 3/3 · 6–12 Oct 2/3 …") responde "quais semanas eu perdi?" sem estado novo | P |
| M4 | Registrar a sessão com minutos e BPM é o caminho lento | `NoteLog.tsx:118-132` (o cabeçalho só tem Settings e fechar) | Alta | Um botão com rótulo "New session" (`Plus`) no cabeçalho do Log cria a nota do tipo com `date` de hoje, no último caderno usado para o tipo (ou em Quick Notes), e a abre no editor com o foco na primeira propriedade. Hoje são mais de 6 passos (caderno, nova nota, tipo, propriedades) | M |
| M5 | O período do Log não casa com a pergunta "no mês passado", e os números do Log e do tracker divergem | `noteLog.ts:80-86` (só janelas móveis); o Log conta notas (sessões) e o tracker conta dias, somando as marcas manuais | Média | Incluir "This month" e "Last month" no seletor ("This month · Last month · 90 days · 12 months"). Na linha de totais, "14 sessions on 12 days · 610 Minutes", para quem compara com "12 days" da faixa entender a diferença | P–M |
| M6 | O rótulo "Counts notes of type" quebra em 92 px, e a dica aparece mesmo sem vínculo | `TrackersModal.tsx:222,238-241`, `TrackersModal.module.css:133-137` | Baixa | Rótulo "From notes" (cabe em 92 px) com as opções "None", "Practice notes" e assim por diante. A dica só aparece com vínculo, mais curta: "Days with a Practice note count as done." | P |
| M7 | "Create 'Practice' type" não dá retorno | `TrackersModal.tsx:119-124` | Média | Uma linha de status depois do atalho: "Created the Practice type (Piece, Minutes, BPM, Focus) with a log." e um botão "Open log" (o `openNoteLog` já existe no `App.tsx`). Sem isso, o usuário não sabe onde registrar a sessão | P |
| M8 | No primeiro uso, o modal abre sem foco, e o nome repetido de um tracker arquivado confunde | `TrackersModal.tsx:325-335`, `useTrackers.ts:31-32` | Baixa | `autoFocus` no "New tracker…" quando não há tracker (ou quando o modal vem do "New tracker" da faixa). No conflito com um arquivado: "An archived tracker has this name. Unarchive it?" | P |
| M9 | Mudar a meta reavalia o passado sem aviso | spec §5 ("vale a meta atual para todas as semanas") | Baixa | Uma dica sob "Weekly target": "Past weeks are checked against the current target." | P |
| M10 | Os chips aparecem apagados nos dias futuros, e o estado "feito" depende só da cor | `TrackerChips.tsx:26,37-48` | Baixa | Esconder os chips em dia futuro. Mostrar o ícone Phosphor `Check` no chip feito, no lugar do ícone do tracker ou ao lado do nome | P |
| M11 | Setas para reordenar | `TrackersModal.tsx:159-182` | Baixa | **Manter as setas**: funcionam por teclado e a lista é curta. Escondê-las quando há um tracker só. O handle `DotsSixVertical` dos outros modais (`StatusManagerModal.tsx:43`, `NoteTypesModal.tsx:61`) daria consistência, com ganho baixo | P (M com drag) |
| M12 | No trilho recolhido, os Logs têm todos o mesmo ícone | `NotebookList.tsx:870-886` (`ChartLineUp` só muda de cor, e o Practice nasce com `color: null`) | Baixa | Usar o `TypeIcon` do tipo com um `ChartLineUp` de 9 px no canto. Assim o Log não se confunde com o board do mesmo tipo, que usa o `TypeIcon` | P |
| M13 | O estado vazio fica para sempre para quem não quer trackers | `TrackersStrip.tsx:69-88` (duas linhas fixas no Calendar) | Baixa | Estado vazio numa linha só ("Trackers · New tracker"), ou recolhido como na M1(b) | P |
| M14 | Textos menores | `ChatToolsMenu.tsx:200` (`CheckCircle`), `chat.ts:110-112`, `TrackersModal.tsx:136-138`, `trackers.ts:183-188` | Baixa | Trocar o ícone do toggle por `Target`, o mesmo do tracker padrão. Na confirmação do Delete de tracker vinculado: "Your Practice notes are kept." Na linha do mês antes do início do tracker, "Started 20 Nov" em vez de "0 in September"; em mês futuro, nada | P |

### Cenários de borda não cobertos
- **Duas notas Practice no mesmo dia:** o Log diz "2 sessions" e o tracker diz "1 day". O texto não explica a diferença (ver M5).
- **Uma nota Practice criada hoje para planejar a sessão de amanhã**, sem data, conta como feito hoje (ver D3).
- **Falha na primeira leitura** que persiste depois das tentativas (ver D1).
- **Mais de 3 trackers feitos no mesmo dia a 220 px:** o "+" encosta na borda (ver D8, a confirmar na tela).
- **Tipo vinculado apagado em outra janela:** o tracker para de contar sem aviso (ver D4).

## 5. Avaliação frente aos objetivos do usuário

- **"Quantas vezes eu treinei mês passado?"** Consegue. No Calendar, ‹ leva ao mês e a linha mostra "13 in October · 3 of 4 weeks on target": dois cliques, ou três a partir de outro caderno. O que atrapalha:
  - não se vê quais semanas falharam (M3);
  - "13" não diz a unidade (M1a);
  - "quantos minutos em outubro" não tem resposta, porque o Log não tem mês de calendário (M5);
  - no chat padrão, a resposta tende a ser estimada (D6).
  - O Coach e a tool, quando ligados, respondem com o número do app.
- **Registrar uma sessão de violão em poucos segundos.** Consegue só a marca: pela keep são duas ações (abrir a janela e clicar no dia de hoje ou no chip); pela main, Calendar e um clique. Registrar com minutos e BPM é lento: criar nota, escolher o tipo e preencher, sem atalho (M4). Se a gravação falhar, o usuário não fica sabendo (D2).
- **Primeiro uso (nenhum tracker).** O estado vazio da faixa leva ao modal; depois vêm digitar o nome, Enter, ajustar o ícone e a meta (opcional), Done e clicar no dia: cerca de 5 ações. Falta o foco automático (M8) e o retorno do atalho Practice (M7).
- **Uso diário com tipo vinculado.** O dia vindo de nota marca sozinho, o que é bom, mas é o ponto mais opaco da feature (D3), e trocar o vínculo apaga o histórico (D4).
- **Agentes.** O Coach e o Plan week estão bem delimitados: só leem, sugerem dias e não cobram fora de hora. O `/week-review` tem o risco do D7.

### Opinião sobre os pontos em aberto
- **Faixa a 220 px na keep:** manter os 7 dias e compactar, com a linha do mês sem o nome do mês (M1a) e a faixa recolhível (M1b). Na keep os chips já cobrem o registro do dia.
- **Célula com nota, task e trackers, teto de 3:** manter o teto de 3, mas estabilizar a altura da célula (D8) e pôr os trackers na legenda (M2).
- **Log na coluna das notas:** manter. O Log é uma lista de notas como a lista de uma tag, e o editor ao lado deixa corrigir a sessão sem perder o contexto. Na área inteira, o editor sumiria e ganharia-se pouco, só um sparkline maior. Ajustar os grupos longos: mostrar os 5 primeiros e "Show all N", e filtrar a lista ao clicar num grupo (ver §6).
- **"Counts notes of type" em 92 px:** trocar por "From notes" (M6).
- **Dia vindo de nota que não se desmarca:** como está, o usuário não entende o porquê. A correção é transformar o bloqueio em navegação: o clique abre a nota (D3).
- **Tooltip em botão desabilitado:** no dia futuro, o motivo é óbvio e o `disabled` serve. No dia vindo de nota, trocar por `aria-disabled` com foco e clique (D3), porque o botão desabilitado não recebe foco e o tooltip depende do WebView.
- **Setas para reordenar:** manter (M11).

## 6. Oportunidades: funcionalidades relacionadas

| Sugestão | Problema que resolve | Impacto | Esforço | Prioridade |
|----------|---------------------|---------|---------|------------|
| "New session" no Log (e no tracker vinculado) | Registrar minutos e BPM leva mais de 6 passos | Alto | Médio | Agora |
| Clique no dia vindo de nota abre a nota | Dia "feito" sem explicação e nota vazia contando | Alto | Médio | Agora |
| Mês de calendário no Log ("This month · Last month") e "N sessions on M days" | Minutos do mês passado e números que divergem do tracker | Médio | Baixo | Próximo |
| Filtrar a lista do Log ao clicar num grupo | "Como evoluiu o BPM em Asturias?" exige rolar a lista | Médio | Baixo | Próximo |
| Comando no Ctrl+P "Mark Guitar today" | Registrar sem abrir o Calendar nem a keep | Baixo | Baixo | Depois |
| `query_trackers` (ou uma tool irmã) com as somas do Log | "Quantos minutos pratiquei em outubro?" no chat | Médio | Médio | Depois |

As mais promissoras:
- **"New session" no Log.** Fecha o ciclo da fase B: hoje o Log mostra as sessões, mas não ajuda a criar uma. Com a nota já tipada e datada, a sessão com minutos fica a um clique e a constância passa a ter conteúdo, sem gamificação.
- **Abrir a nota a partir do dia vindo de nota.** Resolve ao mesmo tempo a explicação (de onde veio o "feito"), a correção (a nota está ali para arquivar ou mudar a data) e a acessibilidade (sem botão desabilitado).
- **Mês de calendário no Log.** Alinha o Log à pergunta do Coordenador e à linha do mês da faixa, que é a âncora da feature.

## 7. Próximos passos recomendados

1. D1, D2, D5, D6 e D7: correções pequenas que tiram enganos.
2. D3 e D4: o dia vindo de nota abre a nota, e a troca de vínculo é confirmada com a opção "Keep as marks".
3. D8 e M1: estabilizar a célula e compactar a faixa na keep, conferindo na tela.
4. M7, M6, M8 e M10: retorno do Practice, rótulo, foco e chips.
5. M4 e M5: "New session" e período por mês no Log.
6. Os demais itens de M conforme o custo.

## 8. Premissas e limites da análise

- O app não foi aberto. Tudo o que é altura, quebra de linha e encaixe foi estimado pelo CSS: a linha do mês em 188 px, os ~250 px da faixa na keep, o salto de altura das linhas da grade e os 3 pontos mais o "+" na célula de 220 px.
- Não verifiquei se o WebView2 mostra `title` em botão desabilitado. Pelo que sei, o Chromium mostra, mas falta conferir.
- Não medi o contraste da letra escura sobre cada cor da paleta nos círculos feitos.
- Os prompts do Coach, do Plan week e do `/week-review` não foram rodados com um modelo. D6 e D7 são riscos inferidos do texto do prompt e das tools ligadas por padrão.
- A fatia 2 (Radar, `/since`, Papers) não faz parte deste relatório.
- **Validação sugerida:**
  - usar por duas semanas reais (violão e atividade física) e anotar quantas vezes o registro foi pela keep, pela faixa ou pelo chip;
  - perguntar "quantas vezes fui em outubro?" no General, no Coach e no Assistant e comparar com a faixa;
  - criar uma nota Practice vazia e ver se o usuário descobre por que o dia ficou feito.
