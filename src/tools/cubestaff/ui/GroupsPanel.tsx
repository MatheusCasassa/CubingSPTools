import { useMemo, useState } from 'react'
import { useI18n } from '../../../i18n/I18nProvider'
import { EventIcon } from '../../../components/ui/EventIcon'
import { eventName } from '../../../lib/wca/format'
import { lockKey, type GroupPlan, type Ref, type StaffRole } from '../model/types'
import { slotsByRound } from '../model/engine'
import { roundCompetitors } from '../model/people'
import type { Issue } from '../model/report'
import {
  addReserve,
  addStaff,
  candidates,
  clearRound,
  moveCompetitor,
  removeCompetitor,
  removeReserve,
  removeStaff,
  replaceWithReserve,
  toggleLock,
  unlockRound,
} from '../model/edits'
import { useCs } from './ctx'
import { BASE_EVENT } from '../model/scramblerRank'

const NXN_LABEL: Record<string, string> = { '333': '3x3', '444': '4x4', '555': '5x5' }
import { IconChevron, IconLock, IconPlus, Menu, MenuItem, Modal, Tag } from './primitives'

type Kind = 'competitor' | StaffRole | 'reserve'

// ------------------------------------------------------------- conferência

export function IssuesBox({ issues, onJump }: { issues: Issue[]; onJump?: (roundId: string) => void }) {
  const { m } = useI18n()
  const { person, where, roundLabel } = useCs()
  const t = m.cubestaff
  const [open, setOpen] = useState(false)
  const shown = issues.filter((i) => i.code !== 'notInList' || issues.length < 40)
  const errors = issues.filter((i) => i.level === 'error').length
  const warns = issues.filter((i) => i.level === 'warn').length
  const text = (i: Issue) => {
    const w = i.group ? where(i.roundId, i.group) : roundLabel(i.roundId)
    const who = i.ref ? person(i.ref).name : ''
    switch (i.code) {
      case 'conflict':
      case 'notApproved':
      case 'newcomerStaff':
      case 'delegateStaff':
      case 'unavailable':
      case 'otherDay':
      case 'notInList':
        return t.issue[i.code](who, w)
      case 'shortJudges':
      case 'shortScramblers':
      case 'shortRunners':
        return t.issue[i.code](w, i.count ?? 0, i.needed ?? 0)
      case 'tooManyTasks':
        return t.issue.tooManyTasks(who, i.count ?? 0, i.needed ?? 0)
      case 'emptyGroup':
        return t.issue.emptyGroup(w)
      case 'noSchedule':
        return t.issue.noSchedule(roundLabel(i.roundId))
    }
  }
  return (
    <section className={`card p-4 ${errors ? 'border-accent-red/40' : warns ? 'border-accent-yellow/40' : ''}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {t.issues}
          {errors > 0 && <Tag tone="danger">{errors}</Tag>}
          {warns > 0 && <Tag tone="warn">{warns}</Tag>}
          {issues.length === 0 && <span className="text-xs font-normal text-fg-muted">{t.noIssues}</span>}
        </span>
        {issues.length > 0 && (
          <IconChevron className={`h-4 w-4 text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && issues.length > 0 && (
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-sm">
          {shown
            .slice()
            .sort((a, b) => ({ error: 0, warn: 1, info: 2 })[a.level] - { error: 0, warn: 1, info: 2 }[b.level])
            .map((i, k) => (
              <li key={k}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1 text-left hover:bg-surface-2"
                  onClick={() => onJump?.(i.roundId)}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i.level === 'error' ? 'bg-accent-red' : i.level === 'warn' ? 'bg-accent-yellow' : 'bg-brand-400'}`}
                  />
                  <span>{text(i)}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </section>
  )
}

// ------------------------------------------------------------- pessoa

function Chip({
  roundId,
  g,
  kind,
  ref_,
  groupCount,
  issueRefs,
  onReplace,
}: {
  roundId: string
  g: GroupPlan
  kind: Kind
  ref_: Ref
  groupCount: number
  issueRefs: Map<Ref, 'error' | 'warn' | 'info'>
  onReplace?: (kind: StaffRole, ref: Ref) => void
}) {
  const { m } = useI18n()
  const t = m.cubestaff
  const { s, plan, person } = useCs()
  const info = person(ref_)
  const key = lockKey(kind, ref_)
  const locked = g.locked.includes(key)
  const level = issueRefs.get(ref_)
  const id = Number(ref_.slice(1))
  return (
    <Menu
      button={(toggle) => (
        <button
          type="button"
          onClick={toggle}
          className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-left text-xs transition-colors hover:border-brand-500/60 ${
            level === 'error'
              ? 'border-accent-red/60 bg-accent-red/10'
              : level === 'warn'
                ? 'border-accent-yellow/60 bg-accent-yellow/10'
                : 'border-border-subtle bg-surface'
          }`}
          title={info.wcaId ?? undefined}
        >
          {locked && <IconLock className="h-3 w-3 shrink-0 text-brand-500" />}
          <span className="truncate">{info.name}</span>
          {info.newcomer && (
            <span className="rounded bg-accent-yellow/20 px-1 text-[9px] font-bold text-amber-800 dark:text-amber-200">
              N
            </span>
          )}
          {info.delegate && (
            <span className="rounded bg-brand-500/15 px-1 text-[9px] font-bold text-brand-700 dark:text-brand-300">
              D
            </span>
          )}
          {info.extra && <span className="rounded bg-surface-2 px-1 text-[9px] font-bold text-fg-muted">X</span>}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-3 pb-1 pt-2 text-xs text-fg-muted">
            {info.name} {info.wcaId && <span className="font-mono">· {info.wcaId}</span>}
          </div>
          {kind === 'competitor' && groupCount > 1 && (
            <>
              <div className="px-3 pt-1 text-[11px] uppercase tracking-wider text-fg-faint">{t.moveTo}</div>
              <div className="flex flex-wrap gap-1 px-2 py-1">
                {Array.from({ length: groupCount }, (_, i) => i + 1)
                  .filter((n) => n !== g.number)
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="chip border-border-subtle hover:bg-surface-2"
                      onClick={() => (s.commit(moveCompetitor(plan, roundId, id, n)), close())}
                    >
                      {n}
                    </button>
                  ))}
              </div>
            </>
          )}
          {kind === 'reserve' &&
            (['judge', 'scrambler', 'runner'] as StaffRole[]).map((r) => (
              <MenuItem
                key={r}
                onClick={() => (
                  s.commit(removeReserve(addStaff(plan, roundId, g.number, r, ref_), roundId, g.number, ref_)),
                  close()
                )}
              >
                → {t.roles[r]}
              </MenuItem>
            ))}
          {kind !== 'competitor' && kind !== 'reserve' && g.reserves.length > 0 && (
            <>
              <div className="px-3 pt-1 text-[11px] uppercase tracking-wider text-fg-faint">{t.replaceBy}</div>
              {g.reserves.map((r) => (
                <MenuItem
                  key={r}
                  onClick={() => (s.commit(replaceWithReserve(plan, roundId, g.number, kind, ref_, r)), close())}
                >
                  ↔ {person(r).name}
                </MenuItem>
              ))}
            </>
          )}
          {kind !== 'competitor' && kind !== 'reserve' && onReplace && (
            <MenuItem onClick={() => (onReplace(kind, ref_), close())}>↔ {t.replaceOther}</MenuItem>
          )}
          <MenuItem onClick={() => (s.commit(toggleLock(plan, roundId, g.number, key)), close())}>
            <IconLock /> {locked ? t.unlock : t.lock}
          </MenuItem>
          <MenuItem
            danger
            onClick={() => {
              const next =
                kind === 'competitor'
                  ? removeCompetitor(plan, roundId, id)
                  : kind === 'reserve'
                    ? removeReserve(plan, roundId, g.number, ref_)
                    : removeStaff(plan, roundId, g.number, kind, ref_)
              s.commit(next)
              close()
            }}
          >
            {t.remove}
          </MenuItem>
        </div>
      )}
    </Menu>
  )
}

