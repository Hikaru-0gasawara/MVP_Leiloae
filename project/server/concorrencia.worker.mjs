// Um disputante. Abre a PRÓPRIA conexão com o mesmo arquivo de banco e tenta
// dar lances o mais rápido que consegue. Rodando vários em paralelo, a disputa
// pelo escritor é real — dentro de um só processo, `node:sqlite` é síncrono e
// nunca haveria intercalação para testar.
import { workerData, parentPort } from "node:worker_threads";
import { abrirBanco, buscarLote } from "./db.js";
import { darLance } from "./bids.js";
import { minBidFor } from "../src/domain/auction.js";

const { caminhoDb, usuarioId, loteId, tentativas, valorFixo } = workerData;
const db = abrirBanco(caminhoDb);

const aceitos = [];
const recusados = [];

for (let i = 0; i < tentativas; i++) {
  const valor = valorFixo ?? minBidFor(buscarLote(db, loteId));
  try {
    const r = darLance(db, { loteId, usuarioId, valor });
    (r.erro ? recusados : aceitos).push(r.erro || r.lance.value);
  } catch (e) {
    recusados.push("excecao:" + e.message);
  }
}

parentPort.postMessage({ aceitos, recusados });
