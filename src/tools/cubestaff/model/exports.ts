// Planilhas para baixar do CubeStaff: por grupo (com suplentes e ajudantes
// extras, que não vão para a WCA) e por pessoa.

import type { Wcif } from '../../../lib/wca/types'
import { type Plan, type Ref, type StaffRole, refId } from './types'
import { slotsByRound } from './engine'
import { competitionTimezone, localParts } from './schedule'
import { findRound } from './people'
import { toCsv } from './csv'

export interface ExportLabels {
  event: string
  round: string
  group: string
  room: string
  start: string
  role: string
  name: string
  wcaId: string
  station: string
  roles: Record<'competitor' | StaffRole | 'reserve', string>
  roundName: (eventId: string, number: number, total: number) => string
  person: string
  assignments: string
}

export function refName(wcif: Wcif, plan: Plan, ref: Ref): { name: string; wcaId: string } {
  const id = refId(ref)
  if (id != null) {
    const p = wcif.persons.find((x) => x.registrantId === id)
    return { name: p?.name ?? `#${id}`, wcaId: p?.wcaId ?? '' }
  }
  const x = plan.extras.find((e) => `x${e.id}` === ref)
  return { name: x?.name ?? ref, wcaId: '' }
}

function fmtTime(ms: number | null, tz: string): string {
  if (ms == null) return ''
  const { date, hour, minute } = localParts(ms, tz)
  return `${date} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

interface Line {
  start: number | null
  eventId: string
  roundLabel: string
  group: number
  room: string
  role: 'competitor' | StaffRole | 'reserve'
  ref: Ref
  station: number | null
}

function lines(wcif: Wcif, plan: Plan, L: ExportLabels): Line[] {
  const scheds = slotsByRound(wcif, plan)
  const out: Line[] = []
  for (const [roundId, rp] of Object.entries(plan.rounds)) {
    const info = findRound(wcif, roundId)
    const eventId = roundId.split('-')[0]
    const label = info ? L.roundName(eventId, info.number, info.total) : roundId
    const sched = scheds.get(roundId)
    for (const g of rp.groups) {
      const slot = sched?.slots.find((s) => s.number === g.number)
      const start = slot?.start ?? sched?.attempts[0]?.start ?? null
      const base = { start, eventId, roundLabel: label, group: g.number, room: slot?.roomName ?? '' }
      const st = plan.config.stationNumbers
      g.competitors.forEach((id, i) =>
        out.push({ ...base, role: 'competitor', ref: `p${id}`, station: st ? i + 1 : null }),
      )
      g.judges.forEach((r, i) => out.push({ ...base, role: 'judge', ref: r, station: st ? i + 1 : null }))
      g.scramblers.forEach((r) => out.push({ ...base, role: 'scrambler', ref: r, station: null }))
      g.runners.forEach((r) => out.push({ ...base, role: 'runner', ref: r, station: null }))
      g.reserves.forEach((r) => out.push({ ...base, role: 'reserve', ref: r, station: null }))
    }
  }
  return out.sort((a, b) => (a.start ?? 0) - (b.start ?? 0) || a.group - b.group)
}

export function groupsCsv(wcif: Wcif, plan: Plan, L: ExportLabels, delimiter = ','): string {
  const tz = competitionTimezone(wcif)
  const order: Record<string, number> = { scrambler: 0, judge: 1, runner: 2, reserve: 3, competitor: 4 }
  const rows = lines(wcif, plan, L)
    .sort(
      (a, b) =>
        (a.start ?? 0) - (b.start ?? 0) ||
        a.roundLabel.localeCompare(b.roundLabel) ||
        a.group - b.group ||
        order[a.role] - order[b.role],
    )
    .map((l) => {
      const n = refName(wcif, plan, l.ref)
      return [l.roundLabel, l.group, l.room, fmtTime(l.start, tz), L.roles[l.role], n.name, n.wcaId, l.station]
    })
  return toCsv([[L.round, L.group, L.room, L.start, L.role, L.name, L.wcaId, L.station], ...rows], delimiter)
}

export function peopleCsv(wcif: Wcif, plan: Plan, L: ExportLabels, delimiter = ','): string {
  const tz = competitionTimezone(wcif)
  const byRef = new Map<Ref, Line[]>()
  for (const l of lines(wcif, plan, L)) byRef.set(l.ref, [...(byRef.get(l.ref) ?? []), l])
  const refs = [...byRef.keys()].sort((a, b) =>
    refName(wcif, plan, a).name.localeCompare(refName(wcif, plan, b).name, 'pt-BR'),
  )
  const rows = refs.map((ref) => {
    const n = refName(wcif, plan, ref)
    const list = byRef
      .get(ref)!
      .map((l) => `${fmtTime(l.start, tz).slice(11)} ${l.roundLabel} ${L.group} ${l.group}: ${L.roles[l.role]}`)
      .join(' | ')
    return [n.name, n.wcaId, list]
  })
  return toCsv([[L.person, L.wcaId, L.assignments], ...rows], delimiter)
}
