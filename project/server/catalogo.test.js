// Paginação do catálogo e histórico público de lances — as outras duas
// pendências de docs/api.md que dependiam só de código.
//
// A paginação é por CHAVE e não por OFFSET porque o catálogo é ordenado pelo
// prazo de encerramento, e a prorrogação move um lote de lugar no meio da
// leitura. Com OFFSET, o lote que anda para frente aparece duas vezes e o que
// anda para trás some — e o teste "prorrogar no meio da paginação" abaixo é
// exatamente esse caso.

import { describe, it, expect, beforeEach } from "vitest";
import { abrirBanco, semear, listarLotes, historicoDoLote } from "./db.js";
import { criarUsuario } from "./auth.js";
import { darLance, cancelarLance } from "./bids.js";
import { scheduledEnd } from "../src/domain/schedule.js";
import { minBidFor } from "../src/domain/auction.js";

let db;

const LOTES = () =>
  [...Array(7)].map((_, i) => ({
    id: `lote-${i}`, category: "imovel", title: `Lote ${i}`,
    appraised: 200000, minBid: 100000, currentBid: 100000 + i, bids: 0,
    endsAt: scheduledEnd(20 + i * 3),
    photoIds: [], docs: [], rules: "", description: "",
  }));

beforeEach(() => {
  db = abrirBanco(":memory:");
  semear(db, LOTES());
});

const paginarTudo = (limite) => {
  const vistos = [];
  let cursor = null;
  let voltas = 0;
  do {
    const pagina = listarLotes(db, { limite, cursor });
    vistos.push(...pagina.lotes.map((l) => l.id));
    cursor = pagina.proximo;
  } while (cursor && ++voltas < 50);
  return vistos;
};

describe("paginação do catálogo", () => {
  it("sem limite responde o catálogo inteiro, como na 1.1", () => {
    const r = listarLotes(db);
    expect(r.lotes).toHaveLength(7);
    expect(r.proximo).toBeNull();
    expect(r.total).toBe(7);
  });

  it("percorre o catálogo inteiro, sem repetir nem pular", () => {
    const vistos = paginarTudo(3);
    expect(vistos).toHaveLength(7);
    expect(new Set(vistos).size).toBe(7);
  });

  it("a última página não anuncia uma página seguinte", () => {
    let cursor = null;
    let pagina;
    do {
      pagina = listarLotes(db, { limite: 3, cursor });
      cursor = pagina.proximo;
    } while (cursor);
    expect(pagina.lotes.length).toBeGreaterThan(0);
    expect(pagina.proximo).toBeNull();
  });

  it("página do tamanho exato do catálogo não promete mais nada", () => {
    const r = listarLotes(db, { limite: 7 });
    expect(r.lotes).toHaveLength(7);
    expect(r.proximo).toBeNull();
  });

  it("prorrogar um lote no meio da leitura não duplica nem some com ninguém", () => {
    const primeira = listarLotes(db, { limite: 3 });
    // O primeiro lote da página 1 é empurrado para o fim da fila — é o que a
    // prorrogação faz de verdade quando alguém dá lance nos últimos 2 min.
    db.prepare("UPDATE lotes SET encerra_em = ? WHERE id = ?")
      .run(scheduledEnd(200), primeira.lotes[0].id);

    const vistos = [...primeira.lotes.map((l) => l.id)];
    let cursor = primeira.proximo;
    while (cursor) {
      const p = listarLotes(db, { limite: 3, cursor });
      vistos.push(...p.lotes.map((l) => l.id));
      cursor = p.proximo;
    }
    // O prorrogado já tinha sido entregue; ninguém aparece duas vezes, e os
    // outros seis continuam todos lá.
    expect(new Set(vistos).size).toBe(vistos.length);
    expect(new Set(vistos).size).toBe(7);
  });

  it("cursor corrompido não derruba a listagem — começa do início", () => {
    const r = listarLotes(db, { limite: 3, cursor: "não-é-um-cursor" });
    expect(r.lotes).toHaveLength(3);
    expect(r.lotes[0].id).toBe(listarLotes(db, { limite: 3 }).lotes[0].id);
  });

  it("o cursor não entrega estrutura interna do banco", () => {
    const { proximo } = listarLotes(db, { limite: 2 });
    expect(proximo).not.toMatch(/select|from|lotes/i);
  });
});

