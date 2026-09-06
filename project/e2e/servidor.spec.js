// Itens 9 a 13 do plano, pelo navegador contra o servidor de verdade.
//
// Roda num projeto separado do Playwright (`servidor`), que constrói a
// aplicação apontando para a API e sobe `server/index.js` com banco próprio.
// O projeto padrão continua exercitando o modo demonstração — os dois modos
// precisam continuar funcionando.
import { test, expect } from "@playwright/test";

// Cada teste se apresenta como um cliente diferente. O servidor de teste roda
// com LEILOAE_ATRAS_DE_PROXY=1, então X-Forwarded-For define a identidade para
// a limitação de taxa (SEC-007) — sem isto, a suíte inteira dividiria o mesmo
// balde de fichas e os testes se derrubariam uns aos outros. De quebra, o
// caminho de proxy fica exercitado.
// O contador é por PROCESSO, e o Playwright roda vários workers: sem somar o
// índice do worker, dois processos começariam na mesma identidade e no mesmo
// lote — e os testes se atrapalhariam entre si.
let clienteN = 0;
const sequencial = () => test.info().workerIndex * 1000 + clienteN++;
const identidade = () => {
  const n = sequencial();
  return `203.0.${Math.floor(n / 250) % 250}.${(n % 250) + 1}`;
};

/** Prepara uma página como um cliente novo. */
async function comoClienteNovo(page, ip = identidade()) {
  await page.route(/^https:\/\/images\.unsplash\.com/, (route) => route.abort());
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": ip });
  return ip;
}

