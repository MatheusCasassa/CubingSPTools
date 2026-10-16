// Tempos em CENTÉSIMOS de segundo (inteiros) e as regras de arredondamento
// da WCA:
//  9f1 — resultados < 10 min: truncados ao centésimo; médias < 10 min:
//        arredondadas ao centésimo mais próximo.
//  9f2 — resultados ≥ 10 min: truncados ao segundo; médias ≥ 10 min:
//        arredondadas ao segundo mais próximo (X.49 → X, X.50 → X+1).

export const TEN_MINUTES = 60_000 // cs

/** Máximo de dígitos digitáveis: MMSScc (até 99:59.99). */
export const MAX_DIGITS = 6

/** Só os dígitos, sem zeros à esquerda, no máximo MAX_DIGITS. */
export function cleanDigits(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS)
}

/**
 * Dígitos alinhados à direita → centésimos: os 2 últimos são centésimos,
 * os 2 anteriores segundos e o resto minutos ("12345" → 1:23.45).
 * Segundos ≥ 60 transbordam para minutos ("9000" → 1:30.00).
 */
export function digitsToCentis(raw: string): number | null {
  const d = cleanDigits(raw)
  if (!d) return null
  const n = d.padStart(6, '0')
  const m = Number(n.slice(0, 2))
  const s = Number(n.slice(2, 4))
  const c = Number(n.slice(4, 6))
  return (m * 60 + s) * 100 + c
}

/** Centésimos → dígitos (inverso de digitsToCentis, já normalizado). */
export function centisToDigits(cs: number | null): string {
  if (cs == null || cs <= 0) return ''
  const m = Math.floor(cs / 6000)
  const s = Math.floor((cs % 6000) / 100)
  const c = cs % 100
  return cleanDigits(`${String(m).padStart(2, '0')}${String(s).padStart(2, '0')}${String(c).padStart(2, '0')}`)
}

/** Exibição enquanto digita: "1" → 0.01, "123" → 1.23, "12345" → 1:23.45. */
export function formatDigits(raw: string): string {
  const d = cleanDigits(raw)
  if (!d) return ''
  const n = d.padStart(3, '0')
  const c = n.slice(-2)
  const rest = n.slice(0, -2)
  if (rest.length <= 2) return `${Number(rest)}.${c}`
  return `${Number(rest.slice(0, -2))}:${rest.slice(-2)}.${c}`
}

/** Duração com centésimos ("8.05", "1:02.27", "30:00.00"). */
export function formatDuration(cs: number): string {
  const v = Math.max(0, Math.round(cs))
  const m = Math.floor(v / 6000)
  const s = Math.floor((v % 6000) / 100)
  const c = String(v % 100).padStart(2, '0')
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}.${c}` : `${s}.${c}`
}

/** Resultado individual no padrão WCA (≥ 10 min sem centésimos). */
export function formatResult(cs: number): string {
  if (cs >= TEN_MINUTES) {
    const v = Math.floor(cs / 100)
    return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
  }
  return formatDuration(cs)
}

/** 9f1/9f2: resultado individual truncado. */
export function truncateResult(cs: number): number {
  return cs >= TEN_MINUTES ? Math.floor(cs / 100) * 100 : Math.floor(cs)
}

/** 9f1/9f2: média arredondada (meio para cima). */
export function roundAverage(cs: number): number {
  if (!Number.isFinite(cs)) return cs
  if (cs >= TEN_MINUTES) return Math.floor(cs / 100 + 0.5 + 1e-9) * 100
  return Math.floor(cs + 0.5 + 1e-9)
}

export type Penalty = 'ok' | '+2' | 'dnf'
