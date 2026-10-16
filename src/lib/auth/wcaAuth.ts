// Fluxo OAuth 2.0 "implicit grant" contra a WCA — o mesmo usado pelo
// Groupifier e pelo AGE (comprovadamente aceito pela WCA). O token volta no
// fragmento (#) da URL de redirecionamento; não há troca de código nem secret.

import { config } from '../config'

const LS_TOKEN = 'wca_scorecards.token'
const SS_STATE = 'wca_scorecards.oauth_state'
const SS_RETURN = 'wca_scorecards.return_to'

export interface StoredToken {
  accessToken: string
  /** epoch ms de expiração (WCA: expires_in ~2h, com margem de 15 min). */
  expiresAt: number
  scope: string
}

/** String aleatória segura (usada como `state` anti-CSRF). */
function randomString(length = 24): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  let out = ''
  for (const v of values) out += charset[v % charset.length]
  return out
}

/**
 * Inicia o login: guarda o `state` e a página de origem e redireciona à WCA
 * (response_type=token). A WCA sempre volta para a RAIZ do app (a única
 * redirect URI registrada); de lá voltamos para `returnTo`.
 */
export function beginLogin(returnTo: string = window.location.pathname): void {
  const state = randomString(24)
  sessionStorage.setItem(SS_STATE, state)
  sessionStorage.setItem(SS_RETURN, returnTo)
  const params = new URLSearchParams({
    client_id: config.wcaClientId,
    redirect_uri: config.redirectUri,
    response_type: 'token',
    scope: config.scopes.join(' '),
    state,
  })
  window.location.assign(`${config.wcaAuthorizeUrl}?${params.toString()}`)
}

/**
 * Se a URL atual traz o token no fragmento (#access_token=...), valida o
 * `state`, persiste o token, limpa o hash e retorna o token. Senão, null.
 */
export function consumeRedirect(): StoredToken | null {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash || !hash.includes('access_token')) {
    // Pode vir erro no fragmento também.
    if (hash.includes('error')) {
      const p = new URLSearchParams(hash)
      throw new Error(p.get('error_description') || `Erro OAuth: ${p.get('error')}`)
    }
    return null
  }

  const p = new URLSearchParams(hash)
  const accessToken = p.get('access_token')
  const state = p.get('state')
  const expectedState = sessionStorage.getItem(SS_STATE)

  // Limpa o fragmento e volta para a página onde o login começou.
  const base = import.meta.env.BASE_URL || '/'
  const returnTo = sessionStorage.getItem(SS_RETURN)
  sessionStorage.removeItem(SS_RETURN)
  window.history.replaceState({}, '', returnTo && returnTo.startsWith('/') ? returnTo : base)

  if (!accessToken) return null
  if (expectedState && state !== expectedState) {
    throw new Error('State inválido no retorno do login (possível CSRF).')
  }
  sessionStorage.removeItem(SS_STATE)

  const expiresIn = Number(p.get('expires_in') || 7200)
  const token: StoredToken = {
    accessToken,
    expiresAt: Date.now() + Math.max(60, expiresIn - 15 * 60) * 1000,
    scope: p.get('scope') ?? config.scopes.join(' '),
  }
  saveToken(token)
  return token
}

export function saveToken(token: StoredToken): void {
  localStorage.setItem(LS_TOKEN, JSON.stringify(token))
}

export function loadToken(): StoredToken | null {
  const raw = localStorage.getItem(LS_TOKEN)
  if (!raw) return null
  try {
    const token = JSON.parse(raw) as StoredToken
    if (!token.accessToken || token.expiresAt <= Date.now()) {
      localStorage.removeItem(LS_TOKEN)
      return null
    }
    return token
  } catch {
    localStorage.removeItem(LS_TOKEN)
    return null
  }
}

export function logout(): void {
  localStorage.removeItem(LS_TOKEN)
}

// O retorno do login é lido UMA vez, antes do React/roteador montar
// (main.tsx chama takeRedirectResult()), para que a URL limpa (sem #token)
// e a página de retorno já estejam valendo quando o roteador ler a URL.
let redirectResult: { token: StoredToken | null; error: string | null } | null = null

export function takeRedirectResult(): { token: StoredToken | null; error: string | null } {
  if (!redirectResult) {
    try {
      redirectResult = { token: consumeRedirect(), error: null }
    } catch (e) {
      redirectResult = { token: null, error: e instanceof Error ? e.message : String(e) }
    }
  }
  return redirectResult
}
