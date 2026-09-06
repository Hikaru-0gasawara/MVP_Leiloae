# Contrato da API — v1

Versão: **1.1.0** · Prefixo: `/api/v1` · Confirmável em `GET /api/v1/saude`.

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
| `token-invalido` | 400 | Link de redefinição inválido, expirado ou já usado |
| `canal-indisponivel` | 503 | Recuperação por e-mail não configurada no ambiente |
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

`registrar` exige `{email, senha, nome}`; senha com no mínimo 10 caracteres.
Nenhuma resposta em nenhuma rota devolve hash, sal ou senha.

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

## Limitação de taxa

Balde de fichas por cliente e por perfil de rota. Excedido, a resposta é `429`
com `Retry-After` em segundos.

| Perfil | Rotas | Padrão |
| --- | --- | --- |
| `autenticacao` | entrar, registrar, recuperar, redefinir | 10 de imediato, +1/min |
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
| GET | `/lotes` | `{lotes: Lote[], agora}` |
| GET | `/lotes/:id` | `{lote: Lote, agora}` |
| GET | `/saude` | `{ok, versao, agora}` |

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

- **Sem verificação de e-mail** no cadastro. A conta funciona antes de o
  endereço ser confirmado, então um endereço digitado errado só aparece quando
  a pessoa tenta recuperar a senha.
- **Sem paginação** em `/lotes`: o catálogo tem 14 itens. Passa a ser
  necessária muito antes de mil.
- **Limitação de taxa por processo**, não por cluster (ver acima).
- **Sem histórico público de lances por lote.** A trilha existe no banco e não
  é exposta por nenhuma rota; publicar exige decidir antes o que aparece sobre
  quem deu cada lance.
- **Sem backup nem política de retenção** definidos para o arquivo SQLite.
- **A janela de prorrogação (2 min) é uma escolha técnica, não uma regra de
  edital.** Precisa ser confirmada pelo negócio e constar do edital de cada
  lote antes de ir ao ar.
