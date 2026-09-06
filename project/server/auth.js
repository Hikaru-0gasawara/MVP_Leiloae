// Autenticação e sessão (SEC-003).
//
// Sem dependência: `scrypt` e `randomBytes` vêm do node:crypto. Decisões que
// importam, e por quê:
//
//  · A senha nunca é guardada — só o hash scrypt com sal por usuário.
//  · O token de sessão nunca é guardado em claro: o banco guarda o SHA-256.
//    Quem lê o banco não consegue se passar por ninguém.
//  · O cookie é HttpOnly (JavaScript não lê) e SameSite=Lax (não viaja em
//    requisição de outro site), o que fecha a porta de CSRF nas rotas de
//    escrita sem precisar de token separado.
//  · Login errado responde a mesma coisa para e-mail inexistente e senha
//    errada, e leva o mesmo tempo: não dá para enumerar quem tem conta.

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { novoId } from "./db.js";

const N = 16384, r = 8, p = 1, TAM = 64;
export const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;
export const COOKIE = "leiloae_sessao";

export function hashSenha(senha, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(senha, salt, TAM, { N, r, p }).toString("hex") };
}

export function senhaConfere(senha, salt, hashEsperado) {
  const calculado = scryptSync(senha, salt, TAM, { N, r, p });
  const esperado = Buffer.from(hashEsperado, "hex");
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

/**
 * Regras mínimas de senha. Curtas demais são o vetor mais explorado.
 * @param {{email?: any, senha?: any, nome?: any}} dados
 * @returns {string[]}
 */
export function validarCredenciais({ email, senha, nome }) {
  const erros = [];
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) erros.push("E-mail inválido.");
  if (!senha || String(senha).length < 10) erros.push("A senha precisa de pelo menos 10 caracteres.");
  if (String(senha || "").length > 200) erros.push("Senha longa demais.");
  if (nome !== undefined && (!nome || String(nome).trim().length < 2)) erros.push("Informe seu nome.");
  return erros;
}

export function criarUsuario(db, { email, senha, nome }) {
  const erros = validarCredenciais({ email, senha, nome });
  if (erros.length) return { erro: "dados-invalidos", mensagem: erros.join(" ") };

  const normalizado = String(email).trim().toLowerCase();
  if (db.prepare("SELECT id FROM usuarios WHERE email = ?").get(normalizado)) {
    return { erro: "email-em-uso", mensagem: "Já existe uma conta com esse e-mail." };
  }
  const { salt, hash } = hashSenha(senha);
  const id = novoId();
  db.prepare(
    "INSERT INTO usuarios (id, email, nome, senha_hash, salt, criado_em) VALUES (?,?,?,?,?,?)"
  ).run(id, normalizado, String(nome).trim(), hash, salt, Date.now());
  return { usuario: { id, email: normalizado, nome: String(nome).trim(), emailVerificado: false } };
}

/** Forma pública do usuário. Hash, sal e id de sessão nunca saem daqui. */
const usuarioPublico = (linha) => ({
  id: linha.id,
  email: linha.email,
  nome: linha.nome,
  emailVerificado: linha.email_verificado_em != null,
});

/** Sempre gasta o mesmo trabalho de scrypt, exista o usuário ou não. */
const SAL_FANTASMA = "0".repeat(32);
const HASH_FANTASMA = scryptSync("senha-que-ninguem-usa", SAL_FANTASMA, TAM, { N, r, p }).toString("hex");

export function autenticar(db, { email, senha }) {
  const normalizado = String(email || "").trim().toLowerCase();
  const linha = db.prepare("SELECT * FROM usuarios WHERE email = ?").get(normalizado);
  const ok = linha
    ? senhaConfere(String(senha || ""), linha.salt, linha.senha_hash)
    : (senhaConfere(String(senha || ""), SAL_FANTASMA, HASH_FANTASMA), false);
  if (!ok) return { erro: "credenciais-invalidas", mensagem: "E-mail ou senha incorretos." };
  return { usuario: usuarioPublico(linha) };
}

export function criarSessao(db, usuarioId, agora = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessoes (token_hash, usuario_id, criado_em, expira_em) VALUES (?,?,?,?)")
    .run(hashToken(token), usuarioId, agora, agora + DURACAO_SESSAO_MS);
  return token;
}

