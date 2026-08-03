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

O Monet tem três módulos centrais — **Anotações**, **Chat** e **Library** — que compartilham uma base de conhecimento comum e se conectam entre si por pontes explícitas (nunca automáticas).

**Anotações**

Funciona como um caderno escolar: o usuário cria **cadernos**, organiza **matérias** dentro deles, e escreve **anotações** num editor rich-text completo (formatação, tabelas, blocos de código, blocos colapsáveis, notas vinculadas).

- Acesso à IA via `/comandos` digitados direto no texto — rápido, sem sair do fluxo de escrita.
- A resposta de um comando aparece como card, e o usuário escolhe: **Inserir** (embute a resposta como bloco na própria nota) ou **Chat** (abre a mesma resposta no módulo de Chat, pra fazer perguntas paralelas sobre o tema sem poluir a nota).
- Cada caderno tem visibilidade configurável sobre a base de conhecimento (RAG) — a **mesma base** usada pelo Chat, com granularidade por caderno.
- **Calendar**: uma agenda dentro de Anotações que funciona como agenda de papel — cada dia tem sua própria área de anotação, com captura rápida global e lembretes.

*Comandos disponíveis:* `/search`, `/profile`, `/define`, `/summarize`, `/opinion`, `/table`, `/expand`, `/explain`, `/guide`, `/mindmap`, `/ask`, `/docs`, `/action`, `/week`.

**Chat**

Vai além de um chat simples:

- Conversas agrupadas em **pastas**; cada pasta pode acessar a mesma base de conhecimento de Anotações, com granularidade por pasta — permite conversar com base em livros, artigos e documentos específicos.
- **System prompt personalizado por pasta**.
- **Memória por pasta gerenciada pela própria IA** — ela decide o que vale reter entre conversas.
- **RAG automático (fase de teste):** durante uma pesquisa web, se o modelo encontra um artigo relevante — inclusive científico —, ele grava automaticamente na base de conhecimento da pasta e passa a consultá-lo via RAG nas respostas seguintes. Ainda em validação: o objetivo é comprovar se isso melhora a qualidade das respostas frente ao fluxo sem esse sistema.
- Cada resposta tem botões de **copiar** e de **Anotar** — a ponte de volta pra Anotações (mecanismo perene vs. descartável, item 3).
- Ferramentas de pesquisa: **web search** e **deep research** (busca em várias etapas, priorizando qualidade sobre uma busca única).

**Library**

Onde o usuário lê PDFs, livros e artigos.

- Leitura com zoom e **grifos em várias cores**.
- Um chat aparece ao lado do livro: a cada pergunta, o modelo tem acesso à página atual e aos destaques feitos, deixando as respostas mais coerentes com o que está sendo lido.
- Cada destaque pode virar uma citação enviada direto pra Anotações — útil pra quem está fazendo um fichamento.
- Os chats de cada livro **não ficam isolados** na Library: aparecem também na área de Chat geral, como qualquer outra pasta.

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
- **Não faz o trabalho de elaboração pelo usuário.** Recursos que "resumem tudo automaticamente" ou "geram anotações sozinhas" sem curadoria explícita do usuário contrariam o mecanismo perene vs. descartável (item 3) — a IA nunca escreve direto na área permanente.
- **Não é uma ferramenta de anotação rápida/efêmera** (tipo Apple Notes ou Google Keep) para quem só quer anotar sem intenção de aprofundamento contínuo — isso está fora da persona-alvo (item 2).
- **Não é um gerenciador de tarefas/produtividade geral.** O Calendar existe pra sustentar o estudo ao longo do tempo, não pra competir com ferramentas de PM (Todoist, Notion como tracker de projetos).
- **Não é colaborativo.** Sem compartilhamento em tempo real, múltiplos usuários num mesmo caderno, ou qualquer forma de trabalho em equipe — é uma ferramenta de estudo individual.
- **Não sincroniza entre dispositivos** hoje (item 6) — decisão de arquitetura que também reflete o produto: cada instância do Monet é o espaço de estudo de uma pessoa, numa máquina.
