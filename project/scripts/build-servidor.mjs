// Build que aponta para a API, em `dist-servidor/`.
//
// Existia como `vite build --outDir dist-servidor`, e a variável que decide o
// MODO da aplicação ficava por fora, na linha de comando:
//
//   VITE_API_URL=/ npm run build:servidor
//
// Duas consequências, e as duas mordiam em silêncio:
//
//  · Quem esquecia o prefixo — ou rodava `npm run dev:servidor`, que nunca o
//    teve — recebia um bundle em MODO DEMONSTRAÇÃO servido na porta do
//    servidor. Sem erro, sem aviso: a tela abria com a persona fictícia e a
//    conta de verdade simplesmente não existia.
//  · A sintaxe `VAR=valor comando` é do shell POSIX. No `cmd.exe` ela é um
//    erro de comando não encontrado, então o caminho documentado não rodava
//    na máquina de quem desenvolve no Windows.
//
// Agora o script diz o que faz: um build de servidor aponta para a API. Uma
// URL já definida no ambiente é respeitada — é assim que se constrói para uma
// API noutro domínio.

import { build } from "vite";

process.env.VITE_API_URL = process.env.VITE_API_URL || "/";

await build({ build: { outDir: "dist-servidor" } });

console.log(`[build:servidor] dist-servidor/ apontando para VITE_API_URL=${process.env.VITE_API_URL}`);
