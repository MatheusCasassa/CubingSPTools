// Regras do CubeStaff conferidas na competição de demonstração.
//   npx tsx scripts/test-cubestaff.ts
import assert from 'node:assert/strict'
import { demoCubeStaffWcif, demoPlan } from '../src/tools/cubestaff/model/demo'
import {
  agendaFor,
  generate,
  pendingRounds,
  scramblersFor,
  slotsByRound,
  slotOf,
} from '../src/tools/cubestaff/model/engine'
import { checkPlan } from '../src/tools/cubestaff/model/report'
import {
  buildWcif,
  changedOutside,
  planFromWcif,
  readExtension,
  diffAssignments,
  clearWcif,
} from '../src/tools/cubestaff/model/publish'
import { addStaff, candidates, moveCompetitor } from '../src/tools/cubestaff/model/edits'
import {
  compareRank,
  isAccepted,
  isApproved,
  isDelegate,
  isNewcomer,
  personsById,
} from '../src/tools/cubestaff/model/people'
import { parseCsv, toCsv } from '../src/tools/cubestaff/model/csv'
import {
  detectColumns,
  matchPerson,
  parseAvailability,
  parseEvents,
  readRows,
} from '../src/tools/cubestaff/model/staffImport'
import { lockKey, refId, type Plan } from '../src/tools/cubestaff/model/types'
import {
  BASE_EVENT,
  compareScramblers,
  isRareEvent,
  psychSheet,
  puzzleAllowed,
  scramblerRanking,
} from '../src/tools/cubestaff/model/scramblerRank'
import { presentAt } from '../src/tools/cubestaff/model/presence'
import { decodeStaffRow, encodePlan, encodedSize, EXTENSION_MAX_BYTES } from '../src/tools/cubestaff/model/codec'
import { listGroups, competitorsInGroup } from '../src/lib/wca/wcif'

let n = 0
const ok = (msg: string) => {
  n++
  console.log(`✓ ${msg}`)
}

const wcif = demoCubeStaffWcif()
const base = demoPlan(wcif)
const byId = personsById(wcif)
const firstRounds = wcif.events.map((e) => e.rounds[0].id)
const { plan, notes } = generate(wcif, base, { roundIds: firstRounds, now: '2026-10-16T12:00:00Z' })
const groups = Object.values(plan.rounds).flatMap((rp) => rp.groups.map((g) => ({ roundId: rp.roundId, g })))

// 1. Todos os inscritos presentes competem exatamente uma vez por rodada.
for (const roundId of firstRounds) {
  const eventId = roundId.split('-')[0]
  const expected = wcif.persons
    .filter((p) => p.registration?.status === 'accepted' && p.registration.eventIds.includes(eventId))
    .map((p) => p.registrantId!)
    .sort()
  const got = plan.rounds[roundId].groups.flatMap((g) => g.competitors).sort()
  assert.deepEqual(got, expected, roundId)
}
ok('todos os inscritos aprovados competem uma vez em cada 1ª rodada')

// 2. Uma função por vez — nenhum conflito de horário (inclusive entre palcos).
const errors = checkPlan(wcif, plan).filter((i) => i.level === 'error')
assert.equal(errors.length, 0, JSON.stringify(errors.slice(0, 3)))
for (const { g } of groups) {
  const staff = [...g.judges, ...g.scramblers, ...g.runners]
  assert.equal(new Set(staff).size, staff.length)
  for (const r of staff) assert.ok(!g.competitors.includes(refId(r)!))
}
ok('uma função por vez, sem conflito entre palcos simultâneos')

// 3. Novatos nunca são juízes nem embaralhadores; só a lista vira staff.
const list = new Set(base.staff.map((s) => s.registrantId))
for (const { g } of groups) {
  for (const r of [...g.judges, ...g.scramblers, ...g.runners]) {
    const p = byId.get(refId(r)!)!
    assert.ok(!isNewcomer(p), `novato no staff: ${p.name}`)
    assert.ok(list.has(p.registrantId!), `fora da lista: ${p.name}`)
  }
}
ok('novatos fora do staff; só candidatos aprovados')

