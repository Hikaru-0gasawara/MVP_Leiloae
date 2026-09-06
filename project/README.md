# Leiloaê

"Leilão sem juridiquês" — marketplace de leilões de imóveis e veículos em São Paulo,
feito para quem nunca participou de um leilão.

React + Vite no cliente, Node + SQLite no servidor. A aplicação roda em **dois modos**,
e os dois são exercitados pelos testes:

| | Demonstração (padrão) | Servidor |
| --- | --- | --- |
| Como subir | `npm run dev` | `npm run dev:servidor` |
| Decidido por | `VITE_API_URL` vazio | `VITE_API_URL=/` no build |
| Catálogo | `src/data.js`, estático | banco, via `/api/v1/lotes` |
| Lances e favoritos | `localStorage` | conta no servidor, com transação |
| Conta | persona fictícia | e-mail e senha de verdade |
| Publicável sem back-end | sim | não |

As telas são as mesmas: `src/state/catalogo.js` entrega a mesma interface nos dois
casos, então nenhuma tela sabe qual está rodando.

## Rodando

Tudo daqui de dentro (`project/`) — é onde vive o `package.json`.

```bash
npm install
npm run dev          # modo demonstração em http://localhost:5173
npm run dev:servidor # modo servidor em http://localhost:3000
```

São os dois únicos comandos de que você precisa para ver a aplicação. O primeiro
é o padrão: roda inteiro no navegador, sem back-end. O segundo constrói apontando
para a API e sobe o Node — conta, lances e histórico de verdade.

**Nenhum comando deste README pede variável de ambiente na linha.** `npm run
dev:servidor` já constrói com `VITE_API_URL=/`, porque um build de servidor que
não aponta para o servidor não serve para nada — e a sintaxe `VAR=valor comando`
é do shell POSIX, então esse era também o caminho que não rodava no Windows.

| | |
| --- | --- |
| `npm run build` | build de produção em `dist/` |
| `npm run preview` | serve o build |
| `npm run build:servidor` | build apontando para a API, em `dist-servidor/` |
| `npm run servidor` | sobe a API + serve o build já existente (porta 3000) |
| `npm run lint` | ESLint (react-hooks + jsx-a11y) |
| `npm run typecheck` | `tsc --checkJs` sobre domínio, bibliotecas e servidor |
| `npm test` | Vitest (unidade e componente) |
| `npm run test:e2e` | Playwright (regressão, acessibilidade, CSP e servidor) |
| `npm run check` | lint + typecheck + test + build |
| `npm run fotos:baixar` | baixa as fotos para `public/fotos` (ver abaixo) |
| `npm run backup` | cópia de segurança do banco + retenção (ver abaixo) |

`npm run test:e2e` sobe sozinho os dois servidores de que precisa (o build de
demonstração na 4173, a API na 4180) e descarta o banco a cada execução. Não é
preciso preparar nada antes; se você já tiver um deles de pé, ele é reaproveitado.
Na primeira vez, `npx playwright install chromium` baixa o navegador.

O CI (`.github/workflows/ci.yml`) roda lint, testes, `npm audit` e build em todo push
e pull request, mais a suíte E2E num job separado.

## Servidor

```bash
npm run dev:servidor      # http://localhost:3000, API em /api/v1
```

O contrato está em [`docs/api.md`](docs/api.md), versionado em `/api/v1`.

Para reconstruir e subir em passos separados — o que você quer num deploy, onde o
build acontece antes e noutra máquina:

```bash
npm run build:servidor
npm run servidor
```

`VITE_API_URL` só precisa ser definida à mão para apontar a interface a uma API
**noutro domínio**; nesse caso libere o host em `connect-src` na CSP.

### Confirmação de e-mail em desenvolvimento

