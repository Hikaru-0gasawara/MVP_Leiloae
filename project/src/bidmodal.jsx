// Modal de lance em três passos.
//
// Correções: recusa lance em leilão encerrado, inclusive se ele encerrar com o
// modal aberto (BIZ-002); incrementos derivados do lote (BIZ-010); linhas de
// custo vindas do domínio, com a Taxa Leiloaê visível (BIZ-007/BIZ-008);
// diálogo acessível (FRONT-005); e o lance passa a ser efetivamente registrado
// (BIZ-001).

import { useState, useId, useRef } from "react";
import {
  simulateCost, validateBid, minBidFor, incrementOptionsFor, isEnded, formatBRL as fmtBRL,
} from "./domain/auction.js";
import { useNow } from "./lib/clock.js";
import { CONTACT, hasWhatsApp, openExternal } from "./lib/config.js";
import { Icon, Button, GlossaryTerm } from "./components.jsx";
import { Dialog } from "./ui/Dialog.jsx";

export function BidModal({ lot, open, onClose, onConfirm, onWin, onSeeLot, onSeeMyBids, isFirstBid = true, suggestedValue }) {
  if (!open || !lot) return null;
  // A key remonta o fluxo a cada lote/sugestão: o estado inicial vem do próprio
  // useState, sem efeito sincronizando estado (evita renders em cascata).
  return (
    <BidFlow
      key={`${lot.id}:${suggestedValue ?? ""}`}
      lot={lot} onClose={onClose} onConfirm={onConfirm} onWin={onWin}
      onSeeLot={onSeeLot} onSeeMyBids={onSeeMyBids}
      isFirstBid={isFirstBid} suggestedValue={suggestedValue}
    />
  );
}

function BidFlow({ lot, onClose, onConfirm, onWin, onSeeLot, onSeeMyBids, isFirstBid, suggestedValue }) {
  const inicial = suggestedValue || minBidFor(lot);
  const [step, setStep] = useState("input");
  const [value, setValue] = useState(inicial);
  const [autoBid, setAutoBid] = useState(false);
  const [autoBidMax, setAutoBidMax] = useState(inicial + minBidFor(lot) - lot.currentBid);
  const [confirmedValue, setConfirmedValue] = useState(0);
  const titleId = useId();
  const inputRef = useRef(null);
  const now = useNow();

  const ended = isEnded(lot, now);
  const check = validateBid(lot, value, now);
  const breakdown = simulateCost(value, lot.category);

  const registrar = () => {
    // Revalida no instante da confirmação: o leilão pode ter encerrado
    // enquanto o modal estava aberto.
    const final = validateBid(lot, value, Date.now());
    if (!final.ok) {
      setStep("input");
      window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: final.message }));
      return;
    }
    onConfirm?.({ lot, value, autoMax: autoBid ? autoBidMax : null });
    setConfirmedValue(value);
    setStep("success");
  };

  return (
    <Dialog open onClose={onClose} labelledBy={titleId} initialFocusRef={step === "input" ? inputRef : undefined}>
      {ended ? (
        <EndedStep lot={lot} titleId={titleId} onClose={onClose} onSeeLot={onSeeLot} />
      ) : step === "input" ? (
        <BidInputStep
          lot={lot} titleId={titleId} inputRef={inputRef}
          value={value} setValue={setValue}
          check={check} breakdown={breakdown}
          incrementOptions={incrementOptionsFor(lot)}
          autoBid={autoBid} setAutoBid={setAutoBid}
          autoBidMax={autoBidMax} setAutoBidMax={setAutoBidMax}
          isFirstBid={isFirstBid}
          onClose={onClose} onContinue={() => setStep("confirm")} onSeeLot={onSeeLot}
        />
      ) : step === "confirm" ? (
        <BidConfirmStep
          lot={lot} titleId={titleId} value={value} breakdown={breakdown}
          autoBid={autoBid} autoBidMax={autoBidMax} isFirstBid={isFirstBid}
          onBack={() => setStep("input")} onConfirm={registrar} onClose={onClose}
        />
      ) : (
        <BidSuccessStep
          lot={lot} titleId={titleId} value={confirmedValue} isFirstBid={isFirstBid}
          onClose={onClose} onSeeMyBids={onSeeMyBids}
          onWin={() => onWin?.(lot, confirmedValue)}
        />
      )}
    </Dialog>
  );
}

