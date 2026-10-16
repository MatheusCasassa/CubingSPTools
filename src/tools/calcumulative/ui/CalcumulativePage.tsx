import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs } from '../../../components/ui/Tabs'
import { CalcumulativeMark } from '../../../components/ui/icons'
import { TimeInput } from './TimeInput'
import { PenaltyToggle } from './PenaltyToggle'
import { digitsToCentis, formatDuration, formatResult, type Penalty } from '../model/time'
import { computeCumulative, type AttemptOutcome } from '../model/cumulative'
import { computeAverage, neededForTarget } from '../model/average'
import { useI18n } from '../../../i18n/I18nProvider'
import type { Messages } from '../../../i18n/messages/pt'

interface Row {
  digits: string
  penalty: Penalty
}
const emptyRows = (n: number): Row[] => Array.from({ length: n }, () => ({ digits: '', penalty: 'ok' }))

type Mode = 'cumulativo' | 'media'

// ------------------------------------------------------------------ peças
function Stat({
  label,
  value,
  hint,
  tone = 'default',
  big = false,
}: {
  label: string
  value: string
  hint?: ReactNode
  tone?: 'default' | 'good' | 'bad' | 'brand'
  big?: boolean
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'bad'
        ? 'text-accent-red'
        : tone === 'brand'
          ? 'text-brand-600 dark:text-brand-300'
          : 'text-fg'
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2/60 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-fg-muted">{label}</div>
      <div className={`mt-1 font-mono font-semibold tabular-nums ${big ? 'text-3xl' : 'text-xl'} ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-fg-faint">{hint}</span>}
    </label>
  )
}

const fmtAvg = (v: number | null) => (v == null ? '—' : Number.isFinite(v) ? formatResult(v) : 'DNF')

// ------------------------------------------------------------------ cumulativo
function statusBadge(o: AttemptOutcome, m: Messages) {
  switch (o.status) {
    case 'ok':
      return <span className="text-emerald-600 dark:text-emerald-400">{formatResult(o.result!)}</span>
    case 'dnf':
      return <span className="text-accent-red">DNF ({formatResult(o.elapsed!)})</span>
    case 'dnf-limit':
      return (
        <span className="text-accent-red" title={m.calc.limitReachedTitle}>
          DNF ({formatResult(o.elapsed!)}) · {m.calc.limitTag}
        </span>
      )
    case 'dns':
      return <span className="text-fg-faint">DNS</span>
    default:
      return o.limit != null ? <span className="text-fg-muted">{m.calc.upTo(formatDuration(o.limit))}</span> : null
  }
}

function CumulativeCalc() {
  const { m } = useI18n()
  const [count, setCount] = useState(5)
  const [limitDigits, setLimitDigits] = useState('')
  const [perDigits, setPerDigits] = useState('')
  const [rows, setRows] = useState<Row[]>(emptyRows(5))

  const limit = digitsToCentis(limitDigits)
  const perAttempt = digitsToCentis(perDigits)
  const out = useMemo(
    () =>
      computeCumulative(
        rows.slice(0, count).map((r) => ({ cs: digitsToCentis(r.digits), penalty: r.penalty })),
        limit,
        perAttempt,
      ),
    [rows, count, limit, perAttempt],
  )

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const changeCount = (n: number) => {
    setCount(n)
    setRows((prev) => (prev.length >= n ? prev : [...prev, ...emptyRows(n - prev.length)]))
  }
  const reset = () => {
    setLimitDigits('')
    setPerDigits('')
    setRows(emptyRows(5))
  }

  const pct = limit ? Math.min(100, (out.used / limit) * 100) : 0
  const next = out.attempts.find((a) => a.status === 'pending')
  const barColor = pct >= 100 ? 'bg-accent-red' : pct >= 80 ? 'bg-accent-yellow' : 'bg-brand-500'

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="card space-y-6 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={m.calc.cumulativeLimit} hint={m.calc.cumulativeLimitHint}>
            <TimeInput digits={limitDigits} onChange={setLimitDigits} label={m.calc.cumulativeLimit} placeholder="0:00.00" />
          </Field>
          <Field label={m.calc.perAttemptLimit} hint={m.calc.perAttemptLimitHint}>
            <TimeInput digits={perDigits} onChange={setPerDigits} label={m.calc.perAttemptLimitShort} placeholder="—" />
          </Field>
        </div>

        <div>
          <span className="label">{m.calc.attempts}</span>
          <div className="seg max-w-xs">
            {[
              { n: 5, label: '5' },
              { n: 3, label: '3' },
              { n: 2, label: '2' },
              { n: 1, label: '1' },
            ].map((o) => (
              <button key={o.n} type="button" aria-pressed={count === o.n} onClick={() => changeCount(o.n)}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-fg-faint">{m.calc.attemptsHint}</p>
        </div>

        <ol className="space-y-2.5">
          {out.attempts.map((o, i) => {
            const dns = o.status === 'dns'
            return (
              <li key={i} className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <span className="w-8 shrink-0 text-center font-mono text-lg font-semibold text-fg-muted">{i + 1}</span>
                <div className="min-w-[120px] flex-1">
                  <TimeInput
                    digits={dns ? '' : rows[i].digits}
                    onChange={(d) => setRow(i, { digits: d })}
                    label={m.calc.attempt(i + 1)}
                    disabled={dns}
                    invalid={o.status === 'dnf-limit'}
                  />
                </div>
                <PenaltyToggle
                  value={rows[i].penalty}
                  onChange={(p) => setRow(i, { penalty: p })}
                  disabled={dns}
                  label={m.calc.attemptPenalty(i + 1)}
                />
                <span className="w-full text-right font-mono text-xs tabular-nums sm:w-40">{statusBadge(o, m)}</span>
              </li>
            )
          })}
        </ol>

        <p className="text-xs leading-relaxed text-fg-faint">{m.calc.rulesNote}</p>
      </div>

      <aside className="order-first space-y-3 lg:sticky lg:top-24 lg:order-none lg:self-start">
        <div className="card space-y-3 p-5">
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-fg-muted">
              <span>{m.calc.used}</span>
              <span>{limit ? `${Math.floor(pct)}%` : m.calc.setLimit}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <Stat label={m.calc.timeUsed} value={formatDuration(out.used)} />
          <Stat
            label={m.calc.timeLeft}
            value={limit ? formatDuration(out.remaining) : '—'}
            tone={limit && out.remaining === 0 ? 'bad' : 'brand'}
            big
            hint={out.reached ? m.calc.reached : undefined}
          />
          {next && next.limit != null && (
            <Stat
              label={m.calc.nextLimit}
              value={formatDuration(next.limit)}
              hint={perAttempt && next.limit === perAttempt ? m.calc.nextLimitPer : m.calc.nextLimitCum}
            />
          )}
          <button type="button" className="btn-ghost w-full" onClick={reset}>
            {m.common.clear}
          </button>
        </div>
      </aside>
    </div>
  )
}

// ------------------------------------------------------------------ média
function AverageCalc() {
  const { m } = useI18n()
  const [rows, setRows] = useState<Row[]>(emptyRows(5))
  const [targetDigits, setTargetDigits] = useState('')
  const out = useMemo(
    () => computeAverage(rows.map((r) => ({ cs: digitsToCentis(r.digits), penalty: r.penalty }))),
    [rows],
  )
  const target = digitsToCentis(targetDigits)
  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  const four = out.count === 4 ? (out.values.filter((v) => v != null) as number[]) : null
  const need = four && target ? neededForTarget(four, target) : null
  const fifthIndex = out.count === 4 ? out.values.findIndex((v) => v == null) : -1

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="card space-y-6 p-5 sm:p-6">
        <ol className="space-y-2.5">
          {rows.map((r, i) => {
            const v = out.values[i]
            const dropped = out.dropped.includes(i)
            return (
              <li key={i} className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <span className="w-8 shrink-0 text-center font-mono text-lg font-semibold text-fg-muted">{i + 1}</span>
                <div className="min-w-[120px] flex-1">
                  <TimeInput digits={r.digits} onChange={(d) => setRow(i, { digits: d })} label={m.calc.solve(i + 1)} />
                </div>
                <PenaltyToggle value={r.penalty} onChange={(p) => setRow(i, { penalty: p })} label={m.calc.solvePenalty(i + 1)} />
                <span className="w-full text-right font-mono text-sm tabular-nums sm:w-28">
                  {v == null ? (
                    <span className="text-fg-faint">{i === fifthIndex ? m.calc.missingThis : ''}</span>
                  ) : (
                    <span className={dropped ? 'text-fg-faint' : v === Infinity ? 'text-accent-red' : 'text-fg'}>
                      {dropped ? '(' : ''}
                      {Number.isFinite(v) ? formatResult(v) : 'DNF'}
                      {dropped ? ')' : ''}
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
        <p className="text-xs leading-relaxed text-fg-faint">{m.calc.averageNote}</p>
        <div className="flex justify-end">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setRows(emptyRows(5))}>
            {m.calc.clearTimes}
          </button>
        </div>
      </div>

      <aside className="order-first space-y-3 lg:sticky lg:top-24 lg:order-none lg:self-start">
        <div className="card space-y-3 p-5">
          {out.count === 5 ? (
            <Stat label={m.calc.average} value={fmtAvg(out.average)} tone={out.average === Infinity ? 'bad' : 'brand'} big />
          ) : (
            <Stat
              label={m.calc.average}
              value="—"
              hint={
                out.count === 0
                  ? m.calc.typeTimes
                  : out.count < 4
                    ? m.calc.partialMean(out.count, fmtAvg(out.partialMean))
                    : m.calc.oneLeft
              }
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="BPA" value={fmtAvg(out.bpa)} tone="good" hint={m.calc.bestPossible} />
            <Stat label="WPA" value={fmtAvg(out.wpa)} tone={out.wpa === Infinity ? 'bad' : 'default'} hint={m.calc.worstPossible} />
          </div>
          <p className="text-xs text-fg-faint">{m.calc.bpaWpaNote}</p>
        </div>

        <div className="card space-y-3 p-5">
          <Field label={m.calc.target} hint={m.calc.targetHint}>
            <TimeInput digits={targetDigits} onChange={setTargetDigits} label={m.calc.targetShort} placeholder="0.00" />
          </Field>
          {target && out.count !== 4 && <p className="text-sm text-fg-muted">{m.calc.targetNeedFour}</p>}
          {need?.kind === 'guaranteed' && (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {m.calc.guaranteed(formatResult(target!))}
            </p>
          )}
          {need?.kind === 'impossible' && (
            <p className="text-sm font-medium text-accent-red">
              {m.calc.impossible(formatResult(target!))}
            </p>
          )}
          {need?.kind === 'needed' && (
            <Stat
              label={m.calc.needLast}
              value={`≤ ${formatResult(need.maxResult)}`}
              tone="brand"
              hint={m.calc.forAverageBelow(formatResult(target!))}
            />
          )}
        </div>
      </aside>
    </div>
  )
}

// ------------------------------------------------------------------ página
export default function CalcumulativePage() {
  const { m } = useI18n()
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('aba') === 'media' ? 'media' : 'cumulativo'

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="flex items-center gap-4">
        <CalcumulativeMark className="h-12 w-12" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calcumulative</h1>
          <p className="text-sm text-fg-muted">{m.calc.subtitle}</p>
        </div>
      </div>

      <div className="mt-8">
        <Tabs
          label={m.calc.tabs}
          value={mode}
          onChange={(m) => setParams(m === 'media' ? { aba: 'media' } : {}, { replace: true })}
          tabs={[
            { value: 'cumulativo', label: m.calc.tabCumulative },
            { value: 'media', label: m.calc.tabAverage },
          ]}
        />
      </div>

      {/* As duas ficam montadas: trocar de aba não apaga o que foi digitado. */}
      <div className="mt-6" role="tabpanel" hidden={mode !== 'cumulativo'}>
        <CumulativeCalc />
      </div>
      <div className="mt-6" role="tabpanel" hidden={mode !== 'media'}>
        <AverageCalc />
      </div>
    </div>
  )
}
