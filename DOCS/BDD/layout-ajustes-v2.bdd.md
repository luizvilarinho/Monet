# BDD — Ajustes de Layout v2

## Contexto do produto
O Monet possui um layout de 4 colunas (Cadernos | Anotações | Editor | Painel IA).
Este documento especifica os comportamentos esperados para melhorias de usabilidade
no layout: rolagem independente por coluna, header fixo, exportação de notas,
redimensionamento da coluna de Anotações e atalhos de teclado para modos de visualização.

---

## Glossário

| Termo | Definição |
|---|---|
| **Header / Toolbar** | Barra superior do app onde ficam os botões: exportar `.md`, preview e IA |
| **Coluna** | Cada uma das 4 seções verticais do layout: Cadernos, Anotações, Editor, Painel IA |
| **Modo Preview** | Modo que exibe o conteúdo da nota renderizado em Markdown, sem cursor de edição |
| **Modo Foco** | Modo de tela cheia que oculta as colunas laterais e maximiza a área de edição |
| **Drag handle** | Alça visual na borda de uma coluna que permite arrastar para redimensionar sua largura |
| **Scroll independente** | Cada coluna possui sua própria barra de rolagem, sem afetar as demais |
| **Exportar** | Ação de salvar o conteúdo da nota atual como arquivo `.md` no sistema de arquivos |
| **Atalho de teclado** | Combinação de teclas que aciona uma ação sem uso do mouse |

---

## Feature 1 — Rolagem independente por coluna

### Cenário 1 — Coluna com conteúdo que excede a altura da tela

**Dado** que o usuário possui muitos cadernos cadastrados  
**E** a lista de cadernos ultrapassa a altura visível da coluna Cadernos  
**Quando** o usuário rola o mouse sobre a coluna Cadernos  
**Então** apenas a coluna Cadernos rola verticalmente  
**E** as demais colunas permanecem na posição atual  

---

### Cenário 2 — Rolagem da coluna Anotações não afeta o Editor

**Dado** que a nota selecionada possui muitas anotações na coluna Anotações  
**E** o editor está posicionado em determinado ponto do texto  
**Quando** o usuário rola a coluna Anotações  
**Então** a posição de rolagem do Editor não é alterada  
**E** a posição de rolagem da coluna Cadernos não é alterada  

---

### Cenário 3 — Rolagem do Editor não afeta as colunas laterais

**Dado** que o usuário está editando uma nota longa  
**Quando** o usuário rola dentro do Editor  
**Então** apenas o conteúdo do Editor se move  
**E** as colunas Cadernos, Anotações e Painel IA permanecem estáticas  

---

### Cenário 4 — Barra de rolagem visível apenas quando necessário

**Dado** que o conteúdo de uma coluna cabe inteiramente na altura da tela  
**Então** nenhuma barra de rolagem é exibida nessa coluna  
**Quando** o conteúdo cresce e ultrapassa a altura disponível  
**Então** uma barra de rolagem aparece apenas nessa coluna  

---

## Feature 2 — Header sempre visível

### Cenário 1 — Header fixo durante a rolagem do Editor

**Dado** que o usuário está editando uma nota longa  
**Quando** o usuário rola para baixo dentro do Editor  
**Então** o header com os botões (exportar, preview, IA) permanece visível no topo  
**E** nenhum botão do header fica oculto ou fora da área visível  

---

### Cenário 2 — Header fixo durante a rolagem das colunas laterais

**Dado** que o usuário está rolando a coluna Cadernos ou Anotações  
**Então** o header permanece fixo no topo durante toda a rolagem  

---

### Cenário 3 — Header fixo independente do modo ativo

**Dado** que o usuário está no modo de edição padrão  
**Então** o header é sempre visível  
**Dado** que o usuário está no modo Preview  
**Então** o header é sempre visível  
**Dado** que o usuário está no modo Foco  
**Então** o header é sempre visível  

---

## Feature 3 — Exportar nota como `.md`

### Cenário 1 — Exportar nota com conteúdo (caminho feliz)

**Dado** que o usuário tem uma nota aberta no Editor com conteúdo  
**Quando** o usuário clica no botão `export .md` no header  
**Então** o sistema abre a caixa de diálogo nativa de "Salvar arquivo" do sistema operacional  
**E** o nome do arquivo sugerido é o título da nota com extensão `.md`  
**E** o usuário escolhe o destino e confirma  
**Então** o arquivo `.md` é salvo com o conteúdo renderizado em Markdown (equivalente ao Modo Preview)  
**E** linhas de slash commands (`/resumir`, `/pesquisa`, etc.) são omitidas do arquivo exportado  
**E** uma mensagem de confirmação é exibida brevemente na interface  

