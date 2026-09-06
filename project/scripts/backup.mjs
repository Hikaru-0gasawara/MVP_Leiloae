// Cópia de segurança do banco e política de retenção.
//
// Registrado em docs/api.md como pendência: "sem backup nem política de
// retenção definidos para o arquivo SQLite". O arquivo é o produto inteiro —
// contas, lances e a trilha de auditoria — e até aqui a única cópia que existia
// era a que alguém lembrasse de fazer na mão.
//
//   npm run backup
//
// Configuração por ambiente (nenhum segredo, nenhum valor no código):
//
//   LEILOAE_DB             banco de origem            (padrão ./dados/leiloae.db)
//   LEILOAE_BACKUP_DIR     pasta de destino           (padrão ./backups)
//   LEILOAE_BACKUP_DIAS    retenção em dias           (padrão 30)
//   LEILOAE_BACKUP_MINIMO  cópias sempre preservadas  (padrão 7)
//
// Três decisões que fazem a diferença entre isto e um `cp`:
//
//  · A cópia sai de `VACUUM INTO`, não do sistema de arquivos. Com WAL ligado,
//    copiar o arquivo enquanto o servidor escreve produz um banco truncado no
//    meio de uma transação — que parece um backup até o dia em que precisa ser
//    restaurado. `VACUUM INTO` roda dentro do próprio SQLite e escreve um
//    banco consistente, sem parar quem está escrevendo.
//  · A cópia é ABERTA E CONFERIDA antes de qualquer coisa ser apagada. Backup
//    que ninguém tenta ler é fé, não cópia de segurança.
//  · A retenção nunca apaga tudo. Um relógio errado ou uma pasta recém-criada
//    deixariam todas as cópias "velhas" no mesmo instante; o mínimo por
//    contagem é o que impede a limpeza de virar o incidente.

import { mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const ORIGEM = resolve(process.env.LEILOAE_DB || "./dados/leiloae.db");
const DESTINO = resolve(process.env.LEILOAE_BACKUP_DIR || "./backups");
const DIAS = Number(process.env.LEILOAE_BACKUP_DIAS || 30);
const MINIMO = Number(process.env.LEILOAE_BACKUP_MINIMO || 7);

const PREFIXO = "leiloae-";
const SUFIXO = ".db";
/** Tabelas sem as quais a cópia não serve para restaurar nada. */
const TABELAS_ESPERADAS = ["usuarios", "lotes", "lances", "eventos"];

/** Nome ordenável por si só: ordem alfabética = ordem cronológica. */
const nomeDaCopia = (agora = new Date()) =>
  `${PREFIXO}${agora.toISOString().replace(/[:.]/g, "-").replace("Z", "")}${SUFIXO}`;

/**
 * Escreve uma cópia consistente e confere que ela abre.
 * @param {string} origem
 * @param {string} arquivo
 */
export function copiar(origem, arquivo) {
  const db = new DatabaseSync(origem, { readOnly: true });
  try {
    // O caminho entra como literal porque VACUUM INTO não aceita parâmetro.
    // Aspas simples duplicadas é o escape de string do próprio SQLite.
    db.exec(`VACUUM INTO '${arquivo.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
  return conferir(arquivo);
}

/**
 * Abre a cópia e confere integridade e presença das tabelas.
 * @param {string} arquivo
 * @returns {{ok: true, bytes: number, contagens: Record<string, number>}}
 */
export function conferir(arquivo) {
  const db = new DatabaseSync(arquivo, { readOnly: true });
  try {
    const integridade = db.prepare("PRAGMA integrity_check").get();
    const veredito = Object.values(integridade || {})[0];
    if (veredito !== "ok") throw new Error(`integrity_check devolveu "${veredito}"`);

    /** @type {Record<string, number>} */
    const contagens = {};
    for (const tabela of TABELAS_ESPERADAS) {
      contagens[tabela] = db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get().n;
    }
    return { ok: true, bytes: statSync(arquivo).size, contagens };
  } finally {
    db.close();
  }
}

/**
 * Aplica a retenção. Devolve o que foi (ou seria) apagado.
 *
 * @param {string} pasta
 * @param {{dias?: number, minimo?: number, agora?: number, aplicar?: boolean}} [opcoes]
 */
export function aplicarRetencao(pasta, { dias = DIAS, minimo = MINIMO, agora = Date.now(), aplicar = true } = {}) {
  const copias = readdirSync(pasta)
    .filter((n) => n.startsWith(PREFIXO) && n.endsWith(SUFIXO))
    .map((nome) => ({ nome, caminho: join(pasta, nome), em: statSync(join(pasta, nome)).mtimeMs }))
    .sort((a, b) => b.em - a.em); // mais nova primeiro

  const limite = agora - dias * 24 * 60 * 60 * 1000;
  // As `minimo` mais novas ficam de fora da regra de idade, sempre.
  const candidatas = copias.slice(minimo).filter((c) => c.em < limite);
  if (aplicar) for (const c of candidatas) unlinkSync(c.caminho);
  return { total: copias.length, apagadas: candidatas.map((c) => c.nome) };
}

/** Execução direta: `npm run backup`. */
export async function principal() {
  if (!existsSync(ORIGEM)) {
    console.error(`[backup] banco não encontrado em ${ORIGEM}. Defina LEILOAE_DB ou rode o servidor uma vez.`);
    process.exitCode = 1;
    return;
  }
  mkdirSync(DESTINO, { recursive: true });

  const arquivo = join(DESTINO, nomeDaCopia());
  const { bytes, contagens } = copiar(ORIGEM, arquivo);
  const linhas = Object.entries(contagens).map(([t, n]) => `${t}=${n}`).join(" ");
  console.log(`[backup] ${arquivo}  ${(bytes / 1024).toFixed(1)} KiB  (${linhas})`);

  const { total, apagadas } = aplicarRetencao(DESTINO);
  console.log(
    `[backup] retenção: ${dias_texto()} · ${total} cópias na pasta` +
    (apagadas.length ? ` · ${apagadas.length} apagada(s)` : "")
  );
}

const dias_texto = () => `${DIAS} dias, mínimo de ${MINIMO} cópias`;

if (process.argv[1] && resolve(process.argv[1]).endsWith("backup.mjs")) await principal();
