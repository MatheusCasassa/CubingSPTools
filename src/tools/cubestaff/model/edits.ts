// Edições manuais do plano. Toda edição TRAVA o item editado, para que
// "Gerar de novo" preserve o que foi feito à mão.

import type { Wcif } from '../../../lib/wca/types'
import { type GroupPlan, type Plan, type Ref, type StaffRole, lockKey, pref, refId } from './types'
import { compareScramblers, scramblerRanking, type ScrambleRank } from './scramblerRank'
import { agendaFor, isAvailable, slotOf, slotsByRound } from './engine'
import { competitionTimezone, overlaps } from './schedule'
import { findRound, hasResultIn, isAccepted, isApproved, isDelegate, isNewcomer, personsById } from './people'

const touch = (plan: Plan) => {
  plan.updatedAt = new Date().toISOString()
}

function group(plan: Plan, roundId: string, n: number): GroupPlan {
  const g = plan.rounds[roundId]?.groups.find((x) => x.number === n)
  if (!g) throw new Error(`Grupo ${roundId} ${n} não existe`)
  return g
}

const listOf = (g: GroupPlan, role: StaffRole) =>
  role === 'judge' ? g.judges : role === 'scrambler' ? g.scramblers : g.runners

function dropEverywhereInGroup(g: GroupPlan, ref: Ref) {
  g.judges = g.judges.filter((r) => r !== ref)
  g.scramblers = g.scramblers.filter((r) => r !== ref)
  g.runners = g.runners.filter((r) => r !== ref)
  g.reserves = g.reserves.filter((r) => r !== ref)
  g.locked = g.locked.filter((k) => !k.endsWith(`:${ref}`) || k.startsWith('competitor:'))
}

export function moveCompetitor(src: Plan, roundId: string, id: number, toGroup: number): Plan {
  const plan = structuredClone(src)
  const rp = plan.rounds[roundId]
  for (const g of rp.groups) {
    g.competitors = g.competitors.filter((x) => x !== id)
    g.locked = g.locked.filter((k) => k !== lockKey('competitor', pref(id)))
  }
  const target = group(plan, roundId, toGroup)
  target.competitors.push(id)
  target.locked.push(lockKey('competitor', pref(id)))
  // Quem compete não pode ser staff no mesmo grupo.
  dropEverywhereInGroup(target, pref(id))
  touch(plan)
  return plan
}

export function addCompetitor(src: Plan, roundId: string, id: number, toGroup: number): Plan {
  return moveCompetitor(src, roundId, id, toGroup)
}

export function removeCompetitor(src: Plan, roundId: string, id: number): Plan {
  const plan = structuredClone(src)
  for (const g of plan.rounds[roundId].groups) {
    g.competitors = g.competitors.filter((x) => x !== id)
    g.locked = g.locked.filter((k) => k !== lockKey('competitor', pref(id)))
  }
  touch(plan)
  return plan
}

export function addStaff(src: Plan, roundId: string, n: number, role: StaffRole, ref: Ref): Plan {
  const plan = structuredClone(src)
  const g = group(plan, roundId, n)
  dropEverywhereInGroup(g, ref)
  const id = refId(ref)
  if (id != null) g.competitors = g.competitors.filter((x) => x !== id)
  listOf(g, role).push(ref)
  g.locked = [...g.locked.filter((k) => !k.endsWith(`:${ref}`)), lockKey(role, ref)]
  touch(plan)
  return plan
}

export function removeStaff(src: Plan, roundId: string, n: number, role: StaffRole, ref: Ref): Plan {
  const plan = structuredClone(src)
  const g = group(plan, roundId, n)
  const l = listOf(g, role).filter((r) => r !== ref)
  if (role === 'judge') g.judges = l
  else if (role === 'scrambler') g.scramblers = l
  else g.runners = l
  g.locked = g.locked.filter((k) => k !== lockKey(role, ref))
  touch(plan)
  return plan
}

/** Troca alguém do staff por um suplente (ex.: juiz que não apareceu). */
export function replaceWithReserve(
  src: Plan,
  roundId: string,
  n: number,
  role: StaffRole,
  out: Ref,
  reserve: Ref,
): Plan {
  let plan = removeStaff(src, roundId, n, role, out)
  plan = addStaff(plan, roundId, n, role, reserve)
  const g = group(plan, roundId, n)
  g.reserves = g.reserves.filter((r) => r !== reserve)
  return plan
}

export function addReserve(src: Plan, roundId: string, n: number, ref: Ref): Plan {
  const plan = structuredClone(src)
  const g = group(plan, roundId, n)
  if (!g.reserves.includes(ref)) g.reserves.push(ref)
  g.locked = [...g.locked.filter((k) => k !== lockKey('reserve', ref)), lockKey('reserve', ref)]
  touch(plan)
  return plan
}

export function removeReserve(src: Plan, roundId: string, n: number, ref: Ref): Plan {
  const plan = structuredClone(src)
  const g = group(plan, roundId, n)
  g.reserves = g.reserves.filter((r) => r !== ref)
  g.locked = g.locked.filter((k) => k !== lockKey('reserve', ref))
  touch(plan)
  return plan
}

