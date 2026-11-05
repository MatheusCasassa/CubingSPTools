// Conferência do plano (vale para o que foi gerado E para edições manuais):
// conflitos de horário, novatos/Delegados no staff, indisponíveis, grupos
// com staff faltando e carga por pessoa.

import type { Wcif } from '../../../lib/wca/types'
import { type Plan, type Ref, type StaffRole, refId } from './types'
import {
  agendaFor,
  isAvailable,
  judgesFor,
  runnersFor,
  scramblersFor,
  slotOf,
  slotsByRound,
  stationsForRoom,
} from './engine'
import { competitionTimezone, overlaps } from './schedule'
import { presentAt } from './presence'
import { isAccepted, isApproved, isDelegate, isNewcomer, normalizeName, personsById } from './people'

export type IssueCode =
  | 'conflict'
  | 'notApproved'
  | 'newcomerStaff'
  | 'delegateStaff'
  | 'unavailable'
  | 'otherDay'
  | 'notInList'
  | 'shortJudges'
  | 'shortScramblers'
  | 'shortRunners'
  | 'tooManyTasks'
  | 'emptyGroup'
  | 'noSchedule'
  | 'similarNames'

export interface Issue {
  level: 'error' | 'warn' | 'info'
  code: IssueCode
  roundId: string
  group: number
  ref?: Ref
  /** Segunda pessoa (nomes parecidos). */
  ref2?: Ref
  role?: 'competitor' | StaffRole | 'reserve'
  count?: number
  needed?: number
}

