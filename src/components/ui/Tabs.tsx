// Abas com sublinhado: só uma linha embaixo da aba ativa.
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T
  onChange: (v: T) => void
  tabs: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-6 overflow-x-auto border-b border-border-subtle">
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={
              '-mb-px whitespace-nowrap border-b-2 px-1 pb-3 pt-1 text-sm font-medium transition-colors ' +
              (active
                ? 'border-brand-500 text-fg'
                : 'border-transparent text-fg-muted hover:border-border-strong hover:text-fg')
            }
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
