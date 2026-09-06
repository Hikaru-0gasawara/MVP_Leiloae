// Entrar e criar conta (SEC-003).
//
// Existe só no modo servidor: sem back-end não há conta de verdade, e uma tela
// de login que aceita qualquer coisa seria exatamente o tipo de encenação que
// a auditoria apontou (SEC-001).
//
// A senha vai no corpo de um POST, nunca na URL; o campo tem `autoComplete`
// certo para o gerenciador de senhas do navegador funcionar; e o erro do
// servidor aparece como texto, não como alerta silencioso no console.

import { useState, useId } from "react";
import { Button } from "../components.jsx";

const campo = {
  background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 12,
  padding: "13px 16px", fontSize: 15, color: "var(--text)", outline: "none", width: "100%",
};
const rotulo = { fontSize: 12.5, color: "var(--text-mute)", display: "block", marginBottom: 6 };

export function TelaDeEntrada({ acoes, aoEntrar, aoVoltar }) {
  const [modo, setModo] = useState("entrar"); // entrar | criar | recuperar
  const [form, setForm] = useState({ nome: "", email: "", senha: "" });
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const ids = { nome: useId(), email: useId(), senha: useId() };
  const criando = modo === "criar";
  const recuperando = modo === "recuperar";
  const [enviado, setEnviado] = useState(false);

  const definir = (chave) => (e) => setForm((f) => ({ ...f, [chave]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = recuperando
      ? await acoes.recuperar(form.email)
      : criando
        ? await acoes.registrar(form)
        : await acoes.entrar(form);
    setEnviando(false);

    if (!r.ok) {
      setErro(r.erro?.mensagem || "Não foi possível continuar.");
      return;
    }
    if (recuperando) {
      // A confirmação é deliberadamente vaga: dizer "enviamos para essa conta"
      // revelaria quem tem conta a quem for perguntando um e-mail por vez.
      setEnviado(true);
      return;
    }
    setForm({ nome: "", email: "", senha: "" });
    aoEntrar?.();
  };

  if (recuperando && enviado) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "64px 32px 90px" }}>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 34, lineHeight: 1.05, margin: "0 0 10px", fontWeight: 400 }}>
          Verifique seu e-mail.
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }} role="status">
          Se existir uma conta com esse endereço, enviamos um link para redefinir a senha.
          Ele vale por 30 minutos e só pode ser usado uma vez.
        </p>
        <Button variant="ghost" onClick={() => { setModo("entrar"); setEnviado(false); }}>
          Voltar para entrar
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "64px 32px 90px" }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: 38, lineHeight: 1.05, margin: "0 0 8px", fontWeight: 400 }}>
        {recuperando ? "Recuperar acesso." : criando ? "Criar sua conta." : "Entrar na sua conta."}
      </h1>
      <p style={{ color: "var(--text-dim)", fontSize: 15, lineHeight: 1.6, margin: "0 0 28px" }}>
        {recuperando
          ? "Informe o e-mail da conta e enviamos um link para criar uma senha nova."
          : criando
            ? "Você precisa de uma conta para dar lances e salvar lotes."
            : "Seus lances e favoritos ficam guardados na sua conta."}
      </p>

      <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {criando && (
          <div>
            <label htmlFor={ids.nome} style={rotulo}>Nome</label>
            <input id={ids.nome} required value={form.nome} onChange={definir("nome")}
              autoComplete="name" placeholder="Como podemos te chamar" style={campo} />
          </div>
        )}
        <div>
          <label htmlFor={ids.email} style={rotulo}>E-mail</label>
          <input id={ids.email} required type="email" value={form.email} onChange={definir("email")}
            autoComplete="email" placeholder="voce@email.com" style={campo} />
        </div>
        {!recuperando && (
        <div>
          <label htmlFor={ids.senha} style={rotulo}>Senha</label>
          <input id={ids.senha} required type="password" value={form.senha} onChange={definir("senha")}
            autoComplete={criando ? "new-password" : "current-password"}
            minLength={criando ? 10 : undefined} style={campo} />
          {criando && (
            <div style={{ fontSize: 12.5, color: "var(--text-mute)", marginTop: 6 }}>
              Pelo menos 10 caracteres. Uma frase que só você lembra funciona melhor que símbolos.
            </div>
          )}
        </div>
        )}

        {erro && (
          <div role="alert" style={{
            fontSize: 13.5, color: "var(--danger-ink)", background: "rgba(255,133,133,0.12)",
            border: "1px solid rgba(255,133,133,0.3)", borderRadius: 10, padding: "10px 14px",
          }}>{erro}</div>
        )}

        <Button type="submit" full size="lg" disabled={enviando}>
          {enviando ? "Aguarde…" : recuperando ? "Enviar link" : criando ? "Criar conta" : "Entrar"}
        </Button>
      </form>

      <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <button type="button" onClick={() => { setModo(criando || recuperando ? "entrar" : "criar"); setErro(null); }}
          style={{ background: "none", border: "none", color: "var(--accent-ink)", fontSize: 13.5, cursor: "pointer", padding: 0 }}>
          {criando || recuperando ? "Já tenho conta" : "Criar uma conta"}
        </button>
        {!criando && !recuperando && (
          <button type="button" onClick={() => { setModo("recuperar"); setErro(null); }}
            style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 13.5, cursor: "pointer", padding: 0 }}>
            Esqueci minha senha
          </button>
        )}
        <button type="button" onClick={aoVoltar}
          style={{ background: "none", border: "none", color: "var(--text-mute)", fontSize: 13.5, cursor: "pointer", padding: 0 }}>
          Voltar aos leilões
        </button>
      </div>
    </div>
  );
}
