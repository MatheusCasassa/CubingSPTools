// Súmulas em branco GENÉRICAS (como no Groupifier): não dependem de
// modalidade. Saem só com o nome da competição (e a logo, se houver); a
// modalidade, a rodada, o limite de tempo e o tempo de corte ficam com espaço
// para preencher à mão. Escolhe-se a quantidade por nº de tentativas.
import { useI18n } from '../../../i18n/I18nProvider'
import { GENERIC_ATTEMPTS, type GenericAttempts } from '../model/logic'

const MAX = 500
const clamp = (n: number) => Math.max(0, Math.min(MAX, Math.round(n) || 0))

export type GenericBlank = Record<GenericAttempts, number>
export const NO_GENERIC_BLANK: GenericBlank = { 5: 0, 3: 0, 2: 0, 1: 0 }

export function BlankPanel({ value, onChange }: { value: GenericBlank; onChange: (v: GenericBlank) => void }) {
  const { m } = useI18n()
  const total = GENERIC_ATTEMPTS.reduce((n, a) => n + value[a], 0)

  return (
    <section className={'card p-4 transition-colors ' + (total > 0 ? 'border-brand-500/50' : '')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{m.scorecomps.blankTitle}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{m.scorecomps.blankIntro}</p>
        </div>
        {total > 0 && <span className="font-mono text-xs text-fg-muted">{total}</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {GENERIC_ATTEMPTS.map((a) => (
          <label
            key={a}
            title={m.scorecomps.blankFormats[a]}
            className={
              'chip ' +
              (value[a] > 0
                ? 'border-brand-500 bg-brand-600/15 text-brand-700 dark:text-brand-300'
                : 'border-dashed border-border-strong text-fg-muted')
            }
          >
            <span>
              {m.scorecomps.attemptsN(a)}
              <span className="ml-1 opacity-70">({m.scorecomps.blankFormats[a]})</span>
            </span>
            <input
              type="number"
              min={0}
              max={MAX}
              value={value[a]}
              onChange={(e) => onChange({ ...value, [a]: clamp(Number(e.target.value)) })}
              className="w-12 bg-transparent text-right font-mono text-fg outline-none"
              aria-label={m.scorecomps.blankAriaN(a)}
            />
          </label>
        ))}
        {total > 0 && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(NO_GENERIC_BLANK)}>
            {m.scorecomps.blankReset}
          </button>
        )}
      </div>
    </section>
  )
}
