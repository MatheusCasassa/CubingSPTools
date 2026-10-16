// Separa as competições em Futuras e Passadas.
// Regra: só é PASSADA a partir do dia seguinte ao último dia da competição
// (hoje ≥ último dia + 1). No próprio último dia ela ainda é futura.
// "Hoje" é a data em UTC-0 (padrão da WCA), calculada a partir da hora do
// servidor (lib/trustedTime) — não do relógio nem do fuso do aparelho. Assim
// todo mundo, em qualquer país, vê a mesma classificação.
import type { CompetitionListItem } from '../../../lib/wca/types'

/** Data de hoje em UTC-0 no formato da WCA (AAAA-MM-DD). */
export function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** Último dia da competição (end_date; se faltar, start_date). */
export function lastDay(c: CompetitionListItem): string {
  return c.end_date || c.start_date || ''
}

export function isPast(c: CompetitionListItem, today: string): boolean {
  const end = lastDay(c)
  // Datas AAAA-MM-DD comparam certo como texto: passada só se hoje > último dia.
  return end !== '' && today > end
}

export function splitCompetitions(
  list: CompetitionListItem[],
  today: string,
): { upcoming: CompetitionListItem[]; past: CompetitionListItem[] } {
  const upcoming = list
    .filter((c) => !isPast(c, today))
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? '')) // mais próxima primeiro
  const past = list
    .filter((c) => isPast(c, today))
    .sort((a, b) => lastDay(b).localeCompare(lastDay(a))) // mais recente primeiro
  return { upcoming, past }
}
