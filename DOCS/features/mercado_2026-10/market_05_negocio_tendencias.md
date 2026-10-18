# Mercado e negócio de apps de anotações / PKM — contexto 2024–2026

Pesquisa de contexto para o estudo de mercado do Monet · data de corte: **17/10/2026** · idioma: pt-BR (nomes de produtos no original)

---

## Como ler este relatório

Cada dado sensível a tempo traz a data da informação e uma etiqueta de confiabilidade:

| Etiqueta | Significado |
|---|---|
| **[P]** | Fonte primária: site, blog, página de preços, documento ou repositório oficial da própria empresa |
| **[J]** | Imprensa (TechCrunch, 9to5Mac, Bloomberg, CNBC etc.) reportando dado da empresa ou de documento público |
| **[S]** | Secundária: agregador, blog de terceiros, fórum, podcast — útil, mas não auditada |
| **[E]** | Estimativa de terceiros (Sacra, GetLatka, Starter Story etc.) — não é dado da empresa |
| **[I]** | Inferência deste relatório, a partir das evidências citadas |

Limitações importantes (detalhadas na seção "Lacunas"): o orçamento de buscas web da sessão acabou no meio da pesquisa, o Reddit ficou inacessível às ferramentas, e algumas fontes primárias (CNBC, Axios, OpenAI, central de ajuda do Evernote) bloquearam o acesso. Nesses casos, uso fontes secundárias e indico isso.

---

## Resumo executivo

1. **Os relatórios de "tamanho de mercado" não servem de âncora.** As estimativas para 2025 vão de US$ 2,1 bi a US$ 11,1 bi, uma diferença de cerca de 5x, com definições opacas. As âncoras confiáveis são os números das empresas.
2. **O Notion é o gigante do segmento:** 100 milhões de usuários (ago/2024) [P], mais de US$ 500 milhões de receita anualizada (set/2025) [J], mais de US$ 600 milhões de ARR (dez/2025) [J/S] e valuation de US$ 11 bi em tender offer (dez/2025–jan/2026) [J/S]. Cerca de metade da receita vem de produtos de IA [S].
3. **Indies enxutos e lucrativos existem e são o modelo mais próximo do Monet:** o Obsidian tem 7 pessoas e se declara "100% user-supported" [P]. A Capacities tem cerca de 6,5 FTE, é bootstrapped e lucrativa, com cerca de 250 mil registrados e cerca de 20 mil ativos [J]. A Heptabase alega ARR de 7 dígitos, mas isso não foi verificado [E].
4. **Consolidação e "financeirização".** A Bending Spoons, dona do Evernote, abriu capital na Nasdaq (jul/2026) e comprou a Airtable por EV de US$ 1,285 bi (ago/2026) [J]. O Evernote limita o plano grátis a 50 notas e 1 dispositivo e cobra US$ 99/ano (Starter) ou US$ 249,99/ano (Advanced) [P/S].
5. **A cobrança por IA migrou de add-on para bundle + créditos medidos.** Exemplos: Notion Business com IA inclusa e Custom Agents a US$ 10 por 1.000 créditos; créditos em Heptabase, RemNote, Craft e Tana; Mem com faixas por uso. Ao mesmo tempo, surgem o BYOK (Reflect Open, jul/2026) e a IA local (Microsoft Foundry Local) [P].
6. **Encerramentos e pivôs frequentes** reforçam o medo de lock-in: Notion Mail (17 meses de vida), Pocket, Omnivore, Skiff, Arc, Limitless/Rewind. A Tana se reposicionou como "agentic meeting platform" e a Reflect virou open source com BYOK [P/J].
7. **Tendências com evidência forte:**
   - MCP como padrão: mais de 10 mil servidores públicos; Notion, Evernote, Capacities, Craft, Granola, Tana e Reflect já expõem MCP.
   - Agentes no workspace.
   - IA para aprender: Study Mode, Learning mode, Guided Learning e Gemini Notebook, este com mais de 30 milhões de usuários.
   - Local-first: o ensaio da Ink & Switch voltou ao topo do HN com 883 pontos em jul/2025.
   - Usuários querem trazer os próprios agentes para dentro das notas: os tópicos mais vistos do fórum do Obsidian no último ano são plugins de Claude Code/Codex/Gemini CLI.
8. **O sentimento dominante é cansaço:**
   - de IA forçada ("AI slop");
   - de inchaço e lentidão;
   - de assinaturas;
   - de lock-in.
   Há também "second brain fatigue" explícita (Westenberg, jun/2025). Sync e mobile continuam sendo as dores técnicas mais citadas.
9. **Microsoft Store: o acesso barateou, a descoberta não.** A loja tem mais de 250 milhões de MAU, registro grátis para desenvolvedores e 0% de comissão com commerce próprio (15% via commerce da Microsoft) [P]. Mas o top de produtividade grátis é dominado por marcas grandes: OneNote em #17 e Samsung Notes em #18; Notion, Evernote e Obsidian não aparecem no top 24. Nos indies, o crescimento veio de comunidade, YouTube e boca a boca.
10. **Brasil: não há dados confiáveis de uso por estudantes ou concurseiros.** O Windows tem 86,7% do desktop no Brasil, contra 76,4% no mundo [S]. Apps de notas cobram em USD sem preço regional (Notion, Obsidian, Capacities), enquanto o Spotify cobra cerca de 36% do preço americano. A Google oferece AI Plus grátis por 1 ano a universitários até 31/12/2026 [P].

---

## 1. Tamanho e crescimento do mercado

### 1.1 Relatórios de "market research": números e crítica

| Fonte | Recorte declarado | 2025 | Projeção | CAGR | Observação |
|---|---|---|---|---|---|
| The Business Research Company (via GII) | "note taking app" global | US$ 11,11 bi | US$ 23,79 bi (2029) | 21,0% | Edição posterior da mesma série: US$ 11,02 bi (2025), US$ 28,05 bi (2030), 20,5% |
| MarketIntelo | "note taking app" | US$ 2,1 bi | US$ 4,6 bi (2034) | 9,2% | O menor valor encontrado |
| Technavio | "AI note-taking" | n/d | n/d | 21,3% (2024–2029) | Só o nicho de IA |
| Agregação (anotherwrapper) | faixa de vários relatórios | US$ 7,9–17,2 bi | n/d | 11–21% | Serve só para mostrar a dispersão |
| llcbuddy | "handwritten notes software" | US$ 576,1 mi | n/d | 12,9% | Página com datas incoerentes; **descartar** |

**Crítica:**
- As estimativas de 2025 diferem em cerca de 5x. Os relatórios ficam atrás de paywall e não divulgam metodologia nem o que entra na conta: suites, ferramentas de equipe, transcrição de reuniões, apps de escrita à mão.
- É o padrão típico de "market research" genérico, gerado em massa e revendido por intermediários como a GII. **Não recomendo usar nenhum desses números como TAM sem ressalva.**
- **[I] Checagem de baixo para cima:** a maior empresa do segmento, o Notion, tinha entre US$ 0,6 e 0,9 bi de ARR em 2025–2026, e boa parte vem de colaboração em equipes, não de "anotações pessoais".
- Os demais players conhecidos são ordens de grandeza menores ou não divulgam receita. Para chegar a US$ 11 bi de "apps de notas", seria preciso incluir categorias adjacentes: suites de escritório, wikis corporativas, notetakers de reunião.
- O recorte "PKM pessoal pago" é provavelmente bem menor que qualquer um desses números.

### 1.2 Números concretos de empresas

| Empresa | Métrica | Valor | Data | Tipo |
|---|---|---|---|---|
| **Notion** | Usuários | 100 milhões | ago/2024 (post de 03/09/2024) | [P] |
| Notion | Receita anualizada | > US$ 500 mi (lançamento do Notion Agent) | 18/09/2025 | [J] CNBC (acesso bloqueado; conteúdo via agregadores) |
| Notion | ARR | > US$ 600 mi; cerca de metade de produtos de IA (cerca de US$ 300 mi); fluxo de caixa positivo; cerca de 1.000 funcionários | dez/2025 | [J/S] Forbes via Trending Topics |
| Notion | Valuation | US$ 11 bi (tender de US$ 270–300 mi; compradores Sequoia, Index e GIC); antes US$ 10 bi | anunciado 15/12/2025; concluído jan/2026 | [J/S]/[E] |
| Notion | ARR estimado | US$ 865 mi (+82% a/a) | jul/2026 | [E] Sacra |
| **Obsidian** | Equipe | 7 pessoas (CEO, 2 cofundadores, 3 engenheiros, 1 suporte) | out/2026 | [P] |
| Obsidian | Uso corporativo | > 10.000 organizações usam no trabalho | 20/02/2025 | [P] |
| Obsidian | Ecossistema | > 8.000 plugins/temas (o dobro desde mai/2026); > 120 mi de downloads de plugins | mai–out/2026 | [P] |
| Obsidian | Receita e usuários | Não divulgados. Estimativas de US$ 2 mi (GetLatka) a US$ 25 mi (post viral, abr/2026, não verificado); cerca de 1–1,5 mi de usuários (não oficial) | 2025–2026 | [E] |
| **Bending Spoons** (Evernote) | Receita | US$ 1,31 bi (2025); US$ 601 mi no 1º tri/2026 (+132%); lucro de cerca de US$ 27 mi no 1º tri/2026 | jun/2026 (prospecto) | [J] |
| Bending Spoons | Escala | > 500 mi de MAU no portfólio; 9 mi de clientes pagantes; > 50 aquisições | jun/2026 | [J] |
| Bending Spoons | IPO | Nasdaq (BSP), US$ 29/ação, cerca de US$ 1,68 bi levantados; cerca de US$ 18 bi de valuation no preço; cerca de US$ 25 bi após o 1º dia | 01/07/2026 | [J] |
| Evernote | Receita isolada | Não divulgada | — | — |
| **Granola** | Série C | US$ 125 mi a US$ 1,5 bi; antes US$ 43 mi a US$ 250 mi (mai/2025); total de cerca de US$ 192 mi | 25/03/2026 | [J] |
| **Gemini Notebook** (ex-NotebookLM) | Uso | > 30 mi de pessoas e > 600 mil organizações | 16/07/2026 | [P] |
| **Tana** | Captação | US$ 25 mi no total (Série A de US$ 14 mi a US$ 100 mi pós-money); lista de espera de 160 mil pessoas | 03/02/2025 | [S] |
| **Capacities** | Uso, equipe e finanças | Cerca de 250 mil registrados, cerca de 20 mil ativos ou muito ativos, cerca de 6,5 FTE, lucrativa, sem capital externo | 14/07/2026 | [J] deutsche-startups |
| Capacities | Alegação da homepage | "> 50.000 active knowledge workers" (conflita com o número da entrevista) | out/2026 | [P] |
| **Heptabase** | Captação | Seed de cerca de US$ 1,7 mi (2022; YC, Kleiner Perkins, HOF) | 2022 | [S] |
| Heptabase | Receita | "ARR de 7 dígitos em 2 anos" (post do fundador no Indie Hackers, citado pela Starter Story); "US$ 200 mil/mês" (Starter Story); cerca de 6 pessoas (est.) | jan/2025 | [E] não verificado |
| **Craft** | Captação | Série A de US$ 8 mi (2021); Série B de US$ 12,2 mi (set/2022); alega "milhões de usuários" | 2022 | [P]/[S] |
| **Mem** | Captação | US$ 23,5 mi liderados pelo OpenAI Startup Fund (US$ 110 mi pós-money) | nov/2022 | [S] |
| **Logseq** | Captação | US$ 4,1 mi | mai/2022 | [P] |
| **Readwise** | Finanças | Bootstrapped, sem números recentes | — | [P]/[S] |
| **Omnivore** | Uso | 500 mil usuários na época do acqui-hire | out/2024 | [P] |
| Airtable (adjacente) | ARR | Cerca de US$ 480 mi (+20% a/a); vendida por cerca de 2,7x o ARR | jun–ago/2026 | [J] |

