# BDD - System Prompt Personalizado por Pasta no Chat

## Historias de usuario

### HU-01 - Acessar o modal de configuracao de system prompt da pasta
Prioridade: Alta

Como usuario do Monet
Quero clicar em um icone na pasta de chat
Para abrir o modal de configuracao do system prompt daquela pasta

### HU-02 - Definir um system prompt para a pasta
Prioridade: Alta

Como usuario do Monet
Quero escrever um texto de instrucao no modal da pasta
Para que o modelo de IA se comporte de acordo com aquele contexto nas conversas daquela pasta

### HU-03 - Escolher o modo de aplicacao do system prompt
Prioridade: Alta

Como usuario do Monet
Quero selecionar se meu system prompt deve substituir ou ser adicionado ao prompt padrao
Para ter controle sobre o quanto vou personalizar o comportamento base do modelo

### HU-04 - Identificar visualmente pastas com system prompt configurado
Prioridade: Media

Como usuario do Monet
Quero ver o icone da pasta em verde quando ela tiver um system prompt definido
Para identificar rapidamente quais pastas tem comportamento de IA personalizado

### HU-05 - Limpar o system prompt de uma pasta
Prioridade: Media

Como usuario do Monet
Quero apagar o conteudo do system prompt de uma pasta
Para que as conversas daquela pasta voltem a usar o prompt padrao do sistema

### HU-06 - Garantir fallback para prompt padrao quando pasta nao tem system prompt
Prioridade: Alta

Como usuario do Monet
Quero que pastas sem system prompt personalizado usem o prompt padrao do sistema
Para garantir comportamento consistente da IA quando nao ha personalizacao definida

---

## Cenarios BDD

