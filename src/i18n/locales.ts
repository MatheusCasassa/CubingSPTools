// Idiomas do hub — os mesmos do site da CubingSP: PT (padrão, sem prefixo),
// EN (/en/…) e ES (/es/…).
export const LOCALES = ['pt', 'en', 'es'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'pt'

/** Tag BCP 47 (datas, ordenação, <html lang>). */
export const LOCALE_TAG: Record<Locale, string> = { pt: 'pt-BR', en: 'en', es: 'es' }

/** Idioma pelo 1º segmento da URL ("/en/scorecomps" → en). */
export function localeFromPath(pathname: string): Locale {
  const seg = pathname.split('/')[1]
  return seg === 'en' || seg === 'es' ? seg : DEFAULT_LOCALE
}

/** Remove o prefixo de idioma ("/es/calcumulative" → "/calcumulative"). */
export function stripLocale(pathname: string): string {
  const seg = pathname.split('/')[1]
  if (seg === 'en' || seg === 'es') return pathname.slice(seg.length + 1) || '/'
  return pathname || '/'
}

/** Caminho no idioma pedido ("/scorecomps", en → "/en/scorecomps"). */
export function withLocale(path: string, locale: Locale): string {
  const clean = stripLocale(path.startsWith('/') ? path : `/${path}`)
  if (locale === DEFAULT_LOCALE) return clean
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`
}
