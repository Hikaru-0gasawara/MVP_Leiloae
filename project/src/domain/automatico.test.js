// Lance automático e prorrogação.
//
// As duas regras que o produto prometia e não cumpria: o teto era guardado sem
// nunca ser usado, e o lance no último segundo vencia por falta de tempo de
// resposta, não por oferecer mais.

import { describe, it, expect } from "vitest";
import {
  resolverAutomatico, encerramentoApos, foiProrrogado,
  JANELA_PRORROGACAO_MS, minBidFor, minIncrementFor,
} from "./auction.js";

const lote = (over = {}) => ({
  id: "lote-1", category: "imovel", minBid: 138000, currentBid: 142500,
  endsAt: Date.now() + 3600e3, ...over,
});

describe("resolverAutomatico — leilão inglês com procuração", () => {
  it("sem tetos, não há lance automático", () => {
    expect(resolverAutomatico(lote(), [])).toBeNull();
    expect(resolverAutomatico(lote(), null)).toBeNull();
  });

  it("um único teto sobe apenas ao lance mínimo, não ao teto", () => {
    // O ponto do mecanismo: revelar um teto alto não custa dinheiro.
    const l = lote();
    const r = resolverAutomatico(l, [{ usuarioId: "ana", limite: 500000, desde: 1 }], "beto");
    expect(r).toEqual({ usuarioId: "ana", valor: minBidFor(l) });
    expect(r.valor).toBeLessThan(500000);
  });

  it("com dois tetos, o maior vence pagando um incremento acima do segundo", () => {
    const l = lote({ currentBid: 142500 }); // incremento da faixa: R$ 1.000
    const r = resolverAutomatico(l, [
      { usuarioId: "ana", limite: 200000, desde: 1 },
      { usuarioId: "beto", limite: 160000, desde: 2 },
    ], "beto");
    expect(r).toEqual({ usuarioId: "ana", valor: 161000 });
  });

  it("o vencedor nunca paga acima do próprio teto", () => {
    const l = lote({ currentBid: 142500 });
    const r = resolverAutomatico(l, [
      { usuarioId: "ana", limite: 160500, desde: 1 },
      { usuarioId: "beto", limite: 160000, desde: 2 },
    ], "beto");
    // Um incremento acima do segundo seria 161.000, acima do teto de Ana.
    expect(r).toEqual({ usuarioId: "ana", valor: 160500 });
  });

  it("empate no teto fica com quem registrou primeiro, sem pagar mais", () => {
    const l = lote({ currentBid: 142500 });
    const r = resolverAutomatico(l, [
      { usuarioId: "ana", limite: 180000, desde: 1 },
      { usuarioId: "beto", limite: 180000, desde: 2 },
    ], null);
    expect(r.usuarioId).toBe("ana");
    expect(r.valor).toBe(180000);
  });

  it("quem já lidera não dá lance contra si mesmo", () => {
    const l = lote({ currentBid: 150000 });
    expect(resolverAutomatico(l, [{ usuarioId: "ana", limite: 200000, desde: 1 }], "ana"))
      .toBeNull();
  });

  it("mas quem lidera é elevado quando aparece um teto maior atrás", () => {
    const l = lote({ currentBid: 150000 });
    const r = resolverAutomatico(l, [
      { usuarioId: "ana", limite: 200000, desde: 1 },
      { usuarioId: "beto", limite: 175000, desde: 2 },
    ], "ana");
    expect(r).toEqual({ usuarioId: "ana", valor: 176000 });
  });

  it("teto que não alcança o lance mínimo não gera lance", () => {
    const l = lote({ currentBid: 142500 }); // mínimo: 143.500
    expect(resolverAutomatico(l, [{ usuarioId: "ana", limite: 143000, desde: 1 }], "beto"))
      .toBeNull();
  });

  it("teto exatamente no mínimo entra", () => {
    const l = lote({ currentBid: 142500 });
    expect(resolverAutomatico(l, [{ usuarioId: "ana", limite: 143500, desde: 1 }], "beto"))
      .toEqual({ usuarioId: "ana", valor: 143500 });
  });

  it("ignora teto inválido em vez de quebrar", () => {
    const l = lote();
    expect(resolverAutomatico(l, [
      { usuarioId: "x", limite: NaN, desde: 1 },
      { usuarioId: "y", limite: 0, desde: 2 },
      null,
    ], null)).toBeNull();
  });

  it("respeita o lance mínimo do edital num lote sem lances", () => {
    const l = lote({ currentBid: 0, minBid: 138000 });
    const r = resolverAutomatico(l, [{ usuarioId: "ana", limite: 500000, desde: 1 }], null);
    expect(r.valor).toBe(138000);
    expect(r.valor).toBeGreaterThanOrEqual(l.minBid);
  });

  it("a disputa converge: aplicar de novo sobre o resultado não gera outro lance", () => {
    const l = lote({ currentBid: 142500 });
    const tetos = [
      { usuarioId: "ana", limite: 200000, desde: 1 },
      { usuarioId: "beto", limite: 160000, desde: 2 },
    ];
    const primeiro = resolverAutomatico(l, tetos, "beto");
    const depois = { ...l, currentBid: primeiro.valor };
    expect(resolverAutomatico(depois, tetos, primeiro.usuarioId)).toBeNull();
  });
});

