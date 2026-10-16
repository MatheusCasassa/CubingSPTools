import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthContext'
import { Alert } from '../components/ui/Feedback'
import { CalcumulativeMark, CubeStaffMark, IconArrowRight, ScoreCompsMark } from '../components/ui/icons'

interface Tool {
  to: string
  name: string
  mark: ReactNode
  ready: boolean
  login: boolean
  description: string
}

const TOOLS: Tool[] = [
  {
    to: '/scorecomps',
    name: 'ScoreComps',
    mark: <ScoreCompsMark className="h-10 w-10" />,
    ready: true,
    login: true,
    description:
      'Súmulas oficiais em PDF a partir dos grupos da competição, com as regras de corte e limite de tempo da WCA, ' +
      'vários tamanhos de folha e a logo da competição.',
  },
  {
    to: '/calcumulative',
    name: 'Calcumulative',
    mark: <CalcumulativeMark className="h-10 w-10" />,
    ready: true,
    login: false,
    description:
      'Calculadora de limite de tempo cumulativo e de média de 5 com BPA, WPA e quanto você precisa no último solve.',
  },
  {
    to: '/cubestaff',
    name: 'CubeStaff',
    mark: <CubeStaffMark className="h-10 w-10" />,
    ready: false,
    login: true,
    description:
      'Agrupamento e atribuição de tarefas (Juiz, Embaralhador e Runner) integrados à WCA. Os grupos alimentam o ScoreComps.',
  },
]

function Badge({ ready }: { ready: boolean }) {
  return ready ? (
    <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
      Disponível
    </span>
  ) : (
    <span className="rounded-full border border-border-strong px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
      Em breve
    </span>
  )
}

export default function Home() {
  const { error } = useAuth()
  return (
    <div className="container-page py-14 sm:py-20">
      <section className="animate-fade-up">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Ferramentas</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-fg-muted">
          Ferramentas feitas para facilitar Delegados, Organizadores e competidores com as principais tarefas de uma
          competição: <strong className="text-fg">Agrupamento</strong>,{' '}
          <strong className="text-fg">Atribuição de Tarefas</strong>,{' '}
          <strong className="text-fg">Geração de Súmulas em PDF</strong> e cálculos de tempo, tudo a partir dos dados
          oficiais da WCA.
        </p>
        {error && (
          <div className="mt-6 max-w-xl">
            <Alert>{error}</Alert>
          </div>
        )}
      </section>

      <section className="mt-12 grid gap-5 md:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="card group relative flex flex-col p-6 transition-colors hover:border-brand-500/50"
          >
            <div className="flex items-start justify-between gap-3">
              {t.mark}
              <Badge ready={t.ready} />
            </div>
            <h2 className="mt-5 text-lg font-semibold">{t.name}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-fg-muted">{t.description}</p>
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium text-brand-600 dark:text-brand-300">
                {t.ready ? 'Abrir' : 'Saiba mais'}
                <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-xs text-fg-faint">{t.login ? 'Login WCA' : 'Sem login'}</span>
            </div>
          </Link>
        ))}
      </section>

      <p className="mt-10 max-w-3xl text-sm leading-relaxed text-fg-muted">
        As ferramentas de Delegados e Organizadores pedem login na sua conta WCA. Nenhuma senha ou armazenamento passam
        por aqui, roda 100% no seu navegador.
      </p>
    </div>
  )
}
