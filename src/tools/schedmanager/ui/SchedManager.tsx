import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Spinner } from '../../../components/ui/Feedback'
import { EventIcon } from '../../../components/ui/EventIcon'
import { SchedManagerMark } from '../../../components/ui/icons'
import { useI18n } from '../../../i18n/I18nProvider'
import {
  CspApiError,
  getScheduleDraft,
  patchScheduleDraft,
  type SchedChange,
  type ScheduleDraft,
} from '../../../lib/csp/server'
import { fetchWcif, patchWcifParts, WcaApiError } from '../../../lib/wca/api'
import { eventName } from '../../../lib/wca/format'
import { applyChanges, emptyDraft } from '../../../../worker/api'
import { DuringHome, DuringPage, type DuringCtx, type DuringTool } from '../../during/DuringShell'
import { applyDraft, buildRows, days, diffMinutes, normalizeTime, nowIn, type ApplyResult, type SchedRow } from '../model/schedule'

export function useSchedManagerTool(): DuringTool {
  const { m } = useI18n()
  const t = m.schedmanager
  return {
    slug: 'schedmanager',
    name: 'SchedManager',
    mark: (c) => <SchedManagerMark className={c} />,
    access: 'staff',
    subtitle: t.subtitle,
    intro: t.intro,
    loginNote: t.loginNote,
    features: t.features,
  }
}

export function SchedManagerHome() {
  return <DuringHome tool={useSchedManagerTool()} />
}

export default function SchedManagerPage() {
  const { competitionId } = useParams()
  return (
    <DuringPage tool={useSchedManagerTool()} competitionId={competitionId} wide>
      {(ctx) => <Manager ctx={ctx} competitionId={competitionId!} />}
    </DuringPage>
  )
}

const DEMO_KEY = 'csp.schedmanager.demo'
const QUEUE_KEY = (id: string) => `csp.schedmanager.queue.${id}`

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function saveJson(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sem armazenamento */
  }
}

type Sync = 'idle' | 'saving' | 'saved' | 'offline' | 'error'

