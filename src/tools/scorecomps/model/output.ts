// Planejamento dos arquivos de saída: em quantos PDFs dividir, em que ordem
// as súmulas vão para a folha (natural ou corte e empilhe) e os nomes.
// Puro (sem React/DOM) — usado pela UI, pelo Worker e pelos scripts.

import type { ScorecardModel } from './logic'
import { padToPage, cutAndStack } from './order'
import { layoutFor, type PaperId } from '../pdf/paper'

export type OrderMode = 'natural' | 'stack'
export type SplitMode = 'single' | 'round' | 'group'

export interface RoundBatch {
  roundId: string
  /** Súmulas da rodada na ordem natural (grupo a grupo). */
  models: ScorecardModel[]
}

export interface OutputFile {
  name: string
  /** Posições na ordem final de impressão (`null` = posição vazia). */
  slots: (ScorecardModel | null)[]
  count: number
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Cada seção começa numa folha nova e é ordenada de forma independente. */
function arrange(models: ScorecardModel[], perPage: number, order: OrderMode): (ScorecardModel | null)[] {
  const padded = padToPage(models, perPage)
  return order === 'stack' && perPage > 1 ? cutAndStack(padded, perPage) : padded
}

export function planOutput(
  batches: RoundBatch[],
  opts: { competitionId: string; paperId: PaperId; order: OrderMode; split: SplitMode },
): OutputFile[] {
  const perPage = layoutFor(opts.paperId).perPage
  const comp = slug(opts.competitionId)
  const nonEmpty = batches.filter((b) => b.models.length > 0)

  if (opts.split === 'single') {
    const slots = nonEmpty.flatMap((b) => arrange(b.models, perPage, opts.order))
    const count = nonEmpty.reduce((n, b) => n + b.models.length, 0)
    return count ? [{ name: `sumulas-${comp}-${opts.paperId}.pdf`, slots, count }] : []
  }

  const files: OutputFile[] = []
  for (const b of nonEmpty) {
    const round = slug(b.roundId)
    if (opts.split === 'round') {
      files.push({ name: `${comp}-${round}.pdf`, slots: arrange(b.models, perPage, opts.order), count: b.models.length })
      continue
    }
    const keys: string[] = []
    for (const m of b.models) if (!keys.includes(m.groupKey)) keys.push(m.groupKey)
    for (const key of keys) {
      const models = b.models.filter((m) => m.groupKey === key)
      const suffix = key === 'blank' ? 'em-branco' : key === 'all' ? 'todos' : key
      files.push({ name: `${comp}-${round}-${suffix}.pdf`, slots: arrange(models, perPage, opts.order), count: models.length })
    }
  }
  return files
}

/** Todos os textos que vão para o PDF (para carregar só as fontes necessárias). */
export function textsOf(files: OutputFile[]): string[] {
  const out = new Set<string>()
  for (const f of files)
    for (const m of f.slots)
      if (m) {
        out.add(m.competitionName)
        out.add(m.eventName)
        out.add(m.competitorName)
      }
  return [...out]
}
