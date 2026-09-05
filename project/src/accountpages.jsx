// Account sub-pages: Histórico, Mensagens, Pagamentos, Configurações.
// Reuses globals: SectionHead, Button, Icon, Badge, LotPhoto, StatCard, fmtBRL, fmtNum, LOTS.

const { useState: useStateAP, useRef: useRefAP, useEffect: useEffectAP } = React;

// ---------- shared shell ----------
function PageWrap({ overline, title, subtitle, right, max = 1080, children }) {
  return (
    <div style={{ maxWidth: max, margin: "0 auto", padding: "40px 40px 80px", animation: "leiloe-fadein 0.3s ease" }}>
      <SectionHead overline={overline} title={title} subtitle={subtitle} right={right} />
      {children}
    </div>
  );
}

function APanel({ title, sub, action, onAction, children, pad = true }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      {(title || action) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 22px 14px", gap: 16, borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 600 }}>{title}</div>
            {sub && <div style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 3 }}>{sub}</div>}
          </div>
          {action && <button onClick={onAction} style={{ background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)", borderRadius: 999, padding: "6px 14px", fontSize: 12.5, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>{action}</button>}
        </div>
      )}
      <div style={{ padding: pad ? "6px 22px 10px" : 0 }}>{children}</div>
    </div>
  );
}

function Switch({ checked, onChange }) {
  return (
    <span onClick={onChange} style={{
      width: 40, height: 23, borderRadius: 999, flexShrink: 0, position: "relative", cursor: "pointer",
      background: checked ? "var(--accent)" : "var(--surface-3)", transition: "background 0.18s ease",
    }}>
      <span style={{ position: "absolute", top: 3, left: checked ? 20 : 3, width: 17, height: 17, borderRadius: "50%", background: checked ? "#15101F" : "var(--text-mute)", transition: "left 0.18s ease" }} />
    </span>
  );
}

function ToggleLine({ label, sub, checked, onChange, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div>
        <div style={{ fontSize: 14, color: "var(--text)" }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 2 }}>{sub}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
      border: "1px solid " + (active ? "transparent" : "var(--border-2)"),
      background: active ? "var(--accent)" : "transparent",
      color: active ? "var(--bg)" : "var(--text-dim)",
      fontWeight: active ? 600 : 400,
    }}>{children}</button>
  );
}

