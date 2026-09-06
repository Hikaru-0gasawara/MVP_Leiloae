// Contrato HTTP (BACK-001). Versionado em /api/v1 — ver docs/api.md.
//
// Nenhuma rota protegida lê o usuário do corpo ou da URL: quem está falando
// vem SEMPRE da sessão (SEC-003/004). É o que fecha a porta de IDOR — pedir
// pelo recurso de outra pessoa não retorna o recurso, retorna 404.

import {
  criarUsuario, autenticar, criarSessao, usuarioDaSessao, encerrarSessao,
  lerCookie, cookieDeSessao, cookieDeSaida, COOKIE,
  abrirRecuperacao, redefinirSenha, VALIDADE_RECUPERACAO_MS,
} from "./auth.js";
import { enviarEmail, mensagemDeRecuperacao, TEM_CANAL_EMAIL } from "./email.js";
import { listarLotes, buscarLote } from "./db.js";
import { darLance, cancelarLance, meusLances, listarSalvos, alternarSalvo } from "./bids.js";
import { criarLimitador, identificar } from "./ratelimit.js";

export const VERSAO_API = "1.0.0";
const PREFIXO = "/api/v1";

const LIMITE_CORPO = 16 * 1024; // nenhum pedido legítimo desta API é maior

/**
 * Erro com código HTTP. Antes era um `Error` com `.status` grudado depois —
 * funcionava, mas nada garantia que o campo existisse onde era lido.
 */
export class ErroHttp extends Error {
  /**
   * @param {number} status
   * @param {string} codigo
   * @param {string} [mensagem]
   */
  constructor(status, codigo, mensagem) {
    super(mensagem || codigo);
    this.name = "ErroHttp";
    this.status = status;
    this.codigo = codigo;
  }
}

/** Mapeia erro de domínio para código HTTP. Erro de regra não é erro de servidor. */
const STATUS = {
  "dados-invalidos": 400,
  "valor-invalido": 400,
  "teto-invalido": 400,
  "invalid": 400,
  "below-min": 409,
  "ended": 409,
  "fora-da-janela": 409,
  "email-em-uso": 409,
  "credenciais-invalidas": 401,
  "nao-autenticado": 401,
  "lote-inexistente": 404,
  "lance-inexistente": 404,
  "no-lot": 404,
  "excesso-de-pedidos": 429,
  "token-invalido": 400,
  "canal-indisponivel": 503,
};

/** Perfil de limite por rota. Ausente = leitura.
 *  @type {Array<[RegExp, "autenticacao"|"escrita"|"leitura"]>} */
const PERFIL_DA_ROTA = [
  [/^\/auth\/(entrar|registrar|recuperar|redefinir)$/, "autenticacao"],
  [/^\/lotes\/[\w-]+\/lances$/, "escrita"],
  [/^\/lances\/[\w-]+\/cancelar$/, "escrita"],
  [/^\/salvos\/[\w-]+$/, "escrita"],
];

/**
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<any>}
 */
export async function lerCorpo(req) {
  /** @type {Buffer[]} */
  const pedacos = [];
  let tamanho = 0;
  for await (const pedaco of req) {
    tamanho += pedaco.length;
    if (tamanho > LIMITE_CORPO) throw new ErroHttp(413, "corpo-grande-demais", "Pedido grande demais.");
    pedacos.push(Buffer.from(pedaco));
  }
  if (!pedacos.length) return {};
  try {
    return JSON.parse(Buffer.concat(pedacos).toString("utf8"));
  } catch {
    throw new ErroHttp(400, "json-invalido", "Corpo da requisição não é JSON válido.");
  }
}

/**
 * @typedef {object} ContextoDeRotas
 * @property {any} db conexão node:sqlite
 * @property {boolean} [seguro] marca o cookie como Secure (produção em https)
 * @property {(lote: any) => void} [aoMudarLote] publica o lote no fluxo ao vivo
 * @property {boolean} [atrasDeProxy] confiar em X-Forwarded-For
 * @property {string} [urlBase] origem pública, para montar o link de recuperação
 * @property {any} [limitador] injetável nos testes
 */

