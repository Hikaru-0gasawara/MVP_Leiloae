// Recuperação de senha.
//
// Um fluxo de recuperação mal feito é a porta mais larga de um sistema de
// contas: revela quem tem conta, aceita link reusado, e — o pior — deixa quem
// invadiu continuar dentro depois de a vítima trocar a senha.

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { abrirBanco, semear } from "./db.js";
import {
  criarUsuario, autenticar, criarSessao, usuarioDaSessao,
  abrirRecuperacao, redefinirSenha, limparRecuperacoes, VALIDADE_RECUPERACAO_MS,
} from "./auth.js";
import { criarServidor } from "./index.js";
import { criarLimitador } from "./ratelimit.js";
import { scheduledEnd } from "../src/domain/schedule.js";

const SENHA = "senha-bem-comprida";
const NOVA = "senha-nova-tambem-longa";
let db;

const criar = (email = "ana@ex.com") =>
  criarUsuario(db, { email, senha: SENHA, nome: "Ana" }).usuario;

beforeEach(() => { db = abrirBanco(":memory:"); });

describe("abrir pedido", () => {
  it("devolve um token para conta existente", () => {
    const ana = criar();
    const pedido = abrirRecuperacao(db, "ana@ex.com");
    expect(pedido.usuario.id).toBe(ana.id);
    expect(pedido.token).toHaveLength(43); // 32 bytes em base64url
  });

  it("devolve null para conta inexistente — quem chama responde igual nos dois casos", () => {
    expect(abrirRecuperacao(db, "ninguem@ex.com")).toBeNull();
  });

  it("aceita o e-mail com outra caixa", () => {
    criar("Ana@Exemplo.com");
    expect(abrirRecuperacao(db, "ana@exemplo.com")).not.toBeNull();
  });

  it("o token não fica em claro no banco", () => {
    criar();
    const { token } = abrirRecuperacao(db, "ana@ex.com");
    const linhas = db.prepare("SELECT * FROM recuperacoes").all();
    expect(JSON.stringify(linhas)).not.toContain(token);
  });

  it("um pedido novo invalida o anterior", () => {
    criar();
    const primeiro = abrirRecuperacao(db, "ana@ex.com");
    const segundo = abrirRecuperacao(db, "ana@ex.com");

    expect(redefinirSenha(db, { token: primeiro.token, senha: NOVA }).erro).toBe("token-invalido");
    expect(redefinirSenha(db, { token: segundo.token, senha: NOVA }).ok).toBe(true);
  });
});

describe("redefinir", () => {
  it("troca a senha e a antiga deixa de valer", () => {
    criar();
    const { token } = abrirRecuperacao(db, "ana@ex.com");

    expect(redefinirSenha(db, { token, senha: NOVA }).ok).toBe(true);
    expect(autenticar(db, { email: "ana@ex.com", senha: SENHA }).erro).toBe("credenciais-invalidas");
    expect(autenticar(db, { email: "ana@ex.com", senha: NOVA }).usuario).toBeTruthy();
  });

  it("DERRUBA todas as sessões abertas", () => {
    // O ponto do teste: se quem invadiu continua com sessão viva depois da
    // troca de senha, a vítima acha que resolveu e não resolveu nada.
    const ana = criar();
    const sessaoDaVitima = criarSessao(db, ana.id);
    const sessaoDoInvasor = criarSessao(db, ana.id);
    expect(usuarioDaSessao(db, sessaoDoInvasor)).not.toBeNull();

    const { token } = abrirRecuperacao(db, "ana@ex.com");
    redefinirSenha(db, { token, senha: NOVA });

    expect(usuarioDaSessao(db, sessaoDoInvasor)).toBeNull();
    expect(usuarioDaSessao(db, sessaoDaVitima)).toBeNull();
  });

  it("o token é de uso único", () => {
    criar();
    const { token } = abrirRecuperacao(db, "ana@ex.com");
    expect(redefinirSenha(db, { token, senha: NOVA }).ok).toBe(true);
    expect(redefinirSenha(db, { token, senha: "terceira-senha-longa" }).erro).toBe("token-invalido");
    // E a senha continua sendo a segunda, não a terceira.
    expect(autenticar(db, { email: "ana@ex.com", senha: NOVA }).usuario).toBeTruthy();
  });

  it("token expirado não vale", () => {
    criar();
    const { token } = abrirRecuperacao(db, "ana@ex.com");
    const depois = Date.now() + VALIDADE_RECUPERACAO_MS + 1000;
    expect(redefinirSenha(db, { token, senha: NOVA }, depois).erro).toBe("token-invalido");
  });

  it("token inventado, vazio ou ausente não vale", () => {
    criar();
    for (const t of ["inventado", "", null, undefined]) {
      expect(redefinirSenha(db, { token: t, senha: NOVA }).erro).toBeTruthy();
    }
  });

  it("a nova senha passa pelas mesmas regras", () => {
    criar();
    const { token } = abrirRecuperacao(db, "ana@ex.com");
    expect(redefinirSenha(db, { token, senha: "curta" }).erro).toBe("dados-invalidos");
    // E o token continua válido: a recusa foi da senha, não do link.
    expect(redefinirSenha(db, { token, senha: NOVA }).ok).toBe(true);
  });

  it("limpar remove vencidos e usados, e preserva os vivos", () => {
    criar("a@ex.com");
    criar("b@ex.com");
    const usado = abrirRecuperacao(db, "a@ex.com");
    redefinirSenha(db, { token: usado.token, senha: NOVA });
    abrirRecuperacao(db, "b@ex.com"); // vivo

    expect(limparRecuperacoes(db)).toBe(1);
    expect(db.prepare("SELECT COUNT(*) n FROM recuperacoes").get().n).toBe(1);
  });
});

