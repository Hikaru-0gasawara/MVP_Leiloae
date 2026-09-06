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
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
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
  // Verificação de e-mail. Mesmo desenho da recuperação — token guardado como
  // hash, uso único, validade curta —, porque o risco é o mesmo: quem lê o
  // banco não pode confirmar o endereço de ninguém.
  `CREATE TABLE IF NOT EXISTS verificacoes (
     token_hash TEXT PRIMARY KEY,
     usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
     criado_em  INTEGER NOT NULL,
     expira_em  INTEGER NOT NULL,
     usado_em   INTEGER
   )`,
  `CREATE INDEX IF NOT EXISTS idx_verificacoes_usuario ON verificacoes(usuario_id)`,
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
  // A pasta é criada aqui porque ninguém mais a criava: numa cópia limpa do
  // repositório (`dados/` é ignorada pelo git) o servidor morria com "unable
  // to open database file" — uma mensagem do SQLite que não diz o que fazer.
  if (caminho !== ":memory:") mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  // WAL deixa leitura e escrita conviverem; busy_timeout faz o escritor esperar
  // em vez de falhar quando outro processo está no meio de uma transação.
  if (caminho !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  for (const ddl of ESQUEMA) db.exec(ddl);
  migrar(db);
  return db;
}

/**
 * Migrações de coluna.
 *
 * `CREATE TABLE IF NOT EXISTS` não altera tabela que já existe, então banco de
 * antes desta versão continuaria sem a coluna nova e toda leitura quebraria em
 * produção — e só em produção, porque o banco dos testes nasce do zero.
 * Idempotente: roda em toda abertura e não faz nada quando já está em dia.
 */
function migrar(db) {
  const colunas = (tabela) => db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);
  if (!colunas("usuarios").includes("email_verificado_em")) {
    db.exec("ALTER TABLE usuarios ADD COLUMN email_verificado_em INTEGER");
  }
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

/**
 * Ordem do catálogo: pelo horário DO EDITAL, com o id desempatando.
 *
 * Não por `encerra_em`, que é a coluna que a prorrogação empurra. A ordem da
 * paginação precisa de uma chave que não se mova: um lote que muda de lugar
 * depois de já ter sido entregue reaparece na página seguinte, e essa é a
 * duplicata que o teste "prorrogar no meio da leitura" pega. `encerra_em_original`
 * é imutável por construção, então a mesma leitura paginada devolve cada lote
 * exatamente uma vez, mesmo com o leilão andando embaixo dela.
 *
 * A diferença prática entre as duas ordens é de no máximo dois minutos — a
 * janela da prorrogação — e a interface reordena por conta própria.
 */
const ORDEM_CATALOGO = "ORDER BY encerra_em_original ASC, id ASC";

/**
 * Uma página do catálogo.
 *
 * Paginação por CHAVE, não por `OFFSET`. Com `OFFSET`, qualquer lote que mude
 * de lugar entre duas páginas faz um vizinho aparecer duas vezes ou sumir — e
 * este catálogo muda de lugar sozinho, porque a prorrogação empurra o
 * encerramento de quem recebe lance nos últimos dois minutos. O cursor carrega
 * o par (encerra_em_original, id) da última linha entregue: uma chave que a
 * prorrogação não move (ver ORDEM_CATALOGO), então a página seguinte continua
 * exatamente de onde a anterior parou, com o leilão andando ou não.
 *
 * @param {any} db
 * @param {{limite?: number, cursor?: string|null}} [opcoes]
 * @returns {{lotes: any[], proximo: string|null, total: number}}
 */
