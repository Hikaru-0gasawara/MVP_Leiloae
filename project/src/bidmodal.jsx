// Bid modal — matches screenshot: photo + title + "Lance atual" header,
// suggested value, increment chips, cost breakdown with Taxa Leiloaê (1,5%),
// auto-bid toggle, "Primeiro lance protegido" banner, confirm CTA, WhatsApp link.

const { useState: useStateBM, useEffect: useEffectBM, useMemo: useMemoBM } = React;

function BidModal({ lot, open, onClose, onWin, isFirstBid = true, onSeeLot, suggestedValue }) {
  const [step, setStep] = useStateBM("input"); // input | confirm | success
  const [value, setValue] = useStateBM(0);
  const [autoBid, setAutoBid] = useStateBM(false);
  const [autoBidMax, setAutoBidMax] = useStateBM(0);

  useEffectBM(() => {
    if (lot && open) {
      setStep("input");
      const start = suggestedValue || (lot.currentBid + 1000);
      setValue(start);
      setAutoBid(false);
      setAutoBidMax(start + 5000);
    }
  }, [lot, open, suggestedValue]);

  // ESC to close
  useEffectBM(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !lot) return null;

  const breakdown = simulateCost(value);
  const isCarro = lot.category === "carro";
  const minValue = Math.max(lot.currentBid + 100, lot.minBid || 0);
  const isValid = value >= minValue;

  const incrementOptions = [
    { label: "+R$ 500",   amount: 500 },
    { label: "+R$ 1.000", amount: 1000 },
    { label: "+R$ 2.000", amount: 2000 },
    { label: "+R$ 5.000", amount: 5000 },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(8,6,12,0.74)", backdropFilter: "blur(8px)",
      display: "grid", placeItems: "center",
      padding: 24, animation: "leiloe-fadein 0.2s ease",
      overflowY: "auto",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        borderRadius: 24,
        width: "100%", maxWidth: 540,
        boxShadow: "0 40px 80px -16px rgba(0,0,0,0.6)",
        overflow: "hidden",
        animation: "leiloe-scalein 0.22s ease",
        margin: "auto",
      }}>
        {step === "input" && (
          <BidInputStep
            lot={lot}
            value={value} setValue={setValue}
            minValue={minValue} isValid={isValid}
            breakdown={breakdown}
            incrementOptions={incrementOptions}
            autoBid={autoBid} setAutoBid={setAutoBid}
            autoBidMax={autoBidMax} setAutoBidMax={setAutoBidMax}
            isFirstBid={isFirstBid}
            isCarro={isCarro}
            onClose={onClose}
            onContinue={() => setStep("confirm")}
            onSeeLot={onSeeLot}
          />
        )}
        {step === "confirm" && (
          <BidConfirmStep
            lot={lot} value={value} breakdown={breakdown}
            autoBid={autoBid} autoBidMax={autoBidMax}
            isFirstBid={isFirstBid}
            onBack={() => setStep("input")}
            onConfirm={() => setStep("success")}
            onClose={onClose}
          />
        )}
        {step === "success" && (
          <BidSuccessStep
            lot={lot} value={value} isFirstBid={isFirstBid}
            onClose={onClose}
            onWin={() => { onWin && onWin(lot, value); }}
          />
        )}
      </div>
    </div>
  );
}

