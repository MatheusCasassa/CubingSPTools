// Registro das ferramentas do CSPTools e das 4 categorias (usado pela Home e
// pelo menu). Para adicionar uma ferramenta, basta incluí-la em TOOLS: ela
// aparece no menu da categoria e na Home, sempre em ordem alfabética.
//
// Cores das categorias = faces do cubo "CSP" da logo da CubingSP: azul do P
// (Antes), vermelho do C (Durante), preto/branco do S (Depois — preto no tema
// claro, branco no escuro, por isso é a cor do texto) e o cinza de apoio da
// identidade visual (Auxiliares).
import type { ReactNode } from 'react'
import {
  CalcumulativeMark,
  CubeStaffMark,
  EasyPasswordMark,
  SchedManagerMark,
  ScoreCompsMark,
  SmartRanksMark,
  SortCuberMark,
  RepCheckMark,
  FMTimerMark,
} from '../components/ui/icons'
import type { Messages } from '../i18n/messages/pt'

export type Category = keyof Messages['home']['categories']

export const CATEGORIES: Category[] = ['before', 'during', 'after', 'aux']

/** Cor de cada categoria (valor CSS). */
export const CATEGORY_COLOR: Record<Category, string> = {
  before: 'rgb(var(--cat-before))', // azul do P (#1242B6; mais claro no escuro)
  during: '#e60000', // vermelho do C
  after: 'rgb(var(--fg))', // S: preto/branco
  aux: 'rgb(var(--fg-muted))', // cinza de apoio
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
    category: 'aux',
    ready: true,
    login: false,
    description: 'calcumulative',
  },
  {
    to: '/easypassword',
    name: 'EasyPassword',
    mark: (c) => <EasyPasswordMark className={c} />,
    category: 'during',
    ready: true,
    login: true,
    description: 'easypassword',
  },
  {
    to: '/schedmanager',
    name: 'SchedManager',
    mark: (c) => <SchedManagerMark className={c} />,
    category: 'during',
    ready: true,
    login: true,
    description: 'schedmanager',
  },
  {
    to: '/smartranks',
    name: 'SmartRanks',
    mark: (c) => <SmartRanksMark className={c} />,
    category: 'during',
    ready: true,
    login: true,
    description: 'smartranks',
  },
  {
    to: '/sortcuber',
    name: 'SortCuber',
    mark: (c) => <SortCuberMark className={c} />,
    category: 'during',
    ready: true,
    login: true,
    description: 'sortcuber',
  },
  {
    to: '/repcheck',
    name: 'RepCheck',
    mark: (c) => <RepCheckMark className={c} />,
    category: 'during',
    ready: true,
    login: true,
    description: 'repcheck',
  },
  {
    to: '/fmtimer',
    name: 'FMTimer',
    mark: (c) => <FMTimerMark className={c} />,
    category: 'during',
    ready: true,
    login: false,
    description: 'fmtimer',
  },
]

/** Ferramentas de uma categoria, em ordem alfabética (lançadas ou não). */
export function toolsIn(category: Category, tag: string): Tool[] {
  const collator = new Intl.Collator(tag, { sensitivity: 'base' })
  return TOOLS.filter((t) => t.category === category).sort((a, b) => collator.compare(a.name, b.name))
}

/** Ferramenta da página atual (caminho sem o prefixo de idioma), se houver. */
export function toolOfPath(path: string): Tool | null {
  return TOOLS.find((x) => path === x.to || path.startsWith(x.to + '/')) ?? null
}

/** Categoria da página atual (sem o prefixo de idioma), se for de uma ferramenta. */
export function categoryOfPath(path: string): Category | null {
  return toolOfPath(path)?.category ?? null
}
