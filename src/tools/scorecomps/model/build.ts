// WCIF → plano de rodadas/grupos → lista de súmulas.
// Os grupos vêm do WCIF (atividades "evento-rN-gK" + assignments "competitor"),
// exatamente o contrato que o CubeStaff (ou Groupifier/Delegate Dashboard)
// grava na WCA. O ScoreComps só LÊ — nunca altera o WCIF.
// Rodadas seguintes sem grupos: os classificados vêm dos resultados que o
// WCA Live sincroniza com a WCA (mesma regra do CubeStaff).

import type { Wcif } from '../../../lib/wca/types'
import {
  listRounds,
  listGroups,
  groupSchedule,
  competitorsInGroup,
  acceptedCompetitors,
  type RoundInfo,
  type Competitor,
} from '../../../lib/wca/wcif'
import {
  attemptsFor,
  buildRoundLayout,
  buildGenericLayout,
  GENERIC_ATTEMPTS,
  type GenericAttempts,
  type ScorecardModel,
} from './logic'
import { personsById, roundCompetitors } from '../../cubestaff/model/people'
import { SCORECARD_STRINGS } from './strings'
import type { Locale } from '../../../i18n/locales'

export interface GroupPlan {
  /** Chave única dentro da rodada ("g1", "g2"… ou "all"). */
  key: string
  /** Número impresso no campo Grupo (vazio quando não há grupos). */
  printed: string
  label: string
  competitors: Competitor[]
}

export interface RoundPlan {
  info: RoundInfo
  groups: GroupPlan[]
  /** true quando os competidores vieram dos grupos do WCIF. */
  fromGroups: boolean
  /** Sugestão de súmulas em branco (rodadas seguintes, sem atribuições). */
  suggestedBlank: number
  /**
   * Rodadas seguintes: de onde vieram os classificados.
   *  - 'results': lista da própria rodada no WCA Live (rodada já aberta);
   *  - 'previousResults': calculado pelos resultados da rodada anterior e
   *    pela condição de classificação (Regulamento 9p1: no máximo 75%).
   */
  advancers: 'results' | 'previousResults' | null
}

/** Chave do "grupo" com os classificados de uma rodada seguinte. */
export const ADVANCERS_KEY = 'adv'

function advancingFrom(prev: RoundPlan | undefined): number {
  if (!prev) return 0
  const prevCount =
    prev.groups.reduce((n, g) => n + g.competitors.length, 0) || prev.suggestedBlank
  const cond = prev.info.round.advancementCondition as
    | { type: 'ranking' | 'percent' | 'attemptResult'; level: number }
    | null
  if (!cond) return prevCount
  if (cond.type === 'ranking') return Math.min(cond.level, prevCount || cond.level)
  if (cond.type === 'percent') return Math.floor((prevCount * cond.level) / 100)
  return prevCount
}

/** Modalidades sem súmula no ScoreComps: o FMC usa as folhas do próprio TNoodle. */
export const NO_SCORECARD_EVENTS = new Set(['333fm'])

export function planRounds(wcif: Wcif): RoundPlan[] {
  const plans: RoundPlan[] = []
  for (const info of listRounds(wcif)) {
    if (NO_SCORECARD_EVENTS.has(info.eventId)) continue
    const prev = plans.find(
      (p) => p.info.eventId === info.eventId && p.info.roundNumber === info.roundNumber - 1,
    )
    const groups: GroupPlan[] = listGroups(wcif, info.roundId)
      .map((g) => ({
        key: `g${g.number}`,
        printed: String(g.number),
        label: g.label,
        competitors: competitorsInGroup(wcif, g.activityIds),
      }))
      .filter((g) => g.competitors.length > 0)

    if (groups.length > 0) {
      plans.push({ info, groups, fromGroups: true, suggestedBlank: 0, advancers: null })
    } else if (info.roundNumber === 1) {
      // Sem grupos: todos os inscritos aceitos, campo Grupo em branco.
      plans.push({
        info,
        groups: [
          {
            key: 'all',
            printed: '',
            label: 'Sem grupos (todos os inscritos)',
            competitors: acceptedCompetitors(wcif, info.eventId),
          },
        ],
        fromGroups: false,
        suggestedBlank: 0,
        advancers: null,
      })
    } else {
      // Rodadas seguintes: classificados lidos dos resultados (WCA Live → WCA).
      const known = roundCompetitors(wcif, info.roundId, new Set())
      const byId = personsById(wcif)
      const competitors: Competitor[] = known.ids
        .map((id) => byId.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p && p.registrantId != null)
        .map((p) => ({ registrantId: p.registrantId!, name: p.name, wcaId: p.wcaId }))
      if ((known.source === 'results' || known.source === 'previousResults') && competitors.length > 0) {
        plans.push({
          info,
          groups: [{ key: ADVANCERS_KEY, printed: '', label: 'Classificados', competitors }],
          fromGroups: false,
          suggestedBlank: 0,
          advancers: known.source,
        })
      } else {
        // Ainda sem resultados: só súmulas em branco (sugestão pela condição).
        plans.push({ info, groups: [], fromGroups: false, suggestedBlank: advancingFrom(prev), advancers: null })
      }
    }
  }
  return plans
}

