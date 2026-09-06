// Entrega de mensagens transacionais.
//
// Não há servidor de e-mail neste projeto, e inventar um seria o mesmo defeito
// que a auditoria apontou no formulário de contato (SEC-002): confirmar o envio
// e descartar a mensagem.
//
// Então o canal é explícito:
//
//  · `LEILOAE_EMAIL_ENDPOINT` definido → a mensagem é entregue por POST a esse
//    endereço (um webhook para o provedor que a operação usar). É o ponto de
//    integração; trocar de provedor é trocar o endpoint.
//  · Nada definido → o canal NÃO existe, e quem chama recebe isso como
//    resposta. A interface diz "recuperação indisponível", em vez de dizer
//    "enviamos um link" para um link que não foi a lugar nenhum.
//
// Fora de produção, sem endpoint, a mensagem é impressa no log do servidor —
// o suficiente para desenvolver e testar o fluxo inteiro.

export const EMAIL_ENDPOINT = process.env.LEILOAE_EMAIL_ENDPOINT || "";
export const TEM_CANAL_EMAIL = Boolean(EMAIL_ENDPOINT) || process.env.NODE_ENV !== "production";

/**
 * @param {{para: string, assunto: string, texto: string}} mensagem
 * @returns {Promise<{ok: boolean, canal: "endpoint"|"log"|"nenhum", erro?: string}>}
 */
export async function enviarEmail(mensagem) {
  if (EMAIL_ENDPOINT) {
    try {
      const r = await fetch(EMAIL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mensagem),
      });
      if (!r.ok) return { ok: false, canal: "endpoint", erro: `HTTP ${r.status}` };
      return { ok: true, canal: "endpoint" };
    } catch (/** @type {any} */ e) {
      return { ok: false, canal: "endpoint", erro: String(e?.message || e) };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    // O corpo vai para o log de desenvolvimento de propósito: é o único jeito
    // de exercitar o fluxo sem provedor. Em produção este ramo não roda.
    console.log(
      `\n[Leiloaê · e-mail de desenvolvimento]\n  para: ${mensagem.para}\n` +
      `  assunto: ${mensagem.assunto}\n  ${mensagem.texto.replace(/\n/g, "\n  ")}\n`
    );
    return { ok: true, canal: "log" };
  }

  return { ok: false, canal: "nenhum", erro: "LEILOAE_EMAIL_ENDPOINT não configurado" };
}

/** Corpo do e-mail de recuperação. */
export function mensagemDeRecuperacao({ nome, email, link, validadeMinutos }) {
  return {
    para: email,
    assunto: "Redefinir sua senha no Leiloaê",
    texto:
      `Oi, ${nome}.\n\n` +
      `Alguém pediu para redefinir a senha desta conta. Se foi você, abra o link abaixo:\n\n` +
      `${link}\n\n` +
      `O link vale por ${validadeMinutos} minutos e só pode ser usado uma vez.\n` +
      `Se não foi você, não precisa fazer nada — sua senha continua a mesma.\n`,
  };
}
