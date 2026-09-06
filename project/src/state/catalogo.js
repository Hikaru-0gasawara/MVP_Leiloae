// Uma interface, duas implementações (ARCH-001).
//
// As telas consomem sempre a mesma forma:
//
//   { lotes, meusLances, estado, erro, recarregar, sessao, acoes }
//
// Quem entrega isso é `useCatalogoServidor` (com back-end) ou
// `useCatalogoLocal` (modo demonstração, tudo no navegador). Nenhuma tela sabe
// qual está rodando — e é isso que permitiu ligar o servidor sem reescrever a
// interface, e permite continuar publicando a demonstração sem servidor.

import { useEffect, useMemo, useReducer, useState } from "react";
import { LOTS } from "../data.js";
import { userReducer, loadUserState, saveUserState, applyUserState, myBids } from "./userState.js";
import { api, assinarEventos, TEM_SERVIDOR, ErroDaApi } from "../api/client.js";
import { useResource } from "../api/resource.js";

// ---------------------------------------------------------------------------
// Modo demonstração: catálogo estático + estado no localStorage.
// ---------------------------------------------------------------------------
function useCatalogoLocal() {
  const [estadoUsuario, dispatch] = useReducer(userReducer, undefined, loadUserState);
  useEffect(() => { saveUserState(estadoUsuario); }, [estadoUsuario]);

  const lotes = useMemo(() => applyUserState(LOTS, estadoUsuario), [estadoUsuario]);
  const meusLances = useMemo(() => myBids(estadoUsuario, lotes), [estadoUsuario, lotes]);

  const acoes = useMemo(() => ({
    async alternarSalvo(lote) {
      dispatch({ type: "toggle-save", lotId: lote.id });
      return { ok: true };
    },
    async darLance({ lote, valor, teto }) {
      dispatch({ type: "place-bid", lot: lote, value: valor, autoMax: teto, now: Date.now() });
      return { ok: true };
    },
    async cancelarLance(lanceId) {
      dispatch({ type: "cancel-bid", bidId: lanceId, now: Date.now() });
      return { ok: true };
    },
  }), []);

  return {
    lotes,
    meusLances,
    estado: "pronto",
    erro: null,
    recarregar: () => {},
    // Sem servidor não há conta de verdade: a persona da demonstração entra
    // sempre, e a interface avisa que é demonstração (SEC-001).
    sessao: { usuario: { id: "demo", nome: "Camila", email: "camila@email.com" }, carregando: false, demo: true },
    acoes,
  };
}

// ---------------------------------------------------------------------------
// Modo servidor: catálogo, lances e favoritos vêm da API.
// ---------------------------------------------------------------------------
function useCatalogoServidor() {
  const sessao = useResource((s) => api.eu(s), { inicial: null });
  const usuario = sessao.dados?.usuario ?? null;

  const catalogo = useResource((s) => api.lotes(s), {});
  const salvos = useResource((s) => api.salvos(s), { deps: [usuario?.id], ativo: Boolean(usuario) });
  const lances = useResource((s) => api.meusLances(s), { deps: [usuario?.id], ativo: Boolean(usuario) });

  // Lotes que chegaram pelo fluxo de eventos, sobrepostos ao catálogo.
  const [aoVivo, setAoVivo] = useState({});
  useEffect(() => assinarEventos((lote) => {
    if (lote?.id) setAoVivo((atual) => ({ ...atual, [lote.id]: lote }));
  }), []);

  // Memoizado para não recriar a lista (e a dependência) a cada renderização.
  const idsSalvos = useMemo(() => salvos.dados?.salvos ?? [], [salvos.dados]);

  const lotes = useMemo(() => {
    const base = catalogo.dados?.lotes ?? [];
    return base.map((lote) => {
      const atualizado = aoVivo[lote.id] || lote;
      const salvo = idsSalvos.includes(lote.id);
      return salvo === Boolean(atualizado.saved) ? atualizado : { ...atualizado, saved: salvo };
    });
  }, [catalogo.dados, aoVivo, idsSalvos]);

  const meusLances = useMemo(() => {
    const brutos = lances.dados?.lances ?? [];
    const porId = new Map(lotes.map((l) => [l.id, l]));
    // O lote do lance vem do catálogo ao vivo quando existe: assim "Meus
    // lances" mostra o lance atual de agora, não o do momento do pedido.
    return brutos.map((e) => ({ ...e, lot: porId.get(e.bid.lotId) || e.lot }));
  }, [lances.dados, lotes]);

  const estado = catalogo.erro ? "erro" : catalogo.carregando ? "carregando" : "pronto";

  const acoes = useMemo(() => ({
    async alternarSalvo(lote) {
      if (!usuario) return { ok: false, erro: new ErroDaApi({ codigo: "nao-autenticado", status: 401 }) };
      // Atualização otimista: o clique responde na hora, e o servidor confirma.
      const antes = salvos.dados;
      salvos.definir({
        salvos: idsSalvos.includes(lote.id) ? idsSalvos.filter((i) => i !== lote.id) : [...idsSalvos, lote.id],
      });
      try {
        await api.alternarSalvo(lote.id);
        return { ok: true };
      } catch (e) {
        salvos.definir(antes); // desfaz: o servidor é quem manda
        return { ok: false, erro: e };
      }
    },

    async darLance({ lote, valor, teto }) {
      try {
        const r = await api.darLance(lote.id, { valor, teto });
        if (r.lote) setAoVivo((atual) => ({ ...atual, [r.lote.id]: r.lote }));
        lances.recarregar();
        return { ok: true, dados: r };
      } catch (e) {
        // O servidor recusou. Recarrega o lote para a tela mostrar o mínimo
        // de verdade em vez de insistir num valor que já ficou para trás.
        try {
          const { lote: atualizado } = await api.lote(lote.id);
          setAoVivo((atual) => ({ ...atual, [atualizado.id]: atualizado }));
        } catch { /* se nem isso responde, o erro já basta */ }
        return { ok: false, erro: e };
      }
    },

    async cancelarLance(lanceId) {
      try {
        const r = await api.cancelarLance(lanceId);
        lances.recarregar();
        if (r.loteId) {
          const { lote } = await api.lote(r.loteId);
          setAoVivo((atual) => ({ ...atual, [lote.id]: lote }));
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, erro: e };
      }
    },

    async entrar(dados) {
      try {
        await api.entrar(dados);
        sessao.recarregar();
        return { ok: true };
      } catch (e) { return { ok: false, erro: e }; }
    },
    async registrar(dados) {
      try {
        await api.registrar(dados);
        sessao.recarregar();
        return { ok: true };
      } catch (e) { return { ok: false, erro: e }; }
    },
    async sair() {
      try { await api.sair(); } catch { /* já pode estar sem sessão */ }
      sessao.definir({ usuario: null });
      lances.definir(null);
      salvos.definir(null);
      return { ok: true };
    },
  }), [usuario, salvos, lances, sessao, idsSalvos]);

  return {
    lotes,
    meusLances,
    estado,
    erro: catalogo.erro,
    recarregar: catalogo.recarregar,
    sessao: { usuario, carregando: sessao.carregando, demo: false },
    acoes,
  };
}

/** Escolhe a implementação pela configuração. */
export function useCatalogo() {
  // A escolha vem de uma constante de build: nunca muda entre renderizações,
  // então chamar hooks diferentes nos dois ramos é seguro.
  return TEM_SERVIDOR ? useCatalogoServidor() : useCatalogoLocal(); // eslint-disable-line react-hooks/rules-of-hooks
}
