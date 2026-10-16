// Cliente da API da WCA. Todas as chamadas usam o access_token (Bearer).

import { config } from '../config'
import type { Wcif, CompetitionListItem, WcaMe } from './types'

export class WcaApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'WcaApiError'
  }
}

async function apiFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${config.wcaApiBase}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new WcaApiError(`Erro ${res.status} ao acessar ${path}`, res.status)
  }
  return (await res.json()) as T
}

/** Dados do usuário logado. */
export async function fetchMe(token: string): Promise<WcaMe> {
  const data = await apiFetch<{ me: WcaMe }>('/me', token)
  return data.me
}

/** Determina se o usuário é Delegado (qualquer nível) pela API. */
export function isDelegate(me: WcaMe): boolean {
  const status = (me.delegate_status ?? '').toLowerCase()
  if (status && status !== 'none') return true
  const roles = (me.roles ?? []).map((r) => r.toLowerCase())
  return roles.some((r) => r.includes('delegate'))
}

/**
 * Competições que o usuário pode gerenciar (é Delegado OU Organizador).
 * O parâmetro managed_by_me faz a WCA filtrar pelo vínculo do usuário —
 * é isto que restringe a geração de súmulas às competições permitidas.
 */
export async function fetchManagedCompetitions(token: string): Promise<CompetitionListItem[]> {
  return apiFetch<CompetitionListItem[]>(
    '/competitions?managed_by_me=true&sort=-start_date&per_page=100',
    token,
  )
}

/** WCIF completo e gerenciável da competição (requer scope manage_competitions). */
export async function fetchWcif(token: string, competitionId: string): Promise<Wcif> {
  return apiFetch<Wcif>(`/competitions/${competitionId}/wcif`, token)
}

/**
 * Salva as mudanças na WCA via PATCH parcial do WCIF (persons + schedule).
 * Remove `registration` de cada pessoa (a API reavalia o status senão) —
 * mesmo cuidado do Groupifier.
 */
export async function patchWcif(
  token: string,
  competitionId: string,
  wcif: Wcif,
): Promise<void> {
  const persons = wcif.persons.map((p) => {
    const { registration: _omit, ...rest } = p
    void _omit
    return rest
  })
  const body = JSON.stringify({ persons, schedule: wcif.schedule })
  const res = await fetch(`${config.wcaApiBase}/competitions/${competitionId}/wcif`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new WcaApiError(`Falha ao salvar WCIF (${res.status}). ${text}`, res.status)
  }
}
