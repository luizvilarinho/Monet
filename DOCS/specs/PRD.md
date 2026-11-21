# PRD — Monet

> Este documento complementa `DOCS/specs/productVision.md` (o *porquê*) e `DOCS/specs/systemSpecification.md` (o *como técnico*) com os requisitos de produto: público, escopo e funcionalidades.

---

## 1. Contexto e problema

O Monet parte da premissa de que **acesso à informação virou commodity, mas profundidade não**. Ferramentas de IA atuais (chats, resumos automáticos) resolvem o primeiro problema e agravam o segundo: terceirizam o esforço de elaboração que é onde o aprendizado realmente acontece.

O Monet existe para quem precisa se aprofundar de verdade em um tema ao longo do tempo — e assume uma postura deliberadamente contrária à dos chats de IA convencionais: o **trabalho do usuário** (notas, leituras, o notebook do tema) é o centro; a IA orbita em volta, disponível quando acionada via `/comandos`, nunca proativa.

> Tese completa, critérios de avaliação de feature e tabela comparativa em [`productVision.md`](productVision.md).

---

## 2. Público-alvo / Persona

**Persona primária: o autodidata em aprofundamento de longo prazo**

Alguém que decidiu estudar um tema a sério — não passar os olhos, mas realmente atravessá-lo: ler o livro todo, acompanhar um curso do início ao fim, voltar ao material semanas depois para reconectar ideias. O Monet nasceu para essa pessoa: o próprio criador o construiu porque sentiu falta de uma ferramenta assim para o próprio estudo.

Duas atividades centrais definem essa persona hoje:

- **Fichamento de livro** — registrar, estruturar e revisitar anotações de uma leitura extensa, mantendo relação com o texto original.
- **Acompanhamento de curso** — anotar ao longo de um curso/palestra em andamento, sustentando o estudo ao longo de várias sessões, não numa sentada só.

**Relação com a IA:** essa persona quer ajuda pontual dentro de um contexto maior — uma pergunta sobre um trecho difícil, uma pesquisa complementar, uma dúvida sobre o livro — mas **rejeita** ferramentas onde a IA vira o centro da atividade. O valor está no estudo sendo feito por ela mesma; a IA é convocada, não oferecida.

**O que essa persona não é:** alguém buscando respostas rápidas e descartáveis (uso de chat genérico), nem alguém fazendo anotações efêmeras/soltas sem intenção de aprofundamento contínuo.

---

## 3. Proposta de valor e diferenciação

O Monet compete com um espaço já povoado por ferramentas de nota + IA — mas a diferenciação não está em "ter IA", está em **quem decide o que vira conhecimento permanente**.

**O mecanismo: perene vs. descartável**

O Monet trata anotação e chat como duas categorias de informação com pesos diferentes:

- **Anotações são perenes** — é aquilo que o usuário deliberadamente decidiu guardar. Por isso, apagar uma anotação exige confirmação (double-check): é uma ação considerada, não acidental.
- **Chat é descartável por natureza** — é onde a exploração acontece: perguntas pontuais, temas ao redor do assunto principal, caminhos que não necessariamente merecem virar registro. Por isso vive em localStorage e apagar uma conversa **não** exige confirmação — a fricção baixa é proposital, reflete que aquele conteúdo não tem o mesmo peso.
- **A ponte entre os dois é explícita e granular**: cada resposta da IA no chat tem um botão **"Anotar"**. Se uma resposta específica merece ser preservada, só ela — não a conversa inteira — migra para a área perene.

A IA nunca escreve diretamente na área permanente. Ela só chega lá por uma decisão explícita do usuário, resposta por resposta.

**Por que isso é diferente de outros apps:** ferramentas como Notion AI, NotebookLM ou assistentes de resumo usam a IA para *definir* a informação — ela resume, ela escreve, e esse output já é o artefato final que fica. Nenhum desses apps usa a IA ativamente como mecanismo de **aprofundamento** da informação, mantendo a curadoria do que é importante nas mãos do usuário. No Monet, a IA é sempre o meio de chegar a algo; o que fica registrado é sempre uma escolha do usuário.

