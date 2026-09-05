// Three navigation/IA variations for Leiloê.

const { useState: useStateNav, useRef: useRefNav, useEffect: useEffectNav, useMemo: useMemoNav } = React;

// ---------- Shared: Logo wordmark ----------
function Wordmark({ size = 24, sub }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
      <span style={{
        fontFamily: "var(--serif)", fontStyle: "italic",
        fontSize: size, lineHeight: 1, color: "var(--text)",
        letterSpacing: "-0.02em",
      }}>
        Leilo<span style={{ color: "var(--accent-ink)" }}>aê</span>
      </span>
      {sub && <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--text-mute)" }}>{sub}</span>}
    </div>
  );
}

// ---------- Light/Dark toggle ----------
function ThemeToggle({ theme = "dark", onToggle, style }) {
  const isLight = theme === "light";
  return (
    <button onClick={onToggle} aria-label={isLight ? "Ativar modo escuro" : "Ativar modo claro"} title={isLight ? "Modo escuro" : "Modo claro"} style={{
      background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border-2)",
      borderRadius: 999, padding: "9px 11px", flexShrink: 0, cursor: "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      ...style,
    }}>
      {isLight ? <Icon.moon size={14} /> : <Icon.sun size={14} />}
    </button>
  );
}

// ---------- Top-level search input ----------
function NavSearch({ placeholder = "Buscar por bairro, modelo, lote…", style, onSubmit }) {
  const [v, setV] = useStateNav("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit && onSubmit(v); }} style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 999,
      padding: "10px 16px",
      color: "var(--text-mute)",
      transition: "border-color 0.15s ease",
      ...style,
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-2)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <Icon.search size={15} />
      <input
        value={v} onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        style={{
          background: "transparent", border: "none", outline: "none",
          color: "var(--text)", fontSize: 14, flex: 1, minWidth: 0,
        }}
      />
      <span style={{ fontSize: 11, color: "var(--text-mute)", border: "1px solid var(--border-2)", padding: "2px 6px", borderRadius: 6, fontFamily: "var(--mono)" }}>⌘ K</span>
    </form>
  );
}

