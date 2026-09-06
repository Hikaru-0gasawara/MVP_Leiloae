// Camada de dados: carregando, erro, vazio e recarregar (ARCH-001/FRONT-010).
//
// A auditoria pedia React Query. Um cliente com sete endpoints e atualização
// por eventos do servidor não precisa de cache genérico, invalidação por chave
// nem `stale-while-revalidate`: precisa de três estados explícitos e um
// recarregar. São ~80 linhas testáveis contra ~13 kB de dependência, então
// aqui está o hook em vez da biblioteca.
//
// O que ele garante, e que era o defeito real (FRONT-010: nenhuma tela tinha
// estado de carregamento ou de erro):
//  · nunca fica preso em "carregando" quando a promessa rejeita;
//  · resposta de pedido antigo não sobrescreve a de um mais novo;
//  · desmontar cancela o pedido em voo.
//
// O `carregando` é ajustado DURANTE a renderização quando a chave muda, não
// dentro do efeito: assim a primeira renderização após uma troca de parâmetro
// já sai como "carregando", sem um quadro intermediário mostrando dado velho.

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * @template T
 * @param {(sinal: AbortSignal) => Promise<T>} buscar
 * @param {{deps?: unknown[], ativo?: boolean, inicial?: T|null}} [opcoes]
 * @returns {{dados: T|null, carregando: boolean, erro: Error|null, recarregar: () => void, definir: (v:T|null)=>void}}
 */
export function useResource(buscar, { deps = [], ativo = true, inicial = null } = {}) {
  const [gatilho, setGatilho] = useState(0);
  const chave = JSON.stringify([ativo, gatilho, ...deps]);

  const [estado, setEstado] = useState({ chave, dados: inicial, erro: null, pronto: !ativo });

  // Ajuste de estado durante a renderização: o padrão recomendado do React
  // para "os parâmetros mudaram, o que eu tinha não vale mais".
  if (estado.chave !== chave) {
    setEstado({ chave, dados: inicial, erro: null, pronto: !ativo });
  }

  const sequencia = useRef(0);

  useEffect(() => {
    if (!ativo) return undefined;
    const meu = ++sequencia.current;
    const controlador = new AbortController();

    buscar(controlador.signal).then(
      (resultado) => {
        if (meu !== sequencia.current) return; // resposta atrasada: descartada
        setEstado({ chave, dados: resultado, erro: null, pronto: true });
      },
      (e) => {
        if (e?.name === "AbortError" || meu !== sequencia.current) return;
        setEstado({ chave, dados: null, erro: e, pronto: true });
      }
    );

    return () => controlador.abort();
    // `buscar` é recriado a cada renderização; `chave` já resume as dependências reais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, ativo]);

  const recarregar = useCallback(() => setGatilho((n) => n + 1), []);
  const definir = useCallback(
    (valor) => setEstado((atual) => ({ ...atual, dados: valor, erro: null, pronto: true })),
    []
  );

  const atual = estado.chave === chave ? estado : { dados: inicial, erro: null, pronto: !ativo };
  return {
    dados: atual.dados,
    erro: atual.erro,
    carregando: ativo && !atual.pronto,
    recarregar,
    definir,
  };
}

/**
 * Ação que escreve no servidor. Devolve o estado de envio e o erro, para que o
 * botão possa se desabilitar e a tela possa explicar o que houve — em vez de
 * a interface fingir sucesso, que era o padrão antes (SEC-002/BIZ-001).
 */
export function useMutation(executar) {
  const [estado, setEstado] = useState({ enviando: false, erro: null });
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const disparar = useCallback(async (...args) => {
    setEstado({ enviando: true, erro: null });
    try {
      const r = await executar(...args);
      if (vivo.current) setEstado({ enviando: false, erro: null });
      return { ok: true, dados: r };
    } catch (e) {
      if (vivo.current) setEstado({ enviando: false, erro: e });
      return { ok: false, erro: e };
    }
  }, [executar]);

  const limparErro = useCallback(() => setEstado((a) => ({ ...a, erro: null })), []);
  return { disparar, enviando: estado.enviando, erro: estado.erro, limparErro };
}
