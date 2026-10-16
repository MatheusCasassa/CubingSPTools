// Súmulas em branco: as linhas seguem o formato da rodada (nunca o evento).
import assert from 'node:assert/strict'
import { demoWcif } from '../src/tools/scorecomps/model/demo'
import { planRounds, buildRoundScorecards, buildGenericScorecards, ADVANCERS_KEY } from '../src/tools/scorecomps/model/build'
import { advancingFromPrevious } from '../src/tools/cubestaff/model/people'
import { attemptsFor, buildRoundLayout } from '../src/tools/scorecomps/model/logic'

const rows = (format: '1' | '2' | '3' | 'm' | 'a', eventId: string) => {
  const l = buildRoundLayout({ id: `${eventId}-r1`, format, timeLimit: null, cutoff: null, advancementCondition: null }, eventId)
  return { solves: l.block1.length + l.block2.length, extras: l.extras.length }
}
assert.deepEqual(rows('a', '333'), { solves: 5, extras: 2 }) // Ao5
assert.deepEqual(rows('a', '333bf'), { solves: 5, extras: 2 }) // Bo5 (3BLD) — mesma cara
assert.deepEqual(rows('m', '666'), { solves: 3, extras: 2 }) // Mo3
assert.deepEqual(rows('m', '777'), { solves: 3, extras: 2 })
assert.deepEqual(rows('3', '444bf'), { solves: 3, extras: 2 }) // Bo3
assert.deepEqual(rows('1', '333mbf'), { solves: 1, extras: 2 }) // MBLD Bo1
assert.deepEqual(rows('2', '333mbf'), { solves: 2, extras: 2 }) // MBLD Bo2
assert.equal(attemptsFor('2'), 2)

// Demo: 3 em branco do Multi-Blind (Bo2) saem sem nome/ID/grupo e com 2 linhas.
const wcif = demoWcif()
const plan = planRounds(wcif).find((p) => p.info.roundId === '333mbf-r1')!
const cards = buildRoundScorecards(wcif, plan, { roundId: '333mbf-r1', groupKeys: [], blank: 3 }, 'name', 'pt')
assert.equal(cards.length, 3)
for (const c of cards) {
  assert.equal(c.competitorName, '')
  assert.equal(c.competitorId, '')
  assert.equal(c.group, '')
  assert.equal(c.layout.block1.length + c.layout.block2.length, 2)
}
console.log('✓ súmulas em branco seguem o formato da rodada (Ao5/Bo5, Mo3/Bo3, MBLD 1–2)')

// Em branco GENÉRICAS: sem modalidade, só a competição; limite e corte para
// preencher; corte depois da 2ª (de 5) e da 1ª (de 3); sem corte com 1 ou 2.
{
  const g5 = buildGenericScorecards('Campeonato X', 5, 4, 'pt')
  assert.equal(g5.length, 4)
  const c = g5[0]
  assert.equal(c.competitionName, 'Campeonato X')
  assert.match(c.eventName, /^Modalidade: _+ {2}Rodada: _+$/)
  assert.equal(c.competitorName + c.competitorId + c.group, '')
  assert.deepEqual(c.layout.block1.map((r) => r.label), ['1', '2'])
  assert.deepEqual(c.layout.block2.map((r) => r.label), ['3', '4', '5'])
  assert.match(c.layout.dnfText ?? '', /^Limite de tempo: _+$/)
  assert.match(c.layout.cutoffText, /^Tempo de corte se > _+$/)
  assert.equal(c.layout.extras.length, 2)
  const g3 = buildGenericScorecards('X', 3, 1, 'en')[0]
  assert.deepEqual([g3.layout.block1.length, g3.layout.block2.length], [1, 2])
  assert.match(g3.eventName, /^Event: /)
  for (const n of [2, 1] as const) {
    const g = buildGenericScorecards('X', n, 1)[0]
    assert.equal(g.layout.block1.length, n)
    assert.equal(g.layout.block2.length, 0)
    assert.equal(g.layout.cutoffText, '')
  }
  console.log('✓ súmulas em branco genéricas (sem modalidade)')
}

// Rodadas seguintes: classificados com nome (WCA Live → WCA).
{
  const plans = planRounds(wcif)
  const r2 = plans.find((p) => p.info.roundId === '333-r2')!
  assert.equal(r2.advancers, 'previousResults')
  assert.equal(r2.groups[0].key, ADVANCERS_KEY)
  assert.equal(r2.groups[0].competitors.length, 16) // condição: top 16
  const r1 = wcif.events.find((e) => e.id === '333')!.rounds[0]
  const top16 = new Set(r1.results!.filter((r) => (r.ranking ?? 99) <= 16).map((r) => r.personId))
  assert.ok(r2.groups[0].competitors.every((c) => top16.has(c.registrantId)))
  const pyr2 = plans.find((p) => p.info.roundId === 'pyram-r2')!
  assert.equal(pyr2.advancers, 'results') // rodada já aberta no WCA Live
  const cards = buildRoundScorecards(wcif, r2, { roundId: '333-r2', groupKeys: [ADVANCERS_KEY], blank: 2 }, 'name', 'pt')
  assert.equal(cards.length, 18)
  assert.ok(cards.slice(0, 16).every((c) => c.competitorName !== '' && c.group === ''))
  // 75%: com 10 resultados e "top 16", avançam só 7.
  const ten = { ...r1, results: r1.results!.slice(0, 10) }
  assert.equal(advancingFromPrevious(ten)!.length, 7)
  console.log('✓ rodadas seguintes com os nomes dos classificados')
}
