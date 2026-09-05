// Screens: Home, Tour, Listing, My Bids.
import { useState, useEffect, useMemo } from "react";
import { GLOSSARY, LOTS, fmtBRL, fmtNum, simulateCost } from "./data.js";
import { Badge, Button, Icon, SectionHead, GlossaryTerm, Countdown, LotCard, LotPhoto } from "./components.jsx";
import { Wordmark } from "./nav.jsx";
import { useCompare } from "./state/compareStore.js";

// ============================================================
// HOME — logged-out landing
// ============================================================
export function HomeScreen({ onNavigate, onTour, onOpenLot, onCategoryChange, onBid, onSave, onOpenPage, lots = LOTS }) {
  const allLots = lots;
  const featured = allLots.filter(l => l.category === "imovel").slice(0, 3);
  const endingSoon = [...allLots].sort((a, b) => a.endsAt - b.endsAt).slice(0, 3);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 40px 80px", animation: "leiloe-fadein 0.3s ease" }}>
      {/* Hero */}
      <section className="home-hero" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)", gap: 40, alignItems: "center", marginBottom: 96 }}>
        <div className="home-hero-text" style={{ minWidth: 0 }}>
          <Badge tone="accent" style={{ marginBottom: 22 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} /> beta &middot; São Paulo
          </Badge>
          <h1 style={{
            fontFamily: "var(--serif)", fontSize: "clamp(34px, 4.4vw, 60px)", lineHeight: 1.08,
            letterSpacing: "-0.02em", margin: "0 0 20px",
            fontWeight: 400,
          }}>
            Leilão sem juridiquês.<br/>
            <span style={{ color: "var(--accent-ink)" }}>Imóveis e carros abaixo do mercado</span>, com a clareza de um e-commerce.
          </h1>
          <p style={{ fontSize: 19, color: "var(--text-dim)", lineHeight: 1.5, margin: "0 0 32px" }}>
            O Leiloaê descomplica o leilão de imóveis e veículos pra você arrematar com segurança — mesmo se for sua primeira vez.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button size="lg" variant="primary" onClick={() => { onCategoryChange && onCategoryChange("todos"); onNavigate("listing"); }} iconRight={<Icon.arrowR />}>
              Ver leilões
            </Button>
            <Button size="lg" variant="ghost" onClick={() => onTour && onTour()} icon={<Icon.book size={18} />}>
              Tutorial
            </Button>
          </div>

          <div style={{ display: "flex", gap: 28, marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
            <Stat number="R$ 250mil" label="ticket máximo" />
            <Stat number="–35%" label="desconto médio vs. mercado" />
            <Stat number="24h" label="pra cancelar o 1º lance" />
          </div>
        </div>

        <HeroCollage lots={featured} onOpenLot={onOpenLot} />
      </section>

      {/* Categorias */}
      <section style={{ marginBottom: 96 }}>
        <SectionHead
          overline="Categorias"
          title="O que você quer arrematar?"
          subtitle="No MVP, imóveis residenciais e veículos até R$ 250 mil, região metropolitana de SP."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <CategoryCard
            label="Imóveis"
            count={allLots.filter(l => l.category === "imovel").length}
            sub="Studios, apartamentos, casas e kitnets em SP. Judiciais e extrajudiciais."
            gradient="linear-gradient(135deg, #B59FF0 0%, #5A3FA0 70%, #2A1F45 100%)"
            emoji="⌂"
            onClick={() => { onCategoryChange && onCategoryChange("imovel"); onNavigate("listing"); }}
          />
          <CategoryCard
            label="Veículos"
            count={allLots.filter(l => l.category === "carro").length}
            sub="Carros de bancos e leiloeiros oficiais. FIPE na tela, laudo cautelar incluso."
            gradient="linear-gradient(135deg, #FFC07A 0%, #9C6A2A 60%, #2A1D10 100%)"
            emoji="🚗"
            onClick={() => { onCategoryChange && onCategoryChange("carro"); onNavigate("listing"); }}
            badge="novo"
          />
        </div>
      </section>

      {/* Como funciona */}
      <section style={{ marginBottom: 96 }}>
        <SectionHead
          overline="Como funciona"
          title="Comprar em leilão, em 4 passos."
          subtitle="Sem letra miúda, sem termo escondido. Você vê o custo total antes de qualquer compromisso."
        />
        <div className="home-steps" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20 }}>
          <Step n="01" title="Encontre" body="Filtre por bairro, tipo e ocupação. Cada palavra técnica tem um tooltip explicando — basta tocar." />
          <Step n="02" title="Entenda" body={<>Lance + <GlossaryTerm term="comissão do leiloeiro">comissão</GlossaryTerm> + <GlossaryTerm term="ITBI">ITBI</GlossaryTerm> + cartório. Tudo na tela, atualizado em tempo real.</>} />
          <Step n="03" title="Arremate" body="Confirmação clara, lance automático opcional e 24h pra cancelar o primeiro lance, sem multa." />
          <Step n="04" title="Receba" body="Passo a passo do pagamento até a entrega das chaves, com suporte humano no WhatsApp." />
        </div>
      </section>

      {/* Featured / Ending soon */}
      <section style={{ marginBottom: 96 }}>
        <SectionHead
          overline="Encerrando em breve"
          title="Disputas ao vivo agora."
          right={<Button variant="ghost" size="sm" onClick={() => onNavigate("listing")} iconRight={<Icon.arrowR size={14} />}>Ver todos</Button>}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
          {endingSoon.map(lot => <LotCard key={lot.id} lot={lot} onClick={onOpenLot} onBid={onBid} onSave={onSave} />)}
        </div>
      </section>

      {/* Trust band */}
      <section style={{
        padding: "44px 48px",
        background: "linear-gradient(135deg, var(--surface) 0%, var(--bg-2) 100%)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, alignItems: "center",
      }}>
        <div>
          <Badge tone="success" style={{ marginBottom: 16 }}>O que a gente faz diferente</Badge>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: 36, lineHeight: 1.1, margin: "0 0 16px", letterSpacing: "-0.02em", fontWeight: 400 }}>
            Quatro coisas que os concorrentes não fazem.
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
            <Diff title="Glossário inline" body="Toda palavra jurídica tem tooltip. Você não precisa pausar pra googlar." />
            <Diff title="Simulador de custo total" body="Lance + taxas + ITBI antes do compromisso. Sem surpresa no final." />
            <Diff title="Histórico público do vendedor" body="Avaliações, taxa de entrega e tempo na plataforma — visíveis pra todos." />
            <Diff title="Primeiro lance protegido" body="Janela de 24h pra cancelar a primeira tentativa. Sem multa." />
          </ul>
        </div>
        <div style={{
          padding: 24,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-mute)" }}>simulador rápido</span>
            <Badge tone="accent">demo</Badge>
          </div>
          <MiniSimulator initial={142500} />
        </div>
      </section>

      {/* Depoimentos */}
      <section style={{ margin: "96px 0" }}>
        <SectionHead overline="Depoimentos" title="Quem já arrematou." subtitle="Três primeiras vezes que deram certo." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
          <Quote text="Primeiro arremate da minha vida. Sem o glossário eu não teria coragem." who="Camila, 29" role="Studio na Mooca" />
          <Quote text="Comprei um carro 22% abaixo da FIPE. O simulador me deu segurança." who="Rafael, 34" role="Honda Civic 2019" />
          <Quote text="Atendimento via WhatsApp resolveu em 12 minutos. Outro mundo." who="Marina, 29" role="Apto no Tatuapé" />
        </div>
      </section>

      {/* FAQ */}
      <section style={{ marginBottom: 96 }}>
        <SectionHead overline="Dúvidas" title="Perguntas frequentes." subtitle="O que todo mundo pergunta antes do primeiro lance." />
        <HomeFaq onOpenPage={onOpenPage} />
      </section>

      {/* CTA final */}
      <FinalCta lots={allLots} onNavigate={onNavigate} onTour={onTour} onCategoryChange={onCategoryChange} />
    </div>
  );
}

