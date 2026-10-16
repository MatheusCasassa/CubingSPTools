import { useMemo, useState } from 'react'
import { useI18n } from '../../../i18n/I18nProvider'
import { EventIcon } from '../../../components/ui/EventIcon'
import { eventName } from '../../../lib/wca/format'
import type { Plan, StaffEntry, StaffRole } from '../model/types'
import { isDelegate, isNewcomer, normalizeName } from '../model/people'
import { competitionDays } from '../model/schedule'
import { loadPrivate } from '../model/storage'
import { useCs } from './ctx'
import { IconPlus, IconUpload, Modal, Tag } from './primitives'
import { ImportDialog } from './ImportDialog'
import { DEMO_ID } from '../model/demo'

const ROLES: StaffRole[] = ['judge', 'scrambler', 'runner']

export function PersonSearch({
  exclude,
  onPick,
  autoFocus,
}: {
  exclude: Set<number>
  onPick: (id: number) => void
  autoFocus?: boolean
}) {
  const { m } = useI18n()
  const { wcif } = useCs()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const n = normalizeName(q)
    return wcif.persons
      .filter((p) => p.registrantId != null && !exclude.has(p.registrantId))
      .filter((p) => !n || normalizeName(p.name).includes(n) || (p.wcaId ?? '').toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 60)
  }, [q, wcif, exclude])
  return (
    <div>
      <input
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        placeholder={m.cubestaff.search}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="mt-2 max-h-80 overflow-y-auto">
        {list.map((p) => (
          <li key={p.registrantId}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
              onClick={() => onPick(p.registrantId!)}
            >
              <span>
                {p.name}
                <span className="ml-2 font-mono text-[11px] text-fg-faint">{p.wcaId ?? ''}</span>
              </span>
              <span className="flex gap-1">
                {isNewcomer(p) && <Tag tone="warn">{m.cubestaff.tags.newcomer}</Tag>}
                {isDelegate(p) && <Tag tone="brand">{m.cubestaff.tags.delegate}</Tag>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Availability({ entry }: { entry: StaffEntry }) {
  const { m, tag } = useI18n()
  const { wcif } = useCs()
  const days = competitionDays(wcif)
  if (!entry.availability) return <span className="text-xs text-fg-faint">{m.cubestaff.always}</span>
  const fmt = new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' })
  return (
    <span className="flex flex-wrap gap-1">
      {days.map((d) => {
        const a = entry.availability![d] ?? { morning: false, afternoon: false }
        const cell = (on: boolean, letter: string, title: string) => (
          <span
            title={title}
            className={`grid h-5 w-5 place-items-center rounded text-[10px] font-semibold ${on ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-surface-2 text-fg-faint line-through'}`}
          >
            {letter}
          </span>
        )
        const day = fmt.format(new Date(`${d}T12:00:00Z`))
        return (
          <span key={d} className="inline-flex items-center gap-0.5 rounded-md border border-border-subtle px-1 py-0.5">
            <span className="mr-0.5 text-[10px] text-fg-muted">{day}</span>
            {cell(a.morning, m.cubestaff.morning[0], `${day} · ${m.cubestaff.morning}`)}
            {cell(a.afternoon, m.cubestaff.afternoon[0], `${day} · ${m.cubestaff.afternoon}`)}
          </span>
        )
      })}
    </span>
  )
}

export function StaffPanel() {
  const { m } = useI18n()
  const { s, wcif, plan, person } = useCs()
  const t = m.cubestaff
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [extraName, setExtraName] = useState('')
  const [extraNote, setExtraNote] = useState('')
  const [q, setQ] = useState('')
  const priv = useMemo(() => loadPrivate(s.isDemo ? DEMO_ID : wcif.id), [s.isDemo, wcif.id, plan.staff])

  const update = (next: Partial<Plan>, key?: string) =>
    s.commit({ ...plan, ...next, updatedAt: new Date().toISOString() }, key)
  const setEntry = (id: number, patch: Partial<StaffEntry>) =>
    update({ staff: plan.staff.map((e) => (e.registrantId === id ? { ...e, ...patch } : e)) })
  const inList = new Set(plan.staff.map((e) => e.registrantId))

  const sorted = plan.staff
    .map((e) => ({ e, p: person(`p${e.registrantId}`) }))
    .filter(
      ({ p }) =>
        !q ||
        normalizeName(p.name).includes(normalizeName(q)) ||
        (p.wcaId ?? '').toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => a.p.name.localeCompare(b.p.name, 'pt-BR'))

  const addAll = () => {
    const extra: StaffEntry[] = wcif.persons
      .filter((p) => p.registrantId != null && p.wcaId && !inList.has(p.registrantId))
      .map((p) => ({
        registrantId: p.registrantId!,
        roles: [],
        preferred: [],
        scrambler: null,
        scramblePuzzles: [],
        availability: null,
      }))
    update({ staff: [...plan.staff, ...extra] })
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="font-semibold">
              {t.staffTitle} <span className="ml-1 text-sm font-normal text-fg-muted">({plan.staff.length})</span>
            </h2>
            <p className="mt-1 text-sm text-fg-muted">{t.staffHint}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary btn-sm" onClick={() => setImporting(true)}>
              <IconUpload className="h-3.5 w-3.5" /> {t.importCsv}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setAdding(true)}>
              <IconPlus /> {t.addPerson}
            </button>
            <button className="btn-ghost btn-sm" onClick={addAll}>
              {t.addAllWithId}
            </button>
            {plan.staff.length > 0 && (
              <button
                className="btn-ghost btn-sm"
                onClick={() => window.confirm(t.removeAllConfirm) && update({ staff: [] })}
              >
                {t.removeAll}
              </button>
            )}
          </div>
        </div>

        {plan.staff.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border-strong p-6 text-center text-sm text-fg-faint">
            {t.staffEmpty}
          </p>
        ) : (
          <>
            <input
              className="mt-5 w-full max-w-xs rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              placeholder={t.search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-fg-muted">
                    <th className="py-2 pr-3 font-medium">{t.extraName}</th>
                    <th className="px-3 py-2 font-medium">{t.canDo}</th>
                    <th className="px-3 py-2 font-medium">{t.prefers}</th>
                    <th className="px-3 py-2 font-medium">{t.puzzles}</th>
                    <th className="px-3 py-2 font-medium">{t.availability}</th>
                    <th className="py-2 pl-3" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(({ e, p }) => {
                    const pi = priv[String(e.registrantId)]
                    return (
                      <tr key={e.registrantId} className="border-b border-border-subtle/60 align-top last:border-0">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{p.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] text-fg-faint">{p.wcaId ?? ''}</span>
                            {p.delegate && <Tag tone="brand">{t.tags.delegate}</Tag>}
                            {p.newcomer && <Tag tone="danger">{t.tags.newcomer}</Tag>}
                          </div>
                          {pi && (pi.email || pi.phone || pi.notes?.length) ? (
                            <details className="mt-1 text-xs text-fg-muted">
                              <summary className="cursor-pointer">{t.answers}</summary>
                              <div className="mt-1 space-y-1">
                                {pi.email && <div>{pi.email}</div>}
                                {pi.phone && <div>{pi.phone}</div>}
                                {pi.appliesText && <div>{pi.appliesText}</div>}
                                {pi.notes?.map((n, i) => (
                                  <div key={i} className="rounded-md bg-surface-2 p-2">
                                    <div className="text-[11px] text-fg-faint">{n.question.slice(0, 120)}</div>
                                    <div className="mt-0.5 text-fg">{n.answer}</div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {ROLES.map((r) => {
                              const on = e.roles.length === 0 || e.roles.includes(r)
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  className={`chip ${on ? 'border-brand-500/50 bg-brand-500/10 text-fg' : 'border-border-subtle text-fg-faint line-through'}`}
                                  onClick={() => {
                                    const cur = e.roles.length === 0 ? [...ROLES] : e.roles
                                    const next = on ? cur.filter((x) => x !== r) : [...cur, r]
                                    setEntry(e.registrantId, {
                                      roles: next.length === ROLES.length ? [] : next,
                                      ...(r === 'scrambler'
                                        ? { scrambler: on ? false : e.scrambler === false ? null : e.scrambler }
                                        : {}),
                                    })
                                  }}
                                >
                                  {t.roles[r]}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            className="rounded-lg border border-border-subtle bg-surface px-2 py-1 text-sm"
                            value={e.preferred[0] ?? ''}
                            onChange={(ev) =>
                              setEntry(e.registrantId, {
                                preferred: ev.target.value ? [ev.target.value as StaffRole] : [],
                              })
                            }
                          >
                            <option value="">{t.anyRole}</option>
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {t.roles[r]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          {e.scrambler === false ? (
                            <span className="text-xs text-fg-faint">{t.scramblerNo}</span>
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {e.scramblePuzzles.map((ev) => (
                                <EventIcon
                                  key={ev}
                                  eventId={ev}
                                  className="h-4 w-4 text-fg-muted"
                                  title={eventName(ev)}
                                />
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Availability entry={e} />
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <button
                            className="text-xs text-fg-muted hover:text-red-600"
                            onClick={() =>
                              update({ staff: plan.staff.filter((x) => x.registrantId !== e.registrantId) })
                            }
                          >
                            {t.remove}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-fg-faint">{t.privateNote}</p>
          </>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">
          {t.extrasTitle} <span className="ml-1 text-sm font-normal text-fg-muted">({plan.extras.length})</span>
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t.extrasHint}</p>
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!extraName.trim()) return
            const id = String(Math.max(0, ...plan.extras.map((x) => Number(x.id) || 0)) + 1)
            update({ extras: [...plan.extras, { id, name: extraName.trim(), note: extraNote.trim() || undefined }] })
            setExtraName('')
            setExtraNote('')
          }}
        >
          <input
            className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm"
            placeholder={t.extraName}
            value={extraName}
            onChange={(e) => setExtraName(e.target.value)}
          />
          <input
            className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm"
            placeholder={t.extraNote}
            value={extraNote}
            onChange={(e) => setExtraNote(e.target.value)}
          />
          <button className="btn-ghost btn-sm" type="submit">
            <IconPlus /> {t.addExtra}
          </button>
        </form>
        {plan.extras.length > 0 && (
          <ul className="mt-4 divide-y divide-border-subtle/60">
            {plan.extras.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {x.name}
                  {x.note && <span className="ml-2 text-xs text-fg-muted">{x.note}</span>}
                </span>
                <button
                  className="text-xs text-fg-muted hover:text-red-600"
                  onClick={() => update({ extras: plan.extras.filter((e) => e.id !== x.id) })}
                >
                  {t.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {adding && (
        <Modal title={t.addPerson} onClose={() => setAdding(false)}>
          <PersonSearch
            autoFocus
            exclude={inList}
            onPick={(id) =>
              update({
                staff: [
                  ...plan.staff,
                  {
                    registrantId: id,
                    roles: [],
                    preferred: [],
                    scrambler: null,
                    scramblePuzzles: [],
                    availability: null,
                  },
                ],
              })
            }
          />
        </Modal>
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </div>
  )
}
