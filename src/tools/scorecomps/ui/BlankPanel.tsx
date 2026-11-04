// Súmulas em branco GENÉRICAS (como no Groupifier): não dependem de
// modalidade. Saem só com o nome da competição (e a logo, se houver); a
// modalidade, a rodada, o limite de tempo e o tempo de corte ficam com espaço
// para preencher à mão. Um botão só: os tipos (5, 3, 2 ou 1 tentativa) vêm
// das rodadas da competição.
import { useI18n } from '../../../i18n/I18nProvider'
import { IconSpinner } from '../../../components/ui/icons'
import type { GenericAttempts } from '../model/logic'

export function BlankPanel({
  types,
  perType,
  busy,
  disabled,
  onGenerate,
}: {
  types: GenericAttempts[]
  /** Súmulas de cada tipo (uma folha cheia). */
  perType: number
  busy: boolean
  disabled: boolean
  onGenerate: () => void
}) {
  const { m } = useI18n()
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{m.scorecomps.blankTitle}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{m.scorecomps.blankIntro}</p>
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={onGenerate} disabled={busy || disabled}>
          {busy ? <IconSpinner /> : null}
          {m.scorecomps.blankButton}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {types.map((a) => (
          <span key={a} className="chip border-border-subtle bg-surface-2 text-fg-muted">
            {m.scorecomps.attemptsN(a)}
            <span className="opacity-70">({m.scorecomps.blankFormats[a]})</span>
          </span>
        ))}
        <span className="text-xs text-fg-faint">{m.scorecomps.blankPerType(perType)}</span>
      </div>
    </section>
  )
}