function BidInputStep({ lot, value, setValue, minValue, isValid, breakdown, incrementOptions, autoBid, setAutoBid, autoBidMax, setAutoBidMax, isFirstBid, isCarro, onClose, onContinue, onSeeLot }) {
  const glyphs = { studio: "▢", apto: "◫", casa: "⌂", sedan: "🚗", hatch: "🚗", suv: "🚙" };
  return (
    <div>
      {/* Header: mini photo + title + "Ver página do item" */}
      <div style={{ padding: "20px 22px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 10, overflow: "hidden",
            background: lot.photo, position: "relative", flexShrink: 0,
            display: "grid", placeItems: "center",
            color: "rgba(255,255,255,0.42)",
          }}>
            <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 28, lineHeight: 1 }}>{glyphs[lot.glyph] || (isCarro ? "🚗" : "▢")}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lot.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 2 }}>Lance atual: <span style={{ fontFamily: "var(--mono)", color: "var(--text-dim)" }}>{fmtBRL(lot.currentBid)}</span></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {onSeeLot && (
            <button onClick={() => { onSeeLot(lot); onClose(); }} title="Ver página do item" style={{
              background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)",
              borderRadius: 999, padding: "7px 12px", fontSize: 12.5, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <Icon.arrowR size={12} /> Ver página
            </button>
          )}
          <button onClick={onClose} aria-label="Fechar" style={{ background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)", borderRadius: "50%", width: 32, height: 32, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <Icon.close size={14} />
          </button>
        </div>
      </div>

      {/* "Quanto você quer dar de lance?" */}
      <div style={{ padding: "22px 22px 0" }}>
        <div style={{ fontSize: 14, color: "var(--text)", marginBottom: 12, fontWeight: 500 }}>
          Quanto você quer dar de lance?
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "var(--bg-2)", border: `1px solid ${isValid ? "var(--border-2)" : "var(--danger)"}`,
          borderRadius: 14, padding: "14px 18px",
        }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 22, color: "var(--text-mute)" }}>R$</span>
          <input
            type="number"
            value={value || ""}
            onChange={(e) => setValue(Number(e.target.value) || 0)}
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "var(--text)", fontFamily: "var(--mono)", fontSize: 24, fontWeight: 600,
              flex: 1, minWidth: 0, letterSpacing: "-0.01em",
            }}
          />
        </div>
        {!isValid && (
          <div style={{ fontSize: 12, color: "var(--danger-ink)", marginTop: 8 }}>Mínimo: {fmtBRL(minValue)}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {incrementOptions.map(opt => (
            <button key={opt.amount} onClick={() => setValue(v => v + opt.amount)}
              style={{
                background: "transparent", color: "var(--text)",
                border: "1px solid var(--border-2)",
                borderRadius: 999, padding: "7px 14px",
                fontSize: 13, cursor: "pointer", fontFamily: "var(--mono)",
              }}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Cost breakdown */}
      <div style={{ margin: "20px 22px 0", padding: "18px 20px", background: "rgba(255,192,122,0.06)", border: "1px solid rgba(255,192,122,0.18)", borderRadius: 14 }}>
        <CostRow label="Seu lance" value={breakdown.lance} />
        <CostRow label={<>Comissão do <GlossaryTerm term="comissão do leiloeiro">leiloeiro</GlossaryTerm> (5%)</>} value={breakdown.comissao} />
        <CostRow label={<>Taxa Leiloaê (1,5%)</>} value={breakdown.taxa} />
        {!isCarro && <CostRow label={<><GlossaryTerm term="ITBI">ITBI</GlossaryTerm> estimado (3%)</>} value={breakdown.itbi} />}
        <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "10px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Custo total estimado</span>
          <span style={{ fontFamily: "var(--mono)", color: "var(--accent-ink)", fontWeight: 600, fontSize: 17 }}>
            {fmtBRL(isCarro ? (breakdown.total - breakdown.itbi) : breakdown.total)}
          </span>
        </div>
      </div>

      {/* First-bid protection */}
      {isFirstBid && (
        <div style={{ margin: "16px 22px 0", padding: "12px 14px", background: "var(--success-dim)", border: "1px solid rgba(123,224,176,0.25)", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ color: "var(--success-ink)", marginTop: 1 }}><Icon.shield size={16} /></span>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <span style={{ color: "var(--success-ink)", fontWeight: 500 }}>Primeiro lance protegido</span>
            <span style={{ color: "var(--text-dim)" }}> · 24h pra cancelar sem multa.</span>
          </div>
        </div>
      )}

      {/* Auto-bid */}
      <div style={{ margin: "14px 22px 0", padding: "14px 18px", border: "1px solid var(--border)", borderRadius: 14 }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer" }}>
          <span style={{ fontSize: 14 }}>Quer dar lances automaticamente até um teto?</span>
          <input type="checkbox" checked={autoBid} onChange={(e) => setAutoBid(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
        </label>
        {autoBid && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Teto:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 10px" }}>
              <span style={{ fontFamily: "var(--mono)", color: "var(--text-mute)", fontSize: 13 }}>R$</span>
              <input type="number" value={autoBidMax} onChange={(e) => setAutoBidMax(Number(e.target.value) || 0)}
                style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 14, width: 110 }} />
            </div>
          </div>
        )}
      </div>

      {/* Confirm CTA */}
      <div style={{ padding: "20px 22px 12px" }}>
        <button onClick={onContinue} disabled={!isValid} style={{
          width: "100%", padding: "16px 22px",
          background: isValid ? "var(--accent)" : "var(--surface-3)",
          color: isValid ? "#15101F" : "var(--text-mute)",
          border: "none", borderRadius: 14,
          fontSize: 15, fontWeight: 600, cursor: isValid ? "pointer" : "not-allowed",
          letterSpacing: "-0.005em",
        }}>
          Confirmar lance de {fmtBRL(value)}
        </button>
      </div>

      {/* Cancel + WhatsApp */}
      <div style={{ padding: "0 22px 22px", textAlign: "center" }}>
        <button onClick={onClose} style={{
          background: "transparent", border: "none",
          color: "var(--text-dim)", fontSize: 14, padding: "10px 16px",
          cursor: "pointer", fontWeight: 500,
        }}>Cancelar</button>
        <div>
          <a href="#" onClick={(e) => e.preventDefault()} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            color: "var(--accent-ink)", fontSize: 14, fontWeight: 500,
            padding: "6px 12px", textDecoration: "none",
          }}>
            <Icon.whatsapp size={16} /> Tirar dúvida no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function CostRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", gap: 12 }}>
      <span style={{ fontSize: 13.5, color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontSize: 14, fontFamily: "var(--mono)", color: "var(--text)", fontVariantNumeric: "tabular-nums", fontWeight: 500, whiteSpace: "nowrap" }}>
        {fmtBRL(value, false)}
      </span>
    </div>
  );
}

