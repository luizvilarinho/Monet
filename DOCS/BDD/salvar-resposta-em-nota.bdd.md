# BDD - Salvar Resposta da IA do Chat em uma Nota

## Contexto do produto

No modo Chat, o usuario conversa livremente com a IA. Atualmente nao existe um caminho
direto para transformar uma resposta dessa conversa em material de estudo permanente
dentro dos cadernos. Esta funcionalidade adiciona, em cada resposta da IA do chat, um
botao "Salvar em nota" que abre um fluxo guiado para escolher o caderno e a nota de
destino (ou criar uma nova), apendar a resposta no fim da nota e oferecer navegacao
imediata para revisar o resultado.

---

## Historias de usuario

### HU-01 - Salvar uma resposta da IA do Chat em uma nota existente
Prioridade: Alta

Como usuario do Monet
Quero salvar uma resposta da IA do Chat dentro de uma nota de um caderno
Para preservar o conteudo gerado como material de estudo no fluxo de anotacoes

### HU-02 - Criar uma nova nota a partir de uma resposta da IA do Chat
Prioridade: Alta

Como usuario do Monet
Quero criar uma nova nota dentro de um caderno ja escolhido a partir do fluxo de salvar
Para nao precisar sair do Chat, ir para o modo Caderno, criar a nota manualmente e voltar

### HU-03 - Encontrar rapidamente o caderno usado por ultimo
Prioridade: Media

Como usuario do Monet
Quero ver o ultimo caderno usado por mim ja no topo do seletor
Para reduzir cliques quando estou salvando varias respostas no mesmo caderno

### HU-04 - Ir direto para a nota recem-atualizada
Prioridade: Media

Como usuario do Monet
Quero ter a opcao de ir direto para a nota que acabei de atualizar
Para conferir o conteudo colado e continuar editando se necessario

### HU-05 - Continuar no Chat apos salvar
Prioridade: Media

Como usuario do Monet
Quero ter a opcao de fechar o aviso de sucesso e permanecer no Chat
Para continuar a conversa com a IA sem trocar de modo

---

## Cenarios BDD

