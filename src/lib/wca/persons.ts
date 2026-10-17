// Busca PÚBLICA de pessoas na WCA (sem login): nome ou WCA ID → recordes
// pessoais. Uma única chamada (/persons?q=…) já traz os PRs de cada pessoa.

export interface PersonPRs {
  wcaId: string
  name: string
  countryIso2: string
  /** Melhor média (PR de média) por evento, em centésimos. */
  averages: Record<string, number>
}

interface ApiPerson {
  person: { name: string; wca_id: string; country_iso2?: string; country?: { iso2?: string } }
  personal_records?: Record<string, { average?: { best: number } }>
}

export const WCA_ID_RE = /^\d{4}[A-Z]{4}\d{2}$/i

export function parsePersons(data: ApiPerson[]): PersonPRs[] {
  return data.map((p) => {
    const averages: Record<string, number> = {}
    for (const [ev, rec] of Object.entries(p.personal_records ?? {})) {
      const best = rec.average?.best
      if (best != null && best > 0) averages[ev] = best
    }
    return {
      wcaId: p.person.wca_id,
      name: p.person.name,
      countryIso2: p.person.country_iso2 ?? p.person.country?.iso2 ?? '',
      averages,
    }
  })
}

/** Até 10 pessoas para o texto digitado (nome ou WCA ID). */
export async function searchPersons(query: string, signal?: AbortSignal): Promise<PersonPRs[]> {
  const q = query.trim()
  // Import tardio: mantém parsePersons testável no Node (sem import.meta.env).
  const { config } = await import('../config')
  const res = await fetch(`${config.wcaApiBase}/persons?q=${encodeURIComponent(q)}&per_page=10`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) throw new Error(`WCA ${res.status}`)
  const list = parsePersons((await res.json()) as ApiPerson[])
  // WCA ID exato primeiro.
  const up = q.toUpperCase()
  return list.sort((a, b) => Number(b.wcaId === up) - Number(a.wcaId === up))
}