test.beforeEach(async ({ page }) => {
  await comoClienteNovo(page);
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

/**
 * Abre um lote DIFERENTE por teste.
 *
 * Rodando em paralelo, dois testes no mesmo lote se superam e o segundo lance
 * é recusado — corretamente, pelo servidor. O defeito seria o teste, não a
 * aplicação; então cada um recebe o seu.
 *
 * A vaga é passada pelo chamador, de propósito. Antes vinha de um contador de
 * processo somado ao índice do worker; como o índice do lote é o resto da
 * divisão pelo tamanho do catálogo, dois workers caíam no mesmo lote sempre
 * que os contadores deles se alinhavam — e a suíte falhava conforme o número
 * de núcleos da máquina, o que é o pior tipo de teste instável. Com a vaga
 * escrita em cada chamada, duas iguais são visíveis lendo o arquivo.
 */
async function abrirLoteExclusivo(page, vaga) {
  const lote = await page.evaluate(async (i) => {
    const { lotes } = await (await fetch("/api/v1/lotes")).json();
    const abertos = lotes.filter((l) => l.endsAt > Date.now() + 3600e3);
    if (i >= abertos.length) throw new Error(`vaga ${i} não cabe em ${abertos.length} lotes abertos`);
    return abertos[i];
  }, vaga);
  await page.goto(`/lote/${lote.id}`);
  await expect(page.getByRole("heading", { name: lote.title, level: 1 })).toBeVisible();
  return lote;
}

test.describe("ARCH-001 — a aplicação vive de dados do servidor", () => {
  test("o catálogo vem da API, não de constante no pacote", async ({ page }) => {
    const pedidos = [];
    page.on("request", (r) => { if (r.url().includes("/api/v1/lotes")) pedidos.push(r.url()); });
    await page.goto("/leiloes");
    await expect(page.locator("article").first()).toBeVisible();
    expect(pedidos.length).toBeGreaterThan(0);
  });

  test("entrar continua acessível com o catálogo fora do ar", async ({ page }) => {
    // A tela de entrada não depende do catálogo: ficar inacessível junto com
    // ele seria tirar da pessoa justamente a ação que ela ainda pode fazer.
    await page.route("**/api/v1/lotes?*", (route) => route.abort("failed"));
    await page.goto("/entrar");
    await expect(page.getByRole("heading", { name: /Entrar na sua conta/i })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });

  test("FRONT-010 — API fora do ar mostra erro com saída, não tela em branco", async ({ page }) => {
    await page.route("**/api/v1/lotes?*", (route) => route.abort("failed"));
    await page.goto("/leiloes");
    await expect(page.getByRole("alert")).toContainText(/Sem conexão|não conseguimos carregar/i);
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
  });

  test("FRONT-010 — 'tentar de novo' recupera quando o servidor volta", async ({ page }) => {
    let falhar = true;
    await page.route("**/api/v1/lotes?*", (route) => (falhar ? route.abort("failed") : route.continue()));
    await page.goto("/leiloes");
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();

    falhar = false;
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.locator("article").first()).toBeVisible();
  });

  test("FRONT-002 — erro do servidor não apaga a aplicação", async ({ page }) => {
    await page.route("**/api/v1/lotes?*", (route) => route.fulfill({ status: 500, body: "{}" }));
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
    const lote = await abrirLoteExclusivo(page, 0);
    const titulo = lote.title;
    await page.getByRole("button", { name: /^Dar lance/ }).first().click();

    const dialogo = page.getByRole("dialog");
    const valor = await dialogo.getByLabel("Quanto você quer dar de lance?").inputValue();
    await dialogo.getByRole("button", { name: /^Confirmar lance de/ }).click();
    await dialogo.getByLabel(/Li o/).check();
    await dialogo.getByRole("button", { name: /^Confirmar lance$/ }).click();
    await expect(dialogo.getByText("Lance registrado.")).toBeVisible();
    await page.keyboard.press("Escape");

    // 1. Sobreviveu à recarga — está no banco, não em memória.
    const formatado = new RegExp(Number(valor).toLocaleString("pt-BR").replace(/\./g, "\\."));
    await page.goto("/leiloes");
    await expect(page.locator("article").filter({ hasText: titulo }).first()
      .getByText(formatado)).toBeVisible();

    // 2. Uma pessoa deslogada, noutra aba, vê o MESMO valor: o lance está no
    //    servidor, não no navegador de quem deu.
    const anonima = await context.browser().newPage();
    await comoClienteNovo(anonima);
    await anonima.goto(new URL("/leiloes", page.url()).toString());
    await expect(anonima.locator("article").filter({ hasText: titulo }).first()
      .getByText(formatado)).toBeVisible();
    await anonima.close();
  });

  test("BIZ-004 — 'Meus lances' vem do servidor e some ao sair", async ({ page }) => {
    await criarConta(page);
    await abrirLoteExclusivo(page, 1);
    await page.getByRole("button", { name: /^Dar lance/ }).first().click();
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
    const escolhido = await abrirLoteExclusivo(page, 2);
    const resposta = await page.evaluate(async (loteId) => {
      const { lote: alvo } = await (await fetch(`/api/v1/lotes/${loteId}`)).json();
      const r = await fetch(`/api/v1/lotes/${alvo.id}/lances`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: 1 }),
      });
      return { status: r.status, corpo: await r.json(), loteId: alvo.id, antes: alvo.currentBid };
    }, escolhido.id);
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
    await abrirLoteExclusivo(page, 3);
    await page.getByRole("button", { name: /^Dar lance/ }).first().click();
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
    const escolhido = await abrirLoteExclusivo(page, 4);
    const lance = await page.evaluate(async (loteId) => {
      const { lote: alvo } = await (await fetch(`/api/v1/lotes/${loteId}`)).json();
      const r = await fetch(`/api/v1/lotes/${alvo.id}/lances`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: alvo.currentBid + 5000 }),
      });
      return (await r.json()).lance;
    }, escolhido.id);
    expect(lance?.id).toBeTruthy();

    // Pessoa B, noutro contexto (outro cookie), tenta cancelar.
    const outro = await context.browser().newContext();
    const paginaB = await outro.newPage();
    await comoClienteNovo(paginaB);
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

