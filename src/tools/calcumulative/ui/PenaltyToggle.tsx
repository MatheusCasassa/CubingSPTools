import type { Penalty } from '../model/time'

const OPTIONS: { value: Penalty; label: string; title: string }[] = [
  { value: 'ok', label: 'OK', title: 'Sem penalidade' },
  { value: '+2', label: '+2', title: 'Penalidade de 2 segundos' },
  { value: 'dnf', label: 'DNF', title: 'Did Not Finish' },
]

export function PenaltyToggle({
  value,
  onChange,
  disabled,
  label,
}: {
  value: Penalty
  onChange: (p: Penalty) => void
  disabled?: boolean
  label: string
}) {
  return (
    <div className="seg w-[132px] shrink-0" role="group" aria-label={label}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          disabled={disabled}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={
            value === o.value && o.value === 'dnf'
              ? '!text-accent-red'
              : value === o.value && o.value === '+2'
                ? '!text-amber-600 dark:!text-accent-yellow'
                : ''
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
