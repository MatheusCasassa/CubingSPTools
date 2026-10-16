// Fontes do PDF (react-pdf).
//  • Arimo — desenho e métricas do Arial/Liberation Sans, a fonte em que o
//    Modelo_Aprovado foi renderizado (regular + negrito), em subconjuntos por
//    script (latin, latin-ext, cirílico, grego, hebraico, vietnamita);
//  • Noto Sans SC/KR — fallback CJK por glifo (react-pdf ≥ 3.4: fontFamily em
//    array). Só os subconjuntos com os caracteres usados são baixados.
//
// Também mede textos com as MESMAS fontes (fontkit), para o nome do competidor
// ocupar a largura do cartão sem nunca estourar — inclusive com CJK.

import { Font } from '@react-pdf/renderer'
import * as fontkit from 'fontkit'
import manifest from './fontManifest.json'

type Range = [number, number]
interface BaseEntry {
  subset: string
  ranges: Range[]
  files: Record<string, string>
}
interface FallbackEntry {
  family: string
  file: string
  ranges: Range[]
}

const BASE = manifest.base as unknown as BaseEntry[]
const FALLBACK = manifest.fallback as unknown as FallbackEntry[]
export const BASE_FAMILY = 'Arimo'

const inRanges = (cp: number, ranges: Range[]) => ranges.some(([a, b]) => cp >= a && cp <= b)

export interface FontAccess {
  /** Caminho relativo ("fonts/…") → URL (navegador) ou caminho de arquivo (Node). */
  resolve: (relPath: string) => string
  /** Lê os bytes da fonte (para medir textos). */
  load: (relPath: string) => Promise<Uint8Array>
}

interface Face {
  family: string
  weight: number
  font: fontkit.Font
}

export interface PreparedFonts {
  /** Pilha de famílias para `fontFamily` (ordem de preferência por glifo). */
  stack: string[]
  /** Largura do texto em unidades de "1 px de fonte" (multiplique pelo tamanho). */
  measure: (text: string, weight: number) => number
  /**
   * Deslocamento vertical (em unidades de "1 px de fonte") que põe a linha base
   * onde o navegador poria (CSS: meia-entrelinha + ascendente da fonte
   * PRINCIPAL). O react-pdf usa o maior ascendente da linha e não aplica
   * meia-entrelinha — sem esta correção, nomes com CJK desceriam ~0,26 em.
   */
  baselineShift: (text: string, weight: number, lineHeight: number) => number
}

const registered = new Set<string>()
const faceCache = new Map<string, Promise<fontkit.Font>>()
let hyphenationSet = false

function baseFamily(subset: string): string {
  return subset === 'latin' ? BASE_FAMILY : `${BASE_FAMILY}-${subset}`
}

function loadFace(rel: string, access: FontAccess): Promise<fontkit.Font> {
  let p = faceCache.get(rel)
  if (!p) {
    p = access.load(rel).then((bytes) => fontkit.create(bytes as unknown as Buffer) as fontkit.Font)
    faceCache.set(rel, p)
  }
  return p
}

/** Registra no react-pdf e carrega (para medição) as fontes que `texts` exigem. */
export async function prepareFonts(texts: Iterable<string>, access: FontAccess): Promise<PreparedFonts> {
  if (!hyphenationSet) {
    // Nunca hifenizar/quebrar palavras no meio (nomes próprios).
    Font.registerHyphenationCallback((word) => [word])
    hyphenationSet = true
  }

  const latin = BASE.find((e) => e.subset === 'latin')!
  const baseEntries: BaseEntry[] = [latin]
  const fallbacks: FallbackEntry[] = []
  const seen = new Set<number>()
  for (const t of texts) {
    for (const ch of t) {
      const cp = ch.codePointAt(0)!
      if (cp < 0x80 || seen.has(cp)) continue
      seen.add(cp)
      if (inRanges(cp, latin.ranges)) continue
      const ext = BASE.find((e) => e.subset !== 'latin' && inRanges(cp, e.ranges))
      if (ext) {
        if (!baseEntries.includes(ext)) baseEntries.push(ext)
        continue
      }
      const fb = FALLBACK.find((f) => inRanges(cp, f.ranges))
      if (fb && !fallbacks.includes(fb)) fallbacks.push(fb)
    }
  }

  const faces: Face[] = []
  for (const e of baseEntries) {
    const family = baseFamily(e.subset)
    if (!registered.has(family)) {
      Font.register({
        family,
        fonts: Object.entries(e.files).map(([w, f]) => ({ src: access.resolve(f), fontWeight: Number(w) })),
      })
      registered.add(family)
    }
    for (const [w, f] of Object.entries(e.files)) {
      faces.push({ family, weight: Number(w), font: await loadFace(f, access) })
    }
  }
  for (const fb of fallbacks) {
    if (!registered.has(fb.family)) {
      Font.register({ family: fb.family, src: access.resolve(fb.file), fontWeight: 700 })
      registered.add(fb.family)
    }
    faces.push({ family: fb.family, weight: 700, font: await loadFace(fb.file, access) })
  }

  const stack = [...baseEntries.map((e) => baseFamily(e.subset)), ...fallbacks.map((f) => f.family)]

  // Mesma regra do react-pdf: para cada caractere, a 1ª família da pilha que
  // tem o glifo; dentro da família, o peso mais próximo.
  const pick = (cp: number, weight: number): fontkit.Font | null => {
    for (const fam of stack) {
      const cands = faces.filter((f) => f.family === fam)
      if (cands.length === 0 || !cands[0].font.hasGlyphForCodePoint(cp)) continue
      cands.sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight))
      return cands[0].font
    }
    return null
  }

  // Mede por trechos contíguos na mesma fonte (mantém o kerning do trecho).
  const measure = (text: string, weight: number): number => {
    let w = 0
    let cur: fontkit.Font | null = null
    let buf = ''
    const flush = () => {
      if (cur && buf) w += cur.layout(buf).advanceWidth / cur.unitsPerEm
      buf = ''
    }
    for (const ch of text) {
      const f = pick(ch.codePointAt(0)!, weight) ?? faces[0].font
      if (f !== cur) {
        flush()
        cur = f
      }
      buf += ch
    }
    flush()
    return w
  }

  const primary = faces.find((f) => f.family === BASE_FAMILY && f.weight === 700)!.font
  const pA = primary.ascent / primary.unitsPerEm
  const pD = -primary.descent / primary.unitsPerEm

  const baselineShift = (text: string, weight: number, lineHeight: number): number => {
    let maxAsc = 0
    for (const ch of text) {
      const f = pick(ch.codePointAt(0)!, weight) ?? faces[0].font
      maxAsc = Math.max(maxAsc, f.ascent / f.unitsPerEm)
    }
    if (maxAsc === 0) maxAsc = pA
    const cssBaseline = (lineHeight - (pA + pD)) / 2 + pA
    return cssBaseline - maxAsc
  }

  return { stack, measure, baselineShift }
}
