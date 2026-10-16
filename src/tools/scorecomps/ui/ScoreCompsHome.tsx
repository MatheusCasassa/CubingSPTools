import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth/AuthContext'
import { fetchManagedCompetitions } from '../../../lib/wca/api'
import type { CompetitionListItem } from '../../../lib/wca/types'
import { WcaLoginButton } from '../../../components/auth/WcaLoginButton'
import { Alert, Spinner } from '../../../components/ui/Feedback'
import { IconArrowRight, ScoreCompsMark } from '../../../components/ui/icons'
import { useI18n } from '../../../i18n/I18nProvider'
import { WcaApiError } from '../../../lib/wca/api'
import { splitCompetitions, todayIso } from '../model/competitions'
import { syncTrustedTime, trustedNow } from '../../../lib/trustedTime'

function formatDate(d: string | undefined, tag: string): string {
  if (!d) return ''
  const [y, mo, day] = d.split('-').map(Number)
  return new Intl.DateTimeFormat(tag, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(y, mo - 1, day),
  )
}

function dateRange(c: CompetitionListItem, tag: string): string {
  const start = formatDate(c.start_date, tag)
  const end = formatDate(c.end_date, tag)
  return end && end !== start ? `${start} – ${end}` : start
}

function CompetitionRows({ comps, empty }: { comps: CompetitionListItem[]; empty: string }) {
  const { lp, tag } = useI18n()
  if (comps.length === 0) return <p className="text-sm text-fg-faint">{empty}</p>
  return (
    <ul className="grid gap-2.5">
      {comps.map((c) => (
        <li key={c.id}>
          <Link
            to={lp(`/scorecomps/${encodeURIComponent(c.id)}`)}
            state={{ name: c.name }}
            className="card group flex items-center justify-between px-5 py-4 transition-colors hover:border-brand-500/50"
          >
            <span>
              <span className="block font-medium">{c.name}</span>
              <span className="mt-0.5 block text-xs text-fg-faint">
                {dateRange(c, tag)}
                {c.city ? ` · ${c.city}` : ''}
              </span>
            </span>
            <IconArrowRight className="h-4 w-4 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Header() {
  const { m } = useI18n()
  return (
    <div className="flex items-center gap-4">
      <ScoreCompsMark className="h-12 w-12" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Score<span className="text-navy dark:text-canary">Comps</span>
        </h1>
        <p className="text-sm text-fg-muted">{m.scorecomps.subtitle}</p>
      </div>
    </div>
  )
}

function DemoLink() {
  const { m, lp } = useI18n()
  return (
    <Link to={lp('/scorecomps/demo')} className="btn-ghost">
      {m.scorecomps.demo}
    </Link>
  )
}

function CompetitionList() {
  const { token, isDelegate, setManagesCompetitions } = useAuth()
  const { m } = useI18n()
  const [comps, setComps] = useState<CompetitionListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let active = true
    // Busca as competições e, em paralelo, a hora do servidor (para "hoje").
    Promise.all([fetchManagedCompetitions(token.accessToken), syncTrustedTime()])
      .then(([list]) => {
        if (!active) return
        setComps(list)
        setManagesCompetitions(list.length > 0)
      })
      .catch((e) =>
        active &&
        setError(e instanceof WcaApiError && e.status === 401 ? m.errors.sessionExpired : m.errors.loadCompetitions),
      )
    return () => {
      active = false
    }
  }, [token, setManagesCompetitions])

  if (error) return <Alert>{error}</Alert>
  if (!comps) return <Spinner label={m.scorecomps.loadingCompetitions} />

  const { upcoming, past } = splitCompetitions(comps, todayIso(trustedNow()))

  if (comps.length === 0 && !isDelegate) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-xl font-semibold">{m.scorecomps.restrictedTitle}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-fg-muted">{m.scorecomps.restrictedText}</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">{m.scorecomps.yourCompetitions}</h2>
      <p className="mb-5 mt-1 text-sm text-fg-muted">{m.scorecomps.onlyManaged}</p>
      {comps.length === 0 ? (
        <p className="text-sm text-fg-muted">{m.scorecomps.noManageable}</p>
      ) : (
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">
              {m.scorecomps.upcomingCompetitions}
            </h3>
            <CompetitionRows comps={upcoming} empty={m.scorecomps.noUpcoming} />
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-muted">
              {m.scorecomps.pastCompetitions}
            </h3>
            <CompetitionRows comps={past} empty={m.scorecomps.noPast} />
          </section>
        </div>
      )}
    </div>
  )
}

export default function ScoreCompsHome() {
  const { status, error } = useAuth()
  const { m } = useI18n()
  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Header />
        {status === 'loading' && <Spinner label={m.common.checkingSession} />}
        {status !== 'loading' && status !== 'authenticated' && (
          <div className="mt-10 animate-fade-up">
            <p className="text-lg leading-relaxed">{m.scorecomps.intro}</p>
            <p className="mt-4 leading-relaxed text-fg-muted">{m.scorecomps.loginNote}</p>
            {error && (
              <div className="mt-6">
                <Alert>{error}</Alert>
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <WcaLoginButton large />
              <DemoLink />
            </div>
          </div>
        )}
        {status === 'authenticated' && (
          <div className="mt-10 animate-fade-up">
            <CompetitionList />
            <div className="mt-8 border-t border-border-subtle pt-6">
              <DemoLink />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
