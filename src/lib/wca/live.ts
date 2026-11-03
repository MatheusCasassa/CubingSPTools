// WCA Live (GraphQL público, com CORS liberado). A API limita a
// "complexidade" de cada consulta, então os resultados vêm rodada a rodada,
// em lotes pequenos.

/** WCA Live (GraphQL público). */
export const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api'

export interface LivePerson {
  id: string
  name: string
  wcaId: string | null
  registrantId: number | null
  countryIso2: string | null
}

export interface LiveResult {
  ranking: number | null
  best: number
  average: number
  attempts: number[]
  person: LivePerson
}

export interface LiveRound {
  id: string
  number: number
  name: string
  finished: boolean
  open: boolean
  numResults: number
  format: { id: string; numberOfAttempts: number; sortBy: 'best' | 'average' }
  results: LiveResult[]
}

export interface LiveEvent {
  eventId: string
  name: string
  rounds: LiveRound[]
}

export interface LiveCompetition {
  liveId: string
  wcaId: string
  name: string
  events: LiveEvent[]
  fetchedAt: string
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(WCA_LIVE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const data = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null
  if (!res.ok || !data?.data) throw new Error(data?.errors?.[0]?.message ?? `WCA Live ${res.status}`)
  return data.data
}

/** Id da competição no WCA Live a partir do id da WCA (null se não importada). */
export async function findLiveId(wcaId: string, name: string): Promise<string | null> {
  const terms = [name, wcaId]
  for (const filter of terms) {
    const d = await gql<{ competitions: { id: string; wcaId: string }[] }>(
      'query($f:String!){competitions(filter:$f,limit:20){id wcaId}}',
      { f: filter },
    )
    const hit = d.competitions.find((c) => c.wcaId === wcaId)
    if (hit) return hit.id
  }
  return null
}

const RESULT_FIELDS =
  'results{ranking best average attempts{result} person{id name wcaId registrantId country{iso2}}}'

/** Todos os resultados da competição no WCA Live (null se não estiver no WCA Live). */
export async function fetchLiveCompetition(wcaId: string, name: string): Promise<LiveCompetition | null> {
  const liveId = await findLiveId(wcaId, name)
  if (!liveId) return null
  type RawRound = Omit<LiveRound, 'results'>
  const head = await gql<{
    competition: { name: string; competitionEvents: { event: { id: string; name: string }; rounds: RawRound[] }[] }
  }>(
    'query($id:ID!){competition(id:$id){name competitionEvents{event{id name} rounds{id number name finished open numResults format{id numberOfAttempts sortBy}}}}}',
    { id: liveId },
  )
  const rounds = head.competition.competitionEvents.flatMap((e) => e.rounds.filter((r) => r.numResults > 0))
  const results = new Map<string, LiveResult[]>()
  // Lotes de rodadas por consulta, abaixo do limite de complexidade.
  for (let i = 0; i < rounds.length; i += 3) {
    const batch = rounds.slice(i, i + 3)
    const q = `{${batch.map((r, k) => `r${k}:round(id:"${r.id}"){id ${RESULT_FIELDS}}`).join(' ')}}`
    type Raw = {
      id: string
      results: {
        ranking: number | null
        best: number
        average: number
        attempts: { result: number }[]
        person: { id: string; name: string; wcaId: string | null; registrantId: number | null; country: { iso2: string } | null }
      }[]
    }
    const d = await gql<Record<string, Raw | null>>(q)
    for (const r of Object.values(d)) {
      if (!r) continue
      results.set(
        r.id,
        r.results.map((x) => ({
          ranking: x.ranking,
          best: x.best,
          average: x.average,
          attempts: x.attempts.map((a) => a.result),
          person: {
            id: x.person.id,
            name: x.person.name,
            wcaId: x.person.wcaId,
            registrantId: x.person.registrantId,
            countryIso2: x.person.country?.iso2 ?? null,
          },
        })),
      )
    }
  }
  return {
    liveId,
    wcaId,
    name: head.competition.name,
    fetchedAt: new Date().toISOString(),
    events: head.competition.competitionEvents.map((e) => ({
      eventId: e.event.id,
      name: e.event.name,
      rounds: e.rounds.map((r) => ({ ...r, results: results.get(r.id) ?? [] })),
    })),
  }
}

/** Link da competição no WCA Live. */
export const liveUrl = (liveId: string) => `https://live.worldcubeassociation.org/competitions/${liveId}`