function ModalHeader({ lot, titleId, subtitle, onClose, onSeeLot }) {
  const glyphs = { studio: "▢", apto: "◫", casa: "⌂", sedan: "🚗", hatch: "🚗", suv: "🚙" };
  return (
    <div style={{ padding: "20px 22px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0 }}>
        <div aria-hidden="true" style={{
          width: 60, height: 60, borderRadius: 10, overflow: "hidden", background: lot.photo,
          position: "relative", flexShrink: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.42)",
        }}>
          <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28, lineHeight: 1 }}>
            {glyphs[lot.glyph] || (lot.category === "carro" ? "🚗" : "▢")}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 id={titleId} style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 22, fontWeight: 400, lineHeight: 1.15, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {lot.title}
          </h2>
          <div style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {onSeeLot && (
          <button type="button" onClick={() => { onSeeLot(lot); onClose(); }} style={{
            background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)",
            borderRadius: 999, padding: "7px 12px", fontSize: 12.5, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <Icon.arrowR size={12} /> Ver página
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Fechar" style={{
          background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)",
          borderRadius: "50%", width: 32, height: 32, display: "grid", placeItems: "center", cursor: "pointer",
        }}>
          <Icon.close size={14} />
        </button>
      </div>
    </div>
  );
}

/** Leilão encerrado: nenhum caminho leva a um lance (BIZ-002). */
function EndedStep({ lot, titleId, onClose, onSeeLot }) {
  return (
    <div>
      <ModalHeader lot={lot} titleId={titleId} subtitle="Leilão encerrado" onClose={onClose} onSeeLot={onSeeLot} />
      <div style={{ padding: "24px 22px 8px" }}>
        <div role="status" style={{
          padding: "16px 18px", borderRadius: 14, background: "var(--surface-2)",
          border: "1px solid var(--border-2)", fontSize: 14.5, lineHeight: 1.6, color: "var(--text-dim)",
        }}>
          <b style={{ color: "var(--text)" }}>Este leilão já encerrou.</b> Não é possível dar lances
          depois do prazo — é o que garante a validade do arremate de quem participou dentro dele.
        </div>
      </div>
      <div style={{ padding: "16px 22px 24px", display: "flex", gap: 10 }}>
        <Button variant="ghost" full onClick={onClose}>Fechar</Button>
        {onSeeLot && <Button variant="primary" full onClick={() => { onSeeLot(lot); onClose(); }}>Ver detalhes do lote</Button>}
      </div>
    </div>
  );
}

