// O cliente da API e a classe de erro que a interface inteira consome.
//
// O apelido `.mensagem` tem teste próprio porque a falha dele é invisível: a
// tela continua funcionando e só troca a explicação do servidor por um texto
// genérico. Foi assim que "E-mail ou senha incorretos" virou "Não foi possível
// continuar" sem ninguém notar.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ErroDaApi } from "./client.js";

describe("ErroDaApi", () => {
  it("expõe a mensagem do servidor em português e em `message`", () => {
    const e = new ErroDaApi({ codigo: "credenciais-invalidas", mensagem: "E-mail ou senha incorretos.", status: 401 });
    expect(e.mensagem).toBe("E-mail ou senha incorretos.");
    expect(e.message).toBe(e.mensagem);
    expect(e.codigo).toBe("credenciais-invalidas");
  });

  it("cai para o código, e depois para um texto padrão, quando falta mensagem", () => {
    expect(new ErroDaApi({ codigo: "ended", status: 409 }).mensagem).toBe("ended");
    expect(new ErroDaApi({}).mensagem).toMatch(/servidor/i);
  });

  it("separa erro temporário de erro definitivo", () => {
    expect(new ErroDaApi({ status: 0 }).temporario).toBe(true);   // rede fora
    expect(new ErroDaApi({ status: 503 }).temporario).toBe(true); // servidor fora
    expect(new ErroDaApi({ status: 429 }).temporario).toBe(true); // muitos pedidos
    expect(new ErroDaApi({ status: 409 }).temporario).toBe(false); // superado: reenviar não ajuda
    expect(new ErroDaApi({ status: 400 }).temporario).toBe(false);
  });

  it("marca o caso em que a saída é entrar na conta", () => {
    expect(new ErroDaApi({ status: 401 }).precisaEntrar).toBe(true);
    expect(new ErroDaApi({ status: 403 }).precisaEntrar).toBe(false);
  });

  it("continua sendo um Error de verdade", () => {
    const e = new ErroDaApi({ mensagem: "x" });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ErroDaApi");
  });
});

describe("api", () => {
  let original;
  beforeEach(() => { original = global.fetch; });
  afterEach(() => { global.fetch = original; });

  const carregar = async () => { vi.resetModules(); return import("./client.js"); };

  it("rede fora vira 'sem-conexao', não uma exceção crua", async () => {
    global.fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    const { api } = await carregar();
    await expect(api.lotes()).rejects.toMatchObject({ codigo: "sem-conexao", status: 0, temporario: true });
  });

  it("resposta de erro carrega código, mensagem e status do servidor", async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false, status: 409,
      json: () => Promise.resolve({ erro: "below-min", mensagem: "O lance mínimo agora é R$ 143.500.", min: 143500 }),
    }));
    const { api } = await carregar();
    await expect(api.darLance("lote-a", { valor: 1 })).rejects.toMatchObject({
      codigo: "below-min", status: 409,
    });
  });

  it("envia o cookie de sessão junto (a sessão é HttpOnly)", async () => {
    const chamadas = [];
    global.fetch = vi.fn((url, opcoes) => {
      chamadas.push({ url, opcoes });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });
    const { api } = await carregar();
    await api.meusLances();
    expect(chamadas[0].opcoes.credentials).toBe("include");
  });

  it("o corpo vai como JSON, nunca na URL", async () => {
    const chamadas = [];
    global.fetch = vi.fn((url, opcoes) => {
      chamadas.push({ url, opcoes });
      return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve({}) });
    });
    const { api } = await carregar();
    await api.entrar({ email: "a@ex.com", senha: "senha-bem-comprida" });
    expect(chamadas[0].url).not.toContain("senha");
    expect(JSON.parse(chamadas[0].opcoes.body)).toEqual({ email: "a@ex.com", senha: "senha-bem-comprida" });
  });
});
