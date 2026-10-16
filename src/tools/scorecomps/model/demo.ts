// Competição FICTÍCIA para testar o ScoreComps sem login (localhost / demo).
// Cobre todos os casos de regra: Ao5 sem corte, Ao5 com corte, Mo3 com corte,
// 3BLD Bo5 com limite cumulativo, FMC, rodadas seguintes (súmulas em branco),
// nomes longos, CJK, cirílico e acentos.

import type { Wcif, WcifActivity, WcifEvent, WcifPerson, WcifResult } from '../../../lib/wca/types'

const FIRST = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João',
  'Karina', 'Lucas', 'Mariana', 'Nicolas', 'Olívia', 'Pedro', 'Rafaela', 'Samuel', 'Tatiane', 'Vinícius',
]
const LAST = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Ferreira', 'Costa', 'Rodrigues', 'Almeida',
  'Nascimento', 'Carvalho', 'Gomes', 'Martins', 'Araújo', 'Ribeiro',
]
const SPECIAL = [
  'Pedro Henrique Maciel Ceccopieri Belo (陈昊然)',
  'Yuxuan Wang (王宇轩)',
  'Min-jun Kim (김민준)',
  'Алексей Смирнов',
  'Maria Luíza Albuquerque de Vasconcellos Cavalcanti',
  'Łukasz Wiśniewski',
]

type EventSpec = { id: string; rounds: WcifEvent['rounds'] }

const EVENTS: EventSpec[] = [
  {
    id: '333',
    rounds: [
      { id: '333-r1', format: 'a', timeLimit: { centiseconds: 60000, cumulativeRoundIds: [] }, cutoff: null, advancementCondition: { type: 'ranking', level: 16 } },
      { id: '333-r2', format: 'a', timeLimit: { centiseconds: 60000, cumulativeRoundIds: [] }, cutoff: null, advancementCondition: null },
    ],
  },
  {
    id: '444',
    rounds: [
      { id: '444-r1', format: 'a', timeLimit: { centiseconds: 18000, cumulativeRoundIds: [] }, cutoff: { numberOfAttempts: 2, attemptResult: 9000 }, advancementCondition: null },
    ],
  },
  {
    id: '666',
    rounds: [
      { id: '666-r1', format: 'm', timeLimit: { centiseconds: 36000, cumulativeRoundIds: [] }, cutoff: { numberOfAttempts: 1, attemptResult: 18000 }, advancementCondition: null },
    ],
  },
  {
    id: '333bf',
    rounds: [
      { id: '333bf-r1', format: 'a', timeLimit: { centiseconds: 180000, cumulativeRoundIds: ['333bf-r1'] }, cutoff: null, advancementCondition: null },
    ],
  },
  {
    id: 'pyram',
    rounds: [
      { id: 'pyram-r1', format: 'a', timeLimit: { centiseconds: 6000, cumulativeRoundIds: [] }, cutoff: { numberOfAttempts: 2, attemptResult: 1500 }, advancementCondition: { type: 'percent', level: 75 } },
      { id: 'pyram-r2', format: 'a', timeLimit: { centiseconds: 6000, cumulativeRoundIds: [] }, cutoff: null, advancementCondition: null },
    ],
  },
  ...(['222', '333oh', 'clock', 'minx', 'skewb', 'sq1', 'fto'] as const).map((id) => ({
    id,
    rounds: [
      {
        id: `${id}-r1`,
        format: 'a' as const,
        timeLimit: { centiseconds: id === 'minx' ? 30000 : 12000, cumulativeRoundIds: [] },
        cutoff: id === 'minx' ? { numberOfAttempts: 2, attemptResult: 15000 } : null,
        advancementCondition: null,
      },
    ],
  })),
  {
    id: '777',
    rounds: [
      { id: '777-r1', format: 'm', timeLimit: { centiseconds: 54000, cumulativeRoundIds: [] }, cutoff: { numberOfAttempts: 1, attemptResult: 30000 }, advancementCondition: null },
    ],
  },
  {
    // Multi-Blind com 2 tentativas (Bo2) — algumas competições usam só 1.
    id: '333mbf',
    rounds: [{ id: '333mbf-r1', format: '2', timeLimit: null, cutoff: null, advancementCondition: null }],
  },
  {
    id: '333fm',
    rounds: [
      { id: '333fm-r1', format: 'm', timeLimit: { centiseconds: 360000, cumulativeRoundIds: [] }, cutoff: null, advancementCondition: null },
    ],
  },
]