// ====================================================================
// HISTÓRICO — activity timeline
// ====================================================================
function HistoryScreen({ onOpenLot, onNavigate }) {
  const [filter, setFilter] = useStateAP("tudo");
  const L = window.LOTS;
  const byId = (id) => L.find(l => l.id === id);

  const events = [
    { id: "e1", kind: "outbid", day: "Hoje", time: "14:32", lot: "lot-tatuape-studio", title: "Seu lance foi superado", detail: "Novo lance de R$ 158.200 — R$ 1.500 acima do seu." },
    { id: "e2", kind: "bid", day: "Hoje", time: "09:11", lot: "lot-mooca-studio", title: "Você deu um lance", detail: "R$ 142.700 no Studio na Mooca." },
    { id: "e3", kind: "saved", day: "Ontem", time: "21:04", lot: "car-civic", title: "Você salvou um lote", detail: "Honda Civic EXL 2019 adicionado aos favoritos." },
    { id: "e4", kind: "doc", day: "Ontem", time: "16:48", title: "Documento aprovado", detail: "Seu comprovante de residência foi verificado." },
    { id: "e5", kind: "bid", day: "12 fev", time: "11:20", lot: "car-corolla", title: "Você deu um lance", detail: "R$ 68.900 no Toyota Corolla XEi." },
    { id: "e6", kind: "won", day: "9 fev", time: "18:00", lot: "lot-liberdade-kitnet", title: "Arremate concluído", detail: "Você arrematou a Kitnet na Liberdade por R$ 98.500." },
    { id: "e7", kind: "account", day: "2 fev", time: "10:15", title: "Conta criada", detail: "Bem-vinda ao Leiloaê, Camila." },
  ];

  const kindMap = {
    outbid:  { icon: <Icon.gavel size={15} />, color: "var(--hot-ink)", bg: "rgba(255,107,91,0.12)", group: "lances" },
    bid:     { icon: <Icon.gavel size={15} />, color: "var(--accent-ink)", bg: "var(--accent-dim)", group: "lances" },
    saved:   { icon: <Icon.heart size={15} />, color: "var(--accent-ink)", bg: "var(--accent-dim)", group: "salvos" },
    doc:     { icon: <Icon.check size={15} />, color: "var(--success-ink)", bg: "var(--success-dim)", group: "conta" },
    won:     { icon: <Icon.check size={15} />, color: "var(--success-ink)", bg: "var(--success-dim)", group: "lances" },
    account: { icon: <Icon.user size={15} />, color: "var(--text-mute)", bg: "var(--surface-2)", group: "conta" },
  };

  const filters = [
    { id: "tudo", label: "Tudo" },
    { id: "lances", label: "Lances" },
    { id: "salvos", label: "Salvos" },
    { id: "conta", label: "Conta" },
  ];

  const shown = events.filter(e => filter === "tudo" || kindMap[e.kind].group === filter);
  const days = [...new Set(shown.map(e => e.day))];

  return (
    <PageWrap overline="Histórico" title="Tudo que você fez por aqui." subtitle="Seus lances, lotes salvos e eventos da conta — em ordem." max={840}>
      <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
        {filters.map(f => <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>)}
      </div>

      {shown.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-mute)", background: "var(--surface)", border: "1px dashed var(--border-2)", borderRadius: 18 }}>
          Nenhum evento nesta categoria ainda.
        </div>
      ) : days.map(day => (
        <div key={day} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-mute)", marginBottom: 12 }}>{day}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shown.filter(e => e.day === day).map(e => {
              const k = kindMap[e.kind];
              const lot = e.lot ? byId(e.lot) : null;
              const clickable = !!lot;
              return (
                <div key={e.id} onClick={() => clickable && onOpenLot(lot)} style={{
                  display: "flex", gap: 14, alignItems: "center", padding: "14px 18px",
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
                  cursor: clickable ? "pointer" : "default",
                }}
                  onMouseEnter={(ev) => { if (clickable) ev.currentTarget.style.borderColor = "var(--border-2)"; }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.borderColor = "var(--border)"; }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: k.bg, color: k.color }}>{k.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 500 }}>{e.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2 }}>{e.detail}</div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-mute)", fontFamily: "var(--mono)", flexShrink: 0 }}>{e.time}</span>
                  {clickable && <Icon.arrowR size={14} />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </PageWrap>
  );
}

// ====================================================================
// MENSAGENS — inbox + thread
// ====================================================================
const CONVERSATIONS = [
  {
    id: "c1", who: "Justi Leilões", role: "Leiloeiro oficial", initial: "J", accent: "var(--accent)",
    about: "Studio no Tatuapé", unread: 1, last: "Os documentos do imóvel já estão...",
    msgs: [
      { from: "them", text: "Olá, Camila! Vi que você deu um lance no Studio no Tatuapé. Posso ajudar com algo?", time: "10:02" },
      { from: "me", text: "Oi! O imóvel está ocupado?", time: "10:05" },
      { from: "them", text: "Está desocupado — a entrega de chaves é prevista em ~47 dias após o arremate.", time: "10:07" },
      { from: "them", text: "Os documentos do imóvel já estão disponíveis na aba ‘Documentos’ do lote.", time: "10:08" },
    ],
  },
  {
    id: "c2", who: "Suporte Leiloaê", role: "Atendimento", initial: "L", accent: "var(--success)",
    about: "Verificação de conta", unread: 0, last: "Tudo certo! Sua renda foi aprovada.",
    msgs: [
      { from: "me", text: "Quanto tempo leva a análise do comprovante de renda?", time: "Ontem" },
      { from: "them", text: "Costuma levar até 2 dias úteis. Te aviso assim que sair!", time: "Ontem" },
      { from: "them", text: "Tudo certo! Sua renda foi aprovada. Já pode arrematar acima de R$ 100 mil. 🎉", time: "Hoje" },
    ],
  },
  {
    id: "c3", who: "3ª Vara Cível de SP", role: "Leilão judicial", initial: "3", accent: "var(--warning)",
    about: "Apto 2 dorm. — Vila Prudente", unread: 0, last: "O edital completo está anexado.",
    msgs: [
      { from: "them", text: "Prezada, segue o edital completo do lote anexado ao processo.", time: "11 fev" },
      { from: "me", text: "Obrigada! Vou analisar.", time: "11 fev" },
    ],
  },
];

