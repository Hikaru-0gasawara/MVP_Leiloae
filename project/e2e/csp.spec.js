// Item 14 do plano (SEC-006 / FRONT-014).
//
// Critério: "CSP ativa sem quebra". `vite preview` não aplica public/_headers,
// então a CSP nunca era exercitada — e não era: `font-src 'self'` bloqueava as
// fontes que o Vite embutia como data: URI, e a tipografia caía para a do
// sistema sem erro visível. Aqui o build é servido COM os cabeçalhos reais.
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(RAIZ, "dist");

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff",
  ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json",
  ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon",
};

/** Lê public/_headers no formato Netlify. */
async function lerHeaders() {
  const txt = await readFile(join(RAIZ, "public", "_headers"), "utf8");
  const blocos = [];
  let atual = null;
  for (const linha of txt.split("\n")) {
    if (!linha.trim() || linha.trim().startsWith("#")) continue;
    if (!/^\s/.test(linha)) { atual = { padrao: linha.trim(), headers: {} }; blocos.push(atual); }
    else if (atual) {
      const i = linha.indexOf(":");
      atual.headers[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
    }
  }
  return blocos;
}

let servidor, base;

test.beforeAll(async () => {
  const blocos = await lerHeaders();
  const casa = (padrao, caminho) =>
    padrao === "/*" ? true : new RegExp("^" + padrao.replace(/\*/g, ".*") + "$").test(caminho);

  servidor = createServer(async (req, res) => {
    const caminho = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let arquivo = join(DIST, normalize(caminho).replace(/^(\.\.[/\\])+/, ""));
    // Reescrita de SPA, como em public/_redirects e vercel.json (ARCH-002).
    // O teste do fim em "/" só valia no POSIX: no Windows `normalize("/")` dá
    // "\\", `join` devolve o próprio dist e o servidor tentava LER a pasta
    // (EISDIR). Perguntar se é diretório cobre os dois sistemas.
    const ehPasta = existsSync(arquivo) && statSync(arquivo).isDirectory();
    if (!existsSync(arquivo) || ehPasta) arquivo = join(DIST, "index.html");
    for (const b of blocos) if (casa(b.padrao, caminho)) for (const [k, v] of Object.entries(b.headers)) res.setHeader(k, v);
    res.setHeader("Content-Type", TIPOS[extname(arquivo)] || "application/octet-stream");
    res.end(await readFile(arquivo));
  });
  await new Promise((r) => servidor.listen(0, r));
  base = `http://localhost:${servidor.address().port}`;
});

test.afterAll(async () => { await new Promise((r) => servidor.close(r)); });

const ROTAS = ["/", "/leiloes", "/lote/lot-mooca-studio", "/lote/car-civic", "/meus-lances",
  "/salvos", "/conta", "/conta/mensagens", "/institucional/taxas", "/institucional/termos"];

/** Coleta violações relatadas pelo próprio navegador. */
async function comCsp(page) {
  const violacoes = [];
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__csp.push(`${e.violatedDirective} bloqueou ${String(e.blockedURI).slice(0, 80)}`);
    });
  });
  page.on("console", (m) => { if (/Refused to|Content Security Policy/i.test(m.text())) violacoes.push(m.text().slice(0, 200)); });
  return violacoes;
}

test("os cabeçalhos de segurança chegam em rota profunda, sem 404", async ({ request }) => {
  const r = await request.get(`${base}/lote/car-civic`);
  expect(r.status()).toBe(200);
  const h = r.headers();
  expect(h["content-security-policy"]).toContain("default-src 'self'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

for (const rota of ROTAS) {
  test(`a CSP não bloqueia nada em ${rota}`, async ({ page }) => {
    // As imagens são o único terceiro previsto; abortá-las evita depender da rede.
    await page.route(/^https:\/\/images\.unsplash\.com/, (r) => r.abort());
    const violacoes = await comCsp(page);
    await page.goto(base + rota, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main");
    await page.waitForTimeout(400);
    const doNavegador = await page.evaluate(() => window.__csp || []);
    expect([...violacoes, ...doNavegador]).toEqual([]);
  });
}

test("a CSP não bloqueia os overlays", async ({ page }) => {
  await page.route(/^https:\/\/images\.unsplash\.com/, (r) => r.abort());
  const violacoes = await comCsp(page);

  await page.goto(base + "/leiloes", { waitUntil: "domcontentloaded" });
  await page.locator("article").first().getByRole("button", { name: "Dar lance" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Como funciona/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(400);

  const doNavegador = await page.evaluate(() => window.__csp || []);
  expect([...violacoes, ...doNavegador]).toEqual([]);
});

test("as fontes próprias carregam de verdade sob a CSP", async ({ page }) => {
  await page.route(/^https:\/\/images\.unsplash\.com/, (r) => r.abort());
  await page.goto(base + "/", { waitUntil: "load" });
  await page.waitForTimeout(600);

  // Nenhuma fonte como data: URI — era o que a CSP bloqueava.
  const fontes = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .filter((r) => /\.(woff2?|ttf|otf)(\?|$)/.test(r.name) || r.name.startsWith("data:font"))
      .map((r) => ({ nome: r.name.slice(0, 60), tamanho: r.transferSize ?? r.encodedBodySize })));
  expect(fontes.length).toBeGreaterThan(0);
  expect(fontes.some((f) => f.nome.startsWith("data:font"))).toBe(false);

  // E o navegador realmente carregou as famílias declaradas.
  const carregadas = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
  });
  expect(carregadas.join(",")).toMatch(/Funnel Sans|Instrument Serif/);
});

test("sem endpoint configurado, a aplicação não fala com nenhum host externo", async ({ page }) => {
  const externos = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith(base) && !url.startsWith("data:") && !url.startsWith("blob:")) externos.push(url);
    return url.startsWith("https://images.unsplash.com") ? route.abort() : route.continue();
  });
  await page.goto(base + "/leiloes", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  // O banco de imagens é o único terceiro conhecido, e é substituível por
  // VITE_PHOTO_BASE (ver npm run fotos:baixar). Nada além dele pode aparecer.
  const inesperados = externos.filter((u) => !u.startsWith("https://images.unsplash.com"));
  expect(inesperados, `\n${inesperados.join("\n")}\n`).toEqual([]);
});
