// Testes do Calcumulative com os EXEMPLOS DO REGULAMENTO DA WCA.
//   npx tsx scripts/test-calcumulative.ts
import assert from 'node:assert/strict'
import { computeCumulative } from '../src/tools/calcumulative/model/cumulative'
import { computeAverage, neededForTarget, ao5, mo3 } from '../src/tools/calcumulative/model/average'
import { averageFormatOf, eventsWithAverage } from '../src/tools/calcumulative/model/events'
import { parsePersons } from '../src/lib/wca/persons'
import { digitsToCentis, formatDigits, formatResult, formatDuration, roundAverage } from '../src/tools/calcumulative/model/time'

const t = (m: number, s: number, c = 0) => (m * 60 + s) * 100 + c
let n = 0
const ok = (name: string, fn: () => void) => {
  fn()
  n++
  console.log('✓', name)
}

ok('entrada por dígitos', () => {
  assert.equal(digitsToCentis('1234'), 1234)
  assert.equal(digitsToCentis('12345'), t(1, 23, 45))
  assert.equal(digitsToCentis('9000'), t(1, 30)) // 90 s transborda
  assert.equal(digitsToCentis('300000'), t(30, 0))
  assert.equal(digitsToCentis(''), null)
  assert.equal(formatDigits('1'), '0.01')
  assert.equal(formatDigits('123'), '1.23')
  assert.equal(formatDigits('12345'), '1:23.45')
  assert.equal(formatDigits('300000'), '30:00.00')
})

ok('formatação WCA (9f1/9f2)', () => {
  assert.equal(formatResult(t(1, 2, 27)), '1:02.27')
  assert.equal(formatResult(t(13, 59, 47)), '13:59')
  assert.equal(formatDuration(805), '8.05')
  assert.equal(roundAverage(1234.5), 1235)
  assert.equal(roundAverage(1234.49), 1234)
  assert.equal(roundAverage(t(10, 0, 49)), t(10, 0))
  assert.equal(roundAverage(t(10, 0, 50)), t(10, 1))
})

ok('A1a2++ — 30:00 cumulativo; 6:00 e DNF (10:00) → 3ª tentativa tem 14:00', () => {
  const r = computeCumulative(
    [
      { cs: t(6, 0), penalty: 'ok' },
      { cs: t(10, 0), penalty: 'dnf' },
      { cs: null, penalty: 'ok' },
    ],
    t(30, 0),
  )
  assert.equal(r.attempts[2].limit, t(14, 0))
  assert.equal(r.used, t(16, 0))
  assert.equal(r.remaining, t(14, 0))
})

ok('A1a2++ — 13:59 cabe; 13:59 + 2 = 14:01 não cabe (DNF)', () => {
  const base = [
    { cs: t(6, 0), penalty: 'ok' as const },
    { cs: t(10, 0), penalty: 'dnf' as const },
  ]
  const a = computeCumulative([...base, { cs: t(13, 59, 80), penalty: 'ok' }], t(30, 0))
  assert.equal(a.attempts[2].status, 'ok')
  assert.equal(a.attempts[2].result, t(13, 59)) // truncado (≥ 10 min)
  const b = computeCumulative([...base, { cs: t(13, 59), penalty: '+2' }], t(30, 0))
  assert.equal(b.attempts[2].status, 'dnf-limit')
})

ok('A1a2++++ — cumulativo 20:00 + 8:00 por tentativa; 7:00 e 7:30 → 3ª tem 5:30', () => {
  const r = computeCumulative(
    [
      { cs: t(7, 0), penalty: 'ok' },
      { cs: t(7, 30), penalty: 'ok' },
      { cs: null, penalty: 'ok' },
    ],
    t(20, 0),
    t(8, 0),
  )
  assert.equal(r.attempts[0].limit, t(8, 0))
  assert.equal(r.attempts[2].limit, t(5, 30))
})

ok('A1a2+++++ — limite atingido → restantes DNS', () => {
  const r = computeCumulative(
    [
      { cs: t(5, 0), penalty: 'ok' },
      { cs: t(9, 0), penalty: 'ok' }, // 5:00 + 9:00 > 10:00 → para em 5:00 (DNF)
      { cs: null, penalty: 'ok' },
    ],
    t(10, 0),
  )
  assert.equal(r.attempts[1].status, 'dnf-limit')
  assert.equal(r.attempts[1].counted, t(5, 0))
  assert.equal(r.attempts[2].status, 'dns')
  assert.equal(r.remaining, 0)
  assert.ok(r.reached)
})

ok('A1a5 — +2 conta no tempo usado', () => {
  const r = computeCumulative([{ cs: 5000, penalty: '+2' }], t(5, 0))
  assert.equal(r.used, 5200)
})

ok('Ao5 — descarta melhor e pior; 2 DNFs → DNF', () => {
  assert.equal(ao5([1000, 1100, 1200, 1300, 1400]), 1200)
  assert.equal(ao5([1000, 1100, 1200, 1300, Infinity]), 1200)
  assert.equal(ao5([1000, 1100, 1200, Infinity, Infinity]), Infinity)
  // (10.01 + 10.02 + 10.04) / 3 = 10.0233 → 10.02
  assert.equal(ao5([900, 1001, 1002, 1004, 2000]), 1002)
})