function Manager({ ctx, competitionId }: { ctx: DuringCtx; competitionId: string }) {
  const { m, tag } = useI18n()
  const t = m.schedmanager
  const [wcif, setWcif] = useState(ctx.wcif)
  const rows = useMemo(() => buildRows(wcif), [wcif])
  const allDays = useMemo(() => days(rows), [rows])
  const [day, setDay] = useState<string>(() => {
    const today = new Date().toISOString().slice(0, 10)
    return allDays.includes(today) ? today : (allDays[0] ?? '')
  })
  const [draft, setDraft] = useState<ScheduleDraft | null>(null)
  const [queue, setQueue] = useState<SchedChange[]>(() => (ctx.demo ? [] : loadJson(QUEUE_KEY(competitionId), [])))
  const [sync, setSync] = useState<Sync>('idle')
  const [error, setError] = useState<string | null>(null)
  const [review, setReview] = useState<ApplyResult | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const sending = useRef(false)

  // Carrega e acompanha o rascunho compartilhado.
  const refresh = useCallback(async () => {
    if (ctx.demo) {
      setDraft(loadJson<ScheduleDraft>(DEMO_KEY, emptyDraft('demo')))
      return
    }
    try {
      setDraft(await getScheduleDraft(ctx.token!, competitionId))
    } catch (e) {
      if (e instanceof CspApiError && e.status === 0) setSync('offline')
      else setError(e instanceof CspApiError && e.status === 401 ? m.errors.sessionExpired : m.errors.generic)
    }
  }, [ctx.demo, ctx.token, competitionId])

  useEffect(() => {
    void refresh()
    if (ctx.demo) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !sending.current) void refresh()
    }, 20_000)
    return () => window.clearInterval(id)
  }, [refresh, ctx.demo])

  // Envia as alterações (e guarda no aparelho se estiver sem internet).
  const flush = useCallback(
    async (pending: SchedChange[]) => {
      if (pending.length === 0 || sending.current) return
      if (ctx.demo) {
        setDraft((d) => {
          const next = applyChanges(d ?? emptyDraft('demo'), pending, 'Demo', new Date().toISOString())
          saveJson(DEMO_KEY, next)
          return next
        })
        setQueue([])
        setSync('saved')
        return
      }
      sending.current = true
      setSync('saving')
      try {
        const next = await patchScheduleDraft(ctx.token!, competitionId, pending)
        setDraft(next)
        setQueue((q) => {
          const rest = q.slice(pending.length)
          saveJson(QUEUE_KEY(competitionId), rest.length ? rest : null)
          return rest
        })
        setSync('saved')
      } catch (e) {
        if (e instanceof CspApiError && e.status === 0) setSync('offline')
        else {
          setSync('error')
          setError(e instanceof CspApiError && e.status === 401 ? m.errors.sessionExpired : m.errors.generic)
        }
      } finally {
        sending.current = false
      }
    },
    [ctx.demo, ctx.token, competitionId],
  )

  useEffect(() => {
    if (queue.length === 0) return
    const id = window.setTimeout(() => void flush(queue), sync === 'offline' ? 10_000 : 500)
    return () => window.clearTimeout(id)
  }, [queue, flush, sync])

  useEffect(() => {
    const on = () => queue.length && void flush(queue)
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [queue, flush])

  const change = (c: SchedChange) => {
    // Mostra na hora (otimista) e entra na fila.
    setDraft((d) => applyChanges(d ?? emptyDraft(competitionId), [c], m.schedmanager.you, new Date().toISOString()))
    setQueue((q) => {
      const next = [...q, c]
      if (!ctx.demo) saveJson(QUEUE_KEY(competitionId), next)
      return next
    })
  }

  const openReview = async () => {
    setError(null)
    setSaved(null)
    if (!draft) return
    setReview(applyDraft(wcif, rows, draft))
  }

  const saveToWca = async () => {
    if (!draft || ctx.demo || !ctx.token) return
    setSync('saving')
    try {
      // WCIF mais recente (outra pessoa pode ter mudado algo na WCA).
      const fresh = await fetchWcif(ctx.token, competitionId)
      const res = applyDraft(fresh, buildRows(fresh), draft)
      const next = { ...fresh, schedule: res.schedule, events: res.events ?? fresh.events }
      await patchWcifParts(ctx.token, competitionId, next, res.events ? ['schedule', 'events'] : ['schedule'])
      const after = await fetchWcif(ctx.token, competitionId)
      setWcif(after)
      // Os horários reais viram o novo planejado: o rascunho é limpo.
      const clear: SchedChange[] = [
        ...Object.keys(draft.rows).flatMap((key) => [
          { key, field: 'start' as const, value: null },
          { key, field: 'end' as const, value: null },
        ]),
        ...Object.keys(draft.sets).map((key) => ({ key, field: 'sets' as const, value: null })),
      ]
      setDraft(await patchScheduleDraft(ctx.token, competitionId, clear, true))
      setReview(null)
      setSaved(t.savedToWca(res.changes.length, res.sets.length))
      setSync('saved')
    } catch (e) {
      setSync('error')
      setError(
        e instanceof WcaApiError
          ? e.status === 401
            ? m.errors.sessionExpired
            : `${t.wcaError} ${e.message}`
          : m.errors.generic,
      )
    }
  }

  if (!draft) return <Spinner label={t.loading} />
  const dayRows = rows.filter((r) => r.date === day)
  const tz = rows[0]?.tz ?? 'UTC'
  const edited = Object.keys(draft.rows).length + Object.keys(draft.sets).length
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat(tag, { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(d + 'T12:00:00'))

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="info">{saved}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-fg-muted">{t.howTo(tz)}</p>
        <SyncBadge sync={sync} queue={queue.length} />
      </div>

      {allDays.length > 1 && (
        <div className="seg max-w-lg">
          {allDays.map((d) => (
            <button key={d} type="button" aria-pressed={d === day} onClick={() => setDay(d)}>
              {dayLabel(d)}
            </button>
          ))}
        </div>
      )}

      <div className="hidden grid-cols-[minmax(0,1fr)_7.5rem_7.5rem_5rem] gap-3 px-4 text-xs font-medium uppercase tracking-wider text-fg-faint sm:grid">
        <span>{t.activity}</span>
        <span>{t.start}</span>
        <span>{t.end}</span>
        <span>{t.sets}</span>
      </div>
      <ul className="space-y-2">
        {dayRows.map((r) => (
          <Row key={r.key} row={r} draft={draft} onChange={change} />
        ))}
      </ul>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="text-sm">
          <p className="font-medium">{t.editedCount(edited)}</p>
          <p className="mt-0.5 text-xs text-fg-faint">
            {draft.updatedBy && draft.updatedAt
              ? t.lastEdit(
                  draft.updatedBy,
                  new Intl.DateTimeFormat(tag, { timeStyle: 'short' }).format(new Date(draft.updatedAt)),
                )
              : t.noEdits}
            {draft.savedToWcaAt &&
              ` · ${t.lastSave(draft.savedToWcaBy ?? '', new Intl.DateTimeFormat(tag, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(draft.savedToWcaAt)))}`}
          </p>
        </div>
        {ctx.manager && !ctx.demo ? (
          <button type="button" className="btn-primary" disabled={edited === 0 || queue.length > 0} onClick={openReview}>
            {t.saveWca}
          </button>
        ) : (
          <p className="max-w-xs text-xs text-fg-faint">{ctx.demo ? t.demoNoSave : t.onlyManagersSave}</p>
        )}
      </div>

      {review && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={() => setReview(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.reviewTitle}
            className="card max-h-[90vh] w-full overflow-y-auto p-6 shadow-2xl sm:max-w-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">{t.reviewTitle}</h2>
            <p className="mt-1 text-sm text-fg-muted">{t.reviewHint}</p>
            {review.errors.length > 0 && (
              <div className="mt-4">
                <Alert>{t.reviewErrors(review.errors.map((e) => e.name).join(', '))}</Alert>
              </div>
            )}
            <ul className="mt-4 space-y-1.5 text-sm">
              {review.changes.map((c) => (
                <li key={c.key} className="flex justify-between gap-3">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 font-mono text-xs">
                    <span className="text-fg-faint line-through">{c.from}</span> → {c.to}
                  </span>
                </li>
              ))}
              {review.sets.map((s) => (
                <li key={s.roundId} className="flex justify-between gap-3">
                  <span className="truncate">{t.setsOf(s.roundId)}</span>
                  <span className="shrink-0 font-mono text-xs">
                    <span className="text-fg-faint line-through">{s.from ?? '–'}</span> → {s.to}
                  </span>
                </li>
              ))}
              {review.changes.length + review.sets.length === 0 && <li className="text-fg-faint">{t.nothingToSave}</li>}
            </ul>
            <p className="mt-4 text-xs text-fg-faint">{t.reviewNote}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setReview(null)}>
                {m.during.cancel}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={sync === 'saving' || review.changes.length + review.sets.length === 0}
                onClick={saveToWca}
              >
                {sync === 'saving' ? t.saving : t.confirmSave}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SyncBadge({ sync, queue }: { sync: Sync; queue: number }) {
  const { m } = useI18n()
  const t = m.schedmanager.sync
  const [text, cls] =
    sync === 'offline'
      ? [t.offline(queue), 'text-amber-600 dark:text-amber-300']
      : sync === 'saving' || queue > 0
        ? [t.saving, 'text-fg-muted']
        : sync === 'error'
          ? [t.error, 'text-red-600 dark:text-red-300']
          : [t.saved, 'text-emerald-600 dark:text-emerald-400']
  return <span className={`text-xs font-medium ${cls}`}>● {text}</span>
}

function TimeCell({
  value,
  placeholder,
  tz,
  label,
  onCommit,
}: {
  value: string
  placeholder: string
  tz: string
  label: string
  onCommit: (v: string) => void
}) {
  const { m } = useI18n()
  const [text, setText] = useState(value)
  const [bad, setBad] = useState(false)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value)
  }, [value])
  const commit = (raw: string) => {
    const v = normalizeTime(raw)
    if (v === null) return setBad(true)
    setBad(false)
    setText(v)
    if (v !== value) onCommit(v)
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        maxLength={5}
        onFocus={() => (focused.current = true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => {
          focused.current = false
          commit(e.target.value)
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={`w-full min-w-0 rounded-lg border bg-surface px-2.5 py-2 font-mono text-sm placeholder:text-fg-faint/70 focus:outline-none focus:ring-2 focus:ring-brand-400 ${
          bad ? 'border-red-500' : text ? 'border-brand-500/60' : 'border-border-subtle'
        }`}
      />
      <button
        type="button"
        title={m.schedmanager.now}
        aria-label={`${label}: ${m.schedmanager.now}`}
        onClick={() => commit(nowIn(tz))}
        className="shrink-0 rounded-md p-1.5 text-fg-faint hover:bg-surface-2 hover:text-brand-500"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

function Row({ row, draft, onChange }: { row: SchedRow; draft: ScheduleDraft; onChange: (c: SchedChange) => void }) {
  const { m } = useI18n()
  const t = m.schedmanager
  const d = draft.rows[row.key] ?? {}
  const start = d.start ?? ''
  const end = d.end ?? ''
  const sets = row.roundId ? draft.sets[row.roundId] : undefined
  const title =
    row.kind === 'other'
      ? row.name
      : `${eventName(row.eventId!)} · ${m.during.round(row.roundNumber!)}${row.attempt ? ` · ${t.attempt(row.attempt)}` : ''}`
  const shift = start ? diffMinutes(row.plannedStart, start) : null
  const invalid = diffMinutes(start || row.plannedStart, end || row.plannedEnd) <= 0
  return (
    <li
      className={`card grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4rem] items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_7.5rem_7.5rem_5rem] sm:gap-y-2 ${
        invalid ? 'border-red-500/60' : ''
      }`}
    >
      <div className="col-span-3 flex min-w-0 items-center gap-3 sm:col-span-1">
        {row.eventId ? (
          <EventIcon eventId={row.eventId} className="h-6 w-6 text-fg-muted" />
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-fg-faint">
            {row.plannedStart}–{row.plannedEnd} · {row.rooms.map((r) => r.name).join(', ')}
            {shift != null && shift !== 0 && (
              <span className={shift > 0 ? ' text-amber-600 dark:text-amber-300' : ' text-emerald-600 dark:text-emerald-400'}>
                {' '}
                · {t.shift(shift)}
              </span>
            )}
            {d.by && <span> · {t.by(d.by)}</span>}
          </p>
        </div>
      </div>
      <span className="mt-1 text-[11px] uppercase tracking-wider text-fg-faint sm:hidden">{t.start}</span>
      <span className="mt-1 text-[11px] uppercase tracking-wider text-fg-faint sm:hidden">{t.end}</span>
      <span className="mt-1 text-[11px] uppercase tracking-wider text-fg-faint sm:hidden">{row.roundId ? t.sets : ''}</span>
      <TimeCell
        value={start}
        placeholder={row.plannedStart}
        tz={row.tz}
        label={t.start}
        onCommit={(v) => onChange({ key: row.key, field: 'start', value: v || null })}
      />
      <TimeCell
        value={end}
        placeholder={row.plannedEnd}
        tz={row.tz}
        label={t.end}
        onCommit={(v) => onChange({ key: row.key, field: 'end', value: v || null })}
      />
      {row.roundId ? (
        <input
          type="number"
          min={1}
          max={26}
          inputMode="numeric"
          aria-label={t.sets}
          placeholder={String(row.plannedSets ?? row.groups ?? '')}
          defaultValue={sets ?? ''}
          key={`${row.roundId}-${sets ?? ''}`}
          onBlur={(e) => {
            const raw = e.target.value.trim()
            const v = raw === '' ? null : Math.round(Number(raw))
            if (v !== null && (!Number.isFinite(v) || v < 1 || v > 26)) return
            if (v !== (sets ?? null)) onChange({ key: row.roundId!, field: 'sets', value: v })
          }}
          className={`w-full rounded-lg border bg-surface px-2.5 py-2 font-mono text-sm placeholder:text-fg-faint/70 focus:outline-none focus:ring-2 focus:ring-brand-400 ${
            sets ? 'border-brand-500/60' : 'border-border-subtle'
          }`}
        />
      ) : (
        <span />
      )}
    </li>
  )
}
