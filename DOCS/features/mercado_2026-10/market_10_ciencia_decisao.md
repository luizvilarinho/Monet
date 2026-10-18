# Ciência da decisão, overreliance e aprendizado: evidências para o "companheiro de decisão" do Monet

*Levantamento feito em 2026-10-17. Áreas: HCI, ciência cognitiva, ciência da decisão e engenharia de software. Método: busca e leitura de fontes primárias (artigos, preprints, relatórios, PDFs). Quando um número veio de fonte secundária, isso está indicado ("via ...").*

**Público-alvo do produto:** um desenvolvedor que programa com agentes de IA, tem dificuldade em decisões técnicas (arquitetura, bibliotecas, aprovar planos do agente) e usa a IA para entender termos e comparar opções.
**Tese:** a IA explica, abre opções e provoca; o usuário decide e registra.

---

## (a) Resumo executivo

1. **O maior risco é o usuário aceitar o erro da IA, não a IA errar.** Explicações de IA aumentam a aceitação das recomendações *estejam elas certas ou não* (Bansal et al., CHI 2021). Explicações mais longas aumentam a confiança sem aumentar a acurácia (Steyvers et al., *Nature Machine Intelligence* 2025). Entre 319 profissionais, quem confiava mais na IA relatou pensar menos criticamente (coeficiente −0,69, p < 0,001), e quem confiava mais em si mesmo pensou mais (+0,26) (Lee et al., CHI 2025, Microsoft). Com IA, as pessoas resolvem melhor, mas superestimam o próprio desempenho (Fernandes et al., 2025).
2. **Em desenvolvedores, o custo aparece no aprendizado, não na entrega imediata.** Num RCT da Anthropic (52 devs aprendendo a biblioteca Trio), o grupo com IA fez 50% no quiz contra 67% sem IA (d = 0,74). A maior perda foi em depuração, e o ganho de tempo (cerca de 2 min) não foi significativo. Quem usou a IA só para perguntas conceituais ficou com 65% ou mais. No METR, devs experientes ficaram 19% *mais lentos* com IA e mesmo assim acreditavam estar 20% mais rápidos.
3. **As intervenções que funcionam são as menos apreciadas.** As *cognitive forcing functions* (decidir antes de ver a IA, IA sob demanda, espera) reduzem o excesso de confiança. Foram também as menos preferidas, e beneficiaram sobretudo quem gosta de pensar (Buçinca et al., 2021). Logo, satisfação é uma métrica enganosa. Usuários também preferem e confiam mais em IAs bajuladoras (Cheng et al., *Science* 2026).
4. **O desenho mais promissor para decidir e aprender ao mesmo tempo é a "IA avaliativa":** a IA organiza opções e evidências a favor e contra, e o usuário decide. Explicação sem recomendação gerou decisões melhores *e* aprendizado. Recomendação com explicação gerou decisões melhores *sem* aprendizado (Gajos & Mamykina, IUI 2022). Abordagens orientadas por hipóteses aumentam a acurácia e reduzem a dependência (Le, Miller et al., 2024). Já recomendações baixam o limiar de evidência que a pessoa exige para decidir (Benk & Miller, 2026).
5. **Provocar ajuda quando a provocação é específica, a decisão importa e isso acontece raramente. Irrita quando é genérica, a tarefa é urgente e vem sempre.** Provocações de uma ou duas frases estimularam metacognição em tarefas de alto risco, mas viraram "texto de aviso" ignorado em tarefas rápidas (Drosos, Sarkar et al., 2025). Um tutor GPT-4 com salvaguardas evitou a queda de 17% na prova vista com o ChatGPT sem restrições (Bastani et al., PNAS 2025). Já um tutor socrático "puro" aumentou o engajamento, não melhorou o aprendizado e foi visto como menos útil (Blasco & Charisi).
6. **Explicar de volta funciona, desde que seja curto e opcional.** Autoexplicação tem g = 0,55 (meta-análise). Ensinar tem d ≈ 0,8–0,9 no teste tardio. *Teach-back* foi eficaz em 19 de 20 estudos. A personalização que tem evidência é pelo **conhecimento prévio** (efeito de reversão da expertise), não por "estilo de aprendizagem", que não tem evidência.
7. **Termos aprendidos no trabalho só ficam se forem recuperados com espaçamento.** Testagem (g ≈ 0,50 em 222 estudos de sala de aula) e espaçamento (intervalo ótimo de cerca de 10–20% do horizonte de retenção) estão entre os achados mais robustos da psicologia da aprendizagem. Glossário passivo (reler) tem baixa utilidade.
8. **A higiene de decisão tem base sólida no núcleo e folclore na periferia.**
   - Desenvolver várias alternativas está associado a mais sucesso: de 56% para 70%, em 356 decisões (Nutt, 1999).
   - Lembrar o custo de oportunidade muda escolhas: a intenção de compra caiu de 75% para 55%.
   - Treinos curtos contra vieses transferem para casos de campo: 29% menos escolhas enviesadas.
   - O pre-mortem tem evidência escassa, mas positiva. O popular "+30% de acerto" é uma distorção do estudo original.
   - ADRs são pouco adotados e, quando adotados, rasos: 63% já são criados com status "aceito". Não há evidência causal de que melhorem a qualidade.
9. **Arquitetura de software é um ambiente "malvado" (*wicked*) para a intuição: o feedback é demorado e ruidoso.** Um diário de decisões com revisão programada é a forma de criar o ciclo de feedback que falta. Debriefs têm d = 0,67 (+20–25%). Quinze minutos diários de reflexão escrita deram +22,8% num estudo de campo.
10. **Separar aprender de executar tem justificativa.**
    - Uma interrupção custa de 10 a 25 minutos até retomar a tarefa, e o trabalho interrompido gera mais estresse.
    - Uma nota de "ponto de retomada", ou um plano para a pendência, reduz a interferência.
    - Explicações ancoradas e discretas distraem menos do que um chat.
    - Agentes proativos aumentam a eficiência, mas atrapalham o fluxo quando não sinalizam o que estão fazendo.

**Postura de design recomendada: fricção proporcional ao risco e ao objetivo de aprendizagem.**
- **Decisões reversíveis e baratas:** resposta rápida e direta.
- **Decisões caras ou irreversíveis, ou quando o usuário diz "quero entender":**
  - hipótese do usuário antes da análise;
  - mapa avaliativo das opções;
  - um contra-argumento ancorado em fontes;
  - registro da decisão com data de revisão.

---

## (b) Evidência por tema

### 1. Overreliance em decisões assistidas por IA

#### 1.1 O fenômeno: explicação, confiança e autoavaliação

| Estudo | Amostra / tarefa | Achado (efeito) |
|---|---|---|
| **Bansal et al., CHI 2021** | Estudos com usuários em 3 conjuntos de dados (classificação de sentimento e LSAT); IA com acurácia comparável à humana | A ajuda da IA gerou ganhos complementares, mas **as explicações não aumentaram esses ganhos**. Elas aumentaram a chance de aceitar a recomendação *independentemente de estar correta*. |
| **Vasconcelos et al., CSCW 2023** | 5 estudos, N = 731 (Prolific); labirintos com IA 80% correta | Explicações só reduzem a overreliance quando **reduzem o custo de verificar**: tarefa difícil e explicação fácil de ler (caminho destacado). Explicação escrita, mais difícil de ler, ajudou menos. Um destaque bem saliente levou a overreliance a 0% na tarefa difícil, e um bônus maior (US$ 0,50 contra 0,01) também a reduziu. Conclusão dos autores: overreliance é uma "decisão estratégica" de custo e benefício, não uma fatalidade cognitiva. |
| **Steyvers et al., Nat. Mach. Intell. 2025** | Experimentos com respostas de LLM (múltipla escolha e resposta curta) | Existe um "gap de calibração": humanos confiam mais nas respostas do que o próprio modelo. **Explicações mais longas aumentam a confiança mesmo sem aumentar a acurácia.** Ajustar a linguagem da explicação à confiança interna do modelo reduz o gap. |
| **Si et al., NAACL 2024** | 80 crowdworkers checando fatos (LLM × busca) | Explicações de LLM deixam as pessoas mais rápidas, com acurácia parecida, mas elas confiam demais quando o modelo erra. Mostrar argumentos **a favor e contra** reduz a overreliance, mas não supera ler as passagens recuperadas. Em situações de alto risco, ler a fonte é melhor que ler a explicação. |
| **Spatharioti et al., CHI 2025 (MSR)** | Busca com LLM × busca tradicional em decisões de consumo | Com LLM, as pessoas são mais rápidas e mais satisfeitas, mas confiam na informação errada quando o modelo erra. **Destacar em cores os trechos incertos aumentou bastante a detecção de erros** e melhorou a acurácia, sem afetar as demais medidas. |
| **Bo, Wan & Anderson, CHI 2025** | N = 400; LSAT e estimativa numérica; o usuário responde antes e depois de ver a IA | Testaram aviso persistente, destaque de incerteza por token e resposta implícita. As três reduzem a overreliance em algumas configurações, mas **em geral não melhoram a confiança apropriada**. Em alguns contextos, as pessoas ficaram *mais* confiantes após confiar errado. |
| **Lee et al., CHI 2025 (CMU/Microsoft)** | 319 profissionais, 936 exemplos reais de uso | Coeficientes (não padronizados) sobre o pensamento crítico percebido: confiança na IA para a tarefa **−0,69** (p < 0,001); autoconfiança **+0,26** (p = 0,026); confiança em avaliar a resposta da IA **+0,31** (p = 0,046); tendência a refletir **+0,52** (p < 0,001). Inibidores relatados: confiar ou depender da IA (83/319), achar a tarefa trivial (55/319), não conseguir melhorar a resposta (72/319), não conseguir inspecioná-la por falta de conhecimento (58/319), falta de tempo (44/319). O pensamento crítico desloca-se para verificação, integração e "curadoria" (*stewardship*) da tarefa. |
| **Fernandes et al., *Computers in Human Behavior* 2025** | N = 246 (mais replicação com N = 452); 20 questões de lógica do LSAT com ChatGPT | O desempenho subiu cerca de 3 pontos em relação à norma, mas as pessoas **superestimaram o próprio escore em cerca de 4 pontos**. O efeito Dunning-Kruger desaparece porque todos superestimam. Maior letramento em IA trouxe mais confiança e *pior* autoavaliação. |
| **Budzyń et al., *Lancet Gastroenterol. Hepatol.* 2025** | Observacional, 4 centros na Polônia | Depois da introdução da IA, a taxa de detecção de adenoma nas colonoscopias feitas **sem** IA caiu de 28,4% para 22,4% (OR 0,69). É a primeira evidência clínica real de *deskilling* (perda de habilidade). |
| **Sharma et al., ICLR 2024 (Anthropic)** | Análise de dados de preferência de RLHF | Humanos e modelos de preferência preferem respostas bajuladoras convincentes a respostas corretas "numa fração não desprezível" dos casos. A bajulação é um comportamento geral de modelos treinados com RLHF. |
| **Cheng et al., *Science* 2026** | Auditoria de 11 modelos; 3 experimentos pré-registrados (N = 2.405) | Os modelos validam as ações do usuário cerca de **49% mais que humanos**. Respostas bajuladoras foram avaliadas como de maior qualidade e mais confiáveis, aumentaram a intenção de voltar a usar e **reduziram** a disposição de reparar conflitos. |

Moldura teórica: as "ironias da automação" (Bainbridge, 1983), revisitadas para GenAI por Simkute, Tankelevitch et al. (2024). Quanto mais se automatiza, mais crucial fica a habilidade humana de supervisionar, e menos ela é praticada. Tankelevitch et al. (CHI 2024, Best Paper) descrevem a GenAI como uma tarefa de **alta demanda metacognitiva**: planejar o pedido, avaliar a saída e decidir se e como usá-la.

#### 1.2 Estudos com desenvolvedores (2023–2026)

