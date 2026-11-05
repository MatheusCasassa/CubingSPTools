// SmartRanks: rankings para premiações a partir dos resultados do WCA Live.
//
// Classificação final de cada modalidade: quem chegou mais longe vem antes
// (final, depois quem parou na rodada anterior…), e dentro da mesma rodada
// vale a posição do WCA Live. Só entra quem tem pelo menos um resultado
// válido. Cada categoria (Novatos, Feminino, Idade) filtra essa
// classificação e renumera as posições.
//
// Pontuação geral (RASCS, método da APS — Associação Portuguesa de
// Speedcubing): em cada rodada, Pontos = Competidores da rodada ÷ (Posição + 1).
// O total é a soma de todas as rodadas.

import type { LiveCompetition, LiveEvent, LiveResult } from '../../../lib/wca/live'
import type { Wcif } from '../../../lib/wca/types'

export interface PersonInfo {
  registrantId: number
  name: string
  wcaId: string | null
  gender: string | null
  birthdate: string | null
  countryIso2: string | null
  /** Esta foi a primeira competição da pessoa (confirmado na WCA depois do envio dos resultados). */
  firstCompetition?: boolean
}

export type AgeMode = 'upTo' | 'from' | 'between'
/** Mais novos / mais velhos da competição, independente da idade. */
export type AgeOrder = 'youngest' | 'oldest'

export type Category =
  | { kind: 'all' }
  | { kind: 'newcomers' }
  | { kind: 'female' }
  | { kind: 'age'; mode: AgeMode; min: number; max: number }

/** Idade completa numa data ("AAAA-MM-DD"). */
export function ageOn(birthdate: string, date: string): number {
  const [by, bm, bd] = birthdate.split('-').map(Number)
  const [y, m, d] = date.split('-').map(Number)
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)
}

export function personsInfo(wcif: Wcif): Map<number, PersonInfo> {
  const out = new Map<number, PersonInfo>()
  for (const p of wcif.persons)
    if (p.registrantId != null)
      out.set(p.registrantId, {
        registrantId: p.registrantId,
        name: p.name,
        wcaId: p.wcaId,
        gender: p.gender ?? null,
        birthdate: p.birthdate ?? null,
        countryIso2: p.countryIso2 ?? null,
      })
  return out
}

/** A categoria usa data de nascimento (só no WCIF de Delegados e Organizadores). */
export const needsBirthdate = (c: Category) => c.kind === 'age'

export function matches(c: Category, info: PersonInfo | undefined, liveWcaId: string | null, refDate: string): boolean {
  switch (c.kind) {
    case 'all':
      return true
    case 'newcomers':
      // Primeira competição: sem WCA ID ou, depois do envio dos resultados,
      // com WCA ID ganho nesta competição.
      return !!info?.firstCompetition || !(info?.wcaId ?? liveWcaId)
    case 'female':
      return info?.gender === 'f'
    case 'age': {
      if (!info?.birthdate) return false
      const age = ageOn(info.birthdate, refDate)
      if (c.mode === 'upTo') return age <= c.max
      if (c.mode === 'from') return age >= c.min
      return age >= c.min && age <= c.max
    }
  }
}

/** Idade completa em anos e meses numa data ("AAAA-MM-DD"). */
export function ageYm(birthdate: string, date: string): { years: number; months: number } {
  const [by, bm, bd] = birthdate.split('-').map(Number)
  const [y, m, d] = date.split('-').map(Number)
  let months = (y - by) * 12 + (m - bm) - (d < bd ? 1 : 0)
  if (months < 0) months = 0
  return { years: Math.floor(months / 12), months: months % 12 }
}

// ------------------------------------------------- mais novos / mais velhos

export interface AgeRow {
  position: number
  registrantId: number
  name: string
  wcaId: string | null
  birthdate: string
  years: number
  months: number
}

/**
 * Competidores ordenados pela data de nascimento (mais novos ou mais velhos
 * primeiro). Só entra quem tem pelo menos um resultado válido no WCA Live
 * (competiu de fato). Mesma data de nascimento = mesma posição.
 */
