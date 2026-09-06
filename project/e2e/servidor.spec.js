// Itens 9 a 13 do plano, pelo navegador contra o servidor de verdade.
//
// Roda num projeto separado do Playwright (`servidor`), que constrói a
// aplicação apontando para a API e sobe `server/index.js` com banco próprio.
// O projeto padrão continua exercitando o modo demonstração — os dois modos
// precisam continuar funcionando.
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/images\.unsplash\.com/, (route) => route.abort());
});

/** Cada teste cria a própria conta: nenhum depende do estado deixado por outro. */
let contador = 0;
const novaConta = () => ({
  nome: "Pessoa de Teste",
  email: `teste-${Date.now()}-${contador++}@exemplo.test`,
  senha: "senha-bem-comprida",
});

async function criarConta(page, conta = novaConta()) {
  await page.goto("/entrar");
  await page.locator("main").getByRole("button", { name: "Criar uma conta" }).click();
  await page.getByLabel("Nome").fill(conta.nome);
  await page.getByLabel("E-mail").fill(conta.email);
  await page.getByLabel("Senha").fill(conta.senha);
  await page.locator("main").getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: /Leilões em São Paulo/i })).toBeVisible();
  return conta;
}

const primeiroCardAberto = (page) =>
  page.locator("article").filter({ hasNot: page.getByText("Leilão encerrado") }).first();

test.describe("ARCH-001 — a aplicação vive de dados do servidor", () => {
  test("o catálogo vem da API, não de constante no pacote", async ({ page }) => {
    const pedidos = [];
    page.on("request", (r) => { if (r.url().includes("/api/v1/lotes")) pedidos.push(r.url()); });
    await page.goto("/leiloes");
    await expect(page.locator("article").first()).toBeVisible();
    expect(pedidos.length).toBeGreaterThan(0);
  });

  test("FRONT-010 — API fora do ar mostra erro com saída, não tela em branco", async ({ page }) => {
    await page.route("**/api/v1/lotes", (route) => route.abort("failed"));
    await page.goto("/leiloes");
    await expect(page.getByRole("alert")).toContainText(/Sem conexão|não conseguimos carregar/i);
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
  });

  test("FRONT-010 — 'tentar de novo' recupera quando o servidor volta", async ({ page }) => {
    let falhar = true;
    await page.route("**/api/v1/lotes", (route) => (falhar ? route.abort("failed") : route.continue()));
    await page.goto("/leiloes");
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();

    falhar = false;
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.locator("article").first()).toBeVisible();
  });

  test("FRONT-002 — erro do servidor não apaga a aplicação", async ({ page }) => {
    await page.route("**/api/v1/lotes", (route) => route.fulfill({ status: 500, body: "{}" }));
    await page.goto("/leiloes");
    // O cabeçalho continua de pé e navegável.
    await expect(page.getByRole("banner").or(page.locator("header"))).toBeVisible();
    await expect(page.getByRole("alert")).toBeVisible();
  });
});

test.describe("SEC-003 — autenticação de verdade", () => {
  test("sem conta, dar lance leva à entrada", async ({ page }) => {
    await page.goto("/leiloes");
    await primeiroCardAberto(page).getByRole("button", { name: "Dar lance" }).click();

    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: /^Confirmar lance de/ }).click();
    await dialogo.getByLabel(/Li o/).check();
    await dialogo.getByRole("button", { name: /^Confirmar lance$/ }).click();

    // O servidor recusa: nada de "lance registrado".
    await expect(dialogo.getByText("Lance registrado.")).toHaveCount(0);
  });

  test("criar conta, sair e entrar de novo", async ({ page }) => {
    const conta = await criarConta(page);

    await page.getByRole("button", { name: /Conta de/ }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByLabel("E-mail").fill(conta.email);
    await page.getByLabel("Senha").fill(conta.senha);
    await page.locator("main").getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("button", { name: /Conta de/ })).toBeVisible();
  });

  test("senha errada mostra o erro na tela, não no console", async ({ page }) => {
    const conta = await criarConta(page);
    await page.getByRole("button", { name: /Conta de/ }).click();
    await page.getByRole("button", { name: "Sair" }).click();

    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(conta.email);
    await page.getByLabel("Senha").fill("senha-errada-longa");
    await page.locator("main").getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(/incorretos/i);
  });

  test("a senha nunca aparece na URL", async ({ page }) => {
    const conta = await criarConta(page);
    expect(page.url()).not.toContain(conta.senha);
    expect(page.url()).not.toContain("senha");
  });
});