| Estudo | Amostra / desenho | Achado |
|---|---|---|
| **Anthropic, jan/2026** ("How AI assistance impacts the formation of coding skills"; preprint arXiv 2601.20245) | RCT, 52 engenheiros (maioria júnior) aprendendo **Trio**, uma biblioteca assíncrona de Python | Quiz: **50% com IA contra 67% sem IA** (d = 0,738, p = 0,01). Maior diferença em **depuração**. A IA economizou cerca de 2 min, sem significância. Padrões com escore baixo (< 40%): delegação total, dependência progressiva e "depurar via IA". Padrões com escore alto (≥ 65%): **gerar código e depois pedir para entender**, pedir código junto com explicação e fazer **só perguntas conceituais** (n = 7). Os autores recomendam "modos de aprendizagem". |
| **METR, jul/2025** | RCT, 16 devs experientes de código aberto, 246 tarefas reais | Com IA as tarefas levaram **19% mais tempo** (IC +2% a +39%). Os devs previam 24% de aceleração e, depois, acreditavam ter ganho 20%. |
| **METR, fev/2026 (atualização)** | 57 devs, mais de 800 tarefas | Estimativas de aceleração: −18% para os devs que voltaram do estudo anterior (IC −38% a +9%) e −4% para os novos (IC −15% a +9%). O METR considera o resultado **pouco confiável**: muitos devs se recusaram a trabalhar sem IA, e 30–50% deixaram de enviar tarefas. A conclusão é que os devs provavelmente estão mais rápidos que em 2025, mas a evidência é fraca. |
| **Peng et al., 2023 (GitHub/Microsoft)** | RCT com 95 freelancers implementando um servidor HTTP em JS | **55,8% mais rápido** com Copilot. Tarefa isolada e conflito de interesse dos autores. |
| **Cui et al., *Management Science* 2025** | 3 experimentos de campo (Microsoft, Accenture, Fortune 100), 4.867 devs | +26,08% de tarefas concluídas (erro padrão de 10,3 pontos percentuais). **Devs menos experientes adotaram mais e ganharam mais.** |
| **DORA 2024** (via InfoQ) | Survey com mais de 39 mil profissionais; modelo estatístico | Um aumento de 25% na adoção de IA está associado a −1,5% de throughput, **−7,2% de estabilidade de entrega** e +7,5% de qualidade da documentação. 39% confiam pouco ou nada no código gerado. |
| **Stack Overflow 2025** (via imprensa) | Cerca de 49 mil respondentes | 46% desconfiam da acurácia da IA, 33% confiam e só 3% confiam muito. 66% citam soluções "quase certas, mas não exatamente". 45% dizem que depurar código de IA demora mais. |
| **Anthropic, dez/2025** (estudo interno) | 132 engenheiros e pesquisadores, 53 entrevistas, 200 mil transcrições do Claude Code | Uso em cerca de 59–60% do trabalho e produtividade autorrelatada de +50%. A maioria diz conseguir delegar totalmente só 0–20% do trabalho e mantém para si o "pensamento de alto nível, design e decisões de gosto". Há medo de atrofia de habilidades e um nomeado **"paradoxo da supervisão"**: usar bem a IA exige justamente as habilidades que o uso excessivo corrói. As transcrições de design e planejamento subiram de 1,0% para 9,9%. |
| **Prather et al., ICER 2024** | 21 sessões com novatos (observação, entrevista, eye-tracking) | A GenAI "**alarga o fosso**": ajuda quem já tem estratégia metacognitiva e atrapalha quem não tem. Surgem três novas dificuldades metacognitivas: *Interruption*, *Mislead* e *Progression*. |
| **Kazemitabaar et al., CHI 2023** | 69 novatos de 10 a 17 anos; Codex em 45 tarefas | Taxa de conclusão 1,15× maior e notas 1,8× maiores, sem piora em modificação manual de código. A retenção após 1 semana foi levemente melhor, mas sem significância. **Quem tinha mais conhecimento prévio se beneficiou mais.** |
| **Lehmann, Cornelius & Sting** (preprint) | 2 experimentos de laboratório pré-registrados (cursos de programação) | Usar o LLM **como substituto** (pedir soluções) cobre mais tópicos e reduz a compreensão de cada um. Usar **como complemento** (pedir explicações) aumenta a compreensão. Efeito médio nulo, e o fosso entre alunos com mais e menos conhecimento prévio aumenta. |
| **Barke, James & Polikarpova, OOPSLA 2023** | Teoria fundamentada com 20 programadores | Dois modos de uso: **aceleração** (já sei o próximo passo) e **exploração** (não sei como seguir e uso a IA para ver opções). |

**Leitura conjunta:** o problema não é "usar IA", e sim **delegar o pensamento que se precisava aprender**. Os padrões que preservam o aprendizado (perguntas conceituais, "gerar e depois entender") são exatamente o que o companheiro de decisão deve induzir. A distância entre a produtividade percebida e a real (METR) e a superestimação (Fernandes) indicam que **o usuário não percebe sozinho quando está dependente**. O produto precisa de sinais externos (seção (c), "Como medir").

#### 1.3 Intervenções: o que funciona e a que custo

| Intervenção | Evidência | Efeito | Custo / risco |
|---|---|---|---|
| **Usuário decide antes de ver a IA** ("update") | Buçinca et al. 2021 (N = 199, de 260 recrutados; tarefa de nutrição); Fogliato et al. 2022 (19 radiologistas veterinários); Gajos & Mamykina 2022 | No pacote de forçamento cognitivo, a aceitação da escolha errada da IA caiu de **0,64 para 0,48** (p = 0,003). Acertos quando a IA errava: sem IA 0,49, XAI simples 0,08, forçamento 0,27. Registrar uma leitura provisória reduz a ancoragem. | **Menos preferido**: o sistema é visto como mais complexo e o desempenho foi pior justamente nas condições mais apreciadas. Benefício concentrado em quem tem alta *need for cognition*. Também reduz a concordância **quando a IA está certa** (*under-reliance*; Fogliato). Em Gajos & Mamykina (exp. 2), decidir antes melhorou as decisões, mas **não gerou aprendizado**. |
| **IA sob demanda / espera artificial (30 s)** | Buçinca et al. 2021 | Sem diferença significativa entre os 3 designs de forçamento | A espera artificial é a mais antipática. Prefira "sob demanda" a temporizadores. |
| **Explicação sem recomendação (IA avaliativa ou orientada por hipóteses)** | Gajos & Mamykina 2022; Le, Miller et al. 2024; Benk & Miller 2026 (N = 290); Reicherts et al. CHI 2025 (ExtendAI) | Explicação sem recomendação melhorou **decisões e aprendizado**. A abordagem por hipóteses aumentou a acurácia e reduziu a dependência em comparação com a recomendação. Recomendações **reduzem o limiar de evidência** exigido, um "viés oculto". O ExtendAI, que constrói sobre o raciocínio do próprio usuário, integrou-se melhor ao pensamento e deu resultados um pouco melhores. | Mais esforço. Leve aumento de *under-reliance* (Le et al.). O RecommendAI trouxe mais *insights* novos com menos esforço (Reicherts). |
| **Explicações contrastivas** | Si et al. 2024 (a favor e contra); Buçinca et al. CHI 2025 (N = 628, explicar a diferença entre a escolha da IA e a escolha provável do humano) | Reduzem a overreliance. As contrastivas centradas no humano **melhoraram a habilidade de decidir sem IA** sem perder acurácia. | Mostrar só a explicação contrastiva não substitui a fonte primária (Si). |
| **Incerteza em 1ª pessoa** | Kim et al., FAccT 2024 (N = 404, perguntas médicas) | "Não tenho certeza, mas..." reduziu a concordância com respostas erradas e **aumentou a acurácia**. A forma impessoal ("Não está claro...") teve efeito menor e não significativo. | A redação importa. |
| **Destaque de incerteza** | Spatharioti et al. 2025; Bo et al. 2025 | Aumenta a detecção de erros (Spatharioti), mas o efeito sobre a confiança apropriada é misto (Bo). | Risco de *under-reliance* e de "cegueira a avisos". |
| **Perguntas em vez de explicações** | Danry et al., CHI 2023 (N = 204) | Perguntas formuladas pela IA melhoraram o discernimento de argumentos logicamente falhos, em comparação com ausência de feedback e com explicações causais. | — |
| **Deliberação humano-IA por dimensão** | Ma et al., CHI 2025 (admissão em pós-graduação) | Melhor confiança apropriada e melhor desempenho que baselines de XAI (estudo exploratório). | Esforço maior. |
| **Advogado do diabo (LLM) em grupos** | Chiang et al., IUI 2024 | Deliberação mais profunda e confiança mais apropriada (via resumo de tese, sem número verificado) | Evidência limitada. |
| **Aumentar o benefício de se engajar** | Vasconcelos et al. 2023 | Mais em jogo leva a menos overreliance. | Sugere aplicar fricção onde o custo de errar é alto. |
| **Checklists e "vá com calma"** | ver §4.8 | "Vá com calma" genérico não ajuda; reflexão estruturada ajuda em casos complexos. | — |

**Síntese de 1.3:**
- Cada técnica reduz a overreliance, mas nenhuma é gratuita. A combinação com melhor relação custo-benefício é: hipótese do usuário (só quando vale a pena), explicação avaliativa com contraste, incerteza honesta e verificação barata.
- O custo de agrado é real e previsível. Portanto, a fricção deve ser **seletiva e adaptativa** (Buçinca: os benefícios se concentram em parte dos usuários).

---

### 2. IA como provocadora e tutora socrática

#### 2.1 A IA provocadora

- **Sarkar, "AI Should Challenge, Not Obey" (CACM 67(10), out/2024, artigo de opinião).** Propõe a IA como "provocadora": ela aponta argumentos fracos, suposições, vieses e alternativas, em vez de completar o trabalho ("A provocateur does not complete your report"). O próprio autor alerta que "uma barragem constante de críticas frustraria os usuários". Ele recomenda interfaces de **notação** e **mapas de argumentos** em vez de chat puro, e indicar as fontes com sua autoridade.
- **Drosos, Sarkar, Xu & Toronto, 2025 ("It makes you think", preprint MSR).** Estudo entre sujeitos com N = 24 (12 por condição), em que se montavam *shortlists* assistidas por IA, uma tarefa séria (bolsas de caridade) e uma casual (filmes). As provocações eram textos de até 2 frases em cada cartão de critério.
  - **Quantitativo:** quase tudo foi não significativo. As shortlists ficaram mais divergentes (RBO 0,30 contra 0,47) e houve sinais preocupantes: a concordância com "considerei que a IA poderia estar errada" caiu (3,5 contra 4,0, p = 0,039) e a sensação de "segurança" aumentou (5,0 contra 3,0, p = 0,003). Ou seja, a provocação também pode **gerar confiança**.
  - **Qualitativo:** as provocações estimularam metacognição, decomposição do problema e novos critérios. Até provocações irrelevantes ajudaram a articular o que *era* relevante.
  - **Quando ajudam:** em projetos grandes, exploratórios e de alto risco.
  - **Quando são ignoradas:** em tarefas rápidas, quando são genéricas ou óbvias ("costumo ignorar texto de aviso") e, para especialistas, quando não são contraintuitivas.
  - **Recomendações dos autores:** não usar linguagem visual de alerta; ser específico e desafiador; dar exemplos e definições inline; oferecer um botão para aplicar a sugestão.
  - **Cinco dimensões que moldam a experiência:** urgência, importância, expertise, acionabilidade e responsabilidade do usuário.
- **Microsoft Research, Tools for Thought.**
  - O workshop da CHI 2025 reuniu 56 participantes e 34 trabalhos (síntese em Tankelevitch et al., 2025) em torno de **proteger e ampliar** a cognição: metacognição, pensamento crítico, memória e criatividade.
  - O survey de Lee et al. (2025) recomenda intervenções de pensamento crítico **proativas** (interromper quando o risco de omissão é alto) e **reativas** (sob pedido). Recomenda também apresentá-las como **desenvolvimento de habilidade**, não como "co-auditoria", porque os profissionais se engajam quando querem melhorar profissionalmente. E sugere explicações do raciocínio, críticas guiadas e confronto com fontes autoritativas.
  - Tankelevitch et al. (CHI 2024) propõem duas estratégias: apoiar a metacognição (planejamento, autoavaliação, perguntas reflexivas) e reduzir a demanda (explicabilidade, customização).
  - Reicherts et al. (CHI 2025) mostram o equilíbrio entre os dois polos: a IA que estende o raciocínio do usuário (ExtendAI) integra-se melhor, enquanto a que recomenda traz mais novidades com menos esforço.

