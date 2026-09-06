// Componentes compartilhados do Leiloaê.
import { useState, useEffect, useRef, useId } from "react";
import ReactDOM from "react-dom";
import { GLOSSARY, VENDORS } from "./data.js";
import {
  formatBRL as fmtBRL, formatNumber as fmtNum, timeLeft,
  discountPct, isEnded, referenceValueOf,
} from "./domain/auction.js";
import { useNow } from "./lib/clock.js";
import { usePrefersReducedMotion, offsetFromId } from "./lib/motion.js";
import { photoSources, photoAlt } from "./lib/photos.js";
import { IS_DEMO } from "./lib/config.js";
import { useCompare } from "./state/compareStore.js";

/** Um lote está "quente" na última hora — derivado do tempo, não de um campo fixo. */
export function isHot(lot, now) {
  return !isEnded(lot, now) && lot.endsAt - now < 3600e3;
}

// ---------- Buttons ----------
const btnBase = {
  fontFamily: "var(--sans)",
  fontWeight: 500,
  letterSpacing: "-0.005em",
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  transition: "transform 0.06s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
  whiteSpace: "nowrap",
};

export function Button({ children, variant = "primary", size = "md", icon, iconRight, full, onClick, type = "button", style, disabled, ...rest }) {
  const sizeStyle = size === "lg" ? { padding: "16px 26px", fontSize: 16 }
                  : size === "sm" ? { padding: "8px 14px", fontSize: 13 }
                  : { padding: "12px 20px", fontSize: 14.5 };
  const variantStyle = variant === "primary"
    ? { background: "var(--accent)", color: "#15101F" }
    : variant === "ghost"
    ? { background: "transparent", color: "var(--text)", border: "1px solid var(--border-2)" }
    : variant === "subtle"
    ? { background: "var(--surface-2)", color: "var(--text)" }
    : variant === "danger"
    ? { background: "var(--danger)", color: "#2A0F0F" }
    : { background: "var(--surface-2)", color: "var(--text)" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...btnBase, ...sizeStyle, ...variantStyle, width: full ? "100%" : undefined, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer", ...style }}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

// ---------- Badge ----------
export function Badge({ children, tone = "neutral", style }) {
  const tones = {
    neutral: { background: "rgba(255,255,255,0.06)", color: "var(--text-dim)", border: "1px solid var(--border)" },
    accent:  { background: "var(--accent-dim)", color: "var(--accent-ink)", border: "1px solid rgba(181,159,240,0.25)" },
    success: { background: "var(--success-dim)", color: "var(--success-ink)", border: "1px solid rgba(123,224,176,0.25)" },
    warning: { background: "rgba(255,192,122,0.12)", color: "var(--warning-ink)", border: "1px solid rgba(255,192,122,0.25)" },
    // Vermelho escurecido de #E84E3E: sobre ele, o texto claro ficava em
    // 3,4-4,4:1 (axe: color-contrast). Agora passa de 4,5:1 mantendo o tom.
    hot:     { background: "rgba(196,49,34,0.96)", color: "#FFF1ED", border: "1px solid rgba(255,255,255,0.28)", fontWeight: 600, backdropFilter: "blur(6px)", textShadow: "0 1px 3px rgba(0,0,0,0.35)", boxShadow: "0 2px 10px rgba(0,0,0,0.3)" },
    dark:    { background: "rgba(0,0,0,0.62)", color: "#F4F1E8", border: "1px solid rgba(255,255,255,0.22)", backdropFilter: "blur(7px)", textShadow: "0 1px 4px rgba(0,0,0,0.4)" },
    ended:   { background: "rgba(12,9,17,0.86)", color: "#D9D3E4", border: "1px solid rgba(255,255,255,0.28)", fontWeight: 600, backdropFilter: "blur(6px)" },
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500,
      letterSpacing: "-0.005em",
      ...tones[tone],
      ...style,
    }}>{children}</span>
  );
}

