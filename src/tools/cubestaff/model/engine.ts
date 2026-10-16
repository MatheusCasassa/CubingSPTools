// Motor de geração do CubeStaff.
//
// Regras (definidas pelo Matheus):
//  - base: competidores presentes; nº de estações e de grupos é manual;
//  - uma função por vez: quem compete num grupo só compete; ninguém faz duas
//    coisas em atividades simultâneas (inclusive em palcos diferentes);
//  - novatos (sem WCA ID) nunca são juízes nem embaralhadores;
//  - staff automático só sai da lista de candidatos aprovados;
//  - Delegados evitados como juiz/embaralhador (embaralhador só se bem
//    ranqueado); com staff "expressivo", ficam totalmente de fora;
//  - embaralhadores: os mais bem ranqueados, 1 a cada 8 competidores do grupo,
//    revezando quem já embaralhou muito;
//  - juízes: até o nº de estações, preferindo quem acabou de competir no
//    grupo anterior;
//  - runners só se habilitado; suplentes por grupo;
//  - itens travados (edição manual) são preservados ao gerar de novo.

import type { Wcif, WcifPerson } from '../../../lib/wca/types'
import {
  type CubeStaffConfig,
  type GroupPlan,
  type Plan,
  type Ref,
  type RoundPlan,
  type StaffEntry,
  type StaffRole,
  lockKey,
  pref,
  refId,
} from './types'
import { overlaps, periodOf, roundSchedule, splitEven, type RoundSchedule, type Slot } from './schedule'
import {
  compareRank,
  findRound,
  hasResultIn,
  isDelegate,
  isNewcomer,
  personsById,
  rankKey,
  roundCompetitors,
  type CompetitorSource,
} from './people'

export type NoteLevel = 'error' | 'warn' | 'info'
export interface Note {
  level: NoteLevel
  code:
    | 'noStaffList'
    | 'noSchedule'
    | 'unknownCompetitors'
    | 'shortJudges'
    | 'shortScramblers'
    | 'shortRunners'
    | 'competitorConflict'
    | 'delegatesUsed'
    | 'locksDropped'
    | 'attemptsRound'
  roundId?: string
  group?: number
  count?: number
  needed?: number
}

// ------------------------------------------------------------- sugestões

/** Sugestão de nº de grupos (Groupifier: ~1,7 × estações por grupo). */
export function suggestedGroups(competitors: number, stations: number, roundNumber: number): number {
  if (competitors <= 0) return 1
  if (stations <= 0) return roundNumber === 1 ? 2 : 1
  const count = Math.round(competitors / (stations * 1.7) + 0.4)
  return Math.max(count, roundNumber === 1 && competitors > stations ? 2 : 1)
}

export const scramblersFor = (size: number, perScrambler: number) =>
  size <= 0 ? 0 : Math.max(1, Math.ceil(size / Math.max(1, perScrambler)))

export const judgesFor = (size: number, stations: number) => Math.max(0, Math.min(size, stations))

export const runnersFor = (size: number, stations: number) =>
  size <= 0 ? 0 : Math.max(1, Math.ceil(Math.min(size, Math.max(stations, 1)) / 8))

export function stationsForRoom(config: CubeStaffConfig, roomId: number): number {
  const v = config.stationsByRoom[String(roomId)]
  return v && v > 0 ? v : config.stations
}

export function groupCountFor(wcif: Wcif, config: CubeStaffConfig, roundId: string, competitors: number): number {
  const set = config.groupsByRound[roundId]
  if (set && set > 0) return set
  const info = findRound(wcif, roundId)
  return suggestedGroups(competitors, config.stations, info?.number ?? 1)
}

// ------------------------------------------------------------- agenda (ocupação)

export interface Busy {
  start: number | null
  end: number | null
  roundId: string
  group: number
  role: 'competitor' | StaffRole
}

