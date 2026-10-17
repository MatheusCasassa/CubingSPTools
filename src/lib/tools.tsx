// Registro das ferramentas do CSPTools e das 4 categorias (usado pela Home e
// pelo menu). Para adicionar uma ferramenta, basta incluí-la em TOOLS: ela
// aparece no menu da categoria e na Home, sempre em ordem alfabética.
//
// Cores das categorias = cores da bandeira do Estado de São Paulo, que
// compõem o tema da CubingSP: azul (mapa), vermelho (retângulo), amarelo
// (estrelas) e as listras pretas e brancas (preto no tema claro, branco no
// escuro — por isso a 4ª cor é a do texto).
import type { ReactNode } from 'react'
import { CalcumulativeMark, CubeStaffMark, ScoreCompsMark } from '../components/ui/icons'
import type { Messages } from '../i18n/messages/pt'

export type Category = keyof Messages['home']['categories']

export const CATEGORIES: Category[] = ['before', 'during', 'after', 'aux']

/** Cor de cada categoria (valor CSS). */
export const CATEGORY_COLOR: Record<Category, string> = {
  before: '#3b5bea', // azul
  during: '#c81e3c', // vermelho
  after: '#f5c518', // amarelo
  aux: 'rgb(var(--fg))', // listras preto/branco
}

/** Âncora da categoria na Home (/#antes etc.). */
export const CATEGORY_ANCHOR: Record<Category, string> = {
  before: 'antes',
  during: 'durante',
  after: 'depois',
  aux: 'auxiliares',
}

export interface Tool {
  to: string
  name: string
  mark: (className: string) => ReactNode
  category: Category
  ready: boolean
  login: boolean
  description: keyof Messages['home']['tools']
}

export const TOOLS: Tool[] = [
  {
    to: '/scorecomps',
    name: 'ScoreComps',
    mark: (c) => <ScoreCompsMark className={c} />,
    category: 'before',
    ready: true,
    login: true,
    description: 'scorecomps',
  },
  {
    to: '/cubestaff',
    name: 'CubeStaff',
    mark: (c) => <CubeStaffMark className={c} />,
    category: 'before',
    ready: true,
    login: true,
    description: 'cubestaff',
  },
  {
    to: '/calcumulative',
    name: 'Calcumulative',
    mark: (c) => <CalcumulativeMark className={c} />,
    category: 'during',
    ready: true,
    login: false,
    description: 'calcumulative',
  },
]

/** Ferramentas de uma categoria, em ordem alfabética (lançadas ou não). */
export function toolsIn(category: Category, tag: string): Tool[] {
  const collator = new Intl.Collator(tag, { sensitivity: 'base' })
  return TOOLS.filter((t) => t.category === category).sort((a, b) => collator.compare(a.name, b.name))
}

/** Categoria da página atual (sem o prefixo de idioma), se for de uma ferramenta. */
export function categoryOfPath(path: string): Category | null {
  const t = TOOLS.find((x) => path === x.to || path.startsWith(x.to + '/'))
  return t ? t.category : null
}
