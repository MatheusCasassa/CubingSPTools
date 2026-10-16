// Competição FICTÍCIA para testar o CubeStaff sem login (/cubestaff/demo).
// Dois dias, dois palcos, rodadas seguintes, FMC por tentativas, novatos,
// Delegados, recordes pessoais e uma lista de staff aprovada.

import type { Wcif, WcifActivity, WcifEvent, WcifPerson, WcifRoom } from '../../../lib/wca/types'
import { emptyPlan, type Plan, type StaffEntry, type StaffRole } from './types'

export const DEMO_ID = 'DemoCubeStaff2026'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const FIRST = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Eduarda',
  'Felipe',
  'Gabriela',
  'Henrique',
  'Isabela',
  'João',
  'Karina',
  'Lucas',
  'Mariana',
  'Nicolas',
  'Olívia',
  'Pedro',
  'Rafaela',
  'Samuel',
  'Tatiane',
  'Vinícius',
  'Yasmin',
  'Thiago',
  'Letícia',
  'Gustavo',
]
const LAST = [
  'Silva',
  'Santos',
  'Oliveira',
  'Souza',
  'Lima',
  'Pereira',
  'Ferreira',
  'Costa',
  'Rodrigues',
  'Almeida',
  'Nascimento',
  'Carvalho',
  'Gomes',
  'Martins',
  'Araújo',
  'Ribeiro',
  'Barbosa',
  'Rocha',
]

const EVENTS: {
  id: string
  rounds: number
  adv?: WcifEvent['rounds'][number]['advancementCondition'][]
  base: number
  format?: 'a' | 'm'
}[] = [
  {
    id: '333',
    rounds: 3,
    adv: [
      { type: 'percent', level: 50 },
      { type: 'ranking', level: 12 },
    ],
    base: 1500,
  },
  { id: '222', rounds: 1, base: 500 },
  { id: '444', rounds: 1, base: 5000 },
  { id: 'pyram', rounds: 2, adv: [{ type: 'ranking', level: 16 }], base: 600 },
  { id: '333oh', rounds: 1, base: 2600 },
  { id: 'skewb', rounds: 1, base: 700 },
  { id: 'clock', rounds: 1, base: 1100 },
  { id: '333bf', rounds: 1, base: 9000 },
  { id: '333fm', rounds: 1, base: 3500, format: 'm' },
]

const iso = (day: number, hh: number, mm: number) => {
  // America/Sao_Paulo = UTC-3 (sem horário de verão).
  const d = new Date(Date.UTC(2026, 10, 14 + day, hh + 3, mm))
  return d.toISOString()
}

