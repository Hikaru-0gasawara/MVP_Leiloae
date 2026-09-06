// Limitação de taxa (SEC-007).
//
// `docs/api.md` marcava isto como obrigatório antes de expor à internet, e com
// razão: sem limite, `/auth/entrar` é um oráculo de força bruta e `/lances` é
// um caminho barato para inundar o banco de escritas.
//
// Balde de fichas (token bucket): cada chave acumula fichas a uma taxa fixa até
// um teto. Escolhido em vez de "N por janela" porque não tem a borda em que o
// atacante gasta a cota inteira no último instante de uma janela e de novo no
// primeiro da seguinte.
//
// LIMITE CONHECIDO: o estado é de PROCESSO. Com mais de uma instância, o limite
// efetivo multiplica pelo número de instâncias. Para valer em várias máquinas,
// isto precisa de armazenamento compartilhado (Redis) — está registrado em
// docs/api.md em vez de fingir que já protege um cluster.

/**
 * Perfis por tipo de rota. `custo` é quanto cada pedido consome.
 *
 * Ajustáveis por ambiente, porque o número certo depende do tráfego real e a
 * operação não deveria precisar de um deploy para afrouxar ou apertar:
 *   LEILOAE_LIMITE_AUTENTICACAO, LEILOAE_LIMITE_ESCRITA, LEILOAE_LIMITE_LEITURA
 * Cada um no formato "capacidade:porMinuto" — ex.: "10:1".
 */
function doAmbiente(nome, capacidadePadrao, porMinutoPadrao) {
  const bruto = process.env[`LEILOAE_LIMITE_${nome}`];
  const [cap, porMin] = String(bruto || "").split(":").map(Number);
  const capacidade = Number.isFinite(cap) && cap > 0 ? cap : capacidadePadrao;
  const porMinuto = Number.isFinite(porMin) && porMin > 0 ? porMin : porMinutoPadrao;
  return { capacidade, recargaPorSegundo: porMinuto / 60, custo: 1 };
}

export const PERFIS = {
  // Entrar/registrar/recuperar: caro de propósito — dez de imediato e uma por
  // minuto depois. Um ataque de dicionário fica inviável; uma pessoa que
  // errou a senha três vezes não sente.
  autenticacao: doAmbiente("AUTENTICACAO", 10, 1),
  // Escrita de lance: rápido o bastante para uma disputa real, longe de rajada.
  escrita: doAmbiente("ESCRITA", 30, 60),
  // Leitura: generoso; existe para conter varredura, não para atrapalhar.
  leitura: doAmbiente("LEITURA", 120, 240),
};

export function criarLimitador({ perfis = PERFIS, agora = () => Date.now() } = {}) {
  /** @type {Map<string, {fichas: number, em: number}>} */
  const baldes = new Map();

  /** Saldo do balde AGORA, já recarregado pelo tempo decorrido. */
  function recarregar(balde, p, t) {
    const decorrido = Math.max(0, t - balde.em) / 1000;
    balde.fichas = Math.min(p.capacidade, balde.fichas + decorrido * p.recargaPorSegundo);
    balde.em = t;
    return balde;
  }

  /**
   * Consome uma ficha.
   * @param {string} chave  identidade do cliente (IP, conta, ou os dois)
   * @param {keyof typeof PERFIS} perfil
   * @returns {{ok: true, restante: number} | {ok: false, esperarMs: number}}
   */
  function consumir(chave, perfil = "leitura") {
    const p = perfis[perfil] || perfis.leitura;
    const t = agora();
    const id = `${perfil}:${chave}`;
    const balde = recarregar(baldes.get(id) || { fichas: p.capacidade, em: t }, p, t);

    if (balde.fichas < p.custo) {
      baldes.set(id, balde);
      const faltam = p.custo - balde.fichas;
      return { ok: false, esperarMs: Math.ceil((faltam / p.recargaPorSegundo) * 1000) };
    }

    balde.fichas -= p.custo;
    baldes.set(id, balde);
    return { ok: true, restante: Math.floor(balde.fichas) };
  }

  /**
   * Descarta baldes cheios e parados. Sem isto, a memória cresce com o número
   * de IPs vistos — que é justamente o que um atacante controla.
   */
  function limpar(idadeMs = 3600_000) {
    const t = agora();
    for (const [id, balde] of baldes) {
      const p = perfis[id.split(":")[0]] || perfis.leitura;
      const paradoHaMuito = t - balde.em > idadeMs;
      // O saldo precisa ser recalculado AQUI. Comparar o valor congelado no
      // último uso nunca dá "cheio" para quem gastou uma ficha, e o mapa
      // cresceria com todo IP já visto — que é justamente o que o atacante
      // controla.
      const cheio = recarregar({ ...balde }, p, t).fichas >= p.capacidade;
      if (cheio && paradoHaMuito) baldes.delete(id);
    }
    return baldes.size;
  }

  return { consumir, limpar, get tamanho() { return baldes.size; } };
}

/**
 * Identidade do cliente para fins de limite.
 *
 * Só confia em `X-Forwarded-For` quando o processo foi explicitamente iniciado
 * atrás de um proxy (`LEILOAE_ATRAS_DE_PROXY=1`). Confiar sempre seria dar ao
 * atacante o poder de escolher a própria chave de limite — e escapar dele.
 */
export function identificar(req, { atrasDeProxy = false } = {}) {
  if (atrasDeProxy) {
    const encaminhado = req.headers["x-forwarded-for"];
    if (encaminhado) return String(encaminhado).split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "desconhecido";
}
