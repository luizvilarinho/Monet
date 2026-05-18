# BDD - Migração para Inglês

## Historias de usuario

### HU-01 - Interface em inglês
Prioridade: Alta

Como usuario do Monet
Quero que toda a interface do app esteja em inglês
Para que o app seja acessível a um público global

### HU-02 - Comandos renomeados para inglês
Prioridade: Alta

Como usuario do Monet
Quero acionar comandos de IA com nomes em inglês
Para que a experiência de escrita seja consistente com o idioma do app

### HU-03 - Respostas da IA no idioma do usuário
Prioridade: Alta

Como usuario do Monet
Quero que a IA responda no idioma configurado no meu sistema operacional
Para receber respostas no idioma em que me comunico melhor

### HU-04 - Datas e formatos regionais conforme o sistema
Prioridade: Media

Como usuario do Monet
Quero que datas e formatos regionais sigam o locale do meu sistema operacional
Para que as informações sejam exibidas no formato que já conheço

### HU-05 - Mensagens de erro em inglês
Prioridade: Media

Como usuario do Monet
Quero que as mensagens de erro do backend também estejam em inglês
Para ter uma experiência consistente em todo o app

---

## Cenarios BDD

```gherkin
Feature: Migração completa da interface para inglês
  Como usuario do Monet
  Quero que toda a interface, comandos e mensagens estejam em inglês
  Para que o app seja acessível a qualquer usuário independentemente do idioma nativo

  # --- UI Labels e Botões ---

  Scenario: Exibir labels da interface em inglês
    Given que o usuario abre o app pela primeira vez
    When qualquer tela ou painel for exibido
    Then todos os labels, títulos, botões e textos de interface devem estar em inglês
    And nenhuma string em português deve estar visível na interface

  Scenario: Exibir mensagens de status em inglês
    Given que o usuario realizou uma ação que gera feedback de status
    When o sistema exibir uma mensagem de status (ex: salvando, carregando, erro)
    Then a mensagem deve estar em inglês

  Scenario: Exibir placeholders e tooltips em inglês
    Given que o usuario interage com campos de entrada ou elementos com tooltip
    When o placeholder ou tooltip for exibido
    Then o texto deve estar em inglês

  # --- Comandos renomeados ---

  Scenario: Reconhecer comandos em inglês no editor
    Given que o usuario está editando uma nota no editor
    When ele iniciar uma linha com /
    Then o sistema deve exibir autocomplete com os comandos em inglês
    And a lista deve conter /search, /profile, /define, /summarize, /opinion, /table, /expand, /explain, /guide, /mindmap e /ask

  Scenario: Executar comando /search
    Given que o usuario digitou /search seguido de um termo
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitação para a IA usando o comando /search
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /profile
    Given que o usuario digitou /profile seguido de um nome
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitação para a IA usando o comando /profile
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /define
    Given que o usuario digitou /define seguido de um termo
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitação para a IA usando o comando /define
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /summarize
    Given que o usuario digitou /summarize em uma nota com conteúdo
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitação para a IA usando o comando /summarize
    And a solicitação deve usar o contexto da nota atual
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /opinion
    Given que o usuario digitou /opinion seguido de um tema
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitação para a IA usando o comando /opinion
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /table
    Given que o usuario digitou /table seguido de um tema
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitação para a IA usando o comando /table
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /expand
    Given que o usuario digitou /expand em uma nota com conteúdo
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitação para a IA usando o comando /expand
    And a solicitação deve usar o contexto da nota atual
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /explain
    Given que o usuario digitou /explain seguido de um conceito
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitação para a IA usando o comando /explain
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /guide
    Given que o usuario digitou /guide seguido de um tópico
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitação para a IA usando o comando /guide
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /mindmap
    Given que o usuario digitou /mindmap em uma nota com conteúdo
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitação para a IA usando o comando /mindmap
    And a solicitação deve usar o contexto da nota atual
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Executar comando /ask
    Given que o usuario digitou /ask seguido de uma pergunta livre
    When ele pressionar Enter
    Then o sistema deve iniciar uma solicitação para a IA usando o comando /ask
    And a resposta deve ser exibida no painel IA da nota atual

  Scenario: Rejeitar comandos antigos em português
    Given que o usuario digita um comando em português (ex: /pesquisa, /resumir)
    When ele pressionar Enter
    Then o sistema não deve reconhecer como comando válido
    And a linha deve ser marcada visualmente como comando inválido

  # --- System prompts e idioma da IA ---

  Scenario: IA responde no idioma do sistema operacional do usuário
    Given que o usuario executou qualquer comando de IA
    And que o sistema detectou o idioma do sistema operacional via navigator.language
    When a IA retornar a resposta
    Then a resposta deve estar escrita no idioma detectado do sistema operacional do usuário

  Scenario: IA responde em inglês quando o idioma do sistema não é detectado
    Given que o usuario executou qualquer comando de IA
    And que o sistema não conseguiu detectar o idioma do sistema operacional
    When a IA retornar a resposta
    Then a resposta deve estar escrita em inglês

  # --- Formatação de datas e locale ---

  Scenario: Exibir datas no formato do sistema operacional do usuário
    Given que o app precisa exibir uma data (ex: data de criação de uma nota)
    When a data for renderizada na interface
    Then o formato deve seguir o locale do sistema operacional do usuario
    And nenhuma data deve estar hardcoded no formato pt-BR

  # --- Conteúdo gerado automaticamente pelo sistema ---

  Scenario: Exibir título padrão de nova nota em inglês
    Given que o usuario cria uma nova nota sem inserir título
    When o sistema atribuir um título padrão à nota
    Then o título padrão deve estar em inglês (ex: "New note")
    And nenhum título gerado automaticamente deve estar em português

  # --- Mensagens de erro do backend ---

  Scenario: Exibir erros de backend em inglês
    Given que ocorreu um erro interno durante uma operação
    When o sistema exibir a mensagem de erro ao usuario
    Then a mensagem deve estar em inglês
    And nenhuma string de erro em português deve ser visível ao usuario

  # --- Preferência de idioma ---

  Scenario: Salvar idioma detectado no localStorage na primeira abertura
    Given que o usuario abre o app pela primeira vez
    When o app inicializar e detectar o idioma via navigator.language
    Then o sistema deve salvar o idioma detectado no localStorage
    And o valor salvo deve ser acessível para uso futuro sem nova detecção

  Scenario: Usar idioma salvo no localStorage nas aberturas seguintes
    Given que o usuario já abriu o app anteriormente
    And que existe um idioma salvo no localStorage
    When o app inicializar novamente
    Then o sistema deve usar o idioma do localStorage em vez de reler navigator.language
```

