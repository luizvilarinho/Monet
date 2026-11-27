# Explorer Report — Player do YouTube embutido e sincronização (R2 e embed do R6)

- Data: 2026-11-27 (todas as consultas à documentação e todas as provas foram feitas neste dia)
- Task: `DOCS/reports/27-11-2026/taskreport_20261127153603.md`
- Escopo desta exploração: só o player embutido e a sincronização. A leitura do código do Monet e a origem da transcrição com tempo estão em outras explorações.
- Nenhum código foi alterado. Este arquivo é o único criado no repositório.

---

## 1. Resposta curta

**O player do YouTube embutido deve funcionar dentro do Monet no Windows**, com uma mudança de uma linha no CSP. Certeza: **alta (cerca de 85%)**, não total, porque a prova foi feita no Edge sem janela e não no WebView2 do app. O que falta só a fase 0 da implementação prova (seção 11).

- **Dificuldade geral: Média.** Embed e CSP: Baixa. Sincronização (frase atual, clicar e saltar, pausa no fim da frase, velocidade): Baixa. Acabamento (foco do teclado, anúncios, erros, tela cheia no WebView2, regra do YouTube que pode mudar): Média.
- **Por que funciona no Windows e falha em outros sistemas:** o YouTube exige que o iframe chegue com o cabeçalho `Referer`. No Windows, o Tauri serve o app em `http://tauri.localhost`, que é um endereço web de verdade e gera Referer. No macOS e no Linux o endereço é `tauri://localhost`, que não gera, e dá o Error 153. O Monet é Windows hoje (`DOCS/specs/PRD.md`, seção 6), então esse é o caminho que importa.
- **Mudança mínima de CSP:** só `frame-src` ganha o domínio do YouTube. Detalhe na seção 3.
- **Minha recomendação sobre o controle do player:** falar com o iframe só por `postMessage`, **sem carregar o script `iframe_api`**. Funciona hoje (provado), não exige script remoto no CSP e deixa o `script-src` como está. O custo é que esse protocolo não está na documentação oficial. Guardar o `iframe_api` como plano B atrás da mesma interface. Decisão do Coordenador (D1 abaixo).

---

## 2. Como foi provado, e o que a prova vale

**Ambiente da prova** (arquivos e processos já apagados, ver seção 12):
- Edge 158.0.4370.45 sem janela (`--headless=new`), comandado por CDP, com **perfil temporário** numa pasta de rascunho fora do repositório, sem login, rede real.
- Servidor local mínimo em Node (porta única 18765, http e https na mesma porta) servindo uma página HTML de teste.
- Para a página responder como `http://tauri.localhost` e `https://tauri.localhost` **sem porta e sem administrador**: regra de resolução de host do navegador (`--host-resolver-rules="MAP tauri.localhost 127.0.0.1:18765"`) e um certificado autoassinado descartável só para a variante https.
- Vídeos: públicos, de tipos diferentes (um de cerca de 3,5 min, outro de cerca de 10 min em 4K 60 fps, vários clipes populares e transmissões ao vivo). Nada de título, canal ou link neste relatório.

**O que a prova mostra:** como o servidor do YouTube e o motor Chromium se comportam com essas origens e esses Referers; o protocolo `postMessage`; a frequência e a precisão da posição; o CSP exato que cada forma pede; o que acontece com foco e teclado.

**O que a prova NÃO mostra (só a fase 0 mostra):**
- O WebView2 do app de verdade: o Tauri serve o app por protocolo próprio (a origem `http://tauri.localhost` é simulada aqui com regra de DNS), o WebView2 tem outra pasta de dados e política de rastreamento, e o MSIX da Store roda em contêiner.
- Reprodução com som, codecs e decodificação por hardware. Aqui o som estava mudo e o vídeo 4K de 60 fps travou após um salto no tempo (o decodificador por software do modo sem janela não deu conta); com um vídeo comum tudo correu bem. Isso é limite do ambiente de teste, não do player.
- **Anúncios:** nenhum apareceu em nenhum teste.
- Consentimento e cookies da União Europeia (a prova rodou no Brasil), login e Premium.
- Tela cheia da janela do Tauri, picture-in-picture e o que o Tauri faz com "Assistir no YouTube" (nova janela).

---

## 3. Controle do player e CSP exato (pontos 1 e 2)

### 3.1 Documentação oficial (consultada em 2026-11-27)
Fonte: IFrame Player API (`developers.google.com/youtube/iframe_api_reference`) e parâmetros (`developers.google.com/youtube/player_parameters`).

