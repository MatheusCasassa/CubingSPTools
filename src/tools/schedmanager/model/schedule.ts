// SchedManager: horários reais do cronograma.
//
// Cada linha é uma atividade do cronograma da WCA (rodada, tentativa de
// FMC/MBLD ou outra: almoço, premiação…). A mesma atividade em vários palcos
// com o mesmo horário vira uma linha só. Os horários são digitados na hora
// local do local da competição ("HH:MM") e convertidos para UTC ao salvar.

import type { ScheduleDraft } from '../../../lib/csp/server'
import type { Wcif, WcifActivity, WcifEvent, WcifSchedule } from '../../../lib/wca/types'

// ------------------------------------------------------------ fusos horários

function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

/** "AAAA-MM-DD" + "HH:MM" na hora local de `tz` → instante ISO (UTC). */
export function zonedToUtc(date: string, time: string, tz: string): string {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  let t = guess - tzOffsetMs(guess, tz)
  t = guess - tzOffsetMs(t, tz) // horário de verão: segunda volta
  return new Date(t).toISOString().replace('.000Z', 'Z')
}

/** Instante ISO → data e hora locais de `tz`. */
export function localOf(iso: string, tz: string): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? '00'
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` }
}

/** Hora atual em `tz` ("HH:MM"). */
export const nowIn = (tz: string, now = new Date()) => localOf(now.toISOString(), tz).time

/** Aceita "1015", "10:15", "10h15", "9:5" → "10:15" (null se inválido; "" se vazio). */
export function normalizeTime(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/h/, ':')
  if (s === '') return ''
  let h: number
  let m: number
  const colon = s.match(/^(\d{1,2})[:.](\d{1,2})$/)
  if (colon) {
    h = Number(colon[1])
    m = Number(colon[2].length === 1 ? colon[2] + '0' : colon[2])
  } else if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, s.length - 2))
    m = Number(s.slice(-2))
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s)
    m = 0
  } else return null
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
/** Diferença em minutos (b − a) entre dois "HH:MM". */
export const diffMinutes = (a: string, b: string) => minutes(b) - minutes(a)

// ------------------------------------------------------------------- linhas

export type RowKind = 'round' | 'attempt' | 'other'

export interface SchedRow {
  key: string
  code: string
  kind: RowKind
  name: string
  eventId: string | null
  roundNumber: number | null
  attempt: number | null
  /** "333-r1" para rodadas e tentativas. */
  roundId: string | null
  date: string
  tz: string
  plannedStart: string
  plannedEnd: string
  startIso: string
  endIso: string
  rooms: { roomId: number; name: string; color?: string }[]
  activityIds: number[]
  /** Grupos planejados (atividades-filhas -gN). */
  groups: number
  /** Sets planejados (scrambleSetCount da rodada). */
  plannedSets: number | null
}

export function parseCode(code: string): { eventId: string | null; round: number | null; attempt: number | null } {
  const m = code.match(/^([a-z0-9]+)-r(\d+)(?:-a(\d+))?$/)
  if (!m || code.startsWith('other-')) return { eventId: null, round: null, attempt: null }
  return { eventId: m[1], round: Number(m[2]), attempt: m[3] ? Number(m[3]) : null }
}

function findRound(events: WcifEvent[], roundId: string) {
  for (const e of events) for (const r of e.rounds) if (r.id === roundId) return r
  return null
}

export function buildRows(wcif: Wcif): SchedRow[] {
  const raw: (SchedRow & { roomOrder: number })[] = []
  let roomOrder = 0
  for (const venue of wcif.schedule.venues) {
    const tz = venue.timezone || 'UTC'
    for (const room of venue.rooms) {
      roomOrder++
      for (const a of room.activities) {
        if (!a.startTime || !a.endTime) continue
        const s = localOf(a.startTime, tz)
        const e = localOf(a.endTime, tz)
        const p = parseCode(a.activityCode)
        const roundId = p.eventId ? `${p.eventId}-r${p.round}` : null
        const round = roundId ? findRound(wcif.events, roundId) : null
        raw.push({
          key: '',
          code: a.activityCode,
          kind: p.attempt ? 'attempt' : p.eventId ? 'round' : 'other',
          name: a.name,
          eventId: p.eventId,
          roundNumber: p.round,
          attempt: p.attempt,
          roundId,
          date: s.date,
          tz,
          plannedStart: s.time,
          plannedEnd: e.time,
          startIso: a.startTime,
          endIso: a.endTime,
          rooms: [{ roomId: room.id, name: room.name, color: (room as { color?: string }).color }],
          activityIds: [a.id],
          groups: a.childActivities?.length ?? 0,
          plannedSets: round?.scrambleSetCount ?? null,
          roomOrder,
        })
      }
    }
  }
  // Mesma atividade e mesmo horário em vários palcos → uma linha.
  const merged: (SchedRow & { roomOrder: number })[] = []
  for (const r of raw) {
    const same = merged.find((x) => x.code === r.code && x.startIso === r.startIso && x.endIso === r.endIso)
    if (same) {
      same.rooms.push(...r.rooms)
      same.activityIds.push(...r.activityIds)
      same.groups = Math.max(same.groups, r.groups)
    } else merged.push({ ...r, rooms: [...r.rooms], activityIds: [...r.activityIds] })
  }
  merged.sort((a, b) => a.startIso.localeCompare(b.startIso) || a.roomOrder - b.roomOrder || a.code.localeCompare(b.code))
  // Chave estável: código@dia (+#n se a mesma atividade aparece mais de uma vez no dia).
  const count = new Map<string, number>()
  return merged.map(({ roomOrder: _o, ...r }) => {
    void _o
    const base = `${r.code}@${r.date}`
    const n = (count.get(base) ?? 0) + 1
    count.set(base, n)
    return { ...r, key: n === 1 ? base : `${base}#${n}` }
  })
}

