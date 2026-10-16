// Súmula em VETOR (react-pdf). Reproduz o Modelo_Aprovado medida a medida:
// todas as dimensões abaixo estão em "px de projeto" de um cartão com 397 px
// de largura (105 mm a 96 dpi) e são escaladas UNIFORMEMENTE para o retângulo
// de cada súmula na folha — o desenho é o mesmo em A4, Carta, A5, A6 e A7.
//
// Este arquivo roda igual no navegador (Web Worker) e no Node (scripts de
// verificação), então o PDF conferido aqui é exatamente o que o usuário baixa.

import { Document, Page, View, Text, Image, Svg, Line } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { ScorecardModel, ScorecardRow } from '../model/logic'
import { layoutFor, MM_TO_PT, type PaperId, type Rect } from './paper'
import type { PreparedFonts } from './fonts'

// ------------------------------------------------------------------ medidas
/** Largura de projeto do cartão (px). */
export const DESIGN_W = 397

const INK = '#14161c'
const MUTED = '#6b7180'
const EVENT = '#2b2f3a'
const PEN = '#3a3f4b'

// Linhas: no Modelo_Aprovado todas as linhas saíram com 1 px de projeto
// (o 1.8 px do CSS foi arredondado para 1 px na renderização aprovada).
const THICK = 1
const THIN = 1
// Pesos: a fonte do modelo aprovado só tem regular e negrito
// (500 → regular, 600/700 → negrito).
const REG = 400
const BOLD = 700
const NUM_W = 34
const SIG_W = 40
const ROW_H = 42
const ROW_GAP = 5
const HEAD_SIDE_W = 46

/** Altura de projeto mínima garantida (px). */
const MIN_DESIGN_H = 530
/** Fração da largura que o nome ocupa no máximo (como no modelo aprovado). */
const NAME_FILL = 0.97

/**
 * Tamanho do nome: o maior entre 11.5 e 22 px que cabe numa linha, medido com
 * as próprias fontes do PDF (inclui CJK). Abaixo de 11.5 px o nome quebra em
 * duas linhas, nunca estoura o cartão.
 */
export function nameFontPx(name: string, fonts: PreparedFonts, nameW = DESIGN_W - 26): number {
  const unit = fonts.measure(name, 700)
  if (unit <= 0) return 22
  const px = (nameW * NAME_FILL) / unit
  return Math.floor(Math.max(11.5, Math.min(22, px)) * 10) / 10
}

// ------------------------------------------------------------------ cartão
/** Logo da competição: PNG/JPEG (data URL) + proporção largura/altura. */
export interface Logo {
  src: string
  aspect: number
}

const LOGO_H = 28
const LOGO_MAX_W = 56
const LOGO_GAP = 5

export interface CardProps {
  model: ScorecardModel
  /** Retângulo do cartão na página, em pt. */
  rect: Rect
  fonts: PreparedFonts
  logo?: Logo | null
}