- **Parâmetros úteis:** `enablejsapi=1` (liga o controle), `origin` (esquema e domínio completos da página; a documentação diz que é opcional, mas recomenda sempre informar), `playsinline=1`, `rel=0` (desde 2018 só limita os relacionados ao mesmo canal, não os remove), `cc_load_policy=1` (liga a legenda do próprio YouTube), `cc_lang_pref`, `hl`, `disablekb=1` (o player para de responder ao teclado), `controls`, `fs`, `start` e `end` (só inteiros; `start` cai no keyframe, em geral até cerca de 2 s antes).
- **Métodos:** `getCurrentTime()` (segundos), `seekTo(segundos, allowSeekAhead)` (a doc recomenda `true` ao soltar e `false` enquanto arrasta), `playVideo()`, `pauseVideo()`, `setPlaybackRate(taxa)` (é uma sugestão; valores sem suporte arredondam), `getDuration()` (0 até carregar os metadados; em transmissão ao vivo o valor não serve), `getPlayerState()` (-1, 0, 1, 2, 3, 5), `getAvailablePlaybackRates()`.
- **Eventos:** `onReady`, `onStateChange`, `onPlaybackRateChange`, `onError`, `onAutoplayBlocked`.
- **Códigos de `onError`:** 2 (parâmetro inválido), 5 (erro do player HTML5), 100 (não encontrado ou privado), 101 e 150 (dono não permite embed) e **153**: "The request does not include the HTTP Referer header or equivalent API Client identification."
- **Tamanho:** viewport mínima 200 x 200 px; para 16:9, recomendado 480 x 270 px ou mais.

### 3.2 Forma A: com o script `iframe_api` (documentada)
- Carrega `https://www.youtube.com/iframe_api`, que por sua vez carrega `https://www.youtube.com/s/player/<hash>/www-widgetapi.vflset/www-widgetapi.js`. **Verificado:** os dois vêm do mesmo domínio `www.youtube.com`; nenhum outro domínio apareceu. O `iframe_api` em `youtube-nocookie.com` dá 404 (o script sempre vem de `www.youtube.com`, mesmo com o iframe em nocookie).
- **CSP mínimo (verificado):** `frame-src` com o domínio do iframe **mais** `script-src` com `https://www.youtube.com`.
- O script usa uma política de Trusted Types do próprio YouTube. O CSP do app não exige Trusted Types, então não atrapalha.
- **Custo de segurança:** o script do YouTube passaria a rodar **dentro da janela principal do Monet**, a que tem acesso aos comandos do Tauri (notas, chaves via Rust, etc.). Hoje o `script-src` só aceita código do próprio app.
- **Vantagem:** é o único caminho que a documentação descreve. `getCurrentTime()` já devolve valor interpolado: 299 valores diferentes em 300 leituras a cada 20 ms (a leitura da posição é suave, não em degraus).

### 3.3 Forma B: sem script, só `postMessage` (não documentada; verificada)
É o mesmo protocolo que o `iframe_api` usa por baixo. Observado ao vivo:

1. A página cria o iframe `https://<domínio>/embed/<id>?enablejsapi=1&origin=<origem exata da página>&playsinline=1&rel=0&mute=1...`.
2. **Aperto de mão obrigatório:** a página manda `{"event":"listening","id":"<id do widget>","channel":"widget"}` (texto JSON, para o `contentWindow`, com `targetOrigin` igual ao domínio do iframe) e repete a cada 250 ms até ouvir algo. Sem esse envio o player fica mudo (verificado: zero mensagens e o comando de tocar não surtiu efeito).
3. O player responde com `initialDelivery` (lista de métodos), `onReady`, `alreadyInitialized` e depois `infoDelivery` o tempo todo.
4. **Comandos:** `{"event":"command","func":"seekTo","args":[60,true],"id":"<id>","channel":"widget"}`. Verificados: `mute`, `playVideo`, `pauseVideo`, `seekTo`, `setPlaybackRate`.
5. **Leituras:** vêm dentro de `infoDelivery.info`: `currentTime`, `currentTimeLastUpdated_` (hora local do iframe, em segundos de época), `mediaReferenceTime`, `playbackRate`, `videoLoadedFraction`, `duration` (também em `progressState.duration`) e `playerState` (só quando o estado muda).
- **Se `origin` for informado, tem que bater exatamente.** Com a origem errada, ou com `https` numa página `http`, o player **não manda nada** (verificado). Sem o parâmetro, funciona (verificado), mas a documentação manda informar, porque ele impede que script de terceiros assuma o controle do player. Calcular a partir de `location.origin` em tempo de execução, nunca escrever fixo (a origem muda entre dev, produção e `useHttpsScheme`).
- **CSP mínimo (verificado): só `frame-src`.** `script-src`, `connect-src`, `img-src` e `style-src` ficam como estão (`img-src` já aceita `https:`).
- **Risco:** o formato das mensagens não está na documentação; o YouTube pode mudar sem aviso. Por isso a interface do player no app deve ter duas implementações trocáveis (esta e a da forma A).

### 3.4 A mudança exata de CSP (arquivo `src-tauri/tauri.conf.json`, linha `csp`)

| Hoje | Forma B (recomendada) | Forma A (plano B) |
|---|---|---|
| `frame-src 'self' blob:` | `frame-src 'self' blob: https://www.youtube-nocookie.com` | igual à B, e **também** `script-src 'self' 'wasm-unsafe-eval' https://www.youtube.com` |

