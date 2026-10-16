// Plano ⇄ WCIF.
//  - buildWcif: aplica o plano no WCIF (atividades de grupo + assignments) e
//    grava a extensão CubingSP.CubeStaff — é o que vai para a WCA.
//  - planFromWcif: reconstrói o plano ao abrir a competição (extensão; ou,
//    se não houver, os grupos já existentes de Groupifier/Delegate Dashboard).

import type { Wcif, WcifActivity, WcifAssignment, WcifExtension } from '../../../lib/wca/types'
import { eventName } from '../../../lib/wca/format'
import {
  DEFAULT_CONFIG,
  ROLE_CODE,
  emptyPlan,
  pref,
  refId,
  type GroupPlan,
  type Plan,
  type Ref,
  type RoundPlan,
  type StaffRole,
} from './types'
import { existingGroupActivities, maxActivityId, roundSchedule } from './schedule'
import { compareRank, findRound } from './people'
import { decodePlan, encodePlan, encodedSize, roundHash, EXTENSION_MAX_BYTES, type EncodedPlan } from './codec'

export const EXTENSION_ID = 'CubingSP.CubeStaff'
export const EXTENSION_SPEC = 'https://github.com/MatheusCasassa/CubingSPTools/blob/main/docs/cubestaff-extension.md'

const STAFF_CODES: Record<string, StaffRole> = {
  'staff-judge': 'judge',
  'staff-scrambler': 'scrambler',
  'staff-runner': 'runner',
}

// ------------------------------------------------------------- extensão

export class ExtensionTooLargeError extends Error {
  constructor(public bytes: number) {
    super(`Plano grande demais para a WCA (${bytes} bytes)`)
    this.name = 'ExtensionTooLargeError'
  }
}

export function readExtension(wcif: Wcif): Plan | null {
  const ext = wcif.extensions?.find((e) => e.id === EXTENSION_ID)
  const data = ext?.data as (Partial<Plan> & { v?: number }) | undefined
  if (!data) return null
  if ((data as { v?: number }).v === 2)
    return decodePlan(data as unknown as EncodedPlan, wcif, (id) => roundFromWcif(wcif, id))
  if (data.version !== 1) return null
  // Formato antigo (plano completo).
  const base = emptyPlan()
  return {
    ...base,
    ...data,
    config: { ...DEFAULT_CONFIG, ...(data.config ?? {}) },
    staff: data.staff ?? [],
    extras: data.extras ?? [],
    rounds: data.rounds ?? {},
    published: data.published ?? [],
    publishedHash: data.publishedHash ?? {},
    revision: data.revision ?? 0,
  } as Plan
}

/** Grava a extensão (formato compacto). Lança ExtensionTooLargeError se passar do limite. */
export function writeExtension(wcif: Wcif, plan: Plan): void {
  const data = encodePlan(plan, wcif)
  const bytes = encodedSize(data)
  if (bytes > EXTENSION_MAX_BYTES) throw new ExtensionTooLargeError(bytes)
  const ext: WcifExtension = { id: EXTENSION_ID, specUrl: EXTENSION_SPEC, data }
  const list = (wcif.extensions ?? []).filter((e) => e.id !== EXTENSION_ID)
  list.push(ext)
  wcif.extensions = list
}

// ------------------------------------------------------------- WCIF → plano

function walk(wcif: Wcif, visit: (a: WcifActivity) => void) {
  const rec = (as: WcifActivity[]) => as.forEach((a) => (visit(a), a.childActivities?.length && rec(a.childActivities)))
  for (const v of wcif.schedule?.venues ?? []) for (const r of v.rooms ?? []) rec(r.activities ?? [])
}

