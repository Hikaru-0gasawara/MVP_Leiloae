// Lance automático, prorrogação e trilha de auditoria, no servidor.
//
// As três funcionalidades que estavam prometidas e não existiam: o teto era
// guardado e nunca usado, o lance no último segundo vencia por falta de tempo
// de resposta, e cancelar um lance apagava o rastro de que ele existiu.

import { describe, it, expect, beforeEach } from "vitest";
import { abrirBanco, semear, buscarLote, eventosDoLote } from "./db.js";
import { criarUsuario } from "./auth.js";
import { darLance, cancelarLance, meusLances } from "./bids.js";
import { minBidFor, JANELA_PRORROGACAO_MS } from "../src/domain/auction.js";

const SENHA = "senha-bem-comprida";
let db;

const LOTE = (over = {}) => ({
  id: "lote-a", category: "imovel", title: "Studio", appraised: 400000,
  minBid: 138000, currentBid: 142500, bids: 14, endsAt: Date.now() + 3600e3,
  photoIds: [], docs: [], rules: "", description: "", ...over,
});

const criar = (nome) => criarUsuario(db, { email: `${nome}@ex.com`, senha: SENHA, nome }).usuario;
const lances = () => db.prepare("SELECT * FROM lances ORDER BY criado_em, valor").all();

beforeEach(() => {
  db = abrirBanco(":memory:");
  semear(db, [LOTE()]);
});

describe("teto: o lance automático realmente acontece", () => {
  it("um teto sozinho não dispara lance contra ninguém", () => {
    const ana = criar("ana");
    const r = darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500, teto: 200000 });
    expect(r.lanceAutomatico).toBeNull();
    expect(buscarLote(db, "lote-a").currentBid).toBe(143500);
    expect(lances()).toHaveLength(1);
  });

  it("quem tem teto é coberto automaticamente quando outro lança", () => {
    const ana = criar("ana"), beto = criar("beto");
    darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500, teto: 200000 });

    // Beto cobre manualmente. O teto de Ana precisa responder.
    const r = darLance(db, { loteId: "lote-a", usuarioId: beto.id, valor: 150000 });

    expect(r.lanceAutomatico).not.toBeNull();
    expect(r.lanceAutomatico.value).toBe(151000); // 150.000 + incremento da faixa
    expect(r.lanceAutomatico.automatico).toBe(true);
    expect(r.lote.currentBid).toBe(151000);

    const lote = buscarLote(db, "lote-a");
    expect(lote.currentBid).toBe(151000);
    expect(lote.bids).toBe(14 + 3); // manual de Ana, manual de Beto, automático de Ana
  });

  it("o vencedor paga o necessário, não o teto", () => {
    const ana = criar("ana"), beto = criar("beto");
    darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500, teto: 300000 });
    darLance(db, { loteId: "lote-a", usuarioId: beto.id, valor: 160000 });

    expect(buscarLote(db, "lote-a").currentBid).toBe(161000);
    expect(buscarLote(db, "lote-a").currentBid).toBeLessThan(300000);
  });

  it("dois tetos: o maior vence um incremento acima do segundo", () => {
    const ana = criar("ana"), beto = criar("beto");
    darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500, teto: 300000 });
    // Beto entra com teto menor: é superado na hora, sem nunca liderar.
    darLance(db, { loteId: "lote-a", usuarioId: beto.id, valor: 150000, teto: 180000 });

    expect(buscarLote(db, "lote-a").currentBid).toBe(181000);
    const ultimo = lances().at(-1);
    expect(ultimo.usuario_id).toBe(ana.id);
    expect(ultimo.automatico).toBe(1);
  });

  it("um teto que não alcança o mínimo não gera lance nenhum", () => {
    const ana = criar("ana"), beto = criar("beto");
    darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500, teto: 144000 });
    darLance(db, { loteId: "lote-a", usuarioId: beto.id, valor: 150000 });
    // O teto de Ana (144.000) está abaixo do mínimo depois de Beto (151.000).
    expect(buscarLote(db, "lote-a").currentBid).toBe(150000);
    expect(lances()).toHaveLength(2);
  });

  it("o automático nunca ultrapassa o teto de quem o autorizou", () => {
    const ana = criar("ana"), beto = criar("beto");
    darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500, teto: 150500 });
    darLance(db, { loteId: "lote-a", usuarioId: beto.id, valor: 150000 });
    // Um incremento acima seria 151.000, acima do teto: para em 150.500.
    expect(buscarLote(db, "lote-a").currentBid).toBe(150500);
    expect(lances().at(-1).valor).toBe(150500);
  });

  it("o automático não escala sozinho: uma rodada não vira dez lances", () => {
    const ana = criar("ana"), beto = criar("beto");
    darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500, teto: 900000 });
    darLance(db, { loteId: "lote-a", usuarioId: beto.id, valor: 150000 });
    // Exatamente três lances: dois manuais e um automático.
    expect(lances()).toHaveLength(3);
    expect(buscarLote(db, "lote-a").currentBid).toBe(151000);
  });

  it("o lance automático não abre janela de cancelamento", () => {
    const ana = criar("ana"), beto = criar("beto");
    darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500, teto: 200000 });
    darLance(db, { loteId: "lote-a", usuarioId: beto.id, valor: 150000 });
    const automatico = lances().find((l) => l.automatico === 1);
    expect(automatico.cancelavel_ate).toBeNull();
  });

  it("o lance automático aparece em 'Meus lances' marcado como automático", () => {
    const ana = criar("ana"), beto = criar("beto");
    darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500, teto: 200000 });
    darLance(db, { loteId: "lote-a", usuarioId: beto.id, valor: 150000 });

    const meus = meusLances(db, ana.id);
    expect(meus).toHaveLength(2);
    expect(meus.some((e) => e.bid.automatico)).toBe(true);
  });

  it("cancelar o lance que carregava o teto tira a pessoa da disputa", () => {
    const ana = criar("ana"), beto = criar("beto");
    const primeiro = darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500, teto: 300000 });
    cancelarLance(db, { lanceId: primeiro.lance.id, usuarioId: ana.id });

    const r = darLance(db, { loteId: "lote-a", usuarioId: beto.id, valor: 150000 });
    expect(r.lanceAutomatico).toBeNull();
    expect(buscarLote(db, "lote-a").currentBid).toBe(150000);
  });
});

