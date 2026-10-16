// Motor de agrupamento — fiel à lógica do Groupifier (src/logic).
// Cria atividades de grupo no WCIF, semeia por ranking (personalBests),
// atribui competidores e staff. Opera sobre um clone do WCIF.

import type { Wcif, WcifPerson, WcifActivity } from '../../lib/wca/types'
import { listRounds, type RoundInfo } from '../../lib/wca/wcif'

// -------------------- Configuração --------------------

export type SortingRule = 'clustered' | 'balanced'

export interface RoundGroupConfig {
  groups: number
  sorting: SortingRule
  scramblers: number
  runners: number
  assignJudges: boolean
  stationNumbers: boolean
}

export interface GroupingConfig {
  stations: number
  perRound: Record<string, RoundGroupConfig>
}

const BLD_EVENTS = new Set(['333bf', '444bf', '555bf', '333mbf'])
const NO_GROUP_EVENTS = new Set(['333fm', '333mbf']) // tentativas pré-agendadas

// -------------------- Ranking --------------------

function bests(person: WcifPerson, eventId: string): { average: number; single: number } {
  let average = Infinity
  let single = Infinity
  for (const pb of person.personalBests ?? []) {
    if (pb.eventId !== eventId) continue
    if (pb.type === 'average') average = pb.best
    else if (pb.type === 'single') single = pb.best
  }
  return { average, single }
}

/** Chave de ordenação (menor = mais rápido). BLD ordena por single primeiro. */
function rankKey(person: WcifPerson, eventId: string): [number, number] {
  const { average, single } = bests(person, eventId)
  return BLD_EVENTS.has(eventId) ? [single, average] : [average, single]
}

function compareRank(a: WcifPerson, b: WcifPerson, eventId: string): number {
  const ka = rankKey(a, eventId)
  const kb = rankKey(b, eventId)
  return ka[0] - kb[0] || ka[1] - kb[1] || a.name.localeCompare(b.name, 'pt-BR')
}

/** Competidores da rodada, do MAIS RÁPIDO ao mais lento (best-first). */
function competitorsBestFirst(wcif: Wcif, round: RoundInfo): WcifPerson[] {
  const eventId = round.eventId
  // Rodadas > 1: usar quem avançou (results), se houver.
  const results = round.round.results as { personId: number }[] | undefined
  let people: WcifPerson[]
  if (round.roundNumber > 1 && results && results.length > 0) {
    const ids = new Set(results.map((r) => r.personId))
    people = wcif.persons.filter((p) => p.registrantId != null && ids.has(p.registrantId))
  } else {
    people = wcif.persons.filter((p) => {
      if (p.registrantId == null) return false
      const reg = p.registration
      const accepted = reg && (reg.status === 'accepted' || reg.status === undefined)
      return !!accepted && !!reg?.eventIds?.includes(eventId)
    })
  }
  return people.slice().sort((a, b) => compareRank(a, b, eventId))
}

// -------------------- Sugestões (Groupifier) --------------------

export function suggestedGroupCount(competitors: number, stations: number, roundNumber: number): number {
  if (stations <= 0) return Math.max(1, roundNumber === 1 ? 2 : 1)
  const preferred = stations * 1.7
  const count = Math.round(competitors / preferred + 0.4)
  return Math.max(count, roundNumber === 1 ? 2 : 1)
}

export function suggestedScramblers(groupSize: number, stations: number): number {
  const gc = Math.max(groupSize, 1)
  return Math.floor(1 + (Math.min(gc, stations) - 1) / 5)
}
export function suggestedRunners(groupSize: number, stations: number): number {
  const gc = Math.max(groupSize, 1)
  return Math.max(0, Math.floor((Math.min(gc, stations) - 1) / 8))
}

/** Config padrão para uma rodada, dado o nº de estações. */
export function defaultRoundConfig(
  competitors: number,
  stations: number,
  roundNumber: number,
): RoundGroupConfig {
  const groups = suggestedGroupCount(competitors, stations, roundNumber)
  const groupSize = groups > 0 ? competitors / groups : competitors
  return {
    groups,
    sorting: 'clustered',
    scramblers: suggestedScramblers(groupSize, stations),
    runners: suggestedRunners(groupSize, stations),
    assignJudges: stations > 0,
    stationNumbers: false,
  }
}

