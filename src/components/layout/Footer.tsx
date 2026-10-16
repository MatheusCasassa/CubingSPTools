import type { ReactNode } from 'react'
import { APP_VERSION, LINKS } from '../../lib/config'
import { IconBook, IconGithub, IconMail, IconWca } from '../ui/icons'
import { useI18n } from '../../i18n/I18nProvider'

function IconLink({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      title={title}
      aria-label={title}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      className="text-fg-faint transition-colors hover:text-fg"
    >
      {children}
    </a>
  )
}

export function Footer() {
  const { m } = useI18n()
  return (
    <footer className="mt-auto border-t border-border-subtle">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5">
        <span className="text-xs text-fg-muted">
          {m.footer.developedBy} <strong className="font-semibold text-fg">Matheus Casassa</strong>{' '}
          {m.footer.forCommunity}
        </span>
        <div className="flex items-center gap-4">
          <IconLink href={LINKS.guide} title={m.footer.guide}>
            <IconBook />
          </IconLink>
          <IconLink href={LINKS.github} title={m.footer.github}>
            <IconGithub />
          </IconLink>
          <IconLink href={LINKS.email} title={m.footer.email}>
            <IconMail />
          </IconLink>
          <IconLink href={LINKS.wca} title={m.footer.wca}>
            <IconWca />
          </IconLink>
          <span className="font-mono text-xs text-fg-faint">{APP_VERSION}</span>
        </div>
      </div>
    </footer>
  )
}
