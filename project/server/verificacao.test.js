// Verificação de e-mail — a primeira das pendências registradas em
// docs/api.md ("sem verificação de e-mail no cadastro").
//
// O que estava errado antes: a conta funcionava sem que ninguém tivesse
// provado ler aquele endereço, e um e-mail digitado torto só aparecia quando a
// pessoa tentava recuperar a senha — o pior momento possível, porque é o
// momento em que ela já está trancada para fora.

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { abrirBanco } from "./db.js";
import {
  criarUsuario, criarSessao, usuarioDaSessao,
  abrirVerificacao, confirmarEmail, limparVerificacoes, VALIDADE_VERIFICACAO_MS,
} from "./auth.js";
import { mensagemDeVerificacao } from "./email.js";

const SENHA = "senha-bem-comprida";
let db;

beforeEach(() => {
  db = abrirBanco(":memory:");
});
afterAll(() => { try { db?.close(); } catch { /* já fechado */ } });

const conta = (email = "ana@ex.com") =>
  criarUsuario(db, { email, senha: SENHA, nome: "Ana" }).usuario;

describe("verificação de e-mail", () => {
  it("a conta nasce com o endereço não confirmado", () => {
    expect(conta().emailVerificado).toBe(false);
  });

  it("o token confirma o endereço, e a sessão passa a dizer isso", () => {
    const u = conta();
    const sessao = criarSessao(db, u.id);
    expect(usuarioDaSessao(db, sessao).emailVerificado).toBe(false);

    const { token } = abrirVerificacao(db, u.id);
    expect(confirmarEmail(db, token).ok).toBe(true);
    expect(usuarioDaSessao(db, sessao).emailVerificado).toBe(true);
  });

  it("confirmar NÃO derruba a sessão — nada que dê poder a um invasor mudou", () => {
    const u = conta();
    const sessao = criarSessao(db, u.id);
    const { token } = abrirVerificacao(db, u.id);
    confirmarEmail(db, token);
    // Ao contrário da redefinição de senha, que derruba tudo de propósito.
    expect(usuarioDaSessao(db, sessao)).not.toBeNull();
  });

  it("o token é de uso único", () => {
    const u = conta();
    const { token } = abrirVerificacao(db, u.id);
    expect(confirmarEmail(db, token).ok).toBe(true);
    expect(confirmarEmail(db, token).erro).toBe("token-invalido");
  });

  it("um pedido novo invalida o anterior", () => {
    const u = conta();
    const primeiro = abrirVerificacao(db, u.id).token;
    const segundo = abrirVerificacao(db, u.id).token;
    expect(confirmarEmail(db, primeiro).erro).toBe("token-invalido");
    expect(confirmarEmail(db, segundo).ok).toBe(true);
  });

  it("token vencido não confirma nada", () => {
    const u = conta();
    const agora = Date.now();
    const { token } = abrirVerificacao(db, u.id, agora);
    const depois = agora + VALIDADE_VERIFICACAO_MS + 1;
    expect(confirmarEmail(db, token, depois).erro).toBe("token-invalido");
    expect(usuarioDaSessao(db, criarSessao(db, u.id)).emailVerificado).toBe(false);
  });

  it("token inventado é recusado sem dizer nada sobre a conta", () => {
    conta();
    const r = confirmarEmail(db, "token-que-nunca-existiu");
    expect(r.erro).toBe("token-invalido");
    expect(JSON.stringify(r)).not.toMatch(/ana@ex\.com/);
  });

  it("endereço já confirmado não gera token novo", () => {
    const u = conta();
    confirmarEmail(db, abrirVerificacao(db, u.id).token);
    expect(abrirVerificacao(db, u.id)).toBeNull();
  });

  it("a limpeza tira o que já foi usado e o que venceu, e preserva o vivo", () => {
    const a = conta("a@ex.com");
    const b = conta("b@ex.com");
    const c = conta("c@ex.com");
    const agora = Date.now();

    confirmarEmail(db, abrirVerificacao(db, a.id, agora).token, agora); // usado
    abrirVerificacao(db, b.id, agora - VALIDADE_VERIFICACAO_MS - 1);    // vencido
    abrirVerificacao(db, c.id, agora);                                  // vivo

    limparVerificacoes(db, agora);
    expect(db.prepare("SELECT COUNT(*) AS n FROM verificacoes").get().n).toBe(1);
  });

  it("o token nunca aparece guardado em claro", () => {
    const u = conta();
    const { token } = abrirVerificacao(db, u.id);
    const linhas = JSON.stringify(db.prepare("SELECT * FROM verificacoes").all());
    expect(linhas).not.toContain(token);
  });

  it("o e-mail carrega o link e diz que a conta já funciona", () => {
    const m = mensagemDeVerificacao({
      nome: "Ana", email: "ana@ex.com", link: "https://x/verificar?token=abc", validadeHoras: 24,
    });
    expect(m.para).toBe("ana@ex.com");
    expect(m.texto).toContain("https://x/verificar?token=abc");
    expect(m.texto).toMatch(/já funciona/i);
  });
});
