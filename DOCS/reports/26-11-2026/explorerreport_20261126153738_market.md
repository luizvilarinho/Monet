# Explorer Report — mercado e método para o leitor de estudo de línguas

> Pesquisa web feita em 2026-11-26 para o Task Report `taskreport_20261126134217.md`. Cobre o **R8** (referências de mercado) e dá base de método para o **R5** (praticar) e o **R6** (outras funcionalidades). Não repete `DOCS/features/mercado_2026-10/` (o `market_04` já cobre leitura, highlights e SRS; o `market_09` já descreve os estados de palavra do LingQ e o Vocabulary Builder do Kindle).

## Problema

O Coordenador quer que o Library sirva ao estudo contínuo de línguas: ouvir o texto, traduzir trechos e ganhar vocabulário, **sem conhecimento decorado** (nada de flashcards, repetição espaçada ou cartão de lacuna). A pergunta é como os produtos de referência resolvem isso e o que a pesquisa em aquisição de segunda língua diz sobre ganhar vocabulário lendo e ouvindo, sem drill.

**Resposta curta.** O mercado resolve bem o "consultar e ouvir" e quase sempre termina em cartões. A parte sem cartões que funciona nos produtos é uma só: **a palavra consultada fica marcada no texto e reaparece em contexto**. A pesquisa apoia três coisas: dar o sentido na hora e na língua nativa (quase dobra o que se aprende lendo), fazer a palavra voltar muitas vezes em contexto, e **usar** a palavra (recontar, escrever), que é o que mais rende. Pedir que o usuário adivinhe antes de ver a tradução **não** tem apoio.

**Um aviso honesto.** Ler sem nenhum apoio rende pouco por palavra: numa meta-análise de 24 estudos, a pessoa aprende em média cerca de 15% das palavras novas de um texto [E1]. O caminho sem drill é mais lento por palavra e compensa com volume de leitura, glosa e uso. Isso é coerente com o critério do Coordenador, mas convém saber o preço.

**Dificuldade** (impressão minha, sem olhar o código, que é assunto dos outros relatórios): **Média**. Os padrões que mais valem dependem de duas peças de base, a segmentação do texto em frases e a marcação de palavras no texto, nos dois leitores.

**Como ler as marcas.** Toda afirmação tem a fonte entre colchetes (lista no fim). "Impressão" é julgamento meu. "Não confirmei" é algo que não achei em fonte confiável hoje.

---

## 1. Como os produtos resolvem

