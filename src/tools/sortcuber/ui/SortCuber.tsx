import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert } from '../../../components/ui/Feedback'
import { SortCuberMark } from '../../../components/ui/icons'
import { useI18n } from '../../../i18n/I18nProvider'
import { fetchLiveCompetition } from '../../../lib/wca/live'
import { DuringHome, DuringPage, type DuringCtx, type DuringTool } from '../../during/DuringShell'
import {
  candidates,
  DEFAULT_OPTIONS,
  draw,
  eligible,
  randomInt,
  type Candidate,
  type DrawOptions,
  type DrawRecord,
} from '../model/draw'

export function useSortCuberTool(): DuringTool {
  const { m } = useI18n()
  const t = m.sortcuber
  return {
    slug: 'sortcuber',
    name: 'SortCuber',
    mark: (c) => <SortCuberMark className={c} />,
    access: 'staff',
    subtitle: t.subtitle,
    intro: t.intro,
    loginNote: t.loginNote,
    features: t.features,
  }
}

export function SortCuberHome() {
  return <DuringHome tool={useSortCuberTool()} />
}

export default function SortCuberPage() {
  const { competitionId } = useParams()
  return (
    <DuringPage tool={useSortCuberTool()} competitionId={competitionId}>
      {(ctx) => <Raffle ctx={ctx} />}
    </DuringPage>
  )
}

const KEY = (id: string) => `csp.sortcuber.${id}`

interface Saved {
  options: DrawOptions
  history: DrawRecord[]
}

