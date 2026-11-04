import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Spinner } from '../../../components/ui/Feedback'
import { EventIcon } from '../../../components/ui/EventIcon'
import { EasyPasswordMark } from '../../../components/ui/icons'
import { useI18n } from '../../../i18n/I18nProvider'
import { CspApiError, deletePasscodes, getPasscodes, putPasscodes, type PasscodeEntry, type PasscodeFile } from '../../../lib/csp/server'
import { eventName } from '../../../lib/wca/format'
import { DuringHome, DuringPage, type DuringCtx, type DuringTool } from '../../during/DuringShell'
import { groupPasscodes, parsePasscodes, sameCompetition, setKey } from '../model/parse'

export function useEasyPasswordTool(): DuringTool {
  const { m } = useI18n()
  const t = m.easypassword
  return {
    slug: 'easypassword',
    name: 'EasyPassword',
    mark: (c) => <EasyPasswordMark className={c} />,
    access: 'delegate',
    subtitle: t.subtitle,
    intro: t.intro,
    loginNote: t.loginNote,
    features: t.features,
  }
}

export function EasyPasswordHome() {
  return <DuringHome tool={useEasyPasswordTool()} />
}

export default function EasyPasswordPage() {
  const { competitionId } = useParams()
  const tool = useEasyPasswordTool()
  return (
    <DuringPage tool={tool} competitionId={competitionId}>
      {(ctx) => <Passwords ctx={ctx} competitionId={competitionId!} />}
    </DuringPage>
  )
}

const SEEN_KEY = (id: string) => `csp.easypassword.seen.${id}`
const HIDE_AFTER_MS = 90_000

function readSeen(id: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY(id)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function errorText(e: unknown, m: ReturnType<typeof useI18n>['m']): string {
  if (e instanceof CspApiError) {
    if (e.status === 401) return m.errors.sessionExpired
    if (e.status === 403) return m.during.deniedDelegate
    if (e.status === 0) return m.during.offline
    if (e.code === 'badFile') return m.easypassword.badFile
  }
  return m.errors.generic
}

function Passwords({ ctx, competitionId }: { ctx: DuringCtx; competitionId: string }) {
  const { m, tag } = useI18n()
  const t = m.easypassword
  const id = competitionId
  const [file, setFile] = useState<PasscodeFile | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [replacing, setReplacing] = useState(false)

  useEffect(() => {
    let active = true
    getPasscodes(ctx.token!, competitionId)
      .then((f) => active && setFile(f))
      .catch((e) => active && (setError(errorText(e, m)), setFile(null)))
    return () => {
      active = false
    }
  }, [ctx.token, competitionId])

  const upload = async (entries: PasscodeEntry[], fileName: string, title: string) => {
    setBusy(true)
    setError(null)
    try {
      setFile(await putPasscodes(ctx.token!, competitionId, { entries, fileName, title }))
      setReplacing(false)
    } catch (e) {
      setError(errorText(e, m))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(t.deleteConfirm)) return
    setBusy(true)
    try {
      await deletePasscodes(ctx.token!, competitionId)
      setFile(null)
      try {
        localStorage.removeItem(SEEN_KEY(id))
      } catch {
        /* sem armazenamento */
      }
    } catch (e) {
      setError(errorText(e, m))
    } finally {
      setBusy(false)
    }
  }

  if (file === undefined) return <Spinner label={t.loading} />
  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {(!file || replacing) && (
        <Uploader
          competitionName={ctx.wcif.name}
          busy={busy}
          onUpload={upload}
          onCancel={file ? () => setReplacing(false) : undefined}
        />
      )}
      {file && !replacing && <Viewer file={file} storageId={id} />}
      {file && !replacing && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5 text-xs text-fg-faint">
          <span>
            {t.uploadedBy(
              file.uploadedBy.name,
              new Intl.DateTimeFormat(tag, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(file.uploadedAt)),
            )}
            {` · ${t.expires}`}
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setReplacing(true)} disabled={busy}>
              {t.replace}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={remove} disabled={busy}>
              {t.delete}
            </button>
          </span>
        </div>
      )}
    </div>
  )
}

