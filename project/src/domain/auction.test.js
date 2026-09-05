import { describe, it, expect } from "vitest";
import {
  simulateCost, isEnded, minIncrementFor, minBidFor, incrementOptionsFor,
  discountPct, validateBid, isCancelable, bidStatus, timeLeft, formatBRL, RATES,
} from "./auction.js";

const imovel = (over = {}) => ({ id: "i1", category: "imovel", currentBid: 142500, appraised: 215000, minBid: 138000, endsAt: Date.now() + 3600e3, ...over });
const carro = (over = {}) => ({ id: "c1", category: "carro", currentBid: 61500, fipe: 87500, minBid: 58000, endsAt: Date.now() + 3600e3, ...over });

describe("simulateCost — BIZ-008: as linhas exibidas somam exatamente o total", () => {
  it("soma das linhas é igual ao total (imóvel)", () => {
    const r = simulateCost(142500, "imovel");
    const soma = r.lines.reduce((s, l) => s + l.value, 0);
    expect(soma).toBeCloseTo(r.total, 2);
  });

  it("soma das linhas é igual ao total (veículo)", () => {
    const r = simulateCost(61500, "carro");
    const soma = r.lines.reduce((s, l) => s + l.value, 0);
    expect(soma).toBeCloseTo(r.total, 2);
  });

  it("expõe a Taxa Leiloaê de 1,5% como linha visível", () => {
    const r = simulateCost(142500, "imovel");
    const taxa = r.lines.find((l) => l.key === "taxa");
    expect(taxa).toBeDefined();
    expect(taxa.value).toBeCloseTo(142500 * RATES.taxa, 2);
    expect(taxa.label).toContain("1,5%");
  });

  it("regressão do valor exato apontado na auditoria", () => {
    // Antes: linhas somavam 156.700 e o total exibido era 158.837,50.
    const r = simulateCost(142500, "imovel");
    expect(r.total).toBeCloseTo(158837.5, 2);
    expect(r.lines.reduce((s, l) => s + l.value, 0)).toBeCloseTo(158837.5, 2);
  });
});

describe("simulateCost — BIZ-007: ITBI só incide sobre imóvel", () => {
  it("não cobra ITBI de veículo", () => {
    const r = simulateCost(61500, "carro");
    expect(r.itbi).toBe(0);
    expect(r.lines.some((l) => l.key === "itbi")).toBe(false);
  });

  it("cobra ITBI de imóvel", () => {
    const r = simulateCost(142500, "imovel");
    expect(r.itbi).toBeCloseTo(142500 * RATES.itbi, 2);
  });

  it("o mesmo veículo tem o mesmo custo em qualquer tela", () => {
    expect(simulateCost(61500, "carro").total).toBe(simulateCost(61500, "carro").total);
  });

  it("trata entradas inválidas sem quebrar", () => {
    for (const v of [0, -1, NaN, null, undefined, ""]) {
      const r = simulateCost(v, "imovel");
      expect(r.total).toBe(0);
      expect(r.lines).toEqual([]);
    }
  });
});

describe("isEnded / validateBid — BIZ-002: lance em leilão encerrado", () => {
  const agora = 1_000_000_000_000;

  it("reconhece leilão encerrado", () => {
    expect(isEnded(imovel({ endsAt: agora - 1 }), agora)).toBe(true);
    expect(isEnded(imovel({ endsAt: agora + 1 }), agora)).toBe(false);
    expect(isEnded(imovel({ endsAt: agora }), agora)).toBe(true); // limite: fecha no instante
  });

  it("rejeita lance em lote encerrado, por maior que seja o valor", () => {
    const lote = imovel({ endsAt: agora - 1000 });
    const r = validateBid(lote, 999_999, agora);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("ended");
  });

  it("rejeita lance abaixo do mínimo", () => {
    const lote = imovel({ currentBid: 142500, endsAt: agora + 60e3 });
    expect(validateBid(lote, 142600, agora).ok).toBe(false);
    expect(validateBid(lote, minBidFor(lote), agora).ok).toBe(true);
  });

  it("rejeita valores inválidos", () => {
    const lote = imovel({ endsAt: agora + 60e3 });
    for (const v of [0, -5, NaN, null, "abc"]) {
      expect(validateBid(lote, v, agora).ok).toBe(false);
    }
  });

  it("rejeita lote inexistente", () => {
    expect(validateBid(null, 1000, agora).ok).toBe(false);
  });
});