describe("prorrogação: o lance no último segundo não vence por relógio", () => {
  it("lance longe do fim não move o prazo", () => {
    const ana = criar("ana");
    const antes = buscarLote(db, "lote-a").endsAt;
    darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500 });
    expect(buscarLote(db, "lote-a").endsAt).toBe(antes);
  });

  it("lance nos segundos finais empurra o encerramento", () => {
    db.exec("DELETE FROM lotes");
    const agora = Date.now();
    semear(db, [LOTE({ id: "lote-b", endsAt: agora + 20_000 })]);
    const ana = criar("ana");

    darLance(db, { loteId: "lote-b", usuarioId: ana.id, valor: 143500 }, agora);

    const lote = buscarLote(db, "lote-b");
    expect(lote.endsAt).toBe(agora + JANELA_PRORROGACAO_MS);
    expect(lote.endsAt).toBeGreaterThan(lote.encerramentoOriginal);
  });

  it("o horário do edital fica registrado e não se move", () => {
    db.exec("DELETE FROM lotes");
    const agora = Date.now();
    const original = agora + 20_000;
    semear(db, [LOTE({ id: "lote-b", endsAt: original })]);
    const ana = criar("ana"), beto = criar("beto");

    darLance(db, { loteId: "lote-b", usuarioId: ana.id, valor: 143500 }, agora);
    darLance(db, { loteId: "lote-b", usuarioId: beto.id, valor: 144500 }, agora + 1000);

    expect(buscarLote(db, "lote-b").encerramentoOriginal).toBe(original);
  });

  it("lote já encerrado continua encerrado — prorrogação não ressuscita", () => {
    db.exec("DELETE FROM lotes");
    semear(db, [LOTE({ id: "lote-c", endsAt: Date.now() - 1000 })]);
    const ana = criar("ana");
    const r = darLance(db, { loteId: "lote-c", usuarioId: ana.id, valor: 999999 });
    expect(r.erro).toBe("ended");
    expect(buscarLote(db, "lote-c").endsAt).toBeLessThan(Date.now());
  });
});

