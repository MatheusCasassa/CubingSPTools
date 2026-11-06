// FMTimer — timer do FMC com avisos falados.
//
// O tempo é calculado pelo relógio (instante de término), não por contagem de
// ticks: mesmo com a aba em segundo plano ou o aparelho lento, o restante fica
// certo. Os avisos são "eventos" que disparam uma vez cada, quando o tempo
// restante cruza a marca.

export type VoiceLang = 'pt' | 'en' | 'es'

export interface TimerSettings {
  minutes: number
  /** Avisos de "faltam N minutos". */
  alerts: number[]
  countdown: boolean
  announceStart: boolean
  announceEnd: boolean
  beep: boolean
  volume: number
  lang: VoiceLang
  /** Nome da voz do aparelho (vazio = padrão). */
  voiceName: string
}

export const ALERT_OPTIONS = [45, 30, 20, 15, 10, 5, 2, 1]

export const DEFAULT_SETTINGS: TimerSettings = {
  minutes: 60,
  alerts: [30, 15, 10, 5, 1],
  countdown: true,
  announceStart: true,
  announceEnd: true,
  beep: true,
  volume: 1,
  lang: 'pt',
  voiceName: '',
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface TimerState {
  attempt: number
  status: TimerStatus
  /** Quando corre: instante (ms) em que acaba. */
  endsAt: number | null
  /** Parado/pausado: milissegundos restantes. */
  remainingMs: number
  /** Eventos já anunciados nesta tentativa. */
  fired: string[]
}

export const initialState = (s: TimerSettings, attempt = 1): TimerState => ({
  attempt,
  status: 'idle',
  endsAt: null,
  remainingMs: s.minutes * 60_000,
  fired: [],
})

export function remainingOf(st: TimerState, now: number): number {
  if (st.status === 'running' && st.endsAt != null) return Math.max(0, st.endsAt - now)
  return st.remainingMs
}

export type Announcement =
  | { kind: 'start'; minutes: number }
  | { kind: 'left'; minutes: number }
  | { kind: 'count'; n: number }
  | { kind: 'end' }

/**
 * Avisos que devem tocar agora: marcas cruzadas desde o último tick e ainda não
 * anunciadas. Se várias foram cruzadas de uma vez (aba dormindo), só a mais
 * recente toca — as outras são marcadas como feitas.
 */
export function dueAnnouncements(
  st: TimerState,
  s: TimerSettings,
  remainingMs: number,
): { play: Announcement | null; fired: string[] } {
  const fired = new Set(st.fired)
  const crossed: { key: string; a: Announcement; at: number }[] = []
  const total = s.minutes * 60_000
  for (const m of s.alerts) {
    const at = m * 60_000
    if (at < total && remainingMs <= at && remainingMs > at - 30_000) crossed.push({ key: `m${m}`, a: { kind: 'left', minutes: m }, at })
    else if (remainingMs <= at - 30_000 && at < total) fired.add(`m${m}`) // passou longe: não toca atrasado
  }
  if (s.countdown)
    for (let n = 10; n >= 1; n--) {
      const at = n * 1000
      if (remainingMs <= at && remainingMs > at - 1000) crossed.push({ key: `c${n}`, a: { kind: 'count', n }, at })
      else if (remainingMs <= at - 1000) fired.add(`c${n}`)
    }
  if (s.announceEnd && remainingMs <= 0) crossed.push({ key: 'end', a: { kind: 'end' }, at: 0 })
  const fresh = crossed.filter((c) => !fired.has(c.key)).sort((a, b) => a.at - b.at)
  for (const c of crossed) fired.add(c.key)
  return { play: fresh[0]?.a ?? null, fired: [...fired] }
}

/** Texto falado de cada aviso, no idioma da voz (independe do idioma do site). */
export function phrase(a: Announcement, lang: VoiceLang): string {
  const min = (n: number) =>
    lang === 'pt'
      ? `${n} ${n === 1 ? 'minuto' : 'minutos'}`
      : lang === 'es'
        ? `${n} ${n === 1 ? 'minuto' : 'minutos'}`
        : `${n} ${n === 1 ? 'minute' : 'minutes'}`
  switch (a.kind) {
    case 'start':
      return lang === 'pt'
        ? `Podem começar. Vocês têm ${min(a.minutes)}.`
        : lang === 'es'
          ? `Pueden comenzar. Tienen ${min(a.minutes)}.`
          : `You may begin. You have ${min(a.minutes)}.`
    case 'left':
      return lang === 'pt'
        ? `${a.minutes === 1 ? 'Falta' : 'Faltam'} ${min(a.minutes)}.`
        : lang === 'es'
          ? `${a.minutes === 1 ? 'Queda' : 'Quedan'} ${min(a.minutes)}.`
          : `${min(a.minutes)} remaining.`
    case 'count':
      return String(a.n)
    case 'end':
      return lang === 'pt' ? 'Tempo esgotado. Parem.' : lang === 'es' ? 'Tiempo. Dejen de escribir.' : "Time's up. Stop writing."
  }
}

export const SPEECH_LANG: Record<VoiceLang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }

export function formatClock(ms: number): string {
  // Sempre em minutos (60:00, não 1:00:00), como se lê no FMC.
  const total = Math.ceil(Math.max(0, ms) / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