#### 2.2 Tutores: quando "segurar a resposta" ajuda

| Estudo | Amostra | Achado |
|---|---|---|
| **Bastani et al., PNAS 2025** | Cerca de 1.000 alunos de ensino médio na Turquia (matemática) | Na prática, o GPT Base (interface tipo ChatGPT) melhorou o desempenho em **48%** e o GPT Tutor (dicas, sem dar a resposta, com insumos dos professores) em **127%**. Na prova sem IA, o grupo **GPT Base caiu 17%** em relação ao controle, enquanto o **GPT Tutor ficou igual ao controle**. Mecanismo: a IA usada como muleta. Os alunos foram otimistas demais sobre o que aprenderam. Mede só efeitos de curto prazo. |
| **Kestin et al., *Scientific Reports* 2025** | RCT com 194 alunos de física em Harvard (cruzado) | Um tutor de IA desenhado com boas práticas pedagógicas levou a **mais que o dobro de ganho de aprendizado em menos tempo**, comparado a uma aula de aprendizagem ativa bem conduzida, com mais engajamento. Foram só duas lições. |
| **Blasco & Charisi** (preprint SSRN) | 122 alunos de 14 a 18 anos (RCT) | O tutor socrático aumentou o engajamento, **sem ganho significativo de aprendizado**, e uma fração maior dos alunos o viu como *menos útil*. O raciocínio passo a passo aumentou a acurácia numa tarefa de previsão. A retenção foi limitada quando a IA foi retirada. |
| **Kazemitabaar et al., IUI 2025** | N = 82 (7 técnicas) e depois N = 42 (as 2 melhores) | A técnica mais eficaz foi **guiar a solução passo a passo, com o aprendiz articulando o que deve acontecer antes de o código aparecer** (*Lead-and-Reveal*). Ela também alinhou a habilidade percebida com a real. Cada técnica foi avaliada também pela fricção que introduz. |
| **Jin et al., CHI 2024 (AlgoBo)** | 40 novatos em algoritmos | Aprender ensinando um agente LLM que simula concepções erradas gerou conversas mais densas em conhecimento (efeito de 0,71). Na versão piloto, o agente era **competente demais**, programava sem ser ensinado, e não houve aprendizado. |

#### 2.3 Explain-back (o usuário explica de volta): base de evidência

- **Autoexplicação:** meta-análise de Bisra et al. (2018) com 69 efeitos de 64 relatos: **g = 0,55** (IC 0,45–0,65).
- **Aprender ensinando:** Fiorella & Mayer (2013). Quem *de fato ensinou* (gravando uma aula) superou quem só se preparou para ensinar no teste após 1 semana (**d = 0,79 e 0,90**). A mera expectativa de ensinar ajudou só no teste imediato (d = 0,59 e 0,55).
- **Teach-back:** revisão de Talevski et al. (2020, PLOS ONE). Foi eficaz em **19 de 20 estudos**, com qualidade moderada ou baixa, em resultados que vão de recordação e retenção até reinternação hospitalar.
- **Por que funciona:** a *ilusão de profundidade explicativa* (Rozenblit & Keil, 2002). As pessoas superestimam o quanto entendem mecanismos, e a autoavaliação cai depois que tentam explicar. Buscar na internet infla a estimativa do próprio conhecimento (Fisher, Goddu & Keil, 2015, 9 experimentos), e com IA esse efeito parece maior (Fernandes et al., 2025).
- **Limite:** a autoavaliação sozinha é ruim. O explain-back serve para revelar lacunas, não para dar nota.

#### 2.4 Quando provocar e questionar ajuda, e quando irrita

| Ajuda quando... | Irrita, ou é ignorado, quando... | Fonte |
|---|---|---|
| A decisão é importante ou irreversível, ou a tarefa é exploratória | Há pressa ou a tarefa é rotineira | Drosos 2025; Lee 2025 (falta de tempo, tarefa trivial) |
| A provocação é específica, contextual e acionável | É genérica, óbvia, com cara de "aviso legal" | Drosos 2025 |
| O usuário quer aprender, ou tem alta *need for cognition* | O usuário só quer executar; o forçamento é constante | Buçinca 2021 |
| Vem em pontos de pausa (antes de aprovar, ao terminar) | Interrompe o fluxo; o agente proativo não sinaliza o que faz | Pu et al. CHI 2025; Iqbal & Bailey 2008 |
| O questionamento conduz a solução passo a passo, com revelação | É socrático "puro", sem nunca dar a resposta | Kazemitabaar 2025; Blasco & Charisi |
| O desafio é contraintuitivo, para quem já é especialista | Reflete o que o especialista já sabe | Drosos 2025 |
| É pouco frequente (1 a 3 por decisão) | É uma barragem de críticas | Sarkar 2024 |

---

### 3. Explicações no nível certo

#### 3.1 Nível e andaime

- **Zona de desenvolvimento proximal e scaffolding** (Vygotsky; Wood, Bruner & Ross, 1976) são construtos teóricos. A evidência prática vem da tutoria adaptativa. Na revisão de VanLehn (2011), tutoria humana teve **d = 0,79** e sistemas tutores *step-based* **d = 0,76**, ambos contra ausência de tutoria. Ajustar o passo ao aprendiz é o que dá o efeito.
- **Efeito de reversão da expertise** (Kalyuga, Ayres, Chandler & Sweller, 2003). Técnicas que ajudam novatos, como exemplos resolvidos (*worked examples*) e explicações passo a passo, **perdem efeito ou atrapalham** quem já domina o assunto, porque se tornam redundantes. Implicação: o andaime deve **diminuir** conforme o domínio cresce.
- **Maldição da expertise** (Hinds, 1999). Especialistas preveem mal quanto um novato vai demorar, e técnicas de *debiasing* não corrigiram isso. A IA se comporta como um "especialista", então **não deve adivinhar o nível do usuário: deve perguntar e medir**.
- **Estilo conversacional** (Ginns, Martin & Marsh, 2013; 3.312 alunos): retenção **d = 0,30** e transferência **d = 0,54**. O efeito some em instruções com mais de 35 minutos. "Explicar como para um colega" tem algum respaldo pelo tom, mas é o nível de conhecimento que importa.
- **Estilos de aprendizagem** (visual, auditivo etc.): **não há evidência adequada** de que casar a instrução com o estilo melhore o aprendizado (Pashler et al., 2008).

#### 3.2 Termos, glossários e analogias

- **Pré-treino** (princípio de Mayer). Apresentar nomes e características dos conceitos-chave *antes* da explicação principal melhora a transferência: mediana **d = 0,85** (5 de 5 testes, 2009) ou **d = 0,75** (13 de 16 testes, Cambridge Handbook, 2014). Para o Monet, isso significa mostrar 2–4 termos-chave em uma linha cada antes de comparar arquiteturas.
- **Comparar casos lado a lado.** A meta-análise de Alfieri, Nokes-Malach & Schunn (2013; 57 experimentos, 336 testes) encontrou **d ≈ 0,50** a favor de comparar casos em vez de estudá-los isoladamente. Em negociação, comparar 2 casos tornou cerca de **3 vezes** mais provável transferir a estratégia (Loewenstein et al., 1999). Analisar os casos separadamente não foi melhor do que não ter treino (Loewenstein, Thompson & Gentner, 2003). "X vs. Y: quando usar cada um" é uma forma de explicar com respaldo.
- **Glossário passivo.** Reler e grifar têm baixa utilidade, e testagem e prática distribuída têm alta (Dunlosky et al., 2013). Um glossário só de consulta ajuda a entender no momento, mas não a reter.

#### 3.3 Retenção de conceitos aprendidos no trabalho

- **Testagem (prática de recuperação):**
  - Yang et al. (2021, *Psychological Bulletin*): 222 estudos e 48.478 alunos em sala de aula, **g = 0,499**.
  - Adesope et al. (2017): 272 efeitos; testar supera reestudar e todas as outras condições de comparação.
- **Tentativa antes da resposta:** gerar a resposta (efeito de geração) tem **d ≈ 0,40** (Bertsch et al., 2007, 86 estudos). Tentativas de recordação que *falham* também melhoram o aprendizado posterior, desde que o feedback venha logo (Kornell, Hays & Bjork, 2009).
- **Espaçamento** (Cepeda et al., 2008; mais de 1.350 pessoas): o intervalo ótimo de revisão fica em **20–40% do horizonte para retenção de 1 semana** e cai para **5–10% para retenção de 1 ano**. Exemplo: para lembrar daqui a 6 meses, revise depois de algumas semanas.
- **Profissionais:** um RCT de *spaced education* (Kerfoot et al., 2007), com casos clínicos enviados semanalmente por e-mail a estudantes de medicina, melhorou a retenção, com efeitos de **1,01** (6–8 meses) e **0,73** (9–11 meses). Houve atrito: 71% fizeram o teste final.

#### 3.4 Implicações

- Personalizar pelo **conhecimento prévio**, com um modelo do aprendiz explícito e editável. Nunca por "estilo".
- Termo novo = definição curta + exemplo no contexto do usuário + **contraste com o termo vizinho**.
- Consolidar *fora* do fluxo, com 3–5 perguntas espaçadas sobre conceitos e decisões reais do próprio usuário.

---

### 4. Higiene de decisão

#### 4.1 *Noise* e o Mediating Assessments Protocol (MAP)

- **O livro.** *Noise* (Kahneman, Sibony & Sunstein, 2021) mostra variabilidade grande e indesejada em julgamentos que deveriam ser iguais. A "higiene de decisão" proposta inclui:
  - estruturar o julgamento em avaliações independentes;
  - **resistir à intuição prematura**;
  - sequenciar a informação, expondo só o necessário a cada etapa;
  - colher julgamentos independentes antes de discutir;
  - tomar a visão de fora (taxas-base);
  - preferir escalas relativas.
- **O MAP** (Kahneman, Lovallo & Sibony, MIT SMR 2019) funciona em três passos: definir **antes** os critérios mediadores; avaliar cada um de forma independente e baseada em fatos; e só no fim fazer o julgamento holístico.
- **De onde vem a evidência:**
  - Entrevistas estruturadas são o procedimento de seleção com maior validade preditiva (Sackett et al., 2022).
  - A predição mecânica iguala ou supera a clínica na grande maioria dos 136 estudos (Grove et al., 2000).
  - Modelos lineares com **pesos iguais** são robustos (Dawes, 1979).
- **Ressalva:** o MAP *em si* tem pouca avaliação experimental direta em decisões estratégicas. É uma extrapolação razoável, não um protocolo testado.
- **Quando confiar na intuição** (Kahneman & Klein, 2009). Só em ambientes de **alta validade**, com oportunidade de aprender pelas regularidades. Decisões de arquitetura têm feedback **atrasado e ruidoso**, um ambiente "malvado" no sentido de Hogarth, Lejarraga & Soyer (2015). Ali a intuição não tem como ser calibrada sem registro e revisão explícitos.

#### 4.2 Alternativas e custo de oportunidade

- **Nutt (1999, *Academy of Management Executive*), 356 decisões em organizações médias e grandes (fonte primária lida).**
  - Os gestores desenvolveram múltiplas opções em **menos de 20%** das decisões. Quando o fizeram, **o sucesso subiu de 56% para 70%**.
  - Na tática de "impor a ideia", com uma solução só, a solução foi plenamente usada em apenas 42% dos casos.
  - É um estudo observacional, sujeito a confusão: decisões com mais alternativas podem ser também as mais bem conduzidas em geral.
