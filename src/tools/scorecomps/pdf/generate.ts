// API usada pela interface: gera os arquivos (no Worker, com fallback para a
// thread principal) e entrega o download (PDF único ou ZIP).
import { zipSync } from 'fflate'
import type { RenderRequest, RenderProgress, RenderedFile } from './core'

function viaWorker(req: RenderRequest, onProgress: (p: RenderProgress) => void): Promise<RenderedFile[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' })
    } catch (e) {
      reject(e)
      return
    }
    worker.onmessage = (ev) => {
      const msg = ev.data
      if (msg.type === 'progress') onProgress(msg.progress)
      else if (msg.type === 'done') {
        worker.terminate()
        resolve(msg.files)
      } else if (msg.type === 'error') {
        worker.terminate()
        reject(new Error(msg.message))
      }
    }
    worker.onerror = (ev) => {
      worker.terminate()
      reject(new Error(ev.message || 'Falha no Worker de PDF'))
    }
    worker.postMessage(req)
  })
}

export async function generateFiles(
  req: RenderRequest,
  onProgress: (p: RenderProgress) => void,
): Promise<RenderedFile[]> {
  try {
    return await viaWorker(req, onProgress)
  } catch (e) {
    console.warn('[ScoreComps] Worker indisponível, gerando na thread principal:', e)
    const { renderInBrowser } = await import('./browserCore')
    return renderInBrowser(req, onProgress)
  }
}

export function triggerDownload(data: Uint8Array | Blob, filename: string, type = 'application/pdf'): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Um arquivo → PDF; vários → ZIP (sem recompressão: PDFs já são comprimidos). */
export function deliver(files: RenderedFile[], zipName: string): void {
  if (files.length === 1) {
    triggerDownload(files[0].data, files[0].name)
    return
  }
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {}
  for (const f of files) entries[f.name] = [f.data, { level: 0 }]
  triggerDownload(zipSync(entries), zipName, 'application/zip')
}

/** Abre o PDF numa nova aba (pré-visualização). */
export function openInNewTab(file: RenderedFile): void {
  const url = URL.createObjectURL(new Blob([file.data as BlobPart], { type: 'application/pdf' }))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
