# Feature: Memória de Pasta (Folder Memory)

## Visão geral

Adicionar ao chat do Monet a capacidade do modelo gerenciar, de forma autônoma e orgânica, uma "memória" textual por pasta. O objetivo é dar continuidade entre conversas dentro da mesma pasta (ex: pasta de estudo de um livro), permitindo que o modelo saiba o que já foi discutido sem precisar reler o histórico completo, e sem que o usuário precise reexplicar contexto toda vez que abre uma nova conversa na pasta.

A memória é deliberadamente **imprecisa por design** — funciona como uma memória humana: guarda o que parece relevante/marcante, descarta o resto, e pode ser editada manualmente pelo usuário a qualquer momento. Não é um banco de dados fiel de tudo que foi dito.

---

## 1. Mudanças de UI

### 1.1 Acesso à memória
- Remover a ideia de "box sempre visível" (descartada).
- Adicionar um **ícone novo ao lado do ícone do prompt adicional**, na linha da pasta (mesma área onde hoje já existem os ícones de documento/prompt — ver referência visual anexa, pasta "Odisseia - Homero").
- Clicar nesse ícone abre um **modal** exibindo o conteúdo da memória daquela pasta como texto editável (semelhante a editar uma nota).
- No modal, o usuário pode: ler o texto completo da memória, editar livremente, apagar trechos ou apagar tudo.

### 1.2 Flag liga/desliga
- Adicionar um novo toggle dentro do **box de "Ferramentas"** do chat (o mesmo painel onde hoje fica "Web Search"), **abaixo do toggle de Web Search**.
- Nome sugerido: "Memória da pasta" (ajustar copy conforme padrão do produto).
- Comportamento:
  - **Ligada**: o modelo recebe o conteúdo atual da memória como contexto injetado, e tem disponível a tool de atualização de memória.
  - **Desligada**: nenhuma leitura nem escrita de memória ocorre. A tool não é oferecida ao modelo e nenhum conteúdo de memória é injetado no prompt.
- Escopo do toggle: **por pasta** (não é uma flag global do app — cada pasta tem seu próprio estado).

### 1.3 Feedback de escrita (toast)
- Quando o modelo decide chamar a tool de atualização de memória em uma resposta, exibir um **toast discreto** (ex: "memória da pasta atualizada"), não bloqueante, que não interrompe o fluxo de escrita do usuário.
- O toast pode ser clicável, abrindo o modal da memória para o usuário ver o que mudou (opcional para v1, pode ficar como melhoria futura).

---

## 2. System prompt: nova variável separada

- Hoje a pasta já possui um campo de **system prompt opcional/adicional** que o usuário escreve, e que pode substituir ou complementar o prompt padrão do app.
- O prompt de gerenciamento de memória **não deve fazer parte nem do prompt padrão, nem do prompt opcional do usuário** — ele precisa ser uma **terceira variável de prompt, independente**, que é **sempre injetada quando a flag de memória estiver ligada**, independentemente de o usuário ter optado por enviar ou não o prompt padrão do app.
- Motivo: o usuário pode desabilitar o envio do prompt padrão (usando só o dele), e mesmo assim a lógica de memória precisa continuar funcionando de forma consistente — ela não pode depender do prompt padrão estar ativo.
- Sugestão de nome de variável: `MEMORY_SYSTEM_PROMPT` (ou equivalente ao padrão de nomenclatura já usado no projeto), injetado como um bloco/capítulo adicional na montagem final do prompt enviado ao modelo, junto com: prompt padrão (se ativo) + prompt opcional do usuário (se preenchido) + `MEMORY_SYSTEM_PROMPT` (se flag de memória ligada) + conteúdo atual da memória da pasta.