// 4. Embaralhadores: 1 a cada 8 competidores; juízes ≤ estações.
assert.equal(scramblersFor(8, 8), 1)
assert.equal(scramblersFor(9, 8), 2)
assert.equal(scramblersFor(16, 8), 2)
assert.equal(scramblersFor(17, 8), 3)
for (const { roundId, g } of groups) {
  if (roundId.startsWith('333fm')) continue
  assert.ok(g.judges.length <= plan.config.stations)
  assert.ok(g.scramblers.length <= scramblersFor(g.competitors.length, 8))
}
ok('embaralhadores proporcionais (8 em 8) e juízes até o nº de estações')

// 5. Embaralhadores bem ranqueados: quem tem resultado no evento (ou na
// modalidade principal) vem antes do Sum of Ranks, que só completa a lista.
for (const { roundId, g } of groups) {
  const ranking = scramblerRanking(wcif, roundId.split('-')[0])
  for (const r of g.scramblers) {
    const p = byId.get(refId(r)!)!
    assert.ok(ranking.byId.has(p.registrantId!), `${p.name} embaralhando ${roundId} sem ranking`)
  }
}
{
  const ranking = scramblerRanking(wcif, '333')
  const scores = [...ranking.byId.values()]
  assert.ok(scores.filter((x) => x.source === 'event').every((x) => x.score <= 1))
  assert.ok(!ranking.rare)
  assert.ok(
    scores.every((x) => x.source !== 'sor'),
    'Sum of Ranks não vale em evento normal',
  )
}
ok('embaralhadores pelo ranking do evento (Sum of Ranks fora em evento normal)')

// 6. Disponibilidade: quem só está na manhã de sábado não é escalado à tarde.
const partial = base.staff
  .filter((s) => s.availability?.['2026-11-14']?.afternoon === false)
  .map((s) => `p${s.registrantId}`)
const scheds = slotsByRound(wcif, plan)
for (const { roundId, g } of groups) {
  const slot = slotOf(scheds.get(roundId), g.number)
  if (slot.start == null) continue
  const sp = new Date(slot.start)
  const afternoonSat = sp.toISOString().startsWith('2026-11-14') && sp.getUTCHours() - 3 >= 12
  if (!afternoonSat) continue
  for (const r of [...g.judges, ...g.scramblers, ...g.runners])
    assert.ok(!partial.includes(r), `${r} indisponível em ${roundId}`)
}
ok('disponibilidade (manhã/tarde) respeitada')

// 7. Novatos concentrados nos primeiros grupos (100%).
const g333 = plan.rounds['333-r1'].groups
const newcomersIn = (i: number) => g333[i].competitors.filter((id) => isNewcomer(byId.get(id)!)).length
assert.ok(newcomersIn(0) >= newcomersIn(g333.length - 1))
assert.equal(newcomersIn(g333.length - 1), 0)
ok('novatos concentrados nos grupos iniciais')

// 8. Modo mesclado espalha novatos.
const mixed = generate(
  wcif,
  { ...base, config: { ...base.config, distribution: 'mixed' } },
  { roundIds: ['333-r1'] },
).plan
const nm = mixed.rounds['333-r1'].groups.map((g) => g.competitors.filter((id) => isNewcomer(byId.get(id)!)).length)
assert.ok(Math.max(...nm) - Math.min(...nm) <= 1, String(nm))
ok('modo mesclado distribui novatos por igual')

// 9. 50% novatos.
const half = generate(wcif, { ...base, config: { ...base.config, newcomerShare: 50 } }, { roundIds: ['333-r1'] }).plan
const g1 = half.rounds['333-r1'].groups[0]
const n1 = g1.competitors.filter((id) => isNewcomer(byId.get(id)!)).length
assert.ok(n1 <= Math.ceil(g1.competitors.length / 2))
ok('grupos com 50% de novatos')

// 10. Delegados: fora do staff quando há staff expressivo.
const lots = structuredClone(base)
lots.config.stations = 4
const lotsPlan = generate(wcif, lots, { roundIds: ['222-r1'] }).plan
for (const g of lotsPlan.rounds['222-r1'].groups)
  for (const r of [...g.judges, ...g.scramblers])
    assert.ok(!isDelegate(byId.get(refId(r)!)!), 'Delegado escalado com staff de sobra')
ok('Delegados fora de juiz/embaralhador com staff expressivo')

// 11. Travas: edição manual sobrevive a gerar de novo.
const someone = plan.rounds['333-r1'].groups[0].competitors.at(-1)!
let edited: Plan = moveCompetitor(plan, '333-r1', someone, 3)
const judgeRef = base.staff
  .map((s) => `p${s.registrantId}`)
  .find(
    (r) =>
      !edited.rounds['222-r1'].groups[1].competitors.includes(refId(r)!) &&
      !edited.rounds['222-r1'].groups[1].judges.includes(r),
  )!
