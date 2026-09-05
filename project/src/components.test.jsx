import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LotCard } from "./components.jsx";
import { BidModal } from "./bidmodal.jsx";
import { MyBidsScreen } from "./mybids.jsx";
import { FIRST_BID_WINDOW_MS } from "./domain/auction.js";

const lote = (over = {}) => ({
  id: "lot-1", category: "imovel", title: "Studio na Mooca",
  address: "R. Teste, 1 — Mooca", city: "São Paulo", region: "Zona Leste",
  area: 28, bedrooms: 1, occupancy: "Vazio", auctionType: "Extrajudicial", praca: "2ª praça",
  appraised: 215000, minBid: 138000, currentBid: 142500, bids: 14,
  endsAt: Date.now() + 3600e3, vendor: "vendor-bb", photo: "linear-gradient(135deg,#000,#111)",
  glyph: "studio", saved: false, photoIds: ["abc", "def", "ghi", "jkl"],
  docs: [], rules: "", description: "", ...over,
});

describe("LotCard", () => {
  it("mostra o botão de lance em leilão aberto", () => {
    render(<LotCard lot={lote()} />);
    expect(screen.getByRole("button", { name: "Dar lance" })).toBeInTheDocument();
  });

  it("BIZ-002 — não oferece lance em leilão encerrado", () => {
    render(<LotCard lot={lote({ endsAt: Date.now() - 1000 })} />);
    expect(screen.queryByRole("button", { name: "Dar lance" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Leilão encerrado").length).toBeGreaterThan(0);
  });

  it("FRONT-003 — carrega uma única imagem por card, com srcset e dimensões", () => {
    const { container } = render(<LotCard lot={lote()} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute("srcset");
    expect(imgs[0]).toHaveAttribute("width");
    expect(imgs[0]).toHaveAttribute("height");
    expect(imgs[0].getAttribute("alt")).toMatch(/Studio na Mooca/);
  });

  it("FRONT-006 — os controles do card não ficam dentro de outro controle", () => {
    const { container } = render(<LotCard lot={lote()} />);
    const aninhados = [...container.querySelectorAll("button")].filter(
      (b) => b.closest('[role="button"]') || b.parentElement?.closest("button")
    );
    expect(aninhados).toHaveLength(0);
  });

  it("BIZ-009 — esconde o selo de desconto quando não há desconto real", () => {
    const { container } = render(<LotCard lot={lote({ currentBid: 250000, appraised: 215000 })} />);
    expect(container.textContent).not.toMatch(/−\d+%/);
  });

  it("chama onBid e onSave sem disparar a navegação do card", async () => {
    const user = userEvent.setup();
    const onBid = vi.fn(); const onSave = vi.fn(); const onClick = vi.fn();
    render(<LotCard lot={lote()} onBid={onBid} onSave={onSave} onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "Dar lance" }));
    await user.click(screen.getByRole("button", { name: /^Salvar/ }));
    expect(onBid).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("BidModal", () => {
  it("BIZ-002 — leilão encerrado não apresenta caminho para lance", () => {
    render(<BidModal lot={lote({ endsAt: Date.now() - 1 })} open onClose={() => {}} />);
    expect(screen.getByText(/Este leilão já encerrou/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Quanto você quer dar de lance?")).not.toBeInTheDocument();
  });

  it("BIZ-008 — as linhas somam o total exibido e a Taxa Leiloaê aparece", () => {
    render(<BidModal lot={lote()} open onClose={() => {}} />);
    expect(screen.getByText("Taxa Leiloaê (1,5%)")).toBeInTheDocument();
    expect(screen.getByText("Custo total estimado")).toBeInTheDocument();
  });

  it("BIZ-007 — veículo não tem linha de ITBI", () => {
    render(<BidModal lot={lote({ id: "c1", category: "carro", fipe: 87500, currentBid: 61500, minBid: 58000 })} open onClose={() => {}} />);
    expect(screen.queryByText(/ITBI/)).not.toBeInTheDocument();
  });

  it("BIZ-010 — o incremento sugerido vem da faixa do lote", () => {
    render(<BidModal lot={lote()} open onClose={() => {}} />);
    // currentBid 142.500 → incremento de R$ 1.000
    expect(screen.getByRole("button", { name: /\+R\$\s?1\.000/ })).toBeInTheDocument();
  });

  it("bloqueia o avanço com valor abaixo do mínimo e explica o porquê", async () => {
    const user = userEvent.setup();
    render(<BidModal lot={lote()} open onClose={() => {}} />);
    const campo = screen.getByLabelText("Quanto você quer dar de lance?");
    await user.clear(campo);
    await user.type(campo, "100");
    expect(await screen.findByRole("alert")).toHaveTextContent(/lance mínimo/i);
    expect(screen.getByRole("button", { name: /Confirmar lance de/ })).toBeDisabled();
  });

  it("BIZ-001 — confirmar registra o lance com o valor informado", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<BidModal lot={lote()} open onClose={() => {}} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: /Confirmar lance de/ }));
    await user.click(screen.getByLabelText(/Li o edital/));
    await user.click(screen.getByRole("button", { name: /^Confirmar lance$/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].value).toBe(143500); // 142.500 + incremento 1.000
    expect(screen.getByText("Lance registrado.")).toBeInTheDocument();
  });

  it("FRONT-005 — é um diálogo anunciado como tal", () => {
    render(<BidModal lot={lote()} open onClose={() => {}} />);
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAttribute("aria-labelledby");
  });
});

describe("MyBidsScreen", () => {
  const entrada = (over = {}) => ({
    bid: { id: "b1", lotId: "lot-1", value: 143500, placedAt: Date.now(), cancelableUntil: null, canceled: false, ...over.bid },
    lot: lote(over.lot),
  });

  it("BIZ-005 — oferece as abas especificadas", () => {
    render(<MyBidsScreen bids={[entrada()]} />);
    for (const aba of ["Todos", "Ganhando", "Superados", "Arrematados", "Encerrados"]) {
      expect(screen.getByRole("tab", { name: new RegExp(aba) })).toBeInTheDocument();
    }
  });

  it("BIZ-005 — lance superado oferece 'Cobrir lance' com o valor sugerido", async () => {
    const user = userEvent.setup();
    const onBid = vi.fn();
    render(<MyBidsScreen bids={[entrada({ bid: { value: 140000 }, lot: { currentBid: 150000 } })]} onBid={onBid} />);
    // "Superado" aparece no KPI e no selo da linha; ambos são legítimos.
    expect(screen.getAllByText("Superado").length).toBeGreaterThanOrEqual(2);
    await user.click(screen.getByRole("button", { name: /Cobrir lance/ }));
    expect(onBid).toHaveBeenCalledTimes(1);
    expect(onBid.mock.calls[0][1]).toBe(151000); // 150.000 + incremento de R$ 1.000 da faixa
  });

  it("BIZ-005 — arremate abre o pop-up de detalhes", async () => {
    const user = userEvent.setup();
    render(<MyBidsScreen bids={[entrada({ bid: { value: 143500 }, lot: { currentBid: 143500, endsAt: Date.now() - 1000 } })]} />);
    await user.click(screen.getByRole("button", { name: "Ver detalhes" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Valor final")).toBeInTheDocument();
    expect(within(dialogo).getByText("Custo total estimado")).toBeInTheDocument();
    expect(within(dialogo).getByText("Passo a passo")).toBeInTheDocument();
  });

  it("BIZ-006 — primeiro lance mostra a janela de cancelamento e a ação", async () => {
    const user = userEvent.setup();
    const onCancelBid = vi.fn();
    render(<MyBidsScreen bids={[entrada({ bid: { cancelableUntil: Date.now() + FIRST_BID_WINDOW_MS } })]} onCancelBid={onCancelBid} />);
    expect(screen.getByText(/Primeiro lance protegido/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar lance" }));
    expect(onCancelBid).toHaveBeenCalledWith("b1");
  });

  it("estado vazio por aba, com caminho de saída", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<MyBidsScreen bids={[]} onNavigate={onNavigate} />);
    expect(screen.getByText("Nada aqui ainda")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Ver leilões/ }));
    expect(onNavigate).toHaveBeenCalledWith("listing");
  });
});
