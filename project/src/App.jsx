// Main App — routes and global state.
import { useState, useEffect, useMemo, useRef } from "react";
import { LOTS } from "./data.js";
import { NavB, NotificationsPanel } from "./nav.jsx";
import { Footer, PageScreen } from "./pages.jsx";
import { HomeScreen, TourOverlay, ListingScreen, MyBidsScreen } from "./screens.jsx";
import { SavedScreen } from "./saved.jsx";
import { Toast, ProfileScreen } from "./account.jsx";
import { HistoryScreen, MessagesScreen, PaymentsScreen, SettingsScreen } from "./accountpages.jsx";
import { LotDetailScreen, WinScreen } from "./lotdetail.jsx";
import { BidModal } from "./bidmodal.jsx";
import { CompareBar, CompareModal } from "./compare.jsx";
import { compareStore } from "./state/compareStore.js";

export default function App() {
  const [route, setRoute] = useState({ name: "home", lotId: null, winValue: null });
  const [category, setCategory] = useState("todos"); // todos | imovel | carro
  const [tourOpen, setTourOpen] = useState(false);
  const [bidLot, setBidLot] = useState(null);
  const [lots, setLots] = useState(LOTS);
  const [hasBid, setHasBid] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(true);
  const [toast, setToast] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("leiloe:theme") || "dark"; } catch { return "dark"; }
  });
  const toastTimer = useRef(null);

  // Apply light/dark theme to the document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("leiloe:theme", theme); } catch { /* storage unavailable */ }
  }, [theme]);
  const onToggleTheme = () => setTheme(th => th === "light" ? "dark" : "light");
  const onSetTheme = (th) => setTheme(th);

  // Toast: listen for global "leiloe:toast" events from anywhere in the app.
  useEffect(() => {
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
    onSignOut, onSignIn,
    notify,
  };

  const currentLot = useMemo(() => lots.find(l => l.id === route.lotId), [lots, route.lotId]);

  const renderScreen = () => {
    if (route.name === "listing") return <ListingScreen onOpenLot={openLot} category={category} onCategoryChange={setCategory} onBid={openBid} onSave={saveLot} onOpenCompare={openCompare} lots={lots} />;
    if (route.name === "lot" && currentLot) return <LotDetailScreen lot={currentLot} onBack={() => navigate("listing")} onBid={openBid} onSave={saveLot} />;
    if (route.name === "win" && currentLot) return <WinScreen lot={currentLot} winValue={route.winValue} onNavigate={navigate} onTour={() => setTourOpen(true)} />;
    if (route.name === "my-bids") return <MyBidsScreen onOpenLot={openLot} lots={lots} />;
    if (route.name === "saved") return <SavedScreen onOpenLot={openLot} onBid={openBid} onSave={saveLot} onNavigate={navigate} onCategoryChange={setCategory} lots={lots} />;
    if (route.name === "profile") return <ProfileScreen onNavigate={navigate} onOpenLot={openLot} lots={lots} />;
    if (route.name === "history") return <HistoryScreen onOpenLot={openLot} onNavigate={navigate} />;
    if (route.name === "messages") return <MessagesScreen />;
    if (route.name === "payments") return <PaymentsScreen notify={notify} />;
    if (route.name === "settings") return <SettingsScreen theme={theme} onSetTheme={onSetTheme} onSignOut={onSignOut} onOpenPage={openPage} notify={notify} />;
    if (route.name === "page") return <PageScreen pageId={route.pageId} onNavigate={navigate} onOpenPage={openPage} onTour={() => setTourOpen(true)} />;
    return <HomeScreen onNavigate={navigate} onTour={() => setTourOpen(true)} onOpenLot={openLot} onCategoryChange={setCategory} onBid={openBid} onSave={saveLot} onOpenPage={openPage} lots={lots} />;
  };

  return (
    <>
      <div style={{ minHeight: "100vh" }}>
        <NavB
          route={route.name}
          category={category}
          onNavigate={navigate}
          onCategoryChange={setCategory}
          onTour={() => setTourOpen(true)}
          onOpenNotifications={() => setNotifOpen(o => !o)}
          notificationsOpen={notifOpen}
          theme={theme}
          onToggleTheme={onToggleTheme}
          account={account}
          lots={lots}
        />
        <main>{renderScreen()}</main>
        <Footer onOpenPage={openPage} onTour={() => setTourOpen(true)} onNavigate={navigate} />
      </div>

      <BidModal lot={bidLot} open={!!bidLot} onClose={closeBid} onWin={onSimulateWin} isFirstBid={!hasBid} onSeeLot={openLot} />
      <TourOverlay open={tourOpen} onClose={() => setTourOpen(false)} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
      <CompareBar onOpen={() => setCompareOpen(true)} hidden={compareOpen} lots={lots} />
      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} onBid={(lot) => { setCompareOpen(false); openBid(lot); }} lots={lots} />
      <Toast message={toast} />
    </>
  );
}