```gherkin
Feature: System Prompt Personalizado por Pasta no Chat
  Como usuario do Monet
  Quero definir um system prompt personalizado para cada pasta de chat
  Para ter mais controle sobre o comportamento do modelo de IA por contexto

  # --- Acesso ao modal ---

  Scenario: Abrir modal de system prompt de uma pasta sem prompt definido pela primeira vez
    Given que o usuario visualiza uma pasta na sidebar do Chat
    And essa pasta nao possui system prompt definido e nunca foi configurada
    When o usuario clicar no icone de system prompt da pasta
    Then o modal de configuracao de system prompt deve ser exibido
    And o campo de texto deve estar vazio
    And o selector de modo deve exibir "Substituir" pre-selecionado
    And o modal deve exibir uma mensagem amigavel explicando brevemente o que e o espaco e para que serve

  Scenario: Abrir modal de pasta cujo texto foi limpo mas modo foi previamente configurado
    Given que o usuario visualiza uma pasta que ja teve system prompt configurado
    And o texto do system prompt foi apagado e o modal foi confirmado sem texto
    And o modo "Adicionar" estava selecionado quando o texto foi apagado
    When o usuario clicar no icone de system prompt da pasta
    Then o modal deve ser exibido com o campo de texto vazio
    And o selector de modo deve exibir "Adicionar" (o modo anteriormente salvo)

  Scenario: Abrir modal de system prompt de uma pasta com prompt ja definido
    Given que o usuario visualiza uma pasta na sidebar do Chat
    And essa pasta ja possui um system prompt definido
    When o usuario clicar no icone de system prompt da pasta
    Then o modal de configuracao de system prompt deve ser exibido
    And o campo de texto deve exibir o system prompt previamente salvo
    And o selector de modo deve exibir o modo previamente salvo

  # --- Configurar e salvar system prompt ---

  Scenario: Salvar system prompt com sucesso
    Given que o modal de configuracao de system prompt esta aberto para uma pasta
    When o usuario escrever um texto no campo de system prompt
    And o usuario selecionar o modo de aplicacao
    And o usuario confirmar o modal
    Then o system prompt deve ser salvo para aquela pasta
    And o modal deve ser fechado
    And o icone de system prompt da pasta deve ficar verde

  Scenario: Salvar modal com campo de texto em branco
    Given que o modal de configuracao de system prompt esta aberto para uma pasta
    And o campo de texto esta vazio
    When o usuario confirmar o modal
    Then nenhum system prompt deve ser salvo para a pasta
    And o modal deve ser fechado
    And o icone de system prompt da pasta deve permanecer no estado padrao (nao verde)

  Scenario: Cancelar edicao do system prompt sem salvar
    Given que o modal de configuracao de system prompt esta aberto para uma pasta
    And o usuario editou o campo de texto
    When o usuario fechar o modal sem confirmar
    Then nenhuma alteracao deve ser salva
    And o system prompt da pasta deve permanecer igual ao estado anterior ao modal ser aberto
    And o icone de system prompt deve permanecer no estado correspondente ao estado anterior

  # --- Modos de aplicacao ---

  Scenario: Selecionar modo "Substituir" no modal
    Given que o modal de configuracao de system prompt esta aberto
    When o usuario selecionar a opcao "Substituir" no campo de modo
    Then a selecao deve indicar que o system prompt do usuario ira substituir completamente o prompt padrao do sistema

  Scenario: Selecionar modo "Adicionar" no modal
    Given que o modal de configuracao de system prompt esta aberto
    When o usuario selecionar a opcao "Adicionar" no campo de modo
    Then a selecao deve indicar que o system prompt do usuario sera combinado com o prompt padrao do sistema

  # --- Indicador visual ---

  Scenario: Icone da pasta em estado padrao sem system prompt
    Given que uma pasta nao possui system prompt definido
    When o usuario visualizar essa pasta na sidebar
    Then o icone de system prompt deve estar no estado padrao (nao verde)

  Scenario: Icone da pasta em verde com system prompt definido
    Given que uma pasta possui um system prompt definido com texto nao vazio
    When o usuario visualizar essa pasta na sidebar
    Then o icone de system prompt deve estar verde

  Scenario: Icone volta ao estado padrao apos system prompt ser removido
    Given que uma pasta possui um system prompt definido e seu icone esta verde
    When o usuario abrir o modal, limpar o campo de texto e confirmar
    Then o icone de system prompt deve voltar ao estado padrao (nao verde)

  # --- Aplicacao no envio de mensagem ---

  Scenario: Enviar mensagem em pasta com system prompt no modo "Substituir"
    Given que uma pasta tem um system prompt definido no modo "Substituir"
    And o usuario esta em uma conversa dentro dessa pasta
    When o usuario enviar uma mensagem
    Then o sistema deve enviar a mensagem para a API usando apenas o system prompt da pasta como prompt de sistema
    And o prompt padrao do sistema nao deve ser enviado para a API

  Scenario: Enviar mensagem em pasta com system prompt no modo "Adicionar"
    Given que uma pasta tem um system prompt definido no modo "Adicionar"
    And o usuario esta em uma conversa dentro dessa pasta
    When o usuario enviar uma mensagem
    Then o sistema deve enviar a mensagem para a API com o prompt padrao seguido do system prompt da pasta
    And o prompt padrao deve vir primeiro no payload da API
    And o system prompt da pasta deve vir depois do prompt padrao

  Scenario: Enviar mensagem em pasta sem system prompt personalizado
    Given que uma pasta nao possui system prompt definido
    And o usuario esta em uma conversa dentro dessa pasta
    When o usuario enviar uma mensagem
    Then o sistema deve enviar a mensagem para a API usando apenas o prompt padrao do sistema

  Scenario: Enviar mensagem em conversa fora de qualquer pasta
    Given que o usuario esta em uma conversa que nao pertence a nenhuma pasta
    When o usuario enviar uma mensagem
    Then o sistema deve enviar a mensagem para a API usando apenas o prompt padrao do sistema

  # --- Isolamento entre pastas ---

  Scenario: System prompt de uma pasta nao afeta conversas de outras pastas
    Given que a pasta "Biologia" tem um system prompt definido
    And o usuario esta em uma conversa dentro da pasta "Historico" que nao tem system prompt
    When o usuario enviar uma mensagem
    Then o sistema deve usar apenas o prompt padrao, sem interferencia do system prompt da pasta "Biologia"

  Scenario: Multiplas pastas com system prompts distintos sao independentes entre si
    Given que existem tres pastas cada uma com system prompt diferente
    When o usuario abrir o modal de cada pasta individualmente
    Then cada modal deve exibir apenas o system prompt daquela pasta especifica
    And nenhuma pasta deve exibir o system prompt de outra pasta

  # --- Interacao com movimentacao de conversas ---

  Scenario: Conversa movida para pasta com system prompt usa novo prompt em mensagens futuras
    Given que existe uma conversa na lista solta sem system prompt personalizado
    And existe uma pasta "Biologia" com system prompt no modo "Substituir"
    When o usuario mover essa conversa para a pasta "Biologia"
    And o usuario enviar uma nova mensagem nessa conversa
    Then o sistema deve usar o system prompt da pasta "Biologia" para essa nova mensagem

  Scenario: Conversa retirada de pasta com system prompt usa prompt padrao em mensagens futuras
    Given que existe uma conversa dentro da pasta "Biologia" que tem system prompt definido
    When o usuario retirar essa conversa da pasta e ela ir para a lista solta
    And o usuario enviar uma nova mensagem nessa conversa
    Then o sistema deve usar apenas o prompt padrao para essa nova mensagem

  # --- Persistencia ---

  Scenario: System prompt da pasta persiste apos reiniciar o app
    Given que uma pasta tem um system prompt e modo de aplicacao definidos
    When o usuario fechar e reabrir o app
    Then a pasta deve manter o mesmo system prompt
    And a pasta deve manter o mesmo modo de aplicacao
    And o icone de system prompt deve continuar verde

  Scenario: Pasta nova criada sem system prompt inicia sem configuracao
    Given que o usuario criou uma nova pasta
    When o usuario abrir o modal de system prompt dessa pasta
    Then o campo de texto deve estar completamente vazio
    And nenhum texto residual de outra pasta deve ser exibido
```

