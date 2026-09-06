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
     -- Horário do edital. A coluna encerra_em pode ser empurrada por
     -- prorrogação; esta não muda, e é o que permite dizer "prorrogado".
     encerra_em_original INTEGER NOT NULL,
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
     cancelado_em   INTEGER,
     -- 1 quando o lance foi disparado pelo teto, não digitado pela pessoa.
     automatico     INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE INDEX IF NOT EXISTS idx_lances_lote ON lances(lote_id, valor DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_lances_usuario ON lances(usuario_id, criado_em DESC)`,
  // Trilha de auditoria: linha por acontecimento, apenas inserção. Separada
  // dos dados operacionais de propósito — cancelar um lance altera a tabela de
  // lances, mas não pode apagar o registro de que ele existiu.
  `CREATE TABLE IF NOT EXISTS eventos (
     id         TEXT PRIMARY KEY,
     em         INTEGER NOT NULL,
     tipo       TEXT NOT NULL,
     usuario_id TEXT,
     lote_id    TEXT,
     lance_id   TEXT,
     valor      INTEGER,
     detalhe    TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_eventos_lote ON eventos(lote_id, em DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_eventos_em ON eventos(em DESC)`,
  // Recuperação de senha. Como nas sessões, guarda-se o hash do token: quem
  // lê o banco não consegue redefinir a senha de ninguém.
  `CREATE TABLE IF NOT EXISTS recuperacoes (
     token_hash TEXT PRIMARY KEY,
     usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
     criado_em  INTEGER NOT NULL,
     expira_em  INTEGER NOT NULL,
     usado_em   INTEGER
   )`,
  `CREATE INDEX IF NOT EXISTS idx_recuperacoes_usuario ON recuperacoes(usuario_id)`,
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
    `INSERT INTO lotes (id, categoria, estatico, lance_minimo, lance_atual, lances,
                        encerra_em, encerra_em_original, versao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
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
        Math.round(endsAt),
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
    encerramentoOriginal: linha.encerra_em_original ?? linha.encerra_em,
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

/**
 * Registra um acontecimento na trilha de auditoria. Chamado de DENTRO da
 * transação que produziu o fato, para que os dois vivam ou morram juntos.
 *
 * @param {any} db
 * @param {{tipo: string, usuarioId?: string|null, loteId?: string|null,
 *          lanceId?: string|null, valor?: number|null, detalhe?: any}} evento
 * @param {number} [agora]
 */
export function registrarEvento(db, evento, agora = Date.now()) {
  db.prepare(
    `INSERT INTO eventos (id, em, tipo, usuario_id, lote_id, lance_id, valor, detalhe)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    randomUUID(),
    agora,
    evento.tipo,
    evento.usuarioId ?? null,
    evento.loteId ?? null,
    evento.lanceId ?? null,
    evento.valor ?? null,
    evento.detalhe === undefined ? null : JSON.stringify(evento.detalhe)
  );
}

/** Trilha de um lote, do mais recente ao mais antigo. */
export function eventosDoLote(db, loteId, limite = 100) {
  return db.prepare("SELECT * FROM eventos WHERE lote_id = ? ORDER BY em DESC LIMIT ?")
    .all(loteId, limite)
    .map((e) => ({ ...e, detalhe: e.detalhe ? JSON.parse(e.detalhe) : null }));
}