export class Agenda {
  private map = new Map<Ref, Busy[]>()
  add(ref: Ref, b: Busy) {
    const list = this.map.get(ref) ?? []
    list.push(b)
    this.map.set(ref, list)
  }
  get(ref: Ref): Busy[] {
    return this.map.get(ref) ?? []
  }
  isBusy(ref: Ref, slot: { start: number | null; end: number | null }, except?: { roundId: string; group: number }) {
    return this.get(ref).some(
      (b) => !(except && b.roundId === except.roundId && b.group === except.group) && overlaps(b, slot),
    )
  }
  staffCount(ref: Ref): number {
    return this.get(ref).filter((b) => b.role !== 'competitor').length
  }
  roleCount(ref: Ref, role: StaffRole): number {
    return this.get(ref).filter((b) => b.role === role).length
  }
  /** Tarefas de staff seguidas que terminam logo antes de `start`. */
  consecutiveBefore(ref: Ref, start: number | null): number {
    if (start == null) return 0
    const tasks = this.get(ref).filter((b) => b.role !== 'competitor' && b.start != null && b.end != null)
    let cur = start
    let count = 0
    for (;;) {
      const prev = tasks.find((t) => t.end! <= cur && t.end! >= cur - 5 * 60000)
      if (!prev) break
      count++
      cur = prev.start!
      if (count > 50) break
    }
    return count
  }
}

export function slotsByRound(wcif: Wcif, plan: Plan): Map<string, RoundSchedule> {
  const out = new Map<string, RoundSchedule>()
  for (const [roundId, rp] of Object.entries(plan.rounds)) {
    out.set(roundId, roundSchedule(wcif, roundId, rp.groups.length))
  }
  return out
}

export function slotOf(sched: RoundSchedule | undefined, group: number): { start: number | null; end: number | null } {
  if (!sched) return { start: null, end: null }
  if (sched.kind === 'attempts') {
    const s = sched.attempts.map((a) => a.start).filter((x): x is number => x != null)
    const e = sched.attempts.map((a) => a.end).filter((x): x is number => x != null)
    // Cada tentativa é um bloco; para conflito usamos cada uma (ver agendaFor).
    return { start: s.length ? Math.min(...s) : null, end: e.length ? Math.max(...e) : null }
  }
  const slot = sched.slots.find((s) => s.number === group)
  return { start: slot?.start ?? null, end: slot?.end ?? null }
}

/** Ocupação de todos a partir do plano (opcionalmente ignorando rodadas). */
export function agendaFor(wcif: Wcif, plan: Plan, skipRounds: Set<string> = new Set()): Agenda {
  const agenda = new Agenda()
  const scheds = slotsByRound(wcif, plan)
  for (const [roundId, rp] of Object.entries(plan.rounds)) {
    if (skipRounds.has(roundId)) continue
    const sched = scheds.get(roundId)
    for (const g of rp.groups) {
      const blocks =
        sched?.kind === 'attempts'
          ? sched.attempts.map((a) => ({ start: a.start, end: a.end }))
          : [slotOf(sched, g.number)]
      for (const blk of blocks) {
        const base = { ...blk, roundId, group: g.number }
        g.competitors.forEach((id) => agenda.add(pref(id), { ...base, role: 'competitor' }))
        g.judges.forEach((r) => agenda.add(r, { ...base, role: 'judge' }))
        g.scramblers.forEach((r) => agenda.add(r, { ...base, role: 'scrambler' }))
        g.runners.forEach((r) => agenda.add(r, { ...base, role: 'runner' }))
      }
    }
  }
  return agenda
}

// ------------------------------------------------------------- disponibilidade

export function isAvailable(entry: StaffEntry | undefined, slot: { start: number | null }, tz: string): boolean {
  if (!entry?.availability || slot.start == null) return true
  const { date, period } = periodOf(slot.start, tz)
  const day = entry.availability[date]
  if (!day) {
    // Dia sem informação: se a pessoa marcou algum dia, consideramos ausente
    // neste; se o mapa está vazio, disponível.
    return Object.keys(entry.availability).length === 0
  }
  return day[period]
}

const canDo = (entry: StaffEntry, role: StaffRole) => entry.roles.length === 0 || entry.roles.includes(role)

// ------------------------------------------------------------- competidores

interface WorkGroup {
  roundId: string
  eventId: string
  number: number
  slot: Slot | { start: number | null; end: number | null; roomId: number }
  plan: GroupPlan
}

