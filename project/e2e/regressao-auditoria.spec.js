// Regressões da auditoria: cada teste aqui reproduz um defeito que foi
// encontrado em produção-simulada e agora precisa continuar corrigido.
import { test, expect } from "@playwright/test";

// O E2E não depende de rede externa: imagens de terceiros são dispensadas,
// senão o "load" fica pendurado quando o ambiente bloqueia o CDN.
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/images\.unsplash\.com/, (route) => route.abort());
});

const irParaLeiloes = async (page) => {
  await page.goto("/leiloes");
  await expect(page.getByRole("heading", { name: /Leilões em São Paulo/i })).toBeVisible();
};

test.describe("BIZ-002 — leilão encerrado não aceita lance", () => {
  test("o lote encerrado do catálogo não oferece botão de lance", async ({ page }) => {
    await irParaLeiloes(page);
    const cardEncerrado = page.locator("article").filter({ hasText: "Kitnet — Liberdade" });
    await expect(cardEncerrado).toBeVisible();
    await expect(cardEncerrado.getByText("Leilão encerrado")).toBeVisible();
    await expect(cardEncerrado.getByRole("button", { name: "Dar lance" })).toHaveCount(0);
  });

  test("a página do lote encerrado também não oferece lance", async ({ page }) => {
    await page.goto("/lote/lot-liberdade-kitnet");
    await expect(page.getByRole("heading", { name: "Kitnet — Liberdade", level: 1 })).toBeVisible();
    await expect(page.getByText("Leilão encerrado — não é possível dar lances.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Dar lance$/ })).toHaveCount(0);
  });

  test("o leilão encerrando com o modal aberto impede o registro do lance", async ({ page }) => {
    await page.clock.install();
    await irParaLeiloes(page);
    const card = page.locator("article").filter({ hasText: "Studio na Mooca" }).first();
    await card.getByRole("button", { name: "Dar lance" }).click();

    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole("button", { name: /^Confirmar lance de/ }).click();
    await dialogo.getByLabel(/Li o/).check();

    // O prazo vence com o usuário no último passo, prestes a confirmar.
    await page.clock.fastForward(72 * 60 * 60 * 1000);

    await expect(dialogo.getByText(/Este leilão já encerrou/)).toBeVisible();
    await expect(dialogo.getByRole("button", { name: /^Confirmar lance$/ })).toHaveCount(0);
    await expect(dialogo.getByText("Lance registrado.")).toHaveCount(0);

    // E nada foi gravado: Meus lances continua vazio.
    await page.goto("/meus-lances");
    await expect(page.getByText("Nada aqui ainda")).toBeVisible();
  });

  test("todos os lotes encerram e nenhum aceita lance depois disso", async ({ page }) => {
    await page.clock.install();
    await irParaLeiloes(page);
    // 72h à frente: toda a agenda de 48h já passou.
    await page.clock.fastForward(72 * 60 * 60 * 1000);
    await expect(page.getByRole("button", { name: "Dar lance" })).toHaveCount(0);
    await expect(page.getByText("Leilão encerrado").first()).toBeVisible();
  });
});

test.describe("BIZ-001 — o lance altera o lote e aparece em Meus lances", () => {
  test("dar lance sobe o lance atual, conta o lance e entra em Meus lances", async ({ page }) => {
    await irParaLeiloes(page);
    const card = page.locator("article").filter({ hasText: "Studio na Mooca" }).first();
    const valorAntes = await card.locator("text=/^\\d{1,3}(\\.\\d{3})*$/").first().textContent();

    await card.getByRole("button", { name: "Dar lance" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();

    const valor = await dialogo.getByLabel("Quanto você quer dar de lance?").inputValue();
    await dialogo.getByRole("button", { name: /^Confirmar lance de/ }).click();
    await dialogo.getByLabel(/Li o/).check();
    await dialogo.getByRole("button", { name: /^Confirmar lance$/ }).click();
    await expect(dialogo.getByText("Lance registrado.")).toBeVisible();

    await dialogo.getByRole("button", { name: "Ver meus lances" }).click();
    await expect(page.getByRole("heading", { name: /Acompanhe sua disputa/i })).toBeVisible();
    const linha = page.locator("main").getByRole("button", { name: "Studio na Mooca", exact: true });
    await expect(linha).toBeVisible();
    await expect(page.locator("main").getByText("Ganhando").first()).toBeVisible();

    // O lote na listagem reflete o novo lance.
    await irParaLeiloes(page);
    const cardDepois = page.locator("article").filter({ hasText: "Studio na Mooca" }).first();
    const valorDepois = await cardDepois.locator("text=/^\\d{1,3}(\\.\\d{3})*$/").first().textContent();
    expect(Number(valorDepois.replace(/\D/g, ""))).toBeGreaterThan(Number(valorAntes.replace(/\D/g, "")));
    expect(Number(valorDepois.replace(/\D/g, ""))).toBe(Number(valor));
  });
});

test.describe("FRONT-001 — favoritos sobrevivem ao reload", () => {
  test("favoritar, recarregar e continuar favoritado", async ({ page }) => {
    await irParaLeiloes(page);
    const card = page.locator("article").filter({ hasText: "Studio na Mooca" }).first();
    await card.getByRole("button", { name: /^Salvar/ }).click();
    await expect(card.getByRole("button", { name: /Remover dos salvos/ })).toBeVisible();

    await page.reload();
    const depois = page.locator("article").filter({ hasText: "Studio na Mooca" }).first();
    await expect(depois.getByRole("button", { name: /Remover dos salvos/ })).toBeVisible();

    await page.goto("/salvos", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").getByRole("button", { name: "Studio na Mooca", exact: true })).toBeVisible();
  });
});

test.describe("FRONT-005 — diálogo acessível", () => {
  test("foco entra no modal, fica preso e volta ao gatilho", async ({ page }) => {
    await irParaLeiloes(page);
    const card = page.locator("article").filter({ hasText: "Studio na Mooca" }).first();
    const gatilho = card.getByRole("button", { name: "Dar lance" });
    await gatilho.click();

    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toHaveAttribute("aria-modal", "true");

    // O foco começa dentro do diálogo.
    await expect.poll(async () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);

    // Vinte tabulações nunca escapam para o fundo.
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const dentro = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
      expect(dentro, `Tab ${i + 1} vazou para fora do diálogo`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialogo).toHaveCount(0);
    await expect(gatilho).toBeFocused();
  });

  test("o tour fecha com ESC", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Como funciona/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("ARCH-002 — rotas com URL", () => {
  test("lote tem endereço próprio e o voltar do navegador funciona", async ({ page }) => {
    await irParaLeiloes(page);
    await page.locator("article").filter({ hasText: "Studio na Mooca" }).first()
      .getByRole("button", { name: "Studio na Mooca", exact: true }).click();

    await expect(page).toHaveURL(/\/lote\/lot-mooca-studio$/);
    await expect(page.getByRole("heading", { name: "Studio na Mooca", level: 1 })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/leiloes$/);
  });

  test("link direto para um lote abre o lote", async ({ page }) => {
    await page.goto("/lote/car-civic");
    await expect(page.getByRole("heading", { name: "Honda Civic EXL", level: 1 })).toBeVisible();
  });

  test("lote inexistente mostra mensagem, não a home silenciosamente", async ({ page }) => {
    await page.goto("/lote/nao-existe");
    await expect(page.getByText("Não encontramos esse lote.")).toBeVisible();
  });
});

test.describe("BIZ-007/008 — simulador coerente", () => {
  test("as linhas do simulador somam o total exibido, e veículo não paga ITBI", async ({ page }) => {
    await page.goto("/lote/car-civic");
    const painel = page.locator("aside");
    await expect(painel.getByText("Simulador de custo")).toBeVisible();
    await expect(painel.getByText(/ITBI/)).toHaveCount(0);
    await expect(painel.getByText("Taxa Leiloaê (1,5%)")).toBeVisible();

    // Compara apenas dentro do cartão do simulador (o painel também mostra o lance atual).
    const simulador = page.getByTestId("simulador-custo");
    // pt-BR usa espaço não separável depois de "R$"; o \s do regex cobre os dois.
    const texto = await simulador.innerText();
    const valores = [...texto.matchAll(/R\$\s*([\d.]+)/g)].map((m) => Number(m[1].replace(/\./g, "")));
    expect(valores.length).toBeGreaterThanOrEqual(4);

    const total = valores[valores.length - 1];
    const soma = valores.slice(0, -1).reduce((s, v) => s + v, 0);
    // Sem a Taxa Leiloaê nas linhas, a diferença seria de milhares (era o bug BIZ-008).
    expect(Math.abs(soma - total)).toBeLessThanOrEqual(valores.length);
  });
});

test.describe("SEC-001/002 — honestidade do ambiente de demonstração", () => {
  test("a faixa de demonstração aparece", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Ambiente de demonstração.")).toBeVisible();
  });

  test("o formulário de contato não coleta dados sem destino", async ({ page }) => {
    await page.goto("/institucional/contato");
    await expect(page.getByText("O formulário está desativado nesta demonstração")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  });

  test("não há CNPJ fictício apresentado como real", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("00.000.000/0001-00")).toHaveCount(0);
    await expect(page.getByText(/Protótipo de demonstração/)).toBeVisible();
  });

  test("a caixa de mensagens não se apresenta como canal real", async ({ page }) => {
    await page.goto("/conta/mensagens");
    await expect(page.getByRole("note")).toContainText("não é enviado a ninguém");
    await expect(page.getByRole("note")).toContainText("não escreva dados pessoais");
  });

  test("as páginas jurídicas avisam que são fictícias", async ({ page }) => {
    await page.goto("/institucional/termos");
    await expect(page.getByText(/não tem validade jurídica/)).toBeVisible();
  });
});

test.describe("FRONT-003/004 — orçamento de imagens e timers", () => {
  // Orçamento do item 8 do plano: "≤ 2 imagens por card e ≤ 2 timers ativos,
  // medidos". Os números são absolutos de propósito — um limite proporcional
  // ao número de cards deixaria voltar exatamente o defeito original, em que o
  // custo crescia com o catálogo.
  const contarTimers = (page) => page.addInitScript(() => {
    window.__vivos = new Set();
    const si = window.setInterval, ci = window.clearInterval;
    window.setInterval = function (...a) { const id = si.apply(window, a); window.__vivos.add(id); return id; };
    window.clearInterval = function (id) { window.__vivos.delete(id); return ci.call(window, id); };
  });

  test("a listagem fica dentro do orçamento de imagens e timers", async ({ page }) => {
    await contarTimers(page);
    await irParaLeiloes(page);
    await page.waitForTimeout(1500);

    const cards = await page.locator("article").count();
    const imagens = await page.locator("img").count();
    expect(cards).toBeGreaterThan(5); // o orçamento só significa algo com catálogo cheio
    expect(imagens / cards).toBeLessThanOrEqual(2);

    // Antes: 56 intervalos. Depois do relógio único ainda sobravam 14 — um por
    // card, da rotação de fotos. Agora o índice é derivado do relógio.
    expect(await page.evaluate(() => window.__vivos.size)).toBeLessThanOrEqual(2);
  });

  test("a página do lote fica dentro do mesmo orçamento", async ({ page }) => {
    await contarTimers(page);
    await page.goto("/lote/lot-mooca-studio");
    await expect(page.getByRole("heading", { name: "Studio na Mooca", level: 1 })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__vivos.size)).toBeLessThanOrEqual(2);
  });

  test("nenhum timer sobrevive à aba oculta", async ({ page }) => {
    await contarTimers(page);
    await irParaLeiloes(page);
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__vivos.size)).toBe(0);
  });
});
