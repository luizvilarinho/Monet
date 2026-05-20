# BDD - Atualizador Automático (Auto-Updater)

## Historias de usuario

### HU-01 - Ser notificado quando uma nova versão está disponível
Prioridade: Alta

Como usuario do Monet
Quero ser notificado quando uma versão mais recente do app estiver disponível
Para que eu possa manter o app atualizado sem precisar verificar manualmente

### HU-02 - Decidir se desejo instalar a atualização agora
Prioridade: Alta

Como usuario do Monet que recebeu uma notificação de atualização
Quero poder aceitar ou adiar a instalação da nova versão
Para instalar no momento que for mais conveniente para mim

### HU-03 - Adiar a atualização para a próxima abertura
Prioridade: Alta

Como usuario do Monet que não deseja interromper o que está fazendo
Quero poder adiar a atualização e ser perguntado novamente na próxima vez que abrir o app
Para não perder meu contexto de trabalho atual

### HU-04 - Ignorar uma versão específica
Prioridade: Media

Como usuario do Monet
Quero poder ignorar uma versão específica
Para não ser perguntado sobre ela novamente nas próximas aberturas

### HU-05 - Configurar o comportamento do verificador de atualizações
Prioridade: Media

Como usuario do Monet
Quero configurar como o app trata atualizações (sempre perguntar, instalar automaticamente ou nunca verificar)
Para que o comportamento de atualização se adapte às minhas preferências

### HU-06 - Ser informado sobre o conteúdo da nova versão
Prioridade: Media

Como usuario do Monet que recebeu uma notificação de atualização
Quero ver um resumo das mudanças incluídas na nova versão
Para decidir com mais contexto se vale instalar agora

### HU-07 - Saber quando a verificação de atualização falha
Prioridade: Baixa

Como usuario do Monet
Quero ser informado silenciosamente quando o app não consegue verificar por atualizações (ex: sem internet)
Para entender por que nenhuma notificação foi exibida, sem ser interrompido desnecessariamente

---

## Cenarios BDD

