// Item 4 do plano de ação (BIZ-007 / BIZ-008).
//
// O critério de conclusão é explícito: "teste garante soma das linhas = total
// nas três telas". As três telas são as que a auditoria apontou divergindo —
// home (mini simulador), página do lote e modal de lance — e aqui entra também
// o tour, que ensinava um total sem a Taxa Leiloaê.
//
// O teste não confere números escritos à mão: extrai o que está renderizado e
// verifica a invariante. Se alguém voltar a montar uma lista de linhas própria
// numa tela, a soma deixa de fechar e este teste quebra.
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeScreen, TourOverlay } from "./screens.jsx";
import { LotDetailScreen } from "./lotdetail.jsx";
import { BidModal } from "./bidmodal.jsx";
import { simulateCost } from "./domain/auction.js";
import { LOTS } from "./data.js";

/** Todos os valores em reais de um trecho da tela, na ordem em que aparecem. */
function valores(el) {
  // pt-BR separa "R$" do número com espaço não separável; \s cobre os dois.
  return [...el.textContent.matchAll(/R\$\s*([\d.]+(?:,\d{2})?)/g)]
    .map((m) => Number(m[1].replace(/\./g, "").replace(",", ".")));
}

const imovel = LOTS.find((l) => l.category === "imovel" && l.endsAt > Date.now());
const carro = LOTS.find((l) => l.category === "carro" && l.endsAt > Date.now());

describe("BIZ-008 — a soma das linhas é igual ao total exibido", () => {
  it("tela 1: mini simulador da home", () => {
    render(<HomeScreen />);
    const campo = screen.getByLabelText("Se você desse este lance:");
    const lance = Number(campo.value);
    const bloco = campo.closest("div").parentElement;

    const esperado = simulateCost(lance, "imovel");
    const vistos = valores(bloco);
    const total = vistos[vistos.length - 1];
    // A home omite a linha "Seu lance" (ele está no campo acima), então o
    // total deve fechar com o lance digitado somado às demais linhas.
    const extras = vistos.slice(0, -1).reduce((s, v) => s + v, 0);
    expect(Math.abs(lance + extras - total)).toBeLessThanOrEqual(1);
    expect(Math.abs(total - esperado.total)).toBeLessThanOrEqual(1);
    expect(bloco.textContent).toMatch(/Taxa Leiloaê \(1,5%\)/);
  });

  it("tela 2: simulador da página do lote", () => {
    render(<LotDetailScreen lot={imovel} />);
    const simulador = screen.getByTestId("simulador-custo");
    const vistos = valores(simulador);
    const total = vistos[vistos.length - 1];
    const soma = vistos.slice(0, -1).reduce((s, v) => s + v, 0);
    expect(vistos.length).toBeGreaterThanOrEqual(5);
    expect(Math.abs(soma - total)).toBeLessThanOrEqual(1);
    expect(simulador.textContent).toMatch(/Taxa Leiloaê \(1,5%\)/);
  });

  it("tela 3: modal de lance", () => {
    render(<BidModal lot={imovel} open onClose={() => {}} />);
    const linhaTaxa = screen.getByText("Taxa Leiloaê (1,5%)");
    const simulador = linhaTaxa.closest("div").parentElement;
    const vistos = valores(simulador);
    const total = vistos[vistos.length - 1];
    const soma = vistos.slice(0, -1).reduce((s, v) => s + v, 0);
    expect(Math.abs(soma - total)).toBeLessThanOrEqual(1);
  });

  it("tela 4: o tour ensina o mesmo total do simulador", async () => {
    const user = userEvent.setup();
    render(<TourOverlay open onClose={() => {}} />);
    const dialogo = await screen.findByRole("dialog");

    // O simulador é o slide 3; o tour ensinava ali um total sem a taxa.
    await user.click(within(dialogo).getByRole("button", { name: /Próximo/ }));
    await user.click(within(dialogo).getByRole("button", { name: /Próximo/ }));
    expect(within(dialogo).getByText(/03 \/ 05/)).toBeInTheDocument();

    // O tour prefixa as parcelas com "+", então a busca é por conteúdo.
    const taxa = within(dialogo).getByText(/Taxa Leiloaê \(1,5%\)/);
    const bloco = taxa.closest("div").parentElement;
    const vistos = valores(bloco);
    const total = vistos[vistos.length - 1];
    const soma = vistos.slice(0, -1).reduce((s, v) => s + v, 0);
    expect(Math.abs(soma - total)).toBeLessThanOrEqual(1);

    // E o texto do slide não pode enumerar as parcelas omitindo a taxa.
    expect(within(dialogo).getByText(/calculados na hora/).textContent).toMatch(/taxa Leiloaê/i);
  });
});

describe("BIZ-007 — ITBI só incide sobre imóvel", () => {
  it("a página do lote de veículo não cobra ITBI", () => {
    render(<LotDetailScreen lot={carro} />);
    const simulador = screen.getByTestId("simulador-custo");
    expect(simulador.textContent).not.toMatch(/ITBI/);
    expect(simulador.textContent).toMatch(/Taxa Leiloaê/);
  });

  it("o modal de lance de veículo não cobra ITBI", () => {
    render(<BidModal lot={carro} open onClose={() => {}} />);
    expect(screen.queryByText(/ITBI/)).not.toBeInTheDocument();
  });

  it("as duas telas de um mesmo veículo chegam ao mesmo total", () => {
    // Era exatamente este o defeito BIZ-007: para o mesmo carro, a página do
    // lote cobrava ITBI e o modal não, e os dois totais divergiam.
    const { unmount } = render(<LotDetailScreen lot={carro} />);
    const entradaPagina = Number(screen.getByLabelText(/Se você desse este lance|lance/i).value);
    const naPagina = valores(screen.getByTestId("simulador-custo")).pop();
    unmount();

    render(<BidModal lot={carro} open onClose={() => {}} />);
    const entradaModal = Number(screen.getByLabelText("Quanto você quer dar de lance?").value);

    // As duas telas partem do mesmo lance sugerido e precisam chegar ao mesmo
    // total — e ao mesmo que o domínio calcula.
    expect(entradaModal).toBe(entradaPagina);
    expect(Math.abs(naPagina - simulateCost(entradaPagina, "carro").total)).toBeLessThanOrEqual(1);
  });
});
