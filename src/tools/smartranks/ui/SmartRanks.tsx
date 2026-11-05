import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Spinner } from '../../../components/ui/Feedback'
import { EventIcon } from '../../../components/ui/EventIcon'
import { SmartRanksMark } from '../../../components/ui/icons'
import { useI18n } from '../../../i18n/I18nProvider'
import { liveUrl } from '../../../lib/wca/live'
import { fetchLiveResults, ilrUrl, type LiveResults } from '../../../lib/wca/liveResults'
import { fetchFirstTimers } from '../model/newcomers'
import { eventName } from '../../../lib/wca/format'
import { DuringHome, DuringPage, type DuringCtx, type DuringTool } from '../../during/DuringShell'
import {
  apsPoints,
  byAge,
  categoryStandings,
  eventFinished,
  headline,
  needsBirthdate,
  personsInfo,
  sortByOf,
  toCsv,
  type AgeMode,
  type AgeOrder,
  type Category,
} from '../model/ranks'

export function useSmartRanksTool(): DuringTool {
  const { m } = useI18n()
  const t = m.smartranks
  return {
    slug: 'smartranks',
    name: 'SmartRanks',
    mark: (c) => <SmartRanksMark className={c} />,
    access: 'staff',
    subtitle: t.subtitle,
    intro: t.intro,
    loginNote: t.loginNote,
    features: t.features,
  }
}

export function SmartRanksHome() {
  return <DuringHome tool={useSmartRanksTool()} />
}

export default function SmartRanksPage() {
  const { competitionId } = useParams()
  return (
    <DuringPage tool={useSmartRanksTool()} competitionId={competitionId} wide>
      {(ctx) => <Ranks ctx={ctx} />}
    </DuringPage>
  )
}

