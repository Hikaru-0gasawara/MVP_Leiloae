import { describe, it, expect } from "vitest";
import {
  userReducer, applyUserState, myBids, initialUserState, loadUserState, saveUserState,
} from "./userState.js";
import { FIRST_BID_WINDOW_MS, bidStatus } from "../domain/auction.js";

const agora = 1_700_000_000_000;
const lote = (over = {}) => ({
  id: "lot-1", category: "imovel", title: "Studio", currentBid: 142500, bids: 14,
  appraised: 215000, minBid: 138000, endsAt: agora + 3600e3, saved: false, ...over,
});

describe("BIZ-001 — dar lance altera o lote", () => {
  it("eleva o lance atual e incrementa a contagem", () => {
    const l = lote();
    const s = userReducer(initialUserState, { type: "place-bid", lot: l, value: 143500, now: agora });
    const [projetado] = applyUserState([l], s);
    expect(projetado.currentBid).toBe(143500);
    expect(projetado.bids).toBe(15);
  });

  it("o lance aparece em Meus lances", () => {
    const l = lote();
    const s = userReducer(initialUserState, { type: "place-bid", lot: l, value: 143500, now: agora });
    const lista = myBids(s, applyUserState([l], s));
    expect(lista).toHaveLength(1);
    expect(lista[0].bid.value).toBe(143500);
    expect(lista[0].lot.id).toBe("lot-1");
  });

  it("dois lances no mesmo lote mantêm o maior como lance atual", () => {
    const l = lote();
    let s = userReducer(initialUserState, { type: "place-bid", lot: l, value: 143500, now: agora });
    const intermediario = applyUserState([l], s)[0];
    s = userReducer(s, { type: "place-bid", lot: intermediario, value: 146000, now: agora + 1000 });
    const [projetado] = applyUserState([l], s);
    expect(projetado.currentBid).toBe(146000);
    expect(projetado.bids).toBe(16);
  });

  it("nunca reduz o lance atual do lote", () => {
    const l = lote();
    const s = { savedIds: [], bids: [{ id: "b", lotId: "lot-1", value: 1000, placedAt: agora, canceled: false }] };
    expect(applyUserState([l], s)[0].currentBid).toBe(142500);
  });
});

describe("BIZ-002 — o redutor recusa lance inválido mesmo se a UI deixar passar", () => {
  it("recusa lance em leilão encerrado", () => {
    const l = lote({ endsAt: agora - 1 });
    const s = userReducer(initialUserState, { type: "place-bid", lot: l, value: 999999, now: agora });
    expect(s.bids).toHaveLength(0);
  });

  it("recusa lance abaixo do mínimo", () => {
    const l = lote();
    const s = userReducer(initialUserState, { type: "place-bid", lot: l, value: 142501, now: agora });
    expect(s.bids).toHaveLength(0);
  });
});

describe("BIZ-006 — proteção de primeiro lance", () => {
  it("dá janela de 24 h apenas ao primeiro lance", () => {
    const l = lote();
    let s = userReducer(initialUserState, { type: "place-bid", lot: l, value: 143500, now: agora });
    expect(s.bids[0].cancelableUntil).toBe(agora + FIRST_BID_WINDOW_MS);

    const outro = lote({ id: "lot-2", currentBid: 61500, minBid: 58000, category: "carro", fipe: 87500 });
    s = userReducer(s, { type: "place-bid", lot: outro, value: 62500, now: agora + 5000 });
    expect(s.bids[1].cancelableUntil).toBeNull();
  });

  it("cancelar dentro da janela remove o efeito do lance no lote", () => {
    const l = lote();
    let s = userReducer(initialUserState, { type: "place-bid", lot: l, value: 143500, now: agora });
    expect(applyUserState([l], s)[0].currentBid).toBe(143500);

    s = userReducer(s, { type: "cancel-bid", bidId: s.bids[0].id, now: agora + 3600e3 });
    expect(s.bids[0].canceled).toBe(true);
    const [projetado] = applyUserState([l], s);
    expect(projetado.currentBid).toBe(142500);
    expect(projetado.bids).toBe(14);
  });

  it("não cancela depois de expirada a janela", () => {
    const l = lote();
    let s = userReducer(initialUserState, { type: "place-bid", lot: l, value: 143500, now: agora });
    s = userReducer(s, { type: "cancel-bid", bidId: s.bids[0].id, now: agora + FIRST_BID_WINDOW_MS + 1 });
    expect(s.bids[0].canceled).toBe(false);
  });

  it("lance cancelado não conta como primeiro para o próximo", () => {
    const l = lote();
    let s = userReducer(initialUserState, { type: "place-bid", lot: l, value: 143500, now: agora });
    s = userReducer(s, { type: "cancel-bid", bidId: s.bids[0].id, now: agora + 1000 });
    s = userReducer(s, { type: "place-bid", lot: l, value: 144500, now: agora + 2000 });
    expect(s.bids[1].cancelableUntil).toBe(agora + 2000 + FIRST_BID_WINDOW_MS);
  });
});

describe("FRONT-001 — persistência", () => {
  it("favoritar alterna e persiste ida e volta", () => {
    let s = userReducer(initialUserState, { type: "toggle-save", lotId: "lot-1" });
    expect(s.savedIds).toEqual(["lot-1"]);
    saveUserState(s);
    expect(loadUserState().savedIds).toEqual(["lot-1"]);

    s = userReducer(s, { type: "toggle-save", lotId: "lot-1" });
    expect(s.savedIds).toEqual([]);
  });

  it("favorito se reflete no lote projetado", () => {
    const s = userReducer(initialUserState, { type: "toggle-save", lotId: "lot-1" });
    expect(applyUserState([lote()], s)[0].saved).toBe(true);
  });

  it("estado corrompido no armazenamento não derruba a aplicação", () => {
    localStorage.setItem("leiloae:user-state:v1", "{isso não é json");
    expect(loadUserState()).toEqual(initialUserState);

    localStorage.setItem("leiloae:user-state:v1", JSON.stringify({ savedIds: "x", bids: [{ lixo: 1 }] }));
    expect(loadUserState()).toEqual({ savedIds: [], bids: [] });
  });
});

describe("integração com bidStatus", () => {
  it("o lance vira 'ganhando' e depois 'arrematado' ao encerrar", () => {
    const l = lote();
    const s = userReducer(initialUserState, { type: "place-bid", lot: l, value: 143500, now: agora });
    const [projetado] = applyUserState([l], s);
    expect(bidStatus(s.bids[0], projetado, agora)).toBe("winning");
    expect(bidStatus(s.bids[0], { ...projetado, endsAt: agora - 1 }, agora)).toBe("won");
  });
});
