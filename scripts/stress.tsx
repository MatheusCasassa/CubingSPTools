// Pior caso: nomes enormes (latinos, CJK sem espaços, polonês, vietnamita),
// nome da competição em 3 linhas, logo, Ao5 com corte e limite cumulativo —
// em TODOS os tamanhos de folha. Nada pode sair do cartão.
//   npm run stress [-- caminho/logo.png]   → samples/stress-*.pdf
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { renderCore } from '../src/tools/scorecomps/pdf/core'
import { buildRoundLayout } from '../src/tools/scorecomps/model/logic'
import { PAPER_IDS } from '../src/tools/scorecomps/pdf/paper'
const pub = join(process.cwd(), 'public')
const layout = buildRoundLayout({ id: '444-r1', format: 'a', timeLimit: { centiseconds: 18000, cumulativeRoundIds: ['444-r1', '555-r1'] }, cutoff: { numberOfAttempts: 2, attemptResult: 9000 }, advancementCondition: null }, '444')
const names = ['Maria Luíza Albuquerque de Vasconcellos Cavalcanti Figueiredo Bragança Orléans', '欧阳娜娜欧阳娜娜欧阳娜娜欧阳娜娜欧阳娜娜欧阳娜娜欧阳', 'Wójcik-Szczepańska Agnieszka Małgorzata', 'Nguyễn Thị Minh Khai']
const models = names.map((n, i) => ({ competitionName: 'Campeonato Paulista de Cubo Mágico Oficial da Federação Edição Especial 2026', eventName: '4x4x4 Cube · Rodada 1', competitorId: String(100 + i), wcaId: '2019ABCD01', group: '12', competitorName: n, layout, roundId: '444-r1', groupKey: 'g1' }))
const logo = process.argv[2]
  ? { src: `data:image/png;base64,${(await readFile(process.argv[2])).toString('base64')}`, aspect: 1 }
  : null
await mkdir('samples', { recursive: true })
for (const paperId of PAPER_IDS) {
  const [f] = await renderCore({ files: [{ name: 'x', slots: models, count: 4 }], paperId, cutLines: true, logo, title: 'stress' },
    { resolve: (r) => join(pub, r), load: async (r) => new Uint8Array(await readFile(join(pub, r))) },
    async (doc) => new Uint8Array(await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0])))
  await writeFile(`samples/stress-${paperId}.pdf`, f.data)
}
console.log('ok')
