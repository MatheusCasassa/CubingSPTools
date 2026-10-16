// Formatação de tempos e nomes de eventos/rodadas (padrão WCA).
import { getEventName } from '@wca/helpers'

/**
 * Centésimos de segundo → formato WCA:
 *   < 60s  → "SS.cc"   (ex.: 12.34)
 *   ≥ 60s  → "M:SS.cc" (ex.: 1:23.45)
 */
export function formatCentis(cs: number): string {
  const total = Math.round(cs)
  const cc = total % 100
  const totalSec = Math.floor(total / 100)
  const s = totalSec % 60
  const m = Math.floor(totalSec / 60)
  const cc2 = String(cc).padStart(2, '0')
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}.${cc2}`
  return `${s}.${cc2}`
}

// Eventos que o @wca/helpers ainda não conhece.
const EXTRA_EVENT_NAMES: Record<string, string> = {
  fto: 'Face-Turning Octahedron',
}

/** Nome oficial do evento na WCA (ex.: "3x3x3 Cube"). */
export function eventName(eventId: string): string {
  if (EXTRA_EVENT_NAMES[eventId]) return EXTRA_EVENT_NAMES[eventId]
  try {
    return getEventName(eventId as Parameters<typeof getEventName>[0]) ?? eventId
  } catch {
    return eventId
  }
}

/** Nome legível da rodada: "Rodada N" ou "Final" (última de um evento com 2+ rodadas). */
export function roundLabel(roundNumber: number, totalRounds: number): string {
  if (roundNumber === totalRounds && totalRounds > 1) return 'Final'
  return `Rodada ${roundNumber}`
}