| Produto | Gesto para traduzir | O que mostra | Áudio junto do texto | O que acontece com a palavra | Como ela volta (fora cartões) |
| --- | --- | --- | --- | --- | --- |
| **LingQ** | Clique na palavra; no modo frase, botão "Show Translation" [P1][P2] | Ao clicar na palavra nova, pede uma ação: guardar com um significado, marcar conhecida ou ignorar [P2]; tradução da frase só sob pedido [P1] | Modo frase toca o áudio da lição ou TTS da frase [P1] | Azul (nova), amarela (guardada, status 1 a 4), sem cor (conhecida) [P3][P4] | Fica amarela em todo texto futuro; no modo frase há "reordenar a frase" e "falar a frase" [P1] |
| **Readlang** | Clique na palavra; arrastar para expressão (6 a 12 palavras) [P6] | Tradução que considera a frase inteira; abas Explain (IA) e Dictionary [P8] | Vozes para palavra e frase; texto inteiro no plano mais caro; MP3 enviado ganha transcrição que marca cada palavra [P6][P8] | Salva sozinha, com a frase de origem [P7] | Lista de palavras; conversa escrita com IA que corrige [P7]. O resto é cartão |
| **Language Reactor** | Passar o mouse (popup) ou clicar (painel lateral) [P10] | Tradução automática e dicionário [P9] | Vídeo: pausa automática por legenda. Texto importado: tradução ao lado e leitura por TTS [P9] | Salvar palavra. Destaque por cor: não confirmei | Revisão de frases (PhrasePump), que é cartão [P10] |
| **Migaku** | Clique, ou mouse + Shift [P11] | Dicionário, frases de exemplo e explicação por IA [P11] | Foco em vídeo e legenda. Para texto: não confirmei | Sublinhado por estado: desconhecida, aprendendo, conhecida, ignorada [P12] | Análise de dificuldade do conteúdo pelas palavras conhecidas [P13]. O centro é o cartão em um clique |
| **Lute** (código aberto) | Clique abre a ficha; mouse em cima mostra popup; `t` traduz a frase, `Shift+t` o parágrafo [P14] | O que o próprio usuário anotou; forma base ("parent term"); dicionários externos [P14] | Player para áudio que o usuário fornece, com marcadores. **Sem TTS** [P14] | Status 1 a 5, "well known", "ignored"; nova aparece em azul; `h` liga e desliga o destaque [P14] | Destaque em todos os textos; aba com as frases onde o termo apareceu. **Sem teste nenhum**, por desenho [P14] |
| **Kindle** | Pressionar a palavra; selecionar trecho e escolher Translation [P15][P16] | Dicionário (pode ser bilíngue) e tradução automática. Word Wise põe dica curta acima das palavras difíceis sem gesto nenhum [P17] | Assistive Reader (TTS) com marcação do texto em tempo real; inglês, espanhol, francês, alemão, italiano [P18] | Entra sozinha no Vocabulary Builder, com a frase do livro [P15] | Word Wise repete a dica a cada ocorrência [P17]. O Vocabulary Builder é cartão |
| **Readwise Reader** | Selecionar 1 a 3 palavras (definir); selecionar trecho e tecla `G` (traduzir, explicar, simplificar) [P21] | Resposta de IA no chat lateral; prompts editáveis [P21] | TTS neural; começa no parágrafo do meio da tela e acompanha; 0,5x a 3x; não funciona offline [P20][P22] | Nada | Nada |
| **Speechify / NaturalReader / ElevenReader** | NaturalReader: clicar no texto pausado abre "Translate" [P24]. Os outros não traduzem | Tradução seca | Speechify marca a frase lida, 0,5x a 4,5x [P23]; NaturalReader deixa escolher marcação por palavra ou por frase e corrigir pronúncias [P24]; ElevenReader pula cabeçalho e rodapé na importação [P25] | Nada | Nada |
| **Leitor Imersivo** (Microsoft) | Clique na palavra com "Translate by word" ligado [P27] | Tradução seca, falada, em mais de 80 línguas [P29]; imagem da palavra; classes gramaticais por cor; sílabas [P26][P28] | Leitura em voz alta com marcação; foco de 1, 3 ou 5 linhas [P26] | Nada | Nada |
| **Beelinguapp** | Nenhum: o texto na língua nativa fica ao lado [P30] | Tradução paralela do trecho | Narração com marcação "karaokê" [P30] | Nada confirmado | Nada confirmado |
| **Leitores com IA de 2025–2026** (Ember, Close Reader, pimReader, LinguaRead) | Toque na palavra ou na frase [P31][P32] | Sentido **naquela frase**; explicação de gramática sob pedido; no Ember a IA roda no aparelho [P31] | Ember: "Read from Here" com marcação de frase e palavra [P31] | Salva com a frase | Quase todos terminam em repetição espaçada [P31][P32] |

**O que importa nessa tabela**

- **Ninguém se destacou em 2025–2026.** Surgiu uma safra de leitores pequenos com IA, todos parecidos: sentido no contexto, explicação sob pedido, e cartões no fim [P31][P32]. Não achei um líder. (Impressão: o espaço "leitor sério de livro + língua, sem cartões" está vago; só o Lute o ocupa, e ele não tem TTS nem tradução automática.)
- **O gesto dominante é o clique na palavra**, com arrasto para expressão. Hover só aparece em extensão de navegador (Language Reactor, Lute).
- **"Sentido no contexto da frase" virou o padrão** depois dos modelos de linguagem. O Readlang trocou a tradução palavra a palavra por uma que lê a frase inteira [P8].
- **Dois grupos que não se falam.** Os leitores de voz (Speechify, ElevenReader, NaturalReader, Readwise) têm o melhor áudio e nenhum vocabulário. Os leitores de língua (LingQ, Lute, Migaku) têm vocabulário e áudio fraco ou nenhum. Juntar os dois num leitor de livro é o que o Task Report propõe, e é raro no mercado.
- **A única mecânica sem cartão que se repete** é a marcação persistente da palavra no texto (LingQ, Lute, Migaku) e a dica que reaparece (Word Wise).

---

## 2. Padrões que valem copiar e o que evitar

### Valem copiar

1. **Sentido no contexto, com a frase guardada junto.** A palavra nunca é salva sozinha: vai com a frase onde apareceu (Readlang [P7], Vocabulary Builder [P15], leitores novos [P31]).
2. **Palavra consultada marcada em todo texto futuro, com chave para desligar.** É o que faz a palavra "voltar" sem sessão de revisão (LingQ [P3], Lute com a tecla `h` [P14]).
3. **"Ouvir a partir daqui" com a frase marcada, velocidade lenta e ajuste por teclado.** Começar pelo parágrafo visível e seguir a leitura na tela (Readwise [P20], Speechify [P23], Ember [P31]).
4. **Modo frase com a tradução atrás de um botão.** Uma frase por vez, áudio da frase, tradução só quando pedida (LingQ [P1]). O foco de linha do Leitor Imersivo é o primo simples disso [P26].
5. **"Frases onde esta palavra apareceu".** Ver a palavra em vários contextos reais do que a pessoa leu (Lute [P14]; "Usage" no Kindle [P15]).
6. **Limpar o texto antes de falar e deixar corrigir pronúncia.** Pular cabeçalho e rodapé (ElevenReader [P25]); editor de pronúncia para nomes (NaturalReader [P24]).