| Ferramenta | Onde a IA entra | Por que isso não serve à tese do Monet |
| --- | --- | --- |
| **Notion AI** | Embutida no workspace, resume/escreve por você — o output já é o artefato final | A IA define a informação, em vez de ajudar a aprofundá-la |
| **NotebookLM** | O notebook é organizado em torno das respostas da IA sobre as fontes | A IA é o destino da interação, não o meio |
| **ChatGPT/Claude puro** | Chat isolado, sem separação entre exploração e registro permanente | Tudo tem o mesmo peso — nada é automaticamente descartável nem automaticamente perene |
| **Obsidian** | Local-first e ótimo em notas conectadas, mas sem IA nativa no fluxo | Resolve "o trabalho no centro", mas não oferece IA à mão nem o mecanismo de curadoria |
| **Readwise Reader** | Ótimo em capturar highlights de leitura | Não distingue exploração descartável de registro permanente |

**Outros elementos do diferencial:**

1. **IA convocada por `/comando` dentro do próprio texto** — sem trocar de janela para uma dúvida pontual.
2. **A IA se ancora no material do próprio usuário** (notas, KB com RAG, pastas monitoradas, o livro aberto no Reader), não em conhecimento genérico, a menos que explicitamente pedido.
3. **Silenciosa por padrão** — nunca sugere ou resume sem ser chamada.

---

## 4. Inventário de funcionalidades atuais

O Monet tem três módulos centrais — **Anotações**, **Chat** e **Library** — que compartilham uma base de conhecimento comum e se conectam entre si por pontes explícitas (nunca automáticas). Um quarto modo, o **Mincer**, é a porta de entrada para grandes volumes e só alimenta os outros por clique.

**Anotações**

Funciona como um caderno escolar: o usuário cria **cadernos**, organiza **matérias** dentro deles, e escreve **anotações** num editor rich-text completo (formatação, tabelas, blocos de código, blocos colapsáveis, notas vinculadas).