/** Grupos de uma rodada como estão hoje no WCIF (assignments). */
export function roundFromWcif(wcif: Wcif, roundId: string): RoundPlan | null {
  const sched = roundSchedule(wcif, roundId, 1)
  if (sched.kind === 'attempts') {
    const ids = new Set(sched.attempts.map((a) => a.activityId))
    const comps = wcif.persons
      .filter(
        (p) =>
          p.registrantId != null &&
          p.assignments.some((a) => a.assignmentCode === 'competitor' && ids.has(a.activityId)),
      )
      .map((p) => p.registrantId!)
    if (comps.length === 0) return null
    return {
      roundId,
      groups: [{ number: 1, competitors: comps, judges: [], scramblers: [], runners: [], reserves: [], locked: [] }],
      updatedAt: new Date().toISOString(),
    }
  }
  const acts = existingGroupActivities(wcif, roundId)
  if (acts.length === 0) return null
  const numbers = [...new Set(acts.map((a) => a.number))].sort((a, b) => a - b)
  const groups: GroupPlan[] = numbers.map((number) => {
    const ids = new Set(acts.filter((a) => a.number === number).map((a) => a.activityId))
    const g: GroupPlan = { number, competitors: [], judges: [], scramblers: [], runners: [], reserves: [], locked: [] }
    const withStation: { id: number; st: number }[] = []
    for (const p of wcif.persons) {
      if (p.registrantId == null) continue
      for (const a of p.assignments) {
        if (!ids.has(a.activityId)) continue
        if (a.assignmentCode === 'competitor') withStation.push({ id: p.registrantId, st: a.stationNumber ?? 9999 })
        const role = STAFF_CODES[a.assignmentCode]
        if (role)
          (role === 'judge' ? g.judges : role === 'scrambler' ? g.scramblers : g.runners).push(pref(p.registrantId))
      }
    }
    // Ordem: estação; sem estação, do mais rápido ao mais lento (como o CubeStaff gera).
    const byId = new Map(wcif.persons.map((p) => [p.registrantId, p]))
    const eventId = roundId.split('-')[0]
    g.competitors = withStation
      .sort((a, b) => a.st - b.st || compareRank(byId.get(a.id)!, byId.get(b.id)!, eventId))
      .map((x) => x.id)
    return g
  })
  if (groups.every((g) => g.competitors.length === 0 && g.judges.length === 0)) return null
  return { roundId, groups, updatedAt: new Date().toISOString() }
}

/** Plano ao abrir: extensão do CubeStaff; senão, grupos que já existem no WCIF. */
export function planFromWcif(wcif: Wcif): { plan: Plan; from: 'extension' | 'wcif' | 'empty' } {
  const ext = readExtension(wcif)
  if (ext) return { plan: ext, from: 'extension' }
  const plan = emptyPlan()
  for (const ev of wcif.events) {
    for (const r of ev.rounds) {
      const rp = roundFromWcif(wcif, r.id)
      if (rp) {
        plan.rounds[r.id] = rp
        plan.published.push(r.id)
        plan.publishedHash[r.id] = roundHash(rp)
        plan.config.groupsByRound[r.id] = rp.groups.length
      }
    }
  }
  return { plan, from: Object.keys(plan.rounds).length > 0 ? 'wcif' : 'empty' }
}

/**
 * Rodadas publicadas que alguém alterou na WCA depois da publicação
 * (Delegate Dashboard, Groupifier…) — compara com a impressão digital salva.
 */
export function changedOutside(wcif: Wcif, plan: Plan): string[] {
  return plan.published.filter((roundId) => {
    const saved = plan.publishedHash?.[roundId]
    return saved != null && roundHash(roundFromWcif(wcif, roundId)) !== saved
  })
}

// ------------------------------------------------------------- plano → WCIF

export interface BuildResult {
  wcif: Wcif
  /** Rodadas sem horário no cronograma (não publicáveis). */
  skipped: string[]
  published: string[]
}

function roundTitle(roundId: string, wcif: Wcif): string {
  const info = findRound(wcif, roundId)
  const ev = eventName(roundId.split('-')[0])
  return info ? `${ev}, Round ${info.number}` : ev
}

/**
 * Aplica as rodadas do plano no WCIF (cópia). `roundIds` = quais publicar
 * (padrão: todas do plano). A extensão sempre leva o plano inteiro.
 */
