import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { localeFromPath, LOCALE_TAG, withLocale, type Locale } from './locales'
import { pt, type Messages } from './messages/pt'
import { en } from './messages/en'
import { es } from './messages/es'

const ALL: Record<Locale, Messages> = { pt, en, es }

interface I18n {
  locale: Locale
  tag: string
  m: Messages
  /** Caminho interno no idioma atual. */
  lp: (path: string) => string
}

const Ctx = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const locale = localeFromPath(pathname)
  const value = useMemo<I18n>(
    () => ({ locale, tag: LOCALE_TAG[locale], m: ALL[locale], lp: (p: string) => withLocale(p, locale) }),
    [locale],
  )
  useEffect(() => {
    document.documentElement.lang = LOCALE_TAG[locale]
    document.title = ALL[locale].meta.title
    try {
      localStorage.setItem('ferramentas.locale', locale)
    } catch {
      /* só não lembra */
    }
  }, [locale])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n deve ser usado dentro de I18nProvider')
  return ctx
}

/** Mensagens de um idioma fora do React (ex.: textos da súmula). */
export function messagesFor(locale: Locale): Messages {
  return ALL[locale]
}