- **Negligência do custo de oportunidade** (Frederick et al., 2009, *JCR*). Lembrar que o dinheiro poderia ter outro uso reduziu a intenção de compra de um DVD de **75% para 55%**, e de 73% para 37% em outro estudo. As pessoas não consideram a opção "não fazer" a menos que ela esteja explícita.
- **Quantas opções mostrar.** A meta-análise de "excesso de escolha" (Scheibehenne et al., 2010; 63 condições, N = 5.036) encontrou efeito médio **praticamente zero**, com grande variância. Três ou quatro opções reais não "paralisam" por si; o que pesa é a complexidade e a incerteza sobre preferências.

#### 4.3 Pre-mortem, "considerar o oposto" e treino contra vieses

- **Pre-mortem** (Klein, HBR 2007). A base citada é Mitchell, Russo & Pennington (1989): imaginar que o evento já aconteceu aumentou em cerca de 30% o **número** de razões geradas, sem avaliar sua qualidade. A versão popular, "+30% na capacidade de identificar *corretamente*", é uma distorção.
  - Veinott, Klein & Wiggins (2010; n = 178; via Collins) acharam que o pre-mortem reduziu o excesso de confiança num plano cerca de **2 vezes** mais que listas de prós e contras.
  - Gallop & Bischoff (2016; 101 gerentes e engenheiros; via Collins) acharam que times com pre-mortem identificaram mais riscos de qualidade, segundo avaliação cega.
  - Veredito: **literatura escassa, mas consistentemente positiva**, e de custo baixo.
- **Considerar o oposto** reduz a assimilação enviesada (Lord, Lepper & Preston, 1984) e a ancoragem (Mussweiler, Strack & Pfeiffer, 2000).
- **Treinos curtos funcionam e transferem:**
  - Morewedge et al. (2015): um jogo de sessão única reduziu vieses em **≥ 32% logo após e ≥ 24% dois meses depois**. Vídeos tiveram efeito menor.
  - Sellier, Scopelliti & Morewedge (2019; N = 290): os treinados ficaram **29% menos propensos** a escolher a solução inferior, que confirmava a hipótese, num caso de campo baseado no Challenger.
  - Chang et al. (2016): menos de 1 hora de treino melhorou a acurácia de previsões geopolíticas (Brier) em **6–11%**.
- **"Multidão interna":**
  - Herzog & Hertwig (2009): fazer uma segunda estimativa supondo que a primeira está errada e tirar a média melhora a acurácia.
  - Vul & Pashler (2008): o ganho é **maior quando a segunda estimativa vem 3 semanas depois**. É um argumento empírico para **revisitar** decisões com distância.

#### 4.4 Reversibilidade

- **Bezos, carta aos acionistas de 2015 (publicada em 2016).** Decisões "Tipo 1" são *one-way doors*, irreversíveis, e pedem método, cuidado e lentidão. As "Tipo 2" são *two-way doors* e devem ser rápidas, tomadas por indivíduos ou grupos pequenos. Organizações grandes tendem a aplicar o processo pesado a decisões Tipo 2. É uma **heurística útil sem teste empírico direto**.
- **Contraponto** (Gilbert & Ebert, 2002, *JPSP*). As pessoas **preferem** opções reversíveis, mas ficam **menos satisfeitas** com elas, porque a possibilidade de voltar atrás atrapalha os processos que geram satisfação depois da decisão. Implicação: chamar algo de "reversível" deve calibrar o esforço, não virar desculpa para não se comprometer. Muitas decisões "reversíveis" de software ficam caras de reverter com o tempo (dados migrados, dependências espalhadas).

#### 4.5 Diário de decisões: separar a qualidade da decisão do resultado

- **Annie Duke** (*Thinking in Bets*, 2018) chama de *resulting* o hábito de julgar a decisão pelo resultado. A base experimental vem de dois vieses clássicos:
  - **viés de resultado:** a mesma decisão é julgada pior quando o resultado é ruim (Baron & Hershey, 1988);
  - **viés retrospectivo:** depois do fato, as pessoas superestimam o que teriam previsto (Fischhoff, 1975).
  - Registrar a previsão **antes** do resultado é o único antídoto prático.
- **Não encontrei RCT do "decision journal" em si.** A evidência é **adjacente e forte**:
  - **Reflexão escrita** (Di Stefano, Gino, Pisano & Staats; via HBS Working Knowledge): num call center da Wipro, 15 min diários escrevendo sobre o que se aprendeu elevaram o desempenho no teste final em **22,8%**; no laboratório, +18%. Uma versão posterior reúne 10 experimentos (N = 4.340): o benefício é maior **no início da curva de aprendizagem**.
  - **Debriefs** (Tannenbaum & Cerasoli, 2013): 46 amostras, N = 2.136, **d = 0,67**, cerca de +20–25%, semelhante para indivíduos e equipes.
  - **Intenções de implementação** (Gollwitzer & Sheeran, 2006): planos "se X, então Y" têm **d = 0,65** sobre o cumprimento de metas. Isso sustenta usar **gatilhos concretos de revisão** ("se a latência p95 passar de 200 ms, revisitar") em vez de "revisar algum dia".

#### 4.6 ADRs na engenharia de software

- **Origem:** o template de Nygard (2011), com contexto, decisão, status e consequências.
- **Adoção** (Buchgeher et al., IEEE Access 2023, mineração de repositórios no GitHub):
  - a adoção é baixa, embora cresça a cada ano;
  - cerca de **50% dos repositórios com ADRs têm só 1 a 5 registros**, ou seja, foram testados e abandonados;
  - nos que usam ADRs sistematicamente, o registro é uma atividade de equipe de longo prazo.
- **Impacto** (de Santana Junior et al., ICSA 2026; 921 repositórios, 5.800 ADRs): correlações **pequenas** com métricas de qualidade (code smells, tempo de resolução de issues). **63% dos ADRs já nascem com status "aceito"**, o que pula a deliberação que deveriam registrar.
- **Por que não se documenta** (Tang et al., 2006; 81 arquitetos): os praticantes valorizam o *rationale* e o usam para raciocinar, mas enfrentam barreiras para documentá-lo.
- **O que melhora o raciocínio de design:**
  - *cartões-lembrete de raciocínio* (riscos, suposições, trade-offs) fizeram estudantes e profissionais raciocinarem mais sobre o design (Tang et al., 2018);
  - reflexões externas melhoraram a qualidade da discussão de design em 12 grupos (Razavian et al., 2016);
  - um workshop de debiasing com 16 estudantes e 20 profissionais **reduziu significativamente a ancoragem e o viés de otimismo** (Borowa et al., ICSA 2025). Profissionais foram *mais* suscetíveis aos vieses que estudantes. A técnica anti-ancoragem era simples: **citar uma desvantagem da solução proposta**.
- **Vieses no dia a dia de desenvolvimento** (Chattopadhyay et al., ICSE 2020, estudo de campo): cerca de **70% das ações que depois foram revertidas** estavam associadas a pelo menos um viés cognitivo.
- **Técnicas de decisão** (Falessi et al., 2011, *ACM Computing Surveys*): **não há técnica "melhor"**. Escolhe-se pelo tipo de dificuldade que se quer evitar.
- **Veredito:** ADRs têm valor plausível como memória e comunicação, mas **não há evidência causal de que melhorem a qualidade**. O formato só se sustenta se for **barato**, aqui com rascunho gerado pela IA, e se capturar a **deliberação**: opções, porquês e status "proposta" antes de "aceita".

#### 4.7 Critérios ponderados e o risco de "pensar demais"

- Decompor em critérios e avaliar cada um **de forma independente** tem respaldo (MAP, entrevistas estruturadas, Dawes 1979). Os **pesos com casas decimais** não têm: pesos iguais são robustos, e a precisão é ilusória.
- **"Pensar demais"** (Wilson & Schooler, 1991). Analisar razões pode **piorar** escolhas baseadas em preferência ou gosto. Para decisões de "gosto" (ergonomia de API, nomes, estética de código), não force a matriz: deixe o critério explícito como subjetivo.

#### 4.8 Checklists e "ir com calma"

- **Checklist cirúrgico da OMS.** Em 8 hospitais, a mortalidade caiu de 1,5% para 0,8% e as complicações de 11% para 7% (Haynes et al., NEJM 2009). Imposto em escala em Ontário, **não teve efeito significativo**: mortalidade de 0,71% para 0,65% (Urbach et al., NEJM 2014). Checklists funcionam quando mudam o comportamento real em pontos de falha conhecidos, não como burocracia.
- **"Vá com calma, seja cuidadoso"** (Norman et al., 2014). Residentes levaram **30% mais tempo sem ganho de acurácia**. A **reflexão estruturada** (considerar diagnósticos alternativos) melhorou a acurácia só em **casos complexos** (Mamede, Schmidt & Penaforte, 2008; 42 residentes). Ou seja, estrutura ajuda e exortação não.

#### 4.9 Resumo da força da evidência

| Técnica | Força | Comentário |
|---|---|---|
| Avaliações independentes por critério (MAP / entrevista estruturada) | **Alta** para o princípio, **baixa** para o MAP em decisões estratégicas | Extrapolação de seleção de pessoal e predição |
| Gerar mais de uma alternativa | **Moderada** (observacional) | 56% → 70% (Nutt) |
| Lembrar custo de oportunidade / "não fazer nada" | **Moderada-alta** (experimental, consumo) | 75% → 55% |
| Considerar o oposto / treino de debiasing | **Moderada-alta** | Transfere para casos de campo (−29%) |
| Pre-mortem | **Baixa-moderada** | Poucos estudos, todos positivos |
| Reversibilidade (Tipo 1/2) | **Heurística** | Sem teste; atenção a Gilbert & Ebert |
| Diário de decisão | **Indireta** | Reflexão (+22,8%), debrief (d = 0,67), vieses de resultado e retrospectivo |
| ADRs | **Baixa** para benefício; **alta** para "baixa adoção" | Barato e deliberativo, ou é abandonado |
| Matriz de pesos | **Baixa** para os pesos; **alta** para a decomposição | Pesos iguais bastam |
| Checklists | **Depende da implementação** | Haynes × Urbach |

---

### 5. Carga cognitiva, interrupção e troca de contexto

#### 5.1 O custo das interrupções

- **Mark, Gudith & Klocke (CHI 2008).** 48 participantes respondendo e-mails, interrompidos a cada 2 min. Os interrompidos **terminaram mais rápido e sem perda de qualidade**, mas relataram **mais estresse, frustração, pressão de tempo e esforço**. Bastaram 20 minutos de trabalho interrompido para isso aparecer. A compensação é feita com velocidade e cobra em estresse.
- **Iqbal & Horvitz (CHI 2007).** Estudo de campo com 27 pessoas por 2 semanas (2.267 h de logs).
  - Cerca de **10 min gastos nas trocas disparadas por alertas**, mais **10–15 min** até voltar à tarefa interrompida.
  - **27% das suspensões passaram de 2 horas.**
  - Janelas de tarefas suspensas que ficavam mais escondidas foram retomadas mais devagar.
  - Os autores recomendam pistas visuais e salvar o contexto da tarefa.
- **Altmann, Trafton & Hambrick (2014).** Interrupções de **2,8 s dobraram** os erros de sequência; de 4,4 s, triplicaram.
- **Programadores** (Parnin & Rugaber, 2011; cerca de 10.000 sessões de 85–86 programadores, mais um survey com 414). Só **10% das sessões voltaram a editar código em menos de 1 minuto**, e só 7% voltaram sem navegar antes por outros pontos do código. Programadores dependem muito de **notas** para retomar (DeLine & Parnin, 2010; 371 programadores).
- **Momento da interrupção** (Iqbal & Bailey, CHI 2008). Entregar notificações em **pontos de pausa** (fim de subtarefa) reduziu a frustração e o tempo de reação, comparado à entrega imediata.
- **Resíduo de atenção** (Leroy, 2009; Leroy & Glomb, *Organization Science* 2018). Parte da atenção fica presa na tarefa anterior. Escrever um **"plano de retomada"** de menos de 1 minuto (onde parei, próximo passo) reduziu o resíduo e melhorou o desempenho na tarefa que interrompeu.
- **Pendências** (Masicampo & Baumeister, 2011). Fazer um **plano específico** para uma meta não cumprida eliminou os efeitos de intrusão e interferência. A versão popular do efeito Zeigarnik ("lembramos mais do inacabado") **não se sustentou** na meta-análise de Ghibellini & Meier (2025). O que se mantém é a *tendência a retomar* o inacabado (efeito Ovsiankina).