export type SortBy = 'name' | 'id'

export interface RoundSelection {
  roundId: string
  /** Grupos escolhidos (chaves de GroupPlan). */
  groupKeys: string[]
  /** Súmulas em branco adicionais. */
  blank: number
}

/** "Rodada N" / "Final" no idioma pedido. */
export function roundName(info: RoundInfo, locale: Locale): string {
  const S = SCORECARD_STRINGS[locale]
  return info.roundNumber === info.totalRounds && info.totalRounds > 1 ? S.final : S.round(info.roundNumber)
}

/** A competição tem mais de uma sala/palco? (para mostrar a sala na capa) */
function hasManyRooms(wcif: Wcif): boolean {
  return (wcif.schedule?.venues ?? []).reduce((n, v) => n + (v.rooms?.length ?? 0), 0) > 1
}

function eventLine(info: RoundInfo, locale: Locale): string {
  return info.totalRounds > 1 ? `${info.eventName} · ${roundName(info, locale)}` : info.eventName
}

function sortCompetitors(list: Competitor[], sortBy: SortBy, locale: Locale): Competitor[] {
  const out = [...list]
  if (sortBy === 'id') out.sort((a, b) => a.registrantId - b.registrantId)
  else out.sort((a, b) => a.name.localeCompare(b.name, locale === 'pt' ? 'pt-BR' : locale))
  return out
}

/** Súmulas de UMA rodada (na ordem: grupo a grupo, depois as em branco). */
// ------------------------------------------------- conferência do embaralhamento

/**
 * Coluna de conferência do embaralhamento (2º embaralhador confere e rubrica),
 * comum em campeonatos grandes para os melhores competidores:
 * - 'off': sem a coluna;
 * - 'all': em todas as súmulas;
 * - 'psych': nos N melhores da Psych Sheet da rodada (recorde pessoal);
 * - 'national': em quem está no top N do ranking nacional da modalidade.
 * Súmulas em branco (nome desconhecido) recebem a coluna sempre que ela está ligada.
 */
export interface CheckOption {
  mode: 'off' | 'all' | 'psych' | 'national'
  top: number
}
export const NO_CHECK: CheckOption = { mode: 'off', top: 10 }

export interface CardOptions {
  check: CheckOption
  /** Imprimir o número da estação/mesa (quando o WCIF tiver). */
  station: boolean
  /** Capa antes das súmulas de cada grupo. */
  covers?: boolean
}
const DEFAULT_CARD_OPTIONS: CardOptions = { check: NO_CHECK, station: false }

/** Quem recebe a coluna de conferência nesta rodada (registrantIds). */
export function checkedCompetitors(wcif: Wcif, plan: RoundPlan, opt: CheckOption): Set<number> {
  const all = plan.groups.flatMap((g) => g.competitors.map((c) => c.registrantId))
  if (opt.mode === 'off') return new Set()
  if (opt.mode === 'all') return new Set(all)
  const type = plan.info.round.format === 'a' || plan.info.round.format === 'm' ? 'average' : 'single'
  const byId = new Map(wcif.persons.map((p) => [p.registrantId, p]))
  const pbOf = (id: number) => {
    const pbs = byId.get(id)?.personalBests?.filter((b) => b.eventId === plan.info.eventId) ?? []
    return pbs.find((b) => b.type === type) ?? pbs.find((b) => b.type === 'single') ?? null
  }
  if (opt.mode === 'national')
    return new Set(
      all.filter((id) => {
        const r = pbOf(id)?.nationalRanking
        return r != null && r > 0 && r <= opt.top
      }),
    )
  // Psych Sheet: média (formatos a/m) ou single; sem recorde fica de fora.
  const ranked = all
    .map((id) => ({ id, pb: pbOf(id) }))
    .filter((x) => x.pb && x.pb.best > 0)
    .sort((a, b) => (a.pb!.worldRanking ?? Infinity) - (b.pb!.worldRanking ?? Infinity) || a.pb!.best - b.pb!.best)
  // Empate na N-ésima posição: entram todos os empatados.
  const cut = ranked[opt.top - 1]?.pb?.best
  return new Set(ranked.filter((x, i) => i < opt.top || (cut != null && x.pb!.best === cut)).map((x) => x.id))
}

