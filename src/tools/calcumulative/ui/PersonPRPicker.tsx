// "Meta de média" a partir do PR de alguém: busca a pessoa na WCA (nome ou
// WCA ID), mostra as modalidades em que ela tem média válida e, ao escolher
// uma, usa o PR de média como meta (e o formato certo: Ao5 ou Mo3).
import { useEffect, useRef, useState } from 'react'
import { EventIcon } from '../../../components/ui/EventIcon'
import { IconSpinner } from '../../../components/ui/icons'
import { useI18n } from '../../../i18n/I18nProvider'
import { eventName } from '../../../lib/wca/format'
import { searchPersons, WCA_ID_RE, type PersonPRs } from '../../../lib/wca/persons'
import { eventsWithAverage } from '../model/events'
import type { AverageFormat } from '../model/average'
import { formatResult } from '../model/time'

export interface PickedPR {
  wcaId: string
  name: string
  eventId: string
  pr: number
  format: AverageFormat
}

const MIN_CHARS = 3

export function PersonPRPicker({
  picked,
  onPick,
  onClear,
}: {
  picked: PickedPR | null
  onPick: (p: PickedPR) => void
  onClear: () => void
}) {
  const { m } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PersonPRs[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [person, setPerson] = useState<PersonPRs | null>(null)
  const abort = useRef<AbortController | null>(null)

  // Busca com espera de 350 ms depois da última tecla.
  useEffect(() => {
    const q = query.trim()
    abort.current?.abort()
    if (person || (q.length < MIN_CHARS && !WCA_ID_RE.test(q))) {
      setResults(null)
      setLoading(false)
      return
    }
    const ctl = new AbortController()
    abort.current = ctl
    setLoading(true)
    setError(false)
    const t = setTimeout(() => {
      searchPersons(q, ctl.signal)
        .then((r) => !ctl.signal.aborted && setResults(r))
        .catch(() => !ctl.signal.aborted && setError(true))
        .finally(() => !ctl.signal.aborted && setLoading(false))
    }, 350)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [query, person])

  const choosePerson = (p: PersonPRs) => {
    setPerson(p)
    setResults(null)
    setQuery('')
  }
  const reset = () => {
    setPerson(null)
    onClear()
  }

  return (
    <div className="border-t border-border-subtle pt-3">
      <span className="label">{m.calc.prTitle}</span>

      {!person ? (
        <>
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={m.calc.prPlaceholder}
              aria-label={m.calc.prPlaceholder}
              className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            {loading && <IconSpinner className="absolute right-3 top-2.5 h-4 w-4 text-fg-faint" />}
          </div>
          <p className="mt-1.5 text-xs text-fg-faint">{m.calc.prHint}</p>
          {error && <p className="mt-2 text-xs text-accent-red">{m.calc.prError}</p>}
          {results && results.length === 0 && !loading && <p className="mt-2 text-sm text-fg-muted">{m.calc.prNoResults}</p>}
          {results && results.length > 0 && (
            <ul className="mt-2 max-h-64 overflow-auto rounded-lg border border-border-subtle">
              {results.map((p) => (
                <li key={p.wcaId}>
                  <button
                    type="button"
                    onClick={() => choosePerson(p)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-fg-faint">
                      {p.wcaId}
                      {p.countryIso2 ? ` · ${p.countryIso2}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-2">
            <a
              href={`https://www.worldcubeassociation.org/persons/${person.wcaId}`}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 hover:underline"
            >
              <span className="block truncate text-sm font-semibold">{person.name}</span>
              <span className="block font-mono text-[11px] text-fg-faint">{person.wcaId}</span>
            </a>
            <button type="button" className="btn-ghost btn-sm shrink-0" onClick={reset}>
              {m.calc.prChange}
            </button>
          </div>
          {eventsWithAverage(person.averages).length === 0 ? (
            <p className="mt-2 text-sm text-fg-muted">{m.calc.prNoAverages}</p>
          ) : (
            <>
              <p className="mt-3 text-xs text-fg-muted">{m.calc.prPickEvent}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {eventsWithAverage(person.averages).map((e) => {
                  const on = picked?.wcaId === person.wcaId && picked.eventId === e.id
                  return (
                    <button
                      key={e.id}
                      type="button"
                      aria-pressed={on}
                      title={`${eventName(e.id)} — ${e.format === 'mo3' ? 'Mo3' : 'Ao5'}`}
                      onClick={() =>
                        onPick({ wcaId: person.wcaId, name: person.name, eventId: e.id, pr: e.pr, format: e.format })
                      }
                      className={
                        'chip ' +
                        (on
                          ? 'border-brand-500 bg-brand-600/15 text-brand-700 dark:text-brand-300'
                          : 'border-border-subtle bg-surface-2 text-fg-muted hover:border-border-strong')
                      }
                    >
                      <EventIcon eventId={e.id} className="h-4 w-4" />
                      <span className="font-mono">{formatResult(e.pr)}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
