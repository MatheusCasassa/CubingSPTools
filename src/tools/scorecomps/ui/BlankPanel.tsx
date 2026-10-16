// Súmulas em branco por modalidade (como no Groupifier/AGE): para inscrições
// de última hora, reposição ou rodadas seguintes. Cada súmula segue o FORMATO
// da rodada no WCIF — Ao5/Bo5 com 5 tentativas, Mo3/Bo3 (6x6, 7x7, BLD
// grandes, FMC) com 3, Multi-Blind com 1, 2 ou 3 conforme a competição —
// sempre com os 2 extras. O número digitado aqui é o mesmo do campo
// "Em branco" de cada rodada.
import { useState } from 'react'
import { EventIcon } from '../../../components/ui/EventIcon'
import { useI18n } from '../../../i18n/I18nProvider'
import { roundName, type RoundPlan } from '../model/build'
import { attemptsFor } from '../model/logic'

const MAX = 500
const clamp = (n: number) => Math.max(0, Math.min(MAX, Math.round(n) || 0))

export function BlankPanel({
  events,
  blankOf,
  onBlank,
  onApplyAll,
}: {
  events: { eventId: string; eventName: string; rounds: RoundPlan[] }[]
  blankOf: (roundId: string) => number
  onBlank: (roundId: string, n: number) => void
  /** Define `n` súmulas em branco na 1ª rodada de cada modalidade (0 zera todas as rodadas). */
  onApplyAll: (n: number) => void
}) {
  const { m, locale } = useI18n()
  const [perEvent, setPerEvent] = useState(5)
  const total = events.reduce((t, ev) => t + ev.rounds.reduce((s, p) => s + blankOf(p.info.roundId), 0), 0)

  return (
    <details className="card group p-0" open={total > 0 || undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-semibold">{m.scorecomps.blankTitle}</span>
          <span className="mt-0.5 block text-xs text-fg-faint">{m.scorecomps.blankSummary}</span>
        </span>
        <span className="flex items-center gap-3">
          {total > 0 && <span className="font-mono text-xs text-fg-muted">{total}</span>}
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-fg-muted transition-transform group-open:rotate-180" aria-hidden>
            <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>

      <div className="border-t border-border-subtle p-4">
        <p className="text-xs leading-relaxed text-fg-muted">{m.scorecomps.blankIntro}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <label className="chip border-border-subtle bg-surface-2 text-fg-muted">
            <input
              type="number"
              min={0}
              max={MAX}
              value={perEvent}
              onChange={(e) => setPerEvent(clamp(Number(e.target.value)))}
              className="w-10 bg-transparent text-right font-mono text-fg outline-none"
              aria-label={m.scorecomps.blankPerEventAria}
            />
            {m.scorecomps.blankPerEvent}
          </label>
          <button type="button" className="btn-ghost btn-sm" onClick={() => onApplyAll(perEvent)}>
            {m.scorecomps.blankApply}
          </button>
          {total > 0 && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => onApplyAll(0)}>
              {m.scorecomps.blankReset}
            </button>
          )}
        </div>

        <ul className="mt-4 divide-y divide-border-subtle">
          {events.map((ev) => (
            <li key={ev.eventId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
              <span className="flex min-w-0 items-center gap-2.5 text-sm">
                <EventIcon eventId={ev.eventId} className="h-5 w-5 shrink-0" />
                <span className="truncate">{ev.eventName}</span>
              </span>
              <span className="flex flex-wrap justify-end gap-2">
                {ev.rounds.map((p) => {
                  const n = blankOf(p.info.roundId)
                  const attempts = attemptsFor(p.info.round.format)
                  return (
                    <label
                      key={p.info.roundId}
                      title={m.scorecomps.formats[p.info.round.format] ?? ''}
                      className={
                        'chip ' +
                        (n > 0
                          ? 'border-brand-500 bg-brand-600/15 text-brand-700 dark:text-brand-300'
                          : 'border-dashed border-border-strong text-fg-muted')
                      }
                    >
                      <span>
                        {ev.rounds.length > 1 ? `${roundName(p.info, locale)} · ` : ''}
                        {m.scorecomps.attemptsN(attempts)}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={MAX}
                        value={n}
                        onChange={(e) => onBlank(p.info.roundId, clamp(Number(e.target.value)))}
                        className="w-10 bg-transparent text-right font-mono text-fg outline-none"
                        aria-label={m.scorecomps.blankAria(`${ev.eventName} ${roundName(p.info, locale)}`)}
                      />
                    </label>
                  )
                })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
