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
import { watermarkOpacity } from '../model/watermark'
import { SCORECARD_STRINGS } from '../model/strings'

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

/** Marca d'água: até 80% da largura e 70% da altura do cartão (transparência em model/watermark.ts). */
const WATERMARK_MAX_W = 0.8
const WATERMARK_MAX_H = 0.7

export interface CardProps {
  model: ScorecardModel
  /** Retângulo do cartão na página, em pt. */
  rect: Rect
  fonts: PreparedFonts
  /** Logo pequena ao lado do nome da competição. */
  logo?: Logo | null
  /** Logo grande e bem apagada no fundo do cartão. */
  watermark?: Logo | null
  /** Transparência da marca d'água, em % (50–95). */
  watermarkTransparency?: number
  /** Centro da marca d'água: o cartão inteiro ou só os desenhos (cabeçalho, caixas). */
  watermarkCenter?: WatermarkCenter
}

/** 'card' = centro do cartão; 'content' = centro do que está desenhado. */
export type WatermarkCenter = 'card' | 'content'

export function Card({ model, rect, fonts, logo, watermark, watermarkTransparency, watermarkCenter = 'card' }: CardProps): ReactElement {
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

  const check = !!model.scrambleCheck
  const solveRow = (row: ScorecardRow, key: string) => {
    // Com conferência: S | conferência | resultado | J | C (como nos campeonatos grandes).
    const cells = [...(check ? ['s', 'k'] : ['s']), 't', ...(row.isExtra ? ['d'] : []), 'j', 'c']
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
  const colLabel = (label: string, w: number, size = 12.5) => (
    <View style={{ width: s(w), alignItems: 'center', justifyContent: 'center' }}>
      <T size={size} weight={BOLD}>{label}</T>
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
      {watermark && watermarkCenter === 'card' ? (
        <Watermark logo={watermark} rect={rect} opacity={watermarkOpacity(watermarkTransparency)} />
      ) : null}
      {/* Tudo o que é desenhado fica neste bloco: com a marca d'água
          "no conteúdo", ela é centralizada nele (e não no cartão inteiro). */}
      <View style={{ position: 'relative' }}>
      {watermark && watermarkCenter === 'content' ? (
        <ContentWatermark logo={watermark} rect={rect} opacity={watermarkOpacity(watermarkTransparency)} />
      ) : null}
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
            {L.idLabel ?? 'ID'}
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
            <T size={16} weight={REG} color={EVENT} lh={1.1} style={{ textAlign: 'center', marginTop: s(1) }}>
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
            {L.groupLabel ?? 'GRUPO'}
          </T>
          <T size={20} weight={BOLD}>{model.group || ' '}</T>
        </View>
      </View>

      {/* Nome do competidor — largura total do cartão */}
      <View style={{ paddingVertical: s(4), paddingHorizontal: s(5), alignItems: 'center' }}>
        <T size={nameSize} weight={BOLD} lh={1.08} style={{ textAlign: 'center' }}>
          {blank ? ' ' : model.competitorName}
        </T>
        {model.wcaId || model.station ? (
          <T size={9.5} weight={BOLD} color={MUTED} style={{ marginTop: s(1) }}>
            {[model.wcaId, model.station ? `${L.stationLabel ?? 'Station'} ${model.station}` : null]
              .filter(Boolean)
              .join('  ·  ')}
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
          {check ? colLabel(L.checkLabel ?? 'CHECK', SIG_W, 10) : null}
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
    </View>
  )
}

/** Borda externa do cartão: traço de 0.4 mm centrado na borda, raio 2.6 mm. */

/**
 * Marca d'água centralizada no cartão. É o primeiro filho do cartão, então
 * fica ATRÁS de linhas e textos (o cartão não tem fundo opaco).
 */
function Watermark({ logo, rect, opacity }: { logo: Logo; rect: Rect; opacity: number }): ReactElement {
  const w = Math.min(rect.w * WATERMARK_MAX_W, rect.h * WATERMARK_MAX_H * logo.aspect)
  const h = w / logo.aspect
  return (
    <Image
      src={logo.src}
      style={{
        position: 'absolute',
        left: (rect.w - w) / 2,
        top: (rect.h - h) / 2,
        width: w,
        height: h,
        opacity,
      }}
    />
  )
}

/**
 * Marca d'água centralizada no bloco desenhado (cabeçalho, nome e caixas), que
 * costuma não ocupar a altura toda do cartão. Mesmo tamanho máximo da versão
 * "cartão", limitado à altura do bloco.
 */
function ContentWatermark({ logo, rect, opacity }: { logo: Logo; rect: Rect; opacity: number }): ReactElement {
  const w = Math.min(rect.w * WATERMARK_MAX_W, rect.h * WATERMARK_MAX_H * logo.aspect)
  const h = w / logo.aspect
  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      <Image src={logo.src} style={{ width: w, height: h, maxHeight: '92%', objectFit: 'contain', opacity }} />
    </View>
  )
}

/**
 * Capa de um grupo (no lugar de uma súmula): identifica o maço e traz o
 * controle do Delegado e da equipe de dados, com horário previsto × real.
 */
export function CoverCard({ model, rect, fonts }: { model: ScorecardModel; rect: Rect; fonts: PreparedFonts }): ReactElement {
  const c = model.cover!
  const S = SCORECARD_STRINGS[c.locale].cover
  const k = Math.min(rect.w / DESIGN_W, rect.h / MIN_DESIGN_H)
  const s = (v: number) => v * k
  const txt = (size: number, weight = REG, color = INK) => ({
    fontFamily: fonts.stack,
    fontSize: s(size),
    fontWeight: weight,
    color,
    lineHeight: 1.2,
  })
  const GREY = '#8a8f9c'
  const line = <View style={{ flex: 1, height: s(0.8), backgroundColor: INK }} />
  const section = (label: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s(24), marginBottom: s(8) }}>
      {line}
      <Text style={{ ...txt(14, BOLD), marginHorizontal: s(10) }}>{label}</Text>
      {line}
    </View>
  )
  const box = (
    <View style={{ width: s(14), height: s(14), borderWidth: s(1), borderColor: INK, marginLeft: s(6) }} />
  )
  const blank = (w: number) => <View style={{ width: s(w), borderBottomWidth: s(0.8), borderColor: INK, marginLeft: s(4), height: s(13) }} />
  const item = (n: number, text: string, tail?: ReactElement) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: s(10), paddingLeft: s(20) }}>
      <Text style={txt(13.5)}>
        {n}. {text}
      </Text>
      {tail}
    </View>
  )
  const initials = (label: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginTop: s(9) }}>
      <Text style={txt(14, BOLD)}>{label}</Text>
      {blank(64)}
    </View>
  )
  return (
    <View
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        paddingHorizontal: s(14),
        paddingTop: s(24),
      }}
    >
      <Text style={{ ...txt(16), textAlign: 'center' }}>{model.competitionName}</Text>
      <Text style={{ ...txt(23, BOLD), textAlign: 'center', marginTop: s(4) }}>
        {c.eventName} {c.roundText}
        {c.totalRounds > 1 && c.roundNumber < c.totalRounds ? (
          <Text style={{ color: GREY }}>{` ${S.of} ${c.totalRounds}`}</Text>
        ) : null}
      </Text>
      {c.groupNumber != null ? (
        <Text style={{ ...txt(30, BOLD), textAlign: 'center', marginTop: s(2) }}>
          {S.group} {c.groupNumber}
          <Text style={{ color: GREY }}>{` ${S.of} ${c.groupCount}`}</Text>
        </Text>
      ) : null}
      {c.rooms ? <Text style={{ ...txt(13, BOLD, MUTED), textAlign: 'center', marginTop: s(2) }}>{c.rooms}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginTop: s(12) }}>
        <Text style={txt(12.5)}>
          {S.scheduled} {c.scheduled ?? '—'} · {S.actual}
        </Text>
        {blank(34)}
        <Text style={{ ...txt(12.5), marginLeft: s(2) }}>–</Text>
        {blank(34)}
        <Text style={{ ...txt(12.5), marginLeft: s(4) }}>· {S.set}</Text>
        {blank(22)}
      </View>

      {section(S.delegate)}
      {item(1, S.grouped(c.sheets), box)}
      {item(2, S.signatures, box)}
      {item(3, S.incidents, blank(34))}
      <View style={{ marginTop: s(6) }}>{initials(S.delegateInitials)}</View>

      {section(S.data)}
      {item(4, S.entered)}
      {initials(S.enteredInitials)}
      {item(5, S.incidentsLogged)}
      {initials(S.delegateInitials)}
      {item(6, S.verified)}
      {initials(S.delegateInitials)}
    </View>
  )
}

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
  watermark?: Logo | null
  watermarkTransparency?: number
  watermarkCenter?: WatermarkCenter
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
                {m.cover ? (
                  <CoverCard model={m} rect={toPt(layout.cards[si])} fonts={options.fonts} />
                ) : (
                  <Card model={m} rect={toPt(layout.cards[si])} fonts={options.fonts} logo={options.logo} watermark={options.watermark} watermarkTransparency={options.watermarkTransparency} watermarkCenter={options.watermarkCenter} />
                )}
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