export function checkPlan(wcif: Wcif, plan: Plan): Issue[] {
  const issues: Issue[] = []
  const byId = personsById(wcif)
  const entries = new Map(plan.staff.map((s) => [s.registrantId, s]))
  const scheds = slotsByRound(wcif, plan)
  const agenda = agendaFor(wcif, plan)
  const tz = competitionTimezone(wcif)
  const cfg = plan.config

  for (const [roundId, rp] of Object.entries(plan.rounds)) {
    const sched = scheds.get(roundId)
    if (sched?.kind === 'none') issues.push({ level: 'warn', code: 'noSchedule', roundId, group: 0 })
    for (const g of rp.groups) {
      const slot = slotOf(sched, g.number)
      const blocks = sched?.kind === 'attempts' ? sched.attempts : [slot]
      const roomId = sched?.slots.find((s) => s.number === g.number)?.roomId ?? 0
      if (g.competitors.length === 0) issues.push({ level: 'info', code: 'emptyGroup', roundId, group: g.number })
      // Nomes parecidos no mesmo grupo: recomendação de separar (súmulas e
      // chamadas se confundem).
      for (const [a, b] of similarPairs(g.competitors.map((id) => [id, byId.get(id)?.name ?? ''] as const)))
        issues.push({ level: 'info', code: 'similarNames', roundId, group: g.number, ref: `p${a}`, ref2: `p${b}` })

      // Conflitos: a mesma pessoa em duas coisas ao mesmo tempo.
      const roles: ['competitor' | StaffRole, Ref[]][] = [
        ['competitor', g.competitors.map((id) => `p${id}`)],
        ['judge', g.judges],
        ['scrambler', g.scramblers],
        ['runner', g.runners],
      ]
      const seenHere = new Map<Ref, number>()
      for (const [, refs] of roles) refs.forEach((r) => seenHere.set(r, (seenHere.get(r) ?? 0) + 1))
      for (const [role, refs] of roles) {
        for (const ref of refs) {
          const doubleHere = (seenHere.get(ref) ?? 0) > 1
          const elsewhere = agenda
            .get(ref)
            .some((b) => !(b.roundId === roundId && b.group === g.number) && blocks.some((blk) => overlaps(b, blk)))
          if (doubleHere || elsewhere)
            issues.push({ level: 'error', code: 'conflict', roundId, group: g.number, ref, role })
          const id = refId(ref)
          const person = id != null ? byId.get(id) : undefined
          // Inscrição não aprovada (pendente, cancelada…) ou que saiu da competição.
          if (id != null && (!person || (role === 'competitor' ? !isAccepted(person) : !isApproved(person))))
            issues.push({ level: 'error', code: 'notApproved', roundId, group: g.number, ref, role })
          if (role === 'competitor') continue
          if (person && isNewcomer(person) && role !== 'runner')
            issues.push({ level: 'error', code: 'newcomerStaff', roundId, group: g.number, ref, role })
          if (person && isDelegate(person) && role !== 'runner')
            issues.push({ level: 'info', code: 'delegateStaff', roundId, group: g.number, ref, role })
          if (id != null && !entries.has(id))
            issues.push({ level: 'info', code: 'notInList', roundId, group: g.number, ref, role })
          if (id != null && !isAvailable(entries.get(id), slot, tz))
            issues.push({ level: 'warn', code: 'unavailable', roundId, group: g.number, ref, role })
          if (person && cfg.presenceByEvents && !presentAt(wcif, person, slot.start))
            issues.push({ level: 'warn', code: 'otherDay', roundId, group: g.number, ref, role })
        }
      }

      for (const ref of g.reserves) {
        const id = refId(ref)
        const person = id != null ? byId.get(id) : undefined
        if (id != null && (!person || !isApproved(person)))
          issues.push({ level: 'error', code: 'notApproved', roundId, group: g.number, ref, role: 'reserve' })
      }

      if (sched?.kind !== 'attempts' && plan.staff.length > 0) {
        const size = g.competitors.length
        const stations = stationsForRoom(cfg, roomId)
        const nj = judgesFor(size, stations)
        const ns = scramblersFor(size, cfg.competitorsPerScrambler)
        const nr = cfg.runnersEnabled ? runnersFor(size, stations) : 0
        if (g.judges.length < nj)
          issues.push({
            level: 'warn',
            code: 'shortJudges',
            roundId,
            group: g.number,
            count: g.judges.length,
            needed: nj,
          })
        if (g.scramblers.length < ns)
          issues.push({
            level: 'warn',
            code: 'shortScramblers',
            roundId,
            group: g.number,
            count: g.scramblers.length,
            needed: ns,
          })
        if (g.runners.length < nr)
          issues.push({
            level: 'warn',
            code: 'shortRunners',
            roundId,
            group: g.number,
            count: g.runners.length,
            needed: nr,
          })
      }
    }
  }

  if (cfg.maxTasksPerPerson > 0) {
    const seen = new Set<Ref>()
    for (const rp of Object.values(plan.rounds))
      for (const g of rp.groups)
        for (const ref of [...g.judges, ...g.scramblers, ...g.runners]) {
          if (seen.has(ref)) continue
          seen.add(ref)
          const n = agenda.staffCount(ref)
          if (n > cfg.maxTasksPerPerson)
            issues.push({
              level: 'warn',
              code: 'tooManyTasks',
              roundId: rp.roundId,
              group: g.number,
              ref,
              count: n,
              needed: cfg.maxTasksPerPerson,
            })
        }
  }
  return issues
}

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/**
 * Nomes que se confundem: mesmo primeiro e último nome ("João Silva" e
 * "João Pedro Silva") ou quase iguais (até 2 letras de diferença).
 */
export function similarNames(a: string, b: string): boolean {
  const x = normalizeName(a)
  const y = normalizeName(b)
  if (!x || !y) return false
  if (x === y) return true
  const tx = x.split(' ')
  const ty = y.split(' ')
  if (tx.length > 1 && ty.length > 1 && tx[0] === ty[0] && tx.at(-1) === ty.at(-1)) return true
  return Math.min(x.length, y.length) >= 6 && lev(x, y) <= 2
}

export function similarPairs(people: (readonly [number, string])[]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++)
      if (similarNames(people[i][1], people[j][1])) out.push([people[i][0], people[j][0]])
  return out
}

/** Carga de staff por pessoa (para a visão "Pessoas"). */
export function staffLoad(plan: Plan): Map<Ref, Record<StaffRole, number>> {
  const out = new Map<Ref, Record<StaffRole, number>>()
  const add = (ref: Ref, role: StaffRole) => {
    const cur = out.get(ref) ?? { judge: 0, scrambler: 0, runner: 0 }
    cur[role]++
    out.set(ref, cur)
  }
  for (const rp of Object.values(plan.rounds))
    for (const g of rp.groups) {
      g.judges.forEach((r) => add(r, 'judge'))
      g.scramblers.forEach((r) => add(r, 'scrambler'))
      g.runners.forEach((r) => add(r, 'runner'))
    }
  return out
}