/** Resolve o usuário do token. Devolve null para token ausente, falso ou expirado. */
export function usuarioDaSessao(db, token, agora = Date.now()) {
  if (!token) return null;
  const linha = db.prepare(
    `SELECT u.id, u.email, u.nome, u.email_verificado_em, s.expira_em
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ?`
  ).get(hashToken(token));
  if (!linha) return null;
  if (linha.expira_em <= agora) {
    db.prepare("DELETE FROM sessoes WHERE token_hash = ?").run(hashToken(token));
    return null;
  }
  return usuarioPublico(linha);
}

export function encerrarSessao(db, token) {
  if (!token) return;
  db.prepare("DELETE FROM sessoes WHERE token_hash = ?").run(hashToken(token));
}

export function limparSessoesExpiradas(db, agora = Date.now()) {
  return db.prepare("DELETE FROM sessoes WHERE expira_em <= ?").run(agora).changes;
}

/** Lê um cookie do cabeçalho, sem confiar em espaçamento. */
export function lerCookie(cabecalho, nome) {
  if (!cabecalho) return null;
  for (const parte of String(cabecalho).split(";")) {
    const i = parte.indexOf("=");
    if (i === -1) continue;
    if (parte.slice(0, i).trim() === nome) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}

export function cookieDeSessao(token, { seguro = false, maxAge = DURACAO_SESSAO_MS } = {}) {
  const partes = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAge / 1000)}`,
  ];
  if (seguro) partes.push("Secure");
  return partes.join("; ");
}

export const cookieDeSaida = ({ seguro = false } = {}) =>
  cookieDeSessao("", { seguro, maxAge: 0 });

// ---------------------------------------------------------------------------
// Recuperação de senha
// ---------------------------------------------------------------------------
//
// Três decisões que fazem a diferença entre um fluxo de recuperação e um vetor
// de invasão:
//
//  · A resposta é a MESMA exista ou não a conta. Um fluxo que diz "e-mail não
//    encontrado" entrega a lista de clientes a quem perguntar.
//  · O token é de uso único, curto (30 min) e guardado como hash.
//  · Redefinir a senha DERRUBA TODAS AS SESSÕES da pessoa. Sem isso, quem
//    invadiu a conta continua dentro depois de a vítima trocar a senha —
//    que é justamente o momento em que ela acha que resolveu.

export const VALIDADE_RECUPERACAO_MS = 30 * 60 * 1000;

/**
 * Abre um pedido de recuperação. Devolve o token em claro APENAS para ser
 * entregue pelo canal configurado — ele nunca volta na resposta HTTP.
 *
 * @returns {{token: string, usuario: {id: string, email: string, nome: string}} | null}
 *          null quando não existe conta com esse e-mail (e o chamador responde
 *          exatamente a mesma coisa que responderia se existisse).
 */
export function abrirRecuperacao(db, email, agora = Date.now()) {
  const normalizado = String(email || "").trim().toLowerCase();
  const usuario = db.prepare("SELECT id, email, nome FROM usuarios WHERE email = ?").get(normalizado);
  if (!usuario) return null;

  // Um pedido novo invalida os anteriores: dois links vivos ao mesmo tempo
  // dobram a janela de quem interceptar um deles.
  db.prepare("DELETE FROM recuperacoes WHERE usuario_id = ? AND usado_em IS NULL").run(usuario.id);

  const token = randomBytes(32).toString("base64url");
  db.prepare(
    "INSERT INTO recuperacoes (token_hash, usuario_id, criado_em, expira_em, usado_em) VALUES (?,?,?,?,NULL)"
  ).run(hashToken(token), usuario.id, agora, agora + VALIDADE_RECUPERACAO_MS);

  return { token, usuario };
}

/**
 * Consome o token e troca a senha.
 * @returns {{ok: true, usuarioId: string} | {erro: string, mensagem: string}}
 */
export function redefinirSenha(db, { token, senha }, agora = Date.now()) {
  const erros = validarCredenciais({ email: "x@y.z", senha });
  if (erros.length) return { erro: "dados-invalidos", mensagem: erros.join(" ") };
  if (!token) return { erro: "token-invalido", mensagem: "Link inválido ou já usado." };

  db.exec("BEGIN IMMEDIATE");
  try {
    const linha = db.prepare("SELECT * FROM recuperacoes WHERE token_hash = ?").get(hashToken(token));
    const valido = linha && linha.usado_em == null && linha.expira_em > agora;
    if (!valido) {
      db.exec("ROLLBACK");
      return { erro: "token-invalido", mensagem: "Link inválido, expirado ou já usado." };
    }

    const { salt, hash } = hashSenha(senha);
    db.prepare("UPDATE usuarios SET senha_hash = ?, salt = ? WHERE id = ?").run(hash, salt, linha.usuario_id);
    db.prepare("UPDATE recuperacoes SET usado_em = ? WHERE token_hash = ?").run(agora, linha.token_hash);
    // Todas as sessões caem — inclusive a de quem tenha invadido a conta.
    db.prepare("DELETE FROM sessoes WHERE usuario_id = ?").run(linha.usuario_id);

    db.exec("COMMIT");
    return { ok: true, usuarioId: linha.usuario_id };
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* já desfeita */ }
    throw e;
  }
}

/** Remove pedidos vencidos ou já usados. */
export function limparRecuperacoes(db, agora = Date.now()) {
  return db.prepare("DELETE FROM recuperacoes WHERE expira_em <= ? OR usado_em IS NOT NULL")
    .run(agora).changes;
}

// ---------------------------------------------------------------------------
// Verificação de e-mail
// ---------------------------------------------------------------------------
//
// A conta funcionava antes de o endereço ser confirmado, e um e-mail digitado
// errado só aparecia quando a pessoa tentava recuperar a senha — no pior
// momento possível, o de já estar trancada para fora. Agora o cadastro dispara
// um link de confirmação.
//
// Duas decisões deliberadas:
//
//  · A conta continua funcionando sem verificação. Travar o lance atrás de um
//    e-mail que pode nunca chegar (provedor bloqueando, caixa cheia) trocaria
//    um problema raro por um que impede de usar o produto. O que muda é que a
//    interface diz, de forma visível, que o endereço ainda não foi confirmado.
//  · O token segue o desenho da recuperação: hash no banco, uso único,
//    validade curta. Pedir de novo invalida o link anterior.

export const VALIDADE_VERIFICACAO_MS = 24 * 60 * 60 * 1000;

/**
 * Abre um pedido de verificação e devolve o token em claro, apenas para ser
 * entregue pelo canal de e-mail. Devolve null se o endereço já está confirmado.
 *
 * @returns {{token: string, usuario: {id: string, email: string, nome: string}} | null}
 */
export function abrirVerificacao(db, usuarioId, agora = Date.now()) {
  const usuario = db.prepare(
    "SELECT id, email, nome, email_verificado_em FROM usuarios WHERE id = ?"
  ).get(usuarioId);
  if (!usuario || usuario.email_verificado_em != null) return null;

  db.prepare("DELETE FROM verificacoes WHERE usuario_id = ? AND usado_em IS NULL").run(usuario.id);
  const token = randomBytes(32).toString("base64url");
  db.prepare(
    "INSERT INTO verificacoes (token_hash, usuario_id, criado_em, expira_em, usado_em) VALUES (?,?,?,?,NULL)"
  ).run(hashToken(token), usuario.id, agora, agora + VALIDADE_VERIFICACAO_MS);

  return { token, usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome } };
}

/**
 * Consome o token e marca o endereço como confirmado.
 *
 * Diferente da redefinição de senha, NÃO derruba as sessões: aqui nada que dê
 * poder a um invasor mudou — confirmar um endereço não troca credencial.
 *
 * @returns {{ok: true, usuario: {id: string, email: string, nome: string, emailVerificado: true}}
 *          | {erro: string, mensagem: string}}
 */
export function confirmarEmail(db, token, agora = Date.now()) {
  if (!token) return { erro: "token-invalido", mensagem: "Link de confirmação inválido ou já usado." };

  db.exec("BEGIN IMMEDIATE");
  try {
    const linha = db.prepare("SELECT * FROM verificacoes WHERE token_hash = ?").get(hashToken(token));
    const valido = linha && linha.usado_em == null && linha.expira_em > agora;
    if (!valido) {
      db.exec("ROLLBACK");
      return { erro: "token-invalido", mensagem: "Link de confirmação inválido, expirado ou já usado." };
    }
    db.prepare("UPDATE usuarios SET email_verificado_em = ? WHERE id = ?").run(agora, linha.usuario_id);
    db.prepare("UPDATE verificacoes SET usado_em = ? WHERE token_hash = ?").run(agora, linha.token_hash);
    const usuario = db.prepare("SELECT id, email, nome FROM usuarios WHERE id = ?").get(linha.usuario_id);
    db.exec("COMMIT");
    return { ok: true, usuario: { ...usuario, emailVerificado: true } };
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* já desfeita */ }
    throw e;
  }
}

/** Remove pedidos de verificação vencidos ou já usados. */
export function limparVerificacoes(db, agora = Date.now()) {
  return db.prepare("DELETE FROM verificacoes WHERE expira_em <= ? OR usado_em IS NOT NULL")
    .run(agora).changes;
}