```gherkin
Feature: Atualizador automático
  Como usuario do Monet
  Quero ser notificado sobre novas versões ao abrir o app
  Para manter o software atualizado no momento que for mais conveniente para mim

  # --- Verificação de atualização na inicialização ---

  Scenario: Verificar atualização ao iniciar o app respeitando intervalo diário
    Given que o app foi iniciado
    And que a preferência de atualização não está configurada como "never"
    And que a última verificação de atualização ocorreu há mais de 24 horas (ou nunca ocorreu)
    When o app terminar de inicializar e renderizar o layout principal
    Then o sistema deve verificar silenciosamente se há uma nova versão disponível em segundo plano
    And essa verificação não deve bloquear nem atrasar a exibição do layout principal

  Scenario: Não verificar atualização quando última verificação foi há menos de 24 horas
    Given que o app foi iniciado
    And que a preferência de atualização não está configurada como "never"
    And que a última verificação de atualização ocorreu há menos de 24 horas
    When o app terminar de inicializar
    Then o sistema não deve realizar uma nova verificação
    And nenhuma notificação de atualização deve ser exibida com base em cache desatualizado

  Scenario: Não verificar atualizações opcionais quando a preferência está como "never"
    Given que a preferência de atualização do usuario está configurada como "never"
    And que a última verificação de atualização ocorreu há mais de 24 horas
    When o app for iniciado
    Then o sistema deve verificar silenciosamente se existe alguma versão obrigatória disponível
    And se não houver versão obrigatória, nenhuma notificação de atualização deve ser exibida
    And o download de versões opcionais não deve ocorrer

  Scenario: Exibir atualização obrigatória mesmo quando preferência está como "never"
    Given que a preferência de atualização do usuario está configurada como "never"
    When o app for iniciado e a verificação silenciosa detectar uma versão obrigatória
    Then o sistema deve exibir o diálogo de atualização obrigatória normalmente
    And a preferência "never" não deve suprimir esse diálogo

  Scenario: Não verificar atualização quando não há conexão com a internet
    Given que o app foi iniciado
    And que não há conexão com a internet disponível
    When o sistema tentar verificar se há nova versão
    Then a verificação deve falhar silenciosamente
    And nenhuma notificação de erro deve ser exibida ao usuario
    And o app deve funcionar normalmente

  # --- Detecção de nova versão ---

  Scenario: Detectar que o app já está na versão mais recente
    Given que o app foi iniciado
    And que a verificação de atualização foi concluída com sucesso
    When a versão disponível no servidor for igual à versão instalada
    Then o sistema não deve exibir nenhuma notificação ao usuario

  Scenario: Detectar nova versão disponível com preferência "ask"
    Given que o app foi iniciado
    And que a verificação de atualização foi concluída com sucesso consultando o GitHub Releases
    And que a preferência de atualização está configurada como "ask" (padrão)
    When uma versão mais recente for detectada
    And essa versão não foi previamente ignorada pelo usuario
    And essa versão não é uma atualização obrigatória
    Then o sistema deve exibir uma notificação de atualização disponível
    And a notificação deve ser exibida após o layout principal estar completamente carregado

  Scenario: Detectar versão obrigatória disponível
    Given que o app foi iniciado
    And que a verificação de atualização foi concluída com sucesso
    When uma versão marcada como obrigatória for detectada no GitHub Releases
    Then o sistema deve exibir o diálogo de atualização obrigatória
    And o diálogo deve informar que essa atualização é necessária para continuar usando o app
    And o diálogo deve exibir apenas o botão "Update now"
    And os botões "Later" e "Skip this version" não devem estar presentes
    And o usuario não deve conseguir fechar o diálogo sem iniciar a instalação

  Scenario: Detectar nova versão disponível com preferência "auto"
    Given que o app foi iniciado
    And que a preferência de atualização está configurada como "auto"
    When uma versão mais recente for detectada
    Then o sistema deve iniciar o download da atualização automaticamente sem perguntar ao usuario
    And deve exibir uma barra de progresso discreta indicando que a atualização está sendo baixada

  Scenario: Detectar nova versão que o usuario já ignorou
    Given que o app foi iniciado
    And que a verificação de atualização foi concluída com sucesso
    And que o usuario havia ignorado a versão X em uma abertura anterior
    When a versão detectada for a mesma versão X ignorada
    Then o sistema não deve exibir nenhuma notificação ao usuario

  # --- Diálogo de atualização disponível ---

  Scenario: Exibir diálogo de atualização com release notes buscadas do GitHub
    Given que uma nova versão foi detectada
    And que a preferência de atualização está como "ask"
    And que há conexão com a internet disponível
    When o diálogo de atualização for exibido
    Then deve mostrar o número da versão disponível
    And deve mostrar o número da versão atualmente instalada
    And deve exibir o conteúdo das release notes buscado em tempo real do GitHub Releases
    And deve haver um botão "Update now" para instalar imediatamente
    And deve haver um botão "Later" para adiar para a próxima abertura
    And deve haver um botão "Skip this version" para ignorar essa versão específica

  Scenario: Exibir diálogo de atualização sem release notes quando não há internet
    Given que uma nova versão foi detectada
    And que a preferência de atualização está como "ask"
    And que não há conexão com a internet disponível no momento de exibir o diálogo
    When o diálogo de atualização for exibido
    Then deve mostrar o número da versão disponível
    And deve mostrar o número da versão atualmente instalada
    And no lugar das release notes deve exibir a mensagem "Versão X.X.X disponível. Conecte-se à internet para ver as novidades."
    And deve haver um botão "Update now" para instalar imediatamente
    And deve haver um botão "Later" para adiar para a próxima abertura
    And deve haver um botão "Skip this version" para ignorar essa versão específica

  Scenario: Não bloquear o uso do app durante o diálogo de atualização
    Given que o diálogo de atualização está sendo exibido
    When o usuario fechar ou descartar o diálogo por qualquer meio
    Then o app deve se comportar como se o usuario tivesse clicado em "Later"
    And o layout principal deve permanecer acessível e funcional

  # --- Instalar atualização agora ---

  Scenario: Iniciar download da atualização ao clicar em "Update now"
    Given que o diálogo de atualização está sendo exibido
    When o usuario clicar no botão "Update now"
    Then o sistema deve iniciar o download da nova versão
    And deve exibir uma barra de progresso com o percentual do download
    And o botão "Update now" deve ser substituído por um estado de carregamento
    And o usuario não deve poder clicar em "Update now" novamente enquanto o download estiver em andamento

  Scenario: Concluir instalação após download bem-sucedido
    Given que o download da atualização foi concluído com sucesso
    When o arquivo de instalação estiver pronto
    Then o sistema deve exibir uma mensagem informando que o app será reiniciado para aplicar a atualização
    And deve haver um botão "Restart now" para reiniciar imediatamente
    And deve haver um botão "Restart later" para reiniciar manualmente em outro momento

  Scenario: Reiniciar o app para aplicar a atualização
    Given que o download foi concluído e o usuario clicou em "Restart now"
    When o app for reiniciado
    Then a nova versão deve estar instalada e em execução após a reinicialização

  Scenario: Falha no download da atualização
    Given que o usuario clicou em "Update now"
    And que o download foi iniciado
    When o download falhar (ex: conexão perdida, arquivo corrompido)
    Then o sistema deve exibir uma mensagem de erro informando que o download falhou
    And deve oferecer um botão "Try again" para reiniciar o download
    And deve oferecer um botão "Cancel" para cancelar a tentativa de atualização

  # --- Adiar atualização ---

  Scenario: Adiar atualização clicando em "Later"
    Given que o diálogo de atualização está sendo exibido
    When o usuario clicar no botão "Later"
    Then o diálogo deve ser fechado
    And o app deve continuar funcionando normalmente
    And a versão ignorada não deve ser registrada como ignorada permanentemente
    And na próxima abertura do app a notificação deve aparecer novamente

  # --- Ignorar versão específica ---

  Scenario: Ignorar versão específica clicando em "Skip this version"
    Given que o diálogo de atualização está sendo exibido para a versão X
    When o usuario clicar no botão "Skip this version"
    Then o diálogo deve ser fechado
    And o sistema deve registrar localmente que a versão X foi ignorada pelo usuario
    And nas próximas aberturas do app, a versão X não deve gerar nenhuma notificação
    And se uma versão Y posterior for lançada, o sistema deve notificar normalmente

  # --- Configuração de preferências de atualização ---

  Scenario: Exibir opções de atualização nas Settings
    Given que o usuario está na tela de Settings
    When ele acessar a seção de atualizações
    Then deve ser exibida a versão atual do app instalada
    And deve haver um seletor com as opções de comportamento: "Ask before updating", "Update automatically" e "Never check for updates"
    And a opção atualmente ativa deve estar marcada
    And deve haver um botão "Check for updates now" para verificação manual

  Scenario: Alterar preferência para "Ask before updating"
    Given que o usuario está na seção de atualizações das Settings
    When ele selecionar a opção "Ask before updating"
    Then o sistema deve salvar essa preferência localmente
    And nas próximas verificações, o app deve exibir o diálogo de confirmação antes de qualquer instalação

  Scenario: Alterar preferência para "Update automatically"
    Given que o usuario está na seção de atualizações das Settings
    When ele selecionar a opção "Update automatically"
    Then o sistema deve salvar essa preferência localmente
    And nas próximas inicializações, o app deve baixar e instalar atualizações automaticamente sem perguntar

  Scenario: Alterar preferência para "Never check for updates"
    Given que o usuario está na seção de atualizações das Settings
    When ele selecionar a opção "Never check for updates"
    Then o sistema deve salvar essa preferência localmente
    And o app não deve mais verificar atualizações ao iniciar

  Scenario: Verificar atualização manualmente via Settings
    Given que o usuario está na seção de atualizações das Settings
    When ele clicar no botão "Check for updates now"
    Then o sistema deve realizar a verificação de atualização imediatamente
    And deve exibir um indicador de carregamento enquanto verifica
    And se uma nova versão for encontrada, deve exibir o diálogo de atualização
    And se o app já estiver na versão mais recente, deve exibir a mensagem "You're up to date"
    And se não houver conexão com a internet, deve exibir uma mensagem de erro específica para esse caso

  # --- Persistência do estado entre sessões ---

  Scenario: Manter preferência de atualização entre sessões
    Given que o usuario configurou a preferência de atualização em uma sessão anterior
    When o app for aberto em uma nova sessão
    Then a preferência salva deve ser aplicada automaticamente
    And não deve ser necessário reconfigurar

  Scenario: Manter registro de versões ignoradas entre sessões
    Given que o usuario ignorou a versão X em uma sessão anterior
    When o app for aberto em uma nova sessão
    And a versão disponível no servidor ainda for a versão X
    Then nenhuma notificação deve ser exibida
```