```gherkin
Feature: Salvar Resposta da IA do Chat em uma Nota
  Como usuario do Monet
  Quero salvar uma resposta da IA do Chat em uma nota de um caderno
  Para preservar conteudo da conversa como material de estudo permanente

  # --- Botao "Salvar em nota" no card de resposta ---

  Scenario: Botao "Salvar em nota" aparece em respostas concluidas do Chat
    Given que o usuario esta no modo Chat
    And que a IA terminou de gerar uma resposta na conversa atual
    When o usuario visualizar essa mensagem da IA
    Then a mensagem deve exibir um botao rotulado "Salvar em nota"
    And o botao deve estar visivel sem necessidade de hover

  Scenario: Botao "Salvar em nota" nao aparece durante streaming
    Given que a IA esta gerando uma resposta em tempo real no Chat
    When o usuario visualizar essa mensagem da IA
    Then o botao "Salvar em nota" nao deve estar visivel

  Scenario: Botao "Salvar em nota" nao aparece em respostas com erro
    Given que uma mensagem da IA no Chat falhou (status erro)
    When o usuario visualizar essa mensagem
    Then o botao "Salvar em nota" nao deve estar visivel

  Scenario: Botao "Salvar em nota" nao aparece em respostas interrompidas
    Given que a geracao de uma resposta no Chat foi interrompida pelo usuario
    When o usuario visualizar essa mensagem
    Then o botao "Salvar em nota" nao deve estar visivel

  Scenario: Botao "Salvar em nota" nao aparece em mensagens do proprio usuario
    Given que o usuario enviou uma mensagem na conversa do Chat
    When o usuario visualizar sua propria mensagem
    Then o botao "Salvar em nota" nao deve estar visivel

  # --- Abertura do seletor ---

  Scenario: Abrir o seletor de destino ao clicar em "Salvar em nota"
    Given que o usuario visualiza uma resposta concluida da IA no Chat
    When o usuario clicar no botao "Salvar em nota"
    Then o sistema deve abrir um modal de selecao
    And o modal deve estar na etapa de selecao de caderno
    And o modal nao deve fechar a conversa nem alterar o modo atual

  # --- Etapa 1: Selecao de caderno ---

  Scenario: Listar cadernos no seletor com o ultimo usado no topo
    Given que o usuario abriu o modal de "Salvar em nota"
    And que existem cadernos cadastrados
    And que existe um registro persistido de ultimo caderno usado por esta funcionalidade
    When o usuario visualizar a lista de cadernos
    Then todos os cadernos devem aparecer na lista
    And o ultimo caderno usado deve aparecer no topo, destacado como "Usado por ultimo"
    And os demais cadernos devem aparecer abaixo na ordem em que vierem do banco
    And o caderno "Usado por ultimo" deve estar apenas destacado, sem pre-selecao automatica

  Scenario: Listar cadernos quando ainda nao ha registro de ultimo usado
    Given que o usuario abriu o modal de "Salvar em nota"
    And que existem cadernos cadastrados
    And que esta e a primeira vez que o usuario aciona esta funcionalidade
    When o usuario visualizar a lista de cadernos
    Then todos os cadernos devem aparecer na ordem em que vierem do banco
    And nenhum item deve ser destacado como "Usado por ultimo"

  Scenario: Registro de "ultimo caderno usado" persiste entre sessoes
    Given que o usuario salvou uma resposta em um caderno em uma sessao anterior
    When o usuario reabrir o app e acionar "Salvar em nota" novamente
    Then o caderno usado na sessao anterior deve aparecer destacado no topo da lista
    And o registro deve estar armazenado em localStorage

  Scenario: Selecionar um caderno na primeira etapa
    Given que o usuario visualiza a lista de cadernos no modal
    When o usuario selecionar um caderno
    Then o modal deve avancar para a etapa de selecao de nota
    And o caderno selecionado deve aparecer indicado no topo da etapa de notas

  Scenario: Modal exibe estado vazio quando nao ha cadernos cadastrados
    Given que o usuario nao possui nenhum caderno cadastrado
    When o usuario clicar no botao "Salvar em nota"
    Then o modal deve abrir informando que nao ha cadernos disponiveis
    And o modal deve oferecer uma acao para criar um novo caderno
    And ao criar o novo caderno, o fluxo deve avancar para a etapa de selecao de nota desse caderno

  # --- Etapa 2: Selecao de nota destino ---

  Scenario: Listar notas do caderno selecionado
    Given que o usuario selecionou um caderno na etapa anterior
    And que esse caderno tem ao menos uma nota
    When o modal exibir a etapa de selecao de nota
    Then a lista deve exibir todas as notas desse caderno na ordem em que vierem do banco
    And a lista deve incluir uma opcao "Criar nova nota" em destaque no topo da lista

  Scenario: Caderno sem notas exibe apenas a opcao de criar nova nota
    Given que o caderno selecionado nao tem nenhuma nota
    When o modal exibir a etapa de selecao de nota
    Then a lista deve exibir apenas a opcao "Criar nova nota"
    And o modal deve informar que o caderno ainda nao tem notas

  Scenario: Voltar para a etapa de selecao de caderno
    Given que o usuario esta na etapa de selecao de nota
    When o usuario acionar a opcao de voltar
    Then o modal deve retornar a etapa de selecao de caderno
    And a selecao anterior de caderno deve permanecer marcada

  # --- Confirmacao do salvamento em nota existente ---

  Scenario: Salvar a resposta em uma nota existente (caminho feliz)
    Given que o usuario selecionou um caderno e uma nota existente
    When o usuario confirmar o salvamento
    Then o conteudo da resposta da IA deve ser apendado ao final da nota selecionada dentro de um bloco toggle (details/summary)
    And a nota deve manter todo o conteudo anterior intacto
    And o caderno selecionado deve ser registrado como "ultimo caderno usado" para futuras aberturas do modal
    And o modal deve avancar para a etapa de aviso de sucesso

  Scenario: Conteudo apendado preserva o markdown bruto dentro do toggle
    Given que a resposta da IA contem formatacao markdown (listas, cabecalhos, blocos de codigo)
    When o usuario salvar essa resposta em uma nota existente
    Then o texto adicionado dentro do toggle deve ser o markdown bruto, nao o HTML renderizado
    And a estrutura de formatacao deve ser preservada para renderizacao posterior

  Scenario: Conteudo apendado e separado do conteudo existente
    Given que a nota destino ja possui conteudo
    When o usuario salvar uma resposta nessa nota
    Then o bloco toggle apendado deve ser separado do conteudo existente por uma linha em branco
    And o conteudo existente nao deve ser alterado em nenhuma posicao anterior

  Scenario: Apendar resposta em nota nao vazia nao exibe aviso adicional
    Given que o usuario selecionou uma nota destino que ja contem conteudo
    When o usuario confirmar o salvamento
    Then o sistema deve gravar diretamente sem exibir aviso de "essa nota ja contem texto"
    And o fluxo deve seguir direto para a etapa de aviso de sucesso

  # --- Criacao de nova nota a partir do fluxo ---

  Scenario: Criar nova nota como destino do salvamento
    Given que o usuario selecionou um caderno na primeira etapa
    When o usuario escolher a opcao "Criar nova nota"
    Then o modal deve solicitar um titulo para a nova nota
    And ao confirmar com um titulo valido, a nota deve ser criada dentro do caderno selecionado
    And a resposta da IA deve ser inserida como conteudo inicial dessa nota
    And o caderno selecionado deve ser registrado como "ultimo caderno usado"
    And o modal deve avancar para a etapa de aviso de sucesso

  Scenario: Cancelar a criacao de nova nota
    Given que o usuario esta na tela de informar o titulo da nova nota
    When o usuario cancelar a criacao
    Then nenhuma nota deve ser criada
    And o modal deve retornar para a etapa de selecao de nota

  Scenario: Tentar criar nova nota com titulo em branco
    Given que o usuario esta na tela de informar o titulo da nova nota
    When o usuario tentar confirmar com o campo de titulo vazio
    Then o sistema deve impedir a criacao
    And deve sinalizar que o titulo e obrigatorio

  # --- Etapa 3: Aviso de sucesso ---

  Scenario: Exibir aviso de sucesso apos salvar
    Given que o usuario confirmou o salvamento da resposta
    And que a operacao foi concluida com sucesso
    When o aviso for exibido
    Then o modal deve mostrar a mensagem de que a nota foi salva com sucesso
    And o aviso deve indicar o nome do caderno e o titulo da nota destino
    And o aviso deve exibir os botoes "Ir para nota" e "Fechar"

  Scenario: Clicar em "Ir para nota" navega para a nota recem-atualizada
    Given que o aviso de sucesso esta visivel
    When o usuario clicar em "Ir para nota"
    Then o app deve mudar para o modo Caderno
    And o caderno destino deve estar selecionado
    And a nota destino deve estar selecionada e aberta no editor
    And o editor deve abrir a nota no topo, sem rolagem automatica ate o trecho apendado
    And o modal deve ser fechado

  Scenario: Clicar em "Fechar" mantem o usuario no Chat
    Given que o aviso de sucesso esta visivel
    When o usuario clicar em "Fechar"
    Then o modal deve ser fechado
    And o usuario deve permanecer no modo Chat
    And a conversa atual deve continuar visivel sem alteracao

  # --- Cancelamento e fechamento do modal ---

  Scenario: Fechar o modal antes de confirmar o salvamento
    Given que o usuario abriu o modal de "Salvar em nota"
    And que ainda nao confirmou o salvamento
    When o usuario fechar o modal
    Then nenhuma nota deve ser criada nem alterada
    And o registro de "ultimo caderno usado" nao deve ser atualizado
    And o usuario deve permanecer no modo Chat

  # --- Falhas e erros ---

  Scenario: Falha ao gravar a resposta na nota
    Given que o usuario confirmou o salvamento
    And que a gravacao da nota falhou (erro de armazenamento local)
    When a falha for detectada
    Then o modal deve exibir uma mensagem clara de erro
    And o modal deve oferecer a opcao de tentar novamente
    And nenhum conteudo parcial deve ser deixado na nota destino

  # --- Salvar a mesma resposta mais de uma vez ---

  Scenario: Salvar a mesma resposta em mais de uma nota
    Given que o usuario ja salvou uma resposta em uma nota
    When o usuario clicar novamente em "Salvar em nota" na mesma resposta
    Then o modal deve abrir normalmente
    And o usuario deve poder selecionar outro caderno e nota destino
    And o conteudo deve ser apendado tambem nessa nova nota destino

  Scenario: Salvar a mesma resposta na mesma nota mais de uma vez nao exibe aviso de duplicidade
    Given que o usuario ja salvou uma resposta em uma nota especifica
    When o usuario salvar essa mesma resposta novamente na mesma nota
    Then o sistema deve apendar um novo bloco toggle ao final da nota sem qualquer aviso de duplicidade
    And o gerenciamento de eventuais duplicacoes fica a cargo do usuario
```

