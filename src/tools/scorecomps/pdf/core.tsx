// Núcleo de geração: o MESMO código roda no Web Worker (navegador) e no Node
// (scripts/render-samples.tsx), mudando só como as fontes são lidas e como o
// documento vira bytes.

import type { ReactElement } from 'react'
import { ScorecardDocument } from './ScorecardDocument'
import { prepareFonts, type FontAccess } from './fonts'
import { textsOf, type OutputFile } from '../model/output'
import type { PaperId } from './paper'
import type { Logo } from './ScorecardDocument'

export interface RenderRequest {
  files: OutputFile[]
  paperId: PaperId
  cutLines: boolean
  /** Logo da competição (PNG em data URL + proporção) ou null. */
  logo: Logo | null
  title: string
}

export interface RenderProgress {
  done: number
  total: number
  current: string
}

export interface RenderedFile {
  name: string
  data: Uint8Array
}

export async function renderCore(
  req: RenderRequest,
  access: FontAccess,
  toBytes: (doc: ReactElement) => Promise<Uint8Array>,
  onProgress?: (p: RenderProgress) => void,
): Promise<RenderedFile[]> {
  const texts = textsOf(req.files)
  const fonts = await prepareFonts(texts, access)
  const out: RenderedFile[] = []
  for (let i = 0; i < req.files.length; i++) {
    const f = req.files[i]
    onProgress?.({ done: i, total: req.files.length, current: f.name })
    const doc = (
      <ScorecardDocument
        slots={f.slots}
        options={{ paperId: req.paperId, cutLines: req.cutLines, fonts, logo: req.logo, title: req.title }}
      />
    )
    out.push({ name: f.name, data: await toBytes(doc) })
  }
  onProgress?.({ done: req.files.length, total: req.files.length, current: '' })
  return out
}
