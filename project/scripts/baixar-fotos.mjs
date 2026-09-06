// Baixa as fotos dos lotes para public/fotos/, uma vez, para que a aplicação
// carregue sem nenhuma requisição a terceiros (FRONT-014).
//
//   npm run fotos:baixar
//   echo 'VITE_PHOTO_BASE=/fotos' >> .env.local
//
// Depois disso a CSP pode dispensar images.unsplash.com em img-src.
//
// As imagens são de banco de imagens e ilustram lotes fictícios; ao publicar,
// confira a licença e a atribuição exigidas pela fonte.

import { mkdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LOTS } from "../src/data.js";
import { PHOTO_SIZES } from "../src/lib/photos.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = join(RAIZ, "public", "fotos");
const FONTE = "https://images.unsplash.com/photo-";

const larguras = [...new Set(Object.values(PHOTO_SIZES).flatMap((p) => p.widths))].sort((a, b) => a - b);
const ids = [...new Set(LOTS.flatMap((l) => l.photoIds || []))];

await mkdir(DESTINO, { recursive: true });
console.log(`${ids.length} fotos × ${larguras.length} larguras (${larguras.join(", ")}) → public/fotos/`);

let baixadas = 0, existentes = 0, falhas = 0;
for (const id of ids) {
  for (const w of larguras) {
    const arquivo = join(DESTINO, `${id}-${w}.jpg`);
    try {
      await access(arquivo);
      existentes++;
      continue;
    } catch { /* ainda não existe */ }

    const url = `${FONTE}${id}?auto=format&fit=crop&w=${w}&q=70`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await writeFile(arquivo, Buffer.from(await r.arrayBuffer()));
      baixadas++;
      process.stdout.write(".");
    } catch (e) {
      falhas++;
      console.error(`\nfalhou ${id}-${w}: ${e.message}`);
    }
  }
}

console.log(`\nbaixadas ${baixadas} · já existiam ${existentes} · falhas ${falhas}`);
if (falhas) {
  console.error("Alguma foto não veio. Rode de novo: o script pula o que já está em disco.");
  process.exitCode = 1;
}