**Leitura [I]:**
- Há três "andares" de escala:
  - plataformas com dezenas a centenas de milhões de usuários: Notion e Gemini Notebook, além de OneNote e Apple Notes, sem dados aqui;
  - VC-backed de nicho com valuations altas, sobretudo IA de reuniões: Granola;
  - indies com centenas de milhares de registrados e dezenas de milhares de ativos: Capacities, provavelmente Heptabase e Obsidian em escala maior.
- Para o Monet, o comparável realista é o terceiro andar.

---

## 2. Modelos de receita e benchmarks de preço

### 2.1 Modelos observados (2024–2026)

| Modelo | Exemplos verificados | Notas |
|---|---|---|
| Freemium por assento | Notion (Free, Plus, Business, Enterprise) | IA virou motivo para subir de tier |
| Freemium com limite agressivo | Evernote Free (50 notas, 1 caderno, 1 dispositivo) | Monetiza pela inércia; gera reação negativa (seção 7) |
| App grátis + serviços pagos | Obsidian (Sync, Publish); Joplin (Joplin Cloud); AFFiNE (nuvem); Logseq (Sync para patrocinadores) | O modelo local-first mais citado como "o que funciona" no HN |
| Mecenato / "pague mais sem ganhar features" | Obsidian Catalyst (US$ 25 único); Obsidian Commercial (opcional desde fev/2025); Capacities Believer; AFFiNE Believer (vitalício, US$ 499,99) | O Believer da Capacities gerou €1–2 mil de MRR em poucos dias no lançamento [J] |
| Vitalício (lifetime) | UpNote (US$ 39,99); AFFiNE Believer | Comum em indies baratos |
| Só pago (sem free) | Readwise (trial de 30 dias); Reflect Classic | Funciona com nicho e integração forte |
| Créditos ou faixas de uso de IA | Notion Custom Agents; Heptabase; RemNote; Craft; Tana; Capacities Plus; Mem | Tendência dominante em 2026 |
| Add-on de IA separado | Goodnotes AI Pass; AFFiNE AI; RemNote "Pro with AI" | Encarece a entrada de quem quer IA |
| BYOK (chave do usuário) | Reflect Open (jul/2026); plugins do Obsidian (SecretStorage, out/2026); SiYuan | Custo de inferência zero para o desenvolvedor |
| IA local / on-device | Microsoft Foundry Local (Windows); Apple Foundation Models; busca semântica local no Reflect Open; plugin "Local Graph RAG" no Obsidian | Ainda é complemento, não substituto, dos modelos de fronteira |

### 2.2 Tabela de preços de entrada (USD, salvo indicação) — out/2026

| App | Grátis? | Entrada paga (mensal / anual) | O que destrava | IA no plano | Fonte |
|---|---|---|---|---|---|
| **Notion** | Sim (uploads de 5 MB, histórico de 7 dias) | Plus: US$ 10/membro/mês como exibido; Business: US$ 20; "até 20% de desconto no anual" (fontes secundárias: US$ 10/20 no anual, US$ 12/24 no mensal) | Plus: limites de equipe pequena; Business: IA | Free/Plus: só trial. Business: Notion Agent, AI Meeting Notes, Enterprise Search. Custom Agents: US$ 10 por 1.000 créditos/mês, sem rollover | [P] notion.com/pricing; [S] |
| **Obsidian** | App grátis sem limites (inclusive uso comercial desde 20/02/2025) | Sync Standard: US$ 4/mês no anual ou US$ 5 mensal (1 cofre, 1 GB). Sync Plus: US$ 8/10 (10 cofres, 10 GB). Publish: US$ 8/10 por site. Catalyst: US$ 25 (único). Commercial: US$ 50/usuário/ano (opcional) | Sync E2EE, histórico, publicação web | Sem IA nativa (IA via plugins) | [P] |
| **Evernote** | 50 notas, 1 caderno, 1 dispositivo, 1 GB | Starter: US$ 8,25/mês (US$ 99/ano) ou US$ 14,99 mensal (1.000 notas, 20 cadernos, 3 dispositivos, 5 GB). Advanced: US$ 20,83/mês (US$ 249,99/ano) ou US$ 24,99 mensal (ilimitado) | Remove limites | AI Assistant, busca semântica, transcrição, MCP (distribuição por plano não especificada) | [P] compare-plans; [S] TidBITS |
| **Bear** (só Apple) | Sim (limitado) | Pro: US$ 2,99/mês ou US$ 29,99/ano | Sync, temas, exportação | Não destacada | [P] |
| **UpNote** | Até 50 notas | US$ 1,99/mês; vitalício US$ 39,99 | Notas ilimitadas; roda em Windows, Mac, Linux, iOS e Android | — | [P] |
| **Capacities** | Sim (sem IA) | Pro: US$ 9,99/mês no anual (US$ 119,88/ano). Believer: US$ 12,49/mês no anual. Add-on Plus de IA: +US$ 8,33/mês no anual | Tarefas, API, versões, análise de PDF/imagem, conectores ChatGPT/Claude/Cursor | "Orçamento leve" no Pro; Plus para uso regular; top-ups. 40% de desconto para estudantes (anual) | [P] |
| **Heptabase** | Não (trial não confirmado) | Pro: US$ 8,99/mês (100 créditos). Premium: US$ 17,99 (1.800 créditos, AI tutor, OCR). Premium+: US$ 53,99. "Anual economiza 25%" | Grifos em PDF, transcrição do YouTube, quadros | Créditos; no Pro, só modelos Gemini | [P] |
| **Tana** | 50 consultas de IA, 5 reuniões/mês | Pro: US$ 20/usuário/mês em "early bird" (cheio US$ 30) | Reuniões ilimitadas, agente sem bot, MCP completo | "20x" o free; créditos extras que não expiram | [P] |
| **Craft** | 1.500 blocos, 15 créditos de IA | Plus: R$ 41,60 mensal ou R$ 33,30/mês no anual (exibido em BRL para acesso do Brasil; preço em USD não verificado) | Blocos ilimitados, 1 TB, API/MCP | 50 créditos/mês no Plus. Educação grátis | [P] |
| **Reflect** | Não (Classic). O Reflect Open para Mac é grátis | Classic: cerca de US$ 10/mês no anual (US$ 120/ano) [S]. Reflect Open: grátis, open source; iOS será pago (preço não definido) | Open: Markdown local, sync via iCloud/Git | Open: BYOK (OpenAI, Anthropic, Google, OpenRouter) | [P]/[S] |
| **Mem** | Sim (25 mensagens/notas) | Plus: US$ 9. Pro: US$ 29. Pro 2x: US$ 49 … Pro 20x: US$ 199 (mensal) | Rotinas, conexões, Voice Mode por horas | Precificação por volume de uso | [P] |
| **Readwise** | Não (trial de 30 dias) | Lite: US$ 5,59/mês no anual. Full: US$ 9,99/mês no anual ou US$ 12,99 mensal | Reader, tags, notas | — | [P]; 50% para acadêmicos |
| **RemNote** | 250 créditos de IA, 3 PDFs anotados | Pro: US$ 8/mês (US$ 96/ano). Pro with AI: US$ 18/mês (US$ 216/ano) | PDFs ilimitados, oclusão de imagem, agenda de provas | 1.000 ou 20.000 créditos; "Learn PDF", gravador de aula | [P] |
| **Goodnotes** | 3 cadernos, 100 MB | Essential: US$ 11,99/ano. Pro: US$ 35,99/ano | Cadernos ilimitados, sync | Add-on AI Pass: US$ 9,99/mês | [P] |
| **Granola** | Basic (histórico de 30 dias) | Business: US$ 14/usuário/mês. Enterprise: US$ 35 | Histórico ilimitado, escolha de modelo, MCP/API | IA é o produto | [P] |
| **AFFiNE** | Uso local ilimitado + 10 GB na nuvem | Pro: US$ 6,75/mês (cadência ambígua). Believer vitalício: US$ 499,99 | Nuvem de 100 GB, colaboração | Add-on AFFiNE AI: US$ 8,9/mês (anual) | [P] |
| **Joplin Cloud** | App grátis (open source) | Basic: €2,99/mês ou €28,69/ano. Pro: €5,99/mês ou €57,48/ano | Sync hospedado, compartilhamento | — | [P]; 50% para estudantes |
| **Microsoft 365** (OneNote + Copilot) | OneNote grátis | Personal: US$ 9,99/mês ou US$ 99,99/ano. Premium: US$ 19,99/mês | Copilot no Word/OneNote etc. (créditos mensais) | Reajuste de +US$ 3/mês em jan/2025 junto com o Copilot; planos "Classic" sem IA | [P] |
| **Gemini Notebook** | Sim | Incluído com "expanded access" no Google AI Pro (R$ 96,99/mês no Brasil) | Limites maiores | Execução de código no AI Ultra; Pro "nas próximas semanas" (jul/2026) | [P] |

