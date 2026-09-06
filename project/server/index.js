// Servidor HTTP (BACK-001 / DEVOPS-001).
//
// `node:http` puro: a API tem uma dúzia de rotas e um roteador de trinta
// linhas resolve, sem somar uma dependência à superfície de auditoria.
//
// Também serve o `dist/` com os mesmos cabeçalhos de segurança de
// public/_headers, para que desenvolvimento e produção não divirjam.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { extname, join, normalize, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { abrirBanco, semear } from "./db.js";
import { criarRotas } from "./routes.js";
import { limparSessoesExpiradas, limparRecuperacoes, limparVerificacoes } from "./auth.js";
import { criarLimitador } from "./ratelimit.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
// O build de servidor sai em dist-servidor (aponta para a API); o de
// demonstração fica em dist. Servimos o primeiro quando existe.
const DIST_SERVIDOR = join(RAIZ, "dist-servidor");
const DIST = existsSync(DIST_SERVIDOR) ? DIST_SERVIDOR : join(RAIZ, "dist");

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon",
};

/** Os mesmos cabeçalhos de public/_headers, aplicados também em dev. */
function cabecalhosSeguranca(res, { seguro }) {
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https://images.unsplash.com; " +
    "style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; " +
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=()");
  if (seguro) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

/**
 * Cria o servidor.
 * @param {{db?: any, servirEstaticos?: boolean, seguro?: boolean,
 *          atrasDeProxy?: boolean, limitador?: any, urlBase?: string}} opcoes
 */
export function criarServidor(opcoes = {}) {
  const db = opcoes.db || abrirBanco();
  semear(db);
  limparSessoesExpiradas(db);

  const seguro = opcoes.seguro ?? process.env.NODE_ENV === "production";
  const servirEstaticos = opcoes.servirEstaticos ?? true;

  // Assinantes de eventos ao vivo (BIZ-004).
  const ouvintes = new Set();
  const publicar = (evento, dados) => {
    const bloco = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
    for (const res of ouvintes) {
      try { res.write(bloco); } catch { ouvintes.delete(res); }
    }
  };

  const limitador = opcoes.limitador || criarLimitador();
  const despachar = criarRotas({
    db,
    seguro,
    atrasDeProxy: opcoes.atrasDeProxy ?? process.env.LEILOAE_ATRAS_DE_PROXY === "1",
    urlBase: opcoes.urlBase ?? process.env.LEILOAE_URL_BASE ?? "",
    limitador,
    aoMudarLote: (lote) => lote && publicar("lote", lote),
  });

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    const caminho = decodeURIComponent(url.pathname);
    cabecalhosSeguranca(res, { seguro });

    // ---- eventos ao vivo --------------------------------------------------
    if (caminho === "/api/v1/eventos") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      res.write("retry: 3000\n\n");
      ouvintes.add(res);
      const pulso = setInterval(() => { try { res.write(": pulso\n\n"); } catch { /* fechado */ } }, 25000);
      req.on("close", () => { clearInterval(pulso); ouvintes.delete(res); });
      return;
    }

    // ---- API --------------------------------------------------------------
    try {
      const resultado = await despachar(req, caminho, url.searchParams);
      if (resultado) {
        const { status = 200, corpo, cookie, cabecalhos } = resultado;
        if (cookie) res.setHeader("Set-Cookie", cookie);
        for (const [k, v] of Object.entries(cabecalhos || {})) res.setHeader(k, String(v));
        res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify(corpo));
        return;
      }
    } catch (/** @type {any} */ e) {
      const status = e?.status || 500;
      if (status >= 500) console.error("[Leiloaê] erro na API:", e);
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      // Mensagem genérica no 500: detalhe de exceção não vai para o cliente.
      res.end(JSON.stringify({
        erro: e?.codigo || (status >= 500 ? "erro-interno" : e?.message),
        mensagem: status >= 500 ? "Erro interno." : e?.message,
      }));
      return;
    }

    // ---- estáticos + reescrita de SPA -------------------------------------
    if (!servirEstaticos || !existsSync(DIST)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Sem build. Rode `npm run build`.");
      return;
    }
    let arquivo = join(DIST, normalize(caminho).replace(/^(\.\.[/\\])+/, ""));
    // A checagem de "termina em barra" so valia no POSIX: no Windows
    // `normalize("/")` devolve a barra invertida, `join` cai no proprio dist e o
    // servidor tentava LER a pasta (EISDIR) - "/" respondia 500 na maquina de
    // quem desenvolve. Perguntar se e diretorio funciona nos dois.
    if (!existsSync(arquivo) || statSync(arquivo).isDirectory()) arquivo = join(DIST, "index.html");
    if (caminho.startsWith("/assets/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.writeHead(200, { "Content-Type": TIPOS[extname(arquivo)] || "application/octet-stream" });
    res.end(await readFile(arquivo));
  });

  // Manutenção periódica: sessões vencidas e baldes de limite parados. Sem
  // isto as duas estruturas só crescem — a de limite, no ritmo que um atacante
  // escolher. `unref` para não segurar o processo aberto.
  const manutencao = setInterval(() => {
    try {
      limparSessoesExpiradas(db);
      limparRecuperacoes(db);
      limparVerificacoes(db);
      limitador.limpar();
    } catch (e) {
      console.error("[Leiloaê] falha na manutenção periódica:", e);
    }
  }, 10 * 60 * 1000);
  manutencao.unref?.();

  servidor.on("close", () => {
    clearInterval(manutencao);
    for (const res of ouvintes) res.end();
    ouvintes.clear();
  });
  // Exposto para os testes inspecionarem o banco sem abrir outra conexão.
  return Object.assign(servidor, { bancoDeDados: db });
}

// Execução direta: `node server/index.js`
//
// A comparação era pelo último segmento de `process.argv[1]` partido em "/".
// No Windows o caminho vem com "\\", então o split não separava nada e a
// condição era sempre falsa: `npm run servidor` terminava com código 0 sem
// abrir porta nenhuma, e sem dizer por quê. Agora os dois lados viram caminho
// absoluto do sistema antes de comparar.
const esteArquivo = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === esteArquivo) {
  const porta = Number(process.env.PORT || 3000);
  criarServidor().listen(porta, () => {
    console.log(`Leiloaê em http://localhost:${porta}  (API em /api/v1)`);
  });
}
