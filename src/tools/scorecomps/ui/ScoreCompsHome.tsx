import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth/AuthContext'
import { fetchManagedCompetitions } from '../../../lib/wca/api'
import type { CompetitionListItem } from '../../../lib/wca/types'
import { WcaLoginButton } from '../../../components/auth/WcaLoginButton'
import { Alert, Spinner } from '../../../components/ui/Feedback'
import { IconArrowRight, ScoreCompsMark } from '../../../components/ui/icons'

function formatDate(d?: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function Header() {
  return (
    <div className="flex items-center gap-4">
      <ScoreCompsMark className="h-12 w-12" />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Score<span className="text-navy dark:text-canary">Comps</span>
        </h1>
        <p className="text-sm text-fg-muted">Súmulas oficiais em PDF a partir dos grupos da WCA</p>
      </div>
    </div>
  )
}

function DemoLink() {
  return (
    <Link to="/scorecomps/demo" className="btn-ghost">
      Ver com uma competição de demonstração
    </Link>
  )
}

function CompetitionList() {
  const { token, isDelegate, setManagesCompetitions } = useAuth()
  const [comps, setComps] = useState<CompetitionListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let active = true
    fetchManagedCompetitions(token.accessToken)
      .then((list) => {
        if (!active) return
        setComps(list)
        setManagesCompetitions(list.length > 0)
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
    return () => {
      active = false
    }
  }, [token, setManagesCompetitions])

  if (error) return <Alert>{error}</Alert>
  if (!comps) return <Spinner label="Carregando suas competições…" />

  if (comps.length === 0 && !isDelegate) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-xl font-semibold">Acesso restrito</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-fg-muted">
          Sua conta WCA não é Delegada nem Organizadora de nenhuma competição. O ScoreComps é exclusivo para
          quem gerencia competições na WCA.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">Suas competições</h2>
      <p className="mb-5 mt-1 text-sm text-fg-muted">
        Apenas competições em que você é Delegado ou Organizador aparecem aqui.
      </p>
      {comps.length === 0 ? (
        <p className="text-sm text-fg-muted">Você é Delegado, mas não há competições gerenciáveis no momento.</p>
      ) : (
        <ul className="grid gap-2.5">
          {comps.map((c) => (
            <li key={c.id}>
              <Link
                to={`/scorecomps/${encodeURIComponent(c.id)}`}
                state={{ name: c.name }}
                className="card group flex items-center justify-between px-5 py-4 transition-colors hover:border-brand-500/50"
              >
                <span>
                  <span className="block font-medium">{c.name}</span>
                  <span className="mt-0.5 block text-xs text-fg-faint">
                    {formatDate(c.start_date)}
                    {c.city ? ` · ${c.city}` : ''}
                  </span>
                </span>
                <IconArrowRight className="h-4 w-4 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ScoreCompsHome() {
  const { status, error } = useAuth()
  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Header />
        {status === 'loading' && <Spinner label="Verificando sessão…" />}
        {status !== 'loading' && status !== 'authenticated' && (
          <div className="mt-10 animate-fade-up">
            <p className="text-lg leading-relaxed">
              Escolha a competição, marque as rodadas e os grupos e baixe as súmulas prontas para imprimir — com
              as regras de corte, limite de tempo e penalidade de cada rodada, direto dos dados oficiais da WCA.
            </p>
            <p className="mt-4 leading-relaxed text-fg-muted">
              Para utilizar a ferramenta, é necessário fazer login em sua conta WCA. Nenhuma senha ou
              armazenamento passam por aqui, roda 100% no seu navegador.
            </p>
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
