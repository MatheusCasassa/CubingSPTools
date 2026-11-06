// Vozes do FMTimer. Hoje: a voz sintetizada do próprio aparelho (TTS).
// O formato "pacote de voz" já prepara as vozes gravadas (Delegados,
// speedcubers): um pacote só precisa saber tocar cada aviso — por exemplo, um
// arquivo de áudio por frase — e entra na lista sem mudar o timer.

import { phrase, SPEECH_LANG, type Announcement, type TimerSettings } from './timer'

export interface VoicePack {
  id: string
  play(a: Announcement, s: TimerSettings): void
}

let audioCtx: AudioContext | null = null

/** Bipe curto (Web Audio). */
export function beep(volume: number, freq = 880, ms = 180) {
  try {
    audioCtx ??= new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.frequency.value = freq
    gain.gain.value = Math.max(0, Math.min(1, volume)) * 0.4
    osc.connect(gain).connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + ms / 1000)
  } catch {
    /* sem áudio */
  }
}

export const speechAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** Vozes do aparelho para o idioma escolhido. */
export function voicesFor(lang: string): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return []
  const base = lang.slice(0, 2)
  return window.speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(base))
}

/** Desbloqueia áudio e voz (navegadores exigem um toque antes de falar). */
export function unlockAudio() {
  try {
    audioCtx ??= new AudioContext()
    void audioCtx.resume()
    if (speechAvailable()) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      window.speechSynthesis.speak(u)
    }
  } catch {
    /* sem áudio */
  }
}

export const ttsPack: VoicePack = {
  id: 'tts',
  play(a, s) {
    const go = () => {
      if (!speechAvailable()) return
      const synth = window.speechSynthesis
      // A contagem não pode atrasar: interrompe o que estiver falando.
      if (a.kind === 'count' || a.kind === 'end') synth.cancel()
      const u = new SpeechSynthesisUtterance(phrase(a, s.lang))
      u.lang = SPEECH_LANG[s.lang]
      const v = s.voiceName ? voicesFor(s.lang).find((x) => x.name === s.voiceName) : undefined
      if (v) u.voice = v
      u.volume = s.volume
      u.rate = a.kind === 'count' ? 1.1 : 0.95
      synth.speak(u)
    }
    if (s.beep && a.kind !== 'count') {
      beep(s.volume, a.kind === 'end' ? 660 : 880, a.kind === 'end' ? 500 : 180)
      window.setTimeout(go, 350)
    } else go()
    if (!speechAvailable() && a.kind === 'count') beep(s.volume, 990, 120)
  },
}
