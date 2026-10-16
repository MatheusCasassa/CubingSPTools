// Cronograma: onde e quando cada grupo acontece.
// Os grupos são fatias de tempo iguais das atividades de rodada do WCIF
// (como no Groupifier). Rodadas em vários palcos/salas dividem os grupos
// entre as salas; a numeração é global, por horário de início.

import type { Wcif, WcifActivity, WcifRoom } from '../../../lib/wca/types'
import { ATTEMPT_EVENTS } from './types'

export interface Slot {
  number: number
  roomId: number
  roomName: string
  /** Atividade de rodada (pai) onde o grupo é criado. */
  parentActivityId: number
  /** Atividade de grupo já existente com o mesmo código (reaproveita o id). */
  existingActivityId: number | null
  start: number | null
  end: number | null
}

export interface RoundSchedule {
  roundId: string
  /** "groups" = fatias de tempo; "attempts" = FMC/MBLD com -a1, -a2… */
  kind: 'groups' | 'attempts' | 'none'
  slots: Slot[]
  /** Para "attempts": as atividades de tentativa (todos competem em todas). */
  attempts: { activityId: number; roomId: number; start: number | null; end: number | null }[]
  timezone: string
}

export const parseTime = (s?: string): number | null => {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

interface Located {
  room: WcifRoom
  activity: WcifActivity
  timezone: string
}

function topActivities(wcif: Wcif): Located[] {
  const out: Located[] = []
  for (const venue of wcif.schedule?.venues ?? []) {
    for (const room of venue.rooms ?? []) {
      for (const activity of room.activities ?? []) out.push({ room, activity, timezone: venue.timezone || 'UTC' })
    }
  }
  return out
}

export function competitionTimezone(wcif: Wcif): string {
  return wcif.schedule?.venues?.find((v) => v.timezone)?.timezone || 'UTC'
}

/** Divide `total` em `parts` inteiros quase iguais (os primeiros levam o resto). */
export function splitEven(total: number, parts: number): number[] {
  if (parts <= 0) return []
  const base = Math.floor(total / parts)
  const rem = total % parts
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0))
}

export function roundSchedule(wcif: Wcif, roundId: string, groupCount: number): RoundSchedule {
  const eventId = roundId.split('-')[0]
  const all = topActivities(wcif)
  const timezone = competitionTimezone(wcif)
  const parents = all.filter((l) => l.activity.activityCode === roundId)

  // FMC / MBLD: tentativas agendadas ("333fm-r1-a1"), no topo ou como filhas.
  if (ATTEMPT_EVENTS.has(eventId)) {
    const attemptRe = new RegExp(`^${roundId}-a\\d+$`)
    const attempts: RoundSchedule['attempts'] = []
    for (const l of all) {
      const visit = (a: WcifActivity) => {
        if (attemptRe.test(a.activityCode))
          attempts.push({
            activityId: a.id,
            roomId: l.room.id,
            start: parseTime(a.startTime),
            end: parseTime(a.endTime),
          })
        a.childActivities?.forEach(visit)
      }
      visit(l.activity)
    }
    if (attempts.length > 0) {
      attempts.sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
      return { roundId, kind: 'attempts', slots: [], attempts, timezone }
    }
  }

  if (parents.length === 0) {
    // Sem horário no cronograma: grupos "soltos" (não dá para publicar).
    return {
      roundId,
      kind: 'none',
      slots: Array.from({ length: groupCount }, (_, i) => ({
        number: i + 1,
        roomId: 0,
        roomName: '',
        parentActivityId: 0,
        existingActivityId: null,
        start: null,
        end: null,
      })),
      attempts: [],
      timezone,
    }
  }

  // Ordena as salas pelo horário e divide os grupos entre elas.
  parents.sort(
    (a, b) => (parseTime(a.activity.startTime) ?? 0) - (parseTime(b.activity.startTime) ?? 0) || a.room.id - b.room.id,
  )
  const perRoom = splitEven(groupCount, parents.length)
  type Temp = Omit<Slot, 'number' | 'existingActivityId'> & { order: number }
  const temps: Temp[] = []
  parents.forEach((p, idx) => {
    const n = perRoom[idx]
    const start = parseTime(p.activity.startTime)
    const end = parseTime(p.activity.endTime)
    for (let i = 0; i < n; i++) {
      const s = start != null && end != null ? start + ((end - start) * i) / n : null
      const e = start != null && end != null ? start + ((end - start) * (i + 1)) / n : null
      temps.push({
        roomId: p.room.id,
        roomName: p.room.name,
        parentActivityId: p.activity.id,
        start: s == null ? null : Math.round(s),
        end: e == null ? null : Math.round(e),
        order: idx,
      })
    }
  })
  temps.sort((a, b) => (a.start ?? 0) - (b.start ?? 0) || a.order - b.order)

  const slots: Slot[] = temps.map((t, i) => {
    const number = i + 1
    const parent = parents.find((p) => p.activity.id === t.parentActivityId)!
    const existing = parent.activity.childActivities?.find((c) => c.activityCode === `${roundId}-g${number}`)
    const { order: _o, ...rest } = t
    void _o
    return { ...rest, number, existingActivityId: existing?.id ?? null }
  })
  return { roundId, kind: 'groups', slots, attempts: [], timezone }
}

/** Grupos que já existem no WCIF para a rodada (vindos de outra ferramenta). */
export function existingGroupActivities(wcif: Wcif, roundId: string): { number: number; activityId: number }[] {
  const re = new RegExp(`^${roundId}-g(\\d+)$`)
  const out: { number: number; activityId: number }[] = []
  for (const l of topActivities(wcif)) {
    const visit = (a: WcifActivity) => {
      const m = a.activityCode.match(re)
      if (m) out.push({ number: Number(m[1]), activityId: a.id })
      a.childActivities?.forEach(visit)
    }
    visit(l.activity)
  }
  return out.sort((a, b) => a.number - b.number)
}

export function hasRoundInSchedule(wcif: Wcif, roundId: string): boolean {
  return topActivities(wcif).some(
    (l) => l.activity.activityCode === roundId || l.activity.activityCode.startsWith(`${roundId}-a`),
  )
}

export function maxActivityId(wcif: Wcif): number {
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

// ----------------------------------------------------------- horário local

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
    } catch {
      f = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
    }
    fmtCache.set(tz, f)
  }
  return f
}

/** Data local (AAAA-MM-DD), hora e minuto de um instante no fuso da competição. */
export function localParts(ms: number, tz: string): { date: string; hour: number; minute: number } {
  const parts = partsFormatter(tz).formatToParts(new Date(ms))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  }
}

/** Manhã = antes do meio-dia (horário local da competição). */
export function periodOf(ms: number, tz: string): { date: string; period: 'morning' | 'afternoon' } {
  const { date, hour } = localParts(ms, tz)
  return { date, period: hour < 12 ? 'morning' : 'afternoon' }
}

/** Dias da competição (AAAA-MM-DD), pelo cronograma do WCIF. */
export function competitionDays(wcif: Wcif): string[] {
  const start = wcif.schedule?.startDate
  const n = wcif.schedule?.numberOfDays ?? 1
  if (!start) return []
  const [y, m, d] = start.split('-').map(Number)
  return Array.from({ length: Math.max(1, n) }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d + i))
    return dt.toISOString().slice(0, 10)
  })
}

export function overlaps(
  a: { start: number | null; end: number | null },
  b: { start: number | null; end: number | null },
): boolean {
  if (a.start == null || a.end == null || b.start == null || b.end == null) return false
  return a.start < b.end && b.start < a.end
}
