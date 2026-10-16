import { Link } from 'react-router-dom'
import { useI18n } from '../../../i18n/I18nProvider'
import { Rich } from '../../../i18n/Rich'
import { LINKS } from '../../../lib/config'
import { IconArrowLeft } from '../../../components/ui/icons'
import { CubeStaffHeader } from './CubeStaffHome'
import { pt } from '../manual/pt'
import { en } from '../manual/en'
import { es } from '../manual/es'
import type { Block } from '../manual/types'

const MANUALS = { pt, en, es }

function BlockView({ b }: { b: Block }) {
  if (typeof b === 'string')
    return (
      <p className="leading-relaxed text-fg-muted">
        <Rich text={b} strongClass="text-fg" />
      </p>
    )
  if ('note' in b)
    return (
      <p className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm">
        <Rich text={b.note} />
      </p>
    )
  if ('list' in b)
    return (
      <ul className="list-disc space-y-1.5 pl-5 leading-relaxed text-fg-muted marker:text-brand-500">
        {b.list.map((x, i) => (
          <li key={i}>
            <Rich text={x} strongClass="text-fg" />
          </li>
        ))}
      </ul>
    )
  const [head, ...rows] = b.table
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="bg-surface-2 text-left">
            {head.map((h) => (
              <th key={h} className="px-4 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border-subtle align-top">
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-2 ${j === 0 ? 'font-medium' : 'text-fg-muted'}`}>
                  <Rich text={c} strongClass="text-fg" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ManualPage() {
  const { locale, lp } = useI18n()
  const M = MANUALS[locale]
  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Link to={lp('/cubestaff')} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <IconArrowLeft className="h-3.5 w-3.5" />
          {M.back}
        </Link>
        <div className="mt-6">
          <CubeStaffHeader subtitle={M.subtitle} />
        </div>
        <h1 className="sr-only">{M.title}</h1>
        <p className="mt-8 text-lg leading-relaxed">
          <Rich text={M.intro} />
        </p>

        <nav className="card mt-8 p-5" aria-label={M.toc}>
          <h2 className="label">{M.toc}</h2>
          <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {M.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-brand-600 hover:underline dark:text-brand-300">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {M.sections.map((s) => (
          <section key={s.id} id={s.id} className="mt-12 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">{s.title}</h2>
            <div className="mt-4 space-y-4">
              {s.blocks.map((b, i) => (
                <BlockView key={i} b={b} />
              ))}
            </div>
          </section>
        ))}

        <section className="card mt-14 p-6">
          <h2 className="text-lg font-semibold">{M.feedbackTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{M.feedbackText}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn-primary btn-sm" href={`${LINKS.email}?subject=CubeStaff%20-%20feedback`}>
              {M.feedbackEmail}
            </a>
            <a
              className="btn-ghost btn-sm"
              href={`${LINKS.github}/issues/new?labels=cubestaff`}
              target="_blank"
              rel="noreferrer"
            >
              {M.feedbackGithub}
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
