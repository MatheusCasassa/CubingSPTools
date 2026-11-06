import { useEffect, useRef, useState } from 'react'
import { Alert } from '../../../components/ui/Feedback'
import { FMTimerMark } from '../../../components/ui/icons'
import { useI18n } from '../../../i18n/I18nProvider'
import {
  ALERT_OPTIONS,
  DEFAULT_SETTINGS,
  dueAnnouncements,
  formatClock,
  initialState,
  remainingOf,
  type TimerSettings,
  type TimerState,
  type VoiceLang,
} from '../model/timer'
import { speechAvailable, ttsPack, unlockAudio, voicesFor } from '../model/voice'

const SETTINGS_KEY = 'csp.fmtimer.settings'
const STATE_KEY = 'csp.fmtimer.state'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback
  } catch {
    return fallback
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* sem armazenamento */
  }
}

const voice = ttsPack

export default function FMTimerPage() {
  const { m, locale } = useI18n()
  const t = m.fmtimer
  const [settings, setSettings] = useState<TimerSettings>(() =>
    load(SETTINGS_KEY, { ...DEFAULT_SETTINGS, lang: (locale.slice(0, 2) as VoiceLang) || 'pt' }),
  )
  const [state, setState] = useState<TimerState>(() => load(STATE_KEY, initialState(settings)))
  const [now, setNow] = useState(() => Date.now())
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [full, setFull] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const wake = useRef<{ release(): Promise<void> } | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => save(SETTINGS_KEY, settings), [settings])
  useEffect(() => save(STATE_KEY, state), [state])

  // Vozes do aparelho (algumas chegam depois).
  useEffect(() => {
    if (!speechAvailable()) return
    const upd = () => setVoices(voicesFor(settings.lang))
    upd()
    window.speechSynthesis.addEventListener('voiceschanged', upd)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', upd)
  }, [settings.lang])

  // Relógio + avisos.
  useEffect(() => {
    if (state.status !== 'running') return
    const h = window.setInterval(() => {
      const n = Date.now()
      setNow(n)
      const st = stateRef.current
      if (st.status !== 'running') return
      const rem = remainingOf(st, n)
      const { play, fired } = dueAnnouncements(st, settings, rem)
      if (play) voice.play(play, settings)
      const next: TimerState = { ...st, fired }
      const out: TimerState = rem <= 0 ? { ...next, status: 'finished', endsAt: null, remainingMs: 0 } : next
      stateRef.current = out
      setState(out)
    }, 200)
    return () => window.clearInterval(h)
  }, [state.status, settings])

  // Tela sempre ligada enquanto corre.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }
    if (state.status === 'running' && nav.wakeLock && !wake.current)
      nav.wakeLock
        .request('screen')
        .then((l) => (wake.current = l))
        .catch(() => undefined)
    if (state.status !== 'running' && wake.current) {
      void wake.current.release().catch(() => undefined)
      wake.current = null
    }
  }, [state.status])

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  const remaining = remainingOf(state, now)
  const set = <K extends keyof TimerSettings>(k: K, v: TimerSettings[K]) => {
    const next = { ...settings, [k]: v }
    setSettings(next)
    // Mudou a duração com o timer parado: atualiza o relógio.
    if (k === 'minutes') setState((st) => (st.status === 'idle' ? initialState(next, st.attempt) : st))
  }

  const start = () => {
    unlockAudio()
    const n = Date.now()
    setNow(n)
    if (state.status === 'idle' && settings.announceStart) voice.play({ kind: 'start', minutes: settings.minutes }, settings)
    setState((st) => ({ ...st, status: 'running', endsAt: n + st.remainingMs }))
  }
  const pause = () =>
    setState((st) => ({ ...st, status: 'paused', remainingMs: remainingOf(st, Date.now()), endsAt: null }))
  const adjust = (deltaMin: number) =>
    setState((st) => {
      const n = Date.now()
      const rem = Math.max(0, remainingOf(st, n) + deltaMin * 60_000)
      // Avisos à frente do novo tempo voltam a valer.
      const fired = st.fired.filter((k) => {
        const at = k === 'end' ? 0 : k.startsWith('m') ? Number(k.slice(1)) * 60_000 : Number(k.slice(1)) * 1000
        return at >= rem
      })
      if (st.status === 'running') return { ...st, endsAt: n + rem, fired }
      return { ...st, remainingMs: rem, fired, status: st.status === 'finished' && rem > 0 ? 'paused' : st.status }
    })
  const reset = () => window.confirm(t.resetConfirm) && setState((st) => initialState(settings, st.attempt))
  const goAttempt = (a: number) => {
    if (a === state.attempt) return
    if ((state.status === 'running' || state.status === 'paused') && !window.confirm(t.resetConfirm)) return
    setState(initialState(settings, a))
  }

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void box.current?.requestFullscreen?.().catch(() => undefined)
  }

  const statusText =
    state.status === 'finished' ? t.finished : state.status === 'paused' ? t.paused : state.status === 'idle' ? t.ready : ''
  const low = state.status === 'running' && remaining <= 5 * 60_000

  return (
    <div className="container-page py-10 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-4">
          <FMTimerMark className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">FMTimer</h1>
            <p className="truncate text-sm text-fg-muted">{t.subtitle}</p>
          </div>
        </div>

        {!speechAvailable() && (
          <div className="mt-6">
            <Alert tone="warn">{t.noSpeech}</Alert>
          </div>
        )}

        <div
          ref={box}
          className={`card mt-8 flex flex-col items-center justify-center p-6 text-center ${
            full ? 'h-screen w-screen rounded-none border-0 bg-bg' : ''
          }`}
        >
          <div className="seg mb-4 [&>button]:whitespace-nowrap">
            {[1, 2, 3].map((a) => (
              <button key={a} type="button" aria-pressed={state.attempt === a} onClick={() => goAttempt(a)}>
                {t.attempt(a)}
              </button>
            ))}
          </div>
          <div
            className={`font-mono font-bold tabular-nums leading-none ${full ? 'text-[22vw]' : 'text-7xl sm:text-9xl'} ${
              state.status === 'finished' || low ? 'text-accent-red' : ''
            }`}
            aria-live="off"
          >
            {formatClock(remaining)}
          </div>
          <p className={`mt-3 h-6 font-medium ${full ? 'text-2xl' : 'text-sm'} text-fg-muted`}>{statusText}</p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {state.status === 'running' ? (
              <button type="button" className="btn-primary px-8 py-3 text-base" onClick={pause}>
                {t.pause}
              </button>
            ) : (
              state.status !== 'finished' && (
                <button type="button" className="btn-primary px-8 py-3 text-base" onClick={start}>
                  {state.status === 'paused' ? t.resume : t.start}
                </button>
              )
            )}
            <button type="button" className="btn-ghost" onClick={() => adjust(-1)} disabled={remaining <= 0}>
              {t.minusMin}
            </button>
            <button type="button" className="btn-ghost" onClick={() => adjust(1)}>
              {t.plusMin}
            </button>
            <button type="button" className="btn-ghost" onClick={reset} disabled={state.status === 'idle'}>
              {t.reset}
            </button>
            {state.attempt < 3 && state.status === 'finished' && (
              <button type="button" className="btn-ghost" onClick={() => goAttempt(state.attempt + 1)}>
                {t.next}
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={toggleFull}>
              {full ? t.exitFullscreen : t.fullscreen}
            </button>
          </div>
        </div>

        <div className="card mt-6 space-y-4 p-5">
          <h2 className="font-semibold">{t.settings}</h2>
          <div className="flex flex-wrap gap-4">
            <label className="text-xs text-fg-muted">
              {t.voiceLang}
              <select
                value={settings.lang}
                onChange={(e) => setSettings({ ...settings, lang: e.target.value as VoiceLang, voiceName: '' })}
                className="mt-1 block rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-fg"
              >
                <option value="pt">Português</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </label>
            {voices.length > 0 && (
              <label className="text-xs text-fg-muted">
                {t.voice}
                <select
                  value={settings.voiceName}
                  onChange={(e) => set('voiceName', e.target.value)}
                  className="mt-1 block max-w-[16rem] rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-fg"
                >
                  <option value="">{t.voiceDefault}</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs text-fg-muted">
              {t.duration}
              <input
                type="number"
                min={1}
                max={180}
                value={settings.minutes}
                disabled={state.status !== 'idle'}
                onChange={(e) => set('minutes', Math.max(1, Math.min(180, Math.round(Number(e.target.value) || 60))))}
                className="mt-1 block w-24 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-fg"
              />
            </label>
            <label className="text-xs text-fg-muted">
              {t.volume}
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.1}
                value={settings.volume}
                onChange={(e) => set('volume', Number(e.target.value))}
                className="mt-3 block w-32 accent-brand-600"
              />
            </label>
            <div className="self-end">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  unlockAudio()
                  voice.play({ kind: 'left', minutes: 5 }, settings)
                }}
              >
                {t.test}
              </button>
            </div>
          </div>

          <div>
            <span className="label">{t.alerts}</span>
            <div className="flex flex-wrap gap-1.5">
              {ALERT_OPTIONS.filter((a) => a < settings.minutes).map((a) => {
                const on = settings.alerts.includes(a)
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={on}
                    className={`chip ${on ? 'border-brand-500 bg-brand-500/10 text-fg' : 'border-border-subtle text-fg-muted'}`}
                    onClick={() =>
                      set('alerts', on ? settings.alerts.filter((x) => x !== a) : [...settings.alerts, a].sort((x, y) => y - x))
                    }
                  >
                    {t.minutes(a)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['countdown', t.countdown],
                ['announceStart', t.announceStart],
                ['announceEnd', t.announceEnd],
                ['beep', t.beep],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={settings[k]}
                  onChange={(e) => set(k, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="text-xs text-fg-faint">{t.tips}</p>
          <p className="text-xs text-fg-faint">{t.voicesSoon}</p>
        </div>
      </div>
    </div>
  )
}