export function toggleLock(src: Plan, roundId: string, n: number, key: string): Plan {
  const plan = structuredClone(src)
  const g = group(plan, roundId, n)
  g.locked = g.locked.includes(key) ? g.locked.filter((k) => k !== key) : [...g.locked, key]
  touch(plan)
  return plan
}

export function unlockRound(src: Plan, roundId: string): Plan {
  const plan = structuredClone(src)
  plan.rounds[roundId]?.groups.forEach((g) => (g.locked = []))
  touch(plan)
  return plan
}

export function clearRound(src: Plan, roundId: string): Plan {
  const plan = structuredClone(src)
  delete plan.rounds[roundId]
  touch(plan)
  return plan
}

// ------------------------------------------------------------- candidatos

function roleIn(g: GroupPlan | undefined, ref: Ref): StaffRole | 'reserve' | null {
  if (!g) return null
  if (g.judges.includes(ref)) return 'judge'
  if (g.scramblers.includes(ref)) return 'scrambler'
  if (g.runners.includes(ref)) return 'runner'
  if (g.reserves.includes(ref)) return 'reserve'
  return null
}

export interface Candidate {
  ref: Ref
  name: string
  wcaId: string | null
  inList: boolean
  newcomer: boolean
  delegate: boolean
  available: boolean
  /** Ocupado (compete ou faz staff) em algo simultâneo — inclusive neste grupo. */
  busy: boolean
  competingHere: boolean
  /** Função que a pessoa já tem neste grupo (staff). */
  roleHere: StaffRole | 'reserve' | null
  load: number
  /** Tem resultado no evento. */
  hasResult: boolean
  /** Ranking de embaralhador: por onde a pessoa se classifica (ver scramblerRank). */
  scramble: ScrambleRank | null
  extra: boolean
}

export function candidates(
  wcif: Wcif,
  plan: Plan,
  roundId: string,
  n: number,
  role: StaffRole | 'competitor' | 'reserve',
): Candidate[] {
  const byId = personsById(wcif)
  const entries = new Map(plan.staff.map((s) => [s.registrantId, s]))
  const sched = slotsByRound(wcif, plan).get(roundId)
  const slot = slotOf(sched, n)
  const agenda = agendaFor(wcif, plan)
  const g = plan.rounds[roundId]?.groups.find((x) => x.number === n)
  const tz = competitionTimezone(wcif)
  const eventId = roundId.split('-')[0]
  const info = findRound(wcif, roundId)
  const ranking = scramblerRanking(wcif, eventId)
  const out: Candidate[] = []
  // Só inscrições aprovadas; para competir, só competidores aprovados.
  for (const p of wcif.persons) {
    if (p.registrantId == null || !isApproved(p)) continue
    if (role === 'competitor' && !isAccepted(p)) continue
    if (role === 'competitor' && !(p.registration?.eventIds ?? []).includes(eventId) && info?.number === 1) continue
    const ref = pref(p.registrantId)
    const competingHere = !!g?.competitors.includes(p.registrantId)
    const roleHere = roleIn(g, ref)
    const busy = agenda
      .get(ref)
      .some((b) => overlaps(b, slot) && !(b.roundId === roundId && b.group === n && b.role !== 'competitor'))
    out.push({
      ref,
      name: p.name,
      wcaId: p.wcaId,
      inList: entries.has(p.registrantId),
      newcomer: isNewcomer(p),
      delegate: isDelegate(p),
      available: isAvailable(entries.get(p.registrantId), slot, tz),
      busy: busy || competingHere,
      competingHere,
      roleHere,
      load: agenda.staffCount(ref),
      hasResult: hasResultIn(p, eventId),
      scramble: ranking.byId.get(p.registrantId) ?? null,
      extra: false,
    })
  }
  for (const x of plan.extras) {
    if (x.registrantId != null) continue
    const ref = `x${x.id}`
    out.push({
      ref,
      name: x.name,
      wcaId: null,
      inList: false,
      newcomer: false,
      delegate: false,
      available: true,
      busy: agenda.get(ref).some((b) => overlaps(b, slot)),
      competingHere: false,
      roleHere: roleIn(g, ref),
      load: agenda.staffCount(ref),
      hasResult: false,
      scramble: null,
      extra: true,
    })
  }
  const rankSort = role === 'scrambler'
  return out
    .filter((c) => c.roleHere !== role)
    .sort((a, b) => {
      const score = (c: Candidate) =>
        (c.busy ? 100 : 0) +
        (c.roleHere ? 40 : 0) +
        (c.newcomer && role !== 'competitor' ? 50 : 0) +
        (!c.available ? 30 : 0) +
        (!c.inList && !c.extra ? 10 : 0) +
        (c.delegate ? 5 : 0)
      const d = score(a) - score(b)
      if (d !== 0) return d
      if (rankSort) {
        const pa = byId.get(refId(a.ref) ?? -1)
        const pb = byId.get(refId(b.ref) ?? -1)
        if (pa && pb) return compareScramblers(pa, pb, ranking)
      }
      return a.load - b.load || a.name.localeCompare(b.name, 'pt-BR')
    })
}
