// Preferência de movimento do sistema, como store compartilhada.
//
// Ler `matchMedia` durante a renderização funciona, mas não avisa quando a
// pessoa muda a preferência com a página aberta. Um único listener serve toda
// a aplicação, no mesmo padrão do relógio e da visibilidade da aba.

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function mql() {
  return typeof window !== "undefined" && window.matchMedia ? window.matchMedia(QUERY) : null;
}

function subscribe(fn) {
  const m = mql();
  if (!m) return () => {};
  // Safari antigo só tem addListener.
  if (m.addEventListener) {
    m.addEventListener("change", fn);
    return () => m.removeEventListener("change", fn);
  }
  m.addListener(fn);
  return () => m.removeListener(fn);
}

const getSnapshot = () => Boolean(mql()?.matches);

/** `true` quando o sistema pede menos movimento. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Deslocamento estável e determinístico a partir de um identificador, para
 * escalonar animações derivadas de um relógio compartilhado — sem isto, todos
 * os cards trocariam de foto no mesmo instante.
 */
export function offsetFromId(id, periodMs) {
  let h = 0;
  for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) | 0;
  return Math.abs(h) % Math.max(1, periodMs);
}

// ---- Pausa dos carrosséis ---------------------------------------------------
//
// O ticker "Encerrando" e a rotação de fotos dos cards e da galeria são
// CONTEÚDO, não enfeite de transição: com "reduzir movimento" ligado no
// sistema eles congelavam e a faixa ao vivo — que é a razão de existir do
// header — virava uma lista estática. Era o defeito relatado.
//
// Agora rodam sempre, e a pausa é explícita: passar o mouse, focar pelo
// teclado ou apertar o botão da faixa. É o que a WCAG 2.2.2 pede de conteúdo
// em movimento — um jeito de parar —, e sem isso a preferência do sistema
// virava um interruptor sem volta. As transições decorativas (fade, scale,
// confete) continuam obedecendo `prefers-reduced-motion`.
//
// O estado guardado é o INSTANTE da pausa, não um booleano: com ele o índice
// da foto continua sendo uma função pura do relógio, e pausar congela onde
// está em vez de saltar para a primeira foto.

const CHAVE_PAUSA = "leiloae:carrossel-pausado";

/** @type {number|null} */
let pausadoEm = (() => {
  try {
    const guardado = localStorage.getItem(CHAVE_PAUSA);
    return guardado ? Number(guardado) || Date.now() : null;
  } catch {
    return null; // navegação privada: a preferência simplesmente não persiste
  }
})();

const pausaListeners = new Set();

function subscribePausa(fn) {
  pausaListeners.add(fn);
  return () => pausaListeners.delete(fn);
}

const snapshotPausa = () => pausadoEm;

/**
 * Alterna (ou define) a pausa dos carrosséis.
 * @param {boolean} [valor]
 */
export function pausarCarrosseis(valor) {
  const querPausar = typeof valor === "boolean" ? valor : pausadoEm === null;
  pausadoEm = querPausar ? Date.now() : null;
  try {
    if (pausadoEm === null) localStorage.removeItem(CHAVE_PAUSA);
    else localStorage.setItem(CHAVE_PAUSA, String(pausadoEm));
  } catch {
    // sem persistência; o estado em memória continua valendo nesta aba
  }
  pausaListeners.forEach((fn) => fn());
}

/**
 * Estado da pausa dos carrosséis.
 * @returns {{pausado: boolean, pausadoEm: number|null, alternar: (valor?: boolean) => void}}
 */
export function useCarrosseis() {
  const instante = useSyncExternalStore(subscribePausa, snapshotPausa, () => null);
  return { pausado: instante !== null, pausadoEm: instante, alternar: pausarCarrosseis };
}