// ---------- Account chip (with profile popover) ----------
function AccountChip({ compact, name = "Camila", fullName = "Camila Silva", email = "camila@email.com", onTour, onNavigate, onOpenPage, onMyData, onNotifications, onSignOut, onSignIn, notify, loggedIn = true, notifCount = 2 }) {
  const [open, setOpen] = useStateNav(false);
  const ref = useRefNav(null);
  useEffectNav(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // Logged-out: show an "Entrar" button instead of the avatar.
  if (!loggedIn) {
    return (
      <button onClick={() => onSignIn && onSignIn()} style={{
        display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0,
        background: "var(--accent)", color: "#15101F", border: "none",
        borderRadius: 999, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer",
      }}>
        <Icon.user size={14} /> Entrar
      </button>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 8,
        background: open ? "var(--surface-2)" : "transparent",
        border: "1px solid var(--border-2)",
        borderRadius: 999, padding: compact ? "4px 4px" : "4px 12px 4px 4px",
        cursor: "pointer", color: "var(--text)",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
          color: "#15101F", fontWeight: 600, fontSize: 13,
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>{name[0]}</div>
        {!compact && <span style={{ fontSize: 13.5, color: "var(--text-dim)" }}>{name}</span>}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 288,
          background: "var(--surface)",
          border: "1px solid var(--border-2)",
          borderRadius: 16,
          padding: "8px",
          boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7)",
          zIndex: 80,
          animation: "leiloe-scalein 0.15s ease",
          transformOrigin: "top right",
          maxHeight: "calc(100vh - 90px)", overflowY: "auto",
        }}>
          {/* identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 10px 14px" }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
              color: "#15101F", fontWeight: 600, fontSize: 18,
              display: "grid", placeItems: "center", fontFamily: "var(--serif)", fontStyle: "italic",
            }}>{name[0]}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullName}</div>
              <div style={{ fontSize: 12, color: "var(--text-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 10.5, fontWeight: 600, color: "var(--success-ink)", background: "var(--success-dim)", borderRadius: 999, padding: "2px 8px" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)" }} /> Modo iniciante
              </span>
            </div>
          </div>

          {/* activity group */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <MenuItem icon={<Icon.gavel size={15} />} onClick={() => { onNavigate && onNavigate("my-bids"); setOpen(false); }}>Meus lances</MenuItem>
            <MenuItem icon={<Icon.heart size={15} />} onClick={() => { onNavigate && onNavigate("saved"); setOpen(false); }}>Favoritos</MenuItem>
            <MenuItem icon={<Icon.clock size={15} />} onClick={() => { onNavigate && onNavigate("history"); setOpen(false); }}>Histórico</MenuItem>
            <MenuItem icon={<Icon.bell size={15} />} badge={notifCount} onClick={() => { onNotifications && onNotifications(); setOpen(false); }}>Notificações</MenuItem>
            <MenuItem icon={<Icon.chat size={15} />} onClick={() => { onNavigate && onNavigate("messages"); setOpen(false); }}>Mensagens</MenuItem>
          </div>

          <div style={{ height: 1, background: "var(--border)", margin: "8px 8px" }} />

          {/* account group */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <MenuItem icon={<Icon.user size={15} />} onClick={() => { onMyData && onMyData(); setOpen(false); }}>Meus dados</MenuItem>
            <MenuItem icon={<Icon.card size={15} />} onClick={() => { onNavigate && onNavigate("payments"); setOpen(false); }}>Pagamentos</MenuItem>
            <MenuItem icon={<Icon.gear size={15} />} onClick={() => { onNavigate && onNavigate("settings"); setOpen(false); }}>Configurações</MenuItem>
          </div>

          <div style={{ height: 1, background: "var(--border)", margin: "8px 8px" }} />

          {/* help group */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <MenuItem icon={<Icon.help size={15} />} onClick={() => { onOpenPage && onOpenPage("ajuda"); setOpen(false); }}>Central de ajuda</MenuItem>
            <MenuItem icon={<Icon.book size={15} />} onClick={() => { onOpenPage && onOpenPage("glossario"); setOpen(false); }}>Glossário</MenuItem>
            <MenuItem icon={<Icon.shield size={15} />} onClick={() => { onOpenPage && onOpenPage("privacidade"); setOpen(false); }}>Privacidade</MenuItem>
            <MenuItem icon={<Icon.doc size={15} />} onClick={() => { onOpenPage && onOpenPage("termos"); setOpen(false); }}>Termos de uso</MenuItem>
          </div>

          <div style={{ height: 1, background: "var(--border)", margin: "8px 8px" }} />

          <MenuItem icon={<SignOutIcon />} danger onClick={() => { onSignOut && onSignOut(); setOpen(false); }}>Sair</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, children, onClick, badge, danger }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 12px", background: "transparent", border: "none",
      color: danger ? "var(--hot)" : "var(--text)", fontSize: 13.5, textAlign: "left", cursor: "pointer",
      borderRadius: 8, width: "100%",
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ color: danger ? "var(--hot-ink)" : "var(--text-mute)", display: "flex", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {badge ? <span style={{ flexShrink: 0, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "var(--accent)", color: "#15101F", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center" }}>{badge}</span> : null}
    </button>
  );
}

const SignOutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h5" />
    <path d="M11 5l3 3-3 3M14 8H7" />
  </svg>
);

// ---------- Notifications panel ----------
const NOTIFICATIONS = [
  {
    id: "n1",
    type: "outbid",
    title: "Seu lance foi superado",
    body: "Studio no Tatuapé · novo lance R$ 158.200 (R$ 1.500 acima do seu).",
    time: "há 8 min",
    unread: true,
    cta: "Cobrir lance",
  },
  {
    id: "n2",
    type: "ending",
    title: "Encerrando em 1 hora",
    body: "Apto 2 dorm. — Vila Prudente. Você salvou este lote.",
    time: "há 32 min",
    unread: true,
    cta: "Ver lote",
  },
  {
    id: "n3",
    type: "info",
    title: "Janela de cancelamento expira em 18h",
    body: "Seu primeiro lance no Studio na Mooca. Tudo bem com sua decisão?",
    time: "há 6h",
    unread: false,
    cta: "Revisar",
  },
  {
    id: "n4",
    type: "vehicle",
    title: "Novo lote na sua busca: Civic",
    body: "Honda Civic EXL 2019 entrou em leilão. R$ 61.500.",
    time: "há 1d",
    unread: false,
    cta: "Ver",
  },
];

function NotificationsPanel({ open, onClose }) {
  const ref = useRefNav(null);
  useEffectNav(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} style={{
      position: "fixed",
      top: 64, right: 96,
      width: 380, maxHeight: "70vh",
      background: "var(--surface)",
      border: "1px solid var(--border-2)",
      borderRadius: 16,
      boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7)",
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      animation: "leiloe-scalein 0.18s ease",
      transformOrigin: "top right",
      zIndex: 90,
    }}>
        <div style={{ padding: "18px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 20, lineHeight: 1.1 }}>Notificações</div>
            <div style={{ fontSize: 12, color: "var(--text-mute)", marginTop: 3 }}>{NOTIFICATIONS.filter(n => n.unread).length} não lidas</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)", borderRadius: "50%", width: 28, height: 28, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <Icon.close size={12} />
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {NOTIFICATIONS.map(n => (
            <div key={n.id} style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex", gap: 12,
              background: n.unread ? "rgba(181,159,240,0.04)" : "transparent",
              cursor: "pointer",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: n.type === "outbid" ? "rgba(255,107,91,0.12)" :
                            n.type === "ending" ? "rgba(255,192,122,0.14)" :
                            n.type === "vehicle" ? "rgba(110,231,224,0.12)" :
                            "var(--accent-dim)",
                color: n.type === "outbid" ? "var(--hot)" :
                       n.type === "ending" ? "var(--warning)" :
                       n.type === "vehicle" ? "#6EE7E0" : "var(--accent)",
                display: "grid", placeItems: "center", flexShrink: 0,
              }}>
                {n.type === "outbid" ? <Icon.gavel size={14} /> :
                 n.type === "ending" ? <Icon.bell size={14} /> :
                 n.type === "vehicle" ? "🚗" :
                 <Icon.shield size={14} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{n.title}</span>
                  {n.unread && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, marginTop: 6 }} />}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.45, marginBottom: 6 }}>{n.body}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-mute)" }}>{n.time}</span>
                  <button style={{ background: "transparent", border: "none", color: "var(--accent-ink)", fontSize: 12, fontWeight: 500, cursor: "pointer", padding: 0 }}>{n.cta} →</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", textAlign: "center" }}>
          <button style={{ background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 12.5, cursor: "pointer" }}>Marcar todas como lidas</button>
        </div>
    </div>
  );
}

