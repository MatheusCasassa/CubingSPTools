// Estado da página da competição: WCIF, plano, histórico (desfazer/refazer),
// rascunho local automático e gravação na WCA com detecção de conflito.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Wcif } from '../../../lib/wca/types'
import { fetchWcif, patchWcifParts, WcaApiError } from '../../../lib/wca/api'
import type { Plan } from '../model/types'
import { generate, pendingRounds, type Note } from '../model/engine'
import {
  buildWcif,
  changedOutside,
  planFromWcif,
  readExtension,
  roundFromWcif,
  withExtensionOnly,
} from '../model/publish'
import { clearDraft, loadDraft, saveDraft, savePreviewWcif, type LocalDraft } from '../model/storage'
import { checkPlan, type Issue } from '../model/report'
import { demoCubeStaffWcif, demoPlan, DEMO_ID } from '../model/demo'

export type LoadState = 'loading' | 'ready' | 'error'

export interface Conflict {
  remote: Plan
  who: string
  at: string
  retry: () => Promise<void>
}

export function useCubeStaff(competitionId: string, token: string | null, meName: string | undefined) {
  const isDemo = competitionId === 'demo'
  const storageId = isDemo ? DEMO_ID : competitionId
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [wcif, setWcif] = useState<Wcif | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [past, setPast] = useState<Plan[]>([])
  const [future, setFuture] = useState<Plan[]>([])
  const [from, setFrom] = useState<'extension' | 'wcif' | 'empty'>('empty')
  const [baseRevision, setBaseRevision] = useState(0)
  const [remoteSavedAt, setRemoteSavedAt] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [localSavedAt, setLocalSavedAt] = useState<string | null>(null)
  const [pendingDraft, setPendingDraft] = useState<LocalDraft | null>(null)
  const [outside, setOutside] = useState<string[]>([])
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [saving, setSaving] = useState<null | 'draft' | 'publish' | 'refresh'>(null)
  const [lastNotes, setLastNotes] = useState<Note[]>([])

  // ---- carregamento
  const load = useCallback(async () => {
    setState('loading')
    setError(null)
    try {
      let w: Wcif
      let p: Plan
      let src: 'extension' | 'wcif' | 'empty'
      if (isDemo) {
        w = demoCubeStaffWcif()
        p = demoPlan(w)
        src = 'empty'
      } else {
        if (!token) return
        w = await fetchWcif(token, competitionId)
        const r = planFromWcif(w)
        p = r.plan
        src = r.from
      }
      setWcif(w)
      setPlan(p)
      setFrom(src)
      setPast([])
      setFuture([])
      setBaseRevision(p.revision)
      setRemoteSavedAt(src === 'extension' ? p.updatedAt : null)
      setOutside(src === 'extension' ? changedOutside(w, p) : [])
      setDirty(false)
      const draft = loadDraft(storageId)
      if (
        draft &&
        JSON.stringify(draft.plan) !== JSON.stringify(p) &&
        draft.savedAt > (src === 'extension' ? p.updatedAt : '')
      ) {
        setPendingDraft(draft)
      }
      setState('ready')
    } catch (e) {
      setError(
        e instanceof WcaApiError && (e.status === 403 || e.status === 404)
          ? 'noPermission'
          : e instanceof WcaApiError && e.status === 401
            ? 'sessionExpired'
            : 'loadCompetition',
      )
      setState('error')
    }
  }, [competitionId, isDemo, storageId, token])

  useEffect(() => {
    void load()
  }, [load])

  // ---- rascunho local automático (debounce)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!plan || !dirty) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const savedAt = new Date().toISOString()
      if (saveDraft(storageId, { plan, baseRevision, savedAt })) setLocalSavedAt(savedAt)
    }, 600)
    return () => window.clearTimeout(timer.current)
  }, [plan, dirty, baseRevision, storageId])

  // ---- histórico
  // Edições seguidas do mesmo campo (ex.: digitar um número) viram um único
  // passo de "desfazer".
  const lastKey = useRef<{ key: string; at: number } | null>(null)
  const commit = useCallback(
    (next: Plan, coalesceKey?: string) => {
      if (!plan) return
      const now = Date.now()
      const same = coalesceKey && lastKey.current?.key === coalesceKey && now - lastKey.current.at < 1500
      if (!same) setPast((p) => [...p.slice(-49), plan])
      lastKey.current = coalesceKey ? { key: coalesceKey, at: now } : null
      setFuture([])
      setPlan(next)
      setDirty(true)
    },
    [plan],
  )
  const undo = useCallback(() => {
    if (!plan || past.length === 0) return
    setFuture((f) => [plan, ...f])
    setPlan(past[past.length - 1])
    setPast((p) => p.slice(0, -1))
    setDirty(true)
  }, [plan, past])
  const redo = useCallback(() => {
    if (!plan || future.length === 0) return
    setPast((p) => [...p, plan])
    setPlan(future[0])
    setFuture((f) => f.slice(1))
    setDirty(true)
  }, [plan, future])

  const restoreDraft = useCallback(
    (yes: boolean) => {
      if (yes && pendingDraft) commit(pendingDraft.plan)
      else clearDraft(storageId)
      setPendingDraft(null)
    },
    [pendingDraft, commit, storageId],
  )

  // ---- geração
  const run = useCallback(
    (roundIds: string[]) => {
      if (!wcif || !plan) return []
      const res = generate(wcif, plan, { roundIds })
      commit(res.plan)
      setLastNotes(res.notes)
      return res.notes
    },
    [wcif, plan, commit],
  )

  /** Busca resultados novos na WCA (sem mexer no plano) e devolve rodadas prontas. */
  const refreshResults = useCallback(async () => {
    if (!wcif || !plan) return []
    if (isDemo) return pendingRounds(wcif, plan)
    if (!token) return []
    setSaving('refresh')
    try {
      const fresh = await fetchWcif(token, competitionId)
      // Mantém o plano local; só atualiza eventos/resultados, pessoas e cronograma.
      setWcif(fresh)
      return pendingRounds(fresh, plan)
    } finally {
      setSaving(null)
    }
  }, [wcif, plan, isDemo, token, competitionId])

  // ---- gravação na WCA
  const stamp = (p: Plan): Plan => ({
    ...p,
    revision: baseRevision + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: meName,
  })

  const guarded = useCallback(
    async (fn: (fresh: Wcif) => Promise<void>, force = false): Promise<boolean> => {
      if (!token) return false
      const fresh = await fetchWcif(token, competitionId)
      const remote = readExtension(fresh)
      if (!force && remote && remote.revision !== baseRevision) {
        setConflict({
          remote,
          who: remote.updatedBy ?? '?',
          at: remote.updatedAt,
          retry: async () => {
            setConflict(null)
            await guarded(fn, true)
          },
        })
        return false
      }
      await fn(fresh)
      return true
    },
    [token, competitionId, baseRevision],
  )

  const saveRemoteDraft = useCallback(async (): Promise<boolean> => {
    if (!plan || isDemo) return false
    setSaving('draft')
    try {
      return await guarded(async (fresh) => {
        const next = stamp(plan)
        const out = withExtensionOnly(fresh, next)
        await patchWcifParts(token!, competitionId, out, ['extensions'])
        setWcif(out)
        setPlan(next)
        setBaseRevision(next.revision)
        setRemoteSavedAt(next.updatedAt)
        setDirty(false)
        clearDraft(storageId)
      })
    } finally {
      setSaving(null)
    }
  }, [plan, isDemo, guarded, token, competitionId, storageId, baseRevision, meName])

  const publish = useCallback(
    async (roundIds: string[]): Promise<boolean> => {
      if (!plan || isDemo) return false
      setSaving('publish')
      try {
        return await guarded(async (fresh) => {
          const next = stamp(plan)
          const built = buildWcif(fresh, next, roundIds)
          await patchWcifParts(token!, competitionId, built.wcif, ['persons', 'schedule', 'extensions'])
          const saved = readExtension(built.wcif)!
          setWcif(built.wcif)
          setPlan(saved)
          setBaseRevision(saved.revision)
          setRemoteSavedAt(saved.updatedAt)
          setOutside([])
          setDirty(false)
          clearDraft(storageId)
        })
      } finally {
        setSaving(null)
      }
    },
    [plan, isDemo, guarded, token, competitionId, storageId, baseRevision, meName],
  )

  const acceptRemote = useCallback(() => {
    if (!conflict) return
    setPlan(conflict.remote)
    setBaseRevision(conflict.remote.revision)
    setRemoteSavedAt(conflict.remote.updatedAt)
    setDirty(false)
    setConflict(null)
    clearDraft(storageId)
  }, [conflict, storageId])

  /** Substitui as rodadas alteradas fora do CubeStaff pela versão da WCA. */
  const importOutside = useCallback(() => {
    if (!wcif || !plan) return
    const next = structuredClone(plan)
    for (const roundId of outside) {
      const rp = roundFromWcif(wcif, roundId)
      if (rp) next.rounds[roundId] = rp
      else delete next.rounds[roundId]
    }
    commit(next)
    setOutside([])
  }, [wcif, plan, outside, commit])

  /** WCIF com os grupos do plano para o ScoreComps (sem publicar). */
  const preparePreview = useCallback(() => {
    if (!wcif || !plan) return null
    const built = buildWcif(wcif, plan, undefined, false)
    savePreviewWcif(storageId, built.wcif)
    return storageId
  }, [wcif, plan, storageId])

  const issues: Issue[] = useMemo(() => (wcif && plan ? checkPlan(wcif, plan) : []), [wcif, plan])

  return {
    isDemo,
    state,
    error,
    wcif,
    plan,
    from,
    commit,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    run,
    refreshResults,
    saveRemoteDraft,
    publish,
    saving,
    dirty,
    localSavedAt,
    remoteSavedAt,
    baseRevision,
    pendingDraft,
    restoreDraft,
    outside,
    importOutside,
    conflict,
    acceptRemote,
    dismissConflict: () => setConflict(null),
    preparePreview,
    issues,
    lastNotes,
    clearNotes: () => setLastNotes([]),
    reload: load,
  }
}

export type CubeStaffState = ReturnType<typeof useCubeStaff>
