// Aplicação — rotas, estado global e composição das telas.
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { isEnded, minBidFor } from "./domain/auction.js";
import { useNow } from "./lib/clock.js";
import { IS_DEMO } from "./lib/config.js";
import { routeToPath, pathToRoute, routeTitle } from "./lib/router.js";
import { track, FUNIL } from "./lib/telemetry.js";
import { useCatalogo } from "./state/catalogo.js";
import { TEM_SERVIDOR } from "./api/client.js";
import { compareStore } from "./state/compareStore.js";
import { NavB, NotificationsPanel } from "./nav.jsx";
import { Footer, PageScreen } from "./pages.jsx";
import { HomeScreen, TourOverlay, ListingScreen } from "./screens.jsx";
import { MyBidsScreen } from "./mybids.jsx";
import { SavedScreen } from "./saved.jsx";
import { Toast, ProfileScreen } from "./account.jsx";
import { HistoryScreen, MessagesScreen, PaymentsScreen, SettingsScreen } from "./accountpages.jsx";
import { LotDetailScreen, WinScreen } from "./lotdetail.jsx";
import { BidModal } from "./bidmodal.jsx";
import { CompareBar, CompareModal } from "./compare.jsx";
import { ErrorBoundary } from "./ui/ErrorBoundary.jsx";
import { DemoBanner } from "./ui/DemoBanner.jsx";
import { CarregandoCatalogo, FalhaAoCarregar } from "./ui/Estados.jsx";
import { TelaDeEntrada } from "./ui/TelaDeEntrada.jsx";