// =====================================================================
// VARIATION A — Sidebar persistente
// =====================================================================
function NavA({ route, category, onNavigate, onCategoryChange, onTour }) {
  const items = [
    { id: "home",       label: "Início",        icon: <Icon.spark /> },
    { id: "imoveis",    label: "Imóveis",       icon: <Icon.compass />, badge: window.LOTS.filter(l => l.category === "imovel").length },
    { id: "veiculos",   label: "Veículos",      icon: <Icon.gavel />, badge: window.LOTS.filter(l => l.category === "carro").length },
    { id: "saved",      label: "Salvos",        icon: <Icon.heart />, badge: window.LOTS.filter(l => l.saved).length },
    { id: "my-bids",    label: "Meus lances",   icon: <Icon.list /> },
    { id: "learn",      label: "Como funciona", icon: <Icon.book /> },
  ];
  const isActive = (id) => {
    if (id === "home") return route === "home";
    if (id === "imoveis") return (route === "listing" || route === "lot") && category === "imovel";
    if (id === "veiculos") return (route === "listing" || route === "lot") && category === "carro";
    return route === id;
  };
  return (
    <aside style={{
      position: "sticky", top: 0, alignSelf: "flex-start",
      width: 248, height: "100vh",
      borderRight: "1px solid var(--border)",
      background: "var(--bg)",
      display: "flex", flexDirection: "column",
      padding: "22px 16px 18px",
      flexShrink: 0,
    }}>
      <div style={{ padding: "0 8px 18px", borderBottom: "1px solid var(--border)" }}>
        <Wordmark size={26} sub="beta" />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 14, flex: 1 }}>
        {items.map(it => {
          const active = isActive(it.id);
          return (
            <button key={it.id} onClick={() => {
              if (it.id === "imoveis") { onCategoryChange("imovel"); onNavigate("listing"); }
              else if (it.id === "veiculos") { onCategoryChange("carro"); onNavigate("listing"); }
              else if (it.id === "learn") { onTour(); }
              else if (it.id === "saved") { onNavigate("saved"); }
              else if (it.id === "my-bids") { onNavigate("my-bids"); }
              else { onNavigate(it.id); }
            }}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 10,
                background: active ? "var(--surface-2)" : "transparent",
                color: active ? "var(--text)" : "var(--text-dim)",
                border: "none", textAlign: "left",
                fontSize: 14, fontWeight: active ? 500 : 400,
                position: "relative", cursor: "pointer",
              }}>
              <span style={{ color: active ? "var(--accent-ink)" : "var(--text-mute)", display: "flex" }}>{it.icon}</span>
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge != null && (
                <span style={{
                  fontSize: 11, fontFamily: "var(--mono)",
                  background: active ? "var(--accent-dim)" : "var(--surface-2)",
                  color: active ? "var(--accent-ink)" : "var(--text-mute)",
                  padding: "1px 7px", borderRadius: 999,
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{
        marginTop: 16, padding: "14px",
        background: "linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%)",
        border: "1px solid rgba(181,159,240,0.18)",
        borderRadius: 14,
      }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 17, lineHeight: 1.2, marginBottom: 6 }}>
          Primeiro lance?
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10, lineHeight: 1.4 }}>
          Janela de 24h pra cancelar. Sem multa.
        </div>
        <button onClick={onTour} style={{
          background: "var(--accent)", color: "#15101F", border: "none",
          padding: "8px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 500,
          cursor: "pointer", width: "100%",
        }}>Fazer tour ›</button>
      </div>
    </aside>
  );
}

