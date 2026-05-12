# BDD - Acoes nas Respostas da IA no Modo Caderno

## Historias de usuario

### HU-01 - Copiar a resposta da IA para a area de transferencia
Prioridade: Alta

Como usuario do Monet
Quero copiar a resposta da IA diretamente do Painel IA no modo Caderno
Para colar o conteudo em outro contexto sem precisar selecionar o texto manualmente

### HU-02 - Continuar a conversa sobre uma resposta da IA no modo Chat
Prioridade: Alta

Como usuario do Monet
Quero abrir uma resposta do Painel IA diretamente no modo Chat
Para fazer perguntas de acompanhamento sobre aquele tema sem perder o contexto inicial

---

## Cenarios BDD

```gherkin
Feature: Acoes nas Respostas da IA no Modo Caderno
  Como usuario do Monet
  Quero acionar acoes diretamente em cada resposta da IA no Painel IA
  Para copiar ou continuar a conversa sem interromper o fluxo de trabalho

  # --- Botao Copiar ---

  Scenario: Botao de copia aparece em respostas concluidas
    Given que um /comando foi executado e a resposta da IA foi concluida
    When o usuario visualizar o card dessa resposta no Painel IA
    Then o card deve exibir um botao de copiar ao final da resposta
    And o botao deve estar visivel sem necessidade de hover

  Scenario: Botao de copia nao aparece durante streaming
    Given que a IA esta gerando uma resposta em tempo real
    When o usuario visualizar o card dessa resposta no Painel IA
    Then o botao de copiar nao deve estar visivel

  Scenario: Copiar resposta da IA para a area de transferencia
    Given que o usuario esta visualizando um card de resposta concluida no Painel IA
    When o usuario clicar no botao de copiar
    Then o conteudo textual da resposta da IA deve ser copiado para a area de transferencia
    And o botao deve exibir confirmacao visual temporaria de que a copia foi realizada
    And apos a confirmacao o botao deve retornar ao estado original

  Scenario: Confirmacao de copia desaparece automaticamente
    Given que o usuario acabou de copiar uma resposta
    When a confirmacao visual for exibida
    Then ela deve desaparecer automaticamente apos alguns segundos sem acao do usuario

  Scenario: Copiar resposta com formatacao markdown
    Given que a resposta da IA contem formatacao markdown (listas, cabecalhos, blocos de codigo)
    When o usuario copiar a resposta
    Then o texto copiado deve ser o markdown bruto, nao o HTML renderizado
    And o usuario deve poder colar o conteudo em qualquer editor de texto

  Scenario: Botoes ficam ocultos quando o card esta colapsado
    Given que o card de uma resposta esta colapsado na interface
    When o usuario visualizar o card colapsado
    Then os botoes de copiar e Chat nao devem estar visiveis
    And ao expandir o card os botoes devem aparecer normalmente

  # --- Botao Chat ---

  Scenario: Botao Chat aparece em respostas concluidas
    Given que um /comando foi executado e a resposta da IA foi concluida
    When o usuario visualizar o card expandido dessa resposta no Painel IA
    Then o card deve exibir um botao rotulado "Chat" ao final da resposta
    And o botao deve estar visivel sem necessidade de hover

  Scenario: Botao Chat nao aparece durante streaming
    Given que a IA esta gerando uma resposta em tempo real
    When o usuario visualizar o card dessa resposta no Painel IA
    Then o botao Chat nao deve estar visivel

  Scenario: Botao Chat desabilitado quando nao ha API key configurada
    Given que o usuario nao tem uma chave de API do OpenRouter configurada
    And que um /comando foi executado e a resposta da IA foi concluida
    When o usuario visualizar o card dessa resposta no Painel IA
    Then o botao Chat deve estar visivel porem desabilitado
    And o botao deve exibir indicacao visual de que esta inativo

  Scenario: Abrir resposta da IA no modo Chat
    Given que o usuario esta visualizando um card de resposta concluida no Painel IA
    And que ha uma API key configurada
    When o usuario clicar no botao Chat
    Then o app deve mudar para o modo Chat
    And uma nova conversa deve ser criada automaticamente
    And a nova conversa deve estar pre-carregada com o /comando completo como mensagem do usuario
    And a nova conversa deve estar pre-carregada com a resposta da IA como mensagem do assistente
    And a nova conversa deve estar ativa e visivel na sidebar do Chat
    And o campo de entrada do Chat deve estar em foco para o usuario digitar a proxima pergunta

  Scenario: Conversa aberta pelo botao Chat usa o /comando completo como titulo
    Given que o usuario clicou no botao Chat de uma resposta de /resumir
    When a nova conversa for criada no modo Chat
    Then o titulo da conversa deve ser o /comando completo executado (ex: "/resumir")

  Scenario: Multiplos cliques em Chat de cards diferentes criam conversas separadas
    Given que o usuario tem dois cards de resposta no Painel IA
    When o usuario clicar em Chat no primeiro card
    And retornar ao modo Caderno
    And clicar em Chat no segundo card
    Then duas conversas distintas devem existir no modo Chat
    And cada conversa deve conter o contexto do card que a originou

  Scenario: Botao Chat em resposta com query (ex: /pesquisa Rust)
    Given que o card exibe a resposta de um /comando com argumento (ex: /pesquisa Rust)
    When o usuario clicar no botao Chat
    Then a mensagem do usuario na nova conversa deve incluir o comando completo com o argumento
    And a resposta pre-carregada deve ser a resposta da IA para aquele comando

  Scenario: Botao Chat preserva o historico de conversas existentes
    Given que o usuario tem conversas existentes no modo Chat
    When o usuario clicar no botao Chat em um card do Painel IA
    Then as conversas existentes devem permanecer intactas na sidebar
    And apenas uma nova conversa deve ser adicionada

  # --- Posicionamento dos botoes ---

  Scenario: Botoes aparecem ao final de cada card de resposta
    Given que o Painel IA tem multiplos cards de resposta concluida
    When o usuario visualizar os cards
    Then cada card deve exibir seus proprios botoes de copiar e Chat
    And os botoes de um card nao devem interferir nos botoes de outro card

  Scenario: Botoes nao aparecem em respostas com erro
    Given que um /comando resultou em erro (status error)
    When o usuario visualizar o card dessa resposta no Painel IA
    Then os botoes de copiar e Chat nao devem aparecer nesse card

  Scenario: Botoes nao aparecem em respostas interrompidas
    Given que a geracao de uma resposta foi interrompida pelo usuario (status interrupted)
    When o usuario visualizar o card dessa resposta no Painel IA
    Then os botoes de copiar e Chat nao devem aparecer nesse card
```

