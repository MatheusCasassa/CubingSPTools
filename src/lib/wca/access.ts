// Competições para as ferramentas "Durante a Competição".
//
//   delegate  só as competições em que a pessoa é Delegada (ou trainee).
//   staff     Delegados, Organizadores e quem tem função ou tarefa de staff
//             no WCIF da competição (juiz, embaralhador, corredor…).
//
// Só entram competições próximas: até 30 dias depois do fim e até 120 dias
// antes do início. O servidor do CSPTools confere de novo o vínculo antes de
// entregar dados protegidos (senhas, rascunho).

import { config } from '../config'
import { fetchManagedCompetitions } from './api'
import type { CompetitionListItem, Wcif, WcifPerson } from './types'

export type DuringAccess = 'delegate' | 'staff'
export type DuringRole = 'delegate' | 'organizer' | 'staff'

export interface DuringCompetition extends CompetitionListItem {
  role: DuringRole
}

const WINDOW_PAST_DAYS = 30
const WINDOW_FUTURE_DAYS = 120

const addDays = (iso: string, d: number) => new Date(Date.parse(iso + 'T00:00:00Z') + d * 86400_000).toISOString().slice(0, 10)

export function inWindow(c: CompetitionListItem, today: string): boolean {
  const end = c.end_date || c.start_date || ''
  const start = c.start_date || end
  return end >= addDays(today, -WINDOW_PAST_DAYS) && start <= addDays(today, WINDOW_FUTURE_DAYS)
}

async function getJson<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${config.wcaApiBase}${path}`, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok) throw new Error(`WCA ${res.status}`)
  return (await res.json()) as T
}

/** WCIF público (sem e-mail e data de nascimento). Não precisa de login. */
export const fetchPublicWcif = (id: string) => getJson<Wcif>(`/competitions/${encodeURIComponent(id)}/wcif/public`)

interface CompetitionInfo {
  delegates: { id: number }[]
  organizers: { id: number }[]
}

const fetchInfo = (id: string) => getJson<CompetitionInfo>(`/competitions/${encodeURIComponent(id)}`)

/** A pessoa tem função ou tarefa de staff neste WCIF? */
export function isStaffPerson(p: WcifPerson | undefined): boolean {
  if (!p) return false
  return (p.roles ?? []).length > 0 || p.assignments.some((a) => a.assignmentCode.startsWith('staff-'))
}

export const personOf = (wcif: Wcif, userId: number) => wcif.persons.find((p) => p.wcaUserId === userId)

export async function fetchDuringCompetitions(
  token: string,
  meId: number,
  need: DuringAccess,
  today: string,
): Promise<DuringCompetition[]> {
  const managed = (await fetchManagedCompetitions(token)).filter((c) => inWindow(c, today))
  const out: DuringCompetition[] = []
  await Promise.all(
    managed.map(async (c) => {
      try {
        const info = await fetchInfo(c.id)
        const delegate = info.delegates.some((d) => d.id === meId)
        if (delegate) out.push({ ...c, role: 'delegate' })
        else if (need === 'staff') out.push({ ...c, role: 'organizer' })
      } catch {
        /* competição inacessível: ignora */
      }
    }),
  )
  if (need === 'staff') {
    const mine = await getJson<{ future_competitions?: CompetitionListItem[]; past_competitions?: CompetitionListItem[] }>(
      '/competitions/mine',
      token,
    ).catch(() => ({ future_competitions: [], past_competitions: [] }))
    const seen = new Set(out.map((c) => c.id))
    const others = [...(mine.future_competitions ?? []), ...(mine.past_competitions ?? [])].filter(
      (c) => !seen.has(c.id) && inWindow(c, today),
    )
    await Promise.all(
      others.map(async (c) => {
        try {
          const wcif = await fetchPublicWcif(c.id)
          if (isStaffPerson(personOf(wcif, meId))) out.push({ ...c, role: 'staff' })
        } catch {
          /* sem WCIF: ignora */
        }
      }),
    )
  }
  return out
}