function NavATopbar({ onTour, onOpenNotifications, notificationsOpen, account, theme, onToggleTheme }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "16px 32px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg)",
      position: "sticky", top: 0, zIndex: 20,
    }}>
      <div style={{ flex: 1 }} />
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <button onClick={onTour} style={{
        background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border-2)",
        borderRadius: 999, padding: "8px 14px", fontSize: 13, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
      }}>
        <Icon.book size={14} /> Como funciona
      </button>
      <button onClick={onOpenNotifications} style={{
        position: "relative",
        background: notificationsOpen ? "var(--surface-2)" : "transparent",
        color: "var(--text-dim)", border: "1px solid var(--border-2)",
        borderRadius: 999, padding: "9px 11px",
        cursor: "pointer",
      }}>
        <Icon.bell size={14} />
        <span style={{ position: "absolute", top: 4, right: 6, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
      </button>
      <AccountChip onTour={onTour} {...account} />
    </div>
  );
}

// =====================================================================
// VARIATION B — Top minimalista + Live ticker (DEFAULT)
// =====================================================================
function NavB({ route, category, onNavigate, onCategoryChange, onTour, onOpenNotifications, notificationsOpen, account, theme, onToggleTheme }) {
  const items = [
    { id: "auctions", label: "Leilões" },
    { id: "bids",     label: "Meus lances" },
    { id: "saved",    label: "Salvos" },
  ];

  const ticker = useMemoNav(() => {
    return [...window.LOTS].sort((a, b) => a.endsAt - b.endsAt);
  }, [window.LOTS]);

  const activeId = (route === "listing" || route === "lot") ? "auctions"
                 : route === "my-bids" ? "bids"
                 : route === "saved" ? "saved" : null;

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 18,
        padding: "16px 28px",
        maxWidth: 1440, margin: "0 auto",
      }}>
        <button onClick={() => onNavigate("home")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
          <Wordmark size={26} />
        </button>
        <nav style={{ display: "flex", gap: 2, minWidth: 0, flexShrink: 0 }}>
          {items.map(it => {
            const active = activeId === it.id;
            return (
              <button key={it.id} onClick={() => {
                if (it.id === "auctions") onNavigate("listing");
                else if (it.id === "bids") onNavigate("my-bids");
                else if (it.id === "saved") onNavigate("saved");
              }}
                style={{
                  background: "transparent", border: "none",
                  color: active ? "var(--text)" : "var(--text-dim)",
                  padding: "8px 16px", borderRadius: 999,
                  fontSize: 14, fontWeight: active ? 500 : 400,
                  position: "relative", whiteSpace: "nowrap", cursor: "pointer",
                }}>
                {it.label}
                {active && <span style={{
                  position: "absolute", left: "50%", bottom: -19, width: 4, height: 4,
                  borderRadius: "50%", background: "var(--accent)", transform: "translateX(-50%)",
                }} />}
              </button>
            );
          })}
        </nav>
        <div style={{ flex: 1, minWidth: 12 }} />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button onClick={onTour} style={{
          background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border-2)",
          borderRadius: 999, padding: "8px 14px", fontSize: 13, cursor: "pointer", flexShrink: 0,
          display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
        }}>
          <Icon.book size={14} /> Como funciona
        </button>
        <button onClick={onOpenNotifications} aria-label="Notificações" style={{
          position: "relative",
          background: notificationsOpen ? "var(--surface-2)" : "transparent",
          color: "var(--text-dim)", border: "1px solid var(--border-2)",
          borderRadius: 999, padding: "9px 11px", flexShrink: 0, cursor: "pointer",
        }}>
          <Icon.bell size={14} />
          <span style={{ position: "absolute", top: 4, right: 6, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
        </button>
        <AccountChip {...account} />
      </div>

      {/* Animated marquee ticker */}
      <div style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-2)",
        overflow: "hidden",
        position: "relative",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 0 10px 28px",
          fontSize: 12.5,
          maxWidth: "100%",
        }}>
          <Badge tone="hot" style={{ flexShrink: 0, marginRight: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--hot)", animation: "leiloe-pulse 1.2s infinite", marginRight: 2 }} />
            Encerrando
          </Badge>
          <MarqueeTrack items={ticker} onClick={(lot) => {
            onCategoryChange(lot.category === "carro" ? "carro" : "imovel");
            onNavigate("lot", lot.id);
          }} />
        </div>
      </div>
    </header>
  );
}