- Troque `youtube-nocookie.com` por `www.youtube.com` se preferir o domínio normal. **O domínio do `frame-src` tem que ser o mesmo do iframe**: com `frame-src` em um e iframe no outro, o navegador bloqueia (verificado).
- `youtube-nocookie.com` é o "modo de privacidade aprimorada" (Ajuda do YouTube, consultada hoje): as visualizações não mexem nas recomendações do espectador e os anúncios não são personalizados. Para app, a Ajuda manda usar uma instância de WebView. Funcionou igual ao domínio normal na prova.
- **Dev:** `src-tauri/tauri.conf.dev.json` só troca `productName` e `identifier`; o CSP é herdado por mescla (inferência, não rodei o app). Origem em dev: `http://localhost:1420` (`devUrl`). Em produção no Windows: `http://tauri.localhost`.
- **Não mexer em `useHttpsScheme`** (hoje não está definido, então o padrão é `false`). Pela referência de configuração do Tauri, trocar esse valor muda a origem e **torna inacessíveis o localStorage, os cookies e o IndexedDB antigos**. O chat do Monet vive em localStorage. Não é preciso mexer: as duas origens funcionam (seção 4).

### 3.5 Atributos recomendados no iframe (verificados onde indicado)
- `allow="autoplay; encrypted-media; fullscreen"` e `allowfullscreen`. Deixar o `picture-in-picture` de fora (seção 6 explica).
- `referrerpolicy="strict-origin-when-cross-origin"` explícito: é a política que o YouTube recomenda e protege caso o app passe a mandar uma política mais restritiva.
- `sandbox="allow-scripts allow-same-origin allow-presentation"`, e acrescentar `allow-popups allow-popups-to-escape-sandbox` se o link "Assistir no YouTube" do erro deve abrir. **Verificado:** as duas combinações tocam. `sandbox="allow-scripts"` sozinho **não funciona** (nenhuma mensagem, o player não inicia).
- Para não duplicar texto, não ligar `cc_load_policy=1` (a legenda do YouTube apareceria por cima do vídeo além da nossa transcrição). Se o usuário já ligou legenda no YouTube, ela pode vir ligada; desligar por API não foi provado.

---

## 4. Regras de embed em 2025–2026 e apps de desktop (ponto 2)

**A regra (documentação oficial):** quem usa o player embutido, inclusive o IFrame API, deve se identificar pelo cabeçalho `Referer`. A seção "API Client Identity and Credentials" foi **acrescentada em 2025-07-07** à página "Required Minimum Functionality" (histórico de revisões dos Termos). Pontos dela:
- Não usar `Referrer-Policy` que apague o Referer (recomendada: `strict-origin-when-cross-origin`); não usar `noreferrer` em `window.open`.
- Em WebViews e apps desktop o Referer vem vazio por padrão, então o cliente **deve definir manualmente**. Exemplos da página: `baseUrl` do HTML local no Android e iOS; cabeçalho no pedido; no .NET desktop, `CoreWebView2HttpRequestHeaders.SetHeader`. A página não cita Electron nem Tauri.
- **Formato pedido:** URL **https** cujo domínio é o **identificador do app** (nome reverso, como `com.empresa.app`). Para Windows, a página diz: na Microsoft Store, montar a partir do AppID de `apps.microsoft.com/detail/<AppID>`; fora da Store, usar só o atributo `Name` da identidade do pacote.
- Sem seguir isso, a página avisa que a função do player embutido pode ser reduzida, e clientes de alto volume podem precisar de credenciais.
- A Ajuda do YouTube confirma: embed sem Referer mostra o "error 153" com a opção "Watch on YouTube".

**O que o servidor aceita hoje (verificado na prova, tabela abaixo):** basta **existir** um Referer web. `http://tauri.localhost/`, `https://tauri.localhost/`, `http://localhost:<porta>/` e `http://127.0.0.1:<porta>/` passam; `file://` e política `no-referrer` não geram Referer e dão 153. Um Referer injetado à mão numa página `file://` também resolve, até com domínio que não existe, ou seja, o servidor não valida o domínio nesse nível.

| Origem da página | Referer que chegou ao YouTube | Resultado |
|---|---|---|
| `http://localhost:<porta>` (como o dev em 1420) | `http://localhost:<porta>/` | pronto e tocando |
| **`http://tauri.localhost` (Windows, produção, padrão)** | `http://tauri.localhost/` | **pronto e tocando** |
| `https://tauri.localhost` (se um dia `useHttpsScheme`) | `https://tauri.localhost/` | pronto e tocando |
| `http://127.0.0.1:<porta>` | `http://127.0.0.1:<porta>/` | pronto e tocando |
| `http://tauri.localhost` sem o parâmetro `origin` | `http://tauri.localhost/` | tocando, e as mensagens chegam normalmente (ver 3.3 sobre `origin` errado) |
| `http://` e `https://tauri.localhost` com `youtube-nocookie.com` | idem | tocando |
| `file://` | nenhum | **Error 153** (também com nocookie) |
| qualquer origem com `Referrer-Policy: no-referrer` | nenhum | **Error 153** |
| `file://` + Referer `https://com.monet.app/` injetado no pedido do iframe (simula o `SetHeader` do WebView2, via CDP) | injetado | tocando |
| `file://` + Referer de domínio inexistente injetado | injetado | tocando |

