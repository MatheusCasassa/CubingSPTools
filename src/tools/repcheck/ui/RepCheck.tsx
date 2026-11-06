import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Spinner } from '../../../components/ui/Feedback'
import { RepCheckMark } from '../../../components/ui/icons'
import { useI18n } from '../../../i18n/I18nProvider'
import { config } from '../../../lib/config'
import {
  CspApiError,
  getChecklist,
  patchChecklist,
  type ChecklistDoc,
  type ChecklistItem,
  type ChecklistOp,
  type ChecklistPhase,
} from '../../../lib/csp/server'
import { applyChecklist } from '../../../../worker/api'
import { syncTrustedTime, trustedNow } from '../../../lib/trustedTime'
import { todayIso } from '../../scorecomps/model/competitions'
import { DuringHome, DuringPage, type DuringCtx, type DuringTool } from '../../during/DuringShell'
import {
  competitionDays,
  defaultItems,
  dueDate,
  groupsPublished,
  loadMyTemplate,
  newItemId,
  PHASES,
  saveMyTemplate,
  statusOf,
  summary,
} from '../model/checklist'

export function useRepCheckTool(): DuringTool {
  const { m } = useI18n()
  const t = m.repcheck
  return {
    slug: 'repcheck',
    name: 'RepCheck',
    mark: (c) => <RepCheckMark className={c} />,
    access: 'staff',
    subtitle: t.subtitle,
    intro: t.intro,
    loginNote: t.loginNote,
    features: t.features,
  }
}

export function RepCheckHome() {
  return <DuringHome tool={useRepCheckTool()} />
}

export default function RepCheckPage() {
  const { competitionId } = useParams()
  return (
    <DuringPage tool={useRepCheckTool()} competitionId={competitionId}>
      {(ctx) => <Checklist ctx={ctx} />}
    </DuringPage>
  )
}

/** Troca a lista mantendo as marcações dos itens que continuam. */
function withDone(next: ChecklistItem[], prev: ChecklistItem[]): ChecklistItem[] {
  const done = new Map(prev.map((i) => [i.id, i.done]))
  return next.map((i) => ({ ...i, done: done.get(i.id) ?? null }))
}

