// Adaptação do núcleo para o navegador (Worker ou thread principal).
import { Buffer } from 'buffer'
import { pdf } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { renderCore, type RenderRequest, type RenderProgress, type RenderedFile } from './core'

// O react-pdf chama `Buffer.isBuffer` ao carregar imagens (logo); sem o
// polyfill a imagem não entra no cache e é embutida de novo em cada súmula.
const g = globalThis as unknown as { Buffer?: typeof Buffer }
if (!g.Buffer) g.Buffer = Buffer

function fontUrl(rel: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return new URL(base + rel, self.location.origin).href
}

export function renderInBrowser(
  req: RenderRequest,
  onProgress?: (p: RenderProgress) => void,
): Promise<RenderedFile[]> {
  return renderCore(
    req,
    {
      resolve: fontUrl,
      load: async (rel) => {
        const res = await fetch(fontUrl(rel))
        if (!res.ok) throw new Error(`Falha ao carregar a fonte ${rel} (${res.status})`)
        return new Uint8Array(await res.arrayBuffer())
      },
    },
    async (doc: ReactElement) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(doc as any).toBlob()
      return new Uint8Array(await blob.arrayBuffer())
    },
    onProgress,
  )
}