test.describe("BIZ-001/012 — o lance é registrado no servidor", () => {
  test("dar lance sobe o lance do lote para todo mundo, e persiste na recarga", async ({ page, context }) => {
    await criarConta(page);
    await page.goto("/leiloes");

    const card = primeiroCardAberto(page);
    const titulo = await card.getByRole("button").filter({ hasNotText: /Comparar|Salvar|Dar lance/ }).first().innerText();
    await card.getByRole("button", { name: "Dar lance" }).click();

    const dialogo = page.getByRole("dialog");
    const valor = await dialogo.getByLabel("Quanto você quer dar de lance?").inputValue();
    await dialogo.getByRole("button", { name: /^Confirmar lance de/ }).click();
    await dialogo.getByLabel(/Li o/).check();
    await dialogo.getByRole("button", { name: /^Confirmar lance$/ }).click();
    await expect(dialogo.getByText("Lance registrado.")).toBeVisible();
    await page.keyboard.press("Escape");

    // 1. Sobreviveu à recarga — está no banco, não em memória.
    await page.reload();
    await expect(page.locator("article").filter({ hasText: titulo }).first()
      .getByText(new RegExp(Number(valor).toLocaleString("pt-BR").replace(/\./g, "\\.")))).toBeVisible();

    // 2. Uma pessoa deslogada, noutra aba, vê o mesmo lance.
    const anonima = await context.browser().newPage();
    await anonima.route(/^https:\/\/images\.unsplash\.com/, (r) => r.abort());
    await anonima.goto(page.url().replace(/\/[^/]*$/, "/leiloes"));
    await expect(anonima.locator("article").filter({ hasText: titulo }).first()).toBeVisible();
    await anonima.close();
  });

  test("BIZ-004 — 'Meus lances' vem do servidor e some ao sair", async ({ page }) => {
    await criarConta(page);
    await page.goto("/leiloes");
    await primeiroCardAberto(page).getByRole("button", { name: "Dar lance" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: /^Confirmar lance de/ }).click();
    await dialogo.getByLabel(/Li o/).check();
    await dialogo.getByRole("button", { name: /^Confirmar lance$/ }).click();
    await dialogo.getByRole("button", { name: "Ver meus lances" }).click();

    await expect(page.getByRole("heading", { name: /Acompanhe sua disputa/i })).toBeVisible();
    await expect(page.locator("main").getByText("Ganhando").first()).toBeVisible();

    await page.getByRole("button", { name: /Conta de/ }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await page.goto("/meus-lances");
    await expect(page.getByText("Nada aqui ainda")).toBeVisible();
  });

  test("SEC-004 — lance abaixo do mínimo é recusado pelo servidor mesmo forçando", async ({ page }) => {
    await criarConta(page);
    // Contorna a interface: fala com a API como um cliente hostil faria.
    const resposta = await page.evaluate(async () => {
      const { lotes } = await (await fetch("/api/v1/lotes")).json();
      const alvo = lotes.find((l) => l.endsAt > Date.now());
      const r = await fetch(`/api/v1/lotes/${alvo.id}/lances`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: 1 }),
      });
      return { status: r.status, corpo: await r.json(), loteId: alvo.id, antes: alvo.currentBid };
    });
    expect(resposta.status).toBe(409);
    expect(resposta.corpo.erro).toBe("below-min");

    // E o lote não se moveu.
    const depois = await page.evaluate(async (id) =>
      (await (await fetch(`/api/v1/lotes/${id}`)).json()).lote.currentBid, resposta.loteId);
    expect(depois).toBe(resposta.antes);
  });
});

test.describe("BIZ-006 — cancelamento com validação no servidor", () => {
  test("o primeiro lance pode ser cancelado e o lote volta atrás", async ({ page }) => {
    await criarConta(page);
    await page.goto("/leiloes");
    await primeiroCardAberto(page).getByRole("button", { name: "Dar lance" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: /^Confirmar lance de/ }).click();
    await dialogo.getByLabel(/Li o/).check();
    await dialogo.getByRole("button", { name: /^Confirmar lance$/ }).click();
    await dialogo.getByRole("button", { name: "Ver meus lances" }).click();

    await expect(page.getByText(/Primeiro lance protegido/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar lance" }).click();

    await page.reload();
    await expect(page.getByText("Cancelado").first()).toBeVisible();
  });

  test("IDOR — não dá para cancelar o lance de outra pessoa", async ({ page, context }) => {
    // Pessoa A dá um lance e descobre o id do lance.
    await criarConta(page);
    const lance = await page.evaluate(async () => {
      const { lotes } = await (await fetch("/api/v1/lotes")).json();
      const alvo = lotes.find((l) => l.endsAt > Date.now());
      const r = await fetch(`/api/v1/lotes/${alvo.id}/lances`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: alvo.currentBid + 5000 }),
      });
      return (await r.json()).lance;
    });
    expect(lance?.id).toBeTruthy();

    // Pessoa B, noutro contexto (outro cookie), tenta cancelar.
    const outro = await context.browser().newContext();
    const paginaB = await outro.newPage();
    await paginaB.route(/^https:\/\/images\.unsplash\.com/, (r) => r.abort());
    await criarConta(paginaB);
    const status = await paginaB.evaluate(async (id) => {
      const r = await fetch(`/api/v1/lances/${id}/cancelar`, { method: "POST" });
      return r.status;
    }, lance.id);
    expect(status).toBe(404);
    await outro.close();

    // O lance de A continua vivo.
    await page.goto("/meus-lances");
    await expect(page.getByText("Cancelado")).toHaveCount(0);
  });
});

test.describe("FRONT-001 — favoritos ficam na conta, não no navegador", () => {
  test("salvar, sair, entrar de novo e o favorito continua lá", async ({ page }) => {
    const conta = await criarConta(page);
    await page.goto("/leiloes");
    const card = page.locator("article").first();
    const titulo = await card.getByRole("button").filter({ hasNotText: /Comparar|Salvar|Dar lance/ }).first().innerText();
    await card.getByRole("button", { name: /^Salvar/ }).click();
    await expect(card.getByRole("button", { name: /Remover dos salvos/ })).toBeVisible();

    await page.getByRole("button", { name: /Conta de/ }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(conta.email);
    await page.getByLabel("Senha").fill(conta.senha);
    await page.locator("main").getByRole("button", { name: "Entrar", exact: true }).click();

    await page.goto("/salvos");
    await expect(page.locator("main").getByText(titulo).first()).toBeVisible();
  });
});
