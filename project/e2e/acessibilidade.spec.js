// Item 5 do plano de ação (FRONT-005 / FRONT-011).
//
// Critério de conclusão: "axe-core sem violação séria; navegação por teclado
// validada". Este arquivo cobre a primeira metade em todas as rotas e nos cinco
// overlays; a navegação por teclado (foco inicial, trap, ESC, devolução do foco)
// está em regressao-auditoria.spec.js.
//
// O corte é em serious/critical: violações "moderate" e "minor" ficam
// registradas na saída para acompanhamento, sem reprovar o build.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/images\.unsplash\.com/, (route) => route.abort());
  // A regra de contraste avalia o estado de repouso: sem isto o axe amostra a
  // animação de entrada e acusa cores intermediárias que ninguém lê.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const analisar = (page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

/** Só reprova no que a auditoria classificou como sério. */
function serias(resultado) {
  return resultado.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

function descrever(violacoes) {
  return violacoes
    .map((v) => `${v.id} (${v.impact}) — ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n    ")}`)
    .join("\n");
}

const ROTAS = [
  ["home", "/"],
  ["listagem", "/leiloes"],
  ["lote", "/lote/lot-mooca-studio"],
  ["lote encerrado", "/lote/lot-liberdade-kitnet"],
  ["meus lances", "/meus-lances"],
  ["salvos", "/salvos"],
  ["conta", "/conta"],
  ["taxas", "/institucional/taxas"],
  ["contato", "/institucional/contato"],
];

// Os dois temas: o claro reprovava em pontos que o escuro passava.
//
// Cada rota é varrida em dois instantes. Sem isso a suíte dependia da hora em
// que rodava: o selo "encerrando" (--hot-ink) só existe na última hora de um
// lote, e uma falha de contraste ali passou dias invisível — aparecia e sumia
// conforme o ciclo de 48h da agenda. Aqui os dois estados são forçados.
const MOMENTOS = [
  ["catálogo aberto", 0],
  // 47h à frente: a agenda de 48h coloca lotes na última hora e acende o selo.
  ["lote encerrando", 47 * 60 * 60 * 1000],
];

for (const tema of ["dark", "light"]) {
  for (const [nome, rota] of ROTAS) {
    for (const [momento, avanco] of MOMENTOS) {
      test(`sem violação séria: ${nome} · tema ${tema} · ${momento}`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem("leiloe:theme", t), tema);
        if (avanco) await page.clock.install();
        await page.goto(rota);
        await page.waitForSelector("main");
        if (avanco) {
          await page.clock.fastForward(avanco);
          await page.waitForTimeout(300);
        }
        const graves = serias(await analisar(page));
        expect(graves, `\n${descrever(graves)}\n`).toEqual([]);
      });
    }
  }
}

test.describe("os cinco overlays", () => {
  test("modal de lance", async ({ page }) => {
    await page.goto("/leiloes");
    await page.locator("article").filter({ hasText: "Studio na Mooca" }).first()
      .getByRole("button", { name: "Dar lance" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const graves = serias(await analisar(page));
    expect(graves, `\n${descrever(graves)}\n`).toEqual([]);
  });

  test("tour de iniciante", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Como funciona/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const graves = serias(await analisar(page));
    expect(graves, `\n${descrever(graves)}\n`).toEqual([]);
  });

  test("comparador", async ({ page }) => {
    await page.goto("/leiloes");
    const cards = page.locator("article");
    await cards.nth(0).getByRole("button", { name: /^Comparar/ }).click();
    await cards.nth(1).getByRole("button", { name: /^Comparar/ }).click();
    // A barra de comparação só habilita o botão a partir de dois lotes.
    await page.getByRole("button", { name: "Comparar (2)" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const graves = serias(await analisar(page));
    expect(graves, `\n${descrever(graves)}\n`).toEqual([]);
  });

  test("painel de notificações", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Notificaç/i }).first().click();
    await expect(page.getByRole("dialog", { name: "Notificações" })).toBeVisible();
    const graves = serias(await analisar(page));
    expect(graves, `\n${descrever(graves)}\n`).toEqual([]);
  });

  test("painel da conta", async ({ page }) => {
    await page.goto("/");
    const gatilho = page.getByRole("button", { name: /Conta de/ });
    await gatilho.click();
    await expect(gatilho).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByLabel("Painel da conta de Camila Silva")).toBeVisible();
    const graves = serias(await analisar(page));
    expect(graves, `\n${descrever(graves)}\n`).toEqual([]);
  });
});

test.describe("FRONT-011 — todos os overlays dispensam com ESC", () => {
  test("painel de notificações fecha com ESC e devolve o foco", async ({ page }) => {
    await page.goto("/");
    const gatilho = page.getByRole("button", { name: /Notificaç/i }).first();
    await gatilho.click();
    const painel = page.getByRole("dialog", { name: "Notificações" });
    await expect(painel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(painel).toHaveCount(0);
    await expect(gatilho).toBeFocused();
  });

  test("painel da conta fecha com ESC e devolve o foco", async ({ page }) => {
    await page.goto("/");
    const gatilho = page.getByRole("button", { name: /Conta de/ });
    await gatilho.click();
    const painel = page.getByLabel("Painel da conta de Camila Silva");
    await expect(painel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(painel).toHaveCount(0);
    await expect(gatilho).toBeFocused();
    await expect(gatilho).toHaveAttribute("aria-expanded", "false");
  });
});