// -------------------- Atividades de grupo --------------------

function maxActivityId(wcif: Wcif): number {
  let max = 0
  const walk = (as: WcifActivity[]) => {
    for (const a of as) {
      if (a.id > max) max = a.id
      if (a.childActivities?.length) walk(a.childActivities)
    }
  }
  for (const v of wcif.schedule?.venues ?? []) for (const r of v.rooms ?? []) walk(r.activities ?? [])
  return max
}

interface GroupActivityRef {
  number: number
  activityId: number
  size: number
}

/** Garante uma sala sintética quando não há cronograma (uso local apenas). */
function ensureSyntheticRoom(wcif: Wcif): { activities: WcifActivity[] } {
  if (!wcif.schedule) wcif.schedule = { venues: [] }
  if (wcif.schedule.venues.length === 0) {
    wcif.schedule.venues.push({
      id: 1,
      name: 'Local (gerado)',
      rooms: [{ id: 1, name: 'Sala 1', activities: [] }],
    } as unknown as Wcif['schedule']['venues'][number])
  }
  const venue = wcif.schedule.venues[0]
  if (!venue.rooms || venue.rooms.length === 0) {
    venue.rooms = [{ id: 1, name: 'Sala 1', activities: [] }] as unknown as typeof venue.rooms
  }
  return { activities: venue.rooms[0].activities }
}

function nominalTime(index: number): { start: string; end: string } {
  // Horários nominais (sem depender de "agora") para grupos sintéticos.
  const base = Date.parse('2026-01-01T09:00:00.000Z')
  const start = new Date(base + index * 30 * 60000).toISOString()
  const end = new Date(base + (index + 1) * 30 * 60000).toISOString()
  return { start, end }
}

/**
 * Cria (ou recria) as atividades de grupo de uma rodada e devolve refs com
 * tamanhos calculados. `hasRealSchedule` = havia atividade de rodada no
 * cronograma (necessário para salvar na WCA).
 */
function createGroupActivities(
  wcif: Wcif,
  round: RoundInfo,
  groupsCount: number,
  competitors: number,
): { refs: GroupActivityRef[]; hasRealSchedule: boolean } {
  // Remove grupos e atribuições antigas desta rodada (idempotente).
  clearRoundGroups(wcif, round.roundId)

  // Procura atividades de rodada reais no cronograma.
  const roundActivities: WcifActivity[] = []
  for (const v of wcif.schedule?.venues ?? [])
    for (const r of v.rooms ?? [])
      for (const a of r.activities ?? []) if (a.activityCode === round.roundId) roundActivities.push(a)

  const hasRealSchedule = roundActivities.length > 0
  let nextId = maxActivityId(wcif) + 1

  // Sem cronograma: cria uma atividade de rodada sintética.
  const targets: WcifActivity[] = hasRealSchedule
    ? roundActivities
    : (() => {
        const room = ensureSyntheticRoom(wcif)
        const t = nominalTime(0)
        const act: WcifActivity = {
          id: nextId++,
          name: round.label,
          activityCode: round.roundId,
          startTime: t.start,
          endTime: t.end,
          childActivities: [],
        }
        room.activities.push(act)
        return [act]
      })()

  // Divide cada atividade de rodada em `groupsCount` fatias iguais de tempo.
  type Temp = { parent: WcifActivity; start: number; end: number }
  const temps: Temp[] = []
  for (const parent of targets) {
    parent.childActivities = []
    const start = parent.startTime ? Date.parse(parent.startTime) : Date.parse(nominalTime(0).start)
    const end = parent.endTime ? Date.parse(parent.endTime) : start + groupsCount * 30 * 60000
    const dur = (end - start) / groupsCount
    for (let i = 0; i < groupsCount; i++) {
      temps.push({ parent, start: start + i * dur, end: start + (i + 1) * dur })
    }
  }

  // Numera globalmente por horário de início.
  temps.sort((a, b) => a.start - b.start || a.end - b.end)
  const refs: GroupActivityRef[] = []
  const sizes = groupSizes(competitors, temps.length)
  temps.forEach((t, index) => {
    const number = index + 1
    const id = nextId++
    const code = `${round.roundId}-g${number}`
    const child: WcifActivity = {
      id,
      name: `${round.label}, Grupo ${number}`,
      activityCode: code,
      startTime: new Date(t.start).toISOString(),
      endTime: new Date(t.end).toISOString(),
      childActivities: [],
    }
    t.parent.childActivities.push(child)
    refs.push({ number, activityId: id, size: sizes[index] })
  })

  return { refs, hasRealSchedule }
}