edited = addStaff(edited, '222-r1', 2, 'judge', judgeRef)
const regen = generate(wcif, edited, { roundIds: ['333-r1', '222-r1'] }).plan
assert.ok(regen.rounds['333-r1'].groups[2].competitors.includes(someone))
assert.ok(regen.rounds['222-r1'].groups[1].judges.includes(judgeRef))
assert.ok(regen.rounds['222-r1'].groups[1].locked.includes(lockKey('judge', judgeRef)))
ok('itens travados preservados ao gerar de novo')

// 12. Rodadas seguintes: geradas só com resultados; o resto fica intacto.
const pending = pendingRounds(wcif, plan)
assert.deepEqual(
  pending.map((p) => p.roundId),
  ['pyram-r2'],
)
assert.equal(pending[0].count, 16)
const upd = generate(wcif, plan, { roundIds: ['pyram-r2'] }).plan
assert.deepEqual(upd.rounds['333-r1'], plan.rounds['333-r1'])
assert.equal(upd.rounds['pyram-r2'].groups.flatMap((g) => g.competitors).length, 16)
assert.ok(notes.every((x) => x.roundId !== '333-r2'))
ok('"Atualizar rodadas seguintes" gera só o que tem resultado, sem mexer no resto')

// 13. Publicação no WCIF: atividades evento-rN-gK + assignments, lidas pelo ScoreComps.
const built = buildWcif(wcif, upd)
assert.deepEqual(built.skipped, [])
const gs = listGroups(built.wcif, '333-r1')
assert.equal(gs.length, 4)
assert.equal(
  gs.reduce((s, g) => s + competitorsInGroup(built.wcif, g.activityIds).length, 0),
  upd.rounds['333-r1'].groups.flatMap((g) => g.competitors).length,
)
const ids = new Set<number>()
const walk = (as: { id: number; childActivities: typeof as }[]) =>
  as.forEach((a) => (assert.ok(!ids.has(a.id), 'id duplicado'), ids.add(a.id), walk(a.childActivities)))
built.wcif.schedule.venues.forEach((v) => v.rooms.forEach((r) => walk(r.activities)))
const fm = built.wcif.persons.find((p) => p.registration?.eventIds.includes('333fm'))!
assert.equal(fm.assignments.filter((a) => a.assignmentCode === 'competitor' && ids.has(a.activityId)).length > 0, true)
ok('publica grupos no WCIF (ids únicos, FMC nas tentativas)')

// 14. Extensão: o plano volta igual (vinculado à competição) e detecta edição externa.
const back = planFromWcif(built.wcif)
assert.equal(back.from, 'extension')
const norm = (p: Plan) =>
  Object.fromEntries(
    Object.entries(p.rounds).map(([id, rp]) => [
      id,
      rp.groups.map((g) => ({
        ...g,
        competitors: [...g.competitors].sort(),
        judges: [...g.judges].sort(),
        scramblers: [...g.scramblers].sort(),
        runners: [...g.runners].sort(),
      })),
    ]),
  )
assert.deepEqual(norm(back.plan), norm(upd))
assert.deepEqual(back.plan.config, upd.config)
assert.deepEqual(back.plan.extras, upd.extras)
assert.deepEqual(readExtension(built.wcif)!.staff, upd.staff)
assert.deepEqual(changedOutside(built.wcif, back.plan), [])
const tampered = structuredClone(built.wcif)
const g1ids = new Set(listGroups(tampered, '333-r1')[0].activityIds)
const victim = tampered.persons.find((p) =>
  p.assignments.some((a) => a.assignmentCode === 'competitor' && g1ids.has(a.activityId)),
)!
victim.assignments = victim.assignments.filter((a) => !g1ids.has(a.activityId))
assert.ok(changedOutside(tampered, back.plan).length > 0)
ok('plano salvo na extensão e edição fora do CubeStaff detectada')

// 15. Republicar não duplica atividades nem muda ids.
const again = buildWcif(built.wcif, back.plan)
assert.deepEqual(
  listGroups(again.wcif, '333-r1').map((g) => g.activityIds),
  gs.map((g) => g.activityIds),
)
assert.equal(diffAssignments(built.wcif, again.wcif).length, 0)
ok('republicar é idempotente')