---

## Criterios de aceitacao

1. Toda mensagem concluida da IA no modo Chat deve exibir um botao "Salvar em nota" sempre visivel (sem hover).
2. O botao nao deve aparecer em mensagens com status streaming, erro ou interrompido, nem em mensagens do usuario.
3. Ao clicar em "Salvar em nota", o sistema deve abrir um modal de selecao em duas etapas: (1) caderno, (2) nota.
4. Na etapa de selecao de caderno, o ultimo caderno usado por esta funcionalidade deve aparecer no topo, destacado como "Usado por ultimo"; os demais devem aparecer na ordem em que vierem do banco.
5. O caderno "Usado por ultimo" deve ser apenas destacado, nunca pre-selecionado — o usuario sempre clica explicitamente para avancar.
6. Quando nao houver cadernos cadastrados, o modal deve oferecer a criacao de um novo caderno como ponto de entrada do fluxo.
7. Na etapa de selecao de nota, a lista deve mostrar as notas do caderno selecionado na ordem em que vierem do banco, com a opcao "Criar nova nota" em destaque no topo.
8. A opcao "Criar nova nota" deve permitir informar um titulo obrigatorio e criar a nota dentro do caderno selecionado.
9. Em uma nota existente, a resposta da IA deve ser apendada ao final do conteudo existente dentro de um bloco toggle (markdown details/summary), separada do conteudo anterior por uma linha em branco, sem alterar nada do que ja existia.
10. Em uma nota recem-criada via fluxo, a resposta da IA deve ser o conteudo inicial — tambem dentro de um bloco toggle.
11. O conteudo salvo dentro do toggle deve ser o markdown bruto da resposta da IA (nao o HTML renderizado).
12. Apos o salvamento bem-sucedido, o modal deve registrar o caderno destino como "ultimo caderno usado" para a proxima abertura do modal.
13. O registro de "ultimo caderno usado" deve ser persistido em localStorage e sobreviver a reinicios do app.
14. Apos o salvamento, o modal deve exibir aviso de sucesso indicando o caderno e o titulo da nota destino, com os botoes "Ir para nota" e "Fechar".
15. "Ir para nota" deve navegar para o modo Caderno, selecionar o caderno e a nota destino, abrir a nota no topo do editor (sem rolagem automatica ate o trecho apendado) e fechar o modal.
16. "Fechar" deve apenas fechar o modal e manter o usuario no Chat com a conversa atual intacta.
17. Cancelar o modal antes da confirmacao nao deve criar nem alterar nenhuma nota e nao deve atualizar o registro de "ultimo caderno usado".
18. Em caso de falha de gravacao, o modal deve exibir mensagem clara, oferecer a opcao de tentar novamente e nao deixar conteudo parcial na nota destino.
19. O usuario deve poder salvar a mesma resposta em mais de uma nota diferente — e tambem na mesma nota mais de uma vez — sem aviso de duplicidade.
20. Apenas a resposta da IA deve ser salva — a mensagem do usuario que originou aquela resposta nao acompanha o trecho apendado.
21. Nao ha limite de tamanho para a resposta a ser salva.
22. Apendar em nota nao vazia nao exige confirmacao adicional ("essa nota ja contem texto") — o salvamento e direto.
23. Nao ha atalho de teclado para o botao "Salvar em nota".

