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
 * Grupos de uma rodada, lidos do cronograma (child activities "...-gN").
 * Se a rodada não tiver grupos definidos, retorna vazio (o chamador cai
 * no fallback de "grupo único" por inscrição).
 */
export function listGroups(wcif: Wcif, roundId: string): GroupInfo[] {
  const groupRegex = new RegExp(`^${escapeRegex(roundId)}-g(\\d+)$`)
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
    const assigned = person.assignments.some(
      (as) => as.assignmentCode === 'competitor' && ids.has(as.activityId),
    )
    if (assigned) {
      out.push({ registrantId: person.registrantId, name: person.name, wcaId: person.wcaId })
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