### 2.3 Como os apps cobram por IA em 2025–2026

1. **IA básica no plano caro.**
   - O Notion parou de vender o add-on de IA a novos clientes em mai/2025 e colocou a IA no Business [S]. Hoje, na página de preços, Free e Plus têm só trial [P].
   - A Microsoft embutiu o Copilot no Microsoft 365 Personal/Family com aumento de US$ 3/mês (16/01/2025). Ofereceu planos "Classic" sem IA a assinantes existentes, um reconhecimento implícito de que parte do público não quer pagar por IA [P].
2. **IA agêntica medida por créditos.** O Notion lançou os Custom Agents (24/02/2026, segundo fontes secundárias) e passou a cobrá-los a US$ 10 por 1.000 créditos a partir de 04/05/2026 [P/S]. O consumo depende de quantos passos, ferramentas e modelos o agente usa [S]. O mesmo padrão aparece em Heptabase, RemNote, Craft, Tana e Capacities [P].
3. **Faixas por volume** (Mem: de US$ 9 a US$ 199). O preço deixa de ser "por assento" e passa a ser por mensagens, rotinas e horas de voz [P].
4. **Add-on separado** (Goodnotes AI Pass, AFFiNE AI, RemNote Pro with AI). Na prática, dobra o custo de entrada de quem quer IA [P].
5. **BYOK.**
   - O caso mais emblemático é o **Reflect Open** (14/07/2026). As requisições vão direto ao provedor escolhido pelo usuário (OpenAI, Anthropic, Google ou OpenRouter), que cobra o usuário; as chaves ficam no keychain do sistema operacional [P].
   - O Obsidian não tem IA no core, mas em out/2026 criou o *SecretStorage* para plugins guardarem chaves de API no "Obsidian Keychain" [P]. Isso institucionaliza o BYOK via ecossistema.
6. **IA local.**
   - O Microsoft Foundry Local roda LLMs no próprio PC com Windows 11 24H2 ou superior, em CPU, GPU ou NPU, sem exigir Copilot+ PC, com SDKs para .NET, Python, JS e **Rust** (docs de 21/09/2026) [P].
   - A Apple oferece Foundation Models on-device e Private Cloud Compute sem custo de API para desenvolvedores com menos de 2 milhões de primeiros downloads [P].
7. **"Sem IA" como posicionamento.** A homepage do Obsidian não menciona IA [P].

### 2.4 Custo de inferência e margens

- **Benchmark de margem.** O relatório State of AI 2025 da Bessemer (13/08/2025) mostra que as "Supernovas" de IA têm margem bruta média de cerca de 25%, muitas vezes negativa. As "Shooting Stars" ficam em cerca de 60%, "um pouco abaixo de SaaS" [P]. Software em nuvem tradicional fica tipicamente em 74–77% de margem bruta (Meritech, West Monroe, citados por fontes secundárias) [S].
- **Notion — margem.** O CEO teria dito ao WSJ que a margem bruta, antes de cerca de 90%, perde hoje cerca de 10 pontos percentuais para os provedores de IA. Isso circula via podcast e blogs; não achei o texto original [S, não verificado].
- **Notion — custos em queda.** Há relato de que a CFO disse que os custos de IA caíram cerca de 3x em dois anos [S, não verificado]. Verificado é o blog de engenharia (19/02/2026): a busca vetorial escalou 10x com custo 90% menor em dois anos, incluindo a troca para turbopuffer e embeddings auto-hospedados [P].
- **Evernote.** Usuários que receberam os novos preços suspeitam que a diferença "paga custos de IA" (TidBITS, jul/2026) [S].
- **Leitura [I].**
  - A IA virou custo variável relevante. Por isso os grandes separam a IA "básica" inclusa da IA "agêntica" medida, e por isso surgem BYOK e IA local entre os pequenos.
  - Para um app grátis e BYOK como o Monet, o custo marginal de inferência para o desenvolvedor é zero. O preço disso é a fricção de o usuário obter chaves e pagar em USD (seção 8), e a ausência de receita própria.

---

## 3. Estratégias de solo devs e indies que deram certo

| App | Equipe | Capital | Modelo | O que explica o resultado (evidência) |
|---|---|---|---|---|
| **Obsidian** | 7 pessoas, 3 engenheiros [P]; post no X (abr/2026) fala em crescer de 3 para 4 engenheiros [S] | Sem VC; "100% supported by our users, not investors" [P] | App grátis, Sync/Publish pagos, mecenato (Catalyst, Commercial) | Arquivos Markdown locais ("File over app": "Apps are ephemeral, but your files have a chance to last", kepano, 01/07/2023) [P]. Ecossistema de plugins (> 8.000 projetos, > 120 mi de downloads) [P]. Confiança e segurança: auditorias de Sync pela Cure53 e Trail of Bits (mai/2026) e postura "less is safer" (set/2025) [P]. Gratuidade total para trabalho (fev/2025) removeu atrito de adoção [P] |
| **Capacities** | Cerca de 6,5 FTE remotos na Europa [J] | Bootstrapped, lucrativa [J][P] | Freemium + Believer + add-on de IA | Proximidade com usuários ("nosso maior fator de sucesso foi o contato próximo com os usuários") [J]. Discord com > 10 mil membros [P]. Lançamento no Twitter + vídeo de um YouTuber médio; menções orgânicas, como a de Casey Newton [J]. Erros admitidos: lançou tarde e apostou numa tecnologia de banco que não trouxe vantagem e custou uma migração [J]; o offline-first levou meses [P] |
| **Heptabase** | Cerca de 6 (est.) [E] | Seed de cerca de US$ 1,7 mi (YC, Kleiner) [S] | Assinatura com créditos de IA | Nicho claro: "Master anything you learn", para estudantes, pesquisadores e autodidatas, com PDF, quadros visuais e AI tutor [P]. Selos do Product Hunt (Golden Kitty) [P]. Comunidades em Discord/Telegram e afiliados (cerca de 10% da receita, segundo a Starter Story) [E não verificado] |
| **Bear** | Pequena (Shiny Frog) | — | Assinatura barata, só Apple | Foco em escrita e design; preço baixo (US$ 29,99/ano). O reajuste de 2023 valeu só para clientes novos, com os antigos preservados (US$ 14,99/ano) — gesto de boa vontade [P] |
| **UpNote** | Pequena (UpNote Pte. Ltd.) | — | US$ 1,99/mês ou vitalício de US$ 39,99 | Barato e multiplataforma, incluindo Windows [P]. Aparece como destino de quem foge do Evernote [S] |
| **Readwise** | Pequena | Bootstrapped [P] | Só pago (trial de 30 dias) | Integração (sincronização de destaques de várias fontes) + Reader; desconto acadêmico de 50% [P] |
| **Joplin** | Open source (mantenedor principal + comunidade) | — | App grátis + Joplin Cloud | 56,8 mil estrelas no GitHub; privacidade; 50% para estudantes [P] |

**Padrões que se repetem [I, baseado nas evidências acima]:**
1. **Propriedade dos dados como pilar de confiança:** arquivos abertos, exportação fácil, privacidade. É também o argumento-chave contra a percepção de risco de "app de dev solo".
2. **Comunidade antes de marketing pago:** Discord, fórum, plugins, feedback board. A Capacities diz não ter grande orçamento de marketing.
3. **Nicho nítido:** visual learning (Heptabase), escrita em Apple (Bear), destaques de leitura (Readwise).
4. **Preço justo e mecenato:** Catalyst, Believer, vitalício, gestos de grandfathering.
5. **Equipe mínima e lucratividade cedo,** em vez de crescimento financiado.
6. **Sinais formais de confiança:** auditorias, políticas de "sem telemetria" (o Obsidian proíbe telemetria em plugins) [P].

**Contraexemplos e alertas:**
- **Logseq** (open source, US$ 4,1 mi de VC). A migração para a versão "DB" se arrasta: segue em beta no GitHub, com mobile/RTC em alpha [P]. No fórum (out/2026), o tópico mais ativo é "Is anyone planning to use OG version indefinitely?" (49 respostas), e há críticas à ferramenta de migração MD→DB [P].
- **Reflect.** E2EE + formato próprio + sync próprio deixaram o app "cada vez mais difícil de evoluir". Em jul/2026 a empresa recomeçou como open source, com Markdown e BYOK [P].
- **Mem.** Reconstrução completa ("Mem 2.0", 01/10/2025) e troca para precificação por uso [P].
- **Tana.** Captou com a tese de PKM/grafo e, em out/2026, se apresenta como "agentic meeting platform", tratando o "Tana Outliner" como produto separado [P].

---

## 4. Distribuição

### 4.1 Microsoft Store — o que mudou em 2025–2026 [P]

