import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../../../lib/auth/AuthContext'
import { fetchWcif } from '../../../lib/wca/api'
import type { Wcif } from '../../../lib/wca/types'
import { WcaLoginButton } from '../../../components/auth/WcaLoginButton'
import { Alert, Spinner } from '../../../components/ui/Feedback'
import { IconArrowLeft, IconDownload, IconEye, IconSpinner } from '../../../components/ui/icons'
import { demoWcif } from '../model/demo'
import { planRounds, buildRoundScorecards, type RoundPlan, type SortBy } from '../model/build'
import { planOutput, type OrderMode, type SplitMode, type RoundBatch } from '../model/output'
import { layoutFor, PAPERS, PAPER_IDS, type PaperId } from '../pdf/paper'
import type { RenderProgress } from '../pdf/core'
import { generateFiles, deliver, openInNewTab } from '../pdf/generate'
import { LogoPicker, loadLogo, saveLogo } from './LogoPicker'
import { EventIcon } from '../../../components/ui/EventIcon'
import type { Logo } from '../pdf/ScorecardDocument'

// ----------------------------------------------------------------- preferências
interface Prefs {
  paperId: PaperId
  order: OrderMode
  split: SplitMode
  sortBy: SortBy
  cutLines: boolean
}
const DEFAULT_PREFS: Prefs = { paperId: 'a4', order: 'natural', split: 'single', sortBy: 'name', cutLines: true }
const PREFS_KEY = 'scorecomps.prefs'

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }
  } catch {
    return DEFAULT_PREFS
  }
}

// ----------------------------------------------------------------- seleção
interface RoundSel {
  groups: string[]
  blank: number
}
type Selection = Record<string, RoundSel>

const isOn = (s?: RoundSel) => !!s && (s.groups.length > 0 || s.blank > 0)

function fullSel(p: RoundPlan): RoundSel {
  return { groups: p.groups.map((g) => g.key), blank: p.groups.length === 0 ? p.suggestedBlank : 0 }
}

// ----------------------------------------------------------------- componentes
function Seg<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; disabled?: boolean; title?: string }[]
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function RoundCard({
  plan,
  sel,
  onChange,
}: {
  plan: RoundPlan
  sel: RoundSel | undefined
  onChange: (s: RoundSel) => void
}) {
  const cur = sel ?? { groups: [], blank: 0 }
  const on = isOn(sel)
  const count = plan.groups.filter((g) => cur.groups.includes(g.key)).reduce((n, g) => n + g.competitors.length, 0) + cur.blank
  const { info } = plan

  const toggleRound = () => onChange(on ? { groups: [], blank: 0 } : fullSel(plan))
  const toggleGroup = (key: string) =>
    onChange({
      ...cur,
      groups: cur.groups.includes(key) ? cur.groups.filter((k) => k !== key) : [...cur.groups, key],
    })

  return (
    <div className={'card p-4 transition-colors ' + (on ? 'border-brand-500/50' : '')}>
      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={on} onChange={toggleRound} />
          <span className="font-medium">
            {info.label}
            <span className="ml-2 text-xs font-normal text-fg-faint">{formatLabel(plan)}</span>
          </span>
        </label>
        {on && <span className="font-mono text-xs text-fg-muted">{count}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
        {plan.groups.map((g) => {
          const active = cur.groups.includes(g.key)
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => toggleGroup(g.key)}
              aria-pressed={active}
              className={
                'chip ' +
                (active
                  ? 'border-brand-500 bg-brand-600/15 text-brand-700 dark:text-brand-300'
                  : 'border-border-subtle bg-surface-2 text-fg-muted hover:border-border-strong')
              }
            >
              {g.label}
              <span className="font-mono opacity-70">{g.competitors.length}</span>
            </button>
          )
        })}
        <label className="chip border-dashed border-border-strong text-fg-muted">
          Em branco
          <input
            type="number"
            min={0}
            max={500}
            value={cur.blank}
            onChange={(e) => onChange({ ...cur, blank: Math.max(0, Math.min(500, Number(e.target.value) || 0)) })}
            className="w-12 bg-transparent text-right font-mono text-fg outline-none"
            aria-label={`Súmulas em branco — ${info.eventName} ${info.label}`}
          />
        </label>
      </div>
      {!plan.fromGroups && plan.groups.length === 0 && (
        <p className="mt-2 pl-7 text-xs text-fg-faint">
          Rodada seguinte: os classificados só existem no dia. Sugestão: {plan.suggestedBlank} súmulas em branco.
        </p>
      )}
      {!plan.fromGroups && plan.groups.length > 0 && (
        <p className="mt-2 pl-7 text-xs text-fg-faint">
          Sem grupos na WCA: o campo Grupo sai em branco. Gere os grupos no CubeStaff, Groupifier ou Delegate
          Dashboard.
        </p>
      )}
    </div>
  )
}

