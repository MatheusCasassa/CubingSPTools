// Regra de Competições Passadas x Futuras.
//   npx tsx scripts/test-competitions.ts
import assert from 'node:assert/strict'
import { splitCompetitions, todayIso } from '../src/tools/scorecomps/model/competitions'

const c = (id: string, start: string, end?: string) => ({ id, name: id, start_date: start, end_date: end })
const list = [
  c('UmDia', '2026-10-16', '2026-10-16'),
  c('TerminaHoje', '2026-10-15', '2026-10-16'),
  c('TerminouOntem', '2026-10-14', '2026-10-15'),
  c('Futura', '2026-11-01', '2026-11-02'),
  c('Antiga', '2026-01-10', '2026-01-11'),
  c('SemFim', '2026-10-10'),
]
const { upcoming, past } = splitCompetitions(list, '2026-10-16')
assert.deepEqual(upcoming.map((x) => x.id), ['TerminaHoje', 'UmDia', 'Futura'])
assert.deepEqual(past.map((x) => x.id), ['TerminouOntem', 'SemFim', 'Antiga'])
// No dia seguinte ao último dia, passa para "Passadas".
assert.ok(splitCompetitions(list, '2026-10-17').past.some((x) => x.id === 'TerminaHoje'))
// "Hoje" é sempre em UTC-0: 23:30 de 15/10 em São Paulo já é 16/10 em UTC.
assert.equal(todayIso(new Date('2026-10-16T02:30:00Z')), '2026-10-16')
assert.equal(todayIso(new Date('2026-10-15T23:59:59Z')), '2026-10-15')
console.log('✓ competições passadas/futuras (último dia + 1)')