| Item | Fato | Data / fonte |
|---|---|---|
| Base de usuários | "Over 250 million monthly active users" | Blog Windows Developer, 07/05/2026 |
| Registro de dev individual | Grátis (taxa de US$ 19 dispensada), verificação por documento + selfie, cerca de 200 mercados | Doc oficial de 07/08/2025, atualizada em abr/2026; o post de 07/05/2026 remete a um anúncio de 10/09/2025 |
| Registro de empresa | Grátis (taxa de US$ 99 removida), onboarding via Entra ID | 07/05/2026 |
| Comissão ("Store Fee") | 15% para apps e 12% para jogos **se usar o commerce da Microsoft**. Compras in-app em apps não-jogo via commerce de terceiros **não pagam Store Fee**. Pagamento via gift card ou operadora: +10% ("Commerce Expansion Adjustment") | App Developer Agreement v8.11, vigente desde 17/04/2026 |
| Comunicação da Microsoft | "Non-game apps can use their own in-app commerce system and keep 100% of revenue" | 07/05/2026 |
| Benefícios do MSIX | Hospedagem pela Microsoft, assinatura de código grátis, atualizações automáticas, descoberta via Windows Search | 07/05/2026 |
| Preço por mercado | > 240 países/regiões; preço base customizável por mercado; trials de 1/7/15/30 dias ou ilimitado; promoções | Doc de Pricing & availability (atualizada em ago/2026) |
| Curadoria | "AI Hub" na Store (Copilot+ PCs nos EUA, Canadá, Reino Unido e Austrália): Grammarly com +245% de page views e +13% de instalações | 18/02/2025 |
| Top produtividade grátis (EUA, out/2026) | Liderado por Acrobat, Zoom, Teams, iCloud, ChatGPT, Firefox, Claude etc. Apps de notas: OneNote #17 e Samsung Notes #18; Notion, Evernote e Obsidian fora do top 24 visível | apps.microsoft.com, consulta de 17/10/2026 |

**Leitura [I]:**
- Para um dev solo no Windows, a Store virou infraestrutura barata e de confiança: registro grátis, assinatura e update incluídos, 0% de comissão com commerce próprio.
- Não é, por si só, um canal de descoberta para apps de notas. Os rankings premiam marcas grandes, e o ganho documentado de tráfego veio de **curadoria editorial** (AI Hub).
- Vale buscar destaque editorial ou coleções, e não contar com busca orgânica na Store.

### 4.2 Mac App Store [P]
- Small Business Program com 15% de comissão até US$ 1 milhão de proceeds por ano; 10% sob os termos alternativos da UE. Integração com Foundation Models/PCC sem custo de nuvem para pequenos desenvolvedores.
- Irrelevante no curto prazo para um app Windows-first, mas mostra que a Apple está subsidiando IA on-device para indies.

### 4.3 Product Hunt, Hacker News, YouTube, comunidades e SEO

| Canal | Evidência | Leitura [I] |
|---|---|---|
| **Product Hunt** | Mem 2.0: #5 do dia, 316 upvotes (out/2025) [S]. Capacities: "Product of the Day", nota 4,8 com 198 reviews [P]. Heptabase: selos "Top Post" e "Golden Kitty" [P] | Selo de credibilidade e pico de tráfego; nenhum caso mostra PH como motor sustentado |
| **Hacker News** | Posts do Obsidian: "free for work" com 282 pts; "Less is safer" com 522; "Future of plugins" com 452. "Local-first software" voltou com 883 pts e 297 comentários (05/07/2025). Já capacities.io e heptabase.com nunca passaram de 5 pts [HN] | Funciona para narrativas de dev, local-first, open source e segurança; não para PKM "de consumidor" |
| **YouTube e criadores** | O crescimento inicial da Capacities veio de um post de lançamento no Twitter e de um vídeo de um "YouTuber de porte médio" [J]. O marketplace de templates do Notion tem > 30.000 templates e 22.675 criadores; categorias "Student Life" (7.769) e "Study Planner" (5.680) [P] | Criadores foram o canal de massa do Notion. Nesta pesquisa **não** coletei métricas atuais de Ali Abdaal, Tiago Forte ou Nick Milo (lacuna) |
| **Comunidades** (Discord, fórum) | Capacities: Discord com > 10 mil membros [P]. Fórum do Obsidian e fórum do Logseq muito ativos [P]. Heptabase: outreach em Discord/Telegram de nicho [E] | O canal que mais aparece nos casos de indies |
| **Lista de espera** | Tana: 160 mil pessoas antes da abertura [S] | Útil para captar recursos; nem sempre vira uso, e a Tana pivotou depois |
| **SEO** | As buscas desta pesquisa por "PKM/second brain apps 2026" retornaram sobretudo conteúdo dos próprios fornecedores (blog do AFFiNE, Toolfinder, Letterly, Constella) | SEO de "melhores apps" é disputado pelos próprios vendors; comparativos e guias de migração são o formato dominante |
| **Momentos de migração** | O Obsidian lançou um importador de Airtable logo após a compra pela Bending Spoons (ago/2026; posts "How to migrate from Airtable to Obsidian" no HN) [P/HN]. Saída de usuários do Evernote após os novos preços (TidBITS, jul/2026) [S] | Importadores lançados no momento certo são um canal de aquisição |

---

## 5. Tendências 2025–2026 (com evidência)

| Tendência | Evidência (data) | Força | Leitura [I] |
|---|---|---|---|
| **IA agêntica no workspace** | Notion 3.0, com "até 20 minutos de trabalho autônomo" (18/09/2025) [P]; Custom Agents com créditos (2026) [P/S]; Notion Mail encerrado porque "mais da metade dos usuários gerencia e-mail sem abrir a caixa", "going all in on agents" (25/06/2026) [J]; Airtable Superagent (jan/2026) [J]; rotinas no Mem [P]; Tana como plataforma de reuniões agêntica [P] | Forte | Os grandes migram de "documentos" para "agentes que fazem". Abre espaço para o polo oposto: IA convocada, sob controle do usuário |
| **MCP como integração padrão** | MCP doado à Linux Foundation (AAIF, 09/12/2025): > 10 mil servidores públicos ativos, 97 mi+ de downloads mensais dos SDKs; adotado por ChatGPT, Gemini, Microsoft Copilot, Cursor e VS Code [P]. Notion com MCP hospedado (15/07/2025) [P]; Evernote "Connect to AI tools (MCP)" [P]; Capacities com conectores para ChatGPT, Claude e Cursor [P]; API/MCP no Craft [P]; MCP na Granola (fev/2026) [J] e na Tana [P]; Reflect com MCP para agentes de código (10/03/2026; edição em 28/04/2026) [P] | Forte | Expor as notas via MCP virou recurso esperado, inclusive no free (Craft) |
| **"Traga seu agente"** | Tópicos mais vistos do fórum do Obsidian no último ano: plugins que trazem Claude Code, Codex e Gemini CLI para dentro do Obsidian (35 mil e 33 mil views), "Local Graph RAG" e "Design your vault for AI orientation" [P]. Obsidian CLI pensado para "agentic coding tools" [P] | Forte (usuários avançados) | O usuário avançado quer usar o próprio agente sobre as próprias notas, não a IA embutida do app |
| **Modelos locais / on-device** | Foundry Local estável no Windows (SDK com suporte a Rust; docs de 21/09/2026) [P]; Phi Silica nos Copilot+ PCs (a ser substituído por "Aion Instruct") [P]; Apple Foundation Models [P]; busca semântica local no Reflect Open [P] | Média | Viável para busca, embeddings e resumos; a qualidade de fronteira segue na nuvem |
| **Local-first e soberania de dados** | Ensaio "Local-first software" com 883 pts no HN (07/2025) [HN]; Local-First Conf (edições 2024–2026; próxima em Berlim, mai/2027) [P]; pivô da Reflect para Markdown local (07/2026) [P]; o importador Airtable→Markdown do Obsidian | Forte em devs; média no público geral | Arquivos abertos viraram argumento de venda contra aquisições e encerramentos |
| **"Second brain fatigue" / minimalismo** | "I Deleted My Second Brain" (Westenberg, 17/06/2025: "Instead of accelerating my thinking, it began to replace it.") repercutiu no kottke, em Jim Nielsen e no blog do Bullet Journal [P/S]; "also done with second braining" (D. Kedziora, 30/06/2025) [S]. No HN, swyx diz que quase parou de tomar notas por causa de sync lento [HN] | Média (cultural) | O público cansou de "sistemas". Favorece produtos com propósito claro (estudo de um tema) em vez de "capture tudo" |
| **Retorno ao papel / escrita à mão** | reMarkable lançou Paper Pro Move (03/09/2025) e Paper Pure (06/05/2026), uma parceria com a Miro (03/2026) e um estudo próprio sobre menos estresse (04/2025) [P]; Goodnotes investe em IA para escrita à mão [P]. **Não** encontrei dados de vendas | Fraca (só sinais de investimento) | Nicho real, mas sem números nesta pesquisa |
| **Notetakers de reunião com IA** | Granola: US$ 1,5 bi (03/2026); a própria TechCrunch diz que notas de reunião com IA viraram commodity, com "many players" (Read AI, Fireflies, Quill) [J]; ensaio "Leave Your AI Note-taker at Home" (Westenberg, 02/07/2026) [P]; divulgação de falha de sessão na Granola (HN, ~jul/2026) [HN] | Forte (capital); reação social crescente | É mercado de trabalho e equipe, e longe do caso de uso do Monet |
| **Aprender com IA** | ChatGPT Study Mode (29/07/2025, inclusive no Free) [J]; Claude Learning mode (02/04/2025) [P]; Gemini Guided Learning (06/08/2025) [P]; Gemini Notebook com > 30 mi de usuários (07/2026) [P]; AI tutor na Heptabase e "Learn PDF" no RemNote [P]; Google AI Plus grátis por 1 ano para universitários [P] | Forte | Estudo com IA virou recurso grátis dos gigantes; diferenciação precisa vir de persistência, organização e fontes do próprio usuário |
| **Consolidação vs. ferramentas focadas** | Bending Spoons com > 50 aquisições, Evernote e Airtable [J]; Grammarly + Coda + Superhuman Mail → "Superhuman" (10/2025) [J]; Atlassian + The Browser Company (US$ 610 mi) [J]; Gemini Notebook integrado ao app Gemini e ao AI Mode [P]. Contra-sinal: o próprio Notion fechou o Mail [J] | Forte | Suites crescem por aquisição; até o Notion recuou de um módulo que não era central |
| **Privacidade / E2EE** | Standard Notes passou à Proton (10/04/2024) [P]; Obsidian Sync auditado (05/2026) [P]; Notion Enterprise com "zero data retention" junto aos provedores de LLM [P]; no HN: "Every time when a company adds ai features, i know they want to train on my data" [HN]. Contraponto: a Reflect abandonou E2EE e sync próprio por complexidade [P] | Média | Privacidade é exigência; E2EE próprio custa caro para times pequenos |
| **Open source** | Estrelas no GitHub em out/2026: AppFlowy 77,5 mil; AFFiNE 73,6 mil; Joplin 56,8 mil; SiYuan 46,8 mil (com tópicos MCP e agentic-ai); Logseq 45,3 mil; Anytype 8,9 mil (source-available); Reflect Open 1,6 mil [P] | Forte em interesse | O open source puxa confiança e contribuições; monetização via nuvem ou hospedagem |

