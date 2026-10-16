import { useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth/AuthContext'
import { isConfigured } from '../../lib/config'

export function WcaLoginButton({ large = false }: { large?: boolean }) {
  const { login } = useAuth()
  const location = useLocation()
  return (
    <button
      onClick={() => login(location.pathname)}
      disabled={!isConfigured()}
      className={`btn-primary ${large ? 'px-7 py-3.5 text-base' : ''}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
        <path d="M9 3.5v17M15 3.5v17M3.5 9h17M3.5 15h17" />
      </svg>
      Entrar com a conta WCA
    </button>
  )
}
