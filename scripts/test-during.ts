// Ferramentas "Durante a Competição": EasyPassword, SchedManager, SmartRanks,
// SortCuber e o servidor do CSPTools (worker/index.ts).
//   npx tsx scripts/test-during.ts
import assert from 'node:assert/strict'
import {
  demoPasscodes,
  eventIdOf,
  groupPasscodes,
  parsePasscodes,
  sameCompetition,
} from '../src/tools/easypassword/model/parse'
import {
  applyDraft,
  buildRows,
  diffMinutes,
  localOf,
  normalizeTime,
  zonedToUtc,
} from '../src/tools/schedmanager/model/schedule'
import {
  ageOn,
  apsPoints,
  categoryStandings,
  formatResult,
  headline,
  personsInfo,
} from '../src/tools/smartranks/model/ranks'
import { candidates, DEFAULT_OPTIONS, draw, eligible, randomInt } from '../src/tools/sortcuber/model/draw'
import {
  applyChanges,
  emptyDraft,
  expiryFor,
  handleApi,
  validEntries,
  type Env,
  type KV,
} from '../worker/api'
import type { LiveCompetition, LiveEvent } from '../src/lib/wca/live'
import type { Wcif, WcifPerson } from '../src/lib/wca/types'

let n = 0
const ok = (msg: string) => {
  n++
  console.log(`✓ ${msg}`)
}

