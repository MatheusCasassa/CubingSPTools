// Gera PDFs de amostra no Node com EXATAMENTE o mesmo código do navegador
// (planejamento, ordem, fontes e documento react-pdf).
//   npm run samples            → samples/*.pdf
//   npm run samples -- --logo caminho/logo.png
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { demoWcif } from '../src/tools/scorecomps/model/demo'
import { planRounds, buildRoundScorecards } from '../src/tools/scorecomps/model/build'
import { planOutput, type OrderMode, type SplitMode } from '../src/tools/scorecomps/model/output'
import { renderCore } from '../src/tools/scorecomps/pdf/core'
import type { PaperId } from '../src/tools/scorecomps/pdf/paper'

const root = resolve(import.meta.dirname, '..')
const pub = join(root, 'public')
const outDir = join(root, 'samples')

const logoArg = process.argv.indexOf('--logo')
// (amostra: proporção informada por --aspect, padrão 1)
const aspectArg = process.argv.indexOf('--aspect')
const logo =
  logoArg > 0
    ? {
        src: `data:image/png;base64,${(await readFile(process.argv[logoArg + 1])).toString('base64')}`,
        aspect: aspectArg > 0 ? Number(process.argv[aspectArg + 1]) : 1,
      }
    : null

const wcif = demoWcif()
const plans = planRounds(wcif)
const batches = plans.map((p) => ({
  roundId: p.info.roundId,
  models: buildRoundScorecards(
    wcif,
    p,
    { roundId: p.info.roundId, groupKeys: p.groups.map((g) => g.key), blank: Math.min(p.suggestedBlank, 4) },
    'name',
  ),
}))

const variants: { paper: PaperId; order: OrderMode; split: SplitMode; tag: string }[] = [
  { paper: 'a4', order: 'natural', split: 'single', tag: 'a4-natural' },
  { paper: 'a4', order: 'stack', split: 'single', tag: 'a4-empilhar' },
  { paper: 'letter', order: 'natural', split: 'single', tag: 'carta' },
  { paper: 'a5', order: 'natural', split: 'single', tag: 'a5' },
  { paper: 'a6', order: 'natural', split: 'single', tag: 'a6' },
  { paper: 'a7', order: 'natural', split: 'single', tag: 'a7' },
]

await mkdir(outDir, { recursive: true })
for (const v of variants) {
  const files = planOutput(batches, { competitionId: wcif.id, paperId: v.paper, order: v.order, split: v.split })
  const t0 = Date.now()
  const rendered = await renderCore(
    { files, paperId: v.paper, cutLines: true, logo, title: wcif.name },
    {
      resolve: (rel) => join(pub, rel),
      load: async (rel) => new Uint8Array(await readFile(join(pub, rel))),
    },
    async (doc) => new Uint8Array(await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0])),
  )
  for (const f of rendered) await writeFile(join(outDir, `amostra-${v.tag}${logo ? '-logo' : ''}.pdf`), f.data)
  console.log(`${v.tag}: ${files[0].count} súmulas, ${files[0].slots.length} posições, ${Date.now() - t0} ms`)
}
