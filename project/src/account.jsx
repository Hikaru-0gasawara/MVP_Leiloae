// Account area: Meus dados (perfil), Toast.
import { useState, useId } from "react";
import { LOTS } from "./data.js";
import { SectionHead, Button, Badge, Icon } from "./components.jsx";

// ---------- Ephemeral toast (controlled by App, dispatched via "leiloe:toast") ----------
export function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)",
      zIndex: 300, background: "var(--surface-3)", border: "1px solid var(--border-2)",
      color: "var(--text)", borderRadius: 999, padding: "11px 20px",
      fontSize: 13.5, fontWeight: 500, boxShadow: "0 18px 44px -14px rgba(0,0,0,0.7)",
      display: "inline-flex", alignItems: "center", gap: 10, maxWidth: "calc(100vw - 32px)",
      animation: "leiloe-fadein 0.2s ease",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
      {message}
    </div>
  );
}

export const notify = (msg) => window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: msg }));

// ====================================================================
// MEUS DADOS — profile / account
// ====================================================================
export function ProfileScreen({ onNavigate, lots = LOTS, bidsCount = 0, winsCount = 0 }) {
  const [prefs, setPrefs] = useState({ outbid: true, ending: true, newLots: false, email: true });
  const togglePref = (k) => setPrefs(p => ({ ...p, [k]: !p[k] }));
  const saved = lots.filter(l => l.saved);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 40px 120px", animation: "leiloe-fadein 0.3s ease" }}>
      <SectionHead as="h1" overline="Conta" title="Meus dados" subtitle="Suas informações, verificação e preferências de notificação." />

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 28, alignItems: "flex-start" }}>
        {/* LEFT — identity card */}
        <div style={{ position: "sticky", top: 100, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: 24, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 14px",
              background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
              color: "#15101F", fontWeight: 600, fontSize: 30,
              display: "grid", placeItems: "center", fontFamily: "var(--serif)", fontStyle: "italic",
            }}>C</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 24, lineHeight: 1.1 }}>Camila Silva</div>
            <div style={{ fontSize: 13, color: "var(--text-mute)", marginTop: 4 }}>camila@email.com</div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
              <Badge tone="success"><Icon.check size={11} /> Identidade verificada</Badge>
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-around", fontSize: 12 }}>
              <div><div style={{ fontFamily: "var(--mono)", fontSize: 18, color: "var(--text)" }}>{bidsCount}</div><div style={{ color: "var(--text-mute)" }}>{bidsCount === 1 ? "lance" : "lances"}</div></div>
              <div><div style={{ fontFamily: "var(--mono)", fontSize: 18, color: "var(--text)" }}>{winsCount}</div><div style={{ color: "var(--text-mute)" }}>{winsCount === 1 ? "arremate" : "arremates"}</div></div>
              <div><div style={{ fontFamily: "var(--mono)", fontSize: 18, color: "var(--text)" }}>{saved.length}</div><div style={{ color: "var(--text-mute)" }}>salvos</div></div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button variant="ghost" full icon={<Icon.list size={14} />} onClick={() => onNavigate("my-bids")}>Meus lances</Button>
            <Button variant="ghost" full icon={<Icon.heart size={14} />} onClick={() => onNavigate("listing")}>Lotes salvos</Button>
          </div>
        </div>

        {/* RIGHT — sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="Dados pessoais" action="Editar" onAction={() => notify("Edição de dados — em breve")}>
            <Field label="Nome completo" value="Camila Silva" />
            <Field label="CPF" value="•••.456.789-••" />
            <Field label="Telefone" value="(11) 9 8765-4321" />
            <Field label="Endereço" value="R. Apinajés, 1.100 — Perdizes, São Paulo · SP" last />
          </Panel>

          <Panel title="Verificação" sub="Necessária para arrematar acima de R$ 100 mil.">
            <VerifyRow label="Documento de identidade" status="ok" detail="RG aprovado · jun/2025" />
            <VerifyRow label="Comprovante de residência" status="ok" detail="Aprovado · jun/2025" />
            <VerifyRow label="Comprovante de renda" status="pending" detail="Em análise — até 2 dias úteis" onAction={() => notify("Reenviar comprovante — em breve")} last />
          </Panel>

          <Panel title="Formas de pagamento" action="Adicionar" onAction={() => notify("Adicionar forma de pagamento — em breve")}>
            <PayRow icon={<Icon.pix size={16} />} title="Pix" detail="Chave: camila@email.com" tag="principal" />
            <PayRow icon={<Icon.shield size={16} />} title="Cartão de crédito" detail="•••• 4821 · Visa" last />
          </Panel>

          <Panel title="Notificações" sub="Como você quer ser avisada.">
            <ToggleRow label="Quando eu for superado num lance" checked={prefs.outbid} onChange={() => togglePref("outbid")} />
            <ToggleRow label="Leilão que salvei encerrando em breve" checked={prefs.ending} onChange={() => togglePref("ending")} />
            <ToggleRow label="Novos lotes na minha busca" checked={prefs.newLots} onChange={() => togglePref("newLots")} />
            <ToggleRow label="Resumo por e-mail" checked={prefs.email} onChange={() => togglePref("email")} last />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, sub, action, onAction, children }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 22px 14px", gap: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>{title}</div>
          {sub && <div style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 3 }}>{sub}</div>}
        </div>
        {action && <button onClick={onAction} style={{ background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)", borderRadius: 999, padding: "6px 14px", fontSize: 12.5, cursor: "pointer", flexShrink: 0 }}>{action}</button>}
      </div>
      <div style={{ padding: "0 22px 8px" }}>{children}</div>
    </div>
  );
}

function Field({ label, value, last }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "12px 0", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--text-mute)" }}>{label}</span>
      <span style={{ fontSize: 13.5, color: "var(--text)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function VerifyRow({ label, status, detail, onAction, last }) {
  const ok = status === "ok";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <span style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
        background: ok ? "var(--success-dim)" : "rgba(255,192,122,0.14)",
        color: ok ? "var(--success)" : "var(--warning)",
      }}>{ok ? <Icon.check size={14} /> : <Icon.info size={14} />}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 1 }}>{detail}</div>
      </div>
      {!ok && onAction && <button onClick={onAction} style={{ background: "transparent", border: "none", color: "var(--accent-ink)", fontSize: 12.5, cursor: "pointer", flexShrink: 0 }}>Reenviar</button>}
    </div>
  );
}

function PayRow({ icon, title, detail, tag, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--accent-ink)" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          {title}
          {tag && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent-ink)", background: "var(--accent-dim)", borderRadius: 999, padding: "1px 7px" }}>{tag}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 1 }}>{detail}</div>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, last }) {
  const id = useId();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 0", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <label htmlFor={id} style={{ fontSize: 14, color: "var(--text-dim)", cursor: "pointer" }}>{label}</label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        style={{
          width: 40, height: 23, borderRadius: 999, flexShrink: 0, position: "relative", border: "none", padding: 0,
          background: checked ? "var(--accent)" : "var(--surface-3)", transition: "background 0.18s ease", cursor: "pointer",
        }}
      >
        <span aria-hidden="true" style={{
          position: "absolute", top: 3, left: checked ? 20 : 3, width: 17, height: 17, borderRadius: "50%",
          background: checked ? "#15101F" : "var(--text-mute)", transition: "left 0.18s ease",
        }} />
      </button>
    </div>
  );
}
