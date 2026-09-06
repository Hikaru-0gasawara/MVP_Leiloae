// Motor de lances (BIZ-001/002/005/006/010, SEC-004).
//
// Duas garantias, e as duas dependem de ser aqui e não no cliente:
//
// 1. TRANSAÇÃO. O lance abre `BEGIN IMMEDIATE`, RELÊ o lote de dentro da
//    transação e só então valida. Ler antes de abrir a transação seria validar
//    contra um lance atual que outro já superou — dois lances de mesmo valor
//    entrariam, e o leilão perderia o dinheiro da diferença.
//
// 2. MESMAS REGRAS. A validação usa `src/domain/auction.js`, o módulo que a
//    interface usa. Não é a mesma regra "reimplementada": é a mesma função.
//    Não existe divergência possível entre o que o botão habilita e o que o
//    servidor aceita — e o servidor decide.
//
// O relógio é sempre o do servidor. O cliente não manda "agora".

import { validateBid, minBidFor, isCancelable, FIRST_BID_WINDOW_MS } from "../src/domain/auction.js";
import { linhaParaLote, novoId } from "./db.js";

/**
 * Registra um lance.
 * @returns {{lance: object, lote: object} | {erro: string, mensagem: string, min?: number}}
 */
export function darLance(db, { loteId, usuarioId, valor, teto }, agora = Date.now()) {
  /** @type {string} */ const idLote = String(loteId);
  /** @type {string} */ const idUsuario = String(usuarioId);
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    return { erro: "valor-invalido", mensagem: "O lance precisa ser um valor inteiro em reais." };
  }
  const tetoNumero = teto == null || teto === "" ? null : Number(teto);
  if (tetoNumero !== null && (!Number.isInteger(tetoNumero) || tetoNumero < numero)) {
    return { erro: "teto-invalido", mensagem: "O teto precisa ser um inteiro maior ou igual ao lance." };
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    // Releitura dentro da transação: este é o ponto do exercício.
    const linha = db.prepare("SELECT * FROM lotes WHERE id = ?").get(loteId);
    if (!linha) {
      db.exec("ROLLBACK");
      return { erro: "lote-inexistente", mensagem: "Lote não encontrado." };
    }
    const lote = linhaParaLote(linha);

    const checagem = validateBid(lote, numero, agora);
    if (!checagem.ok) {
      db.exec("ROLLBACK");
      return { erro: checagem.reason, mensagem: checagem.message, min: minBidFor(lote) };
    }

    // Janela de arrependimento só no primeiro lance da pessoa, em qualquer lote.
    const jaDeu = db.prepare(
      "SELECT COUNT(*) AS n FROM lances WHERE usuario_id = ? AND cancelado_em IS NULL"
    ).get(usuarioId).n;
    const cancelavelAte = jaDeu === 0 ? agora + FIRST_BID_WINDOW_MS : null;

    const id = novoId();
    db.prepare(
      `INSERT INTO lances (id, lote_id, usuario_id, valor, teto, criado_em, cancelavel_ate, cancelado_em)
       VALUES (?,?,?,?,?,?,?,NULL)`
    ).run(id, idLote, idUsuario, numero, tetoNumero, agora, cancelavelAte);


    db.prepare(
      "UPDATE lotes SET lance_atual = ?, lances = lances + 1, versao = versao + 1 WHERE id = ?"
    ).run(numero, loteId);

    db.exec("COMMIT");
    return {
      lance: {
        id, lotId: loteId, value: numero, autoMax: tetoNumero,
        placedAt: agora, cancelableUntil: cancelavelAte, canceled: false,
      },
      lote: { ...lote, currentBid: numero, bids: lote.bids + 1, versao: lote.versao + 1 },
    };
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* transação já desfeita */ }
    throw e;
  }
}

/**
 * Cancela um lance dentro da janela de 24 h (BIZ-006).
 *
 * O `usuario_id` vem da sessão, nunca da requisição: pedir para cancelar o
 * lance de outra pessoa devolve "não encontrado", sem revelar que existe.
 */
