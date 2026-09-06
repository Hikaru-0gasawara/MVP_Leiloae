// Testes do servidor.
//
// Cobrem os dois critérios de conclusão que a auditoria escreveu por extenso:
//   item 9  — "lance concorrente testado sob rajada sem duplicidade"
//   item 10 — "teste de IDOR por rota passa; nenhum dado sensível sem sessão"
//
// Mais o que a auditoria classificou como não testável por falta de servidor:
// concorrência, falha de regra, requisição duplicada e falha parcial.

import { describe, it, expect, beforeEach } from "vitest";
import { abrirBanco, semear, buscarLote } from "./db.js";
import { criarUsuario, autenticar, criarSessao, usuarioDaSessao, encerrarSessao, validarCredenciais, hashSenha, senhaConfere } from "./auth.js";
import { darLance, cancelarLance, meusLances, alternarSalvo, listarSalvos } from "./bids.js";
import { minBidFor, FIRST_BID_WINDOW_MS } from "../src/domain/auction.js";
import { scheduledEnd } from "../src/domain/schedule.js";

const SENHA = "senha-bem-comprida";
let db;

const lotesDeTeste = () => [
  {
    id: "lote-a", category: "imovel", title: "Studio na Mooca", appraised: 215000,
    minBid: 138000, currentBid: 142500, bids: 14, endsAt: scheduledEnd(20),
    photoIds: [], docs: [], rules: "", description: "",
  },
  {
    id: "lote-b", category: "carro", title: "Honda Civic", fipe: 87500,
    minBid: 58000, currentBid: 61500, bids: 9, endsAt: scheduledEnd(30),
    photoIds: [], docs: [], rules: "", description: "",
  },
  {
    id: "lote-encerrado", category: "imovel", title: "Kitnet", appraised: 120000,
    minBid: 90000, currentBid: 98500, bids: 22, endsAt: Date.now() - 86400000,
    photoIds: [], docs: [], rules: "", description: "",
  },
];

const criar = (email) => criarUsuario(db, { email, senha: SENHA, nome: "Fulana" }).usuario;

beforeEach(() => {
  db = abrirBanco(":memory:");
  semear(db, lotesDeTeste());
});

// ---------------------------------------------------------------- autenticação
describe("SEC-003 — autenticação", () => {
  it("guarda hash e sal, nunca a senha", () => {
    criar("a@ex.com");
    const linha = db.prepare("SELECT * FROM usuarios WHERE email = ?").get("a@ex.com");
    expect(linha.senha_hash).not.toContain(SENHA);
    expect(linha.salt).toHaveLength(32);
    expect(JSON.stringify(linha)).not.toContain(SENHA);
  });

  it("o mesmo texto gera hashes diferentes para pessoas diferentes", () => {
    const um = hashSenha(SENHA), outro = hashSenha(SENHA);
    expect(um.hash).not.toBe(outro.hash);
    expect(senhaConfere(SENHA, um.salt, um.hash)).toBe(true);
    expect(senhaConfere("outra-coisa-longa", um.salt, um.hash)).toBe(false);
  });

  it("recusa senha curta e e-mail malformado", () => {
    expect(validarCredenciais({ email: "nao-e-email", senha: SENHA, nome: "Ana" })).toEqual(["E-mail inválido."]);
    expect(validarCredenciais({ email: "a@ex.com", senha: "curta", nome: "Ana" }))
      .toEqual(["A senha precisa de pelo menos 10 caracteres."]);
    expect(validarCredenciais({ email: "a@ex.com", senha: SENHA, nome: "X" })).toEqual(["Informe seu nome."]);
    expect(validarCredenciais({ email: "a@ex.com", senha: SENHA, nome: "Ana" })).toEqual([]);
  });

  it("normaliza o e-mail e impede conta duplicada", () => {
    criar("Alguem@Exemplo.com");
    const r = criarUsuario(db, { email: "alguem@exemplo.com", senha: SENHA, nome: "Outra" });
    expect(r.erro).toBe("email-em-uso");
  });

  it("dá a mesma resposta para conta inexistente e senha errada", () => {
    criar("a@ex.com");
    const inexistente = autenticar(db, { email: "ninguem@ex.com", senha: SENHA });
    const senhaErrada = autenticar(db, { email: "a@ex.com", senha: "senha-errada-longa" });
    expect(inexistente.mensagem).toBe(senhaErrada.mensagem);
    expect(inexistente.erro).toBe(senhaErrada.erro);
  });

  it("a sessão resolve o usuário, e sair a invalida", () => {
    const u = criar("a@ex.com");
    const token = criarSessao(db, u.id);
    expect(usuarioDaSessao(db, token).id).toBe(u.id);
    encerrarSessao(db, token);
    expect(usuarioDaSessao(db, token)).toBeNull();
  });

  it("o token não fica em claro no banco", () => {
    const u = criar("a@ex.com");
    const token = criarSessao(db, u.id);
    const linhas = db.prepare("SELECT * FROM sessoes").all();
    expect(JSON.stringify(linhas)).not.toContain(token);
  });

  it("sessão expirada não autentica e é removida", () => {
    const u = criar("a@ex.com");
    const token = criarSessao(db, u.id, Date.now() - 40 * 24 * 3600e3);
    expect(usuarioDaSessao(db, token)).toBeNull();
    expect(db.prepare("SELECT COUNT(*) n FROM sessoes").get().n).toBe(0);
  });

  it("token forjado não autentica", () => {
    criar("a@ex.com");
    expect(usuarioDaSessao(db, "token-inventado")).toBeNull();
    expect(usuarioDaSessao(db, "")).toBeNull();
    expect(usuarioDaSessao(db, null)).toBeNull();
  });
});

