# BDD - Tela de Primeiro Acesso (Onboarding)

## Historias de usuario

### HU-01 - Ver apresentação do app no primeiro uso
Prioridade: Alta

Como novo usuario do Monet
Quero ver uma tela de boas-vindas na primeira vez que abro o app
Para entender o que o Monet faz antes de começar a usá-lo

### HU-02 - Configurar chave do OpenRouter durante o onboarding
Prioridade: Alta

Como novo usuario do Monet
Quero inserir minha chave de API do OpenRouter no fluxo de primeiro acesso
Para que as funcionalidades de IA já estejam disponíveis quando eu começar a usar o app

### HU-03 - Configurar chave do Tavily durante o onboarding
Prioridade: Media

Como novo usuario do Monet
Quero inserir minha chave de API do Tavily durante o onboarding
Para que comandos de busca na internet já estejam habilitados desde o início

### HU-04 - Pular o onboarding e voltar mais tarde
Prioridade: Media

Como novo usuario do Monet
Quero poder pular o onboarding a qualquer momento
Para acessar o app imediatamente e retomar a configuração em outra abertura

### HU-05 - Não ver o onboarding novamente após concluir a última etapa
Prioridade: Alta

Como usuario que completou a última etapa do onboarding
Quero que a tela de primeiro acesso não apareça nas próximas aberturas do app
Para não ser interrompido por um fluxo que já finalizei

### HU-06 - Ser informado sobre limitações quando pular a configuração da IA
Prioridade: Alta

Como usuario que pulou a configuração do OpenRouter
Quero ver uma mensagem clara explicando que as funcionalidades de IA estão desabilitadas
Para entender por que os comandos de IA não estão funcionando e como ativá-los

---

## Cenarios BDD

