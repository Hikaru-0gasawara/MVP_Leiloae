// Diálogo acessível (FRONT-005).
//
// Antes os cinco overlays eram <div> sem semântica: sem role, sem aria-modal,
// sem armadilha de foco e sem devolução de foco. Medido na auditoria: ao abrir
// o modal de lance o foco continuava no fundo e 12 Tabs percorriam apenas
// elementos de fundo. Este componente centraliza o comportamento correto.

import { useEffect, useRef, useCallback } from "react";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Dialog({
  open,
  onClose,
  labelledBy,
  label,
  children,
  overlayStyle,
  panelStyle,
  closeOnOverlayClick = true,
  initialFocusRef,
}) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  const focusables = useCallback(
    () => Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) || []).filter((el) => el.offsetParent !== null || el === document.activeElement),
    []
  );

  // Guarda o gatilho, move o foco para dentro e devolve ao fechar.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const alvo = initialFocusRef?.current || focusables()[0] || panelRef.current;
    // rAF garante que o painel já está no DOM e visível.
    const raf = requestAnimationFrame(() => alvo?.focus?.());
    return () => {
      cancelAnimationFrame(raf);
      previouslyFocused.current?.focus?.();
    };
  }, [open, focusables, initialFocusRef]);

  // ESC fecha e Tab circula dentro do diálogo.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const itens = focusables();
      if (itens.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || !panelRef.current?.contains(ativo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && ativo === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose, focusables]);

  // Impede rolagem do fundo enquanto o diálogo está aberto.
  useEffect(() => {
    if (!open) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(8,6,12,0.74)", backdropFilter: "blur(8px)",
        display: "grid", placeItems: "center", padding: 24, overflowY: "auto",
        animation: "leiloe-fadein 0.2s ease",
        ...overlayStyle,
      }}
    >
      {/* Fechar clicando fora é um botão de verdade, não um div com onClick:
          assim a ação existe para teclado e leitores de tela. */}
      {closeOnOverlayClick && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          tabIndex={-1}
          style={{
            position: "fixed", inset: 0, width: "100%", height: "100%",
            background: "transparent", border: "none", cursor: "default", padding: 0,
          }}
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        style={{
          position: "relative",
          background: "var(--surface)",
          border: "1px solid var(--border-2)",
          borderRadius: 24,
          width: "100%", maxWidth: 540,
          boxShadow: "0 40px 80px -16px rgba(0,0,0,0.6)",
          overflow: "hidden", margin: "auto",
          animation: "leiloe-scalein 0.22s ease",
          ...panelStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Popover ancorado (menu da conta, painel de notificações): fecha com ESC e
 * clique fora, e devolve o foco ao gatilho.
 */
export function useDismissable({ open, onClose, ref }) {
  useEffect(() => {
    if (!open) return;
    const gatilho = document.activeElement;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") { onClose(); gatilho?.focus?.(); } };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, ref]);
}
