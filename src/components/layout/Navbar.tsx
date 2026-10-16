import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth/AuthContext'
import { config } from '../../lib/config'
import { applyTheme, getTheme, type Theme } from '../../lib/theme'
import { IconArrowLeft, IconGrid, IconMenu, IconMoon, IconSun } from '../ui/icons'
import { useI18n } from '../../i18n/I18nProvider'
import { LanguageSelect } from './LanguageSelect'

function ThemeToggle() {
  const { m } = useI18n()
  const [theme, setTheme] = useState<Theme>(getTheme())
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      onClick={() => {
        setTheme(next)
        applyTheme(next)
      }}
      className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
      title={theme === 'dark' ? m.nav.lightTheme : m.nav.darkTheme}
      aria-label={m.nav.toggleTheme}
    >
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  )
}

const TOOLS = [
  { to: '/scorecomps', label: 'ScoreComps' },
  { to: '/calcumulative', label: 'Calcumulative' },
  { to: '/cubestaff', label: 'CubeStaff' },
]

function ToolLink({ to, label, soon, onClick }: { to: string; label: string; soon?: boolean; onClick?: () => void }) {
  const { m, lp } = useI18n()
  return (
    <NavLink
      to={lp(to)}
      onClick={onClick}
      className={({ isActive }) =>
        'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
        (isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg')
      }
    >
      {label}
      {soon && (
        <span className="rounded bg-brand-600/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-500 dark:text-brand-300">
          {m.common.soon}
        </span>
      )}
    </NavLink>
  )
}

export function Navbar() {
  const { status, me, logout, login } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { m, lp, locale } = useI18n()
  // O site da CubingSP também tem /en e /es.
  const cubingspHref = config.cubingspUrl + (locale === 'pt' ? '' : `/${locale}`)

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg/80 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-4">
        <Link to={lp('/')} className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <IconGrid className="h-4 w-4" />
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight min-[420px]:inline">{m.nav.tools}</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label={m.nav.tools}>
          {TOOLS.map((t) => (
            <ToolLink key={t.to} {...t} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <a
            href={cubingspHref}
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-fg-muted transition-colors hover:text-fg xl:flex"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            {m.nav.backTo}{' '}
            <span className="font-semibold text-fg">
              CUBING<span className="text-accent-red">SP</span>
            </span>
          </a>

          {status === 'authenticated' && me && (
            <div className="hidden items-center gap-2 border-l border-border-subtle pl-3 sm:flex">
              <div className="text-right leading-tight">
                <div className="max-w-[160px] truncate text-sm font-medium">{me.name}</div>
                <div className="font-mono text-[11px] text-fg-faint">{me.wca_id ?? m.nav.noWcaId}</div>
              </div>
              <button className="btn-ghost btn-sm" onClick={logout}>
                {m.nav.signOut}
              </button>
            </div>
          )}
          <LanguageSelect />
          <ThemeToggle />
          {(status === 'anonymous' || status === 'error') && (
            <button
              type="button"
              onClick={() => login(location.pathname)}
              className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
              title={m.nav.signInTitle}
            >
              {m.nav.signIn}
            </button>
          )}
          <button
            className="rounded-lg p-2 text-fg-muted hover:bg-surface-2 hover:text-fg md:hidden"
            aria-label={m.nav.menu}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <IconMenu />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border-subtle bg-bg md:hidden">
          <nav className="container-page flex flex-col gap-1 py-3" aria-label={m.nav.toolsMenu}>
            {TOOLS.map((t) => (
              <ToolLink key={t.to} {...t} onClick={() => setOpen(false)} />
            ))}
            <a href={cubingspHref} className="rounded-lg px-3 py-2 text-sm text-fg-muted hover:text-fg">
              {m.nav.backToCubingsp}
            </a>
            {status === 'authenticated' && me && (
              <button className="rounded-lg px-3 py-2 text-left text-sm text-fg-muted hover:text-fg" onClick={logout}>
                {m.nav.signOutAs(me.name)}
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