/** Tamanhos de grupo quase iguais (primeiros grupos recebem o resto). */
function groupSizes(total: number, groups: number): number[] {
  if (groups <= 0) return []
  const base = Math.floor(total / groups)
  const rem = total % groups
  return Array.from({ length: groups }, (_, i) => base + (i < rem ? 1 : 0))
}

/** Remove atividades de grupo e atribuições associadas de uma rodada. */
function clearRoundGroups(wcif: Wcif, roundId: string): void {
  const groupIds = new Set<number>()
  const prefix = `${roundId}-g`
  for (const v of wcif.schedule?.venues ?? [])
    for (const r of v.rooms ?? [])
      for (const a of r.activities ?? []) {
        if (a.activityCode === roundId && a.childActivities?.length) {
          for (const c of a.childActivities) {
            if (c.activityCode?.startsWith(prefix)) groupIds.add(c.id)
          }
          a.childActivities = a.childActivities.filter((c) => !c.activityCode?.startsWith(prefix))
        }
      }
  if (groupIds.size === 0) return
  for (const p of wcif.persons) {
    p.assignments = p.assignments.filter((as) => !groupIds.has(as.activityId))
  }
}

// -------------------- Atribuição de competidores --------------------

function assignCompetitors(
  wcif: Wcif,
  round: RoundInfo,
  refs: GroupActivityRef[],
  cfg: RoundGroupConfig,
): Map<number, number> {
  // person.registrantId -> group number
  const bestFirst = competitorsBestFirst(wcif, round)
  const worstFirst = bestFirst.slice().reverse()
  const G = refs.length
  const assignmentByPerson = new Map<number, number>()

  // Distribui (worst-first) em grupos.
  const buckets: WcifPerson[][] = refs.map(() => [])
  if (cfg.sorting === 'balanced') {
    // Snake seeding.
    worstFirst.forEach((p, i) => {
      const cycle = Math.floor(i / G)
      const pos = i % G
      const g = cycle % 2 === 0 ? pos : G - 1 - pos
      buckets[g].push(p)
    })
  } else {
    // Clustered: fatias contíguas conforme tamanhos.
    let idx = 0
    refs.forEach((ref, g) => {
      for (let k = 0; k < ref.size && idx < worstFirst.length; k++, idx++) buckets[g].push(worstFirst[idx])
    })
    // sobra (por arredondamento) vai para o último grupo
    while (idx < worstFirst.length) buckets[G - 1].push(worstFirst[idx++])
  }

  const personById = new Map(wcif.persons.map((p) => [p.registrantId, p] as const))
  buckets.forEach((members, g) => {
    const ref = refs[g]
    // Números de estação: mais rápido = estação 1.
    const ordered = members.slice().sort((a, b) => compareRank(a, b, round.eventId))
    ordered.forEach((person, i) => {
      const full = personById.get(person.registrantId)
      if (!full) return
      full.assignments.push({
        activityId: ref.activityId,
        assignmentCode: 'competitor',
        ...(cfg.stationNumbers ? { stationNumber: i + 1 } : {}),
      })
      if (person.registrantId != null) assignmentByPerson.set(person.registrantId, ref.number)
    })
  })
  return assignmentByPerson
}

// -------------------- Atribuição de staff --------------------

