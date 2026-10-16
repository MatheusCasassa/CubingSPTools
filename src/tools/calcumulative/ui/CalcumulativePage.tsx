import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs } from '../../../components/ui/Tabs'
import { CalcumulativeMark } from '../../../components/ui/icons'
import { TimeInput } from './TimeInput'
import { PenaltyToggle } from './PenaltyToggle'
import { digitsToCentis, formatDuration, formatResult, type Penalty } from '../model/time'
import { computeCumulative, type AttemptOutcome } from '../model/cumulative'
import { computeAverage, neededForTarget } from '../model/average'

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
function statusBadge(o: AttemptOutcome) {
  switch (o.status) {
    case 'ok':
      return <span className="text-emerald-600 dark:text-emerald-400">{formatResult(o.result!)}</span>
    case 'dnf':
      return <span className="text-accent-red">DNF ({formatResult(o.elapsed!)})</span>
    case 'dnf-limit':
      return (
        <span className="text-accent-red" title="O resultado (com penalidades) atingiu o limite da tentativa — Regulamento A1a4">
          DNF ({formatResult(o.elapsed!)}) · limite
        </span>
      )
    case 'dns':
      return <span className="text-fg-faint">DNS</span>
    default:
      return o.limit != null ? <span className="text-fg-muted">até {formatDuration(o.limit)}</span> : null
  }
}

function CumulativeCalc() {
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
          <Field label="Limite cumulativo" hint="Ex.: 3BLD costuma ter 10:00 a 30:00.">
            <TimeInput digits={limitDigits} onChange={setLimitDigits} label="Limite cumulativo" placeholder="0:00.00" />
          </Field>
          <Field label="Limite por tentativa (opcional)" hint="Se a rodada também tiver limite por solve.">
            <TimeInput digits={perDigits} onChange={setPerDigits} label="Limite por tentativa" placeholder="—" />
          </Field>
        </div>

        <div>
          <span className="label">Tentativas</span>
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
          <p className="mt-1.5 text-xs text-fg-faint">
            5: 3BLD e eventos com média de 5 (Ao5/Bo5) · 3: 4BLD, 5BLD, 6x6x6, 7x7x7 (Mo3/Bo3).
          </p>
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
                    label={`Tentativa ${i + 1}`}
                    disabled={dns}
                    invalid={o.status === 'dnf-limit'}
                  />
                </div>
                <PenaltyToggle
                  value={rows[i].penalty}
                  onChange={(p) => setRow(i, { penalty: p })}
                  disabled={dns}
                  label={`Penalidade da tentativa ${i + 1}`}
                />
                <span className="w-full text-right font-mono text-xs tabular-nums sm:w-40">{statusBadge(o)}</span>
              </li>
            )
          })}
        </ol>

        <p className="text-xs leading-relaxed text-fg-faint">
          Conta para o limite o resultado com penalidades ou, se for DNF, o tempo decorrido (A1a5). Se o resultado
          chegar ao limite da tentativa, ela vira DNF (A1a4); esgotado o limite cumulativo, as tentativas restantes são
          DNS.
        </p>
      </div>

      <aside className="order-first space-y-3 lg:sticky lg:top-24 lg:order-none lg:self-start">
        <div className="card space-y-3 p-5">
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-fg-muted">
              <span>Usado</span>
              <span>{limit ? `${Math.floor(pct)}%` : 'defina o limite'}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <Stat label="Tempo usado" value={formatDuration(out.used)} />
          <Stat
            label="Tempo restante"
            value={limit ? formatDuration(out.remaining) : '—'}
            tone={limit && out.remaining === 0 ? 'bad' : 'brand'}
            big
            hint={out.reached ? 'Limite cumulativo atingido — demais tentativas são DNS.' : undefined}
          />
          {next && next.limit != null && (
            <Stat
              label="Limite da próxima tentativa"
              value={formatDuration(next.limit)}
              hint={perAttempt && next.limit === perAttempt ? 'Vale o limite por tentativa.' : 'Restante do cumulativo.'}
            />
          )}
          <button type="button" className="btn-ghost w-full" onClick={reset}>
            Limpar
          </button>
        </div>
      </aside>
    </div>
  )
}

