// Estado do usuário: favoritos e lances.
//
// Corrige três achados de uma vez:
//  · BIZ-001 — dar um lance passa a alterar o lote (lance atual e contagem);
//  · BIZ-004 — "Meus lances" deriva dos lances reais, não de IDs fixos;
//  · FRONT-001 — favoritos e lances sobrevivem ao reload.
//
// A validação usa as mesmas regras de `domain/auction` que a interface usa para
// habilitar o botão: mesmo que alguém burle a UI, o redutor recusa o lance.
// Isso é defesa em profundidade no cliente — NÃO substitui validação no
// servidor, que ainda não existe (SEC-004).

import { validateBid, isCancelable, FIRST_BID_WINDOW_MS } from "../domain/auction.js";

const STORAGE_KEY = "leiloae:user-state:v1";

export const initialUserState = { savedIds: [], bids: [] };

/** Lê o estado persistido, tolerando armazenamento indisponível ou corrompido. */
export function loadUserState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialUserState;
    const parsed = JSON.parse(raw);
    return {
      savedIds: Array.isArray(parsed.savedIds) ? parsed.savedIds.filter((id) => typeof id === "string") : [],
      bids: Array.isArray(parsed.bids) ? parsed.bids.filter((b) => b && typeof b.lotId === "string" && Number.isFinite(b.value)) : [],
    };
  } catch {
    return initialUserState;
  }
}

export function saveUserState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Armazenamento indisponível (aba anônima, cota cheia): seguimos em memória.
  }
}

export function userReducer(state, action) {
  switch (action.type) {
    case "toggle-save": {
      const has = state.savedIds.includes(action.lotId);
      return {
        ...state,
        savedIds: has ? state.savedIds.filter((id) => id !== action.lotId) : [...state.savedIds, action.lotId],
      };
    }

    case "place-bid": {
      const { lot, value, autoMax, now = Date.now() } = action;
      const check = validateBid(lot, value, now);
      if (!check.ok) return state; // lance inválido nunca entra no estado
      const isFirst = state.bids.filter((b) => !b.canceled).length === 0;
      const bid = {
        id: `${lot.id}-${now}`,
        lotId: lot.id,
        value: Number(value),
        placedAt: now,
        autoMax: Number.isFinite(autoMax) && autoMax > value ? Number(autoMax) : null,
        // Proteção de primeiro lance: janela de 24 h apenas no primeiro (BIZ-006).
        cancelableUntil: isFirst ? now + FIRST_BID_WINDOW_MS : null,
        canceled: false,
      };
      return { ...state, bids: [...state.bids, bid] };
    }

    case "cancel-bid": {
      const now = action.now ?? Date.now();
      return {
        ...state,
        bids: state.bids.map((b) =>
          b.id === action.bidId && isCancelable(b, now) ? { ...b, canceled: true, canceledAt: now } : b
        ),
      };
    }

    case "reset":
      return initialUserState;

    default:
      return state;
  }
}

/**
 * Projeta o estado do usuário sobre o catálogo base.
 * O lance mais alto não cancelado passa a ser o lance atual do lote, e a
 * contagem de lances cresce — era exatamente o que não acontecia (BIZ-001).
 */
export function applyUserState(baseLots, state) {
  const activeBids = state.bids.filter((b) => !b.canceled);
  const byLot = new Map();
  for (const bid of activeBids) {
    const list = byLot.get(bid.lotId) || [];
    list.push(bid);
    byLot.set(bid.lotId, list);
  }
  return baseLots.map((lot) => {
    const mine = byLot.get(lot.id);
    const saved = state.savedIds.includes(lot.id);
    if (!mine || mine.length === 0) {
      return saved === lot.saved ? lot : { ...lot, saved };
    }
    const highest = Math.max(...mine.map((b) => b.value));
    return {
      ...lot,
      saved,
      currentBid: Math.max(lot.currentBid, highest),
      bids: lot.bids + mine.length,
    };
  });
}

/** Lances do usuário, do mais recente ao mais antigo, já ligados ao lote. */
export function myBids(state, lots) {
  const byId = new Map(lots.map((l) => [l.id, l]));
  return [...state.bids]
    .sort((a, b) => b.placedAt - a.placedAt)
    .map((bid) => ({ bid, lot: byId.get(bid.lotId) }))
    .filter((entry) => entry.lot);
}