describe("incremento — BIZ-010: por faixa do lote, não constante", () => {
  it("escala com o valor do lote", () => {
    expect(minIncrementFor({ currentBid: 30000 })).toBe(250);
    expect(minIncrementFor({ currentBid: 61500 })).toBe(500);
    expect(minIncrementFor({ currentBid: 142500 })).toBe(1000);
    expect(minIncrementFor({ currentBid: 215000 })).toBe(2000);
  });

  it("respeita incremento explícito do lote quando houver", () => {
    expect(minIncrementFor({ currentBid: 142500, minIncrement: 5000 })).toBe(5000);
  });

  it("as sugestões de incremento derivam do lote", () => {
    expect(incrementOptionsFor({ currentBid: 142500 })).toEqual([1000, 2000, 4000, 10000]);
  });

  it("lance mínimo respeita o piso do edital", () => {
    expect(minBidFor({ currentBid: 100, minBid: 138000 })).toBe(138000);
  });
});

describe("discountPct — BIZ-009: sem desconto inventado", () => {
  it("calcula desconto real", () => {
    expect(discountPct(imovel({ currentBid: 142500, appraised: 215000 }))).toBe(34);
  });

  it("usa FIPE para veículo", () => {
    expect(discountPct(carro({ currentBid: 61500, fipe: 87500 }))).toBe(30);
  });

  it("devolve null quando o lance supera a referência", () => {
    expect(discountPct(imovel({ currentBid: 250000, appraised: 215000 }))).toBeNull();
  });

  it("devolve null sem referência válida", () => {
    expect(discountPct(imovel({ appraised: undefined }))).toBeNull();
    expect(discountPct(imovel({ appraised: 0 }))).toBeNull();
  });
});

describe("proteção de primeiro lance — BIZ-006", () => {
  const agora = 2_000_000_000_000;

  it("é cancelável dentro da janela", () => {
    expect(isCancelable({ cancelableUntil: agora + 1000 }, agora)).toBe(true);
  });

  it("deixa de ser cancelável após a janela", () => {
    expect(isCancelable({ cancelableUntil: agora - 1 }, agora)).toBe(false);
  });

  it("lance já cancelado não é cancelável de novo", () => {
    expect(isCancelable({ cancelableUntil: agora + 1000, canceled: true }, agora)).toBe(false);
  });

  it("lance sem janela não é cancelável", () => {
    expect(isCancelable({}, agora)).toBe(false);
  });
});

describe("bidStatus", () => {
  const agora = 3_000_000_000_000;

  it("ganhando enquanto for o maior e o leilão estiver aberto", () => {
    const lote = imovel({ currentBid: 150000, endsAt: agora + 60e3 });
    expect(bidStatus({ value: 150000 }, lote, agora)).toBe("winning");
  });

  it("superado quando outro lance passou o meu", () => {
    const lote = imovel({ currentBid: 160000, endsAt: agora + 60e3 });
    expect(bidStatus({ value: 150000 }, lote, agora)).toBe("outbid");
  });

  it("arrematado quando encerra sendo o maior", () => {
    const lote = imovel({ currentBid: 150000, endsAt: agora - 1 });
    expect(bidStatus({ value: 150000 }, lote, agora)).toBe("won");
  });

  it("perdido quando encerra sem ser o maior", () => {
    const lote = imovel({ currentBid: 160000, endsAt: agora - 1 });
    expect(bidStatus({ value: 150000 }, lote, agora)).toBe("lost");
  });

  it("cancelado prevalece sobre qualquer outro estado", () => {
    const lote = imovel({ currentBid: 150000, endsAt: agora - 1 });
    expect(bidStatus({ value: 150000, canceled: true }, lote, agora)).toBe("canceled");
  });
});

describe("timeLeft e formatação", () => {
  it("marca encerrado em zero e negativo", () => {
    expect(timeLeft(0).ended).toBe(true);
    expect(timeLeft(-5000).ended).toBe(true);
  });

  it("marca como quente abaixo de 1 hora", () => {
    expect(timeLeft(59 * 60e3).hot).toBe(true);
    expect(timeLeft(61 * 60e3).hot).toBe(false);
  });

  it("formata dias, horas e minutos", () => {
    expect(timeLeft(26 * 3600e3).text).toBe("1d 2h 0min");
    expect(timeLeft(90e3).text).toBe("1min 30s");
  });

  it("formata moeda em pt-BR e trata valores inválidos", () => {
    expect(formatBRL(1234.5)).toContain("1.235");
    expect(formatBRL(null)).toBe("—");
    expect(formatBRL(NaN)).toBe("—");
  });
});
