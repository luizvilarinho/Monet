# Corretor Ortográfico

## Prioridade: Alta

---

## História de Usuário

**Como** usuário que anota durante aulas e leituras
**Quero** que palavras escritas com erros ortográficos sejam sinalizadas e corrigíveis
**Para** manter minhas anotações com qualidade profissional sem interromper o fluxo de escrita

---

## Cenários BDD

### Funcionalidade Principal

```gherkin
Feature: Corretor ortográfico em tempo real
  Como usuário do Monet
  Quero que erros ortográficos sejam identificados e corrigíveis
  Para produzir anotações sem erros

  Scenario: Palavra errada é sublinhada em vermelho
    Given que o usuário está digitando no editor
    When o usuário digita uma palavra com erro ortográfico (ex: "exenplo")
    Then a palavra errada deve ser sublinhada com um traço vermelho ondulado

  Scenario: Menu de contexto exibe sugestões de correção
    Given que uma palavra está sublinhada como errada
    When o usuário clica com o botão direito na palavra
    Then deve aparecer um menu de contexto com sugestões de correção
    And as sugestões devem estar ordenadas por relevância

  Scenario: Usuário seleciona sugestão de correção
    Given que o menu de contexto com sugestões está aberto
    When o usuário clica em uma sugestão
    Then a palavra errada deve ser substituída pela sugestão selecionada
    And o sublinhado vermelho deve desaparecer

  Scenario: Usuário ignora a sugestão
    Given que o menu de contexto com sugestões está aberto
    When o usuário clica fora do menu
    Then o menu de contexto deve fechar
    And a palavra deve permanecer inalterada
    And o sublinhado vermelho deve continuar visível
```

### Edge Cases

```gherkin
Feature: Comportamento em casos especiais

  Scenario: Palavra em linguagem técnica ou estrangeira não é marcada
    Given que o usuário digita uma palavra em inglês (ex: "framework")
    When o dicionário está configurado para PT-BR
    Then a palavra NÃO deve ser sublinhada como errada

  Scenario: Palavra corrigida manualmente remove o sublinhado
    Given que uma palavra está sublinhada como errada
    When o usuário corrige manualmente a palavra (ex: de "exenplo" para "exemplo")
    Then o sublinhado vermelho deve desaparecer imediatamente

  Scenario: Múltiplas palavras erradas na mesma linha
    Given que o usuário digitou uma linha com várias palavras erradas
    When o cursor está em qualquer posição da linha
    Then TODAS as palavras erradas devem estar sublinhadas

  Scenario: Palavra em negrito ou itálico com erro
    Given que o usuário digitou "**exenplo**"
    When a palavra está dentro de formatação markdown
    Then a palavra errada deve ser sublinhada independentemente da formatação

  Scenario: Palavra em código não é verificada
    Given que o usuário digitou um bloco de código com "exenplo"
    When a palavra está dentro de um code block (``` ```) ou inline code (` `)
    Then a palavra NÃO deve ser sublinhada como errada

  Scenario: URL e emails não são verificados
    Given que o usuário digitou "https://exenplo.com" ou "usuario@exenplo.com"
    When o texto é uma URL ou email
    Then o texto NÃO deve ser sublinhado como errado
```

---

## Critérios de Aceitação

### [MUST] - Obrigatórios
- [ ] Palavras com erros ortográficos em PT-BR são sublinhadas em vermelho ondulado
- [ ] Menu de contexto aparece ao clicar com botão direito em palavra sublinhada
- [ ] Menu exibe pelo menos 3 sugestões de correção ordenadas por relevância
- [ ] Selecionar sugestão substitui a palavra errada pela correta
- [ ] Sublinhado desaparece após correção
- [ ] Funciona em tempo real (sem precisar salvar ou recarregar)

### [SHOULD] - Desejáveis
- [ ] Dicionário PT-BR incluído por padrão
- [ ] Suportar ignorar palavra (adicionar ao dicionário pessoal)
- [ ] Desabilitar/ativar corretor via configuração
- [ ] Sublinhado não interfere na visualização do markdown preview

### [COULD] - Opcionais
- [ ] Sugestões baseadas em contexto (não apenas dicionário)
- [ ] Atalho de teclado para aceitar primeira sugestão
- [ ] Suporte a outros idiomas (EN, ES)

---

## Glossário

| Termo | Definição |
|-------|-----------|
| **Sublinhado ondulado vermelho** | Indicador visual padrão para erros ortográficos, traço contínuo ondulado abaixo da palavra |
| **Menu de contexto** | Menu que aparece ao clicar com botão direito, também chamado de context menu ou right-click menu |
| **Sugestões de correção** | Lista de palavras corretas sugeridas pelo sistema para substituir a palavra errada |
| **PT-BR** | Português do Brasil, idioma principal do dicionário de verificação |
| **Code block** | Bloco de código delimitado por ``` no markdown |
| **Inline code** | Código em linha delimitado por ` no markdown |

---

## Decisões de Projeto

| ID | Questão | Decisão | Impacto |
|----|---------|---------|--------|
| A1 | Qual library de spell check será usada? | **typo-js** - Leve (~200KB), dicionário PT-BR disponível, fácil integração com CodeMirror 6 | Performance e tamanho do bundle |
| A2 | O corretor deve funcionar offline? | **Não** - Pode usar solução baseada em browser/navegador | Requer dicionário embarcado vs API externa |
| A3 | Como lidar com palavras compostas com hífen? | **Ambas as partes devem ser marcadas em vermelho** se estiverem erradas | Qualidade das sugestões |
| A4 | O menu de contexto deve substituir ou complementar o menu nativo do CodeMirror? | **Complementar** | UX - consistência |
