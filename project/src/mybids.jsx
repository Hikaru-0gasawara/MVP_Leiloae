// "Meus lances" — agora derivado dos lances reais do usuário.
//
// Antes eram três IDs fixos com status inventado (BIZ-004) e faltavam as abas,
// o "Cobrir lance" e o detalhe do arremate especificados em chats/chat1.md §5
// (BIZ-005). A janela de 24h do primeiro lance ganha ação de verdade (BIZ-006).

import { useState, useId } from "react";
import {
  bidStatus, isCancelable, minBidFor, simulateCost, formatBRL as fmtBRL, formatNumber as fmtNum,
} from "./domain/auction.js";
import { useNow } from "./lib/clock.js";
import { VENDORS } from "./data.js";
import { CONTACT, hasWhatsApp, openExternal } from "./lib/config.js";
import { SectionHead, Button, Icon, Countdown, LotPhoto, SeloAutomatico, SeloProrrogado } from "./components.jsx";
import { StatCard } from "./screens.jsx";
import { Dialog } from "./ui/Dialog.jsx";

const TABS = [
  { id: "todos", label: "Todos" },
  { id: "winning", label: "Ganhando" },
  { id: "outbid", label: "Superados" },
  { id: "won", label: "Arrematados" },
  { id: "closed", label: "Encerrados" },
];

const STATUS_INFO = {
  winning: { label: "Ganhando", color: "var(--success-ink)", bg: "var(--success-dim)" },
  outbid: { label: "Superado", color: "var(--hot-ink)", bg: "rgba(255,107,91,0.12)" },
  won: { label: "Arrematado", color: "var(--accent-ink)", bg: "var(--accent-dim)" },
  lost: { label: "Encerrado", color: "var(--text-mute)", bg: "var(--surface-2)" },
  canceled: { label: "Cancelado", color: "var(--text-mute)", bg: "var(--surface-2)" },
};

const tabOf = (status) => (status === "lost" || status === "canceled" ? "closed" : status);

export function MyBidsScreen({ bids = [], onOpenLot, onBid, onCancelBid, onNavigate }) {
  const now = useNow();
  const [tab, setTab] = useState("todos");
  const [detalhe, setDetalhe] = useState(null);

  const comStatus = bids.map((entry) => ({ ...entry, status: bidStatus(entry.bid, entry.lot, now) }));
  const contagem = comStatus.reduce((acc, e) => {
    const t = tabOf(e.status);
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const visiveis = tab === "todos" ? comStatus : comStatus.filter((e) => tabOf(e.status) === tab);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 40px 80px", animation: "leiloe-fadein 0.3s ease" }}>
      <SectionHead
        as="h1"
        overline="Meus lances"
        title="Acompanhe sua disputa."
        subtitle={
          comStatus.length === 0
            ? "Quando você der um lance, ele aparece aqui com o status ao vivo."
            : `${contagem.winning || 0} ganhando · ${contagem.outbid || 0} superados · ${contagem.won || 0} arrematados.`
        }
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <StatCard label="Lances ativos" value={(contagem.winning || 0) + (contagem.outbid || 0)} tone="accent" />
        <StatCard label="Ganhando" value={contagem.winning || 0} tone="success" />
        <StatCard label="Superado" value={contagem.outbid || 0} tone="warning" />
        <StatCard label="Arremates" value={contagem.won || 0} tone="accent" />
      </div>

      <div role="tablist" aria-label="Filtrar meus lances" style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const ativo = tab === t.id;
          const n = t.id === "todos" ? comStatus.length : contagem[t.id] || 0;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={ativo}
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 16px", borderRadius: 999, fontSize: 13.5, cursor: "pointer",
                border: `1px solid ${ativo ? "var(--text)" : "var(--border-2)"}`,
                background: ativo ? "var(--text)" : "transparent",
                color: ativo ? "var(--bg)" : "var(--text-dim)",
                fontWeight: ativo ? 600 : 400,
              }}
            >
              {t.label}
              <span style={{ marginLeft: 6, fontFamily: "var(--mono)", fontSize: 11, opacity: 0.7 }}>{n}</span>
            </button>
          );
        })}
      </div>

      {visiveis.length === 0 ? (
        <EmptyTab tab={tab} onNavigate={onNavigate} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visiveis.map((entry) => (
            <BidRow
              key={entry.bid.id}
              entry={entry}
              now={now}
              onOpenLot={onOpenLot}
              onCover={() => onBid?.(entry.lot, minBidFor(entry.lot))}
              onCancel={() => onCancelBid?.(entry.bid.id)}
              onDetails={() => setDetalhe(entry)}
            />
          ))}
        </div>
      )}

      <WinDetailsDialog entry={detalhe} onClose={() => setDetalhe(null)} onNavigate={onNavigate} onOpenLot={onOpenLot} />
    </div>
  );
}

