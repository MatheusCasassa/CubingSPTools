// Importação da lista de staff a partir do CSV de um Google Forms (ou de
// qualquer planilha). As colunas são reconhecidas pelo texto da pergunta
// (PT/EN/ES) e podem ser corrigidas na tela. Funciona com os formulários do
// Brasileiro 2026 (Staff e Delegados) e com formulários parecidos.
//
// O mínimo necessário é saber QUEM é a pessoa (WCA ID ou nome). Tudo o mais
// (funções, preferência, puzzles, disponibilidade) é aproveitado se existir.

import type { Wcif, WcifPerson } from '../../../lib/wca/types'
import type { Availability, StaffEntry, StaffRole } from './types'
import { normalizeName } from './people'
import { competitionDays } from './schedule'

export type FieldKey =
  | 'identity'
  | 'wcaId'
  | 'name'
  | 'email'
  | 'phone'
  | 'scramblerInterest'
  | 'scramblePuzzles'
  | 'applies'
  | 'preferred'
  | 'delegate'
  | 'approved'

export const FIELD_KEYS: FieldKey[] = [
  'identity',
  'wcaId',
  'name',
  'email',
  'phone',
  'scramblerInterest',
  'scramblePuzzles',
  'applies',
  'preferred',
  'delegate',
  'approved',
]

export interface ColumnMap {
  fields: Partial<Record<FieldKey, number>>
  /** Colunas de disponibilidade (ex.: "...presente no campeonato [Manhã]"). */
  availability: number[]
  /** Perguntas abertas (ex.: teste de embaralhamento) — só para leitura. */
  notes: number[]
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = { fields: {}, availability: [], notes: [] }
  const set = (k: FieldKey, i: number) => {
    if (map.fields[k] == null) map.fields[k] = i
  }
  headers.forEach((raw, i) => {
    const h = norm(raw)
    if (!h || /carimbo|timestamp|marca temporal/.test(h)) return
    if (/\[.*\]/.test(h) && /(horario|presente|disponiv|availab|dispon|present|turno|period)/.test(h)) {
      map.availability.push(i)
      return
    }
    if (/^se indicou|^if you (indicated|chose)|^si indicaste/.test(h)) {
      map.notes.push(i)
      return
    }
    if (/marketing|redes sociais|social media/.test(h)) return
    if (/eventos?.*(inscrit|registr)|events?.*(registered|signed)/.test(h)) return
    if (/wca/.test(h) && /\bid\b|identific/.test(h)) {
      // "Qual sua ID da WCA? Caso não tenha uma, preencha com seu nome completo."
      set(/nome|name|nombre/.test(h) ? 'identity' : 'wcaId', i)
      return
    }
    if (/e-?mail|correo/.test(h)) return set('email', i)
    if (/whats|telefone|celular|phone|telefono|movil/.test(h)) return set('phone', i)
    if (/(puzzle|experien|eventos)/.test(h) && /(embaralh|scrambl|mezcl)/.test(h)) return set('scramblePuzzles', i)
    if (/(interesse|interest|interes|quer|want|quiere)/.test(h) && /(embaralh|scrambl|mezcl)/.test(h))
      return set('scramblerInterest', i)
    if (/selecione todos|select all|seleccione todos|marque todos/.test(h)) return set('applies', i)
    if (/prefer|posicao|funcao|position|role|puesto|funcion/.test(h)) return set('preferred', i)
    if (/(voce e|are you|eres|es usted).*(delegad|delegate)|^delegad/.test(h)) return set('delegate', i)
    if (/aprovad|approved|aprobad|^status|selecionad|selected/.test(h)) return set('approved', i)
    if (/^(nome|name|nombre)|nome completo|full name|nombre completo/.test(h)) return set('name', i)
  })
  return map
}

// ------------------------------------------------------------- valores

const YES = /^(sim|s|yes|y|si|sí|x|true|1|ok|aprovad|approved|aprobad|selecionad|selected|confirmad)/i
const NO = /^(nao|não|no|n|false|0|reprovad|rejected)/i
export const isYes = (v: string) => YES.test(norm(v)) || YES.test(v.trim())
export const isNo = (v: string) => NO.test(norm(v))

const ROLE_PATTERNS: [StaffRole, RegExp][] = [
  ['judge', /juiz|juiza|judge|juez|arbitr/],
  ['scrambler', /embaralh|scrambl|mezcl/],
  ['runner', /runner|corredor|mensageir|entregador/],
]

/** Funções citadas num texto, na ordem em que aparecem. */
export function parseRoles(text: string): StaffRole[] {
  const t = norm(text)
  const found = ROLE_PATTERNS.map(([role, re]) => ({ role, idx: t.search(re) })).filter((x) => x.idx >= 0)
  return found.sort((a, b) => a.idx - b.idx).map((x) => x.role)
}