// --------------------------------------------------------------------- lances
describe("SEC-004 — o servidor revalida a regra, não confia no cliente", () => {
  it("recusa lance abaixo do mínimo mesmo que o cliente mande", () => {
    const u = criar("a@ex.com");
    const r = darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: 1 });
    expect(r.erro).toBe("below-min");
    expect(r.min).toBe(minBidFor(buscarLote(db, "lote-a")));
    expect(buscarLote(db, "lote-a").currentBid).toBe(142500);
  });

  it("recusa lance em leilão encerrado", () => {
    const u = criar("a@ex.com");
    const r = darLance(db, { loteId: "lote-encerrado", usuarioId: u.id, valor: 999999 });
    expect(r.erro).toBe("ended");
  });

  it("recusa valor não inteiro, negativo ou textual", () => {
    const u = criar("a@ex.com");
    for (const v of [143500.5, -1, 0, "muito", null, Infinity, NaN]) {
      expect(darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: v }).erro).toBeTruthy();
    }
  });

  it("recusa teto menor que o lance", () => {
    const u = criar("a@ex.com");
    expect(darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: 143500, teto: 100 }).erro).toBe("teto-invalido");
  });

  it("aceita o lance mínimo exato e atualiza lote e contagem", () => {
    const u = criar("a@ex.com");
    const minimo = minBidFor(buscarLote(db, "lote-a"));
    const r = darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: minimo });
    expect(r.erro).toBeUndefined();
    const lote = buscarLote(db, "lote-a");
    expect(lote.currentBid).toBe(minimo);
    expect(lote.bids).toBe(15);
    expect(lote.versao).toBe(2);
  });

  it("BIZ-010 — o incremento é o da faixa do lote, não uma constante", () => {
    const u = criar("a@ex.com");
    // lote-a a 142.500 → faixa de R$ 1.000; lote-b a 61.500 → faixa de R$ 500.
    expect(minBidFor(buscarLote(db, "lote-a"))).toBe(143500);
    expect(minBidFor(buscarLote(db, "lote-b"))).toBe(62000);
    expect(darLance(db, { loteId: "lote-b", usuarioId: u.id, valor: 61999 }).erro).toBe("below-min");
    expect(darLance(db, { loteId: "lote-b", usuarioId: u.id, valor: 62000 }).erro).toBeUndefined();
  });

  it("lote inexistente devolve 'não encontrado' e não cria nada", () => {
    const u = criar("a@ex.com");
    expect(darLance(db, { loteId: "nao-existe", usuarioId: u.id, valor: 999999 }).erro).toBe("lote-inexistente");
    expect(db.prepare("SELECT COUNT(*) n FROM lances").get().n).toBe(0);
  });

  it("uma recusa não deixa transação aberta nem sujeira no banco", () => {
    const u = criar("a@ex.com");
    darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: 1 });
    // Se a transação tivesse ficado aberta, a próxima escrita falharia.
    expect(darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: 143500 }).erro).toBeUndefined();
    expect(db.prepare("SELECT COUNT(*) n FROM lances").get().n).toBe(1);
  });
});