---

## Criterios de aceitacao

1. Cada pasta na sidebar deve exibir um icone clicavel que abre o modal de configuracao de system prompt.
2. O icone deve estar no estado padrao (nao verde) quando a pasta nao possuir system prompt definido ou quando o campo estiver vazio.
3. O icone deve ficar verde quando a pasta possuir um system prompt com texto nao vazio salvo.
4. Ao clicar no icone, um modal deve ser exibido contendo: mensagem amigavel explicando brevemente o que e o espaco e para que serve, campo de texto para escrever o system prompt, e campo select com as opcoes "Substituir" e "Adicionar".
5. O modal deve pre-preencher o campo de texto e o selector de modo com os valores previamente salvos ao ser reaberto.
6. Ao confirmar o modal com texto no campo, o system prompt e o modo devem ser persistidos na pasta.
7. Ao confirmar o modal com o campo de texto vazio, nenhum system prompt deve ser considerado ativo; a pasta deve se comportar como sem personalizacao.
8. O cancelamento do modal (fechar sem confirmar) nao deve alterar o system prompt nem o modo da pasta.
9. Em modo "Substituir": ao enviar mensagem em conversa de pasta com system prompt, apenas o system prompt da pasta deve ser enviado como prompt de sistema para a API; o prompt padrao nao deve ser incluido.
10. Em modo "Adicionar": ao enviar mensagem em conversa de pasta com system prompt, o payload da API deve conter tanto o prompt padrao quanto o system prompt da pasta.
11. Conversas em pastas sem system prompt definido ou fora de qualquer pasta devem sempre utilizar apenas o prompt padrao.
12. O system prompt e o modo de aplicacao de cada pasta devem persistir entre sessoes do app.
13. O system prompt de uma pasta nao deve influenciar o comportamento de conversas em outras pastas.
14. Ao mover uma conversa para outra pasta, novas mensagens enviadas devem usar o system prompt da pasta destino; ao retirar de uma pasta para a lista solta, novas mensagens devem usar o prompt padrao.
15. Cada pasta mantem seu proprio system prompt independentemente das demais.

---

## Glossario do dominio

- **System Prompt (Prompt de Sistema):** instrucao inicial enviada ao modelo de IA antes das mensagens do usuario; define o comportamento, tom e restricoes da IA para aquela conversa.
- **Prompt padrao:** system prompt global definido pelo sistema Monet; utilizado em todas as conversas quando nenhum system prompt personalizado de pasta estiver configurado.
- **System prompt de pasta:** texto de instrucao definido pelo usuario para uma pasta especifica; aplicado em todas as conversas dentro daquela pasta ao enviar mensagens.
- **Modo "Substituir":** configuracao na qual o system prompt da pasta substitui completamente o prompt padrao; apenas o system prompt da pasta e enviado para a API.
- **Modo "Adicionar":** configuracao na qual o system prompt da pasta e combinado com o prompt padrao; ambos sao enviados para a API.
- **Modal de system prompt:** janela de dialogo aberta ao clicar no icone de system prompt de uma pasta; contem a mensagem explicativa, o campo de texto para o prompt e o campo select de modo.
- **Icone de system prompt:** elemento visual na sidebar associado a cada pasta; indica se aquela pasta possui um system prompt personalizado ativo — verde quando ha prompt definido, estado padrao quando nao ha.
- **Payload da API:** conjunto de dados enviado para o modelo de IA ao processar uma mensagem; inclui o system prompt, historico de mensagens e a nova mensagem do usuario.
- **Lista solta:** conjunto de conversas que nao estao associadas a nenhuma pasta; conversas na lista solta utilizam sempre o prompt padrao.

---

## Decisoes tomadas

| # | Decisao |
|---|---|
| 1 | No modo "Adicionar", a ordem no payload e: prompt padrao primeiro, system prompt da pasta depois |
| 2 | O texto do prompt padrao nunca deve ser exibido ao usuario em nenhuma parte da interface |
| 3 | Sem limite de caracteres para o system prompt da pasta |
| 4 | A opcao pre-selecionada no selector ao abrir pela primeira vez e "Substituir" |
| 5 | O modo e persistido de forma independente do texto; ao limpar o texto e salvar, o modo anteriormente escolhido e mantido e sera exibido na proxima vez que o modal for aberto |

---

## Ambiguidades e decisoes pendentes

Nenhuma pendencia. Todas as ambiguidades foram resolvidas.
