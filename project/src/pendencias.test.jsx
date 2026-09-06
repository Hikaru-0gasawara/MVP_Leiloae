// As pendências de docs/api.md, pela interface.
//
// Cada bloco corresponde a um item da seção "O que ainda não existe" do
// contrato. O servidor tem suíte própria; aqui o que se prova é que a tela
// consome o que o servidor passou a oferecer — e, sem servidor, que ela diz a
// verdade em vez de fingir que tem o dado.

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LotDetailScreen } from "./lotdetail.jsx";
import { TelaDeVerificacao, AvisoDeEmailNaoVerificado } from "./ui/TelaDeVerificacao.jsx";

const lote = {
  id: "lot-1", category: "imovel", title: "Studio na Mooca",
  address: "R. Teste, 1", city: "São Paulo", region: "Zona Leste",
  area: 28, bedrooms: 1, parking: 0, floor: 3, year: 2015, type: "Studio",
  occupancy: "Vazio", auctionType: "Extrajudicial", praca: "2ª praça",
  appraised: 215000, minBid: 138000, currentBid: 142500, bids: 14,
  endsAt: Date.now() + 3600e3, vendor: "vendor-bb", photo: "linear-gradient(135deg,#000,#111)",
  glyph: "studio", saved: false, photoIds: ["abc", "def", "ghi", "jkl"],
  docs: [], rules: "regras", description: "descrição",
};

