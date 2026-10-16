// WCIF → plano de rodadas/grupos → lista de súmulas.
// Os grupos vêm do WCIF (atividades "evento-rN-gK" + assignments "competitor"),
// exatamente o contrato que o CubeStaff (ou Groupifier/Delegate Dashboard)
// grava na WCA. O ScoreComps só LÊ — nunca altera o WCIF.

import type { Wcif } from '../../../lib/wca/types'
import {
  listRounds,
  listGroups,
  competitorsInGroup,
  acceptedCompetitors,
  type RoundInfo,
  type Competitor,
} from '../../../lib/wca/wcif'
import { buildRoundLayout, type ScorecardModel } from './logic'
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
}

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

export function planRounds(wcif: Wcif): RoundPlan[] {
  const plans: RoundPlan[] = []
  for (const info of listRounds(wcif)) {
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
      plans.push({ info, groups, fromGroups: true, suggestedBlank: 0 })
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
      })
    } else {
      // Rodadas seguintes: classificados só existem no dia → súmulas em branco.
      plans.push({ info, groups: [], fromGroups: false, suggestedBlank: advancingFrom(prev) })
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
export function buildRoundScorecards(
  wcif: Wcif,
  plan: RoundPlan,
  sel: RoundSelection,
  sortBy: SortBy,
  locale: Locale = 'pt',
): ScorecardModel[] {
  const layout = buildRoundLayout(plan.info.round, plan.info.eventId, locale)
  const base = {
    competitionName: wcif.name,
    eventName: eventLine(plan.info, locale),
    layout,
    roundId: plan.info.roundId,
  }
  const wanted = new Set(sel.groupKeys)
  const out: ScorecardModel[] = []
  for (const g of plan.groups) {
    if (!wanted.has(g.key)) continue
    for (const c of sortCompetitors(g.competitors, sortBy, locale)) {
      out.push({
        ...base,
        competitorId: String(c.registrantId),
        wcaId: c.wcaId,
        group: g.printed,
        competitorName: c.name,
        groupKey: g.key,
      })
    }
  }
  for (let i = 0; i < sel.blank; i++) {
    out.push({ ...base, competitorId: '', wcaId: null, group: '', competitorName: '', groupKey: 'blank' })
  }
  return out
}
