import { useMemo, useState } from 'react'
import { useI18n } from '../../../i18n/I18nProvider'
import { parseCsv } from '../model/csv'
import {
  detectColumns,
  FIELD_KEYS,
  mergeStaff,
  readRows,
  toStaffEntry,
  type ColumnMap,
  type ImportRow,
} from '../model/staffImport'
import { loadPrivate, savePrivate } from '../model/storage'
import { DEMO_ID } from '../model/demo'
import { useCs } from './ctx'
import { approvedPersons } from '../model/people'
import { Modal, Tag } from './primitives'

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { m } = useI18n()
  const t = m.cubestaff
  const { s, wcif, plan } = useCs()
  const [table, setTable] = useState<string[][] | null>(null)
  const [map, setMap] = useState<ColumnMap | null>(null)
  const [paste, setPaste] = useState('')
  const [overrides, setOverrides] = useState<Record<number, number | 'extra' | null>>({})
  const [skip, setSkip] = useState<Set<number>>(new Set())

  const loadText = (text: string) => {
    const tb = parseCsv(text)
    if (tb.length < 2) return
    setTable(tb)
    setMap(detectColumns(tb[0]))
    setOverrides({})
    setSkip(new Set())
  }

  const rows: ImportRow[] = useMemo(() => (table && map ? readRows(wcif, table, map) : []), [table, map, wcif])
  const effective = rows.map((r) => {
    const o = overrides[r.index]
    if (o === undefined) return r
    if (o === 'extra' || o === null) return { ...r, registrantId: null, how: null as ImportRow['how'] }
    return { ...r, registrantId: o, how: 'manual' as const }
  })
  const included = effective.filter((r) => !skip.has(r.index) && r.approved)
  const matched = effective.filter((r) => r.registrantId != null).length

  const doImport = () => {
    const entries = included.map(toStaffEntry).filter((e): e is NonNullable<typeof e> => !!e)
    const extras = included
      .filter((r) => r.registrantId == null && overrides[r.index] === 'extra')
      .map((r, i) => ({
        id: `${Date.now().toString(36)}${i}`,
        name: r.name || r.rawIdentity,
        note: r.appliesText || undefined,
      }))
    // Dados privados ficam só neste navegador.
    const key = s.isDemo ? DEMO_ID : wcif.id
    const priv = loadPrivate(key)
    for (const r of included)
      if (r.registrantId != null)
        priv[String(r.registrantId)] = {
          email: r.email || undefined,
          phone: r.phone || undefined,
          appliesText: r.appliesText || undefined,
          notes: r.notes,
        }
    savePrivate(key, priv)
    s.commit({
      ...plan,
      staff: mergeStaff(plan.staff, entries),
      extras: [...plan.extras, ...extras],
      updatedAt: new Date().toISOString(),
    })
    onClose()
  }

  const headers = table?.[0] ?? []
  const colSelect = (value: number | undefined, onChange: (v: number | undefined) => void) => (
    <select
      className="w-full rounded-lg border border-border-subtle bg-surface px-2 py-1 text-xs"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    >
      <option value="">{t.noColumn}</option>
      {headers.map((h, i) => (
        <option key={i} value={i}>
          {h.length > 70 ? `${h.slice(0, 70)}…` : h}
        </option>
      ))}
    </select>
  )

  return (
    <Modal
      title={t.importTitle}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="btn-primary btn-sm" disabled={included.length === 0} onClick={doImport}>
            {t.importRun(included.filter((r) => r.registrantId != null || overrides[r.index] === 'extra').length)}
          </button>
        </>
      }
    >
      {!table ? (
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">{t.importHint}</p>
          <label className="btn-primary btn-sm cursor-pointer">
            {t.chooseFile}
            <input
              type="file"
              accept=".csv,text/csv,text/plain,.tsv"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) loadText(await f.text())
              }}
            />
          </label>
          <textarea
            className="h-40 w-full rounded-lg border border-border-subtle bg-surface p-3 font-mono text-xs"
            placeholder={t.pasteHere}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            onBlur={() => paste.trim() && loadText(paste)}
          />
          <p className="text-xs text-fg-faint">{t.privateNote}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <details open className="rounded-xl border border-border-subtle p-4">
            <summary className="cursor-pointer text-sm font-semibold">{t.columns}</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {FIELD_KEYS.map((k) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-xs text-fg-muted">{t.fields[k]}</span>
                  {colSelect(map!.fields[k], (v) => setMap({ ...map!, fields: { ...map!.fields, [k]: v } }))}
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-xs text-fg-muted">{t.availabilityCols}</span>
                <div className="space-y-1">
                  {headers
                    .map((h, i) => (
                      <label key={i} className="flex items-start gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-brand-600"
                          checked={map!.availability.includes(i)}
                          onChange={(e) =>
                            setMap({
                              ...map!,
                              availability: e.target.checked
                                ? [...map!.availability, i]
                                : map!.availability.filter((x) => x !== i),
                            })
                          }
                        />
                        <span className={map!.availability.includes(i) ? '' : 'text-fg-faint'}>
                          {h.length > 90 ? `…${h.slice(-90)}` : h}
                        </span>
                      </label>
                    ))
                    .filter(
                      (_, i) =>
                        /\[|manh|tarde|morning|afternoon|dispon|presen/i.test(headers[i]) ||
                        map!.availability.includes(i),
                    )}
                </div>
              </div>
              <div>
                <span className="mb-1 block text-xs text-fg-muted">{t.notesCols}</span>
                <ul className="list-disc space-y-1 pl-4 text-xs text-fg-muted">
                  {map!.notes.map((i) => (
                    <li key={i}>{headers[i].slice(0, 110)}…</li>
                  ))}
                </ul>
              </div>
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-fg-muted">{t.previewRows(rows.length)}</span>
            <span className="font-medium">{t.matched(matched, rows.length)}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-fg-muted">
                  <th className="py-2 pr-2 font-medium">{t.include}</th>
                  <th className="px-2 py-2 font-medium">{t.fields.identity}</th>
                  <th className="px-2 py-2 font-medium">{t.tabs.people}</th>
                  <th className="px-2 py-2 font-medium">{t.canDo}</th>
                  <th className="px-2 py-2 font-medium">{t.puzzles}</th>
                </tr>
              </thead>
              <tbody>
                {effective.map((r) => {
                  const off = skip.has(r.index) || !r.approved
                  return (
                    <tr
                      key={r.index}
                      className={`border-b border-border-subtle/60 align-top last:border-0 ${off ? 'opacity-50' : ''}`}
                    >
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          className="accent-brand-600"
                          checked={!off}
                          disabled={!r.approved}
                          onChange={(e) => {
                            const n = new Set(skip)
                            if (e.target.checked) n.delete(r.index)
                            else n.add(r.index)
                            setSkip(n)
                          }}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div>{r.rawIdentity}</div>
                        {r.declaredDelegate && <Tag tone="brand">{t.tags.delegate}</Tag>}
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className={`w-full max-w-[260px] rounded-lg border bg-surface px-2 py-1 text-xs ${r.registrantId == null ? 'border-accent-yellow/60' : r.how === 'fuzzy' ? 'border-accent-yellow/60' : 'border-border-subtle'}`}
                          value={overrides[r.index] === 'extra' ? 'extra' : (r.registrantId ?? '')}
                          onChange={(e) =>
                            setOverrides({
                              ...overrides,
                              [r.index]:
                                e.target.value === 'extra'
                                  ? 'extra'
                                  : e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                            })
                          }
                        >
                          <option value="">{t.pickPerson}</option>
                          <option value="extra">{t.asExtra}</option>
                          {approvedPersons(wcif)
                            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                            .map((p) => (
                              <option key={p.registrantId} value={p.registrantId!}>
                                {p.name} {p.wcaId ? `(${p.wcaId})` : ''}
                              </option>
                            ))}
                        </select>
                        <div className="mt-1 text-[11px] text-fg-faint">
                          {t.match[r.how ?? (overrides[r.index] === 'extra' ? 'manual' : 'none')]}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {r.roles.length === 0 ? t.anyRole : r.roles.map((x) => t.roles[x]).join(', ')}
                        {r.preferred[0] && (
                          <div className="text-fg-muted">
                            {t.prefers}: {t.roles[r.preferred[0]]}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-fg-muted">
                        {r.scrambler === false ? t.scramblerNo : r.scramblePuzzles.join(', ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