### Evitar

1. **Tradução a um toque sem nenhum freio vira muleta.** Queixa recorrente entre quem estuda: com a resposta sempre a um toque, não se treina inferir pelo contexto. A regra prática citada é só consultar na terceira vez que a palavra aparece [C1]. Um fórum de estudantes chega ao meio-termo "manter o dicionário, mas desligado por padrão" [C2]. (Ver a seção 3: a pesquisa não manda dificultar a primeira consulta; o freio certo é outro.)
2. **Gestão de palavras e contagem que viram o objetivo.** No fórum do LingQ: usuário que revisou algumas centenas das suas 2000 "palavras conhecidas" e sabia menos de um terço fora da frase original [C3]; gente "sobrecarregada" com a lista [C4]; usuários experientes que ignoram as estatísticas e dizem que criar e ajustar LingQs é perda de tempo e que ler é a revisão [C5].
3. **Voz robótica, voz da língua errada e marcação fora de sincronia.** Reclamações antigas e recentes sobre o TTS do LingQ ("overly robotic"), vozes de holandês e japonês ruins e transcrição desalinhada do áudio [C6]. No Beelinguapp, áudio fora de sincronia e texto que rola para longe do trecho lido [P30]. O Readwise corrigiu em out/2026 vozes de alemão que eram vozes inglesas lendo alemão [P22].
4. **Dica automática sem critério.** Reviews do Word Wise dizem que a escolha das palavras com dica "parece aleatória" e há quem ache a dica irritante [P19]. (Impressão: ajuda que aparece sem ser pedida também contraria a visão de produto, "a IA fica à mão sem se impor".)

---

## 3. Evidência de método, sem drill

| Tema | O que os estudos dizem | Força da evidência |
| --- | --- | --- |
| **Ler ouvindo ao mesmo tempo** | Ganho de vocabulário parecido entre ler, ouvir e ler ouvindo (cerca de 13% a 17% das palavras novas) [E1]. Na compreensão, vantagem pequena (g = 0,18), que **some quando a pessoa controla o próprio ritmo** (g = 0,06) [E2]. Num estudo clássico, os alunos preferiram ler ouvindo [E3]. | Moderada. Duas meta-análises; a de compreensão mistura língua materna e segunda língua. |
| **Cobertura de palavras conhecidas** | 95% é o mínimo e 98% o ideal para ler com proveito [E4]. Outro estudo grande não achou degrau: a compreensão sobe em linha com a cobertura, sem limiar [E5]. | Boa, mas correlacional. O número exato é discutível; a direção não. |
| **Glosa (tradução à mão)** | Meta-análise de 42 estudos: com glosa aprende-se 45% das palavras contra 27% sem glosa (teste imediato) e 33% contra 20% (teste tardio). Glosa **na língua nativa** rende mais que na língua-alvo. Glosa de múltipla escolha foi a melhor; glossário separado, a pior [E6]. Estudo com alunos de francês: quem tinha dicionário quase não consultava; glosa à mão venceu [E7]. | Forte para "glosa ajuda" e "língua nativa ajuda mais". |
| **Número de encontros** | Mais encontros, mais aprendizado: correlação média r = 0,34 (meta-análise) [E8]. Palavras vistas menos de 8 vezes num livro graduado não sobreviveram a 3 meses [E9]; num romance, ganho claro acima de 10 encontros [E10]. | Boa para "repetição em contexto ajuda". Fraca para um número mágico: a repetição explica só parte do resultado. |
| **Releitura e escuta repetida** | Reler o mesmo texto com áudio, 5 vezes: todo dia rende mais no teste imediato; uma vez por semana rende mais na retenção [E11]. | Fraca a moderada. Um estudo (71 alunos); a replicação só confirmou a parte imediata. |
| **Leitura estreita** (mesmo autor ou tema) | A lógica é sólida (as mesmas palavras voltam). O estudo que li mostra ganho de significado maior que de grafia e de uso, sem grupo de comparação claro [E12]. | Fraca. Poucos estudos e pequenos. |
| **Shadowing** (repetir junto com o áudio) | Melhora a percepção dos sons e a escuta, mais em quem está no nível baixo; funciona melhor **depois** de entender o conteúdo; doses curtas (10 a 15 min) [E13]. | Moderada para escuta. Para pronúncia, só achei um estudo de 16 pessoas e não li o resultado [E14]. |
| **Ditado** | Estudos pequenos e resultados mistos: um achou ganho na escuta, outro não achou diferença em um semestre [E15]. | Fraca. |
| **Carga de envolvimento** | Meta-análise de 42 estudos: a hipótese original explica pouco. O componente "buscar ou inferir o sentido" **não contribuiu**. O que mais rende é **usar a palavra numa composição** (+23%) e **numa frase própria** (+15%), precisar da palavra para a tarefa (+21%) e cada encontro a mais (+9%) [E16]. Inferir e depois conferir deu a mesma retenção que receber o sentido, gastando bem mais tempo [E17]. | Forte (meta-análise), com a ressalva de que mede tarefas de sala de aula. |
| **Lembrar x adivinhar** | Recuperar de memória o sentido de uma palavra já vista reteve mais do que inferi-lo de um contexto rico [E18]. Um estudo posterior do mesmo grupo não repetiu a vantagem em todos os desenhos [E18]. | Moderada, com resultado misto. |