const EVENT_PATTERNS: [string, RegExp][] = [
  ['333mbf', /multi/],
  ['333fm', /fewest|fmc|menos movimentos|menor numero/],
  ['333oh', /one[- ]?hand|uma mao|una mano|\boh\b/],
  ['333bf', /3x3(x3)?.*(blind|vend|cega|bld)|3bld|\bbld\b/],
  ['444bf', /4x4(x4)?.*(blind|vend|cega|bld)|4bld/],
  ['555bf', /5x5(x5)?.*(blind|vend|cega|bld)|5bld/],
  ['222', /2x2/],
  ['444', /4x4/],
  ['555', /5x5/],
  ['666', /6x6/],
  ['777', /7x7/],
  ['333', /3x3|cubo magico|rubik/],
  ['clock', /clock|relogio|reloj/],
  ['pyram', /pyra|piramin/],
  ['minx', /megaminx|\bmega\b|minx/],
  ['skewb', /skewb/],
  ['sq1', /square|sq-?1/],
]

/** Eventos citados num texto de múltipla escolha ("3x3x3, Pyraminx, Clock"). */
export function parseEvents(text: string): string[] {
  const out: string[] = []
  for (const token of text.split(/[,;\n]+/)) {
    const t = norm(token)
    if (!t) continue
    for (const [id, re] of EVENT_PATTERNS) {
      if (re.test(t)) {
        if (!out.includes(id)) out.push(id)
        break
      }
    }
  }
  return out
}

const WEEKDAYS: [number, RegExp][] = [
  [0, /^(dom|sun|domingo)/],
  [1, /^(seg|mon|lun)/],
  [2, /^(ter|tue|mar(?!c))/],
  [3, /^(qua|wed|mie)/],
  [4, /^(qui|thu|jue)/],
  [5, /^(sex|fri|vie)/],
  [6, /^(sab|sat)/],
]

function periodsIn(text: string): ('morning' | 'afternoon')[] {
  const t = norm(text)
  const out: ('morning' | 'afternoon')[] = []
  if (/manha|morning|manana|\bam\b/.test(t)) out.push('morning')
  if (/tarde|afternoon|noite|evening|night|\bpm\b/.test(t)) out.push('afternoon')
  if (/integral|dia todo|all day|todo el dia/.test(t)) out.push('morning', 'afternoon')
  return out
}

function daysIn(text: string, days: string[]): string[] {
  const t = norm(text)
  if (!t) return []
  if (/todos|all|ambos|both|todo/.test(t)) return days
  const out = new Set<string>()
  for (const token of t.split(/[,;/]+| e | and | y /)) {
    const s = token.trim()
    if (!s) continue
    const dm = s.match(/(\d{1,2})[/.-](\d{1,2})/)
    if (dm) {
      const d = days.find((x) => Number(x.slice(8, 10)) === Number(dm[1]) && Number(x.slice(5, 7)) === Number(dm[2]))
      if (d) out.add(d)
      continue
    }
    const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (iso && days.includes(iso[0])) {
      out.add(iso[0])
      continue
    }
    const nth = s.match(/(\d)\s*(º|o|°)?\s*dia|dia\s*(\d)|day\s*(\d)/)
    if (nth) {
      const n = Number(nth[1] ?? nth[3] ?? nth[4])
      if (days[n - 1]) out.add(days[n - 1])
      continue
    }
    for (const [wd, re] of WEEKDAYS) {
      if (re.test(s)) days.filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === wd).forEach((d) => out.add(d))
    }
  }
  return [...out]
}

/**
 * Disponibilidade a partir das colunas de grade do Google Forms:
 *   "…presente no campeonato [Manhã]" = "Sábado, Domingo"
 * (linha = período, valor = dias) — ou o contrário (linha = dia, valor =
 * períodos). Sem resposta em nenhuma coluna → null (sempre disponível).
 */
export function parseAvailability(
  headers: string[],
  cols: number[],
  row: string[],
  days: string[],
): Availability | null {
  if (cols.length === 0) return null
  const avail: Availability = {}
  for (const d of days) avail[d] = { morning: false, afternoon: false }
  let answered = false
  for (const c of cols) {
    const cell = (row[c] ?? '').trim()
    if (!cell) continue
    answered = true
    const label = headers[c].match(/\[(.*?)\]/)?.[1] ?? headers[c]
    let periods = periodsIn(label)
    let dayList = daysIn(label, days)
    if (periods.length > 0) {
      dayList = daysIn(cell, days)
      // Valor não reconhecido (ex.: "Sim"): vale para todos os dias.
      if (dayList.length === 0) dayList = isNo(cell) ? [] : days
    } else if (dayList.length > 0) {
      periods = periodsIn(cell)
      if (periods.length === 0 && !isNo(cell)) periods = ['morning', 'afternoon']
    } else continue
    for (const d of dayList) for (const p of periods) if (avail[d]) avail[d][p] = true
  }
  if (!answered || days.length === 0) return null
  return avail
}

// ------------------------------------------------------------- linhas

export type MatchHow = 'wcaId' | 'email' | 'name' | 'fuzzy' | 'manual' | null