- Acesso à IA via `/comandos` digitados direto no texto — rápido, sem sair do fluxo de escrita.
- A resposta de um comando aparece como card, e o usuário escolhe: **Inserir** (embute a resposta como bloco na própria nota) ou **Chat** (abre a mesma resposta no módulo de Chat, pra fazer perguntas paralelas sobre o tema sem poluir a nota).
- Cada caderno tem visibilidade configurável sobre a base de conhecimento (RAG) — a **mesma base** usada pelo Chat, com granularidade por caderno.
- **Marcas de atenção**: o usuário marca um trecho para voltar a ele (botão "Mark" ao selecionar, Ctrl+Shift+M ou `==texto==`), com rótulo opcional ("Pesquisar", "Revisar"). A lista Marks reúne as marcas de todos os cadernos, abre a nota no ponto marcado e resolve a marca sem apagar o texto; o Ctrl+P filtra com `has:mark`/`mark:`. A IA consulta e cita as marcas quando perguntada, mas nunca as cria.
- **Tags de nota** como tema transversal: a tag (com autocomplete) abre a lista das notas com ela, de todos os cadernos, agrupadas por caderno; a seção "Tags" mostra a contagem de cada uma e o Ctrl+P filtra com `tag:`.
- **Board de notas por tipo**: qualquer tipo de nota com uma propriedade Select ou Checkbox pode virar board ("Show as board" no modal de tipos), com colunas pelos valores da propriedade, seções opcionais por um segundo Select e cards das notas do tipo de todos os cadernos. Arrastar o card grava o valor (coluna e seção numa vez); o card abre a nota num modal sobre o board, com Previous/Next; "New" na coluna ou na seção cria a nota já classificada. Abre pelas linhas de board logo abaixo de Tasks na coluna de cadernos, filtra por caderno, busca, chips e uma caixa marcada, e exporta os cards visíveis em CSV no formato do Build your own Radar.
- **Log por tipo de nota**: qualquer tipo de nota pode virar um diário de sessões ("Show as log" no modal de tipos), com uma propriedade Number somada, outra Number de tendência e uma Select ou Text para agrupar. A visão abre por uma linha na coluna de cadernos, logo abaixo dos boards, e lista as notas do tipo de todos os cadernos no dia delas (a `date` ou a criação), num período (este mês, o mês passado, 90 dias ou 12 meses), com sessões e dias distintos ("14 sessions on 12 days"), soma, grupos e a tendência primeiro → último valor em sparkline. O botão "New session" cria uma nota do tipo com a data de hoje e a abre ao lado do Log. O atalho "Create 'Practice' type" monta um diário de prática (Piece, Minutes, BPM, Focus).
- **Calendar**: uma agenda dentro de Anotações que funciona como agenda de papel — cada dia tem sua própria área de anotação, com captura rápida global e lembretes.
- **Trackers de constância**: hábitos com meta semanal (violão 3 vezes por semana), marcados dia a dia numa faixa "Trackers" do Calendar e por chips na nota do dia (na main e na keep). Cada linha mostra o "n/meta" da semana em foco e o total do mês com as semanas que bateram a meta ("13 days · 3 of 4 weeks on target"); a faixa recolhe pelo cabeçalho, e os dias feitos viram pontos na grade do mês. Um tracker pode contar as notas de um tipo (por exemplo, Practice) como dias feitos, sem marca manual; o clique nesse dia abre a nota, e trocar o vínculo com dias vindos de nota pede confirmação. Arquivar mantém o histórico e tira o tracker da faixa e dos agentes. Sem streak, gamificação, lembrete ou notificação. Coach, Plan week e `/week-review` recebem a contagem calculada pelo app, e a tool "Trackers" do Chat consulta o período; a IA nunca marca nem altera tracker.
- **Tasks**: pasta especial de tarefas leves (status, projeto, prazo). Itens de checklist de qualquer nota viram tasks via "Add to Tasks", ficam vinculados à nota de origem e aparecem no Calendar (laranja; vencidas em vermelho) até serem concluídas. Do date × deadline (atraso de planejamento em amarelo, deadline estourado em vermelho), faixa de resumo da semana e **dropdown de visões**: List (Group by data/projeto/status/group), Week board, **Month** (5 semanas a partir da atual, uma linha compacta por task, arrastar para um dia muda o do date com o deadline visível na grade), Kanban (colunas por status; arrastar muda status), Projects e Groups (colunas por projeto/group; arrastar entre projetos move a task e a nota-corpo), **Deadlines** (projetos em colunas e semanas do deadline em faixas alinhadas; arrastar muda só o deadline), My Day (plan today: planejamento diário sem tocar em Do date/Deadline; só na TasksView) e Review (weekly review, reflexão salva no Calendar). **Status customizáveis** (Manage statuses: nome, cor, limite WIP; to do/doing/done/dropped são fixos; excluir um status devolve as tasks a to do; status custom conta como aberto e em andamento) e **visões salvas** (base + projeto + filtro + busca + group by). Quick add com linguagem natural (`fri`, `!17/10`, `#Projeto`, `@<status>`, `!!`), busca de texto (`/`, Ctrl+F), snooze (`z`/`Z` e menu: 1 dia, 1 semana, próxima segunda), tempo em doing (badge), cor por projeto, largura própria da coluna (até 640px) com cadernos ocultos, groups dentro do projeto, atalhos de teclado e ações em lote, bloco `/tasks` vivo nas notas e "Due today" na nota diária, flag Important, recorrência simples (diária/semanal/mensal), progresso do checklist da nota-corpo, lembretes de deadline (véspera e dia) e uma tool "Tasks" opcional no Chat. Na lista, atrasadas aparecem em Overdue (têm prioridade sobre In progress); os chips de resumo não são exclusivos.

*Comandos disponíveis:*
- **Agentes especializados** (ver `DOCS/features/agents_study.md`), cada um com prompt e contexto próprios e o nome do agente no bloco:
  - `/define`: glossário curto, com a definição anterior do termo;
  - `/critique`: julga a profundidade da nota;
  - `/docs`: responde só pelas fontes do caderno, citando doc ou nota;
  - `/expand`: dados novos, com web quando há instrução;
  - `/since`: o que mudou sobre o assunto da nota desde que ela foi escrita. Busca na web a partir de uma data na instrução ou, sem ela, do último `/since` da nota, da data da nota ou da criação, e lista as mudanças datadas, com a fonte; o título do bloco mostra a data de corte e a origem ("Since · 01/03/2026 (note created)"). Só diz que a nota pode estar desatualizada quando uma fonte contradiz o texto de forma explícita. A busca leva os assuntos da nota, nunca o texto dela. Precisa da chave do Tavily (ver `DOCS/specs/radar.md`);
  - `/week-review` e `/today`: só no Calendar. As notas de plano entram pelo resumo calculado pelo app (o mesmo do coach), não pelo corpo; no `/today`, com os itens do plano no dia da nota, feitos ou abertos. O `/week-review` inclui também o resultado de cada tracker na semana (feitos × meta).