describe("encerramentoApos — prorrogação anti-sniping", () => {
  const agora = 1_700_000_000_000;

  it("lance longe do fim não move o prazo", () => {
    const fim = agora + 3600e3;
    expect(encerramentoApos({ endsAt: fim }, agora)).toBe(fim);
  });

  it("lance dentro da janela empurra o fim para agora + janela", () => {
    const fim = agora + 30_000; // faltando 30 s
    expect(encerramentoApos({ endsAt: fim }, agora)).toBe(agora + JANELA_PRORROGACAO_MS);
  });

  it("lance exatamente na borda da janela não prorroga", () => {
    const fim = agora + JANELA_PRORROGACAO_MS;
    expect(encerramentoApos({ endsAt: fim }, agora)).toBe(fim);
  });

  it("lote já encerrado não é ressuscitado", () => {
    const fim = agora - 1;
    expect(encerramentoApos({ endsAt: fim }, agora)).toBe(fim);
  });

  it("prorrogações sucessivas continuam empurrando, sempre pela janela", () => {
    let fim = agora + 10_000;
    fim = encerramentoApos({ endsAt: fim }, agora);
    expect(fim).toBe(agora + JANELA_PRORROGACAO_MS);
    // Novo lance 30 s depois, ainda dentro da janela.
    const t2 = agora + 30_000;
    expect(encerramentoApos({ endsAt: fim }, t2)).toBe(t2 + JANELA_PRORROGACAO_MS);
  });

  it("prazo malformado não vira NaN silencioso", () => {
    expect(Number.isFinite(encerramentoApos({ endsAt: undefined }, agora))).toBe(false);
  });

  it("foiProrrogado compara com o horário original", () => {
    expect(foiProrrogado({ endsAt: 200, encerramentoOriginal: 100 })).toBe(true);
    expect(foiProrrogado({ endsAt: 100, encerramentoOriginal: 100 })).toBe(false);
    expect(foiProrrogado({ endsAt: 100 })).toBe(false);
  });
});

describe("as duas regras juntas", () => {
  it("o incremento usado pelo automático é o da faixa do lote", () => {
    const caro = lote({ currentBid: 250000, minBid: 200000 });
    expect(minIncrementFor(caro)).toBe(2000);
    const r = resolverAutomatico(caro, [
      { usuarioId: "ana", limite: 400000, desde: 1 },
      { usuarioId: "beto", limite: 300000, desde: 2 },
    ], "beto");
    expect(r.valor).toBe(302000);
  });
});