type EventState = 'none' | 'some' | 'all'

function eventState(rounds: RoundPlan[], sel: Selection): EventState {
  const on = rounds.filter((p) => isOn(sel[p.info.roundId])).length
  return on === 0 ? 'none' : on === rounds.length ? 'all' : 'some'
}

/** Faixa de modalidades (como na WCA): clique marca/desmarca o evento inteiro. */
function EventStrip({
  events,
  sel,
  onToggle,
}: {
  events: { eventId: string; eventName: string; rounds: RoundPlan[] }[]
  sel: Selection
  onToggle: (eventId: string) => void
}) {
  return (
    <div className="card flex flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3">
      <span className="mr-2 text-sm font-semibold">Eventos</span>
      {events.map((ev) => {
        const st = eventState(ev.rounds, sel)
        return (
          <button
            key={ev.eventId}
            type="button"
            onClick={() => onToggle(ev.eventId)}
            aria-pressed={st === 'all'}
            title={`${st === 'none' ? 'Selecionar' : 'Desmarcar'} ${ev.eventName}`}
            className={
              'relative grid h-10 w-10 place-items-center rounded-lg transition-colors ' +
              (st === 'all'
                ? 'bg-brand-600/15 text-brand-600 dark:text-brand-300'
                : st === 'some'
                  ? 'text-fg hover:bg-surface-2'
                  : 'text-fg-muted hover:bg-surface-2 hover:text-fg')
            }
          >
            <EventIcon eventId={ev.eventId} className="h-6 w-6" />
            {st === 'some' && (
              <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-500" aria-hidden />
            )}
            <span className="sr-only">{ev.eventName}</span>
          </button>
        )
      })}
    </div>
  )
}

function formatLabel(p: RoundPlan): string {
  const r = p.info.round
  const fmt = { a: 'Média de 5', m: 'Média de 3', '3': 'Melhor de 3', '2': 'Melhor de 2', '1': 'Melhor de 1' }[r.format]
  return fmt ?? ''
}