### O que isso recomenda para o desenho

- **Primeira consulta: mostrar o sentido na hora, no contexto, na língua nativa.** Exigir tentativa antes não tem apoio: buscar ou inferir não acrescentou aprendizado [E16] e custa tempo [E17]. O "tentar antes de revelar" do R3, se aplicado à primeira consulta, é fricção sem ganho.
- **O esforço que vale é lembrar, não adivinhar.** Quando a pessoa clica numa palavra que **já consultou antes**, faz sentido mostrar primeiro a frase onde a viu e deixar o sentido a um toque. Isso é recuperação dentro da leitura, não sessão de cartões [E18]. É o ponto mais perto da linha traçada pelo Coordenador; por isso entra como opção e como decisão dele, não como padrão.
- **Fazer a palavra voltar em contexto.** Marcar discretamente as ocorrências seguintes da palavra consultada, no mesmo livro e em outros, e mostrar as frases anteriores [E8][E9]. Sem agenda de revisão.
- **O ganho grande está no uso.** Recontar o trecho e escrever com as palavras novas rendem mais que qualquer forma de consulta [E16][E19].
- **Áudio no ritmo do usuário.** Como a vantagem de ler ouvindo some quando a pessoa controla o ritmo [E2], o áudio serve à pronúncia e à constância, não a "aprender mais rápido". Controles de pausa, repetir frase e velocidade lenta importam mais que a leitura contínua.

---

## 4. Praticar vocabulário com elaboração, sem decoreba

| Prática | Algum produto faz? | Há evidência? |
| --- | --- | --- |
| **Escrever uma frase própria com a palavra** | Readlang tem conversa escrita com IA que corrige [P7]. Nenhum leitor pede a frase a partir da palavra consultada (não achei). | Sim, com ressalva. Uso em frase: +15% (imediato) e +11,5% (tardio) [E16]. Mas escrever frase **no primeiro contato** com a palavra atrapalhou a fixação da forma [E20]. Vale para palavra já reencontrada. |
| **Recontar o trecho com as palavras novas** | Nenhum leitor faz de forma nativa (não achei). | Sim, a mais forte desta lista. Ver, resumir em voz alta e ver de novo fez lembrar mais significados que ver duas vezes, no teste imediato e no tardio [E19]. Uso em composição: +23% e +21% [E16]. |
| **Responder perguntas de compreensão** | NaturalReader gera quizzes e perguntas por IA [P24]. | Parcial. Técnicas que fazem a pessoa precisar da palavra e voltar a ela depois da leitura aumentam o que se aprende lendo [E21]; "precisar da palavra" vale +21% [E16]. Pergunta que não depende das palavras novas não ajuda o vocabulário (impressão). |
| **Reencontrar a palavra marcada em outros livros** | LingQ, Lute e Migaku [P3][P14][P12]. | Sim. Repetição em contexto [E8][E9]. |
| **Ouvir de novo só as frases que tiveram consulta** | Não achei produto que faça exatamente isso. O modo frase do LingQ lista as palavras guardadas de cada frase [P1]. | Indireta. Releitura com áudio ajuda, e espaçada retém mais [E11]. É uma ideia própria deste estudo, barata se o áudio já estiver em cache (impressão). |
| **Shadowing da frase** | LingQ tem exercício de falar a frase com retorno [P1]. | Moderada para escuta, depois de entender o texto [E13]. |

---

## 5. Outras funcionalidades do R6

