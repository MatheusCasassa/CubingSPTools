// Limite de tempo cumulativo — Regulamento WCA, Artigo A:
//  A1a2   limite da tentativa = o menor entre o limite por tentativa e
//         (limite cumulativo − tempo que já conta nas tentativas anteriores);
//  A1a4   se o cronômetro chega ao limite da tentativa → DNF;
//  A1a5   conta para o limite: o resultado APÓS penalidades (se não for DNF)
//         ou o tempo decorrido (se for DNF);
//  A1a2++ só o resultado final conta: 13:59 cabe em 14:00, 13:59 + 2 não;
//  A1a2+++++ atingido o limite cumulativo, as tentativas restantes são DNS.

import { truncateResult, type Penalty } from './time'

export interface AttemptInput {
  /** Tempo do cronômetro em centésimos (null = ainda não feita). */
  cs: number | null
  penalty: Penalty
}

export type AttemptStatus = 'pending' | 'ok' | 'dnf' | 'dnf-limit' | 'dns'

export interface AttemptOutcome {
  status: AttemptStatus
  /** Limite desta tentativa (cs) — null quando é DNS. */
  limit: number | null
  /** Resultado final (cs) para status ok; null nos demais. */
  result: number | null
  /** Tempo decorrido registrado (cs), usado em "DNF (x)". */
  elapsed: number | null
  /** Quanto esta tentativa consome do limite cumulativo (cs). */
  counted: number
}

export interface CumulativeOutcome {
  attempts: AttemptOutcome[]
  used: number
  remaining: number
  reached: boolean
}

export function computeCumulative(
  inputs: AttemptInput[],
  cumulativeLimit: number | null,
  perAttemptLimit: number | null = null,
): CumulativeOutcome {
  const total = cumulativeLimit ?? Infinity
  const perAttempt = perAttemptLimit ?? Infinity
  let used = 0
  let reached = false
  const attempts: AttemptOutcome[] = []

  for (const inp of inputs) {
    if (reached) {
      attempts.push({ status: 'dns', limit: null, result: null, elapsed: null, counted: 0 })
      continue
    }
    const limit = Math.min(perAttempt, total - used)
    const limitOut = Number.isFinite(limit) ? limit : null

    if (inp.cs == null || inp.cs <= 0) {
      attempts.push({ status: 'pending', limit: limitOut, result: null, elapsed: null, counted: 0 })
      continue
    }

    // O juiz para o cronômetro no limite (A1a4): nunca conta mais que ele.
    const elapsed = Math.min(truncateResult(inp.cs), limit)
    let out: AttemptOutcome
    if (inp.penalty === 'dnf') {
      out = { status: 'dnf', limit: limitOut, result: null, elapsed, counted: elapsed }
    } else {
      const result = truncateResult(inp.cs) + (inp.penalty === '+2' ? 200 : 0)
      if (result >= limit) {
        // Não terminou antes do limite (com penalidade inclusa) → DNF;
        // conta o tempo decorrido (A1a5).
        out = { status: 'dnf-limit', limit: limitOut, result: null, elapsed, counted: elapsed }
      } else {
        out = { status: 'ok', limit: limitOut, result, elapsed, counted: result }
      }
    }
    attempts.push(out)
    used += out.counted
    if (Number.isFinite(total) && used >= total) reached = true
  }

  return {
    attempts,
    used,
    remaining: Number.isFinite(total) ? Math.max(0, total - used) : Infinity,
    reached,
  }
}