export function demoCubeStaffWcif(): Wcif {
  const rand = rng(2026)
  const names: string[] = []
  for (let i = 0; names.length < 84; i++) {
    const n = `${FIRST[i % FIRST.length]} ${LAST[(i * 5 + Math.floor(i / FIRST.length)) % LAST.length]}`
    if (!names.includes(n)) names.push(n)
  }

  const persons: WcifPerson[] = names.map((name, i) => {
    const newcomer = i % 6 === 5
    const delegate = i === 0 || i === 1
    const skill = 0.55 + rand() * 1.4
    const eventIds = EVENTS.map((e) => e.id).filter((id, k) => id === '333' || rand() < (k < 4 ? 0.75 : 0.4))
    const personalBests = newcomer
      ? []
      : eventIds.flatMap((id) => {
          const ev = EVENTS.find((e) => e.id === id)!
          const avg = Math.round(ev.base * skill * (0.9 + rand() * 0.3))
          if (id === '333bf' && rand() < 0.4) return []
          return [
            { eventId: id, best: Math.round(avg * 0.85), type: 'single' as const },
            ...(id === '333bf' ? [] : [{ eventId: id, best: avg, type: 'average' as const }]),
          ]
        })
    return {
      registrantId: i + 1,
      name,
      wcaId: newcomer
        ? null
        : `20${String(12 + (i % 12)).padStart(2, '0')}${name
            .normalize('NFD')
            .replace(/[^A-Za-z]/g, '')
            .slice(0, 4)
            .toUpperCase()
            .padEnd(4, 'X')}0${(i % 9) + 1}`,
      countryIso2: 'BR',
      roles: delegate ? ['delegate'] : i === 2 || i === 3 ? ['organizer'] : [],
      email: `pessoa${i + 1}@exemplo.com`,
      // Algumas inscrições NÃO aprovadas (pendente/cancelada): o CubeStaff ignora.
      registration: {
        eventIds,
        status: i % 13 === 12 ? 'pending' : i === 40 ? 'deleted' : 'accepted',
        isCompeting: true,
      },
      assignments: [],
      personalBests,
    }
  })

  // Cronograma: sábado (palco Azul e Vermelho) e domingo.
  let id = 1
  const act = (code: string, name: string, start: string, end: string): WcifActivity => ({
    id: id++,
    name,
    activityCode: code,
    startTime: start,
    endTime: end,
    childActivities: [],
  })
  const blue: WcifActivity[] = [
    act('other-registration', 'Credenciamento', iso(0, 8, 0), iso(0, 9, 0)),
    act('333-r1', '3x3x3 Cube, Round 1', iso(0, 9, 0), iso(0, 10, 30)),
    act('222-r1', '2x2x2 Cube, Round 1', iso(0, 10, 30), iso(0, 11, 30)),
    act('pyram-r1', 'Pyraminx, Round 1', iso(0, 11, 30), iso(0, 12, 30)),
    act('other-lunch', 'Almoço', iso(0, 12, 30), iso(0, 13, 30)),
    act('444-r1', '4x4x4 Cube, Round 1', iso(0, 13, 30), iso(0, 15, 0)),
    act('skewb-r1', 'Skewb, Round 1', iso(0, 15, 0), iso(0, 16, 0)),
    act('333-r2', '3x3x3 Cube, Round 2', iso(0, 16, 0), iso(0, 17, 0)),
    act('333fm-r1-a1', '3x3x3 Fewest Moves, Round 1, Attempt 1', iso(1, 8, 30), iso(1, 9, 30)),
    act('333oh-r1', '3x3x3 One-Handed, Round 1', iso(1, 9, 30), iso(1, 10, 45)),
    act('pyram-r2', 'Pyraminx, Final', iso(1, 10, 45), iso(1, 11, 30)),
    act('clock-r1', 'Clock, Round 1', iso(1, 13, 0), iso(1, 14, 0)),
    act('333fm-r1-a2', '3x3x3 Fewest Moves, Round 1, Attempt 2', iso(1, 14, 0), iso(1, 15, 0)),
    act('333-r3', '3x3x3 Cube, Final', iso(1, 15, 0), iso(1, 16, 0)),
  ]
  const red: WcifActivity[] = [
    act('333-r1', '3x3x3 Cube, Round 1', iso(0, 9, 0), iso(0, 10, 30)),
    act('333bf-r1', '3x3x3 Blindfolded, Round 1', iso(1, 11, 30), iso(1, 12, 30)),
  ]
  const rooms: WcifRoom[] = [
    { id: 1, name: 'Palco Azul', activities: blue },
    { id: 2, name: 'Palco Vermelho', activities: red },
  ]

  const events: WcifEvent[] = EVENTS.map((e) => ({
    id: e.id,
    rounds: Array.from({ length: e.rounds }, (_, i) => ({
      id: `${e.id}-r${i + 1}`,
      format: e.format ?? (e.id === '333bf' ? ('3' as const) : ('a' as const)),
      timeLimit: { centiseconds: e.base * 6, cumulativeRoundIds: [] },
      cutoff: null,
      advancementCondition: e.adv?.[i] ?? null,
      results: [],
    })),
  }))

  // Pyraminx R1 já com resultados (para testar "Atualizar rodadas seguintes").
  const pyr = events.find((e) => e.id === 'pyram')!.rounds[0]
  const pyrPeople = persons.filter(
    (p) => p.registration?.status === 'accepted' && p.registration.eventIds.includes('pyram'),
  )
  pyr.results = pyrPeople
    .map((p) => ({ p, avg: 400 + Math.round(rand() * 900) }))
    .sort((a, b) => a.avg - b.avg)
    .map((x, i) => ({
      personId: x.p.registrantId!,
      ranking: i + 1,
      attempts: [1, 2, 3, 4, 5].map(() => ({ result: x.avg + Math.round(rand() * 100) })),
      best: x.avg - 50,
      average: x.avg,
    }))

  return {
    id: DEMO_ID,
    name: 'Campeonato CubeStaff Demo 2026',
    shortName: 'CubeStaff Demo 2026',
    persons,
    events,
    schedule: {
      startDate: '2026-11-14',
      numberOfDays: 2,
      venues: [{ id: 1, name: 'Ginásio CubingSP', timezone: 'America/Sao_Paulo', rooms }],
    },
    extensions: [],
  }
}

/** Plano inicial da demo: lista de staff aprovada (40 pessoas) e grupos. */
export function demoPlan(wcif: Wcif): Plan {
  const plan = emptyPlan()
  plan.config.stations = 10
  plan.config.groupsByRound = {
    '333-r1': 4,
    '222-r1': 3,
    '444-r1': 3,
    'pyram-r1': 3,
    '333oh-r1': 2,
    'skewb-r1': 2,
    'clock-r1': 2,
    '333bf-r1': 2,
    '333fm-r1': 1,
    '333-r2': 2,
    'pyram-r2': 1,
    '333-r3': 1,
  }
  const rand = rng(77)
  const rolesPool: StaffRole[][] = [[], ['judge'], ['judge', 'scrambler'], ['scrambler'], ['judge', 'runner']]
  const staff: StaffEntry[] = wcif.persons
    .filter((p) => p.wcaId && p.registrantId! <= 60)
    .map((p, i) => {
      const roles = rolesPool[i % rolesPool.length]
      const partial = i % 7 === 3
      return {
        registrantId: p.registrantId!,
        roles,
        preferred: roles.slice(0, 1),
        scrambler: roles.length === 0 ? null : roles.includes('scrambler'),
        scramblePuzzles: roles.includes('scrambler') ? (p.registration?.eventIds ?? []).filter(() => rand() < 0.8) : [],
        availability: partial
          ? { '2026-11-14': { morning: true, afternoon: false }, '2026-11-15': { morning: true, afternoon: true } }
          : null,
      }
    })
  plan.staff = staff
  plan.extras = [{ id: '1', name: 'Marcos (pai da Yasmin)', note: 'Pode ser runner' }]
  return plan
}
