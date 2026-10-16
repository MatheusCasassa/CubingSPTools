import { Link } from 'react-router-dom'
import { CubeStaffMark } from '../components/ui/icons'
import { useI18n } from '../i18n/I18nProvider'

export default function CubeStaff() {
  const { m, lp } = useI18n()
  const [before, after] = m.cubestaff.intro.split('**ScoreComps**')
  return (
    <div className="container-page py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-4">
          <CubeStaffMark className="h-14 w-14" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">CubeStaff</h1>
            <p className="text-sm text-fg-muted">{m.cubestaff.subtitle}</p>
          </div>
        </div>
        <p className="mt-8 text-lg leading-relaxed">
          {before}
          <Link to={lp('/scorecomps')} className="font-medium text-brand-500 hover:underline dark:text-brand-300">
            ScoreComps
          </Link>
          {after}
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {m.cubestaff.planned.map(([title, text]) => (
            <div key={title} className="card p-5">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-fg-muted">{m.cubestaff.footnote}</p>
      </div>
    </div>
  )
}
