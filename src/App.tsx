import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { Spinner } from './components/ui/Feedback'
import Home from './pages/Home'
import CubeStaff from './pages/CubeStaff'
import NotFound from './pages/NotFound'

// O ScoreComps (react-pdf, fontkit…) só é baixado quando a ferramenta é aberta.
const ScoreCompsHome = lazy(() => import('./tools/scorecomps/ui/ScoreCompsHome'))
const CompetitionPage = lazy(() => import('./tools/scorecomps/ui/CompetitionPage'))
const CalcumulativePage = lazy(() => import('./tools/calcumulative/ui/CalcumulativePage'))

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<Spinner label="Carregando…" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/scorecomps" element={<ScoreCompsHome />} />
            <Route path="/scorecomps/:competitionId" element={<CompetitionPage />} />
            <Route path="/calcumulative" element={<CalcumulativePage />} />
            <Route path="/cubestaff" element={<CubeStaff />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