describe("pela rede", () => {
  // Banco próprio: o `beforeEach` lá de cima troca `db` a cada teste, e o
  // servidor guarda a conexão que recebeu ao subir.
  let servidor, base, dbRede;

  beforeAll(async () => {
    dbRede = abrirBanco(":memory:");
    const db = dbRede;
    semear(db, [{
      id: "lote-a", category: "imovel", title: "Studio", appraised: 215000, minBid: 138000,
      currentBid: 142500, bids: 14, endsAt: scheduledEnd(20),
      photoIds: [], docs: [], rules: "", description: "",
    }]);
    servidor = criarServidor({
      db, servirEstaticos: false, seguro: false, urlBase: "https://leiloae.test",
      limitador: criarLimitador({
        perfis: {
          autenticacao: { capacidade: 1e6, recargaPorSegundo: 1e6, custo: 1 },
          escrita: { capacidade: 1e6, recargaPorSegundo: 1e6, custo: 1 },
          leitura: { capacidade: 1e6, recargaPorSegundo: 1e6, custo: 1 },
        },
      }),
    });
    await new Promise((ok) => servidor.listen(0, ok));
    base = `http://localhost:${servidor.address().port}/api/v1`;
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(async () => { await new Promise((ok) => servidor.close(ok)); });

  const post = async (caminho, corpo) => {
    const r = await fetch(base + caminho, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  };

  it("a resposta é a mesma para conta existente e inexistente", async () => {
    await post("/auth/registrar", { email: "existe@ex.com", senha: SENHA, nome: "Existe" });

    const comConta = await post("/auth/recuperar", { email: "existe@ex.com" });
    const semConta = await post("/auth/recuperar", { email: "naoexiste@ex.com" });

    expect(comConta.status).toBe(semConta.status);
    expect(comConta.json).toEqual(semConta.json);
  });

  it("a resposta nunca carrega o token", async () => {
    const r = await post("/auth/recuperar", { email: "existe@ex.com" });
    const linha = dbRede.prepare("SELECT token_hash FROM recuperacoes ORDER BY criado_em DESC").get();
    expect(JSON.stringify(r.json)).not.toContain(linha.token_hash);
    expect(JSON.stringify(r.json)).not.toMatch(/token/i);
  });

  it("o fluxo completo funciona ponta a ponta", async () => {
    await post("/auth/registrar", { email: "fluxo@ex.com", senha: SENHA, nome: "Fluxo" });
    const pedido = abrirRecuperacao(dbRede, "fluxo@ex.com");

    expect((await post("/auth/redefinir", { token: pedido.token, senha: NOVA })).status).toBe(200);
    expect((await post("/auth/entrar", { email: "fluxo@ex.com", senha: SENHA })).status).toBe(401);
    expect((await post("/auth/entrar", { email: "fluxo@ex.com", senha: NOVA })).status).toBe(200);
  });

  it("token inválido é 400, não 500", async () => {
    const r = await post("/auth/redefinir", { token: "nao-existe", senha: NOVA });
    expect(r.status).toBe(400);
    expect(r.json.erro).toBe("token-invalido");
  });
});