function EmptyTab({ tab, onNavigate }) {
  const textos = {
    todos: "Você ainda não deu nenhum lance.",
    winning: "Nenhum lance seu está ganhando agora.",
    outbid: "Nenhum lance seu foi superado.",
    won: "Você ainda não arrematou nada.",
    closed: "Nenhum leilão seu foi encerrado ainda.",
  };
  return (
    <div style={{
      padding: "64px 24px", textAlign: "center", background: "var(--surface)",
      border: "1px dashed var(--border-2)", borderRadius: 20,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
    }}>
      <div aria-hidden="true" style={{
        width: 64, height: 64, borderRadius: "50%", background: "var(--accent-dim)",
        color: "var(--accent-ink)", display: "grid", placeItems: "center", marginBottom: 4,
      }}><Icon.gavel size={26} /></div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 26, letterSpacing: "-0.01em" }}>Nada aqui ainda</div>
      <p style={{ color: "var(--text-dim)", margin: "0 0 12px", maxWidth: 380, lineHeight: 1.55 }}>{textos[tab]}</p>
      <Button variant="primary" iconRight={<Icon.arrowR size={15} />} onClick={() => onNavigate?.("listing")}>
        Ver leilões
      </Button>
    </div>
  );
}

function BidRow({ entry, now, onOpenLot, onCover, onCancel, onDetails }) {
  const { bid, lot, status } = entry;
  const info = STATUS_INFO[status];
  const podeCancelar = isCancelable(bid, now);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "120px minmax(0, 1fr) auto", gap: 20, alignItems: "center",
      padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
    }}>
      <div style={{ width: 120, height: 80, borderRadius: 10, overflow: "hidden" }}>
        <LotPhoto lot={lot} height={80} rounded="0" showBadges={false} context="thumb" />
      </div>

      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 400 }}>
          <button type="button" onClick={() => onOpenLot?.(lot)} style={{
            background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
            fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.15, color: "var(--text)",
          }}>{lot.title}</button>
        </h2>
        <div style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 2 }}>
          {lot.category === "carro"
            ? `${lot.year} · ${lot.transmission} · ${fmtNum(lot.km)} km`
            : `${(lot.address || "").split(" — ")[1] || ""} · ${lot.region}`}
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap", fontSize: 12.5, alignItems: "center" }}>
          <span style={{ color: "var(--text-mute)" }}>
            Meu lance <b style={{ fontFamily: "var(--mono)", color: "var(--text)", fontWeight: 600 }}>{fmtBRL(bid.value)}</b>
          </span>
          {/* Um lance que a pessoa não digitou precisa se apresentar como tal. */}
          {bid.automatico && <SeloAutomatico />}
          {bid.autoMax > 0 && !bid.automatico && (
            <span style={{ color: "var(--text-mute)" }}>
              Teto <b style={{ fontFamily: "var(--mono)", color: "var(--text)", fontWeight: 600 }}>{fmtBRL(bid.autoMax)}</b>
            </span>
          )}
          <span style={{ color: "var(--text-mute)" }}>
            Lance atual <b style={{ fontFamily: "var(--mono)", color: "var(--text)", fontWeight: 600 }}>{fmtBRL(lot.currentBid)}</b>
          </span>
          {status !== "won" && status !== "lost" && status !== "canceled" && (
            <span style={{ color: "var(--text-mute)", display: "inline-flex", gap: 6, alignItems: "center" }}>
              Encerra em <Countdown endsAt={lot.endsAt} compact />
              <SeloProrrogado lot={lot} />
            </span>
          )}
        </div>
        {podeCancelar && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--success-ink)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon.shield size={12} /> Primeiro lance protegido · cancelável por mais <Countdown endsAt={bid.cancelableUntil} compact />
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
        <span style={{
          padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500,
          background: info.bg, color: info.color, whiteSpace: "nowrap",
        }}>{info.label}</span>

        {status === "outbid" && (
          <Button size="sm" variant="primary" onClick={onCover} icon={<Icon.gavel size={13} />}>Cobrir lance</Button>
        )}
        {status === "winning" && (
          <Button size="sm" variant="ghost" onClick={onCover}>Aumentar meu teto</Button>
        )}
        {status === "won" && (
          <Button size="sm" variant="ghost" onClick={onDetails}>Ver detalhes</Button>
        )}
        {podeCancelar && (
          <button type="button" onClick={onCancel} style={{
            background: "transparent", border: "none", color: "var(--text-mute)",
            fontSize: 12.5, cursor: "pointer", padding: "2px 4px", textDecoration: "underline",
          }}>Cancelar lance</button>
        )}
      </div>
    </div>
  );
}