---

## Criterios de aceitacao

1. Toda string visível na interface (labels, botões, títulos, placeholders, tooltips, mensagens de status) deve estar em inglês após a migração.
2. Nenhuma string em português deve permanecer acessível ao usuário na interface.
3. O autocomplete de comandos deve listar exclusivamente os comandos em inglês: /search, /profile, /define, /summarize, /opinion, /table, /expand, /explain, /guide, /mindmap e /ask.
4. Comandos antigos em português não devem ser reconhecidos como válidos.
5. A IA deve responder no idioma detectado via `navigator.language` do sistema operacional do usuário.
6. Quando o idioma do sistema não puder ser detectado, a IA deve responder em inglês.
7. Datas exibidas na interface devem usar o locale do sistema operacional do usuário (sem hardcode de pt-BR).
8. Todas as mensagens de erro geradas pelo backend (Rust) devem estar em inglês.
9. Títulos e textos gerados automaticamente pelo sistema (ex: título padrão de nova nota) devem estar em inglês.
10. O idioma detectado via `navigator.language` deve ser salvo no localStorage na primeira abertura do app.
11. Nas aberturas subsequentes, o app deve usar o idioma salvo no localStorage sem reler `navigator.language`.

---

## Glossario do dominio

- Monet: aplicação desktop de notas com IA para apoio ao aprendizado ativo.
- Migração de idioma: substituição direta de todas as strings em português por equivalentes em inglês no código-fonte, sem uso de framework de i18n.
- i18n: abreviação de internacionalização; estrutura de software para suportar múltiplos idiomas via arquivos de tradução. Fora do escopo desta entrega.
- navigator.language: API do browser/WebView que retorna o idioma configurado no sistema operacional do usuário (ex: "pt-BR", "en-US").
- Locale do sistema: idioma e região configurados no sistema operacional do usuário, usados para formatar datas, números e textos regionais.
- System prompt: instrução enviada à IA antes da pergunta do usuário, que define o comportamento e o idioma das respostas.
- Comando válido: comando reconhecido entre as opções suportadas pelo sistema em inglês.
- Comando inválido: texto iniciado por `/` que não corresponde a nenhum comando suportado (inclui comandos antigos em português).
- /search: substituto em inglês do /pesquisa — busca sobre um termo.
- /profile: substituto em inglês do /quem — perfil profissional de uma pessoa.
- /define: substituto em inglês do /definir — definição técnica concisa.
- /summarize: substituto em inglês do /resumir — resumo do conteúdo da nota atual.
- /opinion: substituto em inglês do /opiniao — resposta opinativa sobre um tema.
- /table: substituto em inglês do /tabela — resposta formatada como tabela markdown.
- /expand: substituto em inglês do /aprofundar — informações novas além do que está na nota.
- /explain: substituto em inglês do /explicar — explicação usando a técnica Feynman.
- /guide: substituto em inglês do /guia — roteiro de estudos com tópicos e sequência lógica.
- /mindmap: substituto em inglês do /mapa-mental — mapa mental hierárquico em markdown.
- /ask: substituto em inglês do /perguntar — pergunta livre ao modelo de IA.
- Backend Rust: camada de servidor local do app escrita em Rust via Tauri, responsável por operações de arquivo e banco de dados.
- Conteúdo gerado automaticamente: strings criadas pelo sistema sem input direto do usuário, como títulos padrão de notas; devem seguir o mesmo padrão de idioma da interface.
- localStorage: armazenamento chave-valor disponível na WebView do Tauri, usado para persistir a preferência de idioma detectada entre sessões.

---

## Ambiguidades e decisoes pendentes

1. ~~**Idioma da IA vs idioma da interface:** A interface será em inglês, mas a IA responderá no idioma do sistema do usuário.~~ **Decidido:** comportamento intencional. UI em inglês; IA responde no idioma do sistema do usuário.

2. ~~**Nomes dos comandos:** Confirmar se todos os nomes estão aprovados antes da implementação.~~ **Decidido:** lista aprovada — /search, /profile, /define, /summarize, /opinion, /table, /expand, /explain, /guide, /mindmap, /ask.

3. ~~**Textos de conteúdo gerado:** Títulos gerados automaticamente devem ser traduzidos?~~ **Decidido:** sim, traduzir para inglês (ex: "Nova nota" → "New note").

4. ~~**Salvar preferência de idioma:** Dentro do escopo desta entrega?~~ **Decidido:** sim, salvar no localStorage (não no SQLite).