**Relatos de Tauri e WebView2 (fontes secundárias, não verificadas por mim):**
- Tauri issue #14422 (aberta em 2025-11-05, fechada em 2025-12-21, comentários até 2026-08): em produção, embed do YouTube dá 153 com `tauri://localhost` (relatado em macOS e Linux). Um comentário (2025-11-11) diz que **no Windows funciona**, porque a origem é `http://tauri.localhost`. Soluções postadas: servir o app por HTTP local com `tauri-plugin-localhost` (funciona para o YouTube, mas **o app perde o acesso aos comandos do Tauri**, segundo quem testou) e **página HTML intermediária** servida por HTTP/HTTPS, com o iframe do YouTube dentro, e o app aponta o iframe para ela (confirmado por dois usuários, em 2026-04 e 2026-08).
- Mais dois projetos Tauri com o mesmo erro em produção usaram página hospedada (Sapling, 2026-09; Gramax, desktop, 2026-07 a 2026-09; este último sem solução descrita).
- `referrerpolicy` e o parâmetro `origin` **não resolveram** em `tauri://localhost` (relato do autor da issue 14422): faz sentido, porque o problema é que não há Referer web.
- Electron com `file://`: o mesmo mecanismo (sem Referer). Não achei relato de correção para Electron; um fornecedor de proxy (fonte comercial, só como indício) vende proxy para isso. Um tópico do Obsidian (Electron, 2025-10) atribui o 153 a cookies do YouTube e não traz correção.
- MAUI/WebView2: um tópico (2026-01-30) recebeu como resposta oficial "limitação do lado do YouTube; abra o vídeo no navegador"; não cita o Referer.
- **Não achei nenhum relato de falha no Windows com `http://tauri.localhost`.** Também não achei nenhuma confirmação em contrário além do comentário citado. Sem relato de `https://tauri.localhost` nem de MSIX.

---

## 5. Limites do embed (ponto 4)

| Caso | O que sei | Grau |
|---|---|---|
| **Dono proíbe embed** | O dono desmarca "Allow embedding" no YouTube Studio (Ajuda do YouTube). O player mostra erro e o link "Watch on YouTube". Código **101 ou 150**. | documentação oficial |
| **Código 150 é ambíguo (prova)** | ID inexistente e 4 de 6 IDs de transmissões ao vivo (não sei se por embed proibido ou por já não estarem no ar) devolveram o mesmo **150**, no protocolo cru e no `iframe_api`; segundo fontes secundárias, restrição de idade também. A documentação diz 100 para removido/privado, mas **um ID inexistente devolveu 150, não 100**. **Não consegui provar um vídeo cujo dono proibisse o embed**: nenhum dos cerca de 30 clipes populares testados deu erro. O app não consegue distinguir "removido", "embed proibido" e "idade restrita": a mensagem precisa cobrir os três e oferecer "Open on YouTube". | prova (150) e documentação |
| ID de formato inválido | **Nenhum evento chega** (nem pronto, nem erro). Precisa de um tempo limite na tela. | prova |
| Restrição de idade | A Ajuda do YouTube diz que esses vídeos "não tocam na maioria dos sites de terceiros" e redirecionam para o YouTube. Não provado. | documentação (Ajuda) |
| Privado ou removido | Mesmo caminho do 150. | prova (150) |
| **Ao vivo** | `getDuration()` não serve (das 2 transmissões que carregaram, uma deu 0 e outra um número absurdo, cerca de 75 milhões). Transcrição estática não casa com transmissão ao vivo. Das 6 IDs testadas, 4 deram 150. **Ficam fora.** | prova parcial |
| Shorts | Não testado (não consegui um ID de Short). O embed aceita o ID como vídeo comum; quadro vertical dentro de 16:9. | não confirmado |
| **Anúncios** | A Ajuda do YouTube diz que embeds podem mostrar anúncios puláveis e não puláveis, que o criador não consegue desligar só para embeds e que o embed segue as mesmas configurações do youtube.com. **O que `getCurrentTime()` devolve durante um anúncio não está na documentação**; um relato antigo (cerca de 10 anos) diz que tempo e duração passam a ser os do anúncio. **Nenhum anúncio apareceu na prova.** Não existe `getAdState` neste player (o método não está na lista). Hipótese a provar na fase 0: durante um anúncio, `progressState.duration` fica diferente da duração do vídeo que já sabemos; usar isso para congelar a sincronização e mostrar "Ad playing". | não confirmado |
| Consentimento e cookies | Sem tela de consentimento na prova (Brasil, perfil limpo). Na União Europeia, não verificado. O modo `youtube-nocookie` dá privacidade melhor, mas fontes comerciais dizem que ainda não dispensa o consentimento (opinião, não regra). | não confirmado |
| Conta Premium | Não vale dentro do app a menos que haja login do YouTube **dentro do perfil do WebView2**, o que não é o caso. A Ajuda não diz nada sobre Premium em embeds; só relatos de fórum (anedóticos). Contar com anúncios. | não confirmado |
| Queda de rede | O texto fica; o player não carrega. Sem evento de erro garantido: usar tempo limite. | inferência |

---

## 6. Políticas do YouTube para players embutidos (ponto 5)

Texto **parafraseado** (o literal está nas páginas citadas; consultadas em 2026-11-27). Páginas: Termos dos serviços de API e Políticas para Desenvolvedores (`developers.google.com/youtube/terms/developer-policies`), Required Minimum Functionality (`.../required-minimum-functionality`), Guia de conformidade (`.../developer-policies-guide`), Ajuda do YouTube.