function assignStaff(
  wcif: Wcif,
  round: RoundInfo,
  refs: GroupActivityRef[],
  competitorGroup: Map<number, number>,
  cfg: GroupingConfig,
  roundCfg: RoundGroupConfig,
): void {
  const personById = new Map(wcif.persons.map((p) => [p.registrantId, p] as const))
  const staffLoad = new Map<number, number>()
  const load = (id: number) => staffLoad.get(id) ?? 0

  // Pool: competidores da rodada (podem servir em grupos != o seu).
  const poolIds = [...competitorGroup.keys()]

  for (const ref of refs) {
    // Elegíveis: competem em OUTRO grupo desta rodada.
    const eligible = () =>
      poolIds
        .filter((id) => competitorGroup.get(id) !== ref.number)
        .map((id) => personById.get(id)!)
        .filter(Boolean)

    const assignedHere = new Set<number>()
    const pick = (count: number, code: string, preferFastEvent: boolean) => {
      for (let n = 0; n < count; n++) {
        const cands = eligible().filter((p) => !assignedHere.has(p.registrantId!))
        if (cands.length === 0) break
        cands.sort((a, b) => {
          const dl = load(a.registrantId!) - load(b.registrantId!)
          if (dl !== 0) return dl
          if (preferFastEvent) {
            const c = compareRank(a, b, round.eventId)
            if (c !== 0) return c
          }
          return a.name.localeCompare(b.name, 'pt-BR')
        })
        const chosen = cands[0]
        chosen.assignments.push({ activityId: ref.activityId, assignmentCode: code })
        assignedHere.add(chosen.registrantId!)
        staffLoad.set(chosen.registrantId!, load(chosen.registrantId!) + 1)
      }
    }

    pick(roundCfg.scramblers, 'staff-scrambler', true)
    pick(roundCfg.runners, 'staff-runner', false)
    if (roundCfg.assignJudges) {
      const judges = Math.min(cfg.stations, ref.size)
      pick(judges, 'staff-judge', false)
    }
  }
}

// -------------------- API pública --------------------

export interface RoundGroupingResult {
  roundId: string
  eventId: string
  label: string
  groups: { number: number; size: number; competitors: number }[]
  hasRealSchedule: boolean
}

export interface GroupingResult {
  wcif: Wcif
  rounds: RoundGroupingResult[]
  /** true se todas as rodadas selecionadas têm cronograma real (pode salvar). */
  canSave: boolean
}

/** Gera grupos + atribuições para as rodadas selecionadas. Retorna novo WCIF. */
export function generateGroups(
  sourceWcif: Wcif,
  roundIds: string[],
  config: GroupingConfig,
): GroupingResult {
  const wcif: Wcif = structuredClone(sourceWcif)
  const allRounds = listRounds(wcif)
  const selected = allRounds.filter((r) => roundIds.includes(r.roundId))
  const results: RoundGroupingResult[] = []
  let canSave = true

  for (const round of selected) {
    if (NO_GROUP_EVENTS.has(round.eventId)) continue
    const roundCfg = config.perRound[round.roundId]
    if (!roundCfg || roundCfg.groups < 1) continue

    const competitors = competitorsBestFirst(wcif, round).length
    const { refs, hasRealSchedule } = createGroupActivities(
      wcif,
      round,
      roundCfg.groups,
      competitors,
    )
    if (!hasRealSchedule) canSave = false

    const competitorGroup = assignCompetitors(wcif, round, refs, roundCfg)
    assignStaff(wcif, round, refs, competitorGroup, config, roundCfg)

    // Conta competidores reais por grupo.
    const counts = new Map<number, number>()
    for (const g of competitorGroup.values()) counts.set(g, (counts.get(g) ?? 0) + 1)

    results.push({
      roundId: round.roundId,
      eventId: round.eventId,
      label: `${round.eventName} · ${round.label}`,
      groups: refs.map((r) => ({ number: r.number, size: r.size, competitors: counts.get(r.number) ?? 0 })),
      hasRealSchedule,
    })
  }

  return { wcif, rounds: results, canSave }
}