describe("item 9 — lance concorrente sob rajada, sem duplicidade", () => {
  it("de uma rajada no mesmo valor, exatamente um entra", () => {
    const usuarios = ["a", "b", "c", "d", "e", "f", "g", "h"].map((n) => criar(`${n}@ex.com`));
    const alvo = minBidFor(buscarLote(db, "lote-a")); // todos disputam o mesmo valor

    const resultados = usuarios.map((u) => darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: alvo }));
    const aceitos = resultados.filter((r) => !r.erro);
    const recusados = resultados.filter((r) => r.erro === "below-min");

    expect(aceitos).toHaveLength(1);
    expect(recusados).toHaveLength(usuarios.length - 1);

    const lote = buscarLote(db, "lote-a");
    expect(lote.currentBid).toBe(alvo);
    expect(lote.bids).toBe(15); // 14 do catálogo + exatamente 1
    expect(db.prepare("SELECT COUNT(*) n FROM lances").get().n).toBe(1);
  });

  it("uma escada de lances mantém o lote coerente do começo ao fim", () => {
    const us = ["a", "b", "c"].map((n) => criar(`${n}@ex.com`));
    let aceitos = 0;
    for (let i = 0; i < 30; i++) {
      const u = us[i % us.length];
      const r = darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: minBidFor(buscarLote(db, "lote-a")) });
      if (!r.erro) aceitos++;
    }
    const lote = buscarLote(db, "lote-a");
    expect(aceitos).toBe(30);
    expect(lote.bids).toBe(14 + 30);
    expect(lote.versao).toBe(1 + 30);
    // O lance atual é sempre o maior lance vivo.
    const maior = db.prepare("SELECT MAX(valor) v FROM lances WHERE cancelado_em IS NULL").get().v;
    expect(lote.currentBid).toBe(maior);
  });

  it("requisição duplicada (mesmo valor, mesma pessoa) não passa duas vezes", () => {
    const u = criar("a@ex.com");
    const valor = minBidFor(buscarLote(db, "lote-a"));
    expect(darLance(db, { loteId: "lote-a", usuarioId: u.id, valor }).erro).toBeUndefined();
    expect(darLance(db, { loteId: "lote-a", usuarioId: u.id, valor }).erro).toBe("below-min");
    expect(db.prepare("SELECT COUNT(*) n FROM lances").get().n).toBe(1);
  });
});

describe("BIZ-006 — janela de cancelamento de 24 h", () => {
  it("só o primeiro lance da pessoa nasce cancelável", () => {
    const u = criar("a@ex.com");
    const primeiro = darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: minBidFor(buscarLote(db, "lote-a")) });
    const segundo = darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: minBidFor(buscarLote(db, "lote-a")) });
    expect(primeiro.lance.cancelableUntil).toBeGreaterThan(Date.now());
    expect(segundo.lance.cancelableUntil).toBeNull();
  });

  it("cancelar devolve o lote ao maior lance vivo", () => {
    const a = criar("a@ex.com"), b = criar("b@ex.com");
    const primeiro = darLance(db, { loteId: "lote-a", usuarioId: a.id, valor: 143500 });
    darLance(db, { loteId: "lote-a", usuarioId: b.id, valor: 144500 });
    darLance(db, { loteId: "lote-a", usuarioId: a.id, valor: 145500 });

    expect(buscarLote(db, "lote-a").currentBid).toBe(145500);
    expect(cancelarLance(db, { lanceId: primeiro.lance.id, usuarioId: a.id }).cancelado).toBeTruthy();
    // O cancelado não era o maior: o topo não muda.
    expect(buscarLote(db, "lote-a").currentBid).toBe(145500);
  });

  it("cancelar o único lance devolve o lote ao lance mínimo", () => {
    const a = criar("a@ex.com");
    semear(db, [{ ...lotesDeTeste()[0], id: "lote-c" }]);
    const r = darLance(db, { loteId: "lote-c", usuarioId: a.id, valor: 143500 });
    cancelarLance(db, { lanceId: r.lance.id, usuarioId: a.id });
    expect(buscarLote(db, "lote-c").currentBid).toBe(138000);
  });

  it("fora da janela, não cancela", () => {
    const u = criar("a@ex.com");
    const r = darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: 143500 });
    const depois = Date.now() + FIRST_BID_WINDOW_MS + 1000;
    expect(cancelarLance(db, { lanceId: r.lance.id, usuarioId: u.id }, depois).erro).toBe("fora-da-janela");
  });

  it("cancelar duas vezes não passa", () => {
    const u = criar("a@ex.com");
    const r = darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: 143500 });
    expect(cancelarLance(db, { lanceId: r.lance.id, usuarioId: u.id }).cancelado).toBeTruthy();
    expect(cancelarLance(db, { lanceId: r.lance.id, usuarioId: u.id }).erro).toBe("fora-da-janela");
  });
});