// ---------- Glossary inline tooltip ----------
export function GlossaryTerm({ term, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const popRef = useRef(null);
  const popId = useId();
  const def = GLOSSARY[term.toLowerCase()] || GLOSSARY[term];

  const W = 280;
  const GAP = 10;
  const MARGIN = 12;

  const place = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const center = r.left + r.width / 2;
    let left = center - W / 2;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - W - MARGIN));
    const popH = popRef.current ? popRef.current.offsetHeight : 120;
    const spaceBelow = window.innerHeight - r.bottom;
    const flip = spaceBelow < popH + GAP + MARGIN && r.top > popH + GAP + MARGIN;
    const top = flip ? r.top - GAP : r.bottom + GAP;
    setPos({ left, top, flip, arrowLeft: center - left });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const raf = requestAnimationFrame(place);
    const onClick = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const popup = open && pos && ReactDOM.createPortal(
    <span id={popId} role="tooltip" ref={popRef} style={{
      position: "fixed", left: pos.left, top: pos.top,
      transform: pos.flip ? "translateY(-100%)" : "none",
      width: W, background: "var(--surface-3)", color: "var(--text)",
      border: "1px solid var(--border-2)", borderRadius: 12, padding: "12px 14px",
      fontSize: 13, lineHeight: 1.5, fontWeight: 400,
      boxShadow: "0 18px 36px -12px rgba(0,0,0,0.7)", zIndex: 9999, textAlign: "left",
    }}>
      <span style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-mute)", marginBottom: 6 }}>
        {term}
      </span>
      {def || "Termo sem definição."}
      <span style={{
        position: "absolute",
        left: Math.max(12, Math.min(pos.arrowLeft, W - 12)),
        [pos.flip ? "bottom" : "top"]: -6,
        transform: "translateX(-50%) rotate(45deg)",
        width: 12, height: 12, background: "var(--surface-3)",
        borderTop: pos.flip ? "none" : "1px solid var(--border-2)",
        borderLeft: pos.flip ? "none" : "1px solid var(--border-2)",
        borderBottom: pos.flip ? "1px solid var(--border-2)" : "none",
        borderRight: pos.flip ? "1px solid var(--border-2)" : "none",
      }} />
    </span>,
    document.body
  );

  // Botão de verdade: alcançável por teclado e anunciado como controle (FRONT-007).
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-describedby={open ? popId : undefined}
        style={{
          color: "var(--accent-ink)", background: "none", border: "none", padding: 0,
          font: "inherit", borderBottom: "1px dashed rgba(181,159,240,0.6)",
          cursor: "help", fontWeight: 500,
        }}
      >{children || term}</button>
      {popup}
    </span>
  );
}

// ---------- Countdown ----------
export function Countdown({ endsAt, compact, big, onDark }) {
  const now = useNow();
  const left = timeLeft(endsAt - now);
  const color = onDark
    ? (left.ended ? "rgba(244,241,232,0.6)" : left.hot ? "#FF9A8C" : "#F4F1E8")
    : (left.ended ? "var(--text-mute)" : left.hot ? "var(--hot-ink)" : "var(--text)");
  const textShadow = onDark ? "0 1px 6px rgba(0,0,0,0.5)" : undefined;
  if (big) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontFamily: "var(--mono)", color, fontVariantNumeric: "tabular-nums", textShadow }}>
        <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>{left.short}</span>
      </div>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color, fontFamily: "var(--mono)", fontSize: compact ? 12 : 13, fontWeight: onDark ? 600 : 400, fontVariantNumeric: "tabular-nums", textShadow }}>
      {left.hot && !left.ended && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--hot)", boxShadow: "0 0 0 4px rgba(255,107,91,0.18)", animation: "leiloe-pulse 1.2s infinite" }} />}
      {left.text}
    </span>
  );
}

/**
 * Uma única imagem por vez, com srcset e dimensões declaradas.
 * Antes eram quatro <img> por card, todas baixadas em 1100 px (FRONT-003) e
 * sem width/height nem tratamento de falha (FRONT-009).
 */
