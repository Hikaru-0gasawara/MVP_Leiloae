// Regras de negócio do leilão — funções puras, sem React e sem DOM.
//
// Este módulo é a ÚNICA fonte de verdade das regras. Antes elas estavam
// duplicadas e divergentes entre BidModal, LotDetail e a home (BIZ-007/BIZ-008).
//
// Quando existir backend, estas mesmas regras devem ser reimplementadas (ou
// compartilhadas) no servidor: o cliente é fonte hostil e nada aqui é garantia.

export const RATES = {
  comissao: 0.05,   // comissão do leiloeiro
  taxa: 0.015,      // taxa Leiloaê
  itbi: 0.03,       // ITBI (somente imóveis — imposto sobre bens imóveis)
  registro: 2800,   // cartório/registro, estimativa fixa
};

/** Janela de arrependimento do primeiro lance, em milissegundos. */
export const FIRST_BID_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Custo total de um arremate.
 *
 * Devolve `lines` já pronto para renderização: as três telas que exibem o
 * simulador iteram sobre a mesma lista, o que torna estruturalmente impossível
 * uma tela omitir uma linha que outra mostra (era a causa de BIZ-008).
 *
 * @param {number} lance
 * @param {"imovel"|"carro"} category
 */
export function simulateCost(lance, category = "imovel") {
  const valor = Number(lance);
  if (!Number.isFinite(valor) || valor <= 0) {
    return { lance: 0, comissao: 0, taxa: 0, itbi: 0, registro: 0, total: 0, lines: [] };
  }
  const aplicaItbi = category !== "carro";
  const comissao = valor * RATES.comissao;
  const taxa = valor * RATES.taxa;
  const itbi = aplicaItbi ? valor * RATES.itbi : 0;
  const registro = RATES.registro;
  const total = valor + comissao + taxa + itbi + registro;

  const lines = [
    { key: "lance", label: "Seu lance", value: valor },
    { key: "comissao", label: "Comissão do leiloeiro (5%)", value: comissao },
    { key: "taxa", label: "Taxa Leiloaê (1,5%)", value: taxa },
  ];
  if (aplicaItbi) lines.push({ key: "itbi", label: "ITBI estimado (3%)", value: itbi });
  lines.push({ key: "registro", label: "Cartório e registro", value: registro });

  return { lance: valor, comissao, taxa, itbi, registro, total, lines };
}

/** O leilão já encerrou? */
export function isEnded(lot, now = Date.now()) {
  return !lot || !Number.isFinite(lot.endsAt) || lot.endsAt <= now;
}

/**
 * Incremento mínimo do lote. Editais definem incremento por faixa de valor;
 * antes havia uma constante de R$ 100 para qualquer lote (BIZ-010).
 */
export function minIncrementFor(lot) {
  if (lot?.minIncrement > 0) return lot.minIncrement;
  const base = lot?.currentBid ?? 0;
  if (base >= 200000) return 2000;
  if (base >= 100000) return 1000;
  if (base >= 50000) return 500;
  return 250;
}

/** Menor lance aceitável agora. */
export function minBidFor(lot) {
  const base = (lot?.currentBid ?? 0) + minIncrementFor(lot);
  return Math.max(base, lot?.minBid ?? 0);
}

/** Sugestões de incremento coerentes com a faixa do lote. */
export function incrementOptionsFor(lot) {
  const step = minIncrementFor(lot);
  return [step, step * 2, step * 4, step * 10];
}

/** Valor de referência de mercado (FIPE para veículo, avaliação para imóvel). */
export function referenceValueOf(lot) {
  const ref = lot?.category === "carro" ? lot?.fipe : lot?.appraised;
  return Number.isFinite(ref) && ref > 0 ? ref : null;
}

/**
 * Desconto sobre a referência, em pontos percentuais inteiros.
 * Devolve `null` quando não há referência confiável ou não há desconto real,
 * para que a interface possa esconder o selo em vez de exibir NaN% ou -12%
 * (BIZ-009).
 */
export function discountPct(lot) {
  const ref = referenceValueOf(lot);
  const bid = Number(lot?.currentBid);
  if (ref === null || !Number.isFinite(bid) || bid <= 0) return null;
  const pct = Math.round((1 - bid / ref) * 100);
  return pct > 0 ? pct : null;
}

/**
 * Valida um lance. Única porta de entrada: usada pelo modal para habilitar o
 * botão e pelo redutor de estado antes de registrar (defesa em profundidade).
 *
 * @returns {{ok: boolean, reason?: string, message?: string}}
 */
export function validateBid(lot, value, now = Date.now()) {
  if (!lot) return { ok: false, reason: "no-lot", message: "Lote não encontrado." };
  if (isEnded(lot, now)) {
    return { ok: false, reason: "ended", message: "Este leilão já encerrou." };
  }
  const valor = Number(value);
  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false, reason: "invalid", message: "Informe um valor válido." };
  }
  const minimo = minBidFor(lot);
  if (valor < minimo) {
    return { ok: false, reason: "below-min", message: `O lance mínimo agora é ${formatBRL(minimo)}.`, min: minimo };
  }
  return { ok: true };
}

/** Este lance ainda pode ser cancelado pela proteção de primeiro lance? */
export function isCancelable(bid, now = Date.now()) {
  return Boolean(bid?.cancelableUntil && !bid.canceled && bid.cancelableUntil > now);
}

/**
 * Situação de um lance do usuário em relação ao lote.
 * @returns {"canceled"|"won"|"lost"|"winning"|"outbid"}
 */
export function bidStatus(bid, lot, now = Date.now()) {
  if (bid?.canceled) return "canceled";
  const ended = isEnded(lot, now);
  const isTop = lot && bid && bid.value >= lot.currentBid;
  if (ended) return isTop ? "won" : "lost";
  return isTop ? "winning" : "outbid";
}

// Formatação vive junto das regras porque as mensagens de validação a usam.
export const formatBRL = (n, withCents = false) => {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  });
};

export const formatNumber = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString("pt-BR") : "—");

export function timeLeft(ms) {
  if (ms <= 0) return { text: "Encerrado", short: "00:00", hot: false, ended: true };
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  let text, short;
  if (d > 0) {
    text = `${d}d ${h}h ${m}min`;
    short = `${d}d ${h}h`;
  } else if (h > 0) {
    text = `${h}h ${m}min ${String(s).padStart(2, "0")}s`;
    short = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  } else {
    text = `${m}min ${String(s).padStart(2, "0")}s`;
    short = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return { text, short, hot: totalSec < 3600, ended: false, d, h, m, s };
}
