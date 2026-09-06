// Fontes de imagem responsivas (FRONT-003).
//
// Antes toda foto era pedida em 1100 px de largura, inclusive miniaturas de
// 70 px, e as quatro fotos de cada card eram baixadas mesmo com três
// invisíveis. Aqui cada uso declara o tamanho de que precisa e o navegador
// escolhe a variante pelo `srcset`.
//
// As imagens são de banco de imagens e, em modo demonstração, a interface as
// rotula como ilustrativas (SEC-007).

import { PHOTO_BASE } from "./config.js";

const UNSPLASH = "https://images.unsplash.com/photo-";

/** Larguras oferecidas ao navegador, por contexto de uso. */
export const PHOTO_SIZES = {
  thumb: { widths: [160, 320], sizes: "160px" },
  card: { widths: [480, 720, 960], sizes: "(max-width: 640px) 100vw, 360px" },
  hero: { widths: [720, 1100, 1600], sizes: "(max-width: 900px) 100vw, 800px" },
};

// Com VITE_PHOTO_BASE definido, as fotos vêm do próprio domínio e nenhuma
// requisição sai para terceiros no carregamento.
const url = (id, w) =>
  PHOTO_BASE ? `${PHOTO_BASE}/${id}-${w}.jpg` : `${UNSPLASH}${id}?auto=format&fit=crop&w=${w}&q=70`;

/**
 * @param {string} id identificador da foto no Unsplash
 * @param {keyof typeof PHOTO_SIZES} context
 * @returns {{src: string, srcSet: string, sizes: string}|null}
 */
export function photoSources(id, context = "card") {
  if (!id) return null;
  const preset = PHOTO_SIZES[context] || PHOTO_SIZES.card;
  return {
    src: url(id, preset.widths[Math.floor(preset.widths.length / 2)]),
    srcSet: preset.widths.map((w) => `${url(id, w)} ${w}w`).join(", "),
    sizes: preset.sizes,
  };
}

/** Texto alternativo descritivo — antes todas as fotos tinham alt vazio. */
export function photoAlt(lot, index = 0) {
  if (!lot) return "";
  const ambientes = ["sala", "cozinha", "quarto", "área externa"];
  const angulos = ["frente", "lateral", "traseira", "interior"];
  const tags = lot.category === "carro" ? angulos : ambientes;
  return `${lot.title} — ${tags[index % tags.length]}`;
}
