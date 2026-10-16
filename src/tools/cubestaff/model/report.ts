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
import { isAccepted, isApproved, isDelegate, isNewcomer, personsById } from './people'

export type IssueCode =
  | 'conflict'
  | 'notApproved'
  | 'newcomerStaff'
  | 'delegateStaff'
  | 'unavailable'
  | 'notInList'
  | 'shortJudges'
  | 'shortScramblers'
  | 'shortRunners'
  | 'tooManyTasks'
  | 'emptyGroup'
  | 'noSchedule'

export interface Issue {
  level: 'error' | 'warn' | 'info'
  code: IssueCode
  roundId: string
  group: number
  ref?: Ref
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