export function ageRanking(
  live: LiveCompetition,
  info: Map<number, PersonInfo>,
  refDate: string,
  order: AgeOrder,
): AgeRow[] {
  const ids = new Set<number>()
  for (const ev of live.events)
    for (const rd of ev.rounds)
      for (const r of rd.results) if (valid(r) && r.person.registrantId != null) ids.add(r.person.registrantId)
  const list = [...ids]
    .map((id) => info.get(id))
    .filter((p): p is PersonInfo & { birthdate: string } => !!p?.birthdate)
    .sort((a, b) =>
      order === 'youngest'
        ? b.birthdate.localeCompare(a.birthdate) || a.name.localeCompare(b.name, 'pt-BR')
        : a.birthdate.localeCompare(b.birthdate) || a.name.localeCompare(b.name, 'pt-BR'),
    )
  const out: AgeRow[] = []
  list.forEach((p, i) => {
    const prev = out[i - 1]
    out.push({
      position: prev && prev.birthdate === p.birthdate ? prev.position : i + 1,
      registrantId: p.registrantId,
      name: p.name,
      wcaId: p.wcaId,
      birthdate: p.birthdate,
      ...ageYm(p.birthdate, refDate),
    })
  })
  return out
}

/**
 * Reordena uma classificação (por modalidade ou pontuação geral) pela idade:
 * mais novos ou mais velhos primeiro, com a idade de cada um. Quem não tem
 * data de nascimento fica de fora; mesma data = mesma posição.
 */
export function byAge<T extends { registrantId: number | null; name: string; position: number }>(
  list: T[],
  info: Map<number, PersonInfo>,
  refDate: string,
  order: AgeOrder,
): (T & { years: number; months: number })[] {
  const withBd = list
    .map((r) => ({ r, bd: r.registrantId != null ? info.get(r.registrantId)?.birthdate ?? null : null }))
    .filter((x): x is { r: T; bd: string } => !!x.bd)
    .sort((a, b) =>
      (order === 'youngest' ? b.bd.localeCompare(a.bd) : a.bd.localeCompare(b.bd)) ||
      a.r.position - b.r.position ||
      a.r.name.localeCompare(b.r.name, 'pt-BR'),
    )
  const out: (T & { years: number; months: number; bd: string })[] = []
  withBd.forEach(({ r, bd }, i) => {
    const prev = out[i - 1]
    out.push({ ...r, bd, position: prev && prev.bd === bd ? prev.position : i + 1, ...ageYm(bd, refDate) })
  })
  return out.map(({ bd: _bd, ...r }) => r as unknown as T & { years: number; months: number })
}

// ------------------------------------------------------ por modalidade

export interface Standing {
  position: number
  registrantId: number | null
  name: string
  wcaId: string | null
  roundNumber: number
  roundRanking: number
  best: number
  average: number
  attempts: number[]
}

const valid = (r: LiveResult) => r.best > 0 && r.ranking != null

/** Classificação final do evento (todos), sem posição. */
export function finalStandings(ev: LiveEvent): Omit<Standing, 'position'>[] {
  const seen = new Set<string>()
  const out: Omit<Standing, 'position'>[] = []
  const rounds = [...ev.rounds].sort((a, b) => b.number - a.number)
  for (const rd of rounds) {
    const res = rd.results.filter(valid).sort((a, b) => a.ranking! - b.ranking!)
    for (const r of res) {
      if (seen.has(r.person.id)) continue
      seen.add(r.person.id)
      out.push({
        registrantId: r.person.registrantId,
        name: r.person.name,
        wcaId: r.person.wcaId,
        roundNumber: rd.number,
        roundRanking: r.ranking!,
        best: r.best,
        average: r.average,
        attempts: r.attempts,
      })
    }
  }
  return out
}

/** Classificação de uma categoria num evento, com posições renumeradas (empates mantidos). */
export function categoryStandings(
  ev: LiveEvent,
  cat: Category,
  info: Map<number, PersonInfo>,
  refDate: string,
): Standing[] {
  const list = finalStandings(ev).filter((s) =>
    matches(cat, s.registrantId != null ? info.get(s.registrantId) : undefined, s.wcaId, refDate),
  )
  const out: Standing[] = []
  list.forEach((s, i) => {
    const prev = out[i - 1]
    const tie = prev && prev.roundNumber === s.roundNumber && prev.roundRanking === s.roundRanking
    out.push({ ...s, position: tie ? prev.position : i + 1 })
  })
  return out
}

