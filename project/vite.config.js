import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Orçamento de performance: avisa se um chunk crescer além do previsto (FRONT-013).
    chunkSizeWarningLimit: 400,
    // Fontes nunca embutidas como data: URI. O padrão do Vite embute arquivos
    // pequenos, e a CSP de produção (`font-src 'self'`) bloqueava exatamente
    // esses — a tipografia caía para a fonte do sistema, sem erro visível.
    // Como arquivos separados também são cacheáveis, sai ganhando dos dois
    // lados, e a CSP continua sem precisar de `data:`.
    assetsInlineLimit: (caminho) => (/\.(woff2?|ttf|otf|eot)$/i.test(caminho) ? false : undefined),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    restoreMocks: true,
  },
});