// 16. Importa grupos já existentes (Groupifier / Delegate Dashboard).
const foreign = structuredClone(built.wcif)
foreign.extensions = []
const imported = planFromWcif(foreign)
assert.equal(imported.from, 'wcif')
assert.deepEqual(
  imported.plan.rounds['333-r1'].groups.map((g) => g.competitors.length),
  upd.rounds['333-r1'].groups.map((g) => g.competitors.length),
)
ok('importa grupos criados em outras ferramentas')

// 17. CSV do Google Forms (Brasileiro 2026).
const headers = [
  'Carimbo de data/hora',
  'Email para contato:',
  'Número para whatsapp',
  'Qual sua ID da WCA? Caso não tenha uma, preencha com seu nome completo.',
  'Você tem interesse em ser embaralhador no Brasileiro?',
  'Indique se quer ser embaralhador no Brasileiro e, se sim, selecione os puzzles os quais você tem experiência embaralhando em campeonatos da WCA.',
  'Se indicou querer ser embaralhador, liste todos os eventos em quais é permitido que o embaralhamento esteja incorreto e qual a condição para que seja permitido enviar um puzzle embaralhado incorretamente. (Caso não souber, escreva "Não sei.")',
  'Se indicou querer ser embaralhador, explique qual o procedimento extra de verificação de embaralhamento recomendado para competidores capazes de algum recorde e competidores em uma final de campeonato nacional, continental ou mundial. (Caso não souber, escreva "Não sei.")',
  'Selecione todos que se apliquem.',
  'Você tem interesse em ajudar na equipe de Marketing?',
  'Se selecionou que quer fazer parte da equipe de Marketing, liste a baixo quaisquer links relevantes sobre sua experiência em Marketing.',
  'Selecione todos os eventos para os quais está inscrito no Brasileiro.',
  'Selecione todos os horários em que estará presente no campeonato (e portanto disponível para agir como staff). [Manhã]',
  'Selecione todos os horários em que estará presente no campeonato (e portanto disponível para agir como staff). [Tarde]',
]
const p1 = wcif.persons[10]
const p2 = wcif.persons.find((p) => !p.wcaId)!
const csv = toCsv([
  headers,
  [
    '2026/07/01',
    'x@y.com',
    '11 9',
    p1.wcaId,
    'Sim',
    '3x3x3, Pyraminx, Clock',
    'Não sei.',
    'Não sei.',
    'Juiz, Runner',
    'Não',
    '',
    '3x3x3',
    'Sábado, Domingo',
    'Sábado',
  ],
  [
    '2026/07/02',
    'z@y.com',
    '11 8',
    p2.name.toUpperCase(),
    'Não',
    '',
    '',
    '',
    'Juiz',
    'Não',
    '',
    '3x3x3',
    '',
    'Domingo',
  ],
])
const table = parseCsv(csv)
assert.equal(table.length, 3)
const map = detectColumns(table[0])
assert.equal(map.fields.identity, 3)
assert.equal(map.fields.email, 1)
assert.equal(map.fields.phone, 2)
assert.equal(map.fields.scramblerInterest, 4)
assert.equal(map.fields.scramblePuzzles, 5)
assert.equal(map.fields.applies, 8)
assert.deepEqual(map.availability, [12, 13])
assert.deepEqual(map.notes, [6, 7])
const rows = readRows(wcif, table, map)
assert.equal(rows[0].registrantId, p1.registrantId)
assert.equal(rows[0].how, 'wcaId')
assert.deepEqual(rows[0].roles, ['judge', 'runner', 'scrambler'])
assert.deepEqual(rows[0].scramblePuzzles, ['333', 'pyram', 'clock'])
assert.deepEqual(rows[0].availability, {
  '2026-11-14': { morning: true, afternoon: true },
  '2026-11-15': { morning: true, afternoon: false },
})
assert.equal(rows[1].registrantId, p2.registrantId)
assert.equal(rows[1].scrambler, false)
assert.deepEqual(rows[1].availability, {
  '2026-11-14': { morning: false, afternoon: false },
  '2026-11-15': { morning: false, afternoon: true },
})
assert.deepEqual(parseEvents('2x2x2 Cube, 3x3x3 Blindfolded, Square-1, Megaminx'), ['222', '333bf', 'sq1', 'minx'])
assert.deepEqual(parseAvailability(['[Sábado]'], [0], ['Manhã'], ['2026-11-14', '2026-11-15'])!['2026-11-14'], {
  morning: true,
  afternoon: false,
})
ok('importa CSV do formulário (ID/nome, funções, puzzles, manhã/tarde)')

