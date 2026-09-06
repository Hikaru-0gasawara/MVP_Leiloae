// Carregando, erro e vazio (FRONT-010).
//
// A auditoria registrou que nenhuma tela tinha estes três estados: os dados
// eram constantes de módulo, então "carregando" não existia e "falhou" também
// não. Com servidor, os três acontecem — e a tela precisa dizer o que houve e
// oferecer saída, em vez de ficar em branco.

import { Button } from "../components.jsx";

const centro = {
  maxWidth: 560, margin: "0 auto", padding: "80px 32px",
  display: "flex", flexDirection: "column", alignItems: "center",
  gap: 14, textAlign: "center",
};

/** Esqueleto do catálogo: mostra a forma da página, sem inventar conteúdo. */
export function CarregandoCatalogo() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 40px 80px" }}>
      {/* `aria-busy` + região viva: quem usa leitor de tela ouve que está
          carregando, em vez de encontrar uma página vazia. */}
      <div role="status" aria-live="polite" aria-busy="true" style={{ marginBottom: 28 }}>
        <span style={{ fontSize: 13, color: "var(--text-mute)" }}>Carregando os leilões…</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} aria-hidden="true" style={{
            height: 380, borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)", background: "var(--surface)",
            backgroundImage: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "leiloe-shimmer 1.6s ease-in-out infinite",
            animationDelay: `${i * 0.08}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Falha ao carregar. Diz o que houve na linguagem de quem lê, separa "sem
 * conexão" de "erro do servidor", e sempre oferece o caminho de volta.
 */
export function FalhaAoCarregar({ erro, aoTentarDeNovo }) {
  const semConexao = erro?.codigo === "sem-conexao" || erro?.status === 0;
  return (
    <div style={centro} role="alert">
      <div style={{ fontFamily: "var(--serif)", fontSize: 32, lineHeight: 1.1 }}>
        {semConexao ? "Sem conexão com o servidor." : "Não conseguimos carregar os leilões."}
      </div>
      <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, margin: 0 }}>
        {semConexao
          ? "Verifique sua internet. Os lances e prazos vêm do servidor, então preferimos não mostrar números velhos."
          : erro?.mensagem || "O servidor respondeu com um erro. Tente de novo em instantes."}
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <Button onClick={aoTentarDeNovo}>Tentar de novo</Button>
        <Button variant="ghost" onClick={() => window.location.assign("/")}>Ir para o início</Button>
      </div>
    </div>
  );
}

/** Vazio genérico, com uma saída — nunca um beco sem ação. */
export function Vazio({ titulo, texto, acao }) {
  return (
    <div style={centro}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 28, lineHeight: 1.15 }}>{titulo}</div>
      {texto && <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, margin: 0 }}>{texto}</p>}
      {acao}
    </div>
  );
}
