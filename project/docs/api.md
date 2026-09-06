# Contrato da API — v1

Versão: **1.2.0** · Prefixo: `/api/v1` · Confirmável em `GET /api/v1/saude`.

Este documento é o contrato. Mudança incompatível exige um prefixo novo
(`/api/v2`); acréscimo compatível sobe a versão menor.

## Princípios

1. **Quem está falando vem da sessão, nunca do pedido.** Nenhuma rota aceita
   `usuario_id` no corpo ou na URL. Pedir pelo recurso de outra pessoa devolve
   `404`, não `403` — não confirmamos que o recurso existe.
2. **A regra é decidida aqui.** O cliente valida para dar resposta imediata; o
   servidor valida para valer, usando o mesmo módulo (`src/domain/auction.js`).
   Divergência entre os dois é impossível por construção.
3. **O relógio é do servidor.** Nenhum endpoint aceita "agora" do cliente.
4. **Dinheiro é inteiro em reais.** Sem centavos, sem ponto flutuante.
5. **Erro de regra não é erro de servidor.** Lance superado é `409`, não `400`
   nem `500`.
6. **Toda escrita deixa rastro.** Lance, lance automático, prorrogação e
   cancelamento viram linha na trilha de auditoria, na mesma transação.

## Formato

Toda resposta é JSON. O erro tem sempre a mesma forma:

```json
{ "erro": "below-min", "mensagem": "O lance mínimo agora é R$ 143.500.", "min": 143500 }
```

`erro` é um código estável para o programa; `mensagem` é texto para a pessoa.

### Códigos

| `erro` | HTTP | Significado |
| --- | --- | --- |
| `dados-invalidos` | 400 | Corpo não passou na validação |
| `valor-invalido` / `teto-invalido` | 400 | Lance ou teto fora de forma |
| `json-invalido` | 400 | Corpo não é JSON |
| `corpo-grande-demais` | 413 | Acima de 16 KiB |
| `nao-autenticado` | 401 | Sem sessão válida |
| `credenciais-invalidas` | 401 | E-mail ou senha incorretos |
| `below-min` | 409 | Lance abaixo do mínimo do momento |
| `ended` | 409 | Leilão encerrado |
| `fora-da-janela` | 409 | Fora da janela de cancelamento de 24 h |
| `email-em-uso` | 409 | Já existe conta com esse e-mail |
| `lote-inexistente` / `lance-inexistente` | 404 | Não encontrado (ou não é seu) |
| `rota-inexistente` | 404 | — |
| `metodo-nao-permitido` | 405 | — |
| `excesso-de-pedidos` | 429 | Limite de taxa; a resposta traz `Retry-After` |
| `token-invalido` | 400 | Link de redefinição ou de confirmação inválido, expirado ou já usado |
| `canal-indisponivel` | 503 | Canal de e-mail não configurado no ambiente |
| `erro-interno` | 500 | Falha inesperada; detalhe fica no log, não na resposta |

## Sessão