/** Pop-up do arremate exigido em chat1.md §5. */
function WinDetailsDialog({ entry, onClose, onNavigate, onOpenLot }) {
  const titleId = useId();
  if (!entry) return null;
  const { bid, lot } = entry;
  const custo = simulateCost(bid.value, lot.category);
  const vendor = VENDORS[lot.vendor];
  const passos = [
    "Pagar o sinal por Pix",
    "Assinar a carta de arrematação",
    "Pagar o ITBI na prefeitura",
    "Retirar as chaves",
    "Confirmar o recebimento",
  ];

  return (
    <Dialog open onClose={onClose} labelledBy={titleId} panelStyle={{ maxWidth: 520 }}>
      <div style={{ padding: "24px 26px 8px" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent-ink)", marginBottom: 6 }}>Arremate</div>
        <h2 id={titleId} style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.01em" }}>
          {lot.title}
        </h2>
      </div>

      <div style={{ margin: "16px 26px 0", padding: 18, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14 }}>
        <Linha rotulo="Valor final" valor={fmtBRL(bid.value)} destaque />
        <Linha rotulo="Custo total estimado" valor={fmtBRL(custo.total)} />
        <Linha rotulo="Vendedor" valor={vendor?.name || "—"} />
        <Linha rotulo="Entrega prevista" valor={vendor?.avgKeyHandover || "—"} />
      </div>

      <div style={{ margin: "18px 26px 0" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-mute)", marginBottom: 10 }}>Passo a passo</div>
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 13.5, color: "var(--text-dim)" }}>
          {passos.map((p) => <li key={p}>{p}</li>)}
        </ol>
      </div>

      <div style={{ padding: "20px 26px 26px", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button variant="primary" onClick={() => { onOpenLot?.(lot); onNavigate?.("win", lot.id); onClose(); }}>
          Abrir acompanhamento completo
        </Button>
        {hasWhatsApp() && (
          <Button variant="ghost" icon={<Icon.whatsapp size={14} />} onClick={() => openExternal(CONTACT.whatsappUrl)}>
            Falar no WhatsApp
          </Button>
        )}
      </div>
    </Dialog>
  );
}

function Linha({ rotulo, valor, destaque }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0" }}>
      <span style={{ fontSize: 13.5, color: "var(--text-dim)" }}>{rotulo}</span>
      <span style={{
        fontFamily: "var(--mono)", fontSize: destaque ? 16 : 13.5, fontWeight: destaque ? 600 : 500,
        color: destaque ? "var(--accent-ink)" : "var(--text)",
      }}>{valor}</span>
    </div>
  );
}
