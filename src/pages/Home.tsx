import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthContext'
import { Alert } from '../components/ui/Feedback'
import { BrandMark, IconArrowRight } from '../components/ui/icons'
import { useI18n } from '../i18n/I18nProvider'
import { Rich } from '../i18n/Rich'
import { CATEGORIES, CATEGORY_ANCHOR, CATEGORY_COLOR, toolsIn, type Category, type Tool } from '../lib/tools'

// As ferramentas e as categorias ficam em src/lib/tools.tsx (mesma lista do
// menu). Dentro de cada categoria, ordem alfabética — lançadas ou não.

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

function ToolCard({ t, category }: { t: Tool; category: Category }) {
  const { m, lp } = useI18n()
  return (
    <Link
      to={lp(t.to)}
      className="card group relative flex flex-col overflow-hidden p-6 transition-colors hover:border-border-strong"
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: CATEGORY_COLOR[category] }} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        {t.mark('h-10 w-10')}
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

  return (
    <div className="container-page py-14 sm:py-20">
      <section className="animate-fade-up">
        <h1 className="flex items-center gap-4 text-4xl font-bold tracking-tight sm:text-5xl">
          <BrandMark className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
          <span aria-label={m.home.title}>
            C<span className="text-accent-red">SP</span>Tools
          </span>
        </h1>
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
        const tools = toolsIn(cat, tag)
        const info = m.home.categories[cat]
        return (
          <section key={cat} id={CATEGORY_ANCHOR[cat]} className="mt-14 scroll-mt-24" aria-labelledby={`cat-${cat}`}>
            <div className="flex items-stretch gap-3">
              <span className="w-1.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[cat] }} aria-hidden />
              <div>
                <h2 id={`cat-${cat}`} className="text-xl font-semibold tracking-tight">
                  {info.title}
                </h2>
                <p className="mt-1 text-sm text-fg-muted">{info.description}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              {tools.length > 0 ? (
                tools.map((t) => <ToolCard key={t.to} t={t} category={cat} />)
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
