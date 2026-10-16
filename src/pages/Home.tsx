import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthContext'
import { Alert } from '../components/ui/Feedback'
import { CalcumulativeMark, CubeStaffMark, IconArrowRight, ScoreCompsMark } from '../components/ui/icons'
import { useI18n } from '../i18n/I18nProvider'
import { Rich } from '../i18n/Rich'
import type { Messages } from '../i18n/messages/pt'

type Category = keyof Messages['home']['categories']

/** Ordem fixa das categorias na página. */
const CATEGORIES: Category[] = ['before', 'during', 'after', 'aux']

interface Tool {
  to: string
  name: string
  mark: ReactNode
  category: Category
  ready: boolean
  login: boolean
  description: keyof Messages['home']['tools']
}

// Dentro de cada categoria as ferramentas aparecem em ordem alfabética
// (lançadas ou não) — a ordem desta lista não importa.
const TOOLS: Tool[] = [
  {
    to: '/scorecomps',
    name: 'ScoreComps',
    mark: <ScoreCompsMark className="h-10 w-10" />,
    category: 'before',
    ready: true,
    login: true,
    description: 'scorecomps',
  },
  {
    to: '/cubestaff',
    name: 'CubeStaff',
    mark: <CubeStaffMark className="h-10 w-10" />,
    category: 'before',
    ready: true,
    login: true,
    description: 'cubestaff',
  },
  {
    to: '/calcumulative',
    name: 'Calcumulative',
    mark: <CalcumulativeMark className="h-10 w-10" />,
    category: 'during',
    ready: true,
    login: false,
    description: 'calcumulative',
  },
]

function Badge({ ready }: { ready: boolean }) {
  const { m } = useI18n()
  return ready ? (
    <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
      {m.common.available}
    </span>
  ) : (
    <span className="rounded-full border border-border-strong px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
      {m.common.comingSoon}
    </span>
  )
}

function ToolCard({ t }: { t: Tool }) {
  const { m, lp } = useI18n()
  return (
    <Link to={lp(t.to)} className="card group relative flex flex-col p-6 transition-colors hover:border-brand-500/50">
      <div className="flex items-start justify-between gap-3">
        {t.mark}
        <Badge ready={t.ready} />
      </div>
      <h3 className="mt-5 text-lg font-semibold">{t.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-fg-muted">{m.home.tools[t.description]}</p>
      <div className="mt-5 flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-brand-600 dark:text-brand-300">
          {t.ready ? m.common.open : m.common.learnMore}
          <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="text-xs text-fg-faint">{t.login ? m.common.wcaLogin : m.common.noLogin}</span>
      </div>
    </Link>
  )
}

export default function Home() {
  const { error } = useAuth()
  const { m, tag } = useI18n()
  const collator = new Intl.Collator(tag, { sensitivity: 'base' })

  return (
    <div className="container-page py-14 sm:py-20">
      <section className="animate-fade-up">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{m.home.title}</h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-fg-muted">
          <Rich text={m.home.intro} strongClass="text-fg" />
        </p>
        {error && (
          <div className="mt-6 max-w-xl">
            <Alert>{error}</Alert>
          </div>
        )}
      </section>

      {CATEGORIES.map((cat) => {
        const tools = TOOLS.filter((t) => t.category === cat).sort((a, b) => collator.compare(a.name, b.name))
        const info = m.home.categories[cat]
        return (
          <section key={cat} className="mt-14" aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="text-xl font-semibold tracking-tight">
              {info.title}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">{info.description}</p>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              {tools.length > 0 ? (
                tools.map((t) => <ToolCard key={t.to} t={t} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-border-strong p-6 text-sm text-fg-faint md:col-span-3">
                  {m.home.emptyCategory}
                </div>
              )}
            </div>
          </section>
        )
      })}

      <p className="mt-14 max-w-3xl text-sm leading-relaxed text-fg-muted">{m.home.footnote}</p>
    </div>
  )
}