function BidConfirmStep({ lot, value, breakdown, autoBid, autoBidMax, isFirstBid, onBack, onConfirm, onClose }) {
  const [agree, setAgree] = useStateBM(false);
  return (
    <div>
      <div style={{ padding: "22px 26px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent-ink)", marginBottom: 6 }}>Confirmar lance</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 26, letterSpacing: "-0.01em" }}>Tem certeza?</div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "1px solid var(--border-2)", color: "var(--text-dim)", borderRadius: "50%", width: 32, height: 32, display: "grid", placeItems: "center", cursor: "pointer" }}>
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
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 0" }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--accent)", marginTop: 2 }} />
          <span style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>
            Li o <GlossaryTerm term="edital">edital</GlossaryTerm>, entendi as regras e quero seguir.
          </span>
        </label>
      </div>

      <div style={{ padding: "16px 26px 26px", display: "flex", gap: 10 }}>
        <Button variant="ghost" onClick={onBack} icon={<Icon.arrowL />}>Voltar</Button>
        <Button variant="primary" full disabled={!agree} onClick={onConfirm}>
          Confirmar lance
        </Button>
      </div>
    </div>
  );
}

function BidSuccessStep({ lot, value, isFirstBid, onClose, onWin }) {
  return (
    <div style={{ padding: "32px 32px 28px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "var(--success-dim)", color: "var(--success-ink)",
        margin: "0 auto 18px",
        display: "grid", placeItems: "center",
        animation: "leiloe-scalein 0.4s ease",
      }}>
        <Icon.check size={28} />
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 28, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
        Lance registrado.
      </div>
      <div style={{ color: "var(--text-dim)", marginTop: 8, fontSize: 14, lineHeight: 1.55, maxWidth: 380, marginInline: "auto" }}>
        Seu lance de <span style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>{fmtBRL(value)}</span> entra na disputa de <span style={{ color: "var(--text)" }}>{lot.title}</span>.
      </div>

      <div style={{ marginTop: 22, padding: "14px 16px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14, textAlign: "left" }}>
        <div style={{ fontSize: 12, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Próximos passos</div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          <li style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--text-dim)" }}>
            <span style={{ color: "var(--accent-ink)" }}>•</span> Você receberá notificação se for superado
          </li>
          <li style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--text-dim)" }}>
            <span style={{ color: "var(--accent-ink)" }}>•</span> Acompanhe em <span style={{ color: "var(--text)" }}>Meus lances</span>
          </li>
          {isFirstBid && (
            <li style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--text-dim)" }}>
              <span style={{ color: "var(--success-ink)" }}>•</span> Você ainda pode cancelar nas próximas 24h
            </li>
          )}
        </ul>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <Button variant="ghost" full onClick={onClose}>Voltar</Button>
        <Button variant="primary" full onClick={onWin}>Simular vitória →</Button>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 14 }}>
        💡 dica: "Simular vitória" leva à tela de arremate
      </div>
    </div>
  );
}

Object.assign(window, { BidModal });
