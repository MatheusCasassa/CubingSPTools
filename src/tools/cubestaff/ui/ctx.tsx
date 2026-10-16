import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Wcif, WcifPerson } from '../../../lib/wca/types'
import { eventName } from '../../../lib/wca/format'
import { useI18n } from '../../../i18n/I18nProvider'
import { refId, type Plan, type Ref } from '../model/types'
import { findRound, isDelegate, isNewcomer } from '../model/people'
import { competitionTimezone } from '../model/schedule'
import type { CubeStaffState } from './useCubeStaff'

export interface PersonInfo {
  ref: Ref
  name: string
  wcaId: string | null
  newcomer: boolean
  delegate: boolean
  organizer: boolean
  extra: boolean
  person?: WcifPerson
}

interface Ctx {
  s: CubeStaffState
  wcif: Wcif
  plan: Plan
  person: (ref: Ref) => PersonInfo
  roundLabel: (roundId: string) => string
  where: (roundId: string, group: number) => string
  time: (ms: number | null, withDay?: boolean) => string
  tz: string
}

const C = createContext<Ctx | null>(null)

export function CubeStaffProvider({ s, children }: { s: CubeStaffState; children: ReactNode }) {
  const { m, tag } = useI18n()
  const wcif = s.wcif!
  const plan = s.plan!
  const value = useMemo<Ctx>(() => {
    const byId = new Map(wcif.persons.filter((p) => p.registrantId != null).map((p) => [p.registrantId!, p]))
    const tz = competitionTimezone(wcif)
    const timeFmt = new Intl.DateTimeFormat(tag, { timeZone: tz, hour: '2-digit', minute: '2-digit' })
    const dayFmt = new Intl.DateTimeFormat(tag, { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit' })
    const person = (ref: Ref): PersonInfo => {
      const id = refId(ref)
      if (id != null) {
        const p = byId.get(id)
        return {
          ref,
          name: p?.name ?? `#${id}`,
          wcaId: p?.wcaId ?? null,
          newcomer: p ? isNewcomer(p) : false,
          delegate: p ? isDelegate(p) : false,
          organizer: !!p?.roles?.includes('organizer'),
          extra: false,
          person: p,
        }
      }
      const x = plan.extras.find((e) => `x${e.id}` === ref)
      return { ref, name: x?.name ?? ref, wcaId: null, newcomer: false, delegate: false, organizer: false, extra: true }
    }
    const roundLabel = (roundId: string) => {
      const info = findRound(wcif, roundId)
      const ev = eventName(roundId.split('-')[0])
      return info ? m.cubestaff.roundName(ev, info.number, info.total) : roundId
    }
    return {
      s,
      wcif,
      plan,
      person,
      roundLabel,
      where: (roundId, group) => `${roundLabel(roundId)} · ${m.cubestaff.group(group)}`,
      time: (ms, withDay = false) => (ms == null ? '' : (withDay ? dayFmt : timeFmt).format(new Date(ms))),
      tz,
    }
  }, [s, wcif, plan, m, tag])
  return <C.Provider value={value}>{children}</C.Provider>
}

export function useCs(): Ctx {
  const v = useContext(C)
  if (!v) throw new Error('useCs fora do CubeStaffProvider')
  return v
}
