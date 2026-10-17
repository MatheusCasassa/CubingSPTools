import { useMemo } from 'react'
import { useI18n } from '../../../i18n/I18nProvider'
import { EventIcon } from '../../../components/ui/EventIcon'
import { eventName } from '../../../lib/wca/format'
import type { CubeStaffConfig } from '../model/types'
import { estimateCompetitors, roundCompetitors } from '../model/people'
import { groupCountFor } from '../model/engine'
import { hasRoundInSchedule, roundSchedule } from '../model/schedule'
import { useCs } from './ctx'
import { Field, NumberInput, Seg, Tag, Toggle } from './primitives'

export function ConfigPanel() {
  const { m } = useI18n()
  const { s, wcif, plan } = useCs()
  const cfg = plan.config
  const t = m.cubestaff
  const set = <K extends keyof CubeStaffConfig>(k: K, v: CubeStaffConfig[K]) =>
    s.commit({ ...plan, config: { ...cfg, [k]: v }, updatedAt: new Date().toISOString() }, `cfg:${String(k)}`)

  const rooms = useMemo(() => wcif.schedule.venues.flatMap((v) => v.rooms ?? []), [wcif])
  const absent = useMemo(() => new Set(cfg.absent), [cfg.absent])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="space-y-6">
        <section className="card space-y-5 p-5">
          <h2 className="font-semibold">{t.general}</h2>
          <Field label={t.stations} hint={t.stationsHint}>
            <NumberInput
              value={cfg.stations}
              min={1}
              max={200}
              onChange={(v) => set('stations', v)}
              label={t.stations}
            />
          </Field>
          {rooms.length > 1 && (
            <div className="grid grid-cols-2 gap-3">
              {rooms.map((r) => (
                <Field key={r.id} label={t.stationsRoom(r.name)}>
                  <NumberInput
                    value={cfg.stationsByRoom[String(r.id)] ?? cfg.stations}
                    min={1}
                    max={200}
                    onChange={(v) => set('stationsByRoom', { ...cfg.stationsByRoom, [String(r.id)]: v })}
                  />
                </Field>
              ))}
            </div>
          )}
          <Field label={t.distribution} hint={t.distHint}>
            <Seg
              value={cfg.distribution}
              onChange={(v) => set('distribution', v)}
              options={[
                { value: 'newcomersFirst', label: t.distNewcomers },
                { value: 'mixed', label: t.distMixed },
              ]}
            />
          </Field>
          {cfg.distribution === 'newcomersFirst' && (
            <Field label={t.newcomerShare} hint={cfg.newcomerShare === 100 ? t.share100Hint : t.share50Hint}>
              <Seg
                value={cfg.newcomerShare}
                onChange={(v) => set('newcomerShare', v)}
                options={[
                  { value: 100, label: t.share100 },
                  { value: 50, label: t.share50 },
                ]}
              />
            </Field>
          )}
          <Toggle
            checked={cfg.runnersEnabled}
            onChange={(v) => set('runnersEnabled', v)}
            label={t.runners}
            hint={t.runnersHint}
          />
          <Toggle
            checked={cfg.stationNumbers}
            onChange={(v) => set('stationNumbers', v)}
            label={t.stationNumbers}
            hint={t.stationNumbersHint}
          />
          <Toggle
            checked={cfg.presenceByEvents}
            onChange={(v) => set('presenceByEvents', v)}
            label={t.presenceByEvents}
            hint={t.presenceByEventsHint}
          />
        </section>

        <details className="card group p-5">
          <summary className="cursor-pointer select-none font-semibold">{t.advanced}</summary>
          <div className="mt-5 space-y-5">
            <Field label={t.perScrambler} hint={t.perScramblerHint(cfg.competitorsPerScrambler)}>
              <NumberInput
                value={cfg.competitorsPerScrambler}
                min={1}
                max={50}
                onChange={(v) => set('competitorsPerScrambler', v)}
              />
            </Field>
            <Field label={t.delegateThreshold} hint={t.delegateThresholdHint(cfg.delegateThreshold)}>
              <NumberInput
                value={cfg.delegateThreshold}
                min={1}
                max={5}
                step={0.1}
                onChange={(v) => set('delegateThreshold', v)}
              />
            </Field>
            <Field label={t.maxConsecutive} hint={t.maxConsecutiveHint}>
              <NumberInput value={cfg.maxConsecutive} min={0} max={20} onChange={(v) => set('maxConsecutive', v)} />
            </Field>
            <Field label={t.maxTasks} hint={t.maxTasksHint}>
              <NumberInput
                value={cfg.maxTasksPerPerson}
                min={0}
                max={100}
                onChange={(v) => set('maxTasksPerPerson', v)}
              />
            </Field>
            <Field label={t.reserves}>
              <NumberInput value={cfg.reservesPerGroup} min={0} max={10} onChange={(v) => set('reservesPerGroup', v)} />
            </Field>
          </div>
        </details>
      </div>

      <section className="card overflow-hidden">
        <h2 className="px-5 pt-5 font-semibold">{t.roundsTable}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-fg-muted">
                <th className="px-5 py-2 font-medium">{t.round}</th>
                <th className="px-3 py-2 text-right font-medium">{t.competitors}</th>
                <th className="px-3 py-2 font-medium">{t.groups}</th>
                <th className="px-5 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {wcif.events.map((ev) =>
                ev.rounds.map((r, i) => {
                  const known = roundCompetitors(wcif, r.id, absent)
                  const count = known.source === 'unknown' ? estimateCompetitors(wcif, r.id, absent) : known.ids.length
                  const groups = groupCountFor(wcif, cfg, r.id, count)
                  const attempts = roundSchedule(wcif, r.id, 1).kind === 'attempts'
                  const status = !hasRoundInSchedule(wcif, r.id)
                    ? 'noSchedule'
                    : plan.rounds[r.id]
                      ? plan.published.includes(r.id)
                        ? 'published'
                        : 'planned'
                      : known.source === 'unknown'
                        ? 'waiting'
                        : 'none'
                  return (
                    <tr key={r.id} className="border-b border-border-subtle/60 last:border-0">
                      <td className="px-5 py-2.5">
                        <span className="flex items-center gap-2.5">
                          <EventIcon eventId={ev.id} className={`h-5 w-5 ${i > 0 ? 'opacity-0' : ''}`} />
                          <span>
                            {i === 0 ? <span className="font-medium">{eventName(ev.id)}</span> : null}
                            <span className={i === 0 ? 'ml-2 text-fg-muted' : 'text-fg-muted'}>
                              {i + 1 === ev.rounds.length && ev.rounds.length > 1 ? 'Final' : `R${i + 1}`}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {count}
                        {known.source === 'unknown' && (
                          <span className="ml-1 text-[11px] text-fg-faint">({t.estimated})</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {attempts ? (
                          <span className="text-xs text-fg-faint">—</span>
                        ) : (
                          <span className="flex items-center gap-3">
                            <NumberInput
                              className="w-16"
                              value={groups}
                              min={1}
                              max={40}
                              label={`${t.groups} ${r.id}`}
                              onChange={(v) => set('groupsByRound', { ...cfg.groupsByRound, [r.id]: v })}
                            />
                            <span className="whitespace-nowrap text-xs text-fg-muted">
                              {t.perGroup(Math.ceil(count / Math.max(1, groups)))}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Tag
                          tone={
                            status === 'published'
                              ? 'ok'
                              : status === 'planned'
                                ? 'brand'
                                : status === 'noSchedule'
                                  ? 'warn'
                                  : 'neutral'
                          }
                        >
                          {t.statusRound[status]}
                        </Tag>
                      </td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