export function Card({ model, rect, fonts, logo }: CardProps): ReactElement {
  // pt por px de projeto. Normalmente a largura manda; em folhas "largas"
  // (Carta) a altura mínima garante espaço para o pior caso (corte + nome em
  // 2 linhas + logo) sem estourar o cartão.
  const k = Math.min(rect.w / DESIGN_W, rect.h / MIN_DESIGN_H)
  const designW = rect.w / k
  const nameW = designW - 2 * 8 - 2 * 5
  // Largura útil da célula do meio do cabeçalho (descontando ID/Grupo,
  // bordas e respiro) — o nome da competição quebra linha dentro dela.
  const logoW = logo ? Math.min(LOGO_MAX_W, LOGO_H * logo.aspect) : 0
  const midTextW = designW - 2 * 8 - 2 * THICK - 2 * HEAD_SIDE_W - 2 * 5 - (logo ? logoW + LOGO_GAP : 0)
  const s = (v: number) => v * k
  const L = model.layout
  const blank = model.competitorName === ''

  const txt = (size: number, weight: number, color = INK, lh = 1.1) => ({
    fontFamily: fonts.stack,
    fontSize: s(size),
    fontWeight: weight,
    color,
    lineHeight: lh,
  })

  /**
   * Texto com a linha base na mesma posição do navegador (modelo aprovado):
   * desloca só o desenho (position: relative), sem alterar o layout.
   */
  const T = ({
    children,
    size,
    weight,
    color = INK,
    lh = 1.1,
    style = {},
  }: {
    children: string
    size: number
    weight: number
    color?: string
    lh?: number
    style?: Record<string, unknown>
  }) => (
    <Text
      style={{
        ...txt(size, weight, color, lh),
        position: 'relative',
        top: s(size * fonts.baselineShift(children, weight, lh)),
        ...style,
      }}
    >
      {children}
    </Text>
  )

  const solveRow = (row: ScorecardRow, key: string) => {
    const cells = row.isExtra ? ['s', 't', 'd', 'j', 'c'] : ['s', 't', 'j', 'c']
    return (
      <View key={key} style={{ flexDirection: 'row', height: s(ROW_H), marginBottom: s(ROW_GAP) }}>
        <View style={{ width: s(NUM_W), alignItems: 'center', justifyContent: 'center' }}>
          <T size={21} weight={BOLD}>{row.label}</T>
        </View>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            borderWidth: s(THICK),
            borderColor: INK,
            borderStyle: 'solid',
            borderRadius: s(4),
          }}
        >
          {cells.map((c, i) => (
            <View
              key={c}
              style={{
                ...(c === 't' ? { flex: 1 } : { width: s(SIG_W) }),
                ...(i < cells.length - 1
                  ? { borderRightWidth: s(THIN), borderRightColor: INK, borderRightStyle: 'solid' }
                  : {}),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {c === 'd' && (
                <T size={24} weight={BOLD} lh={1} style={{ opacity: 0.25 }}>
                  D
                </T>
              )}
            </View>
          ))}
        </View>
      </View>
    )
  }

  const centerLine = (
    content: string,
    style: { size: number; weight: number; color?: string },
    pad: [number, number, number, number],
  ) => (
    <View style={{ paddingTop: s(pad[0]), paddingRight: s(pad[1]), paddingBottom: s(pad[2]), paddingLeft: s(pad[3]) }}>
      <T {...style} style={{ textAlign: 'center' }}>
        {content}
      </T>
    </View>
  )

  // Rótulos S / J / C centrados EXATAMENTE sobre as colunas das caixas
  // (as caixas têm borda externa de 1.8 px; os rótulos descontam essa borda).
  const colLabel = (label: string, w: number) => (
    <View style={{ width: s(w), alignItems: 'center' }}>
      <T size={12.5} weight={BOLD}>{label}</T>
    </View>
  )

  const nameSize = blank ? 20 : nameFontPx(model.competitorName, fonts, nameW)

  return (
    <View
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        paddingTop: s(7),
        paddingHorizontal: s(8),
        paddingBottom: s(8),
        flexDirection: 'column',
      }}
    >
      {/* Cabeçalho: ID | Competição/Evento | Grupo */}
      <View
        style={{
          flexDirection: 'row',
          borderWidth: s(THICK),
          borderColor: INK,
          borderStyle: 'solid',
          borderRadius: s(6),
        }}
      >
        <View
          style={{
            width: s(HEAD_SIDE_W),
            paddingVertical: s(3),
            paddingHorizontal: s(5),
            alignItems: 'center',
            justifyContent: 'center',
            borderRightWidth: s(THIN),
            borderRightColor: INK,
            borderRightStyle: 'solid',
          }}
        >
          <T size={8.5} weight={BOLD} color={MUTED} style={{ letterSpacing: s(8.5 * 0.04) }}>
            ID
          </T>
          <T size={20} weight={BOLD}>{model.competitorId || ' '}</T>
        </View>
        <View
          style={{
            flex: 1,
            paddingVertical: s(3),
            paddingHorizontal: s(5),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {logo ? (
            <Image
              src={logo.src}
              style={{ width: s(logoW), height: s(LOGO_H), objectFit: 'contain', marginRight: s(LOGO_GAP) }}
            />
          ) : null}
          <View style={{ maxWidth: s(midTextW), alignItems: 'center' }}>
            <T size={13} weight={BOLD} lh={1.05} style={{ textAlign: 'center' }}>
              {model.competitionName}
            </T>
            <T size={10.5} weight={REG} color={EVENT} style={{ textAlign: 'center', marginTop: s(1) }}>
              {model.eventName}
            </T>
          </View>
        </View>
        <View
          style={{
            width: s(HEAD_SIDE_W),
            paddingVertical: s(3),
            paddingHorizontal: s(5),
            alignItems: 'center',
            justifyContent: 'center',
            borderLeftWidth: s(THIN),
            borderLeftColor: INK,
            borderLeftStyle: 'solid',
          }}
        >
          <T size={8.5} weight={BOLD} color={MUTED} style={{ letterSpacing: s(8.5 * 0.04) }}>
            GRUPO
          </T>
          <T size={20} weight={BOLD}>{model.group || ' '}</T>
        </View>
      </View>

      {/* Nome do competidor — largura total do cartão */}
      <View style={{ paddingVertical: s(4), paddingHorizontal: s(5), alignItems: 'center' }}>
        <T size={nameSize} weight={BOLD} lh={1.08} style={{ textAlign: 'center' }}>
          {blank ? ' ' : model.competitorName}
        </T>
        {model.wcaId ? (
          <T size={9.5} weight={BOLD} color={MUTED} style={{ marginTop: s(1) }}>
            {model.wcaId}
          </T>
        ) : null}
      </View>

      {/* Configuração: DNF / cumulativo + exemplo de penalidade */}
      {L.dnfText || L.penaltyText ? (
        <View style={{ paddingTop: s(3), paddingHorizontal: s(4), paddingBottom: s(5), alignItems: 'center' }}>
          {L.dnfText ? (
            <T size={12.5} weight={BOLD} style={{ textAlign: 'center' }}>
              {L.dnfText}
            </T>
          ) : null}
          {L.penaltyText ? (
            <T size={10} weight={REG} color={PEN} style={{ textAlign: 'center', marginTop: s(1) }}>
              {L.penaltyText}
            </T>
          ) : null}
        </View>
      ) : null}

      {/* Cabeçalho das colunas */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: s(2) }}>
        <View style={{ width: s(NUM_W), alignItems: 'center' }}>
          <T size={14} weight={BOLD}>#</T>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: s(THICK) }}>
          {colLabel('S', SIG_W)}
          <View style={{ flex: 1 }} />
          {colLabel('J', SIG_W)}
          {colLabel('C', SIG_W)}
        </View>
      </View>

      {L.block1.map((r) => solveRow(r, r.label))}
      {L.block2.length > 0 ? (
        <>
          {centerLine(L.cutoffText, { size: 11, weight: BOLD, color: EVENT }, [2, 4, 4, 4])}
          {L.block2.map((r) => solveRow(r, r.label))}
        </>
      ) : null}
      {centerLine(L.extrasText, { size: 12, weight: BOLD }, [2, 4, 4, 4])}
      {L.extras.map((r) => solveRow(r, r.label))}
    </View>
  )
}

