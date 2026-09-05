// Comparar leilões — global store + floating bar + side-by-side modal.
// Lets the user pick up to 4 lots (imóveis or veículos) and compare them.

const { useState: useStateCmp, useEffect: useEffectCmp } = React;

// ---------- Tiny global store (no prop threading needed) ----------
const compareStore = {
  ids: [],
  listeners: new Set(),
  MAX: 4,
  has(id) { return this.ids.includes(id); },
  toggle(id) {
    if (this.has(id)) {
      this.ids = this.ids.filter(x => x !== id);
    } else {
      if (this.ids.length >= this.MAX) {
        window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: `Dá pra comparar até ${this.MAX} leilões por vez` }));
        return;
      }
      this.ids = [...this.ids, id];
    }
    this.emit();
  },
  remove(id) { this.ids = this.ids.filter(x => x !== id); this.emit(); },
  clear() { this.ids = []; this.emit(); },
  emit() { this.listeners.forEach(fn => fn()); },
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
};

function useCompare() {
  const [, setN] = useStateCmp(0);
  useEffectCmp(() => compareStore.subscribe(() => setN(n => n + 1)), []);
  return compareStore;
}

const cmpGlyphs = { studio: "▢", apto: "◫", casa: "⌂", sedan: "🚗", hatch: "🚗", suv: "🚙" };

