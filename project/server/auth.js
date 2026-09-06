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

/** Regras mínimas de senha. Curtas demais são o vetor mais explorado. */
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
  return { usuario: { id, email: normalizado, nome: String(nome).trim() } };
}

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
  return { usuario: { id: linha.id, email: linha.email, nome: linha.nome } };
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
    `SELECT u.id, u.email, u.nome, s.expira_em
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ?`
  ).get(hashToken(token));
  if (!linha) return null;
  if (linha.expira_em <= agora) {
    db.prepare("DELETE FROM sessoes WHERE token_hash = ?").run(hashToken(token));
    return null;
  }
  return { id: linha.id, email: linha.email, nome: linha.nome };
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