- **Tradução paralela (bilíngue).** O mercado tem (Beelinguapp [P30]; Immersive Translate gera EPUB e PDF bilíngues [P33]). Um estudo com 82 alunos achou mais vocabulário retido com texto bilíngue ou glosado do que com texto só na língua-alvo [E22]; a crítica conhecida é que reduz o trabalho de quem lê [C7]. **Veredito: entra por parágrafo e sob pedido, escondida por padrão; página inteira traduzida como modo padrão fica fora.**
- **Reescrita simplificada de trecho.** Existe (Ghostreader simplifica [P21]; LingQ vende "lições simplificadas por IA" [P5]). Texto **elaborado** (que explica as palavras difíceis sem cortar nada) melhorou compreensão e vocabulário frente ao original num estudo com 143 alunos [E23]; um estudo de 2025 não achou ganho de compreensão com texto simplificado por IA [E24]. **Veredito: depois, e como paráfrase ao lado do original, nunca no lugar dele.**
- **Retorno de pronúncia com gravação.** LingQ tem [P1]. Reconhecimento de fala com correção tem efeito médio (g = 0,69, 15 estudos), forte para sons isolados e fraco para ritmo e entonação [E25]. **Veredito: depois. O começo barato é shadowing sem nota: ouvir, gravar, ouvir os dois (impressão; não achei estudo sobre a autocomparação).**
- **Exportar áudio.** NaturalReader exporta MP3 no plano pago [P24]; ElevenReader tem offline só no plano pago e exporta pela plataforma web [P25]; Readwise não funciona offline [P20]. Não há evidência específica; a de reescuta apoia ouvir de novo o que já foi lido [E11]. **Veredito: depois, só de capítulo já lido, por causa do custo.**

---

## Recomendações de desenho

Para um leitor de estudo de línguas sem flashcards.

1. **Tradução da palavra no contexto da frase, na língua nativa, mostrada na hora.** Sem tentativa obrigatória na primeira consulta. — [E6] glosa quase dobra o ganho e a nativa rende mais; [E16][E17] inferir antes não acrescenta.
2. **Guardar sempre a frase de origem junto com a palavra**, e o livro e a posição. — [P7][P15] padrão do mercado; [E8] o que fixa é o encontro em contexto.
3. **Marcar de leve no texto as palavras já consultadas, em todos os livros, com chave para desligar.** É o mecanismo de "revisão" do produto. — [P3][P14]; [E8][E9] mais encontros, mais retenção.
4. **No reencontro de palavra já consultada, mostrar antes a frase onde ela foi vista e deixar o sentido a um toque.** Opcional. É lembrar, não adivinhar. Decisão do Coordenador, por ser o ponto mais próximo do que ele excluiu. — [E18]; [C1] regra de três.
5. **Sem estados manuais e sem contagem como meta.** No máximo "consultada N vezes" e um "já sei" que tira a marca. Contraria o item "estados (nova, aprendendo, conhecida)" do R4. — [C3][C4][C5] a gestão vira o objetivo e as contagens enganam.
6. **"Ouvir a partir daqui" com a frase marcada, velocidade lenta, repetir frase e atalhos; voz nativa da língua do livro.** — [P20][P23][P31]; [C6] voz errada e fora de sincronia são as queixas mais comuns; [E2] o ganho vem do ritmo controlado.
7. **Qualidade da voz: clareza acima de naturalidade perfeita.** Alunos entenderam voz sintética tão bem quanto humana e só a acharam menos natural [E26]. Vale testar as vozes de ouvido, na língua certa, antes de decidir o provedor.
8. **Limpar o texto antes de falar** (cabeçalho, rodapé, número de página, hifenização) e permitir corrigir a pronúncia de nomes. — [P25][P24].
9. **Modo frase ou foco de linha, com a tradução da frase e do parágrafo atrás de um botão.** É a forma certa da "tradução paralela". — [P1][P26]; [E22] bilíngue ajuda; [C7] visível o tempo todo tira o esforço.
10. **A prática principal é recontar.** Ao fim da sessão, convidar a recontar o trecho com as palavras consultadas, por escrito na nota do livro ou em voz alta, com o tutor comentando. Mantém o trabalho do usuário no centro. — [E19]; [E16] uso em composição é o que mais rende.
11. **Frase própria só para palavra já reencontrada, nunca no primeiro contato.** — [E16] rende; [E20] no primeiro contato atrapalha.
12. **"Ouvir de novo as frases consultadas" alguns dias depois**, como reescuta da sessão, e shadowing depois de entender o trecho. — [E11] espaçado retém mais; [E13].

**Fora da lista, mas vale registrar:** mostrar a cobertura estimada do livro (quanto do vocabulário a pessoa já encontrou) serve como aviso de dificuldade, não como meta [E4][E5]; e sugerir o próximo livro do mesmo autor ou tema é um jeito barato de fazer as palavras voltarem (evidência fraca [E12]).