function load(id: string): Saved {
  try {
    const raw = localStorage.getItem(KEY(id))
    if (raw) {
      const s = JSON.parse(raw) as Saved
      return { options: { ...DEFAULT_OPTIONS, ...s.options }, history: s.history ?? [] }
    }
  } catch {
    /* sem armazenamento */
  }
  return { options: DEFAULT_OPTIONS, history: [] }
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

function Raffle({ ctx }: { ctx: DuringCtx }) {
  const { m, tag } = useI18n()
  const t = m.sortcuber
  const id = ctx.demo ? 'demo' : ctx.wcif.id
  const all = useMemo(() => candidates(ctx.wcif), [ctx.wcif])
  const [saved, setSaved] = useState<Saved>(() => load(id))
  const [present, setPresent] = useState<Set<number> | null>(null)
  const [liveState, setLiveState] = useState<'loading' | 'ready' | 'none'>('loading')
  const [count, setCount] = useState(1)
  const [prize, setPrize] = useState('')
  const [rolling, setRolling] = useState<string | null>(null)
  const [result, setResult] = useState<Candidate[] | null>(null)
  const [search, setSearch] = useState('')
  const timer = useRef<number>()

  const opts = saved.options
  const persist = (s: Saved) => {
    setSaved(s)
    try {
      localStorage.setItem(KEY(id), JSON.stringify(s))
    } catch {
      /* sem armazenamento */
    }
  }
  const setOpt = <K extends keyof DrawOptions>(k: K, v: DrawOptions[K]) => persist({ ...saved, options: { ...opts, [k]: v } })

  // Presença: quem tem pelo menos uma tentativa feita no WCA Live.
  useEffect(() => {
    let active = true
    fetchLiveCompetition(ctx.wcif.id, ctx.wcif.name)
      .then((live) => {
        if (!active) return
        if (!live) return setLiveState('none')
        const ids = new Set<number>()
        for (const ev of live.events)
          for (const rd of ev.rounds)
            for (const r of rd.results)
              if (r.person.registrantId != null && r.attempts.some((a) => a > 0 || a === -1)) ids.add(r.person.registrantId)
        setPresent(ids)
        setLiveState('ready')
      })
      .catch(() => active && setLiveState('none'))
    return () => {
      active = false
    }
  }, [ctx.wcif.id, ctx.wcif.name])
  useEffect(() => () => window.clearInterval(timer.current), [])

  const winners = saved.history.flatMap((h) => h.winners.map((w) => w.registrantId))
  const pool = eligible(all, { ...opts, presentOnly: opts.presentOnly && liveState === 'ready' }, present, winners)

  const run = () => {
    if (pool.length === 0) return
    const picked = draw(pool, count)
    setResult(null)
    let ticks = 0
    window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      ticks++
      setRolling(pool[randomInt(pool.length)].name)
      if (ticks >= 22) {
        window.clearInterval(timer.current)
        setRolling(null)
        setResult(picked)
        persist({
          ...saved,
          history: [
            {
              at: new Date().toISOString(),
              prize: prize.trim(),
              poolSize: pool.length,
              winners: picked.map((c) => ({ registrantId: c.registrantId, name: c.name, wcaId: c.wcaId })),
            },
            ...saved.history,
          ].slice(0, 50),
        })
      }
    }, 70)
  }

  const excluded = new Set(opts.excluded)
  const matches =
    search.trim().length >= 2
      ? all.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()) && !excluded.has(c.registrantId)).slice(0, 6)
      : []

  return (
    <div className="space-y-6">
      {/* Resultado */}
      <div className="card flex min-h-[12rem] flex-col items-center justify-center p-6 text-center">
        {rolling ? (
          <p className="text-3xl font-semibold text-fg-muted">{rolling}</p>
        ) : result ? (
          <div className="w-full">
            <p className="text-xs uppercase tracking-wider text-fg-muted">
              {saved.history[0]?.prize || (result.length === 1 ? t.winner : t.winners)}
            </p>
            <ul className="mt-4 space-y-3">
              {result.map((c) => (
                <li key={c.registrantId} className="flex items-center justify-center gap-3">
                  {c.avatar && <img src={c.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />}
                  <span className="text-left">
                    <span className="block text-2xl font-semibold sm:text-3xl">{c.name}</span>
                    <span className="text-xs text-fg-faint">
                      {c.wcaId ?? t.newcomer} · {t.registrant(c.registrantId)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-fg-faint">{t.ready(pool.length)}</p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-fg-muted">
          {t.prize}
          <input
            type="text"
            value={prize}
            maxLength={60}
            placeholder={t.prizePlaceholder}
            onChange={(e) => setPrize(e.target.value)}
            className="mt-1 block w-56 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-fg-muted">
          {t.count}
          <input
            type="number"
            min={1}
            max={Math.max(1, pool.length)}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(50, Math.round(Number(e.target.value) || 1))))}
            className="mt-1 block w-24 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm"
          />
        </label>
        <button type="button" className="btn-primary px-8 py-3 text-base" disabled={!!rolling || pool.length === 0} onClick={run}>
          {t.draw}
        </button>
      </div>
      {count > pool.length && pool.length > 0 && <Alert tone="warn">{t.fewer(pool.length)}</Alert>}

      {/* Critérios */}
      <div className="card space-y-3 p-5">
        <h2 className="font-semibold">{t.rules}</h2>
        <p className="text-xs text-fg-faint">{t.approvedOnly(all.length)}</p>
        <Toggle checked={opts.noDelegates} onChange={(v) => setOpt('noDelegates', v)}>
          {t.noDelegates}
        </Toggle>
        <Toggle checked={opts.noOrganizers} onChange={(v) => setOpt('noOrganizers', v)}>
          {t.noOrganizers}
        </Toggle>
        <Toggle checked={opts.noRepeat} onChange={(v) => setOpt('noRepeat', v)}>
          {t.noRepeat}
        </Toggle>
        <div>
          <Toggle checked={opts.presentOnly} onChange={(v) => setOpt('presentOnly', v)}>
            {t.presentOnly}
          </Toggle>
          <p className="ml-6 mt-1 text-xs text-fg-faint">
            {liveState === 'loading'
              ? t.presentLoading
              : liveState === 'none'
                ? t.presentUnavailable
                : t.presentCount(present?.size ?? 0)}
          </p>
        </div>
        <div className="border-t border-border-subtle pt-3">
          <span className="label">{t.exclude}</span>
          <input
            type="search"
            value={search}
            placeholder={t.searchPlaceholder}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm"
          />
          {matches.length > 0 && (
            <ul className="mt-2 space-y-1">
              {matches.map((c) => (
                <li key={c.registrantId}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                    onClick={() => {
                      setOpt('excluded', [...opts.excluded, c.registrantId])
                      setSearch('')
                    }}
                  >
                    + {c.name} <span className="text-xs text-fg-faint">({c.wcaId ?? t.newcomer})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {opts.excluded.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {opts.excluded.map((rid) => {
                const c = all.find((x) => x.registrantId === rid)
                return (
                  <button
                    key={rid}
                    type="button"
                    className="chip border-border-subtle hover:border-red-500/60"
                    onClick={() => setOpt('excluded', opts.excluded.filter((x) => x !== rid))}
                  >
                    {c?.name ?? `#${rid}`} ×
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Histórico */}
      {saved.history.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t.history}</h2>
            <button
              type="button"
              className="text-xs text-fg-muted hover:text-fg"
              onClick={() => window.confirm(t.clearConfirm) && persist({ ...saved, history: [] })}
            >
              {t.clearHistory}
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {saved.history.map((h) => (
              <li key={h.at} className="flex flex-wrap justify-between gap-2 border-t border-border-subtle pt-2">
                <span>
                  {h.prize && <span className="font-medium">{h.prize}: </span>}
                  {h.winners.map((w) => w.name).join(', ')}
                </span>
                <span className="text-xs text-fg-faint">
                  {new Intl.DateTimeFormat(tag, { timeStyle: 'short' }).format(new Date(h.at))} · {t.among(h.poolSize)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
