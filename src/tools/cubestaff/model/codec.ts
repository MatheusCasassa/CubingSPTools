// Formato compacto da extensão CubingSP.CubeStaff.
//
// A WCA guarda os dados de cada extensão numa coluna TEXT (máx. 64 KB), então
// o plano é gravado enxuto:
//  - ids em base 36, listas como texto "a,1f,x3";
//  - rodadas publicadas e sem mudança desde a publicação NÃO repetem quem
//    compete/faz staff (isso já está nos assignments do WCIF): ficam só os
//    suplentes, as travas e os ajudantes extras.
// Ver docs/cubestaff-extension.md.

import type { Wcif } from '../../../lib/wca/types'
import {
  DEFAULT_CONFIG,
  emptyPlan,
  type Availability,
  type GroupPlan,
  type Plan,
  type Ref,
  type RoundPlan,
  type StaffEntry,
  type StaffRole,
} from './types'
import { competitionDays } from './schedule'

/** Limite seguro (a coluna aceita 65.535 bytes). */
export const EXTENSION_MAX_BYTES = 60_000

const ROLE_LETTER: Record<StaffRole, string> = { judge: 'j', scrambler: 's', runner: 'r' }
const LETTER_ROLE: Record<string, StaffRole> = { j: 'judge', s: 'scrambler', r: 'runner' }

const LOCK_LETTER: Record<string, string> = { competitor: 'c', judge: 'j', scrambler: 's', runner: 'r', reserve: 'v' }
const LOCK_KIND: Record<string, string> = { c: 'competitor', j: 'judge', s: 'scrambler', r: 'runner', v: 'reserve' }

const b36 = (n: number) => n.toString(36)
const fromB36 = (s: string) => parseInt(s, 36)

export const encRefs = (refs: Ref[]) => refs.map((r) => (r.startsWith('p') ? b36(Number(r.slice(1))) : r)).join(',')
export const decRefs = (s: string | undefined): Ref[] =>
  !s
    ? []
    : s
        .split(',')
        .filter(Boolean)
        .map((x) => (x.startsWith('x') ? x : `p${fromB36(x)}`))
const encIds = (ids: number[]) => ids.map(b36).join(',')
const decIds = (s: string | undefined): number[] => (!s ? [] : s.split(',').filter(Boolean).map(fromB36))

// ------------------------------------------------------------- hash de rodada

