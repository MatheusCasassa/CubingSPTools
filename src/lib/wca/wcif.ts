// Helpers para extrair rodadas, grupos e competidores de um WCIF.

import type { Wcif, WcifActivity, WcifRound } from './types'
import { eventName, roundLabel } from './format'

export interface RoundInfo {
  eventId: string
  eventName: string
  roundId: string // ex.: "333-r1"
  roundNumber: number
  totalRounds: number
  label: string // "Rodada 1" | "Final"
  round: WcifRound
}

export interface GroupInfo {
  /** Número do grupo (a partir do activityCode "...-gN"). */
  number: number
  /** activityIds correspondentes (pode haver mais de uma sala). */
  activityIds: number[]
  label: string // "Grupo N"
}

export interface Competitor {
  registrantId: number
  name: string
  wcaId: string | null
  /** Estação/mesa no grupo (assignment do WCIF), quando houver. */
  station?: number | null
}

/** Lista todas as rodadas da competição, ordenadas por evento e número. */
export function listRounds(wcif: Wcif): RoundInfo[] {
  const out: RoundInfo[] = []
  for (const event of wcif.events) {
    const total = event.rounds.length
    event.rounds.forEach((round, idx) => {
      const roundNumber = idx + 1
      out.push({
        eventId: event.id,
        eventName: eventName(event.id),
        roundId: round.id,
        roundNumber,
        totalRounds: total,
        label: roundLabel(roundNumber, total),
        round,
      })
    })
  }
  return out
}

function walkActivities(activities: WcifActivity[], visit: (a: WcifActivity) => void): void {
  for (const a of activities) {
    visit(a)
    if (a.childActivities?.length) walkActivities(a.childActivities, visit)
  }
}

function allActivities(wcif: Wcif): WcifActivity[] {
  const flat: WcifActivity[] = []
  for (const venue of wcif.schedule?.venues ?? []) {
    for (const room of venue.rooms ?? []) {
      walkActivities(room.activities ?? [], (a) => flat.push(a))
    }
  }
  return flat
}

/**
 * Horário e salas de um grupo no cronograma (todas as salas em que ele acontece).
 * Horas no fuso do local da competição, "HH:MM".
 */
export function groupSchedule(
  wcif: Wcif,
  roundId: string,
  groupNumber: number,
): { start: string | null; end: string | null; rooms: string[] } {
  const re = new RegExp(`^${escapeRegex(roundId)}-g${groupNumber}(?:-a\\d+)?$`)
  let start: string | null = null
  let end: string | null = null
  let tz = 'UTC'
  const rooms: string[] = []
  for (const venue of wcif.schedule?.venues ?? [])
    for (const room of venue.rooms ?? [])
      walkActivities(room.activities ?? [], (a) => {
        if (!re.test(a.activityCode)) return
        if (a.startTime && (!start || a.startTime < start)) start = a.startTime
        if (a.endTime && (!end || a.endTime > end)) end = a.endTime
        tz = venue.timezone || tz
        if (!rooms.includes(room.name)) rooms.push(room.name)
      })
  const hm = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso))
      : null
  return { start: hm(start), end: hm(end), rooms }
}

/**
 * Grupos de uma rodada, lidos do cronograma (child activities "...-gN").
 * Se a rodada não tiver grupos definidos, retorna vazio (o chamador cai
 * no fallback de "grupo único" por inscrição).
 */
export function listGroups(wcif: Wcif, roundId: string): GroupInfo[] {
  // "333-r1-g2" ou, em eventos com tentativas agendadas (Multi-BLD),
  // "333mbf-r1-g2-a1" dentro da tentativa.
  const groupRegex = new RegExp(`^${escapeRegex(roundId)}-g(\\d+)(?:-a\\d+)?$`)
  const byNumber = new Map<number, number[]>()

  for (const act of allActivities(wcif)) {
    const m = act.activityCode.match(groupRegex)
    if (m) {
      const n = Number(m[1])
      const list = byNumber.get(n) ?? []
      list.push(act.id)
      byNumber.set(n, list)
    }
  }

  return [...byNumber.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, activityIds]) => ({ number, activityIds, label: `Grupo ${number}` }))
}

/** Competidores designados a um grupo (assignmentCode "competitor"). */
export function competitorsInGroup(wcif: Wcif, activityIds: number[]): Competitor[] {
  const ids = new Set(activityIds)
  const out: Competitor[] = []
  for (const person of wcif.persons) {
    if (person.registrantId == null) continue
    const assigned = person.assignments.find((as) => as.assignmentCode === 'competitor' && ids.has(as.activityId))
    if (assigned) {
      out.push({
        registrantId: person.registrantId,
        name: person.name,
        wcaId: person.wcaId,
        station: assigned.stationNumber ?? null,
      })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/** Fallback: todos os inscritos aceitos no evento (quando não há grupos). */
export function acceptedCompetitors(wcif: Wcif, eventId: string): Competitor[] {
  const out: Competitor[] = []
  for (const person of wcif.persons) {
    if (person.registrantId == null) continue
    const reg = person.registration
    const accepted = reg && (reg.status === 'accepted' || reg.status === undefined)
    if (accepted && reg?.eventIds?.includes(eventId)) {
      out.push({ registrantId: person.registrantId, name: person.name, wcaId: person.wcaId })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
