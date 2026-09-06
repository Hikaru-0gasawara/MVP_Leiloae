// Item 9 — "lance concorrente testado sob rajada sem duplicidade".
//
// O teste em `server.test.js` prova a LÓGICA (releitura dentro da transação).
// Este prova o comportamento sob CONTENÇÃO REAL: várias conexões distintas
// disputando o mesmo arquivo de banco ao mesmo tempo. Sem isso a garantia
// seria só um efeito colateral de `node:sqlite` ser síncrono.
//
// Se a transação fosse trocada por "lê, valida, escreve" sem `BEGIN IMMEDIATE`,
// é aqui que dois lances de mesmo valor entrariam.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Worker } from "node:worker_threads";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { abrirBanco, semear, buscarLote } from "./db.js";
import { criarUsuario } from "./auth.js";
import { minBidFor } from "../src/domain/auction.js";
import { scheduledEnd } from "../src/domain/schedule.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const WORKER = join(AQUI, "concorrencia.worker.mjs");

let pasta, caminhoDb, db;

const LOTE = {
  id: "lote-disputado", category: "imovel", title: "Studio", appraised: 215000,
  minBid: 138000, currentBid: 142500, bids: 14, endsAt: scheduledEnd(20),
  photoIds: [], docs: [], rules: "", description: "",
};

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), "leiloae-"));
  caminhoDb = join(pasta, "teste.db");
  db = abrirBanco(caminhoDb);
  semear(db, [LOTE]);
});

afterEach(() => {
  try { db.close(); } catch { /* já fechado */ }
  rmSync(pasta, { recursive: true, force: true });
});

const correr = (workers) =>
  Promise.all(workers.map((workerData) => new Promise((resolve, reject) => {
    const w = new Worker(WORKER, { workerData });
    w.on("message", resolve);
    w.on("error", reject);
  })));

describe("rajada com conexões concorrentes de verdade", () => {
  it("no mesmo valor, exatamente um lance entra — os outros são recusados", async () => {
    const alvo = minBidFor(buscarLote(db, "lote-disputado"));
    const usuarios = Array.from({ length: 8 }, (_, i) =>
      criarUsuario(db, { email: `d${i}@ex.com`, senha: "senha-bem-comprida", nome: "Disputante" }).usuario);

    const resultados = await correr(usuarios.map((u) => ({
      caminhoDb, usuarioId: u.id, loteId: "lote-disputado", tentativas: 1, valorFixo: alvo,
    })));

    const aceitos = resultados.flatMap((r) => r.aceitos);
    expect(aceitos).toEqual([alvo]);

    const lote = buscarLote(db, "lote-disputado");
    expect(lote.currentBid).toBe(alvo);
    expect(lote.bids).toBe(15);
    expect(db.prepare("SELECT COUNT(*) n FROM lances").get().n).toBe(1);
  }, 30000);

  it("rajada longa: o lote termina coerente e sem lance perdido nem duplicado", async () => {
    const usuarios = Array.from({ length: 6 }, (_, i) =>
      criarUsuario(db, { email: `r${i}@ex.com`, senha: "senha-bem-comprida", nome: "Disputante" }).usuario);

    // Cada worker sempre pede o mínimo do momento: máxima contenção.
    const resultados = await correr(usuarios.map((u) => ({
      caminhoDb, usuarioId: u.id, loteId: "lote-disputado", tentativas: 25, valorFixo: null,
    })));

    const aceitos = resultados.flatMap((r) => r.aceitos);
    const lote = buscarLote(db, "lote-disputado");
    const linhas = db.prepare("SELECT valor FROM lances ORDER BY valor").all().map((r) => r.valor);

    // 1. Nenhum lance registrado a mais nem a menos do que os aceitos.
    expect(linhas).toHaveLength(aceitos.length);
    // 2. Nenhum valor repetido: dois lances iguais seriam a duplicidade temida.
    expect(new Set(linhas).size).toBe(linhas.length);
    // 3. O lote reflete exatamente o maior lance vivo e a contagem certa.
    expect(lote.currentBid).toBe(Math.max(...linhas));
    expect(lote.bids).toBe(14 + linhas.length);
    expect(lote.versao).toBe(1 + linhas.length);
    // 4. Houve disputa de fato — senão o teste não provaria nada.
    expect(aceitos.length).toBeGreaterThan(10);
    expect(resultados.every((r) => r.aceitos.length > 0)).toBe(true);
    // 5. Nenhuma exceção escapou: recusa é regra de negócio, não erro.
    const excecoes = resultados.flatMap((r) => r.recusados).filter((m) => String(m).startsWith("excecao:"));
    expect(excecoes).toEqual([]);
  }, 60000);
});
