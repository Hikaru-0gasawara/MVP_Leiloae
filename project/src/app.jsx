// Main App — routes, state, Tweaks panel.

const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA, useRef: useRefA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "nav": "B",                  // A | B | C
  "accent": "#B59FF0",
  "density": "regular",
  "showLogged": true,
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = [
  "#B59FF0",  // warm violet (default — C6 / Nubank-dark vibe)
  "#7BE0B0",  // mint (Warren-ish)
  "#FFC07A",  // amber (Sotheby-ish)
  "#F4F1E8",  // editorial cream (mono / minimal)
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useStateA({ name: "home", lotId: null, winValue: null });
  const [category, setCategory] = useStateA("imovel"); // imovel | carro
  const [tourOpen, setTourOpen] = useStateA(false);
  const [bidLot, setBidLot] = useStateA(null);
  const [lots, setLots] = useStateA(LOTS);
  const [hasBid, setHasBid] = useStateA(false);
  const [navCMode, setNavCMode] = useStateA("explorar");
  const [notifOpen, setNotifOpen] = useStateA(false);
  const [loggedIn, setLoggedIn] = useStateA(true);
  const [toast, setToast] = useStateA(null);
  const [compareOpen, setCompareOpen] = useStateA(false);
  const [theme, setTheme] = useStateA(() => {
    try { return localStorage.getItem("leiloe:theme") || "dark"; } catch { return "dark"; }
  });
  const toastTimer = useRefA(null);

  // Apply light/dark theme to the document root
  useEffectA(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("leiloe:theme", theme); } catch {}
  }, [theme]);
  const onToggleTheme = () => setTheme(th => th === "light" ? "dark" : "light");
  const onSetTheme = (th) => setTheme(th);

  // Apply tweaks to CSS vars
  useEffectA(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
    // Derive accent-2 and accent-dim from base accent
    document.documentElement.style.setProperty("--accent-dim", hexAlpha(t.accent, theme === "light" ? 0.22 : 0.18));
    document.documentElement.style.setProperty("--accent-2", t.accent);
    // accent-ink = readable accent-colored TEXT. On dark themes the bright accent
    // works; on light themes it must be darkened to keep contrast on accent-dim tints.
    document.documentElement.style.setProperty("--accent-ink", theme === "light" ? darken(t.accent, 0.46) : t.accent);
  }, [t.accent, theme]);

  // Toast: listen for global "leiloe:toast" events from anywhere in the app.
  useEffectA(() => {
    const onToast = (e) => {
      setToast(e.detail);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2800);
    };
    window.addEventListener("leiloe:toast", onToast);
    return () => window.removeEventListener("leiloe:toast", onToast);
  }, []);

  const navigate = (name, lotId = null) => {
    setRoute({ name, lotId, winValue: null });
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const openLot = (lot) => {
    navigate("lot", lot.id);
  };

  const openPage = (pageId) => {
    setRoute({ name: "page", lotId: null, winValue: null, pageId });
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const openBid = (lot) => {
    setBidLot(lot);
  };

  const closeBid = () => setBidLot(null);

  const onSimulateWin = (lot, value) => {
    setHasBid(true);
    setBidLot(null);
    setRoute({ name: "win", lotId: lot.id, winValue: value });
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const saveLot = (lot) => {
    setLots(ls => ls.map(l => l.id === lot.id ? { ...l, saved: !l.saved } : l));
  };

  const notify = (msg) => window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: msg }));

  const onSignOut = () => { setLoggedIn(false); navigate("home"); notify("Você saiu da sua conta"); };
  const onSignIn = () => { setLoggedIn(true); notify("Bem-vinda de volta, Camila"); };

  const openCompare = () => {
    if (window.compareStore && window.compareStore.ids.length >= 2) setCompareOpen(true);
    else notify("Toque no ícone ⇄ em pelo menos 2 cards pra comparar");
  };

  const account = {
    loggedIn,
    onNavigate: navigate,
    onOpenPage: openPage,
    onTour: () => setTourOpen(true),
    onMyData: () => navigate("profile"),
    onNotifications: () => setNotifOpen(true),
    onSignOut, onSignIn,
    notify,
  };

  const currentLot = useMemoA(() => lots.find(l => l.id === route.lotId), [lots, route.lotId]);

  // For prototype: keep LOTS state in sync with `lots` so other components see saved state
  useEffectA(() => { window.LOTS = lots; }, [lots]);

  const renderNav = () => {
    const navProps = {
      route: route.name, category, onNavigate: navigate, onCategoryChange: setCategory,
      onTour: () => setTourOpen(true),
      onOpenNotifications: () => setNotifOpen(o => !o),
      notificationsOpen: notifOpen,
      theme, onToggleTheme,
      account,
    };
    if (t.nav === "A") return null;
    if (t.nav === "B") return <NavB {...navProps} />;
    return <NavC {...navProps} mode={navCMode} setMode={setNavCMode} />;
  };

  const renderScreen = () => {
    if (route.name === "home") return <HomeScreen onNavigate={navigate} onTour={() => setTourOpen(true)} onOpenLot={openLot} onCategoryChange={setCategory} onBid={openBid} onSave={saveLot} onOpenPage={openPage} lots={lots} />;
    if (route.name === "listing") return <ListingScreen onOpenLot={openLot} density={t.density} category={category} onCategoryChange={setCategory} onBid={openBid} onSave={saveLot} onOpenCompare={openCompare} lots={lots} />;
    if (route.name === "lot" && currentLot) return <LotDetailScreen lot={currentLot} onBack={() => navigate("listing")} onBid={openBid} onSave={saveLot} />;
    if (route.name === "win" && currentLot) return <WinScreen lot={currentLot} winValue={route.winValue} onNavigate={navigate} onTour={() => setTourOpen(true)} />;
    if (route.name === "my-bids") return <MyBidsScreen onOpenLot={openLot} />;
    if (route.name === "saved") return <SavedScreen onOpenLot={openLot} onBid={openBid} onSave={saveLot} onNavigate={navigate} onCategoryChange={setCategory} density={t.density} lots={lots} />;
    if (route.name === "profile") return <ProfileScreen onNavigate={navigate} onOpenLot={openLot} />;
    if (route.name === "history") return <HistoryScreen onOpenLot={openLot} onNavigate={navigate} />;
    if (route.name === "messages") return <MessagesScreen />;
    if (route.name === "payments") return <PaymentsScreen notify={notify} />;
    if (route.name === "settings") return <SettingsScreen theme={theme} onSetTheme={onSetTheme} onSignOut={onSignOut} onOpenPage={openPage} notify={notify} />;
    if (route.name === "page") return <PageScreen pageId={route.pageId} onNavigate={navigate} onOpenPage={openPage} onTour={() => setTourOpen(true)} />;
    return <HomeScreen onNavigate={navigate} onTour={() => setTourOpen(true)} onOpenLot={openLot} onCategoryChange={setCategory} onBid={openBid} onSave={saveLot} onOpenPage={openPage} lots={lots} />;
  };

  const layout = t.nav === "A" ? (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <NavA route={route.name} category={category} onNavigate={navigate} onCategoryChange={setCategory} onTour={() => setTourOpen(true)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <NavATopbar onTour={() => setTourOpen(true)} onOpenNotifications={() => setNotifOpen(o => !o)} notificationsOpen={notifOpen} account={account} theme={theme} onToggleTheme={onToggleTheme} />
        <main>{renderScreen()}</main>
        <Footer onOpenPage={openPage} onTour={() => setTourOpen(true)} onNavigate={navigate} />
      </div>
    </div>
  ) : (
    <div style={{ minHeight: "100vh" }}>
      {renderNav()}
      <main>{renderScreen()}</main>
      <Footer onOpenPage={openPage} onTour={() => setTourOpen(true)} onNavigate={navigate} />
    </div>
  );

  return (
    <>
      <GlobalStyles />
      {layout}

      <BidModal lot={bidLot} open={!!bidLot} onClose={closeBid} onWin={onSimulateWin} isFirstBid={!hasBid} />
      <TourOverlay open={tourOpen} onClose={() => setTourOpen(false)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <CompareBar onOpen={() => setCompareOpen(true)} hidden={compareOpen} />
      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} onBid={(lot) => { setCompareOpen(false); openBid(lot); }} />
      <Toast message={toast} />

      <TweaksPanel>
        <TweakSection label="Navegação & IA" />
        <NavVariationPicker
          value={t.nav}
          onChange={(v) => setTweak("nav", v)}
        />

        <TweakSection label="Cor de destaque" />
        <TweakColor
          label="Accent"
          value={t.accent}
          options={ACCENT_OPTIONS}
          onChange={(v) => setTweak("accent", v)}
        />

        <TweakSection label="Densidade" />
        <TweakRadio
          label="Cards"
          value={t.density}
          options={[
            { value: "compact", label: "Compacto" },
            { value: "regular", label: "Confortável" },
          ]}
          onChange={(v) => setTweak("density", v)}
        />

        <TweakSection label="Atalhos" />
        <TweakButton label="Fazer tour de iniciante" onClick={() => setTourOpen(true)}>Abrir tour</TweakButton>
        <TweakButton label="Meus dados (perfil)" onClick={() => navigate("profile")}>Abrir perfil</TweakButton>
        <TweakButton label="Ir pra tela de arremate" onClick={() => {
          const lot = lots[3]; // tatuapé
          setRoute({ name: "win", lotId: lot.id, winValue: lot.currentBid + 1500 });
          window.scrollTo({ top: 0 });
        }}>Ver tela de vitória</TweakButton>
        <TweakButton label="Resetar 'primeiro lance protegido'" onClick={() => setHasBid(false)}>Resetar</TweakButton>
      </TweaksPanel>
    </>
  );
}