/** FNV-1a 32 bits (só para comparar versões de uma rodada). */
function fnv(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** Impressão digital do que vai para o WCIF numa rodada (só pessoas do WCIF). */
export function roundHash(rp: RoundPlan | null | undefined): string {
  if (!rp) return ''
  const p = (l: Ref[]) =>
    l
      .filter((r) => r.startsWith('p'))
      .sort()
      .join(',')
  return fnv(
    rp.groups
      .map((g) =>
        [g.number, [...g.competitors].sort((a, b) => a - b).join(','), p(g.judges), p(g.scramblers), p(g.runners)].join(
          '|',
        ),
      )
      .join(';'),
  )
}

// ------------------------------------------------------------- disponibilidade

function encAvail(a: Availability | null, days: string[]): string | undefined {
  if (!a) return undefined
  return days.map((d) => `${a[d]?.morning ? 1 : 0}${a[d]?.afternoon ? 1 : 0}`).join('')
}
function decAvail(s: string | undefined, days: string[]): Availability | null {
  if (s == null) return null
  const out: Availability = {}
  days.forEach((d, i) => (out[d] = { morning: s[i * 2] === '1', afternoon: s[i * 2 + 1] === '1' }))
  return out
}

// ------------------------------------------------------------- formato

interface EncGroup {
  /** competidores, juízes, embaralhadores, runners, suplentes, travas */
  c?: string
  j?: string
  s?: string
  r?: string
  v?: string
  l?: string
}
interface EncRound {
  /** 1 = igual ao WCIF publicado (pessoas vêm dos assignments). */
  w?: 1
  /** hash da versão publicada */
  h?: string
  t: string
  g: EncGroup[]
}
export interface EncodedPlan {
  v: 2
  cfg: Partial<Plan['config']> & { absent?: never }
  ab?: string
  st: (string | (string | number | null)[])[]
  ex: Plan['extras']
  rd: Record<string, EncRound>
  rev: number
  at: string
  by?: string
}

export function encodePlan(plan: Plan, wcif: Wcif): EncodedPlan {
  const days = competitionDays(wcif)
  const { absent, ...cfg } = plan.config
  const rd: Record<string, EncRound> = {}
  for (const [roundId, rp] of Object.entries(plan.rounds)) {
    const published = plan.published.includes(roundId) ? plan.publishedHash?.[roundId] : undefined
    const same = published != null && published === roundHash(rp)
    rd[roundId] = {
      ...(same ? { w: 1 as const } : {}),
      ...(published ? { h: published } : {}),
      t: rp.updatedAt,
      g: rp.groups.map((g) => {
        const e: EncGroup = {}
        const extrasOnly = (l: Ref[]) => l.filter((r) => r.startsWith('x'))
        if (!same) e.c = encIds(g.competitors)
        const j = same ? extrasOnly(g.judges) : g.judges
        const s = same ? extrasOnly(g.scramblers) : g.scramblers
        const r = same ? extrasOnly(g.runners) : g.runners
        if (j.length) e.j = encRefs(j)
        if (s.length) e.s = encRefs(s)
        if (r.length) e.r = encRefs(r)
        if (g.reserves.length) e.v = encRefs(g.reserves)
        if (g.locked.length)
          e.l = g.locked
            .map((k) => {
              const [kind, ref] = k.split(':')
              return `${LOCK_LETTER[kind]}${encRefs([ref])}`
            })
            .join(',')
        return e
      }),
    }
  }
  return {
    v: 2,
    cfg,
    ...(absent.length ? { ab: encIds(absent) } : {}),
    // Cada candidato é um texto "id|funções|preferida|embaralha|puzzles|disponibilidade".
    // Nada de null: a WCA remove valores null de listas ao salvar a extensão,
    // o que deslocava as posições (bug que zerava os embaralhadores).
    st: plan.staff.map((e) =>
      [
        b36(e.registrantId),
        e.roles.map((x) => ROLE_LETTER[x]).join(''),
        e.preferred.map((x) => ROLE_LETTER[x]).join(''),
        e.scrambler == null ? '' : e.scrambler ? '1' : '0',
        e.scramblePuzzles.join(','),
        encAvail(e.availability, days) ?? '',
      ].join('|'),
    ),
    ex: plan.extras,
    rd,
    rev: plan.revision,
    at: plan.updatedAt,
    ...(plan.updatedBy ? { by: plan.updatedBy } : {}),
  }
}

/**
 * Lê a extensão. `fromWcif` reconstrói uma rodada publicada a partir dos
 * assignments (passado por publish.ts para evitar dependência circular).
 */
const letters = (s: string) =>
  s
    .split('')
    .map((l) => LETTER_ROLE[l])
    .filter(Boolean)

/**
 * Lê um candidato. Formato atual: texto "id|funções|preferida|embaralha|puzzles|disp".
 * Formato antigo (lista): a WCA removia os null, então as posições a partir da
 * 4ª são lidas pelo tipo — número = quer embaralhar; 1º texto = puzzles;
 * 2º texto = disponibilidade.
 */
export function decodeStaffRow(row: string | (string | number | null)[], days: string[]): StaffEntry {
  if (typeof row === 'string') {
    const [id, roles = '', pref = '', scr = '', puzzles = '', avail = ''] = row.split('|')
    return {
      registrantId: fromB36(id),
      roles: letters(roles),
      preferred: letters(pref),
      scrambler: scr === '' ? null : scr === '1',
      scramblePuzzles: puzzles.split(',').filter(Boolean),
      availability: avail === '' ? null : decAvail(avail, days),
    }
  }
  const rest = row.slice(3).filter((x) => x != null)
  const scr = rest.find((x) => typeof x === 'number') as number | undefined
  const texts = rest.filter((x): x is string => typeof x === 'string')
  return {
    registrantId: fromB36(String(row[0])),
    roles: letters(String(row[1] ?? '')),
    preferred: letters(String(row[2] ?? '')),
    scrambler: scr == null ? null : scr === 1,
    scramblePuzzles: (texts[0] ?? '').split(',').filter(Boolean),
    availability: texts[1] ? decAvail(texts[1], days) : null,
  }
}

export function decodePlan(data: EncodedPlan, wcif: Wcif, fromWcif: (roundId: string) => RoundPlan | null): Plan {
  const days = competitionDays(wcif)
  const plan = emptyPlan()
  plan.config = { ...DEFAULT_CONFIG, ...data.cfg, absent: decIds(data.ab) }
  plan.staff = (data.st ?? []).map((row) => decodeStaffRow(row, days))
  plan.extras = data.ex ?? []
  plan.revision = data.rev ?? 0
  plan.updatedAt = data.at ?? plan.updatedAt
  plan.updatedBy = data.by
  for (const [roundId, er] of Object.entries(data.rd ?? {})) {
    const base = er.w ? fromWcif(roundId) : null
    // Publicada e removida/zerada na WCA depois: a rodada sai do plano.
    if (er.w && !base) continue
    const slots = base ? base.groups.map((_, i) => er.g[i] ?? {}) : er.g
    const groups: GroupPlan[] = slots.map((e, i) => {
      const fromW = base?.groups[i]
      const locked = (e.l ?? '')
        .split(',')
        .filter(Boolean)
        .map((x) => `${LOCK_KIND[x[0]]}:${decRefs(x.slice(1))[0]}`)
      return {
        number: fromW?.number ?? i + 1,
        competitors: fromW ? fromW.competitors : decIds(e.c),
        judges: [...(fromW?.judges ?? []), ...decRefs(e.j)],
        scramblers: [...(fromW?.scramblers ?? []), ...decRefs(e.s)],
        runners: [...(fromW?.runners ?? []), ...decRefs(e.r)],
        reserves: decRefs(e.v),
        locked,
      }
    })
    plan.rounds[roundId] = { roundId, groups, updatedAt: er.t }
    plan.config.groupsByRound[roundId] = groups.length
    if (er.h) {
      plan.published.push(roundId)
      // Rodada lida do WCIF: a versão de referência passa a ser a atual da WCA.
      plan.publishedHash[roundId] = er.w ? roundHash(plan.rounds[roundId]) : er.h
    }
  }
  return plan
}

export function encodedSize(data: unknown): number {
  return new TextEncoder().encode(JSON.stringify(data)).length
}