function MessagesScreen() {
  const [activeId, setActiveId] = useStateAP(CONVERSATIONS[0].id);
  const [drafts, setDrafts] = useStateAP({});
  const [threads, setThreads] = useStateAP(() => Object.fromEntries(CONVERSATIONS.map(c => [c.id, c.msgs])));
  const bottomRef = useRefAP(null);
  const active = CONVERSATIONS.find(c => c.id === activeId);
  const msgs = threads[activeId] || [];

  useEffectAP(() => { if (bottomRef.current) bottomRef.current.scrollTop = bottomRef.current.scrollHeight; }, [activeId, msgs.length]);

  const send = () => {
    const text = (drafts[activeId] || "").trim();
    if (!text) return;
    setThreads(t => ({ ...t, [activeId]: [...t[activeId], { from: "me", text, time: "agora" }] }));
    setDrafts(d => ({ ...d, [activeId]: "" }));
  };

  return (
    <PageWrap overline="Mensagens" title="Sua caixa de entrada." subtitle="Converse com leiloeiros e com o suporte, sem sair da plataforma." max={1080}>
      <div className="msg-grid" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", minHeight: 520 }}>
        {/* conversation list */}
        <div className="msg-list" style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
          {CONVERSATIONS.map(c => {
            const isActive = c.id === activeId;
            return (
              <button key={c.id} onClick={() => setActiveId(c.id)} style={{
                display: "flex", gap: 12, alignItems: "center", textAlign: "left", cursor: "pointer", width: "100%",
                padding: "16px 18px", border: "none", borderBottom: "1px solid var(--border)",
                background: isActive ? "var(--surface-2)" : "transparent", color: "inherit",
              }}>
                <span style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "var(--surface-3)", color: c.accent, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 19 }}>{c.initial}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.who}</span>
                    {c.unread > 0 && <span style={{ flexShrink: 0, minWidth: 18, height: 18, borderRadius: 999, background: "var(--accent)", color: "#15101F", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 5px" }}>{c.unread}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{c.last}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* thread */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "var(--surface-3)", color: active.accent, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 16 }}>{active.initial}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{active.who}</div>
              <div style={{ fontSize: 12, color: "var(--text-mute)" }}>{active.role} · {active.about}</div>
            </div>
          </div>

          <div ref={bottomRef} style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 420 }}>
            {msgs.map((m, i) => {
              const mine = m.from === "me";
              return (
                <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "76%" }}>
                    <div style={{
                      padding: "10px 14px", borderRadius: 14, fontSize: 14, lineHeight: 1.5,
                      background: mine ? "var(--accent)" : "var(--surface-2)",
                      color: mine ? "#15101F" : "var(--text)",
                      borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4,
                    }}>{m.text}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-mute)", marginTop: 4, textAlign: mine ? "right" : "left" }}>{m.time}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
            <input
              value={drafts[activeId] || ""}
              onChange={(e) => setDrafts(d => ({ ...d, [activeId]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Escreva uma mensagem…"
              style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 999, padding: "11px 18px", fontSize: 14, color: "var(--text)", outline: "none" }}
            />
            <button onClick={send} aria-label="Enviar" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, border: "none", background: "var(--accent)", color: "#15101F", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <Icon.arrowR size={17} />
            </button>
          </div>
        </div>
      </div>
    </PageWrap>
  );
}

// ====================================================================
// PAGAMENTOS — methods + billing history
// ====================================================================
function PaymentsScreen({ notify }) {
  const methods = [
    { id: "pix", icon: <Icon.pix size={17} />, title: "Pix", detail: "Chave: camila@email.com", tag: "principal" },
    { id: "visa", icon: <Icon.card size={17} />, title: "Visa de crédito", detail: "•••• 4821 · vence 09/28" },
  ];
  const history = [
    { id: "h1", title: "Taxa de serviço — Kitnet na Liberdade", date: "9 fev 2025", value: 1477, status: "paid", method: "Pix" },
    { id: "h2", title: "Comissão do leiloeiro — Kitnet na Liberdade", date: "9 fev 2025", value: 4925, status: "paid", method: "Pix" },
    { id: "h3", title: "Sinal do arremate — Kitnet na Liberdade", date: "9 fev 2025", value: 19700, status: "paid", method: "Visa •••• 4821" },
    { id: "h4", title: "Caução — Studio no Tatuapé", date: "13 fev 2025", value: 5000, status: "pending", method: "Pix" },
  ];
  const statusInfo = {
    paid:    { label: "Pago", color: "var(--success-ink)", bg: "var(--success-dim)" },
    pending: { label: "Pendente", color: "var(--warning-ink)", bg: "rgba(255,192,122,0.12)" },
  };
  const totalPaid = history.filter(h => h.status === "paid").reduce((s, h) => s + h.value, 0);

  return (
    <PageWrap overline="Pagamentos" title="Suas formas de pagar e cobranças." subtitle="Métodos cadastrados e o histórico de tudo que você pagou no Leiloaê." max={920}>
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard label="Pago no total" value={fmtBRL(totalPaid)} tone="success" small />
        <StatCard label="Pendente" value={fmtBRL(history.filter(h => h.status === "pending").reduce((s, h) => s + h.value, 0))} tone="warning" small />
        <StatCard label="Métodos" value={methods.length} tone="accent" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <APanel title="Formas de pagamento" action="Adicionar" onAction={() => notify && notify("Adicionar forma de pagamento — em breve")}>
          {methods.map((m, i) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "15px 0", borderBottom: i === methods.length - 1 ? "none" : "1px solid var(--border)" }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--accent-ink)" }}>{m.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>
                  {m.title}
                  {m.tag && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent-ink)", background: "var(--accent-dim)", borderRadius: 999, padding: "1px 7px" }}>{m.tag}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 2 }}>{m.detail}</div>
              </div>
              <button onClick={() => notify && notify("Gerenciar método — em breve")} style={{ background: "transparent", border: "none", color: "var(--text-mute)", cursor: "pointer", fontSize: 18, padding: 6 }}>⋯</button>
            </div>
          ))}
        </APanel>
      </div>

      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-mute)", marginBottom: 12 }}>Histórico de pagamentos</div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        {history.map((h, i) => {
          const s = statusInfo[h.status];
          return (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 22px", borderBottom: i === history.length - 1 ? "none" : "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 500 }}>{h.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 2 }}>{h.date} · {h.method}</div>
              </div>
              <span style={{ padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 500, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 15, fontWeight: 600, minWidth: 96, textAlign: "right" }}>{fmtBRL(h.value)}</span>
            </div>
          );
        })}
      </div>
    </PageWrap>
  );
}

