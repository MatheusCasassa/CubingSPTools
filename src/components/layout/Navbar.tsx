import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth/AuthContext'
import { config } from '../../lib/config'
import { applyTheme, getTheme, type Theme } from '../../lib/theme'
import { BrandMark, IconArrowLeft, IconChevronDown, IconMenu, IconMoon, IconSun } from '../ui/icons'
import { CATEGORIES, CATEGORY_COLOR, categoryOfPath, toolsIn, type Category } from '../../lib/tools'
import { stripLocale } from '../../i18n/locales'
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

/** Bolinha com a cor da categoria. */
function Dot({ category, className = 'h-2 w-2' }: { category: Category; className?: string }) {
  return <span className={'shrink-0 rounded-full ' + className} style={{ background: CATEGORY_COLOR[category] }} aria-hidden />
}

/** Lista de ferramentas de uma categoria (menu suspenso e menu do celular). */
function CategoryTools({ category, onPick }: { category: Category; onPick: () => void }) {
  const { m, lp, tag } = useI18n()
  const tools = toolsIn(category, tag)
  if (tools.length === 0) return <p className="px-3 py-2 text-sm text-fg-faint">{m.home.emptyCategory}</p>
  return (
    <>
      {tools.map((t) => (
        <NavLink
          key={t.to}
          to={lp(t.to)}
          onClick={onPick}
          className={({ isActive }) =>
            'flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2 ' + (isActive ? 'bg-surface-2' : '')
          }
        >
          {t.mark('h-8 w-8 shrink-0')}
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-fg">
              {t.name}
              {!t.ready && (
                <span className="rounded bg-brand-600/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-500 dark:text-brand-300">
                  {m.common.soon}
                </span>
              )}
            </span>
            <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-fg-muted">{m.home.tools[t.description]}</span>
          </span>
        </NavLink>
      ))}
    </>
  )
}

/** Item do menu: uma categoria (cor + nome curto) que abre suas ferramentas. */
function CategoryMenu({
  category,
  open,
  active,
  onToggle,
  onClose,
}: {
  category: Category
  open: boolean
  active: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const { m } = useI18n()
  const info = m.home.categories[category]
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="true"
        title={info.title}
        className={
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
          (open || active ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg')
        }
      >
        <Dot category={category} />
        {info.short}
        <IconChevronDown className={'h-3.5 w-3.5 transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-80 rounded-2xl border border-border-subtle bg-surface p-2 shadow-xl">
          <div className="flex items-center gap-2 px-3 pb-2 pt-1.5">
            <Dot category={category} className="h-2.5 w-2.5" />
            <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{info.title}</span>
          </div>
          <CategoryTools category={category} onPick={onClose} />
        </div>
      )}
    </div>
  )
}

export function Navbar() {
  const { status, me, logout, login } = useAuth()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState<Category | null>(null)
  const location = useLocation()
  const { m, lp, locale } = useI18n()
  const navRef = useRef<HTMLElement>(null)
  const activeCategory = categoryOfPath(stripLocale(location.pathname))

  // Fecha o menu suspenso ao trocar de página, clicar fora ou apertar Esc.
  useEffect(() => setMenu(null), [location.pathname])
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => navRef.current && !navRef.current.contains(e.target as Node) && setMenu(null)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [menu])
  // O site da CubingSP também tem /en e /es.
  const cubingspHref = config.cubingspUrl + (locale === 'pt' ? '' : `/${locale}`)

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg/80 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-4">
        <Link to={lp('/')} className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <BrandMark className="h-8 w-8" />
          <span className="hidden text-[15px] font-bold tracking-tight min-[420px]:inline">
            C<span className="text-accent-red">SP</span>Tools
          </span>
        </Link>

        <nav ref={navRef} className="ml-1 hidden items-center gap-0.5 md:flex" aria-label={m.nav.tools}>
          {CATEGORIES.map((c) => (
            <CategoryMenu
              key={c}
              category={c}
              open={menu === c}
              active={activeCategory === c}
              onToggle={() => setMenu((cur) => (cur === c ? null : c))}
              onClose={() => setMenu(null)}
            />
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
            {CATEGORIES.map((c) => (
              <div key={c} className="py-1">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <Dot category={c} className="h-2.5 w-2.5" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                    {m.home.categories[c].title}
                  </span>
                </div>
                <CategoryTools category={c} onPick={() => setOpen(false)} />
              </div>
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