function Quote({ text, who, role }) {
  return (
    <figure style={{ margin: 0, padding: 28, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: 18 }}>
      <span style={{ fontFamily: "var(--serif)", fontSize: 34, lineHeight: 1, color: "var(--accent-ink)" }}>&ldquo;</span>
      <blockquote style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 19, lineHeight: 1.4, letterSpacing: "-0.01em", textWrap: "pretty" }}>{text}</blockquote>
      <figcaption style={{ marginTop: "auto", fontSize: 13, color: "var(--text-mute)" }}>
        <span style={{ color: "var(--text)", fontWeight: 500 }}>{who}</span> &middot; {role}
      </figcaption>
    </figure>
  );
}

function HomeFaq({ onOpenPage }) {
  const items = [
    { q: "E se eu nunca participei de um leilão?", a: "É o caso mais comum aqui. O tour de 2 minutos explica o básico, cada termo jurídico tem tooltip e seu primeiro lance pode ser cancelado em 24h sem multa." },
    { q: "Como sei o custo final?", a: "O simulador soma lance + comissão do leiloeiro (5%) + taxa Leiloaê (1,5%) + ITBI (3%) e mostra o total antes de você confirmar qualquer coisa." },
    { q: "É seguro?", a: "Todos os lotes vêm de leiloeiros oficiais e órgãos públicos, com edital e matrícula anexados. O vendedor tem nota pública por entrega, clareza e suporte." },
    { q: "Posso parcelar?", a: "Depende do edital de cada lote. Quando há parcelamento, as condições aparecem na aba Regras e taxas do lote — sem letra miúda." },
    { q: "E se eu me arrepender?", a: "Na sua primeira arrematação você tem 24 horas pra cancelar, sem multa. Nos lances seguintes valem as regras do edital, que a gente resume em português." },
  ];
  const [open, setOpen] = useState(0);
  return (
    <div style={{ maxWidth: 820, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      {items.map((it, i) => (
        <div key={it.q} style={{ borderBottom: i === items.length - 1 ? "none" : "1px solid var(--border)" }}>
          <button onClick={() => setOpen(o => o === i ? -1 : i)} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, width: "100%", textAlign: "left",
            background: "transparent", border: "none", color: "var(--text)", cursor: "pointer", padding: "20px 24px", fontSize: 16, fontWeight: 500, fontFamily: "inherit",
          }}>
            {it.q}
            <span style={{ flexShrink: 0, color: "var(--accent-ink)", fontSize: 20, lineHeight: 1, transform: open === i ? "rotate(45deg)" : "none", transition: "transform 0.2s ease" }}>+</span>
          </button>
          {open === i && (
            <p style={{ margin: 0, padding: "0 24px 22px", fontSize: 14.5, lineHeight: 1.6, color: "var(--text-dim)", maxWidth: 640, textWrap: "pretty" }}>{it.a}</p>
          )}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "18px 24px", borderTop: "1px solid var(--border)", background: "var(--bg-2)" }}>
        <span style={{ fontSize: 14, color: "var(--text-dim)" }}>Não achou sua dúvida?</span>
        <Button size="sm" variant="ghost" onClick={() => onOpenPage && onOpenPage("ajuda")} iconRight={<Icon.arrowR size={14} />}>Central de ajuda</Button>
      </div>
    </div>
  );
}

function FinalCta({ lots, onNavigate, onTour, onCategoryChange }) {
  const endingToday = lots.filter(l => l.endsAt - Date.now() < 864e5).length;
  return (
    <section style={{
      padding: "56px 48px", textAlign: "center",
      background: "linear-gradient(135deg, var(--surface) 0%, var(--bg-2) 100%)",
      border: "1px solid var(--border-2)", borderRadius: "var(--radius-lg)",
    }}>
      <Badge tone="warning" style={{ marginBottom: 20 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--warning-ink)" }} /> {endingToday} leilões encerram hoje
      </Badge>
      <h3 style={{ fontFamily: "var(--serif)", fontSize: "clamp(28px, 3.4vw, 42px)", lineHeight: 1.1, letterSpacing: "-0.02em", fontWeight: 400, margin: "0 auto 16px", maxWidth: 640 }}>
        Pronto pra arrematar seu primeiro lote?
      </h3>
      <p style={{ fontSize: 17, color: "var(--text-dim)", lineHeight: 1.55, margin: "0 auto 32px", maxWidth: 560, textWrap: "pretty" }}>
        Faça o tour de 2 minutos e ganhe a proteção de primeiro lance. Você só confirma depois de ver o custo total.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Button size="lg" variant="primary" onClick={() => onTour && onTour()} icon={<Icon.book size={18} />}>Fazer tour de 2 min</Button>
        <Button size="lg" variant="ghost" onClick={() => { onCategoryChange && onCategoryChange("todos"); onNavigate("listing"); }} iconRight={<Icon.arrowR />}>Ver leilões abertos</Button>
      </div>
      <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginTop: 32, paddingTop: 26, borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--text-mute)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Icon.shield size={14} /> 24h pra cancelar</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Icon.check size={13} /> 4,8 de satisfação</span>
      </div>
    </section>
  );
}

function Stat({ number, label }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 30, letterSpacing: "-0.02em", lineHeight: 1, whiteSpace: "nowrap" }}>{number}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-mute)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em", lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