/** O evento terminou (todas as rodadas com resultados estão finalizadas)? */
export const eventFinished = (ev: LiveEvent) =>
  ev.rounds.length > 0 && ev.rounds.every((r) => r.finished || r.numResults === 0) && ev.rounds.at(-1)!.finished

// ------------------------------------------------------ pontuação geral

export interface PointsRow {
  position: number
  registrantId: number | null
  name: string
  wcaId: string | null
  points: number
  rounds: number
  events: number
  detail: { eventId: string; roundNumber: number; ranking: number; competitors: number; points: number }[]
}

/** Pontuação APS (RASCS): Pontos = TC ÷ (P + 1) por rodada. */
export function apsPoints(
  live: LiveCompetition,
  cat: Category,
  info: Map<number, PersonInfo>,
  refDate: string,
): PointsRow[] {
  const by = new Map<string, Omit<PointsRow, 'position'> & { evs: Set<string> }>()
  for (const ev of live.events)
    for (const rd of ev.rounds) {
      const tc = rd.results.length
      for (const r of rd.results) {
        if (r.ranking == null) continue
        const pts = Math.round((tc / (r.ranking + 1)) * 100) / 100
        let row = by.get(r.person.id)
        if (!row)
          by.set(
            r.person.id,
            (row = {
              registrantId: r.person.registrantId,
              name: r.person.name,
              wcaId: r.person.wcaId,
              points: 0,
              rounds: 0,
              events: 0,
              detail: [],
              evs: new Set(),
            }),
          )
        row.points += pts
        row.rounds++
        row.evs.add(ev.eventId)
        row.detail.push({ eventId: ev.eventId, roundNumber: rd.number, ranking: r.ranking, competitors: tc, points: pts })
      }
    }
  const list = [...by.values()]
    .filter((r) => matches(cat, r.registrantId != null ? info.get(r.registrantId) : undefined, r.wcaId, refDate))
    .map(({ evs, ...r }) => ({ ...r, points: Math.round(r.points * 100) / 100, events: evs.size }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'pt-BR'))
  const out: PointsRow[] = []
  list.forEach((r, i) => {
    const prev = out[i - 1]
    out.push({ ...r, position: prev && prev.points === r.points ? prev.position : i + 1 })
  })
  return out
}

// ------------------------------------------------------------ formatação

function centis(cs: number): string {
  const cc = cs % 100
  const total = Math.floor(cs / 100)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const c2 = String(cc).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${c2}`
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}.${c2}`
  return `${s}.${c2}`
}

/** Resultado no padrão da WCA (tempo, movimentos do FMC ou pontos do Multi-BLD). */
export function formatResult(value: number, eventId: string, kind: 'single' | 'average'): string {
  if (value === -1) return 'DNF'
  if (value === -2) return 'DNS'
  if (value <= 0) return ''
  if (eventId === '333fm') return kind === 'average' ? (value / 100).toFixed(2) : String(value)
  if (eventId === '333mbf') {
    const missed = value % 100
    const secs = Math.floor(value / 100) % 100000
    const points = 99 - Math.floor(value / 10_000_000)
    const solved = points + missed
    const attempted = solved + missed
    const mm = Math.floor(secs / 60)
    const ss = String(secs % 60).padStart(2, '0')
    return `${solved}/${attempted} ${secs === 99999 ? '?' : `${mm}:${ss}`}`
  }
  return centis(value)
}

/** Resultado que define a posição (média ou melhor, conforme o formato da rodada). */
export function headline(s: Pick<Standing, 'best' | 'average'>, sortBy: 'best' | 'average', eventId: string) {
  if (sortBy === 'average' && s.average > 0) return { kind: 'average' as const, text: formatResult(s.average, eventId, 'average') }
  return { kind: 'single' as const, text: formatResult(s.best, eventId, 'single') }
}

/** Formato de ordenação da rodada em que a pessoa terminou. */
export function sortByOf(ev: LiveEvent, roundNumber: number): 'best' | 'average' {
  return ev.rounds.find((r) => r.number === roundNumber)?.format.sortBy ?? 'best'
}

// ------------------------------------------------------------- CSV

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c)
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(','),
    )
    .join('\n')
}
