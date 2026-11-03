// Cliente do servidor do CSPTools (/api do Worker em worker/index.ts).
// Manda o token da WCA; o servidor confere na WCA o vínculo com a competição.

import { config } from '../config'
import type { PasscodeEntry, PasscodeFile, SchedChange, ScheduleDraft } from '../../../worker/api'

export type { PasscodeEntry, PasscodeFile, SchedChange, ScheduleDraft }

export class CspApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
    this.name = 'CspApiError'
  }
}

async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${config.cspApiBase}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new CspApiError(0, 'network')
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new CspApiError(res.status, data.error ?? 'server')
  return data as T
}

const id = (c: string) => encodeURIComponent(c)

/** Senhas guardadas (null se ninguém enviou o arquivo ainda). */
export async function getPasscodes(token: string, compId: string): Promise<PasscodeFile | null> {
  const data = await call<PasscodeFile | { empty: true }>(token, 'GET', `/passcodes/${id(compId)}`)
  return 'empty' in data ? null : data
}

export const putPasscodes = (
  token: string,
  compId: string,
  body: { entries: PasscodeEntry[]; fileName: string; title: string },
) => call<PasscodeFile>(token, 'PUT', `/passcodes/${id(compId)}`, body)

export const deletePasscodes = (token: string, compId: string) =>
  call<{ ok: true }>(token, 'DELETE', `/passcodes/${id(compId)}`)

export const getScheduleDraft = (token: string, compId: string) =>
  call<ScheduleDraft>(token, 'GET', `/schedule/${id(compId)}`)

export const patchScheduleDraft = (
  token: string,
  compId: string,
  changes: SchedChange[],
  savedToWca = false,
) => call<ScheduleDraft>(token, 'PATCH', `/schedule/${id(compId)}`, { changes, savedToWca })

export const clearScheduleDraft = (token: string, compId: string) =>
  call<ScheduleDraft>(token, 'DELETE', `/schedule/${id(compId)}`)