function distributeCompetitors(
  ids: number[],
  groupCount: number,
  byId: Map<number, WcifPerson>,
  eventId: string,
  config: CubeStaffConfig,
  lockedPlacement: Map<number, number>, // registrantId -> group index
): number[][] {
  const G = Math.max(1, groupCount)
  const groups: number[][] = Array.from({ length: G }, () => [])
  const caps = splitEven(ids.length, G)
  for (const [id, gi] of lockedPlacement) {
    if (gi < G && ids.includes(id)) {
      groups[gi].push(id)
      caps[gi] = Math.max(0, caps[gi] - 1)
    }
  }
  const free = ids.filter((id) => !(lockedPlacement.has(id) && lockedPlacement.get(id)! < G))
  const people = free.map((id) => byId.get(id)!).filter(Boolean)
  // Mais lentos primeiro → primeiros grupos; mais rápidos nos últimos.
  const experienced = people
    .filter((p) => !isNewcomer(p))
    .sort((a, b) => compareRank(b, a, eventId))
    .map((p) => p.registrantId!)
  const newcomers = people
    .filter(isNewcomer)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((p) => p.registrantId!)

  const takeExp = () => (experienced.length ? experienced.shift()! : newcomers.shift()!)
  const takeNew = () => (newcomers.length ? newcomers.shift()! : experienced.shift()!)

  if (config.distribution === 'mixed') {
    const perGroup = splitEven(newcomers.length, G)
    for (let g = 0; g < G; g++) {
      const n = Math.min(perGroup[g], caps[g])
      for (let k = 0; k < n; k++) groups[g].push(takeNew())
    }
    for (let g = 0; g < G; g++) {
      const missing = caps[g] - (groups[g].length - countLocked(lockedPlacement, g, ids))
      for (let k = 0; k < missing; k++) {
        const id = experienced.length ? experienced.shift() : newcomers.shift()
        if (id != null) groups[g].push(id)
      }
    }
  } else {
    for (let g = 0; g < G; g++) {
      const cap = caps[g]
      if (config.newcomerShare === 50 && newcomers.length > 0) {
        const nNew = Math.min(newcomers.length, Math.ceil(cap / 2))
        for (let k = 0; k < nNew; k++) groups[g].push(takeNew())
        for (let k = nNew; k < cap; k++) groups[g].push(takeExp())
      } else {
        for (let k = 0; k < cap; k++) groups[g].push(newcomers.length ? takeNew() : takeExp())
      }
    }
  }
  // Sobras (arredondamento): último grupo.
  for (const id of [...newcomers, ...experienced]) groups[G - 1].push(id)
  return groups.map((g) => g.filter((x) => x != null))
}

function countLocked(locked: Map<number, number>, g: number, ids: number[]): number {
  let n = 0
  for (const [id, gi] of locked) if (gi === g && ids.includes(id)) n++
  return n
}

/** Troca competidores com conflito de horário com alguém de outro grupo. */
function repairCompetitorConflicts(
  groups: number[][],
  slots: { start: number | null; end: number | null }[],
  agenda: Agenda,
  locked: Set<number>,
): number {
  let unresolved = 0
  for (let g = 0; g < groups.length; g++) {
    for (let i = 0; i < groups[g].length; i++) {
      const id = groups[g][i]
      if (!agenda.isBusy(pref(id), slots[g])) continue
      if (locked.has(id)) {
        unresolved++
        continue
      }
      let fixed = false
      // Procura grupos vizinhos primeiro (nível parecido).
      const order = [...groups.keys()].filter((x) => x !== g).sort((a, b) => Math.abs(a - g) - Math.abs(b - g))
      for (const g2 of order) {
        if (agenda.isBusy(pref(id), slots[g2])) continue
        const j = groups[g2].findIndex((other) => !locked.has(other) && !agenda.isBusy(pref(other), slots[g]))
        if (j >= 0) {
          const other = groups[g2][j]
          groups[g2][j] = id
          groups[g][i] = other
          fixed = true
          break
        }
      }
      if (!fixed) {
        // Sem troca possível: move para um grupo livre (desequilibra um pouco).
        const g2 = order.find((x) => !agenda.isBusy(pref(id), slots[x]))
        if (g2 != null) {
          groups[g].splice(i, 1)
          groups[g2].push(id)
          i--
        } else unresolved++
      }
    }
  }
  return unresolved
}

