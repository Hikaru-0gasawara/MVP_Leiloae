import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, fireEvent } from "@testing-library/react";
import { LotCard } from "./components.jsx";
import { pausarCarrosseis } from "./lib/motion.js";

// Regressão do defeito relatado: "o carrossel não está rodando automaticamente".
//
// A rotação de fotos e o ticker consultavam `prefers-reduced-motion` e se
// desligavam sozinhos. Num sistema com "reduzir movimento" ligado — o caso de
// quem relatou — o catálogo inteiro exibia só a primeira foto de cada lote,
// sem nenhuma pista de que havia mais três. A troca de foto é conteúdo, não
// transição decorativa: roda sempre, e a pausa passou a ser explícita.

const lote = (over = {}) => ({
  id: "lot-1", category: "imovel", title: "Studio na Mooca",
  address: "R. Teste, 1 — Mooca", city: "São Paulo", region: "Zona Leste",
  area: 28, bedrooms: 1, occupancy: "Vazio", auctionType: "Extrajudicial", praca: "2ª praça",
  appraised: 215000, minBid: 138000, currentBid: 142500, bids: 14,
  endsAt: Date.now() + 3600e3, vendor: "vendor-bb", photo: "linear-gradient(135deg,#000,#111)",
  glyph: "studio", saved: false, photoIds: ["abc", "def", "ghi", "jkl"],
  docs: [], rules: "", description: "", ...over,
});

/** Diz que o sistema pede menos movimento — o estado de quem relatou o defeito. */
function comMovimentoReduzido() {
  const original = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: query.includes("reduced-motion"),
    media: query,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
    dispatchEvent() { return false; },
  });
  return () => { window.matchMedia = original; };
}

const fotoAtual = (container) => container.querySelector("img")?.getAttribute("src");

/** Avança o relógio compartilhado, que é de onde o índice da foto é derivado. */
async function avancar(ms) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

describe("carrossel de fotos do card", () => {
  let restaurar;
  beforeEach(() => {
    vi.useFakeTimers();
    restaurar = comMovimentoReduzido();
    pausarCarrosseis(false);
  });
  afterEach(() => {
    restaurar();
    // Dentro de `act`: este `afterEach` roda ANTES do `cleanup` global do
    // Testing Library (os hooks saem na ordem inversa do registro), então o
    // card ainda está montado e a volta da pausa é uma atualização de estado
    // de verdade — sem `act` ela vira aviso no meio da saída dos testes.
    act(() => { pausarCarrosseis(false); });
    vi.useRealTimers();
  });

  it("troca de foto sozinho mesmo com \"reduzir movimento\" ligado", async () => {
    const { container } = render(<LotCard lot={lote()} />);
    const primeira = fotoAtual(container);
    await avancar(5000); // o ciclo do card é de 4,5 s
    expect(fotoAtual(container)).not.toBe(primeira);
  });

  it("para quando a pessoa pausa, e congela onde está em vez de voltar à foto 1", async () => {
    const { container } = render(<LotCard lot={lote()} />);
    await avancar(5000);
    const aoPausar = fotoAtual(container);
    await act(async () => { pausarCarrosseis(true); });
    expect(fotoAtual(container)).toBe(aoPausar);
    await avancar(15000);
    expect(fotoAtual(container)).toBe(aoPausar);
  });

  it("volta a rodar quando a pessoa retoma", async () => {
    const { container } = render(<LotCard lot={lote()} />);
    await act(async () => { pausarCarrosseis(true); });
    const parada = fotoAtual(container);
    await avancar(15000);
    expect(fotoAtual(container)).toBe(parada);
    await act(async () => { pausarCarrosseis(false); });
    // A comparação é com a foto do instante em que retomou, não com a de antes
    // da pausa: o relógio andou enquanto estava parado, então a foto ao voltar
    // pode ser qualquer uma das quatro.
    const aoRetomar = fotoAtual(container);
    await avancar(5000);
    expect(fotoAtual(container)).not.toBe(aoRetomar);
  });

  it("a preferência de pausa sobrevive à recarga", async () => {
    pausarCarrosseis(true);
    expect(localStorage.getItem("leiloae:carrossel-pausado")).toBeTruthy();
    pausarCarrosseis(false);
    expect(localStorage.getItem("leiloae:carrossel-pausado")).toBeNull();
  });
});

describe("FRONT-009 — foto que falha não leva o card junto", () => {
  beforeEach(() => { vi.useFakeTimers(); pausarCarrosseis(false); });
  afterEach(() => { act(() => { pausarCarrosseis(false); }); vi.useRealTimers(); });

  it("uma foto quebrada não apaga as outras três", async () => {
    const { container } = render(<LotCard lot={lote()} />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    const quebrada = img.getAttribute("src");

    // A falha era guardada como booleano por card: a primeira imagem que não
    // carregasse desligava o card para sempre, e nem a rotação trazia as
    // outras de volta.
    await act(async () => { fireEvent.error(img); });
    expect(container.querySelector("img")).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    const depois = container.querySelector("img");
    expect(depois).toBeTruthy();
    expect(depois.getAttribute("src")).not.toBe(quebrada);
  });
});