function Uploader({
  competitionName,
  busy,
  onUpload,
  onCancel,
}: {
  competitionName: string
  busy: boolean
  onUpload: (entries: PasscodeEntry[], fileName: string, title: string) => void
  onCancel?: () => void
}) {
  const { m } = useI18n()
  const t = m.easypassword
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, setPending] = useState<{ entries: PasscodeEntry[]; fileName: string; title: string } | null>(null)

  const read = async (f: File) => {
    setProblem(null)
    setPending(null)
    if (f.size > 200_000) return setProblem(t.badFile)
    const parsed = parsePasscodes(await f.text())
    if (parsed.entries.length === 0) return setProblem(t.badFile)
    const item = { entries: parsed.entries, fileName: f.name, title: parsed.title || competitionName }
    if (parsed.title && !sameCompetition(parsed.title, competitionName)) setPending(item)
    else onUpload(item.entries, item.fileName, item.title)
  }

  return (
    <div className="card p-6 sm:p-8">
      <h2 className="text-lg font-semibold">{t.uploadTitle}</h2>
      <p className="mt-1 text-sm text-fg-muted">{t.uploadHint}</p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          const f = e.dataTransfer.files[0]
          if (f) void read(f)
        }}
        disabled={busy}
        className={`mt-5 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
          drag ? 'border-brand-500 bg-brand-500/10' : 'border-border-strong hover:border-brand-500/60'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-brand-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 16V4m0 0-4 4m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-medium">{busy ? t.saving : t.choose}</span>
        <span className="text-xs text-fg-faint">{t.fileExample}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void read(f)
        }}
      />
      {problem && (
        <div className="mt-4">
          <Alert>{problem}</Alert>
        </div>
      )}
      {pending && (
        <div className="mt-4 space-y-3">
          <Alert tone="warn">{t.otherCompetition(pending.title, competitionName)}</Alert>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => onUpload(pending.entries, pending.fileName, pending.title)}
            >
              {t.uploadAnyway}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setPending(null)}>
              {m.during.cancel}
            </button>
          </div>
        </div>
      )}
      <p className="mt-5 text-xs leading-relaxed text-fg-faint">{t.privacy}</p>
      {onCancel && (
        <button type="button" className="btn-ghost btn-sm mt-4" onClick={onCancel}>
          {m.during.cancel}
        </button>
      )}
    </div>
  )
}

function Viewer({ file, storageId }: { file: PasscodeFile; storageId: string }) {
  const { m } = useI18n()
  const t = m.easypassword
  const events = useMemo(() => groupPasscodes(file.entries), [file])
  const [evKey, setEvKey] = useState<string | null>(null)
  const [round, setRound] = useState<number | null>(null)
  const [open, setOpen] = useState<PasscodeEntry | null>(null)
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(storageId))
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>()

  const ev = events.find((e) => e.key === evKey) ?? null
  const rd = ev?.rounds.find((r) => r.round === round) ?? ev?.rounds[0] ?? null

  const hide = useCallback(() => {
    setOpen(null)
    setCopied(false)
    window.clearTimeout(timer.current)
  }, [])

  const reveal = (e: PasscodeEntry) => {
    setOpen(e)
    setCopied(false)
    const next = new Set(seen).add(setKey(e))
    setSeen(next)
    try {
      localStorage.setItem(SEEN_KEY(storageId), JSON.stringify([...next]))
    } catch {
      /* sem armazenamento: só nesta tela */
    }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(hide, HIDE_AFTER_MS)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const label = (e: { eventId: string | null; event: string }) => (e.eventId ? eventName(e.eventId) : e.event)
  const roundName = (n: number, total: number) => (n === total && total > 1 ? m.during.final : m.during.round(n))

  // 1) modalidade
  if (!ev)
    return (
      <div>
        <p className="mb-4 text-sm text-fg-muted">{t.pickEvent}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {events.map((e) => {
            const total = e.rounds.reduce((a, r) => a + r.sets.length, 0)
            const done = e.rounds.reduce((a, r) => a + r.sets.filter((s) => seen.has(setKey(s))).length, 0)
            return (
              <button
                key={e.key}
                type="button"
                onClick={() => {
                  setEvKey(e.key)
                  setRound(e.rounds[0]?.round ?? null)
                  hide()
                }}
                className="card flex items-center gap-3 px-4 py-4 text-left transition-colors hover:border-brand-500/60"
              >
                {e.eventId ? <EventIcon eventId={e.eventId} className="h-8 w-8" /> : null}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{label(e)}</span>
                  <span className="text-xs text-fg-faint">{t.setsSeen(done, total)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )

  // 2) set e 3) senha
  return (
    <div>
      <button type="button" className="text-sm text-fg-muted hover:text-fg" onClick={() => (setEvKey(null), hide())}>
        ← {t.allEvents}
      </button>
      <div className="mt-4 flex items-center gap-3">
        {ev.eventId && <EventIcon eventId={ev.eventId} className="h-9 w-9" />}
        <h2 className="text-2xl font-semibold">{label(ev)}</h2>
      </div>
      {ev.rounds.length > 1 && (
        <div className="seg mt-5 max-w-md">
          {ev.rounds.map((r) => (
            <button
              key={r.round}
              type="button"
              aria-pressed={rd?.round === r.round}
              onClick={() => (setRound(r.round), hide())}
            >
              {roundName(r.round, ev.rounds.length)}
            </button>
          ))}
        </div>
      )}
      <p className="mb-3 mt-6 text-sm text-fg-muted">{t.pickSet}</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {rd?.sets.map((s) => {
          const k = setKey(s)
          const active = open && setKey(open) === k
          return (
            <button
              key={k}
              type="button"
              onClick={() => (active ? hide() : reveal(s))}
              aria-pressed={!!active}
              className={`relative flex flex-col items-center justify-center rounded-xl border px-2 py-4 transition-colors ${
                active
                  ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300'
                  : 'border-border-subtle bg-surface hover:border-brand-500/60'
              }`}
            >
              <span className="text-2xl font-semibold">{s.set}</span>
              {s.attempt != null && <span className="text-[11px] text-fg-faint">{t.attempt(s.attempt)}</span>}
              {seen.has(k) && !active && (
                <span className="absolute right-1.5 top-1 text-xs text-emerald-500" title={t.seen}>
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>
      {open && rd && (
        <div className="card mt-6 p-6 text-center">
          <p className="text-xs uppercase tracking-wider text-fg-muted">
            {label(ev)} · {roundName(rd.round, ev.rounds.length)} · {t.set(open.set)}
            {open.attempt != null ? ` · ${t.attempt(open.attempt)}` : ''}
          </p>
          <p className="mt-3 select-all break-all font-mono text-4xl font-semibold tracking-[0.2em] sm:text-5xl">
            {open.code}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(open.code).then(() => setCopied(true))
              }}
            >
              {copied ? t.copied : t.copy}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={hide}>
              {t.hide}
            </button>
          </div>
          <p className="mt-4 text-xs text-fg-faint">{t.autoHide}</p>
        </div>
      )}
    </div>
  )
}
