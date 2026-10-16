import type { ReactNode } from 'react'
import { APP_VERSION, LINKS } from '../../lib/config'
import { IconBook, IconGithub, IconMail, IconWca } from '../ui/icons'

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
  return (
    <footer className="mt-auto border-t border-border-subtle">
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-5">
        <span className="text-xs text-fg-muted">
          Desenvolvido por <strong className="font-semibold text-fg">Matheus Casassa</strong> para a comunidade
          Speedcubing 😎
        </span>
        <div className="flex items-center gap-4">
          <IconLink href={LINKS.guide} title="Guia de uso">
            <IconBook />
          </IconLink>
          <IconLink href={LINKS.github} title="Repositório no GitHub">
            <IconGithub />
          </IconLink>
          <IconLink href={LINKS.email} title="Enviar e-mail">
            <IconMail />
          </IconLink>
          <IconLink href={LINKS.wca} title="Perfil na WCA">
            <IconWca />
          </IconLink>
          <span className="font-mono text-xs text-fg-faint">{APP_VERSION}</span>
        </div>
      </div>
    </footer>
  )
}
