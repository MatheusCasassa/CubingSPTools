// Ranking para escolher EMBARALHADORES.
//
// Regras (Matheus, 16/10):
//  1. Vale o ranking no próprio evento (recordes pessoais no WCIF).
//  2. Variantes de NxN também consideram a modalidade principal:
//     3BLD, 3x3 OH, Multi-BLD, FMC → 3x3 · 4BLD → 4x4 · 5BLD → 5x5.
//     Quem é muito bom no 3x3 é bom embaralhador de 3BLD mesmo sem nunca ter
//     feito 3BLD.
//  3. Evento "novo" (ex.: FTO no começo), onde menos da metade dos inscritos
//     já tem resultado: o Sum of Ranks entra em pé de igualdade — quem se
//     destaca em todas ou quase todas as modalidades costuma ser bom
//     embaralhador. Em eventos normais o Sum of Ranks NÃO é usado.
//
// Para comparar eventos diferentes, cada ranking vira um PERCENTIL entre as
// pessoas aprovadas da competição (0 = melhor da competição, 1 = pior).

import type { Wcif, WcifPerson } from '../../../lib/wca/types'
import { compareRank, hasResultIn, isAccepted, isApproved } from './people'

export const BASE_EVENT: Record<string, string> = {
  '333bf': '333',
  '333oh': '333',
  '333mbf': '333',
  '333fm': '333',
  '333ft': '333',
  '444bf': '444',
  '555bf': '555',
}

/** Evento "raro": menos da metade dos inscritos nele já tem resultado. */
export const RARE_SHARE = 0.5

export type ScrambleSource = 'event' | 'base' | 'sor'

export interface ScrambleRank {
  /** Menor = melhor. Percentil (0–1). */
  score: number
  source: ScrambleSource
  /** Percentil que decidiu (0–1). */
  pct: number
}

export interface ScrambleRanking {
  eventId: string
  baseEventId: string | null
  rare: boolean
  byId: Map<number, ScrambleRank>
}

const cache = new WeakMap<Wcif, Map<string, unknown>>()
function memo<T>(wcif: Wcif, key: string, fn: () => T): T {
  let m = cache.get(wcif)
  if (!m) cache.set(wcif, (m = new Map()))
  if (!m.has(key)) m.set(key, fn())
  return m.get(key) as T
}

const pctOf = (i: number, n: number) => (n <= 1 ? 0 : i / (n - 1))

/** Percentil de cada pessoa aprovada (com resultado) num evento. */
export function eventPercentiles(wcif: Wcif, eventId: string): Map<number, number> {
  return memo(wcif, `pct:${eventId}`, () => {
    const list = wcif.persons.filter((p) => isApproved(p) && hasResultIn(p, eventId))
    list.sort((a, b) => compareRank(a, b, eventId))
    return new Map(list.map((p, i) => [p.registrantId!, pctOf(i, list.length)]))
  })
}

/**
 * Sum of Ranks (singles, ranking mundial) dos aprovados com WCA ID. Evento
 * sem resultado conta como o pior ranking visto na competição + 1 (como na
 * WCA, que usa o total de ranqueados + 1). Devolve o percentil.
 */
export function sumOfRanks(wcif: Wcif): Map<number, number> {
  return memo(wcif, 'sor', () => {
    const people = wcif.persons.filter((p) => isApproved(p) && p.wcaId)
    const worst = new Map<string, number>()
    for (const p of people)
      for (const pb of p.personalBests ?? [])
        if (pb.type === 'single' && pb.worldRanking)
          worst.set(pb.eventId, Math.max(worst.get(pb.eventId) ?? 0, pb.worldRanking))
    const events = [...worst.keys()]
    const sums = people.map((p) => {
      let sum = 0
      for (const e of events) {
        const pb = p.personalBests?.find((b) => b.eventId === e && b.type === 'single' && b.worldRanking)
        sum += pb?.worldRanking ?? worst.get(e)! + 1
      }
      return { id: p.registrantId!, sum, name: p.name }
    })
    sums.sort((a, b) => a.sum - b.sum || a.name.localeCompare(b.name, 'pt-BR'))
    return new Map(sums.map((x, i) => [x.id, pctOf(i, sums.length)]))
  })
}

/** O evento é "raro" (poucos inscritos nele já têm resultado)? */
export function isRareEvent(wcif: Wcif, eventId: string): boolean {
  return memo(wcif, `rare:${eventId}`, () => {
    const registered = wcif.persons.filter(
      (p) => isAccepted(p) && p.registration?.eventIds?.includes(eventId) && p.wcaId,
    )
    if (registered.length === 0) return false
    const withResult = registered.filter((p) => hasResultIn(p, eventId)).length
    return withResult / registered.length < RARE_SHARE
  })
}

export function scramblerRanking(wcif: Wcif, eventId: string): ScrambleRanking {
  return memo(wcif, `scr:${eventId}`, () => {
    const baseEventId = BASE_EVENT[eventId] ?? null
    const rare = isRareEvent(wcif, eventId)
    const ev = eventPercentiles(wcif, eventId)
    const base = baseEventId ? eventPercentiles(wcif, baseEventId) : new Map<number, number>()
    const sor = sumOfRanks(wcif)
    const byId = new Map<number, ScrambleRank>()
    for (const p of wcif.persons) {
      if (!isApproved(p)) continue
      const id = p.registrantId!
      const options: ScrambleRank[] = []
      if (ev.has(id)) options.push({ score: ev.get(id)!, source: 'event', pct: ev.get(id)! })
      if (base.has(id)) options.push({ score: base.get(id)!, source: 'base', pct: base.get(id)! })
      // Sum of Ranks SÓ em evento novo (menos da metade com resultado).
      if (rare && sor.has(id)) {
        const s = sor.get(id)!
        options.push({ score: s, source: 'sor', pct: s })
      }
      if (options.length === 0) continue
      options.sort((a, b) => a.score - b.score)
      byId.set(id, options[0])
    }
    return { eventId, baseEventId, rare, byId }
  })
}

/** Pode embaralhar este evento pelo que marcou no formulário? */
export function puzzleAllowed(
  entry: { scrambler: boolean | null; scramblePuzzles: string[] },
  ranking: ScrambleRanking,
): boolean {
  if (entry.scrambler !== true || entry.scramblePuzzles.length === 0) return true
  if (entry.scramblePuzzles.includes(ranking.eventId)) return true
  if (ranking.baseEventId && entry.scramblePuzzles.includes(ranking.baseEventId)) return true
  // Evento novo (ex.: FTO) costuma nem estar no formulário: não exclui.
  return ranking.rare
}

export function compareScramblers(a: WcifPerson, b: WcifPerson, ranking: ScrambleRanking): number {
  const ra = ranking.byId.get(a.registrantId!)?.score ?? Infinity
  const rb = ranking.byId.get(b.registrantId!)?.score ?? Infinity
  return ra - rb || a.name.localeCompare(b.name, 'pt-BR')
}