export interface ImportRow {
  index: number
  rawIdentity: string
  wcaId: string | null
  name: string
  email: string
  phone: string
  roles: StaffRole[]
  preferred: StaffRole[]
  scrambler: boolean | null
  scramblePuzzles: string[]
  availability: Availability | null
  declaredDelegate: boolean
  approved: boolean
  notes: { question: string; answer: string }[]
  appliesText: string
  registrantId: number | null
  how: MatchHow
}

const WCA_ID_RE = /\b(\d{4}[A-Z]{4}\d{2})\b/

function tokens(s: string) {
  return new Set(
    normalizeName(s)
      .split(' ')
      .filter((t) => t.length > 1),
  )
}

export function matchPerson(
  wcif: Wcif,
  wcaId: string | null,
  email: string,
  name: string,
): { registrantId: number | null; how: MatchHow } {
  const persons = wcif.persons.filter((p) => p.registrantId != null)
  if (wcaId) {
    const p = persons.find((x) => x.wcaId?.toUpperCase() === wcaId.toUpperCase())
    if (p) return { registrantId: p.registrantId, how: 'wcaId' }
  }
  if (email) {
    const p = persons.find((x) => x.email && x.email.toLowerCase() === email.toLowerCase().trim())
    if (p) return { registrantId: p.registrantId, how: 'email' }
  }
  if (name) {
    const n = normalizeName(name)
    const exact = persons.filter((x) => normalizeName(x.name) === n)
    if (exact.length === 1) return { registrantId: exact[0].registrantId, how: 'name' }
    const t = tokens(name)
    let best: { p: WcifPerson; score: number } | null = null
    for (const p of persons) {
      const u = tokens(p.name)
      const inter = [...t].filter((x) => u.has(x)).length
      const score = inter / Math.max(1, Math.min(t.size, u.size))
      const firstOk = [...t][0] === [...u][0]
      if (firstOk && inter >= 2 && score >= 0.66 && (!best || score > best.score)) best = { p, score }
    }
    if (best) return { registrantId: best.p.registrantId, how: 'fuzzy' }
  }
  return { registrantId: null, how: null }
}

export function readRows(wcif: Wcif, table: string[][], map: ColumnMap): ImportRow[] {
  const [headers, ...rows] = table
  const days = competitionDays(wcif)
  const get = (row: string[], k: FieldKey) => {
    const c = map.fields[k]
    return c == null ? '' : (row[c] ?? '').trim()
  }
  return rows.map((row, index) => {
    const identity = get(row, 'identity') || get(row, 'wcaId')
    const idMatch = (identity.toUpperCase().match(WCA_ID_RE) ?? [])[1] ?? null
    const name = get(row, 'name') || (idMatch ? '' : identity)
    const email = get(row, 'email')
    const applies = get(row, 'applies')
    const puzzlesText = get(row, 'scramblePuzzles')
    const interestText = get(row, 'scramblerInterest')

    let scrambler: boolean | null = null
    if (interestText) scrambler = isYes(interestText) ? true : isNo(interestText) ? false : null
    const puzzles = parseEvents(puzzlesText)
    if (puzzlesText && scrambler == null) scrambler = puzzles.length > 0 ? true : isNo(puzzlesText) ? false : null
    if (/nao quero|não quero|no quiero|don.?t want|nao tenho interesse/.test(norm(puzzlesText))) scrambler = false

    const roles = parseRoles(applies)
    if (scrambler === true && roles.length > 0 && !roles.includes('scrambler')) roles.push('scrambler')
    if (scrambler === false) {
      const i = roles.indexOf('scrambler')
      if (i >= 0) roles.splice(i, 1)
    }
    const preferred = parseRoles(get(row, 'preferred'))
    const approvedText = get(row, 'approved')
    const m = matchPerson(wcif, idMatch, email, name)
    return {
      index,
      rawIdentity: identity || name,
      wcaId: idMatch,
      name,
      email,
      phone: get(row, 'phone'),
      roles,
      preferred: preferred.length > 0 ? preferred : [],
      scrambler,
      scramblePuzzles: puzzles,
      availability: parseAvailability(headers, map.availability, row, days),
      declaredDelegate: isYes(get(row, 'delegate')) || /delegad/.test(norm(applies)),
      approved: map.fields.approved == null ? true : isYes(approvedText),
      notes: map.notes.map((c) => ({ question: headers[c], answer: (row[c] ?? '').trim() })).filter((n) => n.answer),
      appliesText: applies,
      registrantId: m.registrantId,
      how: m.how,
    }
  })
}

export function toStaffEntry(r: ImportRow): StaffEntry | null {
  if (r.registrantId == null) return null
  return {
    registrantId: r.registrantId,
    roles: r.roles,
    preferred: r.preferred,
    scrambler: r.scrambler,
    scramblePuzzles: r.scramblePuzzles,
    availability: r.availability,
  }
}

/** Junta entradas novas na lista (a mais recente vence para a mesma pessoa). */
export function mergeStaff(current: StaffEntry[], incoming: StaffEntry[]): StaffEntry[] {
  const map = new Map(current.map((s) => [s.registrantId, s]))
  for (const s of incoming) map.set(s.registrantId, s)
  return [...map.values()]
}