function Step({ n, title, body }) {
  return (
    <div style={{
      padding: 28,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
    }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent-ink)", marginBottom: 18 }}>{n}</div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 24, lineHeight: 1.2, letterSpacing: "-0.01em", marginBottom: 10 }}>{title}</div>
      <p style={{ color: "var(--text-dim)", fontSize: 14.5, lineHeight: 1.55, margin: 0 }}>{body}</p>
    </div>
  );
}

function Diff({ title, body }) {
  return (
    <li style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span style={{
        width: 22, height: 22, borderRadius: "50%",
        background: "var(--success-dim)", color: "var(--success-ink)",
        display: "grid", placeItems: "center", flexShrink: 0, marginTop: 2,
      }}><Icon.check size={12} /></span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5 }}>{body}</div>
      </div>
    </li>
  );
}

function HeroCollage({ lots, onOpenLot }) {
  // 4 stacked + offset cards
  return (
    <div className="home-hero-collage" style={{ position: "relative", height: 540, perspective: 1200 }}>
      {lots.slice(0, 3).map((lot, i) => {
        const positions = [
          { right: 0,   top: 0,    rotate: 3,  z: 3, size: 1.0 },
          { right: 220, top: 80,   rotate: -4, z: 2, size: 0.9 },
          { right: 40,  top: 280,  rotate: 2,  z: 1, size: 0.95 },
        ];
        const p = positions[i];
        return (
          <button key={lot.id} onClick={() => onOpenLot(lot)} style={{
            position: "absolute",
            right: p.right, top: p.top,
            transform: `rotate(${p.rotate}deg) scale(${p.size})`,
            transformOrigin: "center",
            background: "var(--surface)",
            border: "1px solid var(--border-2)",
            borderRadius: 20,
            padding: 0,
            width: 280,
            overflow: "hidden",
            cursor: "pointer",
            boxShadow: "0 24px 60px -16px rgba(0,0,0,0.6)",
            zIndex: p.z,
            textAlign: "left",
            transition: "transform 0.3s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = `rotate(${p.rotate}deg) scale(${p.size * 1.04})`; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${p.rotate}deg) scale(${p.size})`; }}
          >
            <LotPhoto lot={lot} height={160} rounded="0" />
            <div style={{ padding: 16 }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.15, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lot.title}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 600 }}>{fmtBRL(lot.currentBid)}</div>
                <Countdown endsAt={lot.endsAt} compact />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MiniSimulator({ initial }) {
  const [v, setV] = useState(initial);
  const b = simulateCost(v);
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-mute)", marginBottom: 6 }}>Se você desse este lance:</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
        <span style={{ fontFamily: "var(--mono)", color: "var(--text-mute)", fontSize: 14 }}>R$</span>
        <input type="number" value={v} onChange={(e) => setV(Number(e.target.value) || 0)}
          style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 18, fontWeight: 600, flex: 1, minWidth: 0 }} />
      </div>
      <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12.5 }}>
        <Row label="+ Comissão" value={b.comissao} />
        <Row label="+ ITBI" value={b.itbi} />
        <Row label="+ Cartório" value={b.registro} />
        <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />
        <Row label="Custo total" value={b.total} accent />
      </div>
    </div>
  );
}
function Row({ label, value, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: accent ? "var(--accent-ink)" : "var(--text-dim)", fontWeight: accent ? 600 : 400, gap: 8 }}>
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{fmtBRL(value, true)}</span>
    </div>
  );
}