### Conteúdo esperado do `MEMORY_SYSTEM_PROMPT`
Deve instruir o modelo a:
1. Avaliar, a cada resposta, se algo da troca atual (considerando o histórico da conversa) merece ser registrado na memória da pasta.
2. Usar os seguintes critérios de julgamento (sem categorias rígidas, orgânico):
   - **Teste de durabilidade**: isso ainda importaria em uma conversa nova, daqui a semanas?
   - **Teste de novidade**: isso já está registrado? Se sim, não repetir — apenas reforçar/atualizar se fizer sentido.
   - **Teste de reuso**: uma sessão futura na mesma pasta se beneficiaria de saber disso sem reler a conversa inteira?
   - **Tema sustentado**: várias trocas seguidas sobre o mesmo assunto são sinal mais forte de relevância do que uma pergunta isolada.
   - **Intenção declarada**: se o usuário anunciar diretamente a intenção de explorar um assunto (ex: "vamos falar sobre X", "vamos fazer um brainstorm sobre Y"), tratar como sinal forte de relevância, mesmo que a troca seja curta.
   - **Saliência cognitiva/emocional**: momentos de insight, esforço interpretativo, conexão pessoal, discordância ou reação afetiva genuína merecem registro mais rico (com conclusão/tese), enquanto trocas pontuais e de baixa saliência merecem no máximo um registro de índice (tema + data), sem conclusão.
   - **Não generalizar reação pontual como traço permanente**: uma preferência, dificuldade ou opinião expressa uma única vez não deve virar "característica" do usuário — só registrar como padrão algo que se repetiu ou foi reforçado.
3. Incluir 2-3 exemplos concretos de "vale registrar" vs. "não vale registrar" (ex: tese defendida sobre um personagem vs. dúvida pontual de vocabulário; e o caso do "nojo de lagarta" como exemplo do que NÃO fazer — não generalizar reação a uma situação específica).
4. Escrever a memória de forma livre/orgânica (sem schema fixo) — pode conter temas cobertos, interpretações do usuário, perguntas em aberto, progresso de leitura, glossário, ou qualquer outra organização que fizer sentido para aquela pasta específica.
5. Quando a memória atingir um tamanho máximo definido, reescrever/resumir o conteúdo existente, decidindo o que condensar ou descartar (poda), preservando o que continua relevante.

---

## 3. Tool: `update_folder_memory`

- Disponibilizada ao modelo **somente quando a flag de memória da pasta estiver ligada**.
- Comportamento: recebe o conteúdo completo da memória atual como parte do contexto, e a tool permite reescrever o blob inteiro (não apenas fazer append) — isso dá ao modelo controle para reorganizar, condensar ou remover trechos que não são mais relevantes, mantendo a curadoria orgânica também na escrita, não só na leitura.
- Gatilho de chamada: **a cada resposta do assistente dentro da pasta** (mesmo mecanismo de decisão de qualquer outra tool call — o modelo decide, dentro da mesma geração da resposta, se atualiza ou não, sem etapa separada). Na maioria dos turnos a tool não deve ser chamada.
- Ao ser chamada com sucesso, disparar o toast de feedback (seção 1.3).

---

## 4. Modelo usado para gerenciar a memória (v1)

- Usar o **mesmo modelo principal da conversa** para decidir e escrever a memória (não usar um modelo secundário mais barato para essa tarefa na v1).
- Motivo: julgamento de relevância exige nuance (evitar erros como generalizar reação pontual em traço permanente), e modelos menores/mais baratos tendem a errar mais nesse tipo de julgamento sutil. Custo extra por chamada é aceitável frente ao risco de memória mal curada.
- Deixar como possível otimização futura (não v1): rotear a decisão de memória para um modelo mais barato via OpenRouter, caso o custo em escala se torne um problema — validando antes se a qualidade do julgamento se mantém aceitável.

---

## 5. Fora de escopo para esta versão

- Estrutura/schema fixo para a memória (permanece texto livre).
- Preferências de estilo de resposta dentro da memória — isso já é coberto pelo prompt opcional existente da pasta, não deve ser duplicado na memória.
- Memória global do usuário (fora do escopo de pasta) — não faz parte desta feature.
- Roteamento para modelo mais barato na extração de memória.