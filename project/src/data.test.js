import { describe, it, expect } from "vitest";
import { LOTS, VENDORS, GLOSSARY } from "./data.js";
import { isEnded, referenceValueOf } from "./domain/auction.js";
import { scheduledEnd, CYCLE_MS, EPOCH } from "./domain/schedule.js";

describe("integridade do catálogo", () => {
  it("mantém os 14 lotes: 8 imóveis e 6 veículos", () => {
    expect(LOTS).toHaveLength(14);
    expect(LOTS.filter((l) => l.category === "imovel")).toHaveLength(8);
    expect(LOTS.filter((l) => l.category === "carro")).toHaveLength(6);
  });

  it("não tem identificadores duplicados", () => {
    expect(new Set(LOTS.map((l) => l.id)).size).toBe(LOTS.length);
  });

  it("todo lote tem os campos que a interface consome", () => {
    for (const lot of LOTS) {
      expect(lot.id, `id de ${lot.title}`).toBeTruthy();
      expect(lot.title).toBeTruthy();
      expect(["imovel", "carro"]).toContain(lot.category);
      expect(Number.isFinite(lot.currentBid)).toBe(true);
      expect(Number.isFinite(lot.minBid)).toBe(true);
      expect(Number.isFinite(lot.bids)).toBe(true);
      expect(Number.isFinite(lot.endsAt)).toBe(true);
      expect(lot.auctionType).toBeTruthy();
      expect(lot.praca).toBeTruthy();
      expect(Array.isArray(lot.docs)).toBe(true);
      expect(lot.rules).toBeTruthy();
      expect(VENDORS[lot.vendor], `vendedor de ${lot.id}`).toBeDefined();
      expect(Array.isArray(lot.photoIds)).toBe(true);
    }
  });

  it("todo lote tem referência de mercado acima do lance atual", () => {
    for (const lot of LOTS) {
      const ref = referenceValueOf(lot);
      expect(ref, `referência de ${lot.id}`).not.toBeNull();
      expect(ref).toBeGreaterThan(lot.currentBid);
    }
  });

  it("veículos têm FIPE e imóveis têm avaliação e área", () => {
    for (const lot of LOTS) {
      if (lot.category === "carro") {
        expect(Number.isFinite(lot.fipe)).toBe(true);
        expect(lot.km).toBeGreaterThan(0);
        expect(lot.transmission).toBeTruthy();
      } else {
        expect(Number.isFinite(lot.appraised)).toBe(true);
        expect(lot.area).toBeGreaterThan(0);
        expect(lot.occupancy).toBeTruthy();
      }
    }
  });

  it("expõe exatamente um lote encerrado, para exercitar esse estado", () => {
    const encerrados = LOTS.filter((l) => isEnded(l));
    expect(encerrados).toHaveLength(1);
    expect(encerrados[0].id).toBe("lot-liberdade-kitnet");
  });

  it("o glossário cobre os termos usados na interface, incluindo veículos", () => {
    for (const termo of ["praça", "ITBI", "comissão do leiloeiro", "ocupação", "edital", "lance mínimo", "carta de arrematação", "FIPE"]) {
      expect(GLOSSARY[termo], termo).toBeTruthy();
    }
  });
});

describe("BIZ-003 — agenda absoluta e estável", () => {
  it("dois carregamentos no mesmo ciclo produzem o mesmo encerramento", () => {
    const t1 = EPOCH + CYCLE_MS * 10 + 1000;
    const t2 = t1 + 60 * 60 * 1000; // uma hora depois, mesmo ciclo
    expect(scheduledEnd(30, t1)).toBe(scheduledEnd(30, t2));
  });

  it("o encerramento é sempre futuro em relação ao instante consultado", () => {
    const agora = EPOCH + CYCLE_MS * 3 + 5 * 3600e3;
    for (const off of [0, 2, 6, 24, 47.9]) {
      expect(scheduledEnd(off, agora)).toBeGreaterThan(agora);
    }
  });

  it("não usa mais prazos relativos ao carregamento", async () => {
    const fonte = await import("node:fs").then((fs) => fs.readFileSync("src/data.js", "utf8"));
    expect(fonte).not.toMatch(/endsAt: Date\.now\(\)/);
  });
});
