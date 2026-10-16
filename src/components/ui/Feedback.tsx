import type { ReactNode } from 'react'
import { IconSpinner } from './icons'

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-fg-muted">
      <IconSpinner className="h-5 w-5 text-brand-500" />
      {label}
    </div>
  )
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'warn' | 'info'; children: ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-accent-red/40 bg-accent-red/10 text-red-700 dark:text-red-200'
      : tone === 'warn'
        ? 'border-accent-yellow/40 bg-accent-yellow/10 text-amber-800 dark:text-amber-100'
        : 'border-brand-500/30 bg-brand-500/10 text-brand-800 dark:text-brand-300'
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>
}