// ---------- Floating compare bar ----------
function CompareBar({ onOpen, hidden }) {
  const compare = useCompare();
  if (hidden || compare.ids.length === 0) return null;
  const lots = compare.ids.map(id => window.LOTS.find(l => l.id === id)).filter(Boolean);
  const enough = lots.length >= 2;
  return (
    <div style={{
      position: "fixed", left: "50%", bottom: 22, transform: "translateX(-50%)",
      zIndex: 95, width: "min(760px, calc(100vw - 32px))",
      background: "var(--surface)", border: "1px solid var(--border-2)",
      borderRadius: 18, boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7)",
      padding: "12px 14px 12px 18px",
      display: "flex", alignItems: "center", gap: 16,
      animation: "leiloe-fadein 0.22s ease",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>Comparar leilões</span>
        <span style={{ fontSize: 11.5, color: "var(--text-mute)" }}>{lots.length} de {compare.MAX} selecionados</span>
      </div>

      <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 0, overflowX: "auto", scrollbarWidth: "none" }}>
        {lots.map(lot => (
          <div key={lot.id} style={{
            position: "relative", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--bg-2)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "6px 10px 6px 8px",
          }}>
            <span style={{
              width: 30, height: 30, borderRadius: 7, flexShrink: 0,
              background: lot.photo, display: "grid", placeItems: "center",
              color: "rgba(255,255,255,0.55)", fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 16,
            }}>{cmpGlyphs[lot.glyph] || "▢"}</span>
            <span style={{ fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{lot.title}</span>
            <button onClick={() => compareStore.remove(lot.id)} aria-label="Remover" style={{
              background: "transparent", border: "none", color: "var(--text-mute)", cursor: "pointer",
              display: "flex", padding: 2,
            }}><Icon.close size={11} /></button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button onClick={() => compareStore.clear()} style={{
          background: "transparent", border: "none", color: "var(--text-mute)",
          fontSize: 12.5, cursor: "pointer", padding: "8px 6px",
        }}>Limpar</button>
        <button onClick={onOpen} disabled={!enough} style={{
          background: enough ? "var(--accent)" : "var(--surface-3)",
          color: enough ? "#15101F" : "var(--text-mute)",
          border: "none", borderRadius: 999, padding: "10px 18px",
          fontSize: 13.5, fontWeight: 600, cursor: enough ? "pointer" : "not-allowed",
          display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
        }}>
          <Icon.compare size={14} /> Comparar{enough ? ` (${lots.length})` : ""}
        </button>
      </div>
    </div>
  );
}

// ---------- Side-by-side comparison modal ----------
function CompareModal({ open, onClose, onBid }) {
  const compare = useCompare();
  useEffectCmp(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  const lots = compare.ids.map(id => window.LOTS.find(l => l.id === id)).filter(Boolean);
  if (lots.length === 0) return null;

  const data = lots.map(l => {
    const ref = l.category === "carro" ? l.fipe : l.appraised;
    const discount = Math.round((1 - l.currentBid / ref) * 100);
    const bd = simulateCost(l.currentBid);
    const total = l.category === "carro" ? bd.total - bd.itbi : bd.total;
    return { lot: l, ref, discount, total };
  });
  const minBid = Math.min(...data.map(d => d.lot.currentBid));
  const maxDisc = Math.max(...data.map(d => d.discount));
  const minTotal = Math.min(...data.map(d => d.total));
  const soonest = Math.min(...data.map(d => d.lot.endsAt));
  const anyImovel = lots.some(l => l.category !== "carro");
  const anyCarro = lots.some(l => l.category === "carro");

  const cols = `168px repeat(${lots.length}, minmax(196px, 1fr))`;

  const labelCell = {
    padding: "16px 18px", fontSize: 12.5, color: "var(--text-mute)",
    borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)",
    display: "flex", alignItems: "center", position: "sticky", left: 0,
    background: "var(--surface)", zIndex: 2, fontWeight: 500,
  };
  const cell = {
    padding: "16px 18px", fontSize: 14, color: "var(--text)",
    borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)",
    display: "flex", alignItems: "center", gap: 8, position: "relative",
  };
  const bestTag = {
    fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em",
    color: "var(--success-ink)", background: "var(--success-dim)",
    border: "1px solid rgba(123,224,176,0.3)", borderRadius: 999, padding: "1px 7px", fontWeight: 600,
  };

  const els = [];
  // header: empty label cell + lot headers
  els.push(<div key="h-label" style={{ ...labelCell, borderBottom: "1px solid var(--border-2)", alignItems: "flex-end", paddingBottom: 14 }}>
    <span style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--text)", fontStyle: "italic" }}>Comparar</span>
  </div>);
  data.forEach((d, i) => {
    els.push(
      <div key={`h-${i}`} style={{ padding: 14, borderBottom: "1px solid var(--border-2)", borderRight: "1px solid var(--border)" }}>
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
          <LotPhoto lot={d.lot} height={104} rounded="0" showBadges={false} />
          <button onClick={() => compareStore.remove(d.lot.id)} aria-label="Remover da comparação" style={{
            position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%",
            background: "rgba(12,9,17,0.7)", border: "1px solid rgba(255,255,255,0.18)", color: "var(--text)",
            display: "grid", placeItems: "center", cursor: "pointer", backdropFilter: "blur(6px)",
          }}><Icon.close size={11} /></button>
        </div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.15, marginBottom: 4, letterSpacing: "-0.01em" }}>{d.lot.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-mute)" }}>
          {d.lot.category === "carro" ? `${d.lot.year} · ${fmtNum(d.lot.km)} km` : `${(d.lot.address || "").split(" — ")[1] || ""} · ${d.lot.region}`}
        </div>
      </div>
    );
  });

  const addRow = (label, render, highlight) => {
    els.push(<div key={`l-${label}`} style={labelCell}>{label}</div>);
    data.forEach((d, i) => {
      const best = highlight ? highlight(d) : false;
      els.push(
        <div key={`${label}-${i}`} style={cell}>
          {render(d)}
          {best && <span style={bestTag}>melhor</span>}
        </div>
      );
    });
  };

  addRow("Lance atual", (d) => (
    <span style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 600 }}>{fmtBRL(d.lot.currentBid)}</span>
  ), (d) => d.lot.currentBid === minBid);

  addRow(anyCarro && !anyImovel ? "FIPE" : "Referência", (d) => (
    <span style={{ color: "var(--text-dim)" }}><s>{fmtBRL(d.ref)}</s> <span style={{ fontSize: 11, color: "var(--text-mute)" }}>{d.lot.category === "carro" ? "FIPE" : "aval."}</span></span>
  ));

  addRow("Desconto", (d) => (
    <span style={{ color: "var(--success-ink)", fontWeight: 600, fontFamily: "var(--mono)" }}>−{d.discount}%</span>
  ), (d) => d.discount === maxDisc);

  addRow("Custo total estimado", (d) => (
    <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--accent-ink)" }}>{fmtBRL(d.total)}</span>
  ), (d) => d.total === minTotal);

  addRow("Encerra em", (d) => <Countdown endsAt={d.lot.endsAt} compact />, (d) => d.lot.endsAt === soonest);
  addRow("Lances", (d) => <span style={{ fontFamily: "var(--mono)" }}>{d.lot.bids}</span>);
  addRow("Tipo de leilão", (d) => <span>{d.lot.auctionType}</span>);
  addRow("Praça", (d) => <span>{d.lot.praca}</span>);

  if (anyImovel) {
    addRow("Área", (d) => <span>{d.lot.category === "carro" ? "—" : `${d.lot.area} m²`}</span>);
    addRow("Dormitórios", (d) => <span>{d.lot.category === "carro" ? "—" : d.lot.bedrooms}</span>);
    addRow("Ocupação", (d) => <span style={{ color: d.lot.occupancy && d.lot.occupancy !== "Vazio" ? "var(--warning-ink)" : "var(--text)" }}>{d.lot.category === "carro" ? "—" : d.lot.occupancy}</span>);
  }
  if (anyCarro) {
    addRow("Ano / KM", (d) => <span>{d.lot.category === "carro" ? `${d.lot.year} · ${fmtNum(d.lot.km)} km` : "—"}</span>);
    addRow("Câmbio", (d) => <span>{d.lot.category === "carro" ? d.lot.transmission : "—"}</span>);
    addRow("Condição", (d) => <span style={{ color: d.lot.condition && d.lot.condition !== "Sem sinistro" ? "var(--warning-ink)" : "var(--text)" }}>{d.lot.category === "carro" ? d.lot.condition : "—"}</span>);
  }

  addRow("Vendedor", (d) => {
    const v = (window.VENDORS && window.VENDORS[d.lot.vendor]) || { name: "—", rating: 0 };
    return (
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</span>
        <span style={{ fontSize: 12, color: "var(--text-mute)" }}><span style={{ color: "var(--warning-ink)" }}>★</span> {v.rating.toFixed(1)}</span>
      </span>
    );
  });

  // action row
  els.push(<div key="l-action" style={{ ...labelCell, borderBottom: "none" }} />);
  data.forEach((d, i) => {
    els.push(
      <div key={`action-${i}`} style={{ ...cell, borderBottom: "none", padding: 14 }}>
        <button onClick={() => { onBid && onBid(d.lot); }} style={{
          width: "100%", padding: "11px 16px", background: "var(--accent)", color: "#15101F",
          border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}><Icon.gavel size={14} /> Dar lance</button>
      </div>
    );
  });

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 150,
      background: "rgba(8,6,12,0.8)", backdropFilter: "blur(10px)",
      display: "grid", placeItems: "center", padding: 24,
      animation: "leiloe-fadein 0.2s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(1040px, 100%)", maxHeight: "calc(100vh - 48px)",
        background: "var(--surface)", border: "1px solid var(--border-2)",
        borderRadius: 22, boxShadow: "0 40px 90px -20px rgba(0,0,0,0.7)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        animation: "leiloe-scalein 0.22s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent-ink)", marginBottom: 5 }}>Lado a lado</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 26, letterSpacing: "-0.01em", lineHeight: 1 }}>Comparando {lots.length} leilões</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => compareStore.clear()} style={{ background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)", borderRadius: 999, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>Limpar tudo</button>
            <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)", borderRadius: "50%", width: 36, height: 36, display: "grid", placeItems: "center", cursor: "pointer" }}><Icon.close size={14} /></button>
          </div>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, minWidth: "fit-content" }}>
            {els}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { compareStore, useCompare, CompareBar, CompareModal });