```gherkin
Feature: Tela de primeiro acesso (Onboarding)
  Como novo usuario do Monet
  Quero ser guiado por uma tela de boas-vindas no primeiro uso
  Para entender o app e configurar as integrações necessárias antes de começar

  # --- Detecção de primeiro acesso ---

  Scenario: Exibir onboarding na primeira abertura do app
    Given que o usuario está abrindo o Monet pela primeira vez
    And que não existe a flag de onboarding concluído salva localmente
    When o app terminar de inicializar
    Then a tela de onboarding deve ser exibida antes do layout principal do app
    And o layout principal do app não deve ser visível enquanto o onboarding estiver aberto

  Scenario: Não exibir onboarding após conclusão da última etapa
    Given que o usuario já concluiu a última etapa do onboarding em uma abertura anterior
    And que a flag de onboarding concluído está salva localmente
    When o app for aberto novamente
    Then o layout principal do app deve ser exibido diretamente
    And a tela de onboarding não deve aparecer

  Scenario: Reexibir onboarding quando janela é fechada sem conclusão
    Given que o usuario está no onboarding e fecha a janela do app sem clicar em nenhum botão
    And que a flag de onboarding concluído não foi salva
    When o app for aberto novamente
    Then a tela de onboarding deve ser exibida novamente
    And o usuario deve começar a partir da etapa 1

  Scenario: Reexibir onboarding quando usuario clica em Skip em etapas intermediárias
    Given que o usuario clicou no botão "Skip" em qualquer etapa antes da última
    And que a flag de onboarding concluído não foi salva
    When o app for aberto novamente
    Then a tela de onboarding deve ser exibida novamente
    And o usuario deve começar a partir da etapa 1

  # --- Estrutura e navegação entre etapas ---

  Scenario: Exibir indicador de progresso com 3 etapas
    Given que o onboarding está sendo exibido
    When o usuario visualizar qualquer etapa do onboarding
    Then deve haver um indicador visual mostrando em qual etapa o usuario está (ex: Step 1 of 3)
    And o indicador deve destacar a etapa atual e mostrar as demais como inativas

  Scenario: Avançar da etapa 1 para a etapa 2
    Given que o usuario está na etapa 1 do onboarding
    When ele clicar no botão "Next"
    Then o sistema deve exibir a etapa 2 do onboarding
    And o indicador de progresso deve refletir a etapa 2

  Scenario: Avançar da etapa 2 para a etapa 3
    Given que o usuario está na etapa 2 do onboarding
    When ele clicar no botão "Next"
    Then o sistema deve exibir a etapa 3 do onboarding
    And o indicador de progresso deve refletir a etapa 3

  Scenario: Concluir o onboarding na etapa 3
    Given que o usuario está na etapa 3 do onboarding
    When ele clicar no botão de conclusão "Get started"
    Then o sistema deve salvar a flag de onboarding concluído localmente
    And o layout principal do app deve ser exibido
    And o onboarding não deve aparecer em aberturas futuras

  # --- Acesso bloqueado durante o onboarding ---

  Scenario: Não acessar Settings durante o onboarding
    Given que o onboarding está sendo exibido
    When o usuario tentar acessar a tela de Settings
    Then o acesso à tela de Settings deve estar bloqueado
    And o onboarding deve permanecer visível e em foco

  # --- Etapa 1: O que é o Monet ---

  Scenario: Exibir conteúdo da etapa 1 — apresentação do app
    Given que o onboarding está sendo exibido pela primeira vez
    When a etapa 1 for renderizada
    Then deve exibir o título "Capture knowledge as it happens"
    And deve exibir uma descrição explicando o propósito do Monet
    And deve exibir um diagrama esquemático das 4 colunas do layout do app
    And deve haver um botão "Next" para avançar para a etapa 2
    And deve haver um botão "Skip" para ir ao app sem concluir o onboarding

  # --- Etapa 2: Configurar OpenRouter ---

  Scenario: Exibir conteúdo da etapa 2 — configuração do OpenRouter
    Given que o usuario está na etapa 2 do onboarding
    When a etapa for renderizada
    Then deve exibir o título "Connect your AI"
    And deve exibir instruções para criar conta e obter a chave do OpenRouter
    And deve haver um campo de input para colar a chave de API
    And deve haver um botão "Save key"
    And deve haver um link para abrir o site do OpenRouter no browser externo
    And deve haver uma nota de segurança indicando que a chave é armazenada apenas localmente
    And deve haver um botão "Next" sempre disponível, independentemente de a chave ter sido salva
    And deve haver um botão "Skip" para ir ao app sem concluir o onboarding

  Scenario: Validar chave do OpenRouter via API ao clicar em Save key
    Given que o usuario está na etapa 2 do onboarding
    And que ele colou uma chave de API no campo de input
    When ele clicar no botão "Save key"
    Then o sistema deve realizar uma chamada de teste à API do OpenRouter com a chave informada
    And enquanto o teste estiver em andamento deve exibir estado de carregamento no botão

  Scenario: Exibir confirmação verde quando chave do OpenRouter é válida
    Given que o usuario está na etapa 2 do onboarding
    And que o sistema testou a chave informada via API do OpenRouter
    When a API retornar resposta de sucesso
    Then o sistema deve salvar a chave do OpenRouter localmente
    And deve exibir mensagem de confirmação em verde indicando que a chave é válida
    And o botão "Next" deve permanecer disponível para avançar para a etapa 3

  Scenario: Exibir erro vermelho quando chave do OpenRouter é inválida
    Given que o usuario está na etapa 2 do onboarding
    And que o sistema testou a chave informada via API do OpenRouter
    When a API retornar resposta de erro (ex: autenticação negada)
    Then o sistema não deve salvar a chave
    And deve exibir mensagem de erro em vermelho indicando que a chave é inválida
    And o campo de input deve permanecer editável para nova tentativa

  Scenario: Tentar salvar chave do OpenRouter com campo vazio
    Given que o usuario está na etapa 2 do onboarding
    And que o campo de input está vazio
    When ele clicar no botão "Save key"
    Then o sistema não deve iniciar nenhuma chamada à API
    And deve exibir feedback indicando que o campo está vazio

  Scenario: Avançar da etapa 2 sem inserir chave do OpenRouter
    Given que o usuario está na etapa 2 do onboarding
    And que nenhuma chave foi salva nessa etapa
    When ele clicar no botão "Next"
    Then o sistema deve exibir a etapa 3 do onboarding sem validação
    And nenhuma chave do OpenRouter deve ser salva

  Scenario: Abrir site do OpenRouter no browser externo
    Given que o usuario está na etapa 2 do onboarding
    When ele clicar no link de acesso ao OpenRouter
    Then o site do OpenRouter deve ser aberto no browser padrão do sistema operacional
    And o onboarding deve permanecer aberto no app

  # --- Etapa 3: Configurar Tavily ---

  Scenario: Exibir conteúdo da etapa 3 — configuração do Tavily
    Given que o usuario está na etapa 3 do onboarding
    When a etapa for renderizada
    Then deve exibir o título "Enable web search (optional)"
    And deve exibir instruções para criar conta e obter a chave do Tavily
    And deve mencionar que o plano gratuito inclui 1.000 buscas por mês sem cartão de crédito
    And deve haver um campo de input para colar a chave de API
    And deve haver um botão "Save key"
    And deve haver um botão "Skip for now" para concluir o onboarding sem configurar o Tavily
    And deve haver um link para abrir o site do Tavily no browser externo
    And deve haver uma nota explicando o que acontece sem essa chave
    And não deve haver botão "Skip" geral nessa etapa (substituído por "Skip for now")

  Scenario: Validar chave do Tavily via API ao clicar em Save key
    Given que o usuario está na etapa 3 do onboarding
    And que ele colou uma chave de API no campo de input
    When ele clicar no botão "Save key"
    Then o sistema deve realizar uma chamada de teste à API do Tavily com a chave informada
    And enquanto o teste estiver em andamento deve exibir estado de carregamento no botão

  Scenario: Exibir confirmação verde quando chave do Tavily é válida
    Given que o usuario está na etapa 3 do onboarding
    And que o sistema testou a chave informada via API do Tavily
    When a API retornar resposta de sucesso
    Then o sistema deve salvar a chave do Tavily localmente
    And deve exibir mensagem de confirmação em verde indicando que a chave é válida
    And o botão "Get started" deve ficar disponível para concluir o onboarding

  Scenario: Exibir erro vermelho quando chave do Tavily é inválida
    Given que o usuario está na etapa 3 do onboarding
    And que o sistema testou a chave informada via API do Tavily
    When a API retornar resposta de erro
    Then o sistema não deve salvar a chave
    And deve exibir mensagem de erro em vermelho indicando que a chave é inválida
    And o campo de input deve permanecer editável para nova tentativa

  Scenario: Pular configuração do Tavily com "Skip for now"
    Given que o usuario está na etapa 3 do onboarding
    When ele clicar no botão "Skip for now"
    Then o sistema deve salvar a flag de onboarding concluído localmente
    And o layout principal do app deve ser exibido
    And o onboarding não deve aparecer em aberturas futuras

  Scenario: Abrir site do Tavily no browser externo
    Given que o usuario está na etapa 3 do onboarding
    When ele clicar no link de acesso ao Tavily
    Then o site do Tavily deve ser aberto no browser padrão do sistema operacional
    And o onboarding deve permanecer aberto no app

  # --- Comportamento do botão "Skip" (etapas 1 e 2) ---

  Scenario: Pular o onboarding a partir da etapa 1
    Given que o usuario está na etapa 1 do onboarding
    When ele clicar no botão "Skip"
    Then o layout principal do app deve ser exibido imediatamente
    And a flag de onboarding concluído não deve ser salva
    And nenhuma chave de API deve ser salva

  Scenario: Pular o onboarding a partir da etapa 2 sem inserir chave
    Given que o usuario está na etapa 2 do onboarding
    And que ele não inseriu nenhuma chave de API
    When ele clicar no botão "Skip"
    Then o layout principal do app deve ser exibido imediatamente
    And a flag de onboarding concluído não deve ser salva
    And nenhuma chave do OpenRouter deve ser salva

  Scenario: Pular o onboarding após salvar a chave do OpenRouter na etapa 2
    Given que o usuario está na etapa 2 do onboarding
    And que ele já salvou uma chave de API do OpenRouter com sucesso
    When ele clicar no botão "Skip"
    Then o layout principal do app deve ser exibido
    And a flag de onboarding concluído não deve ser salva
    And a chave do OpenRouter salva anteriormente deve ser mantida

  # --- Limitações quando configuração da IA foi pulada ---

  Scenario: Exibir painel de IA desabilitado quando OpenRouter não foi configurado
    Given que o usuario acessou o app sem ter configurado a chave do OpenRouter
    When ele acessar o painel de IA no layout principal
    Then o painel deve exibir a mensagem "Set up your OpenRouter key in Settings to enable AI features."
    And os comandos de IA no editor devem permanecer desabilitados

  Scenario: Exibir aviso sobre /search e /profile sem chave do Tavily
    Given que o usuario acessou o app sem ter configurado a chave do Tavily
    When ele tentar executar os comandos /search ou /profile no editor
    Then o sistema deve informar que esses comandos usarão apenas o conhecimento do modelo
    And nenhuma busca na internet deve ser realizada
```

