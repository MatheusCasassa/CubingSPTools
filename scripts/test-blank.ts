// Súmulas em branco: as linhas seguem o formato da rodada (nunca o evento).
import assert from 'node:assert/strict'
import { demoWcif } from '../src/tools/scorecomps/model/demo'
import { planRounds, buildRoundScorecards } from '../src/tools/scorecomps/model/build'
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