/** Borda externa do cartão: traço de 0.4 mm centrado na borda, raio 2.6 mm. */
export function CardBorder({ rect }: { rect: Rect }): ReactElement {
  const lw = 0.4 * MM_TO_PT
  return (
    <View
      style={{
        position: 'absolute',
        left: rect.x - lw / 2,
        top: rect.y - lw / 2,
        width: rect.w + lw,
        height: rect.h + lw,
        borderWidth: lw,
        borderColor: '#141414',
        borderStyle: 'solid',
        borderRadius: 2.6 * MM_TO_PT + lw / 2,
      }}
    />
  )
}

// ------------------------------------------------------------------ documento
export interface DocumentOptions {
  paperId: PaperId
  cutLines: boolean
  /** Fontes já preparadas (prepareFonts). */
  fonts: PreparedFonts
  logo?: Logo | null
  title?: string
}

/**
 * Monta o documento. `slots` já vem na ordem final de impressão (natural ou
 * corte e empilhe); `null` = posição vazia na folha.
 */
export function ScorecardDocument({
  slots,
  options,
}: {
  slots: (ScorecardModel | null)[]
  options: DocumentOptions
}): ReactElement {
  const layout = layoutFor(options.paperId)
  const pageW = layout.pageW * MM_TO_PT
  const pageH = layout.pageH * MM_TO_PT
  const pages: (ScorecardModel | null)[][] = []
  for (let i = 0; i < slots.length; i += layout.perPage) pages.push(slots.slice(i, i + layout.perPage))

  const toPt = (r: Rect): Rect => ({ x: r.x * MM_TO_PT, y: r.y * MM_TO_PT, w: r.w * MM_TO_PT, h: r.h * MM_TO_PT })

  return (
    <Document title={options.title} creator="ScoreComps" producer="ScoreComps">
      {pages.map((page, pi) => (
        <Page key={pi} size={[pageW, pageH]} style={{ backgroundColor: '#ffffff' }}>
          {page.map((m, si) =>
            m ? (
              <View key={si}>
                <Card model={m} rect={toPt(layout.cards[si])} fonts={options.fonts} logo={options.logo} />
                <CardBorder rect={toPt(layout.cards[si])} />
              </View>
            ) : null,
          )}
          {options.cutLines && layout.cutLines.length > 0 ? (
            // Altura 1 pt menor que a folha: evita o aviso de "quebra de página"
            // do react-pdf (as linhas terminam 3 mm antes da borda).
            <Svg
              style={{ position: 'absolute', left: 0, top: 0, width: pageW, height: pageH - 1 }}
              viewBox={`0 0 ${pageW} ${pageH - 1}`}
            >
              {layout.cutLines.map((l, i) => (
                <Line
                  key={i}
                  x1={l.x1 * MM_TO_PT}
                  y1={l.y1 * MM_TO_PT}
                  x2={l.x2 * MM_TO_PT}
                  y2={l.y2 * MM_TO_PT}
                  stroke="#969696"
                  strokeWidth={0.25 * MM_TO_PT}
                  strokeDasharray={`${1.4 * MM_TO_PT} ${1.4 * MM_TO_PT}`}
                />
              ))}
            </Svg>
          ) : null}
        </Page>
      ))}
    </Document>
  )
}