---

## Criterios de aceitacao

1. A verificação de atualização deve ocorrer em segundo plano, sem bloquear a inicialização do app.
2. A verificação automática só deve ser realizada se a última verificação ocorreu há mais de 24 horas. O timestamp da última verificação deve ser salvo localmente.
3. Nenhuma notificação deve ser exibida antes do layout principal estar completamente carregado.
4. As versões disponíveis devem ser consultadas a partir do GitHub Releases do repositório do Monet.
5. As release notes devem ser buscadas em tempo real do GitHub Releases. Se não houver internet no momento de exibir o diálogo, exibir a mensagem: "Versão X.X.X disponível. Conecte-se à internet para ver as novidades." (substituindo X.X.X pelo número real da versão).
6. Quando a preferência for "ask" (padrão), o diálogo de atualização deve exibir obrigatoriamente: versão disponível, versão atual, release notes (ou fallback offline), botões "Update now", "Later" e "Skip this version".
7. Versões marcadas como obrigatórias no GitHub Releases devem exibir um diálogo com apenas o botão "Update now" — sem "Later", sem "Skip this version" e sem possibilidade de fechar sem iniciar a instalação.
8. Clicar em "Later" deve fechar o diálogo sem salvar a versão como ignorada — a notificação deve reaparecer na próxima abertura (respeitando o intervalo de 24 horas).
9. Clicar em "Skip this version" deve registrar localmente a versão ignorada e suprimir futuras notificações sobre ela. Uma versão posterior deve ser notificada normalmente.
10. Versões obrigatórias não podem ser ignoradas via "Skip this version".
11. O download de atualização deve exibir progresso em percentual durante a transferência.
12. Falha no download deve exibir mensagem de erro com as opções "Try again" e "Cancel".
13. Após download bem-sucedido, o app deve aguardar confirmação do usuario antes de reiniciar.
14. Quando a preferência for "auto", o download deve iniciar automaticamente sem exibir o diálogo de confirmação inicial.
15. Quando a preferência for "never", o app não deve baixar nem instalar versões opcionais, e não deve exibir nenhum diálogo sobre elas. Porém, a verificação de versões obrigatórias deve ocorrer normalmente — versões obrigatórias furam o "never".
16. Falha na verificação por falta de internet deve ser silenciosa — sem notificação de erro ao usuario.
17. A preferência de atualização não deve ser perguntada no onboarding. O padrão "ask" deve funcionar silenciosamente. A opção de alterar está disponível nas Settings.
18. A seção de atualizações nas Settings deve exibir a versão atualmente instalada.
19. O botão "Check for updates now" nas Settings deve realizar a verificação imediatamente, ignorando o intervalo de 24 horas.
20. A preferência de atualização deve persistir entre sessões.
21. O registro de versões ignoradas deve persistir entre sessões.
22. Fechar o diálogo de atualização comum por qualquer meio (tecla ESC, clique fora) deve ser tratado como "Later". O diálogo de atualização obrigatória não deve fechar por esses meios.

