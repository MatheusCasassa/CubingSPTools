// Carrega a competição para uma ferramenta "Durante" e confere o vínculo da
// pessoa logada (Delegado, Organizador ou staff).

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth/AuthContext'
import { fetchWcif, WcaApiError } from '../../lib/wca/api'
import { isStaffPerson, personOf, type DuringAccess, type DuringRole } from '../../lib/wca/access'
import type { Wcif } from '../../lib/wca/types'

export type LoadState = 'loading' | 'ready' | 'login' | 'denied' | 'error'

export function roleIn(wcif: Wcif, userId: number): DuringRole | null {
  const p = personOf(wcif, userId)
  const roles = p?.roles ?? []
  if (roles.includes('delegate') || roles.includes('trainee-delegate')) return 'delegate'
  if (roles.includes('organizer')) return 'organizer'
  return isStaffPerson(p) ? 'staff' : null
}

export function useDuringCompetition(competitionId: string | undefined, need: DuringAccess) {
  const { token, me, status: authStatus } = useAuth()
  const [state, setState] = useState<LoadState>('loading')
  const [wcif, setWcif] = useState<Wcif | null>(null)
  const [role, setRole] = useState<DuringRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!competitionId) return
    if (authStatus === 'loading') return
    if (!token || !me) {
      setState('login')
      return
    }
    try {
      // Para quem gerencia, a WCA devolve o WCIF completo (com data de
      // nascimento); para os demais, o público.
      const w = await fetchWcif(token.accessToken, competitionId)
      const r = roleIn(w, me.id)
      setWcif(w)
      setRole(r)
      setState(r && (need === 'staff' || r === 'delegate') ? 'ready' : 'denied')
    } catch (e) {
      setError(e instanceof WcaApiError && e.status === 401 ? 'session' : e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }, [competitionId, need, token, me, authStatus])

  useEffect(() => {
    void load()
  }, [load])

  return {
    state,
    wcif,
    role,
    error,
    reload: load,
    /** Delegado ou Organizador: pode salvar na WCA e vê a data de nascimento. */
    manager: role === 'delegate' || role === 'organizer',
    token: token?.accessToken ?? null,
  }
}
