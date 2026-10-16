// Hora confiável: em vez do relógio do aparelho (que a pessoa pode mudar),
// usamos a hora do NOSSO servidor (cabeçalho HTTP `Date` da Cloudflare, em
// UTC). Mudar o relógio ou o fuso do aparelho não altera o resultado.
//
// Se o servidor não responder (offline), cai no relógio do aparelho.

let offsetMs = 0 // hora do servidor − hora do aparelho
let synced: Promise<void> | null = null

async function sync(): Promise<void> {
  const base = import.meta.env.BASE_URL || '/'
  const t0 = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetch(`${base}favicon.svg?t=${t0}`, { method: 'HEAD', cache: 'no-store', signal: ctrl.signal })
    const t1 = Date.now()
    const header = res.headers.get('Date')
    const server = header ? Date.parse(header) : NaN
    // O cabeçalho tem resolução de 1 s: +500 ms centraliza o erro.
    if (Number.isFinite(server)) offsetMs = server + 500 - (t0 + t1) / 2
  } catch {
    /* sem rede: fica o relógio do aparelho */
  } finally {
    clearTimeout(timer)
  }
}

/** Sincroniza (uma vez por carregamento da página). */
export function syncTrustedTime(): Promise<void> {
  if (!synced) synced = sync()
  return synced
}

/** Agora, pela hora do servidor. */
export function trustedNow(): Date {
  return new Date(Date.now() + offsetMs)
}

/** Diferença do relógio do aparelho para o servidor (ms), para diagnóstico. */
export function clockSkewMs(): number {
  return offsetMs
}