function LotImage({ lot, index, context, height }) {
  const [failed, setFailed] = useState(false);
  const id = lot.photoIds?.[index % (lot.photoIds?.length || 1)];
  const sources = failed ? null : photoSources(id, context);
  if (!sources) return null;
  return (
    <img
      key={sources.src}
      src={sources.src}
      srcSet={sources.srcSet}
      sizes={sources.sizes}
      alt={photoAlt(lot, index)}
      loading="lazy"
      decoding="async"
      width={1200}
      height={Math.max(1, Math.round(height * (1200 / 360)))}
      onError={() => setFailed(true)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

/**
 * Rotação automática de fotos (FRONT-004).
 *
 * O índice é *derivado* do relógio compartilhado, não de um timer próprio:
 * cada card mantinha um `setInterval`, então uma listagem de 14 lotes ficava
 * com 15 timers ativos — e o custo crescia com o catálogo. Como o relógio já
 * pausa em aba oculta, a rotação pausa junto de graça. O `seed` escalona os
 * cards para que não troquem todos no mesmo segundo.
 */
function useRotatingIndex(length, intervalMs, enabled = true, seed = 0) {
  const now = useNow();
  const semMovimento = usePrefersReducedMotion();
  if (!enabled || semMovimento || length <= 1) return 0;
  return Math.floor((now + seed) / intervalMs) % length;
}

// ---------- Lot Photo ----------
export function LotPhoto({ lot, height = 200, rounded = "var(--radius)", showBadges = true, children, autoRotate, photoIndex = 0, context = "card" }) {
  const now = useNow();
  const glyphs = { studio: "▢", apto: "◫", casa: "⌂", sedan: "🚗", hatch: "🚗", suv: "🚙" };
  const isCarro = lot.category === "carro";
  const total = lot.photoIds?.length || 0;
  const rotated = useRotatingIndex(total, 3200, Boolean(autoRotate), offsetFromId(lot.id, 3200));
  const activeIdx = autoRotate ? rotated : photoIndex;
  const gradient = lot.photo || "";
  const ended = isEnded(lot, now);

  return (
    <div style={{
      position: "relative", width: "100%", height,
      borderRadius: rounded, overflow: "hidden", isolation: "isolate", background: "#0C0911",
    }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: gradient }} />
      <LotImage lot={lot} index={activeIdx} context={context} height={height} />
      {total === 0 && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 8, color: "rgba(255,255,255,0.32)",
        }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: Math.min(height * 0.42, 96), fontStyle: "italic", lineHeight: 1 }}>
            {glyphs[lot.glyph] || (isCarro ? "🚗" : "▢")}
          </span>
        </div>
      )}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 30% 20%, transparent, rgba(0,0,0,0.45) 80%)",
        pointerEvents: "none",
      }} />
      {showBadges && (
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, flexWrap: "wrap", maxWidth: "calc(100% - 60px)" }}>
          {ended ? <Badge tone="ended">Encerrado</Badge> : isHot(lot, now) ? <Badge tone="hot">🔥 Encerrando</Badge> : <Badge tone="dark">{lot.auctionType}</Badge>}
          <Badge tone="dark">{lot.praca}</Badge>
        </div>
      )}
      {children}
    </div>
  );
}

const dotS = { width: 3, height: 3, borderRadius: "50%", background: "currentColor", display: "inline-block", opacity: 0.5 };

