// Web Worker: gera os PDFs fora da thread da interface (a página não trava
// mesmo com centenas de súmulas).
import { renderInBrowser } from './browserCore'
import type { RenderRequest } from './core'

self.onmessage = async (ev: MessageEvent<RenderRequest>) => {
  try {
    const files = await renderInBrowser(ev.data, (p) => self.postMessage({ type: 'progress', progress: p }))
    self.postMessage(
      { type: 'done', files },
      { transfer: files.map((f) => f.data.buffer as ArrayBuffer) },
    )
  } catch (e) {
    self.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}
