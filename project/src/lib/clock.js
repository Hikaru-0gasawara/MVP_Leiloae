// Relógio único da aplicação.
//
// Antes cada <Countdown> criava seu próprio setInterval: 56 timers ativos e
// ~38 mutações de DOM por segundo na listagem, sem pausar em aba oculta
// (FRONT-004). Agora há um único intervalo, compartilhado por todos os
// consumidores e suspenso enquanto a aba não está visível.

import { useSyncExternalStore } from "react";

const TICK_MS = 1000;

let now = Date.now();
let timer = null;
const listeners = new Set();

function tick() {
  now = Date.now();
  listeners.forEach((fn) => fn());
}

function isHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function start() {
  if (timer !== null || listeners.size === 0 || isHidden()) return;
  timer = setInterval(tick, TICK_MS);
}

function stop() {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

function handleVisibility() {
  if (isHidden()) {
    stop();
  } else {
    tick(); // recupera o tempo perdido antes de voltar a contar
    start();
  }
}

function subscribe(fn) {
  // Atualiza antes de assinar: entre a carga do módulo e o primeiro consumidor
  // (ou depois de um período sem assinantes) o instante guardado fica velho, e
  // um lote encerrado apareceria como aberto. O React relê o snapshot após
  // assinar, então a primeira renderização já sai correta.
  now = Date.now();
  listeners.add(fn);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", handleVisibility);
    start();
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    }
  };
}

const getSnapshot = () => now;

/** Instante atual, atualizado uma vez por segundo para toda a aplicação. */
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ---- Visibilidade da aba ----------------------------------------------------
// Mesma ideia do relógio, para qualquer animação periódica: um único ouvinte de
// visibilitychange, compartilhado. Sem isto cada carrossel de card continuava
// trocando imagens numa aba oculta (medido: 14 timers e ~14 mutações de DOM por
// segundo com a aba em segundo plano).

const visListeners = new Set();

function notifyVisibility() {
  visListeners.forEach((fn) => fn());
}

function subscribeVisibility(fn) {
  visListeners.add(fn);
  if (visListeners.size === 1) document.addEventListener("visibilitychange", notifyVisibility);
  return () => {
    visListeners.delete(fn);
    if (visListeners.size === 0) document.removeEventListener("visibilitychange", notifyVisibility);
  };
}

const isVisible = () => !isHidden();

/** `true` enquanto a aba está visível. Use para suspender animações periódicas. */
export function usePageVisible() {
  return useSyncExternalStore(subscribeVisibility, isVisible, () => true);
}

/** Somente para testes: quantos intervalos o relógio mantém ativos (0 ou 1). */
export function __activeTimers() {
  return timer === null ? 0 : 1;
}
