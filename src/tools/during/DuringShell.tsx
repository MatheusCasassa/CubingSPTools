// Moldura comum das ferramentas "Durante a Competição": página inicial com a
// lista de competições (Delegado ou staff) e a página da competição, com os
// estados de carregamento, login e acesso negado.

import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth/AuthContext'
import { fetchDuringCompetitions, type DuringAccess, type DuringCompetition } from '../../lib/wca/access'
import { WcaApiError } from '../../lib/wca/api'
import { WcaLoginButton } from '../../components/auth/WcaLoginButton'
import { Alert, Spinner } from '../../components/ui/Feedback'
import { IconArrowRight } from '../../components/ui/icons'
import { useI18n } from '../../i18n/I18nProvider'
import { Rich } from '../../i18n/Rich'
import { splitCompetitions, todayIso } from '../scorecomps/model/competitions'
import { syncTrustedTime, trustedNow } from '../../lib/trustedTime'
import { useDuringCompetition } from './useDuringCompetition'

export interface DuringTool {
  slug: string
  name: string
  mark: (className: string) => ReactNode
  access: DuringAccess
  subtitle: string
  intro: string
  loginNote: string
  features: [string, string][]
}

function fmtDate(d: string | undefined, tag: string) {
  if (!d) return ''
  const [y, mo, day] = d.split('-').map(Number)
  return new Intl.DateTimeFormat(tag, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(y, mo - 1, day))
}

export function ToolHeader({ tool, subtitle }: { tool: DuringTool; subtitle?: string }) {
  return (
    <div className="flex items-center gap-4">
      {tool.mark('h-12 w-12 shrink-0')}
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight">{tool.name}</h1>
        <p className="truncate text-sm text-fg-muted">{subtitle ?? tool.subtitle}</p>
      </div>
    </div>
  )
}