---

## Limites desta pesquisa

- Não acessei o Reddit. As reclamações vêm de fóruns oficiais, blogs de estudantes e lojas de apps.
- Vários artigos li só pelo resumo ou por citação em outro artigo: [E3], [E5], [E7], [E9], [E10], [E21]. Os números de [E1] vieram do resumo exibido na busca, não do artigo.
- Em [E3], a preferência dos alunos por ler ouvindo é o que conheço do artigo; hoje só consegui abrir a ficha e uma citação. Em [E15], os dois links são os que a busca devolveu para esses estudos; não abri os PDFs.
- A evidência é quase toda de alunos de inglês em sala de aula, com textos curtos. Leitura de livro inteiro por adulto autodidata, em francês, é uma extrapolação.
- Não confirmei: destaque por cor de palavra salva no Language Reactor; áudio para texto no Migaku; línguas atuais do Word Wise (fontes de terceiros dizem só inglês e chinês [P17]); recursos de vocabulário do Beelinguapp.
- Preços e planos mudam; confirmar na página oficial antes de usar como argumento.

---

## Fontes

### Produtos

- [P1] Fórum LingQ, "Sentence Mode: How & why to use it" — https://forum.lingq.com/t/sentence-mode-how-why-to-use-it/8735
- [P2] Fórum LingQ, "New learner guide" — https://forum.lingq.com/t/new-learner-guide/8719
- [P3] Suporte LingQ, status de um LingQ — https://lingq-support.groovehq.com/help/can-you-explain-a-lingqs-status
- [P4] FluentU, review do LingQ (palavras azuis) — https://www.fluentu.com/blog/lingq-review/
- [P5] Headway, review do LingQ (planos, set/2026) — https://makeheadway.com/blog/lingq-review/
- [P6] Readlang, página inicial e planos — https://readlang.com/
- [P7] Readlang, recursos — https://readlang.com/features
- [P8] Blog do Readlang, tradução sensível ao contexto (2024-12-04) — https://blog.readlang.com/2024/12/04/context-aware-translations-and-two-other-features.html
- [P9] Language Reactor na Chrome Web Store (v6.0.1, 2026-10-19) — https://chromewebstore.google.com/detail/language-reactor/hoombieeljmmljlkjmnheibnpciblicm?hl=en
- [P10] Filmora, review do Language Reactor — https://filmora.wondershare.com/more-tips/language-reactor-review.html ; fórum LingQ sobre o comportamento hover/clique — https://forum.lingq.com/t/lingq-ui-feature-ideas/1266449
- [P11] Blog do Migaku, popup dictionary — https://migaku.com/blog/youtube/the-popup-dictionary-migaku-browser-extension
- [P12] Blog do Migaku, estados das palavras — https://migaku.com/blog/youtube/supercharge-your-language-learning-tracking-learned-words
- [P13] Migaku na Chrome Web Store — https://chromewebstore.google.com/detail/migaku-really-learn-langu/lkhiljgmbeecmljiogckofcalncmfnfo
- [P14] Manual do Lute v3 — https://luteorg.github.io/lute-manual/print.html
- [P15] FluentU, tradução e Vocabulary Builder no Kindle — https://www.fluentu.com/blog/kindle-translate-languages/
- [P16] Guias de terceiros sobre a aba Translation do Kindle (não achei página oficial) — https://www.guidingtech.com/how-to-use-dictionary-in-kindle/ ; https://ebookfriendly.com/translate-words-in-kindle-app/
- [P17] ScreenRant, Word Wise — https://screenrant.com/amazon-kindle-word-wise-feature-use-how/
- [P18] Amazon, recursos de acessibilidade do Kindle (Assistive Reader) — https://aboutamazon.com/news/books-and-authors/kindle-accessibility-features-for-all-readers ; ajuda do Assistive Reader (línguas) — https://digprjsurvey.amazon.com/csad/help/node/TdHCSXXqsdhaVKt3Tc
- [P19] The eBook Reader, review do Word Wise — https://blog.the-ebook-reader.com/2014/11/16/kindle-word-wise-review-and-free-ebook-samples/
- [P20] Readwise, FAQ de text-to-speech — https://docs.readwise.io/reader/docs/faqs/text-to-speech
- [P21] Readwise, Ghostreader — https://docs.readwise.io/reader/guides/ghostreader/overview
- [P22] Readwise Reader na App Store e changelog — https://apps.apple.com/app/id1567599761 ; https://docs.readwise.io/changelog
- [P23] Speechify, guia do web app — https://speechify.com/blog/ultimate-guide-to-the-speechify-web-app-for-text-to-speech/
- [P24] NaturalReader, recursos — https://help.naturalreaders.com/en/articles/8823808-features
- [P25] ElevenReader — https://elevenreader.io/
- [P26] Microsoft, Leitor Imersivo — https://support.microsoft.com/en-us/topic/e7d7d585-c747-46d0-8ed4-344b2d74ae79
- [P27] University of the Fraser Valley, guia do Leitor Imersivo (tradução por palavra) — https://itservicedesk.ufv.ca/TDClient/52/ITServicesPortal/KB/Article/13541/Using-the-Immersive-Reader
- [P28] Microsoft, Picture Dictionary — https://support.microsoft.com/en-US/education/define-words-using-immersive-reader-picture-dictionary
- [P29] Microsoft Learn, Leitor Imersivo no Edge (línguas) — https://learn.microsoft.com/en-us/training/modules/research-learn-using-microsoft-edge/immersive-reader
- [P30] Beelinguapp: review da Lingopie (concorrente, ler com cautela) — https://lingopie.com/blog/beelinguapp-review/ ; Think in Italian — https://www.thinkinitalian.com/app-review/beelinguapp ; avaliações de usuários — https://justuseapp.com/en/app/1225056371/beelinguapp-language-learning/reviews
- [P31] Ember na App Store — https://apps.apple.com/us/app/ember-reader/id6759223533
- [P32] Close Reader — https://play.google.com/store/apps/details?id=app.closereader ; pimReader — https://play.google.com/store/apps/details?id=com.pimreader ; LinguaRead — https://apps.apple.com/pg/app/id6752629153
- [P33] Immersive Translate, EPUB bilíngue — https://immersivetranslate.com/en/document/epub-translator