| Tema | Onde | O que diz | Efeito no nosso caso |
|---|---|---|---|
| **Tamanho mínimo** | Required Minimum Functionality, "Embedded YouTube Player size"; IFrame API reference | Viewport de pelo menos 200 x 200 px; se mostrar controles, grande o bastante para mostrá-los inteiros; para 16:9, recomendado 480 x 270 ou mais. As Políticas para Desenvolvedores não têm mínimo próprio. | O "vídeo com tamanho ajustável" do R4 não pode descer de 480 x 270 de forma recomendada, nem de 200 x 200 em hipótese alguma. |
| **Não cobrir nem esconder o player** | Required Minimum Functionality, "Overlays and frames" | Não pôr sobreposições, molduras ou elementos visuais na frente de qualquer parte do player, nem esconder os controles. | Nenhuma camada transparente sobre o iframe (nem para "capturar teclado"). Controles nossos ficam **fora** da área do vídeo. |
| **Não alterar o player** | Required Minimum Functionality, "YouTube Player attributes"; Políticas III.I.4 e III.I.6 | Não alterar o player além do que a API descreve; não modificar, construir sobre nem bloquear parte ou função do player; não remover nem alterar links dele. | Usar só os métodos da API. Não esconder a roda de ajustes etc. |
| **Controles de reprodução** | Guia de conformidade, "reflect a user's standard experience on YouTube" | Não modificar, acrescentar nem bloquear a função padrão de reprodução. Sobreposições para consentimento ou controles de reprodução são aceitas desde que não conflitem com a interface do player. | **Saltar, repetir um trecho e mudar a velocidade por botões nossos, ao lado ou abaixo do player, são uso normal da API.** Não há regra que cite transcrição ao lado. |
| **Transcrição ao lado** | Nenhuma | Não encontrei regra que trate de mostrar texto ao lado do player. Só valem as de não cobrir e não esconder atribuição (Políticas III.F.2.c). | Permitido, em princípio. |
| **Não separar áudio de vídeo** | Políticas III.I.7 e III.I.8; Guia | Proíbe separar, isolar ou modificar áudio ou vídeo, e promover os componentes separadamente. | Afeta a alternativa "tocar o áudio local do Mincer" (seção 9). O embed não é afetado. |
| **Não tocar em segundo plano** | Políticas III.I.9; Guia | Proíbe recurso de reprodução por player que não está exibido na página, aba ou tela que o usuário vê. | Nenhum player escondido. O picture-in-picture do próprio player provavelmente é permitido, mas é cinzento; deixar fora do `allow`. |
| **Anúncios** | Políticas III.I.5; Guia | Proíbe modificar, interferir, substituir ou bloquear anúncios do YouTube; proíbe impedir anúncios no seu serviço. | Não esconder o player para pular anúncio. |
| **Reprodução automática e por script** | Required Minimum Functionality, "Autoplay and scripted playbacks" | Reprodução automática só quando o player está visível (mais da metade na tela); no máximo um player tocando automaticamente por tela. | Nada de tocar ao abrir o item. Repetições e pausas por clique do usuário são seguras; a repetição em laço é uma cinza leve. |
| **Identificação do cliente** | Required Minimum Functionality (2025-07-07), Guia | Ver seção 4. | Hoje passa; endurecimento futuro é risco. |
| **Baixar, guardar, offline** | Políticas III.E.1 (a e b), III.E.6 | Proíbe baixar, importar, guardar ou fazer cópia de conteúdo audiovisual do YouTube sem aprovação por escrito, e tornar disponível para uso offline; proíbe raspagem. | Ver alternativa "áudio local" (seção 9). O texto da transcrição não é o conteúdo audiovisual, mas o assunto é da exploração de transcrição. |
| Dados do embed | Políticas III.E.4.i e III.E.4.j | O embed compartilha dados básicos do usuário com o YouTube; autoplay faz isso já no carregamento; vídeos "Made for Kids" exigem rastreamento desligado. | Informar no app que assistir envia dados ao YouTube. |

Dois pontos de honestidade:
- O protocolo `postMessage` cru não é descrito pela documentação. Os métodos que ele aciona (`seekTo`, `setPlaybackRate`, `pauseVideo`) **são os documentados**; só o meio de chegar a eles não é. Acho o risco de política baixo e o risco de mudança de formato médio, mas é julgamento meu, não garantia do YouTube.
- Não achei, em nenhuma página, uma regra sobre limite de uso do embed por volume que se aplique a um app pessoal. A página só diz que clientes de volume alto "podem precisar de credenciais".

---

## 7. Desenho da sincronização (ponto 6)

**Números medidos (Edge sem janela, vídeo de ~3,5 min, protocolo cru):**

| Medida | Resultado |
|---|---|
| Frequência das posições recebidas | uma a cada **266 ms** em média (250 a 278 ms); cerca de **3,75 por segundo**; 37 mensagens em 10 s |
| Atraso de cada mensagem (relógio do iframe x local) | mediana **2 ms**, máximo 13 ms (n = 25) |
| Deriva em 10 s | razão mídia/relógio de **1,0000** e 0,9998: não houve deriva do player |
| Velocidade | efetiva: 1,502 com 1,5x e 0,501 com 0,5x; a mensagem seguinte já traz `playbackRate`. A lista de velocidades disponíveis é 0,25 a 2 em passos de 0,25 |
| Saltar (`seekTo`) | a primeira mensagem já traz a posição pedida (estado 3, carregando); o vídeo **volta a avançar em ~0,2 s** (0,19 a 0,21) para um salto curto dentro do trecho já carregado, e **0,2 a 0,77 s (mediana 0,5)** para um salto longe. São limites superiores, porque a medida é quantizada pela frequência das mensagens |

