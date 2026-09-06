// Item 6 do plano (DEVOPS-002).
//
// A telemetria tem duas garantias que precisam ser verificáveis, porque as duas
// falham em silêncio: não enviar nada quando não há endpoint configurado, e não
// carregar dado pessoal quando há.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const carregar = async (env) => {
  vi.resetModules();
  vi.stubEnv("VITE_ERROR_ENDPOINT", env.erro ?? "");
  vi.stubEnv("VITE_ANALYTICS_ENDPOINT", env.analytics ?? "");
  return import("./telemetry.js");
};

let beacons;
beforeEach(() => {
  beacons = [];
  navigator.sendBeacon = vi.fn((url, blob) => { beacons.push({ url, blob }); return true; });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); });

const corpo = async (i = 0) => JSON.parse(await beacons[i].blob.text());

describe("sem endpoint configurado", () => {
  it("não envia evento de funil", async () => {
    const t = await carregar({});
    t.track(t.FUNIL.confirmarLance, { lote: "lot-1", valor: 143500 });
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  it("não envia erro — registra no console e para por aí", async () => {
    const t = await carregar({});
    t.reportError(new Error("falhou"));
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("com endpoint configurado", () => {
  it("envia o evento de funil para o endpoint de analytics", async () => {
    const t = await carregar({ analytics: "https://exemplo.test/e" });
    t.track(t.FUNIL.confirmarLance, { lote: "lot-1", valor: 143500 });
    expect(beacons).toHaveLength(1);
    expect(beacons[0].url).toBe("https://exemplo.test/e");
    const c = await corpo();
    expect(c.evento).toBe("lance:confirmado");
    expect(c.lote).toBe("lot-1");
    expect(c.valor).toBe(143500);
  });

  it("envia o erro para o endpoint de erro", async () => {
    const t = await carregar({ erro: "https://exemplo.test/err" });
    t.reportError(new Error("quebrou"));
    expect(beacons[0].url).toBe("https://exemplo.test/err");
    expect((await corpo()).mensagem).toBe("quebrou");
  });

  it("a rota enviada não carrega a query, onde vai o que a pessoa digitou", async () => {
    const t = await carregar({ analytics: "https://exemplo.test/e" });
    window.history.replaceState({}, "", "/leiloes?busca=rua+da+minha+casa&email=eu@exemplo.com");
    t.track(t.FUNIL.verLote, { lote: "lot-1" });
    const c = await corpo();
    expect(c.rota).toBe("/leiloes");
    expect(JSON.stringify(c)).not.toMatch(/exemplo\.com|minha\+casa/);
    window.history.replaceState({}, "", "/");
  });

  it("limita o volume por sessão, para um erro em laço não virar enxurrada", async () => {
    const t = await carregar({ erro: "https://exemplo.test/err" });
    for (let i = 0; i < 60; i++) t.reportError(new Error("laço " + i));
    expect(beacons.length).toBeLessThanOrEqual(20);
  });

  it("uma falha no envio não propaga para quem chamou", async () => {
    const t = await carregar({ erro: "https://exemplo.test/err" });
    navigator.sendBeacon = vi.fn(() => { throw new Error("bloqueado"); });
    expect(() => t.reportError(new Error("x"))).not.toThrow();
  });
});