describe("histórico público de lances", () => {
  const pessoa = (email) => criarUsuario(db, { email, senha: "senha-bem-comprida", nome: email }).usuario;

  /** Dá o menor lance válido do momento — o valor exato não importa aqui. */
  const lancar = (loteId, usuarioId, extra = {}) => {
    const lote = listarLotes(db).lotes.find((l) => l.id === loteId);
    const r = darLance(db, { loteId, usuarioId, valor: minBidFor(lote), ...extra });
    expect(r.lance, JSON.stringify(r)).toBeTruthy();
    return r;
  };

  it("lista os lances do mais recente para o mais antigo", () => {
    const ana = pessoa("ana@ex.com");
    const beto = pessoa("beto@ex.com");
    const lote = listarLotes(db).lotes[0];

    const primeiro = lancar(lote.id, ana.id);
    const segundo = lancar(lote.id, beto.id);

    const h = historicoDoLote(db, lote.id);
    expect(h).toHaveLength(2);
    expect(h[0].valor).toBe(segundo.lance.value);
    expect(h[1].valor).toBe(primeiro.lance.value);
    expect(h[0].em).toBeGreaterThanOrEqual(h[1].em);
  });

  it("ninguém é identificado: só 'Participante N', estável dentro do lote", () => {
    const ana = pessoa("ana@ex.com");
    const beto = pessoa("beto@ex.com");
    const lote = listarLotes(db).lotes[0];

    lancar(lote.id, ana.id);
    lancar(lote.id, beto.id);
    lancar(lote.id, ana.id);

    const h = historicoDoLote(db, lote.id);
    const texto = JSON.stringify(h);
    expect(texto).not.toContain("ana@ex.com");
    expect(texto).not.toContain(ana.id);
    expect(texto).not.toContain(beto.id);
    // Ana deu o 1º e o 3º lance: o mesmo apelido nos dois.
    expect(h[0].participante).toBe(h[2].participante);
    expect(h[1].participante).not.toBe(h[0].participante);
  });

  it("o apelido não atravessa lotes — dois históricos não se cruzam", () => {
    const ana = pessoa("ana@ex.com");
    const beto = pessoa("beto@ex.com");
    const [a, b] = listarLotes(db).lotes;

    lancar(a.id, ana.id);
    lancar(b.id, beto.id);

    // Ambos são "Participante 1" no seu próprio lote: o número é do lote, não
    // da pessoa, então cruzar os dois históricos não reconstrói ninguém.
    expect(historicoDoLote(db, a.id)[0].participante).toBe("Participante 1");
    expect(historicoDoLote(db, b.id)[0].participante).toBe("Participante 1");
  });

  it("não expõe o teto — é com ele que se ganha do outro", () => {
    const ana = pessoa("ana@ex.com");
    const lote = listarLotes(db).lotes[0];
    lancar(lote.id, ana.id, { teto: 500000 });

    const h = historicoDoLote(db, lote.id);
    expect(JSON.stringify(h)).not.toContain("500000");
    expect(h[0]).not.toHaveProperty("teto");
  });

  it("lance cancelado aparece marcado, não sumido", () => {
    const ana = pessoa("ana@ex.com");
    const lote = listarLotes(db).lotes[0];
    const r = lancar(lote.id, ana.id);
    expect(cancelarLance(db, { lanceId: r.lance.id, usuarioId: ana.id }).cancelado).toBeTruthy();

    const h = historicoDoLote(db, lote.id);
    expect(h).toHaveLength(1);
    expect(h[0].cancelado).toBe(true);
  });

  it("o lance automático vem marcado como automático", () => {
    const ana = pessoa("ana@ex.com");
    const beto = pessoa("beto@ex.com");
    const lote = listarLotes(db).lotes[0];
    lancar(lote.id, ana.id, { teto: 200000 });
    lancar(lote.id, beto.id);

    const h = historicoDoLote(db, lote.id);
    expect(h.some((l) => l.automatico)).toBe(true);
  });

  it("lote sem lance nenhum devolve lista vazia, não erro", () => {
    expect(historicoDoLote(db, listarLotes(db).lotes[3].id)).toEqual([]);
  });
});
