// Dados guardados SÓ neste navegador (nunca vão para a WCA):
//  - rascunho automático do plano (para não perder nada antes de salvar);
//  - dados privados do formulário de staff: e-mail, WhatsApp, respostas do
//    teste de embaralhamento.
// Tudo em try/catch: em janela anônima ou com armazenamento bloqueado o app
// continua funcionando, só não lembra.

import type { Wcif } from '../../../lib/wca/types'
import type { Plan } from './types'

export interface PrivateInfo {
  email?: string
  phone?: string
  appliesText?: string
  notes?: { question: string; answer: string }[]
}

export interface LocalDraft {
  plan: Plan
  /** Revisão da extensão na WCA quando o rascunho começou. */
  baseRevision: number
  savedAt: string
}

const key = (kind: string, competitionId: string) => `cubestaff.${kind}.${competitionId}`

function read<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(k: string, v: unknown): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(v))
    return true
  } catch {
    return false
  }
}

function remove(k: string) {
  try {
    localStorage.removeItem(k)
  } catch {
    /* ignora */
  }
}

export const loadDraft = (id: string) => read<LocalDraft>(key('draft', id))
export const saveDraft = (id: string, d: LocalDraft) => write(key('draft', id), d)
export const clearDraft = (id: string) => remove(key('draft', id))

export const loadPrivate = (id: string) => read<Record<string, PrivateInfo>>(key('private', id)) ?? {}
export const savePrivate = (id: string, data: Record<string, PrivateInfo>) => write(key('private', id), data)

/** Apaga tudo o que o CubeStaff guardou neste navegador para a competição. */
export function clearLocal(id: string) {
  remove(key('draft', id))
  remove(key('private', id))
  remove(key('preview', id))
}

// ScoreComps: WCIF com os grupos ainda não publicados (mesmo navegador).
export const PREVIEW_PARAM = 'cubestaff'
export const savePreviewWcif = (id: string, wcif: Wcif) =>
  write(key('preview', id), { wcif, savedAt: new Date().toISOString() })
export const loadPreviewWcif = (id: string) => read<{ wcif: Wcif; savedAt: string }>(key('preview', id))
