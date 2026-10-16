import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="font-mono text-sm text-fg-faint">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Página não encontrada</h1>
      <Link to="/" className="btn-ghost mt-8">
        Voltar ao início
      </Link>
    </div>
  )
}