---

## Criterios de aceitacao

1. A tela de onboarding deve ser exibida apenas quando não houver flag de conclusão salva localmente.
2. A flag de conclusão do onboarding só deve ser salva quando o usuario clicar em "Get started" na etapa 3 ou em "Skip for now" na etapa 3.
3. Clicar em "Skip" nas etapas 1 ou 2 leva o usuario ao app sem salvar a flag — o onboarding deve aparecer novamente na próxima abertura.
4. Fechar a janela do app durante o onboarding sem clicar em nenhum botão não deve salvar a flag — o onboarding deve aparecer novamente na próxima abertura.
5. O onboarding deve ser composto por exatamente 3 etapas, com indicador visual de progresso em todas elas.
6. A etapa 1 deve apresentar o título "Capture knowledge as it happens", uma descrição do propósito do app e um diagrama esquemático obrigatório das 4 colunas do layout.
7. O botão "Next" da etapa 2 deve estar sempre disponível, independentemente de a chave do OpenRouter ter sido salva ou não.
8. Ao clicar em "Save key" na etapa 2, o sistema deve testar a chave via API do OpenRouter antes de salvar.
9. Chave do OpenRouter válida deve gerar mensagem de confirmação em verde e ser salva localmente.
10. Chave do OpenRouter inválida deve gerar mensagem de erro em vermelho e não ser salva.
11. O botão "Save key" da etapa 2 não deve disparar chamada à API quando o campo de input estiver vazio.
12. Ao clicar em "Save key" na etapa 3, o sistema deve testar a chave via API do Tavily antes de salvar.
13. Chave do Tavily válida deve gerar mensagem de confirmação em verde e ser salva localmente.
14. Chave do Tavily inválida deve gerar mensagem de erro em vermelho e não ser salva.
15. A etapa 3 deve oferecer "Skip for now" como alternativa à configuração do Tavily; clicar nele conclui o onboarding.
16. A tela de Settings não deve ser acessível enquanto o onboarding estiver aberto.
17. Clicar em links externos deve abrir o browser do sistema operacional sem fechar o onboarding.
18. A chave do OpenRouter salva durante o onboarding deve ser mantida mesmo se o usuario clicar em "Skip" após salvá-la.
19. Se o usuario acessar o app sem chave do OpenRouter, o painel de IA deve exibir a mensagem "Set up your OpenRouter key in Settings to enable AI features."
20. Se o usuario acessar o app sem chave do Tavily, /search e /profile devem usar apenas o conhecimento interno do modelo, sem busca na internet.

