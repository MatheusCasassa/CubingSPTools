// Textos impressos na SÚMULA, por idioma. O português é o do Modelo_Aprovado;
// EN e ES seguem os termos usados nas súmulas da WCA nesses idiomas.
import type { Locale } from '../../../i18n/locales'

export interface ScorecardStrings {
  id: string
  group: string
  /** Coluna de conferência do embaralhamento (2º embaralhador). */
  check: string
  /** Número da estação/mesa (WCIF). */
  station: string
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
  /** Súmula em branco genérica: linha do evento e campos para preencher. */
  blankEventLine: string
  blankTimeLimit: string
  blankCutoff: string
  /** Capa do grupo. */
  cover: {
    of: string
    group: string
    scheduled: string
    actual: string
    set: string
    delegate: string
    grouped: (n: number) => string
    signatures: string
    incidents: string
    delegateInitials: string
    data: string
    entered: string
    enteredInitials: string
    incidentsLogged: string
    verified: string
  }
}

export const SCORECARD_STRINGS: Record<Locale, ScorecardStrings> = {
  pt: {
    id: 'ID',
    group: 'GRUPO',
    check: 'CONF.',
    station: 'Mesa',
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
    blankEventLine: 'Modalidade: ______________  Rodada: ____',
    blankTimeLimit: 'Limite de tempo: ____________',
    blankCutoff: 'Tempo de corte se > ____________',
    cover: {
      of: 'de',
      group: 'Grupo',
      scheduled: 'Previsto',
      actual: 'Real',
      set: 'Set',
      delegate: 'PARA O DELEGADO',
      grouped: (n) => `Todas as ${n} súmulas agrupadas`,
      signatures: 'Assinaturas faltantes conferidas',
      incidents: 'Nº de súmulas com incidentes:',
      delegateInitials: 'Rubrica do Delegado',
      data: 'PARA A EQUIPE DE DADOS',
      entered: 'Resultados lançados pelo digitador',
      enteredInitials: 'Rubrica do digitador',
      incidentsLogged: 'Incidentes registrados pelo Delegado',
      verified: 'Resultados conferidos pelo Delegado',
    },
  },
  en: {
    id: 'ID',
    group: 'GROUP',
    check: 'CHECK',
    station: 'Station',
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
    blankEventLine: 'Event: ______________  Round: ____',
    blankTimeLimit: 'Time limit: ____________',
    blankCutoff: 'Cutoff if > ____________',
    cover: {
      of: 'of',
      group: 'Group',
      scheduled: 'Scheduled',
      actual: 'Actual',
      set: 'Set',
      delegate: 'FOR THE DELEGATE',
      grouped: (n) => `All ${n} scorecards grouped`,
      signatures: 'Missing signatures checked',
      incidents: 'Scorecards with incidents:',
      delegateInitials: 'Delegate initials',
      data: 'FOR DATA ENTRY',
      entered: 'Results entered by the scoretaker',
      enteredInitials: 'Scoretaker initials',
      incidentsLogged: 'Incidents recorded by the Delegate',
      verified: 'Results checked by the Delegate',
    },
  },
  es: {
    id: 'ID',
    group: 'GRUPO',
    check: 'REV.',
    station: 'Estación',
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
    blankEventLine: 'Modalidad: ______________  Ronda: ____',
    blankTimeLimit: 'Tiempo límite: ____________',
    blankCutoff: 'Tiempo de corte si > ____________',
    cover: {
      of: 'de',
      group: 'Grupo',
      scheduled: 'Previsto',
      actual: 'Real',
      set: 'Set',
      delegate: 'PARA EL DELEGADO',
      grouped: (n) => `Agrupadas todas las ${n} hojas`,
      signatures: 'Verificadas las firmas faltantes',
      incidents: 'Número de hojas con incidentes:',
      delegateInitials: 'Iniciales del Delegado',
      data: 'PARA INGRESO DE DATOS',
      entered: 'Resultados ingresados por el digitador',
      enteredInitials: 'Iniciales del digitador',
      incidentsLogged: 'Incidentes registrados por el Delegado',
      verified: 'Resultados verificados por el Delegado',
    },
  },
}