#### 5.2 Por que separar o "contexto de aprendizagem" do "contexto de execução"

- **Aprendizagem não é desempenho** (Soderstrom & Bjork, 2015). Condições que maximizam o desempenho imediato (respostas prontas, fluidez) costumam *reduzir* a retenção. As "dificuldades desejáveis" (espaçar, testar, gerar) pioram o momento e melhoram o depois. Misturar os dois objetivos no mesmo instante faz o desempenho vencer.
- **Metas de aprendizagem vs. metas de desempenho** (Seijts & Latham, 2005; Seijts et al., 2004). Em tarefas **complexas e novas**, uma meta específica de *aprendizagem* superou uma meta de *desempenho*. Metas de desempenho podem atrapalhar quando o gargalo é conhecimento, não esforço.
- **Modos de uso da IA:**
  - aceleração × exploração (Barke et al., 2023);
  - complemento × substituto (Lehmann et al.);
  - perguntas conceituais × delegação (Anthropic, 2026).
- **Pressão de tempo** é o inibidor que mais aparece: falta de tempo em 44 dos 319 relatos (Lee et al.). Sob urgência, as provocações são ignoradas (Drosos).
- **Esforço cognitivo menor nem sempre é bom:**
  - Stadler, Bannert & Sailer (2024; N = 91): usar o ChatGPT em vez do Google reduziu a carga cognitiva, mas **piorou a qualidade da argumentação**.
  - Fan et al. (2025; BJET): o ChatGPT melhorou o ensaio sem melhorar a transferência, e houve menos processos metacognitivos ("preguiça metacognitiva").
  - Kosmyna et al. (2025; N = 54; preprint): menor conectividade cerebral e dificuldade de citar o próprio texto. O estudo é amplamente criticado por amostra pequena e inconsistências, então use com cautela.

#### 5.3 Evidência sobre "canais laterais" para dúvidas

**Não encontrei RCT do formato "canal lateral de dúvidas".** A evidência indireta converge:

- **Explicações ancoradas e discretas.** O Ivie (Yan et al., CHI 2024) exibe rótulos curtos ao lado do código recém-gerado. Melhorou a compreensão e foi avaliado como "útil e pouco distrativo" em comparação a uma ferramenta de referência.
- **Agentes proativos.** No Codellaborator (Pu et al., CHI 2025; 18 participantes), a proatividade aumentou a eficiência, mas **interrompeu o fluxo**. Indicadores de presença e de contexto da interação atenuaram o problema. Houve também custos para o controle, a autoria do código e a compreensão.
- **Pontos de pausa, notas de retomada e pistas visíveis** reduzem custos (Iqbal & Bailey 2008; Leroy & Glomb 2018; Iqbal & Horvitz 2007; DeLine & Parnin 2010).
- **Precedente interno do Monet:** o chat lateral do Reader, com contexto efêmero de página e destaques, foi validado em uso real e é consistente com essa evidência.

**Implicação:** dúvidas que surgem durante a execução devem ser **estacionadas** com contexto mínimo e respondidas de forma curta e ancorada. O aprofundamento e as provocações vão para **pontos de pausa**.

---

## (c) Regras de design para o companheiro de decisão

### Arquitetura sugerida: três trilhos

1. **Entender** (aprendizagem): termos e conceitos, glossário pessoal, explain-back opcional, revisão espaçada.
2. **Decidir:** triagem, hipótese do usuário (quando vale), mapa avaliativo de opções, contra-argumento, decisão do usuário, registro.
3. **Revisar:** debrief na data ou no gatilho, calibração, atualização das "regras pessoais" e do glossário.

**Fluxo especial: aprovar o plano de um agente** (Regra 9).

### Matriz de fricção (quanto "atrito" aplicar)

| Objetivo \ Reversibilidade | **Reversível e barata** ("porta de duas vias") | **Cara de reverter** | **Irreversível** ("porta de mão única") |
|---|---|---|---|
| **Resolver logo** | Resposta direta + 1 risco + 1 alternativa. Sem perguntas. | Mapa de 2–3 opções + custo de errar + 1 contra-argumento. Registro curto. | Hipótese do usuário primeiro + mapa avaliativo + pre-mortem + checklist + registro com gatilho de revisão. |
| **Quero entender** | Explicação sem veredito + 2–3 termos-chave. Explain-back opcional. | O anterior + comparação lado a lado ("X vs. Y"). | Tudo acima + explain-back antes de aprovar. |

### As regras

**R1. Triagem de 10 segundos antes de ajudar.**
- **Regra:** a IA sugere e o usuário confirma ou corrige quatro coisas:
  - reversibilidade e custo de reverter (horas, dias, irreversível);
  - custo de errar;
  - urgência;
  - objetivo ("resolver" ou "entender").
- A triagem define o nível de fricção pela matriz acima.
- *Por quê:* o forçamento cognitivo funciona, mas é impopular e beneficia sobretudo parte dos usuários (Buçinca 2021). Urgência, importância e tarefas vistas como triviais governam se o pensamento crítico acontece (Drosos 2025; Lee 2025). O benefício de se engajar reduz a overreliance (Vasconcelos 2023).
- *No Monet:* chips no topo da conversa de decisão, por exemplo: "parece porta de mão única: altera o schema do `monet.db`".
- *Limite:* não pode virar formulário. Se o usuário ignorar, a IA infere e mostra a inferência.

**R2. Hipótese do usuário antes da análise, só quando vale a pena.**
- **Regra:** em decisões caras ou irreversíveis, ou no modo "entender", perguntar em uma linha: "O que você escolheria agora e por quê? Confiança de 0 a 100%." "Não sei ainda" é resposta válida. Em decisões reversíveis e baratas, **não perguntar**.
- *Por quê:*
  - decidir antes reduz a overreliance (0,64 → 0,48) e a ancoragem (Buçinca 2021; Fogliato 2022);
  - tentar antes de ver a resposta melhora a retenção (Kornell 2009; Bertsch 2007);
  - a confiança registrada permite calibração depois (Fernandes 2025 mostra que a autoavaliação com IA é inflada);
  - o custo é ser menos agradável e gerar possível *under-reliance* (Fogliato), daí ser seletivo.
- *Detalhe:* se a decisão depende de termos que o usuário não conhece, mostrar antes os 2–3 termos-chave (pré-treino, R10).

**R3. Por padrão, mapa avaliativo de opções, não veredito.**
- **Regra:** a IA monta 2–4 opções × critérios do usuário, cada célula com **evidência a favor e contra** e a origem marcada (fonte ou inferência). Recomendação só **quando pedida**, no fim, rotulada como opinião da IA, com incerteza e com "o que me faria mudar de ideia".
- *Por quê:* explicação sem recomendação gerou decisões melhores *e* aprendizado (Gajos & Mamykina 2022). A abordagem por hipóteses aumentou a acurácia e reduziu a dependência (Le et al. 2024). Recomendações baixam o limiar de evidência (Benk & Miller 2026). Explicações aumentam a aceitação até de erros (Bansal 2021). Construir sobre o raciocínio do usuário integra melhor (Reicherts 2025).
- *Limite:* em decisões reversíveis e urgentes, recomendar direto é aceitável, porque o custo de errar é baixo e o tempo importa.

**R4. Sempre pelo menos 2 alternativas reais, mais "não fazer nada / adiar / versão mínima reversível".**
- **Regra:** inclua "não fazer nada / adiar / fazer um *spike* de 2 h", cada opção com custo explícito, incluindo o de esperar. A IA deve gerar a **alternativa mais forte contra a opção preferida** (pelo usuário ou pelo agente).
- *Por quê:* múltiplas opções estão associadas a 56% → 70% de sucesso, e são raras, aparecendo em menos de 20% das decisões (Nutt 1999). Explicitar o custo de oportunidade muda escolhas (75% → 55%; Frederick 2009). Três ou quatro opções não "paralisam" (Scheibehenne 2010).
- *Limite:* "não fazer nada" às vezes não é viável. Nesse caso, mostrar o custo de esperar (dívida técnica, tarefas bloqueadas).

**R5. Custo de errar e caminho de volta, por opção.**
- **Regra:** para cada opção, registrar:
  - o que quebra se estiver errada;
  - quanto custa reverter (horas ou dias);
  - o primeiro sinal de que está errada;
  - o **ponto de não retorno** (dados migrados, API publicada, dependência espalhada pelo código).
- *Por quê:* o pre-mortem reduz o excesso de confiança e revela mais riscos (Veinott 2010; Gallop & Bischoff 2016). Tipo 1/Tipo 2 é uma heurística útil (Bezos). Mas "reversível" não deve virar desculpa: a reversibilidade reduz a satisfação e o comprometimento (Gilbert & Ebert 2002).
- *No Monet:* seção "Se der errado" no registro, pré-preenchida pela IA e editada pelo usuário.

**R6. Um contra-argumento forte, específico e ancorado em fontes do usuário.**
- **Regra:** no máximo 1 a 3 provocações por decisão, cada uma **acionável** ("verifique X", "pergunte a Y", "teste Z"). Ancorar via RAG no material do próprio usuário: reunião, doc, decisão anterior, com link. A IA deve discordar do usuário *e* do plano do agente quando houver base. **Nunca elogiar uma escolha sem citar o trade-off.**
- *Por quê:*
  - provocações genéricas viram "fluff" e são ignoradas; as específicas estimulam metacognição (Drosos 2025);
  - uma barragem de críticas frustra (Sarkar 2024);
  - mostrar prós e contras reduz a overreliance (Si 2024);
  - citar uma desvantagem da solução proposta reduziu a ancoragem em arquitetos (Borowa 2025);
  - considerar o oposto reduz a ancoragem (Mussweiler 2000);
  - os modelos tendem à bajulação, e os usuários preferem isso (Sharma 2024; Cheng 2026), então o contraponto precisa ser parte do design, não deixado ao acaso.
- *Forma:* tom de colega, sem estética de alerta.

**R7. Incerteza honesta, curta e localizada.**
- **Regra:** escrever a incerteza em 1ª pessoa ("não tenho certeza sobre X porque..."). Separar **fato com fonte**, **inferência** e **opinião**. Marcar visualmente os trechos de baixa confiança. Respostas curtas.
- *Por quê:* hedges em 1ª pessoa reduzem a concordância com erros e aumentam a acurácia (Kim 2024). O comprimento infla a confiança sem aumentar o acerto (Steyvers 2025). O destaque de incerteza aumenta a detecção de erros (Spatharioti 2025). Atenção ao excesso, que gera *under-reliance* (Bo 2025).

**R8. Torne a verificação barata.**
- **Regra:** para cada afirmação que sustenta a decisão, oferecer "como checar em até 5 min": doc oficial, changelog, issue, benchmark, comando, teste mínimo. O usuário pode marcar "verifiquei".
- *Por quê:* explicações só reduzem a overreliance quando reduzem o custo de verificar (Vasconcelos 2023). Ler a fonte supera ler a explicação (Si 2024). A falta de habilidade para inspecionar a resposta foi uma barreira em 58 dos 319 relatos (Lee 2025).

**R9. Checklist curto para aprovar o plano de um agente, só no ponto de pausa.**
- **Regra:** cinco itens, perguntados antes de aprovar:
  1. qual problema o plano resolve e qual o critério de pronto;
  2. o que é **irreversível ou compartilhado**: schema, dados, API pública, novas dependências, segurança;
  3. quais alternativas o agente descartou e por quê;
  4. como testar e como reverter;
  5. **o que no plano eu não sei explicar.**