---

## Glossario do dominio

- Auto-updater: componente responsável por verificar, baixar e instalar novas versões do Monet automaticamente ou mediante confirmação do usuario.
- Versão atual: número da versão do Monet atualmente instalada na máquina do usuario (ex: `1.2.0`).
- Versão disponível: número da versão mais recente publicada no GitHub Releases do repositório do Monet.
- Versão obrigatória: versão marcada explicitamente no GitHub Releases como de instalação obrigatória (ex: por breaking change no banco de dados ou correção crítica de segurança). Não pode ser adiada nem ignorada.
- GitHub Releases: serviço do GitHub usado como fonte de verdade para versões disponíveis e release notes do Monet. A verificação de atualização consulta essa fonte em tempo real.
- Release notes: resumo das mudanças, correções e novidades de uma versão, buscado em tempo real do GitHub Releases.
- Fallback offline de release notes: mensagem exibida no diálogo quando não é possível buscar as release notes por falta de internet. Formato: "Versão X.X.X disponível. Conecte-se à internet para ver as novidades."
- Intervalo de verificação: período mínimo entre duas verificações automáticas de atualização. Definido como 24 horas. Respeitado nas verificações automáticas; ignorado na verificação manual.
- Timestamp da última verificação: registro local da data e hora da verificação automática mais recente, usado para aplicar o intervalo de 24 horas.
- Diálogo de atualização: janela modal exibida ao usuario quando uma nova versão não obrigatória está disponível e a preferência é "ask". Contém "Update now", "Later" e "Skip this version".
- Diálogo de atualização obrigatória: janela modal exibida quando uma versão obrigatória é detectada. Contém apenas "Update now". Não pode ser fechada sem iniciar a instalação.
- Preferência de atualização: configuração do usuario que define como o app trata atualizações. Pode ser "ask", "auto" ou "never". Padrão: "ask". Configurável nas Settings — não é perguntada no onboarding.
- Ask (preferência): o app pergunta ao usuario antes de instalar qualquer atualização não obrigatória. Comportamento padrão.
- Auto (preferência): o app baixa e instala atualizações não obrigatórias automaticamente sem perguntar ao usuario.
- Never (preferência): o app não verifica nem instala atualizações automaticamente. Atualizações obrigatórias ainda são verificadas.
- Versão ignorada: versão específica que o usuario optou por não instalar via "Skip this version". Registrada localmente; não gera notificação em aberturas futuras. Versões obrigatórias não podem ser ignoradas.
- Download de atualização: transferência do instalador da nova versão do GitHub Releases para a máquina local.
- Progresso do download: indicador visual em percentual exibido durante a transferência do arquivo de atualização.
- Reinicialização do app: encerramento e reabertura do Monet para que a nova versão seja aplicada.
- "Update now": botão que inicia o download e a instalação da nova versão. Presente em ambos os tipos de diálogo.
- "Later": botão do diálogo de atualização comum que fecha o diálogo sem instalar nem ignorar a versão — a notificação reaparece na próxima abertura (respeitando 24 horas). Ausente no diálogo obrigatório.
- "Skip this version": botão do diálogo de atualização comum que registra a versão como ignorada e suprime futuras notificações sobre ela. Ausente no diálogo obrigatório.
- "Restart now": botão exibido após o download concluído que reinicia o app para aplicar a atualização.
- "Restart later": botão exibido após o download concluído que posterga o reinício para quando o usuario fechar o app manualmente.
- "Check for updates now": botão nas Settings que força uma verificação manual imediata, ignorando o intervalo de 24 horas.
- Verificação silenciosa: processo de verificação que ocorre em segundo plano sem exibir feedback visual ao usuario enquanto não há resultado.
- Settings: tela de configurações do app onde o usuario pode ajustar a preferência de atualização, ver a versão atual instalada e iniciar uma verificação manual.

