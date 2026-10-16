// Seletor PT / ES / EN com bandeiras em SVG (nunca emoji — o Windows não
// desenha bandeiras de emoji), igual ao do site da CubingSP.
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nProvider'
import { withLocale, type Locale } from '../../i18n/locales'
import { messagesFor } from '../../i18n/I18nProvider'

function Flag({ locale, className = 'h-3.5 w-5' }: { locale: Locale; className?: string }) {
  if (locale === 'pt')
    return (
      <svg viewBox="0 0 20 14" className={className} aria-hidden>
        <rect width="20" height="14" rx="1.5" fill="#009c3b" />
        <path d="M10 1.8 18 7l-8 5.2L2 7z" fill="#ffdf00" />
        <circle cx="10" cy="7" r="3" fill="#002776" />
        <path d="M7.2 6.4c1.9-.4 3.9-.1 5.6.9" stroke="#fff" strokeWidth=".6" fill="none" />
      </svg>
    )
  if (locale === 'es')
    return (
      <svg viewBox="0 0 20 14" className={className} aria-hidden>
        <rect width="20" height="14" rx="1.5" fill="#aa151b" />
        <rect y="3.5" width="20" height="7" fill="#f1bf00" />
      </svg>
    )
  return (
    <svg viewBox="0 0 20 14" className={className} aria-hidden>
      <rect width="20" height="14" rx="1.5" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((y) => (
        <rect key={y} y={y} width="20" height="1.08" fill="#b22234" />
      ))}
      <rect width="9" height="7.5" fill="#3c3b6e" />
    </svg>
  )
}

const ORDER: Locale[] = ['pt', 'es', 'en']

export function LanguageSelect() {
  const { locale, m } = useI18n()
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const choose = (l: Locale) => {
    setOpen(false)
    if (l !== locale) navigate(withLocale(pathname, l) + search + hash)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={m.nav.language}
        className="flex items-center gap-1.5 rounded-full border border-border-subtle px-2.5 py-1.5 text-xs font-semibold uppercase text-fg transition-colors hover:bg-surface-2"
      >
        <Flag locale={locale} />
        {locale}
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-fg-muted" aria-hidden>
          <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={m.nav.language}
          className="absolute right-0 z-40 mt-2 w-40 overflow-hidden rounded-xl border border-border-subtle bg-surface py-1 shadow-xl"
        >
          {ORDER.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === locale}
                onClick={() => choose(l)}
                className={
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ' +
                  (l === locale ? 'font-semibold text-fg' : 'text-fg-muted')
                }
              >
                <Flag locale={l} />
                <span className="w-6 text-xs font-semibold uppercase">{l}</span>
                {messagesFor(l).meta.languageName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
