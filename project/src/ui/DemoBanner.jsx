// Faixa de demonstração (SEC-001).
//
// O sistema exibe documentos jurídicos, dados de empresa e canais de
// atendimento fictícios. Enquanto for demonstração, isso precisa estar
// declarado onde ninguém deixe de ver — não escondido no rodapé.

import { useState } from "react";
import { Icon } from "../components.jsx";
import { IS_DEMO } from "../lib/config.js";

export function DemoBanner() {
  const [aberto, setAberto] = useState(false);

  return (
    <div
      role="region"
      aria-label="Aviso de ambiente de demonstração"
      style={{
        position: "sticky", top: 0, zIndex: 60,
        background: "var(--warning)", color: "#241703",
        fontSize: 13.5, lineHeight: 1.5,
      }}
    >
      <div style={{
        maxWidth: 1440, margin: "0 auto", padding: "8px 28px",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <strong style={{ fontWeight: 700 }}>Ambiente de demonstração.</strong>
        <span>
          Lotes, valores, vendedores, documentos e canais de atendimento são fictícios.
          Nenhum lance tem efeito jurídico ou financeiro.
        </span>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          style={{
            marginLeft: "auto", background: "rgba(0,0,0,0.12)", border: "none",
            color: "inherit", borderRadius: 999, padding: "3px 12px",
            fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          }}
        >
          {aberto ? "Ocultar detalhes" : "O que isso significa?"}
        </button>
      </div>
      {aberto && (
        <div style={{
          maxWidth: 1440, margin: "0 auto", padding: "0 28px 12px",
          fontSize: 13, display: "grid", gap: 4,
        }}>
          <span>· Os imóveis e veículos não existem; as fotos são de banco de imagens, meramente ilustrativas.</span>
          <span>· Termos de uso e Política de Privacidade são textos de exemplo, sem validade.</span>
          <span>· Seus lances e favoritos ficam apenas neste navegador e não são enviados a ninguém.</span>
          <span>· Nenhum dado pessoal é coletado, transmitido ou armazenado fora deste dispositivo.</span>
        </div>
      )}
    </div>
  );
}

/**
 * Aviso local de demonstração, para telas que prometem um canal ou um efeito
 * que não existe fora do protótipo. Fica ao lado do próprio recurso — a faixa
 * do topo diz que o ambiente é de demonstração, mas não diz o que, nesta tela,
 * deixa de acontecer.
 */
export function DemoNotice({ children }) {
  if (!IS_DEMO) return null;
  return (
    <div role="note" style={{
      display: "flex", gap: 12, alignItems: "flex-start",
      background: "rgba(255,192,122,0.14)", border: "1px solid rgba(255,192,122,0.4)",
      borderRadius: 14, padding: "14px 18px", marginBottom: 28,
    }}>
      <span aria-hidden="true" style={{ color: "var(--warning-ink)", marginTop: 2 }}>
        <Icon.info size={16} />
      </span>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>{children}</div>
    </div>
  );
}