// 18. Agenda do plano bate com a conferência.
assert.ok(agendaFor(wcif, upd).staffCount(upd.rounds['333-r1'].groups[0].judges[0]) >= 1)
ok('carga de staff contabilizada')

// 19. Suplentes: livres no horário (nem competem nem fazem staff em grupo simultâneo).
{
  const ag = agendaFor(wcif, plan)
  const sc = slotsByRound(wcif, plan)
  for (const { roundId, g } of groups) {
    const slot = slotOf(sc.get(roundId), g.number)
    for (const r of g.reserves) assert.ok(!ag.isBusy(r, slot), `suplente ocupado: ${r} em ${roundId} g${g.number}`)
    assert.ok(g.reserves.length <= plan.config.reservesPerGroup)
  }
}
ok('suplentes livres no horário do grupo')

// 20. Extensão cabe no limite da WCA (coluna TEXT de 64 KB) numa competição grande.
{
  const big = demoCubeStaffWcif()
  const orig = big.persons.slice()
  for (let k = 1; k < 5; k++)
    for (const p of orig)
      big.persons.push({
        ...structuredClone(p),
        registrantId: p.registrantId! + 100 * k,
        name: `${p.name} ${k}`,
        wcaId: p.wcaId ? p.wcaId.slice(0, 8) + String(k).padStart(2, '0') : null,
      })
  const bp = demoPlan(big)
  bp.staff = big.persons
    .filter((p) => p.wcaId)
    .slice(0, 250)
    .map((p) => ({
      registrantId: p.registrantId!,
      roles: [],
      preferred: [],
      scrambler: true,
      scramblePuzzles: ['333', '222'],
      availability: {
        '2026-11-14': { morning: true, afternoon: false },
        '2026-11-15': { morning: true, afternoon: true },
      },
    }))
  for (const k of Object.keys(bp.config.groupsByRound)) bp.config.groupsByRound[k] *= 4
  const gen = generate(big, bp, { roundIds: big.events.map((e) => e.rounds[0].id) }).plan
  assert.ok(encodedSize(encodePlan(gen, big)) < EXTENSION_MAX_BYTES, 'rascunho grande demais')
  const pub = buildWcif(big, gen)
  const back2 = readExtension(pub.wcif)!
  assert.equal(back2.staff.length, 250)
  assert.deepEqual(back2.staff[0].availability, bp.staff[0].availability)
  assert.equal(Object.keys(back2.rounds).length, Object.keys(gen.rounds).length)
}
ok('extensão compacta cabe no limite da WCA (420 competidores)')

// 21. Só inscrições APROVADAS: pendentes/canceladas não competem, não fazem
// staff, não viram suplentes, não aparecem para escolha nem casam no CSV.
{
  const notApproved = wcif.persons.filter((p) => p.registration?.status !== 'accepted')
  assert.ok(notApproved.length >= 3, 'demo precisa de inscrições não aprovadas')
  const bad = new Set(notApproved.map((p) => p.registrantId!))
  const badRefs = new Set([...bad].map((id) => `p${id}`))
  assert.ok(
    base.staff.some((s) => bad.has(s.registrantId)),
    'demo deveria ter pendente na lista de staff',
  )
  for (const rp of Object.values(upd.rounds))
    for (const g of rp.groups) {
      for (const id of g.competitors) assert.ok(!bad.has(id), `não aprovado competindo: ${id}`)
      for (const r of [...g.judges, ...g.scramblers, ...g.runners, ...g.reserves])
        assert.ok(!badRefs.has(r), `não aprovado no staff: ${r}`)
    }
  assert.ok(candidates(wcif, upd, '333-r1', 1, 'judge').every((c) => !badRefs.has(c.ref)))
  assert.ok(candidates(wcif, upd, '333-r1', 1, 'competitor').every((c) => !badRefs.has(c.ref)))
  const pend = notApproved[0]
  assert.deepEqual(matchPerson(wcif, pend.wcaId, '', pend.name), { registrantId: null, how: 'notApproved' })
  // Inscrição cancelada depois de gerar: a conferência acusa e gerar de novo tira a pessoa.
  const later = structuredClone(wcif)
  const victim = upd.rounds['333-r1'].groups[0].competitors[0]
  later.persons.find((p) => p.registrantId === victim)!.registration!.status = 'deleted'
  assert.ok(checkPlan(later, upd).some((i) => i.code === 'notApproved' && i.ref === `p${victim}`))
  const again = generate(later, upd, { roundIds: ['333-r1'] }).plan
  assert.ok(!again.rounds['333-r1'].groups.some((g) => g.competitors.includes(victim)))
}
ok('só inscrições aprovadas (pendentes/canceladas ficam de fora)')