---

## Glossario do dominio

- **Modo Chat:** modo de interacao do Monet onde o usuario conversa livremente com a IA fora do contexto do editor de notas.
- **Modo Caderno:** modo principal de anotacoes do Monet com o editor de notas, o Painel IA e os /comandos.
- **Caderno:** unidade de organizacao principal do Monet que agrupa notas (e tambem documentos para o RAG).
- **Nota:** documento de texto em markdown pertencente a exatamente um caderno; tem titulo, conteudo e tags.
- **Resposta da IA do Chat:** mensagem do assistente em uma conversa do modo Chat; e a unica origem do botao "Salvar em nota" desta feature.
- **Botao "Salvar em nota":** acao localizada em cada resposta concluida da IA no Chat que inicia o fluxo de salvar a resposta dentro de uma nota.
- **Modal de selecao:** janela em etapas usada para escolher caderno, nota destino, criar nova nota e exibir o aviso de sucesso.
- **Etapa de selecao de caderno:** primeira etapa do modal; lista todos os cadernos do usuario.
- **Etapa de selecao de nota:** segunda etapa do modal; lista as notas do caderno escolhido e tambem a opcao de criar nova nota.
- **"Usado por ultimo":** marcacao aplicada ao caderno que foi destino da ultima execucao bem-sucedida desta funcionalidade; aparece no topo da lista de cadernos (apenas destacado, sem pre-selecao) para reduzir cliques em fluxos repetidos. Persistido em localStorage entre sessoes.
- **"Criar nova nota":** opcao no topo da lista de notas que permite criar uma nota novinha dentro do caderno ja selecionado e usa-la como destino do salvamento.
- **Apendar:** acao de adicionar o conteudo da resposta ao final do conteudo existente da nota dentro de um bloco toggle (details/summary), sem alterar o que ja existia.
- **Bloco toggle:** estrutura markdown `<details><summary>...</summary>...</details>` usada para envolver o conteudo da resposta apendada na nota, permitindo expandir/colapsar o trecho ao visualizar a nota.
- **Markdown bruto:** texto fonte em markdown antes da renderizacao em HTML; e o formato salvo dentro do bloco toggle para preservar a estrutura.
- **Aviso de sucesso:** etapa final do modal que confirma o salvamento e oferece os botoes "Ir para nota" e "Fechar".
- **"Ir para nota":** acao do aviso de sucesso que navega o app para o modo Caderno, seleciona o caderno e a nota destino, abre a nota no topo do editor e fecha o modal.
- **"Fechar":** acao do aviso de sucesso que fecha o modal e mantem o usuario no Chat sem alteracoes na conversa.
- **Status concluido:** estado de uma resposta da IA cuja geracao terminou com sucesso; unico estado em que o botao "Salvar em nota" deve aparecer.
- **Status streaming / erro / interrompido:** estados de uma resposta da IA em que o botao "Salvar em nota" nao deve aparecer.

