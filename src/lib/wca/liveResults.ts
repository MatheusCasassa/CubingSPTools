// Resultados ao vivo de DUAS fontes, enquanto a WCA não termina a migração:
//
// - WCA Live (live.worldcubeassociation.org, GraphQL), o sistema de sempre;
// - Integrated Live Results (ILR), o sistema novo dentro do site da WCA, já
//   usado em competições com dual rounds (rodadas ligadas) e obrigatório para
//   FTO a partir de 2027.
//
// Uma mesma competição pode usar as duas (ex.: só as rodadas ligadas no ILR).
// Por isso a leitura é feita RODADA A RODADA: fica a fonte com mais resultados
// naquela rodada. Quando a WCA migrar tudo para o ILR, basta tirar o WCA Live
// daqui (as ferramentas só conhecem `fetchLiveResults`).
//
// API pública do ILR (sem login, CORS liberado):
//   GET /api/v1/competitions/:id/live/rounds/:roundId
//   → { id, format, competitors[{id, registrant_id, name, wca_id, country_iso2}],
//       results[{registration_id, local_pos, global_pos, best, average, attempts[{attempt_number, value}]}],
//       linked_round_ids }

import type { Wcif } from './types'
import { fetchLiveCompetition, type LiveCompetition, type LiveEvent, type LiveResult, type LiveRound } from './live'

export const ILR_API = 'https://www.worldcubeassociation.org/api/v1/competitions'

/** Página pública dos resultados ao vivo da competição no site da WCA (ILR). */
export const ilrUrl = (competitionId: string) =>
  `https://www.worldcubeassociation.org/competitions/${encodeURIComponent(competitionId)}/live`

interface IlrRound {
  id: string
  format: string
  competitors: { id: number; registrant_id: number | null; name: string; wca_id: string | null; country_iso2: string | null }[]
  results: {
    registration_id: number
    local_pos: number | null
    global_pos: number | null
    best: number
    average: number
    attempts: { attempt_number: number; value: number }[]
  }[]
  linked_round_ids?: string[] | null
}

/** Converte uma rodada do ILR para o mesmo formato do WCA Live. */
export function ilrToResults(r: IlrRound): LiveResult[] {
  const people = new Map(r.competitors.map((c) => [c.id, c]))
  return r.results.map((x) => {
    const p = people.get(x.registration_id)
    return {
      // Posição dentro da rodada (como no WCA Live). Em dual rounds, o ILR
      // também tem a posição combinada (global_pos), que não usamos aqui.
      ranking: x.best === 0 ? null : (x.local_pos ?? x.global_pos),
      best: x.best,
      average: x.average,
      attempts: [...x.attempts].sort((a, b) => a.attempt_number - b.attempt_number).map((a) => a.value),
      person: {
        id: `ilr-${x.registration_id}`,
        name: p?.name ?? `#${x.registration_id}`,
        wcaId: p?.wca_id ?? null,
        registrantId: p?.registrant_id ?? null,
        countryIso2: p?.country_iso2 ?? null,
      },
    }
  })
}

/** Uma rodada no ILR (null se a competição/rodada não estiver no ILR). */
export async function fetchIlrRound(competitionId: string, roundId: string): Promise<LiveResult[] | null> {
  const res = await fetch(
    `${ILR_API}/${encodeURIComponent(competitionId)}/live/rounds/${encodeURIComponent(roundId)}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!res.ok) return null
  const data = (await res.json().catch(() => null)) as IlrRound | null
  if (!data || !Array.isArray(data.results)) return null
  return ilrToResults(data)
}

/** Vários pedidos ao mesmo tempo, sem exagerar. */
async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

const entered = (rs: LiveResult[] | null | undefined) => (rs ?? []).filter((r) => r.best !== 0).length

const ROUND_NAMES = ['First round', 'Second round', 'Semi final']

/** Junta as duas fontes rodada a rodada, na ordem do WCIF. */
export function mergeSources(
  wcif: Wcif,
  wcaLive: LiveCompetition | null,
  ilr: Map<string, LiveResult[] | null>,
): (LiveCompetition & { sources: { wcaLive: boolean; ilr: boolean } }) | null {
  let usedLive = false
  let usedIlr = false
  const events: LiveEvent[] = wcif.events.map((ev) => {
    const liveEv = wcaLive?.events.find((e) => e.eventId === ev.id)
    const rounds: LiveRound[] = ev.rounds.map((rd, i) => {
      const number = i + 1
      const liveRd = liveEv?.rounds.find((r) => r.number === number)
      const fromIlr = ilr.get(rd.id) ?? null
      const useIlr = entered(fromIlr) > entered(liveRd?.results)
      const results = useIlr ? fromIlr! : (liveRd?.results ?? [])
      if (results.length > 0) {
        if (useIlr) usedIlr = true
        else usedLive = true
      }
      const fmt = rd.format
      return {
        id: liveRd?.id ?? rd.id,
        number,
        name: liveRd?.name ?? (number === ev.rounds.length ? 'Final' : ROUND_NAMES[i] ?? `Round ${number}`),
        finished: liveRd?.finished ?? false,
        open: liveRd?.open ?? results.length > 0,
        numResults: results.length,
        format: liveRd?.format ?? {
          id: fmt,
          numberOfAttempts: fmt === 'a' ? 5 : fmt === 'm' || fmt === '3' ? 3 : Number(fmt) || 1,
          sortBy: fmt === 'a' || fmt === 'm' ? 'average' : 'best',
        },
        results,
      }
    })
    return { eventId: ev.id, name: liveEv?.name ?? ev.id, rounds }
  })
  if (!wcaLive && !usedIlr) return null
  return {
    liveId: wcaLive?.liveId ?? '',
    wcaId: wcif.id,
    name: wcif.name,
    fetchedAt: new Date().toISOString(),
    events,
    sources: { wcaLive: usedLive || (!!wcaLive && !usedIlr), ilr: usedIlr },
  }
}

export type LiveResults = NonNullable<ReturnType<typeof mergeSources>>

/**
 * Resultados ao vivo da competição, juntando WCA Live e ILR.
 * null = a competição não está em nenhum dos dois (ou ainda não tem resultados).
 */
export async function fetchLiveResults(wcif: Wcif): Promise<LiveResults | null> {
  const roundIds = wcif.events.flatMap((e) => e.rounds.map((r) => r.id))
  const [wcaLive, ilrList] = await Promise.all([
    fetchLiveCompetition(wcif.id, wcif.name).catch(() => null),
    pool(roundIds, 6, (id) => fetchIlrRound(wcif.id, id).catch(() => null)),
  ])
  return mergeSources(wcif, wcaLive, new Map(roundIds.map((id, i) => [id, ilrList[i]])))
}
