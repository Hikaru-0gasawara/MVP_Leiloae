# Contrato da API — v1

Versão: **1.0.0** · Prefixo: `/api/v1` · Confirmável em `GET /api/v1/saude`.

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

`registrar` exige `{email, senha, nome}`; senha com no mínimo 10 caracteres.
Nenhuma resposta em nenhuma rota devolve hash, sal ou senha.

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

- **Sem limitação de taxa.** Antes de expor à internet, é obrigatório em
  `/auth/entrar` e `/auth/registrar`.
- **Sem verificação de e-mail** nem recuperação de senha.
- **Sem paginação** em `/lotes`: o catálogo tem 14 itens. Passa a ser
  necessária muito antes de mil.
- **Sem prorrogação automática** no encerramento (*sniping*). A auditoria
  aponta a rajada final como o risco estrutural do domínio, e a regra precisa
  ser decidida pelo negócio antes de implementada.
- **Sem trilha de auditoria** separada dos dados operacionais.