// Custom picker for the 3 navigation variations — shows a tiny visual preview
function NavVariationPicker({ value, onChange }) {
  const variants = [
    {
      id: "A",
      label: "Sidebar persistente",
      sub: "Estilo dashboard. Boa pra usuários frequentes que querem ver tudo de uma vez.",
      preview: <NavPreviewA />,
    },
    {
      id: "B",
      label: "Top + ticker ao vivo",
      sub: "Marketplace clássico. Header limpo + barra com leilões encerrando agora.",
      preview: <NavPreviewB />,
    },
    {
      id: "C",
      label: "Hub contextual",
      sub: "3 modos: Aprender → Explorar → Acompanhar. Pra primeira visita.",
      preview: <NavPreviewC />,
    },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 2px" }}>
      {variants.map(v => {
        const active = value === v.id;
        return (
          <button key={v.id} onClick={() => onChange(v.id)} style={{
            padding: 10,
            background: active ? "rgba(181,159,240,0.10)" : "transparent",
            border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 10,
            display: "flex", gap: 10, alignItems: "flex-start",
            textAlign: "left", cursor: "pointer",
            color: "var(--text)",
          }}>
            <div style={{ width: 64, height: 44, borderRadius: 6, overflow: "hidden", background: "var(--bg)", border: "1px solid var(--border)", flexShrink: 0 }}>
              {v.preview}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                {v.label}
                {active && <span style={{ fontSize: 10, color: "var(--accent-ink)" }}>● ativo</span>}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-mute)", lineHeight: 1.4 }}>{v.sub}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Tiny SVG previews of each nav layout
function NavPreviewA() {
  return (
    <svg viewBox="0 0 64 44" width="64" height="44">
      <rect x="0" y="0" width="20" height="44" fill="rgba(255,255,255,0.06)" />
      <rect x="2" y="4" width="12" height="2.5" fill="rgba(255,255,255,0.4)" rx="1" />
      <rect x="2" y="11" width="14" height="2" fill="var(--accent)" rx="1" />
      <rect x="2" y="16" width="12" height="2" fill="rgba(255,255,255,0.3)" rx="1" />
      <rect x="2" y="21" width="10" height="2" fill="rgba(255,255,255,0.3)" rx="1" />
      <rect x="22" y="4" width="20" height="3" fill="rgba(255,255,255,0.15)" rx="1.5" />
      <rect x="22" y="12" width="40" height="14" fill="rgba(255,255,255,0.06)" rx="2" />
      <rect x="22" y="30" width="18" height="10" fill="rgba(255,255,255,0.06)" rx="2" />
      <rect x="44" y="30" width="18" height="10" fill="rgba(255,255,255,0.06)" rx="2" />
    </svg>
  );
}
function NavPreviewB() {
  return (
    <svg viewBox="0 0 64 44" width="64" height="44">
      <rect x="0" y="0" width="64" height="8" fill="rgba(255,255,255,0.06)" />
      <rect x="2" y="2.5" width="8" height="3" fill="var(--accent)" rx="0.5" />
      <rect x="14" y="2.5" width="6" height="3" fill="rgba(255,255,255,0.3)" rx="0.5" />
      <rect x="22" y="2.5" width="8" height="3" fill="rgba(255,255,255,0.3)" rx="0.5" />
      <rect x="32" y="2.5" width="20" height="3" fill="rgba(255,255,255,0.08)" rx="1.5" />
      <rect x="56" y="2.5" width="6" height="3" fill="rgba(255,255,255,0.15)" rx="1.5" />
      <rect x="0" y="8" width="64" height="5" fill="rgba(255,107,91,0.10)" />
      <circle cx="3" cy="10.5" r="1" fill="var(--hot)" />
      <rect x="6" y="9.5" width="10" height="2" fill="rgba(255,107,91,0.7)" rx="0.5" />
      <rect x="18" y="9.5" width="12" height="2" fill="rgba(255,255,255,0.3)" rx="0.5" />
      <rect x="32" y="9.5" width="10" height="2" fill="rgba(255,255,255,0.3)" rx="0.5" />
      <rect x="2" y="16" width="28" height="22" fill="rgba(255,255,255,0.06)" rx="2" />
      <rect x="34" y="16" width="28" height="22" fill="rgba(255,255,255,0.06)" rx="2" />
    </svg>
  );
}
function NavPreviewC() {
  return (
    <svg viewBox="0 0 64 44" width="64" height="44">
      <rect x="0" y="0" width="64" height="7" fill="rgba(255,255,255,0.06)" />
      <rect x="2" y="2" width="6" height="3" fill="var(--accent)" rx="0.5" />
      <rect x="42" y="2" width="14" height="3" fill="rgba(255,255,255,0.1)" rx="1.5" />
      <rect x="58" y="2" width="4" height="3" fill="rgba(255,255,255,0.15)" rx="1.5" />
      <rect x="0" y="7" width="64" height="7" fill="rgba(255,255,255,0.03)" />
      <rect x="2" y="9.5" width="10" height="2" fill="rgba(255,255,255,0.4)" rx="0.5" />
      <rect x="14" y="9.5" width="10" height="2" fill="var(--accent)" rx="0.5" />
      <rect x="26" y="9.5" width="10" height="2" fill="rgba(255,255,255,0.4)" rx="0.5" />
      <rect x="14" y="13" width="10" height="0.6" fill="var(--accent)" />
      <rect x="0" y="14" width="64" height="4" fill="rgba(255,255,255,0.02)" />
      <rect x="2" y="15.5" width="7" height="1.5" fill="rgba(255,255,255,0.3)" rx="0.75" />
      <rect x="11" y="15.5" width="6" height="1.5" fill="rgba(255,255,255,0.3)" rx="0.75" />
      <rect x="19" y="15.5" width="5" height="1.5" fill="rgba(255,255,255,0.3)" rx="0.75" />
      <rect x="2" y="21" width="60" height="20" fill="rgba(255,255,255,0.05)" rx="2" />
    </svg>
  );
}

// hex + alpha helper
function hexAlpha(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// darken a hex toward black by amt (0..1) — used for readable accent text in light mode
function darken(hex, amt) {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - amt));
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - amt));
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - amt));
  return `rgb(${r},${g},${b})`;
}

// Mount
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
