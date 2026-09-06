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
