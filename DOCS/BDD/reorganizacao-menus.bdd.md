# BDD - Modo Cadernos e Modo Chat

## Contexto do produto

O Monet possui hoje um único modo de uso: o fluxo de anotações (Cadernos → Anotações → Editor → IA).
Esta feature adiciona um segundo modo, **Chat**, que permite ao usuário conversar livremente com a IA
sem precisar criar ou abrir nenhuma nota.

A Toolbar atual (com busca, export_md, foco, preview, IA) passa a ser um dropdown acessado ao
passar o mouse sobre o botão "Caderno". No topo do app ficam apenas dois botões de modo:

```
[ Caderno ]  [ Chat ]
```

O dropdown com as opções da Toolbar atual só aparece ao passar o mouse sobre "Caderno" **enquanto o
modo ativo for Caderno**. No modo Chat, o dropdown não aparece.

---

## Historias de usuario

### HU-01 - Alternar entre modo Cadernos e modo Chat
Prioridade: Alta

Como usuario do Monet
Quero clicar em "Caderno" ou "Chat" na barra superior
Para alternar entre o fluxo de anotações e uma conversa livre com a IA

### HU-02 - Acessar as ferramentas do Caderno via dropdown
Prioridade: Alta

Como usuario do Monet
Quero passar o mouse sobre o botão "Caderno" para ver as opções atuais (busca, export_md, foco, preview, IA)
Para manter acesso às ferramentas sem poluir a barra principal

### HU-03 - Conversar com a IA sem abrir nenhuma nota
Prioridade: Alta

Como usuario do Monet
Quero ter uma tela de chat dedicada
Para discutir ideias com a IA sem precisar criar ou editar uma nota

---

## Cenarios BDD