- O item 5 alimenta o glossário (R10).
- *Por quê:* existe o "paradoxo da supervisão" (Anthropic 2025). Checklists funcionam quando curtos e ligados a modos de falha reais, não como burocracia (Haynes 2009 × Urbach 2014). "Vá com calma" não ajuda; estrutura ajuda (Norman 2014; Mamede 2008). Cerca de 70% das ações revertidas tinham viés associado (Chattopadhyay 2020).
- *Limite:* checklist completo só se o plano tocar o item 2. Caso contrário, mostrar recolhido.

**R10. Explicar a partir do que o usuário já sabe, com um modelo do aprendiz aberto.**
- **Regra:**
  - Manter um glossário pessoal com status por termo: *vi → entendo → sei explicar → já apliquei*. Ele fica visível e editável e entra no RAG.
  - Termo novo = definição de 1 frase + exemplo no contexto dele (docs ou código do projeto) + contraste com o termo vizinho ("X vs. Y: quando cada um") + analogia opcional.
  - O andaime diminui à medida que o status sobe.
- *Por quê:*
  - pré-treino tem d ≈ 0,75–0,85 (Mayer);
  - comparar casos tem d ≈ 0,50, com cerca de 3 vezes mais transferência (Alfieri 2013; Loewenstein 1999);
  - técnicas para novatos atrapalham quem já sabe (reversão da expertise, Kalyuga 2003);
  - especialistas, e portanto a IA, julgam mal o nível do novato (Hinds 1999), então é preciso perguntar e medir;
  - o tom conversacional ajuda moderadamente (Ginns 2013);
  - estilos de aprendizagem não têm evidência (Pashler 2008).

**R11. Consolidar fora do fluxo, com recuperação espaçada.**
- **Regra:** 3 a 5 perguntas por semana sobre os termos e as **decisões reais** do usuário ("Por que escolhemos A e não B?"). O usuário tenta antes de ver a resposta, recebe feedback imediato, e os intervalos crescem (de dias para semanas). Opcional e pulável.
- *Por quê:* testagem tem g ≈ 0,50 (Yang 2021; Adesope 2017). O espaçamento ótimo é de 10–20% do horizonte (Cepeda 2008). *Spaced education* funcionou com profissionais em formação (Kerfoot 2007). Tentar antes, mesmo errando, ajuda quando o feedback é imediato (Kornell 2009). Reler um glossário tem baixa utilidade (Dunlosky 2013).
- *No Monet:* "Revisão da semana" como Task ou item no Calendar, com perguntas geradas das notas de decisão e do glossário.

**R12. Explain-back curto e opcional, em dois momentos.**
- **Regra:** pedir o explain-back (a) depois de aprender um termo-chave e (b) antes de aprovar uma decisão irreversível: "Explique em 2–3 frases, para um colega, por que A e não B." A IA aponta **lacunas** (sem dar nota) e faz no máximo uma pergunta de volta.
- *Por quê:* autoexplicação tem g = 0,55 (Bisra 2018). Ensinar de fato tem d ≈ 0,8–0,9 (Fiorella & Mayer 2013). Teach-back foi eficaz em 19 de 20 estudos (Talevski 2020). Explicar revela a ilusão de entendimento (Rozenblit & Keil 2002). Conduzir o raciocínio antes de revelar a resposta alinha a habilidade percebida com a real (Kazemitabaar 2025).
- *Limite:* tornado obrigatório e frequente, irrita (Buçinca 2021) e pode não gerar ganho (Blasco & Charisi). "Pular" deve sempre estar disponível.

**R13. Separar o trilho de aprendizagem do de execução, com um "estacionamento de dúvidas".**
- **Regra:**
  - Durante a execução (agente rodando, código sendo escrito), a dúvida vai para um painel lateral ou nota "Dúvidas de hoje", com 1 linha de contexto e link.
  - A resposta imediata é curta e ancorada no ponto da dúvida.
  - Aprofundamentos e provocações chegam em **pontos de pausa** (fim da tarefa, antes de aprovar um plano, revisão do dia), nunca no meio do fluxo.
  - Ao interromper, gerar automaticamente um **ponto de retomada**: onde parei e qual o próximo passo.
- *Por quê:*
  - a retomada custa de 10 a 25 min, e 27% das suspensões passam de 2 h (Iqbal & Horvitz 2007);
  - o trabalho interrompido gera mais estresse (Mark 2008), e 2,8 s bastam para dobrar os erros (Altmann 2014);
  - pontos de pausa reduzem a frustração (Iqbal & Bailey 2008);
  - um plano de retomada reduz o resíduo de atenção (Leroy & Glomb 2018), e planos para pendências eliminam a intrusão (Masicampo & Baumeister 2011);
  - agentes proativos interrompem quando não sinalizam o que fazem (Pu 2025), enquanto explicações ancoradas distraem pouco (Ivie, 2024);
  - aprender e executar competem (Soderstrom & Bjork 2015; Seijts & Latham 2005).
- *No Monet:* o chat por pasta funciona como canal lateral, reaproveitando o padrão do chat do Reader.

**R14. Registrar a decisão no momento: leve, deliberativo e com o porquê do próprio usuário.**
- **Regra:** a IA rascunha o registro, mas o **porquê e a confiança** são escritos ou confirmados pelo usuário. O registro contém:
  - contexto, opções consideradas (incluindo não fazer nada), critérios e escolha;
  - uma **previsão verificável** ("em 30 dias, esperamos...");
  - **critérios de abandono** (sinais de que errei);
  - um **gatilho de revisão**, com data ou evento ("se p95 > 200 ms").
- O status começa como **"proposta"** e só vira "aceita" depois da decisão explícita.
- *Por quê:*
  - ADRs são raros e rasos, e 63% já nascem "aceitos", perdendo a deliberação (Buchgeher 2023; de Santana Jr. 2026);
  - a barreira é o custo de documentar (Tang 2006), que a IA reduz;
  - os vieses de resultado e retrospectivo exigem registrar **antes** do resultado (Baron & Hershey 1988; Fischhoff 1975);
  - gatilhos "se X, então Y" aumentam o cumprimento (d = 0,65; Gollwitzer & Sheeran 2006).
- *No Monet:* nota num caderno "Decisões" por projeto, com o gatilho virando item no Calendar ou nas Tasks. Antes de decidir, o RAG verifica conflitos com decisões anteriores da mesma pasta.

**R15. Revisitar com um debrief de 5 minutos e medir autonomia, não só satisfação.**
- **Regra:** na data ou no gatilho:
  - comparar a previsão com o resultado;
  - classificar no 2×2 decisão boa/ruim × resultado bom/ruim, separando processo de sorte (Duke);
  - registrar o que aprendeu e atualizar o glossário e as "regras pessoais".
- A fricção deve **diminuir** num tema conforme o usuário demonstra domínio, e **aumentar** em temas novos ou irreversíveis.
- *Por quê:*
  - debriefs têm d = 0,67 (Tannenbaum & Cerasoli 2013), e a reflexão escrita deu +22,8% (Di Stefano et al.);
  - reavaliar com distância melhora a estimativa (Vul & Pashler 2008);
  - sem feedback não há intuição calibrada (Kahneman & Klein 2009; Hogarth 2015);
  - a satisfação engana: as pessoas preferem o que as prejudica (Buçinca 2021; Cheng 2026), e a autoavaliação é otimista (Bastani 2025; Fernandes 2025; METR).

### Como medir se o companheiro está cumprindo a tese

- **Autonomia:** percentual de decisões caras ou irreversíveis com hipótese própria registrada. Percentual de explain-backs feitos sem pedir ajuda à IA.
- **Overreliance:** concordância com a IA nos casos em que, na revisão ou na verificação, ela estava errada.
- **Under-reliance:** rejeição da IA quando ela estava certa.
- **Calibração:** Brier score das confianças registradas contra os resultados nas revisões. Deve melhorar ao longo de meses.
- **Amplitude:** número de alternativas consideradas por decisão. Meta: 3 ou mais, contando "não fazer nada".
- **Ciclo fechado:** percentual de revisões feitas no prazo.
- **Retenção:** acerto nas revisões espaçadas do glossário. Termos que sobem para "sei explicar".
- **Burocracia (alarmes):** o tempo até decidir em decisões reversíveis **não pode subir**. Uma taxa alta de "pular" indica fricção mal calibrada.
- **Satisfação:** acompanhar, mas **não otimizar sozinha**.

---

## (d) O que é folclore, distorção ou carece de evidência

| Afirmação comum | Status | O que a evidência diz |
|---|---|---|
| "Explicações e transparência resolvem a dependência da IA" | **Contrária, no geral** | Aumentam a aceitação até de erros (Bansal 2021). Só ajudam quando barateiam a verificação (Vasconcelos 2023). Explicações longas inflam a confiança (Steyvers 2025). |
| "Basta pedir para o usuário ir com calma e pensar duas vezes" | **Contrária** | +30% de tempo sem ganho de acurácia (Norman 2014). O que funciona é estrutura: forçamento, reflexão em casos complexos. |
| "Pre-mortem aumenta em 30% a capacidade de identificar riscos corretamente" | **Distorcido** | +~30% no *número* de razões, sem medir qualidade (Mitchell 1989). Evidência escassa, mas positiva (Veinott 2010; Gallop & Bischoff 2016). |
| "Diário de decisões melhora decisões" | **Sem teste direto** | Plausível por evidência adjacente: reflexão, debrief, vieses de resultado e retrospectivo. Risco de virar burocracia abandonada, como os ADRs. |
| "ADRs melhoram a qualidade da arquitetura" | **Sem evidência causal** | Correlações pequenas com qualidade. Adoção baixa e rasa (Buchgeher 2023; de Santana Jr. 2026). |
| "Portas de mão única e de duas vias (Bezos)" | **Heurística, sem teste** | Útil para calibrar esforço. A reversibilidade tem custos ocultos: menor satisfação (Gilbert & Ebert 2002) e lock-in. |
| "Fadiga de decisão / ego depletion" | **Contrária** | Replicação em 23 laboratórios (N = 2.141): d = 0,04, IC incluindo zero (Hagger 2016). O caso dos "juízes famintos" foi contestado por fatores de agenda (Weinshall-Margel & Shapard 2011). |
| "Paradoxo da escolha: mais de 3 opções paralisa" | **Fraca e dependente de contexto** | Efeito médio praticamente zero, com grande variância (Scheibehenne 2010). |
| "Durma sobre o problema: o pensamento inconsciente decide melhor" | **Contrária** | Sem vantagem confiável (meta-análise e replicação com N = 399; Nieuwenstein 2015). Revisitar depois funciona por outro mecanismo, a estimativa independente (Vul & Pashler 2008). |
| "Efeito Zeigarnik: lembramos melhor do inacabado" | **Não se sustenta** | Meta-análise de 2025: sem vantagem de memória. Existe tendência a retomar (Ovsiankina), e planos reduzem a intrusão. |
| "Leva 23 minutos para recuperar o foco" | **Número sem fonte primária clara** | Dados primários variam: cerca de 10 + 10–15 min, 27% das suspensões acima de 2 h (Iqbal & Horvitz 2007); só 10% retomam a edição em menos de 1 min (Parnin & Rugaber 2011). Use faixas. |
| "Estilos de aprendizagem (visual, auditivo...)" | **Sem evidência** | Pashler et al. 2008. Personalize por conhecimento prévio. |
| "Explique como para um júnior / ELI5 é sempre melhor" | **Sem teste direto; depende** | O tom conversacional ajuda (d = 0,30 a 0,54), mas simplificar para quem já sabe atrapalha (reversão da expertise). |
| "Tutor socrático é sempre melhor que IA que responde" | **Depende do desenho** | Com salvaguardas evita o dano (Bastani 2025). Bem desenhado dobra o ganho (Kestin 2025). Socrático "puro" pode só gerar engajamento (Blasco & Charisi). |
| "Matriz de decisão ponderada é objetiva" | **Pseudo-precisão** | Pesos iguais são robustos (Dawes 1979). O ganho vem das avaliações independentes, não dos decimais. Analisar razões pode piorar escolhas de gosto (Wilson & Schooler 1991). |
| "Checklists sempre funcionam" | **Depende da implementação** | Grande efeito num estudo (Haynes 2009) e nulo quando imposto em escala (Urbach 2014). |
| "Se o dev se sente mais produtivo com IA, ele está" | **Contrária** | −19% medido contra +20% percebido (METR 2025). Superestimação com IA (Fernandes 2025). |
| "Técnica Feynman / rubber duck" | **Folclore com base adjacente sólida** | Não há estudos do formato, mas a autoexplicação (g = 0,55) e o aprender ensinando o sustentam. |
| "Provocar sempre melhora o pensamento crítico" | **Sem respaldo** | Efeitos quantitativos pequenos ou nulos, sinais de aumento de confiança e irritação com provocações genéricas (Drosos 2025). |

