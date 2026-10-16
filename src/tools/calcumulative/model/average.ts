// Média de 5 (Ao5) — Regulamento 9f8: descarta o melhor e o pior e faz a
// média aritmética dos 3 restantes; DNF/DNS é o pior resultado possível
// (dois ou mais DNFs → média DNF). Arredondamento: 9f1/9f2.
//
// Com 4 tempos:
//  BPA (melhor média possível) = 5º solve sendo o melhor → média dos 3 melhores;
//  WPA (pior média possível)   = 5º solve sendo DNF      → média dos 3 piores.

import { roundAverage, truncateResult, type Penalty } from './time'

export interface SolveInput {
  cs: number | null
  penalty: Penalty
}

/** Valor do solve em cs (Infinity = DNF; null = vazio). */
export function solveValue(s: SolveInput): number | null {
  if (s.penalty === 'dnf') return Infinity
  if (s.cs == null || s.cs <= 0) return null
  return truncateResult(s.cs) + (s.penalty === '+2' ? 200 : 0)
}

function meanOf3(vals: number[]): number {
  if (vals.some((v) => !Number.isFinite(v))) return Infinity
  return roundAverage((vals[0] + vals[1] + vals[2]) / 3)
}

/** Ao5 a partir de exatamente 5 valores. */
export function ao5(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return meanOf3(s.slice(1, 4))
}

export interface AverageOutcome {
  count: number
  values: (number | null)[]
  /** Índices (na ordem digitada) do melhor e pior descartados — só com 5. */
  dropped: number[]
  average: number | null
  bpa: number | null
  wpa: number | null
  /** Média simples dos tempos digitados (1 a 3) — só informativa. */
  partialMean: number | null
}

export function computeAverage(solves: SolveInput[]): AverageOutcome {
  const values = solves.map(solveValue)
  const filled = values.filter((v): v is number => v != null)
  const count = filled.length
  const out: AverageOutcome = { count, values, dropped: [], average: null, bpa: null, wpa: null, partialMean: null }

  if (count === 5) {
    out.average = ao5(filled)
    const idx = values.map((v, i) => ({ v: v as number, i })).sort((a, b) => a.v - b.v || a.i - b.i)
    out.dropped = [idx[0].i, idx[4].i]
  } else if (count === 4) {
    const s = [...filled].sort((a, b) => a - b)
    out.bpa = meanOf3(s.slice(0, 3))
    out.wpa = meanOf3(s.slice(1, 4))
  } else if (count > 0) {
    out.partialMean = filled.some((v) => !Number.isFinite(v))
      ? Infinity
      : roundAverage(filled.reduce((a, b) => a + b, 0) / count)
  }
  return out
}

export type TargetResult =
  | { kind: 'guaranteed' }
  | { kind: 'impossible' }
  | { kind: 'needed'; maxResult: number }

/**
 * Com 4 tempos e uma meta de média T: qual o maior resultado no 5º solve
 * que ainda deixa a média ABAIXO de T (sub-T)?
 */
export function neededForTarget(four: number[], target: number): TargetResult {
  const f = (x: number) => ao5([...four, x])
  if (f(Infinity) < target) return { kind: 'guaranteed' }
  if (f(0) >= target) return { kind: 'impossible' }
  let lo = 0 // f(lo) < target
  let hi = 100 * 60 * 600 // 10 h — certamente f(hi) >= target
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (f(mid) < target) lo = mid
    else hi = mid
  }
  return { kind: 'needed', maxResult: lo }
}