---

### Cenário 2 — Exportar com nota sem título

**Dado** que a nota aberta não possui título definido  
**Quando** o usuário clica em `export .md`  
**Então** o nome de arquivo sugerido na caixa de diálogo é `nota-sem-titulo.md`  

---

### Cenário 3 — Cancelar exportação

**Dado** que o usuário clicou em `export .md`  
**E** a caixa de diálogo de salvar está aberta  
**Quando** o usuário cancela ou fecha a caixa de diálogo  
**Então** nenhum arquivo é criado  
**E** a nota no Editor não é alterada  

---

### Cenário 4 — Exportar nota vazia

**Dado** que a nota aberta não possui conteúdo (campo de edição vazio)  
**Quando** o usuário clica em `export .md`  
**Então** o sistema ainda abre a caixa de diálogo de salvar  
**E** ao confirmar, salva um arquivo `.md` vazio  

---

### Cenário 5 — Nenhuma nota selecionada

**Dado** que nenhuma nota está aberta no Editor  
**Então** o botão `export .md` está desabilitado ou não responde ao clique  

---

## Feature 4 — Coluna de Anotações com largura ajustável via drag

### Cenário 1 — Redimensionar a coluna Anotações arrastando a borda direita

**Dado** que o usuário posiciona o cursor sobre a borda direita da coluna Anotações  
**Então** o cursor muda para o ícone de redimensionamento horizontal (resize cursor)  
**Quando** o usuário clica e arrasta a borda para a direita  
**Então** a coluna Anotações aumenta sua largura proporcionalmente ao arrasto  
**E** a coluna Editor diminui para compensar, mantendo o layout total  
**Quando** o usuário arrasta para a esquerda  
**Então** a coluna Anotações diminui sua largura  
**E** a coluna Editor aumenta para compensar  

---

### Cenário 2 — Respeitar largura mínima da coluna Anotações

**Dado** que o usuário está arrastando a borda da coluna Anotações para a esquerda  
**Quando** a largura da coluna atinge o valor mínimo definido (ex: 160px)  
**Então** o arrasto não reduz mais a coluna Anotações  
**E** o drag handle para de responder ao movimento para a esquerda  

---

### Cenário 3 — Respeitar largura máxima da coluna Anotações

**Dado** que o usuário está arrastando a borda da coluna Anotações para a direita  
**Quando** a coluna Editor atingir sua largura mínima (ex: 300px)  
**Então** o arrasto não aumenta mais a coluna Anotações  

---

### Cenário 4 — Comportamento consistente com as demais colunas redimensionáveis

**Dado** que as colunas Cadernos e Painel IA já possuem drag handles funcionando  
**Então** o drag handle da coluna Anotações deve se comportar da mesma forma visual  
**E** usar o mesmo padrão de interação (cursor, highlight de borda, snap)  

---

## Feature 4b — Persistência de largura de todas as colunas redimensionáveis

### Cenário 1 — Salvar largura da coluna Anotações no localStorage

**Dado** que o usuário redimensionou a coluna Anotações via drag  
**Quando** o usuário solta o drag handle  
**Então** a nova largura da coluna Anotações é salva no localStorage  

---

### Cenário 2 — Salvar largura da coluna Cadernos no localStorage

**Dado** que o usuário redimensionou a coluna Cadernos via drag  
**Quando** o usuário solta o drag handle  
**Então** a nova largura da coluna Cadernos é salva no localStorage  

---

### Cenário 3 — Salvar largura do Painel IA no localStorage

**Dado** que o usuário redimensionou o Painel IA via drag  
**Quando** o usuário solta o drag handle  
**Então** a nova largura do Painel IA é salva no localStorage  

---

### Cenário 4 — Restaurar larguras salvas ao reabrir o app

**Dado** que o usuário havia redimensionado uma ou mais colunas em uma sessão anterior  
**Quando** o usuário reabre o app  
**Então** cada coluna é renderizada com a largura salva no localStorage  
**E** nenhuma coluna volta à largura padrão  

---

### Cenário 5 — Fallback para largura padrão quando não há valor salvo

**Dado** que o usuário nunca redimensionou as colunas (primeira execução ou localStorage limpo)  
**Quando** o app é aberto  
**Então** as colunas são renderizadas com as larguras padrão definidas no layout (Cadernos: 180px, Anotações: 200px, Painel IA: 300px)  

---

## Feature 5 — Atalhos de teclado para Modo Foco e Modo Preview

### Cenário 1 — Ativar Modo Foco com Ctrl+Space