describe("trilha de auditoria", () => {
  it("cada lance deixa um evento com autor, lote e valor", () => {
    const ana = criar("ana");
    darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500 });

    const eventos = eventosDoLote(db, "lote-a");
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ tipo: "lance", usuario_id: ana.id, valor: 143500 });
  });

  it("o lance automático é registrado como tal, apontando quem o disparou", () => {
    const ana = criar("ana"), beto = criar("beto");
    const primeiro = darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500, teto: 200000 });
    const segundo = darLance(db, { loteId: "lote-a", usuarioId: beto.id, valor: 150000 });

    const auto = eventosDoLote(db, "lote-a").find((e) => e.tipo === "lance-automatico");
    expect(auto).toBeTruthy();
    expect(auto.usuario_id).toBe(ana.id);
    expect(auto.detalhe.disparadoPor).toBe(segundo.lance.id);
    expect(primeiro.lance.id).not.toBe(auto.lance_id);
  });

  it("a prorrogação é registrada com o antes e o depois", () => {
    db.exec("DELETE FROM lotes");
    const agora = Date.now();
    semear(db, [LOTE({ id: "lote-b", endsAt: agora + 20_000 })]);
    darLance(db, { loteId: "lote-b", usuarioId: criar("ana").id, valor: 143500 }, agora);

    const evento = eventosDoLote(db, "lote-b").find((e) => e.tipo === "prorrogacao");
    expect(evento.detalhe).toEqual({ de: agora + 20_000, para: agora + JANELA_PRORROGACAO_MS });
  });

  it("cancelar não apaga o rastro: o lance sai da disputa, o evento fica", () => {
    const ana = criar("ana");
    const r = darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 143500 });
    cancelarLance(db, { lanceId: r.lance.id, usuarioId: ana.id });

    const eventos = eventosDoLote(db, "lote-a");
    expect(eventos.map((e) => e.tipo).sort()).toEqual(["cancelamento", "lance"]);
    // O evento do lance continua lá, com o valor original.
    expect(eventos.find((e) => e.tipo === "lance").valor).toBe(143500);
  });

  it("a trilha é só de inserção: a recusa de um lance não vira evento", () => {
    const ana = criar("ana");
    darLance(db, { loteId: "lote-a", usuarioId: ana.id, valor: 1 }); // abaixo do mínimo
    expect(eventosDoLote(db, "lote-a")).toHaveLength(0);
  });

  it("os eventos de uma transação desfeita não sobrevivem", () => {
    const ana = criar("ana");
    // Lote inexistente: nada é gravado, nem lance nem evento.
    darLance(db, { loteId: "nao-existe", usuarioId: ana.id, valor: 999999 });
    expect(db.prepare("SELECT COUNT(*) n FROM eventos").get().n).toBe(0);
  });
});

describe("as três juntas, no fluxo real", () => {
  it("disputa nos segundos finais: teto responde, prazo estica, tudo auditado", () => {
    db.exec("DELETE FROM lotes");
    const agora = Date.now();
    semear(db, [LOTE({ id: "final", endsAt: agora + 15_000 })]);
    const ana = criar("ana"), beto = criar("beto");

    darLance(db, { loteId: "final", usuarioId: ana.id, valor: 143500, teto: 250000 }, agora);
    const r = darLance(db, { loteId: "final", usuarioId: beto.id, valor: 200000 }, agora + 2000);

    const lote = buscarLote(db, "final");
    // 1. O teto de Ana respondeu.
    expect(r.lanceAutomatico.value).toBe(202000);
    expect(lote.currentBid).toBe(202000);
    // 2. Beto ganhou tempo de responder, em vez de perder pelo relógio.
    expect(lote.endsAt).toBe(agora + 2000 + JANELA_PRORROGACAO_MS);
    // 3. E tudo ficou registrado.
    // Os DOIS lances caíram dentro da janela final, então há duas prorrogações.
    const tipos = eventosDoLote(db, "final").map((e) => e.tipo).sort();
    expect(tipos).toEqual(["lance", "lance", "lance-automatico", "prorrogacao", "prorrogacao"]);
    // 4. O mínimo do próximo lance parte do valor real, não do de Beto.
    expect(minBidFor(lote)).toBe(204000);
  });
});
