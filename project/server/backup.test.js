// Cópia de segurança e retenção (scripts/backup.mjs).
//
// Backup que ninguém testa é fé. O que estes testes provam é o que separa uma
// cópia de um `cp`: que ela abre, que traz os dados, que sobrevive a escrita
// concorrente e que a limpeza não é capaz de apagar tudo.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { abrirBanco, semear } from "./db.js";
import { criarUsuario } from "./auth.js";
import { copiar, conferir, aplicarRetencao } from "../scripts/backup.mjs";
import { scheduledEnd } from "../src/domain/schedule.js";

let pasta;

const LOTES = () => [{
  id: "lote-a", category: "imovel", title: "Studio", appraised: 215000, minBid: 138000,
  currentBid: 142500, bids: 0, endsAt: scheduledEnd(20),
  photoIds: [], docs: [], rules: "", description: "",
}];

beforeEach(() => { pasta = mkdtempSync(join(tmpdir(), "leiloae-backup-")); });
afterEach(() => { rmSync(pasta, { recursive: true, force: true }); });

/** Banco em arquivo, com WAL — o mesmo estado em que o servidor o deixa. */
function bancoEmArquivo() {
  const caminho = join(pasta, "leiloae.db");
  const db = abrirBanco(caminho);
  semear(db, LOTES());
  criarUsuario(db, { email: "ana@ex.com", senha: "senha-bem-comprida", nome: "Ana" });
  return { db, caminho };
}

describe("cópia de segurança", () => {
  it("a cópia abre, passa no integrity_check e traz os dados", () => {
    const { db, caminho } = bancoEmArquivo();
    const destino = join(pasta, "copia.db");
    const r = copiar(caminho, destino);
    db.close();

    expect(r.ok).toBe(true);
    expect(r.bytes).toBeGreaterThan(0);
    expect(r.contagens.usuarios).toBe(1);
    expect(r.contagens.lotes).toBe(1);
  });

  it("copia com o banco aberto e escrevendo — é assim que ela vai rodar", () => {
    const { db, caminho } = bancoEmArquivo();
    // Sem VACUUM INTO, copiar o arquivo com WAL ligado neste exato momento
    // produziria um banco truncado no meio de uma transação.
    criarUsuario(db, { email: "beto@ex.com", senha: "senha-bem-comprida", nome: "Beto" });
    const destino = join(pasta, "durante.db");
    const r = copiar(caminho, destino);
    db.close();
    expect(r.contagens.usuarios).toBe(2);
  });

  it("a cópia é um retrato: escrever depois não a altera", () => {
    const { db, caminho } = bancoEmArquivo();
    const destino = join(pasta, "retrato.db");
    copiar(caminho, destino);
    criarUsuario(db, { email: "depois@ex.com", senha: "senha-bem-comprida", nome: "Depois" });
    db.close();
    expect(conferir(destino).contagens.usuarios).toBe(1);
  });

  it("arquivo que não é banco não passa por cópia boa", () => {
    const falso = join(pasta, "nao-e-banco.db");
    writeFileSync(falso, "isto não é um banco SQLite");
    expect(() => conferir(falso)).toThrow();
  });
});

describe("retenção", () => {
  /** Cria N cópias falsas com idades escolhidas, em dias. */
  const povoar = (idades) => {
    const dir = join(pasta, "backups");
    mkdirSync(dir, { recursive: true });
    idades.forEach((dias, i) => {
      const nome = join(dir, `leiloae-2020-01-${String(i + 1).padStart(2, "0")}T00-00-00-000.db`);
      writeFileSync(nome, "x");
      const em = new Date(Date.now() - dias * 86400000);
      utimesSync(nome, em, em);
    });
    return dir;
  };

  it("apaga o que passou da idade e mantém o resto", () => {
    const dir = povoar([1, 2, 3, 40, 50]);
    const r = aplicarRetencao(dir, { dias: 30, minimo: 2 });
    expect(r.apagadas).toHaveLength(2);
    expect(readdirSync(dir)).toHaveLength(3);
  });

  it("nunca apaga tudo: o mínimo por contagem vence a idade", () => {
    // Todas velhas — um relógio errado ou uma pasta parada há meses.
    const dir = povoar([100, 200, 300, 400]);
    const r = aplicarRetencao(dir, { dias: 30, minimo: 3 });
    expect(r.apagadas).toHaveLength(1);
    expect(readdirSync(dir)).toHaveLength(3);
  });

  it("as preservadas são as mais NOVAS, não as primeiras da pasta", () => {
    const dir = povoar([300, 1, 200]);
    aplicarRetencao(dir, { dias: 30, minimo: 1 });
    const sobraram = readdirSync(dir);
    expect(sobraram).toHaveLength(1);
    // A de 1 dia é a segunda criada (índice 1) — não a primeira do diretório.
    expect(sobraram[0]).toContain("02T00-00-00");
  });

  it("pasta vazia não é erro", () => {
    const dir = join(pasta, "vazia");
    mkdirSync(dir, { recursive: true });
    expect(aplicarRetencao(dir)).toEqual({ total: 0, apagadas: [] });
  });

  it("ignora arquivos que não são cópias nossas", () => {
    const dir = povoar([100, 200]);
    writeFileSync(join(dir, "anotacoes.txt"), "não mexa");
    aplicarRetencao(dir, { dias: 30, minimo: 0 });
    expect(readdirSync(dir)).toEqual(["anotacoes.txt"]);
  });

  it("`aplicar: false` diz o que apagaria sem apagar", () => {
    const dir = povoar([100, 200, 300]);
    const r = aplicarRetencao(dir, { dias: 30, minimo: 0, aplicar: false });
    expect(r.apagadas).toHaveLength(3);
    expect(readdirSync(dir)).toHaveLength(3);
  });
});
