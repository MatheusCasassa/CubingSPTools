// Leitura do arquivo de senhas do TNoodle
// ("<Competição> - Computer Display PDF Passcodes - SECRET.txt"):
//
//   SECRET SCRAMBLE SET PASSCODES
//   UNESP Rio Preto Open 2026
//   ...
//   3x3x3 Round 1 Scramble Set A: hjbingwa
//   3x3x3 Fewest Moves Round 1 Scramble Set A Attempt 1: fcfvuxq8

import type { PasscodeEntry } from '../../../lib/csp/server'

/** Nome do evento no TNoodle → id da WCA. */
const EVENT_IDS: Record<string, string> = {
  '3x3x3': '333',
  '2x2x2': '222',
  '4x4x4': '444',
  '5x5x5': '555',
  '6x6x6': '666',
  '7x7x7': '777',
  '3x3x3 blindfolded': '333bf',
  '3x3x3 fewest moves': '333fm',
  '3x3x3 one-handed': '333oh',
  clock: 'clock',
  megaminx: 'minx',
  pyraminx: 'pyram',
  skewb: 'skewb',
  'square-1': 'sq1',
  '4x4x4 blindfolded': '444bf',
  '5x5x5 blindfolded': '555bf',
  '3x3x3 multiple blindfolded': '333mbf',
  '3x3x3 multi-blind': '333mbf',
  'face-turning octahedron': 'fto',
}

export function eventIdOf(name: string): string | null {
  const k = name
    .toLowerCase()
    .replace(/\s+cube\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return EVENT_IDS[k] ?? null
}

const LINE = /^(.+?)\s+Round\s+(\d+)\s+Scramble\s+Set\s+([A-Z]{1,3})(?:\s+Attempt\s+(\d+))?\s*:\s*([A-Za-z0-9]+)\s*$/

export interface ParsedPasscodes {
  title: string
  entries: PasscodeEntry[]
  /** Linhas que pareciam senha mas não foram entendidas. */
  skipped: string[]
}

export function parsePasscodes(text: string): ParsedPasscodes {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim())
  const header = lines.findIndex((l) => /scramble set passcodes/i.test(l))
  const title = header >= 0 ? (lines.slice(header + 1).find((l) => l.length > 0) ?? '') : ''
  const entries: PasscodeEntry[] = []
  const skipped: string[] = []
  for (const l of lines) {
    if (!l.includes(':') || !/scramble set/i.test(l)) continue
    const m = l.match(LINE)
    if (!m) {
      skipped.push(l)
      continue
    }
    entries.push({
      event: m[1],
      eventId: eventIdOf(m[1]),
      round: Number(m[2]),
      set: m[3],
      attempt: m[4] ? Number(m[4]) : null,
      code: m[5],
    })
  }
  return { title, entries, skipped }
}

export interface PasscodeEvent {
  key: string
  event: string
  eventId: string | null
  rounds: { round: number; sets: PasscodeEntry[] }[]
}

/** Agrupa por evento (na ordem do arquivo) e rodada. */
export function groupPasscodes(entries: PasscodeEntry[]): PasscodeEvent[] {
  const out: PasscodeEvent[] = []
  for (const e of entries) {
    const key = e.eventId ?? e.event
    let ev = out.find((x) => x.key === key)
    if (!ev) out.push((ev = { key, event: e.event, eventId: e.eventId, rounds: [] }))
    let rd = ev.rounds.find((r) => r.round === e.round)
    if (!rd) ev.rounds.push((rd = { round: e.round, sets: [] }))
    rd.sets.push(e)
  }
  for (const ev of out) {
    ev.rounds.sort((a, b) => a.round - b.round)
    for (const r of ev.rounds) r.sets.sort((a, b) => (a.attempt ?? 0) - (b.attempt ?? 0) || a.set.localeCompare(b.set))
  }
  return out
}

/** Identificador estável de um set (para marcar como "já revelado"). */
export const setKey = (e: PasscodeEntry) => `${e.eventId ?? e.event}|${e.round}|${e.set}|${e.attempt ?? ''}`

/** Compara o título do arquivo com o nome da competição (ignora acentos e caixa). */
export function sameCompetition(title: string, name: string): boolean {
  const n = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  return n(title) === n(name)
}