- **Demais comandos:** `/search`, `/profile`, `/summarize`, `/opinion`, `/table`, `/explain`, `/guide`, `/mindmap`, `/ask` e `/action`.

A resposta fica na nota como bloco de IA não editável, com o título `<rótulo do agente> · <query>` (a query cortada em 40 caracteres), também no export e no texto que vai à IA. Planejamento, cobrança e tutoria são agentes do Chat (plan-week, planner, coach, tutor).

**Chat**

Vai além de um chat simples:

- Conversas agrupadas em **pastas**; cada pasta pode acessar a mesma base de conhecimento de Anotações, com granularidade por pasta — permite conversar com base em livros, artigos e documentos específicos.
- **System prompt personalizado por pasta**.
- **Agente por conversa**: seletor no composer (General, Plan week, Planner, Coach, Tutor, Radar, Papers), também por atalho (`/plan-week`, `/planner`, `/coach`, `/tutor`, `/radar`, `/papers` ou `/general` no início da mensagem, com autocomplete ao digitar `/`). O agente troca o prompt base, liga as tools de que precisa e recebe um contexto montado pelo app a cada mensagem. O prompt da pasta entra como complemento, e a memória da pasta continua. Cada agente tem a sua política de contexto: Plan week, Planner e Coach rodam sem RAG, web search e deep research (os toggles não mudam, só valem no General); o Tutor mantém o RAG e o web search, sem deep research; o Radar e o Papers também rodam sem RAG, web search do modelo e deep research, porque o app faz as buscas. A nota aberta do chat das Anotações vai a todos. A resposta mostra o rótulo do agente (ícone e nome) quando o agente muda na conversa. Não há agentes no chat do Reader nem nas pastas do Mincer.
- **Plan week**: plano da semana de trabalho a partir de tasks, TODOS, Plans em andamento e notas diárias. Mostra o dia a dia com até 4 itens e as horas só no total do dia, os próximos prazos (até 4 semanas depois) numa linha cada, e Parked e Risks curtos. Usa a capacidade de **Settings › Agenda** (horas por dia e dias de trabalho; padrão 6 h, segunda a sexta). Num dia de trabalho, o plano começa hoje; no último dia de trabalho da semana, cobre hoje e a próxima semana; depois dele (fim de semana), só a próxima. Os Plans entram pelo resumo do app, com os itens de cada plano nos dias a planejar. Só sugere: não grava datas. Os trackers entram numa seção "Trackers" depois dos dias, com as sessões que faltam e os dias sugeridos (fim de semana incluído); essas sessões não têm horas, não usam a capacidade e não contam no teto de 4 itens por dia.
- **Planner**: plano de um objetivo com prazo (livro, curso, vídeos, entrega com etapas). Vem com premissas de até 2 linhas, Plan/Start/End/Capacity/Book e um checklist com um item por dia, que começa pela data `dd/mm` em negrito (o app também lê o dia da semana antes da data, a data ISO, a data sem negrito e o antigo "Dia N"/"Dias N–M"). Pergunta só o prazo, numa pergunta, e assume o ritmo (1 h/dia, todos os dias) e o sumário (que o app não lê dos livros), declarando a suposição. O botão **Save as Plan note** cria a nota com o tipo de plano e as propriedades: acrescenta Capacidade e Livro ao tipo (no idioma das datas do tipo, só no primeiro save), ou cria o tipo "Plan" (Start, End, Capacity, Book). Avisa quando a resposta já foi salva, e explica no modal quando não dá para salvar (nenhum item com data, ou End antes de Start). No replanejamento, oferece **Archive previous plan** (ligado por padrão), só para uma nota de plano com o título citado em "Replaces:" ou, sem ele, o único plano ativo do mesmo livro. O texto passa a ser do usuário.
- **Coach**: cobra o ritmo dos planos ativos ou vencidos. Um plano é uma nota cujo tipo tem par de datas e, além disso, nome de plano (Plan, Plano, Study plan, Reading plan, Plano de estudo/leitura) ou um checklist com ao menos um item no formato do contrato (data no início ou "Dia N"); nomes genéricos como Schedule ou Cronograma contam só pelo checklist. Início e Fim vêm das propriedades com esses nomes; um plano só com Fim também é cobrado. O app calcula feitos × esperados até hoje (planos antigos "Dia N" por dias corridos desde o início) e o sinal do Reader pelo Livro. Mostra o status, o que fazer com datas, uma cobrança e, sem recuperação possível, a proposta de replanejar com `/planner`. Com trackers ativos, cobra também o ritmo de cada um (feitos na semana, sessões que faltam e dias abertos, últimas 4 semanas e totais do mês, tudo contado pelo app) e só oferece o `/planner` quando não há plano nem tracker.
- **Tutor**: julga o estudo de um caderno. O escopo é recalculado a cada mensagem: o caderno da pasta, o nome "Notebook - X" ou o caderno citado na mensagem; sem nenhum, pergunta qual. A mensagem do turno só troca o caderno da pasta quando cita outro entre aspas ou junto de "caderno"/"notebook"; nesse caso (e no chat sem pasta) o RAG e o `search_knowledge_base` buscam nesse caderno. O tutor diz o caderno só na 1ª resposta e quando o escopo muda. Usa o perfil do estudo (nota com a tag `study profile`, ou o título como reserva, salvável pelo botão **Save study profile**), os resumos com número de capítulo, os planos, as marcas, o glossário do `/define` e os títulos das notas, e lê as notas por `get_note` mesmo com a tool Notes desligada. Sai em Solid, Weak, Essential missing, Reading (só títulos reais, fora do que já está no caderno) e Activity.
- **Radar**: o que há de novo, desde a última consulta, nos assuntos que o usuário estuda. O escopo (caderno da pasta, caderno, tag, board ou tudo) é recalculado a cada mensagem, e o app monta um mapa de foco (títulos recentes, perfis, planos, tags, livros em andamento, cards do board), gera consultas só com assuntos e termos, busca na web (Tavily, com filtro de data) e artigos novos (OpenAlex), filtra por data, repetidos e páginas já na KB e entrega ao modelo candidatos numerados. O modelo escolhe até 8 itens (News, Releases & changes, New papers) e diz o que cada um toca; título, link, fonte e data vêm do app. A janela começa em 30 dias e, depois, vai da última consulta concluída (guardada no SQLite, por escopo) até no máximo 90; a mensagem pode pedir outra ("since 01/11", "last 7 days", também com teto de 90), e dentro da conversa a janela não encolhe. Uma linha montada pelo app acima da lista diz o escopo, a janela e as consultas feitas. A mensagem de seguimento ("obrigado", "me fala mais do 2º") não refaz a busca: o modelo responde pela conversa. Sem novidade relevante, diz "Nothing new since…". Um perfil opcional (nota com a tag `radar profile`, salvável pelo botão **Save radar profile**, proposto só na primeira consulta do escopo) diz o que seguir, as fontes preferidas e o que ignorar; ele vale para qualquer caderno, mas num escopo de caderno, tag ou board a busca segue o escopo e o "Follow" só vale para o que casa com ele. Num escopo sem notas, a mensagem com um assunto busca por ele. Só roda quando chamado (o atalho `/radar` sozinho só seleciona o agente), sem background, e exige a chave do Tavily.
- **Papers**: os artigos essenciais e os recentes sobre o escopo (caderno, tag ou tudo), do OpenAlex: os fundamentais (por relevância, reordenados por citações) e os dos últimos 3 anos, sem os que já estão na fila de leitura. Até 6 artigos, cada um com autores, ano, citações, indicação de acesso aberto e o motivo ligado ao escopo; o modelo só escolhe entre os candidatos, então nenhuma referência é inventada. Funciona sem chave (orçamento gratuito do OpenAlex, cuja cobertura de artigos de conferência é baixa); uma chave gratuita é opcional em Settings. Do perfil do Radar usa só o que mandar ignorar, e num escopo sem notas busca pelo assunto da mensagem. A mensagem de seguimento também não refaz a busca.
- **Ações por item (Radar/Papers)**, sempre por clique, embaixo da resposta: **Open** (navegador); nos itens web, **Send to Mincer** (enfileira a página ou o vídeo) e **Add to KB** (grava a página na KB da pasta, sem triagem); nos artigos, **Add to reading list** (cria uma nota do tipo "Paper", com Status, Year, Authors e DOI, board por Status, o link do DOI, o link do PDF quando há, o abstract, o motivo marcado como sugestão da IA e uma seção "My notes" vazia para o usuário; o aviso de propriedade conflitante e o botão **Open reading list**, que abre o board, aparecem no sucesso; o artigo já na fila vira "In reading list", ou "Archived" quando a nota está arquivada, e abre a nota) e **Open in Library** (baixa o PDF de acesso aberto, registra o livro e o liga à nota). A IA nunca grava nota, KB ou fila por conta própria.
- **Memória por pasta gerenciada pela própria IA** — ela decide o que vale reter entre conversas.
- **RAG automático (fase de teste):** durante uma pesquisa web, se o modelo encontra um artigo relevante — inclusive científico —, ele grava automaticamente na base de conhecimento da pasta e passa a consultá-lo via RAG nas respostas seguintes. Ainda em validação: o objetivo é comprovar se isso melhora a qualidade das respostas frente ao fluxo sem esse sistema.
- Cada resposta tem botões de **copiar** e de **Anotar** — a ponte de volta pra Anotações (mecanismo perene vs. descartável, item 3).
- Ferramentas de pesquisa: **web search** e **deep research** (busca em várias etapas, priorizando qualidade sobre uma busca única).
- **Tool "Trackers"**, ao lado da tool "Tasks": só leitura, devolve por tracker o total no período, o resultado de cada semana e os dias feitos, com os números do app. Ligada por padrão, mas só vai ao turno quando há ao menos um tracker ativo; forçada no Coach e no Plan week e fora do chat do Reader. A IA não marca, cria nem altera tracker.