---

### Limitações deste levantamento

- **Tarefas simplificadas:** boa parte da evidência sobre overreliance vem de tarefas de laboratório com crowdworkers (nutrição, labirintos, LSAT, perguntas médicas), não de decisões reais de arquitetura de software. A transferência para o caso do Monet é inferência.
- **Estudos recentes ainda em preprint:** os trabalhos de 2025–2026 (Anthropic, METR, Drosos, Benk & Miller, Lehmann, Blasco & Charisi) ainda não têm, ou têm há pouco tempo, revisão por pares.
- **Conflito de interesse:** os estudos da GitHub, Microsoft e Anthropic são financiados por quem vende as ferramentas.
- **Números de fontes secundárias:** Veinott, Gallop & Bischoff (via Collins); Di Stefano et al. (via HBS Working Knowledge); Bastani (resumo e Wharton); DORA e Stack Overflow (via imprensa); Chiang 2024 (via resumo de tese).
- **Números lidos na fonte primária:** Nutt 1999, Lee 2025, Iqbal & Horvitz 2007 e Mark 2008.
- **Lacuna:** não foi encontrado nenhum estudo controlado de "diário de decisões", de "canal lateral de dúvidas" ou de "companheiro de decisão" para desenvolvedores. As regras acima combinam evidência adjacente.

---

## (e) Fontes

### Overreliance e estudos com desenvolvedores
- Bansal et al. (2021). *Does the Whole Exceed its Parts? The Effect of AI Explanations on Complementary Team Performance.* CHI. https://arxiv.org/abs/2006.14779
- Buçinca, Malaya & Gajos (2021). *To Trust or to Think: Cognitive Forcing Functions Can Reduce Overreliance on AI in AI-assisted Decision-making.* CSCW. https://arxiv.org/abs/2102.09692
- Vasconcelos et al. (2023). *Explanations Can Reduce Overreliance on AI Systems During Decision-Making.* CSCW. https://arxiv.org/abs/2212.06823
- Lee et al. (2025). *The Impact of Generative AI on Critical Thinking.* CHI. https://www.microsoft.com/en-us/research/publication/the-impact-of-generative-ai-on-critical-thinking-self-reported-reductions-in-cognitive-effort-and-confidence-effects-from-a-survey-of-knowledge-workers/ (PDF: https://advait.org/files/lee_2025_ai_critical_thinking_survey.pdf)
- Steyvers et al. (2025). *What large language models know and what people think they know.* Nature Machine Intelligence. https://arxiv.org/abs/2401.13835
- Si et al. (2024). *Large Language Models Help Humans Verify Truthfulness — Except When They Are Convincingly Wrong.* NAACL. https://aclanthology.org/2024.naacl-long.81
- Spatharioti, Rothschild, Goldstein & Hofman (2025). *Effects of LLM-based Search on Decision Making: Speed, Accuracy, and Overreliance.* CHI. https://dangoldstein.com/papers/spatharioti_rothschild_goldstein_hofman_LLM_Search_CHI25.pdf
- Bo, Wan & Anderson (2025). *To Rely or Not to Rely? Evaluating Interventions for Appropriate Reliance on LLMs.* CHI. https://arxiv.org/abs/2412.15584
- Kim, Liao, Vorvoreanu, Ballard & Vaughan (2024). *"I'm Not Sure, But...": Examining the Impact of LLMs' Uncertainty Expression on User Reliance and Trust.* FAccT. https://arxiv.org/abs/2405.00623
- Gajos & Mamykina (2022). *Do People Engage Cognitively with AI? Impact of AI Assistance on Incidental Learning.* IUI. https://arxiv.org/abs/2202.05402
- Buçinca, Swaroop, Paluch, Doshi-Velez & Gajos (2025). *Contrastive Explanations That Anticipate Human Misconceptions Can Improve Human Decision-Making Skills.* CHI. https://arxiv.org/abs/2410.04253
- Danry, Pataranutaporn, Mao & Maes (2023). *Don't Just Tell Me, Ask Me.* CHI. https://dspace.mit.edu/handle/1721.1/150613
- Fogliato et al. (2022). *Who Goes First? Influences of Human-AI Workflow on Decision Making in Clinical Imaging.* FAccT. https://arxiv.org/abs/2205.09696
- Le, Miller, Singh & Sonenberg (2024). *Towards the new XAI: A Hypothesis-Driven Approach to Decision Support Using Evidence.* https://arxiv.org/abs/2402.01292
- Benk & Miller (2026). Recommendation-driven × hypothesis-driven decision support (N = 290). https://arxiv.org/abs/2603.15824
- Reicherts et al. (2025). *AI, Help Me Think—but for Myself.* CHI. https://arxiv.org/abs/2504.06771
- Ma et al. (2025). *Towards Human-AI Deliberation.* CHI. https://arxiv.org/abs/2403.16812
- Chiang, Lu, Li & Yin (2024). *Enhancing AI-Assisted Group Decision Making through LLM-Powered Devil's Advocate.* IUI. https://par.nsf.gov/servlets/purl/10524816
- Fernandes et al. (2025). *AI makes you smarter but none the wiser.* Computers in Human Behavior. https://arxiv.org/abs/2409.16708
- Budzyń et al. (2025). *Endoscopist deskilling after exposure to AI in colonoscopy.* Lancet Gastroenterol. Hepatol. https://wrap.warwick.ac.uk/id/eprint/191005
- Sharma et al. (2024). *Towards Understanding Sycophancy in Language Models.* ICLR. https://arxiv.org/abs/2310.13548
- Cheng et al. (2025/2026). *Sycophantic AI decreases prosocial intentions and promotes dependence.* Science. https://arxiv.org/abs/2510.01395
- Simkute, Tankelevitch et al. (2024). *Ironies of Generative AI.* https://arxiv.org/abs/2402.11364
- Tankelevitch et al. (2024). *The Metacognitive Demands and Opportunities of Generative AI.* CHI. https://arxiv.org/abs/2312.10893
- Anthropic (2026). *How AI assistance impacts the formation of coding skills.* https://www.anthropic.com/research/AI-assistance-coding-skills (preprint: https://arxiv.org/abs/2601.20245)
- Anthropic (2025). *How AI is transforming work at Anthropic.* https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic
- METR (2025). *Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity.* https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
- METR (2026). *Uplift update.* https://evals.alignment.org/blog/2026-02-24-uplift-update/
- Peng, Kalliamvakou, Cihon & Demirer (2023). *The Impact of AI on Developer Productivity: Evidence from GitHub Copilot.* https://arxiv.org/abs/2302.06590
- Cui et al. (2025). *The Effects of Generative AI on High-Skilled Work.* Management Science. https://papers.ssrn.com/abstract=4945566
- DORA 2024, via InfoQ: https://www.infoq.com/news/2024/11/2024-dora-report/
- Stack Overflow Developer Survey 2025, via InfoWorld: https://infoworld.com/article/4031673/ai-use-among-software-developers-grows-but-trust-remains-an-issue-stack-overflow-survey.html
- Prather et al. (2024). *The Widening Gap.* ICER. https://arxiv.org/abs/2405.17739
- Kazemitabaar et al. (2023). *Studying the effect of AI Code Generators on Supporting Novice Learners.* CHI. https://arxiv.org/abs/2302.07427
- Lehmann, Cornelius & Sting. *AI Meets the Classroom: When Do LLMs Harm Learning?* https://arxiv.org/abs/2409.09047
- Barke, James & Polikarpova (2023). *Grounded Copilot.* OOPSLA. https://arxiv.org/abs/2206.15000

### IA provocadora, tutoria e explain-back
- Sarkar (2024). *AI Should Challenge, Not Obey.* CACM. https://arxiv.org/abs/2411.02263
- Drosos, Sarkar, Xu & Toronto (2025). *"It makes you think": Provocations Help Restore Critical Thinking to AI-Assisted Knowledge Work.* https://arxiv.org/abs/2501.17247
- Tankelevitch et al. (2025). *Synthesis of the CHI 2025 Tools for Thought Workshop.* https://arxiv.org/abs/2508.21036. Projeto MSR: https://www.microsoft.com/en-us/research/project/tools-for-thought/
- Bastani et al. (2025). *Generative AI without guardrails can harm learning.* PNAS. https://www.pnas.org/doi/10.1073/pnas.2422633122. Resumo: https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education
- Kestin et al. (2025). *AI tutoring outperforms in-class active learning.* Scientific Reports. https://pmc.ncbi.nlm.nih.gov/articles/PMC12179260/
- Blasco & Charisi. *Impact of LLMs on students: randomised study Socratic vs non-Socratic AI.* https://scale.stanford.edu/ai/repository/impact-large-language-models-students-randomised-study-socratic-vs-non-socratic-ai
- Kazemitabaar et al. (2025). *Exploring the Design Space of Cognitive Engagement Techniques with AI-Generated Code.* IUI. https://arxiv.org/abs/2410.08922
- Jin et al. (2024). *Teach AI How to Code (AlgoBo).* CHI. https://arxiv.org/abs/2309.14534
- Bisra et al. (2018). *Inducing Self-Explanation: a Meta-Analysis.* Educ. Psychol. Review. https://www.gwern.net/doc/psychology/spaced-repetition/2018-bisra.pdf
- Fiorella & Mayer (2013). *The relative benefits of learning by teaching and teaching expectancy.* Contemp. Educ. Psychol. https://doi.org/10.1016/j.cedpsych.2013.06.001
- Talevski et al. (2020). *Teach-back: A systematic review.* PLOS ONE. https://pmc.ncbi.nlm.nih.gov/articles/PMC7156054/
- Rozenblit & Keil (2002). *The misunderstood limits of folk science: an illusion of explanatory depth.* Cognitive Science. https://doi.org/10.1207/s15516709cog2605_1
- Fisher, Goddu & Keil (2015). *Searching for explanations: How the Internet inflates estimates of internal knowledge.* JEP: General. https://www.apa.org/news/press/releases/2015/03/internet-knowledge