ok('BPA/WPA com 4 tempos', () => {
  const r = computeAverage([
    { cs: 1000, penalty: 'ok' },
    { cs: 1200, penalty: 'ok' },
    { cs: 1100, penalty: 'ok' },
    { cs: 1500, penalty: 'ok' },
    { cs: null, penalty: 'ok' },
  ])
  assert.equal(r.bpa, 1100) // (10 + 11 + 12) / 3
  assert.equal(r.wpa, roundAverage((1100 + 1200 + 1500) / 3)) // 12.67
  const d = computeAverage([
    { cs: 1000, penalty: 'ok' },
    { cs: null, penalty: 'dnf' },
    { cs: 1100, penalty: 'ok' },
    { cs: 1500, penalty: 'ok' },
    { cs: null, penalty: 'ok' },
  ])
  assert.equal(d.wpa, Infinity)
  assert.equal(d.bpa, 1200)
})

ok('meta de média (sub-X) no 5º solve', () => {
  // 10, 11, 12, 15 → média = (11 + 12 + x)/3 para 10 ≤ x ≤ 15
  const r = neededForTarget([1000, 1100, 1200, 1500], 1200)
  assert.equal(r.kind, 'needed')
  if (r.kind === 'needed') {
    assert.ok(ao5([1000, 1100, 1200, 1500, r.maxResult]) < 1200)
    assert.ok(ao5([1000, 1100, 1200, 1500, r.maxResult + 1]) >= 1200)
  }
  assert.equal(neededForTarget([1000, 1100, 1200, 1500], 1300).kind, 'guaranteed')
  assert.equal(neededForTarget([1000, 1100, 1200, 1500], 1100).kind, 'impossible')
})

ok('média de 3 (Mo3): sem descartes, DNF derruba', () => {
  const sv = (cs: number) => ({ cs, penalty: 'ok' as const })
  const r = computeAverage([sv(t(3, 0)), sv(t(3, 10)), sv(t(3, 20)), sv(1), sv(1)], 'mo3')
  assert.equal(r.count, 3) // só os 3 primeiros contam
  assert.equal(r.average, t(3, 10))
  assert.deepEqual(r.dropped, [])
  assert.equal(r.bpa, null)
  // 9f1: média arredondada ao centésimo (1.005 → 1.01)
  assert.equal(mo3([100, 100, 101]), 100)
  assert.equal(mo3([100, 101, 101]), 101)
  const d = computeAverage([sv(t(3, 0)), { cs: null, penalty: 'dnf' }, sv(t(3, 20))], 'mo3')
  assert.equal(d.average, Infinity)
  const p = computeAverage([sv(t(3, 0)), sv(t(3, 20))], 'mo3')
  assert.equal(p.average, null)
  assert.equal(p.partialMean, t(3, 10))
})

ok('meta no último solve da média de 3', () => {
  // 6x6: 3:00 e 3:10, meta (PR) 3:05 → precisa x com (360+370+x)/3 < 305 s → x < 3:05 (≈ 3:04.99)
  const r = neededForTarget([t(3, 0), t(3, 10)], t(3, 5), 'mo3')
  assert.equal(r.kind, 'needed')
  if (r.kind === 'needed') {
    assert.ok(mo3([t(3, 0), t(3, 10), r.maxResult]) < t(3, 5))
    assert.ok(mo3([t(3, 0), t(3, 10), r.maxResult + 1]) >= t(3, 5))
  }
  // Mo3 nunca é "garantido" (DNF no último derruba a média).
  assert.notEqual(neededForTarget([100, 100], 99999, 'mo3').kind, 'guaranteed')
  assert.equal(neededForTarget([t(3, 0), Infinity], t(5, 0), 'mo3').kind, 'impossible')
})

ok('PRs de média vindos da WCA', () => {
  const [p] = parsePersons([
    {
      person: { name: 'Fulano', wca_id: '2017TEST01', country_iso2: 'BR' },
      personal_records: {
        '333': { average: { best: 1467 } },
        '666': { average: { best: 31628 } },
        '333fm': { average: { best: 3500 } }, // movimentos — fora
        '333mbf': {}, // sem média — fora
        '444bf': {}, // só single — fora
        '333ft': { average: { best: 37986 } }, // extinta — fora
      },
    },
  ])
  assert.equal(p.wcaId, '2017TEST01')
  const evs = eventsWithAverage(p.averages)
  assert.deepEqual(evs.map((e) => [e.id, e.format, e.pr]), [['333', 'ao5', 1467], ['666', 'mo3', 31628]])
  for (const id of ['666', '777', '444bf', '555bf']) assert.equal(averageFormatOf(id), 'mo3')
  assert.equal(averageFormatOf('333bf'), 'ao5')
})

console.log(`\n${n} testes OK`)
