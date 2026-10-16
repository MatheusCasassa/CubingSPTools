import { useMemo, useState } from 'react'
import { useI18n } from '../../../i18n/I18nProvider'
import type { StaffRole } from '../model/types'
import { agendaFor, type Busy } from '../model/engine'
import { isApproved, normalizeName } from '../model/people'
import { useCs } from './ctx'
import { Tag } from './primitives'

type Filter = 'all' | 'staff' | 'newcomer' | 'delegate' | 'absent'

export function PeoplePanel() {
  const { m } = useI18n()
  const t = m.cubestaff
  const { s, wcif, plan, person, where, time } = useCs()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<number | null>(null)
  const agenda = useMemo(() => agendaFor(wcif, plan), [wcif, plan])
  const absent = new Set(plan.config.absent)
  const inList = new Set(plan.staff.map((e) => e.registrantId))

  const rows = wcif.persons
    .filter(isApproved)
    .map((p) => ({ p, info: person(`p${p.registrantId}`) }))
    .filter(({ p, info }) =>
      filter === 'all'
        ? true
        : filter === 'staff'
          ? inList.has(p.registrantId!)
          : filter === 'newcomer'
            ? info.newcomer
            : filter === 'delegate'
              ? info.delegate
              : absent.has(p.registrantId!),
    )
    .filter(
      ({ p }) =>
        !q ||
        normalizeName(p.name).includes(normalizeName(q)) ||
        (p.wcaId ?? '').toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => a.p.name.localeCompare(b.p.name, 'pt-BR'))

  const toggleAbsent = (id: number) => {
    const next = absent.has(id) ? plan.config.absent.filter((x) => x !== id) : [...plan.config.absent, id]
    s.commit({ ...plan, config: { ...plan.config, absent: next }, updatedAt: new Date().toISOString() })
  }

  const roleLabel = (b: Busy) => (b.role === 'competitor' ? t.roles.competitor : t.roles[b.role as StaffRole])

  return (
    <section className="card p-5">
      <p className="text-sm text-fg-muted">{t.peopleHint}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          className="w-full max-w-xs rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          placeholder={t.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {(['all', 'staff', 'newcomer', 'delegate', 'absent'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`chip ${filter === f ? 'border-brand-500/60 bg-brand-500/10' : 'border-border-subtle'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? t.allEvents : t.tags[f]}
          </button>
        ))}
        <span className="ml-auto text-xs text-fg-faint">{rows.length}</span>
      </div>
      <ul className="mt-4 divide-y divide-border-subtle/60">
        {rows.map(({ p, info }) => {
          const ref = `p${p.registrantId}`
          const items = agenda
            .get(ref)
            .slice()
            .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
          const staffN = items.filter((b) => b.role !== 'competitor').length
          const isOpen = open === p.registrantId
          return (
            <li key={p.registrantId} className={absent.has(p.registrantId!) ? 'opacity-60' : ''}>
              <div className="flex flex-wrap items-center gap-3 py-2.5">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setOpen(isOpen ? null : p.registrantId!)}
                  aria-expanded={isOpen}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 font-mono text-[11px] text-fg-faint">{p.wcaId ?? ''}</span>
                  <span className="ml-2 inline-flex gap-1 align-middle">
                    {info.newcomer && <Tag tone="warn">{t.tags.newcomer}</Tag>}
                    {info.delegate && <Tag tone="brand">{t.tags.delegate}</Tag>}
                    {info.organizer && <Tag>{t.tags.organizer}</Tag>}
                    {inList.has(p.registrantId!) && <Tag tone="ok">{t.tags.staff}</Tag>}
                  </span>
                </button>
                <span className="text-xs text-fg-muted">{t.tasks(staffN)}</span>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={absent.has(p.registrantId!)}
                    onChange={() => toggleAbsent(p.registrantId!)}
                  />
                  {t.absentToggle}
                </label>
              </div>
              {isOpen && (
                <div className="mb-3 rounded-xl bg-surface-2/60 p-3 text-sm">
                  {items.length === 0 ? (
                    <span className="text-fg-faint">{t.noAssignments}</span>
                  ) : (
                    <ul className="space-y-1">
                      {items.map((b, i) => (
                        <li key={i} className="flex flex-wrap gap-x-3">
                          <span className="w-24 shrink-0 font-mono text-xs text-fg-muted">{time(b.start, true)}</span>
                          <span className="flex-1">{where(b.roundId, b.group)}</span>
                          <span className={b.role === 'competitor' ? 'text-fg-muted' : 'font-medium'}>
                            {roleLabel(b)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