// ------------------------------------------------------------------ média
function AverageCalc() {
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
                  <TimeInput digits={r.digits} onChange={(d) => setRow(i, { digits: d })} label={`Solve ${i + 1}`} />
                </div>
                <PenaltyToggle value={r.penalty} onChange={(p) => setRow(i, { penalty: p })} label={`Penalidade do solve ${i + 1}`} />
                <span className="w-full text-right font-mono text-sm tabular-nums sm:w-28">
                  {v == null ? (
                    <span className="text-fg-faint">{i === fifthIndex ? 'falta este' : ''}</span>
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
        <p className="text-xs leading-relaxed text-fg-faint">
          Média de 5 (Ao5): descarta o melhor e o pior e faz a média dos 3 do meio (9f8). Dois DNFs tornam a média
          DNF. Arredondamento ao centésimo (ou ao segundo, acima de 10 minutos) — 9f1/9f2.
        </p>
        <div className="flex justify-end">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setRows(emptyRows(5))}>
            Limpar tempos
          </button>
        </div>
      </div>

      <aside className="order-first space-y-3 lg:sticky lg:top-24 lg:order-none lg:self-start">
        <div className="card space-y-3 p-5">
          {out.count === 5 ? (
            <Stat label="Média" value={fmtAvg(out.average)} tone={out.average === Infinity ? 'bad' : 'brand'} big />
          ) : (
            <Stat
              label="Média"
              value="—"
              hint={
                out.count === 0
                  ? 'Digite os tempos.'
                  : out.count < 4
                    ? `Média simples parcial (${out.count}): ${fmtAvg(out.partialMean)}`
                    : 'Falta 1 solve.'
              }
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="BPA" value={fmtAvg(out.bpa)} tone="good" hint="Melhor possível" />
            <Stat label="WPA" value={fmtAvg(out.wpa)} tone={out.wpa === Infinity ? 'bad' : 'default'} hint="Pior possível" />
          </div>
          <p className="text-xs text-fg-faint">BPA e WPA aparecem com 4 tempos digitados.</p>
        </div>

        <div className="card space-y-3 p-5">
          <Field label="Meta de média (sub-X)" hint="Quanto preciso no último solve para ficar abaixo da meta?">
            <TimeInput digits={targetDigits} onChange={setTargetDigits} label="Meta de média" placeholder="0.00" />
          </Field>
          {target && out.count !== 4 && <p className="text-sm text-fg-muted">Digite 4 tempos para calcular.</p>}
          {need?.kind === 'guaranteed' && (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Garantido: mesmo com DNF a média fica abaixo de {formatResult(target!)}.
            </p>
          )}
          {need?.kind === 'impossible' && (
            <p className="text-sm font-medium text-accent-red">
              Impossível: nem com o melhor solve a média fica abaixo de {formatResult(target!)}.
            </p>
          )}
          {need?.kind === 'needed' && (
            <Stat
              label="Precisa no último solve"
              value={`≤ ${formatResult(need.maxResult)}`}
              tone="brand"
              hint={`para média abaixo de ${formatResult(target!)}`}
            />
          )}
        </div>
      </aside>
    </div>
  )
}

// ------------------------------------------------------------------ página
export default function CalcumulativePage() {
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('aba') === 'media' ? 'media' : 'cumulativo'

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="flex items-center gap-4">
        <CalcumulativeMark className="h-12 w-12" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calcumulative</h1>
          <p className="text-sm text-fg-muted">Limite de tempo cumulativo e média com BPA/WPA, nas regras da WCA</p>
        </div>
      </div>

      <div className="mt-8">
        <Tabs
          label="Calculadoras"
          value={mode}
          onChange={(m) => setParams(m === 'media' ? { aba: 'media' } : {}, { replace: true })}
          tabs={[
            { value: 'cumulativo', label: 'Limite cumulativo' },
            { value: 'media', label: 'Média (BPA / WPA)' },
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