export function buildWcif(source: Wcif, plan: Plan, roundIds?: string[], withExtension = true): BuildResult {
  const wcif: Wcif = structuredClone(source)
  const ids = roundIds ?? Object.keys(plan.rounds)
  let nextId = maxActivityId(wcif) + 1
  const skipped: string[] = []
  const published: string[] = []
  const byReg = new Map(wcif.persons.filter((p) => p.registrantId != null).map((p) => [p.registrantId!, p]))

  for (const roundId of ids) {
    const rp = plan.rounds[roundId]
    if (!rp) continue
    const sched = roundSchedule(wcif, roundId, rp.groups.length)
    if (sched.kind === 'none') {
      skipped.push(roundId)
      continue
    }

    // Atividades que esta rodada controla (para limpar atribuições antigas).
    const managed = new Set<number>()
    const groupActivity = new Map<number, number[]>() // nº do grupo -> activity ids

    if (sched.kind === 'attempts') {
      sched.attempts.forEach((a) => managed.add(a.activityId))
      groupActivity.set(
        1,
        sched.attempts.map((a) => a.activityId),
      )
    } else {
      const codeRe = new RegExp(`^${roundId}-g\\d+$`)
      // Remove grupos antigos da rodada (em todas as salas), guardando os ids.
      walk(wcif, (a) => {
        if (a.activityCode === roundId && a.childActivities?.length) {
          for (const c of a.childActivities) if (codeRe.test(c.activityCode)) managed.add(c.id)
          a.childActivities = a.childActivities.filter((c) => !codeRe.test(c.activityCode))
        }
      })
      const parents = new Map<number, WcifActivity>()
      walk(wcif, (a) => {
        if (a.activityCode === roundId) parents.set(a.id, a)
      })
      for (const slot of sched.slots) {
        const parent = parents.get(slot.parentActivityId)
        if (!parent) continue
        const id = slot.existingActivityId ?? nextId++
        const child: WcifActivity = {
          id,
          name: `${roundTitle(roundId, wcif)}, Group ${slot.number}`,
          activityCode: `${roundId}-g${slot.number}`,
          startTime: slot.start != null ? new Date(slot.start).toISOString() : parent.startTime,
          endTime: slot.end != null ? new Date(slot.end).toISOString() : parent.endTime,
          childActivities: [],
          extensions: [],
        }
        parent.childActivities = [...(parent.childActivities ?? []), child].sort(
          (a, b) => Date.parse(a.startTime ?? '') - Date.parse(b.startTime ?? '') || a.id - b.id,
        )
        managed.add(id)
        groupActivity.set(slot.number, [...(groupActivity.get(slot.number) ?? []), id])
      }
    }

    for (const p of wcif.persons) p.assignments = p.assignments.filter((a) => !managed.has(a.activityId))

    const push = (registrantId: number, a: WcifAssignment) => byReg.get(registrantId)?.assignments.push(a)
    for (const g of rp.groups) {
      const acts = groupActivity.get(g.number) ?? []
      for (const activityId of acts) {
        g.competitors.forEach((id, i) =>
          push(id, {
            activityId,
            assignmentCode: 'competitor',
            stationNumber: plan.config.stationNumbers && sched.kind === 'groups' ? i + 1 : null,
          }),
        )
        const staff: [StaffRole, Ref[]][] = [
          ['judge', g.judges],
          ['scrambler', g.scramblers],
          ['runner', g.runners],
        ]
        for (const [role, refs] of staff) {
          refs.forEach((ref, i) => {
            const id = refId(ref)
            if (id == null) return // ajudante extra: fica só no CubeStaff
            push(id, {
              activityId,
              assignmentCode: ROLE_CODE[role],
              stationNumber: role === 'judge' && plan.config.stationNumbers ? i + 1 : null,
            })
          })
        }
      }
    }
    published.push(roundId)
  }

  const publishedHash = { ...(plan.publishedHash ?? {}) }
  for (const id of published) publishedHash[id] = roundHash(roundFromWcif(wcif, id))
  const nextPlan: Plan = { ...plan, published: [...new Set([...plan.published, ...published])], publishedHash }
  if (withExtension) writeExtension(wcif, nextPlan)
  return { wcif, skipped, published }
}

/** Só a extensão (rascunho na WCA, sem publicar assignments). */
export function withExtensionOnly(source: Wcif, plan: Plan): Wcif {
  const wcif = structuredClone(source)
  writeExtension(wcif, plan)
  return wcif
}

// ------------------------------------------------------------- diferenças

export interface RoundDiff {
  roundId: string
  added: number
  removed: number
}

function assignmentKeys(wcif: Wcif): Map<string, Set<string>> {
  // roundId -> set("registrantId|code|groupNumber")
  const actRound = new Map<number, { roundId: string; group: string }>()
  walk(wcif, (a) => {
    const m = a.activityCode.match(/^(.+-r\d+)-(g\d+|a\d+)$/)
    if (m) actRound.set(a.id, { roundId: m[1], group: m[2] })
  })
  const out = new Map<string, Set<string>>()
  for (const p of wcif.persons) {
    for (const a of p.assignments) {
      const r = actRound.get(a.activityId)
      if (!r) continue
      const set = out.get(r.roundId) ?? new Set()
      set.add(`${p.registrantId}|${a.assignmentCode}|${r.group}`)
      out.set(r.roundId, set)
    }
  }
  return out
}

export function diffAssignments(before: Wcif, after: Wcif): RoundDiff[] {
  const a = assignmentKeys(before)
  const b = assignmentKeys(after)
  const rounds = new Set([...a.keys(), ...b.keys()])
  const out: RoundDiff[] = []
  for (const roundId of rounds) {
    const x = a.get(roundId) ?? new Set()
    const y = b.get(roundId) ?? new Set()
    const added = [...y].filter((k) => !x.has(k)).length
    const removed = [...x].filter((k) => !y.has(k)).length
    if (added || removed) out.push({ roundId, added, removed })
  }
  return out
}