---

## Glossario do dominio

- Monet: aplicação desktop de notas com IA para apoio ao aprendizado ativo.
- Onboarding: fluxo de primeiro acesso composto por 3 etapas, exibido até que o usuario conclua a última etapa.
- Primeiro acesso: condição em que o usuario abre o app e não há flag de onboarding concluído salva localmente.
- Flag de onboarding: registro persistido localmente com a chave `onboarding_completed`, salvo apenas ao concluir a última etapa do onboarding.
- Etapa: seção individual do onboarding, identificada por número e exibida em sequência. O onboarding tem 3 etapas.
- Etapa 1: apresentação do Monet — mostra o propósito do app e o diagrama esquemático das 4 colunas.
- Etapa 2: configuração do OpenRouter — permite inserir, validar e salvar a chave da API de IA.
- Etapa 3: configuração do Tavily — permite inserir, validar e salvar a chave da API de busca; é a etapa final do onboarding.
- Indicador de progresso: elemento visual que mostra em qual etapa o usuario está e quantas etapas existem no total.
- Diagrama esquemático das 4 colunas: representação visual obrigatória na etapa 1 que ilustra o layout do app (ex: notebooks, editor, painel IA, chat).
- OpenRouter: serviço de API que fornece acesso a modelos de IA. Necessário para as funcionalidades de IA do Monet.
- Chave do OpenRouter: token de autenticação para acessar a API do OpenRouter, no formato `sk-or-v1-...`.
- Tavily: serviço de busca na internet via API, usado pelos comandos /search e /profile para recuperar informações atualizadas.
- Chave do Tavily: token de autenticação para acessar a API do Tavily, no formato `tvly-...`.
- Plano gratuito (Tavily): nível de acesso ao Tavily que inclui 1.000 buscas por mês sem necessidade de cartão de crédito.
- Validação de chave: chamada de teste feita pelo sistema à API do serviço (OpenRouter ou Tavily) para verificar se a chave informada é válida antes de salvá-la.
- Feedback verde: mensagem de confirmação visual exibida quando a validação de uma chave é bem-sucedida.
- Feedback vermelho: mensagem de erro visual exibida quando a validação de uma chave falha.
- Painel de IA: área lateral do layout principal do app onde as respostas da IA são exibidas.
- Painel de IA desabilitado: estado do painel de IA quando não há chave do OpenRouter configurada; exibe mensagem orientando o usuario a configurar a chave nas Settings.
- Browser externo: browser padrão do sistema operacional do usuario, aberto pelo Tauri para links que saem do app.
- Skip: botão disponível nas etapas 1 e 2 que leva o usuario ao app imediatamente sem salvar a flag de onboarding — o onboarding reaparece na próxima abertura.
- Skip for now: botão exclusivo da etapa 3 que encerra o onboarding sem configurar o Tavily; salva a flag de conclusão.
- Get started: botão de conclusão da etapa 3 após salvar a chave do Tavily; salva a flag de conclusão e abre o app.
- Settings: tela de configurações do app, acessível apenas após o onboarding, onde o usuario pode inserir ou atualizar chaves de API.

---

## Ambiguidades e decisoes pendentes

1. ~~**Validação da chave do OpenRouter:** Validar via API ou apenas salvar?~~ **Decidido:** testar via API antes de salvar; exibir mensagem verde se válida, vermelha se inválida.

2. ~~**Validação da chave do Tavily:** Validar via API ou apenas salvar?~~ **Decidido:** testar via API antes de salvar; exibir mensagem verde se válida, vermelha se inválida.

3. ~~**Botão "Next" na etapa 2 sem chave salva:** Sempre disponível ou bloqueado?~~ **Decidido:** sempre disponível — o usuario pode avançar sem inserir chave.

4. ~~**Conteúdo visual da etapa 1:** Diagrama é obrigatório ou sugestão?~~ **Decidido:** obrigatório — exibir diagrama esquemático das 4 colunas do layout do app.

5. ~~**Comportamento ao fechar a janela durante o onboarding:** Flag salva ou onboarding reaparece?~~ **Decidido:** onboarding reaparece. A flag só é salva ao clicar em "Get started" ou "Skip for now" na etapa 3.

6. ~~**Acesso às Settings durante o onboarding:** Permitido ou bloqueado?~~ **Decidido:** bloqueado — Settings só é acessível após o onboarding.