### Reclamações de usuários

- [C1] Hacking Chinese, "Why using a good dictionary can be bad for your Chinese reading ability" (2025-04-21) — https://www.hackingchinese.com/why-using-a-good-dictionary-can-be-bad-for-your-chinese-reading-ability/
- [C2] Chinese-forums, "Pop-up dictionaries: how perilous are they" — https://chinese-forums.com/forums/topic/44400-pop-up-dictionaries-how-perilous-are-they
- [C3] Fórum LingQ, "LingQ: The Illusion of Learning" (jan/2025) — https://forum.lingq.com/t/lingq-the-illusion-of-learning/975663
- [C4] Fórum LingQ, "I'm overwhelmed with my vocab list" — https://www.lingq.com/en/forum/open-forum/im-overwhelmed-with-my-vocab-l/
- [C5] Fórum LingQ, tópicos sobre parar de gerenciar palavras — https://forum.lingq.com/t/when-should-i-stop-using-lingq/330133 ; https://forum.lingq.com/t/advise-to-new-users/976017/1 ; https://forum.lingq.com/t/how-do-users-use-lingq/2347317
- [C6] Fórum LingQ, TTS e sincronia — https://forum.lingq.com/t/improved-text-to-speech/71257 ; https://forum.lingq.com/t/dutch-tts-voices/73127 ; https://forum.lingq.com/t/will-japanese-ai-tts-ever-be-functional/2620800 ; https://forum.lingq.com/t/audio-and-transcript-sync-issues/741321
- [C7] Crítica ao texto paralelo: Kazakov (EDULEARN 2021) — https://library.iated.org/view/KAZAKOV2021PAR ; blog do Readlang (2013) — https://blog.readlang.com/2013/02/03/parallel-texts.html

### Estudos