**Pausa no fim da frase** (5 repetições por célula; segundos de vídeo passados do fim pedido; negativo = parou antes):

| Estratégia | 0,75x | 1x | 1,5x |
|---|---|---|---|
| Reativa: pausa quando a posição recebida chega ao fim | +0,16 (0,12 a 0,21) | +0,08 (0,02 a 0,15) | +0,20 (0,10 a 0,34) |
| Reativa com antecipação de 150 ms de relógio | +0,03 (-0,11 a +0,09) | +0,04 (-0,08 a +0,10) | +0,02 (-0,09 a +0,17) |
| **Preditiva:** agenda um temporizador local a partir da última posição e da velocidade, com 20 ms de folga | **-0,01** (-0,012 a -0,006) | **-0,01** (-0,017 a -0,007) | **-0,01** (-0,019 a +0,005) |

Amostra pequena (n = 5); serve como ordem de grandeza.

### Recomendações de desenho
1. **Posição:** receber as mensagens (forma B) e **interpolar** com o relógio local: `pos = currentTime + (agora - recebido) x playbackRate` enquanto o estado for "tocando", ou usar `currentTimeLastUpdated_`. Na forma A, o `getCurrentTime()` já é interpolado; ler a cada 100 ms basta. Não ler mais rápido do que a tela precisa.
2. **Achar a frase atual:** lista ordenada por início (vetor de inícios). A cada tick, conferir primeiro a frase atual e a seguinte (custo constante); só em salto de mais de uma frase, seek, ou troca de velocidade, **busca binária** (maior início menor ou igual à posição). Se a posição cai numa pausa entre frases, manter a anterior marcada até o início da próxima.
3. **Clicar na frase:** `seekTo(início - 0,15 s, true)` (a pequena folga cobre início de legenda um pouco tardio, que depende da fonte da transcrição). Durante o estado "carregando" (3), não deixar a marca pular; mostrar a frase de destino.
4. **Repetir a frase em laço:** na execução preditiva, `seekTo(início)` no fim. O intervalo de silêncio entre as repetições é de cerca de **0,2 s** para frases curtas (já carregadas).
5. **Pausa ao fim da frase:** usar a **preditiva**, que errou no máximo ~20 ms contra 0,1 a 0,3 s da reativa. Com a reativa, a próxima frase pode vazar no começo.
6. **Velocidade:** botões próprios (0,75x, 1x, 1,25x...), fora do player, chamando `setPlaybackRate`. A velocidade é "sugestão", então ler `playbackRate` de volta. A documentação diz que trocar de vídeo volta a taxa para 1: reaplicar.
7. **Usuário rola o texto para longe:** modo "seguir" ligado por padrão; **rolagem manual, seleção de texto ou abrir o popover de tradução desligam o seguir** e aparece um botão com **rótulo escrito** ("Follow") para voltar. A marca da frase atual deve usar o **CSS Custom Highlight** que o app já usa nas palavras guardadas (`DOCS/specs/languagestudy.md`), sem mexer no DOM: assim a seleção do usuário não se desfaz a cada troca de frase. Se rolar para uma frase longe e clicar, o clique salta.
8. **Anúncio e carregando:** congelar a marca e mostrar um aviso quando o estado não for "tocando" ou quando houver sinal de anúncio (hipótese da seção 5).
9. **Problemas conhecidos, verificados na prova:**
   - **O iframe com foco engole o teclado.** Depois de um clique dentro do player, a página pai recebe **zero** eventos de tecla. As teclas do player (por exemplo `k` para tocar e pausar) passam a valer. `disablekb=1` desliga os atalhos do player (verificado: a tecla `k` deixou de pausar), mas **não devolve** o teclado à página.
   - **Conserto verificado:** o `window` da página recebe um evento `blur` quando o foco entra no iframe; chamar `iframe.blur()` logo depois (ou dar foco a outro elemento) **devolve o teclado à página** (a tecla seguinte chegou), e o clique ainda produziu o efeito dele (tocar ou pausar). Os atalhos do Monet são listeners de `keydown` na própria página (48 registros em 43 arquivos de `src/`; não conferi o alvo de cada um), então sem esse conserto param. Ainda é preciso confirmar no WebView2.
   - **Tela cheia:** `requestFullscreen` no iframe com `allowfullscreen` foi aceito. Se a janela do Tauri acompanha, e o que o usuário vê, só a fase 0 diz. Na tela cheia a transcrição some, o que é esperado.
   - **Picture-in-picture:** fora do escopo (deixar fora do `allow`).

---

## 8. Se o embed não funcionar dentro do app (ponto 7): alternativas com veredito