---

## Criterios de aceitacao

1. O card de resposta concluida e expandida no Painel IA deve exibir dois botoes ao final: copiar e Chat; ambos sempre visiveis (sem hover).
2. Os botoes nao devem aparecer em cards com status streaming, error ou interrupted.
3. Os botoes devem ficar ocultos quando o card estiver colapsado; ao expandir devem aparecer normalmente.
4. Ao clicar em copiar, o conteudo textual da resposta (markdown bruto) deve ser copiado para a area de transferencia.
5. O botao de copiar deve exibir confirmacao visual temporaria e retornar ao estado original automaticamente.
6. O texto copiado deve ser o markdown bruto, nao o HTML renderizado.
7. O botao Chat deve estar visivel porem desabilitado quando o usuario nao tiver API key configurada.
8. Ao clicar em Chat (com API key presente), o app deve navegar automaticamente para o modo Chat.
9. Uma nova conversa deve ser criada pre-carregada com: (a) o /comando completo como mensagem do usuario e (b) a resposta da IA como mensagem do assistente.
10. O titulo da nova conversa deve ser o /comando completo (ex: "/resumir", "/pesquisa Rust").
11. A conversa pre-carregada deve usar o mesmo system prompt do modo Chat livre.
12. A nova conversa deve se tornar a conversa ativa e o campo de entrada deve estar em foco.
13. Cada clique em Chat em cards diferentes deve criar conversas distintas.
14. As conversas existentes no Chat nao devem ser afetadas ao criar uma conversa pelo botao Chat.
15. Cada card deve ter seus proprios botoes, independentes dos demais cards.

---

## Glossario do dominio

- **Painel IA:** coluna da interface no modo Caderno onde sao exibidas as respostas geradas pelos /comandos; cada resposta ocupa um card.
- **Card de resposta:** unidade visual no Painel IA que exibe o /comando executado, seu status e a resposta da IA; pode estar expandido ou colapsado.
- **Status concluido:** estado de um card cuja geracao da resposta terminou com sucesso; e o unico estado em que os botoes de acao devem aparecer (quando o card estiver expandido).
- **Status streaming:** estado de um card enquanto a resposta esta sendo gerada em tempo real; botoes de acao ficam ocultos nesse estado.
- **Status erro:** estado de um card cuja geracao de resposta falhou; botoes de acao ficam ocultos nesse estado.
- **Status interrompido:** estado de um card cuja geracao foi cancelada pelo usuario antes de terminar; botoes de acao ficam ocultos nesse estado.
- **Botao copiar:** acao que copia o conteudo textual (markdown bruto) da resposta da IA para a area de transferencia do sistema operacional.
- **Confirmacao visual:** feedback temporario no botao de copiar (ex: icone de check ou texto "Copiado!") que confirma que a copia foi realizada com sucesso.
- **Botao Chat:** acao que abre o modo Chat com uma nova conversa pre-carregada com o contexto do card (comando + resposta).
- **Conversa pre-carregada:** conversa criada automaticamente no modo Chat com mensagens iniciais derivadas do card de origem; o usuario pode continuar a conversa a partir dessas mensagens.
- **Markdown bruto:** texto de origem antes da renderizacao HTML; e o formato copiado pelo botao copiar para preservar a estrutura em editores compatíveis com markdown.
- **Modo Chat:** modo de interacao do Monet onde o usuario conversa livremente com a IA; acessivel pela barra de navegacao principal.
- **Modo Caderno:** modo principal de anotacoes do Monet com o editor de notas, o Painel IA e os /comandos.
- **/comando:** instrucao digitada no editor (ex: /resumir, /pesquisa Rust) que aciona a IA e gera uma resposta no Painel IA; a linha inteira do comando (nome + argumentos) e usada como mensagem do usuario na conversa pre-carregada.

---

## Decisoes tomadas

| # | Decisao |
|---|---|
| 1 | Botoes sempre visiveis no card expandido, sem necessidade de hover |
| 2 | Titulo da conversa pre-carregada = /comando completo (ex: "/resumir", "/pesquisa Rust") |
| 3 | Botao Chat fica desabilitado (visivel porem inativo) quando nao ha API key configurada |
| 4 | Conversa pre-carregada usa o mesmo system prompt do modo Chat livre |
| 5 | Botoes ficam ocultos quando o card esta colapsado; aparecem ao expandir |
| 7 | Botoes nao aparecem em respostas com status interrompido |

---

## Ambiguidades e decisoes pendentes

1. **Navegacao de volta ao Caderno:** nao esta definido se o app deve oferecer um caminho rapido de voltar ao Caderno de origem apos navegar para o Chat via botao Chat.
