// A API pela rede, como o navegador a usa.
//
// Os testes de `server.test.js` chamam as funções direto; aqui passa tudo pelo
// HTTP real — cookie, status, corpo. É o que prova o critério do item 10
// ("teste de IDOR POR ROTA") e o do item 9 pela porta que o cliente usa.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { criarServidor } from "./index.js";
import { criarLimitador } from "./ratelimit.js";
import { abrirBanco, semear, buscarLote } from "./db.js";
import { abrirVerificacao } from "./auth.js";
import { scheduledEnd } from "../src/domain/schedule.js";
import { minBidFor } from "../src/domain/auction.js";

const SENHA = "senha-bem-comprida";
let servidor, base, db;

const LOTES = () => [
  { id: "lote-a", category: "imovel", title: "Studio", appraised: 215000, minBid: 138000,
    currentBid: 142500, bids: 14, endsAt: scheduledEnd(20), photoIds: [], docs: [], rules: "", description: "" },
  { id: "lote-encerrado", category: "imovel", title: "Kitnet", appraised: 120000, minBid: 90000,
    currentBid: 98500, bids: 22, endsAt: Date.now() - 86400000, photoIds: [], docs: [], rules: "", description: "" },
];

beforeAll(async () => {
  db = abrirBanco(":memory:");
  // Limitador folgado: estes testes exercitam o contrato, não o limite — que
  // tem suíte própria em ratelimit.test.js. Sem isto, criar dez contas do
  // mesmo IP esgotaria a cota de autenticação e os erros seriam 429.
  servidor = criarServidor({
    db, servirEstaticos: false, seguro: false,
    limitador: criarLimitador({
      perfis: {
        autenticacao: { capacidade: 1e6, recargaPorSegundo: 1e6, custo: 1 },
        escrita: { capacidade: 1e6, recargaPorSegundo: 1e6, custo: 1 },
        leitura: { capacidade: 1e6, recargaPorSegundo: 1e6, custo: 1 },
      },
    }),
  });
  await new Promise((r) => servidor.listen(0, r));
  base = `http://localhost:${servidor.address().port}/api/v1`;
});

afterAll(async () => { await new Promise((r) => servidor.close(r)); });

beforeEach(() => {
  db.exec(
    "DELETE FROM salvos; DELETE FROM lances; DELETE FROM sessoes; DELETE FROM verificacoes; " +
    "DELETE FROM usuarios; DELETE FROM lotes"
  );
  semear(db, LOTES());
});

