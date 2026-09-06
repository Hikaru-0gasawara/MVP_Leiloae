// Relato de erro e eventos de funil (DEVOPS-002).
//
// A auditoria apontou que um erro em produção não chegaria a ninguém e que não
// havia como saber onde as pessoas desistem. Isto resolve as duas coisas sem
// SDK de terceiro: dois endpoints configuráveis e `sendBeacon`. Sem endpoint
// configurado, nada sai da máquina — o padrão é não enviar.
//
// Regra dura: nenhum dado pessoal entra na carga. Os eventos carregam
// identificadores de lote e valores de lance, que são públicos por natureza;
// nome, e-mail e qualquer conteúdo digitado ficam de fora.

const env = import.meta.env ?? {};

export const ERROR_ENDPOINT = env.VITE_ERROR_ENDPOINT || "";
export const ANALYTICS_ENDPOINT = env.VITE_ANALYTICS_ENDPOINT || "";

const RELEASE = env.VITE_RELEASE || "dev";
const MAX_POR_SESSAO = 20;
let enviados = 0;

function enviar(endpoint, corpo) {
  if (!endpoint || enviados >= MAX_POR_SESSAO) return false;
  enviados++;
  const payload = JSON.stringify({ ...corpo, release: RELEASE, ts: Date.now() });
  try {
    // sendBeacon sobrevive à navegação; o fetch é a alternativa quando não há.
    if (navigator.sendBeacon) {
      return navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }));
    }
    fetch(endpoint, { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "application/json" } })
      .catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/** Só a rota, sem query nem hash: a query pode carregar o que o usuário digitou. */
const rotaAtual = () => (typeof location === "undefined" ? "" : location.pathname);

/** Registra um erro. Sem endpoint configurado, fica no console e nada mais. */
export function reportError(erro, contexto = {}) {
  const dados = {
    tipo: "erro",
    mensagem: String(erro?.message || erro).slice(0, 300),
    stack: String(erro?.stack || "").slice(0, 2000),
    rota: rotaAtual(),
    ...contexto,
  };
  if (!ERROR_ENDPOINT) {
    console.error("[Leiloaê] erro não relatado (VITE_ERROR_ENDPOINT ausente):", dados.mensagem);
    return;
  }
  enviar(ERROR_ENDPOINT, dados);
}

/**
 * Evento de funil. `dados` deve conter apenas identificadores e números —
 * nunca texto digitado pelo usuário.
 */
export function track(evento, dados = {}) {
  if (!ANALYTICS_ENDPOINT) return;
  enviar(ANALYTICS_ENDPOINT, { tipo: "evento", evento, rota: rotaAtual(), ...dados });
}

/** Etapas do funil de lance, nomeadas num lugar só para não divergirem. */
export const FUNIL = {
  verLote: "lote:visto",
  abrirLance: "lance:aberto",
  confirmarLance: "lance:confirmado",
  cancelarLance: "lance:cancelado",
  arremate: "arremate:visto",
};

let instalado = false;

/** Liga a captura global. Idempotente. */
export function installTelemetry() {
  if (instalado || typeof window === "undefined") return;
  instalado = true;
  window.addEventListener("error", (e) => reportError(e.error || e.message, { origem: "window.error" }));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, { origem: "unhandledrejection" }));
  window.addEventListener("leiloae:error", (e) => reportError(e.detail?.error, { origem: "error-boundary" }));
}