**Dado** que o usuário está na tela principal do app  
**Quando** o usuário pressiona `Ctrl+Space`  
**Então** o Modo Foco é ativado  
**E** as colunas Cadernos e Anotações são ocultadas  
**E** o Editor e o Painel IA ocupam toda a largura disponível  
**E** o Painel IA permanece visível ao lado do Editor (não é ocultado)  
**E** o header permanece visível com o botão de Foco no estado ativo  

---

### Cenário 2 — Desativar Modo Foco com Ctrl+Space

**Dado** que o Modo Foco está ativo  
**Quando** o usuário pressiona `Ctrl+Space` novamente  
**Então** o Modo Foco é desativado  
**E** o layout de 4 colunas é restaurado ao estado anterior  

---

### Cenário 3 — Ativar Modo Preview com Ctrl+\

**Dado** que o usuário está editando uma nota  
**Quando** o usuário pressiona `Ctrl+\`  
**Então** o Modo Preview é ativado  
**E** o conteúdo da nota é exibido renderizado em Markdown  
**E** o cursor de edição não está visível  
**E** o header permanece visível  

---

### Cenário 4 — Desativar Modo Preview com Ctrl+\

**Dado** que o Modo Preview está ativo  
**Quando** o usuário pressiona `Ctrl+\` novamente  
**Então** o Modo Preview é desativado  
**E** o editor com cursor de edição é restaurado  

---

### Cenário 5 — Atalhos não conflitam entre si

**Dado** que o usuário está no Modo Foco (`Ctrl+Space` ativo)  
**Quando** o usuário pressiona `Ctrl+\`  
**Então** o Modo Preview é ativado dentro do Modo Foco  
**E** o conteúdo é exibido renderizado em Markdown, com Editor e Painel IA em tela cheia  
**Quando** o usuário pressiona `Ctrl+\` novamente  
**Então** o Modo Preview é desativado, mas o Modo Foco permanece ativo  

---

### Cenário 6 — Botões no header refletem o estado dos atalhos

**Dado** que o Modo Preview foi ativado via `Ctrl+\`  
**Então** o botão `preview` no header aparece no estado ativo/selecionado  
**Dado** que o Modo Foco foi ativado via `Ctrl+Space`  
**Então** o botão `foco` no header aparece no estado ativo/selecionado  
**E** o botão `foco` permanece visível no header mesmo com o Modo Foco ativo  

---

### Cenário 7 — Atalhos exibidos como tooltip nos botões

**Dado** que o usuário posiciona o cursor sobre o botão `preview` no header  
**Então** um tooltip exibe `Preview (Ctrl+\)`  
**Dado** que o usuário posiciona o cursor sobre o botão de Modo Foco no header  
**Então** um tooltip exibe `Foco (Ctrl+Space)`  

---

## Regras de negócio

- Cada coluna deve ter `overflow-y: auto` ou equivalente — rolagem independente por coluna
- O header nunca deve participar do fluxo de rolagem das colunas — deve ser `position: sticky` ou `fixed`
- A exportação usa a API nativa de diálogo de arquivo do Tauri (`dialog.save`) — nunca um download direto no browser
- O conteúdo exportado é o Markdown renderizado (equivalente ao Preview), com slash commands removidos
- As larguras das colunas Cadernos, Anotações e Painel IA são salvas globalmente no localStorage (não por caderno ou nota)
- No Modo Foco, as colunas Cadernos e Anotações são ocultadas; o Painel IA permanece visível ao lado do Editor
- O Modo Foco não entra em fullscreen do sistema operacional — é um reposicionamento interno de colunas dentro da janela Tauri
- O botão de Foco está no header e permanece visível e clicável durante o Modo Foco ativo
- `Ctrl+Space` aciona o Modo Foco — sem conflito com atalhos nativos de sistema
- `Ctrl+\` aciona o Modo Preview — sem conflito com atalhos nativos do Windows ou editores comuns
- Ao sair do Modo Foco, o estado de seleção de caderno e nota é preservado (as colunas apenas ficam ocultas, não são destruídas)

---

## Decisões tomadas (ambiguidades resolvidas)

| # | Decisão |
|---|---|
| 1 | Atalho de Modo Foco: `Ctrl+Space` (não F11, para evitar conflito com fullscreen do Windows) |
| 2 | Exportação: conteúdo no formato Preview (Markdown renderizável), com slash commands filtrados |
| 3 | Persistência de largura: localStorage global para Cadernos, Anotações e Painel IA |
| 4 | Modo Foco: colunas Cadernos e Anotações somem; Painel IA permanece. Editor e IA dividem o espaço total |
| 5 | Botão Foco: já existe no header e deve ser mantido lá, visível mesmo com o Modo Foco ativo |
