// Campo de tempo "por dígitos" (como nos cronômetros de competição):
// digite só números — 1234 vira 12.34, 12345 vira 1:23.45.
import { cleanDigits, formatDigits } from '../model/time'

export function TimeInput({
  digits,
  onChange,
  label,
  placeholder = '0.00',
  disabled,
  invalid,
  className = '',
}: {
  digits: string
  onChange: (digits: string) => void
  label: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      aria-label={label}
      placeholder={placeholder}
      disabled={disabled}
      value={formatDigits(digits)}
      onChange={(e) => onChange(cleanDigits(e.target.value))}
      onFocus={(e) => {
        const el = e.currentTarget
        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length))
      }}
      className={
        'w-full rounded-lg border bg-surface-2 px-3 py-2.5 text-right font-mono text-base tabular-nums outline-none transition-colors ' +
        'placeholder:text-fg-faint focus:border-brand-400 disabled:cursor-not-allowed disabled:opacity-40 ' +
        (invalid ? 'border-accent-red/60' : 'border-border-subtle') +
        ' ' +
        className
      }
    />
  )
}