---

## Ambiguidades e decisoes pendentes

1. ~~**Intervalo mínimo entre verificações:**~~ **Decidido:** verificação automática ocorre uma vez a cada 24 horas. O timestamp da última verificação é salvo localmente. Verificação manual via Settings ignora esse intervalo.

2. ~~**Distribuição via Microsoft Store vs. distribuidor próprio:**~~ **Decidido:** distribuição via GitHub Releases (instalador direto). O auto-updater descrito aqui se aplica a esse canal. Se no futuro o app for publicado na Microsoft Store, o auto-updater será desativado nessa build, pois a Store gerencia atualizações de forma independente.

3. ~~**Atualização obrigatória:**~~ **Decidido:** sim, versões obrigatórias existirão (ex: breaking change no schema do banco de dados, correção crítica de segurança). O diálogo obrigatório exibe apenas "Update now", sem "Later" nem "Skip this version". O usuario não consegue fechar o diálogo sem iniciar a instalação.

4. ~~**Comportamento padrão na primeira configuração:**~~ **Decidido:** a preferência padrão "ask" funciona silenciosamente sem perguntar ao usuario. A opção de alterar o comportamento está disponível nas Settings. Não será incluída no onboarding.

5. **Rollback:** Fora do escopo desta história. Sinalizado para backlog de fase posterior.

6. ~~**Release notes:**~~ **Decidido:** buscadas em tempo real do GitHub Releases. Fallback offline: exibir a mensagem "Versão X.X.X disponível. Conecte-se à internet para ver as novidades." (sem bloquear o diálogo nem o botão "Update now").
