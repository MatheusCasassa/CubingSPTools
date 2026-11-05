// Novatos = pessoas para quem ESTA competição foi a primeira.
//
// Antes do envio dos resultados, novato é quem não tem WCA ID. Depois do envio,
// os novatos ganham WCA ID e somem dessa regra — por isso, para quem tem WCA ID
// do ano da competição (o ano do WCA ID é o da primeira competição), a lista
// pública de competições da pessoa na WCA confirma se a primeira foi esta.
// Assim a categoria continua igual para sempre.

import type { Wcif } from '../../../lib/wca/types'

interface ApiCompetition {
  id: string
  start_date: string
}

/** Quem pode ter estreado nesta competição: WCA ID com o ano da competição. */
export function newcomerCandidates(wcif: Wcif): { registrantId: number; wcaId: string }[] {
  const start = wcif.schedule.startDate ?? ''
  const days = Math.max(1, wcif.schedule.numberOfDays ?? 1)
  const end = start ? new Date(Date.parse(start) + (days - 1) * 86400000).toISOString().slice(0, 10) : ''
  const years = new Set([start.slice(0, 4), end.slice(0, 4)].filter(Boolean))
  return wcif.persons
    .filter((p) => p.registrantId != null && p.wcaId && years.has(p.wcaId.slice(0, 4)))
    .map((p) => ({ registrantId: p.registrantId!, wcaId: p.wcaId! }))
}

/** A primeira competição da lista (pela data) é esta? */
export function isFirstCompetition(comps: ApiCompetition[], competitionId: string): boolean {
  if (comps.length === 0) return false
  const first = [...comps].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id.localeCompare(b.id))[0]
  return first.id === competitionId
}

/**
 * registrantIds de quem estreou nesta competição e já tem WCA ID (resultados
 * enviados). Quem ainda não tem WCA ID continua sendo novato pela regra antiga.
 */
export async function fetchFirstTimers(wcif: Wcif): Promise<Set<number>> {
  const { config } = await import('../../../lib/config')
  const list = newcomerCandidates(wcif)
  const out = new Set<number>()
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(6, list.length) }, async () => {
      while (next < list.length) {
        const c = list[next++]
        try {
          const res = await fetch(`${config.wcaApiBase}/persons/${encodeURIComponent(c.wcaId)}/competitions`, {
            headers: { Accept: 'application/json' },
          })
          if (res.ok && isFirstCompetition((await res.json()) as ApiCompetition[], wcif.id)) out.add(c.registrantId)
        } catch {
          /* sem rede: fica de fora */
        }
      }
    }),
  )
  return out
}
