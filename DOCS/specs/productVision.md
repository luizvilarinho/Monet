# Visão de Produto — Monet

> Este documento registra o *porquê* do Monet. Ele deve guiar decisões de produto e servir de contexto para qualquer agente que trabalhe no projeto. Quando uma feature ou decisão de design estiver em dúvida, volte a este documento.

---

## O problema

Temos acesso a muita informação: um clique e aparece um monte de conteúdo sobre qualquer assunto — no Google, na IA, em blogs. Mas o **aprofundamento** é falho. Acesso à informação virou commodity; profundidade, não.

Para se aprofundar em um tema, o indivíduo precisa se aventurar nele por longos períodos: realmente ler o livro todo, fazer anotações, relacionar informações, revisitar. O aprendizado acontece justamente nesse esforço de elaboração — e isso não se terceiriza.

## A proposta

O Monet existe para **auxiliar quem precisa se aprofundar em um tema**. Se alguém precisa aprender sobre um assunto, o Monet é o companheiro dessa jornada: o lugar onde as leituras, anotações e conexões desse estudo vivem e se acumulam ao longo do tempo.

## O papel da IA: meio, não fim

Esta é a decisão de produto central. No Monet, a IA é um **facilitador** — uma ferramenta que está à mão, disponível para ser acionada quando precisar. Ela pode:

- direcionar os temas de estudo;
- ajudar com alguma informação complexa;
- destrinchar um trecho difícil;
- apontar relações que o usuário ainda não viu.

O que ela **não** é: o destino. A dinâmica do Monet é o inverso dos chats de IA convencionais:

| Chats de IA convencionais | Monet |
| --- | --- |
| A IA é o centro; o usuário orbita em volta pedindo respostas prontas | O **trabalho do usuário** (notas, leituras, o notebook do tema) é o centro; a IA orbita em volta, à disposição |
| Resposta pronta substitui o esforço | A IA desbloqueia o esforço, não o substitui |

## Implicações para decisões de produto

Ao avaliar uma feature ou mudança, perguntar:

1. **Ela sustenta a permanência no tema?** Aprofundamento exige tempo e constância (ex.: agenda/calendário, notas datadas).
2. **Ela mantém o material do usuário no centro?** A IA deve se ancorar no que o usuário está estudando (ex.: KB com RAG, watched folders), não na internet genérica.
3. **Ela preserva o esforço de elaboração?** Features que fazem o trabalho *pelo* usuário (resumir tudo, anotar por ele) contrariam a tese; features que o ajudam a atravessar um bloqueio a reforçam.
4. **A IA fica à mão sem se impor?** Ela deve estar disponível quando acionada, não interromper ou conduzir a experiência.