export const days = (rows: SchedRow[]) => [...new Set(rows.map((r) => r.date))].sort()

// ---------------------------------------------------- aplicar no cronograma

export interface ScheduleChange {
  key: string
  name: string
  from: string
  to: string
}

export interface SetsChange {
  roundId: string
  from: number | null
  to: number
}

export interface ApplyResult {
  schedule: WcifSchedule
  events: WcifEvent[] | null
  changes: ScheduleChange[]
  sets: SetsChange[]
  errors: { key: string; name: string }[]
}

function rescale(a: WcifActivity, os: number, oe: number, ns: number, ne: number) {
  const map = (t: number) => (oe === os ? ns : ns + ((t - os) / (oe - os)) * (ne - ns))
  for (const c of a.childActivities ?? []) {
    if (c.startTime && c.endTime) {
      const cs = Date.parse(c.startTime)
      const ce = Date.parse(c.endTime)
      c.startTime = new Date(Math.round(map(cs) / 1000) * 1000).toISOString().replace('.000Z', 'Z')
      c.endTime = new Date(Math.round(map(ce) / 1000) * 1000).toISOString().replace('.000Z', 'Z')
      rescale(c, cs, ce, Date.parse(c.startTime), Date.parse(c.endTime))
    }
  }
}

/**
 * Aplica o rascunho ao WCIF: novos início/fim das atividades (os grupos dentro
 * de cada rodada acompanham, proporcionalmente) e o número de sets de cada
 * rodada. Linhas com fim antes do início entram em `errors` e não mudam.
 */
export function applyDraft(wcif: Wcif, rows: SchedRow[], draft: ScheduleDraft): ApplyResult {
  const schedule: WcifSchedule = structuredClone(wcif.schedule)
  const byId = new Map<number, WcifActivity>()
  for (const v of schedule.venues) for (const r of v.rooms) for (const a of r.activities) byId.set(a.id, a)
  const changes: ScheduleChange[] = []
  const errors: { key: string; name: string }[] = []
  for (const row of rows) {
    const d = draft.rows[row.key]
    if (!d || (!d.start && !d.end)) continue
    const start = d.start ?? row.plannedStart
    const end = d.end ?? row.plannedEnd
    if (start === row.plannedStart && end === row.plannedEnd) continue
    if (diffMinutes(start, end) <= 0) {
      errors.push({ key: row.key, name: row.name })
      continue
    }
    const ns = zonedToUtc(row.date, start, row.tz)
    const ne = zonedToUtc(row.date, end, row.tz)
    for (const id of row.activityIds) {
      const a = byId.get(id)
      if (!a?.startTime || !a.endTime) continue
      const os = Date.parse(a.startTime)
      const oe = Date.parse(a.endTime)
      a.startTime = ns
      a.endTime = ne
      rescale(a, os, oe, Date.parse(ns), Date.parse(ne))
    }
    changes.push({
      key: row.key,
      name: row.name,
      from: `${row.plannedStart}–${row.plannedEnd}`,
      to: `${start}–${end}`,
    })
  }
  const sets: SetsChange[] = []
  let events: WcifEvent[] | null = null
  for (const [roundId, n] of Object.entries(draft.sets)) {
    const round = findRound(wcif.events, roundId)
    if (!round || round.scrambleSetCount === n) continue
    sets.push({ roundId, from: round.scrambleSetCount ?? null, to: n })
  }
  if (sets.length > 0) {
    events = structuredClone(wcif.events)
    for (const e of events)
      for (const r of e.rounds) {
        const s = sets.find((x) => x.roundId === r.id)
        if (s) r.scrambleSetCount = s.to
        // Resultados não são enviados de volta (o WCA Live cuida deles).
        delete (r as { results?: unknown }).results
      }
  }
  return { schedule, events, changes, sets, errors }
}