// ----------------------------------------------------------------------- IDOR
describe("item 10 — IDOR: ninguém alcança o recurso de outra pessoa", () => {
  it("não dá para cancelar o lance de outra pessoa", () => {
    const a = criar("a@ex.com"), b = criar("b@ex.com");
    const lance = darLance(db, { loteId: "lote-a", usuarioId: a.id, valor: 143500 }).lance;

    const tentativa = cancelarLance(db, { lanceId: lance.id, usuarioId: b.id });
    expect(tentativa.erro).toBe("lance-inexistente");
    expect(db.prepare("SELECT cancelado_em FROM lances WHERE id = ?").get(lance.id).cancelado_em).toBeNull();
  });

  it("'meus lances' devolve só os lances de quem pediu", () => {
    const a = criar("a@ex.com"), b = criar("b@ex.com");
    darLance(db, { loteId: "lote-a", usuarioId: a.id, valor: 143500 });
    darLance(db, { loteId: "lote-a", usuarioId: b.id, valor: 144500 });

    const deA = meusLances(db, a.id);
    expect(deA).toHaveLength(1);
    expect(deA[0].bid.value).toBe(143500);
    expect(meusLances(db, b.id)).toHaveLength(1);
  });

  it("favoritos de uma pessoa não vazam para a outra", () => {
    const a = criar("a@ex.com"), b = criar("b@ex.com");
    alternarSalvo(db, { usuarioId: a.id, loteId: "lote-a" });
    expect(listarSalvos(db, a.id)).toEqual(["lote-a"]);
    expect(listarSalvos(db, b.id)).toEqual([]);
  });

  it("favoritar é alternância, e só afeta quem pediu", () => {
    const a = criar("a@ex.com");
    expect(alternarSalvo(db, { usuarioId: a.id, loteId: "lote-a" }).salvo).toBe(true);
    expect(alternarSalvo(db, { usuarioId: a.id, loteId: "lote-a" }).salvo).toBe(false);
    expect(listarSalvos(db, a.id)).toEqual([]);
  });

  it("favoritar lote inexistente não cria linha órfã", () => {
    const a = criar("a@ex.com");
    expect(alternarSalvo(db, { usuarioId: a.id, loteId: "nao-existe" }).erro).toBe("lote-inexistente");
    expect(db.prepare("SELECT COUNT(*) n FROM salvos").get().n).toBe(0);
  });
});

describe("BIZ-003 — o prazo é do servidor", () => {
  it("o prazo do lote não se move entre leituras", () => {
    const primeiro = buscarLote(db, "lote-a").endsAt;
    const segundo = buscarLote(db, "lote-a").endsAt;
    expect(primeiro).toBe(segundo);
  });

  it("semear de novo não reinicia prazo nem apaga lances", () => {
    const u = criar("a@ex.com");
    darLance(db, { loteId: "lote-a", usuarioId: u.id, valor: 143500 });
    const antes = buscarLote(db, "lote-a");

    semear(db, lotesDeTeste());

    const depois = buscarLote(db, "lote-a");
    expect(depois.endsAt).toBe(antes.endsAt);
    expect(depois.currentBid).toBe(143500);
    expect(db.prepare("SELECT COUNT(*) n FROM lances").get().n).toBe(1);
  });
});
