// Regras da súmula a partir do WCIF (formato, tempo de corte, limite de tempo).
// Mesmas regras do Modelo_Aprovado:
//  • nº de solves vem SEMPRE do formato da rodada (a=5, m/3=3, 2=2, 1=1) — nunca
//    do evento (ex.: 3BLD virou Bo5/Ao5 em 2026 e o WCIF já reflete isso);
//  • só há divisão em blocos quando existe tempo de corte de verdade;
//  • "DNF se > X" (limite simples) ou "Tempo cumulativo de X" (+ múltiplas rodadas);
//  • "Exemplo de Penalidade" em todo evento cronometrado (exceto FMC/Multi);
//  • FMC: "Menor nº de movimentos"; extras E1/E2 com coluna D (Delegado).

import type { WcifFormatId, WcifRound } from '../../../lib/wca/types'
import { formatCentis } from '../../../lib/wca/format'

export const PENALTY_EXAMPLE = 'Exemplo de Penalidade: 14.67 + 2 = 16.67'

export interface ScorecardRow {
  /** Rótulo da linha: "1".."5" ou "E1"/"E2". */
  label: string
  isExtra: boolean
}

/** Layout compartilhado por todas as súmulas de uma mesma rodada. */
export interface RoundLayout {
  solveCount: number
  block1: ScorecardRow[]
  /** Solves após o corte (vazio quando não há corte). */
  block2: ScorecardRow[]
  extras: ScorecardRow[]
  /** "DNF se > X" / "Tempo cumulativo de X" / "Menor nº de movimentos" / null. */
  dnfText: string | null
  penaltyText: string | null
  cutoffText: string
  extrasText: string
}

const SOLVES_BY_FORMAT: Record<WcifFormatId, number> = { '1': 1, '2': 2, '3': 3, m: 3, a: 5 }
const EXTRA_COUNT = 2

function rows(from: number, to: number): ScorecardRow[] {
  const out: ScorecardRow[] = []
  for (let i = from; i <= to; i++) out.push({ label: String(i), isExtra: false })
  return out
}

export function buildRoundLayout(round: WcifRound, eventId: string): RoundLayout {
  const solveCount = SOLVES_BY_FORMAT[round.format] ?? 5
  const isFmc = eventId === '333fm'
  const isMulti = eventId === '333mbf'

  const cutoffAttempts =
    round.cutoff && round.cutoff.numberOfAttempts > 0 && round.cutoff.numberOfAttempts < solveCount
      ? round.cutoff.numberOfAttempts
      : null

  const block1 = rows(1, cutoffAttempts ?? solveCount)
  const block2 = cutoffAttempts != null ? rows(cutoffAttempts + 1, solveCount) : []

  const extras: ScorecardRow[] = []
  for (let i = 1; i <= EXTRA_COUNT; i++) extras.push({ label: `E${i}`, isExtra: true })

  let dnfText: string | null = null
  const tl = round.timeLimit
  if (isFmc) {
    dnfText = 'Menor nº de movimentos'
  } else if (tl && tl.cumulativeRoundIds && tl.cumulativeRoundIds.length > 0) {
    const t = formatCentis(tl.centiseconds)
    dnfText =
      tl.cumulativeRoundIds.length > 1
        ? `Tempo cumulativo de ${t} (múltiplas rodadas)`
        : `Tempo cumulativo de ${t}`
  } else if (tl && tl.centiseconds > 0 && !isMulti) {
    dnfText = `DNF se > ${formatCentis(tl.centiseconds)}`
  }

  const cutoffText =
    block2.length > 0 && round.cutoff
      ? isFmc
        ? `Tempo de corte se > ${round.cutoff.attemptResult} movimentos`
        : `Tempo de corte se > ${formatCentis(round.cutoff.attemptResult)}`
      : ''

  return {
    solveCount,
    block1,
    block2,
    extras,
    dnfText,
    penaltyText: isFmc || isMulti ? null : PENALTY_EXAMPLE,
    cutoffText,
    extrasText: 'Extra(s)',
  }
}

/** Uma súmula individual. Campos vazios = súmula em branco (preencher à mão). */
export interface ScorecardModel {
  competitionName: string
  /** Linha do evento, ex.: "3x3x3 Cube · Rodada 1". */
  eventName: string
  competitorId: string
  wcaId: string | null
  group: string
  competitorName: string
  layout: RoundLayout
  /** Chaves de agrupamento (para dividir arquivos por rodada/grupo). */
  roundId: string
  groupKey: string
}
