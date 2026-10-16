import { Link } from 'react-router-dom'
import { CubeStaffMark } from '../components/ui/icons'

const PLANNED = [
  ['Grupos por ranking', 'Semeadura pelos recordes pessoais, grupos equilibrados ou agrupados por nível.'],
  ['Staff automático', 'Juízes, Embaralhadores e Runners distribuídos com as regras da sua competição.'],
  ['Integrado à WCA', 'Salva as atribuições no WCIF oficial — o mesmo dado que o ScoreComps lê.'],
  ['Revisão manual', 'Ajuste qualquer pessoa ou grupo antes de salvar, com avisos de conflito.'],
]

export default function CubeStaff() {
  return (
    <div className="container-page py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-4">
          <CubeStaffMark className="h-14 w-14" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">CubeStaff</h1>
            <p className="text-sm text-fg-muted">Agrupamento e atribuição de tarefas — em breve</p>
          </div>
        </div>
        <p className="mt-8 text-lg leading-relaxed">
          O CubeStaff vai gerar os grupos e as tarefas de staff da competição e gravá-los direto na WCA. Assim que
          estiverem salvos, o <Link to="/scorecomps" className="font-medium text-brand-500 hover:underline dark:text-brand-300">ScoreComps</Link>{' '}
          já imprime as súmulas com os grupos certos.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PLANNED.map(([title, text]) => (
            <div key={title} className="card p-5">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-fg-muted">
          Enquanto isso, grupos criados no Groupifier ou no Delegate Dashboard já funcionam no ScoreComps.
        </p>
      </div>
    </div>
  )
}
