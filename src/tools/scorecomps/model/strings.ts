// Textos impressos na SÚMULA, por idioma. O português é o do Modelo_Aprovado;
// EN e ES seguem os termos usados nas súmulas da WCA nesses idiomas.
import type { Locale } from '../../../i18n/locales'

export interface ScorecardStrings {
  id: string
  group: string
  round: (n: number) => string
  final: string
  dnfIf: (t: string) => string
  cumulative: (t: string) => string
  cumulativeMulti: (t: string) => string
  penaltyExample: string
  fewestMoves: string
  cutoffIf: (t: string) => string
  cutoffMoves: (n: number) => string
  extras: string
}

export const SCORECARD_STRINGS: Record<Locale, ScorecardStrings> = {
  pt: {
    id: 'ID',
    group: 'GRUPO',
    round: (n) => `Rodada ${n}`,
    final: 'Final',
    dnfIf: (t) => `DNF se > ${t}`,
    cumulative: (t) => `Tempo cumulativo de ${t}`,
    cumulativeMulti: (t) => `Tempo cumulativo de ${t} (múltiplas rodadas)`,
    penaltyExample: 'Exemplo de Penalidade: 14.67 + 2 = 16.67',
    fewestMoves: 'Menor nº de movimentos',
    cutoffIf: (t) => `Tempo de corte se > ${t}`,
    cutoffMoves: (n) => `Tempo de corte se > ${n} movimentos`,
    extras: 'Extra(s)',
  },
  en: {
    id: 'ID',
    group: 'GROUP',
    round: (n) => `Round ${n}`,
    final: 'Final',
    dnfIf: (t) => `DNF if > ${t}`,
    cumulative: (t) => `Cumulative limit of ${t}`,
    cumulativeMulti: (t) => `Cumulative limit of ${t} (multiple rounds)`,
    penaltyExample: 'Penalty example: 14.67 + 2 = 16.67',
    fewestMoves: 'Fewest moves',
    cutoffIf: (t) => `Cutoff if > ${t}`,
    cutoffMoves: (n) => `Cutoff if > ${n} moves`,
    extras: 'Extra(s)',
  },
  es: {
    id: 'ID',
    group: 'GRUPO',
    round: (n) => `Ronda ${n}`,
    final: 'Final',
    dnfIf: (t) => `DNF si > ${t}`,
    cumulative: (t) => `Tiempo acumulado de ${t}`,
    cumulativeMulti: (t) => `Tiempo acumulado de ${t} (varias rondas)`,
    penaltyExample: 'Ejemplo de penalización: 14.67 + 2 = 16.67',
    fewestMoves: 'Menor número de movimientos',
    cutoffIf: (t) => `Tiempo de corte si > ${t}`,
    cutoffMoves: (n) => `Tiempo de corte si > ${n} movimientos`,
    extras: 'Extra(s)',
  },
}
