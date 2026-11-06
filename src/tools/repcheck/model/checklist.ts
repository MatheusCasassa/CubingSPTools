// RepCheck — checklist da competição (antes, durante e depois).
//
// O modelo padrão mora aqui (ids e prazos) e os textos vêm do idioma de quem
// cria a lista. Ao primeiro clique, a lista é gravada no servidor do CSPTools e
// passa a ser a mesma para todo o staff (com os textos daquele momento).

import type { ChecklistItem, ChecklistPhase } from '../../../lib/csp/server'
import type { Wcif } from '../../../lib/wca/types'

export const PHASES: ChecklistPhase[] = ['before', 'during', 'after']

/** Modelo padrão: id → fase, prazo (dias) e se é obrigatório. */
export const DEFAULT_TEMPLATE: Omit<ChecklistItem, 'text'>[] = [
  { id: 'announce', phase: 'before', due: -30, required: true },
  { id: 'venue', phase: 'before', due: -7, required: true },
  { id: 'prizes', phase: 'before', due: -7 },
  { id: 'registrations', phase: 'before', due: -3, required: true },
  { id: 'groups', phase: 'before', due: -3, required: true, auto: 'groups' },
  { id: 'staff', phase: 'before', due: -2 },
  { id: 'scrambles', phase: 'before', due: -2, required: true },
  { id: 'passcodes', phase: 'before', due: -1 },
  { id: 'scorecards', phase: 'before', due: -1, required: true },
  { id: 'material', phase: 'before', due: -1, required: true },
  { id: 'judge-briefing', phase: 'during', due: 0, required: true },
  { id: 'newcomer-ids', phase: 'during', due: 0, required: true },
  { id: 'live-results', phase: 'during', due: 0, required: true },
  { id: 'real-times', phase: 'during', due: 0 },
  { id: 'incidents', phase: 'during', due: 0 },
  { id: 'scramble-safety', phase: 'during', due: 0, required: true },
  { id: 'awards', phase: 'during', due: 0 },
  { id: 'raffles', phase: 'during', due: 0 },
  { id: 'scorecards-collected', phase: 'during', due: 0, required: true },
  { id: 'results-submitted', phase: 'after', due: 2, required: true, auto: 'results' },
  { id: 'report', phase: 'after', due: 3, required: true },
  { id: 'material-returned', phase: 'after', due: 3 },
  { id: 'social', phase: 'after', due: 3 },
  { id: 'feedback', phase: 'after', due: 5 },
  { id: 'scorecards-archived', phase: 'after', due: 7 },
  { id: 'accounts', phase: 'after', due: 14 },
]

export type DefaultTexts = Record<string, string>

/** Modelo padrão com os textos de um idioma. */
export function defaultItems(texts: DefaultTexts): ChecklistItem[] {
  return DEFAULT_TEMPLATE.map((t) => ({ ...t, text: texts[t.id] ?? t.id }))
}

/** Primeiro e último dia da competição ("AAAA-MM-DD"). */
export function competitionDays(wcif: Wcif): { first: string; last: string } {
  const first = wcif.schedule.startDate ?? new Date().toISOString().slice(0, 10)
  const n = Math.max(1, wcif.schedule.numberOfDays ?? 1)
  return { first, last: addDays(first, n - 1) }
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
}

/** Data-limite do item: antes/durante contam do 1º dia; depois, do último. */
export function dueDate(item: ChecklistItem, days: { first: string; last: string }): string | null {
  if (item.due == null) return null
  return addDays(item.phase === 'after' ? days.last : days.first, item.due)
}

export type ItemStatus = 'done' | 'overdue' | 'today' | 'open'

export function statusOf(item: ChecklistItem, days: { first: string; last: string }, today: string): ItemStatus {
  if (item.done) return 'done'
  const d = dueDate(item, days)
  if (!d) return 'open'
  if (today > d) return 'overdue'
  if (today === d) return 'today'
  return 'open'
}

/** Grupos publicados na WCA (atividades de grupo no cronograma). */
export function groupsPublished(wcif: Wcif): boolean {
  const walk = (acts: { activityCode: string; childActivities?: unknown[] }[]): boolean =>
    acts.some(
      (a) =>
        /-g\d+/.test(a.activityCode) ||
        walk((a.childActivities ?? []) as { activityCode: string; childActivities?: unknown[] }[]),
    )
  return wcif.schedule.venues.some((v) => v.rooms.some((r) => walk(r.activities)))
}

/** Id novo e único para um item criado à mão. */
export function newItemId(items: ChecklistItem[]): string {
  let n = items.length + 1
  while (items.some((i) => i.id === `item-${n}`)) n++
  return `item-${n}`
}

/** Resumo por fase: feitos / total e atrasados. */
export function summary(items: ChecklistItem[], days: { first: string; last: string }, today: string) {
  const out = {} as Record<ChecklistPhase, { done: number; total: number; overdue: number }>
  for (const p of PHASES) out[p] = { done: 0, total: 0, overdue: 0 }
  for (const i of items) {
    const s = out[i.phase]
    s.total++
    const st = statusOf(i, days, today)
    if (st === 'done') s.done++
    if (st === 'overdue') s.overdue++
  }
  return out
}

// "Meu modelo" (neste navegador): a lista sem as marcações, para reaproveitar.
const MY_TEMPLATE_KEY = 'csp.repcheck.template'

export function saveMyTemplate(items: ChecklistItem[]): boolean {
  try {
    localStorage.setItem(MY_TEMPLATE_KEY, JSON.stringify(items.map(({ done: _d, ...rest }) => rest)))
    return true
  } catch {
    return false
  }
}

export function loadMyTemplate(): ChecklistItem[] | null {
  try {
    const raw = localStorage.getItem(MY_TEMPLATE_KEY)
    const list = raw ? (JSON.parse(raw) as ChecklistItem[]) : null
    return Array.isArray(list) && list.length > 0 ? list : null
  } catch {
    return null
  }
}
