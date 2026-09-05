// Fronteira de erro (FRONT-002).
//
// Antes qualquer exceção de renderização apagava a aplicação inteira, sem
// mensagem e sem caminho de volta — e sem ninguém saber, já que não há
// rastreamento de erro. Aqui o erro fica contido, o usuário tem saída e o
// evento é publicado para quem estiver escutando.

import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Ponto único de integração com monitoramento (Sentry etc.) quando existir.
    // Enquanto não existe, ao menos registra no console e emite um evento.
    console.error("[Leiloaê] erro de renderização:", error, info?.componentStack);
    window.dispatchEvent(new CustomEvent("leiloae:error", { detail: { error, info } }));
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          maxWidth: 560, margin: "0 auto", padding: "72px 32px",
          textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center",
        }}
      >
        <div style={{ fontFamily: "var(--serif)", fontSize: 32, lineHeight: 1.1, color: "var(--text)" }}>
          Alguma coisa quebrou por aqui.
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, margin: 0 }}>
          O erro ficou contido nesta tela — o resto do site continua funcionando.
          Você pode tentar de novo ou voltar para o início.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={this.handleReset}
            style={{
              background: "var(--accent)", color: "#15101F", border: "none",
              borderRadius: 999, padding: "12px 22px", fontSize: 14.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
          <button
            onClick={() => window.location.assign("/")}
            style={{
              background: "transparent", color: "var(--text)", border: "1px solid var(--border-2)",
              borderRadius: 999, padding: "12px 22px", fontSize: 14.5, cursor: "pointer",
            }}
          >
            Ir para o início
          </button>
        </div>
      </div>
    );
  }
}