test.describe("teto e prorrogação, pela interface", () => {
  test("o teto responde sozinho quando outra pessoa cobre", async ({ page, context }) => {
    // Ana dá um lance com teto alto.
    const ana = await criarConta(page);
    const lote = await abrirLoteExclusivo(page, 5);
    const alvo = await page.evaluate(async (loteId) => {
      const { lote: l } = await (await fetch(`/api/v1/lotes/${loteId}`)).json();
      const r = await fetch(`/api/v1/lotes/${l.id}/lances`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: l.currentBid + 2000, teto: l.currentBid + 90000 }),
      });
      return { loteId: l.id, corpo: await r.json() };
    }, lote.id);
    expect(alvo.corpo.lance).toBeTruthy();
    expect(alvo.corpo.lanceAutomatico).toBeNull();

    // Beto cobre de outro contexto: o teto de Ana precisa responder na hora.
    const outro = await context.browser().newContext();
    const paginaB = await outro.newPage();
    await comoClienteNovo(paginaB);
    await criarConta(paginaB);
    const resposta = await paginaB.evaluate(async (loteId) => {
      const { lote } = await (await fetch(`/api/v1/lotes/${loteId}`)).json();
      const r = await fetch(`/api/v1/lotes/${loteId}/lances`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: lote.currentBid + 1000 }),
      });
      return await r.json();
    }, alvo.loteId);
    await outro.close();

    expect(resposta.lanceAutomatico).not.toBeNull();
    expect(resposta.lote.currentBid).toBe(resposta.lanceAutomatico.value);

    // E Ana vê o lance automático marcado como tal em "Meus lances".
    await page.goto("/meus-lances");
    await expect(page.locator("main").getByText("Automático").first()).toBeVisible();
    expect(ana.email).toContain("@");
  });
});

test.describe("SEC-007 — limitação de taxa", () => {
  test("uma rajada de tentativas de entrada acaba em 429", async ({ page }) => {
    await page.goto("/entrar");
    const resultado = await page.evaluate(async () => {
      const status = [];
      for (let i = 0; i < 25; i++) {
        const r = await fetch("/api/v1/auth/entrar", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "alvo@exemplo.test", senha: "chute-qualquer-longo" }),
        });
        status.push(r.status);
        if (r.status === 429) return { status, retryAfter: r.headers.get("retry-after") };
      }
      return { status, retryAfter: null };
    });
    expect(resultado.status).toContain(429);
    expect(Number(resultado.retryAfter)).toBeGreaterThan(0);
  });
});

test.describe("recuperação de senha", () => {
  test("pedir link responde igual para conta existente e inexistente", async ({ page }) => {
    const conta = await criarConta(page);
    const respostas = await page.evaluate(async (email) => {
      const pedir = async (e) => {
        const r = await fetch("/api/v1/auth/recuperar", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: e }),
        });
        return { status: r.status, corpo: await r.json() };
      };
      return { existe: await pedir(email), naoExiste: await pedir("ninguem-mesmo@exemplo.test") };
    }, conta.email);

    expect(respostas.existe.status).toBe(respostas.naoExiste.status);
    expect(respostas.existe.corpo).toEqual(respostas.naoExiste.corpo);
    expect(JSON.stringify(respostas.existe.corpo)).not.toMatch(/token/i);
  });

  test("a tela de 'esqueci minha senha' existe e confirma sem revelar nada", async ({ page }) => {
    await page.goto("/entrar");
    await page.locator("main").getByRole("button", { name: "Esqueci minha senha" }).click();
    await page.getByLabel("E-mail").fill("qualquer@exemplo.test");
    await page.locator("main").getByRole("button", { name: "Enviar link" }).click();

    const confirmacao = page.getByRole("status");
    await expect(confirmacao).toContainText(/Se existir uma conta/i);
    // Nunca confirma que a conta existe.
    await expect(confirmacao).not.toContainText(/enviamos para você|conta encontrada/i);
  });

  test("link sem token não finge funcionar", async ({ page }) => {
    await page.goto("/redefinir");
    await expect(page.getByRole("heading", { name: /Link incompleto/i })).toBeVisible();
    await expect(page.getByLabel("Nova senha")).toHaveCount(0);
  });

  test("token inválido é recusado com explicação na tela", async ({ page }) => {
    await page.goto("/redefinir?token=nao-existe-esse-token");
    await page.getByLabel("Nova senha").fill("senha-nova-tambem-longa");
    await page.locator("main").getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByRole("alert")).toContainText(/inválido|expirado|usado/i);
  });

  test("o token sai da barra de endereços assim que a tela abre", async ({ page }) => {
    await page.goto("/redefinir?token=um-token-qualquer");
    await expect(page.getByLabel("Nova senha")).toBeVisible();
    // Sem isto o token ficaria no histórico e vazaria no Referer.
    await expect.poll(() => page.url()).not.toContain("token");
    expect(page.url()).toContain("/redefinir");
  });
});

// ---------------------------------------------------------------------------
// Pendências de docs/api.md, pela interface e pela rede.
// ---------------------------------------------------------------------------