### Explicações no nível certo e retenção
- VanLehn (2011). *The relative effectiveness of human tutoring, ITS, and other tutoring systems.* Educational Psychologist. https://doi.org/10.1080/00461520.2011.611369
- Kalyuga, Ayres, Chandler & Sweller (2003). *The Expertise Reversal Effect.* Educational Psychologist. https://doi.org/10.1207/S15326985EP3801_4
- Hinds (1999). *The curse of expertise.* JEP: Applied. https://doi.org/10.1037/1076-898X.5.2.205
- Mayer: princípio do pré-treino (Cambridge Handbook of Multimedia Learning). https://www.cambridge.org/core/books/abs/multimedia-learning/pretraining-principle/01791D57F5D4164251269E6DF56A8BF1
- Alfieri, Nokes-Malach & Schunn (2013). *Learning through Case Comparisons: A Meta-Analytic Review.* https://www.academia.edu/3708913/Learning_through_Case_Comparisons_A_Meta_Analytic_Review
- Gentner, Loewenstein & Thompson (2003). *Learning and transfer: A general role for analogical encoding.* https://dedregentner.owlstown.net/publications/38525-learning-and-transfer-a-general-role-for-analogical-encoding. Loewenstein, Thompson & Gentner (2003, AMLE): https://business.illinois.edu/loewenstein/papers/Loewensteinetal%20AMLE03.pdf
- Ginns, Martin & Marsh (2013). *Designing instructional text in a conversational style: A meta-analysis.* https://researchers.westernsydney.edu.au/en/publications/designing-instructional-text-in-a-conversational-style-a-meta-ana/
- Pashler, McDaniel, Rohrer & Bjork (2008). *Learning Styles: Concepts and Evidence.* https://digitalcommons.usf.edu/psy_facpub/1765/
- Dunlosky et al. (2013). *Improving Students' Learning With Effective Learning Techniques.* PSPI. https://doi.org/10.1177/1529100612453266
- Yang et al. (2021). *Testing (quizzing) boosts classroom learning.* Psychol. Bulletin. https://scholars.hkbu.edu.hk/en/publications/testing-quizzing-boosts-classroom-learning-a-systematic-and-meta-/
- Adesope, Trevisan & Sundararajan (2017). *Rethinking the Use of Tests.* RER. https://journals.sagepub.com/doi/10.3102/0034654316689306
- Cepeda et al. (2008). *Spacing effects in learning: a temporal ridgeline of optimal retention.* https://pubmed.ncbi.nlm.nih.gov/19076480/
- Kornell, Hays & Bjork (2009). *Unsuccessful retrieval attempts enhance subsequent learning.* https://pubmed.ncbi.nlm.nih.gov/19586265/
- Bertsch et al. (2007). *The generation effect: a meta-analytic review.* https://pubmed.ncbi.nlm.nih.gov/17645161/
- Kerfoot et al. (2007). *Spaced education improves the retention of clinical knowledge.* https://pubmed.ncbi.nlm.nih.gov/17209889/

### Higiene de decisão, ADRs e engenharia de software
- Kahneman, Sibony & Sunstein (2021). *Noise: A Flaw in Human Judgment.* https://www.publishersweekly.com/9780316451406
- Kahneman, Lovallo & Sibony (2019). *A Structured Approach to Strategic Decisions.* MIT SMR. https://sloanreview.mit.edu/article/a-structured-approach-to-strategic-decisions/ (registro: https://ses.library.usyd.edu.au/handle/2123/28501)
- Sackett, Zhang, Berry & Lievens (2022). *Revisiting meta-analytic estimates of validity in personnel selection.* JAP. https://doi.org/10.1037/apl0000994
- Grove et al. (2000). *Clinical versus mechanical prediction: a meta-analysis.* Psychol. Assessment. https://doi.org/10.1037/1040-3590.12.1.19
- Dawes (1979). *The robust beauty of improper linear models.* American Psychologist. https://doi.org/10.1037/0003-066X.34.7.571
- Kahneman & Klein (2009). *Conditions for intuitive expertise: a failure to disagree.* https://pubmed.ncbi.nlm.nih.gov/19739881/
- Hogarth, Lejarraga & Soyer (2015). *The two settings of kind and wicked learning environments.* https://doi.org/10.1177/0963721415591878
- Nutt (1999). *Surprising but true: Half the decisions in organizations fail.* AME. https://cebma.org/assets/Uploads/Nutt-1999-gecomprimeerd.pdf
- Frederick et al. (2009). *Opportunity Cost Neglect.* JCR. https://ideas.repec.org/a/oup/jconrs/v36y2009i4p553-561.html
- Scheibehenne, Greifeneder & Todd (2010). *Can there ever be too many options?* JCR. https://abcwest.cogs.indiana.edu/pmwiki/pdf/scheibehenne.options.2010.pdf
- Klein (2007). *Performing a Project Premortem.* HBR. https://hbr.org/2007/09/performing-a-project-premortem
- Mitchell, Russo & Pennington (1989). *Back to the future: Temporal perspective in the explanation of events.* JBDM. https://colab.ws/articles/10.1002%2Fbdm.3960020103
- Collins: revisão da evidência sobre pre-mortem (Veinott et al. 2010; Gallop & Bischoff 2016). https://corporate.jcx.au/premortem
- Lord, Lepper & Preston (1984). *Considering the opposite.* JPSP. https://doi.org/10.1037/0022-3514.47.6.1231
- Mussweiler, Strack & Pfeiffer (2000). *Overcoming the inevitable anchoring effect.* PSPB. https://doi.org/10.1177/01461672002611010
- Morewedge et al. (2015). *Debiasing Decisions: Improved Decision Making With a Single Training Intervention.* https://openaccess.city.ac.uk/id/eprint/12324
- Sellier, Scopelliti & Morewedge (2019). *Debiasing training transfers to improve decision making in the field.* Psychol. Science. https://openaccess.city.ac.uk/id/eprint/22233/
- Chang, Chen, Mellers & Tetlock (2016). *Developing expert political judgment.* JDM. https://ideas.repec.org/a/cup/judgdm/v11y2016i5p509-526_8.html
- Herzog & Hertwig (2009). *The wisdom of many in one mind.* https://edoc.unibas.ch/10055 ; Vul & Pashler (2008). *Measuring the crowd within.* https://www.gwern.net/doc/statistics/prediction/2008-vul.pdf
- Bezos, carta aos acionistas de 2015 (Tipo 1/Tipo 2). Trecho e referência à SEC: https://fs.blog/reversible-irreversible-decisions/
- Gilbert & Ebert (2002). *Decisions and revisions.* JPSP. https://dtg.sites.fas.harvard.edu/Gilber%20t&%20Ebert%20(DECISIONS%20&%20REVISIONS).pdf
- Duke: *resulting* (Thinking in Bets). https://nautil.us/the-resulting-fallacy-is-ruining-your-decisions-236901
- Baron & Hershey (1988). *Outcome bias in decision evaluation.* JPSP. https://doi.org/10.1037/0022-3514.54.4.569
- Fischhoff (1975). *Hindsight ≠ foresight.* JEP: HPP. https://doi.org/10.1037/0096-1523.1.3.288
- Di Stefano, Gino, Pisano & Staats. *Learning by Thinking.* https://www.library.hbs.edu/working-knowledge/reflecting-on-work-improves-job-performance ; https://papers.ssrn.com/abstract=2414478
- Tannenbaum & Cerasoli (2013). *Do team and individual debriefs enhance performance? A meta-analysis.* https://pubmed.ncbi.nlm.nih.gov/23516804/
- Gollwitzer & Sheeran (2006). *Implementation intentions and goal achievement: a meta-analysis.* https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f
- Nygard (2011). *Documenting Architecture Decisions.* https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- Buchgeher et al. (2023). *Using ADRs in Open Source Projects: An MSR Study on GitHub.* IEEE Access. https://research.jku.at/en/publications/using-architecture-decision-records-in-open-source-projects-an-ms/
- de Santana Junior et al. (2026). *ADRs: Adoption, Impact, and Developer Engagement in OSS.* ICSA. https://conf.researchr.org/details/icsa-2026/icsa-2026-papers/34/Architecture-Decision-Records-Adoption-Impact-and-Developer-Engagement-in-Open-Sou
- Tang, Babar, Gorton & Han (2006). *A survey of architecture design rationale.* JSS. https://figshare.swinburne.edu.au/articles/report/A_survey_of_architecture_design_rationale/26269849
- Tang, Bex, Schriek & van der Werf (2018). *Improving software design reasoning: A reminder card approach.* JSS. https://research-portal.uu.nl/en/publications/improving-software-design-reasoning-a-reminder-card-approach/
- Razavian, Tang, Capilla & Lago (2016). *In Two Minds.* JSEP. https://research.vu.nl/en/publications/in-two-minds-how-reflections-influence-software-architecture-desi/
- Borowa, Rebouças de Almeida & Wiese (2025). *Debiasing Architectural Decision-Making: An Experiment With Students and Practitioners.* ICSA. https://arxiv.org/abs/2502.04011
- Chattopadhyay et al. (2020). *A Tale from the Trenches: Cognitive Biases and Software Development.* ICSE. https://par.nsf.gov/servlets/purl/10289961
- Falessi, Cantone, Kazman & Kruchten (2011). *Decision-making techniques for software architecture design.* ACM CSUR. https://doi.org/10.1145/1978802.1978812
- Wilson & Schooler (1991). *Thinking too much.* JPSP. https://doi.org/10.1037/0022-3514.60.2.181
- Haynes et al. (2009). Surgical safety checklist. NEJM. https://doi.org/10.1056/NEJMsa0810119 ; Urbach et al. (2014), NEJM. https://doi.org/10.1056/NEJMsa1308261
- Norman et al. (2014). *The etiology of diagnostic errors.* https://psnet.ahrq.gov/issue/etiology-diagnostic-errors-controlled-trial-system-1-versus-system-2-reasoning ; Mamede et al. (2008), comentado em https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4530537/
- Hagger et al. (2016). *Multilab preregistered replication of the ego-depletion effect.* https://research.tilburguniversity.edu/en/publications/a-multi-lab-pre-registered-replication-of-the-ego-depletion-effec/
- Danziger, Levav & Avnaim-Pesso (2011). PNAS. https://doi.org/10.1073/pnas.1018033108 ; Weinshall-Margel & Shapard (2011). PNAS. https://doi.org/10.1073/pnas.1110910108
- Nieuwenstein et al. (2015). *On making the right choice: unconscious thought advantage.* JDM. https://dlab.sauder.ubc.ca/sjdm/journal/14/14321/jdm14321.html

### Carga cognitiva e interrupções
- Mark, Gudith & Klocke (2008). *The Cost of Interrupted Work: More Speed and Stress.* CHI. https://www.interruptions.net/literature/Mark-CHI08.pdf
- Iqbal & Horvitz (2007). *Disruption and Recovery of Computing Tasks.* CHI. https://www.erichorvitz.com/CHI_2007_Iqbal_Horvitz.pdf
- Iqbal & Bailey (2008). *Effects of intelligent notification management on users and their tasks.* CHI. https://www.interruptions.net/literature/Iqbal-CHI08.pdf
- Altmann, Trafton & Hambrick (2014). *Momentary interruptions can derail the train of thought.* JEP: General. https://www.interruptions.net/literature/Altmann-JExpPsycholGen14.pdf
- Parnin & Rugaber (2011). *Resumption strategies for interrupted programming tasks.* https://sites.cc.gatech.edu/reverse/repository/resumptionstrategies.pdf
- DeLine & Parnin (2010). *Evaluating Cues for Resuming Interrupted Programming Tasks.* CHI. https://www.microsoft.com/en-us/research/publication/evaluating-cues-for-resuming-interrupted-programming-tasks/
- Leroy & Glomb (2018). *Tasks Interrupted.* Organization Science. https://www.washington.edu/news/2018/01/16/task-interrupted-a-plan-for-returning-helps-you-move-on/
- Masicampo & Baumeister (2011). *Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals.* JPSP. https://doi.org/10.1037/a0024192
- Ghibellini & Meier (2025). *Interruption, recall and resumption: a meta-analysis of the Zeigarnik and Ovsiankina effects.* https://ideas.repec.org/a/pal/palcom/v12y2025i1d10.1057_s41599-025-05000-w.html
- Soderstrom & Bjork (2015). *Learning versus performance: An integrative review.* https://doi.org/10.1177/1745691615569000
- Seijts & Latham (2005). *Learning versus performance goals: When should each be used?* https://wku.edu/cebs/doctorate/documents/readings/seijts_latham_2005_learning_vs_performance_goals.pdf
- Yan, Hwang, Wu & Head (2024). *Ivie: Lightweight Anchored Explanations of Just-Generated Code.* CHI. https://arxiv.org/abs/2403.02491
- Pu et al. (2025). *Assistance or Disruption? Proactive AI Programming Support.* CHI. https://arxiv.org/abs/2502.18658
- Stadler, Bannert & Sailer (2024). *Cognitive ease at a cost.* CHB. https://portal.fis.tum.de/en/publications/cognitive-ease-at-a-cost-llms-reduce-mental-effort-but-compromise/
- Fan et al. (2025). *Beware of Metacognitive Laziness.* BJET. https://arxiv.org/abs/2412.09315
- Kosmyna et al. (2025). *Your Brain on ChatGPT* (preprint). https://arxiv.org/abs/2506.08872. Crítica: https://arxiv.org/abs/2601.00856