export function cancelarLance(db, { lanceId, usuarioId }, agora = Date.now()) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const linha = db.prepare("SELECT * FROM lances WHERE id = ? AND usuario_id = ?").get(lanceId, usuarioId);
    if (!linha) {
      db.exec("ROLLBACK");
      return { erro: "lance-inexistente", mensagem: "Lance não encontrado." };
    }
    const lance = {
      cancelableUntil: linha.cancelavel_ate,
      canceled: linha.cancelado_em != null,
    };
    if (!isCancelable(lance, agora)) {
      db.exec("ROLLBACK");
      return {
        erro: "fora-da-janela",
        mensagem: linha.cancelado_em != null
          ? "Este lance já foi cancelado."
          : "A janela de cancelamento deste lance já passou.",
      };
    }

    db.prepare("UPDATE lances SET cancelado_em = ? WHERE id = ?").run(agora, lanceId);

    // O lance atual do lote volta para o maior lance vivo — ou para o mínimo,
    // se o cancelado era o único. Sem isto o lote ficaria marcando um valor
    // que ninguém mais está oferecendo.
    const maior = db.prepare(
      "SELECT MAX(valor) AS v FROM lances WHERE lote_id = ? AND cancelado_em IS NULL"
    ).get(linha.lote_id).v;
    const loteLinha = db.prepare("SELECT lance_minimo FROM lotes WHERE id = ?").get(linha.lote_id);
    db.prepare("UPDATE lotes SET lance_atual = ?, versao = versao + 1 WHERE id = ?")
      .run(maior ?? loteLinha.lance_minimo, linha.lote_id);

    db.exec("COMMIT");
    return { cancelado: lanceId, loteId: linha.lote_id };
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* transação já desfeita */ }
    throw e;
  }
}

/** Lances da pessoa, do mais recente ao mais antigo, com o lote embutido. */
export function meusLances(db, usuarioId) {
  const linhas = db.prepare(
    `SELECT l.*, lo.id AS lote_pk, lo.categoria, lo.estatico, lo.lance_minimo,
            lo.lance_atual, lo.lances, lo.encerra_em, lo.versao
       FROM lances l JOIN lotes lo ON lo.id = l.lote_id
      WHERE l.usuario_id = ?
      ORDER BY l.criado_em DESC`
  ).all(usuarioId);

  return linhas.map((r) => ({
    bid: {
      id: r.id,
      lotId: r.lote_id,
      value: r.valor,
      autoMax: r.teto,
      placedAt: r.criado_em,
      cancelableUntil: r.cancelavel_ate,
      canceled: r.cancelado_em != null,
      canceledAt: r.cancelado_em,
    },
    lot: linhaParaLote({
      id: r.lote_pk, categoria: r.categoria, estatico: r.estatico,
      lance_minimo: r.lance_minimo, lance_atual: r.lance_atual,
      lances: r.lances, encerra_em: r.encerra_em, versao: r.versao,
    }),
  }));
}

export function listarSalvos(db, usuarioId) {
  return db.prepare("SELECT lote_id FROM salvos WHERE usuario_id = ? ORDER BY criado_em DESC")
    .all(usuarioId).map((r) => r.lote_id);
}

export function alternarSalvo(db, { usuarioId, loteId }, agora = Date.now()) {
  if (!db.prepare("SELECT id FROM lotes WHERE id = ?").get(loteId)) {
    return { erro: "lote-inexistente", mensagem: "Lote não encontrado." };
  }
  const existe = db.prepare("SELECT 1 FROM salvos WHERE usuario_id = ? AND lote_id = ?").get(usuarioId, loteId);
  if (existe) {
    db.prepare("DELETE FROM salvos WHERE usuario_id = ? AND lote_id = ?").run(usuarioId, loteId);
    return { salvo: false };
  }
  db.prepare("INSERT INTO salvos (usuario_id, lote_id, criado_em) VALUES (?,?,?)").run(usuarioId, loteId, agora);
  return { salvo: true };
}