async function main() {
  // ------------------------------------------------------------ EasyPassword
  {
    const txt = [
      'SECRET SCRAMBLE SET PASSCODES',
      'Teste Open 2026',
      '',
      'Make sure that only Delegates have access to this file.',
      '3x3x3 Round 1 Scramble Set A: abcd1234',
      '3x3x3 Round 1 Scramble Set B: efgh5678',
      '3x3x3 Round 2 Scramble Set A: zzzz9999',
      '3x3x3 One-Handed Round 1 Scramble Set A: oh000001',
      'Square-1 Round 1 Scramble Set A: sq111111',
      '3x3x3 Fewest Moves Round 1 Scramble Set B Attempt 2: fm222222',
      '3x3x3 Multiple Blindfolded Round 1 Scramble Set A Attempt 1: mb333333',
      '',
    ].join('\r\n')
    const p = parsePasscodes(txt)
    assert.equal(p.title, 'Teste Open 2026')
    assert.equal(p.entries.length, 7)
    assert.equal(p.skipped.length, 0)
    assert.deepEqual(p.entries[5], {
      event: '3x3x3 Fewest Moves',
      eventId: '333fm',
      round: 1,
      set: 'B',
      attempt: 2,
      code: 'fm222222',
    })
    assert.equal(eventIdOf('3x3x3 Cube'), '333')
    assert.equal(eventIdOf('Square-1'), 'sq1')
    const g = groupPasscodes(p.entries)
    assert.deepEqual(
      g.map((e) => e.eventId),
      ['333', '333oh', 'sq1', '333fm', '333mbf'],
    )
    assert.deepEqual(
      g[0].rounds.map((r) => r.sets.map((s) => s.set).join('')),
      ['AB', 'A'],
    )
    assert.ok(sameCompetition('UNESP Rio Preto Open 2026', 'Unesp Rio Preto Open 2026'))
    assert.ok(!sameCompetition('Outra 2026', 'Teste Open 2026'))
    assert.ok(validEntries(p.entries), 'o servidor aceita o que o leitor produz')
    assert.equal(validEntries([{ ...p.entries[0], code: 'senha com espaço' }]), null)
    const demo = demoPasscodes([{ name: '3x3x3', eventId: '333', rounds: 2, sets: 3 }])
    assert.equal(demo.length, 5)
    assert.ok(demo.every((e) => /^[a-z0-9]{8}$/.test(e.code)))
  }
  ok('EasyPassword: leitura do arquivo do TNoodle')

  // ------------------------------------------------------------ SchedManager
  {
    assert.equal(normalizeTime('1015'), '10:15')
    assert.equal(normalizeTime('9:5'), '09:50')
    assert.equal(normalizeTime('10h30'), '10:30')
    assert.equal(normalizeTime('8'), '08:00')
    assert.equal(normalizeTime(''), '')
    assert.equal(normalizeTime('25:00'), null)
    assert.equal(normalizeTime('abc'), null)
    assert.equal(zonedToUtc('2026-10-31', '08:30', 'America/Sao_Paulo'), '2026-10-31T11:30:00Z')
    assert.deepEqual(localOf('2026-10-31T11:30:00Z', 'America/Sao_Paulo'), { date: '2026-10-31', time: '08:30' })
    assert.equal(zonedToUtc('2026-07-04', '10:00', 'America/New_York'), '2026-07-04T14:00:00Z', 'horário de verão')
    assert.equal(diffMinutes('10:20', '12:10'), 110)

    const act = (id: number, code: string, s: string, e: string, children: [number, string, string][] = []) => ({
      id,
      name: code,
      activityCode: code,
      startTime: s,
      endTime: e,
      childActivities: children.map(([cid, cs, ce], i) => ({
        id: cid,
        name: `${code}-g${i + 1}`,
        activityCode: `${code}-g${i + 1}`,
        startTime: cs,
        endTime: ce,
        childActivities: [],
      })),
    })
    const wcif: Wcif = {
      id: 'Teste2026',
      name: 'Teste 2026',
      persons: [],
      events: [
        {
          id: '333',
          rounds: [
            { id: '333-r1', format: 'a', timeLimit: null, cutoff: null, advancementCondition: null, scrambleSetCount: 2 },
          ],
        },
      ],
      schedule: {
        startDate: '2026-10-31',
        numberOfDays: 1,
        venues: [
          {
            id: 1,
            name: 'Local',
            timezone: 'America/Sao_Paulo',
            rooms: [
              {
                id: 1,
                name: 'Palco A',
                activities: [
                  act(1, '333-r1', '2026-10-31T13:00:00Z', '2026-10-31T14:00:00Z', [
                    [11, '2026-10-31T13:00:00Z', '2026-10-31T13:30:00Z'],
                    [12, '2026-10-31T13:30:00Z', '2026-10-31T14:00:00Z'],
                  ]),
                  act(2, 'other-lunch', '2026-10-31T15:00:00Z', '2026-10-31T16:00:00Z'),
                ],
              },
              {
                id: 2,
                name: 'Palco B',
                activities: [
                  act(3, '333-r1', '2026-10-31T13:00:00Z', '2026-10-31T14:00:00Z', [
                    [31, '2026-10-31T13:00:00Z', '2026-10-31T14:00:00Z'],
                  ]),
                ],
              },
            ],
          },
        ],
      },
    }
    const rows = buildRows(wcif)
    assert.equal(rows.length, 2, 'mesma rodada e mesmo horário em 2 palcos = 1 linha')
    assert.equal(rows[0].key, '333-r1@2026-10-31')
    assert.deepEqual(rows[0].activityIds, [1, 3])
    assert.equal(rows[0].plannedStart, '10:00')
    assert.equal(rows[0].plannedSets, 2)
    assert.equal(rows[0].groups, 2)
    let draft = emptyDraft('Teste2026')
    draft = applyChanges(
      draft,
      [
        { key: '333-r1@2026-10-31', field: 'start', value: '10:15' },
        { key: '333-r1@2026-10-31', field: 'end', value: '11:45' },
        { key: '333-r1', field: 'sets', value: 3 },
        { key: 'other-lunch@2026-10-31', field: 'end', value: '11:00' }, // antes do início: erro
      ],
      'Fulano',
      '2026-10-31T15:00:00Z',
    )
    assert.equal(draft.rev, 1)
    const res = applyDraft(wcif, rows, draft)
    assert.equal(res.changes.length, 1)
    assert.deepEqual(res.errors.map((e) => e.key), ['other-lunch@2026-10-31'])
    const a1 = res.schedule.venues[0].rooms[0].activities[0]
    assert.equal(a1.startTime, '2026-10-31T13:15:00Z')
    assert.equal(a1.endTime, '2026-10-31T14:45:00Z')
    assert.equal(a1.childActivities[0].endTime, '2026-10-31T14:00:00Z', 'grupos acompanham proporcionalmente')
    assert.equal(a1.childActivities[1].startTime, '2026-10-31T14:00:00Z')
    assert.equal(res.schedule.venues[0].rooms[1].activities[0].endTime, '2026-10-31T14:45:00Z', 'os dois palcos mudam')
    assert.equal(wcif.schedule.venues[0].rooms[0].activities[0].startTime, '2026-10-31T13:00:00Z', 'original intacto')
    assert.equal(res.events?.[0].rounds[0].scrambleSetCount, 3)
    assert.deepEqual(res.sets, [{ roundId: '333-r1', from: 2, to: 3 }])
    // Rascunho: apagar um campo, validação de entrada.
    draft = applyChanges(draft, [{ key: '333-r1@2026-10-31', field: 'start', value: null }], 'Beltrano', 'x')
    assert.equal(draft.rows['333-r1@2026-10-31'].start, undefined)
    assert.equal(draft.rows['333-r1@2026-10-31'].by, 'Beltrano')
    assert.throws(() => applyChanges(draft, [{ key: '333-r1@2026-10-31', field: 'start', value: '99:00' }], 'x', 'x'))
    assert.throws(() => applyChanges(draft, [{ key: '../hack', field: 'start', value: '10:00' }], 'x', 'x'))
    assert.throws(() => applyChanges(draft, [{ key: '333-r1', field: 'sets', value: 0 }], 'x', 'x'))
  }
  ok('SchedManager: horários locais, linhas por palco, aplicar no cronograma')

  // ------------------------------------------------------------ SmartRanks
  const person = (id: number, name: string, extra: Partial<WcifPerson> = {}): WcifPerson => ({
    registrantId: id,
    name,
    wcaId: `2020TEST${String(id).padStart(2, '0')}`,
    wcaUserId: 1000 + id,
    gender: 'm',
    registration: { eventIds: ['333'], status: 'accepted', isCompeting: true },
    assignments: [],
    roles: [],
    ...extra,
  })
  const people: WcifPerson[] = [
    person(1, 'Ana', { gender: 'f', birthdate: '2015-05-01' }),
    person(2, 'Bruno', { birthdate: '1980-01-01', roles: ['delegate'] }),
    person(3, 'Carla', { gender: 'f', wcaId: null, birthdate: '2010-12-31' }),
    person(4, 'Davi', { wcaId: null, birthdate: '2000-06-15' }),
    person(5, 'Eva', { gender: 'f', birthdate: '1975-03-03', roles: ['organizer'] }),
    person(6, 'Fábio', { registration: { eventIds: [], status: 'accepted', isCompeting: false } }),
  ]
  const wcifP: Wcif = { id: 'T', name: 'T', persons: people, events: [], schedule: { venues: [] } }
  const lp = (id: number) => ({
    id: String(id),
    name: people[id - 1].name,
    wcaId: people[id - 1].wcaId,
    registrantId: id,
    countryIso2: 'BR',
  })
  const res = (id: number, ranking: number, best: number, average: number) => ({
    ranking,
    best,
    average,
    attempts: [best, best, best, best, best],
    person: lp(id),
  })
  const ev333: LiveEvent = {
    eventId: '333',
    name: '3x3x3 Cube',
    rounds: [
      {
        id: 'r1',
        number: 1,
        name: 'First',
        finished: true,
        open: true,
        numResults: 5,
        format: { id: 'a', numberOfAttempts: 5, sortBy: 'average' },
        results: [res(2, 1, 900, 1000), res(1, 2, 1000, 1100), res(3, 3, 1200, 1300), res(4, 4, 1500, 1600), res(5, 5, -1, -1)],
      },
      {
        id: 'r2',
        number: 2,
        name: 'Final',
        finished: true,
        open: true,
        numResults: 3,
        format: { id: 'a', numberOfAttempts: 5, sortBy: 'average' },
        results: [res(1, 1, 950, 1050), res(3, 2, 1100, 1200), res(2, 3, 1000, -1)],
      },
    ],
  }
  const live: LiveCompetition = { liveId: '1', wcaId: 'T', name: 'T', events: [ev333], fetchedAt: '' }
  {
    const info = personsInfo(wcifP)
    const all = categoryStandings(ev333, { kind: 'all' }, info, '2026-10-31')
    assert.deepEqual(
      all.map((s) => `${s.position}${s.name}`),
      ['1Ana', '2Carla', '3Bruno', '4Davi'],
      'final primeiro; Eva (só DNF) fica de fora',
    )
    assert.deepEqual(
      categoryStandings(ev333, { kind: 'female' }, info, '2026-10-31').map((s) => `${s.position}${s.name}`),
      ['1Ana', '2Carla'],
    )
    assert.deepEqual(
      categoryStandings(ev333, { kind: 'newcomers' }, info, '2026-10-31').map((s) => `${s.position}${s.name}`),
      ['1Carla', '2Davi'],
    )
    assert.deepEqual(
      categoryStandings(ev333, { kind: 'age', mode: 'upTo', min: 0, max: 15 }, info, '2026-10-31').map((s) => s.name),
      ['Ana', 'Carla'],
    )
    assert.deepEqual(
      categoryStandings(ev333, { kind: 'age', mode: 'from', min: 40, max: 0 }, info, '2026-10-31').map((s) => s.name),
      ['Bruno'],
    )
    assert.deepEqual(
      categoryStandings(ev333, { kind: 'age', mode: 'between', min: 15, max: 30 }, info, '2026-10-31').map((s) => s.name),
      ['Carla', 'Davi'],
    )
    assert.equal(ageOn('2010-12-31', '2026-10-31'), 15)
    assert.equal(ageOn('2010-10-31', '2026-10-31'), 16)
    // Média DNF: mostra o melhor tempo.
    const bruno = all.find((s) => s.name === 'Bruno')!
    assert.deepEqual(headline(bruno, 'average', '333'), { kind: 'single', text: '10.00' })
    // Pontuação APS: TC/(P+1) por rodada.
    const pts = apsPoints(live, { kind: 'all' }, info, '2026-10-31')
    assert.deepEqual(
      pts.map((p) => `${p.position}${p.name}`),
      ['1Bruno', '2Ana', '3Carla', '4Davi', '5Eva'],
    )
    const ana = pts.find((p) => p.name === 'Ana')!
    assert.equal(ana.points, Math.round((5 / 3 + 3 / 2) * 100) / 100)
    assert.equal(ana.events, 1)
    assert.equal(ana.rounds, 2)
    assert.equal(formatResult(6543, '333', 'single'), '1:05.43')
    assert.equal(formatResult(3567, '333fm', 'average'), '35.67')
    assert.equal(formatResult(28, '333fm', 'single'), '28')
    assert.equal(formatResult(980359901, '333mbf', 'single'), '2/3 59:59', 'Multi-BLD: 1 ponto, 1 erro')
    assert.equal(formatResult(-1, '333', 'single'), 'DNF')
  }
  ok('SmartRanks: classificação final, categorias, idade e pontuação APS')

  // ------------------------------------------------------------ SortCuber
  {
    const all = candidates(wcifP)
    assert.equal(all.length, 5, 'staff não competidor fica de fora')
    const base = eligible(all, DEFAULT_OPTIONS, null, [])
    assert.deepEqual(
      base.map((c) => c.name),
      ['Ana', 'Carla', 'Davi'],
      'sem Delegados e Organizadores por padrão',
    )
    assert.deepEqual(
      eligible(all, { ...DEFAULT_OPTIONS, presentOnly: true, excluded: [4] }, new Set([1, 4]), []).map((c) => c.name),
      ['Ana'],
    )
    assert.deepEqual(
      eligible(all, DEFAULT_OPTIONS, null, [1]).map((c) => c.name),
      ['Carla', 'Davi'],
      'quem já ganhou não repete',
    )
    const winners = draw(base, 10)
    assert.equal(winners.length, 3)
    assert.equal(new Set(winners.map((w) => w.registrantId)).size, 3)
    // Uniforme: cada uma das 3 pessoas sai ~1/3 das vezes.
    const count = [0, 0, 0]
    for (let i = 0; i < 30000; i++) count[randomInt(3)]++
    assert.ok(count.every((c) => c > 9300 && c < 10700), `distribuição ${count}`)
    // Rejeição do viés: valor alto demais é descartado.
    let calls = 0
    const fake = (b: Uint32Array) => {
      b[0] = calls++ === 0 ? 0xffffffff : 5
      return b
    }
    assert.equal(randomInt(3, fake), 2)
    assert.equal(calls, 2)
  }
  ok('SortCuber: só aprovados, exclusões, presença e sorteio sem viés')

  // ------------------------------------------------------------ servidor
  {
    const store = new Map<string, { v: string; exp?: number }>()
    const kv: KV = {
      get: async (k) => store.get(k)?.v ?? null,
      put: async (k, v, o) => void store.set(k, { v, exp: o?.expiration }),
      delete: async (k) => void store.delete(k),
    }
    const env: Env = { CSP_KV: kv, WCA_ORIGIN: 'https://wca.test' }
    const users: Record<string, number> = { tDelegate: 10, tOrganizer: 20, tStaff: 30, tOther: 40 }
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const auth = new Headers(init?.headers).get('authorization') ?? ''
      const body = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status })
      if (url === 'https://wca.test/api/v0/me') {
        const t = auth.replace('Bearer ', '')
        return users[t] ? body({ me: { id: users[t], name: t, wca_id: null } }) : body({}, 401)
      }
      if (url === 'https://wca.test/api/v0/competitions/Teste2026')
        return body({
          id: 'Teste2026',
          name: 'Teste 2026',
          start_date: '2026-10-31',
          end_date: '2026-11-01',
          delegates: [{ id: 10 }],
          organizers: [{ id: 20 }],
        })
      if (url === 'https://wca.test/api/v0/competitions/Teste2026/wcif/public')
        return body({
          persons: [
            { wcaUserId: 30, roles: [], assignments: [{ assignmentCode: 'staff-judge' }] },
            { wcaUserId: 40, roles: [], assignments: [{ assignmentCode: 'competitor' }] },
          ],
        })
      return body({}, 404)
    }) as typeof fetch
    const call = async (method: string, path: string, token?: string, b?: unknown) => {
      const r = await handleApi(
        new Request(`https://csp.test${path}`, {
          method,
          headers: token ? { authorization: `Bearer ${token}` } : {},
          body: b !== undefined ? JSON.stringify(b) : undefined,
        }),
        env,
      )
      return { status: r.status, data: (await r.json()) as Record<string, unknown> }
    }
    try {
      const entries = parsePasscodes('SECRET SCRAMBLE SET PASSCODES\nTeste 2026\n3x3x3 Round 1 Scramble Set A: abc12345\n').entries
      assert.equal((await call('GET', '/api/passcodes/Teste2026')).status, 401, 'sem login')
      assert.equal((await call('GET', '/api/passcodes/Teste2026', 'tOrganizer')).status, 403, 'organizador não vê senhas')
      assert.equal((await call('PUT', '/api/passcodes/Teste2026', 'tStaff', { entries })).status, 403)
      assert.deepEqual((await call('GET', '/api/passcodes/Teste2026', 'tDelegate')).data, { empty: true }, 'ainda vazio')
      const put = await call('PUT', '/api/passcodes/Teste2026', 'tDelegate', { entries, fileName: 'x.txt', title: 'Teste 2026' })
      assert.equal(put.status, 200)
      const got = await call('GET', '/api/passcodes/Teste2026', 'tDelegate')
      assert.equal((got.data.entries as { code: string }[])[0].code, 'abc12345')
      assert.equal((got.data.uploadedBy as { name: string }).name, 'tDelegate')
      assert.equal(store.get('pass:Teste2026')!.exp, expiryFor('2026-11-01', 7, Date.parse('2026-10-31')))
      assert.equal((await call('PUT', '/api/passcodes/Teste2026', 'tDelegate', { entries: [{ bad: 1 }] })).status, 400)
      // Rascunho do cronograma: staff, organizador e Delegado; os outros não.
      assert.equal((await call('GET', '/api/schedule/Teste2026', 'tOther')).status, 403)
      for (const t of ['tStaff', 'tOrganizer', 'tDelegate'])
        assert.equal((await call('GET', '/api/schedule/Teste2026', t)).status, 200, t)
      const p1 = await call('PATCH', '/api/schedule/Teste2026', 'tStaff', {
        changes: [{ key: '333-r1@2026-10-31', field: 'start', value: '10:15' }],
      })
      assert.equal(p1.data.rev, 1)
      const p2 = await call('PATCH', '/api/schedule/Teste2026', 'tOrganizer', {
        changes: [{ key: '333-r1@2026-10-31', field: 'end', value: '11:00' }],
        savedToWca: true,
      })
      const rows = p2.data.rows as Record<string, { start?: string; end?: string }>
      assert.deepEqual([rows['333-r1@2026-10-31'].start, rows['333-r1@2026-10-31'].end], ['10:15', '11:00'], 'edições somam')
      assert.equal(p2.data.savedToWcaBy, 'tOrganizer')
      assert.equal(
        (await call('PATCH', '/api/schedule/Teste2026', 'tStaff', { changes: [{ key: 'x', field: 'start', value: '1' }] })).status,
        400,
      )
      assert.equal((await call('DELETE', '/api/passcodes/Teste2026', 'tDelegate')).status, 200)
      assert.equal(store.has('pass:Teste2026'), false)
      assert.equal((await call('GET', '/api/nada/Teste2026', 'tDelegate')).status, 404)
      // Expiração: nunca antes de amanhã.
      const now = Date.parse('2027-01-01T00:00:00Z')
      assert.equal(expiryFor('2026-10-01', 7, now), now / 1000 + 86400)
    } finally {
      globalThis.fetch = realFetch
    }
  }
  ok('Servidor: senhas só para Delegados, rascunho para o staff, validação e expiração')

  console.log(`\n${n} testes das ferramentas Durante OK`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