// 22. A WCA remove valores null ao salvar a extensão (Cuber Brasil Sumaré 2026):
// o formato não pode depender de null, e o formato antigo (já salvo) é lido certo.
{
  const stripNulls = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.filter((x) => x != null).map(stripNulls)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([, x]) => x != null)
              .map(([k, x]) => [k, stripNulls(x)]),
          )
        : v
  const stored = structuredClone(built.wcif)
  for (const e of stored.extensions ?? []) e.data = stripNulls(e.data)
  const viaWca = readExtension(stored)!
  assert.deepEqual(viaWca.staff, upd.staff)
  // Linhas antigas como ficaram na WCA: [id, funções, preferida, puzzles] (nulls removidos).
  const days = ['2026-11-14', '2026-11-15']
  assert.equal(decodeStaffRow(['1', '', '', ''], days).scrambler, null)
  assert.deepEqual(decodeStaffRow(['1', 'js', 'j', '333,pyram'], days).scramblePuzzles, ['333', 'pyram'])
  const old = decodeStaffRow(['a', 'js', 's', 1, '333', '1011'], days)
  assert.equal(old.scrambler, true)
  assert.deepEqual(old.availability, {
    '2026-11-14': { morning: true, afternoon: false },
    '2026-11-15': { morning: true, afternoon: true },
  })
  assert.equal(decodeStaffRow(['a', '', '', 0, ''], days).scrambler, false)
  assert.equal(decodeStaffRow(['a', '', '', '', '1011'], days).availability?.['2026-11-14'].afternoon, false)
}
ok('extensão sobrevive à WCA removendo null (embaralhadores voltam)')

// 23. "Limpar tudo" na WCA: sem grupos, sem atribuições deles, sem extensão;
// cronograma (rodadas) e outras atribuições intactos.
{
  const pub = buildWcif(wcif, upd).wcif
  const other = pub.persons[0]
  const roundAct = pub.schedule.venues[0].rooms[0].activities.find((a) => a.activityCode === '333-r1')!
  other.assignments.push({ activityId: roundAct.id, assignmentCode: 'staff-dataentry', stationNumber: null })
  const cleared = clearWcif(pub, back.plan)
  for (const r of ['333-r1', '222-r1', 'pyram-r2']) assert.equal(listGroups(cleared, r).length, 0)
  const ids = new Set<number>()
  const all = (as: { id: number; activityCode: string; childActivities: typeof as }[]) =>
    as.forEach((a) => (ids.add(a.id), all(a.childActivities)))
  cleared.schedule.venues.forEach((v) => v.rooms.forEach((r) => all(r.activities)))
  const fmIds = new Set<number>()
  cleared.schedule.venues.forEach((v) =>
    v.rooms.forEach((r) =>
      r.activities.filter((a) => a.activityCode.startsWith('333fm')).forEach((a) => fmIds.add(a.id)),
    ),
  )
  for (const p of cleared.persons)
    for (const a of p.assignments) {
      assert.ok(ids.has(a.activityId), 'atribuição apontando para atividade removida')
      assert.ok(!(fmIds.has(a.activityId) && a.assignmentCode === 'competitor'), 'FMC continua atribuído')
    }
  assert.ok(
    cleared.persons[0].assignments.some((a) => a.assignmentCode === 'staff-dataentry'),
    'apagou atribuição de fora',
  )
  assert.equal(readExtension(cleared), null)
  assert.equal(planFromWcif(cleared).from, 'empty')
  assert.equal(
    cleared.schedule.venues[0].rooms[0].activities.length,
    pub.schedule.venues[0].rooms[0].activities.length,
    'rodadas do cronograma mantidas',
  )
}
ok('"Limpar tudo" na WCA volta a competição ao estado sem CubeStaff')