---

## 6. Linha do tempo de movimentos corporativos (2023–2026)

| Data | Empresa | Movimento | Fonte |
|---|---|---|---|
| jan/2023 | Evernote / Bending Spoons | Bending Spoons assume o Evernote | [HN] 04–05/01/2023 |
| fev/2023 | Evernote | Demissões (relatos de 129 pessoas, não oficiais) | [S] |
| mai/2023 | Evernote | Aumento de preços do Personal/Professional (plano anual pessoal relatado de US$ 69,99 para US$ 129,99) | [HN]/[S] |
| 09/07/2023 | Evernote | Centro de operações transferido para a Europa (fim das operações nos EUA e Chile) | [HN] (122 comentários) |
| 01/07/2023 | Obsidian | Ensaio "File over app" (kepano) | [P] |
| abr–jul/2023 | Bear | Bear 2: novo preço só para clientes novos | [P] |
| nov–dez/2023 | Evernote | Free limitado a 50 notas e 1 caderno | [HN] |
| 17/01/2024 | Notion | Cron vira Notion Calendar (grátis) | [P] |
| 09/02/2024 | Notion / Skiff | Notion compra a Skiff (E2EE); desativação prevista em 6 meses, estendida para 12 após reação de usuários | [J] |
| mar/2024 | Obsidian | Sync Standard a partir de US$ 4/mês | [P]/[HN] |
| 10/04/2024 | Proton / Standard Notes | Standard Notes "joins Proton"; segue open source, com os mesmos preços | [P] |
| 15/08/2024 | Evernote | Free restrito a 1 dispositivo | [HN] |
| ago/2024 | Notion | 100 milhões de usuários | [P] |
| 29/10/2024 | Omnivore / ElevenLabs | Equipe do Omnivore (500 mil usuários) vai para a ElevenLabs; nuvem descontinuada em nov/2024; só auto-hospedagem | [P] |
| 17/12/2024 | Grammarly / Coda | Grammarly compra o Coda | [J] |
| 16/01/2025 | Microsoft | Copilot no Microsoft 365 Personal/Family com +US$ 3/mês; planos "Classic" | [P] |
| 03/02/2025 | Tana | US$ 25 milhões | [S] |
| 20/02/2025 | Obsidian | Licença comercial opcional ("free for work") | [P] |
| abr/2025 | Notion | Lança o Notion Mail | [J] |
| mai/2025 | Notion | Add-on de IA deixa de ser vendido a novos clientes; IA vai para o Business | [S] |
| mai/2025 | Granola | US$ 43 mi a US$ 250 mi | [J] |
| 21/05/2025 | Obsidian | Bases (1.9) | [P] |
| 22/05/2025 | Mozilla / Pocket | Anuncia o fim do Pocket: apps param em 08/07/2025, exportação até 08/10/2025; Fakespot também é fechado | [J] |
| jul/2025 | Grammarly | Compra o Superhuman Mail | [J] |
| 15/07/2025 | Notion | Servidor MCP hospedado | [P] |
| 29/07/2025 | OpenAI | Study Mode no ChatGPT | [J] |
| 04/09/2025 | Atlassian / The Browser Company | Compra por US$ 610 mi em dinheiro; o Arc já estava sem desenvolvimento; o Dia continua | [J]/[P] |
| 10/09/2025 | Microsoft Store | Registro grátis para devs individuais | [P] |
| 18/09/2025 | Notion | Notion 3.0 (Agent); > US$ 500 mi de receita anualizada | [P]/[J] |
| 01/10/2025 | Mem | Mem 2.0 (reconstrução, "AI Thought Partner") | [P] |
| 29/10/2025 | Grammarly → Superhuman | Empresa renomeada para Superhuman (suite com Grammarly, Coda e Superhuman Mail) | [J] |
| fim de 2025 | Evernote | Starter e Advanced substituem Personal e Professional (migração gradual; e-mails em jul/2026) | [P]/[S] |
| 05/12/2025 | Meta / Limitless (ex-Rewind) | Meta compra a Limitless; para de vender o pingente; o desktop Rewind é desativado; suporte de 1 ano | [J] |
| 09/12/2025 | Anthropic / Linux Foundation | MCP doado à Agentic AI Foundation | [P] |
| 15–16/12/2025 | Notion | Tender a US$ 11 bi; > US$ 600 mi de ARR | [J]/[S] |
| jan/2026 | Airtable | Lança o Superagent | [J] |
| fev/2026 | Notion, Granola, Obsidian | Custom Agents do Notion (24/02, [S]); MCP da Granola; Obsidian 1.12 (27/02) | [S]/[J]/[P] |
| 25/03/2026 | Granola | US$ 125 mi a US$ 1,5 bi; API pública e enterprise | [J] |
| abr/2026 | Obsidian | CLI (exige 1.12.7+) | [P] |
| 04/05/2026 | Notion | Custom Agents passam a ser cobrados em créditos | [S] |
| 07/05/2026 | Microsoft Store | Registro grátis para empresas; "250M+ MAU" | [P] |
| 12–13/05/2026 | Obsidian | Obsidian Community (revisão automatizada de plugins); auditorias do Sync | [P] |
| 08/06/2026 | Bending Spoons | Pedido de IPO | [J] |
| 25/06/2026 | Notion | Anuncia o fim do Notion Mail | [J] |
| 01/07/2026 | Bending Spoons | IPO na Nasdaq (BSP) | [J] |
| 14/07/2026 | Reflect | "Reflect Open": open source (MIT), Markdown, BYOK | [P] |
| 16/07/2026 | Google | NotebookLM renomeado Gemini Notebook; > 30 mi de usuários | [P] |
| 04/08/2026 | Bending Spoons / Airtable | Compra por EV de US$ 1,285 bi (cerca de 2,7x o ARR; pico de US$ 11,7 bi em 2021); fechamento relatado em 04/09/2026 por fonte secundária | [J]/[S] |
| ~ago/2026 | Obsidian | Importador Airtable → Markdown local | [P]/[HN] |
| 22/09/2026 | Notion | Notion Mail encerrado (dados exclusivos do Mail apagados após 21/09) | [J] |
| 01/10/2026 | Obsidian | > 8.000 projetos na Community; SecretStorage; pesquisa "State of Obsidian" com relatório público previsto até o fim de 2026 | [P] |
| 2026 (sem data exata) | Tana | Reposicionada como "agentic meeting platform"; Tana Outliner vira produto separado | [P] |
| 2026 | Logseq | Versão DB (2.0.x) divide a comunidade entre OG e DB | [P] (fórum) |

**Lições para quem depende de um app de notas [I, a partir dos casos]:**
1. **Módulos laterais morrem rápido** (Notion Mail: abr/2025 a set/2026). O dado "só do app" se perde se não for exportado a tempo.
2. **Acqui-hires matam produtos** (Omnivore, Limitless/Rewind). **Grandes empresas despriorizam** (Pocket). **Compradores financeiros reprecificam** (Evernote).
3. **Pivôs mudam o produto sob os pés do usuário** (Tana, Reflect, Mem).
4. **O antídoto que o mercado premia** são formatos abertos, exportação completa e, cada vez mais, a promessa explícita de longevidade. A Reflect escreveu que o app "can outlive any one company" [P].
5. **Para o Monet:** a história de "o que acontece com minhas notas se o dev parar" é parte do produto, não só do FAQ.

---

## 7. Sentimento de usuários

> **Limitação:** o Reddit (r/PKMS, r/ObsidianMD, r/Notion, r/productivity) ficou **inacessível** às ferramentas desta pesquisa, tanto por acesso direto quanto por busca restrita ao domínio. As evidências vêm do Hacker News, de fóruns oficiais (Obsidian, Logseq), do fórum TidBITS e de ensaios. Os temas abaixo convergem entre essas fontes, mas uma varredura no Reddit é recomendada no estudo seguinte.