// ---------- Lot Card ----------
export function LotCard({ lot, onClick, onSave, onBid, density = "regular" }) {
  const now = useNow();
  const isCarro = lot.category === "carro";
  const reference = referenceValueOf(lot);
  const discount = discountPct(lot);
  const compact = density === "compact";
  const vendor = VENDORS[lot.vendor] || { name: "", rating: 4.7, reviews: 100 };
  const glyphs = { studio: "▢", apto: "◫", casa: "⌂", sedan: "🚗", hatch: "🚗", suv: "🚙" };
  const compare = useCompare();
  const isComparing = compare.has(lot.id);
  const total = lot.photoIds?.length || 0;
  const activeIdx = useRotatingIndex(total, 4500, true, offsetFromId(lot.id, 4500));
  const ended = isEnded(lot, now);
  const titleId = `lot-title-${lot.id}`;

  return (
    <article
      aria-labelledby={titleId}
      style={{
        textAlign: "left", background: "var(--bg)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", padding: 0, overflow: "hidden",
        display: "flex", flexDirection: "column", color: "inherit", fontFamily: "inherit",
        // O encerramento é sinalizado pelo selo e pela ausência do botão de
        // lance. Esmaecer o cartão inteiro derrubava o texto abaixo do
        // contraste mínimo (axe: color-contrast).
      }}
    >
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: lot.photo }} />
        <LotImage lot={lot} index={activeIdx} context="card" height={compact ? 320 : 380} />
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 22%, rgba(0,0,0,0.5) 58%, rgba(0,0,0,0.82) 82%, rgba(0,0,0,0.92) 100%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", padding: 16, display: "flex", flexDirection: "column", minHeight: compact ? 320 : 380 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ended ? <Badge tone="ended">Encerrado</Badge> : isHot(lot, now) ? <Badge tone="hot">🔥 Encerrando</Badge> : <Badge tone="dark">{lot.auctionType}</Badge>}
              <Badge tone="dark">{lot.praca}</Badge>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => compare.toggle(lot.id)}
                aria-pressed={isComparing}
                aria-label={`Comparar ${lot.title}`}
                title={isComparing ? "Remover da comparação" : "Comparar"}
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: isComparing ? "var(--accent)" : "rgba(8,6,12,0.72)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  color: isComparing ? "#15101F" : "#F4F1E8",
                  display: "grid", placeItems: "center", cursor: "pointer",
                  backdropFilter: "blur(6px)", boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
                }}
              ><Icon.compare size={15} /></button>
              <button
                type="button"
                onClick={() => onSave?.(lot)}
                aria-pressed={Boolean(lot.saved)}
                aria-label={`${lot.saved ? "Remover dos salvos" : "Salvar"}: ${lot.title}`}
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: lot.saved ? "var(--accent)" : "rgba(8,6,12,0.72)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  color: lot.saved ? "#15101F" : "#F4F1E8",
                  display: "grid", placeItems: "center", cursor: "pointer",
                  backdropFilter: "blur(6px)", fontSize: 15, boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
                }}
              ><span aria-hidden="true">{lot.saved ? "♥" : "♡"}</span></button>
            </div>
          </div>

          <div aria-hidden="true" style={{ flex: 1, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.34)" }}>
            {total === 0 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 110, lineHeight: 1 }}>{glyphs[lot.glyph] || (isCarro ? "🚗" : "▢")}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            {/* O título é o único alvo de navegação: acaba com os controles
                aninhados dentro de um card clicável (FRONT-006). */}
            <h3 id={titleId} style={{ margin: 0, fontWeight: 400 }}>
              <button
                type="button"
                onClick={() => onClick?.(lot)}
                style={{
                  background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer",
                  fontFamily: "var(--serif)", fontStyle: "italic", fontSize: compact ? 22 : 26,
                  lineHeight: 1.1, letterSpacing: "-0.01em", color: "#FBF8F0",
                  textShadow: "0 1px 12px rgba(0,0,0,0.45)",
                }}
              >
                {lot.title}
              </button>
            </h3>
            <div style={{ fontSize: 13, color: "rgba(244,241,232,0.78)", marginTop: 4 }}>
              {isCarro
                ? `${lot.year} · ${lot.transmission} · ${fmtNum(lot.km)} km`
                : `${(lot.address || "").split(" — ")[1] || ""} · ${lot.city}`}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(244,241,232,0.7)", fontSize: 12.5, marginTop: 8 }}>
              {isCarro ? (
                <>
                  <span>{lot.fuel}</span><span style={dotS} />
                  <span>{lot.color}</span><span style={dotS} />
                  <span style={{ color: lot.condition === "Sem sinistro" ? "var(--success)" : "var(--warning)" }}>{lot.condition}</span>
                </>
              ) : (
                <>
                  <span>{lot.area}m²</span><span style={dotS} />
                  <span>{lot.bedrooms === 1 ? "1 dorm." : `${lot.bedrooms} dorms.`}</span><span style={dotS} />
                  <span>{lot.occupancy}</span>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.13)" }}>
            <div>
              <div style={{ fontSize: 10.5, color: "rgba(244,241,232,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                {ended ? "Lance final" : "Lance atual"}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontFamily: "var(--mono)" }}>
                <span style={{ fontSize: 13, color: "rgba(244,241,232,0.7)" }}>R$</span>
                <span style={{ fontSize: compact ? 24 : 28, fontWeight: 600, letterSpacing: "-0.01em", color: "#FFFFFF", textShadow: "0 1px 10px rgba(0,0,0,0.4)" }}>
                  {Math.round(lot.currentBid).toLocaleString("pt-BR")}
                </span>
              </div>
              {discount !== null && (
                <div style={{ fontSize: 11.5, marginTop: 4, color: "rgba(244,241,232,0.7)" }}>
                  <s>{fmtBRL(reference)}</s>
                  <span style={{ color: "var(--success-ink)", marginLeft: 6, fontWeight: 600 }}>−{discount}%</span>
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, color: "rgba(244,241,232,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                {ended ? "Encerrado" : "Encerra em"}
              </div>
              <Countdown endsAt={lot.endsAt} compact onDark />
              <div style={{ fontSize: 11.5, color: "rgba(244,241,232,0.7)", marginTop: 4 }}>{lot.bids} lances</div>
            </div>
          </div>
        </div>
      </div>

      {/* Leilão encerrado não oferece lance (BIZ-002). */}
      {ended ? (
        <div style={{
          margin: 12, padding: "12px 16px", borderRadius: 12,
          border: "1px dashed var(--border-2)", color: "var(--text-mute)",
          fontSize: 13.5, textAlign: "center",
        }}>
          Leilão encerrado
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onBid?.(lot)}
          style={{
            margin: 12, padding: "12px 16px", background: "transparent",
            border: "1px solid var(--border-2)", borderRadius: 12,
            color: "var(--text)", fontWeight: 500, fontSize: 14, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.15s ease, border-color 0.15s ease",
          }}
        >
          <Icon.gavel size={14} /> Dar lance
        </button>
      )}

      <div style={{ padding: "0 16px 14px", display: "flex", alignItems: "center", gap: 8, color: "var(--text-mute)", fontSize: 12 }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
        <span style={{ color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{vendor.name}</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span aria-hidden="true" style={{ color: "var(--warning-ink)" }}>★</span>
          <span style={{ color: "var(--text-dim)" }}>{vendor.rating.toFixed(1)}</span>
          <span>· {fmtNum(vendor.reviews)} vendas</span>
        </span>
      </div>
      {IS_DEMO && lot.photoIds?.length > 0 && (
        <span style={{ padding: "0 16px 12px", fontSize: 10.5, color: "var(--text-mute)" }}>
          Fotos ilustrativas
        </span>
      )}
    </article>
  );
}

// ---------- Section header ----------
export function SectionHead({ overline, title, subtitle, right, large, as: Tag = "h2" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        {overline && <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent-ink)", marginBottom: 8, fontWeight: 500 }}>{overline}</div>}
        <Tag style={{
          fontFamily: "var(--serif)", fontSize: large ? 48 : 32, fontWeight: 400,
          letterSpacing: "-0.02em", margin: 0, lineHeight: 1.05,
        }}>{title}</Tag>
        {subtitle && <p style={{ color: "var(--text-dim)", margin: "10px 0 0", maxWidth: 560 }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// ---------- Icons ----------
export const Icon = {
  search:    (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>,
  bell:      (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v1M4 7a4 4 0 1 1 8 0v2l1.5 2H2.5L4 9V7z"/><path d="M6 13a2 2 0 1 0 4 0"/></svg>,
  heart:     (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 14s-5-3-5-7a3 3 0 0 1 5-2 3 3 0 0 1 5 2c0 4-5 7-5 7z"/></svg>,
  gavel:     (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 10l4-4 3 3-4 4z"/><path d="M9 4l3 3"/><path d="M2 14h6"/></svg>,
  car:       (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 10.5h12M3.5 10.5l1.2-3.6a1.5 1.5 0 0 1 1.4-1h3.8a1.5 1.5 0 0 1 1.4 1l1.2 3.6"/><path d="M2.5 10.5v2M13.5 10.5v2"/><circle cx="5" cy="11" r="0.9" fill="currentColor"/><circle cx="11" cy="11" r="0.9" fill="currentColor"/></svg>,
  compare:   (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 5h8M10 3l2 2-2 2"/><path d="M12 11H4M6 9l-2 2 2 2"/></svg>,
  user:      (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5C3.8 11 5.7 10 8 10s4.2 1 5 3.5"/></svg>,
  list:      (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M3 8h10M3 12h10"/></svg>,
  compass:   (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M10.5 5.5L9 9l-3.5 1.5L7 7z" fill="currentColor" fillOpacity=".25"/></svg>,
  book:      (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h5a2 2 0 0 1 2 2v8a2 2 0 0 0-2-2H3z"/><path d="M13 3H8a2 2 0 0 0-2 2v8a2 2 0 0 1 2-2h5z"/></svg>,
  check:     (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3.5 3.5L13 5"/></svg>,
  sun:       (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M13 3l-1 1M4 12l-1 1"/></svg>,
  moon:      (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"/></svg>,
  arrowR:    (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>,
  arrowL:    (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 8H3M7 4L3 8l4 4"/></svg>,
  close:     (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>,
  info:      (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.5"/></svg>,
  shield:    (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2L3 4v4c0 3 2 5 5 6 3-1 5-3 5-6V4z"/></svg>,
  spark:     (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2"/></svg>,
  whatsapp:  (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 0 0-5.7 9.6L1.5 14.5l3.5-.8A6.5 6.5 0 1 0 8 1.5zm0 11.7a5.2 5.2 0 0 1-2.6-.7l-.2-.1-2 .5.5-2-.1-.2A5.2 5.2 0 1 1 8 13.2zm2.9-3.9c-.2-.1-.9-.4-1-.5-.1 0-.2-.1-.4.1l-.5.6c-.1.1-.2.1-.4 0-.2-.1-.8-.3-1.5-.9-.5-.5-.9-1.1-1-1.3-.1-.2 0-.3.1-.4l.3-.3.2-.3v-.3l-.5-1.2c-.1-.3-.2-.2-.3-.2H5.5c-.1 0-.3 0-.5.2-.2.2-.6.6-.6 1.5s.6 1.8.7 2c.1.2 1.3 1.9 3.1 2.7.4.2.7.3 1 .4.4.1.8.1 1.1.1.3-.1.9-.4 1-.7.1-.4.1-.7.1-.7-.1-.1-.2-.1-.4-.2z"/></svg>,
  pix:       (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2l3 3-3 3-3-3 3-3zM8 8l3 3-3 3-3-3 3-3z"/><path d="M2 8l3-3v6L2 8zM14 8l-3-3v6l3-3z"/></svg>,
  clock:     (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>,
  chat:      (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h8a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 12 11H6l-3 2.5V11H4a1.5 1.5 0 0 1-1.5-1.5z"/></svg>,
  card:      (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M2 6.5h12M4.5 9.5h2"/></svg>,
  gear:      (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/></svg>,
  help:      (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M6.3 6.2a1.8 1.8 0 0 1 3.4.6c0 1.2-1.7 1.5-1.7 2.7M8 11.4v.4"/></svg>,
  doc:       (p) => <svg aria-hidden="true" width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3M6 8h4M6 10.5h4"/></svg>,
};

export { fmtBRL, fmtNum };