// ============================================================
// TOUR — 5-step modal overlay
// ============================================================
export function TourOverlay({ open, onClose }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (open) setI(0); }, [open]);
  if (!open) return null;

  const slides = [
    {
      kicker: "01 / 05 · O que é um leilão",
      title: "Imóvel a preço de banco, sem o drama.",
      body: "Imóveis em leilão saem em média 35% abaixo do mercado. A gente cuida do juridiquês — você cuida da escolha.",
      art: <ArtBuilding />,
    },
    {
      kicker: "02 / 05 · Glossário",
      title: <>Termos chatos viram tooltips.</>,
      body: <>Quando você ver palavras como <GlossaryTerm term="praceamento" /> ou <GlossaryTerm term="adjudicação" />, é só tocar.</>,
      art: <ArtGlossary />,
    },
    {
      kicker: "03 / 05 · Simulador",
      title: "Custo total na cara antes de qualquer lance.",
      body: "Lance + comissão + ITBI + cartório, calculados na hora. Você decide com a calculadora aberta.",
      art: <ArtSimulator />,
    },
    {
      kicker: "04 / 05 · Primeiro lance protegido",
      title: "Apertou pra ver no que dá? Tudo bem.",
      body: "Seu primeiro lance tem janela de 24h pra cancelar, sem multa. A gente sabe que tudo é novo pra você.",
      art: <ArtShield />,
    },
    {
      kicker: "05 / 05 · Pronto",
      title: "Bora explorar?",
      body: "São Paulo tem 8 imóveis ativos agora, com lances rolando entre R$ 98mil e R$ 215mil. Bom começo de pesquisa.",
      art: <ArtSpark />,
    },
  ];
  const s = slides[i];
  const last = i === slides.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(8,6,12,0.86)", backdropFilter: "blur(12px)",
      display: "grid", placeItems: "center", padding: 24,
      animation: "leiloe-fadein 0.25s ease",
    }}>
      <div style={{
        width: "100%", maxWidth: 920,
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        borderRadius: 24,
        boxShadow: "0 40px 80px -16px rgba(0,0,0,0.7)",
        overflow: "hidden",
        animation: "leiloe-scalein 0.25s ease",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 480 }}>
          <div style={{
            padding: "40px 40px 32px",
            display: "flex", flexDirection: "column",
            background: "var(--surface)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
              <Wordmark size={20} />
              <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-mute)", fontSize: 13, cursor: "pointer" }}>
                Pular tour ›
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--accent-ink)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 18, fontFamily: "var(--mono)" }}>
              {s.kicker}
            </div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.025em", margin: "0 0 18px", fontWeight: 400 }}>
              {s.title}
            </h2>
            <p style={{ color: "var(--text-dim)", fontSize: 16, lineHeight: 1.55, margin: 0 }}>{s.body}</p>

            <div style={{ flex: 1 }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {slides.map((_, idx) => (
                  <span key={idx} style={{
                    width: idx === i ? 28 : 8, height: 8, borderRadius: 999,
                    background: idx === i ? "var(--accent)" : "var(--surface-3)",
                    transition: "width 0.2s ease, background 0.2s ease",
                  }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {i > 0 && <Button variant="ghost" size="sm" onClick={() => setI(i - 1)} icon={<Icon.arrowL size={14} />}>Voltar</Button>}
                <Button variant="primary" size="sm" onClick={() => last ? onClose() : setI(i + 1)} iconRight={!last && <Icon.arrowR size={14} />}>
                  {last ? "Começar a explorar" : "Próximo"}
                </Button>
              </div>
            </div>
          </div>

          <div style={{
            background: "linear-gradient(135deg, var(--bg-2) 0%, var(--bg) 100%)",
            display: "grid", placeItems: "center",
            borderLeft: "1px solid var(--border)",
            position: "relative",
            overflow: "hidden",
          }}>
            {s.art}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtBuilding() {
  return (
    <svg viewBox="0 0 320 320" style={{ width: "75%", height: "75%" }}>
      <defs>
        <linearGradient id="bld" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B59FF0" />
          <stop offset="1" stopColor="#5A3FA0" />
        </linearGradient>
      </defs>
      <rect x="80" y="60" width="180" height="220" rx="6" fill="url(#bld)" opacity="0.9" />
      <rect x="60" y="100" width="100" height="180" rx="6" fill="#221A30" stroke="rgba(255,255,255,0.13)" />
      {[...Array(7)].map((_, r) => [...Array(3)].map((_, c) => (
        <rect key={`${r}-${c}`} x={70 + c*30} y={115 + r*22} width="18" height="14" fill="rgba(181,159,240,0.4)" />
      )))}
      {[...Array(8)].map((_, r) => [...Array(4)].map((_, c) => (
        <rect key={`b-${r}-${c}`} x={95 + c*38} y={80 + r*24} width="22" height="14" fill="rgba(255,255,255,0.16)" />
      )))}
      <text x="160" y="305" textAnchor="middle" fontFamily="var(--mono)" fontSize="11" fill="var(--text-mute)" letterSpacing="2">SÃO PAULO · SP</text>
    </svg>
  );
}

function ArtGlossary() {
  return (
    <div style={{ width: "70%", display: "flex", flexDirection: "column", gap: 14 }}>
      {["praceamento", "ITBI", "adjudicação"].map((term, i) => (
        <div key={term} style={{ position: "relative", padding: "16px 18px", background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 12, animation: `leiloe-fadein 0.4s ${i * 0.1}s both ease` }}>
          <div style={{ fontSize: 11, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{term}</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.45 }}>{GLOSSARY[term].slice(0, 80) + "…"}</div>
          {i === 0 && <span style={{ position: "absolute", top: -8, right: -8, padding: "2px 8px", background: "var(--accent)", color: "#15101F", fontSize: 10, fontWeight: 600, borderRadius: 999 }}>tooltip</span>}
        </div>
      ))}
    </div>
  );
}

function ArtSimulator() {
  return (
    <div style={{ width: "75%", padding: 22, background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 16 }}>
      <div style={{ fontSize: 11, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Custo total</div>
      {[
        ["Seu lance", "R$ 142.500"],
        ["+ Comissão (5%)", "R$ 7.125"],
        ["+ ITBI (3%)", "R$ 4.275"],
        ["+ Cartório", "R$ 2.800"],
      ].map(([l, v]) => (
        <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "var(--text-dim)" }}>
          <span>{l}</span><span style={{ fontFamily: "var(--mono)" }}>{v}</span>
        </div>
      ))}
      <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, color: "var(--accent-ink)", fontWeight: 600 }}>
        <span>Total</span><span style={{ fontFamily: "var(--mono)" }}>R$ 156.700</span>
      </div>
    </div>
  );
}

function ArtShield() {
  return (
    <svg viewBox="0 0 240 240" style={{ width: "60%" }}>
      <defs>
        <linearGradient id="sh" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7BE0B0" />
          <stop offset="1" stopColor="#2D6E55" />
        </linearGradient>
      </defs>
      <path d="M120 30 L40 60 L40 130 C40 175 80 200 120 215 C160 200 200 175 200 130 L200 60 Z" fill="url(#sh)" opacity="0.18" stroke="#7BE0B0" strokeWidth="1.5" />
      <path d="M85 120 L110 145 L160 95" stroke="#7BE0B0" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="120" y="190" textAnchor="middle" fontFamily="var(--mono)" fontSize="13" fill="#7BE0B0" letterSpacing="2">24H · CANCELÁVEL</text>
    </svg>
  );
}

function ArtSpark() {
  return (
    <div style={{ position: "relative", width: 240, height: 240 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle, rgba(181,159,240,0.45), transparent 60%)" }} />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 96, color: "var(--accent-ink)", letterSpacing: "-0.04em" }}>ê</span>
      </div>
    </div>
  );
}

// ============================================================
// LISTING — unified browse with Tudo/Imóveis/Veículos pills
// ============================================================
export function ListingScreen({ onOpenLot, density = "regular", category = "todos", onCategoryChange, onBid, onSave, onOpenCompare, lots = LOTS }) {
  const compare = useCompare();
  const [filters, setFilters] = useState({
    search: "",
    types: [],
    regions: [],
    occupancy: "all",
    auctionType: "all",
    condition: "all",
    sort: "ending",
    priceMax: 350000,
  });

  // Reset relevant filters when switching category
  useEffect(() => {
    setFilters(f => ({ ...f, types: [], regions: [], occupancy: "all", auctionType: "all", condition: "all" }));
  }, [category]);

  const filtered = useMemo(() => {
    let lotsArr = [...lots];
    if (category === "imovel") lotsArr = lotsArr.filter(l => l.category === "imovel");
    else if (category === "carro") lotsArr = lotsArr.filter(l => l.category === "carro");
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      lotsArr = lotsArr.filter(l => (l.title + " " + (l.address || "") + " " + (l.region || "") + " " + (l.brand || "") + " " + (l.model || "")).toLowerCase().includes(q));
    }
    if (filters.types.length) {
      lotsArr = lotsArr.filter(l => filters.types.includes(l.category === "carro" ? l.brand : l.type));
    }
    if (filters.regions.length) lotsArr = lotsArr.filter(l => filters.regions.includes(l.region));
    if (filters.occupancy !== "all") lotsArr = lotsArr.filter(l => l.occupancy === filters.occupancy);
    if (filters.auctionType !== "all") lotsArr = lotsArr.filter(l => l.auctionType === filters.auctionType);
    if (filters.condition !== "all") lotsArr = lotsArr.filter(l => l.condition === filters.condition);
    lotsArr = lotsArr.filter(l => l.currentBid <= filters.priceMax);
    if (filters.sort === "ending") lotsArr.sort((a, b) => a.endsAt - b.endsAt);
    else if (filters.sort === "price-low") lotsArr.sort((a, b) => a.currentBid - b.currentBid);
    else if (filters.sort === "price-high") lotsArr.sort((a, b) => b.currentBid - a.currentBid);
    else if (filters.sort === "discount") {
      lotsArr.sort((a, b) => {
        const refA = a.category === "carro" ? a.fipe : a.appraised;
        const refB = b.category === "carro" ? b.fipe : b.appraised;
        return (refB - b.currentBid) - (refA - a.currentBid);
      });
    }
    return lotsArr;
  }, [filters, category, lots]);

  const hasFilters = filters.search || filters.types.length || filters.regions.length || filters.occupancy !== "all" || filters.auctionType !== "all" || filters.condition !== "all" || filters.priceMax < 350000;

  const clearAll = () => setFilters({
    search: "", types: [], regions: [], occupancy: "all", auctionType: "all", condition: "all",
    sort: "ending", priceMax: 350000,
  });

  const totals = {
    todos:   lots.length,
    imovel:  lots.filter(l => l.category === "imovel").length,
    carro:   lots.filter(l => l.category === "carro").length,
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 40px 80px" }}>
      <SectionHead
        overline="Explorar"
        title="Leilões em São Paulo"
        subtitle={<><b style={{ color: "var(--text)" }}>{filtered.length} resultados</b> · lotes abaixo de R$ 350.000 · região metropolitana.</>}
        right={
          <Button variant="ghost" size="sm" icon={<Icon.compare size={14} />} onClick={() => onOpenCompare && onOpenCompare()}>
            Comparar leilões{compare.ids.length > 0 ? ` (${compare.ids.length})` : ""}
          </Button>
        }
      />

      {/* Type pills (Tudo / Imóveis / Veículos) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
        <CategoryChip active={category === "todos"} onClick={() => onCategoryChange && onCategoryChange("todos")}>
          Tudo <CountTag active={category === "todos"}>{totals.todos}</CountTag>
        </CategoryChip>
        <CategoryChip active={category === "imovel"} onClick={() => onCategoryChange && onCategoryChange("imovel")}>
          Imóveis <CountTag active={category === "imovel"}>{totals.imovel}</CountTag>
        </CategoryChip>
        <CategoryChip active={category === "carro"} onClick={() => onCategoryChange && onCategoryChange("carro")}>
          Veículos <CountTag active={category === "carro"}>{totals.carro}</CountTag>
        </CategoryChip>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 32 }}>
        <FiltersPanel filters={filters} setFilters={setFilters} category={category} onClear={clearAll} hasFilters={hasFilters} />
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 16, flexWrap: "wrap" }}>
            <ActiveFilterChips filters={filters} setFilters={setFilters} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-mute)" }}>Ordenar por:</span>
              <select value={filters.sort} onChange={(e) => setFilters(f => ({ ...f, sort: e.target.value }))}
                style={{ background: "var(--surface)", border: "1px solid var(--border-2)", color: "var(--text)", borderRadius: 999, padding: "6px 12px", fontSize: 13, outline: "none" }}>
                <option value="ending">Encerrando em breve</option>
                <option value="price-low">Menor preço</option>
                <option value="price-high">Maior preço</option>
                <option value="discount">Maior desconto</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
            {filtered.map(lot => <LotCard key={lot.id} lot={lot} onClick={onOpenLot} density={density} onBid={onBid} onSave={onSave} />)}
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-mute)", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 16 }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--text)", marginBottom: 6 }}>Nada por aqui</div>
              Nenhum resultado com esses filtros. <button onClick={clearAll} style={{ background: "transparent", border: "none", color: "var(--accent-ink)", cursor: "pointer", textDecoration: "underline" }}>Limpar filtros</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CountTag({ children, active }) {
  return (
    <span style={{ marginLeft: 6, color: active ? "var(--bg)" : "var(--text-mute)", fontFamily: "var(--mono)", fontSize: 11, opacity: active ? 0.6 : 1 }}>{children}</span>
  );
}

function CategoryChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "var(--text)" : "var(--surface)",
      color: active ? "var(--bg)" : "var(--text-dim)",
      border: `1px solid ${active ? "var(--text)" : "var(--border-2)"}`,
      borderRadius: 999, padding: "10px 18px",
      fontSize: 14, fontWeight: 500, cursor: "pointer",
      display: "inline-flex", alignItems: "center",
      transition: "all 0.15s ease",
    }}>{children}</button>
  );
}

function ActiveFilterChips({ filters, setFilters }) {
  const chips = [];
  filters.types.forEach(t => chips.push({ label: t, onClear: () => setFilters(f => ({ ...f, types: f.types.filter(x => x !== t) })) }));
  filters.regions.forEach(r => chips.push({ label: r, onClear: () => setFilters(f => ({ ...f, regions: f.regions.filter(x => x !== r) })) }));
  if (filters.occupancy !== "all") chips.push({ label: filters.occupancy, onClear: () => setFilters(f => ({ ...f, occupancy: "all" })) });
  if (filters.auctionType !== "all") chips.push({ label: filters.auctionType, onClear: () => setFilters(f => ({ ...f, auctionType: "all" })) });
  if (filters.condition !== "all") chips.push({ label: filters.condition, onClear: () => setFilters(f => ({ ...f, condition: "all" })) });
  if (chips.length === 0) return <div />;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {chips.map((c, i) => (
        <span key={i} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px 5px 12px",
          background: "var(--accent-dim)", color: "var(--accent-ink)",
          border: "1px solid rgba(181,159,240,0.25)", borderRadius: 999,
          fontSize: 12.5, fontWeight: 500,
        }}>
          {c.label}
          <button onClick={c.onClear} style={{ background: "transparent", border: "none", color: "var(--accent-ink)", cursor: "pointer", display: "flex", padding: 0 }}>
            <Icon.close size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}

function FiltersPanel({ filters, setFilters, category, onClear, hasFilters }) {
  const isCarro = category === "carro";
  const showAll = category === "todos";
  const TYPES = isCarro
    ? ["Honda", "Hyundai", "Chevrolet", "Toyota", "Fiat"]
    : showAll
      ? ["Studio", "Apartamento", "Casa", "Kitnet", "Honda", "Hyundai", "Chevrolet", "Toyota", "Fiat"]
      : ["Studio", "Apartamento", "Casa", "Kitnet"];
  const REGIONS = isCarro
    ? ["Grande SP", "ABC"]
    : ["Centro", "Zona Leste", "Zona Norte", "Zona Sul", "Zona Oeste", "ABC", "Grande SP"];
  const toggleArr = (key, value) => {
    setFilters(f => {
      const cur = f[key];
      return { ...f, [key]: cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value] };
    });
  };
  return (
    <aside style={{ position: "sticky", top: 100, alignSelf: "flex-start" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-mute)" }}>Filtros</div>
          {hasFilters && (
            <button onClick={onClear} style={{ background: "transparent", border: "none", color: "var(--accent-ink)", fontSize: 12, cursor: "pointer", padding: 0 }}>
              Limpar tudo
            </button>
          )}
        </div>

        <FilterGroup label="Buscar">
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--bg-2)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "8px 12px",
            color: "var(--text-mute)",
          }}>
            <Icon.search size={13} />
            <input
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder={isCarro ? "Marca, modelo…" : "Bairro, cidade…"}
              style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 13, flex: 1, minWidth: 0 }}
            />
          </div>
        </FilterGroup>

        <FilterGroup label={isCarro ? "Marca" : (category === "todos" ? "Tipo / marca" : "Tipo de imóvel")}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TYPES.map(t => (
              <ChipToggle key={t} active={filters.types.includes(t)} onClick={() => toggleArr("types", t)}>{t}</ChipToggle>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Região">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {REGIONS.map(r => (
              <ChipToggle key={r} active={filters.regions.includes(r)} onClick={() => toggleArr("regions", r)}>{r}</ChipToggle>
            ))}
          </div>
        </FilterGroup>

        {!isCarro && category !== "carro" && (
          <FilterGroup label={<>Ocupação <span style={{ color: "var(--text-mute)", fontSize: 10, fontWeight: 400 }}> <GlossaryTerm term="ocupação">?</GlossaryTerm></span></>}>
            {[
              ["all", "Tanto faz"],
              ["Vazio", "Vazio"],
              ["Com inquilino", "Com inquilino"],
              ["Ocupado pelo antigo dono", "Ocupado pelo antigo dono"],
            ].map(([v, l]) => (
              <FilterRadio key={v} checked={filters.occupancy === v} onChange={() => setFilters(f => ({ ...f, occupancy: v }))}>{l}</FilterRadio>
            ))}
          </FilterGroup>
        )}

        {(isCarro || category === "todos") && (
          <FilterGroup label="Condição (veículos)">
            {[
              ["all", "Todas"],
              ["Sem sinistro", "Sem sinistro"],
              ["Sinistro pequeno", "Sinistro pequeno"],
            ].map(([v, l]) => (
              <FilterRadio key={v} checked={filters.condition === v} onChange={() => setFilters(f => ({ ...f, condition: v }))}>{l}</FilterRadio>
            ))}
          </FilterGroup>
        )}

        <FilterGroup label="Tipo de leilão">
          {[
            ["all", "Ambos"],
            ["Judicial", "Judicial"],
            ["Extrajudicial", "Extrajudicial"],
          ].map(([v, l]) => (
            <FilterRadio key={v} checked={filters.auctionType === v} onChange={() => setFilters(f => ({ ...f, auctionType: v }))}>{l}</FilterRadio>
          ))}
        </FilterGroup>

        <FilterGroup label="Preço máximo" last>
          <input type="range" min={20000} max={350000} step={5000} value={filters.priceMax}
            onChange={(e) => setFilters(f => ({ ...f, priceMax: Number(e.target.value) }))}
            style={{ width: "100%", accentColor: "var(--accent)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}>
            <span>R$ 20k</span>
            <span style={{ color: "var(--accent-ink)", fontWeight: 500, fontFamily: "var(--mono)" }}>{fmtBRL(filters.priceMax)}</span>
          </div>
        </FilterGroup>
      </div>
    </aside>
  );
}

function ChipToggle({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "var(--accent-dim)" : "transparent",
      color: active ? "var(--accent-ink)" : "var(--text-dim)",
      border: `1px solid ${active ? "rgba(181,159,240,0.4)" : "var(--border-2)"}`,
      borderRadius: 999, padding: "6px 12px",
      fontSize: 12.5, fontWeight: active ? 500 : 400,
      cursor: "pointer",
      transition: "all 0.12s ease",
      display: "inline-flex", alignItems: "center", gap: 5,
    }}>
      {active && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }} />}
      {children}
    </button>
  );
}

function FilterGroup({ label, children, last }) {
  return (
    <div style={{ paddingBottom: last ? 0 : 18, marginBottom: last ? 0 : 18, borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10, fontWeight: 500 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function FilterRadio({ checked, onChange, children }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "2px 0" }}>
      <span style={{
        width: 14, height: 14, borderRadius: "50%",
        border: `1.5px solid ${checked ? "var(--accent)" : "var(--border-2)"}`,
        display: "grid", placeItems: "center",
        background: checked ? "var(--accent)" : "transparent",
      }}>
        {checked && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#15101F" }} />}
      </span>
      <span style={{ fontSize: 13.5, color: checked ? "var(--text)" : "var(--text-dim)" }}>{children}</span>
    </label>
  );
}

export function CategoryCard({ label, count, sub, gradient, emoji, onClick, badge }) {
  return (
    <button onClick={onClick} style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      padding: 0, overflow: "hidden",
      cursor: "pointer", textAlign: "left",
      transition: "transform 0.18s ease, border-color 0.18s ease",
      display: "flex", flexDirection: "column",
      color: "inherit",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "var(--border-2)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{ position: "relative", height: 180, background: gradient, display: "grid", placeItems: "center" }}>
        <span style={{ fontSize: 96, opacity: 0.34, filter: "saturate(0.6)" }}>{emoji}</span>
        {badge && (
          <span style={{ position: "absolute", top: 14, right: 14, padding: "4px 10px", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 999, fontSize: 11, fontWeight: 500, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.1em", backdropFilter: "blur(6px)" }}>{badge}</span>
        )}
      </div>
      <div style={{ padding: "22px 24px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 28, lineHeight: 1.1, letterSpacing: "-0.01em", marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5, maxWidth: 360 }}>{sub}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 26, fontWeight: 600, lineHeight: 1 }}>{count}</span>
          <span style={{ fontSize: 11, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>lotes</span>
        </div>
      </div>
    </button>
  );
}

// ============================================================
// MY BIDS — list of active bids
// ============================================================
export function MyBidsScreen({ onOpenLot, lots = LOTS }) {
  // Simulated user bids
  const myBidIds = ["lot-mooca-studio", "lot-tatuape-studio", "car-corolla"];
  const myBids = lots.filter(l => myBidIds.includes(l.id)).map((lot, i) => ({
    ...lot,
    myBid: i === 0 ? lot.currentBid + 200 : i === 1 ? lot.currentBid - 1500 : lot.currentBid,
    status: i === 0 ? "winning" : i === 1 ? "outbid" : "winning",
    placedAt: ["há 2h", "há 14h", "há 1d"][i],
  }));

  const won = lots.filter(l => l.id === "lot-liberdade-kitnet").map(lot => ({ ...lot, myBid: 98500, wonAt: "há 3 dias" }));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 40px 80px", animation: "leiloe-fadein 0.3s ease" }}>
      <SectionHead
        overline="Meus lances"
        title="Acompanhe sua disputa."
        subtitle={`${myBids.length} leilões ativos · ${won.length} arremate na sua conta.`}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        <StatCard label="Lances ativos" value={myBids.length} tone="accent" />
        <StatCard label="Ganhando" value={myBids.filter(b => b.status === "winning").length} tone="success" />
        <StatCard label="Superado" value={myBids.filter(b => b.status === "outbid").length} tone="warning" />
        <StatCard label="Arremates" value={won.length} tone="accent" />
      </div>

      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-mute)", marginBottom: 12 }}>Em disputa</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {myBids.map(bid => (
            <BidRow key={bid.id} bid={bid} onOpenLot={onOpenLot} />
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-mute)", marginBottom: 12 }}>Arrematados</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {won.map(bid => (
            <BidRow key={bid.id} bid={{ ...bid, status: "won" }} onOpenLot={onOpenLot} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatCard({ label, value, tone, small }) {
  const tones = {
    accent:  { bg: "var(--accent-dim)", color: "var(--accent-ink)" },
    success: { bg: "var(--success-dim)", color: "var(--success-ink)" },
    warning: { bg: "rgba(255,192,122,0.12)", color: "var(--warning-ink)" },
  };
  const t = tones[tone] || tones.accent;
  return (
    <div style={{
      flex: 1, minWidth: 150, padding: "18px 22px",
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 16,
    }}>
      <div style={{ fontSize: 11.5, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: small ? "var(--mono)" : "var(--serif)", fontSize: small ? 22 : 34, fontWeight: small ? 600 : 400, lineHeight: 1, color: t.color }}>{value}</span>
      </div>
    </div>
  );
}

function BidRow({ bid, onOpenLot }) {
  const statusInfo = {
    winning: { label: "Ganhando", color: "var(--success-ink)", bg: "var(--success-dim)" },
    outbid:  { label: "Superado", color: "var(--hot-ink)", bg: "rgba(255,107,91,0.12)" },
    won:     { label: "Arrematado", color: "var(--accent-ink)", bg: "var(--accent-dim)" },
  }[bid.status];
  return (
    <button onClick={() => onOpenLot(bid)} style={{
      display: "grid", gridTemplateColumns: "120px 1fr auto auto auto", gap: 20, alignItems: "center",
      padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 14, cursor: "pointer", textAlign: "left", color: "inherit", width: "100%",
      transition: "border-color 0.15s ease",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-2)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{ width: 120, height: 80, borderRadius: 10, overflow: "hidden" }}>
        <LotPhoto lot={bid} height={80} rounded="0" showBadges={false} autoRotate />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.15, marginBottom: 2 }}>{bid.title}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-mute)" }}>
          {bid.category === "carro"
            ? `${bid.year} · ${bid.transmission} · ${fmtNum(bid.km)} km`
            : `${bid.address.split(" — ")[1] || ""} · ${bid.region}`}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 10.5, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Seu lance</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 600 }}>{fmtBRL(bid.myBid)}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 10.5, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{bid.status === "won" ? "Arrematado" : "Encerra"}</div>
        {bid.status === "won"
          ? <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{bid.wonAt}</div>
          : <Countdown endsAt={bid.endsAt} compact />}
      </div>
      <span style={{
        padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500,
        background: statusInfo.bg, color: statusInfo.color,
      }}>{statusInfo.label}</span>
    </button>
  );
}
