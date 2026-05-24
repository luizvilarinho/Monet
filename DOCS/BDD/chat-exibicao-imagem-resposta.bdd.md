# BDD - Exibicao de Imagens nas Respostas do Modelo

## Historias de usuario

### HU-01 - Ver imagens das respostas renderizadas no chat em vez de ver o codigo markdown
Prioridade: Alta

Como usuario do Monet
Quero que imagens incluidas nas respostas do modelo sejam exibidas visualmente no chat
Para compreender o conteudo da resposta sem precisar abrir links manualmente

### HU-02 - Ser informado quando uma imagem nao pode ser carregada
Prioridade: Alta

Como usuario do Monet
Quero ver uma indicacao visual quando uma imagem da resposta nao puder ser carregada
Para saber que havia uma imagem naquele ponto e que ela nao esta disponivel

### HU-03 - Nao ver sintaxe markdown bruta de imagem em respostas renderizadas
Prioridade: Alta

Como usuario do Monet
Quero que a sintaxe `![alt](url)` seja sempre convertida em imagem visivel
Para que as respostas do modelo sejam limpas e legiveis

---

## Cenarios BDD

```gherkin
Feature: Exibicao de Imagens nas Respostas do Modelo
  Como usuario do Monet
  Quero que imagens retornadas pelo modelo sejam exibidas visualmente no chat
  Para ter uma experiencia de leitura completa sem ver codigo markdown bruto

  # --- Renderizacao de imagem em markdown ---

  Scenario: Renderizar imagem em sintaxe markdown como elemento visual
    Given que o modelo retornou uma resposta contendo a sintaxe `![alt](url)`
    When a resposta for exibida no painel de chat
    Then a sintaxe markdown de imagem nao deve ser visivel como texto
    And a imagem deve ser renderizada como elemento visual no local correspondente da resposta

  Scenario: Renderizar imagem com texto alt como atributo de acessibilidade
    Given que o modelo retornou uma resposta contendo `![descricao da imagem](url)`
    When a imagem for renderizada no painel de chat
    Then o texto alternativo da sintaxe markdown deve ser usado como descricao da imagem
    And o texto alt nao deve ser exibido visualmente ao usuario quando a imagem carrega com sucesso

  # --- Renderizacao de imagem em HTML ---

  Scenario: Renderizar tag HTML de imagem como elemento visual
    Given que o modelo retornou uma resposta contendo a tag `<img src="url" alt="texto">`
    When a resposta for exibida no painel de chat
    Then a tag HTML nao deve ser visivel como texto
    And a imagem deve ser renderizada como elemento visual no local correspondente da resposta

  # --- Imagens com problemas de carregamento ---

  Scenario: Remover imagem e exibir mensagem de falha para URL invalida
    Given que o modelo retornou uma resposta com uma imagem cuja URL e invalida ou inexistente
    When o chat tentar carregar a imagem e o carregamento falhar
    Then a imagem nao deve ser exibida
    And uma mensagem de texto deve aparecer no lugar da imagem informando que houve uma tentativa de carrega-la (ex: "Nao foi possivel carregar a imagem")
    And nenhuma nova tentativa de carregamento deve ser feita automaticamente
    And o restante do texto da resposta deve continuar sendo exibido normalmente

  Scenario: Remover imagem e exibir mensagem de falha para erro de CORS
    Given que o modelo retornou uma resposta com uma imagem em um dominio externo que bloqueia CORS
    When o chat tentar carregar a imagem e o carregamento falhar
    Then a imagem nao deve ser exibida
    And uma mensagem de texto deve aparecer no lugar da imagem informando que houve uma tentativa de carrega-la
    And nenhuma mensagem de erro tecnica deve ser exibida ao usuario
    And nenhuma nova tentativa de carregamento deve ser feita automaticamente

  Scenario: Exibir indicador de carregamento enquanto a imagem e buscada
    Given que o modelo retornou uma resposta com uma imagem externa
    When a resposta for exibida e a imagem ainda nao tiver sido carregada
    Then um indicador de carregamento deve ser exibido no espaco reservado para a imagem
    And ao concluir o carregamento com sucesso o indicador deve ser substituido pela imagem

  # --- Limite de tamanho ---

  Scenario: Nao renderizar imagem acima de 5MB
    Given que o modelo retornou uma resposta com uma imagem cuja URL aponta para um arquivo maior que 5MB
    When o chat tentar carregar a imagem
    Then a imagem nao deve ser renderizada
    And uma mensagem de texto deve aparecer no lugar da imagem informando que houve uma tentativa de carrega-la
    And nenhuma nova tentativa de carregamento deve ser feita automaticamente

  Scenario: Renderizar normalmente imagem com tamanho igual ou inferior a 5MB
    Given que o modelo retornou uma resposta com uma imagem cuja URL aponta para um arquivo de no maximo 5MB
    When o chat carregar a imagem com sucesso
    Then a imagem deve ser exibida normalmente como elemento visual

  # --- Comportamento de tamanho e layout ---

  Scenario: Exibir imagem com largura adaptada ao painel de chat
    Given que o modelo retornou uma resposta com uma imagem externa
    When a imagem for carregada com sucesso
    Then a imagem deve ser exibida com largura maxima limitada ao painel de chat
    And a proporcao original da imagem deve ser preservada
    And a imagem nao deve transbordar os limites do painel

  # --- Exibicao da URL da imagem ---

  Scenario: Exibir URL da imagem como caption ou tooltip
    Given que uma imagem foi carregada com sucesso em uma resposta do modelo
    When a imagem for exibida no painel de chat
    Then a URL da imagem deve ser visivel como caption abaixo da imagem ou como tooltip ao passar o mouse sobre ela

  # --- Imagens SVG ---

  Scenario: Renderizar SVG como imagem somente visual sem interatividade
    Given que o modelo retornou uma resposta com uma imagem em formato SVG
    When a imagem SVG for renderizada no painel de chat
    Then o SVG deve ser exibido como elemento de imagem visivel
    And nenhum script embutido no SVG deve ser executado
    And nenhum evento interativo do SVG deve ser ativado
    And o SVG deve ser tratado como imagem estatica para visualizacao apenas

  # --- Seguranca: bloqueio de URLs locais ---

  Scenario: Bloquear renderizacao de imagem com URL de localhost
    Given que o modelo retornou uma resposta com uma imagem cuja URL aponta para localhost (ex: http://localhost ou http://127.0.0.1)
    When o chat processar a URL da imagem
    Then a imagem nao deve ser carregada nem exibida
    And uma mensagem de texto deve aparecer no lugar informando que houve uma tentativa de carrega-la
    And nenhuma requisicao de rede deve ser feita para o endereco local

  Scenario: Bloquear renderizacao de imagem com URL de rede privada
    Given que o modelo retornou uma resposta com uma imagem cuja URL aponta para um endereco de rede privada (ex: 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    When o chat processar a URL da imagem
    Then a imagem nao deve ser carregada nem exibida
    And uma mensagem de texto deve aparecer no lugar informando que houve uma tentativa de carrega-la
    And nenhuma requisicao de rede deve ser feita para o endereco privado

  # --- Seguranca: sanitizacao de HTML ---

  Scenario: Nao executar scripts embutidos em respostas HTML do modelo
    Given que o modelo retornou uma resposta contendo HTML com tags de script ou eventos inline
    When a resposta for renderizada no painel de chat
    Then nenhum script deve ser executado
    And apenas o conteudo seguro (texto e imagens) deve ser renderizado

  # --- Persistencia no historico ---

  Scenario: Imagens das respostas persistem no historico do chat
    Given que o modelo retornou uma resposta com imagens em uma sessao anterior
    When o usuario reabrir o painel de chat para a mesma nota
    Then as imagens das respostas devem continuar sendo exibidas (se as URLs ainda estiverem acessiveis)

  Scenario: Imagem que carregou anteriormente pode aparecer como falha em sessao futura
    Given que o modelo retornou uma resposta com uma imagem em uma sessao anterior e ela carregou com sucesso
    When o usuario reabrir o chat em uma sessao futura e a URL da imagem nao estiver mais acessivel
    Then a mensagem de falha de carregamento deve ser exibida no lugar da imagem
    And nenhum erro deve ser lancado que comprometa a exibicao do restante da resposta

```