| Alternativa | Veredito | O que pede das políticas do YouTube |
|---|---|---|
| **Domínio `youtube-nocookie.com`** | Não é alternativa ao Referer, é variante: tocou igual na prova e dá privacidade melhor; **não cura** o 153 de quem não tem Referer (`file://` deu 153 com ele). Escolher na fase 0 (recomendo nocookie). | Igual ao embed normal. |
| **Página intermediária hospedada** (HTTPS, com o iframe dentro; o app aponta o iframe para ela) | Funciona (relatado como confirmado em 2026-04 e 2026-08). Só vale como plano B se `http://tauri.localhost` deixar de passar. Custa hospedagem, um domínio remoto no `frame-src`, ponte de `postMessage` extra e dependência de rede para o próprio player. | O Referer vira o do site, não o do app; é cinzento diante do formato pedido (app ID). |
| **Definir o Referer no WebView2** (o conserto que a documentação do YouTube cita para .NET) | Reproduzi o princípio por CDP (`file://` passou a tocar com Referer injetado). No Tauri exigiria código em Rust contra a API do WebView2 (`with_webview`; **não confirmado** que o Tauri expõe o que é preciso). Só se o endereço padrão parar de passar. | É o jeito que a página pede (HTTPS com o ID do app). Para a Store, usar o AppID do `apps.microsoft.com/detail/<AppID>`. |
| **Janela separada do app apontando para o YouTube** | **Não.** Perde a API de controle (a página de assistir não expõe o `iframe_api`); controlar por script injetado altera a página do YouTube. Serve só como botão "Open on YouTube" abrindo o navegador do sistema, que deve existir de qualquer jeito como saída para os erros 101, 150 e 153. | Sem controle, não há sincronização. |
| **Tocar localmente o áudio que o Mincer já baixa** | Tecnicamente é o melhor para estudo (tempo exato, funciona offline, o "Listen" toca a voz original). **Mas guardar o áudio e tocá-lo vai contra** as Políticas III.E.1 (guardar, cache, offline) e III.I.7 (separar o áudio), e o próprio download pelo `yt-dlp` já está fora dos meios oficiais (assunto da exploração de transcrição). Para uso pessoal é decisão de risco do Coordenador; **para versão da Store, não**. Hoje o Mincer apaga o áudio depois de salvar. | Conflita nos pontos citados. |
| `tauri-plugin-localhost` (servir o app em `http://localhost:porta`) | **Não.** Relatado que o app perde o acesso aos comandos do Tauri, e não é preciso no Windows. | n/a |
| Mudar `useHttpsScheme` | **Não.** Perde localStorage/cookies/IndexedDB antigos e não é preciso (provado que as duas origens passam). | n/a |

---

## 9. Descrição do problema, dificuldade e recomendações

**Problema.** Abrir no Library uma página com o player do YouTube em cima e a transcrição embaixo, sincronizados.

**Dificuldade:** Média (Baixa para o embed e para a sincronização; Média no acabamento e na dependência de uma regra do YouTube que pode endurecer).

**Recomendações:**
1. **Forma B primeiro** (só `postMessage`, só `frame-src`), com uma interface do player no app (`play`, `pause`, `seek`, `setRate`, evento de posição e de estado, evento de erro) que permita trocar para a forma A (`iframe_api`, mais `script-src`) se o YouTube mudar o formato.
2. **Domínio `youtube-nocookie.com`** no `frame-src` e no iframe.
3. **Não mexer em `useHttpsScheme`.**
4. **Pausa no fim da frase pela estratégia preditiva** (erro de ~20 ms contra 0,1 a 0,3 s).
5. **Marca da frase atual pelo CSS Custom Highlight**, nunca por troca de DOM, para não desfazer seleção.
6. **Controles de estudo (repetir, voltar uma frase, velocidade) como botões nossos fora da área do vídeo.** Nenhuma camada sobre o iframe.
7. **Saída para os erros** (101, 150, 153, formato inválido sem evento, rede caída): mensagem única cobrindo as causas + botão **"Open on YouTube"** (navegador do sistema) + tempo limite. O texto da transcrição segue legível.
8. **Ao vivo e Shorts:** fora do escopo da primeira versão.
9. **Anúncio:** tratar como estado de "sincronização pausada" (hipótese a provar).
10. **Telas e cliques que o player engole:** na fase 0, devolver o foco ao app depois do clique no player (conserto da seção 7).

**Pontos para o Coordenador decidir (alimentam o estudo):**
- **D1:** forma B (sem script, protocolo não documentado, só `frame-src`) ou forma A (documentada, mas script do YouTube na janela principal)? Minha escolha: B, com A como plano B.
- **D2:** domínio do iframe: `youtube-nocookie.com` (minha escolha) ou `www.youtube.com`.
- **D3:** aceitar que o Monet depende de um Referer `http://tauri.localhost` que hoje passa mas **não é o formato que a página oficial pede** (HTTPS com o ID do app)? Se não aceitar, o custo é o código de Referer no WebView2 (seção 8).
- **D4:** a saída para erros ("Open on YouTube") abre o navegador do sistema, e o player não toca no app; confirmar que isso basta.

---

## 10. O que foi verificado e o que não foi