const abrirHistorico = async (acoes) => {
  const user = userEvent.setup();
  render(<LotDetailScreen lot={lote} acoes={acoes} onBack={() => {}} onBid={() => {}} onSave={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Histórico de lances" }));
  return user;
};

describe("histórico público de lances, na tela", () => {
  it("mostra os lances com o apelido, sem identificar ninguém", async () => {
    const acoes = {
      historicoDoLote: vi.fn().mockResolvedValue({
        ok: true,
        dados: {
          apenasLocal: false,
          lances: [
            { id: "b2", participante: "Participante 2", valor: 145000, em: Date.now(), automatico: true, cancelado: false },
            { id: "b1", participante: "Participante 1", valor: 143000, em: Date.now() - 60000, automatico: false, cancelado: false },
          ],
        },
      }),
    };
    await abrirHistorico(acoes);

    expect(await screen.findByText("Participante 2")).toBeInTheDocument();
    expect(screen.getByText("Participante 1")).toBeInTheDocument();
    expect(screen.getByText("automático")).toBeInTheDocument();
    expect(acoes.historicoDoLote).toHaveBeenCalledWith("lot-1");
  });

  it("o lance cancelado aparece marcado, não sumido", async () => {
    const acoes = {
      historicoDoLote: vi.fn().mockResolvedValue({
        ok: true,
        dados: {
          apenasLocal: false,
          lances: [{ id: "b1", participante: "Participante 1", valor: 143000, em: Date.now(), automatico: false, cancelado: true }],
        },
      }),
    };
    await abrirHistorico(acoes);
    expect(await screen.findByText("cancelado")).toBeInTheDocument();
  });

  it("sem servidor, avisa que só há os lances deste navegador", async () => {
    const acoes = {
      historicoDoLote: vi.fn().mockResolvedValue({ ok: true, dados: { apenasLocal: true, lances: [] } }),
    };
    await abrirHistorico(acoes);
    expect(await screen.findByText(/só aparecem os lances que você deu neste navegador/i)).toBeInTheDocument();
  });

  it("falha de carga explica em vez de ficar em branco", async () => {
    const acoes = {
      historicoDoLote: vi.fn().mockResolvedValue({ ok: false, erro: { mensagem: "Servidor fora do ar." } }),
    };
    await abrirHistorico(acoes);
    expect(await screen.findByText("Servidor fora do ar.")).toBeInTheDocument();
  });
});

describe("confirmação de e-mail", () => {
  const comToken = (token) => {
    window.history.replaceState({}, "", token ? `/verificar?token=${token}` : "/verificar");
  };

  it("consome o token da URL e confirma sozinha", async () => {
    comToken("abc123");
    const acoes = { verificarEmail: vi.fn().mockResolvedValue({ ok: true }) };
    render(<TelaDeVerificacao acoes={acoes} aoConcluir={() => {}} aoVoltar={() => {}} />);

    expect(await screen.findByText("E-mail confirmado.")).toBeInTheDocument();
    expect(acoes.verificarEmail).toHaveBeenCalledWith("abc123");
  });

  it("o token sai da barra de endereços — senão vaza no Referer", async () => {
    comToken("segredo");
    const acoes = { verificarEmail: vi.fn().mockResolvedValue({ ok: true }) };
    render(<TelaDeVerificacao acoes={acoes} aoConcluir={() => {}} aoVoltar={() => {}} />);
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("gasta o token uma vez só, mesmo com a montagem dupla do StrictMode", async () => {
    comToken("uma-vez");
    const acoes = { verificarEmail: vi.fn().mockResolvedValue({ ok: true }) };
    const { rerender } = render(<TelaDeVerificacao acoes={acoes} aoConcluir={() => {}} aoVoltar={() => {}} />);
    rerender(<TelaDeVerificacao acoes={acoes} aoConcluir={() => {}} aoVoltar={() => {}} />);
    await screen.findByText("E-mail confirmado.");
    expect(acoes.verificarEmail).toHaveBeenCalledTimes(1);
  });

  it("link sem token não finge que funcionou", async () => {
    comToken(null);
    const acoes = { verificarEmail: vi.fn() };
    render(<TelaDeVerificacao acoes={acoes} aoConcluir={() => {}} aoVoltar={() => {}} />);
    expect(screen.getByText("Link inválido.")).toBeInTheDocument();
    expect(acoes.verificarEmail).not.toHaveBeenCalled();
  });

  it("token recusado mostra o motivo do servidor", async () => {
    comToken("velho");
    const acoes = {
      verificarEmail: vi.fn().mockResolvedValue({ ok: false, erro: { mensagem: "Link expirado." } }),
    };
    render(<TelaDeVerificacao acoes={acoes} aoConcluir={() => {}} aoVoltar={() => {}} />);
    expect(await screen.findByText("Link expirado.")).toBeInTheDocument();
  });
});

describe("aviso de e-mail não confirmado", () => {
  const usuario = (emailVerificado) => ({ id: "u1", nome: "Ana", email: "ana@ex.com", emailVerificado });

  it("aparece só enquanto o endereço não foi confirmado", () => {
    const { container, rerender } = render(
      <AvisoDeEmailNaoVerificado usuario={usuario(false)} acoes={{}} />
    );
    expect(screen.getByText(/Falta confirmar seu e-mail/i)).toBeInTheDocument();

    rerender(<AvisoDeEmailNaoVerificado usuario={usuario(true)} acoes={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não aparece sem conta nenhuma", () => {
    const { container } = render(<AvisoDeEmailNaoVerificado usuario={null} acoes={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não bloqueia nada: é aviso, não porta trancada", () => {
    render(<AvisoDeEmailNaoVerificado usuario={usuario(false)} acoes={{}} />);
    expect(screen.getByText(/Sua conta já funciona/i)).toBeInTheDocument();
  });

  it("reenvia o link e confirma para onde foi", async () => {
    const user = userEvent.setup();
    const acoes = { reenviarVerificacao: vi.fn().mockResolvedValue({ ok: true }) };
    render(<AvisoDeEmailNaoVerificado usuario={usuario(false)} acoes={acoes} />);

    await user.click(screen.getByRole("button", { name: "Reenviar link" }));
    expect(await screen.findByText("Link enviado para ana@ex.com.")).toBeInTheDocument();
    expect(acoes.reenviarVerificacao).toHaveBeenCalledTimes(1);
  });

  it("falha no reenvio diz o motivo, em vez de sumir em silêncio", async () => {
    const user = userEvent.setup();
    const acoes = {
      reenviarVerificacao: vi.fn().mockResolvedValue({
        ok: false, erro: { mensagem: "O envio de e-mail não está configurado neste ambiente." },
      }),
    };
    render(<AvisoDeEmailNaoVerificado usuario={usuario(false)} acoes={acoes} />);
    await user.click(screen.getByRole("button", { name: "Reenviar link" }));
    expect(await screen.findByText(/não está configurado/i)).toBeInTheDocument();
  });
});
