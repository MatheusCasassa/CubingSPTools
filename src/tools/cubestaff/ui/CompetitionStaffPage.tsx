import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth/AuthContext'
import { WcaLoginButton } from '../../../components/auth/WcaLoginButton'
import { Alert, Spinner } from '../../../components/ui/Feedback'
import { IconArrowLeft, IconDownload, IconSpinner } from '../../../components/ui/icons'
import { Tabs } from '../../../components/ui/Tabs'
import { useI18n } from '../../../i18n/I18nProvider'
import { eventName } from '../../../lib/wca/format'
import { WcaApiError } from '../../../lib/wca/api'
import { buildWcif, diffAssignments, ExtensionTooLargeError } from '../model/publish'
import { pendingRounds, type Note } from '../model/engine'
import { roundCompetitors } from '../model/people'
import { hasRoundInSchedule } from '../model/schedule'
import { groupsCsv, peopleCsv, type ExportLabels } from '../model/exports'
import { PREVIEW_PARAM } from '../model/storage'
import { useCubeStaff } from './useCubeStaff'
import { CubeStaffProvider, useCs } from './ctx'
import { ConfigPanel } from './ConfigPanel'
import { StaffPanel } from './StaffPanel'
import { GroupsPanel } from './GroupsPanel'
import { PeoplePanel } from './PeoplePanel'
import { download, IconRedo, IconRefresh, IconSpark, IconUndo, Menu, MenuItem, Modal } from './primitives'

type Tab = 'config' | 'staff' | 'groups' | 'people'