Sem `LEILOAE_EMAIL_ENDPOINT` configurado e fora de produção, o e-mail não é
enviado a lugar nenhum: ele é **impresso no console do servidor**. Crie uma conta,
copie o link `/verificar?token=…` do log e abra no navegador. Sob o executor de
teste nem isso é impresso — ver [Testes](#testes).

O banco é SQLite pelo módulo embutido `node:sqlite` — **zero dependências novas**
(experimental no Node 22; o acesso está isolado em `server/db.js` justamente para
que trocar de driver seja local). Arquivo em `dados/leiloae.db`, configurável por
`LEILOAE_DB`.

### O que o servidor faz

| | |
| --- | --- |
| **Lance transacional** | `BEGIN IMMEDIATE` + releitura do lote dentro da transação |
| **Lance automático** | teto por procuração: o maior teto vence pagando o necessário, não o teto |
| **Prorrogação** | lance nos últimos 2 min empurra o encerramento (anti-sniping) |
| **Trilha de auditoria** | tabela só de inserção; cancelar não apaga o rastro |
| **Sessão** | scrypt + cookie HttpOnly; o token vive no banco como hash |
| **Recuperação de senha** | token de uso único que derruba todas as sessões |
| **Limitação de taxa** | balde de fichas por cliente e perfil de rota |
| **Eventos ao vivo** | SSE: um lance chega às outras abas na hora |
| **Verificação de e-mail** | link de uso único no cadastro; a conta funciona sem ele |
| **Paginação do catálogo** | por chave, sobre o horário do edital — a prorrogação não a quebra |
| **Histórico público** | a disputa do lote, com apelido por lote e sem teto |

Três decisões que sustentam o resto:

- **O servidor usa o mesmo `src/domain/auction.js` que a interface.** Não é a regra
  reimplementada: é a mesma função. Divergência entre o que o botão habilita e o que
  o servidor aceita é impossível por construção (SEC-004).
- **O lance roda em `BEGIN IMMEDIATE` e relê o lote de dentro da transação.** Numa
  rajada de lances iguais, exatamente um entra. Há teste com contenção real entre
  conexões, e ele foi verificado sabotando a transação de propósito.
- **Quem está falando vem sempre da sessão**, nunca do corpo ou da URL. Pedir pelo
  recurso de outra pessoa devolve 404 (SEC-003/004).

### Cópia de segurança e retenção

```bash
npm run backup
```

O arquivo SQLite é o produto inteiro — contas, lances e a trilha de auditoria — e a
única cópia que existia era a que alguém lembrasse de fazer na mão. `scripts/backup.mjs`
escreve uma cópia em `backups/`, com nome ordenável por si só.

| | |
| --- | --- |
| `LEILOAE_DB` | banco de origem (padrão `./dados/leiloae.db`) |
| `LEILOAE_BACKUP_DIR` | pasta de destino (padrão `./backups`) |
| `LEILOAE_BACKUP_DIAS` | retenção em dias (padrão 30) |
| `LEILOAE_BACKUP_MINIMO` | cópias sempre preservadas (padrão 7) |

Três decisões que separam isto de um `cp`:

- **A cópia sai de `VACUUM INTO`, não do sistema de arquivos.** Com WAL ligado, copiar o
  arquivo enquanto o servidor escreve produz um banco truncado no meio de uma transação —
  que parece um backup até o dia em que precisa ser restaurado.
- **A cópia é aberta e conferida** (`PRAGMA integrity_check` e contagem das tabelas)
  antes de qualquer coisa ser apagada. Backup que ninguém tenta ler é fé, não cópia.
- **A retenção nunca apaga tudo.** Um relógio errado deixaria todas as cópias "velhas" no
  mesmo instante; o mínimo por contagem é o que impede a limpeza de virar o incidente.

Agendar é da operação: um `cron` diário chamando `npm run backup` já cumpre a política.
Restaurar é copiar o arquivo escolhido por cima de `LEILOAE_DB` com o servidor parado.

## Modo demonstração

`VITE_DEMO_MODE` controla a honestidade da interface. O padrão é **ligado**: só fica
desligado com `VITE_DEMO_MODE=false` explícito. Ligado, a aplicação:

- exibe a faixa fixa de "ambiente de demonstração" (`src/ui/DemoBanner.jsx`);
- marca as páginas jurídicas como fictícias e não apresenta CNPJ como real;
- rotula as fotos como ilustrativas;
- avisa, na caixa de mensagens, que nada é enviado a ninguém.

### Fotos e terceiros

Por padrão as fotos vêm de um banco de imagens externo — uma requisição a terceiro em
cada carregamento, levando junto o IP de quem visita. Para eliminar isso:

```bash
npm run fotos:baixar
echo 'VITE_PHOTO_BASE=/fotos' >> .env.local
```

As fotos passam a sair do próprio domínio, e `images.unsplash.com` pode sair do `img-src`
da CSP. As imagens ilustram lotes fictícios: ao publicar, confira licença e atribuição.

### Erros e funil

`VITE_ERROR_ENDPOINT` e `VITE_ANALYTICS_ENDPOINT` ligam o relato de erro e os eventos de
funil (`src/lib/telemetry.js`). Sem eles, **nada sai da máquina**. Os eventos carregam só
identificadores de lote e valores — nunca texto digitado, e a rota é enviada sem a query.
Endpoint externo exige liberar o host em `connect-src` na CSP.

O formulário de contato só aparece se `VITE_CONTACT_FORM_ENDPOINT` estiver definido;
sem endpoint, nenhum campo de dado pessoal é renderizado. Copie `.env.example` para
`.env.local` para configurar canais reais. **Nenhum segredo vai para o código** — tudo
passa por variáveis de ambiente.

## Estrutura

| Arquivo | Conteúdo |
| --- | --- |
| `src/domain/auction.js` | **Regras de negócio**: simulador de custo, lance mínimo, incremento por faixa, encerramento, status. Fonte única — as telas não recalculam nada |
| `src/domain/schedule.js` | Prazos absolutos dos leilões (estáveis entre recargas) |
| `src/state/userState.js` | Reducer de favoritos e lances, persistência e projeção sobre o catálogo |
| `src/lib/clock.js` | Relógio único da aplicação (`useNow`) e visibilidade da aba (`usePageVisible`) |
| `src/lib/motion.js` | Preferência de movimento do sistema, pausa dos carrosséis e escalonamento de animações derivadas do relógio |
| `src/lib/telemetry.js` | Relato de erro e eventos de funil, por endpoint configurável — sem SDK de terceiro |
| `src/api/client.js` | Cliente HTTP e `ErroDaApi`; assinatura do fluxo de eventos |
| `src/api/resource.js` | `useResource`/`useMutation`: carregando, erro, recarregar |
| `src/state/catalogo.js` | A mesma interface para os dois modos (com e sem servidor) |
| `src/tipos.d.ts` | `Lote` como união discriminada por categoria, e demais tipos |
| `server/db.js` | Esquema, migração e leitura do catálogo |
| `server/auth.js` | scrypt, sessão por cookie HttpOnly, token guardado em hash |
| `server/bids.js` | Motor de lances: transação, teto automático, prorrogação, auditoria |
| `server/ratelimit.js` | Limitação de taxa por balde de fichas |
| `server/email.js` | Canal de entrega de e-mail transacional (plugável) |
| `server/routes.js` | Contrato HTTP `/api/v1` |
| `server/index.js` | Servidor, eventos ao vivo e estáticos com os cabeçalhos reais |
| `src/lib/config.js` | Configuração por ambiente: modo demonstração, canais de contato |
| `src/lib/photos.js` | `srcset`/`sizes` por contexto de uso e texto alternativo das fotos |
| `src/lib/router.js` | Mapeamento rota ↔ URL (deep link e histórico do navegador) |
| `src/ui/Dialog.jsx` | Diálogo acessível (foco inicial, trap, ESC, devolução do foco) e `useDismissable` |
| `src/ui/ErrorBoundary.jsx` | Contenção de erro de renderização, com caminho de recuperação |
| `src/ui/DemoBanner.jsx` | Faixa fixa e aviso local de demonstração |
| `src/ui/TelaDeVerificacao.jsx` | Tela do link de confirmação de e-mail e a faixa de "falta confirmar" |
| `scripts/backup.mjs` | Cópia de segurança do banco (`VACUUM INTO`) e política de retenção |
| `scripts/build-servidor.mjs` | Build apontando para a API — a variável de ambiente vive aqui, não na linha de comando |
| `src/App.jsx` | Estado global, rotas por URL e composição das telas |
| `src/data.js` | Catálogo (8 imóveis + 6 veículos), vendedores e glossário |
| `src/nav.jsx` | Header com ticker, painel da conta e notificações |
| `src/components.jsx` | Primitivos (Button, Badge, LotCard, Countdown, GlossaryTerm, Icon) |
| `src/screens.jsx` | Home, tour de iniciante e listagem |
| `src/mybids.jsx` | Meus lances (abas, cobrir lance, cancelamento na janela de 24 h) |
| `src/lotdetail.jsx` | Página do lote (galeria, abas, simulador) e tela de arremate |
| `src/bidmodal.jsx` | Modal de lance em 3 passos |
| `src/compare.jsx` | Barra e modal de comparação (até 4 lotes) |
| `src/saved.jsx`, `src/account.jsx`, `src/accountpages.jsx` | Favoritos e área da conta |
| `src/pages.jsx` | Rodapé e páginas institucionais |
| `src/index.css` | Tokens de tema (claro/escuro) e keyframes |

## Testes

| Suíte | O que cobre |
| --- | --- |
| `src/domain/auction.test.js` | Regras de custo, incremento, lance mínimo, encerramento, status |
| `src/state/userState.test.js` | Reducer, persistência e projeção do estado do usuário |
| `src/data.test.js` | Invariantes do catálogo e da agenda |
| `src/components.test.jsx` | LotCard, BidModal e Meus lances |
| `src/simulador.test.jsx` | Soma das linhas = total nas quatro telas que simulam custo |
| `src/domain/automatico.test.js` | Regra do teto e da prorrogação, isoladas |
| `src/lib/telemetry.test.js` | Não envia nada sem endpoint; não carrega dado pessoal quando envia |
| `src/api/client.test.js` | Forma do erro da API — a falha dela é invisível na tela |
| `src/carrossel.test.jsx` | O carrossel roda com "reduzir movimento" ligado, e a pausa congela onde está |
| `src/pendencias.test.jsx` | Histórico e confirmação de e-mail na tela, nos dois modos |
| `server/server.test.js` | Autenticação, regras no servidor, IDOR e janela de 24 h |
| `server/automatico.test.js` | Teto, prorrogação e trilha de auditoria |
| `server/ratelimit.test.js` | Balde de fichas, identificação do cliente e o 429 pela rede |
| `server/recuperacao.test.js` | Token de uso único, sessões derrubadas, sem enumeração |
| `server/api.test.js` | A API pela rede: cookie, status, IDOR rota a rota, SSE, paginação, histórico, verificação |
| `server/verificacao.test.js` | Token de confirmação: uso único, validade, e a sessão que NÃO cai |
| `server/catalogo.test.js` | Paginação por chave (incluindo prorrogação no meio) e o que o histórico não revela |
| `server/backup.test.js` | A cópia abre e confere; a retenção nunca apaga tudo |
| `server/concorrencia.test.js` | Rajada com conexões concorrentes de verdade |
| `e2e/regressao-auditoria.spec.js` | Um teste por defeito da auditoria, identificado pelo ID — inclui o carrossel sob "reduzir movimento" |
| `e2e/acessibilidade.spec.js` | `axe-core` em 9 rotas × 2 temas × 2 instantes + os 5 overlays; dispensa por teclado |
| `e2e/csp.spec.js` | Serve o build com os cabeçalhos reais e verifica que a CSP não bloqueia nada |
| `e2e/servidor.spec.js` | Fluxo completo contra o servidor: conta, lance, cancelamento, IDOR, confirmação de e-mail, histórico, paginação |

A suíte de acessibilidade reprova o build em qualquer violação `serious` ou `critical`, e
varre cada rota em dois instantes do ciclo do leilão — o selo "encerrando" só existe na
última hora de um lote, e uma falha de contraste ali passava despercebida conforme a hora
em que a suíte rodava.

`e2e/csp.spec.js` existe porque `vite preview` **não** aplica `public/_headers`: a CSP
nunca era exercitada, e não passava — `font-src 'self'` bloqueava as fontes que o Vite
embutia como `data:` URI, derrubando a tipografia para a do sistema sem erro visível.

### Ruído na saída

O canal de e-mail de desenvolvimento **não imprime nada sob o executor de teste**
(`server/email.js`). Desde que o cadastro passou a disparar a confirmação de endereço,
todo teste que cria conta despejava uma mensagem inteira no console e `npm run check`
virava centenas de linhas — em que uma falha de verdade passa despercebida. O canal
continua existindo; o que some é o barulho.

### Isolamento entre testes

Duas armadilhas que já custaram caro e estão fechadas:

- **Um lote por teste.** Rodando em paralelo, dois testes no mesmo lote se superam e o
  segundo lance é recusado — corretamente, pelo servidor; o defeito seria o teste. A vaga
  é passada explicitamente em cada chamada de `abrirLoteExclusivo`. Antes vinha de um
  contador de processo, e como o índice do lote é o resto da divisão pelo tamanho do
  catálogo, dois workers caíam no mesmo lote sempre que os contadores se alinhavam: a
  suíte falhava conforme o número de núcleos da máquina.
- **Thread que terminou de verdade.** `server/concorrencia.test.js` espera o evento
  `exit` dos disputantes, não o `message`. A resposta chega antes de a thread morrer, e o
  teste seguia apagando a pasta temporária com as conexões SQLite ainda abertas nela — no
  Linux passa, no Windows é `EPERM` na limpeza de um teste que tinha passado.

### Orçamento de performance

Verificado no E2E, em números absolutos (não proporcionais ao catálogo): no máximo
**2 imagens por card** e **2 timers ativos**, e **zero timers com a aba oculta**. Toda
animação periódica deriva do relógio único de `src/lib/clock.js` em vez de criar o seu
próprio intervalo.

## Tokens de tema

Vivem em `src/index.css`. O tema claro sobrescreve apenas as variáveis necessárias em
`:root[data-theme="light"]`, e a escolha persiste em `localStorage`. Os dois temas são
verificados por contraste no E2E — ao mexer numa cor, rode `npm run test:e2e`.

## Movimento e carrosséis

O ticker "Encerrando" e a rotação de fotos dos cards e da galeria **continuam rodando com
"reduzir movimento" ligado no sistema**, e a pausa é explícita: passar o mouse, focar pelo
teclado ou apertar o botão da faixa (a escolha persiste em `localStorage`).

Antes eles se desligavam sozinhos com `prefers-reduced-motion`, e num sistema com a
preferência ativada a faixa ao vivo virava uma lista estática e cada card mostrava só a
primeira das quatro fotos, sem nenhuma pista de que havia mais. O que a acessibilidade
pede de conteúdo em movimento é **um jeito de parar** (WCAG 2.2.2), não que ele nunca
comece; a preferência do sistema virava um interruptor sem volta.

As transições **decorativas** — fade de entrada, escala dos diálogos, confete do arremate —
continuam obedecendo `prefers-reduced-motion` pela regra global de `src/index.css`, e o
confete nem chega a ser desenhado.

Detalhe de implementação que vale saber antes de mexer: a animação do ticker vive na
classe `.ticker-marquee`, não no estilo inline. A regra global de reduced-motion usa
`!important`, e `!important` de folha de estilo vence estilo inline — era exatamente por
isso que a duração que o React punha no elemento nunca chegava a valer.