function BidInputStep({ lot, titleId, inputRef, value, setValue, check, breakdown, incrementOptions, autoBid, setAutoBid, autoBidMax, setAutoBidMax, isFirstBid, onClose, onContinue, onSeeLot }) {
  const inputId = useId();
  const errId = useId();
  const autoId = useId();
  const tetoId = useId();

  return (
    <div>
      <ModalHeader lot={lot} titleId={titleId} subtitle={<>Lance atual: <span style={{ fontFamily: "var(--mono)", color: "var(--text-dim)" }}>{fmtBRL(lot.currentBid)}</span></>} onClose={onClose} onSeeLot={onSeeLot} />

      <div style={{ padding: "22px 22px 0" }}>
        <label htmlFor={inputId} style={{ display: "block", fontSize: 14, color: "var(--text)", marginBottom: 12, fontWeight: 500 }}>
          Quanto você quer dar de lance?
        </label>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "var(--bg-2)", border: `1px solid ${check.ok ? "var(--border-2)" : "var(--danger)"}`,
          borderRadius: 14, padding: "14px 18px",
        }}>
          <span aria-hidden="true" style={{ fontFamily: "var(--mono)", fontSize: 22, color: "var(--text-mute)" }}>R$</span>
          <input
            id={inputId}
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={minBidFor(lot)}
            step={1}
            value={value || ""}
            onChange={(e) => setValue(Number(e.target.value) || 0)}
            aria-describedby={check.ok ? undefined : errId}
            aria-invalid={!check.ok}
            style={{
              background: "transparent", border: "none", outline: "none", color: "var(--text)",
              fontFamily: "var(--mono)", fontSize: 24, fontWeight: 600, flex: 1, minWidth: 0, letterSpacing: "-0.01em",
            }}
          />
        </div>
        {!check.ok && (
          <div id={errId} role="alert" style={{ fontSize: 12.5, color: "var(--danger-ink)", marginTop: 8 }}>
            {check.message}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {incrementOptions.map((amount) => (
            <button key={amount} type="button" onClick={() => setValue((v) => (Number(v) || lot.currentBid) + amount)}
              style={{
                background: "transparent", color: "var(--text)", border: "1px solid var(--border-2)",
                borderRadius: 999, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontFamily: "var(--mono)",
              }}>+{fmtBRL(amount)}</button>
          ))}
        </div>
      </div>

      {/* Todas as linhas vêm do domínio: nenhuma tela pode omitir uma linha que outra mostra. */}
      <div style={{ margin: "20px 22px 0", padding: "18px 20px", background: "rgba(255,192,122,0.06)", border: "1px solid rgba(255,192,122,0.18)", borderRadius: 14 }}>
        {breakdown.lines.map((line) => (
          <CostRow key={line.key} label={
            line.key === "comissao" ? <>Comissão do <GlossaryTerm term="comissão do leiloeiro">leiloeiro</GlossaryTerm> (5%)</>
            : line.key === "itbi" ? <><GlossaryTerm term="ITBI">ITBI</GlossaryTerm> estimado (3%)</>
            : line.label
          } value={line.value} />
        ))}
        <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "10px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Custo total estimado</span>
          <span style={{ fontFamily: "var(--mono)", color: "var(--accent-ink)", fontWeight: 600, fontSize: 17 }}>
            {fmtBRL(breakdown.total)}
          </span>
        </div>
      </div>

      {isFirstBid && (
        <div style={{ margin: "16px 22px 0", padding: "12px 14px", background: "var(--success-dim)", border: "1px solid rgba(123,224,176,0.25)", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ color: "var(--success-ink)", marginTop: 1 }}><Icon.shield size={16} /></span>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ color: "var(--success-ink)", fontWeight: 500 }}>Primeiro lance protegido</span>
            <span style={{ color: "var(--text-dim)" }}> · você pode cancelar em até 24h, em Meus lances.</span>
          </div>
        </div>
      )}

      <div style={{ margin: "14px 22px 0", padding: "14px 18px", border: "1px solid var(--border)", borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <label htmlFor={autoId} style={{ fontSize: 14, cursor: "pointer" }}>Quer dar lances automaticamente até um teto?</label>
          <input id={autoId} type="checkbox" checked={autoBid} onChange={(e) => setAutoBid(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
        </div>
        {autoBid && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <label htmlFor={tetoId} style={{ fontSize: 13, color: "var(--text-dim)" }}>Teto:</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 10px" }}>
              <span aria-hidden="true" style={{ fontFamily: "var(--mono)", color: "var(--text-mute)", fontSize: 13 }}>R$</span>
              <input id={tetoId} type="number" min={value} value={autoBidMax} onChange={(e) => setAutoBidMax(Number(e.target.value) || 0)}
                style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 14, width: 110 }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "20px 22px 12px" }}>
        <button type="button" onClick={onContinue} disabled={!check.ok} style={{
          width: "100%", padding: "16px 22px",
          background: check.ok ? "var(--accent)" : "var(--surface-3)",
          color: check.ok ? "#15101F" : "var(--text-mute)",
          border: "none", borderRadius: 14, fontSize: 15, fontWeight: 600,
          cursor: check.ok ? "pointer" : "not-allowed", letterSpacing: "-0.005em",
        }}>
          Confirmar lance de {fmtBRL(value)}
        </button>
      </div>

      <div style={{ padding: "0 22px 22px", textAlign: "center" }}>
        <button type="button" onClick={onClose} style={{
          background: "transparent", border: "none", color: "var(--text-dim)",
          fontSize: 14, padding: "10px 16px", cursor: "pointer", fontWeight: 500,
        }}>Cancelar</button>
        {hasWhatsApp() && (
          <div>
            <button type="button" onClick={() => openExternal(CONTACT.whatsappUrl)} style={{
              display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none",
              color: "var(--accent-ink)", fontSize: 14, fontWeight: 500, padding: "6px 12px", cursor: "pointer",
            }}>
              <Icon.whatsapp size={16} /> Tirar dúvida no WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CostRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", gap: 12 }}>
      <span style={{ fontSize: 13.5, color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontSize: 14, fontFamily: "var(--mono)", color: "var(--text)", fontVariantNumeric: "tabular-nums", fontWeight: 500, whiteSpace: "nowrap" }}>
        {fmtBRL(value)}
      </span>
    </div>
  );
}

function BidConfirmStep({ lot, titleId, value, breakdown, autoBid, autoBidMax, isFirstBid, onBack, onConfirm, onClose }) {
  const [agree, setAgree] = useState(false);
  const agreeId = useId();
  return (
    <div>
      <div style={{ padding: "22px 26px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent-ink)", marginBottom: 6 }}>Confirmar lance</div>
          <h2 id={titleId} style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.01em" }}>Tem certeza?</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)", borderRadius: "50%", width: 32, height: 32, display: "grid", placeItems: "center", cursor: "pointer" }}>
          <Icon.close size={14} />
        </button>
      </div>

      <div style={{ margin: "20px 26px 0", padding: "22px 22px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 16 }}>
        <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
          Você está prestes a se comprometer com um lance de
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 36, fontWeight: 600, color: "var(--text)", margin: "8px 0", letterSpacing: "-0.02em" }}>
          {fmtBRL(value)}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
          em <span style={{ color: "var(--text)" }}>{lot.title}</span>.
        </div>
        <div style={{ height: 1, background: "var(--border)", margin: "16px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "var(--text-dim)" }}>Custo total estimado (com taxas)</span>
          <span style={{ fontFamily: "var(--mono)", color: "var(--accent-ink)", fontWeight: 600 }}>{fmtBRL(breakdown.total, true)}</span>
        </div>
        {autoBid && (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--text-dim)" }}>Lance automático até</span>
            <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{fmtBRL(autoBidMax)}</span>
          </div>
        )}
      </div>

      {isFirstBid && (
        <div style={{ margin: "16px 26px 0", padding: "12px 16px", background: "var(--success-dim)", border: "1px solid rgba(123,224,176,0.25)", borderRadius: 12, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>
          <span style={{ color: "var(--success-ink)", fontWeight: 500 }}><Icon.shield size={14} /> Janela de 24h</span> pra cancelar esse lance. Sem multa.
        </div>
      )}

      <div style={{ margin: "16px 26px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0" }}>
          <input id={agreeId} type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--accent)", marginTop: 2 }} />
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>
            {/* O termo do glossário fica FORA do label: dentro dele, clicar para
                ler a definição também marcaria a concordância. */}
            <label htmlFor={agreeId} style={{ cursor: "pointer" }}>
              Li o edital, entendi as regras e quero seguir.
            </label>{" "}
            <GlossaryTerm term="edital">o que é o edital?</GlossaryTerm>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 26px 26px", display: "flex", gap: 10 }}>
        <Button variant="ghost" onClick={onBack} icon={<Icon.arrowL />}>Voltar</Button>
        <Button variant="primary" full disabled={!agree} onClick={onConfirm}>Confirmar lance</Button>
      </div>
    </div>
  );
}

function BidSuccessStep({ lot, titleId, value, isFirstBid, onClose, onWin, onSeeMyBids }) {
  return (
    <div style={{ padding: "32px 32px 28px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div aria-hidden="true" style={{
        width: 64, height: 64, borderRadius: "50%", background: "var(--success-dim)", color: "var(--success-ink)",
        margin: "0 auto 18px", display: "grid", placeItems: "center", animation: "leiloe-scalein 0.4s ease",
      }}>
        <Icon.check size={28} />
      </div>
      <h2 id={titleId} style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
        Lance registrado.
      </h2>
      <div role="status" style={{ color: "var(--text-dim)", marginTop: 8, fontSize: 14, lineHeight: 1.55, maxWidth: 380, marginInline: "auto" }}>
        Seu lance de <span style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>{fmtBRL(value)}</span> entrou na disputa de <span style={{ color: "var(--text)" }}>{lot.title}</span>.
      </div>

      <div style={{ marginTop: 22, padding: "14px 16px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14, textAlign: "left" }}>
        <div style={{ fontSize: 12, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Próximos passos</div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          <li style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--text-dim)" }}>
            <span aria-hidden="true" style={{ color: "var(--accent-ink)" }}>•</span> Acompanhe em <span style={{ color: "var(--text)" }}>Meus lances</span>
          </li>
          {isFirstBid && (
            <li style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--text-dim)" }}>
              <span aria-hidden="true" style={{ color: "var(--success-ink)" }}>•</span> Você pode cancelar este lance nas próximas 24h
            </li>
          )}
        </ul>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <Button variant="ghost" full onClick={() => { onSeeMyBids?.(); onClose(); }}>Ver meus lances</Button>
        <Button variant="primary" full onClick={onWin}>Simular vitória →</Button>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 14 }}>
        Demonstração: “Simular vitória” abre a tela de arremate.
      </div>
    </div>
  );
}