// ------------------------------------------------------------- escolher pessoa

function Picker({
  roundId,
  group,
  kind,
  replace,
  onClose,
}: {
  roundId: string
  group: number
  kind: Kind
  /** Trocar esta pessoa (staff) por quem for escolhido. */
  replace?: Ref
  onClose: () => void
}) {
  const { m } = useI18n()
  const t = m.cubestaff
  const { s, wcif, plan, where, person } = useCs()
  const [q, setQ] = useState('')
  const list = useMemo(() => candidates(wcif, plan, roundId, group, kind), [wcif, plan, roundId, group, kind])
  const n = q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const shown = list
    .filter((c) => (kind === 'competitor' ? !c.extra && !c.competingHere : true))
    // Na troca, só quem está apto a fazer staff agora: livre no horário, não
    // compete neste grupo e (para juiz/embaralhador) não é novato.
    .filter((c) => !replace || (c.ref !== replace && !c.busy && !c.competingHere && !(c.newcomer && kind !== 'runner')))
    .filter(
      (c) =>
        !n ||
        c.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(n) ||
        (c.wcaId ?? '').toLowerCase().includes(n),
    )
    .slice(0, 80)
  const pick = (ref: Ref) => {
    const id = Number(ref.slice(1))
    if (replace && kind !== 'competitor' && kind !== 'reserve') {
      s.commit(addStaff(removeStaff(plan, roundId, group, kind, replace), roundId, group, kind, ref))
      onClose()
      return
    }
    const next =
      kind === 'competitor'
        ? moveCompetitor(plan, roundId, id, group)
        : kind === 'reserve'
          ? addReserve(plan, roundId, group, ref)
          : addStaff(plan, roundId, group, kind, ref)
    s.commit(next)
    onClose()
  }
  return (
    <Modal
      title={
        replace
          ? t.replaceTitle(person(replace).name, where(roundId, group))
          : t.pickerTitle(t.roles[kind], where(roundId, group))
      }
      onClose={onClose}
    >
      <input
        autoFocus
        className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        placeholder={t.search}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="mt-2 max-h-[55vh] overflow-y-auto">
        {shown.map((c) => (
          <li key={c.ref}>
            <button
              type="button"
              onClick={() => pick(c.ref)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 ${c.busy || (c.newcomer && kind !== 'competitor') ? 'opacity-55' : ''}`}
            >
              <span className="min-w-0">
                <span className="block truncate">{c.name}</span>
                <span className="font-mono text-[11px] text-fg-faint">{c.wcaId ?? ''}</span>
              </span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {c.competingHere && <Tag tone="danger">{t.competingHere}</Tag>}
                {c.busy && !c.competingHere && <Tag tone="danger">{t.busy}</Tag>}
                {c.roleHere && <Tag tone="brand">{t.roles[c.roleHere]}</Tag>}
                {!c.available && <Tag tone="warn">{t.unavailableTag}</Tag>}
                {c.otherDay && <Tag tone="warn">{t.otherDayTag}</Tag>}
                {c.newcomer && <Tag tone="warn">{t.tags.newcomer}</Tag>}
                {c.delegate && <Tag tone="brand">{t.tags.delegate}</Tag>}
                {c.extra && <Tag>{t.tags.extra}</Tag>}
                {!c.inList && !c.extra && kind !== 'competitor' && <Tag>{t.notInListTag}</Tag>}
                {kind !== 'competitor' && c.load > 0 && (
                  <span className="text-[11px] text-fg-faint">{t.tasks(c.load)}</span>
                )}
                {kind === 'scrambler' && c.scramble && !c.scramble.registered && (
                  <Tag tone="warn">{t.notRegisteredTag}</Tag>
                )}
                {kind === 'scrambler' && c.scramble && (
                  <span className="text-[11px] text-fg-muted">
                    {c.scramble.source === 'none'
                      ? t.rankNone
                      : c.scramble.source === 'event' && c.scramble.psych
                        ? t.rankPsych(c.scramble.psych)
                        : c.scramble.source === 'event'
                          ? t.rankEvent(Math.max(1, Math.round(c.scramble.pct * 100)))
                          : c.scramble.source === 'base'
                            ? t.rankBase(
                                NXN_LABEL[BASE_EVENT[roundId.split('-')[0]]] ?? '',
                                Math.max(1, Math.round(c.scramble.pct * 100)),
                              )
                            : t.rankSor(Math.max(1, Math.round(c.scramble.pct * 100)))}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

// ------------------------------------------------------------- grupo

function Section({
  title,
  kind,
  refs,
  roundId,
  g,
  groupCount,
  issueRefs,
  onAdd,
  onReplace,
  need,
  collapsible = false,
}: {
  title: string
  kind: Kind
  refs: Ref[]
  roundId: string
  g: GroupPlan
  groupCount: number
  issueRefs: Map<Ref, 'error' | 'warn' | 'info'>
  onAdd: () => void
  onReplace?: (kind: StaffRole, ref: Ref) => void
  need?: number
  collapsible?: boolean
}) {
  const { m, tag } = useI18n()
  const { person } = useCs()
  const [all, setAll] = useState(false)
  // Sempre em ordem alfabética na tela (a ordem do plano — estações — não muda).
  const sorted = [...refs].sort((a, b) => person(a).name.localeCompare(person(b).name, tag))
  const limit = collapsible && !all ? 10 : Infinity
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          {title}{' '}
          <span
            className={`font-mono ${need != null && refs.length < need ? 'text-amber-600 dark:text-amber-300' : 'text-fg-faint'}`}
          >
            {refs.length}
            {need != null ? `/${need}` : ''}
          </span>
        </span>
        <button
          type="button"
          className="rounded p-0.5 text-fg-faint hover:bg-surface-2 hover:text-brand-500"
          onClick={onAdd}
          aria-label={m.cubestaff.addTo(title)}
          title={m.cubestaff.addTo(title)}
        >
          <IconPlus />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {sorted.slice(0, limit).map((r) => (
          <Chip
            key={r}
            roundId={roundId}
            g={g}
            kind={kind}
            ref_={r}
            groupCount={groupCount}
            issueRefs={issueRefs}
            onReplace={onReplace}
          />
        ))}
        {sorted.length > limit && (
          <button
            type="button"
            className="text-xs text-brand-600 hover:underline dark:text-brand-300"
            onClick={() => setAll(true)}
          >
            {m.cubestaff.showAll(sorted.length)}
          </button>
        )}
        {collapsible && all && sorted.length > 10 && (
          <button
            type="button"
            className="text-xs text-brand-600 hover:underline dark:text-brand-300"
            onClick={() => setAll(false)}
          >
            {m.cubestaff.showLess}
          </button>
        )}
      </div>
    </div>
  )
}

function RoundBlock({
  roundId,
  issues,
  onGenerate,
}: {
  roundId: string
  issues: Issue[]
  onGenerate: (ids: string[]) => void
}) {
  const { m } = useI18n()
  const t = m.cubestaff
  const { s, wcif, plan, roundLabel, time } = useCs()
  const rp = plan.rounds[roundId]
  const sched = useMemo(() => slotsByRound(wcif, plan).get(roundId), [wcif, plan, roundId])
  const [picker, setPicker] = useState<{ group: number; kind: Kind; replace?: Ref } | null>(null)
  const known = roundCompetitors(wcif, roundId, new Set(plan.config.absent))
  const cfg = plan.config

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-semibold">
        <EventIcon eventId={roundId.split('-')[0]} className="h-5 w-5" />
        {roundLabel(roundId)}
        {plan.published.includes(roundId) && <Tag tone="ok">{t.statusRound.published}</Tag>}
      </h3>
      <Menu
        align="right"
        button={(toggle) => (
          <button type="button" className="btn-ghost btn-sm" onClick={toggle}>
            ⋯
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem disabled={known.source === 'unknown'} onClick={() => (onGenerate([roundId]), close())}>
              {rp ? t.regenerate : t.generate}
            </MenuItem>
            {rp && <MenuItem onClick={() => (s.commit(unlockRound(plan, roundId)), close())}>{t.unlockRound}</MenuItem>}
            {rp && (
              <MenuItem danger onClick={() => (s.commit(clearRound(plan, roundId)), close())}>
                {t.clearRound}
              </MenuItem>
            )}
          </>
        )}
      </Menu>
    </div>
  )

  if (!rp)
    return (
      <section className="card p-4">
        {header}
        <p className="mt-2 text-sm text-fg-faint">{known.source === 'unknown' ? t.waitingResults : t.noGroupsYet}</p>
      </section>
    )

  const issuesByGroup = new Map<number, Map<Ref, 'error' | 'warn' | 'info'>>()
  for (const i of issues) {
    if (i.roundId !== roundId || !i.ref) continue
    const mp = issuesByGroup.get(i.group) ?? new Map()
    if (mp.get(i.ref) !== 'error') mp.set(i.ref, i.level)
    issuesByGroup.set(i.group, mp)
  }
  const attempts = sched?.kind === 'attempts'

  return (
    <section className="card p-4" id={`round-${roundId}`}>
      {header}
      <div className={`mt-4 grid gap-3 ${rp.groups.length > 1 ? 'md:grid-cols-2 xl:grid-cols-3' : ''}`}>
        {rp.groups.map((g) => {
          const slot = sched?.slots.find((x) => x.number === g.number)
          const ir = issuesByGroup.get(g.number) ?? new Map()
          const stations = slot ? cfg.stationsByRoom[String(slot.roomId)] || cfg.stations : cfg.stations
          const size = g.competitors.length
          const common = {
            roundId,
            g,
            groupCount: rp.groups.length,
            issueRefs: ir,
            onReplace: (kind: StaffRole, ref: Ref) => setPicker({ group: g.number, kind, replace: ref }),
          }
          return (
            <div key={g.number} className="rounded-xl border border-border-subtle bg-surface-2/40 p-3">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{attempts ? t.rolesPlural.competitor : t.group(g.number)}</span>
                <span className="text-xs text-fg-muted">
                  {slot?.roomName && `${slot.roomName} · `}
                  {slot?.start != null && `${time(slot.start, true)}–${time(slot.end)}`}
                  {attempts && sched?.attempts.map((a) => time(a.start, true)).join(' · ')}
                </span>
              </div>
              <div className="space-y-3">
                {!attempts && (
                  <>
                    <Section
                      {...common}
                      title={t.rolesPlural.scrambler}
                      kind="scrambler"
                      refs={g.scramblers}
                      need={Math.max(1, Math.ceil(size / cfg.competitorsPerScrambler))}
                      onAdd={() => setPicker({ group: g.number, kind: 'scrambler' })}
                    />
                    <Section
                      {...common}
                      title={t.rolesPlural.judge}
                      kind="judge"
                      refs={g.judges}
                      need={Math.min(size, stations)}
                      onAdd={() => setPicker({ group: g.number, kind: 'judge' })}
                    />
                    {(cfg.runnersEnabled || g.runners.length > 0) && (
                      <Section
                        {...common}
                        title={t.rolesPlural.runner}
                        kind="runner"
                        refs={g.runners}
                        onAdd={() => setPicker({ group: g.number, kind: 'runner' })}
                      />
                    )}
                    <Section
                      {...common}
                      title={t.rolesPlural.reserve}
                      kind="reserve"
                      refs={g.reserves}
                      onAdd={() => setPicker({ group: g.number, kind: 'reserve' })}
                    />
                  </>
                )}
                <Section
                  {...common}
                  title={t.rolesPlural.competitor}
                  kind="competitor"
                  refs={g.competitors.map((id) => `p${id}`)}
                  collapsible
                  onAdd={() => setPicker({ group: g.number, kind: 'competitor' })}
                />
              </div>
            </div>
          )
        })}
      </div>
      {picker && (
        <Picker
          roundId={roundId}
          group={picker.group}
          kind={picker.kind}
          replace={picker.replace}
          onClose={() => setPicker(null)}
        />
      )}
    </section>
  )
}

export function GroupsPanel({ onGenerate }: { onGenerate: (ids: string[]) => void }) {
  const { m } = useI18n()
  const { s, wcif } = useCs()
  const [event, setEvent] = useState<string>('all')
  const events = wcif.events
  return (
    <div className="space-y-4">
      <IssuesBox
        issues={s.issues}
        onJump={(roundId) => {
          setEvent(roundId.split('-')[0])
          setTimeout(
            () => document.getElementById(`round-${roundId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            50,
          )
        }}
      />
      <div className="flex flex-wrap gap-2" role="tablist">
        <button
          type="button"
          className={`chip px-3 text-sm ${event === 'all' ? 'border-brand-500/60 bg-brand-500/10' : 'border-border-subtle'}`}
          onClick={() => setEvent('all')}
        >
          {m.cubestaff.allEvents}
        </button>
        {events.map((e) => (
          <button
            key={e.id}
            type="button"
            title={eventName(e.id)}
            className={`chip px-2 py-1.5 ${event === e.id ? 'border-brand-500/60 bg-brand-500/10' : 'border-border-subtle'}`}
            onClick={() => setEvent(e.id)}
          >
            <EventIcon eventId={e.id} className="h-6 w-6" />
          </button>
        ))}
      </div>
      {events
        .filter((e) => event === 'all' || e.id === event)
        .flatMap((e) =>
          e.rounds.map((r) => <RoundBlock key={r.id} roundId={r.id} issues={s.issues} onGenerate={onGenerate} />),
        )}
    </div>
  )
}