function Rows({ tool, comps, empty }: { tool: DuringTool; comps: DuringCompetition[]; empty: string }) {
  const { lp, tag, m } = useI18n()
  if (comps.length === 0) return <p className="text-sm text-fg-faint">{empty}</p>
  return (
    <ul className="grid gap-2.5">
      {comps.map((c) => {
        const s = fmtDate(c.start_date, tag)
        const e = fmtDate(c.end_date, tag)
        return (
          <li key={c.id}>
            <Link
              to={lp(`/${tool.slug}/${encodeURIComponent(c.id)}`)}
              state={{ name: c.name }}
              className="card group flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:border-brand-500/50"
            >
              <span className="min-w-0">
                <span className="block font-medium">{c.name}</span>
                <span className="mt-0.5 block text-xs text-fg-faint">
                  {e && e !== s ? `${s} – ${e}` : s}
                  {c.city ? ` · ${c.city}` : ''} · {m.during.roles[c.role]}
                </span>
              </span>
              <IconArrowRight className="h-4 w-4 shrink-0 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function CompetitionList({ tool }: { tool: DuringTool }) {
  const { token, me } = useAuth()
  const { m } = useI18n()
  const [comps, setComps] = useState<DuringCompetition[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!token || !me) return
    let active = true
    syncTrustedTime()
      .then(() => fetchDuringCompetitions(token.accessToken, me.id, tool.access, todayIso(trustedNow())))
      .then((list) => active && setComps(list))
      .catch(
        (e) =>
          active &&
          setError(e instanceof WcaApiError && e.status === 401 ? m.errors.sessionExpired : m.errors.loadCompetitions),
      )
    return () => {
      active = false
    }
  }, [token, me, tool.access])
  if (error) return <Alert>{error}</Alert>
  if (!comps) return <Spinner label={m.during.loadingCompetitions} />
  if (comps.length === 0)
    return (
      <div className="card p-8 text-center">
        <h2 className="text-xl font-semibold">{m.during.noneTitle}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-fg-muted">
          {tool.access === 'delegate' ? m.during.noneDelegate : m.during.noneStaff}
        </p>
      </div>
    )
  const { upcoming, past } = splitCompetitions(comps, todayIso(trustedNow()))
  return (
    <div>
      <h2 className="text-lg font-semibold">{m.scorecomps.yourCompetitions}</h2>
      <p className="mb-5 mt-1 text-sm text-fg-muted">
        {tool.access === 'delegate' ? m.during.onlyDelegate : m.during.onlyStaff}
      </p>
      <div className="space-y-8">
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">
            {m.scorecomps.upcomingCompetitions}
          </h3>
          <Rows tool={tool} comps={upcoming as DuringCompetition[]} empty={m.scorecomps.noUpcoming} />
        </section>
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">{m.during.recent}</h3>
          <Rows tool={tool} comps={past as DuringCompetition[]} empty={m.scorecomps.noPast} />
        </section>
      </div>
    </div>
  )
}

export function DuringHome({ tool }: { tool: DuringTool }) {
  const { status, error } = useAuth()
  const { m } = useI18n()
  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <ToolHeader tool={tool} />
        {status === 'loading' && <Spinner label={m.common.checkingSession} />}
        {status !== 'loading' && status !== 'authenticated' && (
          <div className="mt-10 animate-fade-up">
            <p className="text-lg leading-relaxed">
              <Rich text={tool.intro} />
            </p>
            <p className="mt-4 leading-relaxed text-fg-muted">{tool.loginNote}</p>
            {error && (
              <div className="mt-6">
                <Alert>{error}</Alert>
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <WcaLoginButton large />
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {tool.features.map(([title, text]) => (
                <div key={title} className="card p-5">
                  <h2 className="font-semibold">{title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {status === 'authenticated' && (
          <div className="mt-10 animate-fade-up">
            <CompetitionList tool={tool} />
          </div>
        )}
      </div>
    </div>
  )
}

export type DuringCtx = ReturnType<typeof useDuringCompetition> & { wcif: NonNullable<ReturnType<typeof useDuringCompetition>['wcif']> }

/** Página de uma competição: cuida de login, carregamento e acesso negado. */
export function DuringPage({
  tool,
  competitionId,
  children,
  wide = false,
}: {
  tool: DuringTool
  competitionId: string | undefined
  children: (ctx: DuringCtx) => ReactNode
  wide?: boolean
}) {
  const { m, lp } = useI18n()
  const location = useLocation()
  const ctx = useDuringCompetition(competitionId, tool.access)
  const stateName = (location.state as { name?: string } | null)?.name
  const name = ctx.wcif?.name ?? stateName ?? competitionId ?? ''
  return (
    <div className="container-page py-10 sm:py-12">
      <div className={`mx-auto ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <Link to={lp(`/${tool.slug}`)} className="text-sm text-fg-muted hover:text-fg">
          ← {tool.name}
        </Link>
        <div className="mt-4">
          <ToolHeader tool={tool} subtitle={name} />
        </div>
        <div className="mt-8">
          {ctx.state === 'loading' && <Spinner label={m.during.loadingCompetition} />}
          {ctx.state === 'login' && (
            <div className="card p-8 text-center">
              <p className="mx-auto max-w-md text-sm text-fg-muted">{tool.loginNote}</p>
              <div className="mt-6 flex justify-center">
                <WcaLoginButton large />
              </div>
            </div>
          )}
          {ctx.state === 'denied' && (
            <div className="card p-8 text-center">
              <h2 className="text-xl font-semibold">{m.scorecomps.restrictedTitle}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-fg-muted">
                {tool.access === 'delegate' ? m.during.deniedDelegate : m.during.deniedStaff}
              </p>
            </div>
          )}
          {ctx.state === 'error' && (
            <Alert>{ctx.error === 'session' ? m.errors.sessionExpired : `${m.during.loadError} ${ctx.error ?? ''}`}</Alert>
          )}
          {ctx.state === 'ready' && ctx.wcif && children(ctx as DuringCtx)}
        </div>
      </div>
    </div>
  )
}