// ------------------------------------------------------------- staff

interface StaffContext {
  wcif: Wcif
  config: CubeStaffConfig
  byId: Map<number, WcifPerson>
  entries: Map<number, StaffEntry>
  agenda: Agenda
  tz: string
  absent: Set<number>
}

function eligible(
  ctx: StaffContext,
  wg: WorkGroup,
  taken: Set<Ref>,
): { id: number; person: WcifPerson; entry: StaffEntry }[] {
  const out: { id: number; person: WcifPerson; entry: StaffEntry }[] = []
  const inGroup = new Set(wg.plan.competitors)
  for (const [id, entry] of ctx.entries) {
    const person = ctx.byId.get(id)
    if (!person || isNewcomer(person) || ctx.absent.has(id) || inGroup.has(id)) continue
    const ref = pref(id)
    if (taken.has(ref)) continue
    if (!isAvailable(entry, wg.slot, ctx.tz)) continue
    if (ctx.agenda.isBusy(ref, wg.slot)) continue
    if (ctx.config.maxTasksPerPerson > 0 && ctx.agenda.staffCount(ref) >= ctx.config.maxTasksPerPerson) continue
    if (ctx.config.maxConsecutive > 0 && ctx.agenda.consecutiveBefore(ref, wg.slot.start) >= ctx.config.maxConsecutive)
      continue
    out.push({ id, person, entry })
  }
  return out
}

function prefScore(entry: StaffEntry, role: StaffRole): number {
  const idx = entry.preferred.indexOf(role)
  if (idx === 0) return -4
  if (idx > 0) return -2
  return entry.preferred.length > 0 ? 3 : 0
}

function pickStaff(
  ctx: StaffContext,
  wg: WorkGroup,
  allGroupsOfRound: WorkGroup[],
  needs: Record<StaffRole, number>,
): { short: Record<StaffRole, number>; delegatesUsed: number } {
  const taken = new Set<Ref>([...wg.plan.judges, ...wg.plan.scramblers, ...wg.plan.runners])
  const short: Record<StaffRole, number> = { judge: 0, scrambler: 0, runner: 0 }
  let delegatesUsed = 0

  const pool = eligible(ctx, wg, taken)
  const nonDelegates = pool.filter((c) => !isDelegate(c.person))
  const totalNeeds = needs.judge + needs.scrambler + needs.runner
  const expressive = nonDelegates.length >= ctx.config.delegateThreshold * Math.max(1, totalNeeds)

  // Quem competiu no grupo anterior desta rodada (julga o seguinte).
  const idx = allGroupsOfRound.indexOf(wg)
  const prevGroup = idx > 0 ? allGroupsOfRound[idx - 1] : allGroupsOfRound.at(-1)
  const neighbors = new Set(prevGroup && prevGroup !== wg ? prevGroup.plan.competitors : [])

  const assign = (ref: Ref, role: StaffRole) => {
    taken.add(ref)
    const list = role === 'judge' ? wg.plan.judges : role === 'scrambler' ? wg.plan.scramblers : wg.plan.runners
    list.push(ref)
    ctx.agenda.add(ref, { start: wg.slot.start, end: wg.slot.end, roundId: wg.roundId, group: wg.number, role })
  }

  // --- Embaralhadores: os mais bem ranqueados no evento, revezando a carga.
  {
    const need = needs.scrambler - wg.plan.scramblers.length
    const cands = pool
      .filter((c) => !taken.has(pref(c.id)))
      .filter((c) => canDo(c.entry, 'scrambler') && c.entry.scrambler !== false)
      .filter(
        (c) =>
          !(
            c.entry.scrambler === true &&
            c.entry.scramblePuzzles.length > 0 &&
            !c.entry.scramblePuzzles.includes(wg.eventId)
          ),
      )
      .filter((c) => hasResultIn(c.person, wg.eventId))
      .sort((a, b) => compareRank(a.person, b.person, wg.eventId))
    const window = Math.max(6, need * 3)
    for (let n = 0; n < need; n++) {
      const open = cands.filter((c) => !taken.has(pref(c.id)))
      const ranked = open.slice(0, window)
      // Delegado só se bem ranqueado (dentro da janela) e sem staff expressivo.
      const allowed = ranked.filter((c) => !isDelegate(c.person) || !expressive)
      const best = allowed
        .map((c, i) => ({
          c,
          score:
            i +
            4 * ctx.agenda.roleCount(pref(c.id), 'scrambler') +
            2 * ctx.agenda.staffCount(pref(c.id)) +
            prefScore(c.entry, 'scrambler') +
            (isDelegate(c.person) ? 6 : 0),
        }))
        .sort((a, b) => a.score - b.score)[0]
      if (!best) {
        short.scrambler += need - n
        break
      }
      if (isDelegate(best.c.person)) delegatesUsed++
      assign(pref(best.c.id), 'scrambler')
    }
  }

  // --- Juízes e runners: carga equilibrada, vizinhos do grupo anterior.
  const fillRole = (role: StaffRole, need: number) => {
    for (let n = 0; n < need; n++) {
      const open = pool.filter((c) => !taken.has(pref(c.id)) && canDo(c.entry, role))
      const nonDel = open.filter((c) => !isDelegate(c.person))
      const list = nonDel.length > 0 || expressive ? nonDel : open // Delegado: último recurso
      const best = list
        .map((c) => ({
          c,
          score:
            10 * ctx.agenda.staffCount(pref(c.id)) +
            3 * ctx.agenda.consecutiveBefore(pref(c.id), wg.slot.start) +
            (neighbors.has(c.id) ? -12 : 0) +
            prefScore(c.entry, role),
        }))
        .sort((a, b) => a.score - b.score || a.c.person.name.localeCompare(b.c.person.name, 'pt-BR'))[0]
      if (!best) {
        short[role] += need - n
        break
      }
      if (isDelegate(best.c.person)) delegatesUsed++
      assign(pref(best.c.id), role)
    }
  }
  fillRole('judge', needs.judge - wg.plan.judges.length)
  fillRole('runner', needs.runner - wg.plan.runners.length)

  return { short, delegatesUsed }
}