**Library**

Onde o usuário lê PDFs, livros e artigos.

- Leitura com zoom e **grifos em várias cores**.
- Um chat aparece ao lado do livro: a cada pergunta, o modelo tem acesso à página atual e aos destaques feitos, deixando as respostas mais coerentes com o que está sendo lido.
- Cada destaque pode virar uma citação enviada direto pra Anotações — útil pra quem está fazendo um fichamento.
- Os chats de cada livro **não ficam isolados** na Library: aparecem também na área de Chat geral, como qualquer outra pasta.
- **Open in Library**, a partir de uma nota Paper da fila de leitura (botão acima do conteúdo da nota, e também na lista de itens do Radar e do Papers): abre o livro já ligado à nota ou baixa o PDF de acesso aberto do artigo (o link fica na nota, na linha `PDF:`), registra o livro na Library (com a mesma validação do import) e o liga à nota, para ler com o chat do Reader. Só por clique; o download só ocorre depois de o artigo estar na fila. A mesma barra aparece também quando o card do board da fila abre a nota. Para o artigo de acesso fechado (sem o link do PDF), o usuário baixa o PDF por fora, importa na Library e liga o livro à nota com **Link a Library book…** (um seletor dos livros da Library); **Unlink** desfaz o vínculo e o livro fica na Library.

