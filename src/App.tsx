import { lazy, Suspense, useEffect, type ReactElement } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { Spinner } from './components/ui/Feedback'
import { useI18n } from './i18n/I18nProvider'
import { stripLocale } from './i18n/locales'
import { toolOfPath } from './lib/tools'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

// Cada ferramenta só é baixada quando é aberta (o ScoreComps leva react-pdf e fontkit).
const ScoreCompsHome = lazy(() => import('./tools/scorecomps/ui/ScoreCompsHome'))
const CompetitionPage = lazy(() => import('./tools/scorecomps/ui/CompetitionPage'))
const CalcumulativePage = lazy(() => import('./tools/calcumulative/ui/CalcumulativePage'))
const CubeStaffHome = lazy(() => import('./tools/cubestaff/ui/CubeStaffHome'))
const CompetitionStaffPage = lazy(() => import('./tools/cubestaff/ui/CompetitionStaffPage'))
const CubeStaffManual = lazy(() => import('./tools/cubestaff/ui/ManualPage'))
const EasyPasswordHome = lazy(() => import('./tools/easypassword/ui/EasyPassword').then((x) => ({ default: x.EasyPasswordHome })))
const EasyPasswordPage = lazy(() => import('./tools/easypassword/ui/EasyPassword'))
const SchedManagerHome = lazy(() => import('./tools/schedmanager/ui/SchedManager').then((x) => ({ default: x.SchedManagerHome })))
const SchedManagerPage = lazy(() => import('./tools/schedmanager/ui/SchedManager'))
const SmartRanksHome = lazy(() => import('./tools/smartranks/ui/SmartRanks').then((x) => ({ default: x.SmartRanksHome })))
const SmartRanksPage = lazy(() => import('./tools/smartranks/ui/SmartRanks'))
const SortCuberHome = lazy(() => import('./tools/sortcuber/ui/SortCuber').then((x) => ({ default: x.SortCuberHome })))
const SortCuberPage = lazy(() => import('./tools/sortcuber/ui/SortCuber'))

const PAGES: { path: string; element: ReactElement }[] = [
  { path: '', element: <Home /> },
  { path: 'scorecomps', element: <ScoreCompsHome /> },
  { path: 'scorecomps/:competitionId', element: <CompetitionPage /> },
  { path: 'calcumulative', element: <CalcumulativePage /> },
  { path: 'cubestaff', element: <CubeStaffHome /> },
  { path: 'cubestaff/manual', element: <CubeStaffManual /> },
  { path: 'cubestaff/:competitionId', element: <CompetitionStaffPage /> },
  { path: 'easypassword', element: <EasyPasswordHome /> },
  { path: 'easypassword/:competitionId', element: <EasyPasswordPage /> },
  { path: 'schedmanager', element: <SchedManagerHome /> },
  { path: 'schedmanager/:competitionId', element: <SchedManagerPage /> },
  { path: 'smartranks', element: <SmartRanksHome /> },
  { path: 'smartranks/:competitionId', element: <SmartRanksPage /> },
  { path: 'sortcuber', element: <SortCuberHome /> },
  { path: 'sortcuber/:competitionId', element: <SortCuberPage /> },
]

// Português sem prefixo; inglês em /en/… e espanhol em /es/… (como o site da CubingSP).
const PREFIXES = ['', 'en', 'es']

/** Título da aba, como no site da CubingSP: "CSPTools" na home e
 *  "Ferramenta | CSPTools" nas demais páginas. */
function usePageTitle() {
  const { pathname } = useLocation()
  const { m } = useI18n()
  useEffect(() => {
    const path = stripLocale(pathname).replace(/\/+$/, '') || '/'
    const brand = m.meta.title
    const page = path === '/' ? null : (toolOfPath(path)?.name ?? m.notFound.title)
    document.title = page ? `${page} | ${brand}` : brand
  }, [pathname, m])
}

export default function App() {
  const { m } = useI18n()
  usePageTitle()
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<Spinner label={m.common.loading} />}>
          <Routes>
            {PREFIXES.flatMap((prefix) =>
              PAGES.map((p) => (
                <Route
                  key={`${prefix}/${p.path}`}
                  path={'/' + [prefix, p.path].filter(Boolean).join('/')}
                  element={p.element}
                />
              )),
            )}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