// ----------------------------------------------------------------- página
export default function CompetitionPage() {
  const { competitionId = '' } = useParams()
  const location = useLocation()
  const { status, token } = useAuth()
  const isDemo = competitionId === 'demo'
  const [wcif, setWcif] = useState<Wcif | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [sel, setSel] = useState<Selection>({})
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [logo, setLogo] = useState<Logo | null>(null)
  const [busy, setBusy] = useState<null | 'download' | 'preview'>(null)
  const [progress, setProgress] = useState<RenderProgress | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  const name = wcif?.name ?? (location.state as { name?: string } | null)?.name ?? competitionId

  // ---- carrega o WCIF
  useEffect(() => {
    setError(null)
    if (isDemo) {
      setWcif(demoWcif())
      return
    }
    if (!token) return
    let active = true
    setWcif(null)
    fetchWcif(token.accessToken, competitionId)
      .then((w) => active && setWcif(w))
      .catch((e) =>
        active &&
        setError(
          e instanceof Error && 'status' in e && (e as { status: number }).status === 403
            ? 'Você não tem permissão para gerenciar esta competição na WCA.'
            : e instanceof Error
              ? e.message
              : 'Erro ao carregar a competição.',
        ),
      )
    return () => {
      active = false
    }
  }, [competitionId, isDemo, token])

  useEffect(() => setLogo(loadLogo(competitionId)), [competitionId])

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      /* sem armazenamento: só não lembra */
    }
  }, [prefs])

  const plans = useMemo(() => (wcif ? planRounds(wcif) : []), [wcif])
  const events = useMemo(() => {
    const out: { eventId: string; eventName: string; rounds: RoundPlan[] }[] = []
    for (const p of plans) {
      let e = out.find((x) => x.eventId === p.info.eventId)
      if (!e) out.push((e = { eventId: p.info.eventId, eventName: p.info.eventName, rounds: [] }))
      e.rounds.push(p)
    }
    return out
  }, [plans])

  const perPage = layoutFor(prefs.paperId).perPage
  const batches: RoundBatch[] = useMemo(() => {
    if (!wcif) return []
    return plans
      .filter((p) => isOn(sel[p.info.roundId]))
      .map((p) => ({
        roundId: p.info.roundId,
        models: buildRoundScorecards(
          wcif,
          p,
          { roundId: p.info.roundId, groupKeys: sel[p.info.roundId].groups, blank: sel[p.info.roundId].blank },
          prefs.sortBy,
        ),
      }))
  }, [wcif, plans, sel, prefs.sortBy])

  const files = useMemo(
    () =>
      planOutput(batches, {
        competitionId: wcif?.id ?? competitionId,
        paperId: prefs.paperId,
        order: perPage > 1 ? prefs.order : 'natural',
        split: prefs.split,
      }),
    [batches, wcif, competitionId, prefs.paperId, prefs.order, prefs.split, perPage],
  )
  const totalCards = files.reduce((n, f) => n + f.count, 0)
  const totalSheets = files.reduce((n, f) => n + f.slots.length / perPage, 0)

  // ---- geração
  const request = (fs = files) => ({
    files: fs,
    paperId: prefs.paperId,
    cutLines: prefs.cutLines,
    logo,
    title: `Súmulas — ${name}`,
  })

  const run = async (kind: 'download' | 'preview') => {
    if (!files.length) return
    setBusy(kind)
    setGenError(null)
    setProgress(null)
    try {
      if (kind === 'preview') {
        // Prévia: só a primeira folha do primeiro arquivo.
        const first = { ...files[0], slots: files[0].slots.slice(0, perPage), name: 'previa.pdf' }
        const [out] = await generateFiles(request([first]), setProgress)
        openInNewTab(out)
      } else {
        const out = await generateFiles(request(), setProgress)
        deliver(out, `sumulas-${(wcif?.id ?? competitionId).replace(/[^\w-]/g, '')}-${prefs.paperId}.zip`)
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  const toggleEvent = (eventId: string) => {
    const ev = events.find((e) => e.eventId === eventId)
    if (!ev) return
    const clear = eventState(ev.rounds, sel) !== 'none'
    setSel((prev) => {
      const next = { ...prev }
      for (const p of ev.rounds) next[p.info.roundId] = clear ? { groups: [], blank: 0 } : fullSel(p)
      return next
    })
  }

  const selectAll = () => setSel(Object.fromEntries(plans.map((p) => [p.info.roundId, fullSel(p)])))
  const selectFirstRounds = () =>
    setSel(Object.fromEntries(plans.filter((p) => p.info.roundNumber === 1).map((p) => [p.info.roundId, fullSel(p)])))
  const clearAll = () => setSel({})

  // ---- estados de carregamento / acesso
  if (!isDemo && status === 'loading') return <Spinner label="Verificando sessão…" />
  if (!isDemo && status !== 'authenticated') {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="text-2xl font-semibold">Entre com a sua conta WCA</h1>
          <p className="mt-3 text-fg-muted">É preciso estar logado como Delegado ou Organizador desta competição.</p>
          <div className="mt-8 flex justify-center">
            <WcaLoginButton />
          </div>
        </div>
      </div>
    )
  }

  const progressText =
    progress && progress.total > 1
      ? `Gerando ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…`
      : 'Gerando PDF…'

  return (
    <div className="container-page py-8 pb-32 lg:pb-12">
      <Link to="/scorecomps" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <IconArrowLeft className="h-3.5 w-3.5" />
        Competições
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          {isDemo && (
            <p className="mt-1 text-sm text-fg-muted">
              Competição fictícia para testar o ScoreComps — nenhum dado da WCA é usado.
            </p>
          )}
        </div>
        {wcif && (
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm" onClick={selectFirstRounds}>
              Só 1ªs rodadas
            </button>
            <button className="btn-ghost btn-sm" onClick={selectAll}>
              Selecionar tudo
            </button>
            <button className="btn-ghost btn-sm" onClick={clearAll}>
              Limpar
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}
      {!wcif && !error && <Spinner label="Carregando rodadas e grupos…" />}

      {wcif && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ------------------------------------------------ rodadas */}
          <div className="space-y-6">
            <EventStrip events={events} sel={sel} onToggle={toggleEvent} />
            {events.map((ev) => (
              <section key={ev.eventId} id={`evento-${ev.eventId}`} className="scroll-mt-24">
                <h2 className="mb-2.5 flex items-center gap-2.5 text-sm font-semibold uppercase tracking-wider text-fg-muted">
                  <EventIcon
                    eventId={ev.eventId}
                    className={'h-5 w-5 ' + (eventState(ev.rounds, sel) === 'none' ? '' : 'text-brand-500 dark:text-brand-300')}
                  />
                  {ev.eventName}
                </h2>
                <div className="space-y-2.5">
                  {ev.rounds.map((p) => (
                    <RoundCard
                      key={p.info.roundId}
                      plan={p}
                      sel={sel[p.info.roundId]}
                      onChange={(s) => setSel((prev) => ({ ...prev, [p.info.roundId]: s }))}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* ------------------------------------------------ opções */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card space-y-5 p-5">
              <div>
                <span className="label">Folha</span>
                <select
                  className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand-400"
                  value={prefs.paperId}
                  onChange={(e) => setPrefs({ ...prefs, paperId: e.target.value as PaperId })}
                >
                  {PAPER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {PAPERS[id].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="label">Ordem na folha</span>
                <Seg
                  value={perPage > 1 ? prefs.order : 'natural'}
                  onChange={(order) => setPrefs({ ...prefs, order })}
                  options={[
                    { value: 'natural', label: 'Natural' },
                    {
                      value: 'stack',
                      label: 'Corte e empilhe',
                      disabled: perPage === 1,
                      title: 'Corte o maço em 4 pilhas e empilhe: as súmulas ficam em ordem.',
                    },
                  ]}
                />
              </div>

              <div>
                <span className="label">Arquivos</span>
                <Seg
                  value={prefs.split}
                  onChange={(split) => setPrefs({ ...prefs, split })}
                  options={[
                    { value: 'single', label: 'Um PDF' },
                    { value: 'round', label: 'Por rodada' },
                    { value: 'group', label: 'Por grupo' },
                  ]}
                />
                {prefs.split !== 'single' && (
                  <p className="mt-1.5 text-xs text-fg-faint">Vários PDFs são baixados juntos num arquivo .zip.</p>
                )}
              </div>

              <div>
                <span className="label">Ordenar competidores por</span>
                <Seg
                  value={prefs.sortBy}
                  onChange={(sortBy) => setPrefs({ ...prefs, sortBy })}
                  options={[
                    { value: 'name', label: 'Nome' },
                    { value: 'id', label: 'ID' },
                  ]}
                />
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                <span>Linhas de corte tracejadas</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={prefs.cutLines}
                  disabled={perPage === 1}
                  onChange={(e) => setPrefs({ ...prefs, cutLines: e.target.checked })}
                />
              </label>

              <LogoPicker
                logo={logo}
                onChange={(l) => {
                  setLogo(l)
                  saveLogo(competitionId, l)
                }}
              />
            </div>

            {/* ação (fixa no rodapé em telas pequenas) */}
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-bg/90 backdrop-blur-md lg:static lg:mt-4 lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
              <div className="container-page flex items-center justify-between gap-3 py-3 lg:block lg:space-y-3 lg:px-0 lg:py-0">
                <p className="text-sm text-fg-muted">
                  <strong className="font-mono text-fg">{totalCards}</strong> súmula{totalCards === 1 ? '' : 's'} ·{' '}
                  <strong className="font-mono text-fg">{totalSheets}</strong> folha{totalSheets === 1 ? '' : 's'}
                  {files.length > 1 && <> · {files.length} PDFs</>}
                </p>
                <div className="flex gap-2 lg:grid lg:grid-cols-[auto_1fr]">
                  <button
                    className="btn-ghost"
                    disabled={!totalCards || !!busy}
                    onClick={() => run('preview')}
                    title="Abre a primeira folha numa nova aba"
                  >
                    {busy === 'preview' ? <IconSpinner /> : <IconEye />}
                    <span className="hidden sm:inline">Prévia</span>
                  </button>
                  <button className="btn-primary" disabled={!totalCards || !!busy} onClick={() => run('download')}>
                    {busy === 'download' ? <IconSpinner /> : <IconDownload />}
                    {busy === 'download' ? progressText : files.length > 1 ? 'Baixar .zip' : 'Baixar PDF'}
                  </button>
                </div>
              </div>
            </div>
            {genError && (
              <div className="mt-3">
                <Alert>Não foi possível gerar o PDF: {genError}</Alert>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