- [E1] Webb, Uchihara & Yanagisawa (2023), "How effective is second language incidental vocabulary learning? A meta-analysis", *Language Teaching* — https://doi.org/10.1017/S0261444822000507
- [E2] Clinton-Lisell (2023), "Does Reading while Listening to Text Improve Comprehension Compared to Reading Only?", meta-análise, 30 estudos — https://commons.und.edu/ehb-fac/75
- [E3] Brown, Waring & Donkaewbua (2008), *Reading in a Foreign Language* 20(2) — https://nflrc.hawaii.edu/rfl/item/174 (resultado lido em citação: https://link.springer.com/10.1186/s40468-025-00367-8)
- [E4] Laufer & Ravenhorst-Kalovski (2010), "Lexical threshold revisited" — https://scholarspace.manoa.hawaii.edu/items/eaead47e-853e-4797-ba6f-596df150c1d7
- [E5] Schmitt, Jiang & Grabe (2011), "The Percentage of Words Known in a Text and Reading Comprehension" — https://www.lextutor.ca/cover/papers/schmitt_etal_2011.pdf
- [E6] Yanagisawa, Webb & Uchihara (2020), meta-regressão sobre glosas, *Studies in Second Language Acquisition* — https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/how-do-different-forms-of-glossing-contribute-to-l2-vocabulary-learning-from-reading/38124150D59DF3039EE1FF5AE88FE922
- [E7] Hulstijn, Hollander & Greidanus (1996), *The Modern Language Journal* — https://www.dare.uva.nl/id/93e7e0c0-a63f-45b0-860b-943f3155d979
- [E8] Uchihara, Webb & Yanagisawa (2019), "The Effects of Repetition on Incidental Vocabulary Learning", *Language Learning* — https://doi.org/10.1111/lang.12343
- [E9] Waring & Takaki (2003), *Reading in a Foreign Language* — https://www.wgtn.ac.nz/__data/assets/pdf_file/0008/1626146/Waring-Takaki-2003.pdf
- [E10] Pellicer-Sánchez & Schmitt (2010), "Incidental vocabulary acquisition from an authentic novel" — https://core.ac.uk/download/323109991.pdf
- [E11] Serrano & Huang (2018), "Learning Vocabulary Through Assisted Repeated Reading", *TESOL Quarterly* — https://diposit.ub.edu/dspace/handle/2445/164091
- [E12] Chang (2019), "Effects of narrow reading and listening on L2 vocabulary learning", *SSLA* — https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/abs/effects-of-narrow-reading-and-listening-on-l2-vocabulary-learning/636D23C4D711F7E93779D98BF7F16F8B
- [E13] Hamada, shadowing: "Shadowing: What is It? How to Use It. Where Will It Go?" — https://journals.sagepub.com/doi/10.1177/0033688218771380 ; antes ou depois de entender o conteúdo — https://jalt-publications.org/node/3537 ; guia para professores — https://contact.teslontario.org/wp-content/uploads/2018/08/Hamada-Shadowing.pdf
- [E14] Foote & McDonough (2017), shadowing com tecnologia móvel, *Journal of Second Language Pronunciation* 3(1) — https://doi.org/10.1075/jslp.3.1.02foo
- [E15] Ditado: Kiany & Shiramiry (2002), *TESL Canada Journal* — https://teslcanadajournal.ca/index.php/tesl/article/download/938/757/965 ; Nam & Seong (2009) — https://koreascience.kr/article/JAKO200917357306519.pdf
- [E16] Yanagisawa & Webb (2022), "Involvement Load Hypothesis Plus", *SSLA* — https://www.cambridge.org/core/product/5C5984B326F37FBF3A3DDA3C0EB2996C ; meta-análise anterior (2021), *Language Learning* — https://doi.org/10.1111/lang.12444
- [E17] Mondria (2003), "The effects of inferring, verifying, and memorizing on the retention of L2 word meanings", *SSLA* — https://doi.org/10.1017/S0272263103000202
- [E18] van den Broek, Takashima, Segers & Verhoeven (2018), *Language Learning* — https://doi.org/10.1111/lang.12285 ; estudo posterior com resultado misto — https://pmc.ncbi.nlm.nih.gov/articles/PMC9285746
- [E19] Nguyen & Boers (2019), "The Effect of Content Retelling on Vocabulary Uptake From a TED Talk", *TESOL Quarterly* — https://core.ac.uk/download/215386365.pdf
- [E20] Barcroft (2004), "Effects of sentence writing in second language lexical acquisition" — https://profiles.wustl.edu/en/publications/effects-of-sentence-writing-in-second-language-lexical-acquisitio/
- [E21] Peters, Hulstijn, Sercu & Lutjeharms (2009), *Language Learning* — https://dare.uva.nl/id/e057b51b-4d0b-40be-9e68-a2c74c047c65
- [E22] Zhang & Webb (2019), "The effects of reading bilingual books on vocabulary learning" — https://nflrc.hawaii.edu/rfl/item/419
- [E23] Huang & Supasiraprapa, texto elaborado x original (*PASAA*) — https://so11.tci-thaijo.org/index.php/PASAA/article/view/2305
- [E24] Murphy Odo (2025), "Comprehensibility of AI-generated and human simplified texts for L2 learners", *Language Learning & Technology* — https://scholarspace.manoa.hawaii.edu/items/e03eae07-5d53-4936-9cb3-8c3f9c748921
- [E25] Ngo, Chen & Lai (2024), meta-análise de reconhecimento de fala na pronúncia, *ReCALL* — https://www.cambridge.org/core/journals/recall/article/effectiveness-of-automatic-speech-recognition-in-eslefl-pronunciation-a-metaanalysis/A915444CF252B61D14961D2FE733822D
- [E26] Bione & Cardoso (2020), "Synthetic voices in the foreign language context", *Language Learning & Technology* (29 alunos brasileiros de inglês) — https://www.lltjournal.org/item-detail/944/