/**
 * Constrói o roteador.
 * @param {ContextoDeRotas} ctx
 * @returns {(req: import("node:http").IncomingMessage, caminho: string) =>
 *   Promise<{status?: number, corpo: any, cookie?: string, cabecalhos?: Record<string,string>}|null>}
 */
export function criarRotas(ctx) {
  const { db } = ctx;
  const limitador = ctx.limitador || criarLimitador();

  const exigirSessao = (req) => {
    const token = lerCookie(req.headers.cookie, COOKIE);
    const usuario = usuarioDaSessao(db, token);
    if (!usuario) throw new ErroHttp(401, "nao-autenticado", "Entre na sua conta para continuar.");
    return usuario;
  };

  const publicarLote = (loteId) => ctx.aoMudarLote?.(buscarLote(db, loteId));

  /** @type {Array<[string, RegExp, Function]>} */
  const rotas = [
    ["GET", /^\/saude$/, () => ({
      corpo: { ok: true, versao: VERSAO_API, agora: Date.now() },
    })],

    // ---- sessão -----------------------------------------------------------
    ["POST", /^\/auth\/registrar$/, async (req) => {
      const corpo = await lerCorpo(req);
      const r = criarUsuario(db, corpo);
      if ("erro" in r) return { status: STATUS[r.erro] || 400, corpo: r };
      const token = criarSessao(db, r.usuario.id);
      return { status: 201, corpo: { usuario: r.usuario }, cookie: cookieDeSessao(token, ctx) };
    }],

    ["POST", /^\/auth\/entrar$/, async (req) => {
      const corpo = await lerCorpo(req);
      const r = autenticar(db, corpo);
      if ("erro" in r) return { status: STATUS[r.erro] || 401, corpo: r };
      const token = criarSessao(db, r.usuario.id);
      return { corpo: { usuario: r.usuario }, cookie: cookieDeSessao(token, ctx) };
    }],

    ["POST", /^\/auth\/sair$/, (req) => {
      encerrarSessao(db, lerCookie(req.headers.cookie, COOKIE));
      return { corpo: { ok: true }, cookie: cookieDeSaida(ctx) };
    }],

    // Pedir link de recuperação. A resposta é IDÊNTICA exista ou não a conta —
    // um "e-mail não encontrado" entregaria a lista de clientes a quem
    // perguntar, um por vez.
    ["POST", /^\/auth\/recuperar$/, async (req) => {
      if (!TEM_CANAL_EMAIL) {
        return {
          status: 503,
          corpo: {
            erro: "canal-indisponivel",
            mensagem: "A recuperação por e-mail não está configurada neste ambiente.",
          },
        };
      }
      const { email } = await lerCorpo(req);
      const pedido = abrirRecuperacao(db, email);
      if (pedido) {
        const link = `${ctx.urlBase || ""}/redefinir?token=${encodeURIComponent(pedido.token)}`;
        const envio = await enviarEmail(mensagemDeRecuperacao({
          nome: pedido.usuario.nome,
          email: pedido.usuario.email,
          link,
          validadeMinutos: Math.round(VALIDADE_RECUPERACAO_MS / 60000),
        }));
        // Falha de entrega vira log, não resposta diferente: a resposta
        // diferente é que revelaria a existência da conta.
        if (!envio.ok) console.error("[Leiloaê] falha ao enviar recuperação:", envio.erro);
      }
      return {
        corpo: {
          ok: true,
          mensagem: "Se existir uma conta com esse e-mail, o link de redefinição foi enviado.",
        },
      };
    }],

    ["POST", /^\/auth\/redefinir$/, async (req) => {
      const { token, senha } = await lerCorpo(req);
      const r = redefinirSenha(db, { token, senha });
      if ("erro" in r) return { status: STATUS[r.erro] || 400, corpo: r };
      // A senha mudou e todas as sessões caíram, inclusive a de quem estivesse
      // dentro: quem redefiniu precisa entrar de novo, de propósito.
      return { corpo: { ok: true }, cookie: cookieDeSaida(ctx) };
    }],

    ["GET", /^\/auth\/eu$/, (req) => {
      const usuario = usuarioDaSessao(db, lerCookie(req.headers.cookie, COOKIE));
      return { corpo: { usuario: usuario || null } };
    }],

    // ---- catálogo (público) -----------------------------------------------
    ["GET", /^\/lotes$/, () => ({
      corpo: { lotes: listarLotes(db), agora: Date.now() },
    })],

    ["GET", /^\/lotes\/([\w-]+)$/, (req, [id]) => {
      const lote = buscarLote(db, id);
      if (!lote) return { status: 404, corpo: { erro: "lote-inexistente", mensagem: "Lote não encontrado." } };
      return { corpo: { lote, agora: Date.now() } };
    }],

    // ---- lances (exige sessão) --------------------------------------------
    ["POST", /^\/lotes\/([\w-]+)\/lances$/, async (req, [loteId]) => {
      const usuario = exigirSessao(req);
      const { valor, teto } = await lerCorpo(req);
      const r = darLance(db, { loteId, usuarioId: usuario.id, valor, teto });
      if ("erro" in r) return { status: STATUS[r.erro] || 400, corpo: r };
      publicarLote(loteId);
      return { status: 201, corpo: r };
    }],

    ["POST", /^\/lances\/([\w-]+)\/cancelar$/, (req, [lanceId]) => {
      const usuario = exigirSessao(req);
      const r = cancelarLance(db, { lanceId, usuarioId: usuario.id });
      if ("erro" in r) return { status: STATUS[r.erro] || 400, corpo: r };
      publicarLote(r.loteId);
      return { corpo: r };
    }],

    ["GET", /^\/meus-lances$/, (req) => {
      const usuario = exigirSessao(req);
      return { corpo: { lances: meusLances(db, usuario.id), agora: Date.now() } };
    }],

    // ---- favoritos (exige sessão) -----------------------------------------
    ["GET", /^\/salvos$/, (req) => {
      const usuario = exigirSessao(req);
      return { corpo: { salvos: listarSalvos(db, usuario.id) } };
    }],

    ["POST", /^\/salvos\/([\w-]+)$/, (req, [loteId]) => {
      const usuario = exigirSessao(req);
      const r = alternarSalvo(db, { usuarioId: usuario.id, loteId });
      if ("erro" in r) return { status: STATUS[r.erro] || 400, corpo: r };
      return { corpo: r };
    }],
  ];

  /** Resolve um pedido. Devolve null quando a URL não é da API. */
  return async function despachar(req, caminho) {
    if (!caminho.startsWith(PREFIXO)) return null;
    const relativo = caminho.slice(PREFIXO.length) || "/";

    // Limite ANTES de qualquer trabalho: o pedido recusado não deve custar uma
    // consulta ao banco nem um scrypt, que é o que o atacante quer arrancar.
    const perfil = PERFIL_DA_ROTA.find(([padrao]) => padrao.test(relativo))?.[1] || "leitura";
    const cliente = identificar(req, { atrasDeProxy: Boolean(ctx.atrasDeProxy) });
    const cota = limitador.consumir(cliente, perfil);
    if (!cota.ok) {
      return {
        status: 429,
        corpo: {
          erro: "excesso-de-pedidos",
          mensagem: "Muitos pedidos em pouco tempo. Espere um instante e tente de novo.",
        },
        cabecalhos: { "Retry-After": String(Math.ceil(cota.esperarMs / 1000)) },
      };
    }

    let achouCaminho = false;
    for (const [metodo, padrao, manipulador] of rotas) {
      const m = padrao.exec(relativo);
      if (!m) continue;
      achouCaminho = true;
      if (req.method !== metodo) continue;
      return await manipulador(req, m.slice(1));
    }
    return {
      status: achouCaminho ? 405 : 404,
      corpo: { erro: achouCaminho ? "metodo-nao-permitido" : "rota-inexistente" },
    };
  };
}
