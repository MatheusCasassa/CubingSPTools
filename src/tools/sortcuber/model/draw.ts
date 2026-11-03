// SortCuber: sorteio entre os competidores APROVADOS da competição.
//
// O WCIF público só traz inscrições aprovadas (e o staff não competidor, que
// fica de fora daqui). Dá para excluir Delegados, Organizadores, uma lista
// escolhida à mão e quem já foi sorteado, e para sortear só quem está
// presente (tem pelo menos um resultado no WCA Live).

import type { Wcif, WcifPerson } from '../../../lib/wca/types'

export interface Candidate {
  registrantId: number
  name: string
  wcaId: string | null
  countryIso2: string | null
  avatar: string | null
  delegate: boolean
  organizer: boolean
}

export interface DrawOptions {
  noDelegates: boolean
  noOrganizers: boolean
  /** Só quem tem resultado no WCA Live (null = WCA Live indisponível). */
  presentOnly: boolean
  /** Não sortear de novo quem já ganhou nesta competição. */
  noRepeat: boolean
  excluded: number[]
}

export const DEFAULT_OPTIONS: DrawOptions = {
  noDelegates: true,
  noOrganizers: true,
  presentOnly: false,
  noRepeat: true,
  excluded: [],
}

const isCompetitor = (p: WcifPerson) =>
  p.registrantId != null &&
  (p.registration?.status ?? 'accepted') === 'accepted' &&
  p.registration?.isCompeting !== false

export function candidates(wcif: Wcif): Candidate[] {
  return wcif.persons
    .filter(isCompetitor)
    .map((p) => {
      const roles = p.roles ?? []
      return {
        registrantId: p.registrantId!,
        name: p.name,
        wcaId: p.wcaId,
        countryIso2: p.countryIso2 ?? null,
        avatar: p.avatar?.thumbUrl ?? null,
        delegate: roles.includes('delegate') || roles.includes('trainee-delegate'),
        organizer: roles.includes('organizer'),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function eligible(
  all: Candidate[],
  opts: DrawOptions,
  present: Set<number> | null,
  winners: number[],
): Candidate[] {
  const ex = new Set(opts.excluded)
  const won = new Set(winners)
  return all.filter(
    (c) =>
      !ex.has(c.registrantId) &&
      !(opts.noDelegates && c.delegate) &&
      !(opts.noOrganizers && c.organizer) &&
      !(opts.presentOnly && present && !present.has(c.registrantId)) &&
      !(opts.noRepeat && won.has(c.registrantId)),
  )
}

/** Inteiro aleatório uniforme em [0, n) — sem viés, com o gerador criptográfico. */
export function randomInt(n: number, rand: (buf: Uint32Array) => Uint32Array = (b) => crypto.getRandomValues(b)): number {
  if (n <= 0) throw new Error('n')
  const limit = Math.floor(0x100000000 / n) * n
  const buf = new Uint32Array(1)
  for (;;) {
    rand(buf)
    if (buf[0] < limit) return buf[0] % n
  }
}

/** Sorteia `count` pessoas diferentes (Fisher–Yates parcial). */
export function draw<T>(pool: T[], count: number, rand?: (buf: Uint32Array) => Uint32Array): T[] {
  const a = [...pool]
  const k = Math.min(count, a.length)
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(a.length - i, rand)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, k)
}

export interface DrawRecord {
  at: string
  prize: string
  winners: { registrantId: number; name: string; wcaId: string | null }[]
  poolSize: number
}
