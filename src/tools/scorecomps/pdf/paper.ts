// Tamanhos de folha e posição das súmulas (estilo Groupifier): as súmulas
// ocupam a folha inteira e linhas de corte tracejadas passam pelas calhas.
// Unidades em mm.

export type PaperId = 'a4' | 'letter' | 'a5' | 'a6' | 'a7'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export interface Line {
  x1: number
  y1: number
  x2: number
  y2: number
}
export interface PageLayout {
  paperId: PaperId
  pageW: number
  pageH: number
  perPage: number
  cards: Rect[]
  cutLines: Line[]
}

interface PaperDef {
  label: string
  short: string
  w: number
  h: number
  cols: number
  rows: number
  margin: number
  gutter: number
}

export const PAPERS: Record<PaperId, PaperDef> = {
  a4: { label: 'A4 — 4 súmulas por folha', short: 'A4', w: 210, h: 297, cols: 2, rows: 2, margin: 6, gutter: 8 },
  letter: { label: 'Carta (Letter) — 4 por folha', short: 'Carta', w: 215.9, h: 279.4, cols: 2, rows: 2, margin: 7, gutter: 8 },
  a5: { label: 'A5 — 1 súmula grande por folha', short: 'A5', w: 148, h: 210, cols: 1, rows: 1, margin: 7, gutter: 0 },
  a6: { label: 'A6 — 1 súmula por folha', short: 'A6', w: 105, h: 148, cols: 1, rows: 1, margin: 5, gutter: 0 },
  a7: { label: 'A7 — 1 súmula pequena por folha', short: 'A7', w: 74, h: 105, cols: 1, rows: 1, margin: 4, gutter: 0 },
}

export const PAPER_IDS = Object.keys(PAPERS) as PaperId[]

export function layoutFor(paperId: PaperId): PageLayout {
  const p = PAPERS[paperId]
  const cellW = (p.w - 2 * p.margin - (p.cols - 1) * p.gutter) / p.cols
  const cellH = (p.h - 2 * p.margin - (p.rows - 1) * p.gutter) / p.rows
  const cards: Rect[] = []
  for (let r = 0; r < p.rows; r++)
    for (let c = 0; c < p.cols; c++)
      cards.push({ x: p.margin + c * (cellW + p.gutter), y: p.margin + r * (cellH + p.gutter), w: cellW, h: cellH })

  const inset = 3
  const cutLines: Line[] = []
  for (let c = 1; c < p.cols; c++) {
    const x = p.margin + c * cellW + (c - 0.5) * p.gutter
    cutLines.push({ x1: x, y1: inset, x2: x, y2: p.h - inset })
  }
  for (let r = 1; r < p.rows; r++) {
    const y = p.margin + r * cellH + (r - 0.5) * p.gutter
    cutLines.push({ x1: inset, y1: y, x2: p.w - inset, y2: y })
  }
  return { paperId, pageW: p.w, pageH: p.h, perPage: p.cols * p.rows, cards, cutLines }
}

export const MM_TO_PT = 72 / 25.4
