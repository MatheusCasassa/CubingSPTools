// Modalidades atuais da WCA com MÉDIA EM TEMPO (as que dá para calcular
// aqui) e o formato da média de cada uma. Ficam de fora o FMC (média em
// movimentos), o Multi-Blind (não tem média) e as modalidades extintas.
import type { AverageFormat } from './average'

export const AVERAGE_EVENTS: { id: string; format: AverageFormat }[] = [
  { id: '333', format: 'ao5' },
  { id: '222', format: 'ao5' },
  { id: '444', format: 'ao5' },
  { id: '555', format: 'ao5' },
  { id: '666', format: 'mo3' },
  { id: '777', format: 'mo3' },
  { id: '333bf', format: 'ao5' },
  { id: '333oh', format: 'ao5' },
  { id: 'clock', format: 'ao5' },
  { id: 'minx', format: 'ao5' },
  { id: 'pyram', format: 'ao5' },
  { id: 'skewb', format: 'ao5' },
  { id: 'sq1', format: 'ao5' },
  { id: '444bf', format: 'mo3' },
  { id: '555bf', format: 'mo3' },
  { id: 'fto', format: 'ao5' },
]

export function averageFormatOf(eventId: string): AverageFormat | null {
  return AVERAGE_EVENTS.find((e) => e.id === eventId)?.format ?? null
}

/** Eventos (na ordem oficial) em que a pessoa tem média válida. */
export function eventsWithAverage(averages: Record<string, number>): { id: string; format: AverageFormat; pr: number }[] {
  return AVERAGE_EVENTS.filter((e) => averages[e.id] > 0).map((e) => ({ ...e, pr: averages[e.id] }))
}