export function listarLotes(db, { limite, cursor } = {}) {
  const total = db.prepare("SELECT COUNT(*) AS n FROM lotes").get().n;
  if (!limite) {
    return { lotes: db.prepare(`SELECT * FROM lotes ${ORDEM_CATALOGO}`).all().map(linhaParaLote), proximo: null, total };
  }
  const depois = lerCursor(cursor);
  // Pede um a mais do que cabe: se vier, existe página seguinte — sem uma
  // segunda consulta só para descobrir isso.
  const linhas = depois
    ? db.prepare(
        `SELECT * FROM lotes WHERE (encerra_em_original, id) > (?, ?) ${ORDEM_CATALOGO} LIMIT ?`
      ).all(depois.encerraEm, depois.id, limite + 1)
    : db.prepare(`SELECT * FROM lotes ${ORDEM_CATALOGO} LIMIT ?`).all(limite + 1);

  const tem_mais = linhas.length > limite;
  const pagina = tem_mais ? linhas.slice(0, limite) : linhas;
  const ultima = pagina[pagina.length - 1];
  return {
    lotes: pagina.map(linhaParaLote),
    proximo: tem_mais && ultima ? escreverCursor(ultima.encerra_em_original, ultima.id) : null,
    total,
  };
}

const escreverCursor = (encerraEm, id) =>
  Buffer.from(`${encerraEm}:${id}`, "utf8").toString("base64url");

/** Cursor ilegível é tratado como "do começo": nunca derruba a listagem. */
function lerCursor(cursor) {
  if (!cursor) return null;
  try {
    const texto = Buffer.from(String(cursor), "base64url").toString("utf8");
    const i = texto.indexOf(":");
    const encerraEm = Number(texto.slice(0, i));
    const id = texto.slice(i + 1);
    if (!Number.isFinite(encerraEm) || !id) return null;
    return { encerraEm, id };
  } catch {
    return null;
  }
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

/**
 * Histórico PÚBLICO de lances de um lote.
 *
 * A trilha de auditoria sempre existiu no banco e não era exposta por rota
 * nenhuma — publicar exigia decidir antes o que aparece sobre quem deu cada
 * lance. A decisão está aqui:
 *
 *  · Ninguém é identificado. Cada conta vira "Participante N" DENTRO daquele
 *    lote, numerado pela ordem do primeiro lance. O mesmo número não segue a
 *    pessoa para outro lote, então dois históricos não podem ser cruzados
 *    para reconstruir o comportamento de alguém no site inteiro.
 *  · O que aparece é o que o leilão já anuncia de qualquer forma: valor,
 *    horário e se o lance foi automático. Nome, e-mail, id e teto não saem —
 *    o teto principalmente, porque é a informação com que se ganha do outro.
 *  · Lance cancelado aparece marcado como cancelado, não sumido: a trilha não
 *    apaga o que existiu, e um valor que desaparece da lista sem explicação é
 *    exatamente o que faz o iniciante achar que o leilão foi mexido.
 *
 * @param {any} db
 * @param {string} loteId
 * @param {number} [limite]
 */
export function historicoDoLote(db, loteId, limite = 100) {
  // `rowid` desempata, não o id: o id é um UUID aleatório, e dois lances
  // gravados no mesmo milissegundo — o caso normal quando um teto responde ao
  // lance que o disparou — saíam em ordem sorteada. `rowid` é a ordem real de
  // inserção, que é a ordem em que as coisas aconteceram.
  const linhas = db.prepare(
    `SELECT id, usuario_id, valor, criado_em, cancelado_em, automatico
       FROM lances WHERE lote_id = ? ORDER BY criado_em ASC, rowid ASC`
  ).all(loteId);

  const numero = new Map();
  for (const l of linhas) if (!numero.has(l.usuario_id)) numero.set(l.usuario_id, numero.size + 1);

  return linhas
    .slice(-limite)
    .reverse()
    .map((l) => ({
      id: l.id,
      participante: `Participante ${numero.get(l.usuario_id)}`,
      valor: l.valor,
      em: l.criado_em,
      automatico: Boolean(l.automatico),
      cancelado: l.cancelado_em != null,
    }));
}

/** Trilha de um lote, do mais recente ao mais antigo. */
export function eventosDoLote(db, loteId, limite = 100) {
  return db.prepare("SELECT * FROM eventos WHERE lote_id = ? ORDER BY em DESC LIMIT ?")
    .all(loteId, limite)
    .map((e) => ({ ...e, detalhe: e.detalhe ? JSON.parse(e.detalhe) : null }));
}
