// Limitação de taxa (SEC-007).
//
// docs/api.md marcava isto como obrigatório antes de qualquer URL pública.
// O relógio é injetado: um teste de limite que depende de `setTimeout` real é
// lento e intermitente, e intermitente é pior que ausente.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { criarLimitador, identificar, PERFIS } from "./ratelimit.js";
import { criarServidor } from "./index.js";
import { abrirBanco, semear } from "./db.js";
import { scheduledEnd } from "../src/domain/schedule.js";

/** Relógio controlado. */
function relogio(inicio = 0) {
  let t = inicio;
  return { agora: () => t, avancar: (ms) => { t += ms; } };
}

describe("balde de fichas", () => {
  it("libera até a capacidade e recusa a seguir", () => {
    const r = relogio();
    const lim = criarLimitador({ agora: r.agora });
    const capacidade = PERFIS.autenticacao.capacidade;

    for (let i = 0; i < capacidade; i++) {
      expect(lim.consumir("1.2.3.4", "autenticacao").ok).toBe(true);
    }
    const recusa = lim.consumir("1.2.3.4", "autenticacao");
    expect(recusa.ok).toBe(false);
    expect(recusa.esperarMs).toBeGreaterThan(0);
  });

  it("recarrega com o tempo, na taxa do perfil", () => {
    const r = relogio();
    const lim = criarLimitador({ agora: r.agora });
    for (let i = 0; i < PERFIS.autenticacao.capacidade; i++) lim.consumir("ip", "autenticacao");
    expect(lim.consumir("ip", "autenticacao").ok).toBe(false);

    // Uma ficha do perfil de autenticação leva 60 s para voltar.
    r.avancar(59_000);
    expect(lim.consumir("ip", "autenticacao").ok).toBe(false);
    r.avancar(2_000);
    expect(lim.consumir("ip", "autenticacao").ok).toBe(true);
  });

  it("não acumula além da capacidade por mais que se espere", () => {
    const r = relogio();
    const lim = criarLimitador({ agora: r.agora });
    r.avancar(30 * 24 * 3600_000); // um mês parado
    let liberados = 0;
    while (lim.consumir("ip", "autenticacao").ok) liberados++;
    expect(liberados).toBe(PERFIS.autenticacao.capacidade);
  });

  it("cada cliente tem o próprio balde", () => {
    const lim = criarLimitador({ agora: relogio().agora });
    for (let i = 0; i < PERFIS.autenticacao.capacidade; i++) lim.consumir("atacante", "autenticacao");
    expect(lim.consumir("atacante", "autenticacao").ok).toBe(false);
    expect(lim.consumir("visitante", "autenticacao").ok).toBe(true);
  });

  it("os perfis são independentes: esgotar a escrita não fecha a leitura", () => {
    const lim = criarLimitador({ agora: relogio().agora });
    for (let i = 0; i < PERFIS.escrita.capacidade; i++) lim.consumir("ip", "escrita");
    expect(lim.consumir("ip", "escrita").ok).toBe(false);
    expect(lim.consumir("ip", "leitura").ok).toBe(true);
  });

  it("perfil desconhecido cai na leitura em vez de liberar tudo", () => {
    const lim = criarLimitador({ agora: relogio().agora });
    let liberados = 0;
    // @ts-expect-error perfil inexistente de propósito
    while (lim.consumir("ip", "inventado").ok) liberados++;
    expect(liberados).toBe(PERFIS.leitura.capacidade);
  });

  it("a memória não cresce sem limite: baldes cheios e parados são descartados", () => {
    const r = relogio();
    const lim = criarLimitador({ agora: r.agora });
    for (let i = 0; i < 500; i++) lim.consumir(`ip-${i}`, "leitura");
    expect(lim.tamanho).toBe(500);

    r.avancar(2 * 3600_000); // duas horas: todos recarregaram até o topo
    expect(lim.limpar()).toBe(0);
  });

  it("um balde ainda gasto não é descartado — senão a limpeza zeraria o limite", () => {
    const r = relogio();
    const lim = criarLimitador({ agora: r.agora });
    for (let i = 0; i < PERFIS.autenticacao.capacidade; i++) lim.consumir("atacante", "autenticacao");
    r.avancar(2 * 3600_000);
    lim.limpar();
    // Depois de duas horas o balde recarregou de verdade: liberar é correto.
    expect(lim.consumir("atacante", "autenticacao").ok).toBe(true);
  });
});

describe("identificação do cliente", () => {
  const req = (headers, ip) => ({ headers, socket: { remoteAddress: ip } });

  it("usa o endereço da conexão por padrão", () => {
    expect(identificar(req({ "x-forwarded-for": "9.9.9.9" }, "10.0.0.1"))).toBe("10.0.0.1");
  });

  it("só confia em X-Forwarded-For quando explicitamente atrás de proxy", () => {
    // Confiar sempre daria ao atacante o poder de escolher a própria chave de
    // limite — e escapar dele trocando o cabeçalho a cada pedido.
    expect(identificar(req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }, "10.0.0.1"), { atrasDeProxy: true }))
      .toBe("9.9.9.9");
  });

  it("sem endereço, devolve uma chave estável em vez de undefined", () => {
    expect(identificar({ headers: {}, socket: {} })).toBe("desconhecido");
  });
});

describe("pela rede", () => {
  let servidor, base, db, r;

  beforeAll(async () => {
    r = relogio();
    db = abrirBanco(":memory:");
    semear(db, [{
      id: "lote-a", category: "imovel", title: "Studio", appraised: 215000, minBid: 138000,
      currentBid: 142500, bids: 14, endsAt: scheduledEnd(20),
      photoIds: [], docs: [], rules: "", description: "",
    }]);
    servidor = criarServidor({
      db, servirEstaticos: false, seguro: false,
      limitador: criarLimitador({ agora: r.agora }),
    });
    await new Promise((ok) => servidor.listen(0, ok));
    base = `http://localhost:${servidor.address().port}/api/v1`;
  });

  afterAll(async () => { await new Promise((ok) => servidor.close(ok)); });

  it("força bruta em /auth/entrar é cortada com 429 e Retry-After", async () => {
    const tentar = () => fetch(`${base}/auth/entrar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alvo@ex.com", senha: "chute-qualquer-longo" }),
    });

    let ultima;
    for (let i = 0; i < PERFIS.autenticacao.capacidade + 1; i++) ultima = await tentar();

    expect(ultima.status).toBe(429);
    expect(Number(ultima.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await ultima.json()).erro).toBe("excesso-de-pedidos");
  });

  it("o limite de autenticação não fecha a leitura do catálogo", async () => {
    // A cota de autenticação já foi esgotada pelo teste anterior.
    expect((await fetch(`${base}/lotes`)).status).toBe(200);
  });

  it("o pedido recusado não chega a consultar o banco", async () => {
    const antes = db.prepare("SELECT COUNT(*) n FROM usuarios").get().n;
    await fetch(`${base}/auth/registrar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "novo@ex.com", senha: "senha-bem-comprida", nome: "Nova" }),
    });
    expect(db.prepare("SELECT COUNT(*) n FROM usuarios").get().n).toBe(antes);
  });

  it("passado o tempo, a cota volta", async () => {
    r.avancar(3600_000);
    const resposta = await fetch(`${base}/auth/registrar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "depois@ex.com", senha: "senha-bem-comprida", nome: "Depois" }),
    });
    expect(resposta.status).toBe(201);
  });
});