type CatKind = Category['kind']
type View = 'events' | 'points'
type AgeChoice = AgeMode | AgeOrder
const isOrder = (a: AgeChoice): a is AgeOrder => a === 'youngest' || a === 'oldest'

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function Ranks({ ctx }: { ctx: DuringCtx }) {
  const { m, tag } = useI18n()
  const t = m.smartranks
  const [live, setLive] = useState<LiveResults | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<CatKind>('newcomers')
  const [ageMode, setAgeMode] = useState<AgeChoice>('upTo')
  const [ageMin, setAgeMin] = useState(40)
  const [ageMax, setAgeMax] = useState(12)
  const [view, setView] = useState<View>('events')
  const [top, setTop] = useState(3)
  const [copied, setCopied] = useState(false)
  const [firstTimers, setFirstTimers] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, first] = await Promise.all([fetchLiveResults(ctx.wcif), fetchFirstTimers(ctx.wcif)])
      setFirstTimers(first)
      setLive(res)
    } catch (e) {
      setError(`${t.liveError} ${e instanceof Error ? e.message : ''}`)
    } finally {
      setLoading(false)
    }
  }, [ctx.wcif])
  useEffect(() => {
    void load()
  }, [load])

  const info = useMemo(() => {
    const m = personsInfo(ctx.wcif)
    for (const id of firstTimers) {
      const p = m.get(id)
      if (p) p.firstCompetition = true
    }
    return m
  }, [ctx.wcif, firstTimers])
  const hasBirthdates = useMemo(() => [...info.values()].some((p) => p.birthdate), [info])
  const refDate = ctx.wcif.schedule.startDate ?? new Date().toISOString().slice(0, 10)
  // Mais novos / mais velhos: lista única por data de nascimento.
  const ageOrder: AgeOrder | null = kind === 'age' && isOrder(ageMode) ? ageMode : null
  const cat: Category =
    kind === 'age'
      ? isOrder(ageMode)
        ? { kind: 'age', mode: 'from', min: 0, max: 999 }
        : { kind: 'age', mode: ageMode, min: ageMode === 'upTo' ? 0 : ageMin, max: ageMode === 'from' ? 999 : ageMax }
      : { kind }

  const catTitle =
    ageOrder
      ? t.ageOrderTitle[ageOrder]
      : kind === 'age'
      ? ageMode === 'upTo'
        ? t.ageUpTo(ageMax)
        : ageMode === 'from'
          ? t.ageFrom(ageMin)
          : t.ageBetween(ageMin, ageMax)
      : t.categories[kind]

  if (live === undefined) return <Spinner label={t.loading} />
  if (error) return <Alert>{error}</Alert>
  if (live === null) return <Alert tone="warn">{t.notOnLive}</Alert>

  const blocked = needsBirthdate(cat) && !hasBirthdates
  // Mais novos / mais velhos: mesma classificação, reordenada pela idade.
  const withAge = <T extends { registrantId: number | null; name: string; position: number }>(list: T[]) =>
    ageOrder ? byAge(list, info, refDate, ageOrder) : list.map((x) => ({ ...x, years: -1, months: 0 }))
  const ageText = (x: { years: number; months: number }) => (x.years >= 0 ? t.ageYm(x.years, x.months) : '')
  const byEvent = live.events
    .map((ev) => ({ ev, list: withAge(categoryStandings(ev, cat, info, refDate)) }))
    .filter((x) => x.list.length > 0)
  const points = withAge(apsPoints(live, cat, info, refDate))

  const exportCsv = () => {
    const rows: (string | number)[][] =
      view === 'events'
        ? [
            [t.csv.event, t.csv.position, t.csv.name, 'WCA ID', t.csv.result, t.csv.round, ...(ageOrder ? [t.csv.age] : [])],
            ...byEvent.flatMap(({ ev, list }) =>
              list
                .filter((s) => s.position <= top)
                .map((s) => [
                  eventName(ev.eventId),
                  s.position,
                  s.name,
                  s.wcaId ?? '',
                  headline(s, sortByOf(ev, s.roundNumber), ev.eventId).text,
                  s.roundNumber,
                  ...(ageOrder ? [ageText(s)] : []),
                ]),
            ),
          ]
        : [
            [t.csv.position, t.csv.name, 'WCA ID', t.csv.points, t.csv.events, t.csv.rounds, ...(ageOrder ? [t.csv.age] : [])],
            ...points.map((p) => [p.position, p.name, p.wcaId ?? '', p.points, p.events, p.rounds, ...(ageOrder ? [ageText(p)] : [])]),
          ]
    download(`${ctx.wcif.id}-${view === 'events' ? ageOrder ?? kind : 'aps'}.csv`, toCsv(rows))
  }

  const copyText = () => {
    const who = (x: { name: string; years: number; months: number }) => (ageOrder ? `${x.name} (${ageText(x)})` : x.name)
    const lines =
      view === 'events'
        ? [
            `${ctx.wcif.name} — ${catTitle}`,
            ...byEvent.flatMap(({ ev, list }) => [
              '',
              eventName(ev.eventId),
              ...list
                .filter((s) => s.position <= top)
                .map((s) => `${s.position}. ${who(s)} — ${headline(s, sortByOf(ev, s.roundNumber), ev.eventId).text}`),
            ]),
          ]
        : [
            `${ctx.wcif.name} — ${t.points} (${catTitle})`,
            ...points.slice(0, Math.max(top, 10)).map((p) => `${p.position}. ${who(p)} — ${p.points}`),
          ]
    void navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fg-faint">
        <span>
          {t.fromLive(new Intl.DateTimeFormat(tag, { timeStyle: 'short' }).format(new Date(live.fetchedAt)))} ·{' '}
          {live.sources.wcaLive && live.liveId && (
            <a className="underline hover:text-fg" href={liveUrl(live.liveId)} target="_blank" rel="noreferrer">
              WCA Live
            </a>
          )}
          {live.sources.wcaLive && live.liveId && live.sources.ilr && ' · '}
          {live.sources.ilr && (
            <a className="underline hover:text-fg" href={ilrUrl(ctx.wcif.id)} target="_blank" rel="noreferrer">
              WCA (Integrated Live Results)
            </a>
          )}
        </span>
        <button type="button" className="btn-ghost btn-sm" onClick={load} disabled={loading}>
          {loading ? t.updating : t.update}
        </button>
      </div>

      {/* Categoria */}
      <div className="card space-y-4 p-5">
        <div>
          <span className="label">{t.category}</span>
          <div className="flex flex-wrap gap-2">
            {(['newcomers', 'female', 'age', 'all'] as CatKind[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`chip px-3 py-1.5 text-sm ${
                  kind === k ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'border-border-subtle'
                }`}
              >
                {t.categories[k]}
              </button>
            ))}
          </div>
        </div>
        {kind === 'age' && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="seg flex-wrap [&>button]:whitespace-nowrap">
              {(['upTo', 'from', 'between', 'youngest', 'oldest'] as AgeChoice[]).map((md) => (
                <button
                  key={md}
                  type="button"
                  aria-pressed={ageMode === md}
                  onClick={() => {
                    setAgeMode(md)
                    if (md === 'upTo') setAgeMax(12)
                    if (md === 'from') setAgeMin(40)
                    if (md === 'between') (setAgeMin(13), setAgeMax(17))
                  }}
                >
                  {t.ageModes[md]}
                </button>
              ))}
            </div>
            {ageMode !== 'upTo' && !ageOrder && (
              <label className="text-xs text-fg-muted">
                {t.ageMinLabel}
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={ageMin}
                  onChange={(e) => setAgeMin(Number(e.target.value) || 0)}
                  className="ml-2 w-20 rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-sm"
                />
              </label>
            )}
            {ageMode !== 'from' && !ageOrder && (
              <label className="text-xs text-fg-muted">
                {t.ageMaxLabel}
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={ageMax}
                  onChange={(e) => setAgeMax(Number(e.target.value) || 0)}
                  className="ml-2 w-20 rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-sm"
                />
              </label>
            )}
            {ageOrder && <p className="w-full text-xs text-fg-faint">{t.ageOrderNote}</p>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="seg [&>button]:whitespace-nowrap">
            <button type="button" aria-pressed={view === 'events'} onClick={() => setView('events')}>
              {t.byEvent}
            </button>
            <button type="button" aria-pressed={view === 'points'} onClick={() => setView('points')}>
              {t.points}
            </button>
          </div>
          {view === 'events' && (
            <label className="text-xs text-fg-muted">
              {t.topLabel}
              <select
                value={top}
                onChange={(e) => setTop(Number(e.target.value))}
                className="ml-2 rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-sm"
              >
                {[3, 5, 8, 10, 999].map((n) => (
                  <option key={n} value={n}>
                    {n === 999 ? t.all : n}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="flex-1" />
          <button type="button" className="btn-ghost btn-sm" onClick={copyText} disabled={blocked}>
            {copied ? t.copied : t.copy}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={exportCsv} disabled={blocked}>
            CSV
          </button>
        </div>
      </div>

      {blocked ? (
        <Alert tone="warn">{t.ageNeedsManager}</Alert>
      ) : view === 'events' ? (
        byEvent.length === 0 ? (
          <p className="text-sm text-fg-faint">{t.empty}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {byEvent.map(({ ev, list }) => (
              <section key={ev.eventId} className="card p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <EventIcon eventId={ev.eventId} className="h-5 w-5" />
                  {eventName(ev.eventId)}
                  {!eventFinished(ev) && <span className="chip border-amber-500/40 text-amber-600 dark:text-amber-300">{t.inProgress}</span>}
                </h3>
                <ol className="mt-3 space-y-1.5">
                  {list
                    .filter((s) => s.position <= top)
                    .map((s) => {
                      const h = headline(s, sortByOf(ev, s.roundNumber), ev.eventId)
                      return (
                        <li key={`${s.registrantId}-${s.name}`} className="flex items-baseline gap-3 text-sm">
                          <span
                            className={`w-6 shrink-0 text-right font-semibold ${
                              s.position === 1 ? 'text-amber-500' : s.position === 2 ? 'text-slate-400' : s.position === 3 ? 'text-orange-700 dark:text-orange-400' : 'text-fg-faint'
                            }`}
                          >
                            {s.position}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {s.name}
                            {ageOrder && <span className="ml-1.5 text-xs text-fg-faint">{ageText(s)}</span>}
                          </span>
                          <span className="shrink-0 font-mono text-xs">
                            {h.text}
                            <span className="ml-1 text-fg-faint">{h.kind === 'average' ? t.avg : t.single}</span>
                          </span>
                        </li>
                      )
                    })}
                </ol>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="px-4 py-2.5 text-right">#</th>
                  <th className="px-4 py-2.5 text-left">{t.csv.name}</th>
                  <th className="hidden px-4 py-2.5 text-right sm:table-cell">{t.csv.events}</th>
                  <th className="px-4 py-2.5 text-right">{t.csv.points}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={`${p.registrantId}-${p.name}`} className="border-t border-border-subtle">
                    <td className="px-4 py-2 text-right font-semibold text-fg-muted">{p.position}</td>
                    <td className="px-4 py-2">
                      {p.name}
                      {ageOrder && <span className="ml-1.5 text-xs text-fg-faint">{ageText(p)}</span>}
                    </td>
                    <td className="hidden px-4 py-2 text-right text-fg-muted sm:table-cell">{p.events}</td>
                    <td className="px-4 py-2 text-right font-mono">{p.points.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {points.length === 0 && <p className="p-5 text-sm text-fg-faint">{t.empty}</p>}
          </div>
          <div className="card p-5 text-sm">
            <h3 className="font-semibold">{t.formulaTitle}</h3>
            <p className="mt-1 text-fg-muted">{t.formula}</p>
            <p className="mt-3 rounded-lg border border-dashed border-border-strong px-3 py-2 text-xs text-fg-faint">
              {t.customSoon}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