// 24. Variantes usam a modalidade principal (3BLD/OH/MBLD → 3x3, 4BLD → 4x4,
// 5BLD → 5x5) e evento novo (poucos com resultado, ex.: FTO) usa o Sum of Ranks.
{
  assert.equal(BASE_EVENT['333bf'], '333')
  assert.equal(BASE_EVENT['333oh'], '333')
  assert.equal(BASE_EVENT['333mbf'], '333')
  assert.equal(BASE_EVENT['444bf'], '444')
  assert.equal(BASE_EVENT['555bf'], '555')
  // Quem é o melhor no 3x3 mas nunca fez 3BLD fica no topo do 3BLD.
  const w2 = structuredClone(wcif)
  const best333 = w2.persons
    .filter((p) => isApproved(p) && p.personalBests?.some((b) => b.eventId === '333' && b.type === 'average'))
    .sort((a, b) => compareRank(a, b, '333'))[0]
  best333.personalBests = best333.personalBests!.filter((b) => b.eventId !== '333bf')
  const bld = scramblerRanking(w2, '333bf')
  assert.equal(bld.byId.get(best333.registrantId!)?.source, 'base')
  assert.equal(bld.byId.get(best333.registrantId!)?.score, 0)
  // FTO novo: quase ninguém tem resultado → Sum of Ranks vale igual.
  const w3 = structuredClone(wcif)
  w3.events.push({
    id: 'fto',
    rounds: [{ id: 'fto-r1', format: 'a', timeLimit: null, cutoff: null, advancementCondition: null }],
  })
  const ftoPeople = w3.persons.filter((p) => isAccepted(p) && p.wcaId).slice(0, 20)
  ftoPeople.forEach((p) => p.registration!.eventIds.push('fto'))
  ftoPeople[19].personalBests = [...(ftoPeople[19].personalBests ?? []), { eventId: 'fto', best: 9000, type: 'single' }]
  for (const p of w3.persons)
    p.personalBests = (p.personalBests ?? []).map((b, i) => ({
      ...b,
      worldRanking: b.worldRanking ?? 1000 + ((p.registrantId! * 37 + i * 11) % 5000),
    }))
  assert.ok(isRareEvent(w3, 'fto'))
  const fto = scramblerRanking(w3, 'fto')
  assert.ok(fto.rare)
  const top = [...fto.byId.entries()].sort((a, b) => a[1].score - b[1].score)[0]
  assert.equal(top[1].source, 'sor')
  assert.ok(top[1].score < 1, 'em evento novo o Sum of Ranks não é só reserva')
  // Puzzles do formulário: 3x3 marcado libera 3BLD; FTO novo não exclui ninguém.
  const entry = { scrambler: true, scramblePuzzles: ['333'] }
  assert.ok(puzzleAllowed(entry, scramblerRanking(wcif, '333bf')))
  assert.ok(!puzzleAllowed(entry, scramblerRanking(wcif, 'skewb')))
  assert.ok(puzzleAllowed(entry, fto))
}
ok('variantes pela modalidade principal e evento novo pelo Sum of Ranks')

// 25. Presença pelos dias das modalidades: quem só faz 3BLD (domingo na demo)
// não é escalado no sábado — nem como suplente.
{
  const w4 = structuredClone(wcif)
  const sundayOnly = w4.persons
    .filter((p) => isAccepted(p) && p.wcaId && base.staff.some((s) => s.registrantId === p.registrantId))
    .slice(0, 6)
  sundayOnly.forEach((p) => (p.registration!.eventIds = ['333bf']))
  const ids = new Set(sundayOnly.map((p) => `p${p.registrantId}`))
  assert.ok(!presentAt(w4, sundayOnly[0], Date.parse('2026-11-14T13:00:00Z')))
  assert.ok(presentAt(w4, sundayOnly[0], Date.parse('2026-11-15T13:00:00Z')))
  const gen = generate(w4, base, { roundIds: w4.events.map((e) => e.rounds[0].id) }).plan
  const sc = slotsByRound(w4, gen)
  let sundayStaff = 0
  for (const rp of Object.values(gen.rounds))
    for (const g of rp.groups) {
      const start = slotOf(sc.get(rp.roundId), g.number).start!
      const saturday = new Date(start - 3 * 3600000).toISOString().startsWith('2026-11-14')
      for (const r of [...g.judges, ...g.scramblers, ...g.runners, ...g.reserves])
        if (ids.has(r)) {
          assert.ok(!saturday, `${r} escalado no sábado sem modalidade no sábado`)
          sundayStaff++
        }
    }
  assert.ok(sundayStaff > 0, 'deveria ser escalado no domingo')
  assert.equal(checkPlan(w4, gen).filter((i) => i.code === 'otherDay').length, 0)
  // Desligado: pode ser escalado no sábado.
  const off = generate(
    w4,
    { ...base, config: { ...base.config, presenceByEvents: false } },
    { roundIds: ['333-r1'] },
  ).plan
  assert.ok(
    off.rounds['333-r1'].groups.some((g) => [...g.judges, ...g.scramblers, ...g.reserves].some((r) => ids.has(r))),
  )
}
ok('presença pelos dias das modalidades inscritas')