/**
 * Suplentes: calculados DEPOIS de todo o staff (para não sugerir quem já está
 * escalado num grupo simultâneo). Livres no horário, menos carregados, sem
 * Delegados se possível; quem acabou de competir vem primeiro.
 */
function pickReserves(ctx: StaffContext, wg: WorkGroup, allGroupsOfRound: WorkGroup[]): Ref[] {
  const taken = new Set<Ref>([...wg.plan.judges, ...wg.plan.scramblers, ...wg.plan.runners])
  const idx = allGroupsOfRound.indexOf(wg)
  const prevGroup = idx > 0 ? allGroupsOfRound[idx - 1] : allGroupsOfRound.at(-1)
  const neighbors = new Set(prevGroup && prevGroup !== wg ? prevGroup.plan.competitors : [])
  const lockedReserves = wg.plan.reserves.filter((r) => wg.plan.locked.includes(lockKey('reserve', r)))
  const pool = eligible(ctx, wg, taken).filter((c) => !lockedReserves.includes(pref(c.id)))
  const nonDel = pool.filter((c) => !isDelegate(c.person))
  const want = Math.max(0, ctx.config.reservesPerGroup - lockedReserves.length)
  const list = (nonDel.length >= want ? nonDel : pool)
    .map((c) => ({
      c,
      score: 10 * ctx.agenda.staffCount(pref(c.id)) + (neighbors.has(c.id) ? -5 : 0) + (isDelegate(c.person) ? 20 : 0),
    }))
    .sort((a, b) => a.score - b.score || a.c.person.name.localeCompare(b.c.person.name, 'pt-BR'))
    .slice(0, want)
    .map((x) => pref(x.c.id))
  return [...lockedReserves, ...list]
}

// ------------------------------------------------------------- API

export interface GenerateOptions {
  /** Rodadas a gerar (as demais ficam como estão). */
  roundIds: string[]
  /** ISO de agora (testes). */
  now?: string
}

