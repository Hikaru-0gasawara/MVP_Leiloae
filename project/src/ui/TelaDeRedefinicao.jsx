// Tela do link de recuperação: /redefinir?token=…
//
// O token vem na query porque é assim que um link de e-mail funciona. Duas
// consequências tratadas aqui:
//
//  · Ele é apagado da barra de endereços assim que a tela monta. Sem isso, o
//    token fica no histórico do navegador e vaza no `Referer` de qualquer link
//    que a pessoa clique em seguida.
//  · Ele nunca é enviado de novo depois de usado: a tela troca para o estado
//    de sucesso e o campo some.

import { useState, useEffect, useId } from "react";
import { Button } from "../components.jsx";

const campo = {
  background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 12,
  padding: "13px 16px", fontSize: 15, color: "var(--text)", outline: "none", width: "100%",
};
const rotulo = { fontSize: 12.5, color: "var(--text-mute)", display: "block", marginBottom: 6 };

export function TelaDeRedefinicao({ acoes, aoConcluir, aoVoltar }) {
  // Lido uma vez, na montagem — antes de o efeito abaixo limpar a URL.
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") || "");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const senhaId = useId();

  useEffect(() => {
    // Tira o token da barra de endereços sem recarregar nem sujar o histórico.
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const enviar = async (e) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await acoes.redefinir({ token: token, senha });
    setEnviando(false);
    setSenha("");
    if (r.ok) setPronto(true);
    else setErro(r.erro?.mensagem || "Não foi possível redefinir a senha.");
  };

  if (!token) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "64px 32px 90px" }}>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 34, lineHeight: 1.05, margin: "0 0 10px", fontWeight: 400 }}>
          Link incompleto.
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }}>
          Este endereço não traz um link de redefinição válido. Peça um novo na tela de entrada.
        </p>
        <Button onClick={aoVoltar}>Ir para entrar</Button>
      </div>
    );
  }

  if (pronto) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "64px 32px 90px" }}>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 34, lineHeight: 1.05, margin: "0 0 10px", fontWeight: 400 }}>
          Senha alterada.
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }} role="status">
          Por segurança, todas as sessões abertas foram encerradas — inclusive em outros
          aparelhos. Entre de novo com a senha nova.
        </p>
        <Button onClick={aoConcluir}>Entrar</Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "64px 32px 90px" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 38, lineHeight: 1.05, margin: "0 0 8px", fontWeight: 400 }}>
        Criar uma senha nova.
      </h1>
      <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, margin: "0 0 28px" }}>
        Escolha uma senha que você lembre. Ao confirmar, todas as sessões abertas nesta
        conta serão encerradas.
      </p>

      <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label htmlFor={senhaId} style={rotulo}>Nova senha</label>
          <input
            id={senhaId} type="password" required minLength={10}
            value={senha} onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password" style={campo}
          />
          <div style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 6 }}>
            Pelo menos 10 caracteres.
          </div>
        </div>

        {erro && (
          <div role="alert" style={{
            fontSize: 13.5, color: "var(--danger-ink)", background: "rgba(255,133,133,0.12)",
            border: "1px solid rgba(255,133,133,0.3)", borderRadius: 10, padding: "10px 14px",
          }}>{erro}</div>
        )}

        <Button type="submit" full size="lg" disabled={enviando}>
          {enviando ? "Aguarde…" : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