| Tema | Evidência concreta | Data |
|---|---|---|
| **IA forçada e "AI slop"** | No HN, sobre o Notion 3.0: "why would I want my team generating/reading AI slop in our Wiki??" (@pembrook); "from aggressive simplicity to feature bloat and now AI slop" (@lowsong) — [item 45304816](https://news.ycombinator.com/item?id=45304816) | 19/09/2025 |
| **Desconfiança sobre o uso de dados** | "Every time when a company adds ai features, i know they want to train on my data sooner or later" (@notrealyme123) — mesmo thread | 09/2025 |
| **Rejeição a código gerado por IA** (no próprio produto) | No fórum do Logseq: "Last version before any LLM-generated code was merged?" | 01/10/2026 |
| **Inchaço e lentidão** | No HN, sobre o Notion: o app "becomes unusably slow" (@progbits) | 09/2025 |
| **Online-only e lock-in** | "It's unfortunate that it's an online service" (@mrandish, Notion 3.0). No HN local-first: "SaaS is a business model. Cloud is DRM." (@api); críticas ao Bear por guardar notas em SQLite — [item 44473135](https://news.ycombinator.com/item?id=44473135) | 07/2025 |
| **Portabilidade como seguro** | "If your Obsidian vault is just a folder of Markdown files, you're ready to leave at a moment's notice." (@troad) — [item 48109970](https://news.ycombinator.com/item?id=48109970) | 05/2026 |
| **Preço e assinatura** | Evernote: usuários saindo para DEVONthink, Apple Notes e UpNote; "US$ 250/ano é demais"; a estratégia "depende de inércia e lock-in" — [TidBITS](https://talk.tidbits.com/t/evernote-2026-price-tiers-floored-me/33792). Obsidian Publish cobrado por site: "nickel-and-diming" (@crooked-v) — [item 43117020](https://news.ycombinator.com/item?id=43117020) | 07/2026; 02/2025 |
| **Torcida pela sobrevivência do indie** | "I want this company to have a decent survival chance." (@kvdveer, sobre o Obsidian) | 02/2025 |
| **Sync é difícil** | No HN, swyx diz que o sync é "godawfully slow" e que quase parou de anotar. No fórum do Obsidian, arquivos de conflito de sync somam 42 respostas. No fórum do Logseq: "Is git the only truly reliable self-hosted sync…?" | 2025–2026 |
| **Mobile** | No fórum do Obsidian: travamentos da sidebar no Android e o comportamento de "double-tap to edit" estão entre as queixas recorrentes | último ano |
| **Segurança de plugins** | "Obsidian plugins have full, unrestricted access to all files in the vault." (@gejose) — [item 45307242](https://news.ycombinator.com/item?id=45307242); pedidos de sandbox e permissões | 09/2025; 05/2026 |
| **Closed source como barreira** | "I want to use Obsidian... but I won't as long as it's not open source." (@dakiol) | 05/2026 |
| **Fadiga do "segundo cérebro"** | "A tag is not an insight." (Westenberg, "I Deleted My Second Brain") | 17/06/2025 |
| **Quero meu agente nas minhas notas** | Tópicos mais vistos do fórum do Obsidian: Claude Code, Codex e Gemini CLI dentro do Obsidian; RAG local. No fórum do Logseq: "How is Logseq's Official Development Aligning With the Emerging Agentic-AI Trend?" (22 respostas) | 2025–2026 |
| **Etiqueta da IA em reuniões** | "I'm Begging You to Leave Your AI Note-taker at Home" (Westenberg) | 02/07/2026 |

**O que as pessoas querem [I]:**
- Velocidade e simplicidade.
- IA opcional, que não "escreva por mim".
- Dados locais e portáveis.
- Preço previsível, sem medição opaca.
- Sync confiável.
- Mobile decente.
- Poder plugar o próprio agente.
- A sensação de que o app "vai durar".

---

## 8. Mercado brasileiro / LatAm

### 8.1 O que não foi encontrado (lacuna declarada)
- **Não encontrei dados confiáveis** sobre o uso de apps de notas por estudantes, concurseiros ou autodidatas brasileiros. Nenhum dos blogs oficiais (Notion, Obsidian) traz número de usuários no Brasil.
- O orçamento de buscas da sessão acabou antes de cobrir pesquisas acadêmicas ou de mercado locais.
- **Sinal indireto:**
  - na Similarweb (desktop, set/2026), o Brasil não aparece no top 5 de tráfego de notion.com (EUA 18,4%, Coreia 11,5%, Japão 9,6%, França 4,2%, Índia 4,0%) nem de obsidian.md (EUA 21,1%, China 12,6%, Alemanha 5,9%, Rússia 4,9%, Reino Unido 3,8%) [S];
  - o Notion oferece interface em "Português (Brasil)" e "Español (Latinoamérica)" [P].

### 8.2 Plataforma
- **O Windows tem 86,7% do desktop no Brasil** (StatCounter, set/2026), contra 76,4% no mundo [S].
- No mundo, o tráfego web é 59,0% mobile e 39,3% desktop (set/2026) [S].
- O número de plataforma para o Brasil (62,7% desktop) parece anômalo frente ao histórico; não o uso [I].

### 8.3 Preços em BRL vs. USD (câmbio de referência: US$ 1 = R$ 5,06, cotação de 16/10/2026)

| Produto | Preço no Brasil | ≈ US$ | Preço nos EUA | Relação BR/EUA | Fonte |
|---|---|---|---|---|---|
| Spotify Premium Individual | R$ 23,90/mês | 4,72 | US$ 12,99 | **~36%** (preço regional forte) | [P] |
| Spotify Universitário / Student | R$ 12,90/mês | 2,55 | US$ 6,99 | ~36% | [P] |
| Microsoft 365 Personal | R$ 509/ano (R$ 51/mês) | 100,5 | US$ 99,99/ano | **~100%** (paridade cambial) | [P] |
| Google AI Pro (inclui Gemini Notebook expandido) | R$ 96,99/mês | 19,2 | US$ 19,99 (preço de referência não reverificado nesta pesquisa) | ~96% | [P] BR |
| Google AI Plus (após 1 ano grátis para universitários) | R$ 24,99/mês | 4,9 | n/d | — | [P] |
| Notion Plus/Business | **cobrado em USD**: US$ 10 / US$ 20 | 10 / 20 | 10 / 20 | 100% (sem moeda local) | [P] |
| Obsidian Sync Standard | **USD**: US$ 4/mês no anual | 4 | 4 | 100% | [P] |
| Capacities Pro | **USD**: US$ 119,88/ano | 119,88 | 119,88 | 100% | [P] |
| Craft Plus | R$ 41,60 / R$ 33,30 por mês (a página não rotula com clareza qual é mensal e qual é anual) | 8,2 / 6,6 | não verificado | — (cobra em BRL) | [P] |

**Ofertas a estudantes relevantes no Brasil:**
- **Notion Education:** grátis para universitários e professores de instituições listadas no World Higher Education Database, com e-mail institucional como e-mail principal; **não vale para K-12** [P].
- **Google AI Plus:** 1 ano grátis para universitários maiores de 18 anos, resgate até 31/12/2026; depois, R$ 24,99/mês [P].
- **Spotify Universitário:** R$ 12,90 [P].
- **Descontos em USD:** 40% no Obsidian (Sync/Publish) e na Capacities (Pro anual); 50% no Joplin, no Readwise e para acadêmicos [P].

**Leitura [I]:**
- Apps de notas e PKM praticamente não praticam preço regional (PPP). Cobram em USD ou convertem pelo câmbio (Craft). Os gigantes de produtividade com IA (Microsoft, Google) cobram em BRL, mas na paridade cambial, sem desconto. Só o streaming de consumo (Spotify) pratica PPP agressivo.
- Os descontos estudantis exigem vínculo universitário. Os **concurseiros** típicos, sem matrícula, ficam fora deles, o que tende a aumentar a sensibilidade a preço justamente da persona de estudo de longo prazo.
- No modelo BYOK do Monet, o custo para o brasileiro é o consumo de API em USD (OpenRouter e Tavily) somado aos encargos de cartão internacional. Lembrete: o IOF sobre compras em moeda estrangeira foi elevado em 2025; a alíquota não foi reverificada nesta pesquisa.

---

## 9. Riscos e oportunidades para um app desktop-only, Windows-first, local-first, BYOK, de dev solo, focado em estudo profundo

### 9.1 Fatos que pesam (todos citados nas seções anteriores)
- Os gigantes oferecem IA de estudo grátis ou subsidiada: Study Mode no ChatGPT Free, Guided Learning no Gemini, Gemini Notebook com > 30 mi de usuários, AI Plus grátis a universitários, Copilot no OneNote via M365.
- Concorrentes diretos já ocupam pedaços da tese do Monet:
  - **Heptabase**: estudo, PDF, AI tutor, Windows.
  - **RemNote**: PDF, flashcards, IA.
  - **Reflect Open**: grátis, local, Markdown, BYOK com OpenRouter, Windows experimental.
  - **Obsidian + plugins de agente/RAG**.
  - **Capacities**: análise de PDF, conectores MCP, Windows.
- Local-first ainda não tem modelo de monetização consolidado além de "sync pago" (HN), e sync está entre as não-metas do Monet.
- Microsoft Store: 250 mi de MAU, registro grátis, 0% de comissão com commerce próprio, preço por mercado e trials. Mas os rankings de produtividade não mostram apps de notas independentes.
- Windows domina o desktop (76% no mundo, 87% no Brasil), mas o tráfego web mundial é majoritariamente mobile, e mobile aparece entre as dores recorrentes.
- Usuários punem IA forçada e lock-in, e valorizam formatos abertos. Um app guardar notas em SQLite já foi criticado como lock-in no HN (caso Bear).
- MCP virou padrão de mercado em 2025–2026; usuários avançados querem trazer o próprio agente.
- IA local no Windows ficou acessível: Foundry Local com SDK em Rust, sem exigir NPU.

### 9.2 Riscos

| Risco | Evidência (fato) | Inferência [I] | Sinal a monitorar |
|---|---|---|---|
| **Comoditização da "IA para estudar"** | Study Mode, Guided Learning, Gemini Notebook e AI Plus grátis para estudantes | O "chat com IA sobre meu material" deixa de diferenciar; o valor precisa estar na **persistência** (notas perenes, grifos, histórico de um tema) | Novos recursos de "notebooks/projects" nos gigantes |
| **Tese local-first + BYOK já não é exclusiva** | Reflect Open (jul/2026), plugins de agente no Obsidian, SecretStorage, SiYuan com API da OpenAI | A diferenciação precisa vir da **integração estudo + biblioteca + chat com memória** e da experiência no Windows, não do BYOK em si | Reflect Open sair do status "experimental" no Windows; Obsidian lançar IA oficial |
| **Fricção do BYOK limita o público** | Bessemer: "most consumers still default to general-purpose LLMs" | Criar contas em OpenRouter/Tavily e pagar em USD afasta o não técnico, em especial no Brasil | Taxa de usuários que concluem a configuração da chave (métrica do próprio Monet) |
| **Sem alavanca de monetização "natural"** | Os indies monetizam via sync (Obsidian, Joplin), IA medida (Capacities, Heptabase) ou mecenato; o Monet exclui sync e não revende IA | Sustentabilidade depende de mecenato, licença pro, vitalício ou futura IA opcional | — |
| **Percepção de lock-in (SQLite) e risco de "dev solo sumir"** | Fechamentos (Pocket, Omnivore, Skiff, Notion Mail); críticas ao SQLite do Bear; Reflect migrou para Markdown "common language for people and AI" | Sem exportação aberta e visível (Markdown ou formato documentado), o Monet herda a desconfiança | Perguntas de "como exporto?" em reviews da Store |
| **Desktop-only num mundo mobile** | 59% do tráfego mundial é mobile; queixas de mobile em Obsidian e Notion | Leitura de PDF/EPUB e captura rápida acontecem muito no celular e tablet; o uso fica restrito a sessões no PC | Pedidos de mobile ou tablet (a exploração da versão web do Reader já existe) |
| **Descoberta fraca na Store** | Top 24 de produtividade sem apps de notas independentes; ganho documentado só com curadoria (AI Hub) | Precisa de canais externos (YouTube, comunidades, SEO de migração) | Posição no ranking de "notes" na Store |
| **Concorrência por atenção de grandes suites** | OneNote (#17) com Copilot; consolidação (Bending Spoons, Superhuman, Atlassian) | Para quem já paga M365, o "bom o bastante" já está instalado | — |
| **Dependência de terceiros na IA** | Preços e modelos mudam (créditos do Notion; Granola mudou o cache local e quebrou fluxos de agentes) | APIs (OpenRouter, Tavily) podem mudar preço ou termos; o app precisa trocar de provedor sem drama | Mudanças de preço e termos da OpenRouter e da Tavily |

### 9.3 Oportunidades

| Oportunidade | Evidência (fato) | Inferência [I] |
|---|---|---|
| **Polo "IA convocada, nunca proativa"** | Reação a "AI slop" (HN); planos "Classic" sem IA na Microsoft; Notion migrando para agentes autônomos | Há demanda por IA sob controle explícito; o posicionamento é contra-tendência, mas tem público |
| **Estudo profundo como nicho** | Templates "Student Life" (7.769) e "Study Planner" (5.680) no Notion; Heptabase "Master anything you learn"; RemNote "Pro with AI" | Demanda comprovada por fluxos de estudo; diferenciais possíveis: fichamento de livro e curso de longo prazo + biblioteca com grifos + chat lateral com contexto |
| **Expor as notas via MCP / "traga seu agente"** | AAIF com > 10 mil servidores; Notion, Evernote, Capacities, Craft, Granola, Tana e Reflect com MCP; tópicos mais vistos do fórum do Obsidian sobre Claude Code e Codex | Um servidor MCP local do Monet (somente leitura, ou com escrita sob confirmação) atende o usuário avançado sem custo de inferência |
| **IA local como "plano sem chave"** | Foundry Local estável, sem NPU obrigatório, SDK em Rust | Reduz a fricção do BYOK para embeddings, busca semântica e resumos simples; o BYOK fica para tarefas pesadas |
| **Economia da Store a favor do solo dev** | Registro grátis; 0% com commerce próprio ou 15% via MS; preço por mercado; trials; MSIX com assinatura e update | Permite testar um "Pro/Believer" com preço regional (PPP) sem infraestrutura de pagamento própria, ou com commerce próprio sem comissão |
| **Mecenato e vitalício** | Believer da Capacities (€1–2 mil de MRR em dias); Catalyst do Obsidian (US$ 25); UpNote vitalício (US$ 39,99); AFFiNE Believer (US$ 499,99) | Modelos compatíveis com "sem backend e sem sync" |
| **Janelas de migração** | Preços do Evernote (2025–2026) com usuários saindo; importador de Airtable do Obsidian logo após a aquisição; fechamentos (Pocket, Omnivore, Notion Mail) | Importadores (por exemplo, ENEX do Evernote e Markdown) e páginas "como migrar de X" são canais de aquisição baratos |
| **Windows como terreno menos disputado por indies "polidos"** | Bear só na Apple; Reflect Open estável só no Mac (Windows experimental) | Há espaço para um app de estudo nativo e bem acabado no Windows, sobretudo no Brasil (87% do desktop). Mas Heptabase, Capacities, Obsidian e UpNote já estão no Windows |
| **Contexto e memória como fosso** | Bessemer: "context and memory may be the new moats" | Notas perenes + memória do chat + grifos acumulados ao longo de meses formam um custo de troca legítimo, desde que exportável |
| **Brasil sem PPP nos concorrentes** | Notion, Obsidian e Capacities em USD; Spotify a ~36% do preço americano | Se houver monetização futura, preço em BRL com desconto regional é diferencial real para concurseiros e autodidatas |

### 9.4 Perguntas abertas para o estudo de mercado
1. Qual fração da persona (autodidata de longo prazo) tem disposição técnica para BYOK? Vale um modo sem chave via IA local?
2. Exportação: qual formato aberto e com que fidelidade (notas, grifos, conversas)?
3. Monetização futura compatível com as não-metas: Believer, licença Pro ou IA opcional paga?
4. Canais: quais criadores brasileiros de estudo, concursos e produtividade cobrem ferramentas no YouTube? (Não levantado aqui.)
5. Até onde ir no Windows-first antes de um leitor web ou tablet?

---

## Lacunas e limitações desta pesquisa

- **Orçamento de buscas esgotado.** O limite de 200 buscas por sessão, compartilhado entre agentes, foi atingido no meio do trabalho. A partir daí, a verificação foi feita por acesso direto a URLs conhecidas (sites oficiais, blogs, documentação, GitHub, HN). Ficaram sem busca de descoberta:
  - dados de uso no Brasil (estudantes e concurseiros);
  - métricas de criadores do YouTube (Ali Abdaal, Tiago Forte, Nick Milo);
  - estatísticas de lançamentos no Product Hunt em 2025–2026;
  - números de Otter, Fireflies e Plaud;
  - a alíquota do IOF.
- **Reddit inacessível** às ferramentas. O sentimento foi levantado em HN, fóruns oficiais, TidBITS e ensaios.
- **Fontes primárias bloqueadas:** CNBC, Axios, OpenAI e a central de ajuda do Evernote. Nesses casos uso imprensa ou fontes secundárias, sinalizadas.
- **Receitas privadas não verificáveis:** Obsidian, Capacities, Heptabase, Evernote isolado, Readwise e UpNote não divulgam receita. Todas as estimativas estão marcadas como [E].
- **Relatórios de tamanho de mercado** ficam atrás de paywall e não divulgam metodologia; os números são apresentados só para mostrar a dispersão.
- **Alguns preços têm cadência ambígua** na página oficial (Notion, Heptabase, AFFiNE, Craft). Indiquei a ambiguidade em cada caso.
- **Datas relativas do HN** ("x meses atrás") foram convertidas para aproximações a partir da data de corte (17/10/2026).

---

## Fontes (acesso em 17/10/2026, salvo indicação)

### Tamanho de mercado
- The Business Research Company via GII — https://gii.tw/report/tbrc1678166-note-taking-app-global-market-report.html ; https://www.gii.tw/report/tbrc1976108-note-taking-app-global-market-report.html
- MarketIntelo — https://marketintelo.com/report/note-taking-app-market
- Technavio (AI note-taking) — https://technavio.com/report/ai-note-taking-market-industry-analysis
- Agregação de estimativas — https://anotherwrapper.com/tools/startup-idea-validator/ai-powered-note-taking-revolution-unlocking-smarter-learning-research
- llcbuddy (baixa qualidade) — https://llcbuddy.com/data/handwritten-notes-software-statistics

### Notion
- 100 milhões de usuários — https://www.notion.com/blog/100-million-of-you
- Preços — https://www.notion.com/pricing ; https://www.notion.com/pt/pricing
- Notion 3.0 — https://www.notion.com/blog/introducing-notion-3-0
- MCP hospedado — https://www.notion.com/blog/notions-hosted-mcp-server-an-inside-look
- Busca vetorial (custo −90%) — https://www.notion.com/blog/two-years-of-vector-search-at-notion
- Notion Calendar — https://www.notion.com/blog/introducing-notion-calendar
- Education Plan — https://www.notion.com/help/notion-for-education
- Templates — https://www.notion.com/templates
- Notion Mail (encerramento) — https://9to5mac.com/2026/06/25/notion-shutting-down-its-ai-powered-email-client-including-mac-and-ios-apps/
- CNBC, US$ 500 mi (acesso bloqueado; via agregadores) — https://www.cnbc.com/2025/09/18/notion-launches-ai-agent-as-it-crosses-500-million-in-annual-revenue.html ; https://benzatine.com/news-room/notions-ai-innovations-propel-revenue-beyond-500-million-amidst-competitive-landscape
- Tender de US$ 11 bi — https://www.trendingtopics.eu/notion-startet-mitarbeiterinnen-aktienverkauf-mit-11-milliarden-bewertung/
- Sacra (estimativa de ARR) — https://sacra.com/research/notion-at-865m-year-growing-82-yoy/
- Mudança de IA em mai/2025 (secundária) — https://userjot.com/blog/notion-pricing-2025-plans-ai-costs-explained
- Custom Agents e créditos (secundárias) — https://matthiasfrank.de/en/notion-custom-agents-full-tutorial-use-cases-pricing-changes/ ; https://dev.to/kanta13jp1/notion-custom-agents-goes-101000-credit-on-54-a-free-way-to-run-all-6-departments-7cj
- Alegação de margem (podcast, secundária) — https://www.willingnesstopay.com/podcast/pricing-package-unpacked-why-notion-pricing-works-better-than-most-saas-companies
- Skiff — https://techcrunch.com/2024/02/09/notion-acquires-privacy-focused-productivity-platform-skiff/
- HN Notion 3.0 — https://news.ycombinator.com/item?id=45304816 ; HN Notion Mail — https://news.ycombinator.com/item?id=48675886 ; listagem — https://news.ycombinator.com/from?site=notion.com

### Obsidian
- https://obsidian.md/ ; https://obsidian.md/pricing ; https://obsidian.md/sync ; https://obsidian.md/about
- https://obsidian.md/blog/ ; https://obsidian.md/blog/free-for-work/ ; https://obsidian.md/blog/future-of-plugins/ ; https://obsidian.md/blog/2026-obsidian-october/ ; https://obsidian.md/blog/less-is-safer/
- CLI — https://obsidian.md/help/cli ; importador Airtable — https://obsidian.md/help/import/airtable
- Fórum (top do ano) — https://forum.obsidian.md/top?period=yearly
- HN — https://news.ycombinator.com/from?site=obsidian.md ; https://news.ycombinator.com/item?id=43117020 ; https://news.ycombinator.com/item?id=45307242 ; https://news.ycombinator.com/item?id=48109970
- "File over app" — https://stephango.com/file-over-app
- Estimativas — https://www.operatorbook.dev/stories/obsidian-revenue-estimates-2m-to-25m ; https://getlatka.com/companies/obsidian.md ; https://x.com/aakashgupta/status/2040622458651529502

### Evernote / Bending Spoons / Airtable
- Planos — https://evernote.com/compare-plans
- Central de ajuda (acesso bloqueado; trecho via busca) — https://help.evernote.com/hc/en-us/articles/46317642175763
- TidBITS — https://talk.tidbits.com/t/evernote-2026-price-tiers-floored-me/33792
- Linha do tempo (secundária) — https://harbor.my/blog/bending-spoons-evernote/
- HN — https://news.ycombinator.com/from?site=evernote.com
- Pedido de IPO — https://techcrunch.com/2026/06/08/eventbrite-and-vimeo-owner-bending-spoons-files-to-go-public
- IPO — https://dealroom.co/news/136652-bending-spoons-prices-ipo-above-range-to-raise-1-68b/ ; https://www.axios.com/2026/07/01/bending-spoons-ipo-pricing (acesso bloqueado)
- Airtable — https://techcrunch.com/2026/08/04/bending-spoons-to-buy-airtable-for-1-28b/ ; https://www.softr.io/blog/airtable-bending-spoons-acquisition ; https://www.cnbc.com/2026/08/04/bending-spoons-in-first-post-ipo-aquisition-with-1point3b-airtable-deal.html (acesso bloqueado)

### Outros apps (preços, posicionamento, números)
- Granola — https://techcrunch.com/2026/03/25/granola-raises-125m-hits-1-5b-valuation-as-it-expands-from-meeting-notetaker-to-enterprise-ai-app/ ; https://tech.eu/2026/03/25/granola-raises-125m-at-1-5bn-valuation/ ; https://www.granola.ai/pricing ; https://news.ycombinator.com/from?site=granola.ai
- Gemini Notebook — https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/ ; https://techcrunch.com/2026/07/16/google-continues-its-renaming-streak-by-turning-notebooklm-to-gemini-notebook/
- Tana — https://tana.inc/ ; https://tana.inc/pricing ; https://www.vktr.com/the-wire/tana-raises-25m-to-unlock-the-power-of-human-ai-collaboration/ ; https://dig.watch/updates/ai-driven-organiser-tana-attracts-25m-amid-growing-enterprise-interest
- Capacities — https://capacities.io/ ; https://capacities.io/pricing ; https://capacities.io/blog/challenges ; https://www.deutsche-startups.de/2026/07/14/als-gebootstrapptes-startup-sind-ressourcen-fast-immer-knapp/ ; https://news.ycombinator.com/from?site=capacities.io
- Heptabase — https://heptabase.com/ ; https://heptabase.com/pricing ; https://www.starterstory.com/heptabase-breakdown ; https://seedtable.com/companies/heptabase ; https://www.cbinsights.com/company/heptabase/financials ; https://news.ycombinator.com/from?site=heptabase.com
- Craft — https://www.craft.do/pricing ; https://support.craft.do/en/account-and-subscription/subscription-plans ; https://www.craft.do/blog/craft-raises-12m-series-b-round
- Bear — https://bear.app/faq/features-and-price-of-bear-pro/ ; https://blog.bear.app/2023/04/bear-2-will-have-a-new-price-only-for-new-customers/
- UpNote — https://getupnote.com/
- Reflect — https://reflect.app/ ; https://reflect.app/blog ; https://reflect.app/blog/reflect-open ; https://github.com/team-reflect ; https://github.com/team-reflect/reflect-open ; preço do Classic (secundária) — https://costbench.com/software/note-taking/reflect/
- Mem — https://get.mem.ai/pricing ; https://get.mem.ai/blog/mem-2-dot-0 ; https://hunted.space/dashboard/mem-2-0/launches/mem-2-0-2
- Readwise — https://readwise.io/pricing ; https://blog.readwise.io/why-were-bootstrapping-readwise/
- RemNote — https://www.remnote.com/pricing
- Goodnotes — https://www.goodnotes.com/pricing
- AFFiNE — https://affine.pro/pricing ; https://github.com/toeverything/AFFiNE
- Joplin — https://joplinapp.org/plans/ ; https://github.com/laurent22/joplin
- Logseq — https://github.com/logseq/logseq ; https://blog.logseq.com/ ; https://discuss.logseq.com/latest ; https://news.ycombinator.com/from?site=logseq.com
- AppFlowy — https://github.com/AppFlowy-IO/AppFlowy ; SiYuan — https://github.com/siyuan-note/siyuan ; Anytype — https://github.com/anyproto/anytype-ts

### Encerramentos, aquisições e pivôs
- Pocket — https://techcrunch.com/2025/05/22/mozilla-is-shutting-down-read-it-later-app-pocket/ ; https://getpocket.com/farewell
- Omnivore — https://elevenlabs.io/blog/omnivore-joins-elevenlabs ; https://github.com/omnivore-app/omnivore
- The Browser Company — https://www.atlassian.com/blog/announcements/atlassian-acquires-the-browser-company ; https://techcrunch.com/2025/09/04/atlassian-to-buy-arc-developer-the-browser-company-for-610m/
- Limitless (ex-Rewind) — https://techcrunch.com/2025/12/05/meta-acquires-ai-device-startup-limitless/
- Grammarly / Coda / Superhuman — https://techcrunch.com/2025/10/29/grammarly-rebrands-to-superhuman-launches-a-new-ai-assistant/
- Standard Notes / Proton — https://proton.me/blog/proton-standard-notes-join-forces

### IA, tendências e margens
- MCP e AAIF — https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation
- ChatGPT Study Mode — https://techcrunch.com/2025/07/29/openai-launches-study-mode-in-chatgpt/
- Claude for Education (Learning mode) — https://www.anthropic.com/news/introducing-claude-for-education
- Gemini Guided Learning — https://blog.google/outreach-initiatives/education/guided-learning/
- Bessemer, State of AI 2025 — https://www.bvp.com/atlas/the-state-of-ai-2025 ; https://www.bvp.com/assets/uploads/2025/08/Final_PDF_State_of_AI_2025_slides_Bessemer_Venture_Partners.pdf
- Margens de software com IA (secundária) — https://trendingtopics.eu/ai-software-margins/
- Microsoft Foundry Local — https://learn.microsoft.com/en-us/windows/ai/foundry-local/get-started
- Microsoft 365 com Copilot (reajuste) — https://www.microsoft.com/en-us/microsoft-365/blog/2025/01/16/copilot-is-now-included-in-microsoft-365-personal-and-family/
- Local-first — https://news.ycombinator.com/item?id=44473135 ; https://news.ycombinator.com/from?site=inkandswitch.com ; https://www.localfirstconf.com/
- "Second brain fatigue" — https://westenberg.beehiiv.com/p/i-deleted-my-second-brain ; https://kottke.org/25/07/0047083-i-deleted-my-second-brain ; https://notes.jim-nielsen.com/n/2025-08-12-2249/ ; https://bulletjournal.com/blogs/bulletjournalist/i-deleted-my-second-brain ; https://derekkedziora.com/notes/2025-06-30-also-done-with-second-braining (encontrado via busca; não aberto)
- Notetakers de IA — https://www.joanwestenberg.com/p/im-begging-you-to-leave-your-ai-note ; https://news.ycombinator.com/from?site=joanwestenberg.com
- Papel / escrita à mão — https://news.remarkable.com/

### Distribuição
- App Developer Agreement v8.11 (Store Fee) — https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/store/documents/legal/ada/fy26/MS.Store.ADAv8.11.US.EN.pdf
- Registro grátis para devs individuais — https://learn.microsoft.com/en-us/windows/apps/publish/whats-new-individual-developer
- Registro grátis para empresas e 250M MAU — https://blogs.windows.com/windowsdeveloper/2026/05/07/publish-to-microsoft-store-as-a-company-now-with-free-registration-and-faster-onboarding/
- AI Hub — https://blogs.windows.com/windowsdeveloper/2025/02/18/discover-magical-ai-experiences-through-the-microsoft-store-on-windows-with-the-new-ai-hub/
- Preço e disponibilidade (MSIX) — https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/price-and-availability
- Top grátis de produtividade (EUA) — https://apps.microsoft.com/collections/computed/apps/topfree/productivity?hl=en-us&gl=US
- Apple Small Business Program — https://developer.apple.com/app-store/small-business-program/

### Brasil, plataforma e preços regionais
- StatCounter, SO de desktop (mundo e Brasil) — https://gs.statcounter.com/os-market-share/desktop/worldwide ; https://gs.statcounter.com/os-market-share/desktop/brazil
- StatCounter, plataformas — https://gs.statcounter.com/platform-market-share/desktop-mobile-tablet/worldwide ; https://gs.statcounter.com/platform-market-share/desktop-mobile-tablet/brazil
- Similarweb — https://www.similarweb.com/website/notion.com/ ; https://www.similarweb.com/website/notion.so/ ; https://www.similarweb.com/website/obsidian.md/
- Câmbio USD/BRL (16/10/2026) — https://economia.awesomeapi.com.br/json/last/USD-BRL
- Spotify — https://www.spotify.com/br-pt/premium/ ; https://www.spotify.com/us/premium/
- Microsoft 365 — https://www.microsoft.com/pt-br/microsoft-365/buy/compare-all-microsoft-365-products ; https://www.microsoft.com/en-us/microsoft-365/buy/compare-all-microsoft-365-products
- Google One / AI Pro (BR) — https://one.google.com/about/plans ; Google AI para estudantes — https://gemini.google/students/