// Continuous marquee — duplicates the items so the loop is seamless.
// Pauses on hover; respects prefers-reduced-motion.
function MarqueeTrack({ items, onClick }) {
  const [paused, setPaused] = useStateNav(false);
  const [reducedMotion, setReducedMotion] = useStateNav(false);
  useEffectNav(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener && mq.addEventListener("change", handler);
    return () => mq.removeEventListener && mq.removeEventListener("change", handler);
  }, []);
  const duplicated = [...items, ...items];
  const speed = Math.max(48, items.length * 7); // ~7s per item
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ flex: 1, overflow: "hidden", position: "relative", maskImage: "linear-gradient(to right, transparent, black 4%, black 96%, transparent)" }}
    >
      <div style={{
        display: "inline-flex", gap: 28, whiteSpace: "nowrap",
        animation: `leiloe-marquee ${speed}s linear infinite`,
        animationPlayState: paused ? "paused" : "running",
        paddingRight: 28,
      }}>
        {duplicated.map((lot, i) => (
          <button key={`${lot.id}-${i}`} onClick={() => onClick(lot)} style={{
            background: "transparent", border: "none", color: "var(--text-dim)",
            padding: 0, display: "inline-flex", alignItems: "center", gap: 8,
            whiteSpace: "nowrap", fontSize: 13, cursor: "pointer",
          }}>
            <span style={{ color: lot.category === "carro" ? "#FFC07A" : "var(--accent)" }}>
              {lot.category === "carro" ? "🚗" : "⌂"}
            </span>
            <span style={{ color: "var(--text)" }}>{lot.title}</span>
            <span style={{ color: "var(--text-mute)", fontFamily: "var(--mono)", fontSize: 12 }}>{fmtBRL(lot.currentBid)}</span>
            <span style={{ color: "var(--text-mute)" }}>·</span>
            <Countdown endsAt={lot.endsAt} compact />
          </button>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// VARIATION C — Hub contextual
// =====================================================================
function NavC({ route, category, onNavigate, onCategoryChange, onTour, mode, setMode, onOpenNotifications, notificationsOpen, account, theme, onToggleTheme }) {
  const modes = [
    { id: "aprender",   label: "Aprender",   sub: "Tour, glossário, simuladores" },
    { id: "explorar",   label: "Explorar",   sub: "Catálogo, filtros, salvos" },
    { id: "acompanhar", label: "Acompanhar", sub: "Lances, alertas, arremates" },
  ];

  const subnavExplore = [
    { id: "imovel", label: "Imóveis", action: () => { onCategoryChange("imovel"); onNavigate("listing"); } },
    { id: "carro",  label: "Veículos", action: () => { onCategoryChange("carro");  onNavigate("listing"); } },
    { id: "ending", label: "Encerrando hoje", action: () => { onNavigate("listing"); } },
    { id: "saved",  label: "Salvos", action: () => { onNavigate("saved"); } },
  ];
  const subnavLearn = [
    { id: "tour",     label: "Tour de iniciante",  action: onTour },
    { id: "gloss",    label: "Glossário",          action: () => {} },
    { id: "sim",      label: "Simulador de custo", action: () => {} },
    { id: "faq",      label: "Perguntas frequentes", action: () => {} },
  ];
  const subnavFollow = [
    { id: "active",   label: "Meus lances ativos", action: () => onNavigate("my-bids") },
    { id: "alerts",   label: "Alertas configurados", action: () => {} },
    { id: "wins",     label: "Arremates", action: () => {} },
    { id: "history",  label: "Histórico", action: () => {} },
  ];
  const subnav = mode === "aprender" ? subnavLearn : mode === "acompanhar" ? subnavFollow : subnavExplore;

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "16px 28px",
        maxWidth: 1440, margin: "0 auto",
      }}>
        <button onClick={() => onNavigate("home")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
          <Wordmark size={26} />
        </button>
        <div style={{ flex: 1 }} />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button onClick={onOpenNotifications} style={{
          position: "relative",
          background: notificationsOpen ? "var(--surface-2)" : "transparent",
          color: "var(--text-dim)", border: "1px solid var(--border-2)",
          borderRadius: 999, padding: "9px 11px", flexShrink: 0, cursor: "pointer",
        }}>
          <Icon.bell size={14} />
          <span style={{ position: "absolute", top: 4, right: 6, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
        </button>
        <AccountChip onTour={onTour} compact {...account} />
      </div>

      <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
        <div style={{ display: "flex", maxWidth: 1440, margin: "0 auto", padding: "0 28px" }}>
          {modes.map(m => {
            const active = mode === m.id;
            return (
              <button key={m.id}
                onClick={() => {
                  setMode(m.id);
                  if (m.id === "aprender") onTour();
                  else if (m.id === "explorar") onNavigate("listing");
                  else if (m.id === "acompanhar") onNavigate("my-bids");
                }}
                style={{
                  background: "transparent", border: "none",
                  padding: "14px 22px",
                  textAlign: "left",
                  color: active ? "var(--text)" : "var(--text-dim)",
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: -1,
                  cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: 2,
                }}>
                <span style={{ fontSize: 14.5, fontWeight: active ? 500 : 400 }}>{m.label}</span>
                <span style={{ fontSize: 11.5, color: "var(--text-mute)" }}>{m.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-2)" }}>
        <div style={{ display: "flex", gap: 4, maxWidth: 1440, margin: "0 auto", padding: "10px 28px", overflowX: "auto", scrollbarWidth: "none" }}>
          {subnav.map((item, i) => {
            const active = mode === "explorar" && (item.id === category || (item.id === "imovel" && category === "imovel") || (item.id === "carro" && category === "carro"));
            return (
              <button key={item.id} onClick={item.action} style={{
                background: active ? "var(--surface-2)" : "transparent",
                color: active ? "var(--text)" : "var(--text-dim)",
                border: "1px solid", borderColor: active ? "var(--border-2)" : "transparent",
                borderRadius: 999, padding: "6px 14px", fontSize: 13, whiteSpace: "nowrap", cursor: "pointer",
              }}>{item.label}</button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

Object.assign(window, { NavA, NavATopbar, NavB, NavC, Wordmark, NavSearch, AccountChip, NotificationsPanel });
