// SAVED / Favoritados — lots the user has hearted.
import { useMemo } from "react";
import { LOTS } from "./data.js";
import { formatBRL as fmtBRL, isEnded } from "./domain/auction.js";
import { useNow } from "./lib/clock.js";
import { SectionHead, Button, Icon, LotCard } from "./components.jsx";
import { StatCard } from "./screens.jsx";

export function SavedScreen({ onOpenLot, onBid, onSave, onNavigate, onCategoryChange, density = "regular", lots = LOTS }) {
  const agora = useNow();
  const saved = useMemo(() => lots.filter(l => l.saved), [lots]);
  const imoveis = saved.filter(l => l.category === "imovel");
  const veiculos = saved.filter(l => l.category === "carro");

  // Sum of current bids across saved lots, and how many are ending within 6h.
  const totalValue = saved.reduce((s, l) => s + l.currentBid, 0);
  const endingSoon = saved.filter(l => !isEnded(l, agora) && (l.endsAt - agora) < 1000 * 60 * 60 * 6).length;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 40px 80px", animation: "leiloe-fadein 0.3s ease" }}>
      <SectionHead
        as="h1"
        overline="Favoritos"
        title="Seus lotes salvos."
        subtitle={
          saved.length === 0
            ? "Toque no coração de qualquer lote pra acompanhá-lo aqui."
            : <><b style={{ color: "var(--text)" }}>{saved.length} {saved.length === 1 ? "lote salvo" : "lotes salvos"}</b> · a gente te avisa quando estiverem encerrando.</>
        }
        right={
          saved.length > 0 &&
          <Button variant="ghost" size="sm" iconRight={<Icon.arrowR size={14} />} onClick={() => { onCategoryChange && onCategoryChange("todos"); onNavigate("listing"); }}>
            Explorar mais
          </Button>
        }
      />

      {saved.length === 0 ? (
        <SavedEmpty onNavigate={onNavigate} onCategoryChange={onCategoryChange} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 40, flexWrap: "wrap" }}>
            <StatCard label="Salvos" value={saved.length} tone="accent" />
            <StatCard label="Encerrando em 6h" value={endingSoon} tone="warning" />
            <StatCard label="Soma dos lances" value={fmtBRL(totalValue)} tone="success" small />
          </div>

          {imoveis.length > 0 && (
            <SavedGroup title="Imóveis" count={imoveis.length}>
              {imoveis.map(lot => <LotCard key={lot.id} lot={lot} onClick={onOpenLot} density={density} onBid={onBid} onSave={onSave} />)}
            </SavedGroup>
          )}

          {veiculos.length > 0 && (
            <SavedGroup title="Veículos" count={veiculos.length}>
              {veiculos.map(lot => <LotCard key={lot.id} lot={lot} onClick={onOpenLot} density={density} onBid={onBid} onSave={onSave} />)}
            </SavedGroup>
          )}
        </>
      )}
    </div>
  );
}

function SavedGroup({ title, count, children }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-mute)" }}>{title}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-mute)" }}>{count}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
        {children}
      </div>
    </section>
  );
}

function SavedEmpty({ onNavigate, onCategoryChange }) {
  return (
    <div style={{
      padding: "72px 32px", textAlign: "center",
      background: "var(--surface)", border: "1px dashed var(--border-2)", borderRadius: 22,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    }}>
      <div style={{
        width: 76, height: 76, borderRadius: "50%",
        background: "var(--accent-dim)", color: "var(--accent-ink)",
        display: "grid", placeItems: "center", marginBottom: 8,
        fontSize: 34, lineHeight: 1,
      }}>♡</div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 30, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Nada salvo ainda</div>
      <p style={{ fontSize: 15, color: "var(--text-dim)", lineHeight: 1.55, maxWidth: 420, margin: "0 0 12px" }}>
        Toque no <span style={{ color: "var(--accent-ink)" }}>♥</span> de qualquer leilão pra guardar aqui. Assim você acompanha os lances e recebe aviso quando estiver encerrando.
      </p>
      <Button variant="primary" iconRight={<Icon.arrowR size={15} />} onClick={() => { onCategoryChange && onCategoryChange("todos"); onNavigate("listing"); }}>
        Explorar leilões
      </Button>
    </div>
  );
}
