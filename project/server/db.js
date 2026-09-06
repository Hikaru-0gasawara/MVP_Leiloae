// Banco de dados (DB-001).
//
// SQLite pelo módulo embutido `node:sqlite`: transações de verdade, sem
// nenhuma dependência nova. Todo acesso ao banco passa por aqui — trocar por
// Postgres depois é reescrever este arquivo, não a aplicação.
//
// Dinheiro é INTEIRO em reais. O catálogo, o edital e os incrementos (250, 500,
// 1000, 2000) trabalham em reais cheios; ponto flutuante não entra em nenhuma
// coluna de valor.
//
// Nota: `node:sqlite` é experimental no Node 22. O acesso está isolado neste
// módulo justamente para que a troca por outro driver seja local.

import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { LOTS } from "../src/data.js";

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS usuarios (
     id          TEXT PRIMARY KEY,
     email       TEXT NOT NULL UNIQUE,
     nome        TEXT NOT NULL,
     senha_hash  TEXT NOT NULL,
     salt        TEXT NOT NULL,
     criado_em   INTEGER NOT NULL
   )`,
  // O token nunca é guardado em claro: vazamento do banco não vira sessão viva.
  `CREATE TABLE IF NOT EXISTS sessoes (
     token_hash  TEXT PRIMARY KEY,
     usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
     criado_em   INTEGER NOT NULL,
     expira_em   INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id)`,
  // `estatico` guarda os campos descritivos do lote (endereço, fotos, edital).
  // O que o leilão altera — lance atual, contagem, prazo — tem coluna própria.
  `CREATE TABLE IF NOT EXISTS lotes (
     id           TEXT PRIMARY KEY,
     categoria    TEXT NOT NULL,
     estatico     TEXT NOT NULL,
     lance_minimo INTEGER NOT NULL,
     lance_atual  INTEGER NOT NULL,
     lances       INTEGER NOT NULL DEFAULT 0,
     encerra_em   INTEGER NOT NULL,
     versao       INTEGER NOT NULL DEFAULT 1
   )`,
  `CREATE TABLE IF NOT EXISTS lances (
     id             TEXT PRIMARY KEY,
     lote_id        TEXT NOT NULL REFERENCES lotes(id),
     usuario_id     TEXT NOT NULL REFERENCES usuarios(id),
     valor          INTEGER NOT NULL,
     teto           INTEGER,
     criado_em      INTEGER NOT NULL,
     cancelavel_ate INTEGER,
     cancelado_em   INTEGER
   )`,
  `CREATE INDEX IF NOT EXISTS idx_lances_lote ON lances(lote_id, valor DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_lances_usuario ON lances(usuario_id, criado_em DESC)`,
  `CREATE TABLE IF NOT EXISTS salvos (
     usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
     lote_id    TEXT NOT NULL REFERENCES lotes(id),
     criado_em  INTEGER NOT NULL,
     PRIMARY KEY (usuario_id, lote_id)
   )`,
];

/**
 * Abre (e migra) o banco.
 * @param {string} caminho arquivo, ou ":memory:" nos testes
 */
export function abrirBanco(caminho = process.env.LEILOAE_DB || "./dados/leiloae.db") {
  const db = new DatabaseSync(caminho);
  // WAL deixa leitura e escrita conviverem; busy_timeout faz o escritor esperar
  // em vez de falhar quando outro processo está no meio de uma transação.
  if (caminho !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  for (const ddl of ESQUEMA) db.exec(ddl);
  return db;
}

/**
 * Carrega o catálogo no banco. Idempotente: não sobrescreve o estado de leilão
 * de um lote que já existe, senão cada reinício apagaria os lances.
 */
export function semear(db, lotes = LOTS) {
  const existe = db.prepare("SELECT id FROM lotes WHERE id = ?");
  const inserir = db.prepare(
    `INSERT INTO lotes (id, categoria, estatico, lance_minimo, lance_atual, lances, encerra_em, versao)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
  );
  let novos = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const lote of lotes) {
      if (existe.get(lote.id)) continue;
      const { id, category, minBid, currentBid, bids, endsAt, ...estatico } = lote;
      inserir.run(
        id,
        category,
        JSON.stringify(estatico),
        Math.round(minBid),
        Math.round(currentBid),
        Math.round(bids || 0),
        Math.round(endsAt)
      );
      novos++;
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return novos;
}

/** Converte a linha do banco na forma de lote que o domínio e a interface usam. */
export function linhaParaLote(linha) {
  if (!linha) return null;
  return {
    ...JSON.parse(linha.estatico),
    id: linha.id,
    category: linha.categoria,
    minBid: linha.lance_minimo,
    currentBid: linha.lance_atual,
    bids: linha.lances,
    endsAt: linha.encerra_em,
    versao: linha.versao,
  };
}

export function listarLotes(db) {
  return db.prepare("SELECT * FROM lotes ORDER BY encerra_em ASC").all().map(linhaParaLote);
}

export function buscarLote(db, id) {
  return linhaParaLote(db.prepare("SELECT * FROM lotes WHERE id = ?").get(id));
}

export const novoId = () => randomUUID();
