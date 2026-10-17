// Presença por dia, pelas modalidades inscritas.
//
// Regra (Matheus, 16/10): quem está inscrito só em modalidades de um dia não
// é esperado nos outros dias — ex.: na Cuber Brasil Sumaré 2026 o 3BLD é no
// sábado e o 3x3 no domingo; quem só faz 3BLD não é escalado no domingo.
//
// Os dias de uma pessoa são os dias (no fuso da competição) em que acontece
// QUALQUER rodada das modalidades em que ela está inscrita. Quem não compete
// (staff não competidor) ou não tem modalidades fica presente em todos os dias.

import type { Wcif, WcifActivity, WcifPerson } from '../../../lib/wca/types'
import { competitionTimezone, localParts, parseTime } from './schedule'

const cache = new WeakMap<Wcif, Map<string, Set<string>>>()

/** Dias (AAAA-MM-DD) em que cada evento tem alguma rodada no cronograma. */
export function eventDays(wcif: Wcif): Map<string, Set<string>> {
  let out = cache.get(wcif)
  if (out) return out
  out = new Map()
  const tz = competitionTimezone(wcif)
  const visit = (a: WcifActivity, venueTz: string) => {
    const m = a.activityCode.match(/^([a-z0-9]+)-r\d+/)
    const start = parseTime(a.startTime)
    if (m && start != null) {
      const set = out!.get(m[1]) ?? new Set<string>()
      set.add(localParts(start, venueTz).date)
      out!.set(m[1], set)
    }
    a.childActivities?.forEach((c) => visit(c, venueTz))
  }
  for (const v of wcif.schedule?.venues ?? [])
    for (const r of v.rooms ?? []) for (const a of r.activities ?? []) visit(a, v.timezone || tz)
  cache.set(wcif, out)
  return out
}

/** Dias em que a pessoa deve estar presente; null = todos os dias. */
export function presenceDays(wcif: Wcif, p: WcifPerson): Set<string> | null {
  const reg = p.registration
  if (!reg || reg.isCompeting === false || !reg.eventIds?.length) return null
  const byEvent = eventDays(wcif)
  const days = new Set<string>()
  for (const e of reg.eventIds) byEvent.get(e)?.forEach((d) => days.add(d))
  return days.size > 0 ? days : null
}

/** A pessoa está no local neste horário (pelos dias das suas modalidades)? */
export function presentAt(wcif: Wcif, p: WcifPerson, start: number | null): boolean {
  if (start == null) return true
  const days = presenceDays(wcif, p)
  if (!days) return true
  return days.has(localParts(start, competitionTimezone(wcif)).date)
}