Cookie `leiloae_sessao`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` em
produção, validade de 30 dias. O token **não** é gravado em claro — o banco
guarda o SHA-256. `SameSite=Lax` é o que dispensa token de CSRF nas escritas.

| Método | Rota | Sessão | Resposta |
| --- | --- | --- | --- |
| POST | `/auth/registrar` | — | `201 {usuario}` + cookie |
| POST | `/auth/entrar` | — | `200 {usuario}` + cookie |
| POST | `/auth/sair` | — | `200 {ok}` + cookie expirado |
| GET | `/auth/eu` | — | `200 {usuario\|null}` |
| POST | `/auth/recuperar` | — | `200 {ok, mensagem}` — sempre igual |
| POST | `/auth/redefinir` | — | `200 {ok}` + cookie expirado |
| POST | `/auth/verificar` | — | `200 {ok, usuario}` |
| POST | `/auth/verificar/enviar` | exige | `200 {ok, jaVerificado}` |

`registrar` exige `{email, senha, nome}`; senha com no mínimo 10 caracteres.
Nenhuma resposta em nenhuma rota devolve hash, sal ou senha.

O objeto `usuario` é `{id, email, nome, emailVerificado}`.

### Recuperação de senha

`POST /auth/recuperar {email}` responde **exatamente a mesma coisa** exista ou
não a conta — um "e-mail não encontrado" entregaria a lista de clientes a quem
for perguntando um endereço por vez. O token vai pelo canal configurado
(`LEILOAE_EMAIL_ENDPOINT`) e **nunca** pela resposta HTTP; sem canal
configurado, a rota responde `503 canal-indisponivel`, em vez de fingir envio.

`POST /auth/redefinir {token, senha}` consome o token (uso único, 30 min) e
**derruba todas as sessões da conta**, inclusive a de quem eventualmente já
estivesse dentro — trocar a senha sem isso é o momento em que a vítima acha que
resolveu e não resolveu.

### Verificação de e-mail

O cadastro dispara um link de confirmação pelo canal configurado
(`LEILOAE_EMAIL_ENDPOINT`). Como na recuperação, o token vai **só pelo e-mail**,
é guardado como hash, vale 24 h e só pode ser usado uma vez; pedir um novo
invalida o anterior.

`POST /auth/verificar {token}` consome o token e marca o endereço como
confirmado. É **público** de propósito: o link do e-mail costuma ser aberto
noutro navegador, onde não existe sessão. Ao contrário da redefinição de senha,
**não derruba as sessões** — confirmar um endereço não troca credencial nenhuma.

`POST /auth/verificar/enviar` reenvia o link. Exige sessão, porque sem isso
seria um jeito de mandar e-mail para qualquer endereço a partir do nosso
domínio; sem canal configurado responde `503 canal-indisponivel`. Conta já
confirmada recebe `200 {ok: true, jaVerificado: true}` e nada é enviado.

**A conta funciona sem verificação, de propósito.** Travar o lance atrás de um
e-mail que pode nunca chegar (provedor bloqueando, caixa cheia) trocaria um
problema raro por um que impede de usar o produto. O que muda é que a interface
diz, de forma visível, que o endereço ainda não foi confirmado — e é isso que
resolve o defeito de origem: um endereço digitado errado aparecia só quando a
pessoa tentava recuperar a senha, já trancada para fora.

## Limitação de taxa

Balde de fichas por cliente e por perfil de rota. Excedido, a resposta é `429`
com `Retry-After` em segundos.

| Perfil | Rotas | Padrão |
| --- | --- | --- |
| `autenticacao` | entrar, registrar, recuperar, redefinir, verificar | 10 de imediato, +1/min |
| `escrita` | lances, cancelamento, favoritos | 30 de imediato, +60/min |
| `leitura` | o resto | 120 de imediato, +240/min |

Ajustáveis sem deploy por `LEILOAE_LIMITE_AUTENTICACAO`, `LEILOAE_LIMITE_ESCRITA`
e `LEILOAE_LIMITE_LEITURA`, no formato `capacidade:porMinuto`.

A identidade do cliente é o endereço da conexão. `X-Forwarded-For` só é
considerado com `LEILOAE_ATRAS_DE_PROXY=1` — confiar nele sempre daria ao
atacante o poder de escolher a própria chave de limite, e escapar dele.

**Limite conhecido:** o estado é de processo. Com várias instâncias, o limite
efetivo multiplica pelo número delas; para valer num cluster, precisa de
armazenamento compartilhado.

## Catálogo (público)

| Método | Rota | Resposta |
| --- | --- | --- |
| GET | `/lotes` | `{lotes: Lote[], proximo, total, agora}` |
| GET | `/lotes/:id` | `{lote: Lote, agora}` |
| GET | `/lotes/:id/lances` | `{lances: LanceDoHistorico[], agora}` |
| GET | `/saude` | `{ok, versao, agora}` |

### Paginação

`GET /lotes` aceita `?limite=` (inteiro de 1 a 200) e `?cursor=`. **Sem
`limite`, responde o catálogo inteiro**, exatamente como na 1.1 — nenhum cliente
existente precisa saber que a paginação passou a existir. Com `limite`, `proximo`
traz o cursor da página seguinte, ou `null` quando acabou. `limite` fora de forma
é `400 dados-invalidos`, não um palpite: quem pediu `limite=abc` tem um defeito,
e arredondar esconderia isso de quem o escreveu.

A paginação é por **chave**, não por `OFFSET`, e a chave é
`(encerra_em_original, id)` — o horário do edital, que a prorrogação não move.
Com `OFFSET`, ou ordenando por `encerra_em`, um lote prorrogado no meio da
leitura reapareceria na página seguinte e o vizinho sumiria. A diferença de
ordem entre as duas colunas é de no máximo dois minutos, e a interface reordena
por conta própria.

### Histórico público de lances

`GET /lotes/:id/lances` devolve a disputa do lote, sem sessão — é a mesma
informação que o pregão anuncia em voz alta na sala. O que faltava não era
código: era decidir o que aparece sobre quem deu cada lance. A decisão:

- **Ninguém é identificado.** Cada conta vira `Participante N` **dentro daquele
  lote**, numerada pela ordem do primeiro lance. O número não segue a pessoa
  para outro lote, então dois históricos não podem ser cruzados para
  reconstruir o comportamento de alguém no site inteiro.
- **Sai o que o leilão já anuncia**: `{id, participante, valor, em, automatico,
  cancelado}`. Nome, e-mail, id e **teto** não saem — o teto principalmente,
  porque é a informação com que se ganha do outro.
- **Lance cancelado aparece marcado, não sumido.** A trilha não apaga o que
  existiu, e um valor que some da lista sem explicação é exatamente o que faz o
  iniciante achar que o leilão foi mexido.

`Lote` tem `endsAt` absoluto em milissegundos e `versao`, que incrementa a cada
escrita — serve para detectar leitura velha. A forma completa está tipada em
`src/tipos.d.ts` como união discriminada por `category`.

## Lances (exige sessão)

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| POST | `/lotes/:id/lances` | `{valor, teto?}` | `201 {lance, lote}` |
| POST | `/lances/:id/cancelar` | — | `200 {cancelado, loteId}` |
| GET | `/meus-lances` | — | `200 {lances: [{bid, lot}], agora}` |

O registro roda em `BEGIN IMMEDIATE` e **relê o lote de dentro da transação**
antes de validar. Numa rajada de lances de mesmo valor, exatamente um entra; os
demais recebem `409 below-min` com o novo mínimo. Isto tem teste dedicado, com
contenção real entre conexões (`server/concorrencia.test.js`).

### Lance automático (teto)

`{valor, teto}` autoriza lances até `teto`. O teto **não é o valor pago**: quem
tem o maior teto vence pagando um incremento acima do segundo maior — ou o
próprio teto, o que for menor. Revelar um teto alto não custa dinheiro, que é o
que torna o mecanismo seguro para quem está começando.

A disputa é resolvida **dentro da mesma transação** do lance que a disparou.
A resposta traz `lanceAutomatico` (ou `null`), e o lance automático vem marcado
com `automatico: true` em `/meus-lances`. Ele não abre janela de cancelamento —
a janela protege a decisão de quem digitou, e ninguém digitou este.

Exceção deliberada à regra de incremento: se o teto de quem vence não alcança um
incremento cheio mas ainda supera o teto do segundo, o lance sai pelo teto. Sem
isso, quem autorizou MAIS perderia para quem autorizou menos.

### Prorrogação (anti-sniping)

Lance nos últimos 2 minutos empurra o encerramento para `agora + 2 min`. O
horário do edital fica em `encerramentoOriginal` e não se move — é o que permite
a interface dizer "prorrogado" com honestidade. Lote já encerrado não é
ressuscitado por lance nenhum.

## Trilha de auditoria

Tabela `eventos`, só de inserção, escrita na mesma transação do fato: `lance`,
`lance-automatico`, `prorrogacao`, `cancelamento`. Cancelar um lance o tira da
disputa, mas **não apaga o registro de que ele existiu**. Uma transação desfeita
não deixa evento.

O cancelamento só vale para o primeiro lance da pessoa e dentro de 24 h. Ao
cancelar, o lote volta para o maior lance vivo — ou para o lance mínimo, se não
sobrar nenhum.

## Favoritos (exige sessão)

| Método | Rota | Resposta |
| --- | --- | --- |
| GET | `/salvos` | `{salvos: string[]}` |
| POST | `/salvos/:loteId` | `{salvo: boolean}` (alternância) |

## Eventos ao vivo

`GET /api/v1/eventos` — Server-Sent Events. Evento `lote` com o lote atualizado
sempre que um lance ou cancelamento muda o estado. Pulso a cada 25 s para
atravessar proxies. Reconexão fica por conta do `EventSource`.

## Cabeçalhos

Toda resposta leva CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options:
DENY`, `Referrer-Policy` e `Permissions-Policy`; `Strict-Transport-Security` em
produção. Respostas de API são `Cache-Control: no-store`.

## O que ainda não existe

Registrado aqui para não ser confundido com omissão:

- **Limitação de taxa por processo**, não por cluster (ver acima). Não é
  descuido nem falta de tempo: um limite que vale num cluster precisa de
  estado compartilhado (Redis ou equivalente), e isso é a primeira dependência
  de infraestrutura do projeto — decisão de operação, não de código. Com uma
  instância, o limite atual vale exatamente o que promete.
- **A janela de prorrogação (2 min) é uma escolha técnica, não uma regra de
  edital.** Precisa ser confirmada pelo negócio e constar do edital de cada
  lote antes de ir ao ar. É o único item desta lista que nenhuma quantidade de
  código resolve.

Resolvido desde a versão 1.1, e registrado aqui para quem voltar a este
documento procurando:

- **Verificação de e-mail** no cadastro — ver acima.
- **Paginação** em `/lotes` — ver acima.
- **Histórico público de lances por lote** — ver acima.
- **Backup e retenção** do arquivo SQLite: `npm run backup` (`scripts/backup.mjs`),
  cópia consistente por `VACUUM INTO`, conferida antes de qualquer limpeza, com
  retenção por idade e um mínimo por contagem que impede a limpeza de apagar
  tudo. Detalhes no README.