**Verificado na prova (Edge 158 sem janela, 2026-11-27):**
- Os Referers e as origens da tabela da seção 4; o 153 sem Referer.
- O CSP mínimo das duas formas e os domínios que cada uma toca.
- O protocolo `postMessage` (aperto de mão, comandos, leituras) e que `origin` tem que bater.
- A frequência (266 ms), o atraso (2 ms), a deriva (nenhuma em 10 s), o efeito de velocidade, o tempo de retomada depois de um salto.
- A pausa preditiva, reativa e reativa com antecipação.
- `sandbox`, foco do teclado, `disablekb`, `blur` e devolução do foco, `requestFullscreen` aceito.
- Que um ID inexistente e 4 de 6 IDs de transmissões ao vivo devolvem 150; que um ID de formato inválido não devolve nada.

**Verificado em documentação oficial (consulta em 2026-11-27):** IFrame Player API, parâmetros do player, Required Minimum Functionality (incluindo "API Client Identity and Credentials", de 2025-07-07), Políticas para Desenvolvedores e Guia de conformidade, histórico de revisões, Ajuda do YouTube (embed, anúncios em embeds, modo de privacidade) e referência de configuração do Tauri (`useHttpsScheme`, padrão `false`).

**Relato (fonte secundária):** issue #14422 do Tauri, os dois projetos que usam página hospedada, Obsidian/Electron, MAUI, o comentário de que "no Windows funciona", a ausência de Premium em embeds.

---

## 11. Não confirmado (só a fase 0 da implementação prova)

1. **O WebView2 real do app**, em `tauri dev`, num build NSIS e no MSIX: o Referer que sai de fato com a origem simulada pelo Tauri, e o comportamento com a política de rastreamento do WebView2.
2. **Anúncios:** se o vídeo escolhido tem anúncio no app, e o que a posição devolve durante ele. Nunca vi um anúncio.
3. **Um vídeo que o dono proibiu de embutir** e **um com restrição de idade** (o 150 não distingue). Shorts.
4. **Consentimento e cookies na União Europeia**; login e Premium.
5. **Tela cheia** (a janela do Tauri acompanha?), **o que o Tauri faz com "Assistir no YouTube"** (nova janela) e picture-in-picture.
6. **Som real, codecs e decodificação por hardware** (aqui só vídeo mudo e software).
7. **A devolução do foco** (`blur` + `iframe.blur()`) no WebView2.
8. **Se o iframe do YouTube consegue chamar os comandos do Tauri.** Não testei; o esperado é que o Tauri negue chamadas de origem remota, mas isso deve ser confirmado antes de liberar o `frame-src`.
9. **Estabilidade do protocolo cru** e **endurecimento futuro da regra do Referer** (formato HTTPS com ID do app). Nenhum dos dois dá para provar hoje.
10. **O MSIX da Store** mantém a origem `http://tauri.localhost` (inferência).

---

## 12. Limpeza e conformidade com as regras

- Servidor local de prova encerrado; **nenhum processo do Edge vivo** (conferido: 0 com o perfil da prova); porta de prova livre; a pasta de rascunho da prova (páginas, scripts, perfil temporário, capturas de tela, certificado descartável) **foi apagada** (conferido). O `vite` e o app dev do Coordenador seguem de pé, intocados.
- Não subi o app (`tauri dev`, `vite`), não li chave de API, nenhuma chamada paga. O Edge usou perfil temporário e nenhum login.
- Nos pedidos externos, nada que identifique usuário, projeto ou máquina. Este relatório não traz título, canal, link nem ID de vídeo.
- Nenhum `git clean -x`, nenhum commit, nenhuma alteração de código.

---

## 13. Fontes (consultadas em 2026-11-27)

Oficiais:
- IFrame Player API: `https://developers.google.com/youtube/iframe_api_reference`
- Parâmetros do player: `https://developers.google.com/youtube/player_parameters`
- Required Minimum Functionality: `https://developers.google.com/youtube/terms/required-minimum-functionality`
- Políticas para Desenvolvedores: `https://developers.google.com/youtube/terms/developer-policies`
- Guia de conformidade: `https://developers.google.com/youtube/terms/developer-policies-guide`
- Histórico de revisões dos Termos: `https://developers.google.com/youtube/terms/revision-history`
- Ajuda do YouTube, embed e modo de privacidade: `https://support.google.com/youtube/answer/171780`
- Ajuda do YouTube, anúncios em embeds: `https://support.google.com/youtube/answer/132596`
- Referência de configuração do Tauri (`useHttpsScheme`): `https://v2.tauri.app/reference/config/`

Secundárias:
- Tauri issue 14422: `https://github.com/tauri-apps/tauri/issues/14422`
- Sapling issue 19: `https://github.com/Danacus/sapling/issues/19`
- Gramax issue 821: `https://github.com/Gram-ax/gramax/issues/821`
- Simon Willison, Error 153 (2025-09-30, atualizado 2025-11-30): `https://til.simonwillison.net/youtube/fixing-153-embed`
- Fórum do Obsidian (Electron): `https://forum.obsidian.md/t/error-153-when-embedding-youtube-videos/105592`
- Microsoft Q&A, MAUI: `https://learn.microsoft.com/en-us/answers/questions/5750528/maui-youtube-video-link-error-code-153`
- Blog de fornecedor de proxy (fonte comercial, só como indício): `https://corsproxy.io/blog/fix-youtube-error-150-153-webview/`