---

## Decisoes tomadas

| # | Decisao |
|---|---|
| 1 | Botao "Salvar em nota" aparece apenas em respostas concluidas do Chat, sempre visivel (sem hover) |
| 2 | Modal de duas etapas (caderno -> nota) com aviso de sucesso ao final |
| 3 | Caderno "Usado por ultimo" aparece no topo da lista, apenas destacado (sem pre-selecao); demais cadernos na ordem em que vierem do banco |
| 4 | Notas listadas na ordem em que vierem do banco; "Criar nova nota" no topo |
| 5 | Conteudo apendado ao final da nota dentro de um bloco toggle (markdown details/summary), separado do conteudo existente por uma linha em branco |
| 6 | Conteudo salvo dentro do toggle e o markdown bruto da resposta, nao o HTML renderizado |
| 7 | Apos salvar com sucesso, o caderno destino vira o novo "ultimo caderno usado" |
| 8 | "Ir para nota" navega para o modo Caderno e abre a nota no topo do editor (sem rolagem automatica ate o trecho apendado) |
| 9 | "Fechar" mantem o usuario no Chat sem alteracoes na conversa |
| 10 | A mesma resposta pode ser salva em mais de uma nota diferente; o botao continua disponivel apos cada salvamento |
| 11 | Quando nao ha cadernos, o fluxo oferece a criacao de um novo caderno como ponto de entrada |
| 12 | Cancelar antes de confirmar nao altera nenhuma nota nem o registro de "ultimo caderno usado" |
| 13 | Registro de "ultimo caderno usado" persistido em localStorage, sobrevivendo a reinicios do app |
| 14 | Apenas a resposta da IA e salva — a mensagem do usuario que originou aquela resposta nao acompanha o trecho |
| 15 | Sem prevencao de duplicidade — salvar a mesma resposta na mesma nota apenas apenda outro toggle, gerenciamento fica com o usuario |
| 16 | Sem limite de tamanho da resposta a ser salva |
| 17 | Sem aviso adicional ao apendar em nota nao vazia — o salvamento e direto |
| 18 | Sem atalho de teclado para o botao "Salvar em nota" |
| 19 | Operacao 100% local (app desktop), nao se aplica comportamento offline |

---

## Ambiguidades e decisoes pendentes

Nenhuma pendencia. Todas as ambiguidades foram resolvidas.

### Observacao sobre o "ultimo caderno usado"

Como o registro fica persistido em localStorage, o caderno referenciado pode ter sido excluido entre uma sessao e outra. Nesse caso, o comportamento esperado e tratar o registro como invalido e cair no caminho "primeira vez" (lista todos os cadernos na ordem em que vierem do banco, sem destaque de "Usado por ultimo").