---

## Criterios de aceitacao

1. Toda ocorrencia da sintaxe `![alt](url)` em respostas do modelo deve ser renderizada como elemento de imagem visivel, nunca como texto literal.
2. Toda ocorrencia da tag `<img>` em respostas do modelo deve ser renderizada como elemento de imagem visivel, nunca como texto ou codigo HTML bruto.
3. Imagens devem ter sua largura limitada ao painel de chat, preservando a proporcao original, sem transbordar o layout.
4. Enquanto uma imagem carrega, um indicador visual de carregamento deve ocupar o espaco reservado para ela.
5. Quando uma imagem falha ao carregar (URL invalida, erro de rede, CORS), a imagem deve ser removida da exibicao e substituida por uma mensagem informando que houve uma tentativa de carrega-la (ex: "Nao foi possivel carregar a imagem"). Nenhuma nova tentativa de carregamento deve ser feita automaticamente.
6. Nenhuma mensagem de erro tecnica deve ser exibida ao usuario quando uma imagem falha ao carregar.
7. Imagens cujo arquivo ultrapassa 5MB nao devem ser renderizadas; uma mensagem de falha deve ser exibida no lugar.
8. URLs de imagem apontando para localhost (127.0.0.1, ::1) ou faixas de rede privada (10.x, 172.16-31.x, 192.168.x) devem ser bloqueadas sem realizar nenhuma requisicao de rede.
9. Imagens SVG devem ser renderizadas como imagem estatica somente para visualizacao; scripts embutidos e eventos interativos do SVG nao devem ser executados.
10. A URL da imagem deve ser exibida ao usuario como caption abaixo da imagem ou como tooltip ao passar o mouse sobre ela.
11. O conteudo HTML retornado pelo modelo deve ser sanitizado: scripts e eventos inline nao devem ser executados.
12. Respostas com imagens devem persistir no historico do chat entre sessoes; imagens cuja URL ficou inacessivel devem exibir a mensagem de falha ao reabrir.