/** Cliente HTTP simples com cookie próprio — cada `cliente()` é uma pessoa. */
function cliente() {
  let cookie = null;
  return {
    get cookie() { return cookie; },
    async req(metodo, caminho, corpo) {
      const r = await fetch(base + caminho, {
        method: metodo,
        headers: {
          ...(corpo ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const setCookie = r.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      let json = null;
      try { json = await r.json(); } catch { /* sem corpo */ }
      return { status: r.status, json, headers: r.headers };
    },
    get(c) { return this.req("GET", c); },
    post(c, b) { return this.req("POST", c, b); },
  };
}

const registrar = async (c, email) => c.post("/auth/registrar", { email, senha: SENHA, nome: "Pessoa" });

// ------------------------------------------------------------------ contrato
describe("contrato", () => {
  it("expõe a versão da API", async () => {
    const { status, json } = await cliente().get("/saude");
    expect(status).toBe(200);
    expect(json.versao).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("rota inexistente é 404 e método errado é 405", async () => {
    const c = cliente();
    expect((await c.get("/nao-existe")).status).toBe(404);
    expect((await c.post("/lotes")).status).toBe(405);
  });

  it("JSON malformado é 400, não 500", async () => {
    const r = await fetch(base + "/auth/entrar", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{isto não é json",
    });
    expect(r.status).toBe(400);
  });

  it("corpo grande demais é recusado com 413", async () => {
    const r = await fetch(base + "/auth/entrar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@ex.com", senha: "x".repeat(50000) }),
    });
    expect(r.status).toBe(413);
  });

  it("o catálogo é público e traz o prazo do servidor", async () => {
    const { status, json } = await cliente().get("/lotes");
    expect(status).toBe(200);
    expect(json.lotes).toHaveLength(2);
    expect(json.lotes[0].endsAt).toBeTypeOf("number");
    expect(json.agora).toBeTypeOf("number");
  });
});

// -------------------------------------------------------------------- sessão
describe("SEC-003 — sessão por cookie", () => {
  it("registrar cria a sessão e o cookie é HttpOnly, SameSite e de caminho raiz", async () => {
    const c = cliente();
    const r = await registrar(c, "a@ex.com");
    expect(r.status).toBe(201);
    const bruto = r.headers.get("set-cookie");
    expect(bruto).toMatch(/HttpOnly/);
    expect(bruto).toMatch(/SameSite=Lax/);
    expect(bruto).toMatch(/Path=\//);
  });

  it("a resposta nunca devolve hash, sal ou senha", async () => {
    const c = cliente();
    const r = await registrar(c, "a@ex.com");
    const texto = JSON.stringify(r.json);
    expect(texto).not.toMatch(/senha|hash|salt/i);
    expect(r.json.usuario).toEqual({
      id: expect.any(String), email: "a@ex.com", nome: "Pessoa", emailVerificado: false,
    });
  });

  it("entrar e sair", async () => {
    const c = cliente();
    await registrar(c, "a@ex.com");
    await c.post("/auth/sair");
    expect((await c.get("/auth/eu")).json.usuario).toBeNull();
    expect((await c.post("/auth/entrar", { email: "a@ex.com", senha: SENHA })).status).toBe(200);
    expect((await c.get("/auth/eu")).json.usuario.email).toBe("a@ex.com");
  });

  it("senha errada é 401 com a mesma mensagem de conta inexistente", async () => {
    const c = cliente();
    await registrar(c, "a@ex.com");
    const errada = await c.post("/auth/entrar", { email: "a@ex.com", senha: "outra-senha-longa" });
    const inexistente = await c.post("/auth/entrar", { email: "z@ex.com", senha: SENHA });
    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(errada.json.mensagem).toBe(inexistente.json.mensagem);
  });
});

// ---------------------------------------------------------------------- IDOR
describe("item 10 — IDOR e acesso sem sessão, rota por rota", () => {
  const PROTEGIDAS = [
    ["POST", "/lotes/lote-a/lances", { valor: 143500 }],
    ["POST", "/lances/qualquer/cancelar", null],
    ["GET", "/meus-lances", null],
    ["GET", "/salvos", null],
    ["POST", "/salvos/lote-a", null],
  ];

  for (const [metodo, caminho] of PROTEGIDAS) {
    it(`${metodo} ${caminho} responde 401 sem sessão`, async () => {
      const r = await cliente().req(metodo, caminho, metodo === "POST" ? { valor: 143500 } : undefined);
      expect(r.status).toBe(401);
      expect(r.json.erro).toBe("nao-autenticado");
    });
  }

  it("cookie forjado não vale sessão", async () => {
    const r = await fetch(base + "/meus-lances", { headers: { Cookie: "leiloae_sessao=token-inventado" } });
    expect(r.status).toBe(401);
  });

  it("uma pessoa não cancela o lance da outra", async () => {
    const a = cliente(), b = cliente();
    await registrar(a, "a@ex.com");
    await registrar(b, "b@ex.com");

    const lance = (await a.post("/lotes/lote-a/lances", { valor: minBidFor(buscarLote(db, "lote-a")) })).json.lance;
    const tentativa = await b.post(`/lances/${lance.id}/cancelar`);
    expect(tentativa.status).toBe(404);

    // O lance de A continua vivo.
    expect((await a.get("/meus-lances")).json.lances[0].bid.canceled).toBe(false);
  });

  it("'meus lances' e 'salvos' só mostram o que é de quem pediu", async () => {
    const a = cliente(), b = cliente();
    await registrar(a, "a@ex.com");
    await registrar(b, "b@ex.com");

    await a.post("/lotes/lote-a/lances", { valor: minBidFor(buscarLote(db, "lote-a")) });
    await a.post("/salvos/lote-a");

    expect((await a.get("/meus-lances")).json.lances).toHaveLength(1);
    expect((await b.get("/meus-lances")).json.lances).toHaveLength(0);
    expect((await a.get("/salvos")).json.salvos).toEqual(["lote-a"]);
    expect((await b.get("/salvos")).json.salvos).toEqual([]);
  });
});

// --------------------------------------------------------------------- regra
describe("SEC-004 — a regra é decidida no servidor", () => {
  it("lance abaixo do mínimo é 409 e informa o mínimo real", async () => {
    const c = cliente();
    await registrar(c, "a@ex.com");
    const r = await c.post("/lotes/lote-a/lances", { valor: 1 });
    expect(r.status).toBe(409);
    expect(r.json.erro).toBe("below-min");
    expect(r.json.min).toBe(minBidFor(buscarLote(db, "lote-a")));
  });

  it("lance em leilão encerrado é 409", async () => {
    const c = cliente();
    await registrar(c, "a@ex.com");
    const r = await c.post("/lotes/lote-encerrado/lances", { valor: 999999 });
    expect(r.status).toBe(409);
    expect(r.json.erro).toBe("ended");
  });

  it("lance aceito atualiza o catálogo público na mesma hora", async () => {
    const c = cliente();
    await registrar(c, "a@ex.com");
    const alvo = minBidFor(buscarLote(db, "lote-a"));
    expect((await c.post("/lotes/lote-a/lances", { valor: alvo })).status).toBe(201);

    const publico = (await cliente().get("/lotes/lote-a")).json.lote;
    expect(publico.currentBid).toBe(alvo);
    expect(publico.bids).toBe(15);
  });
});

describe("item 9 — rajada pela rede", () => {
  it("oito pedidos simultâneos no mesmo valor: um 201 e sete 409", async () => {
    const pessoas = await Promise.all(
      Array.from({ length: 8 }, async (_, i) => {
        const c = cliente();
        await registrar(c, `r${i}@ex.com`);
        return c;
      })
    );
    const alvo = minBidFor(buscarLote(db, "lote-a"));
    const respostas = await Promise.all(pessoas.map((c) => c.post("/lotes/lote-a/lances", { valor: alvo })));

    expect(respostas.filter((r) => r.status === 201)).toHaveLength(1);
    expect(respostas.filter((r) => r.status === 409)).toHaveLength(7);
    expect(db.prepare("SELECT COUNT(*) n FROM lances").get().n).toBe(1);
  });
});

// ---------------------------------------------------------------- ao vivo
describe("BIZ-004 — atualização ao vivo", () => {
  it("um lance publica o lote atualizado no fluxo de eventos", async () => {
    const c = cliente();
    await registrar(c, "a@ex.com");

    const controlador = new AbortController();
    const fluxo = await fetch(base.replace("/api/v1", "") + "/api/v1/eventos", { signal: controlador.signal });
    const leitor = fluxo.body.getReader();
    const decodificador = new TextDecoder();

    const alvo = minBidFor(buscarLote(db, "lote-a"));
    await c.post("/lotes/lote-a/lances", { valor: alvo });

    let texto = "";
    // O primeiro pedaço é o `retry:`; segue lendo até o evento do lote.
    for (let i = 0; i < 5 && !texto.includes("event: lote"); i++) {
      const { value, done } = await leitor.read();
      if (done) break;
      texto += decodificador.decode(value);
    }
    controlador.abort();

    expect(texto).toContain("event: lote");
    const linhaDados = texto.split("\n").find((l) => l.startsWith("data: "));
    expect(JSON.parse(linhaDados.slice(6)).currentBid).toBe(alvo);
  }, 15000);
});

// ------------------------------------------------------------- cabeçalhos
describe("SEC-006 — cabeçalhos de segurança na API", () => {
  it("a resposta traz CSP, nosniff e DENY, e não é cacheada", async () => {
    const r = await fetch(base + "/lotes");
    expect(r.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});

// ------------------------------------------------ pendências de docs/api.md
describe("paginação de /lotes", () => {
  it("sem limite, a resposta é a do contrato antigo", async () => {
    const { json } = await cliente().get("/lotes");
    expect(json.lotes).toHaveLength(2);
    expect(json.proximo).toBeNull();
    expect(json.total).toBe(2);
  });

  it("com limite, entrega a página e o cursor da seguinte", async () => {
    const c = cliente();
    const primeira = await c.get("/lotes?limite=1");
    expect(primeira.json.lotes).toHaveLength(1);
    expect(primeira.json.proximo).toBeTruthy();

    const segunda = await c.get(`/lotes?limite=1&cursor=${encodeURIComponent(primeira.json.proximo)}`);
    expect(segunda.json.lotes).toHaveLength(1);
    expect(segunda.json.lotes[0].id).not.toBe(primeira.json.lotes[0].id);
    expect(segunda.json.proximo).toBeNull();
  });

  it("limite fora de forma é 400, não um palpite", async () => {
    const c = cliente();
    expect((await c.get("/lotes?limite=abc")).status).toBe(400);
    expect((await c.get("/lotes?limite=0")).status).toBe(400);
    expect((await c.get("/lotes?limite=9999")).status).toBe(400);
    expect((await c.get("/lotes?limite=1.5")).status).toBe(400);
  });
});

describe("histórico público de lances", () => {
  it("é público e não identifica ninguém", async () => {
    const ana = cliente();
    await registrar(ana, "hist-ana@ex.com");
    const lote = buscarLote(db, "lote-a");
    await ana.post("/lotes/lote-a/lances", { valor: minBidFor(lote) });

    // Sem cookie nenhum: é a informação que o pregão anuncia em voz alta.
    const { status, json } = await cliente().get("/lotes/lote-a/lances");
    expect(status).toBe(200);
    expect(json.lances).toHaveLength(1);
    expect(json.lances[0].participante).toBe("Participante 1");
    expect(JSON.stringify(json)).not.toContain("hist-ana@ex.com");
  });

  it("lote inexistente é 404", async () => {
    expect((await cliente().get("/lotes/nao-existe/lances")).status).toBe(404);
  });
});

describe("verificação de e-mail", () => {
  it("a conta nasce não verificada e /auth/eu conta isso", async () => {
    const c = cliente();
    const r = await registrar(c, "verificar@ex.com");
    expect(r.json.usuario.emailVerificado).toBe(false);
    expect((await c.get("/auth/eu")).json.usuario.emailVerificado).toBe(false);
  });

  it("o token confirma o endereço, e o link vale uma vez só", async () => {
    const c = cliente();
    await registrar(c, "confirma@ex.com");
    const usuarioId = (await c.get("/auth/eu")).json.usuario.id;
    // O token nunca volta pela resposta HTTP: quem manda é o canal de e-mail.
    // Aqui ele é aberto direto no banco, que é o que o canal receberia.
    const { token } = abrirVerificacao(db, usuarioId);

    const primeira = await cliente().post("/auth/verificar", { token });
    expect(primeira.status).toBe(200);
    expect(primeira.json.usuario.emailVerificado).toBe(true);
    expect((await c.get("/auth/eu")).json.usuario.emailVerificado).toBe(true);

    expect((await cliente().post("/auth/verificar", { token })).status).toBe(400);
  });

  it("token inválido é 400 com código estável", async () => {
    const r = await cliente().post("/auth/verificar", { token: "inventado" });
    expect(r.status).toBe(400);
    expect(r.json.erro).toBe("token-invalido");
  });

  it("reenviar exige sessão", async () => {
    expect((await cliente().post("/auth/verificar/enviar")).status).toBe(401);
  });

  it("reenviar com a conta já confirmada não manda nada e diz por quê", async () => {
    const c = cliente();
    await registrar(c, "reenvio@ex.com");
    const usuarioId = (await c.get("/auth/eu")).json.usuario.id;
    await cliente().post("/auth/verificar", { token: abrirVerificacao(db, usuarioId).token });

    const r = await c.post("/auth/verificar/enviar");
    expect(r.status).toBe(200);
    expect(r.json.jaVerificado).toBe(true);
  });

  it("nenhuma resposta devolve o token de confirmação", async () => {
    const c = cliente();
    const registro = await registrar(c, "discreta@ex.com");
    const eu = await c.get("/auth/eu");
    const reenvio = await c.post("/auth/verificar/enviar");
    const tudo = JSON.stringify([registro.json, eu.json, reenvio.json]);
    const guardados = db.prepare("SELECT token_hash FROM verificacoes").all();
    expect(guardados.length).toBeGreaterThan(0);
    for (const { token_hash } of guardados) expect(tudo).not.toContain(token_hash);
    // Nem o hash nem qualquer campo chamado token: o link só existe no e-mail.
    expect(tudo).not.toMatch(/"token/i);
  });
});
