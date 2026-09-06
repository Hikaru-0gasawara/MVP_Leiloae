// Tela do link de confirmação de e-mail: /verificar?token=…
//
// Mesmas duas precauções da tela de redefinição, pelos mesmos motivos:
//
//  · O token sai da barra de endereços assim que a tela monta. Senão fica no
//    histórico do navegador e vaza no `Referer` do próximo clique.
//  · Ele é consumido UMA vez. O efeito roda na montagem e não depende de a
//    pessoa apertar nada: o link do e-mail já é a confirmação.

import { useState, useEffect, useRef } from "react";
import { Button } from "../components.jsx";

export function TelaDeVerificacao({ acoes, aoConcluir, aoVoltar }) {
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") || "");
  const [estado, setEstado] = useState(token ? "confirmando" : "sem-token");
  const [erro, setErro] = useState(null);
  // O React 18 monta duas vezes em desenvolvimento (StrictMode); sem esta
  // trava o token de uso único seria gasto na primeira montagem e a segunda
  // mostraria "link já usado" para quem acabou de clicar.
  const jaTentou = useRef(false);

  useEffect(() => {
    if (window.location.search) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!token || jaTentou.current) return;
    jaTentou.current = true;
    // Sem cancelamento no desmonte, de propósito. `acoes` é recriado quando a
    // sessão recarrega, e o efeito com limpeza chegava a rodar assim: a
    // primeira execução era descartada no meio do pedido e a segunda não
    // acontecia (a trava de uso único já estava fechada). Resultado: a tela
    // ficava em "Confirmando…" para sempre. O pedido é um só, e escrever o
    // estado depois de desmontar não custa nada no React 18.
    (async () => {
      const r = await acoes.verificarEmail(token);
      if (r.ok) setEstado("pronto");
      else {
        setErro(r.erro?.mensagem || "Não foi possível confirmar este endereço.");
        setEstado("falhou");
      }
    })();
  }, [token, acoes]);

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "64px 32px 90px" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 34, lineHeight: 1.05, margin: "0 0 10px", fontWeight: 400 }}>
        {estado === "pronto" ? "E-mail confirmado." : estado === "confirmando" ? "Confirmando…" : "Link inválido."}
      </h1>
      <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }} aria-live="polite">
        {estado === "pronto" &&
          "Pronto. Agora a gente consegue falar com você — inclusive se um dia precisar recuperar a senha."}
        {estado === "confirmando" && "Só um instante."}
        {estado === "sem-token" &&
          "Este endereço não traz um link de confirmação. Peça um novo pelo aviso no topo do site."}
        {estado === "falhou" && erro}
      </p>
      {estado !== "confirmando" && (
        <Button onClick={estado === "pronto" ? aoConcluir : aoVoltar}>
          {estado === "pronto" ? "Ver leilões" : "Voltar"}
        </Button>
      )}
    </div>
  );
}

/**
 * Faixa de "confirme seu e-mail".
 *
 * Fica visível enquanto o endereço não foi confirmado, e não bloqueia nada: a
 * conta funciona sem verificação de propósito (ver server/auth.js). O que ela
 * resolve é o defeito registrado em docs/api.md — um endereço digitado errado
 * só aparecia quando a pessoa tentava recuperar a senha, já trancada para fora.
 */
export function AvisoDeEmailNaoVerificado({ usuario, acoes }) {
  const [estado, setEstado] = useState("parado"); // parado | enviando | enviado | falhou
  const [mensagem, setMensagem] = useState("");

  if (!usuario || usuario.emailVerificado !== false) return null;

  const reenviar = async () => {
    setEstado("enviando");
    const r = await acoes.reenviarVerificacao();
    if (r.ok) {
      setEstado("enviado");
      setMensagem(`Link enviado para ${usuario.email}.`);
    } else {
      setEstado("falhou");
      setMensagem(r.erro?.mensagem || "Não foi possível enviar agora.");
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap",
      padding: "10px 20px", fontSize: 13.5,
      background: "var(--warning-dim, rgba(255,192,122,0.12))",
      color: "var(--warning-ink)",
      borderBottom: "1px solid rgba(255,192,122,0.25)",
    }}>
      <span>
        <strong style={{ fontWeight: 600 }}>Falta confirmar seu e-mail.</strong>{" "}
        Sua conta já funciona; a confirmação é o que garante que a gente consegue te achar depois.
      </span>
      {estado === "enviando" || estado === "parado" ? (
        <button
          type="button"
          onClick={reenviar}
          disabled={estado === "enviando"}
          style={{
            background: "transparent", border: "1px solid currentColor", borderRadius: 999,
            color: "inherit", padding: "4px 12px", fontSize: 12.5,
            cursor: estado === "enviando" ? "default" : "pointer",
          }}
        >{estado === "enviando" ? "Enviando…" : "Reenviar link"}</button>
      ) : (
        <span aria-live="polite">{mensagem}</span>
      )}
    </div>
  );
}