// ====================================================================
// CONFIGURAÇÕES — settings
// ====================================================================
function SettingsScreen({ theme = "dark", onSetTheme, onSignOut, onOpenPage, notify }) {
  const [prefs, setPrefs] = useStateAP({ outbid: true, ending: true, newLots: false, email: true, whatsapp: true });
  const [privacy, setPrivacy] = useStateAP({ publicProfile: false, analytics: true });
  const [lang, setLang] = useStateAP("pt-BR");
  const toggle = (set, k) => set(p => ({ ...p, [k]: !p[k] }));

  const themeOpts = [
    { id: "light", label: "Claro", icon: <Icon.sun size={14} /> },
    { id: "dark", label: "Escuro", icon: <Icon.moon size={14} /> },
  ];

  return (
    <PageWrap overline="Configurações" title="Ajuste o Leiloaê do seu jeito." subtitle="Aparência, notificações, privacidade e sua conta." max={820}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Appearance */}
        <APanel title="Aparência">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 14 }}>Tema</div>
            <div style={{ display: "flex", gap: 8 }}>
              {themeOpts.map(o => (
                <button key={o.id} onClick={() => onSetTheme && onSetTheme(o.id)} style={{
                  display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer",
                  border: "1px solid " + (theme === o.id ? "transparent" : "var(--border-2)"),
                  background: theme === o.id ? "var(--accent)" : "transparent",
                  color: theme === o.id ? "var(--bg)" : "var(--text-dim)",
                  fontWeight: theme === o.id ? 600 : 400,
                }}>{o.icon} {o.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0" }}>
            <div style={{ fontSize: 14 }}>Idioma</div>
            <select value={lang} onChange={(e) => { setLang(e.target.value); if (e.target.value !== "pt-BR") notify && notify("Outros idiomas — em breve"); }} style={{ background: "var(--surface-2)", border: "1px solid var(--border-2)", color: "var(--text)", borderRadius: 10, padding: "9px 14px", fontSize: 14, outline: "none" }}>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </APanel>

        {/* Notifications */}
        <APanel title="Notificações" sub="Como você quer ser avisada.">
          <ToggleLine label="Quando eu for superada num lance" checked={prefs.outbid} onChange={() => toggle(setPrefs, "outbid")} />
          <ToggleLine label="Leilão que salvei encerrando em breve" checked={prefs.ending} onChange={() => toggle(setPrefs, "ending")} />
          <ToggleLine label="Novos lotes na minha busca" checked={prefs.newLots} onChange={() => toggle(setPrefs, "newLots")} />
          <ToggleLine label="Resumo por e-mail" sub="Toda segunda, um apanhado da semana." checked={prefs.email} onChange={() => toggle(setPrefs, "email")} />
          <ToggleLine label="Avisos no WhatsApp" checked={prefs.whatsapp} onChange={() => toggle(setPrefs, "whatsapp")} last />
        </APanel>

        {/* Privacy */}
        <APanel title="Privacidade">
          <ToggleLine label="Perfil público" sub="Mostrar meu nome em lances e avaliações." checked={privacy.publicProfile} onChange={() => toggle(setPrivacy, "publicProfile")} />
          <ToggleLine label="Ajudar a melhorar o Leiloaê" sub="Compartilhar dados de uso anônimos." checked={privacy.analytics} onChange={() => toggle(setPrivacy, "analytics")} last />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "14px 0 4px" }}>
            <Button size="sm" variant="ghost" onClick={() => onOpenPage && onOpenPage("privacidade")}>Política de privacidade</Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenPage && onOpenPage("termos")}>Termos de uso</Button>
          </div>
        </APanel>

        {/* Danger zone */}
        <APanel title="Conta">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 14 }}>Sair da conta</div>
              <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 2 }}>Encerrar a sessão neste dispositivo.</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onSignOut && onSignOut()}>Sair</Button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0" }}>
            <div>
              <div style={{ fontSize: 14, color: "var(--hot-ink)" }}>Excluir minha conta</div>
              <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 2 }}>Remove seus dados permanentemente.</div>
            </div>
            <button onClick={() => notify && notify("Exclusão de conta — fale com o suporte")} style={{ background: "transparent", border: "1px solid var(--hot)", color: "var(--hot-ink)", borderRadius: 999, padding: "7px 16px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>Excluir</button>
          </div>
        </APanel>
      </div>
    </PageWrap>
  );
}

Object.assign(window, { HistoryScreen, MessagesScreen, PaymentsScreen, SettingsScreen });