export function buildRoundScorecards(
  wcif: Wcif,
  plan: RoundPlan,
  sel: RoundSelection,
  sortBy: SortBy,
  locale: Locale = 'pt',
  options: CardOptions = DEFAULT_CARD_OPTIONS,
): ScorecardModel[] {
  const checked = checkedCompetitors(wcif, plan, options.check)
  const layout = buildRoundLayout(plan.info.round, plan.info.eventId, locale)
  const base = {
    competitionName: wcif.name,
    eventName: eventLine(plan.info, locale),
    layout,
    roundId: plan.info.roundId,
  }
  const wanted = new Set(sel.groupKeys)
  const out: ScorecardModel[] = []
  const numbered = plan.groups.filter((g) => g.printed !== '')
  for (const g of plan.groups) {
    if (!wanted.has(g.key)) continue
    if (options.covers && g.competitors.length > 0) {
      const n = g.printed ? Number(g.printed) : null
      const sch = n != null ? groupSchedule(wcif, plan.info.roundId, n) : { start: null, end: null, rooms: [] }
      out.push({
        ...base,
        competitorId: '',
        wcaId: null,
        group: g.printed,
        competitorName: '',
        groupKey: g.key,
        cover: {
          locale,
          eventName: plan.info.eventName,
          roundText: roundName(plan.info, locale),
          roundNumber: plan.info.roundNumber,
          totalRounds: plan.info.totalRounds,
          groupNumber: n,
          groupCount: numbered.length,
          rooms: sch.rooms.length > 1 || hasManyRooms(wcif) ? sch.rooms.join(' · ') : '',
          scheduled: sch.start && sch.end ? `${sch.start}–${sch.end}` : null,
          sheets: g.competitors.length,
        },
      })
    }
    for (const c of sortCompetitors(g.competitors, sortBy, locale)) {
      out.push({
        ...base,
        competitorId: String(c.registrantId),
        wcaId: c.wcaId,
        group: g.printed,
        competitorName: c.name,
        groupKey: g.key,
        scrambleCheck: checked.has(c.registrantId),
        station: options.station ? (c.station ?? null) : null,
      })
    }
  }
  for (let i = 0; i < sel.blank; i++) {
    out.push({
      ...base,
      competitorId: '',
      wcaId: null,
      group: '',
      competitorName: '',
      groupKey: 'blank',
      scrambleCheck: options.check.mode !== 'off',
    })
  }
  return out
}

// ------------------------------------------------------------- em branco genéricas

/**
 * Tipos de súmula em branco que a competição usa (pelo número de tentativas
 * das rodadas: 5, 3, 2 ou 1). Sem rodadas reconhecidas, todos os tipos.
 */
export function blankTypesFor(wcif: Wcif): GenericAttempts[] {
  const used = new Set<number>()
  for (const info of listRounds(wcif)) {
    if (NO_SCORECARD_EVENTS.has(info.eventId)) continue
    used.add(attemptsFor(info.round.format))
  }
  const types = GENERIC_ATTEMPTS.filter((a) => used.has(a))
  return types.length ? types : [...GENERIC_ATTEMPTS]
}
/** Rodada "virtual" das súmulas em branco genéricas (uma por nº de tentativas). */
export const genericRoundId = (attempts: GenericAttempts) => `em-branco-${attempts}-tentativas`

/**
 * Súmulas em branco que NÃO dependem de modalidade (como no Groupifier): só a
 * competição (e a logo); modalidade, rodada, limite e corte para preencher à mão.
 */
export function buildGenericScorecards(
  competitionName: string,
  attempts: GenericAttempts,
  count: number,
  locale: Locale = 'pt',
  scrambleCheck = false,
): ScorecardModel[] {
  const layout = buildGenericLayout(attempts, locale)
  const S = SCORECARD_STRINGS[locale]
  const out: ScorecardModel[] = []
  for (let i = 0; i < count; i++)
    out.push({
      competitionName,
      eventName: S.blankEventLine,
      layout,
      roundId: genericRoundId(attempts),
      competitorId: '',
      wcaId: null,
      group: '',
      competitorName: '',
      groupKey: 'generic',
      scrambleCheck,
    })
  return out
}