function NotesBox({ notes, onClose }: { notes: Note[]; onClose: () => void }) {
  const { m } = useI18n()
  const { roundLabel, where } = useCs()
  const t = m.cubestaff
  const lines = notes
    .map((n) => {
      const r = n.roundId ? roundLabel(n.roundId) : ''
      switch (n.code) {
        case 'noStaffList':
          return t.notes.noStaffList
        case 'unknownCompetitors':
          return t.notes.unknownCompetitors(r)
        case 'competitorConflict':
          return t.notes.competitorConflict(r, n.count ?? 0)
        case 'delegatesUsed':
          return t.notes.delegatesUsed(n.count ?? 0)
        case 'locksDropped':
          return t.notes.locksDropped(r)
        case 'noSchedule':
          return t.issue.noSchedule(r)
        case 'shortJudges':
        case 'shortScramblers':
        case 'shortRunners':
          return t.issue[n.code](where(n.roundId!, n.group!), n.count ?? 0, n.needed ?? 0)
        default:
          return null
      }
    })
    .filter(Boolean) as string[]
  const generated = new Set(notes.map((n) => n.roundId).filter(Boolean)).size
  return (
    <Alert tone={lines.length ? 'warn' : 'info'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {lines.length === 0 ? (
            <span>{t.generated(generated || 1)}</span>
          ) : (
            <ul className="list-disc space-y-0.5 pl-4">
              {lines.slice(0, 8).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
              {lines.length > 8 && <li>… +{lines.length - 8}</li>}
            </ul>
          )}
        </div>
        <button type="button" className="text-xs underline" onClick={onClose}>
          {t.close}
        </button>
      </div>
    </Alert>
  )
}

function GenerateDialog({
  initial,
  onClose,
  onRun,
}: {
  initial?: string[]
  onClose: () => void
  onRun: (ids: string[]) => void
}) {
  const { m } = useI18n()
  const t = m.cubestaff
  const { wcif, plan, roundLabel } = useCs()
  const absent = new Set(plan.config.absent)
  const rounds = wcif.events
    .flatMap((e) => e.rounds.map((r) => r.id))
    .filter((id) => roundCompetitors(wcif, id, absent).source !== 'unknown')
  const [sel, setSel] = useState<Set<string>>(
    new Set(initial ?? rounds.filter((id) => id.endsWith('-r1') || !plan.rounds[id])),
  )
  return (
    <Modal
      title={t.generateTitle}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="btn-primary btn-sm" disabled={sel.size === 0} onClick={() => onRun([...sel])}>
            {t.generateRun(sel.size)}
          </button>
        </>
      }
    >
      <p className="text-sm text-fg-muted">{t.generateHint}</p>
      <div className="mt-3 flex gap-2">
        <button className="btn-ghost btn-sm" onClick={() => setSel(new Set(rounds))}>
          {m.scorecomps.selectAll}
        </button>
        <button className="btn-ghost btn-sm" onClick={() => setSel(new Set())}>
          {m.common.clear}
        </button>
      </div>
      <ul className="mt-3 space-y-1">
        {rounds.map((id) => (
          <li key={id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={sel.has(id)}
                onChange={(e) => {
                  const n = new Set(sel)
                  if (e.target.checked) n.add(id)
                  else n.delete(id)
                  setSel(n)
                }}
              />
              <span className="flex-1 text-sm">{roundLabel(id)}</span>
              {plan.rounds[id] && <span className="text-[11px] text-fg-faint">{t.regenerate}</span>}
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function UpdateDialog({ onClose, onRun }: { onClose: () => void; onRun: (ids: string[]) => void }) {
  const { m } = useI18n()
  const t = m.cubestaff
  const { s, roundLabel } = useCs()
  const [list, setList] = useState<ReturnType<typeof pendingRounds> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const refresh = s.refreshResults
  useEffect(() => {
    let active = true
    refresh()
      .then((l) => {
        if (!active) return
        setList(l)
        setSel(new Set(l.map((x) => x.roundId)))
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      active = false
    }
    // Busca uma vez ao abrir a janela.
  }, [])
  return (
    <Modal
      title={t.updateTitle}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="btn-primary btn-sm" disabled={sel.size === 0} onClick={() => onRun([...sel])}>
            {t.generateRun(sel.size)}
          </button>
        </>
      }
    >
      <p className="text-sm text-fg-muted">{t.updateHint}</p>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {!list && !error && <Spinner label={m.common.loading} />}
      {list && list.length === 0 && <p className="mt-4 text-sm">{t.updateNone}</p>}
      {list && list.length > 0 && (
        <ul className="mt-3 space-y-1">
          {list.map((x) => (
            <li key={x.roundId}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={sel.has(x.roundId)}
                  onChange={(e) => {
                    const n = new Set(sel)
                    if (e.target.checked) n.add(x.roundId)
                    else n.delete(x.roundId)
                    setSel(n)
                  }}
                />
                <span className="flex-1 text-sm">{roundLabel(x.roundId)}</span>
                <span className="text-[11px] text-fg-faint">
                  {x.count} · {t.updateFrom[x.source]}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function useErrorText() {
  const { m } = useI18n()
  return (e: unknown) =>
    e instanceof ExtensionTooLargeError
      ? m.cubestaff.tooLarge(Math.round(e.bytes / 1000))
      : e instanceof WcaApiError && e.status === 401
        ? m.errors.sessionExpired
        : m.cubestaff.saveError(e instanceof Error ? e.message : String(e))
}

function PublishDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { m } = useI18n()
  const t = m.cubestaff
  const { s, wcif, plan, roundLabel } = useCs()
  const rounds = Object.keys(plan.rounds).filter((id) => hasRoundInSchedule(wcif, id))
  const [sel, setSel] = useState<Set<string>>(new Set(rounds))
  const [error, setError] = useState<string | null>(null)
  const diffs = useMemo(() => {
    const built = buildWcif(wcif, plan, rounds, false)
    return new Map(diffAssignments(wcif, built.wcif).map((d) => [d.roundId, d]))
  }, [wcif, plan])
  const errors = s.issues.filter((i) => i.level === 'error').length
  const errorText = useErrorText()
  const go = async () => {
    setError(null)
    try {
      const ok = await s.publish([...sel])
      onClose()
      if (ok) onDone()
    } catch (e) {
      setError(errorText(e))
    }
  }
  return (
    <Modal
      title={t.saveTitle}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            {t.cancel}
          </button>
          <button className="btn-primary btn-sm" disabled={sel.size === 0 || s.saving != null || s.isDemo} onClick={go}>
            {s.saving === 'publish' ? <IconSpinner /> : null}
            {s.saving === 'publish' ? t.saving : t.publish}
          </button>
        </>
      }
    >
      <p className="text-sm text-fg-muted">{t.saveHint}</p>
      {s.isDemo && (
        <div className="mt-3">
          <Alert tone="info">{t.demoReadonly}</Alert>
        </div>
      )}
      {errors > 0 && (
        <div className="mt-3">
          <Alert tone="warn">{t.saveErrors(errors)}</Alert>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <h3 className="label mt-4">{t.saveRounds}</h3>
      <ul className="space-y-1">
        {rounds.map((id) => {
          const d = diffs.get(id)
          return (
            <li key={id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={sel.has(id)}
                  onChange={(e) => {
                    const n = new Set(sel)
                    if (e.target.checked) n.add(id)
                    else n.delete(id)
                    setSel(n)
                  }}
                />
                <span className="flex-1 text-sm">{roundLabel(id)}</span>
                <span className={`font-mono text-[11px] ${d ? 'text-fg' : 'text-fg-faint'}`}>
                  {d ? t.saveDiff(d.added, d.removed) : t.saveNoChanges}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs text-fg-faint">{t.savePublic}</p>
    </Modal>
  )
}

function ResetDialog({ onClose, onDone }: { onClose: () => void; onDone: (wca: boolean) => void }) {
  const { m } = useI18n()
  const t = m.cubestaff
  const { s, plan } = useCs()
  const onWca = !s.isDemo && (plan.published.length > 0 || s.remoteSavedAt != null)
  const [wca, setWca] = useState(onWca)
  const [error, setError] = useState<string | null>(null)
  const errorText = useErrorText()
  const go = async () => {
    setError(null)
    try {
      if (await s.resetAll(wca)) {
        onClose()
        onDone(wca)
      }
    } catch (e) {
      setError(errorText(e))
    }
  }
  return (
    <Modal
      title={t.resetTitle}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            {t.cancel}
          </button>
          <button
            className="btn btn-sm bg-accent-red text-white hover:bg-red-700"
            disabled={s.saving != null}
            onClick={go}
          >
            {s.saving === 'reset' && <IconSpinner />}
            {wca ? t.resetConfirmWca : t.resetConfirm}
          </button>
        </>
      }
    >
      <p className="text-sm">{t.resetText}</p>
      {!s.isDemo && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border-subtle p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand-600"
            checked={wca}
            onChange={(e) => setWca(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium">{t.resetWca}</span>
            <span className="mt-0.5 block text-xs text-fg-muted">{t.resetWcaHint}</span>
          </span>
        </label>
      )}
      {wca ? (
        <div className="mt-3">
          <Alert tone="warn">{t.resetWcaWarn}</Alert>
        </div>
      ) : (
        <p className="mt-3 text-xs text-fg-muted">{t.resetLocalHint}</p>
      )}
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </Modal>
  )
}

function Workspace() {
  const { m, lp, locale } = useI18n()
  const t = m.cubestaff
  const { s, wcif, plan, tz } = useCs()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>(
    Object.keys(plan.rounds).length > 0 ? 'groups' : plan.staff.length > 0 ? 'config' : 'staff',
  )
  const [dialog, setDialog] = useState<
    null | { kind: 'generate'; initial?: string[] } | { kind: 'update' } | { kind: 'publish' } | { kind: 'reset' }
  >(null)
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const errorText = useErrorText()

  const runGenerate = (ids: string[]) => {
    s.run(ids)
    setDialog(null)
    setTab('groups')
  }

  const labels: ExportLabels = {
    ...t.csv,
    roles: t.roles,
    roundName: (ev, n, total) => t.roundName(eventName(ev), n, total),
  }
  const delim = locale === 'en' ? ',' : ';'
  const fileBase = `cubestaff-${wcif.id}`

  const saveDraft = async () => {
    setMsg(null)
    try {
      if (await s.saveRemoteDraft()) setMsg({ tone: 'info', text: t.savedDraft })
    } catch (e) {
      setMsg({ tone: 'error', text: errorText(e) })
    }
  }

  const fmtStamp = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : locale, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    }).format(new Date(iso))

  const status = s.dirty
    ? s.localSavedAt
      ? t.statusLocal(fmtStamp(s.localSavedAt))
      : t.unsaved
    : s.remoteSavedAt
      ? t.statusRemote(s.baseRevision, fmtStamp(s.remoteSavedAt))
      : t.statusNever

  return (
    <>
      {/* barra de ações */}
      <div className="sticky top-16 z-20 -mx-4 mt-6 border-y border-border-subtle bg-bg/90 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary btn-sm" onClick={() => setDialog({ kind: 'generate' })}>
            <IconSpark className="h-3.5 w-3.5" /> {t.generate}
          </button>
          <button
            className="btn-ghost btn-sm"
            onClick={() => setDialog({ kind: 'update' })}
            disabled={s.saving === 'refresh'}
            title={t.updateRounds}
            aria-label={t.updateRounds}
          >
            <IconRefresh className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.updateRounds}</span>
          </button>
          <span className="mx-1 hidden h-5 w-px bg-border-subtle sm:block" />
          <button
            className="btn-ghost btn-sm px-2"
            onClick={s.undo}
            disabled={!s.canUndo}
            title={t.undo}
            aria-label={t.undo}
          >
            <IconUndo className="h-3.5 w-3.5" />
          </button>
          <button
            className="btn-ghost btn-sm px-2"
            onClick={s.redo}
            disabled={!s.canRedo}
            title={t.redo}
            aria-label={t.redo}
          >
            <IconRedo className="h-3.5 w-3.5" />
          </button>
          <Menu
            button={(toggle) => (
              <button
                className="btn-ghost btn-sm"
                onClick={toggle}
                disabled={Object.keys(plan.rounds).length === 0}
                title={t.download}
                aria-label={t.download}
              >
                <IconDownload className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.download}</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  onClick={() => (download(`${fileBase}-grupos.csv`, groupsCsv(wcif, plan, labels, delim)), close())}
                >
                  {t.downloadGroups}
                </MenuItem>
                <MenuItem
                  onClick={() => (download(`${fileBase}-pessoas.csv`, peopleCsv(wcif, plan, labels, delim)), close())}
                >
                  {t.downloadPeople}
                </MenuItem>
              </>
            )}
          </Menu>
          <button
            className="btn-ghost btn-sm"
            title={t.scorecardsTitle}
            disabled={Object.keys(plan.rounds).length === 0}
            onClick={() => {
              const id = s.preparePreview()
              if (id) navigate(`${lp(`/scorecomps/${encodeURIComponent(id)}`)}?fonte=${PREVIEW_PARAM}`)
            }}
          >
            <span className="hidden md:inline">{t.scorecards}</span>
            <span className="md:hidden">PDF</span>
          </button>
          <button
            className="btn-ghost btn-sm text-red-600 hover:text-red-700 dark:text-red-300"
            title={t.resetTitle}
            onClick={() => setDialog({ kind: 'reset' })}
          >
            {t.resetAll}
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span
              className={`hidden text-xs lg:inline ${s.dirty ? 'text-amber-700 dark:text-amber-300' : 'text-fg-faint'}`}
            >
              {status}
            </span>
            <button
              className="btn-ghost btn-sm"
              onClick={saveDraft}
              disabled={s.isDemo || s.saving != null}
              title={t.saveDraftTitle}
            >
              {s.saving === 'draft' && <IconSpinner />}
              {t.saveDraft}
            </button>
            <button
              className="btn-primary btn-sm"
              onClick={() => setDialog({ kind: 'publish' })}
              disabled={Object.keys(plan.rounds).length === 0}
            >
              {t.publish}
            </button>
          </div>
        </div>
        <p className={`mt-1.5 text-xs lg:hidden ${s.dirty ? 'text-amber-700 dark:text-amber-300' : 'text-fg-faint'}`}>
          {status}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {s.pendingDraft && (
          <Alert tone="info">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                <strong>{t.restoreTitle}.</strong> {t.restoreText(fmtStamp(s.pendingDraft.savedAt))}
              </span>
              <span className="flex gap-2">
                <button className="btn-primary btn-sm" onClick={() => s.restoreDraft(true)}>
                  {t.restoreYes}
                </button>
                <button className="btn-ghost btn-sm" onClick={() => s.restoreDraft(false)}>
                  {t.restoreNo}
                </button>
              </span>
            </div>
          </Alert>
        )}
        {s.from === 'wcif' && !s.dirty && <Alert tone="info">{t.fromWcif}</Alert>}
        {s.outside.length > 0 && (
          <Alert tone="warn">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{t.changedOutside(s.outside.length)}</span>
              <button className="btn-ghost btn-sm" onClick={s.importOutside}>
                {t.changedOutsideImport}
              </button>
            </div>
          </Alert>
        )}
        {msg && <Alert tone={msg.tone === 'error' ? 'error' : 'info'}>{msg.text}</Alert>}
        {s.lastNotes.length > 0 && <NotesBox notes={s.lastNotes} onClose={s.clearNotes} />}
      </div>

      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          label="CubeStaff"
          tabs={[
            { value: 'config', label: t.tabs.config },
            { value: 'staff', label: `${t.tabs.staff} (${plan.staff.length})` },
            { value: 'groups', label: t.tabs.groups },
            { value: 'people', label: t.tabs.people },
          ]}
        />
      </div>
      <div className="mt-6">
        {tab === 'config' && <ConfigPanel />}
        {tab === 'staff' && <StaffPanel />}
        {tab === 'groups' && <GroupsPanel onGenerate={(ids) => setDialog({ kind: 'generate', initial: ids })} />}
        {tab === 'people' && <PeoplePanel />}
      </div>

      {dialog?.kind === 'generate' && (
        <GenerateDialog initial={dialog.initial} onClose={() => setDialog(null)} onRun={runGenerate} />
      )}
      {dialog?.kind === 'update' && <UpdateDialog onClose={() => setDialog(null)} onRun={runGenerate} />}
      {dialog?.kind === 'reset' && (
        <ResetDialog
          onClose={() => setDialog(null)}
          onDone={(wca) => {
            setMsg({ tone: 'info', text: wca ? t.resetDoneWca : t.resetDone })
            setTab('staff')
          }}
        />
      )}
      {dialog?.kind === 'publish' && (
        <PublishDialog onClose={() => setDialog(null)} onDone={() => setMsg({ tone: 'info', text: t.saved })} />
      )}
      {s.conflict && (
        <Modal
          title={t.conflictTitle}
          onClose={s.dismissConflict}
          footer={
            <>
              <button className="btn-ghost btn-sm" onClick={s.acceptRemote}>
                {t.conflictReload}
              </button>
              <button className="btn-primary btn-sm" onClick={() => void s.conflict!.retry()}>
                {t.conflictOverwrite}
              </button>
            </>
          }
        >
          <p className="text-sm">{t.conflictText(s.conflict.who, fmtStamp(s.conflict.at))}</p>
        </Modal>
      )}
    </>
  )
}

export default function CompetitionStaffPage() {
  const { competitionId = '' } = useParams()
  const location = useLocation()
  const { status, token, me } = useAuth()
  const { m, lp } = useI18n()
  const t = m.cubestaff
  const isDemo = competitionId === 'demo'
  const s = useCubeStaff(competitionId, token?.accessToken ?? null, me?.name)
  const name = s.wcif?.name ?? (location.state as { name?: string } | null)?.name ?? competitionId

  if (!isDemo && status === 'loading') return <Spinner label={m.common.checkingSession} />
  if (!isDemo && status !== 'authenticated')
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="text-2xl font-semibold">{m.scorecomps.signInTitle}</h1>
          <p className="mt-3 text-fg-muted">{m.scorecomps.signInText}</p>
          <div className="mt-8 flex justify-center">
            <WcaLoginButton />
          </div>
        </div>
      </div>
    )

  return (
    <div className="container-page py-8 pb-24">
      <Link to={lp('/cubestaff')} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <IconArrowLeft className="h-3.5 w-3.5" />
        {m.scorecomps.competitions}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{name}</h1>
      {isDemo && <p className="mt-1 text-sm text-fg-muted">{t.demoNote}</p>}
      <Link
        to={lp('/cubestaff/manual')}
        className="mt-1 inline-block text-sm text-brand-600 hover:underline dark:text-brand-300"
      >
        {t.manualLink}
      </Link>
      {s.state === 'loading' && <Spinner label={t.loading} />}
      {s.state === 'error' && (
        <div className="mt-6">
          <Alert>{m.errors[(s.error ?? 'loadCompetition') as 'loadCompetition']}</Alert>
        </div>
      )}
      {s.state === 'ready' && s.wcif && s.plan && (
        <CubeStaffProvider s={s}>
          <Workspace />
        </CubeStaffProvider>
      )}
    </div>
  )
}