```gherkin
Feature: Modo Cadernos e Modo Chat
  Como usuario do Monet
  Quero alternar entre o modo de anotações e o modo de chat
  Para ter acesso a ambas funcionalidades pelo mesmo aplicativo

  Background:
    Given que o aplicativo Monet esta aberto

  # --- BARRA PRINCIPAL ---

  Scenario: Exibir os dois botoes de modo na barra superior
    When a interface for carregada
    Then a barra superior deve exibir apenas dois botoes: "Caderno" e "Chat"
    And o botao do modo ativo deve ter estilo visual diferente do inativo (ex: sublinhado, cor de destaque)
    And a busca, export_md, foco, preview e IA nao devem aparecer diretamente na barra superior

  Scenario: Dropdown de ferramentas aparece ao passar o mouse sobre Caderno (modo Caderno)
    Given que o modo ativo e "Caderno"
    When o usuario passar o mouse sobre o botao "Caderno"
    Then deve aparecer um dropdown abaixo do botao "Caderno"
    And o dropdown deve conter: campo de busca de anotacoes, export_md, foco, preview, IA
    And esses itens devem funcionar exatamente como funcionam hoje

  Scenario: Dropdown nao aparece no modo Chat
    Given que o modo ativo e "Chat"
    When o usuario passar o mouse sobre o botao "Caderno"
    Then nenhum dropdown deve aparecer

  Scenario: Dropdown fecha ao mover o mouse para fora
    Given que o dropdown de ferramentas esta aberto
    When o usuario mover o mouse para fora do dropdown e do botao "Caderno"
    Then o dropdown deve fechar

  # --- ALTERNANCIA DE MODOS ---

  Scenario: Modo Caderno e o padrao ao abrir o app pela primeira vez
    When a interface for carregada pela primeira vez (sem dado salvo em localStorage)
    Then o modo ativo deve ser "Caderno"
    And o workspace deve exibir: NotebookList | Sidebar | Editor | AiPanel

  Scenario: Clicar em Chat substitui o workspace pelo ChatPanel
    Given que o modo ativo e "Caderno"
    When o usuario clicar no botao "Chat"
    Then o modo ativo passa a ser "Chat"
    And o workspace inteiro e substituido pelo ChatPanel
    And NotebookList, Sidebar, Editor e AiPanel nao sao exibidos

  Scenario: Clicar em Caderno restaura o layout de anotacoes
    Given que o modo ativo e "Chat"
    When o usuario clicar no botao "Caderno"
    Then o modo ativo passa a ser "Caderno"
    And o workspace exibe novamente: NotebookList | Sidebar | Editor | AiPanel
    And o estado anterior (caderno selecionado, nota selecionada) e preservado

  Scenario: Clicar no botao do modo ja ativo nao faz nada
    Given que o modo ativo e "Chat"
    When o usuario clicar novamente no botao "Chat"
    Then nada acontece (nenhuma mudanca de estado ou layout)

  Scenario: Persistir o modo ativo entre sessoes
    Given que o usuario encerra o app com o modo "Chat" ativo
    When o usuario reabrir o aplicativo
    Then o modo ativo deve ser "Chat"

  # --- CHAT PANEL ---

  Scenario: Layout do ChatPanel
    Given que o modo ativo e "Chat"
    Then o ChatPanel deve ocupar todo o workspace
    And o ChatPanel deve ter um header com o seletor de modelo de IA (ModelSelector)
    And abaixo do header deve haver a area de historico de mensagens (rolavel)
    And na parte inferior deve haver o campo de texto para digitar mensagens
    And ao lado do campo de texto deve haver um botao "Enviar"

  Scenario: Estado vazio do ChatPanel
    Given que o modo ativo e "Chat"
    And nao ha nenhuma mensagem no historico
    Then o ChatPanel deve exibir uma mensagem amigavel de boas-vindas na area de historico
    And o campo de input deve estar disponivel para digitacao

  Scenario: Aviso de API key ausente
    Given que o modo ativo e "Chat"
    And nao ha API key configurada
    Then o ChatPanel deve exibir um aviso amigavel informando que e necessario configurar a API key
    And o botao "Enviar" deve estar desabilitado

  Scenario: Digitar mensagem e enviar pelo botao
    Given que o modo ativo e "Chat"
    And ha uma API key configurada
    When o usuario digitar um texto no campo de input
    And o usuario clicar no botao "Enviar"
    Then a mensagem do usuario aparece no historico com role "user"
    And o campo de input e limpo
    And a IA processa a mensagem via hook useChat (que chama OpenRouter sem noteId)
    And a resposta da IA aparece no historico em streaming com role "assistant"

  Scenario: Enter dentro do campo de texto pula linha (nao envia)
    Given que o modo ativo e "Chat"
    When o usuario pressionar Enter no campo de input
    Then uma nova linha e inserida no campo de texto
    And a mensagem NAO e enviada

  Scenario: Historico exibe mensagens do usuario e da IA com estilo diferente
    Given que ha mensagens no historico do Chat
    Then mensagens com role "user" devem ter estilo visual A (ex: alinhadas a direita ou cor diferente)
    And mensagens com role "assistant" devem ter estilo visual B
    And o historico deve rolar automaticamente para a mensagem mais recente

  Scenario: Historico do Chat e persistido em localStorage
    Given que o usuario enviou mensagens no Chat
    When o usuario fechar e reabrir o aplicativo
    And navegar para o modo "Chat"
    Then o historico anterior de mensagens deve ser exibido

  # --- COMPATIBILIDADE ---

  Scenario: Modo Caderno nao e afetado pela feature
    Given que o modo ativo e "Caderno"
    Then todas as funcionalidades atuais devem continuar funcionando:
      | Funcionalidade                              |
      | Criar, renomear e deletar cadernos          |
      | Criar, reordenar e deletar anotacoes        |
      | Editar notas no Editor (CodeMirror)         |
      | Usar /comandos no editor para acionar a IA  |
      | AiPanel exibindo respostas dos /comandos    |
      | Redimensionar NotebookList e Sidebar        |
      | Modo foco (Ctrl+Space)                      |
    And as funcionalidades do dropdown (export_md, foco, preview, busca, IA) devem funcionar igual a hoje
```

---

## Criterios de aceitacao

### Barra principal e dropdown
1. A barra superior exibe apenas dois botoes: "Caderno" e "Chat".
2. O botao do modo ativo tem estilo visual diferente do inativo.
3. Ao passar o mouse sobre "Caderno" **no modo Caderno**, aparece um dropdown com: campo de busca, export_md, foco, preview, IA — funcionando igual a hoje.
4. No modo Chat, passar o mouse sobre "Caderno" **nao** exibe dropdown.
5. O dropdown fecha ao mover o mouse para fora da area do botao e do dropdown.

### Alternancia de modos
6. O modo padrao (primeiro acesso, sem localStorage) e "Caderno".
7. Clicar no botao do modo ja ativo nao faz nada.
8. Ao voltar para "Caderno" apos ter estado em "Chat", o estado anterior (caderno ativo, nota ativa) e restaurado.
9. O modo ativo e persistido em `localStorage` com a chave `monet:active-mode`.

