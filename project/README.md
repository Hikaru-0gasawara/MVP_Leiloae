# Leiloaê

"Leilão sem juridiquês" — marketplace de leilões de imóveis e veículos em São Paulo,
feito para quem nunca participou de um leilão.

React + Vite no cliente, Node + SQLite no servidor. A aplicação roda em **dois modos**,
e os dois são exercitados pelos testes:

| | Demonstração (padrão) | Servidor |
| --- | --- | --- |
| Ligado por | `VITE_API_URL` vazio | `VITE_API_URL=/` |
| Catálogo | `src/data.js`, estático | banco, via `/api/v1/lotes` |
| Lances e favoritos | `localStorage` | conta no servidor, com transação |
| Conta | persona fictícia | e-mail e senha de verdade |
| Publicável sem back-end | sim | não |

As telas são as mesmas: `src/state/catalogo.js` entrega a mesma interface nos dois
casos, então nenhuma tela sabe qual está rodando.

## Rodando

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm run build     # build de produção em dist/
npm run preview   # serve o build

npm run servidor     # sobe a API + serve o build (porta 3000)
npm run dev:servidor # build apontando para a API e sobe o servidor

npm run lint         # ESLint (react-hooks + jsx-a11y)
npm run typecheck    # tsc --checkJs sobre domínio, bibliotecas e servidor
npm test             # Vitest (unidade e componente)
npm run test:e2e     # Playwright (regressão, acessibilidade e CSP)
npm run check        # lint + typecheck + test + build
npm run fotos:baixar # baixa as fotos para public/fotos (ver abaixo)
```

O CI (`.github/workflows/ci.yml`) roda lint, testes, `npm audit` e build em todo push
e pull request, mais a suíte E2E num job separado.

## Servidor

```bash
VITE_API_URL=/ npm run build:servidor
npm run servidor          # http://localhost:3000, API em /api/v1
```

O contrato está em [`docs/api.md`](docs/api.md), versionado em `/api/v1`.

O banco é SQLite pelo módulo embutido `node:sqlite` — **zero dependências novas**
(experimental no Node 22; o acesso está isolado em `server/db.js` justamente para
que trocar de driver seja local). Arquivo em `dados/leiloae.db`, configurável por
`LEILOAE_DB`.

Três decisões que sustentam o resto:

- **O servidor usa o mesmo `src/domain/auction.js` que a interface.** Não é a regra
  reimplementada: é a mesma função. Divergência entre o que o botão habilita e o que
  o servidor aceita é impossível por construção (SEC-004).
- **O lance roda em `BEGIN IMMEDIATE` e relê o lote de dentro da transação.** Numa
  rajada de lances iguais, exatamente um entra. Há teste com contenção real entre
  conexões, e ele foi verificado sabotando a transação de propósito.
- **Quem está falando vem sempre da sessão**, nunca do corpo ou da URL. Pedir pelo
  recurso de outra pessoa devolve 404 (SEC-003/004).

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
| `src/lib/motion.js` | Preferência de movimento do sistema e escalonamento de animações derivadas do relógio |
| `src/lib/telemetry.js` | Relato de erro e eventos de funil, por endpoint configurável — sem SDK de terceiro |
| `src/api/client.js` | Cliente HTTP e `ErroDaApi`; assinatura do fluxo de eventos |
| `src/api/resource.js` | `useResource`/`useMutation`: carregando, erro, recarregar |
| `src/state/catalogo.js` | A mesma interface para os dois modos (com e sem servidor) |
| `src/tipos.d.ts` | `Lote` como união discriminada por categoria, e demais tipos |
| `server/db.js` | Esquema, migração e leitura do catálogo |
| `server/auth.js` | scrypt, sessão por cookie HttpOnly, token guardado em hash |
| `server/bids.js` | Motor de lances transacional e janela de cancelamento |
| `server/routes.js` | Contrato HTTP `/api/v1` |
| `server/index.js` | Servidor, eventos ao vivo e estáticos com os cabeçalhos reais |
| `src/lib/config.js` | Configuração por ambiente: modo demonstração, canais de contato |
| `src/lib/photos.js` | `srcset`/`sizes` por contexto de uso e texto alternativo das fotos |
| `src/lib/router.js` | Mapeamento rota ↔ URL (deep link e histórico do navegador) |
| `src/ui/Dialog.jsx` | Diálogo acessível (foco inicial, trap, ESC, devolução do foco) e `useDismissable` |
| `src/ui/ErrorBoundary.jsx` | Contenção de erro de renderização, com caminho de recuperação |
| `src/ui/DemoBanner.jsx` | Faixa fixa e aviso local de demonstração |
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
| `src/lib/telemetry.test.js` | Não envia nada sem endpoint; não carrega dado pessoal quando envia |
| `src/api/client.test.js` | Forma do erro da API — a falha dela é invisível na tela |
| `server/server.test.js` | Autenticação, regras no servidor, IDOR e janela de 24 h |
| `server/api.test.js` | A API pela rede: cookie, status, IDOR rota a rota, SSE |
| `server/concorrencia.test.js` | Rajada com conexões concorrentes de verdade |
| `e2e/regressao-auditoria.spec.js` | Um teste por defeito da auditoria, identificado pelo ID |
| `e2e/acessibilidade.spec.js` | `axe-core` em 9 rotas × 2 temas × 2 instantes + os 5 overlays; dispensa por teclado |
| `e2e/csp.spec.js` | Serve o build com os cabeçalhos reais e verifica que a CSP não bloqueia nada |
| `e2e/servidor.spec.js` | Fluxo completo contra o servidor: conta, lance, cancelamento, IDOR |

A suíte de acessibilidade reprova o build em qualquer violação `serious` ou `critical`, e
varre cada rota em dois instantes do ciclo do leilão — o selo "encerrando" só existe na
última hora de um lote, e uma falha de contraste ali passava despercebida conforme a hora
em que a suíte rodava.

`e2e/csp.spec.js` existe porque `vite preview` **não** aplica `public/_headers`: a CSP
nunca era exercitada, e não passava — `font-src 'self'` bloqueava as fontes que o Vite
embutia como `data:` URI, derrubando a tipografia para a do sistema sem erro visível.

### Orçamento de performance

Verificado no E2E, em números absolutos (não proporcionais ao catálogo): no máximo
**2 imagens por card** e **2 timers ativos**, e **zero timers com a aba oculta**. Toda
animação periódica deriva do relógio único de `src/lib/clock.js` em vez de criar o seu
próprio intervalo.

## Tokens de tema

Vivem em `src/index.css`. O tema claro sobrescreve apenas as variáveis necessárias em
`:root[data-theme="light"]`, e a escolha persiste em `localStorage`. Os dois temas são
verificados por contraste no E2E — ao mexer numa cor, rode `npm run test:e2e`.