test.describe("verificação de e-mail", () => {
  test("a conta nova pede confirmação, e o aviso não bloqueia nada", async ({ page }) => {
    await criarConta(page);
    await expect(page.getByText(/Falta confirmar seu e-mail/i)).toBeVisible();
    // A conta funciona sem confirmar: dá para navegar e o botão de lance existe.
    await expect(primeiroCardAberto(page).getByRole("button", { name: "Dar lance" })).toBeVisible();
  });

  test("o reenvio responde alguma coisa — nunca falha em silêncio", async ({ page }) => {
    await criarConta(page);
    await page.getByRole("button", { name: "Reenviar link" }).click();
    // Com canal configurado diz para onde foi; sem canal, diz que não está
    // configurado. O defeito seria o botão não dizer nada.
    await expect(page.getByText(/Link enviado para|não está configurad/i)).toBeVisible();
  });

  test("link de confirmação sem token não finge que funcionou", async ({ page }) => {
    await page.goto("/verificar");
    await expect(page.getByRole("heading", { name: "Link inválido." })).toBeVisible();
  });

  test("token inválido é recusado com explicação, e sai da barra de endereços", async ({ page }) => {
    await page.goto("/verificar?token=nao-existe");
    await expect(page.getByText(/inválido, expirado ou já usado/i)).toBeVisible();
    // O token não pode ficar no histórico nem vazar no Referer do próximo clique.
    expect(new URL(page.url()).search).toBe("");
  });
});

test.describe("histórico público de lances", () => {
  test("o lance aparece no histórico do lote sem identificar quem o deu", async ({ page }) => {
    const conta = await criarConta(page);
    const lote = await abrirLoteExclusivo(page, 6);

    await page.getByRole("button", { name: /^Dar lance/ }).first().click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: /^Confirmar lance de/ }).click();
    await dialogo.getByLabel(/Li o/).check();
    await dialogo.getByRole("button", { name: /^Confirmar lance/ }).click();
    await expect(dialogo.getByText(/Lance registrado/i)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(`/lote/${lote.id}`);
    await page.getByRole("button", { name: "Histórico de lances" }).click();

    await expect(page.getByText("Participante 1")).toBeVisible();
    // Nem o nome nem o e-mail de quem deu o lance aparecem em lugar nenhum.
    await expect(page.locator("main")).not.toContainText(conta.email);
  });

  test("é público: dá para ver o histórico sem conta nenhuma", async ({ page }) => {
    await page.goto("/lote/lot-mooca-studio");
    await page.getByRole("button", { name: "Histórico de lances" }).click();
    // Sem sessão, a aba carrega e explica a regra do apelido — em vez de pedir
    // login ou devolver erro.
    await expect(page.getByText(/o apelido vale só dentro deste lote/i)).toBeVisible();
    await expect(page.getByText(/Carregando o histórico/i)).toHaveCount(0);
  });
});

test.describe("paginação de /lotes", () => {
  test("o cliente monta o catálogo por páginas e não perde nem repete lote", async ({ page }) => {
    await page.goto("/leiloes");
    await expect(page.locator("article").first()).toBeVisible();

    const r = await page.evaluate(async () => {
      const inteiro = await (await fetch("/api/v1/lotes")).json();
      const paginado = [];
      let cursor = null;
      do {
        const q = new URLSearchParams({ limite: "3" });
        if (cursor) q.set("cursor", cursor);
        const p = await (await fetch(`/api/v1/lotes?${q}`)).json();
        paginado.push(...p.lotes.map((l) => l.id));
        cursor = p.proximo;
      } while (cursor);
      return { inteiro: inteiro.lotes.map((l) => l.id), paginado, total: inteiro.total };
    });

    expect(r.paginado).toHaveLength(r.inteiro.length);
    expect(new Set(r.paginado).size).toBe(r.paginado.length);
    expect([...r.paginado].sort()).toEqual([...r.inteiro].sort());
    expect(r.total).toBe(r.inteiro.length);
  });

  test("limite fora de forma é recusado com 400", async ({ page }) => {
    await page.goto("/leiloes");
    const status = await page.evaluate(() =>
      fetch("/api/v1/lotes?limite=abc").then((r) => r.status));
    expect(status).toBe(400);
  });
});
