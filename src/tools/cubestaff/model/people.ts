// Pessoas: quem compete em cada rodada, ranking, novatos e Delegados.

import type { Wcif, WcifPerson, WcifRound } from '../../../lib/wca/types'
import { BLD_EVENTS } from './types'

export const isNewcomer = (p: WcifPerson) => !p.wcaId

/** Delegado ou Delegado trainee da competição (papel no WCIF). */
export const isDelegate = (p: WcifPerson) => (p.roles ?? []).some((r) => r === 'delegate' || r === 'trainee-delegate')

export const isAccepted = (p: WcifPerson) => {
  const reg = p.registration
  return !!reg && (reg.status === 'accepted' || reg.status === undefined) && reg.isCompeting !== false
}

export function personalBest(p: WcifPerson, eventId: string, type: 'single' | 'average'): number {
  const pb = p.personalBests?.find((b) => b.eventId === eventId && b.type === type)
  return pb && pb.best > 0 ? pb.best : Infinity
}

/** Chave de ranking (menor = mais rápido). Às cegas: single primeiro. */
export function rankKey(p: WcifPerson, eventId: string): [number, number] {
  const avg = personalBest(p, eventId, 'average')
  const single = personalBest(p, eventId, 'single')
  return BLD_EVENTS.has(eventId) ? [single, avg] : [avg, single]
}

export const hasResultIn = (p: WcifPerson, eventId: string) =>
  rankKey(p, eventId)[0] !== Infinity || rankKey(p, eventId)[1] !== Infinity

export function compareRank(a: WcifPerson, b: WcifPerson, eventId: string, tag = 'pt-BR'): number {
  const ka = rankKey(a, eventId)
  const kb = rankKey(b, eventId)
  if (ka[0] !== kb[0]) return ka[0] - kb[0] || 0
  if (ka[1] !== kb[1]) return ka[1] - kb[1] || 0
  return a.name.localeCompare(b.name, tag)
}

export function personsById(wcif: Wcif): Map<number, WcifPerson> {
  const map = new Map<number, WcifPerson>()
  for (const p of wcif.persons) if (p.registrantId != null) map.set(p.registrantId, p)
  return map
}

export function findRound(
  wcif: Wcif,
  roundId: string,
): { round: WcifRound; number: number; total: number; eventId: string } | null {
  const eventId = roundId.split('-')[0]
  const event = wcif.events.find((e) => e.id === eventId)
  if (!event) return null
  const idx = event.rounds.findIndex((r) => r.id === roundId)
  if (idx < 0) return null
  return { round: event.rounds[idx], number: idx + 1, total: event.rounds.length, eventId }
}

const hasAttempts = (r: { attempts: { result: number }[] }) => r.attempts?.some((a) => a.result !== 0)

/**
 * Quem avança da rodada anterior, calculado pelos resultados dela (quando o
 * WCA Live ainda não abriu a rodada seguinte, mas já sincronizou a anterior).
 */
export function advancingFromPrevious(prev: WcifRound): number[] | null {
  const results = (prev.results ?? []).filter(hasAttempts)
  if (results.length === 0) return null
  const cond = prev.advancementCondition
  const ranked = results.filter((r) => r.ranking != null).sort((a, b) => (a.ranking ?? 0) - (b.ranking ?? 0))
  // Regulamento 9p1: no máximo 75% avançam.
  const max75 = Math.floor(ranked.length * 0.75)
  let limit = max75
  if (cond?.type === 'ranking') limit = Math.min(cond.level, max75)
  if (cond?.type === 'percent') limit = Math.min(Math.floor((ranked.length * cond.level) / 100), max75)
  let pool = ranked
  if (cond?.type === 'attemptResult') {
    pool = ranked.filter((r) => {
      const v = prev.format === 'a' || prev.format === 'm' ? r.average : r.best
      return v != null && v > 0 && v < cond.level
    })
  }
  // Empates na última posição avançam juntos (dentro do limite de 75%).
  const cut = pool.slice(0, limit)
  const lastRank = cut.at(-1)?.ranking
  const ties = pool.slice(limit).filter((r) => r.ranking === lastRank)
  const out = [...cut, ...ties]
  return out.length <= max75 ? out.map((r) => r.personId) : cut.map((r) => r.personId)
}

export type CompetitorSource = 'registrations' | 'results' | 'previousResults' | 'unknown'

/**
 * Competidores da rodada:
 *  - 1ª rodada: inscrições aceitas no evento (menos os ausentes);
 *  - seguintes: a lista do WCA Live (results da própria rodada, sincronizada
 *    com a WCA) ou, se ainda não aberta, o cálculo pelos resultados anteriores.
 */
export function roundCompetitors(
  wcif: Wcif,
  roundId: string,
  absent: Set<number>,
): { ids: number[]; source: CompetitorSource } {
  const info = findRound(wcif, roundId)
  if (!info) return { ids: [], source: 'unknown' }
  const byId = personsById(wcif)
  if (info.number === 1) {
    const ids = wcif.persons
      .filter((p) => p.registrantId != null && isAccepted(p) && p.registration?.eventIds?.includes(info.eventId))
      .map((p) => p.registrantId!)
      .filter((id) => !absent.has(id))
    return { ids, source: 'registrations' }
  }
  const own = info.round.results ?? []
  if (own.length > 0) return { ids: own.map((r) => r.personId).filter((id) => byId.has(id)), source: 'results' }
  const event = wcif.events.find((e) => e.id === info.eventId)!
  const prev = event.rounds[info.number - 2]
  const adv = prev ? advancingFromPrevious(prev) : null
  if (adv) return { ids: adv.filter((id) => byId.has(id)), source: 'previousResults' }
  return { ids: [], source: 'unknown' }
}

/** Estimativa de competidores numa rodada (para a conta "≈ N por grupo"). */
export function estimateCompetitors(wcif: Wcif, roundId: string, absent: Set<number>): number {
  const known = roundCompetitors(wcif, roundId, absent)
  if (known.source !== 'unknown') return known.ids.length
  const info = findRound(wcif, roundId)
  if (!info) return 0
  const event = wcif.events.find((e) => e.id === info.eventId)!
  let count = roundCompetitors(wcif, event.rounds[0].id, absent).ids.length
  for (let i = 0; i < info.number - 1; i++) {
    const cond = event.rounds[i].advancementCondition
    const max75 = Math.floor(count * 0.75)
    if (cond?.type === 'ranking') count = Math.min(cond.level, max75)
    else if (cond?.type === 'percent') count = Math.min(Math.floor((count * cond.level) / 100), max75)
    else count = max75
  }
  return count
}

/** Normaliza nomes para comparação (sem acentos, minúsculas, sem "(...)" ). */
export function normalizeName(s: string): string {
  return s
    .replace(/\(.*?\)/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
