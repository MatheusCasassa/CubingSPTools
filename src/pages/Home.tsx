import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthContext'
import { WcaLoginButton } from '../components/auth/WcaLoginButton'
import { Alert } from '../components/ui/Feedback'
import { CubeStaffMark, IconArrowRight, ScoreCompsMark } from '../components/ui/icons'

const TOOLS = [
  {
    to: '/scorecomps',
    name: 'ScoreComps',
    mark: <ScoreCompsMark className="h-11 w-11" />,
    status: 'Disponível',
    description:
      'Súmulas oficiais em PDF a partir dos grupos da competição: regras de corte e limite de tempo da WCA, ' +
      'vários tamanhos de folha, ordem de corte e empilhe e a logo da sua competição.',
    ready: true,
  },
  {
    to: '/cubestaff',
    name: 'CubeStaff',
    mark: <CubeStaffMark className="h-11 w-11" />,
    status: 'Em breve',
    description:
      'Agrupamento e atribuição de tarefas (Juiz, Embaralhador e Runner) integrados à WCA. ' +
      'Os grupos salvos alimentam o ScoreComps automaticamente.',
    ready: false,
  },
]

export default function Home() {
  const { status, error } = useAuth()
  return (
    <div className="container-page py-16 sm:py-24">
      <section className="mx-auto max-w-3xl text-center animate-fade-up">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Ferramentas para competições WCA</h1>
        <p className="mt-6 text-lg leading-relaxed text-fg sm:text-xl">
          Ferramentas feitas para facilitar Delegados e Organizadores com as principais tarefas para uma
          competição: <strong>Agrupamento</strong>, <strong>Atribuição de Tarefas</strong> e{' '}
          <strong>Geração de Súmulas em PDF</strong>, tudo a partir dos dados oficiais da WCA.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-fg-muted">
          Para utilizar as ferramentas, é necessário fazer login em sua conta WCA. Nenhuma senha ou
          armazenamento passam por aqui, roda 100% no seu navegador.
        </p>
        {error && (
          <div className="mx-auto mt-6 max-w-md text-left">
            <Alert>{error}</Alert>
          </div>
        )}
        {status !== 'authenticated' && (
          <div className="mt-9 flex justify-center">
            <WcaLoginButton large />
          </div>
        )}
      </section>

      <section className="mx-auto mt-16 grid max-w-4xl gap-5 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="card group flex flex-col p-6 transition-colors hover:border-brand-500/50"
          >
            <div className="flex items-center gap-3.5">
              {t.mark}
              <div>
                <h2 className="text-lg font-semibold">{t.name}</h2>
                <span
                  className={
                    'text-xs font-medium ' + (t.ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-fg-faint')
                  }
                >
                  {t.status}
                </span>
              </div>
            </div>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-fg-muted">{t.description}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 dark:text-brand-300">
              {t.ready ? 'Abrir' : 'Saiba mais'}
              <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}
