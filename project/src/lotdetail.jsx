// Lot detail (the hero screen) + Win confirmation.
import { useState, useMemo, useEffect } from "react";
import { GLOSSARY, VENDORS, fmtBRL, fmtNum, simulateCost } from "./data.js";
import { Icon, Badge, Button, Countdown, GlossaryTerm, LotPhoto } from "./components.jsx";

// ============================================================
// LOT DETAIL — the most important screen
// ============================================================
export function LotDetailScreen({ lot, onBack, onBid, onSave }) {
  const [tab, setTab] = useState("desc"); // desc | rules | docs | glossary
  const [simulatorValue, setSimulatorValue] = useState(lot.currentBid + 1000);
  const vendor = VENDORS[lot.vendor];
  const isCarro = lot.category === "carro";
  const breakdown = simulateCost(simulatorValue);
  const reference = isCarro ? lot.fipe : lot.appraised;
  const discount = Math.round((1 - lot.currentBid / reference) * 100);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 40px 80px", animation: "leiloe-fadein 0.3s ease" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-mute)", marginBottom: 22 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: "var(--text-mute)", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <Icon.arrowL size={12} /> Explorar
        </button>
        <span>/</span>
        <span>{isCarro ? "Veículos" : "Imóveis"}</span>
        <span>/</span>
        <span style={{ color: "var(--text)" }}>{lot.title}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 32 }}>
        {/* LEFT — Photos + tabs */}
        <div>
          <Gallery lot={lot} onSave={onSave} />

          <div style={{ marginTop: 28 }}>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: 44, lineHeight: 1.05, letterSpacing: "-0.025em", margin: "0 0 8px", fontWeight: 400 }}>
              {lot.title}
            </h1>
            <div style={{ color: "var(--text-dim)", fontSize: 15, marginBottom: 22 }}>{lot.address} · {lot.city}</div>

            {/* Quick facts grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", marginBottom: 24 }}>
              {isCarro ? (
                <>
                  <Fact label="Ano" value={lot.year} />
                  <Fact label="KM rodados" value={`${fmtNum(lot.km)} km`} />
                  <Fact label="Câmbio" value={lot.transmission} />
                  <Fact label="Combustível" value={lot.fuel} />
                  <Fact label="Cor" value={lot.color} />
                  <Fact label="Placa" value={lot.plate} />
                  <Fact label="Estado" value={lot.condition} highlight={lot.condition !== "Sem sinistro"} />
                  <Fact label="Tipo de leilão" value={lot.auctionType} />
                </>
              ) : (
                <>
                  <Fact label="Área" value={`${lot.area}m²`} />
                  <Fact label="Dormitórios" value={lot.bedrooms} />
                  <Fact label="Vagas" value={lot.parking} />
                  <Fact label="Andar" value={lot.floor === 0 ? "Térreo" : `${lot.floor}º`} />
                  <Fact label="Ano" value={lot.year} />
                  <Fact label="Tipo" value={lot.type} />
                  <Fact label={<><GlossaryTerm term="ocupação">Ocupação</GlossaryTerm></>} value={lot.occupancy} highlight={lot.occupancy !== "Vazio"} />
                  <Fact label={<>Tipo de leilão</>} value={lot.auctionType} />
                </>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 22 }}>
              {[
                { id: "desc",     label: "Descrição" },
                { id: "rules",    label: "Regras e taxas" },
                { id: "docs",     label: "Documentos" },
                { id: "glossary", label: "Glossário deste leilão" },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  background: "transparent", border: "none",
                  color: tab === t.id ? "var(--text)" : "var(--text-mute)",
                  padding: "10px 16px", fontSize: 14, fontWeight: tab === t.id ? 500 : 400,
                  borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
                  marginBottom: -1, cursor: "pointer",
                }}>{t.label}</button>
              ))}
            </div>

            {tab === "desc" && (
              <div style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.65, maxWidth: 680 }}>
                {lot.description}
              </div>
            )}
            {tab === "rules" && (
              <div style={{ color: "var(--text-dim)", fontSize: 14.5, lineHeight: 1.65, maxWidth: 680 }}>
                <p style={{ margin: "0 0 12px" }}>{lot.rules}</p>
                <div style={{ marginTop: 14, padding: "14px 18px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Resumo simples</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, display: "grid", gap: 4 }}>
                    <li>É a <GlossaryTerm term="praça">2ª praça</GlossaryTerm> — preço já saiu do cheio</li>
                    <li><GlossaryTerm term="comissão do leiloeiro">Comissão do leiloeiro</GlossaryTerm>: 5% (pago no ato)</li>
                    <li><GlossaryTerm term="ITBI">ITBI</GlossaryTerm>: 3% (pago à prefeitura na transferência)</li>
                    <li>Pagamento à vista por Pix em até 24h</li>
                  </ul>
                </div>
              </div>
            )}
            {tab === "docs" && (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {lot.docs.map((doc, i) => (
                  <li key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
                  }}>
                    <span style={{ fontSize: 14 }}>{doc}</span>
                    <button style={{ background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)", borderRadius: 8, padding: "4px 12px", fontSize: 12.5, cursor: "pointer" }}>Baixar PDF</button>
                  </li>
                ))}
              </ul>
            )}
            {tab === "glossary" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, maxWidth: 680 }}>
                {Object.entries(GLOSSARY).slice(0, 8).map(([term, def]) => (
                  <div key={term} style={{ padding: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: "var(--accent-ink)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{term}</div>
                    <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>{def}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Bid panel */}
        <aside style={{ position: "sticky", top: 100, alignSelf: "flex-start", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Live bid */}
          <div style={{ padding: 26, background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: "var(--radius-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Lance atual</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {fmtBRL(lot.currentBid)}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-mute)" }}>
                  <s>{fmtBRL(reference)}</s> {isCarro ? "FIPE" : "avaliação"}
                  <span style={{ color: "var(--success-ink)", marginLeft: 8, fontWeight: 500 }}>−{discount}% {isCarro ? "abaixo da FIPE" : "vs. mercado"}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 18 }}>
              <Mini label="Encerra em" value={<Countdown endsAt={lot.endsAt} compact />} />
              <Mini label="Lances" value={`${lot.bids}`} mono />
              <Mini label={<><GlossaryTerm term="lance mínimo">Mínimo</GlossaryTerm></>} value={fmtBRL(lot.minBid)} mono />
            </div>

            <Button variant="primary" size="lg" full onClick={() => onBid(lot)} icon={<Icon.gavel />}>
              Dar lance
            </Button>
            <button onClick={() => onSave(lot)} style={{
              marginTop: 10, width: "100%",
              background: "transparent", border: "1px solid var(--border-2)",
              color: "var(--text)", borderRadius: 999, padding: "12px 18px",
              fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {lot.saved ? <><Icon.heart size={14} /> Salvo · Ativar alerta</> : <><Icon.heart size={14} /> Salvar e ativar alerta</>}
            </button>
          </div>

          {/* Cost simulator */}
          <div style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Simulador de custo</div>
              <Badge tone="accent">novidade</Badge>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 12 }}>Se você desse este lance:</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <span style={{ fontFamily: "var(--mono)", color: "var(--text-mute)", fontSize: 14 }}>R$</span>
              <input type="number" value={simulatorValue} onChange={(e) => setSimulatorValue(Number(e.target.value) || 0)}
                style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 20, fontWeight: 600, flex: 1, minWidth: 0 }} />
            </div>
            <div style={{ marginTop: 16, fontSize: 13 }}>
              <SimRow label="Seu lance" value={breakdown.lance} />
              <SimRow label={<>+ Comissão (5%)</>} value={breakdown.comissao} />
              <SimRow label={<>+ <GlossaryTerm term="ITBI">ITBI</GlossaryTerm> (3%)</>} value={breakdown.itbi} />
              <SimRow label={<>+ Cartório</>} value={breakdown.registro} />
              <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
              <SimRow label="Total" value={breakdown.total} total />
            </div>
          </div>

          {/* Vendor card */}
          <VendorCard vendor={vendor} />

          {/* First-bid protection callout */}
          <div style={{
            padding: "18px 20px",
            background: "linear-gradient(135deg, var(--success-dim) 0%, var(--bg-2) 100%)",
            border: "1px solid rgba(123,224,176,0.22)",
            borderRadius: "var(--radius)",
            display: "flex", gap: 12,
          }}>
            <span style={{ color: "var(--success-ink)", flexShrink: 0, marginTop: 2 }}><Icon.shield size={18} /></span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--success-ink)", marginBottom: 3 }}>Primeiro lance protegido</div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.5 }}>Mudou de ideia em 24h? Cancele sem multa. Sem pegadinha.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value, highlight }) {
  return (
    <div style={{
      padding: "16px 18px",
      borderRight: "1px solid var(--border)",
      borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 14.5, color: highlight ? "var(--warning-ink)" : "var(--text)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function Mini({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontFamily: mono ? "var(--mono)" : "inherit", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function SimRow({ label, value, total }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: total ? "var(--accent-ink)" : "var(--text-dim)" }}>
      <span style={{ fontSize: total ? 14 : 12.5, fontWeight: total ? 500 : 400 }}>{label}</span>
      <span style={{ fontFamily: "var(--mono)", fontWeight: total ? 600 : 500, fontSize: total ? 15 : 13 }}>{fmtBRL(value, true)}</span>
    </div>
  );
}

function VendorCard({ vendor }) {
  return (
    <div style={{ padding: 22, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
      <div style={{ fontSize: 11, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14 }}>Vendedor</div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "linear-gradient(135deg, var(--surface-3), var(--surface-2))",
          border: "1px solid var(--border-2)",
          display: "grid", placeItems: "center",
          fontFamily: "var(--serif)", fontSize: 22, color: "var(--accent-ink)", fontStyle: "italic",
        }}>{vendor.name[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 500 }}>{vendor.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-mute)" }}>{vendor.type}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13 }}>
        <Stat2 label="Avaliação" value={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "var(--warning-ink)" }}>★</span>
            <span style={{ fontWeight: 500 }}>{vendor.rating.toFixed(1)}</span>
            <span style={{ color: "var(--text-mute)", fontSize: 12 }}>({fmtNum(vendor.reviews)})</span>
          </span>
        } />
        <Stat2 label="Taxa de entrega" value={
          <span style={{ color: "var(--success-ink)", fontWeight: 500 }}>{Math.round(vendor.deliveryRate * 100)}%</span>
        } />
        <Stat2 label="Na plataforma" value={vendor.onPlatformSince} />
        <Stat2 label="Entrega de chaves" value={vendor.avgKeyHandover} />
      </div>
    </div>
  );
}