### ChatPanel — layout
10. O ChatPanel ocupa todo o workspace quando o modo Chat esta ativo.
11. O ChatPanel tem: header com ModelSelector | area de historico rolavel | input fixo na base com botao Enviar.
12. Estado vazio: exibe mensagem amigavel de boas-vindas.
13. Sem API key: exibe aviso amigavel e desabilita o botao Enviar.

### ChatPanel — envio de mensagens
14. Enter no campo de input insere nova linha (NAO envia).
15. O botao "Enviar" envia a mensagem.
16. Apos enviar, o campo de input e limpo.
17. A resposta da IA e exibida em streaming.
18. O historico rola automaticamente para a mensagem mais recente.

### ChatPanel — persistencia
19. O historico de mensagens e persistido em `localStorage` com a chave `monet:chat-history`.
20. Estrutura do objeto gravado:
```typescript
// localStorage["monet:chat-history"] = JSON.stringify(Message[])

interface Message {
  id: string           // UUID gerado no cliente
  role: "user" | "assistant"
  content: string
  timestamp: string    // ISO 8601 (ex: "2026-05-09T14:30:00.000Z")
}
```

### Integracao com IA
21. O ChatPanel usa um hook novo chamado `useChat` (a ser criado do zero).
22. O `useChat` chama a API do OpenRouter diretamente via `fetch` com streaming (SSE), **sem reutilizar nenhum codigo existente** do projeto (nem `openrouter.ts`, nem `useAi`).
23. O endpoint a chamar e `https://openrouter.ai/api/v1/chat/completions` com `stream: true`.
24. A API key do OpenRouter e lida do mesmo local onde o app ja a armazena (verificar `src/hooks/useAi.ts` ou Settings para descobrir a chave exata do localStorage/storage onde ela e salva).
25. O modelo selecionado no ChatPanel e persistido separadamente em `localStorage` com a chave `monet:chat-model`.

### Compatibilidade
25. Os componentes `NotebookList`, `Sidebar`, `Editor` e `AiPanel` nao sao modificados internamente.
26. O hook `useAi` existente nao e modificado.

---

## Decisoes de design (fechadas)

| Decisao | Escolha |
|---|---|
| Layout da barra superior | Apenas "Caderno" e "Chat" — sem outros botoes |
| Ferramentas do Caderno (busca, export etc.) | Dropdown no hover sobre "Caderno", apenas no modo Caderno |
| Comportamento de alternancia | Substitui o workspace inteiro |
| Chat coexiste com AiPanel? | Nao — em modo Chat, workspace e apenas o ChatPanel |
| Chat usa contexto de notas? | Nao — conversa livre e independente |
| Historico do Chat | Unico historico global, array simples em localStorage |
| Chave localStorage do historico | `monet:chat-history` |
| Chave localStorage do modo ativo | `monet:active-mode` |
| Chave localStorage do modelo do chat | `monet:chat-model` |
| Enter no input | Quebra linha (nao envia) |
| Envio de mensagem | Apenas pelo botao "Enviar" |
| Hook de IA para o Chat | Novo hook `useChat` 100% independente, chama OpenRouter via fetch/SSE diretamente |

---

## Arquivos afetados (estimativa)

| Arquivo | Tipo de mudanca |
|---|---|
| `src/App.tsx` | Adicionar estado `activeMode`, renderizar ChatPanel ou layout atual conforme modo |
| `src/components/Toolbar/Toolbar.tsx` | Substituir conteudo atual por botoes "Caderno" / "Chat" + dropdown |
| `src/components/ChatPanel/ChatPanel.tsx` | **Novo componente** — tela de chat |
| `src/hooks/useChat.ts` | **Novo hook** — envio e streaming de mensagens sem noteId |

---

## Glossario

- **Modo Caderno**: modo padrao do app, exibe NotebookList + Sidebar + Editor + AiPanel.
- **Modo Chat**: novo modo, exibe somente o ChatPanel ocupando todo o workspace.
- **ChatPanel**: novo componente de chat livre com a IA, sem vinculo com notas.
- **useChat**: novo hook 100% independente para o ChatPanel; chama a API OpenRouter via fetch com SSE diretamente, sem depender de nenhum codigo existente do projeto.
- **Dropdown de ferramentas**: box que aparece no hover sobre "Caderno" com as opcoes atuais da Toolbar.
- **AiPanel**: componente atual que exibe respostas de /comandos no editor — nao e modificado.
- **ModelSelector**: componente existente de selecao de modelo — reutilizado no ChatPanel.
- **SSE (Server-Sent Events)**: protocolo de streaming usado pela API do OpenRouter para entregar a resposta da IA palavra por palavra.