function Checklist({ ctx }: { ctx: DuringCtx }) {
  const { m, tag } = useI18n()
  const t = m.repcheck
  const id = ctx.wcif.id
  const [doc, setDoc] = useState<ChecklistDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ChecklistItem[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [resultsPosted, setResultsPosted] = useState(false)
  const [today, setToday] = useState(() => todayIso(new Date()))
  const busy = useRef(false)

  const days = useMemo(() => competitionDays(ctx.wcif), [ctx.wcif])
  const fallback = useMemo(() => defaultItems(t.defaults), [t.defaults])
  const items = doc?.items ?? fallback
  const auto: Record<string, boolean> = { groups: groupsPublished(ctx.wcif), results: resultsPosted }

  const refresh = useCallback(async () => {
    try {
      setDoc(await getChecklist(ctx.token!, id))
    } catch (e) {
      setError(e instanceof CspApiError && e.status === 401 ? m.errors.sessionExpired : t.syncError)
    }
  }, [ctx.token, id])

  useEffect(() => {
    void refresh()
    syncTrustedTime().then(() => setToday(todayIso(trustedNow())))
    // Resultados publicados (dado público da WCA).
    fetch(`${config.wcaApiBase}/competitions/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { results_posted_at?: string | null } | null) => setResultsPosted(!!c?.results_posted_at))
      .catch(() => undefined)
  }, [refresh, id])

  useEffect(() => {
    if (editing) return
    const h = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !busy.current) void refresh()
    }, 20_000)
    return () => window.clearInterval(h)
  }, [refresh, editing])

  const send = async (ops: ChecklistOp[]) => {
    setError(null)
    // Otimista: mostra na hora.
    setDoc((d) => {
      try {
        return applyChecklist(
          d ?? { competitionId: id, items: null, rev: 0, updatedAt: null, updatedBy: null },
          ops,
          m.schedmanager.you,
          new Date().toISOString(),
        )
      } catch {
        return d
      }
    })
    busy.current = true
    try {
      setDoc(await patchChecklist(ctx.token!, id, ops))
      return true
    } catch (e) {
      setError(e instanceof CspApiError && e.status === 401 ? m.errors.sessionExpired : t.syncError)
      void refresh()
      return false
    } finally {
      busy.current = false
    }
  }

  const toggle = (item: ChecklistItem) => {
    const ops: ChecklistOp[] = []
    // Primeira marcação: grava o modelo (no idioma de quem marcou).
    if (!doc?.items) ops.push({ op: 'set', items: fallback })
    ops.push({ op: 'check', id: item.id, done: !item.done })
    void send(ops)
  }

  const saveEdit = async () => {
    if (!editing) return
    const clean = editing.filter((i) => i.text.trim())
    if (await send([{ op: 'set', items: clean }])) setEditing(null)
  }

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(tag, { day: '2-digit', month: '2-digit' }).format(new Date(`${d}T12:00:00Z`))
  const fmtWhen = (iso: string) =>
    new Intl.DateTimeFormat(tag, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

  if (!doc && !error) return <Spinner label={m.common.loading} />

  const sum = summary(items, days, today)

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PHASES.map((p) => (
            <a key={p} href={`#${p}`} className="chip border-border-subtle text-xs">
              {t.phases[p]} · {t.progress(sum[p].done, sum[p].total)}
              {sum[p].overdue > 0 && <span className="ml-1 text-accent-red">· {t.overdue(sum[p].overdue)}</span>}
            </a>
          ))}
        </div>
        {!editing ? (
          <button type="button" className="btn-ghost" onClick={() => setEditing(structuredClone(items))}>
            {t.edit}
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
              {t.cancel}
            </button>
            <button type="button" className="btn-primary" onClick={saveEdit}>
              {t.save}
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="card flex flex-wrap gap-2 p-4 text-sm">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => window.confirm(t.resetConfirm) && setEditing(withDone(fallback, items))}
          >
            {t.resetDefault}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (saveMyTemplate(editing)) setNotice(t.savedMine)
            }}
          >
            {t.saveMine}
          </button>
          {loadMyTemplate() && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                const mine = loadMyTemplate()
                if (mine && window.confirm(t.useMineConfirm)) setEditing(withDone(mine, items))
              }}
            >
              {t.useMine}
            </button>
          )}
          <p className="w-full text-xs text-fg-faint">{t.dueHint}</p>
        </div>
      )}

      {PHASES.map((phase) => (
        <section key={phase} id={phase} className="card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold">{t.phases[phase]}</h2>
            <span className="text-xs text-fg-muted">{t.progress(sum[phase].done, sum[phase].total)}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand-600 transition-all dark:bg-brand-500"
              style={{ width: `${sum[phase].total ? (100 * sum[phase].done) / sum[phase].total : 0}%` }}
            />
          </div>
          {editing ? (
            <EditList phase={phase} items={editing} onChange={setEditing} />
          ) : (
            <ul className="mt-4 space-y-1">
              {items
                .filter((i) => i.phase === phase)
                .map((i) => {
                  const st = statusOf(i, days, today)
                  const d = dueDate(i, days)
                  return (
                    <li key={i.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                          checked={!!i.done}
                          onChange={() => toggle(i)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className={`text-sm ${i.done ? 'text-fg-faint line-through' : ''}`}>
                            {i.text}
                            {i.required && <span className="ml-1 text-accent-red" title={t.required}>*</span>}
                          </span>
                          <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                            {i.owner && <span>{i.owner}</span>}
                            {d && !i.done && (
                              <span className={st === 'overdue' ? 'font-medium text-accent-red' : st === 'today' ? 'font-medium text-amber-600 dark:text-amber-300' : ''}>
                                {st === 'today' ? t.dueToday : t.dueOn(fmtDate(d))}
                                {st === 'overdue' && ` · ${t.overdueTag}`}
                              </span>
                            )}
                            {i.auto && auto[i.auto] && !i.done && (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                ✓ {i.auto === 'groups' ? t.autoGroups : t.autoResults}
                              </span>
                            )}
                            {i.done && <span className="text-fg-faint">{t.doneBy(i.done.by, fmtWhen(i.done.at))}</span>}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
            </ul>
          )}
        </section>
      ))}

      <p className="text-xs text-fg-faint">{t.emailSoon}</p>
    </div>
  )
}

function EditList({
  phase,
  items,
  onChange,
}: {
  phase: ChecklistPhase
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
}) {
  const { m } = useI18n()
  const t = m.repcheck
  const set = (id: string, patch: Partial<ChecklistItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const inp = 'rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-sm'
  return (
    <div className="mt-4 space-y-3">
      {items
        .filter((i) => i.phase === phase)
        .map((i) => (
          <div key={i.id} className="rounded-lg border border-border-subtle p-3">
            <input
              type="text"
              value={i.text}
              maxLength={300}
              placeholder={t.textPlaceholder}
              onChange={(e) => set(i.id, { text: e.target.value })}
              className={`${inp} w-full`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
              <input
                type="text"
                value={i.owner ?? ''}
                maxLength={80}
                placeholder={t.ownerPlaceholder}
                onChange={(e) => set(i.id, { owner: e.target.value || undefined })}
                className={`${inp} w-40`}
              />
              <label className="flex items-center gap-1.5">
                {t.dueLabel}
                <input
                  type="number"
                  min={-365}
                  max={365}
                  value={i.due ?? ''}
                  onChange={(e) => set(i.id, { due: e.target.value === '' ? undefined : Math.round(Number(e.target.value)) })}
                  className={`${inp} w-20`}
                />
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={!!i.required}
                  onChange={(e) => set(i.id, { required: e.target.checked || undefined })}
                />
                {t.required}
              </label>
              <button
                type="button"
                className="ml-auto text-accent-red hover:underline"
                onClick={() => onChange(items.filter((x) => x.id !== i.id))}
              >
                {t.remove}
              </button>
            </div>
          </div>
        ))}
      <button
        type="button"
        className="btn-ghost"
        onClick={() =>
          onChange([...items, { id: newItemId(items), phase, text: '', due: phase === 'after' ? 1 : phase === 'during' ? 0 : -1 }])
        }
      >
        + {t.addItem}
      </button>
    </div>
  )
}