export default function App() {
  const [route, setRoute] = useState(() => pathToRoute(window.location.pathname));
  const [category, setCategory] = useState("todos");
  const [tourOpen, setTourOpen] = useState(false);
  const [bidLot, setBidLot] = useState(null);
  const [bidSuggestion, setBidSuggestion] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("leiloe:theme") || "dark"; } catch { return "dark"; }
  });
  const toastTimer = useRef(null);
  const now = useNow();

  // Uma interface, duas implementações: com servidor ou em demonstração local.
  // As telas abaixo não sabem qual está rodando (ARCH-001).
  const catalogo = useCatalogo();
  const { lotes: lots, meusLances: minhasApostas, sessao, acoes } = catalogo;
  const loggedIn = Boolean(sessao.usuario);
  const currentLot = useMemo(() => lots.find((l) => l.id === route.lotId), [lots, route.lotId]);

  // Tema
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("leiloe:theme", theme); } catch { /* armazenamento indisponível */ }
  }, [theme]);

  // Título do documento acompanha a rota.
  useEffect(() => { document.title = routeTitle(route, currentLot); }, [route, currentLot]);

  // Toast global
  useEffect(() => {
    const onToast = (e) => {
      setToast(e.detail);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2800);
    };
    window.addEventListener("leiloe:toast", onToast);
    return () => {
      window.removeEventListener("leiloe:toast", onToast);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Botão voltar/avançar do navegador (ARCH-002)
  useEffect(() => {
    const onPop = () => setRoute(pathToRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((name, lotId = null, extra = {}) => {
    const next = { name, lotId, ...extra };
    setRoute(next);
    const path = routeToPath(next);
    if (path !== window.location.pathname) window.history.pushState({}, "", path);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const openLot = useCallback((lot) => {
    track(FUNIL.verLote, { lote: lot.id, categoria: lot.category });
    navigate("lot", lot.id);
  }, [navigate]);
  const openPage = useCallback((pageId) => navigate("page", null, { pageId }), [navigate]);

  const notify = (msg) => window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: msg }));

  /** Abre o modal de lance — recusa lote encerrado antes mesmo de abrir (BIZ-002). */
  const openBid = useCallback((lot, suggestion = null) => {
    if (isEnded(lot, Date.now())) {
      notify("Este leilão já encerrou.");
      return;
    }
    track(FUNIL.abrirLance, { lote: lot.id, categoria: lot.category });
    setBidSuggestion(suggestion ?? minBidFor(lot));
    setBidLot(lot);
  }, []);

  const closeBid = () => { setBidLot(null); setBidSuggestion(null); };

  /**
   * Confirma o lance. Em modo servidor a decisão é DELE: aqui só se envia e se
   * relata o que voltou. Uma recusa (superado, encerrado, sem sessão) nunca
   * vira sucesso na tela — era exatamente o defeito BIZ-001/SEC-004.
   * @returns {Promise<{ok: boolean, erro?: Error}>}
   */
  const confirmBid = async ({ lot, value, autoMax }) => {
    // Só identificador e número: nada do que a pessoa digitou sai daqui.
    track(FUNIL.confirmarLance, { lote: lot.id, categoria: lot.category, valor: value, teto: autoMax || null });
    const r = await acoes.darLance({ lote: lot, valor: value, teto: autoMax });
    if (!r.ok) notify(r.erro?.mensagem || "Não foi possível registrar o lance.");
    return r;
  };

  const cancelBid = async (bidId) => {
    track(FUNIL.cancelarLance, {});
    const r = await acoes.cancelarLance(bidId);
    notify(r.ok ? "Lance cancelado dentro da janela de 24h." : (r.erro?.mensagem || "Não foi possível cancelar."));
    return r;
  };

  const saveLot = async (lot) => {
    const r = await acoes.alternarSalvo(lot);
    if (!r.ok) notify(r.erro?.precisaEntrar ? "Entre na sua conta para salvar lotes." : "Não foi possível salvar.");
    return r;
  };

  const onSimulateWin = (lot) => {
    track(FUNIL.arremate, { lote: lot.id, categoria: lot.category });
    closeBid();
    navigate("win", lot.id);
  };

  const onSignOut = async () => {
    await acoes.sair?.();
    navigate("home");
    notify("Você saiu da sua conta");
  };
  // Sem servidor não existe conta: o botão leva ao aviso de demonstração.
  const onSignIn = () => (TEM_SERVIDOR ? navigate("entrar") : notify("Modo demonstração: a conta é fictícia."));

  const openCompare = () => {
    if (compareStore.ids.length >= 2) setCompareOpen(true);
    else notify("Toque no ícone ⇄ em pelo menos 2 cards pra comparar");
  };

  const account = {
    loggedIn,
    onNavigate: navigate,
    onOpenPage: openPage,
    onTour: () => setTourOpen(true),
    onMyData: () => navigate("profile"),
    onNotifications: () => setNotifOpen(true),
    onSignOut, onSignIn, notify,
  };

  const renderScreen = () => {
    // Com servidor, o catálogo tem três estados. Sem servidor, `estado` é
    // sempre "pronto" e estes dois ramos nunca aparecem (FRONT-010).
    if (catalogo.estado === "carregando") return <CarregandoCatalogo />;
    if (catalogo.estado === "erro") {
      return <FalhaAoCarregar erro={catalogo.erro} aoTentarDeNovo={catalogo.recarregar} />;
    }

    switch (route.name) {
      case "entrar":
        return loggedIn
          ? <NotFound onNavigate={navigate} />
          : <TelaDeEntrada acoes={acoes} aoEntrar={() => navigate("listing")} aoVoltar={() => navigate("listing")} />;
      case "listing":
        return <ListingScreen onOpenLot={openLot} category={category} onCategoryChange={setCategory} onBid={openBid} onSave={saveLot} onOpenCompare={openCompare} lots={lots} />;
      case "lot":
        return currentLot
          ? <LotDetailScreen lot={currentLot} onBack={() => navigate("listing")} onBid={openBid} onSave={saveLot} />
          : <NotFound onNavigate={navigate} />;
      case "win":
        return currentLot
          ? <WinScreen lot={currentLot} winValue={minhasApostas.find((e) => e.lot.id === currentLot.id)?.bid.value} onNavigate={navigate} onTour={() => setTourOpen(true)} />
          : <NotFound onNavigate={navigate} />;
      case "my-bids":
        return <MyBidsScreen bids={minhasApostas} onOpenLot={openLot} onBid={openBid} onCancelBid={cancelBid} onNavigate={navigate} />;
      case "saved":
        return <SavedScreen onOpenLot={openLot} onBid={openBid} onSave={saveLot} onNavigate={navigate} onCategoryChange={setCategory} lots={lots} />;
      case "profile":
        return <ProfileScreen onNavigate={navigate} onOpenLot={openLot} lots={lots} bidsCount={minhasApostas.length} />;
      case "history":
        return <HistoryScreen onOpenLot={openLot} onNavigate={navigate} lots={lots} bids={minhasApostas} />;
      case "messages":
        return <MessagesScreen />;
      case "payments":
        return <PaymentsScreen notify={notify} />;
      case "settings":
        return <SettingsScreen theme={theme} onSetTheme={setTheme} onSignOut={onSignOut} onOpenPage={openPage} notify={notify} />;
      case "page":
        return <PageScreen pageId={route.pageId} onNavigate={navigate} onOpenPage={openPage} onTour={() => setTourOpen(true)} />;
      default:
        return <HomeScreen onNavigate={navigate} onTour={() => setTourOpen(true)} onOpenLot={openLot} onCategoryChange={setCategory} onBid={openBid} onSave={saveLot} onOpenPage={openPage} lots={lots} />;
    }
  };

  const primeiroLance = minhasApostas.filter((e) => !e.bid.canceled).length === 0;

  return (
    <>
      {IS_DEMO && <DemoBanner />}
      <div style={{ minHeight: "100vh" }}>
        <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
        <NavB
          route={route.name}
          category={category}
          onNavigate={navigate}
          onCategoryChange={setCategory}
          onTour={() => setTourOpen(true)}
          onOpenNotifications={() => setNotifOpen((o) => !o)}
          notificationsOpen={notifOpen}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          account={account}
          lots={lots}
          now={now}
        />
        <main id="conteudo">
          <ErrorBoundary onReset={() => navigate("home")}>{renderScreen()}</ErrorBoundary>
        </main>
        <Footer onOpenPage={openPage} onTour={() => setTourOpen(true)} onNavigate={navigate} />
      </div>

      <BidModal
        lot={bidLot}
        open={Boolean(bidLot)}
        onClose={closeBid}
        onConfirm={confirmBid}
        onWin={onSimulateWin}
        onSeeLot={openLot}
        onSeeMyBids={() => navigate("my-bids")}
        isFirstBid={primeiroLance}
        suggestedValue={bidSuggestion}
      />
      <TourOverlay open={tourOpen} onClose={() => setTourOpen(false)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <CompareBar onOpen={() => setCompareOpen(true)} hidden={compareOpen} lots={lots} />
      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} onBid={(lot) => { setCompareOpen(false); openBid(lot); }} lots={lots} />
      <Toast message={toast} />
    </>
  );
}

/** Rota desconhecida ou lote inexistente — antes caía silenciosamente na home. */
function NotFound({ onNavigate }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "96px 40px", textAlign: "center" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 40, fontWeight: 400, margin: "0 0 12px" }}>
        Não encontramos esse lote.
      </h1>
      <p style={{ color: "var(--text-dim)", fontSize: 16, lineHeight: 1.6, margin: "0 0 24px" }}>
        Ele pode ter saído do catálogo ou o endereço está incorreto.
      </p>
      <button
        onClick={() => onNavigate("listing")}
        style={{
          background: "var(--accent)", color: "#15101F", border: "none",
          borderRadius: 999, padding: "12px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer",
        }}
      >
        Ver leilões abertos
      </button>
    </div>
  );
}