function Stat2({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-mute)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 400 }}>{value}</div>
    </div>
  );
}

// ---------- Gallery ----------
function Gallery({ lot, onSave }) {
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const thumbs = [0, 1, 2, 3];
  // Auto-advance every 3.5s when in auto mode
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setIdx(i => (i + 1) % thumbs.length), 3500);
    return () => clearInterval(id);
  }, [auto, thumbs.length]);
  return (
    <div>
      <div style={{ position: "relative" }}>
        <LotPhoto lot={lot} height={460} rounded="var(--radius-lg)" showBadges photoIndex={idx}>
          <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 8 }}>
            <Badge tone="dark">Foto {idx + 1} de {thumbs.length}</Badge>
            {auto && <Badge tone="dark"><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "leiloe-pulse 1.4s infinite", display: "inline-block" }} /> auto</Badge>}
          </div>
          <button onClick={() => onSave(lot)} style={{
            position: "absolute", top: 14, right: 14,
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(8,6,12,0.72)", border: "1px solid rgba(255,255,255,0.28)",
            color: lot.saved ? "var(--accent)" : "#F4F1E8",
            display: "grid", placeItems: "center", backdropFilter: "blur(8px)", cursor: "pointer", fontSize: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
          }}>
            {lot.saved ? "♥" : "♡"}
          </button>
          {/* prev / next */}
          <button onClick={(e) => { e.stopPropagation(); setAuto(false); setIdx(i => (i - 1 + thumbs.length) % thumbs.length); }} style={navArrowStyle("left")} aria-label="Anterior">
            <Icon.arrowL size={16} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setAuto(false); setIdx(i => (i + 1) % thumbs.length); }} style={navArrowStyle("right")} aria-label="Próximo">
            <Icon.arrowR size={16} />
          </button>
        </LotPhoto>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${thumbs.length}, 1fr)`, gap: 10, marginTop: 10 }}>
        {thumbs.map(i => (
          <button key={i} onClick={() => { setAuto(false); setIdx(i); }} style={{
            position: "relative", padding: 0, border: "none", cursor: "pointer", borderRadius: 8, overflow: "hidden",
            outline: idx === i ? "2px solid var(--accent)" : "1px solid var(--border)",
            outlineOffset: idx === i ? -2 : -1,
          }}>
            <LotPhoto lot={lot} height={70} rounded="0" showBadges={false} photoIndex={i} />
          </button>
        ))}
      </div>
    </div>
  );
}

function navArrowStyle(side) {
  return {
    position: "absolute", top: "50%", [side]: 14,
    transform: "translateY(-50%)",
    width: 38, height: 38, borderRadius: "50%",
    background: "rgba(8,6,12,0.72)",
    border: "1px solid rgba(255,255,255,0.28)",
    color: "#F4F1E8",
    display: "grid", placeItems: "center",
    cursor: "pointer", backdropFilter: "blur(8px)", boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
  };
}

// ============================================================
// WIN — Arremate confirmation + post-bid checklist
// ============================================================
export function WinScreen({ lot, winValue, onNavigate, onTour }) {
  const [done, setDone] = useState({ pay: false, contract: false, itbi: false, key: false, confirm: false });
  const allDone = Object.values(done).every(Boolean);

  return (
    <div style={{ position: "relative", overflow: "hidden", animation: "leiloe-fadein 0.4s ease" }}>
      <Confetti />
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "48px 40px 80px", position: "relative" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <Badge tone="success" style={{ marginBottom: 22 }}>
            <Icon.spark size={12} /> Arremate confirmado
          </Badge>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 68, lineHeight: 1, letterSpacing: "-0.035em", margin: "0 0 18px", fontWeight: 400 }}>
            Parabéns, <span style={{ fontStyle: "italic", color: "var(--accent-ink)" }}>Camila</span>.<br/>
            Você arrematou.
          </h1>
          <p style={{ fontSize: 17, color: "var(--text-dim)", lineHeight: 1.5, maxWidth: 540, margin: "0 auto" }}>
            <span style={{ color: "var(--text)" }}>{lot.title}</span> agora é seu por <span style={{ fontFamily: "var(--mono)", color: "var(--text)", fontWeight: 600 }}>{fmtBRL(winValue || lot.currentBid)}</span>. Vamos te guiar pelos próximos passos — um de cada vez.
          </p>
        </div>

        {/* Lot summary */}
        <div style={{ padding: 24, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", marginBottom: 28, display: "grid", gridTemplateColumns: "200px 1fr auto", gap: 24, alignItems: "center" }}>
          <LotPhoto lot={lot} height={120} showBadges={false} />
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, lineHeight: 1.2, marginBottom: 4 }}>{lot.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{lot.address}</div>
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12.5, color: "var(--text-dim)" }}>
              <span>{lot.area}m²</span>
              <span>{lot.bedrooms} dorm.</span>
              <span>{lot.occupancy}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Valor arrematado</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 26, fontWeight: 600 }}>{fmtBRL(winValue || lot.currentBid)}</div>
          </div>
        </div>

        {/* Checklist */}
        <div style={{ padding: "8px 28px 28px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
          <div style={{ padding: "20px 0 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 26, letterSpacing: "-0.01em", lineHeight: 1.15 }}>Seu passo a passo</div>
              <div style={{ fontSize: 13, color: "var(--text-mute)", marginTop: 4 }}>{Object.values(done).filter(Boolean).length} de 5 concluídos · entrega prevista em {VENDORS[lot.vendor].avgKeyHandover}</div>
            </div>
            <a href="#" style={{ fontSize: 13, color: "var(--accent-ink)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon.whatsapp size={14} /> Falar com suporte
            </a>
          </div>

          <ChecklistItem n="1" done={done.pay} onToggle={() => setDone(d => ({ ...d, pay: !d.pay }))}
            title="Pagar o sinal por Pix" deadline="Até 24h"
            body="Você vai receber um Pix de R$ 7.125 (comissão 5%) + R$ 4.275 (ITBI estimado). O lance principal pode ser parcelado em até 30x conforme score." />

          <ChecklistItem n="2" done={done.contract} onToggle={() => setDone(d => ({ ...d, contract: !d.contract }))}
            title="Assinar a carta de arrematação" deadline="2–7 dias"
            body={<>O cartório envia a <GlossaryTerm term="carta de arrematação">carta de arrematação</GlossaryTerm> por e-mail. Assine digitalmente pelo gov.br — não precisa sair de casa.</>} />

          <ChecklistItem n="3" done={done.itbi} onToggle={() => setDone(d => ({ ...d, itbi: !d.itbi }))}
            title="Pagar ITBI na prefeitura" deadline="15 dias após carta"
            body={<><GlossaryTerm term="ITBI">ITBI</GlossaryTerm> em SP é 3% do valor do arremate. A gente gera o boleto pronto — basta pagar.</>} />

          <ChecklistItem n="4" done={done.key} onToggle={() => setDone(d => ({ ...d, key: !d.key }))}
            title="Retirar as chaves" deadline="~28 dias"
            body="O leiloeiro entra em contato pra agendar. Para imóveis vazios geralmente acontece em 4 semanas; ocupados podem demorar mais." />

          <ChecklistItem n="5" done={done.confirm} onToggle={() => setDone(d => ({ ...d, confirm: !d.confirm }))}
            title="Confirmar recebimento" deadline="Depois das chaves"
            body="Quando você confirma, o leiloeiro recebe o pagamento e o ciclo se fecha. Você também avalia a experiência." last />
        </div>

        {allDone && (
          <div style={{ textAlign: "center", padding: "32px 0", animation: "leiloe-fadein 0.4s ease" }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 28, marginBottom: 8 }}>Tudo certo. 🎉</div>
            <div style={{ color: "var(--text-dim)" }}>Bora avaliar a Justi Leilões e descobrir o próximo lote?</div>
          </div>
        )}

        <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center" }}>
          <Button variant="ghost" onClick={() => onNavigate("listing")} icon={<Icon.arrowL />}>Explorar mais imóveis</Button>
          <Button variant="primary" onClick={() => onNavigate("home")}>Voltar pra Início</Button>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ n, title, body, done, onToggle, deadline, last }) {
  return (
    <div style={{ display: "flex", gap: 18, padding: "20px 0", borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <button onClick={onToggle} aria-label={done ? "Desmarcar" : "Marcar como concluído"} style={{
        width: 36, height: 36, borderRadius: "50%",
        background: done ? "var(--success-dim)" : "var(--surface-2)",
        border: `1.5px solid ${done ? "var(--success)" : "var(--border-2)"}`,
        color: done ? "var(--success)" : "var(--text-mute)",
        display: "grid", placeItems: "center", flexShrink: 0,
        cursor: "pointer", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600,
        transition: "all 0.18s ease",
      }}>
        {done ? <Icon.check size={16} /> : n}
      </button>
      <div style={{ flex: 1, opacity: done ? 0.62 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5, gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 500, textDecoration: done ? "line-through" : "none", textDecorationColor: "var(--text-mute)" }}>{title}</div>
          <span style={{ fontSize: 12, color: "var(--text-mute)", fontFamily: "var(--mono)" }}>{deadline}</span>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.55 }}>{body}</div>
      </div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => {
    return [...Array(36)].map((_, i) => ({
      x: Math.random() * 100,
      delay: Math.random() * 1.6,
      duration: 2.4 + Math.random() * 2,
      color: ["#B59FF0", "#7BE0B0", "#FFC07A", "#FF8E72", "#F4F1E8"][i % 5],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
    }));
  }, []);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: "absolute",
          top: -20, left: `${p.x}%`,
          width: p.size, height: p.size * 0.6,
          background: p.color,
          borderRadius: 2,
          transform: `rotate(${p.rotation}deg)`,
          animation: `leiloe-confetti ${p.duration}s ${p.delay}s linear`,
          animationFillMode: "forwards",
          opacity: 0.85,
        }} />
      ))}
    </div>
  );
}
