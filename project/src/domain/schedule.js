// Agenda dos leilões (BIZ-003).
//
// Antes cada lote usava `endsAt: Date.now() + Xh`, avaliado na importação do
// módulo: os prazos reiniciavam a cada F5 e dois usuários viam leilões
// diferentes. Agora o encerramento é um instante ABSOLUTO, derivado de uma
// época fixa e de um deslocamento por lote — igual para todo mundo e estável
// entre recargas dentro do mesmo ciclo.
//
// Sem servidor, o ciclo se repete a cada 48 h para que o catálogo de
// demonstração continue vivo. Com backend, `endsAt` passa a vir do servidor em
// UTC e esta função sai de cena: é o único ponto a trocar.

/** Época fixa da agenda (UTC). */
export const EPOCH = Date.UTC(2026, 0, 5, 0, 0, 0);

/** Duração do ciclo de renovação do catálogo de demonstração. */
export const CYCLE_MS = 48 * 60 * 60 * 1000;

/**
 * Instante absoluto de encerramento para um lote, dado seu deslocamento em
 * horas dentro do ciclo. Determinística em função de `now`, o que a torna
 * testável e idêntica para usuários simultâneos.
 */
export function scheduledEnd(offsetHours, now = Date.now()) {
  const offset = Math.round(offsetHours * 60 * 60 * 1000);
  const cycleIndex = Math.floor((now - EPOCH) / CYCLE_MS);
  let end = EPOCH + cycleIndex * CYCLE_MS + offset;
  // Se o horário do lote já passou neste ciclo, ele encerra no próximo.
  while (end <= now) end += CYCLE_MS;
  return end;
}

/** Instante absoluto fixo no passado, para lotes já encerrados. */
export function closedAt(daysAgo, now = Date.now()) {
  return now - daysAgo * 24 * 60 * 60 * 1000;
}