// 26. Delegados competindo ficam em grupos diferentes (3 Delegados, 2 grupos → 2 + 1).
{
  const w5 = structuredClone(wcif)
  const extra = w5.persons.filter((p) => isAccepted(p) && p.wcaId && !isDelegate(p)).slice(0, 2)
  extra.forEach((p) => (p.roles = ['delegate']))
  const cfg5 = {
    ...base,
    config: { ...base.config, groupsByRound: { ...base.config.groupsByRound, '333oh-r1': 2, '333-r1': 4 } },
  }
  const gen = generate(w5, cfg5, { roundIds: w5.events.map((e) => e.rounds[0].id) }).plan
  const pById = personsById(w5)
  let checked = 0
  for (const rp of Object.values(gen.rounds)) {
    if (rp.groups.length < 2) continue
    const per = rp.groups.map((g) => g.competitors.filter((id) => isDelegate(pById.get(id)!)).length)
    const total = per.reduce((a, b) => a + b, 0)
    if (total < 2) continue
    checked++
    assert.ok(Math.max(...per) - Math.min(...per) <= 1, `${rp.roundId}: Delegados juntos ${per}`)
    if (total <= rp.groups.length)
      assert.ok(
        per.every((x) => x <= 1),
        `${rp.roundId}: ${per}`,
      )
  }
  assert.ok(checked >= 3, 'deveria haver rodadas com vários Delegados')
  // Todos continuam competindo exatamente uma vez.
  for (const rp of Object.values(gen.rounds)) {
    const all = rp.groups.flatMap((g) => g.competitors)
    assert.equal(new Set(all).size, all.length)
  }
  assert.equal(checkPlan(w5, gen).filter((i) => i.level === 'error').length, 0)
}
ok('Delegados separados em grupos diferentes ao competir')

// 27. Embaralham os melhores INSCRITOS no evento (Psych Sheet). Quem é muito
// bom mas não está inscrito só entra em último caso.
{
  const w6 = structuredClone(wcif)
  const ev = 'pyram'
  const ranked = w6.persons
    .filter(
      (p) => isAccepted(p) && p.registration?.eventIds.includes(ev) && p.personalBests?.some((b) => b.eventId === ev),
    )
    .sort((a, b) => compareRank(a, b, ev))
  const star = ranked[0]
  star.registration!.eventIds = star.registration!.eventIds.filter((e) => e !== ev)
  const rk = scramblerRanking(w6, ev)
  assert.equal(rk.byId.get(star.registrantId!)?.registered, false)
  assert.equal(rk.byId.get(star.registrantId!)?.score, 0, 'continua o melhor no ranking puro')
  assert.ok(compareScramblers(ranked.at(-1)!, star, rk) < 0, 'inscrito pior vem antes de não inscrito melhor')
  assert.equal(psychSheet(w6, ev).get(ranked[1].registrantId!), 1, 'Psych Sheet só com inscritos')
  const cfg6: Plan = {
    ...base,
    staff: base.staff.some((s) => s.registrantId === star.registrantId)
      ? base.staff
      : [
          ...base.staff,
          {
            registrantId: star.registrantId!,
            roles: [],
            preferred: [],
            scrambler: null,
            scramblePuzzles: [],
            availability: null,
          },
        ],
  }
  const gen = generate(w6, cfg6, { roundIds: [`${ev}-r1`] }).plan
  const scr = gen.rounds[`${ev}-r1`].groups.flatMap((g) => g.scramblers)
  assert.ok(scr.length > 0)
  assert.ok(!scr.includes(`p${star.registrantId}`), 'não inscrito não embaralha havendo inscritos livres')
  for (const r of scr) assert.ok(rk.byId.get(refId(r)!)?.registered, `${r} deveria estar inscrito`)
}
ok('embaralhadores: inscritos no evento primeiro, não inscritos só em último caso')

console.log(`\n${n} testes do CubeStaff OK`)