/** Nº de grupos da rodada 1 de cada evento. */
const GROUPS: Record<string, number> = {
  '333': 3, '444': 2, '666': 1, '333bf': 1, pyram: 2, '333fm': 1,
  '222': 2, '333oh': 1, clock: 1, minx: 1, skewb: 1, sq1: 1, fto: 1, '777': 1, '333mbf': 1,
}

const OFFICIAL_ORDER = [
  '333', '222', '444', '555', '666', '777', '333bf', '333fm', '333oh', 'clock',
  'minx', 'pyram', 'skewb', 'sq1', '444bf', '555bf', '333mbf', 'fto',
]

export const DEMO_COMPETITION = { id: 'DemoScoreComps2026', name: 'Campeonato CubingSP 2026' }

export function demoWcif(): Wcif {
  const names = [...SPECIAL]
  for (let i = 0; names.length < 42; i++) names.push(`${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`)

  // Atividades: um "round" por evento com filhos "-gN".
  let nextId = 1
  const roundActivities: WcifActivity[] = []
  const groupIds: Record<string, number[]> = {}
  for (const ev of EVENTS) {
    for (const r of ev.rounds) {
      const children: WcifActivity[] = []
      const isFirst = r.id.endsWith('-r1')
      const n = isFirst ? GROUPS[ev.id] : 0
      groupIds[r.id] = []
      for (let g = 1; g <= n; g++) {
        const id = nextId++
        groupIds[r.id].push(id)
        children.push({ id, name: `${ev.id} Grupo ${g}`, activityCode: `${r.id}-g${g}`, childActivities: [] })
      }
      roundActivities.push({ id: nextId++, name: r.id, activityCode: r.id, childActivities: children })
    }
  }

  const persons: WcifPerson[] = names.map((name, i) => {
    const eventIds = EVENTS.map((e) => e.id).filter((id, k) => id === '333' || (i + k) % 3 !== 0)
    const assignments: WcifPerson['assignments'] = []
    for (const evId of eventIds) {
      const ids = groupIds[`${evId}-r1`]
      if (ids.length) assignments.push({ activityId: ids[i % ids.length], assignmentCode: 'competitor', stationNumber: null })
    }
    return {
      registrantId: i + 1,
      name,
      wcaId: i % 5 === 4 ? null : `20${String(10 + (i % 15)).padStart(2, '0')}${name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X')}0${(i % 9) + 1}`,
      countryIso2: 'BR',
      registration: { eventIds, status: 'accepted', isCompeting: true },
      assignments,
      personalBests: [],
    }
  })

  // Resultados como o WCA Live sincroniza com a WCA, para testar as rodadas
  // seguintes: 3x3 R1 terminada (R2 calculada pela condição: top 16) e
  // Pyraminx R1 terminada com a R2 já aberta no WCA Live (lista própria).
  const events = EVENTS.map((e) => ({ id: e.id, rounds: e.rounds.map((r) => ({ ...r, results: [] as WcifResult[] })) }))
  const finished = (eventId: string, base: number) => {
    const round = events.find((e) => e.id === eventId)!.rounds[0]
    const people = persons.filter((p) => p.registration?.eventIds.includes(eventId))
    // Tempo "aleatório" estável por pessoa (centésimos).
    const avg = (id: number) => base + ((id * 7919) % 997) * 3
    round.results = people
      .map((p) => ({ personId: p.registrantId!, average: avg(p.registrantId!) }))
      .sort((x, y) => x.average - y.average)
      .map((r, i) => ({
        personId: r.personId,
        ranking: i + 1,
        attempts: [0, 1, 2, 3, 4].map((k) => ({ result: r.average + (k - 2) * 37 })),
        best: r.average - 74,
        average: r.average,
      }))
    return round.results
  }
  finished('333', 900)
  const pyrR1 = finished('pyram', 450)
  const pyrR2 = events.find((e) => e.id === 'pyram')!.rounds[1]
  pyrR2.results = pyrR1
    .slice(0, Math.floor(pyrR1.length * 0.75))
    .map((r) => ({ personId: r.personId, ranking: null, attempts: [] }))

  return {
    id: DEMO_COMPETITION.id,
    name: DEMO_COMPETITION.name,
    shortName: DEMO_COMPETITION.name,
    persons,
    events: events.sort(
      (a, b) => OFFICIAL_ORDER.indexOf(a.id) - OFFICIAL_ORDER.indexOf(b.id),
    ),
    schedule: {
      venues: [{ id: 1, name: 'Ginásio', rooms: [{ id: 1, name: 'Palco principal', activities: roundActivities }] }],
    },
  }
}