---

## Glossario do dominio

- Monet: aplicacao desktop de notas com painel de IA para apoio ao estudo.
- Chat: modulo do Monet que permite ao usuario trocar mensagens livres com um modelo de IA.
- Painel de chat: area do Monet onde o historico de mensagens do chat e exibido.
- Modelo: opcao de IA disponibilizada pela OpenRouter, como Claude, GPT-4 ou Gemini.
- Resposta do modelo: mensagem retornada pelo modelo de IA ao usuario no painel de chat.
- Imagem inline: imagem incluida diretamente no corpo de uma resposta do modelo, referenciada por URL.
- Sintaxe markdown de imagem: notacao `![texto alt](url)` usada para referenciar imagens em markdown.
- Tag HTML de imagem: elemento `<img src="url" alt="texto">` retornado diretamente pelo modelo como HTML.
- Texto alt: descricao textual da imagem, proveniente do atributo `alt` do markdown ou da tag HTML, usada para acessibilidade.
- Renderizacao de imagem: processo de converter a sintaxe markdown ou HTML de imagem em um elemento visual exibivel no chat.
- Indicador de carregamento: elemento visual temporario exibido enquanto a imagem e buscada da URL.
- Mensagem de falha de carregamento: texto fixo exibido quando a imagem nao pode ser carregada (ex: "Nao foi possivel carregar a imagem"), sem retry automatico.
- Limite de tamanho de imagem: restricao de 5MB — imagens acima desse tamanho nao sao renderizadas.
- Erro de CORS: situacao em que o dominio externo da imagem bloqueia o carregamento pelo app por restricoes de seguranca do navegador.
- Bloqueio de URL local: impedimento de carregar imagens cujas URLs apontam para localhost ou enderecos de rede privada.
- SVG estatico: imagem SVG renderizada apenas para visualizacao, sem execucao de scripts ou ativacao de interatividade.
- Sanitizacao de HTML: processo de remover ou neutralizar conteudo HTML potencialmente perigoso (scripts, eventos inline) antes de renderizar no chat.
- Caption: texto exibido abaixo da imagem com informacao complementar, como a URL da imagem.
- Tooltip: texto exibido ao passar o mouse sobre a imagem, podendo conter a URL da imagem.
- Historico do chat: sequencia de mensagens trocadas entre o usuario e o modelo, armazenadas localmente e exibidas no painel de chat.

---

## Ambiguidades e decisoes

| # | Ambiguidade | Decisao |
|---|-------------|---------|
| 1 | Retry automatico para imagens quebradas | Sem retry. Remover a imagem e exibir mensagem de falha de carregamento definitivamente naquela sessao. |
| 2 | Lightbox / zoom ao clicar na imagem | Funcionalidade removida. Imagens nao sao clicaveis para ampliar. |
| 3 | Renderizacao de SVGs | SVGs devem ser renderizados como imagem estatica somente visual. Scripts e interatividade do SVG sao bloqueados. |
| 4 | Limite de tamanho de imagem | Maximo de 5MB para renderizar. Imagens acima disso exibem mensagem de falha. |
| 5 | URLs de localhost e rede privada | URLs de localhost e faixas de rede privada sao bloqueadas; nenhuma requisicao e feita. |
| 6 | Exibicao da URL da imagem | A URL pode ser exibida como caption abaixo da imagem ou como tooltip ao passar o mouse. |
