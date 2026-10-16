import { lazy, Suspense, type ReactElement } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { Spinner } from './components/ui/Feedback'
import { useI18n } from './i18n/I18nProvider'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

// Cada ferramenta só é baixada quando é aberta (o ScoreComps leva react-pdf e fontkit).
const ScoreCompsHome = lazy(() => import('./tools/scorecomps/ui/ScoreCompsHome'))
const CompetitionPage = lazy(() => import('./tools/scorecomps/ui/CompetitionPage'))
const CalcumulativePage = lazy(() => import('./tools/calcumulative/ui/CalcumulativePage'))
const CubeStaffHome = lazy(() => import('./tools/cubestaff/ui/CubeStaffHome'))
const CompetitionStaffPage = lazy(() => import('./tools/cubestaff/ui/CompetitionStaffPage'))
const CubeStaffManual = lazy(() => import('./tools/cubestaff/ui/ManualPage'))

const PAGES: { path: string; element: ReactElement }[] = [
  { path: '', element: <Home /> },
  { path: 'scorecomps', element: <ScoreCompsHome /> },
  { path: 'scorecomps/:competitionId', element: <CompetitionPage /> },
  { path: 'calcumulative', element: <CalcumulativePage /> },
  { path: 'cubestaff', element: <CubeStaffHome /> },
  { path: 'cubestaff/manual', element: <CubeStaffManual /> },
  { path: 'cubestaff/:competitionId', element: <CompetitionStaffPage /> },
]

// Português sem prefixo; inglês em /en/… e espanhol em /es/… (como o site da CubingSP).
const PREFIXES = ['', 'en', 'es']

export default function App() {
  const { m } = useI18n()
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