export interface GenerateResult {
  plan: Plan
  notes: Note[]
  sources: Record<string, CompetitorSource>
}

export function generate(wcif: Wcif, source: Plan, opts: GenerateOptions): GenerateResult {
  const plan: Plan = structuredClone(source)
  const config = plan.config
  const notes: Note[] = []
  const sources: Record<string, CompetitorSource> = {}
  const byId = personsById(wcif)
  const absent = new Set(config.absent)
  const entries = new Map(plan.staff.filter((s) => byId.has(s.registrantId)).map((s) => [s.registrantId, s]))
  const now = opts.now ?? new Date().toISOString()
  if (entries.size === 0) notes.push({ level: 'warn', code: 'noStaffList' })

  const targetIds = opts.roundIds.filter((id) => findRound(wcif, id))
  const target = new Set(targetIds)
  const agenda = agendaFor(wcif, plan, target)

  // Travas das rodadas regeneradas também ocupam a agenda (staff travado).
  const work: { roundId: string; groups: WorkGroup[]; sched: RoundSchedule }[] = []

  for (const roundId of targetIds) {
    const info = findRound(wcif, roundId)!
    const { ids, source: src } = roundCompetitors(wcif, roundId, absent)
    sources[roundId] = src
    if (src === 'unknown') {
      notes.push({ level: 'info', code: 'unknownCompetitors', roundId })
      continue
    }
    const G = groupCountFor(wcif, config, roundId, ids.length)
    const sched = roundSchedule(wcif, roundId, G)
    if (sched.kind === 'none') notes.push({ level: 'warn', code: 'noSchedule', roundId })

    const previous = plan.rounds[roundId]
    const sameShape = previous && previous.groups.length === (sched.kind === 'attempts' ? 1 : G)
    if (previous && !sameShape && previous.groups.some((g) => g.locked.length > 0))
      notes.push({ level: 'warn', code: 'locksDropped', roundId })

    if (sched.kind === 'attempts') {
      notes.push({ level: 'info', code: 'attemptsRound', roundId })
      const gp: GroupPlan = {
        number: 1,
        competitors: [...ids],
        judges: [],
        scramblers: [],
        runners: [],
        reserves: [],
        locked: [],
      }
      for (const a of sched.attempts)
        ids.forEach((id) => agenda.add(pref(id), { start: a.start, end: a.end, roundId, group: 1, role: 'competitor' }))
      plan.rounds[roundId] = { roundId, groups: [gp], updatedAt: now }
      continue
    }

    const slots = sched.slots
    // Competidores travados no grupo onde foram colocados à mão.
    const lockedPlacement = new Map<number, number>()
    if (sameShape) {
      previous.groups.forEach((g, gi) =>
        g.competitors.forEach((id) => {
          if (g.locked.includes(lockKey('competitor', pref(id)))) lockedPlacement.set(id, gi)
        }),
      )
    }
    const groupsIds = distributeCompetitors(ids, slots.length, byId, info.eventId, config, lockedPlacement)
    const unresolved = repairCompetitorConflicts(groupsIds, slots, agenda, new Set(lockedPlacement.keys()))
    if (unresolved > 0) notes.push({ level: 'warn', code: 'competitorConflict', roundId, count: unresolved })

    const groups: WorkGroup[] = slots.map((slot, gi) => {
      const prev = sameShape ? previous.groups[gi] : undefined
      const keep = (role: StaffRole, list: Ref[] | undefined) =>
        (list ?? []).filter((r) => prev!.locked.includes(lockKey(role, r)))
      const gp: GroupPlan = {
        number: slot.number,
        // Estação 1 = mais rápido (como no Groupifier).
        competitors: groupsIds[gi].slice().sort((a, b) => compareRank(byId.get(a)!, byId.get(b)!, info.eventId)),
        judges: prev ? keep('judge', prev.judges) : [],
        scramblers: prev ? keep('scrambler', prev.scramblers) : [],
        runners: prev ? keep('runner', prev.runners) : [],
        reserves: prev ? prev.reserves.filter((r) => prev.locked.includes(lockKey('reserve', r))) : [],
        locked: prev
          ? prev.locked.filter((k) => {
              const [kind, ref] = k.split(':')
              if (kind === 'competitor') return groupsIds[gi].includes(refId(ref) ?? -1)
              return true
            })
          : [],
      }
      return { roundId, eventId: info.eventId, number: slot.number, slot, plan: gp }
    })
    for (const wg of groups) {
      wg.plan.competitors.forEach((id) =>
        agenda.add(pref(id), { start: wg.slot.start, end: wg.slot.end, roundId, group: wg.number, role: 'competitor' }),
      )
      for (const role of ['judge', 'scrambler', 'runner'] as StaffRole[]) {
        const list = role === 'judge' ? wg.plan.judges : role === 'scrambler' ? wg.plan.scramblers : wg.plan.runners
        list.forEach((r) => agenda.add(r, { start: wg.slot.start, end: wg.slot.end, roundId, group: wg.number, role }))
      }
    }
    work.push({ roundId, groups, sched })
  }

  // Staff em ordem cronológica (para revezar e respeitar tarefas seguidas).
  const ctx: StaffContext = { wcif, config, byId, entries, agenda, tz: work[0]?.sched.timezone ?? 'UTC', absent }
  const allGroups = work.flatMap((w) => w.groups.map((g) => ({ wg: g, round: w })))
  allGroups.sort((a, b) => (a.wg.slot.start ?? 0) - (b.wg.slot.start ?? 0) || a.wg.number - b.wg.number)
  let delegatesUsed = 0
  for (const { wg, round } of allGroups) {
    const size = wg.plan.competitors.length
    const stations = stationsForRoom(config, wg.slot.roomId)
    const needs: Record<StaffRole, number> = {
      judge: judgesFor(size, stations),
      scrambler: scramblersFor(size, config.competitorsPerScrambler),
      runner: config.runnersEnabled ? runnersFor(size, stations) : 0,
    }
    if (entries.size === 0) continue
    const res = pickStaff(ctx, wg, round.groups, needs)
    delegatesUsed += res.delegatesUsed
    if (res.short.judge > 0)
      notes.push({
        level: 'warn',
        code: 'shortJudges',
        roundId: wg.roundId,
        group: wg.number,
        count: needs.judge - res.short.judge,
        needed: needs.judge,
      })
    if (res.short.scrambler > 0)
      notes.push({
        level: 'warn',
        code: 'shortScramblers',
        roundId: wg.roundId,
        group: wg.number,
        count: needs.scrambler - res.short.scrambler,
        needed: needs.scrambler,
      })
    if (res.short.runner > 0)
      notes.push({
        level: 'warn',
        code: 'shortRunners',
        roundId: wg.roundId,
        group: wg.number,
        count: needs.runner - res.short.runner,
        needed: needs.runner,
      })
  }
  if (entries.size > 0)
    for (const { wg, round } of allGroups)
      if (round.sched.kind !== 'attempts') wg.plan.reserves = pickReserves(ctx, wg, round.groups)
  if (delegatesUsed > 0) notes.push({ level: 'info', code: 'delegatesUsed', count: delegatesUsed })

  for (const w of work) {
    const rp: RoundPlan = { roundId: w.roundId, groups: w.groups.map((g) => g.plan), updatedAt: now }
    plan.rounds[w.roundId] = rp
    plan.config.groupsByRound[w.roundId] = rp.groups.length
  }
  plan.updatedAt = now
  return { plan, notes, sources }
}

/** Rodadas que já podem ser geradas e ainda não têm grupos no plano. */
export function pendingRounds(wcif: Wcif, plan: Plan): { roundId: string; source: CompetitorSource; count: number }[] {
  const absent = new Set(plan.config.absent)
  const out: { roundId: string; source: CompetitorSource; count: number }[] = []
  for (const ev of wcif.events) {
    ev.rounds.forEach((r, i) => {
      if (i === 0) return
      const has = plan.rounds[r.id]?.groups.some((g) => g.competitors.length > 0)
      if (has) return
      const { ids, source } = roundCompetitors(wcif, r.id, absent)
      if (source !== 'unknown' && ids.length > 0) out.push({ roundId: r.id, source, count: ids.length })
    })
  }
  return out
}

export { rankKey }