**Mincer**

Processa o que o usuário não consegue ler ou ouvir inteiro: arquivo de áudio/vídeo/texto (vários de uma vez, ou soltos na janela), texto colado, gravação do áudio do sistema e do microfone, vídeo do YouTube e página web (resumo ou só captura do texto). Ver `DOCS/specs/mincer.md`.

- Fila em background no Rust: o usuário enfileira e continua trabalhando no Monet; progresso, Cancel, Resume (retoma sem repetir o trabalho já pago) e toast nativo do Windows ao terminar. Itens terminados ficam marcados como novos (no histórico e no botão Mincer) até serem abertos.
- Gravação com indicador fora da tela (ponto vermelho e tempo no botão Mincer), nível de áudio por faixa e Discard.
- Transcrição e resumo com presets (Meeting, Class, News, Scientific) e instruções próprias; a transcrição/o texto bruto fica sempre acessível ao lado do resumo. No preset Meeting, as ações saem como checklist, que o usuário pode transformar em tasks com o "Add to Tasks".
- Saídas só por clique: **Send to notebook** (nota com linha de origem e rótulo de IA no topo; o item fica marcado como enviado), **Send to Chat** (pasta do item no grupo Mincer, com o conteúdo como contexto efêmero e aviso visível quando a transcrição passa do orçamento) e **Save .md**.
- Entrada pelo Chat: o **Send to Mincer** dos itens web do Radar enfileira a página ou o vídeo no Mincer, a pedido do usuário; a fila e o processamento não mudam.

---

## 6. Escopo de plataforma

**Hoje: desktop Windows, local-first**

O Monet é um app desktop Windows construído em Tauri 2, com todos os dados vivendo na máquina do usuário — notas e metadados em SQLite (`monet.db`), vetores de embeddings em banco separado (`monet-vec.db`). Não existe conta de usuário, backend próprio ou sincronização entre dispositivos: é uma instância única e local.

