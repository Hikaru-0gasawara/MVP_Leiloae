// Cliente HTTP da API (ARCH-001).
//
// Uma única porta para falar com o servidor. Toda resposta vira ou dado ou um
// `ErroDaApi` com código legível — a interface nunca inspeciona status HTTP
// solto, e nenhuma tela precisa saber o formato do erro.
//
// `credentials: "include"` porque a sessão é cookie HttpOnly: o token não passa
// por JavaScript em momento nenhum (SEC-003).

const env = import.meta.env ?? {};

/**
 * Base da API.
 *
 *  · ausente/vazio → modo demonstração: a aplicação roda toda no navegador,
 *    como antes de existir back-end, e continua publicável sem servidor.
 *  · "/"           → mesma origem (o próprio servidor Node serve o front).
 *  · uma URL       → API noutro domínio.
 */
const BASE_CONFIGURADA = String(env.VITE_API_URL ?? "");
export const TEM_SERVIDOR = BASE_CONFIGURADA !== "";
export const API_URL = BASE_CONFIGURADA === "/" ? "" : BASE_CONFIGURADA.replace(/\/$/, "");

/**
 * @typedef {object} DetalheDeErro
 * @property {string} [codigo]
 * @property {string} [mensagem]
 * @property {number} [status]
 * @property {unknown} [dados]
 */

export class ErroDaApi extends Error {
  /** @param {DetalheDeErro} detalhe */
  constructor({ codigo, mensagem, status, dados }) {
    super(mensagem || codigo || "Falha na comunicação com o servidor.");
    this.name = "ErroDaApi";
    this.codigo = codigo || "erro-desconhecido";
    this.status = status ?? 0;
    this.dados = dados || null;
  }
  /**
   * Apelido em português de `message`. A interface inteira lê `.mensagem`; sem
   * este apelido, toda explicação vinda do servidor virava o texto genérico de
   * reserva — e o usuário nunca saberia POR QUE o lance ou a entrada falhou.
   */
  get mensagem() {
    return this.message;
  }
  /** Erro de rede/servidor indisponível — vale oferecer "tentar de novo". */
  get temporario() {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }
  get precisaEntrar() {
    return this.status === 401;
  }
}

/**
 * @param {string} caminho
 * @param {{metodo?: string, corpo?: unknown, sinal?: AbortSignal}} [opcoes]
 * @returns {Promise<any>}
 */
async function pedir(caminho, { metodo = "GET", corpo, sinal } = {}) {
  let resposta;
  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      method: metodo,
      credentials: "include",
      signal: sinal,
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch (/** @type {any} */ e) {
    if (e?.name === "AbortError") throw e;
    // Rede fora, servidor caído, DNS: um caso só para a interface tratar.
    throw new ErroDaApi({ codigo: "sem-conexao", mensagem: "Não conseguimos falar com o servidor.", status: 0 });
  }

  /** @type {any} */
  let dados = null;
  try { dados = await resposta.json(); } catch { /* resposta sem corpo */ }

  if (!resposta.ok) {
    throw new ErroDaApi({
      codigo: dados?.erro,
      mensagem: dados?.mensagem,
      status: resposta.status,
      dados,
    });
  }
  return dados;
}

export const api = {
  saude: () => pedir("/api/v1/saude"),

  // sessão
  eu: (sinal) => pedir("/api/v1/auth/eu", { sinal }),
  registrar: (dados) => pedir("/api/v1/auth/registrar", { metodo: "POST", corpo: dados }),
  entrar: (dados) => pedir("/api/v1/auth/entrar", { metodo: "POST", corpo: dados }),
  sair: () => pedir("/api/v1/auth/sair", { metodo: "POST" }),

  // catálogo
  lotes: (sinal) => pedir("/api/v1/lotes", { sinal }),
  lote: (id, sinal) => pedir(`/api/v1/lotes/${encodeURIComponent(id)}`, { sinal }),

  // lances
  darLance: (loteId, { valor, teto }) =>
    pedir(`/api/v1/lotes/${encodeURIComponent(loteId)}/lances`, { metodo: "POST", corpo: { valor, teto } }),
  cancelarLance: (lanceId) =>
    pedir(`/api/v1/lances/${encodeURIComponent(lanceId)}/cancelar`, { metodo: "POST" }),
  meusLances: (sinal) => pedir("/api/v1/meus-lances", { sinal }),

  // favoritos
  salvos: (sinal) => pedir("/api/v1/salvos", { sinal }),
  alternarSalvo: (loteId) => pedir(`/api/v1/salvos/${encodeURIComponent(loteId)}`, { metodo: "POST" }),
};

/**
 * Assina o fluxo de eventos do servidor (BIZ-004).
 * @param {(lote: import("../tipos.js").Lote) => void} aoAtualizarLote
 * @returns {() => void} função para cancelar a assinatura
 */
export function assinarEventos(aoAtualizarLote) {
  if (!TEM_SERVIDOR || typeof EventSource === "undefined") return () => {};
  const fonte = new EventSource(`${API_URL}/api/v1/eventos`, { withCredentials: true });
  const aoReceber = (e) => {
    try { aoAtualizarLote(JSON.parse(e.data)); } catch { /* pedaço inválido: ignora */ }
  };
  fonte.addEventListener("lote", aoReceber);
  // O EventSource reconecta sozinho; o erro só importa para não poluir o console.
  fonte.onerror = () => {};
  return () => { fonte.removeEventListener("lote", aoReceber); fonte.close(); };
}
