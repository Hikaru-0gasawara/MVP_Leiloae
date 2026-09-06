import { defineConfig, devices } from "@playwright/test";

const PORTA_DEMO = 4173;
const PORTA_SERVIDOR = 4180;

// Em ambientes que já trazem o Chromium instalado (contêiner de CI próprio),
// PW_CHROMIUM_PATH aponta para ele; caso contrário usa o padrão.
const lancamento = process.env.PW_CHROMIUM_PATH
  ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
  : {};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  projects: [
    {
      // Modo demonstração: sem back-end, como a aplicação é publicada hoje.
      name: "demo",
      testIgnore: /servidor\.spec\.js/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PORTA_DEMO}`, trace: "on-first-retry", ...lancamento },
    },
    {
      // Modo servidor: build apontando para a API, servida pelo próprio Node.
      name: "servidor",
      testMatch: /servidor\.spec\.js/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PORTA_SERVIDOR}`, trace: "on-first-retry", ...lancamento },
    },
  ],
  webServer: [
    {
      command: `npm run build && npx vite preview --port ${PORTA_DEMO} --strictPort`,
      port: PORTA_DEMO,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Banco descartável por execução: os testes nunca dependem do que ficou
      // de uma rodada anterior, e nenhum deles suja o banco de desenvolvimento.
      command:
        `VITE_API_URL=/ npm run build:servidor && ` +
        `LEILOAE_DB=./dados/e2e.db node -e "require('fs').rmSync('./dados/e2e.db',{force:true})" && ` +
        `LEILOAE_DB=./dados/e2e.db PORT=${PORTA_SERVIDOR} ` +
        // Identidade por X-Forwarded-For: cada teste é um cliente distinto
        // para a limitação de taxa. Ver o cabeçalho de e2e/servidor.spec.js.
        `LEILOAE_ATRAS_DE_PROXY=1 node server/index.js`,
      port: PORTA_SERVIDOR,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