**Distribuição:** dois canais em paralelo —
- **Microsoft Store**, como "Monet notes", gratuito, empacotado em MSIX.
- **Download direto** (GitHub Releases), com auto-updater embutido — necessário porque o sandbox da Store não permite que o updater do app aplique atualizações; dentro da Store é a própria Microsoft quem atualiza.

**Considerado para o futuro, sem decisão tomada**

- A visão original do projeto prevê um **webapp simplificado reaproveitando o mesmo código React** — a arquitetura já reserva espaço pra isso (camada `storage.ts` com abstração Tauri vs. browser), mas o lado browser não está implementado.
- Exploração mais concreta e recente: uma versão **web/PWA standalone da Library/Reader** (só leitura de PDF + chat), pensada pra uso em tablet, **sem sincronização com o desktop** (cada dispositivo com sua própria cópia local) — ainda em avaliação de viabilidade, não confirmada.

**Fora de escopo hoje:** apps mobile nativos, colaboração multiusuário/compartilhamento, qualquer forma de sync entre dispositivos.

---

## 9. Não-metas / Fora de escopo

Decisões deliberadas sobre o que o Monet não tenta ser — importantes pra barrar scope creep em features futuras que pareçam boas ideias isoladamente, mas contrariem a tese central (item 3).

- **Não é um chatbot de propósito geral.** A IA no Monet só existe ancorada no material do usuário (notas, KB, o livro aberto); não é um substituto para ChatGPT/Claude como destino de conversa livre e desconectada de um tema em estudo.
  - *Exceção sob demanda (Radar e `/since`):* trazer o que há de novo exige buscar fora do material do usuário. A exceção vale só dentro destas condições: roda **apenas quando o usuário chama** (sem background, sem agendamento, sem feed e sem notificação); a busca é ancorada no mapa de foco do escopo (ou na nota, no `/since`; num escopo sem notas, no assunto que o usuário escreveu) e leva só assuntos e termos, nunca o texto das notas; o modelo só escolhe entre candidatos que o app encontrou, então não inventa fonte; e **nada entra em nota, KB, fila de leitura ou Mincer sem um clique do usuário**. O Papers segue ancorado no mapa de foco do escopo.
- **Não faz o trabalho de elaboração pelo usuário.** Recursos que "resumem tudo automaticamente" ou "geram anotações sozinhas" sem curadoria explícita do usuário contrariam o mecanismo perene vs. descartável (item 3) — a IA nunca escreve direto na área permanente.
  - *Exceção de volume (Mincer):* para reuniões, aulas e vídeos de horas, elaborar sem um intermediário é inviável, então o Mincer resume automaticamente. A exceção vale só dentro dessas condições: o resumo fica no histórico do Mincer e só entra num caderno ou no Chat por clique; a nota enviada leva a origem e o rótulo de IA no topo; a transcrição/o texto bruto (e o "Capture text", sem IA) continuam de primeira classe para o usuário trabalhar sobre o original.
- **Não é uma ferramenta de anotação rápida/efêmera** (tipo Apple Notes ou Google Keep) para quem só quer anotar sem intenção de aprofundamento contínuo — isso está fora da persona-alvo (item 2).
- **Não é um gerenciador de projetos/produtividade geral.** Calendar e Tasks existem pra sustentar o estudo ao longo do tempo e rastrear o que ficou pendente nas anotações — sem pretensão de competir com ferramentas de PM (Todoist, Notion como tracker de projetos). Tasks é um gerenciador pessoal de entregas, integrado às notas e ao Calendar; sem colaboração, sem subtarefas como entidade e sem criação automática por IA (a tool "Tasks" do Chat só consulta). Prioridade leve (uma flag) e recorrência simples são permitidas. Os trackers de constância existem nos mesmos termos: sustentam o estudo ao longo do tempo (violão 3 vezes por semana, uma atividade física), sem virar um app de hábitos — sem streak, gamificação, lembrete ou notificação, e a IA só consulta os números, nunca marca nem altera.
- **Não é colaborativo.** Sem compartilhamento em tempo real, múltiplos usuários num mesmo caderno, ou qualquer forma de trabalho em equipe — é uma ferramenta de estudo individual.
- **Não sincroniza entre dispositivos** hoje (item 6) — decisão de arquitetura que também reflete o produto: cada instância do Monet é o espaço de estudo de uma pessoa, numa máquina.
