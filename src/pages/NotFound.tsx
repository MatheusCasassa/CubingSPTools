import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'

export default function NotFound() {
  const { m, lp } = useI18n()
  return (
    <div className="container-page py-24 text-center">
      <p className="font-mono text-sm text-fg-faint">404</p>
      <h1 className="mt-2 text-2xl font-semibold">{m.notFound.title}</h1>
      <Link to={lp('/')} className="btn-ghost mt-8">
        {m.notFound.back}
      </Link>
    </div>
  )
}
