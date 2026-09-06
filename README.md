# Leiloaê

"Leilão sem juridiquês" — marketplace de leilões de imóveis e veículos em São Paulo,
feito para quem nunca participou de um leilão.

**A aplicação está construída.** Ela vive em [`project/`](project) como um app
React + Vite com back-end Node + SQLite, e é o [`project/README.md`](project/README.md)
que você quer ler — como rodar, o que o servidor faz, onde estão as regras de negócio.
Em duas linhas:

```bash
cd project
npm install
npm run dev          # modo demonstração, sem back-end
```

O contrato da API está em [`project/docs/api.md`](project/docs/api.md).

O restante deste arquivo é o registro de **de onde isto veio**: um bundle de handoff do
Claude Design, com os protótipos e as conversas que definiram o produto. Continua valendo
como fonte de intenção — quando uma decisão de interface parecer arbitrária, a explicação
costuma estar em `chats/`.

---

## De onde veio

Este era um **handoff bundle** do Claude Design (claude.ai/design): alguém desenhou as
telas em HTML/CSS/JS com uma ferramenta de design assistida por IA e exportou o pacote
para que um agente de código as implementasse de verdade. Foi o que aconteceu; o
histórico está nos commits.

## Instruções originais para o agente de código

**Read the chat transcripts first.** There are 5 chat transcript(s) in `chats/`. The transcripts show the full back-and-forth between the user and the design assistant — they tell you **what the user actually wants** and **where they landed** after iterating. Don't skip them. The final HTML files are the output, but the chat is where the intent lives.

**Read `project/index.html` in full.** The user had this file open when they triggered the handoff, so it's almost certainly the primary design they want built. Read it top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `README.md` — this file
- `chats/` — conversation transcripts (read these!)
- `project/` — the `Leiloaê` project files (HTML prototypes, assets, components)

---

## O que mudou desde o handoff

`project/` **não contém mais os protótipos HTML**: eles viraram a aplicação React que
está lá hoje. O `project/index.html` que as instruções acima mandam ler de ponta a ponta
existe, mas hoje é o ponto de entrada do Vite — dezenas de linhas, não o desenho. As
telas estão em `project/src/`. Os transcritos em `chats/` continuam sendo a fonte de intenção, e mais de
uma decisão do código só faz sentido lendo-os — o exemplo mais caro foi o carrossel
"Encerrando", que o chat 3 decidiu manter rolando mesmo com "reduzir movimento" ligado, e
que uma reimplementação bem-intencionada voltou a congelar. Antes de "consertar" um
comportamento que parece estranho, procure nos chats se ele foi pedido.
