import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth/AuthContext'
import { config } from '../../lib/config'
import { applyTheme, getTheme, type Theme } from '../../lib/theme'
import { IconArrowLeft, IconGrid, IconMenu, IconMoon, IconSun } from '../ui/icons'

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getTheme())
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      onClick={() => {
        setTheme(next)
        applyTheme(next)
      }}
      className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
      title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      aria-label="Alternar tema"
    >
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  )
}

const TOOLS = [
  { to: '/scorecomps', label: 'ScoreComps' },
  { to: '/cubestaff', label: 'CubeStaff', soon: true },
]

function ToolLink({ to, label, soon, onClick }: { to: string; label: string; soon?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
        (isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg')
      }
    >
      {label}
      {soon && (
        <span className="rounded bg-brand-600/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-500 dark:text-brand-300">
          em breve
        </span>
      )}
    </NavLink>
  )
}

export function Navbar() {
  const { status, me, logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg/80 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <IconGrid className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Ferramentas</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Ferramentas">
          {TOOLS.map((t) => (
            <ToolLink key={t.to} {...t} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <a
            href={config.cubingspUrl}
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-fg-muted transition-colors hover:text-fg lg:flex"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            Voltar para a{' '}
            <span className="font-semibold text-fg">
              CUBING<span className="text-accent-red">SP</span>
            </span>
          </a>

          {status === 'authenticated' && me && (
            <div className="hidden items-center gap-2 border-l border-border-subtle pl-3 sm:flex">
              <div className="text-right leading-tight">
                <div className="max-w-[160px] truncate text-sm font-medium">{me.name}</div>
                <div className="font-mono text-[11px] text-fg-faint">{me.wca_id ?? 'sem WCA ID'}</div>
              </div>
              <button className="btn-ghost btn-sm" onClick={logout}>
                Sair
              </button>
            </div>
          )}
          <ThemeToggle />
          <button
            className="rounded-lg p-2 text-fg-muted hover:bg-surface-2 hover:text-fg md:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <IconMenu />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border-subtle bg-bg md:hidden">
          <nav className="container-page flex flex-col gap-1 py-3" aria-label="Ferramentas (menu)">
            {TOOLS.map((t) => (
              <ToolLink key={t.to} {...t} onClick={() => setOpen(false)} />
            ))}
            <a href={config.cubingspUrl} className="rounded-lg px-3 py-2 text-sm text-fg-muted hover:text-fg">
              ← Voltar para a CubingSP
            </a>
            {status === 'authenticated' && me && (
              <button className="rounded-lg px-3 py-2 text-left text-sm text-fg-muted hover:text-fg" onClick={logout}>
                Sair ({me.name})
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
